"""
Categories — port of backend-core/src/routes/categories.js

GET /api/categories
GET /api/categories/:slug
"""
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db
from app.redis_client import TTL_CATEGORIES, cache

router = APIRouter()


@router.get("")
@router.get("/")
async def get_categories(db=Depends(get_db)) -> dict:
    cached = await cache.get_json("categories:tree")
    if cached:
        return cached

    rows = await db.fetch(
        """SELECT id, name, slug, parent_id, icon_url, created_at
           FROM categories
           ORDER BY parent_id NULLS FIRST, name ASC"""
    )
    all_cats = [dict(r) for r in rows]

    # Build tree (mirrors Node.js array filter pattern)
    parents = [c for c in all_cats if c["parent_id"] is None]
    tree = [
        {**p, "subcategories": [c for c in all_cats if c["parent_id"] == p["id"]]}
        for p in parents
    ]

    # Serialize UUIDs
    for c in all_cats:
        c["id"] = str(c["id"])
        if c["parent_id"]:
            c["parent_id"] = str(c["parent_id"])
        if c["created_at"]:
            c["created_at"] = c["created_at"].isoformat()

    for p in tree:
        p["id"] = str(p["id"])
        if p.get("parent_id"):
            p["parent_id"] = str(p["parent_id"])
        for sub in p["subcategories"]:
            sub["id"] = str(sub["id"])
            if sub.get("parent_id"):
                sub["parent_id"] = str(sub["parent_id"])

    # Mirror Node.js and API response shape: data with categories tree and flat list, plus top-level compatibility
    result = {
        "success": True,
        "data": {
            "categories": tree,
            "flat": all_cats,
        },
        "categories": tree,
        "flat": all_cats,
    }
    await cache.set_json("categories:tree", result, ex=TTL_CATEGORIES)
    return result


@router.get("/{slug}")
async def get_category_by_slug(slug: str, db=Depends(get_db)) -> dict:
    cache_key = f"categories:slug:{slug.lower().strip()}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached

    cat_row = await db.fetchrow("SELECT * FROM categories WHERE slug = $1", slug)
    if not cat_row:
        raise HTTPException(
            status_code=404,
            detail={"code": "CATEGORY_NOT_FOUND", "message": "Category not found."},
        )

    category = dict(cat_row)
    category["id"] = str(category["id"])

    products = await db.fetch(
        """SELECT p.id, p.title, p.slug, p.price, p.compare_at_price, p.images,
                  p.stock_qty, p.stock_qty AS inventory_count, p.status, sp.store_name
           FROM products p
           JOIN seller_profiles sp ON p.seller_id = sp.user_id
           WHERE (p.category_id = $1 OR p.category_id IN (
               SELECT id FROM categories WHERE parent_id = $1
           )) AND p.status = 'active'
           ORDER BY p.created_at DESC""",
        cat_row["id"],
    )

    result = {
        "success": True,
        "data": {
            "category": category,
            "products": [dict(p) for p in products],
        },
    }
    await cache.set_json(cache_key, result, ex=TTL_CATEGORIES)
    return result
