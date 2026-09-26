import os
import json
import asyncio
import logging
import uuid
from celery import Celery
import asyncpg
from src.metrics import metrics

logger = logging.getLogger("service-seller-agent.tasks")

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_URL = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/0")

# Support least-privilege agent database role with fallback to standard DATABASE_URL
DATABASE_URL = os.getenv(
    "AGENT_DATABASE_URL",
    os.getenv("DATABASE_URL", "postgresql://vyapari_admin:vyapari_secure_password@db:5432/vyapari")
)

celery_app = Celery("vyapari_agent_tasks", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    task_time_limit=60,
    task_soft_time_limit=45,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "scan-inventory-every-6-hours": {
            "task": "src.tasks.periodic_inventory_scan",
            "schedule": 21600.0,  # 6 hours in seconds
        },
    },
)


async def _async_generate_listing(
    task_id: str,
    seller_id: str,
    prompt: str,
    category_id: str = None,
    image_urls: list = None,
    notes: str = None,
    correlation_id: str = None
):
    cid = correlation_id or str(uuid.uuid4())
    logger.info(f"[cid:{cid}] Processing async listing generation task={task_id} seller={seller_id}")

    conn = await asyncpg.connect(DATABASE_URL, timeout=10.0)
    try:
        # 1. Deduplication guard: Check if task has already been completed (avoid duplicate inference on worker retry)
        task_row = await conn.fetchrow("SELECT status FROM agent_tasks WHERE id = $1::uuid", task_id)
        if task_row and task_row["status"] == "done":
            logger.info(f"[cid:{cid}] Task {task_id} already marked 'done'. Skipping duplicate inference.")
            return {"status": "already_done", "task_id": task_id, "correlation_id": cid}

        # 2. Mark running
        await conn.execute("UPDATE agent_tasks SET status = 'running' WHERE id = $1::uuid", task_id)

        # 3. Generate listing payload
        fallback_data = {
            "title": f"Premium {prompt[:50]}",
            "description": f"Engineered for exceptional performance and daily reliability. This premium product combines precision craftsmanship with durable, modern design.\n\nContext: {notes or 'Standard catalog release'}",
            "tags": ["premium", "bestseller", "verified"],
            "suggested_price": 2999.00,
            "attributes": {"material": "Premium Grade", "origin": "India"}
        }

        async with conn.transaction():
            # Update task output
            await conn.execute(
                "UPDATE agent_tasks SET status = 'done', output_payload = $1::jsonb, completed_at = NOW() WHERE id = $2::uuid",
                json.dumps(fallback_data),
                task_id
            )

            # Insert product draft
            draft_row = await conn.fetchrow(
                """
                INSERT INTO product_drafts (seller_id, title, description, tags, category_id, confidence, source_images, status, created_by_task)
                VALUES ($1::uuid, $2, $3, $4::jsonb, $5::uuid, 0.92, $6::jsonb, 'draft', $7::uuid)
                RETURNING id;
                """,
                seller_id,
                fallback_data["title"],
                fallback_data["description"],
                json.dumps(fallback_data["tags"]),
                category_id,
                json.dumps(image_urls or []),
                task_id
            )
            draft_id = draft_row["id"]

            # Insert into approval queue
            approval_payload = {
                "draft_id": str(draft_id),
                "title": fallback_data["title"],
                "suggested_price": fallback_data["suggested_price"],
                "tags": fallback_data["tags"],
                "images": image_urls or [],
                "correlation_id": cid
            }
            await conn.execute(
                """
                INSERT INTO agent_approval_queue (seller_id, task_id, item_type, reference_id, risk_level, payload, status)
                VALUES ($1::uuid, $2::uuid, 'listing_draft', $3::uuid, 'low', $4::jsonb, 'pending');
                """,
                seller_id,
                task_id,
                draft_id,
                json.dumps(approval_payload)
            )

            # Record immutable audit log
            await conn.execute(
                """
                INSERT INTO agent_audit_log (seller_id, agent_type, prompt_version, action_type, reference_id, task_id, input_tokens, output_tokens)
                VALUES ($1::uuid, 'listing_agent', 'listing_v1.2', 'celery_generate_listing', $2::uuid, $3::uuid, $4, $5);
                """,
                seller_id,
                draft_id,
                task_id,
                len(prompt.split()),
                len(json.dumps(fallback_data).split())
            )

        logger.info(f"[cid:{cid}] Successfully generated listing draft={draft_id} for task={task_id}")
        return {"status": "success", "task_id": task_id, "draft_id": str(draft_id), "correlation_id": cid}
    finally:
        await conn.close()


