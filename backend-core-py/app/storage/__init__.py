"""
Media storage providers.

A provider is the thing that actually holds seller-uploaded bytes. The app talks
to this interface only, so choosing where bytes live is a deployment decision
(set ``STORAGE_PROVIDER``) rather than a code change.

Two real implementations ship:

``local``
    Writes to ``MEDIA_ROOT`` on the API host and serves the result from
    ``MEDIA_PUBLIC_BASE``. No credentials, no external service, and it generates
    the full WebP variant ladder itself. This is the only provider that can be
    exercised end to end today, and it is a legitimate production choice for a
    single-container self-host. It does not survive a redeploy that replaces the
    container filesystem without a volume, and it does not share across replicas
    -- both are deployment concerns, not code concerns, and both are why
    ``STORAGE_PROVIDER=s3`` exists.

``s3``
    Presigned PUT straight to the bucket, so image bytes never transit the API
    process. Needs credentials; until then it raises :class:`StorageNotConfigured`
    and the router answers 503 rather than returning a URL that would 403 on use.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.config import settings

MAX_BYTES = 5 * 1024 * 1024

# Extensions we are willing to enumerate as renditions. The static mount serves
# the whole media directory, so this filter is what stops an unrelated file that
# happens to sit in MEDIA_ROOT being reported as a variant.
RENDITION_SUFFIXES = (".webp", ".png", ".jpg", ".jpeg", ".avif")

# Object keys are generated here, but they also arrive as request parameters and
# become filesystem paths, so they are validated before use. This is a real
# allowlist, not a ".. not in key" substring test -- the substring test is
# bypassable and the failure mode is arbitrary file read.
#
# "@" is in the set because generated rendition keys carry an "@<width>w"
# marker. Leaving it out made every key this app writes unreadable by its own
# validator: the write path validated a widthless key and the read path then
# refused the width-suffixed one.
_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9._@-]*(?:/[a-z0-9][a-z0-9._@-]*)*$")
_WIDTH_SUFFIX_RE = re.compile(r"@(\d+)w$")


def validate_key(object_key: str) -> str:
    """Reject any object key that could escape the media root."""
    if not object_key or not isinstance(object_key, str):
        raise InvalidObjectKey("Invalid object key.")
    if len(object_key) > 400 or object_key != object_key.strip():
        raise InvalidObjectKey("Invalid object key.")
    if "\\" in object_key or "\x00" in object_key or object_key.startswith("/"):
        raise InvalidObjectKey("Invalid object key.")
    if not _KEY_RE.match(object_key):
        raise InvalidObjectKey("Invalid object key.")
    return object_key


def _leaf_and_stem(object_key: str) -> tuple[str, str]:
    """
    Split the last path segment into (leaf, leaf-without-extension).

    A bare stem such as ``products/s/abc123`` -- which is exactly what a client
    hands back after uploading, and what ``finalize`` is asked to resolve -- has
    no extension at all. ``rpartition(".")`` returns ("", "", "abc123") for that,
    so a naive split yields an empty stem and silently rewrites the key to point
    at the seller directory.
    """
    leaf = object_key.rsplit("/", 1)[-1]
    name, dot, _ext = leaf.rpartition(".")
    if not dot:
        name = leaf
    return leaf, name


def stem_of(object_key: str) -> str:
    """`products/{seller}/{uuid}@{w}w.webp` -> `products/{seller}/{uuid}`."""
    _leaf, name = _leaf_and_stem(object_key)
    name = _WIDTH_SUFFIX_RE.sub("", name)
    directory = object_key.rsplit("/", 1)[0] if "/" in object_key else ""
    return f"{directory}/{name}" if directory else name


def width_of(object_key: str) -> int | None:
    """The width encoded in a rendition's key, or None if it carries none."""
    _leaf, name = _leaf_and_stem(object_key)
    match = _WIDTH_SUFFIX_RE.search(name)
    return int(match.group(1)) if match else None


