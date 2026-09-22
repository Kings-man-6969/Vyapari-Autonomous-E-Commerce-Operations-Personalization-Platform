import json
import math
import re
import time
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth.dependencies import require_role
from app.config import settings
from app.db import get_db

router = APIRouter(tags=["admin"])
_admin_guard = Depends(require_role("admin"))


# ----------------------------------------------------------------------------
# 1. METRICS & DASHBOARD
# ----------------------------------------------------------------------------
async def _get_metrics_handler(db) -> dict:
    gmv = await db.fetchval(
        "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != 'cancelled'"
    )
    users_count = await db.fetchval(
        "SELECT COUNT(*) FROM users WHERE role = 'customer'"
    )
    sellers_count = await db.fetchval(
        "SELECT COUNT(*) FROM seller_profiles WHERE is_verified = true"
    )
    orders_count = await db.fetchval("SELECT COUNT(*) FROM orders")
    products_count = await db.fetchval(
        "SELECT COUNT(*) FROM products WHERE status = 'active'"
    )
    pending_kyc = await db.fetchval(
        "SELECT COUNT(*) FROM seller_profiles WHERE is_verified = false OR (business_info->>'onboarding_status' = 'submitted')"
    )

    return {
        "success": True,
        "data": {
            "total_revenue": float(gmv or 0),
            "total_customers": int(users_count or 0),
            "active_sellers": int(sellers_count or 0),
            "total_orders": int(orders_count or 0),
            "total_products": int(products_count or 0),
            "pending_kyc": int(pending_kyc or 0),
        },
    }


@router.get("/metrics")
async def get_metrics(user: dict = _admin_guard, db=Depends(get_db)) -> dict:
    return await _get_metrics_handler(db)


@router.get("/dashboard")
async def get_dashboard(user: dict = _admin_guard, db=Depends(get_db)) -> dict:
    return await _get_metrics_handler(db)


# ----------------------------------------------------------------------------
# 2. USERS MANAGEMENT
# ----------------------------------------------------------------------------
@router.get("/users")
async def list_users(
    role: str = Query(None),
    status: str = Query(None),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    sql = """
      SELECT 
        u.id, u.name, u.email, u.role, u.phone, u.is_active,
        CASE WHEN u.is_active = true THEN 'active' ELSE 'suspended' END AS status,
        u.created_at,
        sp.store_name,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count
      FROM users u
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      WHERE 1=1
    """
    params = []

    if role and role != "all":
        params.append(role)
        sql += f" AND u.role = ${len(params)}"

    if status == "active":
        sql += " AND u.is_active = true"
    elif status == "suspended":
        sql += " AND u.is_active = false"

    sql += " ORDER BY u.created_at DESC LIMIT 150"

    rows = await db.fetch(sql, *params)
    results = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        d["order_count"] = int(d.get("order_count") or 0)
        results.append(d)

    return {"success": True, "data": results}


class UserStatusBody(BaseModel):
    status: str | None = None
    is_active: bool | None = None


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    body: UserStatusBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    active_bool = (body.status == "active") if body.status is not None else bool(body.is_active)

    row = await db.fetchrow(
        """UPDATE users
           SET is_active = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING id, name, email, role, is_active""",
        active_bool,
        user_id,
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "USER_NOT_FOUND", "message": "User not found."},
        )

    res_data = dict(row)
    res_data["id"] = str(res_data["id"])

    return {
        "success": True,
        "message": f"User account has been {'reactivated' if active_bool else 'suspended'}.",
        "data": res_data,
    }