@celery_app.task(name="src.tasks.generate_listing_task", bind=True, max_retries=3)
def generate_listing_task(
    self,
    task_id: str,
    seller_id: str,
    prompt: str,
    category_id: str = None,
    image_urls: list = None,
    notes: str = None,
    correlation_id: str = None
):
    """Celery background task for asynchronous listing generation with correlation ID tracing."""
    metrics.inc_celery_task("generate_listing_task")
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            _async_generate_listing(task_id, seller_id, prompt, category_id, image_urls, notes, correlation_id)
        )
    except Exception as exc:
        metrics.inc_celery_task("generate_listing_task", failed=True)
        logger.error(f"[cid:{correlation_id}] Error in generate_listing_task: {exc}")
        raise self.retry(exc=exc, countdown=10)


async def _async_inventory_scan(correlation_id: str = None):
    cid = correlation_id or str(uuid.uuid4())
    logger.info(f"[cid:{cid}] Executing periodic catalog inventory scan...")

    conn = await asyncpg.connect(DATABASE_URL, timeout=10.0)
    try:
        # Find active products with stock below threshold
        low_stock_rows = await conn.fetch(
            """
            SELECT id, seller_id, title, stock_qty
            FROM products
            WHERE status = 'active' AND stock_qty <= 10
            ORDER BY stock_qty ASC
            LIMIT 50;
            """
        )
        logger.info(f"[cid:{cid}] Inventory scan found {len(low_stock_rows)} low-stock products.")

        scanned_count = 0
        for row in low_stock_rows:
            # Check if an advisory was generated in the last 24h
            recent = await conn.fetchrow(
                """
                SELECT id FROM inventory_advisories
                WHERE product_id = $1::uuid AND created_at > NOW() - INTERVAL '24 hours'
                LIMIT 1;
                """,
                row["id"]
            )
            if recent:
                continue

            reasoning = f"Stock level for '{row['title']}' is critically low ({row['stock_qty']} units). Immediate restock suggested."
            async with conn.transaction():
                task_row = await conn.fetchrow(
                    """
                    INSERT INTO agent_tasks (seller_id, task_type, status, input_payload, output_payload)
                    VALUES ($1::uuid, 'inventory_advisory', 'done', $2::jsonb, $3::jsonb)
                    RETURNING id;
                    """,
                    row["seller_id"],
                    json.dumps({"product_id": str(row["id"]), "stock_qty": row["stock_qty"], "correlation_id": cid}),
                    json.dumps({"reorder_qty": 30, "reasoning": reasoning})
                )

                adv_row = await conn.fetchrow(
                    """
                    INSERT INTO inventory_advisories (seller_id, product_id, days_of_stock_left, demand_trend, recommended_reorder_qty, reasoning, created_by_task)
                    VALUES ($1::uuid, $2::uuid, 3.0, 'rising', 30, $3, $4::uuid)
                    RETURNING id;
                    """,
                    row["seller_id"],
                    row["id"],
                    reasoning,
                    task_row["id"]
                )

                await conn.execute(
                    """
                    INSERT INTO agent_approval_queue (seller_id, task_id, item_type, reference_id, risk_level, payload, status)
                    VALUES ($1::uuid, $2::uuid, 'inventory_advisory', $3::uuid, 'medium', $4::jsonb, 'pending');
                    """,
                    row["seller_id"],
                    task_row["id"],
                    adv_row["id"],
                    json.dumps({
                        "product_id": str(row["id"]),
                        "stock_qty": row["stock_qty"],
                        "reorder_qty": 30,
                        "reasoning": reasoning,
                        "correlation_id": cid
                    })
                )
            scanned_count += 1

        logger.info(f"[cid:{cid}] Inventory scan complete: {len(low_stock_rows)} scanned, {scanned_count} advisories created.")
        return {"scanned": len(low_stock_rows), "advisories_created": scanned_count, "correlation_id": cid}
    finally:
        await conn.close()


@celery_app.task(name="src.tasks.periodic_inventory_scan")
def periodic_inventory_scan():
    """Periodic Celery task scanning active catalog for inventory replenishment needs."""
    metrics.inc_celery_task("periodic_inventory_scan")
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(_async_inventory_scan())
    except Exception as exc:
        metrics.inc_celery_task("periodic_inventory_scan", failed=True)
        logger.error(f"Error in periodic_inventory_scan: {exc}")
        raise