def build_stem(seller_id: str, upload_id: str) -> str:
    """Generate the key stem a seller's new upload is written under."""
    if not re.fullmatch(r"[0-9a-fA-F-]{8,64}", seller_id):
        raise InvalidObjectKey("Invalid seller id.")
    if not re.fullmatch(r"[0-9a-f]{8}", upload_id):
        raise InvalidObjectKey("Invalid upload id.")
    return f"products/{seller_id.lower()}/{upload_id}"


class StorageError(RuntimeError):
    """The provider could not complete the requested operation."""


class StorageNotConfigured(StorageError):
    """The selected provider has no credentials. The router maps this to 503."""


class InvalidObjectKey(StorageError):
    """A caller-supplied object key is not one we are willing to touch."""


@dataclass
class UploadTicket:
    """
    Where to send the bytes.

    Both providers hand back the same shape so the client has one upload path:
    read ``method``, ``headers`` and ``fields``, send ``content`` to
    ``upload_url``. The local provider uses a multipart POST to the API; S3 uses
    a presigned PUT with no body wrapper.
    """

    upload_url: str
    method: str
    object_key: str
    headers: dict[str, str] = field(default_factory=dict)
    fields: dict[str, str] = field(default_factory=dict)
    expires_in_seconds: int = 900

    def to_dict(self) -> dict:
        return {
            "upload_url": self.upload_url,
            "method": self.method,
            "object_key": self.object_key,
            "headers": self.headers,
            "fields": self.fields,
            "expires_in_seconds": self.expires_in_seconds,
        }


@dataclass
class StoredObject:
    """
    What actually landed in storage, after validation and re-encoding.

    ``width``/``height`` are the master's intrinsic pixel dimensions. They are
    what stops a product grid from reflowing as images arrive; the browser needs
    them as ``width``/``height`` attributes and an aspect-ratio box.
    """

    object_key: str
    public_url: str
    mime_type: str
    byte_size: int
    width: int | None = None
    height: int | None = None
    variant_widths: list[int] = field(default_factory=list)
    alt_base_url: str | None = None

    def to_dict(self) -> dict:
        return {
            "object_key": self.object_key,
            "public_url": self.public_url,
            "mime_type": self.mime_type,
            "byte_size": self.byte_size,
            "width": self.width,
            "height": self.height,
            "variant_widths": self.variant_widths,
        }


class StorageProvider:
    """Interface every provider implements."""

    name = "abstract"

    @property
    def configured(self) -> bool:
        raise NotImplementedError

    def create_upload(self, *, object_key: str, mime_type: str, byte_size: int) -> UploadTicket:
        raise NotImplementedError

    def finalize(self, object_key: str) -> StoredObject:
        raise NotImplementedError

    def delete(self, object_key: str) -> None:
        raise NotImplementedError

    def describe(self) -> dict:
        """Provider capabilities, surfaced by ``GET /api/uploads/config``."""
        raise NotImplementedError


def get_provider() -> StorageProvider:
    """
    Build the configured provider.

    Imported lazily so that a deployment which never touches media does not pay
    for boto3, and so an unknown provider name fails loudly at first use rather
    than at import time.
    """
    name = (settings.STORAGE_PROVIDER or "local").strip().lower()

    if name == "local":
        from app.storage.local import LocalProvider

        return LocalProvider()
    if name == "s3":
        from app.storage.s3 import S3Provider

        return S3Provider()
    raise StorageError(
        f"STORAGE_PROVIDER={name!r} is not a known provider. Use 'local' or 's3'."
    )


__all__ = [
    "InvalidObjectKey",
    "MAX_BYTES",
    "RENDITION_SUFFIXES",
    "StorageError",
    "StorageNotConfigured",
    "StorageProvider",
    "StoredObject",
    "UploadTicket",
    "build_stem",
    "get_provider",
    "stem_of",
    "validate_key",
    "width_of",
]
