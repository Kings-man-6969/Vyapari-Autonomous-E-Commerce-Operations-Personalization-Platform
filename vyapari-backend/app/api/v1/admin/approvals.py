"""
Vyapari — Admin: KYC Approvals Router
GET  /api/v1/admin/sellers/pending
POST /api/v1/admin/sellers/{seller_id}/approve
POST /api/v1/admin/sellers/{seller_id}/reject
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import AdminDep, AsyncSessionDep
from app.models.seller_profile import KYCStatus, SellerProfile
from app.schemas.seller import KYCActionRequest
from app.schemas.user import SellerProfileRead

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/sellers/pending", response_model=list[SellerProfileRead])
async def list_pending_sellers(
    _: AdminDep,
    db: AsyncSessionDep,
) -> list[SellerProfileRead]:
    """Returns sellers with KYC status pending or under_review."""
    result = await db.execute(
        select(SellerProfile)
        .where(SellerProfile.kyc_status.in_([KYCStatus.pending, KYCStatus.under_review]))
        .order_by(SellerProfile.created_at.asc())
    )
    return list(result.scalars().all())


@router.post("/sellers/{seller_id}/kyc", response_model=SellerProfileRead)
async def process_kyc(
    seller_id: UUID,
    data: KYCActionRequest,
    _: AdminDep,
    db: AsyncSessionDep,
) -> SellerProfileRead:
    """Approve or reject a seller's KYC submission."""
    result = await db.execute(
        select(SellerProfile).where(SellerProfile.id == seller_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found.")

    if data.action == KYCStatus.approved:
        profile.kyc_status = KYCStatus.approved
        from datetime import datetime, timezone
        profile.verified_at = datetime.now(tz=timezone.utc)
        profile.kyc_rejection_reason = None
    elif data.action == KYCStatus.rejected:
        profile.kyc_status = KYCStatus.rejected
        profile.kyc_rejection_reason = data.reason
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be 'approved' or 'rejected'.",
        )

    return profile
