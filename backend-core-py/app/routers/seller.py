"""
Seller — port of backend-core/src/routes/seller.js (658 lines)

All seller-specific endpoints including onboarding, dashboard, products CRUD,
orders, inventory, AI chat copilot, and store settings.
"""
import asyncio
import json
import time
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import require_auth, require_role
from app.config import settings
from app.db import get_db, get_pool

router = APIRouter()

# All routes require authentication
_auth = Depends(require_auth)
_seller_or_admin = Depends(require_role(["seller", "admin"]))


# ── Onboarding (accessible to any authenticated user) ────────────────────────

@router.get("/onboarding/status")
async def onboarding_status(user: dict = _auth, db=Depends(get_db)) -> dict:
    row = await db.fetchrow(
        """SELECT sp.*, u.role FROM seller_profiles sp
           RIGHT JOIN users u ON sp.user_id = u.id
           WHERE u.id = $1""",
        user["id"],
    )

    if not row or not row["store_name"]:
        return {"success": True, "data": {"onboarding_status": "not_started"}}

    b_info = row["business_info"] or {}
    if isinstance(b_info, str):
        b_info = json.loads(b_info)
    pan = b_info.get("pan", "")
    masked_pan = f"{pan[:2]}******{pan[-2:]}" if len(pan) >= 4 else "XXXXXXXXXX"

    return {
        "success": True,
        "data": {
            "onboarding_status": "verified" if row["is_verified"] else "submitted",
            "store_name": row["store_name"],
            "pan_masked": masked_pan,
        },
    }


class OnboardingBody(BaseModel):
    store_name: str
    store_description: str | None = None
    business_address: str
    pan: str
    gstin: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    account_holder_name: str | None = None
    primary_category_id: str | None = None


@router.post("/onboarding")
@router.post("/onboarding/submit")
async def submit_onboarding(body: OnboardingBody, user: dict = _auth) -> dict:
    business_info = {
        "business_address": body.business_address.strip(),
        "pan": body.pan.strip().upper(),
        "gstin": body.gstin.strip().upper() if body.gstin else "",
        "bank_account_number": body.bank_account_number.strip() if body.bank_account_number else "",
        "bank_ifsc": body.bank_ifsc.strip().upper() if body.bank_ifsc else "",
        "account_holder_name": body.account_holder_name.strip() if body.account_holder_name else "",
        "primary_category_id": body.primary_category_id,
    }

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            profile = await conn.fetchrow(
                """INSERT INTO seller_profiles (user_id, store_name, description, business_info, is_verified)
                   VALUES ($1, $2, $3, $4::jsonb, true)
                   ON CONFLICT (user_id) DO UPDATE
                   SET store_name = EXCLUDED.store_name,
                       description = EXCLUDED.description,
                       business_info = EXCLUDED.business_info,
                       is_verified = true,
                       updated_at = CURRENT_TIMESTAMP
                   RETURNING *""",
                user["id"],
                body.store_name.strip(),
                body.store_description or "",
                json.dumps(business_info),
            )
            # Upgrade role to seller if currently customer
            await conn.execute(
                "UPDATE users SET role = 'seller', updated_at = CURRENT_TIMESTAMP "
                "WHERE id = $1 AND role = 'customer'",
                user["id"],
            )

    return {
        "success": True,
        "message": "Seller onboarding completed successfully.",
        "data": {"profile": dict(profile), "onboarding_status": "verified"},
    }


# ── Seller-only routes ────────────────────────────────────────────────────────

