import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db

router = APIRouter(tags=["stores"])


@router.get("/{seller_id}")
async def get_storefront(seller_id: str, db=Depends(get_db)) -> dict:
    try:
        val_uuid = uuid.UUID(seller_id)
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail={"code": "STORE_NOT_FOUND", "message": "Seller store not found."},
        )

    store_row = await db.fetchrow(
        """SELECT sp.*, u.name AS owner_name, u.email AS owner_email, u.created_at AS member_since
           FROM seller_profiles sp
           JOIN users u ON sp.user_id = u.id
           WHERE sp.user_id = $1::uuid OR sp.id = $1::uuid""",
        val_uuid,
    )

    if not store_row:
        raise HTTPException(
            status_code=404,
            detail={"code": "STORE_NOT_FOUND", "message": "Seller store not found."},
        )

    store = dict(store_row)
    store["id"] = str(store["id"])
    store["user_id"] = str(store["user_id"])
    if store.get("created_at"):
        store["created_at"] = store["created_at"].isoformat()
    if store.get("updated_at"):
        store["updated_at"] = store["updated_at"].isoformat()
    if store.get("member_since"):
        store["member_since"] = store["member_since"].isoformat()
    for field in ["business_info", "bank_info", "tax_info"]:
        if isinstance(store.get(field), str):
            try:
                store[field] = json.loads(store[field])
            except Exception:
                pass

    prods_rows = await db.fetch(
        """SELECT p.*, c.name AS category_name
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           WHERE p.seller_id = $1 AND p.status = 'active'
           ORDER BY p.created_at DESC""",
        store_row["user_id"],
    )

    products = []
    for r in prods_rows:
        p = dict(r)
        p["id"] = str(p["id"])
        p["seller_id"] = str(p["seller_id"])
        if p.get("category_id"):
            p["category_id"] = str(p["category_id"])
        if p.get("created_at"):
            p["created_at"] = p["created_at"].isoformat()
        if p.get("updated_at"):
            p["updated_at"] = p["updated_at"].isoformat()
        if p.get("price") is not None:
            p["price"] = float(p["price"])
        if p.get("compare_at_price") is not None:
            p["compare_at_price"] = float(p["compare_at_price"])
        for j_field in ["images", "attributes"]:
            if isinstance(p.get(j_field), str):
                try:
                    p[j_field] = json.loads(p[j_field])
                except Exception:
                    pass
        products.append(p)

    return {
        "success": True,
        "data": {
            "store": store,
            "products": products,
            "total_products": len(products),
        },
    }
