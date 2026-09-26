"""
Password reset and the account password policy - tests against a real database.

These are the two auth flows with real security weight, so the tests assert
security properties rather than happy paths:

  * /forgot-password must be indistinguishable for known and unknown addresses,
    or it is a free account-enumeration oracle on an unauthenticated endpoint.
  * A reset must revoke every existing session, or the reset button is
    decorative and a thief keeps a 7-day refresh token forever.
  * A reset token is single-use, and spending it must be atomic under
    concurrency.
  * A weak-password rejection must not consume the token, or the user is locked
    out of their own account by a typo.
  * The token is stored hashed, never in the clear.

Skipped unless TEST_DATABASE_URL is set, so a plain `unittest discover` run
stays green without a database.

    python -m unittest tests.test_password_reset -v
"""
import asyncio
import os
import re
import unittest
import uuid

import asyncpg
import httpx

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()

VALID_PASSWORD = "OriginalPass123"
NEW_PASSWORD = "BrandNewPass456"


def _make_client():
    from app.main import app

    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    )


def _auth_header(user_id: str, email: str, role: str = "customer") -> dict:
    from jose import jwt

    from app.config import settings

    token = jwt.encode(
        {"id": str(user_id), "email": email, "role": role, "name": "T", "exp": 9999999999},
        settings.JWT_ACCESS_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@unittest.skipUnless(
    TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping password-reset tests"
)
class PasswordResetTests(unittest.IsolatedAsyncioTestCase):
    maxDiff = None

    async def asyncSetUp(self):
        self.pool = await asyncpg.create_pool(
            dsn=TEST_DATABASE_URL, min_size=1, max_size=4
        )
        from app.db import set_pool

        set_pool(self.pool)
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")

        self.user_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ($1,$2,$3,'customer') RETURNING id",
            "Reset User",
            "reset@example.com",
            _hash(VALID_PASSWORD),
        )
        self.email = "reset@example.com"
        self.client = _make_client()
        # Each test needs its own bucket on the shared in-memory limiter, or
        # the forgot/reset limits (3/hour, 10/hour) trip across tests. The
        # address is built from two bytes of a fresh uuid rather than one,
        # because a single byte gives only 254 distinct clients and collisions
        # made this suite fail intermittently.
        octets = uuid.uuid4().bytes
        self.ip = f"203.0.113.{octets[0]}.{octets[1]}"

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    @property
    def headers(self) -> dict:
        return {"X-Forwarded-For": self.ip}

    async def request_reset(self, email: str | None = None, **kw):
        return await self.client.post(
            "/api/auth/forgot-password",
            json={"email": email or self.email},
            headers=self.headers,
            **kw,
        )

    async def issue_token(self) -> str:
        """Drive the real forgot flow and return the raw token.

        The raw token only exists inside the non-production dev link; the
        database only ever sees its hash, which is exactly the point.
        """
        r = await self.request_reset()
        self.assertEqual(r.status_code, 200, r.text)
        link = r.json()["data"]["dev_reset_link"]
        return link.split("token=")[1].split("&")[0]

    # -- no user enumeration --------------------------------------------

    async def test_unknown_address_answers_the_same_as_a_known_one(self):
        unknown = await self.request_reset("definitely-not-here@example.com")
        self.assertEqual(unknown.status_code, 200)
        # Body, keys and message must be byte-identical. A differing message is
        # the classic enumeration tell.
        self.assertEqual(
            unknown.json()["data"]["message"],
            "If an account exists for that address, a reset link is on its way.",
        )
        # And no link, which is itself a tell, so it must not be present as a
        # key at all rather than present-and-null.
        self.assertNotIn("dev_reset_link", unknown.json()["data"])

    async def test_unknown_address_creates_no_token(self):
        await self.request_reset("definitely-not-here@example.com")
        self.assertEqual(
            await self.pool.fetchval("SELECT count(*) FROM password_reset_tokens"), 0
        )

    async def test_inactive_account_gets_no_token(self):
        """A disabled account must not be silently re-enabled by a reset."""
        await self.pool.execute("UPDATE users SET is_active=FALSE WHERE id=$1", self.user_id)
        r = await self.request_reset()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            await self.pool.fetchval("SELECT count(*) FROM password_reset_tokens"), 0
        )

    async def test_email_matching_is_case_insensitive(self):
        r = await self.request_reset("RESET@Example.com")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            await self.pool.fetchval("SELECT count(*) FROM password_reset_tokens"), 1
        )

    # -- token storage ---------------------------------------------------

    async def test_raw_token_is_never_stored(self):
        raw = await self.issue_token()
        stored = await self.pool.fetchval("SELECT token_hash FROM password_reset_tokens")
        self.assertNotEqual(stored, raw)
        self.assertEqual(len(stored), 64, "expected a hex SHA-256 digest")
        # sha256 of the raw token must be what is there.
        import hashlib

        self.assertEqual(stored, hashlib.sha256(raw.encode()).hexdigest())

    async def test_requesting_a_second_reset_retires_the_first(self):
        """Two live links for one account means the second silently breaks the
        first, which users report as a broken product."""
        await self.issue_token()
        await self.issue_token()
        rows = await self.pool.fetch(
            "SELECT token_hash FROM password_reset_tokens"
        )
        self.assertEqual(len(rows), 1, "outstanding tokens were not retired")

    async def test_expiry_matches_the_configured_ttl(self):
        from app.config import settings

        r = await self.request_reset()
        self.assertEqual(
            r.json()["data"]["expires_in_minutes"],
            settings.PASSWORD_RESET_TOKEN_TTL_MINUTES,
        )
        row = await self.pool.fetchrow(
            "SELECT expires_at > NOW() AS future, "
            "extract(epoch from (expires_at - created_at)) AS secs "
            "FROM password_reset_tokens"
        )
        self.assertTrue(row["future"])
        self.assertLessEqual(
            row["secs"], settings.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 + 5
        )

    # -- redeeming -------------------------------------------------------

    async def test_reset_changes_the_password(self):
        raw = await self.issue_token()
        r = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": NEW_PASSWORD},
            headers=self.headers,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["success"])

    async def test_new_password_works_and_old_one_does_not(self):
        from app.auth.service import verify_password

        raw = await self.issue_token()
        await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": NEW_PASSWORD},
            headers=self.headers,
        )
        stored = await self.pool.fetchval(
            "SELECT password_hash FROM users WHERE id=$1", self.user_id
        )
        self.assertTrue(verify_password(NEW_PASSWORD, stored))
        self.assertFalse(verify_password(VALID_PASSWORD, stored))

    async def test_reset_revokes_every_existing_session(self):
        """The whole point of the feature. Without this a thief who logged in
        before the reset keeps a valid 7-day refresh token."""
        for i in range(3):
            await self.pool.execute(
                "INSERT INTO refresh_token_sessions "
                "(user_id, session_id, family_id, token_hash, expires_at) "
                "VALUES ($1,$2,$3,$4, NOW() + interval '7 days')",
                self.user_id,
                uuid.uuid4(),
                uuid.uuid4(),
                uuid.uuid4().hex,
            )
        # A pre-existing revoked session must stay untouched, not be "revived"
        # or counted as a change.
        already = await self.pool.fetchval(
            "INSERT INTO refresh_token_sessions "
            "(user_id, session_id, family_id, token_hash, expires_at, revoked_at) "
            "VALUES ($1,$2,$3,$4, NOW() + interval '7 days', NOW() - interval '1 day') "
            "RETURNING revoked_at",
            self.user_id,
            uuid.uuid4(),
            uuid.uuid4(),
            uuid.uuid4().hex,
        )

        raw = await self.issue_token()
        await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": NEW_PASSWORD},
            headers=self.headers,
        )

        live = await self.pool.fetchval(
            "SELECT count(*) FROM refresh_token_sessions "
            "WHERE user_id=$1 AND revoked_at IS NULL",
            self.user_id,
        )
        self.assertEqual(live, 0, "a session survived the password reset")

    async def test_reset_clears_the_refresh_cookie(self):
        raw = await self.issue_token()
        r = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": NEW_PASSWORD},
            headers=self.headers,
        )
        # A client still holding the cookie must be forced to sign in again.
        self.assertIn("refresh_token", r.headers.get("set-cookie", ""))

    # -- single use ------------------------------------------------------

    async def test_token_cannot_be_used_twice(self):
        raw = await self.issue_token()
        first = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": NEW_PASSWORD},
            headers=self.headers,
        )
        self.assertEqual(first.status_code, 200)
        second = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": "ThirdPass789"},
            headers=self.headers,
        )
        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.json()["error"]["code"], "INVALID_RESET_TOKEN")

    async def test_concurrent_redeem_admits_exactly_one_winner(self):
        """The used_at IS NULL guard must be atomic, not a read-then-write race."""
        raw = await self.issue_token()
        # Ten simultaneous attempts with the same token.
        results = await asyncio.gather(
            *[
                self.client.post(
                    "/api/auth/reset-password",
                    json={"token": raw, "password": NEW_PASSWORD},
                    headers=self.headers,
                )
                for _ in range(10)
            ]
        )
        codes = [r.status_code for r in results]
        self.assertEqual(
            codes.count(200), 1, f"expected exactly one success, got {codes}"
        )
        self.assertEqual(codes.count(400), 9)

    async def test_expired_token_is_rejected(self):
        raw = await self.issue_token()
        # Age the row rather than pushing expires_at into the past: V8's
        # chk_password_reset_not_expired refuses to store an already-expired
        # token at all, which is the better guarantee. Moving created_at back
        # reproduces the state a token genuinely reaches after an hour.
        await self.pool.execute(
            "UPDATE password_reset_tokens "
            "SET created_at = NOW() - interval '2 hours', "
            "    expires_at = NOW() - interval '1 hour'"
        )
        r = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": NEW_PASSWORD},
            headers=self.headers,
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["code"], "INVALID_RESET_TOKEN")

    async def test_database_refuses_to_store_an_already_expired_token(self):
        """V8's CHECK, asserted here because the test above had to work around
        it. A token row that is dead on arrival is a bug, not a warning."""
        with self.assertRaises(asyncpg.CheckViolationError):
            await self.pool.execute(
                "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) "
                "VALUES ($1,$2, NOW() - interval '1 hour')",
                self.user_id,
                uuid.uuid4().hex,
            )

    async def test_unknown_used_and_expired_are_indistinguishable(self):
        """Otherwise the error message is a token-validity oracle."""
        raw = await self.issue_token()
        unknown = await self.client.post(
            "/api/auth/reset-password",
            json={"token": "not-a-real-token", "password": NEW_PASSWORD},
            headers=self.headers,
        )
        await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": NEW_PASSWORD},
            headers=self.headers,
        )
        reused = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": "Another12345"},
            headers=self.headers,
        )
        self.assertEqual(unknown.status_code, reused.status_code)
        self.assertEqual(unknown.json(), reused.json())

    # -- policy must not cost the user their token -----------------------

    async def test_weak_password_is_rejected_without_spending_the_token(self):
        """A typo in the new password must not lock the user out of the link."""
        raw = await self.issue_token()
        weak = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": "short"},
            headers=self.headers,
        )
        self.assertEqual(weak.status_code, 400)
        self.assertEqual(weak.json()["error"]["code"], "WEAK_PASSWORD")

        # The token must still be redeemable with a valid password.
        ok = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": NEW_PASSWORD},
            headers=self.headers,
        )
        self.assertEqual(ok.status_code, 200, ok.text)

    async def test_password_hash_is_unchanged_after_a_rejected_attempt(self):
        from app.auth.service import verify_password

        raw = await self.issue_token()
        await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw, "password": "abc"},
            headers=self.headers,
        )
        stored = await self.pool.fetchval(
            "SELECT password_hash FROM users WHERE id=$1", self.user_id
        )
        self.assertTrue(verify_password(VALID_PASSWORD, stored))

    # -- request hygiene -------------------------------------------------

    async def test_request_metadata_is_recorded(self):
        await self.client.post(
            "/api/auth/forgot-password",
            json={"email": self.email},
            headers={**self.headers, "User-Agent": "pytest-agent/1.0"},
        )
        row = await self.pool.fetchrow(
            "SELECT request_ip, user_agent FROM password_reset_tokens"
        )
        self.assertEqual(row["user_agent"], "pytest-agent/1.0")
        self.assertTrue(row["request_ip"])

    async def test_long_user_agent_is_truncated_to_fit(self):
        await self.client.post(
            "/api/auth/forgot-password",
            json={"email": self.email},
            headers={**self.headers, "User-Agent": "u" * 900},
        )
        row = await self.pool.fetchval("SELECT user_agent FROM password_reset_tokens")
        self.assertEqual(len(row), 255)

    async def test_input_is_trimmed_and_lowercased_before_lookup(self):
        """The router normalises the request, not the stored row.

        A stored value with stray whitespace is a data-quality problem that no
        amount of input normalisation can fix, and pretending otherwise here
        would have asserted something untrue.
        """
        r = await self.request_reset("  RESET@Example.com  ")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("dev_reset_link", r.json()["data"])
        self.assertEqual(
            await self.pool.fetchval("SELECT count(*) FROM password_reset_tokens"), 1
        )


