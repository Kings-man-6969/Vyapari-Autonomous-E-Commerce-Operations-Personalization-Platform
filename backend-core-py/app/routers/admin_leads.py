"""
Admin leads inbox — H2.

The rules here are mostly about the export and about not losing a note.

  * **The CSV export neutralises spreadsheet formulas.** A lead's name and message
    are attacker-controlled text, and a cell beginning `=`, `+`, `-` or `@` is
    executed as a formula by Excel and Sheets on open. `=HYPERLINK(...)` in a
    contact form is a real, well-documented way to attack the person who exports
    the list, and the person who exports the list is the admin.

  * **Notes append, they do not overwrite.** Two admins on one enquiry otherwise
    silently erase each other. The log carries its author; `leads.notes` keeps the
    latest body so the list view does not need a join per row, and both are
    written in one transaction so they cannot disagree.

  * **A status change writes a note.** Otherwise the trail says an enquiry is
    `won` and nothing says who decided that or when.

  * **An empty result is an empty page, not an error.** Filters that match
    nothing are the normal case on a quiet week.
"""
import csv
import io
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.auth.dependencies import require_role
from app.db import get_db
from app.utils import is_valid_uuid, require_valid_uuid_param

router = APIRouter(tags=["admin-leads"])
_admin_guard = Depends(require_role("admin"))

# V8's CHECK constraint on `leads.status`, repeated for a 400 with a field name.
LEAD_STATUSES = ("new", "contacted", "qualified", "won", "lost", "spam")

# Every source, including the two a public form may not claim.
LEAD_SOURCES = (
    "contact_form",
    "product_enquiry",
    "seller_page",
    "checkout_abandon",
    "manual",
)

# An export is a snapshot a human opens, not a data feed. Ten thousand rows is
# already a spreadsheet nobody reads, and it stops one request from streaming the
# whole table through a CSV serialiser.
EXPORT_MAX_ROWS = 10_000

# 100 fits in a typed `\t`, and 32 KB is a signature block.
MAX_NOTE = 4000
MAX_MESSAGE = 4000

# Characters that make Excel and Sheets treat a cell as a formula. Tab and CR are
# included because neither is a formula but both can break out of the field.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _err(status_code: int, code: str, message: str, **data):
    detail = {"code": code, "message": message}
    if data:
        detail["data"] = data
    return HTTPException(status_code=status_code, detail=detail)


def _iso(value):
    return value.isoformat() if value else None


def _lead_uuid(lead_id: str) -> str:
    if not is_valid_uuid(lead_id):
        raise _err(404, "LEAD_NOT_FOUND", "That enquiry does not exist.")
    return str(uuid.UUID(lead_id))


def _row(row) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    for field in ("product_id", "seller_id", "assigned_to"):
        if d.get(field):
            d[field] = str(d[field])
    d["created_at"] = _iso(d.get("created_at"))
    d["updated_at"] = _iso(d.get("updated_at"))
    if "note_count" in d:
        d["note_count"] = int(d["note_count"])
    return d


def _csv_cell(value) -> str:
    """
    One CSV cell, safe to open in a spreadsheet.

    A leading `'` is the conventional neutraliser: Excel reads the cell as text
    and does not show the quote. It is applied to the string form of the value,
    so a numeric id or a timestamp is untouched.
    """
    if value is None:
        return ""
    text = str(value)
    if text.startswith(_FORMULA_PREFIXES):
        return "'" + text
    return text


