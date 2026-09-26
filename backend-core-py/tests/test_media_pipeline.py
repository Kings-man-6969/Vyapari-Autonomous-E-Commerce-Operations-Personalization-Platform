"""
The media pipeline: validation, the rendition ladder, and the upload routes.

Organised by what would cost something, not by endpoint:

    a file that is not an image never gets a URL
    a key that is not yours cannot be written, even with a valid token
    a key cannot escape the media root
    every width the API advertises is really on disk at that width
    an unconfigured provider refuses instead of fabricating

That last group is the one that bites hardest in production. A srcSet naming a
width that was never written is a broken image on every retina display, and
nothing in development shows it, because development is usually a 1x browser
that happily takes the master.

The route tests need no database: `require_auth` verifies the JWT and reads no
user row, so the whole HTTP surface runs without TEST_DATABASE_URL.

    python -m unittest tests.test_media_pipeline -v
"""
from __future__ import annotations

import io
import os
import shutil
import struct
import tempfile
import unittest
import warnings
import zlib

import httpx
from jose import jwt
from PIL import Image
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles
from starlette.responses import Response

from app.config import settings
from app.main import ImmutableStaticFiles
from app.storage import (
    InvalidObjectKey,
    StorageNotConfigured,
    build_stem,
    stem_of,
    validate_key,
    width_of,
)
from app.storage.images import (
    ImageTooLarge,
    InvalidImage,
    extension_for_format,
    open_image,
    render_variants,
)
from app.storage.local import LocalProvider
from app.storage.s3 import S3Provider, _is_placeholder

SELLER_A = "3df45099-3966-51bd-b5c7-a36f1fc75bf7"
SELLER_B = "5d66f426-fcf8-53f8-9322-c34a54f0c9ef"


# ── fixtures ──────────────────────────────────────────────────────────────────

def png_bytes(width: int, height: int, mode: str = "RGB", color=(200, 30, 30)) -> bytes:
    buffer = io.BytesIO()
    Image.new(mode, (width, height), color).save(buffer, format="PNG")
    return buffer.getvalue()


def jpeg_bytes(width: int, height: int) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (12, 90, 170)).save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def exif_rotated_jpeg(width: int, height: int, orientation: int = 6) -> bytes:
    """A JPEG whose EXIF says 'rotate 90', so the pixels are stored landscape."""
    buffer = io.BytesIO()
    image = Image.new("RGB", (width, height), (200, 200, 40))
    exif = image.getexif()
    exif[0x0112] = orientation
    image.save(buffer, format="JPEG", quality=90, exif=exif)
    return buffer.getvalue()


def png_claiming_size(width: int, height: int) -> bytes:
    """
    A structurally valid PNG whose header claims a huge canvas.

    Built by hand because the attack *is* the header: a few hundred bytes make
    a decoder that trusts the IHDR allocate a gigabyte. Producing this with PIL
    would mean allocating the very buffer the test is about.
    """

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b""))
        + chunk(b"IEND", b"")
    )


