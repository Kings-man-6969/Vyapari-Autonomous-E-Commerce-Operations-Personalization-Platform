"""
Leads — public capture.

Section H1. The `leads` table has existed since V8 and has never had a row
written by any code, so this is the first writer.

This is the least-trusted write in the application: unauthenticated, reachable by
anyone, and it puts a stranger's text into a table an admin reads. Three things
follow from that, and they are the whole design.

  * **The source is not the client's to choose freely.** The enum in V8 has five
    values and two of them (`checkout_abandon`, `manual`) are statements only the
    platform can truthfully make. A public form that could claim
    `checkout_abandon` would let anyone file a lead that looks like the
    platform's own analysis. The public route accepts three sources and refuses
    the rest.

  * **A reply address is required, proven twice.** V8's `chk_lead_contactable`
    requires an email or a phone, and it is re-checked here so the answer is a
    400 naming the field rather than a constraint violation surfacing as a 500.

  * **The routing fields are derived, not trusted.** A product enquiry is routed
    to the product's seller by reading the product, not by believing a
    `seller_id` the browser sent. A client that gets it wrong -- or lies -- would
    otherwise file the enquiry against a merchant who has nothing to do with it,
    and the merchant who should have replied never sees it.

There is also a honeypot. Every public form on the internet gets automated
submissions; the field is invisible to a person and irresistible to a script.
A filled honeypot gets the same response as a real submission and stores
nothing, because a bot that is told it failed is a bot that tries again.
"""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db import get_db
from app.rate_limit import limit_for, rate_limit
from app.utils import is_valid_uuid

router = APIRouter(tags=["leads"])

# The three sources a public form may claim. See the module docstring.
PUBLIC_SOURCES = ("contact_form", "product_enquiry", "seller_page")

# V8's CHECK constraint, repeated here so a bad value is a 400 with a field name
# instead of a 500 from the database's name for the constraint.
ALL_SOURCES = (
    "contact_form",
    "product_enquiry",
    "seller_page",
    "checkout_abandon",
    "manual",
)

MAX_MESSAGE = 4000
MAX_NAME = 120
MAX_EMAIL = 150
MAX_PHONE = 20

# Deliberately loose. The job of this pattern is to reject "not an email", not to
# adjudicate RFC 5322 -- and a stricter pattern rejects real addresses, which for
# a contact form means losing the enquiry entirely. The address is not used to
# authenticate anyone; it is used to reply.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$")

# Same reasoning. Indian mobile numbers are ten digits after an optional +91,
# but this must also accept a landline with a STD code and a number written with
# spaces or dashes, because the person typing it does not know what we expect.
_PHONE_RE = re.compile(r"^\+?[0-9][0-9\s\-()]{6,19}$")


class LeadBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, max_length=MAX_NAME)
    email: Optional[str] = Field(default=None, max_length=MAX_EMAIL)
    phone: Optional[str] = Field(default=None, max_length=MAX_PHONE)
    message: Optional[str] = Field(default=None, max_length=MAX_MESSAGE)

    source: str = Field(default="contact_form")
    product_id: Optional[str] = None
    seller_id: Optional[str] = None

    # The honeypot. Named like a real field so a scraper fills it. Never
    # rendered, never sent by a person.
    website: Optional[str] = Field(default=None, max_length=200)

    @field_validator("source")
    @classmethod
    def _public_source(cls, v):
        if v not in PUBLIC_SOURCES:
            raise ValueError(
                f"source must be one of: {', '.join(PUBLIC_SOURCES)}."
            )
        return v

    @field_validator("email")
    @classmethod
    def _email_shape(cls, v):
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if len(v) > MAX_EMAIL or not _EMAIL_RE.match(v):
            # The value is not echoed back. It is a stranger's address, and a
            # 400 body is the wrong place to publish it.
            raise ValueError("That does not look like an email address.")
        return v

    @field_validator("phone")
    @classmethod
    def _phone_shape(cls, v):
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        digits = re.sub(r"\D", "", v)
        if not _PHONE_RE.match(v) or not (8 <= len(digits) <= 15):
            raise ValueError("That does not look like a phone number.")
        return v

    @field_validator("name", "message")
    @classmethod
    def _trim(cls, v):
        if v is None:
            return None
        v = v.strip()
        return v or None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_lead(
    body: LeadBody,
    request: Request,
    db=Depends(get_db),
    _rl=Depends(rate_limit("leads.create", *limit_for("leads.create"))),
) -> dict:
    """
    Capture one enquiry.

    Rate limited per identity -- the user id when signed in, otherwise the first
    hop of `X-Forwarded-For`. A contact form is used a handful of times a year by
    any one person, so the limit is tight, and the cost of a false positive is a
    second attempt rather than a lost sale.
    """
    # The honeypot, before anything else. A filled `website` is not a validation
    # error and must not read like one: answer exactly as a success and drop it.
    # A bot told it failed retries with the field cleared.
    if body.website and body.website.strip():
        return {
            "success": True,
            "message": "Thanks -- we will be in touch.",
            "data": {"status": "received"},
        }

    if not body.email and not body.phone:
        # V8's chk_lead_contactable would catch this as a constraint violation,
        # which is a 500. An enquiry with no reply address is the caller's
        # mistake and should read like one.
        raise HTTPException(
            status_code=400,
            detail={
                "code": "CONTACT_REQUIRED",
                "message": "Provide an email address or a phone number so we can reply.",
                "data": {"fields": ["email", "phone"]},
            },
        )

    product_id = None
    seller_id = None

    if body.source == "product_enquiry":
        if not body.product_id or not is_valid_uuid(body.product_id):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "PRODUCT_REQUIRED",
                    "message": "A product enquiry must name the product it is about.",
                    "data": {"field": "product_id"},
                },
            )
        product = await db.fetchrow(
            "SELECT id, seller_id, status FROM products WHERE id = $1::uuid",
            body.product_id,
        )
        if product is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "PRODUCT_NOT_FOUND", "message": "That product does not exist."},
            )
        product_id = str(product["id"])
        # Derived, not trusted. See the module docstring.
        seller_id = str(product["seller_id"]) if product["seller_id"] else None

    elif body.source == "seller_page":
        if not body.seller_id or not is_valid_uuid(body.seller_id):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "SELLER_REQUIRED",
                    "message": "A store enquiry must name the store it is about.",
                    "data": {"field": "seller_id"},
                },
            )
        exists = await db.fetchval(
            "SELECT 1 FROM users WHERE id = $1::uuid AND role IN ('seller', 'admin')",
            body.seller_id,
        )
        if not exists:
            raise HTTPException(
                status_code=404,
                detail={"code": "SELLER_NOT_FOUND", "message": "That store does not exist."},
            )
        seller_id = str(body.seller_id)

    lead_id = await db.fetchval(
        """
        INSERT INTO leads (name, email, phone, message, source, product_id, seller_id)
        VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::uuid)
        RETURNING id
        """,
        body.name,
        body.email,
        body.phone,
        body.message,
        body.source,
        product_id,
        seller_id,
    )

    return {
        "success": True,
        "message": "Thanks -- we will be in touch.",
        # The id is returned so a support conversation can reference it, and
        # nothing else is: the row's contents are the customer's, and the
        # response should not echo them back into a page that may be shared.
        "data": {"id": str(lead_id), "status": "new"},
    }
