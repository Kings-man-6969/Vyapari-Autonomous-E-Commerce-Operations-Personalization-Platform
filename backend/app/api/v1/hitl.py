import json
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Decision, Product, Review, User
from app.schemas import (
    DecisionOut, DecisionDetailOut, DecisionListResponse,
    ApproveRequest, RejectRequest, HITLAnalyticsResponse,
)
from app.core.auth import require_seller

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _days_ago_str(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def _today_start():
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _dec_out(d: Decision) -> DecisionOut:
    product_name = None
    if d.product:
        product_name = d.product.name
    return DecisionOut(
        decision_id=d.decision_id,
        agent_type=d.agent_type,
        decision_type=d.decision_type,
        product_id=d.product_id,
        product_name=product_name,
        review_id=d.review_id,
        proposed_action=json.loads(d.proposed_action) if d.proposed_action else {},
        confidence_score=d.confidence_score,
        risk_level=d.risk_level,
        decision_status=d.decision_status,
        created_at=d.created_at,
    )


def _execute_decision(d: Decision, db: Session):
    """Execute the action described in a decision."""
    try:
        payload = json.loads(d.proposed_action)
    except Exception:
        return

    if d.decision_type == "RESTOCK" and d.product_id:
        product = db.query(Product).filter(Product.product_id == d.product_id).first()
        if product:
            qty = payload.get("suggested_qty", 50)
            product.stock = max(0, product.stock) + qty
            product.updated_at = _now()

    elif d.decision_type == "PRICE_ADJUST" and d.product_id:
        product = db.query(Product).filter(Product.product_id == d.product_id).first()
        if product:
            new_price = payload.get("suggested_price")
            if new_price and new_price >= product.cost * 1.10:
                product.price = new_price
                product.updated_at = _now()

    elif d.decision_type == "REVIEW_DRAFT" and d.review_id:
        review = db.query(Review).filter(Review.review_id == d.review_id).first()
        if review:
            response_text = payload.get("proposed_response")
            if response_text and response_text != "Escalated — manual handling required":
                review.agent_response = response_text
                review.response_status = "published"
                review.response_published_at = _now()


# ─── Decision Queue ───────────────────────────────────────────────────────────

@router.get("/decisions", response_model=DecisionListResponse)
def list_decisions(
    status: Optional[str] = "pending",
    type: Optional[str] = None,
    risk_level: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    q = db.query(Decision)
    if status and status != "all":
        q = q.filter(Decision.decision_status == status)
    if type and type != "all":
        q = q.filter(Decision.decision_type == type)
    if risk_level and risk_level != "all":
        q = q.filter(Decision.risk_level == risk_level)

    total = q.count()
    pending_count = db.query(Decision).filter(Decision.decision_status == "pending").count()
    today = _today_start()
    auto_today = db.query(Decision).filter(
        Decision.decision_status == "auto_executed",
        Decision.updated_at >= today,
    ).count()

    decisions = q.order_by(Decision.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return DecisionListResponse(
        decisions=[_dec_out(d) for d in decisions],
        total=total,
        pending_count=pending_count,
        auto_executed_today=auto_today,
    )


@router.get("/decisions/{decision_id}", response_model=DecisionDetailOut)
def get_decision(
    decision_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    d = db.query(Decision).filter(Decision.decision_id == decision_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Decision not found")

    related_product = None
    if d.product:
        p = d.product
        related_product = {
            "product_id": p.product_id,
            "name": p.name,
            "category": p.category,
            "price": p.price,
            "stock": p.stock,
            "avg_rating": p.avg_rating,
        }

    review_text = None
    if d.review_id and d.review:
        review_text = d.review.text

    # Previous decisions for same product
    prev_decisions = []
    if d.product_id:
        prev = (
            db.query(Decision)
            .filter(
                Decision.product_id == d.product_id,
                Decision.decision_id != d.decision_id,
            )
            .order_by(Decision.created_at.desc())
            .limit(3)
            .all()
        )
        prev_decisions = [
            {
                "decision_id": p.decision_id,
                "decision_type": p.decision_type,
                "decision_status": p.decision_status,
                "created_at": p.created_at,
            }
            for p in prev
        ]

    return DecisionDetailOut(
        decision_id=d.decision_id,
        agent_type=d.agent_type,
        decision_type=d.decision_type,
        product_id=d.product_id,
        product_name=d.product.name if d.product else None,
        review_id=d.review_id,
        proposed_action=json.loads(d.proposed_action) if d.proposed_action else {},
        confidence_score=d.confidence_score,
        risk_level=d.risk_level,
        decision_status=d.decision_status,
        created_at=d.created_at,
        approver_id=d.approver_id,
        rejection_reason=d.rejection_reason,
        updated_at=d.updated_at,
        review_text=review_text,
        related_product=related_product,
        previous_decisions=prev_decisions,
    )


@router.post("/decisions/{decision_id}/approve")
def approve_decision(
    decision_id: str,
    body: ApproveRequest = ApproveRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    d = db.query(Decision).filter(Decision.decision_id == decision_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Decision not found")
    if d.decision_status != "pending":
        raise HTTPException(status_code=400, detail=f"Decision is already {d.decision_status}")

    d.decision_status = "approved"
    d.approver_id = current_user.user_id
    d.updated_at = _now()

    _execute_decision(d, db)
    db.commit()

    return {
        "decision_id": d.decision_id,
        "decision_status": "approved",
        "approved_at": d.updated_at,
        "approver_id": d.approver_id,
        "action_executed": True,
        "decision": _dec_out(d),
    }


@router.post("/decisions/{decision_id}/reject")
def reject_decision(
    decision_id: str,
    body: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    d = db.query(Decision).filter(Decision.decision_id == decision_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Decision not found")
    if d.decision_status != "pending":
        raise HTTPException(status_code=400, detail=f"Decision is already {d.decision_status}")

    d.decision_status = "rejected"
    d.rejection_reason = f"{body.reason}: {body.notes or ''}"
    d.approver_id = current_user.user_id
    d.updated_at = _now()
    db.commit()

    return {
        "decision_id": d.decision_id,
        "decision_status": "rejected",
        "rejection_reason": d.rejection_reason,
        "decision": _dec_out(d),
    }



@router.get("/history")
def get_history(
    type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    q = db.query(Decision).filter(Decision.decision_status != "pending")
    if type and type != "all":
        q = q.filter(Decision.decision_type == type)
    if status and status != "all":
        q = q.filter(Decision.decision_status == status)

    total = q.count()
    decisions = q.order_by(Decision.updated_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "decisions": [
            {
                "decision_id": d.decision_id,
                "agent_type": d.agent_type,
                "decision_type": d.decision_type,
                "product_name": d.product.name if d.product else None,
                "confidence_score": d.confidence_score,
                "risk_level": d.risk_level,
                "decision_status": d.decision_status,
                "approver_id": d.approver_id,
                "rejection_reason": d.rejection_reason,
                "created_at": d.created_at,
                "updated_at": d.updated_at,
            }
            for d in decisions
        ],
        "total": total,
    }


@router.get("/analytics", response_model=HITLAnalyticsResponse)
def get_hitl_analytics(
    period: str = Query(default="30d"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    cutoff = _days_ago_str(days)

    all_decs = db.query(Decision).filter(Decision.created_at >= cutoff).all()
    total = len(all_decs)
    approved = sum(1 for d in all_decs if d.decision_status == "approved")
    rejected = sum(1 for d in all_decs if d.decision_status == "rejected")
    auto_exec = sum(1 for d in all_decs if d.decision_status == "auto_executed")
    approval_rate = approved / (approved + rejected) if (approved + rejected) > 0 else 0.0

    # Avg processing time
    times = []
    for d in all_decs:
        if d.updated_at and d.created_at and d.decision_status != "pending":
            try:
                created = datetime.fromisoformat(d.created_at.replace("Z", "+00:00"))
                updated = datetime.fromisoformat(d.updated_at.replace("Z", "+00:00"))
                times.append((updated - created).total_seconds() / 3600)
            except Exception:
                pass
    avg_time = round(sum(times) / len(times), 2) if times else 0.0

    # By type
    by_type = {}
    for dtype in ["RESTOCK", "PRICE_ADJUST", "REVIEW_DRAFT"]:
        subset = [d for d in all_decs if d.decision_type == dtype]
        by_type[dtype] = {
            "total": len(subset),
            "approved": sum(1 for d in subset if d.decision_status == "approved"),
            "rejected": sum(1 for d in subset if d.decision_status == "rejected"),
            "auto_executed": sum(1 for d in subset if d.decision_status == "auto_executed"),
        }

    # By risk
    by_risk = {}
    for risk in ["LOW", "MEDIUM", "HIGH"]:
        subset = [d for d in all_decs if d.risk_level == risk]
        by_risk[risk] = {
            "total": len(subset),
            "auto_executed": sum(1 for d in subset if d.decision_status == "auto_executed"),
            "approved": sum(1 for d in subset if d.decision_status == "approved"),
            "rejected": sum(1 for d in subset if d.decision_status == "rejected"),
        }

    return HITLAnalyticsResponse(
        period=period,
        total_decisions=total,
        approved=approved,
        rejected=rejected,
        auto_executed=auto_exec,
        approval_rate=round(approval_rate, 3),
        avg_processing_time_hours=avg_time,
        by_type=by_type,
        by_risk=by_risk,
    )