def auth_header(user_id: str, role: str = "seller", email: str = "seller@example.com") -> dict:
    token = jwt.encode(
        {"id": str(user_id), "email": email, "role": role, "name": "T", "exp": 9999999999},
        settings.JWT_ACCESS_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


# ── key handling ──────────────────────────────────────────────────────────────

class KeyHandlingTests(unittest.TestCase):
    """Object keys become filesystem paths, so this allowlist is load-bearing."""

    def test_build_stem_is_scoped_to_the_seller(self):
        self.assertEqual(build_stem(SELLER_A, "a1b2c3d4"), f"products/{SELLER_A}/a1b2c3d4")

    def test_build_stem_rejects_a_non_uuid_seller(self):
        for bad in ["../etc", "seller", "'; DROP TABLE users; --", "", "a/b"]:
            with self.subTest(bad):
                with self.assertRaises(InvalidObjectKey):
                    build_stem(bad, "a1b2c3d4")

    def test_build_stem_rejects_a_non_hex_upload_id(self):
        for bad in ["../../x", "ABCD", "a1b2c3", "a1b2c3d4e5", "a1b2c3d/"]:
            with self.subTest(bad):
                with self.assertRaises(InvalidObjectKey):
                    build_stem(SELLER_A, bad)

    def test_traversal_is_rejected(self):
        for bad in [
            "../etc/passwd",
            "/etc/passwd",
            "products/../../../etc/passwd",
            "products/s/../../../root/.ssh/id_rsa",
            "a/../../b",
            "..",
        ]:
            with self.subTest(bad):
                with self.assertRaises(InvalidObjectKey):
                    validate_key(bad)

    def test_separators_and_control_characters_are_rejected(self):
        for bad in ["a\\b", "a//b", "a/./b", "a/b\x00c", " a", "a ", "a b", "a|b", "a*b", "a;b"]:
            with self.subTest(bad):
                with self.assertRaises(InvalidObjectKey):
                    validate_key(bad)

    def test_generated_keys_validate(self):
        """
        Regression. The '@<width>w' marker was missing from the allowlist, so
        every *write* succeeded -- the write path validated a widthless key --
        and every subsequent *read* raised INVALID_OBJECT_KEY, because the
        rendition key on disk held a character the validator rejected. Uploads
        appeared to work and produced images nothing could display.
        """
        for key in [
            "products/s/a1b2c3d4",
            "products/s/a1b2c3d4.webp",
            "products/s/a1b2c3d4@1600w.webp",
            f"products/{SELLER_A}/a1b2c3d4@200w.webp",
        ]:
            with self.subTest(key):
                self.assertEqual(validate_key(key), key)

    def test_stem_and_width_round_trip(self):
        self.assertEqual(stem_of("products/s/abc@800w.webp"), "products/s/abc")
        self.assertEqual(width_of("products/s/abc@800w.webp"), 800)
        self.assertEqual(stem_of("products/s/abc.png"), "products/s/abc")
        self.assertIsNone(width_of("products/s/abc.png"))

    def test_stem_of_an_extensionless_key_keeps_its_leaf(self):
        """
        Regression. A client hands back the bare stem it uploaded to, and that
        has no extension. rpartition('.') on 'products/s/abc123' returns
        ('', '', 'abc123'), so the naive split produced the *seller directory*
        as the stem -- and finalize then reported another seller's directory as
        the uploaded object.
        """
        self.assertEqual(stem_of("products/s/abc123"), "products/s/abc123")
        self.assertEqual(stem_of(f"products/{SELLER_A}/abc123"), f"products/{SELLER_A}/abc123")


# ── image validation ──────────────────────────────────────────────────────────

class ImageValidationTests(unittest.TestCase):
    def test_non_images_are_rejected(self):
        cases = {
            "svg with a script tag": b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            "html": b"<!DOCTYPE html><html><body>hello</body></html>",
            "php": b"<?php system($_GET[0]); ?>",
            "shell script": b"#!/bin/sh\nrm -rf /\n",
            "zip renamed as jpeg": b"PK\x03\x04" + b"\x00" * 200,
            "pdf": b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n",
            "elf binary": b"\x7fELF\x02\x01\x01\x00" + b"\x00" * 64,
            "empty": b"",
        }
        for label, data in cases.items():
            with self.subTest(label):
                with self.assertRaises(InvalidImage):
                    open_image(data)

    def test_truncated_image_is_rejected(self):
        with self.assertRaises(InvalidImage):
            open_image(png_bytes(64, 64)[:80])

    def test_pillow_bomb_limit_is_armed(self):
        """2x MAX: Pillow's own hard error, before any allocation happens."""
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with self.assertRaises((InvalidImage, ImageTooLarge)):
                open_image(png_claiming_size(40000, 40000))

    def test_our_own_pixel_ceiling_is_enforced(self):
        """
        Between Pillow's warn threshold and its error threshold Pillow only
        *warns*, so the explicit size check in open_image is the only thing
        standing between a 25000x25000 header and a 2.5 GB allocation.
        """
        side = 25000  # 625 megapixels: over our 50 MP ceiling, under Pillow's 2x
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with self.assertRaises(ImageTooLarge):
                open_image(png_claiming_size(side, side))

    def test_tiny_images_are_rejected(self):
        """A 1x1 GIF is a tracking pixel, not a product photo."""
        with self.assertRaises(InvalidImage):
            open_image(png_bytes(8, 8))

    def test_exif_orientation_is_applied(self):
        """Phone photos store orientation in EXIF, not in the pixels."""
        decoded = open_image(exif_rotated_jpeg(400, 200, orientation=6))
        self.assertEqual((decoded.width, decoded.height), (200, 400))

    def test_exif_is_stripped(self):
        """Re-encoding drops EXIF, taking GPS coordinates with it."""
        variants = render_variants(open_image(exif_rotated_jpeg(300, 300)), [300], 300)
        with Image.open(io.BytesIO(variants[0].content)) as out:
            self.assertFalse(dict(out.getexif()))

    def test_animated_gif_collapses_to_one_frame(self):
        frames = [Image.new("RGB", (100, 100), (i * 40, 0, 0)) for i in range(6)]
        buffer = io.BytesIO()
        frames[0].save(buffer, format="GIF", save_all=True, append_images=frames[1:])
        rendered = render_variants(open_image(buffer.getvalue()), [100], 100)
        self.assertEqual(len(rendered), 1)


# ── rendition ladder ──────────────────────────────────────────────────────────

class RenditionTests(unittest.TestCase):
    def test_every_width_is_written_at_the_advertised_size(self):
        decoded = open_image(jpeg_bytes(3000, 2000))
        variants = render_variants(decoded, [200, 400, 800, 1200, 1600], 1600)
        self.assertEqual([v.width for v in variants], [200, 400, 800, 1200, 1600])
        for variant in variants:
            with self.subTest(width=variant.width):
                with Image.open(io.BytesIO(variant.content)) as img:
                    self.assertEqual(img.size[0], variant.width)
                    self.assertAlmostEqual(img.size[0] / img.size[1], 3000 / 2000, delta=0.01)

    def test_byte_size_falls_as_width_falls(self):
        """
        If this does not hold, the ladder is wasting the seller's bandwidth and
        the small renditions exist for nothing.
        """
        variants = render_variants(open_image(jpeg_bytes(3000, 2000)), [200, 400, 800, 1600], 1600)
        widths = [v.width for v in variants]
        sizes = [v.byte_size for v in variants]
        self.assertEqual(widths, sorted(widths), "widths should ascend")
        self.assertEqual(sizes, sorted(sizes), f"bytes should ascend with width: {sizes}")
        # And the ladder is actually worth having.
        self.assertLess(sizes[0] * 4, sizes[-1])

    def test_small_sources_are_never_upscaled(self):
        decoded = open_image(png_bytes(300, 300))
        variants = render_variants(decoded, [200, 400, 800, 1200, 1600], 1600)
        self.assertEqual([v.width for v in variants], [200, 300])
        self.assertTrue(any(v.is_master and v.width == 300 for v in variants))

    def test_alpha_is_kept_as_png(self):
        """A logo on transparency must not come back with a flattened edge."""
        variants = render_variants(open_image(png_bytes(600, 600, mode="RGBA")), [200, 400, 600], 600)
        self.assertTrue(all(v.ext == "png" for v in variants))
        self.assertTrue(all(v.mime_type == "image/png" for v in variants))

    def test_opaque_sources_become_webp(self):
        variants = render_variants(open_image(jpeg_bytes(800, 800)), [400, 800], 800)
        self.assertTrue(all(v.ext == "webp" for v in variants))

    def test_extension_follows_the_stored_encoding(self):
        """The stored extension describes what was written, not what was sent."""
        self.assertEqual(extension_for_format("JPEG", has_alpha=False), "jpg")
        self.assertEqual(extension_for_format("PNG", has_alpha=True), "png")
        self.assertEqual(extension_for_format("GIF", has_alpha=False), "jpg")


# ── local provider ────────────────────────────────────────────────────────────

class LocalProviderTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="vyapari-media-test-")
        self.provider = LocalProvider(root=self.root, public_base="/media")
        self.directory = os.path.join(self.root, "products", SELLER_A)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_receive_writes_the_whole_ladder(self):
        stored = self.provider.receive(build_stem(SELLER_A, "a1b2c3d4"), jpeg_bytes(3000, 2000))

        self.assertEqual(stored.variant_widths, [200, 400, 800, 1200, 1600])
        self.assertEqual((stored.width, stored.height), (1600, 1067))
        self.assertEqual(stored.mime_type, "image/webp")
        self.assertIn("@1600w.webp", stored.public_url)

        on_disk = sorted(os.listdir(self.directory))
        self.assertEqual(len(on_disk), 5, on_disk)
        # A half-written file is never visible under a real name.
        self.assertFalse([n for n in on_disk if n.endswith(".tmp")], on_disk)
        self.assertFalse([n for n in on_disk if not n.startswith("a1b2c3d4@")], on_disk)

    def test_advertised_variants_are_really_fetchable(self):
        """
        The point of the '@<w>w' convention: a client builds a srcSet from one
        stored URL by rewriting that token. If an advertised variant is not on
        disk, every product image is broken on a retina display and nothing in
        development notices.
        """
        stored = self.provider.receive(build_stem(SELLER_A, "deadbeef"), jpeg_bytes(3000, 2000))
        for width in stored.variant_widths:
            relative = stored.public_url.replace("@1600w", f"@{width}w").removeprefix("/media/")
            with self.subTest(width=width):
                path = os.path.join(self.root, relative)
                self.assertTrue(os.path.isfile(path), relative)
                with Image.open(path) as img:
                    self.assertEqual(img.size[0], width)

    def test_master_is_the_widest_rendition(self):
        self.provider.receive(build_stem(SELLER_A, "cafebabe"), jpeg_bytes(2400, 1200))
        self.assertEqual(self.provider.finalize(build_stem(SELLER_A, "cafebabe")).width, 1600)

    def test_finalize_is_idempotent_from_either_key_shape(self):
        stem = build_stem(SELLER_A, "0badf00d")
        stored = self.provider.receive(stem, jpeg_bytes(1200, 1200))
        from_stem = self.provider.finalize(stem)
        from_rendition = self.provider.finalize(stored.object_key)
        self.assertEqual(from_stem.object_key, from_rendition.object_key)
        self.assertEqual(from_stem.public_url, from_rendition.public_url)

    def test_finalize_reports_a_missing_upload_rather_than_inventing_one(self):
        from app.storage import StorageError

        with self.assertRaises(StorageError):
            self.provider.finalize(build_stem(SELLER_A, "99999999"))

    def test_delete_removes_every_rendition_and_is_idempotent(self):
        stem = build_stem(SELLER_A, "1234abcd")
        self.provider.receive(stem, jpeg_bytes(1200, 1200))
        self.provider.delete(stem)
        self.assertEqual(os.listdir(self.directory), [])
        self.provider.delete(stem)  # no raise

    def test_delete_leaves_a_neighbouring_upload_alone(self):
        """
        Two uploads in one seller directory. Deleting one must not take the
        other's files -- including an in-flight temp file, which is exactly what
        a directory-wide '.*.tmp' sweep does.
        """
        self.provider.receive(build_stem(SELLER_A, "aaaaaaaa"), jpeg_bytes(800, 800))
        self.provider.receive(build_stem(SELLER_A, "bbbbbbbb"), jpeg_bytes(800, 800))
        in_flight = os.path.join(self.directory, ".bbbbbbbb@800w.webp.999.tmp")
        with open(in_flight, "wb") as handle:
            handle.write(b"partial")

        self.provider.delete(build_stem(SELLER_A, "aaaaaaaa"))

        remaining = sorted(os.listdir(self.directory))
        self.assertTrue([n for n in remaining if n.startswith("bbbbbbbb@")], remaining)
        self.assertTrue(os.path.isfile(in_flight), "delete swept a concurrent upload's temp file")

    def test_writes_never_land_in_another_sellers_directory(self):
        self.provider.receive(build_stem(SELLER_A, "11111111"), jpeg_bytes(600, 600))
        self.assertFalse(os.path.isdir(os.path.join(self.root, "products", SELLER_B)))


