"""
The payment flow, end to end, with a gateway that answers like Razorpay does.

Test-mode keys are not in the repository, and the design says they will not be
until deployment. That is a problem for testing, because "the flow works" is a
claim about talking to somebody else's API. So the gateway is a class with four
methods, the test substitutes one, and everything above it -- signature
verification, the webhook's state machine, refunds, stock restoration -- is the
code that actually ships.

Organised by what would cost money, not by endpoint:

    the amount charged is the amount ordered
    only the gateway can say money moved
    nobody can mark somebody else's order paid
    stock goes out once and comes back once
    a refund cannot exceed what is left

    python -m unittest tests.test_payment_flows -v
"""
import hashlib
import hmac
import json
import os
import unittest
import uuid
from decimal import Decimal

import asyncpg
import httpx
from jose import jwt

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()

skip_without_db = unittest.skipUnless(
    TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping payment flow tests"
)

ADDRESS = {
    "full_name": "Asha Verma",
    "email": "asha@example.com",
    "phone": "9876543210",
    "line1": "12 Gopalbari",
    "city": "Jaipur",
    "state": "Rajasthan",
    "pincode": "302001",
    "country": "India",
}


def auth_header(user_id: str, role: str = "customer", email: str = "t@example.com") -> dict:
    from app.config import settings

    token = jwt.encode(
        {"id": str(user_id), "email": email, "role": role, "name": "T", "exp": 9999999999},
        settings.JWT_ACCESS_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


class FakeGateway:
    """
    A Razorpay that never leaves the process.

    Records what it was asked for, so a test can assert on the request as well as
    on our reaction to the answer -- the amount conversion in particular, which is
    the one place a float could quietly become a paisa out.
    """

    # Set False to model a deployment with no keys.
    configured = True
    # What fetch_payment reports. Tests set this to model a declined or a
    # not-yet-captured payment.
    remote_status = "captured"
    # Raise on the next call of the named method, to model a network problem.
    fail_with: Exception | None = None

    def __init__(self):
        self.calls = []
        self.refunds = []
        self.orders = []
        self._counter = 0

    # -- RazorpayClient surface -------------------------------------------

    @property
    def is_configured(self) -> bool:
        return self.configured

    def public_key_id(self) -> str:
        return "rzp_test_fakekeyid"

    @staticmethod
    def to_paise(rupees) -> int:
        from app.payments.razorpay import RazorpayClient

        return RazorpayClient.to_paise(rupees)

    @staticmethod
    def to_rupees(paise) -> float:
        from app.payments.razorpay import RazorpayClient

        return RazorpayClient.to_rupees(paise)

    async def create_order(self, *, amount, currency="INR", receipt, notes=None):
        self._check("create_order")
        self._counter += 1
        data = {
            "id": f"order_FAKE{self._counter:04d}",
            "amount": self.to_paise(amount),
            "currency": currency,
            "receipt": receipt,
            "status": "created",
            "notes": notes or {},
        }
        self.orders.append(data)
        return data

    async def fetch_payment(self, payment_id):
        self._check("fetch_payment")
        self.calls.append(("fetch_payment", payment_id))
        return {
            "id": payment_id,
            "status": self.remote_status,
            "amount": 24950,
            "currency": "INR",
            "captured": self.remote_status == "captured",
        }

    async def create_refund(self, *, payment_id, amount, notes=None):
        self._check("create_refund")
        self._counter += 1
        data = {
            "id": f"rfnd_FAKE{self._counter:04d}",
            "payment_id": payment_id,
            "amount": self.to_paise(amount),
            "status": "processed",
        }
        self.refunds.append(data)
        return data

    def verify_payment_signature(self, order_id, payment_id, signature) -> bool:
        from app.payments.razorpay import RazorpayClient

        return RazorpayClient(
            "rzp_test_fakekeyid", self._secret(), "rzp_test_fakewebhook"
        ).verify_payment_signature(order_id, payment_id, signature)

    def verify_webhook_signature(self, raw_body, signature) -> bool:
        from app.payments.razorpay import RazorpayClient

        return RazorpayClient(
            "rzp_test_fakekeyid", self._secret(), "rzp_test_fakewebhook"
        ).verify_webhook_signature(raw_body, signature)

    @staticmethod
    def _secret() -> str:
        return "fake_key_secret"

    def sign(self, order_id, payment_id) -> str:
        return hmac.new(
            b"fake_key_secret",
            f"{order_id}|{payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()

    def webhook_sig(self, raw_body: bytes) -> str:
        return hmac.new(b"rzp_test_fakewebhook", raw_body, hashlib.sha256).hexdigest()

    def _check(self, name):
        self.calls.append((name,))
        if self.fail_with is not None:
            exc, self.fail_with = self.fail_with, None
            raise exc


@skip_without_db
class _PayBase(unittest.IsolatedAsyncioTestCase):
    maxDiff = None

    async def asyncSetUp(self):
        self.pool = await asyncpg.create_pool(dsn=TEST_DATABASE_URL, min_size=1, max_size=6)
        from app.db import set_pool

        set_pool(self.pool)
        # payment_events is named explicitly because nothing points at it: it is
        # an append-only log of what Razorpay sent, with no FK to any table, so
        # the CASCADE from users/categories cannot reach it. Left in, a fixed
        # event_id from a previous run arrives as a "redelivery" and a test that
        # meant to prove a first delivery is processed fails on its second run.
        await self.pool.execute(
            "TRUNCATE users, categories, payment_events RESTART IDENTITY CASCADE"
        )

        from app.main import app

        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        )

        # The substitution. Both routers imported the name directly, so both the
        # module attribute has to be rebound -- which is exactly why the gateway
        # is an object and not a set of module-level functions.
        from app.routers import orders as orders_router
        from app.routers import payments as payments_router

        self.gateway = FakeGateway()
        self._saved = (payments_router.gateway, orders_router.gateway)
        payments_router.gateway = self.gateway
        orders_router.gateway = self.gateway

        self.category_id = await self.pool.fetchval(
            "INSERT INTO categories (name, slug) VALUES ('Apparel','apparel') RETURNING id"
        )
        self.seller_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ('Seller','seller@example.com','x','seller') RETURNING id"
        )
        await self.pool.execute(
            "INSERT INTO seller_profiles (user_id, store_name) VALUES ($1,'Pay Store')",
            self.seller_id,
        )
        self.customer_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ('Buyer','buyer@example.com','x','customer') RETURNING id"
        )
        self.other_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ('Other','other@example.com','x','customer') RETURNING id"
        )
        self.admin_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ('Admin','admin@example.com','x','admin') RETURNING id"
        )
        self.customer_headers = auth_header(self.customer_id)
        self.other_headers = auth_header(self.other_id, email="other@example.com")
        self.admin_headers = auth_header(self.admin_id, "admin", "admin@example.com")

        o = uuid.uuid4().bytes
        self.ip = f"198.51.100.{o[0]}.{o[1]}"

    async def asyncTearDown(self):
        from app.db import set_pool
        from app.routers import orders as orders_router
        from app.routers import payments as payments_router

        payments_router.gateway, orders_router.gateway = self._saved
        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    # -- fixtures ---------------------------------------------------------

    async def make_product(self, price=100.0, stock=10, title="Kurta") -> str:
        """
        Returns the id as a string, not as asyncpg's UUID.

        Which is only a nuisance because these ids go straight into request
        bodies, and a UUID is not JSON-serialisable -- a test that puts one in a
        payload fails in httpx's header encoder, four frames away from the line
        that did it.
        """
        n = uuid.uuid4().hex[:8]
        return str(await self.pool.fetchval(
            """INSERT INTO products
                 (seller_id, category_id, title, slug, description, price, stock_qty, status)
               VALUES ($1,$2,$3,$4,'d',$5,$6,'active') RETURNING id""",
            self.seller_id, self.category_id, f"{title} {n}", f"pf-{n}", price, stock,
        ))

    async def place_order(self, product_id=None, quantity=2, headers=None):
        product_id = product_id or await self.make_product()
        r = await self.client.request(
            "POST", "/api/orders",
            json={"shipping_address": ADDRESS, "items": [{"product_id": product_id, "quantity": quantity}]},
            headers={**(headers or self.customer_headers), "X-Forwarded-For": self.ip},
        )
        self.assertEqual(r.status_code, 201, r.text)
        return self.order_id_of(r), product_id

    @staticmethod
    def order_id_of(response) -> str:
        """POST /api/orders nests the new order under data.order_id."""
        return response.json()["data"]["order_id"]

    async def open_payment(self, order_id, headers=None):
        r = await self.client.request(
            "POST", "/api/payments/create",
            json={"order_id": order_id},
            headers={**(headers or self.customer_headers), "X-Forwarded-For": self.ip},
        )
        return r

    async def post_webhook(self, event_type, gateway_order_id, payment_id="pay_FAKE0001",
                           event_id=None, extra=None, sign_with=None):
        body = {
            "event_id": event_id or f"evt_{uuid.uuid4().hex[:12]}",
            "event": event_type,
            "payload": {"payment": {"entity": {
                "id": payment_id, "order_id": gateway_order_id, "status": "captured",
                **(extra or {}),
            }}},
        }
        raw = json.dumps(body).encode("utf-8")
        return await self.client.post(
            "/api/payments/webhook",
            content=raw,
            headers={
                "X-Razorpay-Signature": hmac.new(
                    sign_with or b"rzp_test_fakewebhook", raw, hashlib.sha256
                ).hexdigest(),
                "Content-Type": "application/json",
            },
        )

    async def stock(self, product_id) -> int:
        return await self.pool.fetchval("SELECT stock_qty FROM products WHERE id=$1", product_id)

    async def order_status(self, order_id) -> str:
        return await self.pool.fetchval("SELECT status FROM orders WHERE id=$1", order_id)

    async def payment_status(self, order_id):
        return await self.pool.fetchval(
            "SELECT status FROM payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1", order_id
        )


