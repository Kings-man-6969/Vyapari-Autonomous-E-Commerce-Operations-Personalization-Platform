"""
Uploads Router — the real media write path.

Five routes, one per stage of an upload:

    GET    /api/uploads/config     what the storage provider can do
    POST   /api/uploads/presign    reserve a key, get a ticket
    POST   /api/uploads/object     send the bytes
    POST   /api/uploads/complete   resolve the key to a persistable URL
    DELETE /api/uploads/object     remove an object

What changed, and why
---------------------
The previous implementation of ``/presign`` fabricated its response. It built a
key, then returned::

    upload_url = f"https://{bucket}.s3.amazonaws.com/{key}?presigned=true"
    public_url = "https://cdn.vyapari.com/{key}"

Neither address was real. There was no ``?presigned=true`` support in S3, the
``cdn.vyapari.com`` host did not resolve, and no code path anywhere in the
repository called the endpoint -- the seller product form asked for a URL typed
into a text box instead. So the route was not a broken upload path, it was a
decorative one, and the honest failure was invisible because nothing exercised
it.

It also had a security problem independent of being fake. The key extension came
from the client's declared ``mime_type``, and nothing ever verified the bytes
matched. A seller could declare ``image/jpeg``, upload an SVG carrying a
``<script>`` tag, and get back a URL that the app would serve from its own
origin. Everything here runs uploaded bytes through
:mod:`app.storage.images`, which decodes and **re-encodes** them, so a file that
is not an image never gets a URL at all.

The provider is chosen by ``STORAGE_PROVIDER``. ``local`` writes to
``MEDIA_ROOT`` and needs no credentials, so the whole path is exercisable today;
``s3`` presigns a direct browser PUT and answers 503 until real credentials are
set, rather than handing back a URL that would fail after the seller picked a
file.
"""
from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field

from app.auth.dependencies import require_auth
from app.rate_limit import limit_for, rate_limit
from app.storage import (
    MAX_BYTES,
    InvalidObjectKey,
    StorageError,
    StorageNotConfigured,
    StoredObject,
    build_stem,
    get_provider,
    stem_of,
    validate_key,
)
from app.storage.images import InvalidImage

router = APIRouter()

#: MIME types a client may *declare*. Advisory only -- the decoded format is what
#: actually decides how the object is stored, so this list exists to give a
#: seller a clear early error rather than to be the security control.
ALLOWED_MIME_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
}

#: Read the body in chunks so an oversized upload is refused as it arrives
#: rather than after it has been buffered whole into memory.
_CHUNK_BYTES = 256 * 1024

#: A key a seller is allowed to write to: their own directory, one upload id.
_OWNED_KEY_RE = re.compile(r"^products/(?P<seller>[0-9a-fA-F-]{8,64})/(?P<stem>[0-9a-f]{8})$")


class PresignUploadBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mime_type: str = Field(..., description="Declared type: image/jpeg, image/png, image/webp, image/gif, image/avif")
    file_size: int = Field(..., ge=1, le=MAX_BYTES)
    file_name: str | None = None


class CompleteUploadBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    object_key: str = Field(..., description="The key returned by the upload ticket")


def _error(code: str, message: str, http_status: int, **details) -> HTTPException:
    return HTTPException(
        status_code=http_status,
        detail={"code": code, "message": message, "details": details or None},
    )


def _require_owned_key(object_key: str, user: dict) -> str:
    """
    Confirm a key names a directory the caller owns.

    ``validate_key`` proves a key is *well-formed* and cannot escape the media
    root. This proves it is *yours*. Without it, any authenticated seller could
    POST to ``/object`` with ``products/<someone-else>/deadbeef`` and write into
    another seller's directory -- and the presign ticket is not required, so the
    ownership check has to live here rather than being implied by having a ticket.
    """
    try:
        normalised = validate_key(stem_of(object_key))
    except InvalidObjectKey as exc:
        raise _error("INVALID_OBJECT_KEY", str(exc), 400) from exc

    match = _OWNED_KEY_RE.match(normalised)
    if not match:
        raise _error(
            "INVALID_OBJECT_KEY",
            "Object keys must look like products/{your_seller_id}/{{8 hex characters}}.",
            400,
        )
    if match.group("seller").lower() != str(user["id"]).lower():
        # 404 rather than 403: confirming another seller's id exists is itself
        # an enumeration oracle, and the caller learns nothing useful either way.
        raise _error("UPLOAD_NOT_FOUND", "No upload slot at that key.", 404)

    return normalised


