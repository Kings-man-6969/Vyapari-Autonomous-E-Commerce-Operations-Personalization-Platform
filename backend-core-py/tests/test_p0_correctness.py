"""
P0 Core Correctness & Security Test Suite:
1. Transactional Order Idempotency (same key replay -> identical 201, altered payload -> 422)
2. Payment Webhook Signature Verification & Deduplication
3. S3 Presigned Upload Validation (rejects SVGs, enforces 5MB limit, seller ID binding)
4. Security Headers & X-Request-ID Correlation
5. Token Family Rotation & Revocation
"""
import hashlib
import hmac
import json
import unittest
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.auth.service import generate_tokens, hash_token
from app.config import settings
from app.db import get_db, get_pool, set_pool
from app.main import app
from tests.mock_db import MockConnection, MockPool, MockRecord


class TestP0Correctness(unittest.TestCase):
    def setUp(self):
        self.customer_id = "cccccccc-0000-0000-0000-000000000001"
        self.seller_id = "ssssssss-0000-0000-0000-000000000001"

        self.customer_user = {
            "id": self.customer_id,
            "email": "customer@vyapari.in",
            "role": "customer",
            "name": "Customer User",
            "is_active": True,
        }
        self.customer_token, _ = generate_tokens(self.customer_user)
        self.auth_headers = {"Authorization": f"Bearer {self.customer_token}"}

        self.idempotency_store = {}
        self.payment_events = {}

        def mock_db_handler(op, query, *args):
            q = query.lower()

            # --- Idempotency records handling ---
            if "insert into idempotency_records" in q:
                user_id, key, req_hash = args[0], args[1], args[2]
                compound_key = (str(user_id), str(key))
                if compound_key in self.idempotency_store:
                    return None  # Conflict: ON CONFLICT DO NOTHING
                rec = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "key": key,
                    "request_hash": req_hash,
                    "status": "processing",
                    "response": None,
                    "status_code": None,
                }
                self.idempotency_store[compound_key] = rec
                return rec["id"]

            if "from idempotency_records" in q and op == "fetchrow":
                user_id, key = str(args[0]), str(args[1])
                return self.idempotency_store.get((user_id, key))

            if "update idempotency_records" in q:
                resp_json, user_id, key = args[0], str(args[1]), str(args[2])
                compound_key = (user_id, key)
                if compound_key in self.idempotency_store:
                    self.idempotency_store[compound_key]["status"] = "completed"
                    self.idempotency_store[compound_key]["response"] = resp_json
                    self.idempotency_store[compound_key]["status_code"] = 201
                return "UPDATE 1"

            # --- Payment events handling ---
            if "insert into payment_events" in q:
                event_id, event_type, p_hash = str(args[0]), args[1], args[2]
                if event_id in self.payment_events:
                    return None  # Conflict: duplicate
                self.payment_events[event_id] = {"event_id": event_id, "payload_hash": p_hash}
                return event_id

            if "from payment_events" in q and op == "fetchval":
                event_id = str(args[0])
                if event_id in self.payment_events:
                    return self.payment_events[event_id]["payload_hash"]
                return None

            # --- Product and stock checks ---
            if "from products where id = $1::uuid for update" in q:
                # has_variants is one of the columns the real SELECT issues, and
                # resolve_purchase_line reads it to tell "plain product, no choice
                # needed" apart from "offers options, none chosen yet". False is
                # the honest value for this fixture: these tests are about
                # idempotency, on a product with no options.
                return {
                    "id": args[0],
                    "title": "Silk Saree",
                    "price": 1999.0,
                    "stock_qty": 5,
                    "status": "active",
                    "seller_id": self.seller_id,
                    "has_variants": False,
                }

            # --- Order creation inserts ---
            if "insert into orders" in q:
                return {
                    "id": "00000000-0000-0000-0000-000000000099",
                    "total_amount": 1999.0,
                    "status": "pending",
                    "created_at": "2026-09-20T00:00:00Z",
                }

            if "insert into payments" in q:
                return {
                    "id": "pay-row-1",
                    "status": "created",
                    "amount": 1999.0,
                }

            # --- Refresh token sessions ---
            if "from refresh_token_sessions" in q:
                return {
                    "session_id": "sess-1",
                    "user_id": self.customer_id,
                    "family_id": "fam-1",
                    "expires_at": "2026-09-27T00:00:00Z",
                    "revoked_at": "2026-09-20T00:00:00Z",  # simulated revoked
                }

            return None

        self.mock_conn = MockConnection(mock_db_handler)
        self.mock_pool = MockPool(self.mock_conn)
        set_pool(self.mock_pool)
        app.dependency_overrides[get_db] = lambda: self.mock_conn
        app.dependency_overrides[get_pool] = lambda: self.mock_pool

        self.client = TestClient(app)

    def tearDown(self):
        set_pool(None)
        app.dependency_overrides.clear()

    # ------------------------------------------------------------------------
    # 1. Order Idempotency Tests
    # ------------------------------------------------------------------------
    def test_order_idempotency_same_key_replay(self):
        """Replaying identical request with same Idempotency-Key returns stored 201 response."""
        key = str(uuid.uuid4())
        payload = {
            "shipping_address": {"full_name": "Ramesh", "city": "Bengaluru", "pincode": "560001"},
            "items": [{"product_id": "11111111-0000-0000-0000-000000000001", "quantity": 1}],
        }
        headers = {**self.auth_headers, "Idempotency-Key": key}

        # 1st request
        r1 = self.client.post("/api/orders", json=payload, headers=headers)
        self.assertEqual(r1.status_code, 201)
        data1 = r1.json()
        self.assertTrue(data1["success"])
        order_id_1 = data1["data"]["order_id"]

        # 2nd request (replay)
        r2 = self.client.post("/api/orders", json=payload, headers=headers)
        self.assertEqual(r2.status_code, 201)
        data2 = r2.json()
        self.assertTrue(data2["success"])
        order_id_2 = data2["data"]["order_id"]

        self.assertEqual(order_id_1, order_id_2)

    def test_order_idempotency_payload_mismatch(self):
        """Reusing Idempotency-Key with altered payload returns 422 Unprocessable Entity."""
        key = str(uuid.uuid4())
        payload1 = {
            "shipping_address": {"city": "Bengaluru"},
            "items": [{"product_id": "11111111-0000-0000-0000-000000000001", "quantity": 1}],
        }
        payload2 = {
            "shipping_address": {"city": "Mumbai"},  # Changed city
            "items": [{"product_id": "11111111-0000-0000-0000-000000000001", "quantity": 1}],
        }

        # First request succeeds
        r1 = self.client.post("/api/orders", json=payload1, headers={**self.auth_headers, "Idempotency-Key": key})
        self.assertEqual(r1.status_code, 201)

        # Second request with altered payload fails with 422
        r2 = self.client.post("/api/orders", json=payload2, headers={**self.auth_headers, "Idempotency-Key": key})
        self.assertEqual(r2.status_code, 422)
        self.assertEqual(r2.json()["error"]["code"], "IDEMPOTENCY_PAYLOAD_MISMATCH")

    # ------------------------------------------------------------------------
    # 2. Payment Webhook Signature & Deduplication Tests
    # ------------------------------------------------------------------------
    def test_payment_webhook_signature_and_deduplication(self):
        webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET or settings.RAZORPAY_KEY_SECRET or "test_secret"
        raw_body = json.dumps({
            "event_id": "evt_order_12345",
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_999",
                        "order_id": "rzp_order_test_123",
                    }
                }
            }
        }).encode("utf-8")

        # 1. Invalid signature -> 400
        r_bad = self.client.post(
            "/api/payments/webhook",
            content=raw_body,
            headers={"X-Razorpay-Signature": "invalid_signature_hex", "Content-Type": "application/json"}
        )
        self.assertEqual(r_bad.status_code, 400)

        # 2. Valid signature -> 200, and 'unmatched' because rzp_order_test_123
        # is not an order of ours. This used to expect 'processed', which was a
        # claim the endpoint could not support: it matched nothing, so nothing was
        # applied, and answering 'processed' meant a capture for a gateway order we
        # do not have looked in Razorpay's dashboard exactly like one we handled.
        # The 200 is deliberate -- a 4xx would make Razorpay redeliver an event we
        # can never apply. The status code in the body is what tells a person.
        # (test_payment_flows covers the matched case, end to end.)
        valid_sig = hmac.new(webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        r_ok = self.client.post(
            "/api/payments/webhook",
            content=raw_body,
            headers={"X-Razorpay-Signature": valid_sig, "Content-Type": "application/json"}
        )
        self.assertEqual(r_ok.status_code, 200)
        self.assertEqual(r_ok.json()["status"], "unmatched")

        # 3. Duplicate delivery -> 200 duplicate_ignored
        r_dup = self.client.post(
            "/api/payments/webhook",
            content=raw_body,
            headers={"X-Razorpay-Signature": valid_sig, "Content-Type": "application/json"}
        )
        self.assertEqual(r_dup.status_code, 200)
        self.assertEqual(r_dup.json()["status"], "duplicate_ignored")

    # ------------------------------------------------------------------------
    # 3. Presigned Upload Validation (SSRF Safe)
    #
    # Rewritten alongside the storage layer. The old assertion was that the
    # response's upload_url was present and that the key was derived from the
    # caller's id -- both still true, and both were true of a route whose URLs
    # resolved to nothing. test_media_pipeline.py is where the upload path is
    # actually exercised now: bytes uploaded, renditions written, every
    # advertised width fetched over HTTP.
    # ------------------------------------------------------------------------
    def test_s3_presigned_upload_success(self):
        resp = self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/jpeg", "file_size": 1024 * 500},
            headers=self.auth_headers,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertIn("upload_url", data)
        self.assertIn(self.customer_id, data["object_key"])
        # The upload target is a bare stem, not a rendition. The local provider
        # names its own files "{uuid}@{width}w.webp" once the bytes have been
        # decoded and it knows the real aspect ratio, so a client-supplied
        # extension would be a guess -- and letting a client name a width would
        # let it overwrite a 400w rendition with a full-size original.
        self.assertTrue(data["object_key"].startswith(f"products/{self.customer_id}/"))
        self.assertNotIn("@", data["object_key"])
        # Where the image will live is not knowable until the bytes land, which
        # is the point: the old route returned a cdn.vyapari.com URL that did
        # not resolve, before anything had been uploaded.
        self.assertIsNone(data["public_url"])
        self.assertEqual(data["method"], "POST")
        self.assertTrue(data["upload_url"].endswith("/api/uploads/object"))
        self.assertEqual(data["fields"], {"key": data["object_key"]})

    def test_presigned_upload_key_is_not_client_controllable(self):
        """A client-chosen key is the whole IDOR; the key is derived server-side."""
        resp = self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/jpeg", "file_size": 2048, "object_key": "products/x/deadbeef"},
            headers=self.auth_headers,
        )
        # extra="forbid" on the body, so an attempt to name the key is refused
        # outright rather than quietly ignored.
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error"]["code"], "VALIDATION_ERROR")

    def test_s3_presigned_upload_disallowed_mime(self):
        resp = self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/svg+xml", "file_size": 2048},
            headers=self.auth_headers,
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error"]["code"], "INVALID_MIME_TYPE")

    def test_s3_presigned_upload_file_too_large(self):
        resp = self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/png", "file_size": 10 * 1024 * 1024},  # 10 MB > 5 MB
            headers=self.auth_headers,
        )
        self.assertEqual(resp.status_code, 400)

    # ------------------------------------------------------------------------
    # 4. Security Headers & X-Request-ID Tests
    # ------------------------------------------------------------------------
    def test_security_headers_present(self):
        req_id = str(uuid.uuid4())
        resp = self.client.get("/health", headers={"X-Request-ID": req_id})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("X-Request-ID"), req_id)
        self.assertEqual(resp.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(resp.headers.get("X-Frame-Options"), "DENY")
        self.assertIn("Content-Security-Policy", resp.headers)


if __name__ == "__main__":
    unittest.main()