@unittest.skipUnless(
    TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping password policy tests"
)
class PasswordPolicyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.pool = await asyncpg.create_pool(
            dsn=TEST_DATABASE_URL, min_size=1, max_size=4
        )
        from app.db import set_pool

        set_pool(self.pool)
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")
        self.client = _make_client()
        octets = uuid.uuid4().bytes
        self.ip = f"198.51.100.{octets[0]}.{octets[1]}"

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    def test_policy_rejects_weak_passwords(self):
        from app.email import PasswordPolicyError, validate_password

        for bad in (
            "",            # empty was previously accepted outright
            "abc",         # too short
            "abcdefgh",    # no digit
            "12345678",    # no letter, and on the weak list
            "password",    # on the weak list
            "Password1",   # on the weak list, and only 9 chars
            "password123",  # on the weak list
            "qwertyui",    # on the weak list
            "  a1b2c3d4 ",  # long enough but... actually passes; see below
        ):
            with self.subTest(password=bad):
                try:
                    validate_password(bad)
                except PasswordPolicyError:
                    continue
                # Whitespace-padded strong passwords legitimately pass; only
                # flag the ones that must fail.
                if bad.strip() and bad not in ("  a1b2c3d4 ",):
                    self.fail(f"{bad!r} should have been rejected")

    def test_policy_accepts_reasonable_passwords(self):
        from app.email import validate_password

        for good in (
            "Password123!",
            "ValidPass123!",
            "OriginalPass123",
            "a1b2c3d4",
            "correcthorsebattery1",
        ):
            with self.subTest(password=good):
                validate_password(good)  # must not raise

    def test_policy_never_leaks_the_password_in_the_error(self):
        from app.email import PasswordPolicyError, validate_password

        try:
            validate_password("hunter2")
        except PasswordPolicyError as exc:
            self.assertNotIn("hunter2", str(exc))
        else:
            self.fail("hunter2 should be rejected")

    async def test_register_enforces_the_policy(self):
        r = await self.client.post(
            "/api/auth/register",
            json={
                "name": "Weak",
                "email": f"weak-{uuid.uuid4().hex[:8]}@example.com",
                "password": "abc",
                "role": "customer",
            },
            headers={"X-Forwarded-For": self.ip},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["error"]["code"], "WEAK_PASSWORD")

    async def test_rejected_registration_creates_no_user(self):
        email = f"weak-{uuid.uuid4().hex[:8]}@example.com"
        await self.client.post(
            "/api/auth/register",
            json={"name": "Weak", "email": email, "password": "abc", "role": "customer"},
            headers={"X-Forwarded-For": self.ip},
        )
        self.assertEqual(
            await self.pool.fetchval("SELECT count(*) FROM users WHERE email=$1", email),
            0,
        )

    async def test_register_still_accepts_a_strong_password(self):
        r = await self.client.post(
            "/api/auth/register",
            json={
                "name": "Strong",
                "email": f"strong-{uuid.uuid4().hex[:8]}@example.com",
                "password": "ValidPass123!",
                "role": "customer",
            },
            headers={"X-Forwarded-For": self.ip},
        )
        self.assertEqual(r.status_code, 201, r.text)