# ── serving ───────────────────────────────────────────────────────────────────

class MediaServingTests(unittest.TestCase):
    """The immutable-cache wrapper, exercised over real HTTP."""

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="vyapari-media-serve-")
        self.provider = LocalProvider(root=self.root, public_base="/media")
        self.stored = self.provider.receive(build_stem(SELLER_A, "abcabcab"), jpeg_bytes(2400, 1200))
        self.app = Starlette(
            routes=[Mount("/media", ImmutableStaticFiles(directory=self.root, check_dir=False))]
        )
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app, raise_app_exceptions=False),
            base_url="http://testserver",
        )

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_a_master_rendition_is_served_with_immutable_caching(self):
        import asyncio

        async def run():
            path = self.stored.public_url.removeprefix("/media/")
            response = await self.client.get(f"/media/{path}")
            self.assertEqual(response.status_code, 200)
            # These URLs are keyed by a uuid chosen at upload time and never
            # rewritten, so a year-long cache can never be wrong. Without this
            # the browser revalidates every product image on every page view.
            self.assertEqual(
                response.headers.get("cache-control"), "public, max-age=31536000, immutable"
            )
            self.assertGreater(len(response.content), 0)

        asyncio.run(run())

    def test_every_advertised_variant_is_fetchable_over_http(self):
        """End of the srcSet promise: the URLs a browser will ask for, served."""
        import asyncio

        async def run():
            for width in self.stored.variant_widths:
                url = self.stored.public_url.replace("@1600w", f"@{width}w")
                with self.subTest(width=width):
                    response = await self.client.get(url)
                    self.assertEqual(response.status_code, 200)
                    with Image.open(io.BytesIO(response.content)) as img:
                        self.assertEqual(img.size[0], width)

        asyncio.run(run())

    def test_a_missing_object_is_404_not_500(self):
        import asyncio

        async def run():
            response = await self.client.get("/media/products/nobody/00000000@800w.webp")
            self.assertEqual(response.status_code, 404)

        asyncio.run(run())