# ── the amount ───────────────────────────────────────────────────────────────

class AmountTests(_PayBase):
    def test_paise_conversion_is_exact(self):
        """
        The one place a float would become money.

        249.50 as a float is 249.49999999999997..., so a naive *100 gives
        24949. That is a customer charged one paisa less than the order, which
        sounds harmless until it happens on every order in a month.
        """
        from app.payments.razorpay import RazorpayClient

        self.assertEqual(RazorpayClient.to_paise(249.50), 24950)
        self.assertEqual(RazorpayClient.to_paise(249.5), 24950)
        self.assertEqual(RazorpayClient.to_paise(0.1), 10)
        self.assertEqual(RazorpayClient.to_paise(0.07), 7)
        self.assertEqual(RazorpayClient.to_paise(1000), 100000)
        self.assertEqual(RazorpayClient.to_paise("1234.56"), 123456)
        self.assertEqual(RazorpayClient.to_paise(Decimal("999.99")), 99999)

    def test_a_sub_paise_amount_is_refused_rather_than_rounded(self):
        """
        Rounding would charge a different amount than the order says, and the
        difference would be invisible. An error the caller has to see is the only
        honest option.
        """
        from app.payments.razorpay import GatewayError, RazorpayClient

        with self.assertRaises(GatewayError):
            RazorpayClient.to_paise(10.005)

    def test_paise_converts_back_to_the_same_rupees(self):
        from app.payments.razorpay import RazorpayClient

        for rupees in (0, 1, 249.5, 249.99, 1000, 12345.67):
            self.assertEqual(
                RazorpayClient.to_rupees(RazorpayClient.to_paise(rupees)), rupees
            )


# ── opening checkout ─────────────────────────────────────────────────────────