def _build_filters(
    status: Optional[str],
    source: Optional[str],
    assigned_to: Optional[str],
    seller_id: Optional[str],
    product_id: Optional[str],
    q: Optional[str],
    unassigned: bool,
    date_from: Optional[str],
    date_to: Optional[str],
) -> tuple[list[str], list]:
    """
    One filter builder, used by the list, the summary and the export.

    Shared on purpose: three copies of this predicate is three chances for the
    export to quietly include a different set of rows than the list the admin was
    looking at when they clicked Export.
    """
    where: list[str] = []
    params: list = []

    if status:
        if status not in LEAD_STATUSES:
            raise _err(
                400,
                "UNKNOWN_STATUS",
                f"Unknown status '{status}'.",
                allowed=list(LEAD_STATUSES),
            )
        params.append(status)
        where.append(f"l.status = ${len(params)}")

    if source:
        if source not in LEAD_SOURCES:
            raise _err(
                400,
                "UNKNOWN_SOURCE",
                f"Unknown source '{source}'.",
                allowed=list(LEAD_SOURCES),
            )
        params.append(source)
        where.append(f"l.source = ${len(params)}")

    if assigned_to:
        params.append(require_valid_uuid_param(assigned_to, "assigned_to"))
        where.append(f"l.assigned_to = ${len(params)}::uuid")

    if unassigned:
        where.append("l.assigned_to IS NULL")

    if seller_id:
        params.append(require_valid_uuid_param(seller_id, "seller_id"))
        where.append(f"l.seller_id = ${len(params)}::uuid")

    if product_id:
        params.append(require_valid_uuid_param(product_id, "product_id"))
        where.append(f"l.product_id = ${len(params)}::uuid")

    if q and q.strip():
        # ILIKE rather than plain LIKE: matching a name is a human typing it, and
        # a search that refuses "priya" because the row says "Priya" is not a
        # search.
        params.append(f"%{q.strip()}%")
        i = len(params)
        where.append(
            f"(l.name ILIKE ${i} OR l.email ILIKE ${i} OR l.phone ILIKE ${i} "
            f"OR l.message ILIKE ${i} OR l.notes ILIKE ${i})"
        )

    if date_from:
        params.append(date_from)
        where.append(f"l.created_at >= ${len(params)}::timestamptz")
    if date_to:
        params.append(date_to)
        where.append(f"l.created_at <= ${len(params)}::timestamptz")

    return where, params


async def _append_note(db, lead_id: str, author_id: str, body: str) -> dict:
    """
    Append one internal note, and keep the denormalised copy in step.

    One transaction, because `leads.notes` and `lead_notes` are two records of
    one fact. Written separately, a crash between them leaves the list view
    showing a note that the log does not have.
    """
    async with db.transaction():
        row = await db.fetchrow(
            """INSERT INTO lead_notes (lead_id, author_id, body)
               VALUES ($1::uuid, $2::uuid, $3)
               RETURNING id, body, created_at""",
            lead_id,
            author_id,
            body,
        )
        await db.execute(
            "UPDATE leads SET notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
            lead_id,
            body,
        )
    return {
        "id": str(row["id"]),
        "body": row["body"],
        "created_at": _iso(row["created_at"]),
    }


