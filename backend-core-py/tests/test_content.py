"""
Content management — G1 (banners) and G3 (CMS copy), against a real database.

The rules worth testing are all about *not* showing something:

- A banner that is `is_active` but out of its date window must not render. The
  window test is a plain `is_active` check would fail, so the tests set up a
  banner that is active, not started, and one that has ended, and assert neither
  appears.
- A CMS key that has never been written must be a 200 with a null, not a 404.
  The storefront's contract is "fall back to the copy compiled into the
  frontend", and it can only honour that if absence is not an error.
- An admin write must clear its own cache entry, or the change is invisible for
  the length of the TTL. The tests read through the public route, write through
  the admin route, and read again -- so an uninvalidated cache fails here rather
  than in production.
- A `target_url` of `javascript:...` must be refused. It renders as an href.

Skipped unless TEST_DATABASE_URL is set.

    TEST_DATABASE_URL=postgresql://... python -m pytest tests/test_content.py -v
"""
import json
import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()

# The shipped migration, read at run time rather than transcribed. See
# `_seed_sql` for why the seed is re-applied from the file.
MIGRATION_SQL = (
    Path(__file__).resolve().parents[2] / "db" / "migrations" / "V11__content_cms.sql"
)

_SEED_START = "INSERT INTO cms_content"
_SEED_END = "ON CONFLICT (key) DO NOTHING;"


def _seed_sql() -> str:
    """
    V11's CMS seed, exactly as the migration ships it.

    Deliberately sliced out of the file instead of re-written here. Several other
    suites get a clean slate with `TRUNCATE users ... CASCADE`, and TRUNCATE
    follows foreign keys outward -- `cms_content.updated_by` references `users`,
    so the seed V11 writes is gone by the time this file runs. The tests below
    would then report an empty database rather than a correct one, which is the
    failure mode where a suite stays green and measures nothing.

    Re-applying the shipped SQL makes this file order-independent *and* checks
    two things the tests otherwise could not: that the migration on disk matches
    the schema in the database, and that the migration is re-runnable, which is
    what the `ON CONFLICT` is for and what a deploy relies on.
    """
    text = MIGRATION_SQL.read_text(encoding="utf-8")
    start = text.index(_SEED_START)
    end = text.index(_SEED_END, start) + len(_SEED_END)
    return text[start:end]