class CreatePaymentTests(_PayBase):
    async def test_the_gateway_order_id_is_stored_where_the_webhook_looks(self):
        """
        This is the join between the two halves of the flow.

        The webhook arrives carrying the gateway's order id and nothing else we
        can use. Nothing wrote that id anywhere, so the webhook could not match an
        order, so a real payment never marked a real order paid -- and the code
        looked complete.
        """
        order_id, _ = await self.place_order()
        r = await self.open_payment(order_id)
        self.assertEqual(r.status_code, 200, r.text)
        gateway_id = r.json()["data"]["razorpay_order_id"]

        self.assertEqual(
            await self.pool.fetchval("SELECT razorpay_order_id FROM orders WHERE id=$1", order_id),
            gateway_id,
        )
        self.assertEqual(
            await self.pool.fetchval("SELECT provider_ref FROM payments WHERE order_id=$1", order_id),
            gateway_id,
        )

    async def test_checkout_receives_the_key_id_and_never_the_secret(self):
        order_id, _ = await self.place_order()
        data = (await self.open_payment(order_id)).json()["data"]
        self.assertEqual(data["key_id"], "rzp_test_fakekeyid")
        self.assertNotIn("key_secret", json.dumps(data))
        self.assertNotIn("fake_key_secret", json.dumps(data))
        # checkout.js needs the total in rupees, and the currency, and it needs
        # the receipt echoed back so a support agent can match a screenshot.
        self.assertEqual(data["currency"], "INR")
        self.assertEqual(data["receipt"], order_id)
        self.assertEqual(data["amount"], 200.0)

    async def test_prefill_comes_from_the_address_the_customer_already_typed(self):
        """
        Every field checkout.js pre-fills is a field the customer cannot mistype,
        and a mistyped email on a payment form is a support ticket.
        """
        order_id, _ = await self.place_order()
        data = (await self.open_payment(order_id)).json()["data"]
        self.assertEqual(data["prefill"]["name"], "Asha Verma")
        self.assertEqual(data["prefill"]["email"], "asha@example.com")

    async def test_the_amount_sent_to_the_gateway_is_the_order_total(self):
        order_id, _ = await self.place_order(quantity=3)
        await self.pool.execute("UPDATE orders SET total_amount = 249.50 WHERE id=$1", order_id)
        await self.open_payment(order_id)
        self.assertEqual(self.gateway.orders[-1]["amount"], 24950)

    async def test_opening_checkout_twice_reuses_the_gateway_order(self):
        """
        A second gateway order would leave the first payable, so a customer who
        dismissed the modal and came back could pay either -- and the webhook
        would mark the order paid against one payment while the other settles
        into the gateway's account as an unclaimed payment.
        """
        order_id, _ = await self.place_order()
        first = (await self.open_payment(order_id)).json()["data"]
        second = (await self.open_payment(order_id)).json()["data"]

        self.assertEqual(first["razorpay_order_id"], second["razorpay_order_id"])
        self.assertFalse(first["reused_gateway_order"])
        self.assertTrue(second["reused_gateway_order"])
        self.assertEqual(len(self.gateway.orders), 1, "the gateway was called twice")

    async def test_someone_elses_order_cannot_be_paid(self):
        order_id, _ = await self.place_order()
        r = await self.open_payment(order_id, headers=self.other_headers)
        # 404, not 403: a 403 would confirm the order exists.
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(self.gateway.orders, [])

    async def test_a_paid_order_cannot_be_paid_again(self):
        order_id, _ = await self.place_order()
        await self.open_payment(order_id)
        await self.post_webhook("payment.captured", self.gateway.orders[-1]["id"])

        r = await self.open_payment(order_id)
        self.assertEqual(r.status_code, 409, r.text)
        self.assertEqual(r.json()["error"]["code"], "ORDER_NOT_PAYABLE")

    async def test_an_expired_order_cannot_be_paid(self):
        order_id, _ = await self.place_order()
        await self.pool.execute(
            "UPDATE orders SET expires_at = NOW() - INTERVAL '1 minute' WHERE id=$1", order_id
        )
        r = await self.open_payment(order_id)
        self.assertEqual(r.status_code, 409, r.text)

    async def test_without_keys_the_order_is_saved_and_the_answer_says_so(self):
        """
        Not a 500, and not a success that charges nobody.

        The order exists and its stock is held. An operator seeing this needs to
        know the missing thing is two environment variables, so the message names
        them.
        """
        order_id, _ = await self.place_order()
        self.gateway.configured = False
        try:
            r = await self.open_payment(order_id)
        finally:
            self.gateway.configured = True

        self.assertEqual(r.status_code, 503, r.text)
        self.assertEqual(r.json()["error"]["code"], "GATEWAY_NOT_CONFIGURED")
        self.assertIn("RAZORPAY_KEY_ID", r.json()["error"]["message"])
        # The order is untouched: still pending, still holding its stock, so the
        # keys can be added and the customer can still pay.
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_a_gateway_outage_does_not_take_the_order_with_it(self):
        from app.payments.razorpay import GatewayError

        order_id, _ = await self.place_order()
        self.gateway.fail_with = GatewayError("Razorpay returned 500", status_code=500)
        r = await self.open_payment(order_id)

        self.assertEqual(r.status_code, 502, r.text)
        self.assertEqual(await self.order_status(order_id), "pending")
        self.assertIsNone(
            await self.pool.fetchval("SELECT razorpay_order_id FROM orders WHERE id=$1", order_id)
        )

    async def test_a_gateway_reply_with_no_id_is_not_trusted(self):
        order_id, _ = await self.place_order()
        original = self.gateway.create_order

        async def empty(**_):
            return {"status": "created"}

        self.gateway.create_order = empty
        try:
            r = await self.open_payment(order_id)
        finally:
            self.gateway.create_order = original
        self.assertEqual(r.status_code, 502, r.text)


# ── confirming ───────────────────────────────────────────────────────────────

