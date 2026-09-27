"""
Admin catalogue and order management - F1 to F5, against a real database.

Almost everything in this file is about a rule the *wrong* implementation would
pass:

- Writing `products.stock_qty` on a product that has options looks like it
  works. The V8 trigger only reasserts on the next option edit, so the value
  sits there being wrong until then. The tests therefore assert the route
  *refuses*, and assert the parent total is still the sum afterwards.
- Deleting a product that was ordered is a foreign key violation, which is a
  500. The tests assert a 409 that names the number of order lines.
- Deleting a category with children does not fail at all -- `parent_id` is
  `ON DELETE SET NULL` -- it silently re-roots the subtree. The tests assert a
  409 instead.
- `categories.description` was accepted by the API and stored nowhere. The
  tests read the row back, because "the request returned 201" is exactly what
  was true before the fix.

Skipped unless TEST_DATABASE_URL is set, so a plain `pytest` run stays green
without a database.

    TEST_DATABASE_URL=postgresql://... python -m pytest tests/test_admin_ops.py -v
"""
import json
import os
import unittest
import uuid

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()


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
    """
    The error body, with `data` merged in.

    `main.py`'s handler reads only `code`, `message`, `details` and `data` out
    of a route's `detail` dict -- anything else a route puts alongside those is
    dropped before serialisation. So a route's structured payload has to go
    under `data`, and a test asserting on a sibling key would be asserting on
    something no client can ever see.
    """
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


