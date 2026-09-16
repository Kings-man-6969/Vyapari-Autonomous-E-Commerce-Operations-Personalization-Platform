"""
Vyapari — Vector Store Service
Abstraction over pgvector. Swap-safe: future migration to Pinecone/Weaviate
only requires replacing this class.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.embedding import EMBEDDING_DIM, ProductEmbedding


class VectorStoreService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def upsert_product_embedding(
        self,
        product_id: UUID,
        embedding: list[float],
        model_version: str,
    ) -> None:
        """Insert or update a product's embedding vector."""
        from datetime import datetime, timezone
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        stmt = (
            pg_insert(ProductEmbedding)
            .values(
                product_id=product_id,
                embedding=embedding,
                model_version=model_version,
                updated_at=datetime.now(tz=timezone.utc),
            )
            .on_conflict_do_update(
                index_elements=["product_id"],
                set_={
                    "embedding": embedding,
                    "model_version": model_version,
                    "updated_at": datetime.now(tz=timezone.utc),
                },
            )
        )
        await self.db.execute(stmt)

    async def search_similar_products(
        self,
        query_embedding: list[float],
        limit: int = 10,
        distance_metric: str = "cosine",  # "cosine" | "l2"
    ) -> list[dict]:
        """
        Finds the top-k most similar products by embedding distance.
        Uses pgvector operators: <=> (cosine) or <-> (L2).
        """
        op = "<=>" if distance_metric == "cosine" else "<->"

        # Pass embedding as a formatted vector literal
        embedding_str = f"[{','.join(str(x) for x in query_embedding)}]"

        result = await self.db.execute(
            text(f"""
                SELECT
                    pe.product_id,
                    pe.embedding {op} :emb::vector({EMBEDDING_DIM}) AS distance
                FROM product_embeddings pe
                ORDER BY distance ASC
                LIMIT :limit
            """),
            {"emb": embedding_str, "limit": limit},
        )
        return [{"product_id": row.product_id, "distance": row.distance} for row in result]