class ConfirmPaymentTests(_PayBase):
    async def pay(self, order_id, payment_id="pay_FAKE0001", headers=None, gateway_id=None):
        gateway_id = gateway_id or self.gateway.orders[-1]["id"]
        return await self.client.request(
            "POST", f"/api/orders/{order_id}/confirm-payment",
            json={
                "razorpay_payment_id": payment_id,
                "razorpay_order_id": gateway_id,
                "razorpay_signature": self.gateway.sign(gateway_id, payment_id),
            },
            headers=headers or self.customer_headers,
        )

    async def opened(self):
        order_id, product_id = await self.place_order(quantity=2)
        await self.open_payment(order_id)
        return order_id, product_id

    async def test_a_verified_capture_marks_the_order_paid(self):
        order_id, _ = await self.opened()
        r = await self.pay(order_id)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.order_status(order_id), "paid")
        self.assertEqual(await self.payment_status(order_id), "success")
        self.assertEqual(
            await self.pool.fetchval("SELECT razorpay_payment_id FROM orders WHERE id=$1", order_id),
            "pay_FAKE0001",
        )

    async def test_paying_notifies_and_records_the_purchase_once(self):
        """
        Both of these run from a guarded UPDATE, so they cannot double-write when
        the webhook and the browser callback race -- which they do, constantly,
        and which is the normal case rather than the edge case.
        """
        order_id, _ = await self.opened()
        await self.pay(order_id)
        await self.post_webhook("payment.captured", self.gateway.orders[-1]["id"], "pay_FAKE0001")
        await self.post_webhook("payment.captured", self.gateway.orders[-1]["id"], "pay_FAKE0001")

        self.assertEqual(
            await self.pool.fetchval(
                "SELECT COUNT(*) FROM order_status_history WHERE order_id=$1 AND status='paid'",
                order_id,
            ),
            1,
            "the paid history row was written more than once",
        )
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND type='order_confirmed'",
                self.customer_id,
            ),
            1,
            "the customer was told about the order more than once",
        )
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT COUNT(*) FROM user_interactions WHERE user_id=$1 AND event_type='purchase'",
                self.customer_id,
            ),
            1,
        )

    async def test_an_empty_body_is_not_a_receipt(self):
        """
        razorpay_payment_id defaulted to a made-up value, so POSTing nothing was a
        valid payment confirmation for any order id.
        """
        order_id, _ = await self.opened()
        r = await self.client.post(
            f"/api/orders/{order_id}/confirm-payment", json={}, headers=self.customer_headers
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["error"]["code"], "PAYMENT_DETAILS_INCOMPLETE")
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_nobody_can_pay_someone_elses_order(self):
        """
        The UPDATE had no user_id filter. Any logged-in user could mark any order
        on the platform paid and queue a confirmation to its owner -- and the
        seller's fulfilment queue is the thing being fed.
        """
        order_id, _ = await self.opened()
        r = await self.pay(order_id, headers=self.other_headers)
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_a_signature_for_a_different_order_is_refused(self):
        """
        A valid signature proves the browser's claim came from a real checkout of
        this account. It does not prove the claim was about *this* order -- so
        without this check a customer who paid for a ₹10 order could present that
        signature to confirm a ₹10,000 one.
        """
        order_id, _ = await self.opened()
        cheap_id, _ = await self.place_order()
        await self.open_payment(cheap_id)
        cheap_gateway_id = self.gateway.orders[-1]["id"]

        r = await self.pay(order_id, gateway_id=cheap_gateway_id)
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["error"]["code"], "PAYMENT_ORDER_MISMATCH")
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_a_forged_signature_is_refused(self):
        order_id, _ = await self.opened()
        gateway_id = self.gateway.orders[-1]["id"]
        r = await self.client.request(
            "POST", f"/api/orders/{order_id}/confirm-payment",
            json={
                "razorpay_payment_id": "pay_FAKE0001",
                "razorpay_order_id": gateway_id,
                "razorpay_signature": "0" * 64,
            },
            headers=self.customer_headers,
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["error"]["code"], "INVALID_SIGNATURE")
        self.assertEqual(await self.order_status(order_id), "pending")
        # And it never asked the gateway, because there was nothing to ask about.
        self.assertNotIn(("fetch_payment", "pay_FAKE0001"), self.gateway.calls)

    async def test_a_payment_the_gateway_did_not_capture_is_not_a_payment(self):
        """A signature is not a capture. The gateway is the authority."""
        order_id, _ = await self.opened()
        self.gateway.remote_status = "authorized"
        r = await self.pay(order_id)
        self.assertEqual(r.status_code, 402, r.text)
        self.assertEqual(r.json()["error"]["code"], "PAYMENT_NOT_CAPTURED")
        self.assertEqual(await self.order_status(order_id), "pending")
        self.assertEqual(await self.payment_status(order_id), "failed")

    async def test_a_gateway_timeout_leaves_the_order_pending_for_the_webhook(self):
        """
        A network problem is not a declined payment. Cancelling the order here
        would release stock the customer may be about to buy, and marking it paid
        would deliver an order nobody paid for.
        """
        from app.payments.razorpay import GatewayError

        order_id, _ = await self.opened()
        self.gateway.fail_with = GatewayError("could not reach Razorpay: timeout")
        r = await self.pay(order_id)

        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["status"], "pending_verification")
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_a_second_confirmation_is_the_orders_real_state(self):
        order_id, _ = await self.opened()
        await self.pay(order_id)
        r = await self.pay(order_id)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["status"], "paid")

    async def test_without_keys_confirmation_says_so_instead_of_pretending(self):
        order_id, _ = await self.opened()
        self.gateway.configured = False
        try:
            r = await self.pay(order_id)
        finally:
            self.gateway.configured = True
        self.assertEqual(r.status_code, 503, r.text)
        self.assertEqual(r.json()["error"]["code"], "GATEWAY_NOT_CONFIGURED")


# ── polling ──────────────────────────────────────────────────────────────────

class PaymentStatusTests(_PayBase):
    async def test_a_fresh_order_reports_created(self):
        order_id, _ = await self.place_order()
        r = await self.client.get(f"/api/payments/status/{order_id}", headers=self.customer_headers)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["effective_status"], "created")
        self.assertTrue(data["can_retry"])

    async def test_a_signature_back_but_no_capture_reads_as_pending_verification(self):
        """
        The state the frontend actually polls through, and the one that has to
        exist. 'pending' would suggest nothing is happening; 'success' would be a
        lie that a dropped webhook turns into a delivered order nobody paid for.
        """
        order_id, _ = await self.place_order()
        await self.open_payment(order_id)
        await self.pool.execute("UPDATE orders SET razorpay_payment_id = 'pay_X' WHERE id=$1", order_id)

        data = (await self.client.get(f"/api/payments/status/{order_id}", headers=self.customer_headers)).json()["data"]
        self.assertEqual(data["effective_status"], "pending_verification")
        self.assertTrue(data["can_retry"])

    async def test_success_and_cancelled_and_failed_are_distinguishable(self):
        order_id, _ = await self.place_order()
        await self.open_payment(order_id)
        await self.post_webhook("payment.captured", self.gateway.orders[-1]["id"])
        self.assertEqual(
            (await self.client.get(f"/api/payments/status/{order_id}", headers=self.customer_headers)).json()["data"]["effective_status"],
            "success",
        )

        failed_id, _ = await self.place_order()
        await self.open_payment(failed_id)
        await self.post_webhook("payment.failed", self.gateway.orders[-1]["id"])
        data = (await self.client.get(f"/api/payments/status/{failed_id}", headers=self.customer_headers)).json()["data"]
        self.assertEqual(data["effective_status"], "failed")
        self.assertTrue(data["can_retry"], "a declined card should be payable again")

    async def test_an_expired_order_is_not_offered_a_retry(self):
        """
        The sweep has already released the stock, so a "try again" button cannot
        succeed -- it would take payment for something that is no longer held.
        """
        order_id, _ = await self.place_order()
        await self.open_payment(order_id)
        await self.pool.execute(
            "UPDATE orders SET expires_at = NOW() - INTERVAL '1 second' WHERE id=$1", order_id
        )
        data = (await self.client.get(f"/api/payments/status/{order_id}", headers=self.customer_headers)).json()["data"]
        self.assertTrue(data["expired"])
        self.assertFalse(data["can_retry"])

    async def test_poll_status_is_not_readable_by_a_stranger(self):
        order_id, _ = await self.place_order()
        r = await self.client.get(f"/api/payments/status/{order_id}", headers=self.other_headers)
        self.assertEqual(r.status_code, 404, r.text)

    async def test_a_malformed_id_is_a_400_not_a_500(self):
        r = await self.client.get("/api/payments/status/not-a-uuid", headers=self.customer_headers)
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["error"]["code"], "VALIDATION_ERROR")