# ----------------------------------------------------------------------------
# List
# ----------------------------------------------------------------------------
@router.get("/leads")
async def admin_list_leads(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    seller_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=200),
    unassigned: bool = Query(False),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort: str = Query("newest"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    The inbox.

    Newest first by default, because an inbox is worked from the top. `sort=oldest`
    exists because the oldest unhandled enquiry is the one that is most overdue,
    which is the opposite question.
    """
    where, params = _build_filters(
        status, source, assigned_to, seller_id, product_id, q, unassigned, date_from, date_to
    )
    clause = f"WHERE {' AND '.join(where)}" if where else ""

    order = "l.created_at ASC" if sort == "oldest" else "l.created_at DESC"

    total = await db.fetchval(f"SELECT COUNT(*) FROM leads l {clause}", *params)

    page_params = list(params) + [limit, offset]
    rows = await db.fetch(
        f"""
        SELECT l.*,
               (SELECT COUNT(*) FROM lead_notes n WHERE n.lead_id = l.id) AS note_count
          FROM leads l
          {clause}
         ORDER BY {order}
         LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
        """,
        *page_params,
    )

    return {
        "success": True,
        "data": [_row(r) for r in rows],
        "pagination": {"total": int(total or 0), "limit": limit, "offset": offset},
    }


@router.get("/leads/summary")
async def admin_leads_summary(
    q: Optional[str] = Query(None, max_length=200),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    Counts by status, plus unassigned.

    Every status is present even at zero. A filter bar whose buttons disappear
    when a count hits zero is a filter bar that moves under the cursor, and
    "there are none" is information.
    """
    where, params = _build_filters(None, None, None, None, None, q, False, None, None)
    clause = f"WHERE {' AND '.join(where)}" if where else ""

    rows = await db.fetch(
        f"SELECT l.status, COUNT(*) AS n FROM leads l {clause} GROUP BY l.status",
        *params,
    )
    counts = {s: 0 for s in LEAD_STATUSES}
    for r in rows:
        counts[r["status"]] = int(r["n"])

    unassigned = await db.fetchval(
        f"SELECT COUNT(*) FROM leads l {clause} "
        f"{'AND' if where else 'WHERE'} l.assigned_to IS NULL",
        *params,
    )
    # `spam` is not work. Excluding it keeps the badge honest -- otherwise the
    # number an admin is chasing includes rows they have already dismissed.
    open_count = sum(counts[s] for s in LEAD_STATUSES if s not in ("won", "lost", "spam"))

    return {
        "success": True,
        "data": {
            "counts": counts,
            "total": sum(counts.values()),
            "open": open_count,
            "unassigned": int(unassigned or 0),
        },
    }


# ----------------------------------------------------------------------------
# Export
#
# Declared before `/leads/{lead_id}` so the literal path wins. FastAPI matches in
# declaration order, so the other way round "export.csv" arrives as a lead id and
# 404s -- a bug that only shows up when someone clicks the button.
# ----------------------------------------------------------------------------
@router.get("/leads/export.csv")
async def admin_export_leads(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    seller_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=200),
    unassigned: bool = Query(False),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort: str = Query("newest"),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> Response:
    """
    The same rows the list is showing, as a CSV.

    Same filter builder as the list, deliberately -- see `_build_filters`.
    """
    where, params = _build_filters(
        status, source, assigned_to, seller_id, product_id, q, unassigned, date_from, date_to
    )
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    order = "l.created_at ASC" if sort == "oldest" else "l.created_at DESC"

    rows = await db.fetch(
        f"""
        SELECT l.created_at, l.id, l.status, l.source, l.name, l.email, l.phone,
               l.message, l.notes,
               s.name AS seller_name, s.email AS seller_email,
               a.name AS assigned_to_name
          FROM leads l
          LEFT JOIN users s ON s.id = l.seller_id
          LEFT JOIN users a ON a.id = l.assigned_to
          {clause}
         ORDER BY {order}
         LIMIT {EXPORT_MAX_ROWS}
        """,
        *params,
    )

    columns = [
        ("created_at", "Created"),
        ("id", "Enquiry ID"),
        ("status", "Status"),
        ("source", "Source"),
        ("name", "Name"),
        ("email", "Email"),
        ("phone", "Phone"),
        ("seller_name", "Store"),
        ("seller_email", "Store email"),
        ("assigned_to_name", "Assigned to"),
        ("message", "Message"),
        ("notes", "Latest note"),
    ]

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow([label for _, label in columns])
    for row in rows:
        writer.writerow([_csv_cell(row[key]) for key, _ in columns])

    # A BOM, because the file is full of Indian names and phone numbers and Excel
    # on Windows opens a BOM-less UTF-8 CSV as Latin-1, turning every accented
    # name into mojibake. The cost is three bytes.
    body = "\ufeff" + buffer.getvalue()

    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M")
    return Response(
        content=body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="leads-{stamp}.csv"',
            # The export is a snapshot; a proxy must not hand one admin another
            # admin's filtered view out of a shared cache.
            "Cache-Control": "no-store",
        },
    )


# ----------------------------------------------------------------------------
# Manual entry
# ----------------------------------------------------------------------------
class ManualLeadBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, max_length=120)
    email: Optional[str] = Field(default=None, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=20)
    message: Optional[str] = Field(default=None, max_length=MAX_MESSAGE)
    source: str = Field(default="manual")
    product_id: Optional[str] = None
    seller_id: Optional[str] = None
    assigned_to: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=MAX_NOTE)

    @field_validator("source")
    @classmethod
    def _known_source(cls, v):
        if v not in LEAD_SOURCES:
            raise ValueError(f"source must be one of: {', '.join(LEAD_SOURCES)}.")
        return v


