"""
Products — port of backend-core/src/routes/products.js (676 lines)

GET  /api/products/facets
GET  /api/products/suggest
GET  /api/products              (with NLQ + semantic search)
GET  /api/products/:id
POST /api/products              (seller only)
PUT  /api/products/:id          (seller/admin)
POST /api/products/reviews      (verified purchase gate)
"""
import hashlib
import json
import re
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth.dependencies import optional_auth, require_auth, require_role
from app.config import settings
from app.db import get_db, get_pool
from app.redis_client import (
    TTL_AUTOCOMPLETE,
    TTL_FACETS,
    TTL_PRODUCT_DETAIL,
    TTL_SEARCH,
    cache,
)

router = APIRouter()


# ── NLQ Parser ────────────────────────────────────────────────────────────────
# Direct Python port of parseNaturalLanguageQuery() from products.js
# Every regex pattern preserved verbatim.

def _parse_k(raw: str) -> float:
    """'5k' → 5000, '5000' → 5000.0"""
    r = raw.lower().replace(",", "")
    return float(r[:-1]) * 1000 if r.endswith("k") else float(r)


def parse_natural_language_query(
    query_str: str, known_brands: list[str] | None = None
) -> dict:
    if not query_str or not isinstance(query_str, str):
        return {"original": query_str, "cleanQuery": query_str, "intent": {}, "hasIntent": False}

    text = query_str.strip()
    intent: dict = {}
    known_brands = known_brands or []

    # 1. Price extraction
    between = re.search(
        r"\b(?:between)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)?k?)\s*(?:and|to|-)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)?k?)\b",
        text,
        re.IGNORECASE,
    )
    if between:
        intent["min_price"] = _parse_k(between.group(1))
        intent["max_price"] = _parse_k(between.group(2))
        text = text.replace(between.group(0), " ")
    else:
        under = re.search(
            r"\b(?:under|below|less than|within|max|up to)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)?k?)\b",
            text,
            re.IGNORECASE,
        )
        if under:
            val = _parse_k(under.group(1))
            if not __import__("math").isnan(val):
                intent["max_price"] = val
            text = text.replace(under.group(0), " ")

        above = re.search(
            r"\b(?:above|over|more than|min|starting from)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)?k?)\b",
            text,
            re.IGNORECASE,
        )
        if above:
            val = _parse_k(above.group(1))
            if not __import__("math").isnan(val):
                intent["min_price"] = val
            text = text.replace(above.group(0), " ")

    # 2. Rating extraction
    if re.search(r"\b(?:best|top rated|highest rated|top quality|premium|5 star)\b", text, re.IGNORECASE):
        intent["min_rating"] = 4.0
        intent["sort"] = "rating_desc"
        text = re.sub(r"\b(?:best|top rated|highest rated|top quality|premium|5 star)\b", " ", text, flags=re.IGNORECASE)

    # 3. Delivery speed
    if re.search(r"\b(?:fast delivery|next day|tomorrow|quick delivery|free 2-day)\b", text, re.IGNORECASE):
        intent["fast_delivery"] = True
        text = re.sub(r"\b(?:fast delivery|next day|tomorrow|quick delivery|free 2-day)\b", " ", text, flags=re.IGNORECASE)

    # 4. Value / Budget
    if re.search(r"\b(?:cheap|budget|affordable|low price|deal|discounted)\b", text, re.IGNORECASE):
        intent["is_budget"] = True
        if "sort" not in intent:
            intent["sort"] = "price_asc"
        text = re.sub(r"\b(?:cheap|budget|affordable|low price|deal|discounted)\b", " ", text, flags=re.IGNORECASE)

    # 5. Brand detection
    for brand in known_brands:
        if not brand:
            continue
        escaped = re.escape(brand)
        if re.search(rf"\b{escaped}\b", text, re.IGNORECASE):
            intent["brand"] = brand
            text = re.sub(rf"\b{escaped}\b", " ", text, count=1, flags=re.IGNORECASE)
            break

    # Clean trailing prepositions
    clean = re.sub(r"\s+", " ", text).strip()
    clean = re.sub(r"\b(with|for|in|of|and|an|a|the)\b$", "", clean, flags=re.IGNORECASE).strip()

    return {
        "original": query_str,
        "cleanQuery": clean or query_str,
        "intent": intent,
        "hasIntent": len(intent) > 0,
    }


# ── Embedding sync helper ─────────────────────────────────────────────────────