# ── the webhook ──────────────────────────────────────────────────────────────

class WebhookTests(_PayBase):
    async def opened(self):
        order_id, product_id = await self.place_order(quantity=2)
        await self.open_payment(order_id)
        return order_id, self.gateway.orders[-1]["id"]

    async def test_a_capture_marks_the_order_paid(self):
        order_id, gateway_id = await self.opened()
        r = await self.post_webhook("payment.captured", gateway_id, "pay_FAKE0001")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["status"], "processed")
        self.assertEqual(await self.order_status(order_id), "paid")

    async def test_an_unsigned_webhook_is_refused(self):
        order_id, gateway_id = await self.opened()
        body = json.dumps({
            "event_id": "evt_x", "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_FAKE0001", "order_id": gateway_id}}},
        }).encode()
        r = await self.client.post(
            "/api/payments/webhook", content=body,
            headers={"X-Razorpay-Signature": "deadbeef", "Content-Type": "application/json"},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_a_webhook_signed_with_the_key_secret_is_refused(self):
        """
        If RAZORPAY_WEBHOOK_SECRET is set, a signature made with the API key
        secret must not be accepted -- otherwise the API secret becomes a webhook
        credential too, and anything that leaks it can mark orders paid.
        """
        order_id, gateway_id = await self.opened()
        r = await self.post_webhook(
            "payment.captured", gateway_id, sign_with=b"fake_key_secret"
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_a_redelivery_is_ignored_rather_than_reapplied(self):
        order_id, gateway_id = await self.opened()
        body = {
            "event_id": "evt_stable_1", "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_FAKE0001", "order_id": gateway_id}}},
        }
        raw = json.dumps(body).encode()
        sig = self.gateway.webhook_sig(raw)
        first = await self.client.post(
            "/api/payments/webhook", content=raw,
            headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"},
        )
        second = await self.client.post(
            "/api/payments/webhook", content=raw,
            headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"},
        )
        self.assertEqual(first.json()["status"], "processed")
        self.assertEqual(second.json()["status"], "duplicate_ignored")
        self.assertEqual(await self.order_status(order_id), "paid")

    async def test_the_same_event_id_with_a_different_body_is_refused(self):
        """
        A duplicate id with a different payload is not a retry, and honouring it
        would let anyone who can reach the endpoint rewrite what a past event
        said. 422, so it is visible in Razorpay's dashboard as a failure.
        """
        order_id, gateway_id = await self.opened()
        base = {
            "event_id": "evt_tamper_1", "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_FAKE0001", "order_id": gateway_id}}},
        }
        raw1 = json.dumps(base).encode()
        await self.client.post(
            "/api/payments/webhook", content=raw1,
            headers={"X-Razorpay-Signature": self.gateway.webhook_sig(raw1), "Content-Type": "application/json"},
        )
        changed = dict(base, payload={"payment": {"entity": {"id": "pay_OTHER", "order_id": gateway_id}}})
        raw2 = json.dumps(changed).encode()
        r = await self.client.post(
            "/api/payments/webhook", content=raw2,
            headers={"X-Razorpay-Signature": self.gateway.webhook_sig(raw2), "Content-Type": "application/json"},
        )
        self.assertEqual(r.status_code, 422, r.text)
        self.assertEqual(r.json()["error"]["code"], "PAYLOAD_MISMATCH")

    async def test_a_capture_for_an_unknown_order_is_acknowledged_not_retried(self):
        """
        A 4xx here would make Razorpay redeliver an event we can never apply,
        forever. Acknowledged and logged instead.
        """
        r = await self.post_webhook("payment.captured", "order_DOES_NOT_EXIST")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["status"], "unmatched")

    async def test_a_capture_for_a_cancelled_order_does_not_reopen_it(self):
        """
        The customer cancelled, then the money arrived. Marking the order paid
        here would put goods nobody has in a fulfilment queue, so the event is
        logged for a person to refund -- the right place for that decision.
        """
        order_id, gateway_id = await self.opened()
        await self.client.request(
            "PUT", f"/api/orders/{order_id}/cancel", json={"reason": "changed my mind"},
            headers=self.customer_headers,
        )
        r = await self.post_webhook("payment.captured", gateway_id, "pay_LATE")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.order_status(order_id), "cancelled")

    async def test_a_failed_payment_leaves_the_order_payable(self):
        """
        A bank declining is not a cancellation. Treating it as one released stock
        the customer was about to buy.
        """
        order_id, gateway_id = await self.opened()
        r = await self.post_webhook("payment.failed", gateway_id, "pay_DECLINED")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.order_status(order_id), "pending")
        self.assertEqual(await self.payment_status(order_id), "failed")
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT COUNT(*) FROM order_status_history WHERE order_id=$1 AND note LIKE '%failed%'",
                order_id,
            ),
            1,
            "the customer should be able to see that an attempt failed",
        )

    async def test_an_unknown_event_type_is_recorded_and_ignored(self):
        order_id, gateway_id = await self.opened()
        r = await self.post_webhook("payment.authorized", gateway_id)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_malformed_json_is_a_400(self):
        raw = b"{not json"
        r = await self.client.post(
            "/api/payments/webhook", content=raw,
            headers={
                "X-Razorpay-Signature": self.gateway.webhook_sig(raw),
                "Content-Type": "application/json",
            },
        )
        self.assertEqual(r.status_code, 400, r.text)


# ── cancelling ───────────────────────────────────────────────────────────────