@router.get("/config", status_code=200)
async def get_upload_config(
    _rl=Depends(rate_limit("uploads.config", *limit_for("uploads.config"))),
) -> dict[str, Any]:
    """
    Report what the configured provider can do.

    Unauthenticated on purpose: the public storefront needs the variant width list
    to build a ``srcSet`` that matches the widths the API actually wrote, and a
    srcSet of URLs that 404 is worse than no srcSet. Nothing sensitive is
    returned -- a provider name, a byte ceiling and a list of integers.
    """
    try:
        provider = get_provider()
        described = provider.describe()
    except StorageError as exc:
        raise _error("STORAGE_UNAVAILABLE", str(exc), 503) from exc

    widths = list(described.get("variant_widths") or [])
    return {
        "success": True,
        "data": {
            **described,
            "max_bytes": MAX_BYTES,
            "allowed_mime_types": sorted(ALLOWED_MIME_TYPES),
            # The widest rendition a client should ever ask for. A srcSet built
            # from the config endpoint can then never name a width the API did
            # not write, which is the failure that shows up as a broken image.
            "master_width": max(widths) if widths else None,
        },
    }


@router.post("/presign", status_code=200)
async def create_upload_ticket(
    request: Request,
    body: PresignUploadBody,
    user: dict = Depends(require_auth),
    _rl=Depends(rate_limit("uploads.presign", *limit_for("uploads.presign"))),
) -> dict[str, Any]:
    """
    Reserve a key and return a ticket describing where to send the bytes.

    The key is derived here from the authenticated seller, never from the
    request, so a client cannot choose where its bytes land. It is a *derivation*
    rather than a reservation, which means an abandoned presign costs nothing:
    no row is written, and there is no upload table to reconcile.
    """
    mime = body.mime_type.lower().strip()
    if mime not in ALLOWED_MIME_TYPES:
        raise _error(
            "INVALID_MIME_TYPE",
            f"MIME type '{body.mime_type}' is not accepted. Use one of: "
            + ", ".join(sorted(ALLOWED_MIME_TYPES)),
            400,
            allowed=sorted(ALLOWED_MIME_TYPES),
        )

    stem = build_stem(str(user["id"]), uuid.uuid4().hex[:8])
    try:
        provider = get_provider()
        ticket = provider.create_upload(
            object_key=f"{stem}.{ALLOWED_MIME_TYPES[mime]}",
            mime_type=mime,
            byte_size=body.file_size,
            api_base=str(request.base_url),
        )
    except StorageNotConfigured as exc:
        # The Razorpay rule, for the same reason: a ticket that cannot be used is
        # discovered by the seller after they choose the file, and surfaces as an
        # opaque CORS error with nothing in our logs.
        raise _error("STORAGE_NOT_CONFIGURED", str(exc), 503) from exc
    except InvalidObjectKey as exc:
        raise _error("INVALID_OBJECT_KEY", str(exc), 400) from exc
    except StorageError as exc:
        raise _error("STORAGE_ERROR", str(exc), 502) from exc

    return {
        "success": True,
        "data": {
            **ticket.to_dict(),
            "public_url": None,  # only knowable after the bytes land
            "mime_type": mime,
            "max_size_bytes": MAX_BYTES,
        },
    }


