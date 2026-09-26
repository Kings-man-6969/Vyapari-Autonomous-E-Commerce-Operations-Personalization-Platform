"""
Razorpay: the only code that knows how to talk to the gateway.

Everything the rest of the application needs from a payment provider is four
operations -- make an order, check a signature, ask what happened to a payment,
refund one -- and they are defined here as a class so a test can substitute one
without a network or a key.

Money crosses this boundary in paise, as an int. Razorpay's API is defined that
way, and a float rupee amount is where a rounding error becomes a customer
charged one paisa more than the order says. The rupee amount is converted once,
at the edge, with Decimal so 249.50 is 24950 and not 24949.

The keys are not in the repository. Until they are, is_configured() is False and
the create-order endpoint answers 503 with a message that says what to set. That
is deliberate: a placeholder key that "works" would be a checkout that takes a
customer's details and never takes their money, which is worse than a refusal.
"""
import hashlib
import hmac
import logging
from decimal import Decimal
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("vyapari-payments")

API_BASE = "https://api.razorpay.com/v1"

#: The defaults in config.py. Treated as "no key supplied" rather than as a key,
#: because shipping a default that authenticates nothing is how a deployment ends
#: up with 500s from the gateway instead of a clear message from here.
_PLACEHOLDERS = {"rzp_test_placeholder_key_id", "rzp_test_placeholder_key_secret"}


class GatewayError(RuntimeError):
    """Razorpay refused, or could not be reached. Carries the HTTP status."""

    def __init__(self, message: str, status_code: int | None = None, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class RazorpayClient:
    def __init__(self, key_id: str, key_secret: str, webhook_secret: str | None = None):
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret or None

    @property
    def is_configured(self) -> bool:
        return bool(
            self.key_id
            and self.key_secret
            and self.key_id not in _PLACEHOLDERS
            and self.key_secret not in _PLACEHOLDERS
        )

    def public_key_id(self) -> str:
        """The key id is published to the browser; the secret never is."""
        return self.key_id

    # ── amounts ───────────────────────────────────────────────────────────────

    @staticmethod
    def to_paise(rupees: Any) -> int:
        """
        249.50 -> 24950.

        Decimal(str(...)) rather than Decimal(float) because the float has
        already lost the value by the time it arrives: Decimal(249.50) is
        249.5000000000000028..., and to_paise would return 24950 by luck rather
        than by arithmetic.
        """
        amount = Decimal(str(rupees))
        paise = amount * 100
        if paise != paise.to_integral_value():
            # A price with sub-paise precision cannot be charged. Rounding here
            # would silently charge a different amount than the order says, so
            # this is an error the caller has to see.
            raise GatewayError(f"amount {rupees} is finer than a paisa")
        return int(paise)

    @staticmethod
    def to_rupees(paise: Any) -> float:
        return float(Decimal(str(paise or 0)) / 100)

    # ── api ───────────────────────────────────────────────────────────────────

    def _auth(self) -> tuple[str, str]:
        return self.key_id, self.key_secret

    async def create_order(
        self,
        *,
        amount: Any,
        currency: str = "INR",
        receipt: str,
        notes: dict | None = None,
    ) -> dict:
        """
        Creates a Razorpay order and returns it.

        `receipt` is echoed back on every webhook for this order, so it has to be
        something we can recognise -- our own order id.
        """
        payload = {
            "amount": self.to_paise(amount),
            "currency": currency,
            "receipt": receipt[:40],
            "notes": notes or {},
        }
        data = await self._request("POST", "/orders", json=payload)
        logger.info("Razorpay order created: %s for receipt %s", data.get("id"), receipt)
        return data

    async def fetch_payment(self, payment_id: str) -> dict:
        """What the gateway says about a payment. The authority on whether it happened."""
        return await self._request("GET", f"/payments/{payment_id}")

    async def create_refund(self, *, payment_id: str, amount: Any, notes: dict | None = None) -> dict:
        payload = {"amount": self.to_paise(amount), "notes": notes or {}}
        return await self._request("POST", f"/payments/{payment_id}/refund", json=payload)

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        if not self.is_configured:
            raise GatewayError("Razorpay keys are not configured", status_code=503)
        try:
            async with httpx.AsyncClient(
                base_url=API_BASE, auth=self._auth(), timeout=10.0
            ) as client:
                response = await client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            # A timeout is not a refusal. The caller must not conclude the
            # payment failed, and a refund must not be attempted on a timeout --
            # both would be decisions made from a network problem.
            raise GatewayError(f"could not reach Razorpay: {exc}") from exc

        if response.status_code >= 400:
            raise GatewayError(
                f"Razorpay returned {response.status_code}",
                status_code=response.status_code,
                body=_safe_json(response),
            )
        return _safe_json(response) or {}

    # ── signatures ────────────────────────────────────────────────────────────

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        """
        checkout.js returns a signature over "<order_id>|<payment_id>".

        Verified with the key secret, and compared in constant time. This is what
        stops a customer POSTing any order id they like to confirm-payment and
        having their order marked paid for free -- the IDOR that a
        client-reported "payment succeeded" always has.
        """
        if not order_id or not payment_id or not signature:
            return False
        expected = hmac.new(
            key=self.key_secret.encode("utf-8"),
            msg=f"{order_id}|{payment_id}".encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature.strip())

    def verify_webhook_signature(self, raw_body: bytes, signature: str) -> bool:
        secret = self.webhook_secret
        if not secret:
            # Without a dedicated webhook secret Razorpay signs with the API
            # secret, so that is the correct fallback rather than a blank one.
            secret = self.key_secret
        if not secret or not signature:
            return False
        expected = hmac.new(
            key=secret.encode("utf-8"), msg=raw_body, digestmod=hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature.strip())


def _safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"raw": response.text[:500]}


#: The process-wide client. Replaced in tests; never rebound at runtime.
gateway = RazorpayClient(
    settings.RAZORPAY_KEY_ID,
    settings.RAZORPAY_KEY_SECRET,
    settings.RAZORPAY_WEBHOOK_SECRET,
)
