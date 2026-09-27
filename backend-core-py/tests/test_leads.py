"""
Leads — H1 (public capture) and H2 (admin inbox), against a real database.

The tests are organised around the things that would still work if the
implementation were wrong:

- A lead with no way to reply to it looks like a successful submission. V8 has
  `chk_lead_contactable` for it, and a constraint violation is a 500, so the
  tests assert a 400 *and* that no row landed.
- The public source enum has five values and two of them are claims only the
  platform can make. A public form that can post `checkout_abandon` files a lead
  that looks like the platform's own analysis. Ditto `manual`.
- A product enquiry is routed to the product's seller. A client that sends its own
  `seller_id` must not be believed: the tests send a *different* seller and assert
  the lead went to the right one.
- The honeypot must answer exactly like a real submission and store nothing -- a
  bot told it failed retries with the field cleared.
- The CSV export is opened in a spreadsheet by an admin. A cell starting `=` is a
  formula, and `=HYPERLINK(...)` in a contact form is a documented way to attack
  the person who opens it.
- A note log that overwrites is an inbox where two admins erase each other. The
  tests add two notes and assert both survive.

Skipped unless TEST_DATABASE_URL is set.

    TEST_DATABASE_URL=postgresql://... python -m pytest tests/test_leads.py -v
"""
import os
import unittest
import uuid

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()

PUBLIC = "/api/leads"


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


