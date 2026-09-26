"""
Image decoding, validation and re-encoding.

This module is the security boundary for every byte a seller uploads, and it is
provider-agnostic on purpose: the local provider and the S3 provider both run
uploaded bytes through exactly this code.

Two properties matter more than anything else here.

1. **Nothing user-supplied is ever served back as-is.** Every accepted upload is
   decoded and *re-encoded*. A file that merely claims to be an image is caught
   because Pillow has to actually parse it, and a file that parses is rewritten
   as WebP or PNG bytes. That closes the hole the old presign route left open: it
   trusted the client's `mime_type` and wrote to a key derived from it, so a
   seller could claim `image/jpeg`, upload an SVG (or an HTML document), and get
   a URL the app would then serve back under the site's own origin. SVG and HTML
   are not decodable as images, so they never get a key.

2. **The stored object is the master, and the variants are derivable from it.**
   Variants are named ``{uuid}@{width}w.webp`` beside the master, so the browser
   can construct a srcSet from one stored URL with no extra API call.

Uploads are also stripped of EXIF. Re-encoding without an ``exif=`` argument
drops it, which takes the GPS coordinates out of photos straight off a phone.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field

from PIL import Image, ImageOps, UnidentifiedImageError

# Pillow warns above this and hard-errors at 2x. We check the size ourselves
# after open() so the limit is a real limit, not a warning that scrolls by.
MAX_PIXELS = 50_000_000

# What we accept, mapped to the format name Pillow reports.
_ACCEPTED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "AVIF"}

# A 1x1 GIF is a valid image and a classic tracking-pixel / SSRF-confirmation
# payload. Refuse anything that is not plausibly a photograph or pack shot.
MIN_DIMENSION = 16


class InvalidImage(ValueError):
    """Uploaded bytes are not a decodable image."""


class ImageTooLarge(InvalidImage):
    """Decodable, but larger in pixel count than we will process."""


@dataclass
class DecodedImage:
    """A validated, orientation-corrected image ready to be re-encoded."""

    image: Image.Image
    source_format: str
    width: int
    height: int
    has_alpha: bool

    @property
    def aspect_ratio(self) -> float:
        return self.width / self.height if self.height else 1.0


@dataclass
class Variant:
    """One rendered rendition, as bytes, ready to be written somewhere."""

    width: int
    height: int
    content: bytes
    ext: str
    mime_type: str
    is_master: bool = False
    byte_size: int = field(default=0, init=False)

    def __post_init__(self) -> None:
        self.byte_size = len(self.content)

    @property
    def width_token(self) -> str:
        """The `@<w>w` fragment that makes this variant's name derivable."""
        return f"@{self.width}w"

    def filename(self, stem: str) -> str:
        """
        Filename for a variant under a given stem.

        The width lives in the name. That is the whole trick behind a srcSet that
        needs no manifest lookup: strip "@<w>w" and re-append any width.
        """
        return f"{stem}{self.width_token}.{self.ext}"


def open_image(data: bytes) -> DecodedImage:
    """
    Decode and validate uploaded bytes.

    Raises InvalidImage (or ImageTooLarge) for anything that is not a real image.
    """
    if not data:
        raise InvalidImage("The uploaded file is empty.")

    try:
        # A truncated or hostile file can make the decoder allocate wildly before
        # we ever look at the header, so the bomb guard has to be armed *before*
        # open(), not after.
        previous_limit = Image.MAX_IMAGE_PIXELS
        Image.MAX_IMAGE_PIXELS = MAX_PIXELS
        try:
            probe = Image.open(io.BytesIO(data))
            source_format = (probe.format or "").upper()
            width, height = probe.size
        finally:
            Image.MAX_IMAGE_PIXELS = previous_limit
    except UnidentifiedImageError as exc:
        raise InvalidImage(
            "That file is not a readable image. JPEG, PNG, WebP, GIF and AVIF are accepted."
        ) from exc
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageTooLarge(
            f"That image is too large to process (over {MAX_PIXELS:,} pixels)."
        ) from exc
    except OSError as exc:
        # Pillow raises bare OSError for truncated data and for a few container
        # formats it half-understands. Either way it is not a usable image.
        raise InvalidImage("That file could not be decoded as an image.") from exc

    if source_format not in _ACCEPTED_FORMATS:
        raise InvalidImage(
            f"Images in {source_format or 'that format'} are not accepted. "
            "Use JPEG, PNG, WebP, GIF or AVIF."
        )

    if width * height > MAX_PIXELS:
        raise ImageTooLarge(
            f"That image is {width * height:,} pixels, over the {MAX_PIXELS:,} limit."
        )
    if width < MIN_DIMENSION or height < MIN_DIMENSION:
        raise InvalidImage(
            f"That image is {width}x{height}. Images must be at least "
            f"{MIN_DIMENSION}x{MIN_DIMENSION} pixels."
        )

    # Fully decode now, so a zip bomb or a decompression-bomb-in-a-truncated-file
    # is caught here rather than mid-write. After load() the file handle is dead.
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        raise InvalidImage("That image data is incomplete or corrupt.") from exc

    # Phone cameras record orientation in EXIF rather than rotating the pixels.
    # Without this, every portrait photo from a phone uploads sideways.
    image = ImageOps.exif_transpose(image) or image

    # An animated GIF becomes its first frame: a WebP/AVIF still of a product
    # photo is what a catalogue wants, and a 40-frame GIF is a 40x size lie.
    if getattr(image, "n_frames", 1) > 1:
        image.seek(0)
        image = image.copy()

    has_alpha = image.mode in ("RGBA", "LA", "PA") or (
        image.mode == "P" and "transparency" in image.info
    )
    if has_alpha:
        image = image.convert("RGBA")
    else:
        # Flattens palette, CMYK and greyscale into something WebP can hold.
        image = image.convert("RGB")

    return DecodedImage(
        image=image,
        source_format=source_format,
        width=image.width,
        height=image.height,
        has_alpha=has_alpha,
    )


