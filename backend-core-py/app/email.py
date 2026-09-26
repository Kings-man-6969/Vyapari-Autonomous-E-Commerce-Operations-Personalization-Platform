"""
Transactional email — a single seam with one wired implementation.

HONEST STATUS: this does not send email yet. There is no SMTP or API provider
configured for this deployment. `send()` logs the message and returns, so the
calling flow is genuinely exercised end to end — token generation, storage,
expiry, consumption, session revocation — and only the last mile is missing.

That is deliberate, and it is the reason this file exists at all: when a
provider is added it is a change to `send()` and nothing else. The alternative,
a `pass` in the router, hides the fact that nobody has looked at delivery.

Non-production responses include the reset link directly (see
`dev_expose_link`) so the flow is testable without an inbox. Production never
does: a reset link returned in an API body is a password reset with no
possession check at all.

To wire a real provider, set EMAIL_PROVIDER plus its credential and add a
branch to `_dispatch()`. Resend and SES both fit in about fifteen lines.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger("vyapari.email")


@dataclass
class Email:
    to: str
    subject: str
    text: str
    html: Optional[str] = None


#: Kept short and specific. A long list of banned words is security theatre;
#: this is here to stop the handful of passwords that dominate credential
#: stuffing lists, which a length-plus-character-class rule would not.
WEAK_PASSWORDS = frozenset(
    {
        "password", "password1", "password123", "passw0rd", "12345678",
        "123456789", "1234567890", "qwertyui", "qwerty123", "iloveyou",
        "admin123", "welcome1", "letmein1", "abc12345", "passw0rd1",
    }
)

MIN_PASSWORD_LENGTH = 8


class PasswordPolicyError(ValueError):
    """Raised with a user-presentable reason. Never leaks the password."""


def validate_password(password: str) -> None:
    """Enforce the account password policy.

    Registration previously accepted any string at all, including an empty
    one, so "secure authentication" rested entirely on bcrypt never being asked
    to store something trivial. This is deliberately not a symbol requirement:
    forcing punctuation pushes people towards Password1! patterns, which is a
    well-studied way to end up with a worse password, not a better one.
    """
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordPolicyError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        )
    if not any(c.isalpha() for c in password):
        raise PasswordPolicyError("Password must contain at least one letter.")
    if not any(c.isdigit() for c in password):
        raise PasswordPolicyError("Password must contain at least one number.")
    if password.lower() in WEAK_PASSWORDS:
        raise PasswordPolicyError("That password is too common. Choose another.")


def _reset_email(to: str, link: str, minutes: int) -> Email:
    return Email(
        to=to,
        subject="Reset your Vyapari password",
        text=(
            "We received a request to reset the password for your Vyapari account.\n\n"
            f"Open this link to choose a new password:\n{link}\n\n"
            f"The link expires in {minutes} minutes and can be used once.\n\n"
            "If you did not request this, you can ignore this email — your "
            "password will not change until someone opens the link above.\n"
        ),
        html=(
            "<p>We received a request to reset the password for your Vyapari "
            "account.</p>"
            f'<p><a href="{link}">Choose a new password</a></p>'
            f"<p>The link expires in {minutes} minutes and can be used once.</p>"
            "<p>If you did not request this, you can ignore this email — your "
            "password will not change until someone opens the link above.</p>"
        ),
    )


async def _dispatch(message: Email) -> bool:
    """Hand the message to a real provider. Returns True if it was accepted.

    No provider is implemented yet. This returns False, which callers treat as
    "deliver it another way" rather than as a failure — the reset token is
    still valid and still expiring, so wiring a provider later recovers the
    emails that were logged in the meantime.
    """
    provider = (settings.EMAIL_PROVIDER or "").strip().lower()
    if not provider:
        return False

    if provider == "resend":
        if not settings.EMAIL_API_KEY:
            logger.error("EMAIL_PROVIDER=resend but EMAIL_API_KEY is unset.")
            return False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {settings.EMAIL_API_KEY}"},
                    json={
                        "from": settings.EMAIL_FROM,
                        "to": [message.to],
                        "subject": message.subject,
                        "text": message.text,
                        "html": message.html,
                    },
                )
                if r.status_code >= 300:
                    logger.error(
                        f"Resend rejected the message ({r.status_code}): {r.text[:300]}"
                    )
                    return False
                return True
        except Exception as exc:
            logger.error(f"Resend request failed: {exc}")
            return False

    logger.error(f"Unknown EMAIL_PROVIDER '{provider}'. No message sent.")
    return False


async def send(message: Email) -> bool:
    """Deliver a message. Logs the full text so nothing is silently lost."""
    sent = await _dispatch(message)
    if sent:
        logger.info(f"Email sent to {message.to} (subject: {message.subject})")
        return True

    # Not an error yet, but it must be loud. A reset link that is only ever
    # written to a log file is a support burden waiting to happen.
    logger.warning(
        f"[EMAIL NOT SENT - no provider configured] to={message.to} "
        f"subject={message.subject!r}\n{message.text}"
    )
    return False


def password_reset_link(token: str) -> str:
    """Build the frontend URL a reset token is redeemed at."""
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/reset-password?token={token}"


async def send_password_reset(to: str, token: str) -> bool:
    minutes = max(1, settings.PASSWORD_RESET_TOKEN_TTL_MINUTES)
    return await send(_reset_email(to, password_reset_link(token), minutes))


def dev_expose_link(token: str) -> Optional[str]:
    """Return the reset link in non-production so the flow is testable.

    Never returns anything in production. Returning a live reset token in an
    API response defeats the entire possession check, so this is gated on
    NODE_ENV rather than on a feature flag.
    """
    if settings.is_production:
        return None
    return password_reset_link(token)