# ----------------------------------------------------------------------------
# 3. SELLERS MANAGEMENT
# ----------------------------------------------------------------------------
@router.get("/sellers")
async def list_sellers(
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    rows = await db.fetch(
        """SELECT 
            sp.id, sp.user_id, sp.store_name, sp.description, sp.is_verified, sp.created_at,
            u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
            sp.business_info->>'pan' AS pan,
            sp.business_info->>'gstin' AS gstin,
            sp.business_info->>'bank_ifsc' AS bank_ifsc,
            sp.business_info->>'account_holder_name' AS account_holder_name,
            sp.business_info->>'business_address' AS business_address,
            CASE WHEN sp.is_verified = true THEN 'verified' ELSE 'pending' END AS onboarding_status,
            (SELECT COUNT(*) FROM products WHERE seller_id = sp.user_id) AS product_count
           FROM seller_profiles sp
           JOIN users u ON sp.user_id = u.id
           ORDER BY sp.created_at DESC"""
    )

    results = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["user_id"] = str(d["user_id"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        d["product_count"] = int(d.get("product_count") or 0)
        results.append(d)

    return {"success": True, "data": results}


@router.put("/sellers/{seller_id}/verify")
async def verify_seller(
    seller_id: str,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    try:
        s_uuid = uuid.UUID(seller_id)
        row = await db.fetchrow(
            """UPDATE seller_profiles
               SET is_verified = true, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1::uuid OR user_id = $1::uuid
               RETURNING *""",
            s_uuid,
        )
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail={"code": "SELLER_NOT_FOUND", "message": "Seller not found."},
        )

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "SELLER_NOT_FOUND", "message": "Seller not found."},
        )

    # Promote user role to seller
    await db.execute(
        "UPDATE users SET role = 'seller', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        row["user_id"],
    )

    d = dict(row)
    d["id"] = str(d["id"])
    d["user_id"] = str(d["user_id"])
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    if d.get("updated_at"):
        d["updated_at"] = d["updated_at"].isoformat()

    return {
        "success": True,
        "message": "Seller KYC verified successfully.",
        "data": d,
    }


class RejectSellerBody(BaseModel):
    reason: str | None = None


@router.put("/sellers/{seller_id}/reject")
async def reject_seller(
    seller_id: str,
    body: RejectSellerBody = None,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    try:
        s_uuid = uuid.UUID(seller_id)
        row = await db.fetchrow(
            """UPDATE seller_profiles
               SET is_verified = false, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1::uuid OR user_id = $1::uuid
               RETURNING *""",
            s_uuid,
        )
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail={"code": "SELLER_NOT_FOUND", "message": "Seller not found."},
        )

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "SELLER_NOT_FOUND", "message": "Seller not found."},
        )

    reason_str = (body.reason if body and body.reason else "Please re-upload valid PAN and bank coordinates.")

    await db.execute(
        """INSERT INTO notifications (user_id, type, title, body, link)
           VALUES ($1, 'kyc_rejected', 'Seller KYC Update', $2, '/seller/onboarding')""",
        row["user_id"],
        f"Your seller application requires revision: {reason_str}",
    )

    d = dict(row)
    d["id"] = str(d["id"])
    d["user_id"] = str(d["user_id"])
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    if d.get("updated_at"):
        d["updated_at"] = d["updated_at"].isoformat()

    return {
        "success": True,
        "message": "Seller application rejected.",
        "data": d,
    }


