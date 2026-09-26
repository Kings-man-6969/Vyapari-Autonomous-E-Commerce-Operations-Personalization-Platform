"""
Local disk media provider.

Bytes are received by the API, validated and re-encoded by
:mod:`app.storage.images`, and written under ``MEDIA_ROOT`` as a master plus one
rendition per configured width. ``main.py`` serves the directory from
``MEDIA_PUBLIC_BASE``.

Object key layout::

    products/{seller_id}/{uuid}@{width}w.webp

The width in the filename is load-bearing. The frontend can take the stored
``public_url`` and produce a correct ``srcSet`` for a phone, a laptop and a
retina desktop purely by rewriting the ``@{width}w`` token -- no manifest, no
extra API call, no per-image database row. That is what makes responsive media
achievable for uploads here without bolting on an image CDN.

The raw upload is never written to disk. Only re-encoded output is, so there is
no moment at which unvalidated bytes are reachable over HTTP.
"""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

from app.config import settings
from app.storage import (
    MAX_BYTES,
    RENDITION_SUFFIXES,
    InvalidObjectKey,
    StorageError,
    StoredObject,
    UploadTicket,
    stem_of,
    validate_key,
    width_of,
)
from app.storage.images import DecodedImage, InvalidImage, open_image, render_variants


def _dir_of(key: str) -> str:
    """Everything before the last slash, or "" when there is no slash."""
    return key.rsplit("/", 1)[0] if "/" in key else ""


def _leaf_of(key: str) -> str:
    """Everything after the last slash."""
    return key.rsplit("/", 1)[-1]


def _join(directory: str, name: str) -> str:
    return f"{directory}/{name}" if directory else name



