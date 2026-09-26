"""
S3 media provider.

The browser PUTs bytes straight at the bucket with a presigned URL, so image
data never occupies the API process -- which matters as soon as a seller is
uploading a few hundred product photos.

Unconfigured, this provider raises :class:`StorageNotConfigured` and the router
answers ``503 STORAGE_NOT_CONFIGURED``. It does not return a URL that would 403
on use: a presigned URL the client cannot use is discovered by the seller *after*
they have chosen the file, and the failure surfaces as a CORS error in a
third-party's console with nothing in ours.

One honest limitation, documented rather than papered over: S3 does not resize
images. The browser sends whatever the seller picked, at whatever size, and the
CDN serves that exact object to a 360px phone and a 4K monitor alike. So
``generates_variants`` is False and the frontend falls back to a single
``src`` candidate. Getting a real variant ladder on this path means putting an
image CDN in front of the bucket (CloudFront + Lambda@Edge, imgix, Cloudinary)
and pointing ``S3_PUBLIC_BASE_URL`` at it; ``IMAGE_VARIANT_WIDTHS`` is then that
CDN's job, not this module's.
"""

from __future__ import annotations

from app.config import settings
from app.storage import (
    MAX_BYTES,
    StorageError,
    StorageNotConfigured,
    StoredObject,
    UploadTicket,
    stem_of,
    validate_key,
)
from app.storage.images import extension_for

# Presigned PUTs are single-use-ish by TTL, not by count. Fifteen minutes is long
# enough for a seller on a slow connection to finish a 5 MB upload and short
# enough that a leaked URL is not a standing write capability.
PRESIGN_TTL_SECONDS = 900

#: Exact values that are known fakes: the blanks, and the key pair AWS uses
#: throughout its own documentation. Matched whole rather than by substring,
#: because a real key id is arbitrary uppercase alphanumerics and *will*
#: sometimes contain a word like EXAMPLE.
_PLACEHOLDER_LITERALS = frozenset(
    {
        "",
        "   ",
        "none",
        "null",
        "todo",
        "tbd",
        "test",
        # The canonical AWS documentation credentials, from the IAM user guide.
        "akiaiosfodnn7example",
        "wjalrxutnfemi/k7mdeng/bpxrficyexamplekey",
    }
)

#: Substrings that cannot plausibly appear in a real credential. Deliberately
#: excludes the AKIA and ASIA prefixes: those are not placeholders, they are
#: what AWS issues -- every real access key id starts with one of them. Treating
#: them as fake made the provider refuse every legitimate credential while still
#: reporting itself configured, which is the exact failure the Razorpay
#: placeholder check exists to prevent, pointed the other way.
_PLACEHOLDER_MARKERS = (
    "placeholder",
    "changeme",
    "your-",
    "yourkey",
    "xxxx",
    "dummy",
    "fake",
)


def _is_placeholder(value: str | None) -> bool:
    """
    Treat obviously fake credentials as absent.

    A placeholder that "works" is worse than one that does not: it produces
    presigned URLs signed with a key nobody holds, the upload fails with an
    opaque CORS error, and the seller concludes the platform is broken. Same
    reasoning as the Razorpay keys.
    """
    if value is None:
        return True
    lowered = value.strip().lower()
    if lowered in _PLACEHOLDER_LITERALS:
        return True
    return any(marker in lowered for marker in _PLACEHOLDER_MARKERS)


