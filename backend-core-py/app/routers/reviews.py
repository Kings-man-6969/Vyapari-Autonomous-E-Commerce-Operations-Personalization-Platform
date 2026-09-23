import asyncio
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import optional_auth, require_auth, require_role
from app.db import get_db, get_pool
from app.redis_client import cache

router = APIRouter(tags=["reviews"])
_seller_or_admin = Depends(require_role(["seller", "admin"]))


# ----------------------------------------------------------------------------
# 1. PUBLIC: GET /api/reviews/product/:productId
# ----------------------------------------------------------------------------
@router.get("/product/{product_id}")
async def get_product_reviews(
    product_id: str,
    user: dict | None = Depends(optional_auth),
    db=Depends(get_db),
) -> dict:
    try:
        p_uuid = uuid.UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Invalid product ID"})

    rows = await db.fetch(
        """SELECT 
            r.id,
            r.product_id,
            r.rating,
            r.title,
            r.comment,
            r.is_verified_purchase,
            r.seller_reply,
            r.seller_reply_at,
            COALESCE(r.helpful_count, 0) AS helpful_count,
            r.created_at,
            u.id AS reviewer_id,
            u.name AS reviewer_name,
            p.title AS product_title,
            sp.store_name
           FROM reviews r
           JOIN users u ON r.user_id = u.id
           JOIN products p ON r.product_id = p.id
           LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
           WHERE r.product_id = $1::uuid
           ORDER BY r.created_at DESC""",
        p_uuid,
    )

    reviews = []
    breakdown = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    sum_rating = 0

    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["product_id"] = str(d["product_id"])
        d["reviewer_id"] = str(d["reviewer_id"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        if d.get("seller_reply_at"):
            d["seller_reply_at"] = d["seller_reply_at"].isoformat()

        rt = d.get("rating", 0)
        if rt in breakdown:
            breakdown[rt] += 1
        sum_rating += rt
        reviews.append(d)

    total = len(reviews)
    avg = round(sum_rating / total, 1) if total > 0 else 0.0

    return {
        "success": True,
        "data": {
            "total": total,
            "average_rating": avg,
            "breakdown": breakdown,
            "reviews": reviews,
        },
    }


# ----------------------------------------------------------------------------
# 2. SELLER: GET /api/reviews/seller
# (Put BEFORE /{review_id} routes to prevent path conflict)
# ----------------------------------------------------------------------------
@router.get("/seller")
async def get_seller_reviews(
    user: dict = _seller_or_admin,
    db=Depends(get_db),
) -> dict:
    is_seller = user["role"] == "seller"
    if is_seller:
        sql = """SELECT 
            r.id,
            r.product_id,
            r.rating,
            r.title,
            r.comment,
            r.is_verified_purchase,
            r.seller_reply,
            r.seller_reply_at,
            r.created_at,
            u.name AS reviewer_name,
            p.title AS product_title,
            p.images AS product_images,
            sp.store_name
           FROM reviews r
           JOIN products p ON r.product_id = p.id
           JOIN users u ON r.user_id = u.id
           LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
           WHERE p.seller_id = $1::uuid
           ORDER BY r.created_at DESC"""
        rows = await db.fetch(sql, uuid.UUID(user["id"]))
    else:
        sql = """SELECT 
            r.id,
            r.product_id,
            r.rating,
            r.title,
            r.comment,
            r.is_verified_purchase,
            r.seller_reply,
            r.seller_reply_at,
            r.created_at,
            u.name AS reviewer_name,
            p.title AS product_title,
            p.images AS product_images,
            sp.store_name
           FROM reviews r
           JOIN products p ON r.product_id = p.id
           JOIN users u ON r.user_id = u.id
           LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
           ORDER BY r.created_at DESC"""
        rows = await db.fetch(sql)

    reviews = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["product_id"] = str(d["product_id"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        if d.get("seller_reply_at"):
            d["seller_reply_at"] = d["seller_reply_at"].isoformat()
        if isinstance(d.get("product_images"), str):
            try:
                d["product_images"] = json.loads(d["product_images"])
            except Exception:
                pass
        reviews.append(d)

    return {
        "success": True,
        "data": {
            "total": len(reviews),
            "reviews": reviews,
        },
    }


# ----------------------------------------------------------------------------
# 3. CUSTOMER: POST /api/reviews
# ----------------------------------------------------------------------------
class CreateReviewBody(BaseModel):
    product_id: str | None = None
    rating: int | None = None
    title: str | None = ""
    comment: str | None = None


@router.post("", status_code=201)
@router.post("/", status_code=201)
async def create_review(
    body: CreateReviewBody,
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    if not body.product_id or body.rating is None or not body.comment:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Product ID, rating (1-5), and review comment are required.",
            },
        )

    num_rating = int(body.rating)
    if num_rating < 1 or num_rating > 5:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_RATING", "message": "Rating must be an integer between 1 and 5."},
        )

    try:
        p_uuid = uuid.UUID(body.product_id)
    except ValueError:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Product not found."})

    product = await db.fetchrow(
        "SELECT id, title, seller_id FROM products WHERE id = $1::uuid",
        p_uuid,
    )
    if not product:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Product not found."},
        )

    u_uuid = uuid.UUID(user["id"])
    purchase_check = await db.fetchrow(
        """SELECT oi.id, o.id AS order_id
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE oi.product_id = $1::uuid AND o.user_id = $2::uuid AND o.status = 'delivered'
           LIMIT 1""",
        p_uuid,
        u_uuid,
    )

    is_verified_purchase = purchase_check is not None
    order_id = purchase_check["order_id"] if purchase_check else None

    review_row = await db.fetchrow(
        """INSERT INTO reviews (product_id, order_id, user_id, rating, title, comment, is_verified_purchase, created_at)
           VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT (product_id, user_id)
           DO UPDATE SET 
             rating = EXCLUDED.rating, 
             title = EXCLUDED.title, 
             comment = EXCLUDED.comment,
             is_verified_purchase = EXCLUDED.is_verified_purchase,
             created_at = CURRENT_TIMESTAMP
           RETURNING *""",
        p_uuid,
        order_id,
        u_uuid,
        num_rating,
        body.title or "",
        body.comment.strip(),
        is_verified_purchase,
    )

    # Fire and forget notification to seller
    pool = get_pool()

    async def _send_notif():
        try:
            await pool.execute(
                """INSERT INTO notifications (user_id, type, title, body, link)
                   VALUES ($1::uuid, 'customer_review', $2, $3, $4)""",
                product["seller_id"],
                f"New {num_rating}★ Review on {product['title']}",
                f"{user.get('name') or 'A customer'} reviewed \"{product['title']}\": \"{body.comment[:100]}...\"",
                f"/products/{product['id']}",
            )
        except Exception:
            pass

    asyncio.create_task(_send_notif())

    saved = dict(review_row)
    saved["id"] = str(saved["id"])
    saved["product_id"] = str(saved["product_id"])
    saved["user_id"] = str(saved["user_id"])
    if saved.get("order_id"):
        saved["order_id"] = str(saved["order_id"])
    if saved.get("created_at"):
        saved["created_at"] = saved["created_at"].isoformat()
    if saved.get("seller_reply_at"):
        saved["seller_reply_at"] = saved["seller_reply_at"].isoformat()
    saved["reviewer_name"] = user.get("name")

    # Broadened invalidation for review creation (rating/popularity/similarity changes)
    p_id_str = str(product["id"]).lower()
    await cache.delete(f"product:detail:{p_id_str}")
    await cache.delete_prefix("search:")
    await cache.delete_prefix("products:popular:")
    await cache.delete_prefix(f"products:similar:{p_id_str}:")
    await cache.delete_prefix("recommendations:")

    return {
        "success": True,
        "data": {"review": saved},
    }


# ----------------------------------------------------------------------------
# 4. SELLER: POST /api/reviews/:reviewId/reply
# ----------------------------------------------------------------------------
class ReplyBody(BaseModel):
    reply: str | None = None


@router.post("/{review_id}/reply")
async def reply_review(
    review_id: str,
    body: ReplyBody,
    user: dict = _seller_or_admin,
    db=Depends(get_db),
) -> dict:
    if not body.reply or not body.reply.strip():
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Reply text cannot be empty."},
        )

    try:
        r_uuid = uuid.UUID(review_id)
    except ValueError:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Review not found."})

    review = await db.fetchrow(
        """SELECT r.*, p.title AS product_title, p.seller_id, u.name AS reviewer_name, u.id AS reviewer_id, sp.store_name
           FROM reviews r
           JOIN products p ON r.product_id = p.id
           JOIN users u ON r.user_id = u.id
           LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
           WHERE r.id = $1::uuid""",
        r_uuid,
    )

    if not review:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Review not found."},
        )

    if user["role"] != "admin" and str(review["seller_id"]) != str(user["id"]):
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "You can only reply to reviews on your own products."},
        )

    updated = await db.fetchrow(
        """UPDATE reviews 
           SET seller_reply = $1, seller_reply_at = CURRENT_TIMESTAMP
           WHERE id = $2::uuid
           RETURNING *""",
        body.reply.strip(),
        r_uuid,
    )

    pool = get_pool()

    async def _send_reply_notif():
        try:
            await pool.execute(
                """INSERT INTO notifications (user_id, type, title, body, link)
                   VALUES ($1::uuid, 'seller_reply', $2, $3, $4)""",
                review["reviewer_id"],
                f"{review['store_name'] or 'Seller'} replied to your review",
                f"Response to your review on {review['product_title']}: \"{body.reply[:100]}...\"",
                f"/products/{review['product_id']}",
            )
        except Exception:
            pass

    asyncio.create_task(_send_reply_notif())

    reply_at = updated["seller_reply_at"].isoformat() if updated["seller_reply_at"] else None

    return {
        "success": True,
        "data": {
            "review_id": review_id,
            "seller_reply": updated["seller_reply"],
            "seller_reply_at": reply_at,
            "store_name": review["store_name"],
        },
    }


# ----------------------------------------------------------------------------
# 5. PUBLIC: POST /api/reviews/:reviewId/helpful
# ----------------------------------------------------------------------------
@router.post("/{review_id}/helpful")
async def upvote_helpful(
    review_id: str,
    db=Depends(get_db),
) -> dict:
    try:
        r_uuid = uuid.UUID(review_id)
    except ValueError:
        raise HTTPException(status_code=404, detail={"message": "Review not found."})

    result = await db.fetchrow(
        """UPDATE reviews 
           SET helpful_count = COALESCE(helpful_count, 0) + 1 
           WHERE id = $1::uuid 
           RETURNING helpful_count""",
        r_uuid,
    )

    if not result:
        raise HTTPException(status_code=404, detail={"message": "Review not found."})

    return {
        "success": True,
        "data": {"helpful_count": result["helpful_count"]},
    }