@router.post("/object", status_code=201)
async def upload_object(
    key: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(require_auth),
    _rl=Depends(rate_limit("uploads.object", *limit_for("uploads.object"))),
) -> dict[str, Any]:
    """
    Receive the bytes, validate them, and write the rendition ladder.

    Only the local provider accepts bytes here. With ``STORAGE_PROVIDER=s3`` the
    ticket's ``upload_url`` points at the bucket instead and this route is never
    called; answering 409 makes that explicit rather than letting a client
    discover it by shipping 5 MB to the wrong place.
    """
    provider = get_provider()
    if not hasattr(provider, "receive"):
        raise _error(
            "DIRECT_UPLOAD_REQUIRED",
            "This deployment uploads straight to object storage. Use the upload_url "
            "from your ticket instead of posting to /api/uploads/object.",
            409,
            provider=provider.name,
        )

    stem = _require_owned_key(key, user)

    declared = (file.content_type or "").lower().strip()
    if declared and declared not in ALLOWED_MIME_TYPES:
        raise _error(
            "INVALID_MIME_TYPE",
            f"MIME type '{declared}' is not accepted. Use one of: "
            + ", ".join(sorted(ALLOWED_MIME_TYPES)),
            400,
        )

    # Read in chunks and stop at the ceiling. A single `await file.read()` would
    # buffer whatever the client felt like sending.
    data = bytearray()
    while True:
        chunk = await file.read(_CHUNK_BYTES)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > MAX_BYTES:
            raise _error(
                "FILE_TOO_LARGE",
                f"Uploads are limited to {MAX_BYTES:,} bytes.",
                413,
                max_bytes=MAX_BYTES,
            )

    try:
        stored: StoredObject = provider.receive(stem, bytes(data))
    except InvalidImage as exc:
        # 415: the request is well-formed, the payload is not the media type the
        # route exists to accept. The message names the real reason.
        raise _error("INVALID_IMAGE", str(exc), 415) from exc
    except InvalidObjectKey as exc:
        raise _error("INVALID_OBJECT_KEY", str(exc), 400) from exc
    except StorageNotConfigured as exc:
        raise _error("STORAGE_NOT_CONFIGURED", str(exc), 503) from exc
    except StorageError as exc:
        raise _error("STORAGE_ERROR", str(exc), 502) from exc

    return {"success": True, "data": stored.to_dict()}


@router.post("/complete", status_code=200)
async def complete_upload(
    body: CompleteUploadBody,
    user: dict = Depends(require_auth),
    _rl=Depends(rate_limit("uploads.presign", *limit_for("uploads.presign"))),
) -> dict[str, Any]:
    """
    Resolve a completed upload to the URL worth persisting on a product.

    Separate from the upload itself so the S3 path is covered by the same client
    code: the browser PUTs to the bucket, then calls this to learn the public URL
    and confirm the object is really there.
    """
    stem = _require_owned_key(body.object_key, user)
    provider = get_provider()
    try:
        stored = provider.finalize(stem)
    except StorageNotConfigured as exc:
        raise _error("STORAGE_NOT_CONFIGURED", str(exc), 503) from exc
    except StorageError as exc:
        raise _error("UPLOAD_NOT_FOUND", str(exc), 404) from exc

    return {"success": True, "data": stored.to_dict()}


@router.delete("/object", status_code=200)
async def delete_object(
    object_key: str,
    user: dict = Depends(require_auth),
    _rl=Depends(rate_limit("uploads.delete", *limit_for("uploads.delete"))),
) -> dict[str, Any]:
    """Remove an object and every rendition generated from it."""
    stem = _require_owned_key(object_key, user)
    provider = get_provider()
    try:
        provider.delete(stem)
    except StorageNotConfigured as exc:
        raise _error("STORAGE_NOT_CONFIGURED", str(exc), 503) from exc
    except StorageError as exc:
        raise _error("STORAGE_ERROR", str(exc), 502) from exc
    return {"success": True, "data": {"object_key": stem, "deleted": True}}


# Retained for the tests and the old import site; the value now lives in one place.
MAX_FILE_SIZE_BYTES = MAX_BYTES
__all__ = [
    "ALLOWED_MIME_TYPES",
    "MAX_BYTES",
    "MAX_FILE_SIZE_BYTES",
    "router",
]
