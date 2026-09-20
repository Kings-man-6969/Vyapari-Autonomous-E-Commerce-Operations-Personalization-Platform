import unittest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
from src.image_validator import validate_image_bytes
from src.main import should_retry_gemini, RetryableGeminiError
from src.quota import check_and_increment_quota

class TestSellerAgent(unittest.TestCase):
    def test_image_validator_rejects_empty(self):
        with self.assertRaises(ValueError):
            validate_image_bytes(b"")

    def test_image_validator_rejects_svg(self):
        svg_bytes = b"<svg xmlns='http://www.w3.org/2000/svg'><circle r='50'/></svg>" * 20
        with self.assertRaises(ValueError):
            validate_image_bytes(svg_bytes)

    def test_error_classification_retryable(self):
        self.assertTrue(should_retry_gemini(RetryableGeminiError("rate limit")))
        self.assertTrue(should_retry_gemini(httpx.ConnectTimeout("connection timed out")))
        self.assertTrue(should_retry_gemini(httpx.ReadTimeout("read timed out")))
        
        # 429 and 500 are retryable
        req = httpx.Request("POST", "https://api.example.com")
        resp_429 = httpx.Response(429, request=req)
        self.assertTrue(should_retry_gemini(httpx.HTTPStatusError("quota", request=req, response=resp_429)))
        
        resp_503 = httpx.Response(503, request=req)
        self.assertTrue(should_retry_gemini(httpx.HTTPStatusError("service unavailable", request=req, response=resp_503)))

        # 400 Bad Request is NOT retryable
        resp_400 = httpx.Response(400, request=req)
        self.assertFalse(should_retry_gemini(httpx.HTTPStatusError("bad request", request=req, response=resp_400)))

    def test_quota_fallback_when_no_redis(self):
        # When Redis client is None, quota check should fail open gracefully
        with patch("src.quota.get_redis_client", return_value=None):
            allowed, reason, retry_after = asyncio.run(check_and_increment_quota("seller-123"))
            self.assertTrue(allowed)
            self.assertIsNone(reason)
            self.assertEqual(retry_after, 0)

if __name__ == "__main__":
    unittest.main()
