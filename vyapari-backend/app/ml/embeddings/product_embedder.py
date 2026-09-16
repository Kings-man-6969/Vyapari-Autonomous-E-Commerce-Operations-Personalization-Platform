"""
Vyapari — Product Embedder (MVP Stub)
Post-MVP: wire in sentence-transformers for real embeddings.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.logging import get_logger

logger = get_logger(__name__)

EMBEDDING_DIM = 768


class BaseEmbedder(ABC):
    """Abstract interface for any embedding model."""

    @abstractmethod
    async def embed_text(self, text: str) -> list[float]:
        """Return a fixed-dim embedding for the given text."""
        ...

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        ...


class StubEmbedder(BaseEmbedder):
    """
    MVP stub — returns a zero vector.
    Replace with SentenceTransformerEmbedder in post-MVP Phase 10.
    """

    async def embed_text(self, text: str) -> list[float]:
        logger.warning("stub_embedder_used", text_preview=text[:50])
        return [0.0] * EMBEDDING_DIM

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [[0.0] * EMBEDDING_DIM for _ in texts]


class ProductEmbedder:
    """
    High-level product embedding helper.
    Combines product name + description + brand into a single text
    and delegates to the underlying embedder.
    """

    def __init__(self, embedder: BaseEmbedder | None = None) -> None:
        self._embedder: BaseEmbedder = embedder or StubEmbedder()

    async def embed_product(
        self,
        name: str,
        description: str | None = None,
        brand: str | None = None,
        category: str | None = None,
    ) -> list[float]:
        parts = [name]
        if brand:
            parts.append(brand)
        if category:
            parts.append(category)
        if description:
            parts.append(description[:500])  # Truncate to 500 chars

        text = " | ".join(parts)
        return await self._embedder.embed_text(text)


# Singleton for import convenience
product_embedder = ProductEmbedder()
