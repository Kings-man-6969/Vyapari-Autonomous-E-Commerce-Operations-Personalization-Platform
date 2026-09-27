"""Re-embed every product with the real model.

The seed writes deterministic hash vectors into product_embeddings (see
scripts/scraper_bot.py::generate_embedding). They are labelled
'all-MiniLM-L6-v2' but were never produced by that model, so a query embedded
with the real model compares against vectors in an unrelated space and the
results are confidently wrong -- a search for "saree" returns smartwatches.

Run this after loading a seed to put real vectors in:

    python -m src.batch_embed            # inside service-recommendation

It uses the same text construction and the same compute_embedding as
POST /embed/product/{id}, so a batch run and a single re-embed agree.
"""

import asyncio
import logging
import os
import sys
import time

import asyncpg

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("batch_embed")

BATCH_SIZE = 200


async def main() -> int:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        logger.error("DATABASE_URL is not set")
        return 1

    # Imported here so --help and import errors do not require the model.
    from src.main import MODEL_NAME, compute_embedding

    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch(
            "SELECT id, title, description, attributes FROM products ORDER BY id"
        )
        total = len(rows)
        logger.info("Re-embedding %d products with %s", total, MODEL_NAME)
        if total == 0:
            return 0

        started = time.time()
        done = 0
        for i in range(0, total, BATCH_SIZE):
            chunk = rows[i : i + BATCH_SIZE]
            values = []
            for r in chunk:
                text = f"{r['title']} {r['description'] or ''} {str(r['attributes'] or '')}"
                vec = compute_embedding(text)
                values.append((r["id"], "[" + ",".join(str(x) for x in vec) + "]", MODEL_NAME))
            await conn.executemany(
                """
                INSERT INTO product_embeddings (product_id, embedding, model_version, updated_at)
                VALUES ($1, $2::vector, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (product_id) DO UPDATE SET
                    embedding = EXCLUDED.embedding,
                    model_version = EXCLUDED.model_version,
                    updated_at = CURRENT_TIMESTAMP
                """,
                values,
            )
            done += len(chunk)
            logger.info("  %d/%d (%.0fs)", done, total, time.time() - started)

        logger.info("Done: %d products in %.0fs", total, time.time() - started)
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