def render_variants(
    decoded: DecodedImage,
    widths: list[int],
    master_width: int,
    quality: int = 82,
) -> list[Variant]:
    """
    Produce the master plus one rendition per requested width.

    Widths are not upscaled -- asking for 800w from a 600px source returns
    nothing at 800w, because a stretched 800w is a worse 800w. The master is
    the source width when that is narrower than ``master_width``, so a small
    upload is never inflated.

    Alpha is kept as PNG. Re-encoding transparency to WebP is possible but
    lossy on the alpha channel, and a product photo with a chewed-up edge looks
    broken rather than slightly soft.
    """
    if not widths:
        raise ValueError("At least one variant width is required.")

    ordered = sorted({int(w) for w in widths if int(w) > 0})
    if master_width not in ordered:
        ordered.append(int(master_width))
        ordered.sort()

    ext = "png" if decoded.has_alpha else "webp"
    mime = "image/png" if decoded.has_alpha else "image/webp"

    # The master is the largest rendition we will actually produce, capped at
    # master_width. Upscaling a 300px upload to 1600px costs bytes and adds
    # nothing, so the master is the source width in that case.
    effective_master = min(master_width, decoded.width)
    targets: list[tuple[int, bool]] = [(w, w == effective_master) for w in ordered]
    targets.append((effective_master, True))
    # De-duplicate while preserving order, master flag wins.
    seen: dict[int, bool] = {}
    for width, is_master in targets:
        if width > decoded.width:
            continue
        seen[width] = seen.get(width, False) or is_master
    targets = [(w, m) for w, m in sorted(seen.items())]
    if not targets:
        # A source narrower than MIN_DIMENSION cannot happen (open_image
        # rejects it), but never return an empty list: the caller writes a file.
        targets = [(decoded.width, True)]

    variants: list[Variant] = []
    for width, is_master in targets:
        height = max(1, round(decoded.height * (width / decoded.width)))
        frame = decoded.image
        if width != decoded.width:
            frame = decoded.image.resize((width, height), Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        if decoded.has_alpha:
            frame.save(buffer, format="PNG", optimize=True)
        else:
            frame.save(buffer, format="WEBP", quality=quality, method=4)

        variants.append(
            Variant(
                width=width,
                height=height,
                content=buffer.getvalue(),
                ext=ext,
                mime_type=mime,
                is_master=is_master,
            )
        )
    return variants


def extension_for(mime_type: str) -> str | None:
    """Canonical extension for a client-declared MIME type, or None if refused."""
    return {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/avif": "avif",
    }.get(mime_type.lower().strip())


def extension_for_format(source_format: str, has_alpha: bool) -> str:
    """The extension the *stored* object gets, which follows re-encoding, not input."""
    if has_alpha:
        return "png"
    return {
        "JPEG": "jpg",
        "PNG": "png",
        "WEBP": "webp",
        "GIF": "jpg",
        "AVIF": "jpg",
    }.get(source_format.upper(), "webp")
