"""
Vyapari — Notification Celery Tasks
"""
from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger
from app.tasks.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="app.tasks.notifications.send_order_confirmation_email", bind=True, max_retries=3)
def send_order_confirmation_email(self, order_id: str, customer_email: str, order_data: dict) -> None:
    """Sends order confirmation email via SendGrid."""
    try:
        if not settings.SENDGRID_API_KEY:
            logger.warning("sendgrid_not_configured", order_id=order_id)
            return

        from sendgrid import SendGridAPIClient  # type: ignore[import-untyped]
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=(settings.EMAIL_FROM, settings.EMAIL_FROM_NAME),
            to_emails=customer_email,
            subject=f"Order Confirmed! #{order_id[:8].upper()} — Vyapari",
            html_content=_order_confirmation_html(order_id, order_data),
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        sg.send(message)
        logger.info("order_confirmation_email_sent", order_id=order_id, email=customer_email)

    except Exception as exc:
        logger.error("order_confirmation_email_failed", order_id=order_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.notifications.send_kyc_status_email", bind=True, max_retries=3)
def send_kyc_status_email(self, seller_email: str, business_name: str, status: str, reason: str | None = None) -> None:
    """Notifies sellers of KYC approval or rejection."""
    try:
        if not settings.SENDGRID_API_KEY:
            return

        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        if status == "approved":
            subject = f"🎉 Your seller account is approved — Vyapari"
            body = f"<p>Congratulations, <b>{business_name}</b>! Your KYC has been approved. You can now list products on Vyapari.</p>"
        else:
            subject = "KYC Verification Update — Vyapari"
            body = f"<p>We were unable to verify your KYC for <b>{business_name}</b>. Reason: {reason or 'See dashboard for details.'}</p>"

        message = Mail(
            from_email=(settings.EMAIL_FROM, settings.EMAIL_FROM_NAME),
            to_emails=seller_email,
            subject=subject,
            html_content=body,
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        sg.send(message)

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


def _order_confirmation_html(order_id: str, order_data: dict) -> str:
    items_html = "".join(
        f"<li>{item.get('product_name', 'Product')} × {item.get('qty', 1)} — ₹{item.get('unit_price', 0)}</li>"
        for item in order_data.get("items", [])
    )
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#000">Your order is confirmed! 🎉</h2>
      <p>Order ID: <b>#{order_id[:8].upper()}</b></p>
      <p>Total: <b>₹{order_data.get('total_amount', 0)}</b></p>
      <ul>{items_html}</ul>
      <p>You'll receive a shipping notification soon.</p>
      <p style="color:#71717a;font-size:12px">— Team Vyapari</p>
    </div>
    """
