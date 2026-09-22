import json
import re
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth.dependencies import require_role
from app.config import settings
from app.db import get_db, get_pool

router = APIRouter(tags=["approvals"])
_seller_or_admin = Depends(require_role(["seller", "admin"]))


@router.get("")
@router.get("/")
async def get_approval_queue(
    status: str = Query("pending"),
    user: dict = _seller_or_admin,
    db=Depends(get_db),
) -> dict:
    rows = await db.fetch(
        """SELECT 
            q.id, q.task_id, q.item_type, q.reference_id, q.risk_level,
            q.payload, q.status, q.seller_edit, q.created_at, q.resolved_at,
            t.task_type
           FROM agent_approval_queue q
           LEFT JOIN agent_tasks t ON q.task_id = t.id
           WHERE q.seller_id = $1 AND ($2 = 'all' OR q.status = $2)
           ORDER BY q.created_at DESC""",
        user["id"],
        status,
    )

    items = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        if d.get("task_id"):
            d["task_id"] = str(d["task_id"])
        if d.get("reference_id"):
            d["reference_id"] = str(d["reference_id"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        if d.get("resolved_at"):
            d["resolved_at"] = d["resolved_at"].isoformat()
        if isinstance(d.get("payload"), str):
            try:
                d["payload"] = json.loads(d["payload"])
            except Exception:
                pass
        if isinstance(d.get("seller_edit"), str):
            try:
                d["seller_edit"] = json.loads(d["seller_edit"])
            except Exception:
                pass
        items.append(d)

    return {"success": True, "data": {"queue": items}}


@router.post("/{item_id}/approve")
async def approve_item(
    item_id: str,
    user: dict = _seller_or_admin,
) -> dict:
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            item = await conn.fetchrow(
                """SELECT * FROM agent_approval_queue 
                   WHERE id = $1 AND seller_id = $2 FOR UPDATE""",
                item_id,
                user["id"],
            )

            if not item:
                raise HTTPException(
                    status_code=404,
                    detail={"code": "NOT_FOUND", "message": "Queue item not found."},
                )

            if item["status"] != "pending":
                raise HTTPException(
                    status_code=400,
                    detail={"code": "ALREADY_RESOLVED", "message": f"Item already {item['status']}."},
                )

            payload = item["payload"] or {}
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except Exception:
                    payload = {}

            if item["item_type"] == "listing_draft":
                draft = await conn.fetchrow(
                    "SELECT * FROM product_drafts WHERE id = $1",
                    item["reference_id"],
                )

                if draft:
                    raw_title = draft["title"] or "product"
                    base_slug = re.sub(r"[^a-z0-9]+", "-", raw_title.lower()).strip("-")
                    timestamp_suffix = str(int(time.time() * 1000))[-4:]
                    slug = f"{base_slug}-{timestamp_suffix}"
                    price = draft["suggested_price"] or payload.get("suggested_price") or 1999

                    source_images = draft["source_images"] or []
                    if isinstance(source_images, str):
                        try:
                            source_images = json.loads(source_images)
                        except Exception:
                            source_images = []

                    tags = draft["tags"] or []
                    if isinstance(tags, str):
                        try:
                            tags = json.loads(tags)
                        except Exception:
                            tags = []

                    cat_id = "10000000-0000-0000-0000-000000000001"
                    if draft.get("category_id") and str(draft["category_id"]).strip():
                        try:
                            import uuid
                            uuid.UUID(str(draft["category_id"]).strip())
                            cat_id = str(draft["category_id"]).strip()
                        except ValueError:
                            cat_id = "10000000-0000-0000-0000-000000000001"

                    published = await conn.fetchrow(
                        """INSERT INTO products (
                            seller_id, category_id, title, slug, description,
                            price, stock_qty, images, attributes, status
                           )
                           VALUES ($1, $2, $3, $4, $5, $6, 10, $7::jsonb, $8::jsonb, 'active')
                           RETURNING id, title, description""",
                        draft["seller_id"],
                        cat_id,
                        draft["title"],
                        slug,
                        draft["description"],
                        price,
                        json.dumps(source_images),
                        json.dumps({"tags": tags}),
                    )

                    await conn.execute(
                        "UPDATE product_drafts SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                        draft["id"],
                    )

                    # Embedding call via httpx
                    try:
                        async with httpx.AsyncClient(timeout=3.0) as client:
                            emb_resp = await client.post(
                                f"{settings.RECOMMENDATION_SERVICE_URL}/embed",
                                json={"text": f"{published['title']}. {published['description']}"},
                            )
                            if emb_resp.status_code == 200:
                                data = emb_resp.json()
                                if data and data.get("embedding"):
                                    vec_str = "[" + ",".join(map(str, data["embedding"])) + "]"
                                    await conn.execute(
                                        """INSERT INTO product_embeddings (product_id, embedding, model_version)
                                           VALUES ($1, $2::vector, 'all-MiniLM-L6-v2')
                                           ON CONFLICT (product_id) DO UPDATE SET embedding = EXCLUDED.embedding""",
                                        published["id"],
                                        vec_str,
                                    )
                    except Exception as e:
                        print(f"[Approval Publish Embedding Warning] {e}")

            elif item["item_type"] == "support_reply":
                await conn.execute(
                    "UPDATE support_draft_replies SET auto_sent = true WHERE id = $1",
                    item["reference_id"],
                )

            await conn.execute(
                "UPDATE agent_approval_queue SET status = 'approved', resolved_at = CURRENT_TIMESTAMP WHERE id = $1",
                item_id,
            )

    return {
        "success": True,
        "message": f"Item #{item_id[:8]} approved and published successfully.",
    }


class RejectBody(BaseModel):
    reason: str | None = "Rejected by seller"


@router.post("/{item_id}/reject")
async def reject_item(
    item_id: str,
    body: RejectBody = None,
    user: dict = _seller_or_admin,
    db=Depends(get_db),
) -> dict:
    reason_str = (body.reason if body and body.reason else "Rejected by seller")
    seller_edit = json.dumps({"rejection_reason": reason_str})

    row = await db.fetchrow(
        """UPDATE agent_approval_queue 
           SET status = 'rejected', seller_edit = $1::jsonb, resolved_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND seller_id = $3 AND status = 'pending'
           RETURNING id""",
        seller_edit,
        item_id,
        user["id"],
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND_OR_RESOLVED", "message": "Queue item not found or already resolved."},
        )

    return {"success": True, "message": "Agent action rejected."}