class LocalProvider:
    """Files on the API host, served by FastAPI. The default provider."""

    name = "local"

    def __init__(self, root: str | None = None, public_base: str | None = None) -> None:
        self.root = Path(root or settings.MEDIA_ROOT).resolve()
        self.public_base = "/" + (public_base or settings.MEDIA_PUBLIC_BASE).strip("/")

    # -- capability -------------------------------------------------------
    @property
    def configured(self) -> bool:
        return True

    def describe(self) -> dict:
        return {
            "provider": self.name,
            "configured": True,
            # The browser has to POST the bytes to us; there is nowhere else to
            # put them. Clients branch on this rather than on the provider name.
            "direct_upload": False,
            "generates_variants": True,
            "variant_widths": list(settings.IMAGE_VARIANT_WIDTHS),
            "public_base": self.public_base,
        }

    # -- path handling ----------------------------------------------------
    def path_for(self, object_key: str) -> Path:
        validate_key(object_key)
        candidate = (self.root / object_key).resolve()
        # Belt and braces: with the regex above this cannot fail, but a
        # filesystem symlink inside MEDIA_ROOT could still point out of it.
        if candidate != self.root and self.root not in candidate.parents:
            raise InvalidObjectKey("Invalid object key.")
        return candidate

    def _directory_for(self, stem: str) -> Path:
        resolved = (self.root / _dir_of(stem)).resolve()
        if resolved != self.root and self.root not in resolved.parents:
            raise InvalidObjectKey("Invalid object key.")
        return resolved

    def public_url(self, object_key: str) -> str:
        return f"{self.public_base}/{object_key}"

    # -- write path -------------------------------------------------------
    def create_upload(
        self,
        *,
        object_key: str,
        mime_type: str,
        byte_size: int,
        api_base: str = "",
    ) -> UploadTicket:
        if byte_size > MAX_BYTES:
            raise InvalidImage(f"Uploads are limited to {MAX_BYTES:,} bytes.")
        # The client uploads against the bare stem, so it can never name a
        # rendition and overwrite a 400w with a full-size original.
        stem = stem_of(object_key)
        return UploadTicket(
            upload_url=f"{api_base.rstrip('/')}/api/uploads/object",
            method="POST",
            object_key=stem,
            fields={"key": stem},
            expires_in_seconds=900,
        )

    def receive(self, object_key: str, data: bytes) -> StoredObject:
        """Validate, re-encode, and write the master plus every rendition."""
        if not data:
            raise InvalidImage("The uploaded file is empty.")
        if len(data) > MAX_BYTES:
            raise InvalidImage(f"Uploads are limited to {MAX_BYTES:,} bytes.")

        decoded = open_image(data)
        stem = stem_of(object_key)
        validate_key(f"{stem}.webp")

        variants = render_variants(
            decoded,
            widths=list(settings.IMAGE_VARIANT_WIDTHS),
            master_width=int(settings.IMAGE_MASTER_WIDTH),
            quality=int(settings.IMAGE_WEBP_QUALITY),
        )
        directory = self._directory_for(stem)
        directory.mkdir(parents=True, exist_ok=True)
        leaf = _leaf_of(stem)
        directory_prefix = _dir_of(stem)

        written: list[str] = []
        master_key = ""
        master_width = 0
        master_height = 0
        master_bytes = 0
        master_mime = "image/webp"
        for variant in variants:
            filename = f"{leaf}{variant.width_token}.{variant.ext}"
            key = _join(directory_prefix, filename)
            target = directory / filename
            # Write under a pid-qualified temp name and rename into place, so a
            # concurrent GET can never observe a half-written rendition.
            tmp = directory / f".{filename}.{os.getpid()}.tmp"
            tmp.write_bytes(variant.content)
            os.replace(tmp, target)
            written.append(key)
            if variant.is_master:
                master_key = key
                master_width = variant.width
                master_height = variant.height
                master_bytes = variant.byte_size
                master_mime = variant.mime_type

        return StoredObject(
            object_key=master_key,
            public_url=self.public_url(master_key),
            mime_type=master_mime,
            byte_size=master_bytes,
            # The master's dimensions, not the source's. The aspect ratio is
            # identical -- renditions only ever shrink -- and these describe the
            # image the browser actually downloads, which is what the
            # width/height attributes need to be.
            width=master_width,
            height=master_height,
            variant_widths=sorted(w for w in (width_of(k) for k in written) if w),
        )

    # -- read path --------------------------------------------------------
    def finalize(self, object_key: str) -> StoredObject:
        """
        Resolve a completed upload to the rendition worth persisting.

        A client may hand back the bare stem it uploaded to, or a rendition key;
        both resolve to the master, because that is the URL a product row should
        hold and the one every other rendition is derivable from.
        """
        stem = stem_of(object_key)
        master = self._find_master(stem)
        if master is None:
            raise StorageError(
                "No stored image at that key. The upload may not have completed."
            )
        path = self.path_for(master)
        with Image.open(path) as probe:
            width, height = probe.size
        return StoredObject(
            object_key=master,
            public_url=self.public_url(master),
            mime_type="image/png" if path.suffix == ".png" else "image/webp",
            byte_size=path.stat().st_size,
            width=width,
            height=height,
            variant_widths=sorted(w for w in self._rendition_widths(stem) if w),
        )

    def _rendition_paths(self, stem: str) -> list[Path]:
        directory = self._directory_for(stem)
        if not directory.is_dir():
            return []
        leaf = _leaf_of(stem)
        return [
            p
            for p in directory.iterdir()
            if p.is_file()
            and p.suffix.lower() in RENDITION_SUFFIXES
            and p.name.startswith(f"{leaf}@")
        ]

    def _find_master(self, stem: str) -> str | None:
        paths = self._rendition_paths(stem)
        if not paths:
            return None
        # render_variants marks the widest rendition it produced as the master,
        # and every variant it writes carries a width, so widest == master.
        best = max(paths, key=lambda p: width_of(p.name) or 0)
        return _join(_dir_of(stem), best.name)

    def _rendition_widths(self, stem: str) -> list[int]:
        return [w for w in (width_of(p.name) for p in self._rendition_paths(stem)) if w]

    # -- delete -----------------------------------------------------------
    def delete(self, object_key: str) -> None:
        """Remove every rendition of an object. Best effort and idempotent."""
        stem = stem_of(object_key)
        leaf = _leaf_of(stem)
        for path in self._rendition_paths(stem):
            try:
                path.unlink()
            except OSError:
                pass
        # Sweep only *this object's* abandoned temp files. Globbing the whole
        # directory here would delete a concurrent upload of a different image
        # that happens to be mid-write.
        directory = self._directory_for(stem)
        if directory.is_dir():
            for leftover in directory.glob(f".{leaf}@*.tmp"):
                try:
                    leftover.unlink()
                except OSError:
                    pass


def sweep_temp_files(root: str) -> int:
    """Delete stray `.tmp` renditions under a media root. Returns the count."""
    removed = 0
    base = Path(root)
    if not base.is_dir():
        return 0
    for leftover in base.rglob(".*.tmp"):
        try:
            leftover.unlink()
            removed += 1
        except OSError:
            pass
    return removed


__all__ = ["LocalProvider", "MAX_BYTES", "sweep_temp_files"]