class CancelTests(_PayBase):
    async def test_cancelling_an_unpaid_order_returns_the_stock(self):
        order_id, product_id = await self.place_order(quantity=2)
        self.assertEqual(await self.stock(product_id), 8)

        r = await self.client.request(
            "PUT", f"/api/orders/{order_id}/cancel", json={"reason": "found it cheaper"},
            headers=self.customer_headers,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.stock(product_id), 10)
        self.assertEqual(await self.order_status(order_id), "cancelled")
        self.assertEqual(await self.payment_status(order_id), "cancelled")

    async def test_the_cancellation_is_a_history_row_with_the_reason_in_it(self):
        """
        Cancellations deliberately have no table of their own -- orders.status
        already carries 'cancelled' and order_status_history records who changed
        what. One audit trail instead of two that can disagree.
        """
        order_id, _ = await self.place_order()
        await self.client.request(
            "PUT", f"/api/orders/{order_id}/cancel",
            json={"reason": "address was wrong"}, headers=self.customer_headers,
        )
        row = await self.pool.fetchrow(
            "SELECT status, note, changed_by FROM order_status_history "
            "WHERE order_id=$1 ORDER BY changed_at DESC LIMIT 1",
            order_id,
        )
        self.assertEqual(row["status"], "cancelled")
        self.assertEqual(row["note"], "address was wrong")
        self.assertEqual(str(row["changed_by"]), str(self.customer_id))

    async def test_cancelling_twice_does_not_return_the_stock_twice(self):
        order_id, product_id = await self.place_order(quantity=2)
        for _ in range(2):
            r = await self.client.request(
                "PUT", f"/api/orders/{order_id}/cancel", json={}, headers=self.customer_headers
            )
            self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.stock(product_id), 10, "stock came back twice")

    async def test_a_shipped_order_cannot_be_cancelled_from_the_customer_account(self):
        order_id, _ = await self.place_order()
        await self.pool.execute("UPDATE orders SET status = 'shipped' WHERE id=$1", order_id)
        r = await self.client.request(
            "PUT", f"/api/orders/{order_id}/cancel", json={}, headers=self.customer_headers
        )
        self.assertEqual(r.status_code, 409, r.text)
        self.assertEqual(r.json()["error"]["code"], "ORDER_NOT_CANCELLABLE")
        self.assertIn("refund", r.json()["error"]["message"].lower())

    async def test_a_paid_cancellation_marks_the_money_for_refund_and_does_not_move_it(self):
        """
        Money cannot leave by two routes at once. The order is cancelled, the
        stock is back, the payment is flagged -- and an actual refund goes through
        POST /api/payments/refunds, which checks the amount against what is left.
        """
        order_id, product_id = await self.place_order(quantity=2)
        await self.open_payment(order_id)
        await self.post_webhook("payment.captured", self.gateway.orders[-1]["id"], "pay_FAKE0001")

        r = await self.client.request(
            "PUT", f"/api/orders/{order_id}/cancel",
            json={"reason": "bought the wrong size"}, headers=self.customer_headers,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["data"]["refund_pending"])
        self.assertEqual(await self.stock(product_id), 10)
        # Flagged, not refunded. The gateway was not called.
        self.assertEqual(await self.payment_status(order_id), "pending_verification")
        self.assertEqual(self.gateway.refunds, [])

    async def test_cancelling_someone_elses_order_is_a_404(self):
        order_id, _ = await self.place_order()
        r = await self.client.request(
            "PUT", f"/api/orders/{order_id}/cancel", json={}, headers=self.other_headers
        )
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_an_optioned_line_returns_stock_to_the_option_not_the_product(self):
        product_id = await self.make_product(price=1800, stock=0)
        variant_id = str(await self.pool.fetchval(
            "INSERT INTO product_variants (product_id, price, stock_qty, attributes, is_default) "
            "VALUES ($1, 1800, 6, '{\"size\":\"L\"}'::jsonb, TRUE) RETURNING id",
            product_id,
        ))
        r = await self.client.request(
            "POST", "/api/orders",
            json={"shipping_address": ADDRESS, "items": [
                {"product_id": product_id, "quantity": 2, "variant_id": variant_id}
            ]},
            headers={**self.customer_headers, "X-Forwarded-For": self.ip},
        )
        order_id = self.order_id_of(r)
        self.assertEqual(
            await self.pool.fetchval("SELECT stock_qty FROM product_variants WHERE id=$1", variant_id), 4
        )

        await self.client.request(
            "PUT", f"/api/orders/{order_id}/cancel", json={}, headers=self.customer_headers
        )
        self.assertEqual(
            await self.pool.fetchval("SELECT stock_qty FROM product_variants WHERE id=$1", variant_id), 6
        )

    async def test_a_cancelled_product_comes_back_as_active(self):
        order_id, product_id = await self.place_order(quantity=10)
        await self.pool.execute(
            "UPDATE products SET status='out_of_stock' WHERE id=$1", product_id
        )
        await self.client.request(
            "PUT", f"/api/orders/{order_id}/cancel", json={}, headers=self.customer_headers
        )
        self.assertEqual(
            await self.pool.fetchval("SELECT status FROM products WHERE id=$1", product_id), "active"
        )


# ── refunds ──────────────────────────────────────────────────────────────────