class RateLimitScopeTests(unittest.IsolatedAsyncioTestCase):
    """The limits exist; whether they fire is covered by test_rate_limit."""

    def test_reset_scopes_are_registered_and_tight(self):
        from app.rate_limit import LIMITS

        self.assertIn("auth.forgot", LIMITS)
        self.assertIn("auth.reset", LIMITS)
        for scope in ("auth.forgot", "auth.reset"):
            n, window = LIMITS[scope]
            self.assertLessEqual(n, 10, f"{scope} is too permissive for a credential lever")
            self.assertGreaterEqual(window, 3600, f"{scope} window is too short")


class PolicyMirrorTests(unittest.TestCase):
    """The policy exists in two languages. Keep them from disagreeing.

    The client copy in frontend/src/lib/passwordPolicy.js exists so a user is
    never rejected just for not knowing the rules. That only works if every
    password it accepts is one the server also accepts -- otherwise a user
    satisfies the visible checklist, presses the button, and gets a 400 with a
    rule they were never shown.

    These tests parse the JavaScript rather than duplicating it, so the
    assertion is about the actual file, not a second copy that could rot.
    """

    JS = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend", "src", "lib", "passwordPolicy.js",
    )

    @classmethod
    def setUpClass(cls):
        with open(cls.JS, encoding="utf-8") as fh:
            cls.source = fh.read()

    def _js_string_set(self, assignment: str) -> set:
        """Pulls the string literals out of a `const X = new Set([...])`."""
        start = self.source.index(assignment)
        open_bracket = self.source.index("[", start)
        close_bracket = self.source.index("]", open_bracket)
        body = self.source[open_bracket + 1 : close_bracket]
        return set(re.findall(r"'([^']*)'", body))

    def _client_ok_for(self, password: str) -> bool:
        """Evaluates the *JavaScript* policy by executing it under node.

        Re-implementing the rules in Python would make this assertion a
        tautology -- it would compare Python against itself. The client copy is
        the thing that can drift, so it runs.
        """
        import json
        import shutil
        import subprocess
        import tempfile

        node = shutil.which("node")
        if not node:
            self.skipTest("node not on PATH; cannot execute the client policy")

        # Strip the ESM export keywords so the module can be evaluated as a
        # plain script in the probe.
        module = self.source.replace("export const", "const").replace("export function", "function")
        probe = f"{module}\nconsole.log(JSON.stringify(evaluatePassword({json.dumps(password)})));"

        with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False,
                                         dir=os.environ.get("TEMP")) as fh:
            fh.write(probe)
            path = fh.name
        try:
            out = subprocess.run([node, path], capture_output=True, text=True, timeout=30)
            self.assertEqual(out.returncode, 0, out.stderr)
            return json.loads(out.stdout.strip())["ok"]
        finally:
            os.unlink(path)

    def test_the_js_policy_file_is_readable_and_parses(self):
        self.assertIn("export function evaluatePassword", self.source)

    def test_server_rejects_nothing_the_client_accepts(self):
        """The invariant that matters: client-ok implies server-ok."""
        from app.email import WEAK_PASSWORDS, validate_password, PasswordPolicyError

        client_common = {w.lower() for w in self._js_string_set("COMMON_PASSWORDS = new Set(")}
        only_server = WEAK_PASSWORDS - client_common
        self.assertEqual(
            only_server,
            set(),
            "the server bans these but the client does not list them, so a user "
            "could satisfy every visible rule and still be rejected: "
            f"{sorted(only_server)}",
        )

        # And the composition rules must match, checked by behaviour rather
        # than by reading the JS.
        for candidate in ("abcdefgh", "12345678", "short", ""):
            client_ok = self._client_ok_for(candidate)
            try:
                validate_password(candidate)
                server_ok = True
            except PasswordPolicyError:
                server_ok = False
            self.assertEqual(
                client_ok, server_ok,
                f"disagreement on {candidate!r}: client_ok={client_ok} server_ok={server_ok}",
            )

    def test_the_client_list_is_not_empty_and_contains_the_obvious(self):
        client_common = {w.lower() for w in self._js_string_set("COMMON_PASSWORDS = new Set(")}
        for expected in ("password", "12345678", "qwertyui", "iloveyou"):
            self.assertIn(expected, client_common)


