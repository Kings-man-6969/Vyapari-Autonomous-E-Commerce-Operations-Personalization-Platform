import io
import unittest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from src.image_validator import validate_image_bytes
from src.main import app, should_retry_gemini, RetryableGeminiError
from src.quota import check_and_increment_quota, _local_seller_timestamps
from src.metrics import metrics
from src.tasks import _async_generate_listing


class TestSellerAgent(unittest.TestCase):
    def setUp(self):
        # Reset local quota timestamps for isolation
        _local_seller_timestamps.clear()

    def test_image_validator_rejects_empty(self):
        with self.assertRaises(ValueError):
            validate_image_bytes(b"")

    def test_image_validator_rejects_svg(self):
        svg_bytes = b"<svg xmlns='http://www.w3.org/2000/svg'><circle r='50'/></svg>" * 20
        with self.assertRaises(ValueError):
            validate_image_bytes(svg_bytes)

    def test_image_validator_rejects_html(self):
        html_bytes = b"<!DOCTYPE html><html><body><h1>Fake Image</h1></body></html>" * 20
        with self.assertRaises(ValueError):
            validate_image_bytes(html_bytes)

    def test_error_classification_retryable(self):
        self.assertTrue(should_retry_gemini(RetryableGeminiError("rate limit")))
        self.assertTrue(should_retry_gemini(httpx.ConnectTimeout("connection timed out")))
        self.assertTrue(should_retry_gemini(httpx.ReadTimeout("read timed out")))

        # 429 and 500/503 are retryable
        req = httpx.Request("POST", "https://api.example.com")
        resp_429 = httpx.Response(429, request=req)
        self.assertTrue(should_retry_gemini(httpx.HTTPStatusError("quota", request=req, response=resp_429)))

        resp_503 = httpx.Response(503, request=req)
        self.assertTrue(should_retry_gemini(httpx.HTTPStatusError("service unavailable", request=req, response=resp_503)))

        # 400 Bad Request is NOT retryable
        resp_400 = httpx.Response(400, request=req)
        self.assertFalse(should_retry_gemini(httpx.HTTPStatusError("bad request", request=req, response=resp_400)))

    def test_quota_conservative_fallback_when_no_redis(self):
        # When Redis client is None, conservative local rate limiter applies (max 10 req/min)
        with patch("src.quota.get_redis_client", return_value=None):
            seller_id = "test-seller-conservative"
            # 10 allowed requests
            for _ in range(10):
                allowed, reason, retry_after = asyncio.run(check_and_increment_quota(seller_id))
                self.assertTrue(allowed)
                self.assertIsNone(reason)

            # 11th request MUST be throttled to prevent LLM billing explosion
            allowed, reason, retry_after = asyncio.run(check_and_increment_quota(seller_id))
            self.assertFalse(allowed)
            self.assertIn("conservative local limit", reason)
            self.assertGreater(retry_after, 0)

    def test_metrics_prometheus_exposition(self):
        metrics.inc_http_request("GET", "/health", 200, 0.015)
        metrics.inc_gemini_request()
        metrics.inc_gemini_retry()
        metrics.inc_quota_rejection()
        metrics.inc_celery_task("generate_listing_task")

        text = metrics.export_prometheus_text()
        self.assertIn("seller_agent_http_requests_total", text)
        self.assertIn("seller_agent_http_request_duration_seconds", text)
        self.assertIn("seller_agent_gemini_requests_total", text)
        self.assertIn("seller_agent_gemini_retries_total", text)
        self.assertIn("seller_agent_quota_rejections_total", text)
        self.assertIn("seller_agent_celery_tasks_total", text)

    def test_correlation_id_propagation_middleware(self):
        async def run_req():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                # 1. Custom correlation ID passed in header
                resp = await client.get("/health/live", headers={"X-Correlation-ID": "custom-uuid-12345"})
                self.assertEqual(resp.status_code, 200)
                self.assertEqual(resp.headers.get("X-Correlation-ID"), "custom-uuid-12345")
                self.assertIn("X-Response-Time", resp.headers)

                # 2. No correlation ID header -> auto-generated UUID
                resp2 = await client.get("/health/live")
                self.assertEqual(resp2.status_code, 200)
                auto_cid = resp2.headers.get("X-Correlation-ID")
                self.assertTrue(bool(auto_cid))
                self.assertNotEqual(auto_cid, "custom-uuid-12345")

        asyncio.run(run_req())

    def test_health_endpoints(self):
        async def run_req():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                # /health/live probe
                resp_live = await client.get("/health/live")
                self.assertEqual(resp_live.status_code, 200)
                self.assertEqual(resp_live.json(), {"status": "ok"})

                # /metrics endpoint
                resp_metrics = await client.get("/metrics")
                self.assertEqual(resp_metrics.status_code, 200)
                self.assertIn("seller_agent_http_requests_total", resp_metrics.text)

                # /health diagnostic endpoint (safe, credentials not leaked)
                resp_health = await client.get("/health")
                self.assertIn(resp_health.status_code, (200, 503))
                data = resp_health.json()
                self.assertIn("status", data)
                self.assertIn("uptime_seconds", data)
                self.assertIn("prompt_versions", data)
                self.assertNotIn("password", str(data).lower())
                self.assertNotIn("secret", str(data).lower())

        asyncio.run(run_req())

    def test_celery_task_deduplication_and_correlation(self):
        async def run_test():
            mock_conn = AsyncMock()
            # Task already marked 'done' in agent_tasks
            mock_conn.fetchrow.return_value = {"status": "done"}

            with patch("asyncpg.connect", return_value=mock_conn):
                result = await _async_generate_listing(
                    task_id="11111111-1111-1111-1111-111111111111",
                    seller_id="22222222-2222-2222-2222-222222222222",
                    prompt="Wireless earbuds",
                    correlation_id="cid-dedupe-test-999"
                )

                self.assertEqual(result["status"], "already_done")
                self.assertEqual(result["correlation_id"], "cid-dedupe-test-999")
                # Inference should NOT execute any INSERT into product_drafts
                mock_conn.execute.assert_not_called()

        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()