# ── s3 provider without credentials ───────────────────────────────────────────

class S3ProviderTests(unittest.TestCase):
    def test_documentation_credentials_count_as_absent(self):
        for value in ["", "   ", None, "placeholder", "your-key-here", "changeme",
                      "AKIAXXXXXXXXXXXXXXXX", "test", "TODO", "dummy-key", "AKIAfake0000000000"]:
            with self.subTest(value):
                self.assertTrue(_is_placeholder(value))

    def test_real_aws_key_prefixes_are_accepted(self):
        """
        Regression, and an important one. The placeholder check originally
        listed AKIA and ASIA as fake-credential prefixes. Those are not
        placeholders -- they are what AWS issues -- so the provider would have
        refused every legitimate credential while reporting itself configured.
        A prod deployment would have looked fine and never uploaded anything.
        """
        for value in ["AKIA2E0ABCD7XY9QZ", "ASIAY34FZKBOKMUTVV7A", "AKIAIOSFODNN7REALKY1"]:
            with self.subTest(value):
                self.assertFalse(_is_placeholder(value))

    def test_aws_documentation_keys_are_still_caught(self):
        """The other half: the copy-paste-from-the-docs case must still fail."""
        self.assertTrue(_is_placeholder("AKIAIOSFODNN7EXAMPLE"))
        self.assertTrue(_is_placeholder("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"))
        # And a real key that merely happens to contain a dictionary-ish word
        # is not collateral damage.
        self.assertFalse(_is_placeholder("AKIA2EXAMPLE0ABCD9999"))

    def test_unconfigured_provider_refuses_rather_than_fabricating(self):
        """
        The Razorpay rule, for the same reason. A URL signed with credentials
        nobody holds fails at the seller's browser, as an opaque CORS error,
        after they have chosen a file -- and leaves nothing in our logs.
        """
        provider = S3Provider()
        if provider.configured:
            self.skipTest("real S3 credentials are configured in this environment")
        with self.assertRaises(StorageNotConfigured) as caught:
            provider.create_upload(
                object_key=f"products/{SELLER_A}/a1b2c3d4.jpg",
                mime_type="image/jpeg",
                byte_size=1024,
            )
        message = str(caught.exception)
        self.assertIn("S3", message)
        self.assertIn("STORAGE_PROVIDER=local", message)

    def test_describe_admits_it_cannot_resize(self):
        described = S3Provider().describe()
        self.assertFalse(described["generates_variants"])
        self.assertEqual(described["variant_widths"], [])