def auth_header(user_id: str, role: str = "admin", email: str = "admin@example.com") -> dict:
    from jose import jwt

    from app.config import settings

    token = jwt.encode(
        {"id": str(user_id), "email": email, "role": role, "name": "T", "exp": 9999999999},
        settings.JWT_ACCESS_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def err(response) -> dict:
    try:
        body = response.json()
    except ValueError:
        return {}
    error = body.get("error", body)
    if not isinstance(error, dict):
        return {}
    merged = {k: v for k, v in error.items() if k != "data"}
    if isinstance(error.get("data"), dict):
        merged.update(error["data"])
    return merged


def iso(dt: datetime) -> str:
    return dt.isoformat()


@unittest.skipUnless(TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping content tests")
class ContentTests(unittest.IsolatedAsyncioTestCase):
    maxDiff = None

    async def asyncSetUp(self):
        import asyncpg

        self.pool = await asyncpg.create_pool(dsn=TEST_DATABASE_URL, min_size=1, max_size=4)

        # The same clean slate every other suite takes. `users` has to be
        # truncated rather than deleted: other suites leave products and orders
        # behind, and `products.seller_id` is a hard reference, so a plain DELETE
        # is a foreign key violation the moment this file runs after them.
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")

        # ...which truncated the CMS seed along with it (see `_seed_sql`). Put it
        # back from the migration itself, so this class does not depend on what
        # ran before it.
        await self.pool.execute(_seed_sql())

        # The content cache is a process-wide in-memory fallback store, so
        # truncating the tables does not clear it. Without this, a test that
        # reads a slot inherits the previous test's answer and reports three
        # banners where it created one -- a green suite that measures nothing.
        from app.redis_client import cache
        from app.routers.content import BANNER_PLACEMENTS, banner_cache_key

        for placement in BANNER_PLACEMENTS:
            await cache.delete(banner_cache_key(placement))

        from app.db import set_pool

        set_pool(self.pool)

        import httpx

        from app.main import app

        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        )

        self.admin_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Admin','admin@example.com','x','admin') RETURNING id"
            )
        )
        self.customer_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Buyer','buyer@example.com','x','customer') RETURNING id"
            )
        )
        self.headers = auth_header(self.admin_id, "admin", "admin@example.com")
        self.customer_headers = auth_header(self.customer_id, "customer", "buyer@example.com")

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.pool.execute("DELETE FROM cms_content WHERE key LIKE 'home.test%'")
        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    # -- fixtures ---------------------------------------------------------

    async def make_banner(self, **kw) -> str:
        defaults = {
            "title": "Sale",
            "url": "/media/x.webp",
            "placement": "homepage_hero",
            "is_active": True,
            "sort_order": 0,
        }
        defaults.update(kw)
        # asyncpg binds a timestamptz parameter as a real datetime or refuses it
        # outright ("expected a datetime.date or datetime.datetime instance, got
        # 'str'"), so an ISO string is not an option even for a fixture.
        for field in ("start_at", "end_at"):
            if isinstance(defaults.get(field), str):
                defaults[field] = datetime.fromisoformat(defaults[field])
        cols = ", ".join(defaults)
        marks = ", ".join(f"${i + 1}" for i in range(len(defaults)))
        return str(
            await self.pool.fetchval(
                f"INSERT INTO banners ({cols}) VALUES ({marks}) RETURNING id",
                *defaults.values(),
            )
        )

    async def read_slot(self, placement: str = "homepage_hero") -> list:
        r = await self.client.get(f"/api/content/banners?placement={placement}")
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["data"]

    # =====================================================================
    # G1. Banners
    # =====================================================================

    async def test_a_live_banner_is_returned(self):
        await self.make_banner(title="Mega Sale", cta_label="Shop", target_url="/explore")
        slot = await self.read_slot()
        self.assertEqual(len(slot), 1)
        self.assertEqual(slot[0]["title"], "Mega Sale")
        self.assertEqual(slot[0]["cta_label"], "Shop")
        self.assertEqual(slot[0]["target_url"], "/explore")

    async def test_an_inactive_banner_is_not_returned(self):
        await self.make_banner(title="Hidden", is_active=False)
        self.assertEqual(await self.read_slot(), [])

    async def test_a_banner_that_has_not_started_is_not_returned(self):
        # The one a plain `is_active` filter gets wrong.
        await self.make_banner(
            title="Next Week",
            start_at=iso(datetime.now(timezone.utc) + timedelta(days=7)),
        )
        self.assertEqual(await self.read_slot(), [])

    async def test_a_banner_that_has_ended_is_not_returned(self):
        await self.make_banner(
            title="Last Week",
            start_at=iso(datetime.now(timezone.utc) - timedelta(days=7)),
            end_at=iso(datetime.now(timezone.utc) - timedelta(days=1)),
        )
        self.assertEqual(await self.read_slot(), [])

    async def test_a_banner_inside_its_window_is_returned(self):
        await self.make_banner(
            title="This Week",
            start_at=iso(datetime.now(timezone.utc) - timedelta(days=1)),
            end_at=iso(datetime.now(timezone.utc) + timedelta(days=1)),
        )
        slot = await self.read_slot()
        self.assertEqual([b["title"] for b in slot], ["This Week"])

    async def test_banners_come_back_in_sort_order(self):
        await self.make_banner(title="Third", sort_order=30)
        await self.make_banner(title="First", sort_order=10)
        await self.make_banner(title="Second", sort_order=20)
        slot = await self.read_slot()
        self.assertEqual([b["title"] for b in slot], ["First", "Second", "Third"])

    async def test_slots_do_not_leak_into_each_other(self):
        await self.make_banner(title="Hero", placement="homepage_hero")
        await self.make_banner(title="Promo", placement="pdp_promo")
        self.assertEqual([b["title"] for b in await self.read_slot("homepage_hero")], ["Hero"])
        self.assertEqual([b["title"] for b in await self.read_slot("pdp_promo")], ["Promo"])

    async def test_an_unknown_slot_is_a_400_naming_the_allowed_ones(self):
        # Not an empty list: an empty array is indistinguishable from "no
        # campaigns configured", which is the answer you do not want at 2am.
        r = await self.client.get("/api/content/banners?placement=homepage_everything")
        self.assertEqual(r.status_code, 400, r.text)
        body = err(r)
        self.assertEqual(body.get("code"), "UNKNOWN_PLACEMENT")
        self.assertIn("homepage_hero", body.get("allowed", []))

    async def test_every_slot_comes_back_from_the_all_endpoint(self):
        await self.make_banner(title="Hero", placement="homepage_hero")
        await self.make_banner(title="Promo", placement="pdp_promo")
        r = await self.client.get("/api/content/banners/homepage_hero/all")
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        # Empty slots are present as empty arrays, not omitted, so the frontend
        # can index without a guard on every access.
        self.assertEqual(data["homepage_strip"], [])
        self.assertEqual([b["title"] for b in data["homepage_hero"]], ["Hero"])
        self.assertEqual([b["title"] for b in data["pdp_promo"]], ["Promo"])

    async def test_the_public_read_needs_no_auth(self):
        await self.make_banner(title="Public")
        r = await self.client.get("/api/content/banners?placement=homepage_hero")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["data"]), 1)

    # -- cache invalidation ------------------------------------------------

    async def test_a_new_banner_is_visible_on_the_public_read_immediately(self):
        # Read once to fill the cache, then create, then read again. If the write
        # did not clear its own slot, the second read is the stale answer.
        self.assertEqual(await self.read_slot(), [])
        r = await self.client.post(
            "/api/admin/banners",
            headers=self.headers,
            json={"title": "Just Added", "url": "/media/a.webp", "placement": "homepage_hero"},
        )
        self.assertEqual(r.status_code, 201, r.text)
        slot = await self.read_slot()
        self.assertEqual([b["title"] for b in slot], ["Just Added"])

    async def test_deactivating_a_banner_removes_it_from_the_public_read(self):
        await self.make_banner(title="On")
        self.assertEqual(len(await self.read_slot()), 1)

        bid = await self.pool.fetchval("SELECT id FROM banners LIMIT 1")
        r = await self.client.put(
            f"/api/admin/banners/{bid}", headers=self.headers, json={"is_active": False}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.read_slot(), [])

    async def test_deleting_a_banner_removes_it_from_the_public_read(self):
        await self.make_banner(title="Bye")
        self.assertEqual(len(await self.read_slot()), 1)
        bid = await self.pool.fetchval("SELECT id FROM banners LIMIT 1")
        r = await self.client.delete(f"/api/admin/banners/{bid}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.read_slot(), [])

    async def test_moving_a_banner_between_slots_clears_both(self):
        await self.make_banner(title="Mover", placement="homepage_hero")
        self.assertEqual(len(await self.read_slot("homepage_hero")), 1)
        self.assertEqual(len(await self.read_slot("pdp_promo")), 0)

        bid = await self.pool.fetchval("SELECT id FROM banners LIMIT 1")
        r = await self.client.put(
            f"/api/admin/banners/{bid}",
            headers=self.headers,
            json={"placement": "pdp_promo"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        # Both slots. A write that only cleared the new one would leave the
        # banner visible in the slot it just left.
        self.assertEqual(len(await self.read_slot("homepage_hero")), 0)
        self.assertEqual([b["title"] for b in await self.read_slot("pdp_promo")], ["Mover"])

    # -- admin CRUD --------------------------------------------------------

    async def test_a_created_banner_really_lands_in_the_database(self):
        r = await self.client.post(
            "/api/admin/banners",
            headers=self.headers,
            json={
                "title": "Persisted",
                "url": "/media/p.webp",
                "placement": "category_top",
                "cta_label": "Browse",
                "target_url": "/explore?category=1",
                "sort_order": 5,
            },
        )
        self.assertEqual(r.status_code, 201, r.text)
        bid = r.json()["data"]["id"]
        row = await self.pool.fetchrow("SELECT * FROM banners WHERE id = $1::uuid", bid)
        self.assertIsNotNone(row, "201 but no row")
        self.assertEqual(row["title"], "Persisted")
        self.assertEqual(row["placement"], "category_top")
        self.assertEqual(row["cta_label"], "Browse")
        self.assertEqual(int(row["sort_order"]), 5)
        # And the author is recorded, because a creative with no owner is one
        # nobody can be asked about when it is wrong.
        self.assertEqual(str(row["created_by"]), self.admin_id)

    async def test_a_javascript_target_url_is_refused(self):
        # It renders as an href. A CMS editor must not be able to ship script.
        r = await self.client.post(
            "/api/admin/banners",
            headers=self.headers,
            json={
                "title": "XSS",
                "url": "/media/x.webp",
                "target_url": "javascript:alert(document.cookie)",
            },
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIsNone(
            await self.pool.fetchval("SELECT 1 FROM banners WHERE title = 'XSS'")
        )

    async def test_a_relative_or_https_target_url_is_accepted(self):
        for target in ("/explore", "https://example.com/x", "http://example.com"):
            r = await self.client.post(
                "/api/admin/banners",
                headers=self.headers,
                json={"title": f"T{target}", "url": "/u", "target_url": target},
            )
            self.assertEqual(r.status_code, 201, f"{target} -> {r.status_code} {r.text}")

    async def test_a_blank_url_is_refused(self):
        # A banner with no image renders an empty slot with a title in it.
        r = await self.client.post(
            "/api/admin/banners", headers=self.headers, json={"title": "T", "url": "   "}
        )
        self.assertEqual(r.status_code, 400, r.text)

    async def test_an_unknown_placement_is_refused_by_the_api_not_only_the_database(self):
        r = await self.client.post(
            "/api/admin/banners",
            headers=self.headers,
            json={"title": "T", "url": "/u", "placement": "sidebar_float"},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIsNone(
            await self.pool.fetchval("SELECT 1 FROM banners WHERE title = 'T'")
        )

    async def test_a_storage_provider_that_does_not_exist_is_refused(self):
        # 'appwrite' was V8's column default and there is no such provider in
        # this codebase.
        r = await self.client.post(
            "/api/admin/banners",
            headers=self.headers,
            json={"title": "T", "url": "/u", "storage_provider": "appwrite"},
        )
        self.assertEqual(r.status_code, 400, r.text)

    async def test_a_new_banner_defaults_to_the_local_provider(self):
        r = await self.client.post(
            "/api/admin/banners",
            headers=self.headers,
            json={"title": "Defaulted", "url": "/u"},
        )
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["data"]["storage_provider"], "local")
        # And the column itself, so a raw INSERT gets the same answer.
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT storage_provider FROM banners WHERE title = 'Defaulted'"
            ),
            "local",
        )

    async def test_end_at_before_start_at_is_a_400_naming_the_fields(self):
        # chk_banner_window would catch it as a check violation -> 500.
        now = datetime.now(timezone.utc)
        r = await self.client.post(
            "/api/admin/banners",
            headers=self.headers,
            json={
                "title": "Backwards",
                "url": "/u",
                "start_at": iso(now + timedelta(days=2)),
                "end_at": iso(now - timedelta(days=2)),
            },
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "INVALID_WINDOW")

    async def test_a_partial_edit_validates_the_window_against_the_stored_start(self):
        # Sending only end_at must be checked against the stored start_at, or a
        # bad pair can be assembled one field at a time without tripping it.
        now = datetime.now(timezone.utc)
        bid = await self.make_banner(
            title="Windowed", start_at=iso(now + timedelta(days=2))
        )
        r = await self.client.put(
            f"/api/admin/banners/{bid}",
            headers=self.headers,
            json={"end_at": iso(now + timedelta(days=1))},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "INVALID_WINDOW")

    async def test_an_omitted_field_is_untouched_and_null_is_not_a_clear(self):
        bid = await self.make_banner(title="Keep Me", subtitle="Original", sort_order=7)
        r = await self.client.put(
            f"/api/admin/banners/{bid}", headers=self.headers, json={"title": "Renamed"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        row = await self.pool.fetchrow("SELECT * FROM banners WHERE id = $1::uuid", bid)
        self.assertEqual(row["title"], "Renamed")
        self.assertEqual(row["subtitle"], "Original")
        self.assertEqual(int(row["sort_order"]), 7)

    async def test_an_explicit_null_clears_a_field_that_an_omission_preserves(self):
        # The other half of the `model_fields_set` behaviour, and the reason it
        # is not a COALESCE list: removing a CTA is a thing an admin does, so
        # `null` has to mean "clear this" while an absent key means "leave it".
        bid = await self.make_banner(
            title="Has CTA", subtitle="Has Sub", cta_label="Buy", target_url="/explore"
        )
        r = await self.client.put(
            f"/api/admin/banners/{bid}", headers=self.headers, json={"cta_label": None}
        )
        self.assertEqual(r.status_code, 200, r.text)
        row = await self.pool.fetchrow("SELECT * FROM banners WHERE id = $1::uuid", bid)
        self.assertIsNone(row["cta_label"], "explicit null should clear")
        # And the fields that were not mentioned survive.
        self.assertEqual(row["subtitle"], "Has Sub")
        self.assertEqual(row["target_url"], "/explore")

    async def test_an_edit_that_changes_nothing_still_answers_with_the_row(self):
        bid = await self.make_banner(title="Untouched")
        r = await self.client.put(
            f"/api/admin/banners/{bid}", headers=self.headers, json={}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["title"], "Untouched")

    async def test_a_malformed_banner_id_is_a_404_not_a_500(self):
        r = await self.client.put(
            "/api/admin/banners/not-a-uuid", headers=self.headers, json={"title": "x"}
        )
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(err(r).get("code"), "BANNER_NOT_FOUND")

    async def test_a_missing_banner_is_a_404(self):
        r = await self.client.delete(
            f"/api/admin/banners/{uuid.uuid4()}", headers=self.headers
        )
        self.assertEqual(r.status_code, 404, r.text)

    async def test_banner_routes_are_admin_only(self):
        body = {"title": "Nope", "url": "/u"}
        r = await self.client.post("/api/admin/banners", headers=self.customer_headers, json=body)
        self.assertIn(r.status_code, (401, 403), f"POST -> {r.status_code}")
        self.assertEqual(
            await self.pool.fetchval("SELECT count(*) FROM banners WHERE title = 'Nope'"), 0
        )

        r = await self.client.get("/api/admin/banners", headers=self.customer_headers)
        self.assertIn(r.status_code, (401, 403), f"GET -> {r.status_code}")

    async def test_the_admin_list_shows_a_banner_the_storefront_is_hiding(self):
        # `live` has to be computable for a scheduled banner, or an admin
        # opening the screen to ask "why is nothing showing" sees nothing at all.
        now = datetime.now(timezone.utc)
        await self.make_banner(
            title="Next Month",
            start_at=iso(now + timedelta(days=30)),
            end_at=iso(now + timedelta(days=60)),
        )
        await self.make_banner(
            title="Ran", end_at=iso(now - timedelta(days=1))
        )
        await self.make_banner(title="Off", is_active=False)

        r = await self.client.get("/api/admin/banners", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        rows = {b["title"]: b for b in r.json()["data"]}
        self.assertEqual(set(rows), {"Next Month", "Ran", "Off"})

        self.assertTrue(rows["Next Month"]["is_active"])
        self.assertFalse(rows["Next Month"]["in_window"])
        self.assertFalse(rows["Next Month"]["live"])

        self.assertTrue(rows["Ran"]["in_window"] is False)
        self.assertFalse(rows["Ran"]["live"])

        # Active and in-window but switched off: still not live.
        self.assertFalse(rows["Off"]["live"])

        # And the storefront agrees with all three.
        self.assertEqual(await self.read_slot(), [])

    async def test_inactive_banners_can_be_filtered_out_of_the_admin_list(self):
        await self.make_banner(title="On")
        await self.make_banner(title="Off", is_active=False)
        r = await self.client.get(
            "/api/admin/banners?include_inactive=false", headers=self.headers
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual([b["title"] for b in r.json()["data"]], ["On"])

    # =====================================================================
    # G3. CMS copy
    # =====================================================================

    async def test_an_unwritten_cms_key_is_a_200_with_a_null(self):
        # The storefront's contract is "fall back to the copy compiled into the
        # frontend". It can only honour that if absence is not an error.
        r = await self.client.get("/api/content/cms/home.never_written")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(r.json()["data"])

    async def test_a_cms_value_comes_back_as_an_object_not_a_string(self):
        await self.pool.execute(
            """INSERT INTO cms_content (key, value) VALUES ('home.test_object', $1::jsonb)""",
            json.dumps({"headline": "Hi", "cta": {"label": "Go", "to": "/explore"}}),
        )
        r = await self.client.get("/api/content/cms/home.test_object")
        self.assertEqual(r.status_code, 200, r.text)
        value = r.json()["data"]
        # jsonb arrives from asyncpg as text; if it is not decoded the frontend
        # gets a string and every field access on it fails at runtime.
        self.assertIsInstance(value, dict)
        self.assertEqual(value["headline"], "Hi")
        self.assertEqual(value["cta"]["to"], "/explore")

    async def test_a_cms_list_value_comes_back_as_a_list(self):
        await self.pool.execute(
            "INSERT INTO cms_content (key, value) VALUES ('home.test_list', $1::jsonb)",
            json.dumps([{"icon": "truck", "title": "Free"}]),
        )
        r = await self.client.get("/api/content/cms/home.test_list")
        self.assertIsInstance(r.json()["data"], list)

    async def test_all_cms_keys_come_back_in_one_call(self):
        await self.pool.execute(
            "INSERT INTO cms_content (key, value) VALUES ('home.test_a','{\"h\":1}'::jsonb),"
            " ('home.test_b','{\"h\":2}'::jsonb)"
        )
        r = await self.client.get("/api/content/cms")
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["home.test_a"], {"h": 1})
        self.assertEqual(data["home.test_b"], {"h": 2})

    async def test_an_admin_cms_write_is_visible_on_the_public_read(self):
        # Read first to prime the cache; the write must clear its own key.
        url = "/api/content/cms/home.test_write"
        self.assertIsNone((await self.client.get(url)).json()["data"])
        r = await self.client.put(
            "/api/admin/content/home.test_write",
            headers=self.headers,
            json={"value": {"headline": "New Headline"}},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(
            (await self.client.get(url)).json()["data"],
            {"headline": "New Headline"},
        )

    async def test_a_cms_write_really_lands_and_records_the_author(self):
        r = await self.client.put(
            "/api/admin/content/home.test_persist",
            headers=self.headers,
            json={"value": {"headline": "Persisted"}},
        )
        self.assertEqual(r.status_code, 200, r.text)
        row = await self.pool.fetchrow(
            "SELECT * FROM cms_content WHERE key = 'home.test_persist'"
        )
        self.assertIsNotNone(row)
        value = row["value"]
        if isinstance(value, str):
            value = json.loads(value)
        self.assertEqual(value, {"headline": "Persisted"})
        self.assertEqual(str(row["updated_by"]), self.admin_id)

    async def test_a_cms_write_keeps_the_previous_value_as_a_revision(self):
        key = "home.test_revisions"
        await self.client.put(
            f"/api/admin/content/{key}",
            headers=self.headers,
            json={"value": {"headline": "First"}},
        )
        await self.client.put(
            f"/api/admin/content/{key}",
            headers=self.headers,
            json={"value": {"headline": "Second"}},
        )
        r = await self.client.get(
            f"/api/admin/content/{key}/revisions", headers=self.headers
        )
        self.assertEqual(r.status_code, 200, r.text)
        rows = r.json()["data"]
        self.assertEqual(len(rows), 2)
        # Newest first, and each row knows what it replaced.
        self.assertEqual(rows[0]["next"], {"headline": "Second"})
        self.assertEqual(rows[0]["previous"], {"headline": "First"})
        self.assertEqual(rows[1]["previous"], None)

    async def test_a_first_write_has_no_previous_value(self):
        await self.client.put(
            "/api/admin/content/home.test_first",
            headers=self.headers,
            json={"value": {"a": 1}},
        )
        r = await self.client.get(
            "/api/admin/content/home.test_first/revisions", headers=self.headers
        )
        self.assertEqual(len(r.json()["data"]), 1)
        self.assertIsNone(r.json()["data"][0]["previous"])

    async def test_deleting_a_cms_key_falls_back_to_the_compiled_copy(self):
        key = "home.test_delete"
        url = f"/api/content/cms/{key}"
        await self.client.put(
            f"/api/admin/content/{key}",
            headers=self.headers,
            json={"value": {"headline": "Temporary"}},
        )
        self.assertIsNotNone((await self.client.get(url)).json()["data"])

        r = await self.client.delete(f"/api/admin/content/{key}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone((await self.client.get(url)).json()["data"])

    async def test_deleting_a_cms_key_that_is_not_there_is_a_404(self):
        r = await self.client.delete("/api/admin/content/nope", headers=self.headers)
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(err(r).get("code"), "CMS_KEY_NOT_FOUND")

    async def test_an_empty_cms_value_is_refused(self):
        # An empty object is indistinguishable from "no content", and the
        # storefront cannot tell an empty section from a broken one.
        for value in ({}, []):
            r = await self.client.put(
                "/api/admin/content/home.empty", headers=self.headers, json={"value": value}
            )
            self.assertEqual(r.status_code, 400, f"{value!r} -> {r.status_code}")
        self.assertIsNone(
            await self.pool.fetchval("SELECT 1 FROM cms_content WHERE key = 'home.empty'")
        )

    async def test_the_cms_admin_list_names_who_changed_each_key(self):
        await self.client.put(
            "/api/admin/content/home.test_author",
            headers=self.headers,
            json={"value": {"h": 1}},
        )
        r = await self.client.get("/api/admin/content", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        rows = r.json()["data"]
        row = next(r for r in rows if r["key"] == "home.test_author")
        self.assertEqual(row["value"], {"h": 1})
        self.assertEqual(row["updated_by_name"], "Admin")
        self.assertIsNotNone(row["updated_at"])

    async def test_cms_routes_are_admin_only(self):
        for method, path in (
            ("get", "/api/admin/content"),
            ("get", "/api/admin/content/home.hero"),
            ("get", "/api/admin/content/home.hero/revisions"),
        ):
            r = await getattr(self.client, method)(path, headers=self.customer_headers)
            self.assertIn(r.status_code, (401, 403), f"{method} {path} -> {r.status_code}")

        r = await self.client.put(
            "/api/admin/content/home.test_guard",
            headers=self.customer_headers,
            json={"value": {"h": "hacked"}},
        )
        self.assertIn(r.status_code, (401, 403), f"put -> {r.status_code}")

    async def test_a_rejected_cms_write_changes_nothing(self):
        r = await self.client.put(
            "/api/admin/content/home.test_guard",
            headers=self.customer_headers,
            json={"value": {"h": "hacked"}},
        )
        self.assertIn(r.status_code, (401, 403))
        self.assertIsNone(
            await self.pool.fetchval("SELECT 1 FROM cms_content WHERE key = 'home.test_guard'")
        )

    # =====================================================================
    # V11's seeding: the homepage must not change when this lands
    # =====================================================================

    async def test_the_seeded_homepage_copy_matches_what_the_frontend_ships(self):
        """
        V11 transcribed the homepage copy out of HomePage.jsx so that landing the
        migration changes nothing a visitor can see. If someone edits the JSX and
        does not update the seed, this is the test that says so -- the two are
        the same words by construction, and the seed is the copy that wins from
        the moment the migration is applied.

        The first draft of the seed was written from memory rather than read off
        the page, and got two of the four trust-bar items wrong. That is the
        failure this test exists for, so it asserts the list in full rather than
        a couple of spot checks.
        """
        r = await self.client.get("/api/content/cms")
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]

        for key in (
            "home.hero",
            "home.trust_bar",
            "home.categories",
            "home.trending",
            "home.seller_cta",
        ):
            self.assertIn(key, data, f"{key} is not seeded")

        hero = data["home.hero"]
        self.assertEqual(hero["eyebrow"], "Mega Savings • Limited Time Deals")
        self.assertEqual(hero["headline"], "Great Deals on Everything You Love")
        self.assertEqual(hero["primary_cta"], {"label": "Shop All Deals", "to": "/explore"})
        self.assertEqual(
            hero["secondary_cta"], {"label": "Top Rated Products", "to": "/explore?sort=rating"}
        )

        bar = data["home.trust_bar"]
        self.assertIsInstance(bar, list)
        self.assertEqual(
            [(i["icon"], i["title"], i["body"]) for i in bar],
            [
                ("truck", "Free Fast Delivery", "On orders over ₹499"),
                ("rotate-ccw", "7-Day Easy Returns", "Hassle-free replacement or refund"),
                ("shield", "100% Genuine Products", "From verified sellers"),
                ("card", "Secure Payments", "Cards, UPI & Net Banking"),
            ],
        )

        cats = data["home.categories"]
        self.assertEqual(cats["headline"], "Explore Popular Categories")
        self.assertEqual(
            [c["title"] for c in cats["cards"]],
            [
                "Electronics & Audio",
                "Fashion & Apparel",
                "Home & Living",
                "Best Sellers",
            ],
        )
        # Every card needs a destination, or the section renders dead links.
        for card in cats["cards"]:
            self.assertTrue(card.get("to"), f"{card['title']} has no destination")
            self.assertTrue(card.get("cta_label"), f"{card['title']} has no cta_label")

        self.assertEqual(data["home.trending"]["headline"], "Trending Deals of the Day")
        self.assertEqual(
            data["home.seller_cta"]["cta"],
            {"label": "Become a Seller", "to": "/seller/onboarding"},
        )

    async def test_reapplying_the_seed_changes_nothing(self):
        """
        `_seed_sql` runs on every setUp, which only works because V11's INSERT is
        `ON CONFLICT (key) DO NOTHING`. That is also the property a deploy relies
        on: a migration that has to be re-run must not duplicate rows or overwrite
        an admin's edit with the shipped default.
        """
        before = (await self.client.get("/api/content/cms")).json()["data"]

        # An admin edits one key, then the seed is re-applied.
        await self.client.put(
            "/api/admin/content/home.hero",
            headers=self.headers,
            json={"value": {"headline": "Edited By Admin"}},
        )
        await self.pool.execute(_seed_sql())

        after = (await self.client.get("/api/content/cms")).json()["data"]
        self.assertEqual(set(after), set(before), "re-applying the seed added or lost a key")
        # The edit survives. A seed that overwrote live content on every deploy
        # would silently revert the homepage at the worst possible moment.
        self.assertEqual(after["home.hero"]["headline"], "Edited By Admin")
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT count(*) FROM cms_content WHERE key = 'home.hero'"
            ),
            1,
        )

    async def test_no_seeded_key_names_a_section_that_does_not_exist(self):
        """
        An unused key is a claim that a part of the page is editable when it is
        not. The first draft seeded `home.newsletter` for a newsletter section
        that HomePage.jsx does not have.
        """
        r = await self.client.get("/api/content/cms")
        seeded = set(r.json()["data"])
        self.assertEqual(
            seeded,
            {
                "home.hero",
                "home.trust_bar",
                "home.categories",
                "home.trending",
                "home.seller_cta",
            },
        )

    async def test_every_seeded_icon_name_is_one_the_frontend_can_render(self):
        """
        Icons are stored as data and mapped to components in HomePage.jsx. A name
        the frontend does not know falls back to a generic icon, so a typo is
        invisible -- the section renders, it just renders the wrong picture. This
        is the only place the two vocabularies are compared.
        """
        known = {"truck", "rotate-ccw", "shield", "card", "tv", "shirt", "home", "sparkles"}
        r = await self.client.get("/api/content/cms")
        data = r.json()["data"]
        used = {i["icon"] for i in data["home.trust_bar"]}
        used |= {c["icon"] for c in data["home.categories"]["cards"]}
        unknown = used - known
        self.assertEqual(unknown, set(), f"frontend has no icon for: {sorted(unknown)}")


if __name__ == "__main__":
    unittest.main()
