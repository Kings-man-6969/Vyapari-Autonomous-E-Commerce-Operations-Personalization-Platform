import os
import time
import logging
from datetime import datetime, timezone
from typing import Tuple, Optional

logger = logging.getLogger("service-seller-agent.quota")

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_URL = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/0")

MAX_DAILY_REQUESTS = int(os.getenv("MAX_DAILY_SELLER_AI_REQUESTS", "500"))
MAX_DAILY_TOKENS = int(os.getenv("MAX_DAILY_SELLER_AI_TOKENS", "500000"))

_redis_client = None

def get_redis_client():
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2.0)
        except Exception as e:
            logger.warning(f"Could not connect to Redis for AI quota tracking: {e}")
            _redis_client = None
    return _redis_client


async def check_and_increment_quota(seller_id: str, estimated_tokens: int = 1000) -> Tuple[bool, Optional[str], int]:
    """
    Atomically tracks and checks AI usage quotas per seller.
    Returns:
        (allowed: bool, reason: Optional[str], retry_after_seconds: int)
    """
    client = get_redis_client()
    if client is None:
        return True, None, 0

    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        req_key = f"vyapari:quota:seller:{seller_id}:{today}:requests"
        tok_key = f"vyapari:quota:seller:{seller_id}:{today}:tokens"

        pipe = client.pipeline()
        pipe.incrby(req_key, 1)
        pipe.incrby(tok_key, estimated_tokens)
        pipe.ttl(req_key)
        results = await pipe.execute()

        current_requests = results[0]
        current_tokens = results[1]
        ttl = results[2]

        # Set 24h TTL if key is newly created (ttl == -1 means no expiration set)
        if ttl == -1:
            await client.expire(req_key, 86400)
            await client.expire(tok_key, 86400)
            ttl = 86400

        retry_after = max(ttl, 60)

        if current_requests > MAX_DAILY_REQUESTS:
            logger.warning(f"Seller {seller_id} exceeded daily AI request quota: {current_requests}/{MAX_DAILY_REQUESTS}")
            return False, f"Daily AI request limit of {MAX_DAILY_REQUESTS} reached.", retry_after

        if current_tokens > MAX_DAILY_TOKENS:
            logger.warning(f"Seller {seller_id} exceeded daily AI token quota: {current_tokens}/{MAX_DAILY_TOKENS}")
            return False, f"Daily AI token limit of {MAX_DAILY_TOKENS} reached.", retry_after

        return True, None, 0

    except Exception as e:
        logger.warning(f"Redis quota check error ({e}), failing open for seller {seller_id}")
        return True, None, 0