# ── HTTP routes ───────────────────────────────────────────────────────────────

class UploadRouteTests(unittest.IsolatedAsyncioTestCase):
    """
    No database: require_auth verifies the JWT and reads no user row, so the
    whole upload surface runs without TEST_DATABASE_URL.

    The media files are checked on disk rather than over HTTP, because the
    /media StaticFiles mount is bound to MEDIA_ROOT at import time and this
    class repoints that setting per-test. MediaServingTests covers the mount.
    """

    async def asyncSetUp(self):
        self.root = tempfile.mkdtemp(prefix="vyapari-media-routes-")
        self._previous = (
            settings.STORAGE_PROVIDER,
            settings.MEDIA_ROOT,
            settings.MEDIA_PUBLIC_BASE,
        )
        settings.STORAGE_PROVIDER = "local"
        settings.MEDIA_ROOT = self.root
        settings.MEDIA_PUBLIC_BASE = "/media"

        from app.main import app

        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        )
        self.seller = auth_header(SELLER_A)
        self.other = auth_header(SELLER_B, email="other@example.com")

    async def asyncTearDown(self):
        await self.client.aclose()
        (
            settings.STORAGE_PROVIDER,
            settings.MEDIA_ROOT,
            settings.MEDIA_PUBLIC_BASE,
        ) = self._previous
        shutil.rmtree(self.root, ignore_errors=True)

    def seller_dir(self, seller_id: str = SELLER_A) -> str:
        return os.path.join(self.root, "products", seller_id)

    def seller_files(self, seller_id: str = SELLER_A) -> list[str]:
        """Names in the seller's directory, tolerating a directory that is absent.

        A refused upload correctly creates nothing, so 'nothing was written' has
        to be assertable without the directory existing.
        """
        directory = self.seller_dir(seller_id)
        return sorted(os.listdir(directory)) if os.path.isdir(directory) else []

    # -- config -----------------------------------------------------------

    async def test_config_reports_the_rendition_widths(self):
        response = await self.client.get("/api/uploads/config")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["provider"], "local")
        self.assertTrue(data["configured"])
        self.assertTrue(data["generates_variants"])
        self.assertEqual(data["variant_widths"], list(settings.IMAGE_VARIANT_WIDTHS))
        self.assertEqual(data["master_width"], max(settings.IMAGE_VARIANT_WIDTHS))
        self.assertEqual(data["max_bytes"], 5 * 1024 * 1024)
        self.assertIn("image/jpeg", data["allowed_mime_types"])

    async def test_config_needs_no_authentication(self):
        """The public storefront reads this to build srcSets that resolve."""
        response = await self.client.get("/api/uploads/config")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"]["variant_widths"])

    # -- presign ----------------------------------------------------------

    async def test_presign_scopes_the_key_to_the_caller(self):
        response = await self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/jpeg", "file_size": 200_000},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 200)
        ticket = response.json()["data"]
        self.assertTrue(ticket["object_key"].startswith(f"products/{SELLER_A}/"), ticket)
        self.assertEqual(ticket["method"], "POST")
        self.assertTrue(ticket["upload_url"].endswith("/api/uploads/object"))
        # Nothing is promised about where the image will live until it exists.
        self.assertIsNone(ticket["public_url"])

    async def test_presign_rejects_a_non_image_mime(self):
        response = await self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/svg+xml", "file_size": 2048},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "INVALID_MIME_TYPE")

    async def test_presign_rejects_an_oversized_declaration(self):
        # 400, not FastAPI's default 422: main.py's RequestValidationError
        # handler normalises every schema failure to VALIDATION_ERROR/400.
        response = await self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/png", "file_size": 10 * 1024 * 1024},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")

    async def test_presign_rejects_a_zero_size_declaration(self):
        response = await self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/png", "file_size": 0},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 400)

    async def test_presign_rejects_unknown_fields(self):
        response = await self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/png", "file_size": 4096, "bucket": "someone-elses"},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 400)

    async def test_presign_requires_authentication(self):
        response = await self.client.post(
            "/api/uploads/presign", json={"mime_type": "image/jpeg", "file_size": 2048}
        )
        self.assertEqual(response.status_code, 401)

    async def test_presign_leaves_nothing_behind_when_abandoned(self):
        """
        The key is derived, not reserved, so a seller who takes a ticket and
        never uploads costs one hash and no row. There is no upload table to
        reconcile and no orphaned-slot cleanup job.
        """
        for _ in range(3):
            response = await self.client.post(
                "/api/uploads/presign",
                json={"mime_type": "image/png", "file_size": 4096},
                headers=self.seller,
            )
            self.assertEqual(response.status_code, 200)
        self.assertEqual(self.seller_files(), [])

    # -- upload -----------------------------------------------------------

    async def test_full_round_trip(self):
        payload = jpeg_bytes(1200, 900)
        ticket = (await self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/jpeg", "file_size": len(payload)},
            headers=self.seller,
        )).json()["data"]

        upload = await self.client.post(
            ticket["upload_url"],
            data={"key": ticket["object_key"]},
            files={"file": ("photo.jpg", payload, "image/jpeg")},
            headers=self.seller,
        )
        self.assertEqual(upload.status_code, 201, upload.text)
        stored = upload.json()["data"]
        self.assertEqual((stored["width"], stored["height"]), (1200, 900))
        self.assertEqual(stored["mime_type"], "image/webp")
        self.assertEqual(stored["variant_widths"], [200, 400, 800, 1200])

        complete = await self.client.post(
            "/api/uploads/complete",
            json={"object_key": ticket["object_key"]},
            headers=self.seller,
        )
        self.assertEqual(complete.status_code, 200)
        self.assertEqual(complete.json()["data"]["public_url"], stored["public_url"])

    async def test_svg_declared_as_jpeg_is_refused(self):
        """
        The hole the old presign route had. It derived the key extension from
        the client's declared mime_type and never looked at the bytes, so a
        seller could claim image/jpeg, upload an SVG carrying a script tag, and
        be handed a URL served from the app's own origin.
        """
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>'
        response = await self.client.post(
            "/api/uploads/object",
            data={"key": build_stem(SELLER_A, "aabbccdd")},
            files={"file": ("evil.jpg", svg, "image/jpeg")},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 415, response.text)
        self.assertEqual(response.json()["error"]["code"], "INVALID_IMAGE")
        self.assertEqual([n for n in self.seller_files() if n.startswith("aabbccdd")], [])

    async def test_html_declared_as_png_is_refused(self):
        response = await self.client.post(
            "/api/uploads/object",
            data={"key": build_stem(SELLER_A, "aabbccde")},
            files={"file": ("evil.png", b"<html><script>alert(1)</script></html>", "image/png")},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 415)

    async def test_oversized_body_is_refused_with_413(self):
        response = await self.client.post(
            "/api/uploads/object",
            data={"key": build_stem(SELLER_A, "bbbbbbbb")},
            files={
                "file": (
                    "big.jpg",
                    b"\xff\xd8\xff\xe0" + b"\x00" * (5 * 1024 * 1024 + 4096),
                    "image/jpeg",
                )
            },
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 413, response.text)
        self.assertEqual(response.json()["error"]["code"], "FILE_TOO_LARGE")

    async def test_upload_requires_authentication(self):
        response = await self.client.post(
            "/api/uploads/object",
            data={"key": build_stem(SELLER_A, "cccccccc")},
            files={"file": ("photo.jpg", jpeg_bytes(600, 600), "image/jpeg")},
        )
        self.assertEqual(response.status_code, 401)

    # -- ownership --------------------------------------------------------

    async def test_cannot_upload_into_another_sellers_directory(self):
        """
        The ownership check. A presign ticket is not required to post to
        /object, so the check has to live on the write path rather than being
        implied by holding a ticket.
        """
        response = await self.client.post(
            "/api/uploads/object",
            data={"key": build_stem(SELLER_B, "deadbeef")},
            files={"file": ("photo.jpg", jpeg_bytes(600, 600), "image/jpeg")},
            headers=self.seller,
        )
        # 404, not 403: confirming another seller's id exists would itself be an
        # enumeration oracle, and the caller learns nothing either way.
        self.assertEqual(response.status_code, 404)
        self.assertFalse(os.path.isdir(self.seller_dir(SELLER_B)))

    async def test_cannot_delete_another_sellers_object(self):
        response = await self.client.request(
            "DELETE",
            "/api/uploads/object",
            params={"object_key": build_stem(SELLER_B, "deadbeef")},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 404)

    async def test_cannot_finalize_another_sellers_upload(self):
        response = await self.client.post(
            "/api/uploads/complete",
            json={"object_key": build_stem(SELLER_B, "deadbeef")},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 404)

    async def test_traversal_key_is_refused(self):
        for key in ["../../../etc/passwd", "products/../../etc/passwd", "/etc/passwd", ".."]:
            with self.subTest(key):
                response = await self.client.post(
                    "/api/uploads/object",
                    data={"key": key},
                    files={"file": ("photo.jpg", jpeg_bytes(200, 200), "image/jpeg")},
                    headers=self.seller,
                )
                self.assertIn(response.status_code, (400, 404), response.text)

    # -- delete -----------------------------------------------------------

    async def test_delete_removes_the_object(self):
        ticket = (await self.client.post(
            "/api/uploads/presign",
            json={"mime_type": "image/png", "file_size": 4096},
            headers=self.seller,
        )).json()["data"]
        await self.client.post(
            ticket["upload_url"],
            data={"key": ticket["object_key"]},
            files={"file": ("logo.png", png_bytes(600, 600, "RGBA"), "image/png")},
            headers=self.seller,
        )
        self.assertTrue(self.seller_files())

        response = await self.client.request(
            "DELETE",
            "/api/uploads/object",
            params={"object_key": ticket["object_key"]},
            headers=self.seller,
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"]["deleted"])
        self.assertEqual(self.seller_files(), [])

    async def test_delete_requires_authentication(self):
        response = await self.client.request(
            "DELETE", "/api/uploads/object", params={"object_key": build_stem(SELLER_A, "aabbccdd")}
        )
        self.assertEqual(response.status_code, 401)

    # -- direct-upload deployments ----------------------------------------

    async def test_object_route_declines_when_uploads_bypass_the_api(self):
        """
        With STORAGE_PROVIDER=s3 the ticket points at the bucket and this route
        is never called. Saying so with a 409 is better than accepting 5 MB and
        storing it nowhere.
        """
        settings.STORAGE_PROVIDER = "s3"
        try:
            response = await self.client.post(
                "/api/uploads/object",
                data={"key": build_stem(SELLER_A, "dddddddd")},
                files={"file": ("photo.jpg", jpeg_bytes(600, 600), "image/jpeg")},
                headers=self.seller,
            )
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json()["error"]["code"], "DIRECT_UPLOAD_REQUIRED")
        finally:
            settings.STORAGE_PROVIDER = "local"


if __name__ == "__main__":
    unittest.main(verbosity=2)