@unittest.skipUnless(TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping admin ops tests")
class AdminOpsTests(unittest.IsolatedAsyncioTestCase):
    maxDiff = None

    async def asyncSetUp(self):
        import asyncpg

        self.pool = await asyncpg.create_pool(dsn=TEST_DATABASE_URL, min_size=1, max_size=4)
        # payment_events has no foreign key, so CASCADE never reaches it and a
        # fixed event_id from a previous run arrives as a false "redelivery".
        await self.pool.execute(
            "TRUNCATE users, categories, payment_events RESTART IDENTITY CASCADE"
        )

        # `get_db` reads the module-global pool, so the routes under test need
        # this installed or every request is a 500 "Database pool not
        # initialised" and the assertions are all measuring the same error.
        from app.db import set_pool

        set_pool(self.pool)

        import httpx

        from app.main import app

        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        )

        self.category_id = str(
            await self.pool.fetchval(
                "INSERT INTO categories (name, slug) VALUES ('Apparel','apparel') RETURNING id"
            )
        )
        self.seller_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Seller','seller@example.com','x','seller') RETURNING id"
            )
        )
        await self.pool.execute(
            "INSERT INTO seller_profiles (user_id, store_name) VALUES ($1,'Admin Store')",
            self.seller_id,
        )
        self.customer_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Buyer','buyer@example.com','x','customer') RETURNING id"
            )
        )
        self.admin_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Admin','admin@example.com','x','admin') RETURNING id"
            )
        )
        self.headers = auth_header(self.admin_id, "admin", "admin@example.com")
        self.customer_headers = auth_header(self.customer_id, "customer", "buyer@example.com")

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    # -- fixtures ---------------------------------------------------------

    async def make_product(self, **kw) -> str:
        n = uuid.uuid4().hex[:10]
        defaults = {
            "title": f"Product {n}",
            "price": 100.0,
            "stock_qty": 10,
            "status": "active",
        }
        defaults.update(kw)
        return str(
            await self.pool.fetchval(
                """INSERT INTO products
                     (seller_id, category_id, title, slug, description, price,
                      stock_qty, status, images)
                   VALUES ($1,$2,$3,$4,'desc',$5,$6,$7,'[]'::jsonb) RETURNING id""",
                self.seller_id,
                self.category_id,
                defaults["title"],
                f"p-{n}",
                defaults["price"],
                defaults["stock_qty"],
                defaults["status"],
            )
        )

    async def make_variant_product(self, stocks=(5, 3)) -> tuple:
        """
        A product with options, in the state the real routes leave it in.

        The option rows go in directly and then the app's own `sync_variant_flag`
        is called, rather than a hand-written `UPDATE products SET
        has_variants = TRUE`. V8's stock trigger is gated on that flag, so
        inserting options while it is still false syncs nothing; setting the flag
        by hand leaves the parent at whatever stock it had and the sum never
        happens. A fixture that does that is asserting against a state the
        product can never be in -- and it made this read as a trigger bug when it
        was the fixture. Production always goes through `sync_variant_flag`, so
        the fixture does too.
        """
        from app.variants import sync_variant_flag

        product_id = await self.make_product(stock_qty=0)
        ids = []
        for i, stock in enumerate(stocks):
            ids.append(
                str(
                    await self.pool.fetchval(
                        """INSERT INTO product_variants
                             (product_id, price, stock_qty, attributes, is_active, sort_order)
                           VALUES ($1, 100, $2, $3::jsonb, true, $4) RETURNING id""",
                        product_id,
                        stock,
                        json.dumps({"size": f"S{i + 1}"}),
                        i,
                    )
                )
            )
        async with self.pool.acquire() as conn:
            await sync_variant_flag(conn, product_id)
        return product_id, ids

    async def make_order(self, product_id: str, quantity: int = 1, total: str = "100.00") -> str:
        order_id = str(
            await self.pool.fetchval(
                """INSERT INTO orders (user_id, total_amount, status, shipping_address)
                   VALUES ($1,$2::numeric,'paid',$3::jsonb) RETURNING id""",
                self.customer_id,
                total,
                json.dumps(
                    {
                        "full_name": "Buyer Example",
                        "phone": "9999999999",
                        "line1": "12 MG Road",
                        "city": "Pune",
                        "state": "Maharashtra",
                        "pincode": "411001",
                    }
                ),
            )
        )
        await self.pool.execute(
            """INSERT INTO order_items (order_id, product_id, seller_id, quantity, price_at_purchase)
               VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::numeric)""",
            order_id,
            product_id,
            self.seller_id,
            quantity,
            total,
        )
        return order_id

    # =====================================================================
    # F1. Admin product create / edit / delete
    # =====================================================================

    async def test_admin_can_create_a_product_for_a_seller(self):
        r = await self.client.post(
            "/api/admin/products",
            headers=self.headers,
            json={
                "seller_id": self.seller_id,
                "title": "Handwoven Kanjivaram",
                "category_id": self.category_id,
                "price": 2450.0,
                "description": "Silk, handloom.",
                "stock_qty": 4,
                "status": "active",
                "images": ["https://cdn.example.com/a.webp"],
            },
        )
        self.assertEqual(r.status_code, 201, r.text)
        data = r.json()["data"]
        self.assertEqual(data["title"], "Handwoven Kanjivaram")
        self.assertEqual(data["seller_id"], self.seller_id)
        self.assertEqual(data["price"], 2450.0)
        # The slug has to be unique; a bare slugified title would collide the
        # second time anyone created two products with the same name.
        self.assertTrue(data["slug"])
        self.assertNotEqual(data["slug"], "handwoven-kanjivaram")

    async def test_a_created_product_really_lands_in_the_database(self):
        r = await self.client.post(
            "/api/admin/products",
            headers=self.headers,
            json={
                "seller_id": self.seller_id,
                "title": "Persisted Thing",
                "category_id": self.category_id,
                "price": 10.0,
            },
        )
        self.assertEqual(r.status_code, 201, r.text)
        pid = r.json()["data"]["id"]
        row = await self.pool.fetchrow("SELECT title, price FROM products WHERE id = $1::uuid", pid)
        self.assertIsNotNone(row)
        self.assertEqual(row["title"], "Persisted Thing")

    async def test_creating_for_an_unknown_seller_is_404(self):
        r = await self.client.post(
            "/api/admin/products",
            headers=self.headers,
            json={
                "seller_id": str(uuid.uuid4()),
                "title": "Orphan",
                "category_id": self.category_id,
                "price": 1.0,
            },
        )
        self.assertEqual(r.status_code, 404)
        self.assertEqual(err(r).get("code"), "SELLER_NOT_FOUND")

    async def test_a_compare_at_price_below_the_price_is_400_not_500(self):
        # products has CHECK (compare_at_price >= price). Left to the database
        # this is a 500; the admin is told what is wrong instead.
        r = await self.client.post(
            "/api/admin/products",
            headers=self.headers,
            json={
                "seller_id": self.seller_id,
                "title": "Backwards Discount",
                "category_id": self.category_id,
                "price": 500.0,
                "compare_at_price": 100.0,
            },
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "INVALID_COMPARE_AT_PRICE")

    async def test_admin_can_edit_a_product(self):
        pid = await self.make_product(price=100.0)
        r = await self.client.put(
            f"/api/admin/products/{pid}",
            headers=self.headers,
            json={"price": 149.0, "title": "Renamed"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["price"], 149.0)
        self.assertEqual(data["title"], "Renamed")
        # A partial update must not blank the fields it was not given. This is
        # the whole reason it is a different body from create.
        row = await self.pool.fetchrow(
            "SELECT description, slug FROM products WHERE id = $1::uuid", pid
        )
        self.assertEqual(row["description"], "desc")
        self.assertTrue(row["slug"])

    async def test_the_edit_route_will_not_take_stock(self):
        # Stock is F2's job and carries the variant rule. If this route also
        # accepted it, that rule has a way around it.
        pid = await self.make_product(stock_qty=10)
        r = await self.client.put(
            f"/api/admin/products/{pid}",
            headers=self.headers,
            json={"stock_qty": 999},
        )
        # Either the field is ignored or the request is rejected; what must not
        # happen is the number being written.
        if r.status_code == 200:
            row = await self.pool.fetchval(
                "SELECT stock_qty FROM products WHERE id = $1::uuid", pid
            )
            self.assertEqual(int(row), 10, "stock was written through the edit route")

    async def test_a_non_admin_cannot_create_a_product(self):
        r = await self.client.post(
            "/api/admin/products",
            headers=self.customer_headers,
            json={
                "seller_id": self.seller_id,
                "title": "Sneaky",
                "category_id": self.category_id,
                "price": 1.0,
            },
        )
        self.assertIn(r.status_code, (401, 403), r.text)

    async def test_a_product_with_no_order_history_can_be_deleted(self):
        pid = await self.make_product()
        r = await self.client.delete(f"/api/admin/products/{pid}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(
            await self.pool.fetchval("SELECT 1 FROM products WHERE id = $1::uuid", pid)
        )

    async def test_deleting_an_ordered_product_is_409_and_says_how_many(self):
        pid = await self.make_product()
        await self.make_order(pid)
        await self.make_order(pid)
        r = await self.client.delete(f"/api/admin/products/{pid}", headers=self.headers)
        # order_items.product_id is ON DELETE RESTRICT, so this would be a 500
        # from the database if it were not caught first.
        self.assertEqual(r.status_code, 409, r.text)
        body = err(r)
        self.assertEqual(body.get("code"), "PRODUCT_HAS_ORDER_HISTORY")
        self.assertEqual(body.get("order_line_count"), 2)
        self.assertIn("Archive", body.get("message", ""))
        # And the product is still there.
        self.assertIsNotNone(
            await self.pool.fetchval("SELECT 1 FROM products WHERE id = $1::uuid", pid)
        )

    async def test_deleting_a_variant_product_takes_its_options_with_it(self):
        pid, variant_ids = await self.make_variant_product()
        r = await self.client.delete(f"/api/admin/products/{pid}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        for vid in variant_ids:
            self.assertIsNone(
                await self.pool.fetchval(
                    "SELECT 1 FROM product_variants WHERE id = $1::uuid", vid
                )
            )

    async def test_a_malformed_product_id_is_404_not_500(self):
        r = await self.client.delete("/api/admin/products/not-a-uuid", headers=self.headers)
        self.assertEqual(r.status_code, 404, r.text)

    # =====================================================================
    # F2. Admin stock management
    # =====================================================================

    async def test_admin_can_set_stock_on_a_plain_product(self):
        pid = await self.make_product(stock_qty=10)
        r = await self.client.put(
            f"/api/admin/products/{pid}/stock",
            headers=self.headers,
            json={"stock_qty": 42, "reason": "Recount after the audit"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["previous_stock"], 10)
        self.assertEqual(data["stock_qty"], 42)
        row = await self.pool.fetchval("SELECT stock_qty FROM products WHERE id = $1::uuid", pid)
        self.assertEqual(int(row), 42)

    async def test_setting_stock_on_a_variant_product_is_refused(self):
        # The load-bearing test of this whole section. The write would be
        # accepted, displayed, and then erased by the next option edit, so the
        # route has to refuse and hand back the options instead.
        pid, variant_ids = await self.make_variant_product(stocks=(7, 5))
        r = await self.client.put(
            f"/api/admin/products/{pid}/stock",
            headers=self.headers,
            json={"stock_qty": 1},
        )
        self.assertEqual(r.status_code, 409, r.text)
        body = err(r)
        self.assertEqual(body.get("code"), "VARIANT_STOCK_REQUIRED")
        self.assertEqual(len(body.get("variants", [])), 2)
        # Crucially: the number was NOT written.
        total = await self.pool.fetchval("SELECT stock_qty FROM products WHERE id = $1::uuid", pid)
        self.assertEqual(int(total), 12)

    async def test_the_refusal_names_the_options_and_their_stock(self):
        pid, _ = await self.make_variant_product(stocks=(7, 5))
        r = await self.client.put(
            f"/api/admin/products/{pid}/stock", headers=self.headers, json={"stock_qty": 1}
        )
        options = err(r).get("variants", [])
        by_size = {o["attributes"]["size"]: o["stock_qty"] for o in options}
        self.assertEqual(by_size, {"S1": 7, "S2": 5})

    async def test_setting_stock_on_an_option_updates_the_product_total(self):
        pid, variant_ids = await self.make_variant_product(stocks=(7, 5))
        r = await self.client.put(
            f"/api/admin/variants/{variant_ids[0]}/stock",
            headers=self.headers,
            json={"stock_qty": 20, "reason": "Restock"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["previous_stock"], 7)
        self.assertEqual(data["stock_qty"], 20)
        # Read back from the database rather than trusting the response: the
        # trigger, not this code, is what maintains the total.
        total = await self.pool.fetchval("SELECT stock_qty FROM products WHERE id = $1::uuid", pid)
        self.assertEqual(int(total), 25)
        self.assertEqual(data["product_total"], 25)

    async def test_negative_stock_is_rejected(self):
        pid = await self.make_product()
        r = await self.client.put(
            f"/api/admin/products/{pid}/stock", headers=self.headers, json={"stock_qty": -1}
        )
        self.assertEqual(r.status_code, 400, r.text)

    async def test_a_rejected_value_is_a_400_not_a_500_on_any_route(self):
        """
        Regression, and it is not about this file.

        `main.py`'s RequestValidationError handler passed `exc.errors()`
        straight to JSONResponse. When a custom `field_validator` raises,
        pydantic puts the exception *instance* in `ctx["error"]`, which is not
        serialisable -- so the JSONResponse raised, the generic handler caught
        it, and a correctly-rejected input came back 500. Every route with such
        a validator had it, `variants.py` included, long before this section.

        Pinned on the pre-existing seller route rather than on a new one, so
        the fix is measured where the bug was, not only where it was found.
        Ownership is irrelevant: the body is validated before the route runs.
        """
        pid = await self.make_product()
        r = await self.client.post(
            f"/api/products/{pid}/variants",
            headers=self.headers,
            json={"price": 100, "stock_qty": -5, "attributes": {"size": "M"}},
        )
        self.assertEqual(r.status_code, 400, r.text)
        body = err(r)
        self.assertEqual(body.get("code"), "VALIDATION_ERROR")
        # The validator's own words survive, which is the part a client needs
        # and the part that was being thrown away with the unserialisable ctx.
        blob = json.dumps(body)
        self.assertIn("stock_qty cannot be negative", blob)

        # And nothing was written.
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT count(*) FROM product_variants WHERE product_id = $1::uuid", pid
            ),
            0,
        )

    async def test_every_stock_write_is_recorded(self):
        pid = await self.make_product(stock_qty=10)
        await self.client.put(
            f"/api/admin/products/{pid}/stock",
            headers=self.headers,
            json={"stock_qty": 3, "reason": "Damaged in transit"},
        )
        moves = await self.pool.fetch(
            "SELECT previous_qty, new_qty, reason, actor_id FROM product_stock_movements "
            "WHERE product_id = $1::uuid",
            pid,
        )
        self.assertEqual(len(moves), 1)
        self.assertEqual(int(moves[0]["previous_qty"]), 10)
        self.assertEqual(int(moves[0]["new_qty"]), 3)
        self.assertEqual(moves[0]["reason"], "Damaged in transit")
        self.assertEqual(str(moves[0]["actor_id"]), self.admin_id)

    async def test_a_no_op_stock_write_is_still_recorded(self):
        # "An admin set it to what it already was" is worth knowing when
        # someone asks why a listing is at zero.
        pid = await self.make_product(stock_qty=0)
        r = await self.client.put(
            f"/api/admin/products/{pid}/stock",
            headers=self.headers,
            json={"stock_qty": 0, "reason": "Confirming the zero"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        count = await self.pool.fetchval(
            "SELECT COUNT(*) FROM product_stock_movements WHERE product_id = $1::uuid", pid
        )
        self.assertEqual(int(count), 1)

    async def test_an_option_stock_write_records_the_product_too(self):
        pid, variant_ids = await self.make_variant_product(stocks=(7, 5))
        await self.client.put(
            f"/api/admin/variants/{variant_ids[1]}/stock",
            headers=self.headers,
            json={"stock_qty": 1},
        )
        row = await self.pool.fetchrow(
            """SELECT product_id::text AS pid, variant_id::text AS vid
                 FROM product_stock_movements WHERE product_id = $1::uuid""",
            pid,
        )
        self.assertEqual(row["pid"], pid)
        self.assertEqual(row["vid"], variant_ids[1])

    async def test_the_stock_history_is_readable_and_newest_first(self):
        pid = await self.make_product(stock_qty=10)
        for qty in (8, 6, 4):
            await self.client.put(
                f"/api/admin/products/{pid}/stock",
                headers=self.headers,
                json={"stock_qty": qty, "reason": f"to {qty}"},
            )
        r = await self.client.get(
            f"/api/admin/products/{pid}/stock-movements", headers=self.headers
        )
        self.assertEqual(r.status_code, 200, r.text)
        rows = r.json()["data"]
        self.assertEqual(len(rows), 3)
        self.assertEqual([row["new_qty"] for row in rows], [4, 6, 8])
        self.assertEqual(rows[0]["reason"], "to 4")
        self.assertEqual(rows[0]["actor_id"], self.admin_id)

    async def test_stock_routes_are_admin_only(self):
        pid = await self.make_product()
        for path, method in (
            (f"/api/admin/products/{pid}/stock", "put"),
            (f"/api/admin/products/{pid}/stock-movements", "get"),
        ):
            r = await getattr(self.client, method)(path, headers=self.customer_headers)
            self.assertIn(r.status_code, (401, 403), f"{method} {path} -> {r.status_code}")

    async def test_stock_on_a_missing_product_is_404(self):
        r = await self.client.put(
            f"/api/admin/products/{uuid.uuid4()}/stock",
            headers=self.headers,
            json={"stock_qty": 1},
        )
        self.assertEqual(r.status_code, 404, r.text)

    # =====================================================================
    # F3. Admin categories edit / delete
    # =====================================================================

    async def test_a_category_description_is_actually_stored(self):
        # The bug this fixes: `description` was accepted by the schema and
        # never written, because the column did not exist until V10. Asserting
        # a 201 would have passed before the fix too.
        r = await self.client.post(
            "/api/admin/categories",
            headers=self.headers,
            json={
                "name": "Handloom",
                "description": "Woven by hand, not printed.",
                "icon_url": "https://cdn.example.com/handloom.webp",
            },
        )
        self.assertEqual(r.status_code, 201, r.text)
        row = await self.pool.fetchrow(
            "SELECT description, icon_url FROM categories WHERE slug = 'handloom'"
        )
        self.assertEqual(row["description"], "Woven by hand, not printed.")
        self.assertEqual(row["icon_url"], "https://cdn.example.com/handloom.webp")

    async def test_a_category_can_be_renamed_and_given_a_description(self):
        cid = str(
            await self.pool.fetchval(
                "INSERT INTO categories (name, slug) VALUES ('Old Name','old-name') RETURNING id"
            )
        )
        r = await self.client.put(
            f"/api/admin/categories/{cid}",
            headers=self.headers,
            json={"name": "New Name", "description": "Moved on."},
        )
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["name"], "New Name")
        self.assertEqual(data["description"], "Moved on.")
        # The slug is not rewritten from the new name, because a slug is a URL
        # that other people may already have linked to.
        self.assertEqual(data["slug"], "old-name")

    async def test_a_duplicate_category_name_is_409_not_500(self):
        await self.pool.execute(
            "INSERT INTO categories (name, slug) VALUES ('Taken','taken')"
        )
        r = await self.client.post(
            "/api/admin/categories", headers=self.headers, json={"name": "Taken"}
        )
        self.assertEqual(r.status_code, 409, r.text)
        self.assertEqual(err(r).get("code"), "CATEGORY_CONFLICT")

    async def test_a_category_cannot_become_its_own_parent(self):
        cid = str(
            await self.pool.fetchval(
                "INSERT INTO categories (name, slug) VALUES ('Self','self') RETURNING id"
            )
        )
        r = await self.client.put(
            f"/api/admin/categories/{cid}",
            headers=self.headers,
            json={"parent_id": cid},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "CATEGORY_CYCLE")

    async def test_a_category_cannot_move_under_its_own_descendant(self):
        parent = str(
            await self.pool.fetchval(
                "INSERT INTO categories (name, slug) VALUES ('Root Cat','root-cat') RETURNING id"
            )
        )
        child = str(
            await self.pool.fetchval(
                """INSERT INTO categories (name, slug, parent_id)
                   VALUES ('Mid Cat','mid-cat',$1) RETURNING id""",
                parent,
            )
        )
        leaf = str(
            await self.pool.fetchval(
                """INSERT INTO categories (name, slug, parent_id)
                   VALUES ('Leaf Cat','leaf-cat',$1) RETURNING id""",
                child,
            )
        )
        # Root under Leaf would detach the whole branch from the tree.
        r = await self.client.put(
            f"/api/admin/categories/{parent}",
            headers=self.headers,
            json={"parent_id": leaf},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "CATEGORY_CYCLE")
        # And the grandchild case, two levels down, is caught too.
        r2 = await self.client.put(
            f"/api/admin/categories/{parent}",
            headers=self.headers,
            json={"parent_id": child},
        )
        self.assertEqual(r2.status_code, 400, r2.text)

    async def test_a_category_can_be_unparented(self):
        parent = str(
            await self.pool.fetchval(
                "INSERT INTO categories (name, slug) VALUES ('Up','up-cat') RETURNING id"
            )
        )
        child = str(
            await self.pool.fetchval(
                """INSERT INTO categories (name, slug, parent_id)
                   VALUES ('Down','down-cat',$1) RETURNING id""",
                parent,
            )
        )
        r = await self.client.put(
            f"/api/admin/categories/{child}", headers=self.headers, json={"parent_id": None}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(r.json()["data"]["parent_id"])

    async def test_deleting_a_category_with_children_is_refused(self):
        # Without this check the delete *succeeds*: parent_id is
        # ON DELETE SET NULL, so the children are silently re-rooted.
        parent = str(
            await self.pool.fetchval(
                "INSERT INTO categories (name, slug) VALUES ('Parent','parent-cat') RETURNING id"
            )
        )
        await self.pool.execute(
            """INSERT INTO categories (name, slug, parent_id)
               VALUES ('Child One','child-one',$1),
                      ('Child Two','child-two',$1)""",
            parent,
        )
        r = await self.client.delete(f"/api/admin/categories/{parent}", headers=self.headers)
        self.assertEqual(r.status_code, 409, r.text)
        body = err(r)
        self.assertEqual(body.get("code"), "CATEGORY_HAS_CHILDREN")
        self.assertEqual(body.get("child_count"), 2)
        # Still there, with both children intact.
        children = await self.pool.fetchval(
            "SELECT COUNT(*) FROM categories WHERE parent_id = $1::uuid", parent
        )
        self.assertEqual(int(children), 2)

    async def test_deleting_a_category_with_products_is_refused(self):
        await self.make_product()
        r = await self.client.delete(
            f"/api/admin/categories/{self.category_id}", headers=self.headers
        )
        # products.category_id is ON DELETE RESTRICT, so this would be a 500.
        self.assertEqual(r.status_code, 409, r.text)
        body = err(r)
        self.assertEqual(body.get("code"), "CATEGORY_IN_USE")
        self.assertGreaterEqual(body.get("product_count", 0), 1)

    async def test_an_empty_category_can_be_deleted(self):
        cid = str(
            await self.pool.fetchval(
                "INSERT INTO categories (name, slug) VALUES ('Temporary','temporary') RETURNING id"
            )
        )
        r = await self.client.delete(f"/api/admin/categories/{cid}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(
            await self.pool.fetchval("SELECT 1 FROM categories WHERE id = $1::uuid", cid)
        )

    async def test_category_routes_are_admin_only(self):
        # POST, not GET: `/api/admin/categories` is create-only, so a GET here
        # would answer 405 and a 405 is not an authorisation signal -- it says
        # the path exists for a different verb, which tells a non-admin nothing
        # either way. The guard has to be checked on the verbs that exist.
        r = await self.client.post(
            "/api/admin/categories",
            headers=self.customer_headers,
            json={"name": "Nope", "slug": "nope"},
        )
        self.assertIn(r.status_code, (401, 403), f"POST -> {r.status_code}")
        self.assertIsNone(
            await self.pool.fetchval(
                "SELECT 1 FROM categories WHERE slug = 'nope'"
            ),
            "a non-admin got as far as writing a category",
        )

        cid = str(uuid.uuid4())
        # httpx's `delete()` takes no body, so the payload is only attached to
        # the verb that has one.
        r = await self.client.put(
            f"/api/admin/categories/{cid}",
            headers=self.customer_headers,
            json={"name": "x"},
        )
        self.assertIn(r.status_code, (401, 403), f"put -> {r.status_code}")
        r = await self.client.delete(
            f"/api/admin/categories/{cid}", headers=self.customer_headers
        )
        self.assertIn(r.status_code, (401, 403), f"delete -> {r.status_code}")

    # =====================================================================
    # F4. Admin order list
    # =====================================================================

    async def test_the_admin_order_list_shows_orders(self):
        pid = await self.make_product()
        oid = await self.make_order(pid, quantity=2, total="200.00")
        r = await self.client.get("/api/admin/orders", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        rows = r.json()["data"]
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["id"], oid)
        self.assertEqual(row["total_amount"], 200.0)
        self.assertEqual(row["item_count"], 1)
        self.assertEqual(row["customer_email"], "buyer@example.com")
        # The list carries the town, not the whole address.
        self.assertEqual(row["ship_to"]["city"], "Pune")
        self.assertNotIn("line1", row["ship_to"])
        self.assertNotIn("shipping_address", row)

    async def test_the_order_list_filters_by_status(self):
        pid = await self.make_product()
        paid = await self.make_order(pid)
        cancelled = await self.make_order(pid)
        await self.pool.execute(
            "UPDATE orders SET status = 'cancelled' WHERE id = $1::uuid", cancelled
        )
        r = await self.client.get("/api/admin/orders?status=paid", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        ids = [row["id"] for row in r.json()["data"]]
        self.assertEqual(ids, [paid])
        self.assertEqual(r.json()["counts"]["cancelled"], 1)
        self.assertEqual(r.json()["counts"]["all"], 2)

    async def test_an_unknown_status_filter_is_400(self):
        # Not an empty list: a typo in a filter should be visible, not read as
        # "no orders match".
        r = await self.client.get("/api/admin/orders?status=refunded", headers=self.headers)
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "INVALID_STATUS")

    async def test_the_order_list_searches_by_customer_and_by_id(self):
        pid = await self.make_product()
        oid = await self.make_order(pid)
        by_email = await self.client.get(
            "/api/admin/orders?search=buyer@example.com", headers=self.headers
        )
        self.assertEqual([row["id"] for row in by_email.json()["data"]], [oid])
        by_id = await self.client.get(
            f"/api/admin/orders?search={oid}", headers=self.headers
        )
        self.assertEqual([row["id"] for row in by_id.json()["data"]], [oid])
        # A short prefix, which is what someone copies off a screenshot. Cast
        # to uuid here would be a 22P02 and a 500.
        partial = await self.client.get(
            f"/api/admin/orders?search={oid[:8]}", headers=self.headers
        )
        self.assertEqual(partial.status_code, 200, partial.text)
        self.assertEqual([row["id"] for row in partial.json()["data"]], [oid])

    async def test_the_order_list_filters_by_date_range_inclusively(self):
        pid = await self.make_product()
        await self.make_order(pid)
        today = await self.pool.fetchval("SELECT CURRENT_DATE::text")
        inside = await self.client.get(
            f"/api/admin/orders?date_from={today}&date_to={today}", headers=self.headers
        )
        self.assertEqual(len(inside.json()["data"]), 1, inside.text)
        # Yesterday to yesterday must not include an order created today.
        yesterday = await self.pool.fetchval(
            "SELECT (CURRENT_DATE - 1)::text"
        )
        outside = await self.client.get(
            f"/api/admin/orders?date_from={yesterday}&date_to={yesterday}", headers=self.headers
        )
        self.assertEqual(len(outside.json()["data"]), 0)

    async def test_a_malformed_date_is_400(self):
        r = await self.client.get(
            "/api/admin/orders?date_from=not-a-date", headers=self.headers
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "INVALID_DATE")

    async def test_the_order_list_paginates(self):
        pid = await self.make_product()
        for _ in range(3):
            await self.make_order(pid)
        page1 = await self.client.get("/api/admin/orders?limit=2&page=1", headers=self.headers)
        page2 = await self.client.get("/api/admin/orders?limit=2&page=2", headers=self.headers)
        self.assertEqual(len(page1.json()["data"]), 2)
        self.assertEqual(len(page2.json()["data"]), 1)
        self.assertEqual(page1.json()["pagination"], {"total": 3, "page": 1, "limit": 2, "pages": 2})
        ids = {row["id"] for row in page1.json()["data"] + page2.json()["data"]}
        self.assertEqual(len(ids), 3, "pagination repeated or dropped an order")

    async def test_the_order_list_is_admin_only(self):
        r = await self.client.get("/api/admin/orders", headers=self.customer_headers)
        self.assertIn(r.status_code, (401, 403))
        r2 = await self.client.get("/api/admin/orders")
        self.assertIn(r2.status_code, (401, 403))

    # =====================================================================
    # F5. Admin order detail
    # =====================================================================

    async def test_the_order_detail_carries_items_payments_and_address(self):
        pid = await self.make_product()
        oid = await self.make_order(pid, quantity=3, total="100.00")
        await self.pool.execute(
            """INSERT INTO payments (order_id, amount, status, payment_gateway, provider_ref)
               VALUES ($1::uuid, 100.00, 'success', 'razorpay', 'pay_test_1')""",
            oid,
        )
        r = await self.client.get(f"/api/admin/orders/{oid}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]

        self.assertEqual(data["id"], oid)
        self.assertEqual(data["status"], "paid")
        self.assertEqual(data["total_amount"], 100.0)
        # The address is the purchase-time snapshot, not the customer's current
        # default, because this is the one that went on the label.
        self.assertEqual(data["shipping_address"]["line1"], "12 MG Road")
        self.assertEqual(data["shipping_address"]["pincode"], "411001")

        self.assertEqual(len(data["items"]), 1)
        item = data["items"][0]
        self.assertEqual(item["quantity"], 3)
        self.assertEqual(item["price_at_purchase"], 100.0)
        self.assertEqual(item["line_total"], 300.0)
        self.assertEqual(item["seller_id"], self.seller_id)

        self.assertEqual(len(data["payments"]), 1)
        self.assertEqual(data["payments"][0]["status"], "success")
        self.assertEqual(data["payments"][0]["provider_ref"], "pay_test_1")

    async def test_the_detail_agrees_with_the_refund_route_about_what_is_left(self):
        pid = await self.make_product()
        oid = await self.make_order(pid, quantity=1, total="500.00")
        await self.pool.execute(
            """INSERT INTO payments (order_id, amount, status)
               VALUES ($1::uuid, 500.00, 'success')""",
            oid,
        )
        await self.pool.execute(
            """INSERT INTO refunds (order_id, amount, reason, status)
               VALUES ($1::uuid, 200.00, 'damaged', 'processed')""",
            oid,
        )
        r = await self.client.get(f"/api/admin/orders/{oid}", headers=self.headers)
        totals = r.json()["data"]["totals"]
        self.assertEqual(totals["refunded"], 200.0)
        self.assertEqual(totals["refund_pending"], 0.0)
        self.assertEqual(totals["refundable"], 300.0)

    async def test_a_requested_refund_counts_as_pending_not_refunded(self):
        pid = await self.make_product()
        oid = await self.make_order(pid, total="500.00")
        await self.pool.execute(
            """INSERT INTO refunds (order_id, amount, reason, status)
               VALUES ($1::uuid, 100.00, 'customer_request', 'requested')""",
            oid,
        )
        r = await self.client.get(f"/api/admin/orders/{oid}", headers=self.headers)
        totals = r.json()["data"]["totals"]
        self.assertEqual(totals["refunded"], 0.0)
        self.assertEqual(totals["refund_pending"], 100.0)
        # Already spoken for, so the refund route will not accept it twice.
        self.assertEqual(totals["refundable"], 400.0)

    async def test_a_rejected_refund_does_not_reduce_the_refundable_amount(self):
        pid = await self.make_product()
        oid = await self.make_order(pid, total="500.00")
        await self.pool.execute(
            """INSERT INTO refunds (order_id, amount, reason, status)
               VALUES ($1::uuid, 100.00, 'customer_request', 'rejected')""",
            oid,
        )
        totals = (
            await self.client.get(f"/api/admin/orders/{oid}", headers=self.headers)
        ).json()["data"]["totals"]
        self.assertEqual(totals["refundable"], 500.0)

    async def test_the_detail_survives_a_deleted_option(self):
        # order_items.variant_id is ON DELETE SET NULL, so an option removed
        # after purchase leaves the line with no variant_id. The snapshot and
        # the sku are what still describe it.
        pid, variant_ids = await self.make_variant_product()
        oid = await self.make_order(pid)
        await self.pool.execute(
            """UPDATE order_items SET variant_id = $1::uuid, sku_at_purchase = 'S1-RD',
                      variant_snapshot = '{"size":"S1"}'::jsonb
                WHERE order_id = $2::uuid""",
            variant_ids[0],
            oid,
        )
        await self.pool.execute(
            "DELETE FROM product_variants WHERE id = $1::uuid", variant_ids[0]
        )
        r = await self.client.get(f"/api/admin/orders/{oid}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        item = r.json()["data"]["items"][0]
        self.assertIsNone(item["variant_id"])
        self.assertEqual(item["sku_at_purchase"], "S1-RD")
        self.assertEqual(item["variant_snapshot"], {"size": "S1"})

    async def test_a_missing_order_is_404_and_a_malformed_id_is_404(self):
        for path in (
            f"/api/admin/orders/{uuid.uuid4()}",
            "/api/admin/orders/not-a-uuid",
        ):
            r = await self.client.get(path, headers=self.headers)
            self.assertEqual(r.status_code, 404, f"{path} -> {r.status_code} {r.text}")

    async def test_the_order_detail_is_admin_only(self):
        pid = await self.make_product()
        oid = await self.make_order(pid)
        r = await self.client.get(f"/api/admin/orders/{oid}", headers=self.customer_headers)
        self.assertIn(r.status_code, (401, 403), r.text)

    # =====================================================================
    # F5b. Admin order status transitions
    # =====================================================================

    async def test_an_order_moves_one_step_forward_and_records_why(self):
        pid = await self.make_product()
        oid = await self.make_order(pid)
        r = await self.client.put(
            f"/api/admin/orders/{oid}/status",
            headers=self.headers,
            json={"status": "processing", "note": "Packed and labelled"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["status"], "processing")
        self.assertEqual(r.json()["data"]["next_status"], "shipped")
        history = await self.pool.fetch(
            "SELECT status, note, changed_by FROM order_status_history WHERE order_id = $1::uuid",
            oid,
        )
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["status"], "processing")
        self.assertEqual(history[0]["note"], "Packed and labelled")
        self.assertEqual(str(history[0]["changed_by"]), self.admin_id)

    async def test_a_skipped_step_is_refused(self):
        pid = await self.make_product()
        oid = await self.make_order(pid)
        r = await self.client.put(
            f"/api/admin/orders/{oid}/status", headers=self.headers, json={"status": "delivered"}
        )
        self.assertEqual(r.status_code, 409, r.text)
        body = err(r)
        self.assertEqual(body.get("code"), "INVALID_TRANSITION")
        self.assertEqual(body.get("allowed_next"), "processing")
        # And nothing moved.
        status = await self.pool.fetchval("SELECT status FROM orders WHERE id = $1::uuid", oid)
        self.assertEqual(status, "paid")

    async def test_a_delivered_order_cannot_be_put_back_into_shipped(self):
        pid = await self.make_product()
        oid = await self.make_order(pid)
        await self.pool.execute(
            "UPDATE orders SET status = 'delivered' WHERE id = $1::uuid", oid
        )
        r = await self.client.put(
            f"/api/admin/orders/{oid}/status", headers=self.headers, json={"status": "shipped"}
        )
        self.assertEqual(r.status_code, 409, r.text)

    async def test_cancelling_through_the_status_route_points_at_the_cancel_route(self):
        # The point of this: stock. Setting status=cancelled here would leave
        # the order holding inventory it no longer has, so the route refuses and
        # names the one path that puts the stock back.
        pid = await self.make_product()
        oid = await self.make_order(pid)
        r = await self.client.put(
            f"/api/admin/orders/{oid}/status", headers=self.headers, json={"status": "cancelled"}
        )
        self.assertEqual(r.status_code, 409, r.text)
        body = err(r)
        self.assertEqual(body.get("code"), "USE_CANCEL_ROUTE")
        self.assertIn("/cancel", body.get("cancel_route", ""))
        status = await self.pool.fetchval("SELECT status FROM orders WHERE id = $1::uuid", oid)
        self.assertEqual(status, "paid")

    async def test_setting_the_status_it_already_has_is_a_no_op(self):
        pid = await self.make_product()
        oid = await self.make_order(pid)
        r = await self.client.put(
            f"/api/admin/orders/{oid}/status", headers=self.headers, json={"status": "paid"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertFalse(r.json()["data"]["changed"])
        count = await self.pool.fetchval(
            "SELECT COUNT(*) FROM order_status_history WHERE order_id = $1::uuid", oid
        )
        self.assertEqual(int(count), 0, "a no-op wrote a history row")

    async def test_an_unknown_status_is_400(self):
        pid = await self.make_product()
        oid = await self.make_order(pid)
        r = await self.client.put(
            f"/api/admin/orders/{oid}/status", headers=self.headers, json={"status": "teleported"}
        )
        self.assertEqual(r.status_code, 400, r.text)

    async def test_the_status_route_is_admin_only(self):
        pid = await self.make_product()
        oid = await self.make_order(pid)
        r = await self.client.put(
            f"/api/admin/orders/{oid}/status",
            headers=self.customer_headers,
            json={"status": "shipped"},
        )
        self.assertIn(r.status_code, (401, 403), r.text)


if __name__ == "__main__":
    unittest.main()
