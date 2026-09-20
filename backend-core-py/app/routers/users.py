from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import require_auth
from app.auth.service import hash_password, verify_password
from app.db import get_db, get_pool

router = APIRouter(tags=["users"])


def _format_address(row: dict) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    if "user_id" in d:
        d["user_id"] = str(d["user_id"])
    if "created_at" in d and d["created_at"]:
        d["created_at"] = d["created_at"].isoformat()
    # Provide both alias names exactly matching Node.js
    d["name"] = d.get("full_name")
    d["address_line1"] = d.get("line1")
    d["postal_code"] = d.get("pincode")
    return d


# GET /api/users/profile
@router.get("/profile")
async def get_profile(
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    user_row = await db.fetchrow(
        """SELECT id, name, email, phone, role, is_active, created_at
           FROM users WHERE id = $1""",
        user["id"],
    )

    if not user_row:
        raise HTTPException(
            status_code=404,
            detail={"code": "USER_NOT_FOUND", "message": "User not found."},
        )

    user_data = dict(user_row)
    user_data["id"] = str(user_data["id"])
    if user_data.get("created_at"):
        user_data["created_at"] = user_data["created_at"].isoformat()

    orders_count = await db.fetchval(
        "SELECT COUNT(*) FROM orders WHERE user_id = $1", user["id"]
    )
    wishlist_count = await db.fetchval(
        """SELECT COUNT(*) FROM wishlist_items wi
           JOIN wishlists w ON wi.wishlist_id = w.id
           WHERE w.user_id = $1""",
        user["id"],
    )

    user_data["stats"] = {
        "total_orders": int(orders_count or 0),
        "wishlist_items": int(wishlist_count or 0),
    }

    return {"success": True, "data": {"user": user_data}}


class UpdateProfileBody(BaseModel):
    name: str | None = None
    phone: str | None = None
    current_password: str | None = None
    new_password: str | None = None


# PUT /api/users/profile
@router.put("/profile")
async def update_profile(
    body: UpdateProfileBody,
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    if not body.name:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Name is required."},
        )

    if body.new_password:
        if not body.current_password:
            raise HTTPException(
                status_code=400,
                detail={"code": "PASSWORD_REQUIRED", "message": "Current password is required to set a new password."},
            )

        user_row = await db.fetchrow(
            "SELECT password_hash FROM users WHERE id = $1", user["id"]
        )
        if not user_row or not verify_password(body.current_password, user_row["password_hash"]):
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_PASSWORD", "message": "Current password does not match."},
            )

        new_hash = hash_password(body.new_password)
        await db.execute(
            """UPDATE users 
               SET name = $1, phone = $2, password_hash = $3, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $4""",
            body.name.strip(),
            body.phone or None,
            new_hash,
            user["id"],
        )
    else:
        await db.execute(
            """UPDATE users 
               SET name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $3""",
            body.name.strip(),
            body.phone or None,
            user["id"],
        )

    updated_row = await db.fetchrow(
        "SELECT id, name, email, phone, role, updated_at FROM users WHERE id = $1",
        user["id"],
    )
    res_data = dict(updated_row)
    res_data["id"] = str(res_data["id"])
    if res_data.get("updated_at"):
        res_data["updated_at"] = res_data["updated_at"].isoformat()

    return {
        "success": True,
        "message": "Profile updated successfully.",
        "data": {"user": res_data},
    }