@router.post("/leads", status_code=201)
async def admin_create_lead(
    body: ManualLeadBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    A lead an admin typed in — a phone call, a trade-show card.

    This is the only writer that may claim `manual` or `checkout_abandon`, which
    is why those two values exist in V8's enum and why the public route refuses
    them: they are statements only the platform can truthfully make.
    """
    if not body.email and not body.phone:
        raise _err(
            400,
            "CONTACT_REQUIRED",
            "Provide an email address or a phone number so the enquiry can be answered.",
            fields=["email", "phone"],
        )

    for field, value in (("product_id", body.product_id), ("seller_id", body.seller_id)):
        if value and not is_valid_uuid(value):
            raise _err(400, "VALIDATION_ERROR", f"'{field}' must be a valid UUID.", field=field)
    if body.assigned_to and not is_valid_uuid(body.assigned_to):
        raise _err(400, "VALIDATION_ERROR", "'assigned_to' must be a valid UUID.", field="assigned_to")

    if body.product_id and not await db.fetchval(
        "SELECT 1 FROM products WHERE id = $1::uuid", body.product_id
    ):
        raise _err(404, "PRODUCT_NOT_FOUND", "That product does not exist.")
    if body.seller_id and not await db.fetchval(
        "SELECT 1 FROM users WHERE id = $1::uuid", body.seller_id
    ):
        raise _err(404, "SELLER_NOT_FOUND", "That seller does not exist.")
    if body.assigned_to and not await db.fetchval(
        "SELECT 1 FROM users WHERE id = $1::uuid AND role = 'admin'", body.assigned_to
    ):
        raise _err(404, "ADMIN_NOT_FOUND", "That admin does not exist.")

    lead_id = await db.fetchval(
        """
        INSERT INTO leads (name, email, phone, message, source, product_id, seller_id, assigned_to)
        VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::uuid, $8::uuid)
        RETURNING id
        """,
        body.name,
        body.email,
        body.phone,
        body.message,
        body.source,
        body.product_id,
        body.seller_id,
        body.assigned_to,
    )

    if body.note and body.note.strip():
        await _append_note(db, str(lead_id), user["id"], body.note.strip())

    row = await db.fetchrow(
        """SELECT l.*, (SELECT COUNT(*) FROM lead_notes n WHERE n.lead_id = l.id) AS note_count
             FROM leads l WHERE l.id = $1::uuid""",
        lead_id,
    )
    return {"success": True, "message": "Enquiry recorded.", "data": _row(row)}


# ----------------------------------------------------------------------------
# Detail
# ----------------------------------------------------------------------------
@router.get("/leads/{lead_id}")
async def admin_get_lead(
    lead_id: str,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """One enquiry, with its note log and the context the inbox rows only hint at."""
    lid = _lead_uuid(lead_id)
    row = await db.fetchrow(
        """
        SELECT l.*,
               (SELECT COUNT(*) FROM lead_notes n WHERE n.lead_id = l.id) AS note_count,
               s.name  AS seller_name,
               s.email AS seller_email,
               a.name  AS assigned_to_name,
               a.email AS assigned_to_email
          FROM leads l
          LEFT JOIN users s ON s.id = l.seller_id
          LEFT JOIN users a ON a.id = l.assigned_to
         WHERE l.id = $1::uuid
        """,
        lid,
    )
    if not row:
        raise _err(404, "LEAD_NOT_FOUND", "That enquiry does not exist.")

    product = None
    if row["product_id"]:
        p = await db.fetchrow(
            "SELECT id, title, slug, price FROM products WHERE id = $1::uuid",
            row["product_id"],
        )
        if p:
            product = {
                "id": str(p["id"]),
                "title": p["title"],
                "slug": p["slug"],
                "price": float(p["price"]) if p["price"] is not None else None,
            }

    notes = await db.fetch(
        """
        SELECT n.id, n.body, n.created_at, u.name AS author_name, u.email AS author_email
          FROM lead_notes n
          LEFT JOIN users u ON u.id = n.author_id
         WHERE n.lead_id = $1::uuid
         ORDER BY n.created_at DESC
        """,
        lid,
    )

    data = _row(row)
    data["product"] = product
    data["notes_log"] = [
        {
            "id": str(n["id"]),
            "body": n["body"],
            "created_at": _iso(n["created_at"]),
            "author_name": n["author_name"],
            "author_email": n["author_email"],
        }
        for n in notes
    ]
    return {"success": True, "data": data}


# ----------------------------------------------------------------------------
# Update
# ----------------------------------------------------------------------------
class LeadUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[str] = None
    assigned_to: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=MAX_NOTE)

    @field_validator("status")
    @classmethod
    def _known_status(cls, v):
        if v is not None and v not in LEAD_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(LEAD_STATUSES)}.")
        return v


@router.put("/leads/{lead_id}")
async def admin_update_lead(
    lead_id: str,
    body: LeadUpdateBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    Change status, reassign, or leave a note. All three at once if you like.

    A status change writes a note automatically, so the log answers "who decided
    this and when" without depending on an admin remembering to type it.
    """
    lid = _lead_uuid(lead_id)
    current = await db.fetchrow(
        "SELECT id, status, assigned_to FROM leads WHERE id = $1::uuid", lid
    )
    if not current:
        raise _err(404, "LEAD_NOT_FOUND", "That enquiry does not exist.")

    events: list[str] = []

    if body.status and body.status != current["status"]:
        events.append(f"Status: {current['status']} → {body.status}")

    # `model_fields_set`, not a `is not None` check, and for the same reason as
    # the banner PATCH: for `assigned_to`, null is a real value meaning
    # "unassign". Testing truthiness conflates it with "the client did not
    # mention this field", so the one action the field uniquely exists for --
    # taking a lead off someone -- silently did nothing and still answered 200.
    assigned_supplied = "assigned_to" in body.model_fields_set
    if assigned_supplied:
        if body.assigned_to and not is_valid_uuid(body.assigned_to):
            raise _err(400, "VALIDATION_ERROR", "'assigned_to' must be a valid UUID.", field="assigned_to")
        if body.assigned_to:
            admin = await db.fetchrow(
                "SELECT id, name FROM users WHERE id = $1::uuid AND role = 'admin'",
                body.assigned_to,
            )
            if not admin:
                raise _err(404, "ADMIN_NOT_FOUND", "That admin does not exist.")
            if str(admin["id"]) != str(current["assigned_to"]):
                events.append(f"Assigned to {admin['name']}")
        elif current["assigned_to"] is not None:
            events.append("Unassigned")

    if body.status and body.status != current["status"]:
        await db.execute(
            "UPDATE leads SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
            lid,
            body.status,
        )
    if assigned_supplied:
        await db.execute(
            "UPDATE leads SET assigned_to = $2::uuid, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
            lid,
            body.assigned_to or None,
        )

    for event in events:
        await _append_note(db, lid, user["id"], event)
    if body.note and body.note.strip():
        await _append_note(db, lid, user["id"], body.note.strip())

    row = await db.fetchrow(
        """SELECT l.*, (SELECT COUNT(*) FROM lead_notes n WHERE n.lead_id = l.id) AS note_count
             FROM leads l WHERE l.id = $1::uuid""",
        lid,
    )
    return {"success": True, "message": "Enquiry updated.", "data": _row(row)}


@router.post("/leads/{lead_id}/notes", status_code=201)
async def admin_add_lead_note(
    lead_id: str,
    body: dict,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    Append a note without touching status or assignment.

    Deliberately its own route rather than only a field on PUT: the detail view
    has a note box next to a status dropdown, and sending the dropdown's current
    value alongside every note would re-fire the status-change event on every
    save, filling the log with "Status: contacted → contacted" noise.
    """
    lid = _lead_uuid(lead_id)
    text = (body or {}).get("body")
    if not isinstance(text, str) or not text.strip():
        raise _err(400, "NOTE_REQUIRED", "A note cannot be empty.", field="body")
    text = text.strip()
    if len(text) > MAX_NOTE:
        raise _err(
            400,
            "NOTE_TOO_LONG",
            f"A note cannot exceed {MAX_NOTE} characters.",
            field="body",
            max_length=MAX_NOTE,
        )

    exists = await db.fetchval("SELECT 1 FROM leads WHERE id = $1::uuid", lid)
    if not exists:
        raise _err(404, "LEAD_NOT_FOUND", "That enquiry does not exist.")

    note = await _append_note(db, lid, user["id"], text)
    return {"success": True, "message": "Note added.", "data": note}