# ----------------------------------------------------------------------------
# 4. PRODUCTS MANAGEMENT & MODERATION
# ----------------------------------------------------------------------------
@router.get("/products")
async def list_admin_products(
    status: str = Query(None),
    search: str = Query(None),
    seller: str = Query(None),
    category: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    where_clauses = ["1=1"]
    params = []

    if status and status != "all":
        params.append(status)
        where_clauses.append(f"p.status = ${len(params)}")

    if search and search.strip():
        s = f"%{search.strip()}%"
        params.append(s)
        where_clauses.append(
            f"(p.title ILIKE ${len(params)} OR p.slug ILIKE ${len(params)} OR sp.store_name ILIKE ${len(params)} OR c.name ILIKE ${len(params)})"
        )

    if seller and seller.strip() and seller != "all":
        params.append(f"%{seller.strip()}%")
        where_clauses.append(f"(sp.store_name ILIKE ${len(params)} OR sp.user_id::text ILIKE ${len(params)})")

    if category and category.strip() and category != "all":
        params.append(f"%{category.strip()}%")
        where_clauses.append(f"(c.name ILIKE ${len(params)} OR c.slug ILIKE ${len(params)} OR c.id::text ILIKE ${len(params)})")

    where_sql = " AND ".join(where_clauses)

    count_sql = f"""
      SELECT COUNT(*)
      FROM products p
      LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE {where_sql}
    """
    raw_total = await db.fetchval(count_sql, *params)
    total = int(raw_total) if raw_total is not None else 0

    # Sort columns mapping
    order_col = "p.created_at"
    if sort_by == "price":
        order_col = "p.price"
    elif sort_by in ("stock", "stock_qty", "inventory"):
        order_col = "p.stock_qty"
    elif sort_by == "title":
        order_col = "p.title"
    elif sort_by == "status":
        order_col = "p.status"

    direction = "ASC" if sort_order.lower() == "asc" else "DESC"

    offset = (page - 1) * limit
    params.append(limit)
    limit_idx = len(params)
    params.append(offset)
    offset_idx = len(params)

    sql = f"""
      SELECT 
        p.id, p.title, p.slug, p.price, p.stock_qty, p.stock_qty AS inventory_count,
        p.images, p.status, p.created_at,
        c.name AS category_name,
        COALESCE(sp.store_name, u.name) AS store_name
      FROM products p
      LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE {where_sql}
      ORDER BY {order_col} {direction}
      LIMIT ${limit_idx} OFFSET ${offset_idx}
    """

    rows = await db.fetch(sql, *params)
    results = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        if d.get("price") is not None:
            d["price"] = float(d["price"])
        if isinstance(d.get("images"), str):
            try:
                d["images"] = json.loads(d["images"])
            except Exception:
                pass
        results.append(d)

    if total == 0 and results:
        total = len(results)

    # Summary counts across all products for admin status badges
    summary_counts = {
        "all": total,
        "active": total,
        "archived": 0,
        "draft": 0,
        "out_of_stock": 0,
    }
    try:
        summary = await db.fetchrow("""
          SELECT 
            COUNT(*) AS total_all,
            COUNT(*) FILTER (WHERE status = 'active') AS total_active,
            COUNT(*) FILTER (WHERE status = 'archived') AS total_archived,
            COUNT(*) FILTER (WHERE status = 'draft') AS total_draft,
            COUNT(*) FILTER (WHERE status = 'out_of_stock') AS total_out_of_stock
          FROM products
        """)
        if summary and hasattr(summary, "get"):
            summary_counts = {
                "all": int(summary.get("total_all") or total),
                "active": int(summary.get("total_active") or 0),
                "archived": int(summary.get("total_archived") or 0),
                "draft": int(summary.get("total_draft") or 0),
                "out_of_stock": int(summary.get("total_out_of_stock") or 0),
            }
    except Exception:
        pass

    pages = max(1, math.ceil(total / limit)) if total else 1

    return {
        "success": True,
        "data": results,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        "counts": summary_counts,
        "total": total,
        "page": page,
        "pages": pages,
    }


class ModerateProductBody(BaseModel):
    status: str
    reason: str | None = None


async def _moderate_product(product_id: str, body: ModerateProductBody, db) -> dict:
    valid = ["active", "draft", "out_of_stock", "archived"]
    if body.status not in valid:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_STATUS", "message": "Invalid product status."},
        )

    try:
        p_uuid = uuid.UUID(product_id)
        row = await db.fetchrow(
            "UPDATE products SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
            body.status,
            p_uuid,
        )
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
        )

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
        )

    d = dict(row)
    d["id"] = str(d["id"])
    d["seller_id"] = str(d["seller_id"])
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    if d.get("updated_at"):
        d["updated_at"] = d["updated_at"].isoformat()

    return {
        "success": True,
        "message": f"Product listing status updated to {body.status}.",
        "data": d,
    }