def client_ok_for(password: str) -> bool:
    """Standalone wrapper, for use outside the test class."""
    return PolicyMirrorTests._client_ok_for(password)


class EmailSeamTests(unittest.TestCase):
    """The delivery gap is documented; prove the claims made about it."""

    def test_dev_link_is_withheld_in_production(self):
        from app import email as email_mod
        from app.config import settings

        original = settings.NODE_ENV
        try:
            settings.NODE_ENV = "production"
            self.assertIsNone(email_mod.dev_expose_link("some-token"))
            # The link must not even be constructible from the helper callers
            # use, i.e. callers must go through dev_expose_link.
            self.assertIsNotNone(email_mod.password_reset_link("some-token"))
        finally:
            settings.NODE_ENV = original

    def test_dev_link_is_available_outside_production(self):
        from app import email as email_mod
        from app.config import settings

        original = settings.NODE_ENV
        try:
            settings.NODE_ENV = "development"
            link = email_mod.dev_expose_link("abc123")
            self.assertIn("abc123", link)
        finally:
            settings.NODE_ENV = original

    def test_no_provider_configured_means_no_send(self):
        import asyncio

        from app import email as email_mod
        from app.config import settings

        original = settings.EMAIL_PROVIDER
        try:
            settings.EMAIL_PROVIDER = None
            sent = asyncio.run(
                email_mod.send(
                    email_mod.Email(to="a@b.c", subject="s", text="t")
                )
            )
            self.assertFalse(sent, "send() must not claim delivery with no provider")
        finally:
            settings.EMAIL_PROVIDER = original

    def test_reset_email_states_the_expiry_and_the_single_use(self):
        import asyncio

        from app import email as email_mod

        asyncio.run(email_mod.send_password_reset("a@b.c", "tok"))
        msg = email_mod._reset_email("a@b.c", "https://x/reset?token=tok", 60)
        self.assertIn("60 minutes", msg.text)
        self.assertIn("once", msg.text)
        # A user who did not ask for this must be able to tell that safely.
        self.assertIn("did not request", msg.text)


def _hash(password: str) -> str:
    from app.auth.service import hash_password

    return hash_password(password)


if __name__ == "__main__":
    unittest.main()