@router.get("/dashboard")
async def seller_dashboard(user: dict = _seller_or_admin, db=Depends(get_db)) -> dict:
    seller_id = user["id"]
    stats, pending, recent, low_stock = await asyncio.gather(
        db.fetchrow(
            """SELECT
                COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) AS total_revenue,
                COUNT(DISTINCT oi.order_id) AS total_orders,
                COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS active_products_count
               FROM products p
               LEFT JOIN order_items oi ON p.id = oi.product_id
               WHERE p.seller_id = $1""",
            seller_id,
        ),
        db.fetchrow(
            "SELECT COUNT(*) AS count FROM agent_approval_queue WHERE seller_id = $1 AND status = 'pending'",
            seller_id,
        ),
        db.fetch(
            """SELECT DISTINCT o.id, o.total_amount, o.status, o.created_at, u.name AS customer_name
               FROM orders o
               JOIN order_items oi ON o.id = oi.order_id
               JOIN users u ON o.user_id = u.id
               WHERE oi.seller_id = $1
               ORDER BY o.created_at DESC LIMIT 5""",
            seller_id,
        ),
        db.fetch(
            """SELECT id, title, stock_qty, price FROM products
               WHERE seller_id = $1 AND stock_qty <= 5 AND status != 'archived'
               ORDER BY stock_qty ASC LIMIT 5""",
            seller_id,
        ),
    )

    return {
        "success": True,
        "data": {
            "stats": {
                "total_revenue": float(stats["total_revenue"]) if stats and "total_revenue" in stats else 0.0,
                "total_orders": int(stats["total_orders"]) if stats and "total_orders" in stats else 0,
                "active_products": int(stats["active_products_count"]) if stats and "active_products_count" in stats else 0,
                "pending_approvals": int(pending["count"]) if pending and "count" in pending else (int(pending) if isinstance(pending, (int, float)) else 0),
            },
            "recent_orders": [dict(r) for r in recent],
            "low_stock_alerts": [dict(r) for r in low_stock],
        },
    }


@router.get("/products")
async def seller_products(
    status: str | None = None,
    user: dict = _seller_or_admin,
    db=Depends(get_db),
) -> dict:
    sql = """
        SELECT p.id, p.title, p.slug, p.description, p.price, p.compare_at_price,
               p.stock_qty, p.stock_qty AS inventory_count, p.images, p.status, p.created_at,
               c.name AS category_name, c.id AS category_id,
               p.attributes->>'cost_price' AS cost_price,
               p.attributes->>'sku' AS sku,
               p.attributes->'tags' AS tags
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.seller_id = $1
    """
    params: list = [user["id"]]
    if status and status != "all":
        params.append(status)
        sql += f" AND p.status = ${len(params)}"
    sql += " ORDER BY p.created_at DESC"

    rows = await db.fetch(sql, *params)
    return {"success": True, "data": [dict(r) for r in rows]}


class CreateSellerProductBody(BaseModel):
    title: str
    slug: str | None = None
    description: str | None = None
    price: float
    compare_at_price: float | None = None
    cost_price: float | None = None
    inventory_count: int = 0
    category_id: str
    images: list = []
    tags: list | str = []
    status: str | None = None


@router.post("/products", status_code=201)
async def create_seller_product(
    body: CreateSellerProductBody, user: dict = _seller_or_admin, db=Depends(get_db)
) -> dict:
    base = re.sub(r"[^a-z0-9]+", "-", (body.slug or body.title).lower()).strip("-")
    final_slug = f"{base}-{str(int(time.time() * 1000))[-4:]}"
    stock = body.inventory_count
    final_status = body.status or ("active" if stock > 0 else "out_of_stock")
    tags = body.tags if isinstance(body.tags, list) else [t.strip() for t in body.tags.split(",") if t.strip()]
    attributes = {"cost_price": body.cost_price, "tags": tags}

    row = await db.fetchrow(
        """INSERT INTO products
           (seller_id, category_id, title, slug, description, price, compare_at_price,
            stock_qty, images, attributes, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
           RETURNING *""",
        user["id"],
        body.category_id,
        body.title.strip(),
        final_slug,
        body.description or "",
        body.price,
        body.compare_at_price,
        stock,
        json.dumps(body.images),
        json.dumps(attributes),
        final_status,
    )
    product = dict(row)

    # Background embedding trigger
    asyncio.ensure_future(
        _trigger_embedding(str(product["id"]))
    )

    return {"success": True, "message": "Product created successfully.", "data": product}