# GET /api/users/addresses
@router.get("/addresses")
async def get_addresses(
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    rows = await db.fetch(
        """SELECT 
            id, full_name, full_name AS name, phone,
            line1, line1 AS address_line1, city, state,
            pincode, pincode AS postal_code, is_default, created_at
           FROM addresses 
           WHERE user_id = $1
           ORDER BY is_default DESC, created_at DESC""",
        user["id"],
    )
    return {"success": True, "data": [_format_address(r) for r in rows]}


class AddressBody(BaseModel):
    full_name: str | None = None
    name: str | None = None
    phone: str | None = None
    line1: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    postal_code: str | None = None
    is_default: bool = False


# POST /api/users/addresses
@router.post("/addresses", status_code=201)
async def create_address(
    body: AddressBody,
    user: dict = Depends(require_auth),
) -> dict:
    final_name = body.full_name or body.name
    final_line = body.line1 or body.address_line1
    final_pin = body.pincode or body.postal_code

    if not final_name or not body.phone or not final_line or not body.city or not body.state or not final_pin:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "All address fields are required."},
        )

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            is_default = body.is_default
            if is_default:
                await conn.execute(
                    "UPDATE addresses SET is_default = false WHERE user_id = $1",
                    user["id"],
                )
            else:
                count = await conn.fetchval(
                    "SELECT COUNT(*) FROM addresses WHERE user_id = $1", user["id"]
                )
                if int(count or 0) == 0:
                    is_default = True

            insert_row = await conn.fetchrow(
                """INSERT INTO addresses (user_id, full_name, phone, line1, city, state, pincode, is_default)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                   RETURNING id, full_name, full_name AS name, phone, line1, line1 AS address_line1, city, state, pincode, pincode AS postal_code, is_default, created_at""",
                user["id"],
                final_name.strip(),
                body.phone.strip(),
                final_line.strip(),
                body.city.strip(),
                body.state.strip(),
                final_pin.strip(),
                is_default,
            )

    return {
        "success": True,
        "message": "Address added successfully.",
        "data": _format_address(insert_row),
    }


# PUT /api/users/addresses/{id}
@router.put("/addresses/{addr_id}")
async def update_address(
    addr_id: str,
    body: AddressBody,
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    final_name = body.full_name or body.name
    final_line = body.line1 or body.address_line1
    final_pin = body.pincode or body.postal_code

    update_row = await db.fetchrow(
        """UPDATE addresses
           SET full_name = COALESCE($1, full_name),
               phone = COALESCE($2, phone),
               line1 = COALESCE($3, line1),
               city = COALESCE($4, city),
               state = COALESCE($5, state),
               pincode = COALESCE($6, pincode)
           WHERE id = $7 AND user_id = $8
           RETURNING id, full_name, full_name AS name, phone, line1, line1 AS address_line1, city, state, pincode, pincode AS postal_code, is_default""",
        final_name.strip() if final_name else None,
        body.phone.strip() if body.phone else None,
        final_line.strip() if final_line else None,
        body.city.strip() if body.city else None,
        body.state.strip() if body.state else None,
        final_pin.strip() if final_pin else None,
        addr_id,
        user["id"],
    )

    if not update_row:
        raise HTTPException(
            status_code=404,
            detail={"code": "ADDRESS_NOT_FOUND", "message": "Address not found."},
        )

    return {
        "success": True,
        "message": "Address updated.",
        "data": _format_address(update_row),
    }


# DELETE /api/users/addresses/{id}
@router.delete("/addresses/{addr_id}")
async def delete_address(
    addr_id: str,
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    delete_row = await db.fetchrow(
        "DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id",
        addr_id,
        user["id"],
    )
    if not delete_row:
        raise HTTPException(
            status_code=404,
            detail={"code": "ADDRESS_NOT_FOUND", "message": "Address not found."},
        )
    return {"success": True, "message": "Address deleted."}


# PUT /api/users/addresses/{id}/default
@router.put("/addresses/{addr_id}/default")
async def set_default_address(
    addr_id: str,
    user: dict = Depends(require_auth),
) -> dict:
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE addresses SET is_default = false WHERE user_id = $1",
                user["id"],
            )
            update_row = await conn.fetchrow(
                "UPDATE addresses SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING *",
                addr_id,
                user["id"],
            )

            if not update_row:
                raise HTTPException(
                    status_code=404,
                    detail={"code": "ADDRESS_NOT_FOUND", "message": "Address not found."},
                )

    return {
        "success": True,
        "message": "Default address updated.",
        "data": {"address": _format_address(update_row)},
    }