class S3Provider:
    """Presigned direct-to-bucket uploads. Requires credentials."""

    name = "s3"

    def __init__(self) -> None:
        self.bucket = (settings.S3_BUCKET_NAME or "").strip()
        self.region = (settings.S3_REGION or "us-east-1").strip()
        self.endpoint = (settings.S3_ENDPOINT_URL or "").strip() or None
        self._client = None

    # -- capability -------------------------------------------------------
    @property
    def credentials_present(self) -> bool:
        return not (
            _is_placeholder(settings.S3_ACCESS_KEY_ID)
            or _is_placeholder(settings.S3_SECRET_ACCESS_KEY)
        ) and bool(self.bucket)

    @property
    def configured(self) -> bool:
        return self.credentials_present

    def describe(self) -> dict:
        return {
            "provider": self.name,
            "configured": self.configured,
            "direct_upload": True,
            # S3 has no image transforms of its own. See the module docstring.
            "generates_variants": False,
            "variant_widths": [],
            "public_base": self.public_base(),
        }

    def require_configured(self) -> None:
        if not self.configured:
            missing = []
            if not self.bucket:
                missing.append("S3_BUCKET_NAME")
            if _is_placeholder(settings.S3_ACCESS_KEY_ID):
                missing.append("S3_ACCESS_KEY_ID")
            if _is_placeholder(settings.S3_SECRET_ACCESS_KEY):
                missing.append("S3_SECRET_ACCESS_KEY")
            raise StorageNotConfigured(
                "S3 storage is selected but not usable. Set "
                + ", ".join(missing or ["the S3 credentials"])
                + ". Until then, set STORAGE_PROVIDER=local to accept uploads "
                "through the API instead."
            )

    # -- client -----------------------------------------------------------
    @property
    def client(self):
        """Lazily built boto3 client. Imported here so local-only runs skip it."""
        self.require_configured()
        if self._client is None:
            try:
                import boto3
                from botocore.config import Config
            except ImportError as exc:  # pragma: no cover - dependency is declared
                raise StorageNotConfigured(
                    "S3 storage is selected but boto3 is not installed. "
                    "Run: pip install boto3"
                ) from exc

            self._client = boto3.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint,
                aws_access_key_id=settings.S3_ACCESS_KEY_ID,
                aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
                config=Config(
                    signature_version="s3v4",
                    # Required by MinIO and most S3-compatible stores; harmless
                    # against real S3.
                    s3={"addressing_style": "path" if settings.S3_FORCE_PATH_STYLE else "auto"},
                ),
            )
        return self._client

    # -- urls -------------------------------------------------------------
    def public_base(self) -> str:
        base = (settings.S3_PUBLIC_BASE_URL or "").strip().rstrip("/")
        if base:
            return base
        if self.endpoint:
            return f"{self.endpoint.rstrip('/')}/{self.bucket}"
        return f"https://{self.bucket}.s3.{self.region}.amazonaws.com"

    def public_url(self, object_key: str) -> str:
        return f"{self.public_base()}/{object_key}"

    # -- write path -------------------------------------------------------
    def create_upload(
        self,
        *,
        object_key: str,
        mime_type: str,
        byte_size: int,
        api_base: str = "",
    ) -> UploadTicket:
        self.require_configured()
        if byte_size > MAX_BYTES:
            raise StorageError(f"Uploads are limited to {MAX_BYTES:,} bytes.")
        stem = stem_of(object_key)
        validate_key(f"{stem}.webp")

        # The extension on the key is derived from the *stored* encoding, not the
        # declared MIME type, so what the CDN serves always matches its suffix.
        ext = extension_for(mime_type) or "webp"
        key = f"{stem}.{ext}"

        params = {
            "Bucket": self.bucket,
            "Key": key,
            "ContentType": mime_type,
            # Bound so a seller cannot sign a 5 MB slot and then PUT 500 MB.
            "ContentLengthRange": (1, MAX_BYTES),
        }
        try:
            url = self.client.generate_presigned_url(
                "put_object", Params=params, ExpiresIn=PRESIGN_TTL_SECONDS
            )
        except Exception as exc:  # botocore raises a wide family of these
            raise StorageError(f"Could not sign an upload URL: {exc}") from exc

        return UploadTicket(
            upload_url=url,
            method="PUT",
            object_key=key,
            # Bound into the signature, so a client that changes them gets a 403
            # from S3 rather than a stored file with a content type nobody chose.
            headers={"Content-Type": mime_type},
            fields={},
            expires_in_seconds=PRESIGN_TTL_SECONDS,
        )

    # -- read path --------------------------------------------------------
    def finalize(self, object_key: str) -> StoredObject:
        """
        Describe a stored object.

        Dimensions are not decoded here. Doing so would mean pulling the object
        back through the API -- the exact thing a direct-to-S3 upload exists to
        avoid -- so ``width``/``height`` are None and the frontend falls back to
        a reserved aspect-ratio box, correcting it from ``naturalWidth`` once the
        image has loaded.
        """
        self.require_configured()
        validate_key(object_key)
        try:
            head = self.client.head_object(Bucket=self.bucket, Key=object_key)
        except Exception as exc:
            raise StorageError(
                f"No stored object at that key, or it is not readable: {exc}"
            ) from exc

        byte_size = int(head.get("ContentLength") or 0)
        if byte_size == 0:
            raise StorageError("The stored object is empty.")

        return StoredObject(
            object_key=object_key,
            public_url=self.public_url(object_key),
            mime_type=head.get("ContentType") or "application/octet-stream",
            byte_size=byte_size,
            width=None,
            height=None,
            variant_widths=[],
        )

    def delete(self, object_key: str) -> None:
        self.require_configured()
        validate_key(object_key)
        try:
            self.client.delete_object(Bucket=self.bucket, Key=object_key)
        except Exception as exc:
            raise StorageError(f"Could not delete that object: {exc}") from exc


def sweep_stale_uploads(*_args, **_kwargs) -> int:
    """
    No-op for S3.

    The local provider writes renditions through a temp file and a rename, so a
    process killed mid-write can leave one behind; a sweep in app/jobs.py clears
    them. S3 has no equivalent state: an upload that never completed simply left
    no object, and the bucket's own lifecycle rules are the right place to
    expire abandoned multipart parts.
    """
    return 0


__all__ = ["S3Provider", "PRESIGN_TTL_SECONDS", "sweep_stale_uploads"]