class RefundTests(_PayBase):
    async def paid_order(self, amount=200.0):
        order_id, product_id = await self.place_order(quantity=2)
        await self.pool.execute("UPDATE orders SET total_amount = $2 WHERE id=$1", order_id, amount)
        await self.open_payment(order_id)
        await self.post_webhook("payment.captured", self.gateway.orders[-1]["id"], "pay_FAKE0001")
        return order_id, product_id

    async def refund(self, body, headers=None):
        return await self.client.request(
            "POST", "/api/payments/refunds", json=body,
            headers=headers or self.admin_headers,
        )

    async def test_a_refund_reaches_the_gateway_and_is_recorded(self):
        order_id, _ = await self.paid_order()
        r = await self.refund({"order_id": order_id, "amount": 100, "reason": "damaged_in_transit"})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(self.gateway.refunds[-1]["payment_id"], "pay_FAKE0001")
        self.assertEqual(self.gateway.refunds[-1]["amount"], 10000)

        row = await self.pool.fetchrow(
            "SELECT status, amount, gateway_refund_id, requested_by FROM refunds WHERE order_id=$1", order_id
        )
        self.assertEqual(row["status"], "processed")
        self.assertEqual(float(row["amount"]), 100.0)
        self.assertEqual(str(row["requested_by"]), str(self.admin_id))
        # A partial refund says so on the payment, so the admin's money page is
        # not showing 'success' next to a refunded order.
        self.assertEqual(await self.payment_status(order_id), "partially_refunded")

    async def test_a_refund_cannot_exceed_what_is_left(self):
        """
        Checked against the remaining amount, not the order total: an order
        refunded twice must not be able to send the money back twice, and the
        order total does not know about the first refund.
        """
        order_id, _ = await self.paid_order()
        await self.refund({"order_id": order_id, "amount": 150})

        r = await self.refund({"order_id": order_id, "amount": 100})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["error"]["code"], "REFUND_EXCEEDS_REMAINING")
        self.assertEqual(r.json()["error"]["data"]["refundable"], 50.0)
        self.assertEqual(len(self.gateway.refunds), 1)

    async def test_a_full_refund_cancels_the_order_and_returns_the_stock(self):
        """
        The goods are coming back, so leaving the order 'paid' would have it
        sitting in the seller's fulfilment queue forever.
        """
        order_id, product_id = await self.paid_order()
        await self.refund({"order_id": order_id, "amount": 200})
        self.assertEqual(await self.order_status(order_id), "cancelled")
        self.assertEqual(await self.stock(product_id), 10)
        self.assertEqual(await self.payment_status(order_id), "refunded")

    async def test_an_order_with_no_successful_payment_has_nothing_to_refund(self):
        order_id, _ = await self.place_order()
        r = await self.refund({"order_id": order_id, "amount": 50})
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(r.json()["error"]["code"], "NO_REFUNDABLE_PAYMENT")
        self.assertEqual(self.gateway.refunds, [])

    async def test_only_an_admin_can_refund(self):
        order_id, _ = await self.paid_order()
        for headers in (self.customer_headers, self.other_headers):
            r = await self.refund({"order_id": order_id, "amount": 50}, headers=headers)
            self.assertIn(r.status_code, (401, 403), r.text)
        self.assertEqual(self.gateway.refunds, [])

    async def test_a_gateway_refusal_is_recorded_as_failed_not_lost(self):
        from app.payments.razorpay import GatewayError

        order_id, _ = await self.paid_order()
        self.gateway.fail_with = GatewayError("Razorpay returned 400", status_code=400)
        r = await self.refund({"order_id": order_id, "amount": 100})
        self.assertEqual(r.status_code, 502, r.text)
        self.assertEqual(
            await self.pool.fetchval("SELECT status FROM refunds WHERE order_id=$1", order_id), "failed"
        )

    async def test_without_keys_the_refund_is_preserved_as_a_request(self):
        """
        An admin asking for a refund on a deployment with no keys is a fact worth
        keeping, and the refund can be sent once the keys exist.
        """
        order_id, _ = await self.paid_order()
        self.gateway.configured = False
        try:
            r = await self.refund({"order_id": order_id, "amount": 100})
        finally:
            self.gateway.configured = True
        self.assertEqual(r.status_code, 201, r.text)
        self.assertFalse(r.json()["data"]["gateway_called"])
        self.assertEqual(
            await self.pool.fetchval("SELECT status FROM refunds WHERE order_id=$1", order_id), "requested"
        )
        self.assertEqual(self.gateway.refunds, [])

    async def test_the_refund_list_is_admin_only_and_readable(self):
        order_id, _ = await self.paid_order()
        await self.refund({"order_id": order_id, "amount": 100})

        self.assertEqual(
            (await self.client.get("/api/payments/refunds", headers=self.customer_headers)).status_code, 403
        )
        r = await self.client.get("/api/payments/refunds", headers=self.admin_headers)
        self.assertEqual(r.status_code, 200, r.text)
        rows = r.json()["data"]["refunds"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(str(rows[0]["order_id"]), order_id)
        self.assertEqual(rows[0]["amount"], 100.0)

    async def test_a_refund_webhook_updates_the_payment_status(self):
        order_id, _ = await self.paid_order()
        await self.refund({"order_id": order_id, "amount": 200})
        refund = await self.pool.fetchrow(
            "SELECT id, gateway_refund_id FROM refunds WHERE order_id=$1", order_id
        )
        self.assertEqual(refund["gateway_refund_id"], self.gateway.refunds[-1]["id"])
        self.assertEqual(await self.payment_status(order_id), "refunded")


# ── the sweep ────────────────────────────────────────────────────────────────

class SweepTests(_PayBase):
    async def expire(self, order_id, minutes=-5):
        await self.pool.execute(
            "UPDATE orders SET expires_at = NOW() + ($2 || ' minutes')::interval WHERE id=$1",
            order_id, str(minutes),
        )

    async def test_an_abandoned_order_expires_and_its_stock_comes_back(self):
        from app.jobs import sweep_abandoned_orders

        order_id, product_id = await self.place_order(quantity=2)
        await self.expire(order_id)
        self.assertEqual(await self.stock(product_id), 8)

        report = await sweep_abandoned_orders()
        self.assertEqual(report["expired"], 1)
        self.assertEqual(await self.stock(product_id), 10)
        self.assertEqual(await self.order_status(order_id), "cancelled")
        self.assertEqual(await self.payment_status(order_id), "cancelled")

    async def test_the_sweep_leaves_a_paid_order_alone(self):
        """
        The money arrived; the stock is genuinely the customer's. Restoring it
        would sell the same unit twice.
        """
        from app.jobs import sweep_abandoned_orders

        order_id, product_id = await self.place_order(quantity=2)
        await self.open_payment(order_id)
        await self.post_webhook("payment.captured", self.gateway.orders[-1]["id"], "pay_FAKE0001")
        await self.expire(order_id)

        report = await sweep_abandoned_orders()
        self.assertEqual(report["expired"], 0)
        self.assertEqual(await self.stock(product_id), 8)
        self.assertEqual(await self.order_status(order_id), "paid")

    async def test_the_sweep_leaves_a_live_order_alone(self):
        from app.jobs import sweep_abandoned_orders

        order_id, product_id = await self.place_order(quantity=2)
        report = await sweep_abandoned_orders()
        self.assertEqual(report["expired"], 0)
        self.assertEqual(await self.stock(product_id), 8)
        self.assertEqual(await self.order_status(order_id), "pending")

    async def test_expiry_is_recorded_as_a_cancellation_in_the_history(self):
        from app.jobs import sweep_abandoned_orders

        order_id, _ = await self.place_order()
        await self.expire(order_id)
        await sweep_abandoned_orders()
        note = await self.pool.fetchval(
            "SELECT note FROM order_status_history WHERE order_id=$1 AND status='cancelled'", order_id
        )
        self.assertIn("payment window", note)

    async def test_an_optioned_order_returns_its_option_stock(self):
        from app.jobs import sweep_abandoned_orders

        product_id = await self.make_product(price=1800, stock=0)
        variant_id = str(await self.pool.fetchval(
            "INSERT INTO product_variants (product_id, price, stock_qty, attributes, is_default) "
            "VALUES ($1, 1800, 6, '{\"size\":\"M\"}'::jsonb, TRUE) RETURNING id",
            product_id,
        ))
        r = await self.client.request(
            "POST", "/api/orders",
            json={"shipping_address": ADDRESS, "items": [
                {"product_id": product_id, "quantity": 1, "variant_id": variant_id}
            ]},
            headers={**self.customer_headers, "X-Forwarded-For": self.ip},
        )
        order_id = self.order_id_of(r)
        await self.expire(order_id)

        await sweep_abandoned_orders()
        self.assertEqual(
            await self.pool.fetchval("SELECT stock_qty FROM product_variants WHERE id=$1", variant_id), 6
        )

    async def test_two_sweeps_do_not_double_the_stock(self):
        from app.jobs import sweep_abandoned_orders

        order_id, product_id = await self.place_order(quantity=2)
        await self.expire(order_id)
        await sweep_abandoned_orders()
        second = await sweep_abandoned_orders()

        self.assertEqual(second["expired"], 0)
        self.assertEqual(await self.stock(product_id), 10)

    async def test_the_sweep_survives_an_order_whose_option_has_since_been_deleted(self):
        """
        A retired option is kept, so this should not happen -- but if it ever
        does, the sweep must not abort and leave the rest of the batch unswept.
        """
        from app.jobs import sweep_abandoned_orders

        order_id, product_id = await self.place_order(quantity=2)
        await self.expire(order_id)
        # order_items.product_id is ON DELETE RESTRICT, so the line has to go
        # first. What is left is an order with nothing to credit -- restore_stock
        # must return cleanly so the rest of the batch still gets swept.
        await self.pool.execute(
            "DELETE FROM order_items WHERE order_id = $1 AND product_id = $2", order_id, product_id
        )
        await self.pool.execute("DELETE FROM products WHERE id = $1", product_id)

        report = await sweep_abandoned_orders()
        self.assertEqual(report["expired"], 1, "the sweep aborted instead of finishing the batch")
        self.assertEqual(await self.order_status(order_id), "cancelled")


# ── stock restoration, on its own ────────────────────────────────────────────

class RestoreStockTests(_PayBase):
    async def order_a_size(self, size="L", quantity=2):
        product_id = await self.make_product(price=1800, stock=0)
        variant_id = str(await self.pool.fetchval(
            "INSERT INTO product_variants (product_id, price, stock_qty, attributes, is_default) "
            "VALUES ($1, 1800, 6, $2::jsonb, TRUE) RETURNING id",
            product_id, json.dumps({"size": size}),
        ))
        # has_variants is the discriminator restore_stock uses, and in production
        # it is the app that sets it (an option existing does not set it -- the
        # variant service does). Set it here so the fixture matches the state a
        # real optioned product is in when its last option is hard-deleted.
        await self.pool.execute(
            "UPDATE products SET has_variants = TRUE WHERE id = $1", product_id
        )
        r = await self.client.request(
            "POST", "/api/orders",
            json={"shipping_address": ADDRESS, "items": [
                {"product_id": product_id, "quantity": quantity, "variant_id": variant_id}
            ]},
            headers={**self.customer_headers, "X-Forwarded-For": self.ip},
        )
        self.assertEqual(r.status_code, 201, r.text)
        return self.order_id_of(r), product_id, variant_id

    async def test_a_deleted_option_is_reported_rather_than_credited_to_the_product(self):
        """
        order_items.variant_id is ON DELETE SET NULL, so hard-deleting an option
        leaves the line pointing at nothing while its product still has options.

        The tempting thing is to add the quantity to products.stock_qty. On a
        variant product that column is the trigger's, and it would be inflated
        until somebody next edited an option -- at which point the total would
        jump and the difference would look like a stock discrepancy with no cause.
        So it is reported and left alone.
        """
        from app.routers.payments import restore_stock

        order_id, product_id, variant_id = await self.order_a_size()
        self.assertEqual(
            await self.pool.fetchval("SELECT stock_qty FROM product_variants WHERE id=$1", variant_id), 4
        )
        await self.pool.execute("DELETE FROM product_variants WHERE id = $1", variant_id)
        self.assertIsNone(
            await self.pool.fetchval("SELECT variant_id FROM order_items WHERE order_id=$1", order_id),
            "the FK did not null the line, so this test is not exercising the case",
        )

        with self.assertLogs("vyapari-payments", level="WARNING") as logs:
            async with self.pool.acquire() as conn:
                await restore_stock(conn, order_id)

        self.assertTrue(
            any("has been deleted" in line for line in logs.output), logs.output
        )
        # The derived total is untouched, because there is no option to add to.
        self.assertEqual(await self.stock(product_id), 0)

    async def test_a_plain_line_with_no_option_restores_normally(self):
        """
        A NULL variant_id on a product *without* options is the ordinary case --
        every non-variant order -- and must not be mistaken for the broken one.
        """
        from app.routers.payments import restore_stock

        order_id, product_id = await self.place_order(quantity=2)
        with self.assertNoLogs("vyapari-payments", level="WARNING"):
            async with self.pool.acquire() as conn:
                await restore_stock(conn, order_id)
        self.assertEqual(await self.stock(product_id), 10)

    async def test_restoring_twice_double_counts_and_is_the_callers_problem(self):
        """
        Worth knowing rather than hiding: restore_stock is not idempotent, and
        the only guard against calling it twice is the status check on the order
        that precedes it in cancel_order and in the sweep. Documented here so
        nobody adds a third caller without that guard.
        """
        from app.routers.payments import restore_stock

        order_id, product_id = await self.place_order(quantity=2)
        async with self.pool.acquire() as conn:
            await restore_stock(conn, order_id)
            await restore_stock(conn, order_id)
        self.assertEqual(await self.stock(product_id), 12)
