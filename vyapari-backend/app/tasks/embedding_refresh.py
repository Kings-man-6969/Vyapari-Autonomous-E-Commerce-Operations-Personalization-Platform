"""
Vyapari — Embedding Refresh Celery Tasks (MVP Stub)
These tasks run on a daily schedule but are no-ops until
the sentence-transformers embedder is integrated in post-MVP Phase 10.
"""
from __future__ import annotations

from app.core.logging import get_logger
from app.tasks.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="app.tasks.embedding_refresh.refresh_all_product_embeddings")
def refresh_all_product_embeddings() -> dict:
    """
    [MVP Stub] Scheduled daily.
    Post-MVP: loads ProductEmbedder, fetches all active products,
    generates embeddings via sentence-transformers, and upserts to
    product_embeddings table via VectorStoreService.
    """
    logger.info("embedding_refresh_skipped", reason="embedder_not_configured_at_mvp")
    return {"status": "skipped", "reason": "embedder_not_configured"}


@celery_app.task(name="app.tasks.embedding_refresh.refresh_user_embeddings")
def refresh_user_embeddings() -> dict:
    """
    [MVP Stub] Post-MVP: aggregates user_events for each user,
    generates preference embeddings, and upserts to user_embeddings table.
    """
    logger.info("user_embedding_refresh_skipped", reason="embedder_not_configured_at_mvp")
    return {"status": "skipped", "reason": "embedder_not_configured"}