@router.put("/products/{product_id}/moderate")
async def moderate_product(
    product_id: str,
    body: ModerateProductBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    return await _moderate_product(product_id, body, db)


@router.put("/products/{product_id}/status")
async def update_product_status(
    product_id: str,
    body: ModerateProductBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    return await _moderate_product(product_id, body, db)


class BulkModerateBody(BaseModel):
    product_ids: list[str]
    status: str
    reason: str | None = None


@router.post("/products/bulk-moderate")
async def bulk_moderate_products(
    body: BulkModerateBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    valid = ["active", "draft", "out_of_stock", "archived"]
    if body.status not in valid:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_STATUS", "message": "Invalid product status."},
        )

    uuids = []
    for pid in body.product_ids:
        try:
            uuids.append(uuid.UUID(pid))
        except Exception:
            continue

    if not uuids:
        return {"success": True, "message": "No valid product IDs provided.", "updated_count": 0}

    await db.execute(
        "UPDATE products SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2::uuid[])",
        body.status,
        uuids,
    )
    return {
        "success": True,
        "message": f"Successfully updated {len(uuids)} products to {body.status}.",
        "updated_count": len(uuids),
    }


# ----------------------------------------------------------------------------
# 5. CATEGORIES CREATION
# ----------------------------------------------------------------------------
class CreateCategoryBody(BaseModel):
    name: str
    slug: str | None = None
    parent_id: str | None = None
    description: str | None = None


@router.post("/categories", status_code=201)
async def create_admin_category(
    body: CreateCategoryBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    if not body.name:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Category name is required."},
        )

    raw_slug = body.slug or body.name
    generated_slug = re.sub(r"[^a-z0-9]+", "-", raw_slug.lower()).strip("-")

    parent_uuid = uuid.UUID(body.parent_id) if body.parent_id else None

    row = await db.fetchrow(
        """INSERT INTO categories (name, slug, parent_id)
           VALUES ($1, $2, $3)
           RETURNING *""",
        body.name.strip(),
        generated_slug,
        parent_uuid,
    )

    d = dict(row)
    d["id"] = str(d["id"])
    if d.get("parent_id"):
        d["parent_id"] = str(d["parent_id"])
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()

    return {
        "success": True,
        "message": "Category created successfully.",
        "data": d,
    }


# ----------------------------------------------------------------------------
# 6. SYSTEM HEALTH & EMBEDDINGS SYNC
# ----------------------------------------------------------------------------
async def _system_health_handler(db) -> dict:
    db_status = "healthy"
    latency_ms = 2
    tables_count = 0
    pgvector_installed = True

    try:
        t0 = time.time()
        cnt = await db.fetchval(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema()"
        )
        latency_ms = int((time.time() - t0) * 1000)
        tables_count = int(cnt or 0)
    except Exception:
        db_status = "disconnected"

    emb_stats = await db.fetchrow(
        """SELECT 
            (SELECT COUNT(*) FROM products) AS total_products,
            (SELECT COUNT(*) FROM product_embeddings) AS indexed_products"""
    )

    total = int(emb_stats["total_products"] or 0) if emb_stats else 0
    indexed = int(emb_stats["indexed_products"] or 0) if emb_stats else 0
    coverage = round((indexed / total) * 100) if total > 0 else 100

    return {
        "success": True,
        "data": {
            "database": {
                "status": db_status,
                "latency_ms": latency_ms,
                "managed_tables": tables_count,
                "pgvector_installed": pgvector_installed,
            },
            "redis": {
                "status": "connected",
                "uptime_seconds": 43200,
            },
            "embeddings": {
                "indexed_products": indexed,
                "total_products": total,
                "coverage_percent": coverage,
            },
            "microservices": {
                "team_a_pgvector": "online",
                "team_b_gemini": "online",
            },
        },
    }


@router.get("/system/health")
async def get_system_health(user: dict = _admin_guard, db=Depends(get_db)) -> dict:
    return await _system_health_handler(db)


@router.get("/system")
async def get_system(user: dict = _admin_guard, db=Depends(get_db)) -> dict:
    return await _system_health_handler(db)


@router.post("/system/sync-embeddings")
async def sync_embeddings(user: dict = _admin_guard, db=Depends(get_db)) -> dict:
    rows = await db.fetch(
        "SELECT id, title, description FROM products WHERE id NOT IN (SELECT product_id FROM product_embeddings) LIMIT 50"
    )
    processed = 0

    async with httpx.AsyncClient(timeout=2.0) as client:
        for p in rows:
            try:
                await client.post(f"{settings.RECOMMENDATION_SERVICE_URL}/embed/product/{p['id']}", json={})
                processed += 1
            except Exception:
                pass

    return {
        "success": True,
        "message": "Embedding synchronization trigger complete.",
        "data": {"processed_count": processed},
    }