async def sync_product_embedding(product_id: str, text: str, db) -> None:
    """Port of syncProductEmbedding() from products.js."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.post(
                f"{settings.RECOMMENDATION_SERVICE_URL}/embed", json={"text": text}
            )
            data = res.json()
            if data.get("embedding"):
                vec_str = "[" + ",".join(str(v) for v in data["embedding"]) + "]"
                await db.execute(
                    """INSERT INTO product_embeddings (product_id, embedding, model_version)
                       VALUES ($1, $2::vector, 'all-MiniLM-L6-v2')
                       ON CONFLICT (product_id) DO UPDATE
                       SET embedding = EXCLUDED.embedding, updated_at = CURRENT_TIMESTAMP""",
                    product_id,
                    vec_str,
                )
    except Exception as exc:
        print(f"[Embedding Sync Warning] Failed to embed product {product_id}: {exc}")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/facets")
async def get_facets(db=Depends(get_db)) -> dict:
    cached = await cache.get_json("products:facets")
    if cached:
        return cached

    brands_rows = await db.fetch("""
        SELECT p.attributes->>'brand' AS name, count(1)::int AS count
        FROM products p
        WHERE p.status = 'active' AND p.attributes->>'brand' IS NOT NULL
        GROUP BY 1 ORDER BY count DESC, name ASC LIMIT 30
    """)
    price_row = await db.fetchrow("""
        SELECT MIN(price)::int AS min_price, MAX(price)::int AS max_price
        FROM products WHERE status = 'active'
    """)
    cats_rows = await db.fetch("""
        SELECT c.id, c.name, c.slug, count(p.id)::int AS count
        FROM categories c
        JOIN products p ON p.category_id = c.id
        WHERE p.status = 'active'
        GROUP BY c.id ORDER BY count DESC
    """)
    result = {
        "success": True,
        "data": {
            "brands": [dict(r) for r in brands_rows],
            "price_limits": dict(price_row) if price_row else {"min_price": 299, "max_price": 199999},
            "categories": [dict(r) for r in cats_rows],
        },
    }
    await cache.set_json("products:facets", result, ex=TTL_FACETS)
    return result




@router.get("/suggest")
async def suggest(q: str | None = None, db=Depends(get_db)) -> dict:
    if not q or not q.strip():
        return {"success": True, "data": {"products": [], "brands": [], "categories": [], "suggestions": []}}

    term = q.strip()
    cache_key = f"suggest:{term.lower()}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached

    term_like = f"%{term}%"
    start_like = f"{term}%"

    prods = await db.fetch("""
        SELECT p.id, p.title, p.price, p.compare_at_price, p.images,
               p.attributes->>'brand' AS brand,
               COALESCE((p.attributes->>'rating')::numeric, 4.5) AS rating,
               c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'active'
          AND (p.title ILIKE $1 OR p.attributes->>'brand' ILIKE $1 OR c.name ILIKE $1)
        ORDER BY
          CASE WHEN p.attributes->>'brand' ILIKE $2 THEN 1
               WHEN p.title ILIKE $2 THEN 2 ELSE 3 END,
          p.price ASC
        LIMIT 4
    """, term_like, start_like)
    brands = await db.fetch("""
        SELECT p.attributes->>'brand' AS name, count(1)::int AS count
        FROM products p
        WHERE p.status = 'active' AND p.attributes->>'brand' ILIKE $1
        GROUP BY 1 ORDER BY count DESC LIMIT 3
    """, term_like)
    cats = await db.fetch("""
        SELECT c.id, c.name, c.slug, count(p.id)::int AS count
        FROM categories c
        JOIN products p ON p.category_id = c.id
        WHERE p.status = 'active' AND c.name ILIKE $1
        GROUP BY c.id ORDER BY count DESC LIMIT 3
    """, term_like)

    suggestions: list[str] = []
    if brands and cats:
        suggestions.append(f"{brands[0]['name']} in {cats[0]['name']}")
    for p in prods:
        if len(suggestions) < 4 and p["title"] not in suggestions:
            suggestions.append(p["title"])

    result = {
        "success": True,
        "data": {
            "query": term,
            "products": [dict(p) for p in prods],
            "brands": [dict(b) for b in brands],
            "categories": [dict(c) for c in cats],
            "suggestions": suggestions,
        },
    }
    await cache.set_json(cache_key, result, ex=TTL_AUTOCOMPLETE)
    return result


@router.get("")
@router.get("/")
async def list_products(
    category_id: str | None = None,
    seller_id: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    brand: str | None = None,
    min_rating: float | None = None,
    min_discount: float | None = None,
    fast_delivery: str | None = None,
    sort: str | None = None,
    page: int = 1,
    limit: int = 24,
    q: str | None = None,
    db=Depends(get_db),
) -> dict:
    # ── Check Cache for Repeated Searches ─────────────────────────────────────
    normalized_params = {
        "category_id": str(category_id) if category_id else None,
        "seller_id": str(seller_id) if seller_id else None,
        "min_price": float(min_price) if min_price is not None else None,
        "max_price": float(max_price) if max_price is not None else None,
        "brand": brand.strip().lower() if brand else None,
        "min_rating": float(min_rating) if min_rating is not None else None,
        "min_discount": float(min_discount) if min_discount is not None else None,
        "fast_delivery": fast_delivery in ("true", "1", "yes") if fast_delivery else False,
        "sort": sort or "newest",
        "page": int(page),
        "limit": int(limit),
        "q": q.strip().lower() if q else "",
    }
    canonical_repr = json.dumps(normalized_params, sort_keys=True)
    cache_hash = hashlib.md5(canonical_repr.encode("utf-8")).hexdigest()
    cache_key = f"search:{cache_hash}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached

    effective_min_price = min_price
    effective_max_price = max_price
    effective_brand = brand
    effective_min_rating = min_rating
    effective_fast_delivery = fast_delivery in ("true", "1", "yes")
    effective_sort = sort or "newest"

    nl_analysis = None
    semantic_product_ids: list = []

    if q and q.strip():
        brands_rows = await db.fetch(
            "SELECT DISTINCT attributes->>'brand' AS brand FROM products "
            "WHERE status = 'active' AND attributes->>'brand' IS NOT NULL"
        )
        known_brands = [r["brand"] for r in brands_rows if r["brand"]]

        nl_analysis = parse_natural_language_query(q, known_brands)

        if effective_min_price is None and nl_analysis["intent"].get("min_price"):
            effective_min_price = nl_analysis["intent"]["min_price"]
        if effective_max_price is None and nl_analysis["intent"].get("max_price"):
            effective_max_price = nl_analysis["intent"]["max_price"]
        if not effective_brand and nl_analysis["intent"].get("brand"):
            effective_brand = nl_analysis["intent"]["brand"]
        if effective_min_rating is None and nl_analysis["intent"].get("min_rating"):
            effective_min_rating = nl_analysis["intent"]["min_rating"]
        if not effective_fast_delivery and nl_analysis["intent"].get("fast_delivery"):
            effective_fast_delivery = True
        if not sort and nl_analysis["intent"].get("sort"):
            effective_sort = nl_analysis["intent"]["sort"]

        clean_q = nl_analysis["cleanQuery"] or q
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                reco = await client.get(
                    f"{settings.RECOMMENDATION_SERVICE_URL}/search",
                    params={"q": clean_q, "limit": 36},
                )
                reco_data = reco.json()
                if isinstance(reco_data, list):
                    semantic_product_ids = [
                        r["id"] for r in reco_data if r.get("similarity", 0) >= 0.32
                    ]
        except Exception as exc:
            print(f"[Semantic Search Fallback]: {exc}")

    offset = (page - 1) * limit
    conditions = ["p.status = 'active'"]
    params: list = []

    def p(val) -> str:
        params.append(val)
        return f"${len(params)}"

    if category_id:
        pid = p(category_id)
        conditions.append(
            f"(p.category_id = {pid} OR p.category_id IN "
            f"(SELECT id FROM categories WHERE parent_id = {pid}))"
        )
    if seller_id:
        conditions.append(f"p.seller_id = {p(seller_id)}")
    if effective_min_price is not None:
        conditions.append(f"p.price >= {p(effective_min_price)}")
    if effective_max_price is not None:
        conditions.append(f"p.price <= {p(effective_max_price)}")
    if effective_brand:
        brand_list = [b.strip() for b in effective_brand.split(",") if b.strip()]
        if len(brand_list) == 1:
            conditions.append(f"p.attributes->>'brand' ILIKE {p(brand_list[0])}")
        elif len(brand_list) > 1:
            conditions.append(f"p.attributes->>'brand' = ANY({p(brand_list)})")
    if effective_min_rating is not None:
        conditions.append(
            f"COALESCE((p.attributes->>'rating')::numeric, sp.rating_avg, 0) >= {p(effective_min_rating)}"
        )
    if min_discount:
        conditions.append(
            f"p.compare_at_price IS NOT NULL AND "
            f"((p.compare_at_price - p.price) / p.compare_at_price * 100) >= {p(float(min_discount))}"
        )
    if effective_fast_delivery:
        conditions.append("(p.attributes->>'fast_delivery' ILIKE '%Tomorrow%' OR p.price >= 999)")

    # Hybrid keyword / vector search
    if q and q.strip():
        if semantic_product_ids:
            vec_param = p(semantic_product_ids)
            words = [w for w in (nl_analysis["cleanQuery"] or q).split() if len(w) > 2]
            if words:
                text_conds = [
                    f"(p.title ILIKE {p('%' + w + '%')} OR p.description ILIKE {p('%' + w + '%')})"
                    for w in words
                ]
                conditions.append(f"(p.id = ANY({vec_param}) OR ({' AND '.join(text_conds)}))")
            else:
                conditions.append(f"p.id = ANY({vec_param})")
        else:
            words = [w for w in ((nl_analysis or {}).get("cleanQuery", q) or q).split() if len(w) > 2]
            if len(words) > 1:
                text_conds = [
                    f"(p.title ILIKE {p('%' + w + '%')} OR p.description ILIKE {p('%' + w + '%')})"
                    for w in words
                ]
                conditions.append(f"({' AND '.join(text_conds)})")
            else:
                conditions.append(
                    f"(p.title ILIKE {p('%' + q.strip() + '%')} OR p.description ILIKE {p('%' + q.strip() + '%')})"
                )

    # Order by
    if semantic_product_ids and not sort:
        vec_idx = next(
            (i + 1 for i, pv in enumerate(params) if pv is semantic_product_ids), None
        )
        order_by = f"array_position(${vec_idx}, p.id) ASC, p.created_at DESC" if vec_idx else "p.created_at DESC"
    elif effective_sort == "price_asc":
        order_by = "p.price ASC"
    elif effective_sort == "price_desc":
        order_by = "p.price DESC"
    elif effective_sort == "rating_desc":
        order_by = "COALESCE((p.attributes->>'rating')::numeric, sp.rating_avg, 0) DESC"
    else:
        order_by = "p.created_at DESC"

    where_clause = " AND ".join(conditions)
    limit_param = p(limit)
    offset_param = p(offset)

    sql = f"""
        SELECT
            p.id, p.seller_id, p.category_id, p.title, p.slug, p.description,
            p.price, p.compare_at_price, p.stock_qty, p.stock_qty AS inventory_count, p.images, p.attributes,
            p.status, p.created_at,
            c.name AS category_name, c.slug AS category_slug,
            sp.store_name, sp.rating_avg AS seller_rating
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
        WHERE {where_clause}
        ORDER BY {order_by}
        LIMIT {limit_param} OFFSET {offset_param}
    """

    count_sql = f"SELECT COUNT(*) AS total FROM products p WHERE {where_clause}"

    data_rows = await db.fetch(sql, *params)
    count_row = await db.fetchrow(count_sql, *params[:-2])

    total = int(count_row["total"])

    nl_info = None
    if nl_analysis and nl_analysis["hasIntent"]:
        nl_info = {
            "is_natural_language": True,
            "original_query": nl_analysis["original"],
            "clean_query": nl_analysis["cleanQuery"],
            "applied_intent": {
                "max_price": effective_max_price,
                "min_price": effective_min_price,
                "brand": effective_brand,
                "min_rating": effective_min_rating,
                "fast_delivery": effective_fast_delivery,
            },
        }

    result = {
        "success": True,
        "data": {
            "products": [dict(r) for r in data_rows],
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": -(-total // limit),  # ceil division
            },
            "nl_analysis": nl_info,
        },
    }
    await cache.set_json(cache_key, result, ex=TTL_SEARCH)
    return result


@router.get("/{id}")
async def get_product(id: str, user: dict | None = Depends(optional_auth), db=Depends(get_db)) -> dict:
    cache_key = f"product:detail:{id.strip().lower()}"
    cached = await cache.get_json(cache_key)
    if cached:
        # Fire-and-forget interaction logging even on cache hit
        if user:
            import asyncio
            pool = get_pool()
            p_id = cached.get("data", {}).get("product", {}).get("id") or id
            asyncio.ensure_future(
                pool.execute(
                    "INSERT INTO user_interactions (user_id, product_id, event_type) VALUES ($1, $2, 'view')",
                    user["id"],
                    p_id,
                )
            )
        return cached

    is_uuid = bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", id, re.IGNORECASE))
    where_cond = "p.id = $1::uuid" if is_uuid else "p.slug = $1"

    product_row = await db.fetchrow(
        f"""SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                sp.store_name, sp.description AS store_description,
                sp.rating_avg AS store_rating, sp.is_verified
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
           WHERE {where_cond}""",
        id,
    )

    if not product_row:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
        )

    product = dict(product_row)
    if "inventory_count" not in product:
        product["inventory_count"] = product.get("stock_qty", 0)

    reviews = await db.fetch(
        """SELECT r.id, r.rating, r.title, r.comment, r.created_at,
                  r.is_verified_purchase, u.name AS reviewer_name
           FROM reviews r
           JOIN users u ON r.user_id = u.id
           WHERE r.product_id = $1
           ORDER BY r.created_at DESC""",
        product["id"],
    )

    # Fire-and-forget interaction logging (mirrors Node.js .catch(() => {}))
    if user:
        import asyncio
        pool = get_pool()
        asyncio.ensure_future(
            pool.execute(
                "INSERT INTO user_interactions (user_id, product_id, event_type) VALUES ($1, $2, 'view')",
                user["id"],
                product["id"],
            )
        )

    result = {
        "success": True,
        "data": {
            "product": product,
            "reviews": [dict(r) for r in reviews],
        },
    }

    # Cache by query id, and if slug exists also cache by slug
    await cache.set_json(cache_key, result, ex=TTL_PRODUCT_DETAIL)
    if product.get("slug") and product["slug"].lower() != id.strip().lower():
        await cache.set_json(f"product:detail:{product['slug'].lower()}", result, ex=TTL_PRODUCT_DETAIL)
    if str(product.get("id")).lower() != id.strip().lower():
        await cache.set_json(f"product:detail:{str(product['id']).lower()}", result, ex=TTL_PRODUCT_DETAIL)

    return result


class CreateProductBody(BaseModel):
    title: str
    description: str
    price: float
    compare_at_price: float | None = None
    stock_qty: int = 0
    category_id: str
    images: list = []
    attributes: dict = {}
    status: str = "active"


@router.post("/", status_code=201)
async def create_product(
    body: CreateProductBody,
    user: dict = Depends(require_role(["seller", "admin"])),
    db=Depends(get_db),
) -> dict:
    base_slug = re.sub(r"[^a-z0-9]+", "-", body.title.lower()).strip("-")
    slug = f"{base_slug}-{str(int(time.time() * 1000))[-4:]}"
    effective_status = "out_of_stock" if body.stock_qty == 0 else body.status

    cat_id = None
    if body.category_id and str(body.category_id).strip():
        try:
            import uuid
            uuid.UUID(str(body.category_id).strip())
            cat_id = str(body.category_id).strip()
        except ValueError:
            cat_id = None
    if not cat_id:
        first_cat = await db.fetchrow("SELECT id FROM categories LIMIT 1")
        cat_id = str(first_cat["id"]) if first_cat else "10000000-0000-0000-0000-000000000001"

    row = await db.fetchrow(
        """INSERT INTO products
           (seller_id, category_id, title, slug, description, price, compare_at_price,
            stock_qty, images, attributes, status)
           VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
           RETURNING *""",
        user["id"],
        cat_id,
        body.title.strip(),
        slug,
        body.description,
        body.price,
        body.compare_at_price,
        body.stock_qty,
        json.dumps(body.images),
        json.dumps(body.attributes),
        effective_status,
    )

    product = dict(row)

    # Invalidate search, suggest, facets, popular, and categories caches
    await cache.delete_prefix("search:")
    await cache.delete_prefix("suggest:")
    await cache.delete("products:facets")
    await cache.delete_prefix("products:popular:")
    await cache.delete("categories:tree")

    # Synchronous embedding per architectural decision A4
    await sync_product_embedding(
        str(product["id"]), f"{product['title']}. {product['description']}", db
    )

    return {"success": True, "data": {"product": product}}


class UpdateProductBody(BaseModel):
    title: str | None = None
    description: str | None = None
    price: float | None = None
    compare_at_price: float | None = None
    stock_qty: int | None = None
    category_id: str | None = None
    images: list | None = None
    attributes: dict | None = None
    status: str | None = None


@router.put("/{id}")
async def update_product(
    id: str,
    body: UpdateProductBody,
    user: dict = Depends(require_role(["seller", "admin"])),
    db=Depends(get_db),
) -> dict:
    existing = await db.fetchrow("SELECT * FROM products WHERE id = $1", id)
    if not existing:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
        )

    current = dict(existing)
    if user["role"] != "admin" and str(current["seller_id"]) != str(user["id"]):
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "You can only edit products belonging to your store."},
        )

    title = body.title or current["title"]
    description = body.description if body.description is not None else current["description"]
    price = body.price if body.price is not None else float(current["price"])
    compare_at_price = body.compare_at_price if body.compare_at_price is not None else (
        float(current["compare_at_price"]) if current["compare_at_price"] else None
    )
    stock_qty = body.stock_qty if body.stock_qty is not None else current["stock_qty"]
    cat_id = current["category_id"]
    if body.category_id and str(body.category_id).strip():
        try:
            import uuid
            uuid.UUID(str(body.category_id).strip())
            cat_id = str(body.category_id).strip()
        except ValueError:
            pass
    images = body.images if body.images is not None else current["images"]
    attributes = body.attributes if body.attributes is not None else current["attributes"]
    status = body.status or current["status"]

    effective_status = "out_of_stock" if stock_qty == 0 and status == "active" else status

    updated = await db.fetchrow(
        """UPDATE products
           SET title = $1, description = $2, price = $3, compare_at_price = $4,
               stock_qty = $5, category_id = $6::uuid, images = $7::jsonb,
               attributes = $8::jsonb, status = $9, updated_at = CURRENT_TIMESTAMP
           WHERE id = $10
           RETURNING *""",
        title.strip(),
        description,
        price,
        compare_at_price,
        stock_qty,
        cat_id,
        json.dumps(images),
        json.dumps(attributes) if isinstance(attributes, dict) else attributes,
        effective_status,
        id,
    )

    # Invalidate product detail, search, suggest, facets, and popular caches
    await cache.delete(f"product:detail:{id.strip().lower()}")
    if current.get("slug"):
        await cache.delete(f"product:detail:{current['slug'].strip().lower()}")
    if current.get("id"):
        await cache.delete(f"product:detail:{str(current['id']).strip().lower()}")
    await cache.delete_prefix("search:")
    await cache.delete_prefix("suggest:")
    await cache.delete("products:facets")
    await cache.delete_prefix("products:popular:")

    # Fire-and-forget embedding refresh
    import asyncio
    product = dict(updated)
    asyncio.ensure_future(
        sync_product_embedding(str(product["id"]), f"{product['title']}. {product['description']}", db)
    )

    return {"success": True, "data": {"product": product}}


class CreateReviewBody(BaseModel):
    product_id: str
    order_id: str | None = None
    rating: int
    title: str | None = None
    comment: str


@router.post("/reviews", status_code=201)
async def create_review(
    body: CreateReviewBody,
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    if not body.product_id or not body.rating or not body.comment:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "product_id, rating (1-5), and comment are required."},
        )

    # Verified purchase gate
    purchase = await db.fetchrow(
        """SELECT oi.id FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE oi.product_id = $1 AND o.user_id = $2 AND o.status = 'delivered'""",
        body.product_id,
        user["id"],
    )
    is_verified = purchase is not None

    review = await db.fetchrow(
        """INSERT INTO reviews (product_id, order_id, user_id, rating, title, comment, is_verified_purchase)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (product_id, user_id)
           DO UPDATE SET rating = EXCLUDED.rating, title = EXCLUDED.title,
                         comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP
           RETURNING *""",
        body.product_id,
        body.order_id,
        user["id"],
        body.rating,
        body.title or "",
        body.comment.strip(),
        is_verified,
    )

    # Broadened invalidation for review creation (rating/popularity/similarity changes)
    p_id_str = body.product_id.strip().lower()
    await cache.delete(f"product:detail:{p_id_str}")
    await cache.delete_prefix("search:")
    await cache.delete_prefix("products:popular:")
    await cache.delete_prefix(f"products:similar:{p_id_str}:")
    await cache.delete_prefix("recommendations:")

    return {"success": True, "data": {"review": dict(review)}}