async def _trigger_embedding(product_id: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(f"{settings.RECOMMENDATION_SERVICE_URL}/embed/product/{product_id}")
    except Exception:
        pass


@router.get("/products/{id}")
async def get_seller_product(id: str, user: dict = _seller_or_admin, db=Depends(get_db)) -> dict:
    is_uuid = bool(re.match(r"^[0-9a-f-]{36}$", id, re.IGNORECASE))
    cond = "p.id = $1::uuid" if is_uuid else "p.slug = $1"
    row = await db.fetchrow(
        f"""SELECT p.*, p.stock_qty AS inventory_count, c.name AS category_name,
                p.attributes->>'cost_price' AS cost_price,
                p.attributes->'tags' AS tags
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           WHERE {cond} AND (p.seller_id = $2 OR $3 = 'admin')""",
        id,
        user["id"],
        user["role"],
    )
    if not row:
        raise HTTPException(404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."})
    return {"success": True, "data": dict(row)}


class UpdateSellerProductBody(BaseModel):
    title: str | None = None
    slug: str | None = None
    description: str | None = None
    price: float | None = None
    compare_at_price: float | None = None
    cost_price: float | None = None
    inventory_count: int | None = None
    category_id: str | None = None
    images: list | None = None
    tags: list | str | None = None
    status: str | None = None


@router.put("/products/{id}")
async def update_seller_product(
    id: str, body: UpdateSellerProductBody, user: dict = _seller_or_admin, db=Depends(get_db)
) -> dict:
    cur_row = await db.fetchrow(
        "SELECT * FROM products WHERE id = $1 AND (seller_id = $2 OR $3 = 'admin')",
        id, user["id"], user["role"],
    )
    if not cur_row:
        raise HTTPException(404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."})

    cur = dict(cur_row)
    new_stock = body.inventory_count if body.inventory_count is not None else cur["stock_qty"]
    new_status = body.status or ("out_of_stock" if new_stock == 0 else cur["status"])
    cur_attrs = cur["attributes"] or {}
    if isinstance(cur_attrs, str):
        cur_attrs = json.loads(cur_attrs)

    tags = body.tags
    if tags is not None:
        tags = tags if isinstance(tags, list) else [t.strip() for t in tags.split(",") if t.strip()]

    updated_attrs = {
        **cur_attrs,
        "cost_price": body.cost_price if body.cost_price is not None else cur_attrs.get("cost_price"),
        "tags": tags if tags is not None else cur_attrs.get("tags"),
    }

    row = await db.fetchrow(
        """UPDATE products
           SET title = COALESCE($1, title),
               slug = COALESCE($2, slug),
               description = COALESCE($3, description),
               price = COALESCE($4, price),
               compare_at_price = $5,
               stock_qty = $6,
               category_id = COALESCE($7, category_id),
               images = COALESCE($8::jsonb, images),
               attributes = $9::jsonb,
               status = $10,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $11
           RETURNING *""",
        body.title.strip() if body.title else None,
        body.slug.strip() if body.slug else None,
        body.description if body.description is not None else None,
        body.price,
        body.compare_at_price,
        new_stock,
        body.category_id,
        json.dumps(body.images) if body.images is not None else None,
        json.dumps(updated_attrs),
        new_status,
        id,
    )
    return {"success": True, "message": "Product updated successfully.", "data": dict(row)}


@router.get("/orders")
async def seller_orders(status: str | None = None, user: dict = _seller_or_admin, db=Depends(get_db)) -> dict:
    sql = """
        SELECT o.id, o.status, o.created_at, o.total_amount,
               COALESCE(o.shipping_address->>'full_name', o.shipping_address->>'name', u.name) AS customer_name,
               COALESCE(o.shipping_address->>'city', 'N/A') AS shipping_city,
               COALESCE(o.shipping_address->>'state', 'N/A') AS shipping_state,
               u.email AS customer_email,
               SUM(oi.quantity * oi.price_at_purchase) AS seller_subtotal,
               json_agg(json_build_object(
                 'order_item_id', oi.id,
                 'product_id', oi.product_id,
                 'product_title', p.title,
                 'quantity', oi.quantity,
                 'unit_price', oi.price_at_purchase
               )) AS items
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        JOIN users u ON o.user_id = u.id
        WHERE oi.seller_id = $1
    """
    params: list = [user["id"]]
    if status and status != "all":
        params.append(status)
        sql += f" AND o.status = ${len(params)}"
    sql += " GROUP BY o.id, o.shipping_address, u.name, u.email ORDER BY o.created_at DESC"

    rows = await db.fetch(sql, *params)
    return {"success": True, "data": [dict(r) for r in rows]}


class FulfillOrderBody(BaseModel):
    status: str
    tracking_number: str | None = None
    carrier: str | None = None


@router.put("/orders/{id}/fulfill")
@router.put("/orders/{id}/status")
async def fulfill_order(id: str, body: FulfillOrderBody, user: dict = _seller_or_admin, db=Depends(get_db)) -> dict:
    valid_statuses = ["processing", "shipped", "out_for_delivery", "delivered", "cancelled"]
    if body.status not in valid_statuses:
        raise HTTPException(400, detail={"code": "INVALID_STATUS", "message": f"Status must be one of: {', '.join(valid_statuses)}"})

    await db.execute("UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", body.status, id)
    await db.execute(
        "INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, $2, $3, $4)",
        id,
        body.status,
        f"Status set to {body.status}. Carrier: {body.carrier or 'Express'}, AWB: {body.tracking_number or 'N/A'}",
        user["id"],
    )

    order_row = await db.fetchrow("SELECT user_id FROM orders WHERE id = $1", id)
    if order_row:
        await db.execute(
            "INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)",
            order_row["user_id"],
            "order_status",
            f"Order #{id[:8].upper()} Dispatched",
            f"Your consignment is now {body.status.upper()} via {body.carrier or 'Courier'}.",
            f"/orders/{id}",
        )

    return {"success": True, "message": f"Order updated to {body.status}."}


@router.get("/inventory/velocity")
async def inventory_velocity(user: dict = _seller_or_admin, db=Depends(get_db)) -> dict:
    rows = await db.fetch(
        """SELECT p.id, p.title, p.price, p.stock_qty, p.stock_qty AS inventory_count, p.status,
                  p.attributes->>'sku' AS sku,
                  COALESCE(
                    (SELECT SUM(quantity) / 30.0 FROM order_items
                     WHERE product_id = p.id AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'),
                    1.2
                  ) AS daily_sales_velocity
           FROM products p
           WHERE p.seller_id = $1 AND p.status != 'archived'
           ORDER BY p.stock_qty ASC""",
        user["id"],
    )
    return {"success": True, "data": [dict(r) for r in rows]}


@router.post("/inventory/advisory")
async def inventory_advisory(user: dict = _seller_or_admin, db=Depends(get_db)) -> dict:
    low_stock = await db.fetch(
        "SELECT id, title, stock_qty FROM products WHERE seller_id = $1 AND stock_qty <= 10 AND status != 'archived'",
        user["id"],
    )

    created_count = 0
    for item in low_stock:
        suggested_qty = max(50 - item["stock_qty"], 25)
        await db.execute(
            """INSERT INTO agent_approval_queue (seller_id, action_type, title, description, proposed_payload, status)
               VALUES ($1, 'inventory_reorder', $2, $3, $4::jsonb, 'pending')""",
            user["id"],
            f"Restock Advisory: {item['title']}",
            f"Inventory is depleted ({item['stock_qty']} units left). Recommended restock batch: {suggested_qty} units.",
            json.dumps({"product_id": str(item["id"]), "reorder_quantity": suggested_qty, "current_stock": item["stock_qty"]}),
        )
        created_count += 1

    return {
        "success": True,
        "message": f"Generated {created_count} restock advisories in approval queue.",
        "data": {"created_count": created_count},
    }


class AIChatBody(BaseModel):
    message: str


@router.post("/ai/chat")
async def ai_chat(body: AIChatBody, user: dict = _seller_or_admin, db=Depends(get_db)) -> dict:
    if not body.message.strip():
        raise HTTPException(400, detail={"code": "MESSAGE_REQUIRED", "message": "Message is required."})

    lower = body.message.lower()
    reply = "I am observing your marketplace operations and store performance. How can I help you optimize sales today?"

    if any(kw in lower for kw in ["stock", "low", "reorder"]):
        low_res = await db.fetchrow(
            "SELECT count(*) AS count FROM products WHERE seller_id = $1 AND stock_qty <= 10", user["id"]
        )
        count = int(low_res["count"])
        reply = (
            f"You currently have {count} product(s) with stock runway under 10 units. "
            "I have scheduled replenishment advisories in your Approval Queue."
            if count > 0
            else "All catalog items currently maintain healthy inventory runway (>14 days). No immediate stockout risk detected."
        )
    elif any(kw in lower for kw in ["policy", "return"]):
        reply = "Vyapari platform policies require a 7-day buyer return window. Your custom terms in \"Store Settings\" are actively indexed by our Support RAG copilot."
    elif any(kw in lower for kw in ["rank", "seo", "search"]):
        reply = "To rank higher in natural language semantic searches, provide detailed material composition, dimensions, and usage scenarios in product descriptions. Our pgvector model computes similarity against customer search intent."

    return {"success": True, "data": {"reply": reply}}


@router.get("/settings")
async def get_settings(user: dict = _seller_or_admin, db=Depends(get_db)) -> dict:
    row = await db.fetchrow("SELECT * FROM seller_profiles WHERE user_id = $1", user["id"])
    if not row:
        return {"success": True, "data": {}}

    b_info = row["business_info"] or {}
    if isinstance(b_info, str):
        b_info = json.loads(b_info)

    return {
        "success": True,
        "data": {
            "store_name": row["store_name"],
            "store_description": row["description"],
            "business_address": b_info.get("business_address", ""),
            "return_policy": b_info.get("return_policy", "Standard 7-day return policy for unused items."),
            "shipping_policy": b_info.get("shipping_policy", "Dispatched within 24-48 hours via express courier."),
            "support_email": b_info.get("support_email", ""),
            "support_phone": b_info.get("support_phone", ""),
        },
    }


class SettingsBody(BaseModel):
    store_name: str | None = None
    store_description: str | None = None
    business_address: str | None = None
    return_policy: str | None = None
    shipping_policy: str | None = None
    support_email: str | None = None
    support_phone: str | None = None


@router.put("/settings")
async def update_settings(body: SettingsBody, user: dict = _seller_or_admin, db=Depends(get_db)) -> dict:
    cur = await db.fetchrow("SELECT business_info FROM seller_profiles WHERE user_id = $1", user["id"])
    prev_info = {}
    if cur:
        prev_info = cur["business_info"] or {}
        if isinstance(prev_info, str):
            prev_info = json.loads(prev_info)

    merged = {
        **prev_info,
        "business_address": body.business_address or prev_info.get("business_address"),
        "return_policy": body.return_policy or prev_info.get("return_policy"),
        "shipping_policy": body.shipping_policy or prev_info.get("shipping_policy"),
        "support_email": body.support_email or prev_info.get("support_email"),
        "support_phone": body.support_phone or prev_info.get("support_phone"),
    }

    row = await db.fetchrow(
        """UPDATE seller_profiles
           SET store_name = COALESCE($1, store_name),
               description = COALESCE($2, description),
               business_info = $3::jsonb,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $4
           RETURNING *""",
        body.store_name.strip() if body.store_name else None,
        body.store_description,
        json.dumps(merged),
        user["id"],
    )
    return {"success": True, "message": "Store settings and support policies updated.", "data": dict(row)}