@unittest.skipUnless(TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping lead tests")
class LeadTests(unittest.IsolatedAsyncioTestCase):
    maxDiff = None

    async def asyncSetUp(self):
        import asyncpg

        self.pool = await asyncpg.create_pool(dsn=TEST_DATABASE_URL, min_size=1, max_size=4)
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")
        await self.pool.execute("DELETE FROM leads")

        # The rate limiter keeps its counters in the same process-wide cache the
        # content tests use, and the public capture route allows five an hour per
        # identity. Every test here shares one test client identity, so without
        # this the sixth submission of the file is a 429 and the suite fails on
        # its own bookkeeping rather than on the behaviour it is checking.
        from app.redis_client import cache

        await cache.delete_prefix("ratelimit:")

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
        self.seller_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Seller','seller@example.com','x','seller') RETURNING id"
            )
        )
        self.other_seller_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Other','other@example.com','x','seller') RETURNING id"
            )
        )
        self.customer_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Buyer','buyer@example.com','x','customer') RETURNING id"
            )
        )
        # `leads.product_id` needs a real product, and a product needs a category
        # and a seller: `products.category_id` is NOT NULL.
        self.category_id = str(
            await self.pool.fetchval(
                "INSERT INTO categories (name, slug) VALUES ('Kitchen','kitchen') RETURNING id"
            )
        )
        self.product_id = str(
            await self.pool.fetchval(
                "INSERT INTO products "
                "(title, slug, description, price, stock_qty, category_id, seller_id, status) "
                "VALUES ('Test Kettle','test-kettle','desc',499.00,10,$1::uuid,$2::uuid,'active') "
                "RETURNING id",
                self.category_id,
                self.seller_id,
            )
        )

        self.headers = auth_header(self.admin_id, "admin", "admin@example.com")
        self.seller_headers = auth_header(self.seller_id, "seller", "seller@example.com")
        self.customer_headers = auth_header(self.customer_id, "customer", "buyer@example.com")

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    # -- helpers ----------------------------------------------------------

    async def post_lead(self, payload: dict):
        return await self.client.post(PUBLIC, json=payload)

    async def lead_count(self, **where) -> int:
        if not where:
            return int(await self.pool.fetchval("SELECT count(*) FROM leads"))
        clause = " AND ".join(f"{k} = ${i + 1}" for i, k in enumerate(where))
        return int(
            await self.pool.fetchval(
                f"SELECT count(*) FROM leads WHERE {clause}", *where.values()
            )
        )

    async def make_lead(self, **kw) -> str:
        defaults = {
            "name": "Priya",
            "email": "priya@example.com",
            "message": "Is this in stock?",
            "source": "contact_form",
        }
        defaults.update(kw)
        cols = ", ".join(defaults)
        marks = []
        params = []
        for i, (k, v) in enumerate(defaults.items(), start=1):
            cast = "::uuid" if k in ("product_id", "seller_id", "assigned_to") else ""
            marks.append(f"${i}{cast}")
            params.append(v)
        return str(
            await self.pool.fetchval(
                f"INSERT INTO leads ({cols}) VALUES ({', '.join(marks)}) RETURNING id",
                *params,
            )
        )

    # =====================================================================
    # H1. Public capture
    # =====================================================================

    async def test_a_contact_enquiry_is_stored(self):
        r = await self.post_lead(
            {"name": "  Priya  ", "email": " priya@example.com ", "message": "Hello"}
        )
        self.assertEqual(r.status_code, 201, r.text)
        lead_id = r.json()["data"]["id"]
        row = await self.pool.fetchrow("SELECT * FROM leads WHERE id = $1::uuid", lead_id)
        self.assertIsNotNone(row, "201 but no row")
        self.assertEqual(row["source"], "contact_form")
        # Trimmed, both of them. A name with leading whitespace sorts wrong and
        # an address with a trailing space is a bounce.
        self.assertEqual(row["name"], "Priya")
        self.assertEqual(row["email"], "priya@example.com")
        self.assertEqual(row["status"], "new")

    async def test_the_public_route_needs_no_auth(self):
        r = await self.client.post(PUBLIC, json={"email": "a@b.co", "message": "hi"})
        self.assertEqual(r.status_code, 201, r.text)

    async def test_an_email_alone_is_enough(self):
        r = await self.post_lead({"email": "a@b.co"})
        self.assertEqual(r.status_code, 201, r.text)

    async def test_a_phone_alone_is_enough(self):
        for phone in ("+91 98765 43210", "9876543210", "011-2345-6789"):
            r = await self.post_lead({"phone": phone})
            self.assertEqual(r.status_code, 201, f"{phone} -> {r.status_code} {r.text}")

    async def test_a_lead_with_no_reply_address_is_refused_and_not_stored(self):
        # V8's chk_lead_contactable would make this a check violation, which is a
        # 500. It is the caller's mistake and should read like one.
        r = await self.post_lead({"name": "Ghost", "message": "call me"})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "CONTACT_REQUIRED")
        self.assertEqual(await self.lead_count(), 0)

    async def test_an_empty_string_is_not_a_contact_address(self):
        r = await self.post_lead({"email": "   ", "phone": ""})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(await self.lead_count(), 0)

    async def test_a_malformed_email_is_refused_and_not_stored(self):
        for bad in ("not-an-email", "a@b", "a b@c.com", "@b.com", "a@.com"):
            r = await self.post_lead({"email": bad})
            self.assertEqual(r.status_code, 400, f"{bad} -> {r.status_code}")
        self.assertEqual(await self.lead_count(), 0)

    async def test_a_real_looking_email_is_accepted(self):
        for good in ("a.b+tag@sub.example.co.in", "x_y@example.com", "X@EXAMPLE.COM"):
            r = await self.post_lead({"email": good})
            self.assertEqual(r.status_code, 201, f"{good} -> {r.status_code} {r.text}")

    async def test_a_malformed_phone_is_refused(self):
        for bad in ("12345", "abcdefghij", "+", "1234567890123456789"):
            r = await self.post_lead({"phone": bad})
            self.assertEqual(r.status_code, 400, f"{bad} -> {r.status_code}")

    async def test_the_public_route_refuses_the_two_sources_only_the_platform_may_claim(self):
        # `checkout_abandon` and `manual` are statements about what the platform
        # did. A public form that can post one files a lead that looks like the
        # platform's own analysis.
        for source in ("checkout_abandon", "manual"):
            r = await self.post_lead({"email": "a@b.co", "source": source})
            self.assertEqual(r.status_code, 400, f"{source} -> {r.status_code}")
        self.assertEqual(await self.lead_count(), 0)

    async def test_the_public_route_accepts_its_three_sources(self):
        for source in ("contact_form", "product_enquiry", "seller_page"):
            payload = {"email": "a@b.co", "source": source}
            if source == "product_enquiry":
                payload["product_id"] = self.product_id
            if source == "seller_page":
                payload["seller_id"] = self.seller_id
            r = await self.post_lead(payload)
            self.assertEqual(r.status_code, 201, f"{source} -> {r.status_code} {r.text}")

    async def test_an_unknown_source_is_refused(self):
        r = await self.post_lead({"email": "a@b.co", "source": "carrier_pigeon"})
        self.assertEqual(r.status_code, 400, r.text)

    async def test_extra_fields_are_rejected_rather_than_ignored(self):
        # A client that sends `status: "won"` should be told it cannot, not
        # silently have the field dropped.
        r = await self.post_lead({"email": "a@b.co", "status": "won"})
        self.assertEqual(r.status_code, 400, r.text)

    # -- the honeypot ------------------------------------------------------

    async def test_a_filled_honeypot_answers_like_a_success_and_stores_nothing(self):
        r = await self.post_lead(
            {"email": "bot@example.com", "message": "buy now", "website": "http://spam.example"}
        )
        # The same 201 and the same body as a real submission. A bot told it
        # failed retries with the field cleared.
        self.assertEqual(r.status_code, 201, r.text)
        self.assertTrue(r.json()["success"])
        self.assertEqual(await self.lead_count(), 0, "the honeypot stored a row")

    async def test_an_empty_honeypot_does_not_block_a_real_submission(self):
        r = await self.post_lead({"email": "a@b.co", "website": "   "})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(await self.lead_count(email="a@b.co"), 1)

    # -- product enquiries -------------------------------------------------

    async def test_a_product_enquiry_is_routed_to_the_products_seller(self):
        r = await self.post_lead(
            {"email": "a@b.co", "source": "product_enquiry", "product_id": self.product_id}
        )
        self.assertEqual(r.status_code, 201, r.text)
        row = await self.pool.fetchrow("SELECT * FROM leads WHERE email = 'a@b.co'")
        self.assertEqual(str(row["product_id"]), self.product_id)
        self.assertEqual(str(row["seller_id"]), self.seller_id)

    async def test_a_clients_claim_about_the_seller_is_ignored(self):
        # The browser sends the *wrong* seller, and the lead must still go to the
        # product's real owner. Believing the client files the enquiry against a
        # merchant who has nothing to do with it, and the merchant who should
        # have replied never sees it.
        r = await self.post_lead(
            {
                "email": "a@b.co",
                "source": "product_enquiry",
                "product_id": self.product_id,
                "seller_id": self.other_seller_id,
            }
        )
        self.assertEqual(r.status_code, 201, r.text)
        row = await self.pool.fetchrow("SELECT * FROM leads WHERE email = 'a@b.co'")
        self.assertEqual(str(row["seller_id"]), self.seller_id)

    async def test_a_product_enquiry_without_a_product_is_refused(self):
        r = await self.post_lead({"email": "a@b.co", "source": "product_enquiry"})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "PRODUCT_REQUIRED")
        self.assertEqual(await self.lead_count(), 0)

    async def test_a_product_enquiry_for_a_product_that_does_not_exist_is_a_404(self):
        r = await self.post_lead(
            {"email": "a@b.co", "source": "product_enquiry", "product_id": str(uuid.uuid4())}
        )
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(await self.lead_count(), 0)

    async def test_a_malformed_product_id_is_a_400_not_a_500(self):
        r = await self.post_lead(
            {"email": "a@b.co", "source": "product_enquiry", "product_id": "1"}
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(await self.lead_count(), 0)

    # -- seller page enquiries --------------------------------------------

    async def test_a_store_enquiry_is_routed_to_the_seller(self):
        r = await self.post_lead(
            {"email": "a@b.co", "source": "seller_page", "seller_id": self.seller_id}
        )
        self.assertEqual(r.status_code, 201, r.text)
        row = await self.pool.fetchrow("SELECT * FROM leads WHERE email = 'a@b.co'")
        self.assertEqual(str(row["seller_id"]), self.seller_id)

    async def test_a_store_enquiry_without_a_seller_is_refused(self):
        r = await self.post_lead({"email": "a@b.co", "source": "seller_page"})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "SELLER_REQUIRED")

    async def test_a_store_enquiry_naming_a_customer_is_a_404(self):
        # A customer id is not a store, and filing an enquiry against one would
        # mean nobody is responsible for answering it.
        r = await self.post_lead(
            {"email": "a@b.co", "source": "seller_page", "seller_id": self.customer_id}
        )
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(await self.lead_count(), 0)

    async def test_the_public_response_does_not_echo_the_enquiry_back(self):
        # The row is the customer's. A response body that repeats it ends up in
        # browser history, in a proxy log, and in whatever page was open.
        r = await self.post_lead(
            {"name": "Secret Person", "email": "a@b.co", "message": "my private note"}
        )
        self.assertEqual(r.status_code, 201, r.text)
        body = r.text
        self.assertNotIn("Secret Person", body)
        self.assertNotIn("my private note", body)
        self.assertNotIn("a@b.co", body)

    # =====================================================================
    # H2. Admin inbox
    # =====================================================================

    async def test_the_inbox_lists_leads_newest_first(self):
        await self.make_lead(name="Older", email="old@e.com")
        await self.make_lead(name="Newer", email="new@e.com")
        r = await self.client.get("/api/admin/leads", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        names = [row["name"] for row in r.json()["data"]]
        self.assertEqual(names, ["Newer", "Older"])

    async def test_oldest_first_is_available_because_it_answers_a_different_question(self):
        await self.make_lead(name="Older", email="old@e.com")
        await self.make_lead(name="Newer", email="new@e.com")
        r = await self.client.get("/api/admin/leads?sort=oldest", headers=self.headers)
        self.assertEqual([row["name"] for row in r.json()["data"]], ["Older", "Newer"])

    async def test_the_inbox_filters_by_status_and_reports_the_match(self):
        await self.make_lead(email="a@e.com", status="new")
        await self.make_lead(email="b@e.com", status="won")
        r = await self.client.get("/api/admin/leads?status=won", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(len(body["data"]), 1)
        self.assertEqual(body["data"][0]["email"], "b@e.com")
        self.assertEqual(body["pagination"]["total"], 1)

    async def test_an_unknown_status_filter_is_a_400_naming_the_allowed_ones(self):
        r = await self.client.get("/api/admin/leads?status=maybe", headers=self.headers)
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "UNKNOWN_STATUS")
        self.assertIn("new", err(r).get("allowed", []))

    async def test_the_inbox_filters_by_source(self):
        await self.make_lead(email="a@e.com", source="contact_form")
        await self.make_lead(email="b@e.com", source="seller_page")
        r = await self.client.get("/api/admin/leads?source=seller_page", headers=self.headers)
        self.assertEqual([row["email"] for row in r.json()["data"]], ["b@e.com"])

    async def test_an_unknown_source_filter_is_a_400(self):
        r = await self.client.get("/api/admin/leads?source=smoke_signal", headers=self.headers)
        self.assertEqual(r.status_code, 400, r.text)

    async def test_a_filter_that_matches_nothing_is_an_empty_page_not_an_error(self):
        await self.make_lead(email="a@e.com")
        r = await self.client.get("/api/admin/leads?status=won", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"], [])
        self.assertEqual(r.json()["pagination"]["total"], 0)

    async def test_the_inbox_filters_to_unassigned(self):
        await self.make_lead(email="a@e.com", assigned_to=self.admin_id)
        await self.make_lead(email="b@e.com")
        r = await self.client.get("/api/admin/leads?unassigned=true", headers=self.headers)
        self.assertEqual([row["email"] for row in r.json()["data"]], ["b@e.com"])

    async def test_the_inbox_filters_by_assignee_and_seller_and_product(self):
        await self.make_lead(email="a@e.com", assigned_to=self.admin_id)
        await self.make_lead(email="b@e.com")
        await self.make_lead(email="c@e.com", seller_id=self.seller_id)
        await self.make_lead(email="d@e.com", product_id=self.product_id)

        r = await self.client.get(
            f"/api/admin/leads?assigned_to={self.admin_id}", headers=self.headers
        )
        self.assertEqual([x["email"] for x in r.json()["data"]], ["a@e.com"])

        r = await self.client.get(
            f"/api/admin/leads?seller_id={self.seller_id}", headers=self.headers
        )
        self.assertEqual([x["email"] for x in r.json()["data"]], ["c@e.com"])

        r = await self.client.get(
            f"/api/admin/leads?product_id={self.product_id}", headers=self.headers
        )
        self.assertEqual([x["email"] for x in r.json()["data"]], ["d@e.com"])

    async def test_a_malformed_filter_uuid_is_a_400_not_a_500(self):
        # `?assigned_to=1` reaching asyncpg is `invalid UUID '1'` as a 500 with
        # the driver message attached.
        for field in ("assigned_to", "seller_id", "product_id"):
            r = await self.client.get(f"/api/admin/leads?{field}=1", headers=self.headers)
            self.assertEqual(r.status_code, 400, f"{field} -> {r.status_code} {r.text}")

    async def test_the_inbox_searches_name_email_phone_and_message(self):
        await self.make_lead(name="Priya Sharma", email="p@e.com", phone="9876543210",
                             message="About the kettle")
        await self.make_lead(name="Someone Else", email="s@e.com")
        for term, expected in (
            ("priya", "p@e.com"),
            ("p@e.com", "p@e.com"),
            ("98765", "p@e.com"),
            ("kettle", "p@e.com"),
        ):
            r = await self.client.get(f"/api/admin/leads?q={term}", headers=self.headers)
            self.assertEqual(
                [x["email"] for x in r.json()["data"]], [expected], f"q={term}"
            )

    async def test_the_search_is_case_insensitive(self):
        # A search that refuses "priya" because the row says "Priya" is not a
        # search.
        await self.make_lead(name="Priya", email="p@e.com")
        r = await self.client.get("/api/admin/leads?q=PRIYA", headers=self.headers)
        self.assertEqual(len(r.json()["data"]), 1)

    async def test_the_inbox_paginates(self):
        for i in range(5):
            await self.make_lead(email=f"u{i}@e.com")
        r = await self.client.get("/api/admin/leads?limit=2&offset=0", headers=self.headers)
        self.assertEqual(len(r.json()["data"]), 2)
        self.assertEqual(r.json()["pagination"]["total"], 5)
        r2 = await self.client.get("/api/admin/leads?limit=2&offset=2", headers=self.headers)
        self.assertEqual(len(r2.json()["data"]), 2)
        # And the pages do not overlap.
        first = {x["id"] for x in r.json()["data"]}
        second = {x["id"] for x in r2.json()["data"]}
        self.assertEqual(first & second, set())

    async def test_the_summary_counts_every_status_even_at_zero(self):
        await self.make_lead(email="a@e.com", status="new")
        await self.make_lead(email="b@e.com", status="won")
        r = await self.client.get("/api/admin/leads/summary", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        counts = r.json()["data"]["counts"]
        # A filter bar whose buttons disappear when a count hits zero is a filter
        # bar that moves under the cursor.
        for status in ("new", "contacted", "qualified", "won", "lost", "spam"):
            self.assertIn(status, counts)
        self.assertEqual(counts["new"], 1)
        self.assertEqual(counts["won"], 1)
        self.assertEqual(counts["lost"], 0)

    async def test_the_summary_excludes_closed_leads_from_the_open_count(self):
        await self.make_lead(email="a@e.com", status="new")
        await self.make_lead(email="b@e.com", status="contacted")
        await self.make_lead(email="c@e.com", status="won")
        await self.make_lead(email="d@e.com", status="lost")
        await self.make_lead(email="e@e.com", status="spam")
        r = await self.client.get("/api/admin/leads/summary", headers=self.headers)
        data = r.json()["data"]
        self.assertEqual(data["total"], 5)
        # `spam` is not work. Including it would make the number an admin chases
        # count rows they have already dismissed.
        self.assertEqual(data["open"], 2)

    async def test_the_summary_counts_unassigned(self):
        await self.make_lead(email="a@e.com")
        await self.make_lead(email="b@e.com", assigned_to=self.admin_id)
        r = await self.client.get("/api/admin/leads/summary", headers=self.headers)
        self.assertEqual(r.json()["data"]["unassigned"], 1)

    async def test_the_list_carries_a_note_count(self):
        lead_id = await self.make_lead(email="a@e.com")
        await self.client.post(
            f"/api/admin/leads/{lead_id}/notes", headers=self.headers, json={"body": "Called"}
        )
        r = await self.client.get("/api/admin/leads", headers=self.headers)
        self.assertEqual(r.json()["data"][0]["note_count"], 1)

    async def test_lead_routes_are_admin_only(self):
        for method, path in (
            ("get", "/api/admin/leads"),
            ("get", "/api/admin/leads/summary"),
            ("get", "/api/admin/leads/export.csv"),
        ):
            r = await getattr(self.client, method)(path, headers=self.customer_headers)
            self.assertIn(r.status_code, (401, 403), f"{method} {path} -> {r.status_code}")
            r = await getattr(self.client, method)(path, headers=self.seller_headers)
            self.assertIn(r.status_code, (401, 403), f"{method} {path} (seller)")

    async def test_the_export_is_admin_only(self):
        r = await self.client.get("/api/admin/leads/export.csv", headers=self.customer_headers)
        self.assertIn(r.status_code, (401, 403), r.text)

    # =====================================================================
    # Notes. The rule is that they append.
    # =====================================================================

    async def test_adding_a_note_appends_it_and_updates_the_denormalised_copy(self):
        lead_id = await self.make_lead(email="a@e.com")
        r = await self.client.post(
            f"/api/admin/leads/{lead_id}/notes",
            headers=self.headers,
            json={"body": "Called at 4pm, wants delivery Friday"},
        )
        self.assertEqual(r.status_code, 201, r.text)
        row = await self.pool.fetchrow("SELECT notes FROM leads WHERE id = $1::uuid", lead_id)
        # The list view reads `leads.notes`; the detail view reads the log. Both
        # are written together so they cannot disagree.
        self.assertEqual(row["notes"], "Called at 4pm, wants delivery Friday")
        log = await self.pool.fetch(
            "SELECT body, author_id FROM lead_notes WHERE lead_id = $1::uuid", lead_id
        )
        self.assertEqual(len(log), 1)
        self.assertEqual(str(log[0]["author_id"]), self.admin_id)

    async def test_a_second_note_does_not_replace_the_first(self):
        # The bug this whole table exists for: one TEXT column means two admins
        # silently erase each other, and the note that said "call after 6pm" is
        # gone with no trace of who removed it.
        lead_id = await self.make_lead(email="a@e.com")
        for body in ("First note", "Second note", "Third note"):
            r = await self.client.post(
                f"/api/admin/leads/{lead_id}/notes", headers=self.headers, json={"body": body}
            )
            self.assertEqual(r.status_code, 201, r.text)

        log = await self.pool.fetch(
            "SELECT body FROM lead_notes WHERE lead_id = $1::uuid ORDER BY created_at", lead_id
        )
        self.assertEqual([x["body"] for x in log], ["First note", "Second note", "Third note"])
        # And the denormalised copy is the latest, not the first.
        self.assertEqual(
            await self.pool.fetchval("SELECT notes FROM leads WHERE id = $1::uuid", lead_id),
            "Third note",
        )

    async def test_a_blank_note_is_refused(self):
        lead_id = await self.make_lead(email="a@e.com")
        for body in ("", "   ", None, 42):
            r = await self.client.post(
                f"/api/admin/leads/{lead_id}/notes", headers=self.headers, json={"body": body}
            )
            self.assertEqual(r.status_code, 400, f"{body!r} -> {r.status_code}")
        self.assertEqual(
            int(await self.pool.fetchval("SELECT count(*) FROM lead_notes")), 0
        )

    async def test_a_note_is_trimmed(self):
        lead_id = await self.make_lead(email="a@e.com")
        await self.client.post(
            f"/api/admin/leads/{lead_id}/notes",
            headers=self.headers,
            json={"body": "  padded  "},
        )
        self.assertEqual(
            await self.pool.fetchval("SELECT notes FROM leads WHERE id = $1::uuid", lead_id),
            "padded",
        )

    async def test_a_note_on_a_lead_that_does_not_exist_is_a_404(self):
        r = await self.client.post(
            f"/api/admin/leads/{uuid.uuid4()}/notes", headers=self.headers, json={"body": "hi"}
        )
        self.assertEqual(r.status_code, 404, r.text)
        r = await self.client.post(
            "/api/admin/leads/not-a-uuid/notes", headers=self.headers, json={"body": "hi"}
        )
        self.assertEqual(r.status_code, 404, r.text)

    async def test_the_detail_returns_the_note_log_newest_first(self):
        lead_id = await self.make_lead(email="a@e.com")
        for body in ("Older", "Newer"):
            await self.client.post(
                f"/api/admin/leads/{lead_id}/notes", headers=self.headers, json={"body": body}
            )
        r = await self.client.get(f"/api/admin/leads/{lead_id}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual([n["body"] for n in data["notes_log"]], ["Newer", "Older"])
        self.assertEqual(data["notes_log"][0]["author_name"], "Admin")

    async def test_the_detail_resolves_the_product_a_lead_is_about(self):
        lead_id = await self.make_lead(
            email="a@e.com", source="product_enquiry", product_id=self.product_id
        )
        r = await self.client.get(f"/api/admin/leads/{lead_id}", headers=self.headers)
        self.assertEqual(r.json()["data"]["product"]["title"], "Test Kettle")

    async def test_the_detail_of_a_lead_that_does_not_exist_is_a_404(self):
        r = await self.client.get(f"/api/admin/leads/{uuid.uuid4()}", headers=self.headers)
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(err(r).get("code"), "LEAD_NOT_FOUND")

    # =====================================================================
    # Status and assignment
    # =====================================================================

    async def test_a_status_change_is_recorded_as_a_note(self):
        # Otherwise the trail says an enquiry is `won` and nothing says who
        # decided that or when.
        lead_id = await self.make_lead(email="a@e.com")
        r = await self.client.put(
            f"/api/admin/leads/{lead_id}", headers=self.headers, json={"status": "won"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["status"], "won")
        notes = await self.pool.fetch(
            "SELECT body FROM lead_notes WHERE lead_id = $1::uuid", lead_id
        )
        self.assertEqual([n["body"] for n in notes], ["Status: new → won"])

    async def test_re_setting_the_same_status_writes_no_noise(self):
        lead_id = await self.make_lead(email="a@e.com", status="contacted")
        await self.client.put(
            f"/api/admin/leads/{lead_id}", headers=self.headers, json={"status": "contacted"}
        )
        self.assertEqual(
            int(await self.pool.fetchval("SELECT count(*) FROM lead_notes")), 0
        )

    async def test_reassigning_writes_a_note_naming_the_admin(self):
        lead_id = await self.make_lead(email="a@e.com")
        r = await self.client.put(
            f"/api/admin/leads/{lead_id}",
            headers=self.headers,
            json={"assigned_to": self.admin_id},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT body FROM lead_notes WHERE lead_id = $1::uuid", lead_id
            ),
            "Assigned to Admin",
        )

    async def test_unassigning_writes_a_note(self):
        lead_id = await self.make_lead(email="a@e.com", assigned_to=self.admin_id)
        r = await self.client.put(
            f"/api/admin/leads/{lead_id}", headers=self.headers, json={"assigned_to": None}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(r.json()["data"]["assigned_to"])
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT body FROM lead_notes WHERE lead_id = $1::uuid", lead_id
            ),
            "Unassigned",
        )

    async def test_omitting_the_assignee_leaves_the_assignment_alone(self):
        # The other half of `model_fields_set`: changing only the status must not
        # silently unassign the lead, which is what a truthiness check does.
        lead_id = await self.make_lead(email="a@e.com", assigned_to=self.admin_id)
        r = await self.client.put(
            f"/api/admin/leads/{lead_id}", headers=self.headers, json={"status": "contacted"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["assigned_to"], self.admin_id)

    async def test_a_status_change_and_a_free_text_note_together_both_land(self):
        lead_id = await self.make_lead(email="a@e.com")
        r = await self.client.put(
            f"/api/admin/leads/{lead_id}",
            headers=self.headers,
            json={"status": "qualified", "note": "Budget confirmed"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        bodies = await self.pool.fetch(
            "SELECT body FROM lead_notes WHERE lead_id = $1::uuid ORDER BY created_at", lead_id
        )
        self.assertEqual([b["body"] for b in bodies], ["Status: new → qualified", "Budget confirmed"])

    async def test_a_status_change_on_a_missing_lead_is_a_404(self):
        r = await self.client.put(
            f"/api/admin/leads/{uuid.uuid4()}", headers=self.headers, json={"status": "won"}
        )
        self.assertEqual(r.status_code, 404, r.text)

    async def test_an_unknown_status_is_a_400_and_changes_nothing(self):
        lead_id = await self.make_lead(email="a@e.com")
        r = await self.client.put(
            f"/api/admin/leads/{lead_id}", headers=self.headers, json={"status": "archived"}
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(
            await self.pool.fetchval("SELECT status FROM leads WHERE id = $1::uuid", lead_id),
            "new",
        )

    async def test_assigning_to_a_customer_is_a_404(self):
        # A lead assigned to someone who cannot open the inbox is a lead nobody
        # is working.
        lead_id = await self.make_lead(email="a@e.com")
        r = await self.client.put(
            f"/api/admin/leads/{lead_id}",
            headers=self.headers,
            json={"assigned_to": self.customer_id},
        )
        self.assertEqual(r.status_code, 404, r.text)
        self.assertIsNone(
            await self.pool.fetchval("SELECT assigned_to FROM leads WHERE id = $1::uuid", lead_id)
        )

    # =====================================================================
    # The CSV export
    # =====================================================================

    async def test_the_export_is_a_csv_with_a_header_and_the_rows(self):
        await self.make_lead(name="Priya", email="priya@e.com")
        r = await self.client.get("/api/admin/leads/export.csv", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("text/csv", r.headers["content-type"])
        self.assertIn("attachment", r.headers["content-disposition"])
        # A BOM, because Excel on Windows opens a BOM-less UTF-8 CSV as Latin-1
        # and turns every accented name into mojibake.
        self.assertTrue(r.text.startswith("\ufeff"), "no BOM")
        lines = r.text.lstrip("\ufeff").strip().splitlines()
        self.assertIn("Email", lines[0])
        self.assertIn("priya@e.com", lines[1])

    async def test_the_export_neutralises_spreadsheet_formulas(self):
        # `=HYPERLINK(...)` in a contact form is a documented way to attack the
        # person who opens the export, and the person who opens the export is the
        # admin.
        await self.make_lead(
            name='=HYPERLINK("http://evil.example","click")',
            email="attacker@e.com",
            message="+1+1",
        )
        r = await self.client.get("/api/admin/leads/export.csv", headers=self.headers)
        text = r.text.lstrip("\ufeff")
        self.assertIn("'=HYPERLINK", text, "the leading = was not neutralised")
        self.assertIn("'+1+1", text)
        # And the raw form is not present anywhere in the file.
        self.assertNotIn("\n=HYPERLINK", text)
        self.assertNotIn(",=HYPERLINK", text)

    async def test_the_export_honours_the_same_filters_as_the_list(self):
        await self.make_lead(email="in@e.com", status="new")
        await self.make_lead(email="out@e.com", status="won")
        r = await self.client.get("/api/admin/leads/export.csv?status=new", headers=self.headers)
        self.assertIn("in@e.com", r.text)
        # The export must not quietly include a different set of rows than the
        # list the admin was looking at when they clicked Export.
        self.assertNotIn("out@e.com", r.text)

    async def test_the_export_is_not_shadowed_by_the_detail_route(self):
        # Declared in the wrong order, `/leads/export.csv` arrives as a lead id
        # and 404s -- a bug that only shows up when someone clicks the button.
        r = await self.client.get("/api/admin/leads/export.csv", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)

    async def test_the_export_is_not_cached_by_a_proxy(self):
        r = await self.client.get("/api/admin/leads/export.csv", headers=self.headers)
        # One admin's filtered snapshot must not be served to another.
        self.assertEqual(r.headers.get("cache-control"), "no-store")

    # =====================================================================
    # Manual entry, the source only an admin may claim
    # =====================================================================

    async def test_an_admin_can_record_a_lead_by_hand(self):
        r = await self.client.post(
            "/api/admin/leads",
            headers=self.headers,
            json={
                "name": "Walk-in",
                "phone": "9876543210",
                "message": "met at the trade show",
                "source": "manual",
                "note": "Wants a bulk quote",
            },
        )
        self.assertEqual(r.status_code, 201, r.text)
        body = r.json()["data"]
        self.assertEqual(body["source"], "manual")
        self.assertEqual(body["note_count"], 1)
        # The initial note is in the log, not just the column.
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT body FROM lead_notes WHERE lead_id = $1::uuid", body["id"]
            ),
            "Wants a bulk quote",
        )

    async def test_a_manual_lead_with_no_reply_address_is_refused(self):
        r = await self.client.post(
            "/api/admin/leads", headers=self.headers, json={"name": "Nobody"}
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(await self.lead_count(), 0)

    async def test_a_manual_lead_may_claim_checkout_abandon(self):
        # The one other source the public route must not accept.
        r = await self.client.post(
            "/api/admin/leads",
            headers=self.headers,
            json={"email": "a@e.com", "source": "checkout_abandon"},
        )
        self.assertEqual(r.status_code, 201, r.text)

    async def test_a_manual_lead_naming_a_product_that_does_not_exist_is_a_404(self):
        r = await self.client.post(
            "/api/admin/leads",
            headers=self.headers,
            json={"email": "a@e.com", "product_id": str(uuid.uuid4())},
        )
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(await self.lead_count(), 0)

    async def test_a_manual_lead_assigned_to_a_customer_is_a_404(self):
        r = await self.client.post(
            "/api/admin/leads",
            headers=self.headers,
            json={"email": "a@e.com", "assigned_to": self.customer_id},
        )
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(await self.lead_count(), 0)

    async def test_the_public_route_cannot_reach_manual_entry(self):
        # Defense in depth on the source restriction: the public path and the
        # manual path are different routes with different guards.
        r = await self.client.post(
            "/api/admin/leads", json={"email": "a@e.com", "source": "manual"}
        )
        self.assertIn(r.status_code, (401, 403), r.text)
        self.assertEqual(await self.lead_count(), 0)

    # =====================================================================
    # V12's schema
    # =====================================================================

    async def test_a_blank_note_cannot_be_inserted_at_the_database_level(self):
        # chk_lead_note_body. The route checks too; this is the backstop for a
        # writer that does not go through the route.
        lead_id = await self.make_lead(email="a@e.com")
        import asyncpg

        with self.assertRaises(asyncpg.CheckViolationError):
            await self.pool.execute(
                "INSERT INTO lead_notes (lead_id, body) VALUES ($1::uuid, '   ')", lead_id
            )

    async def test_deleting_a_lead_takes_its_notes_with_it(self):
        # ON DELETE CASCADE. Orphan notes are rows with no way to reach them and
        # no way to clean them up.
        lead_id = await self.make_lead(email="a@e.com")
        await self.client.post(
            f"/api/admin/leads/{lead_id}/notes", headers=self.headers, json={"body": "hi"}
        )
        await self.pool.execute("DELETE FROM leads WHERE id = $1::uuid", lead_id)
        self.assertEqual(
            int(await self.pool.fetchval("SELECT count(*) FROM lead_notes")), 0
        )


if __name__ == "__main__":
    unittest.main()




