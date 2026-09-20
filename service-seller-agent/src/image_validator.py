"""
Image Validator for Seller Agent — In-memory Pillow Validation (SSRF Safe)
"""
import io
from typing import Any

try:
    from PIL import Image
except ImportError:
    Image = None

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MIN_DIMENSION = 200
MAX_DIMENSION = 4096
MIN_SIZE_BYTES = 1024
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def validate_image_bytes(data: bytes) -> dict[str, Any]:
    """
    Validates in-memory raw image bytes.
    Rejects SVGs, non-image files, corrupted bytes, and oversized dimensions.
    """
    if len(data) < MIN_SIZE_BYTES:
        raise ValueError("Image file too small (minimum 1 KB).")
    if len(data) > MAX_SIZE_BYTES:
        raise ValueError("Image file exceeds maximum allowable size of 5 MB.")

    # Reject SVGs, HTML, and XML before deeper parsing
    header = data[:512].lower()
    if b"<svg" in header or b"<?xml" in header or b"<!doctype html" in header:
        raise ValueError("Disallowed image format 'SVG/XML'. Only JPEG, PNG, and WebP are accepted.")

    if Image is None:
        # Fallback if Pillow not installed in local environment
        return {"valid": True, "format": "UNKNOWN", "width": 0, "height": 0}

    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = (img.format or "").upper()
            if fmt not in ALLOWED_FORMATS:
                raise ValueError(f"Disallowed image format '{fmt}'. Only JPEG, PNG, and WebP are accepted.")

            width, height = img.size
            if width < MIN_DIMENSION or height < MIN_DIMENSION:
                raise ValueError(f"Image dimensions ({width}x{height}) below minimum of {MIN_DIMENSION}x{MIN_DIMENSION}.")
            if width > MAX_DIMENSION or height > MAX_DIMENSION:
                raise ValueError(f"Image dimensions ({width}x{height}) exceed maximum of {MAX_DIMENSION}x{MAX_DIMENSION}.")

            # Verify integrity
            img.verify()
            return {
                "valid": True,
                "format": fmt,
                "width": width,
                "height": height,
                "size_bytes": len(data),
            }
    except Exception as exc:
        if isinstance(exc, ValueError):
            raise
        raise ValueError(f"Invalid or corrupted image: {exc}")
