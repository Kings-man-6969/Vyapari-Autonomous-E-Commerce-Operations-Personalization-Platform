from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime

from ... import models, schemas
from ...core.security import get_db, require_roles

router = APIRouter()

@router.get("/decisions", response_model=schemas.DecisionsResponse)
def list_decisions(
    status: Optional[str] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles({"admin", "seller"})),
):
    query = db.query(models.Decision)
    if status:
        query = query.filter(models.Decision.decision_status == status)
    if type:
        query = query.filter(models.Decision.decision_type == type)

    decisions = query.order_by(models.Decision.created_at.desc()).all()
    return schemas.DecisionsResponse(decisions=[schemas.DecisionOut.model_validate(d) for d in decisions], total=len(decisions))


@router.get("/decisions/{decision_id}", response_model=schemas.DecisionOut)
def get_decision(decision_id: str, db: Session = Depends(get_db), _: models.User = Depends(require_roles({"admin", "seller"}))):
    decision = db.query(models.Decision).filter(models.Decision.decision_id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return schemas.DecisionOut.model_validate(decision)


@router.post("/decisions/{decision_id}/approve")
def approve_decision(
    decision_id: str,
    payload: schemas.ApproveDecisionIn,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles({"admin", "seller"})),
):
    decision = db.query(models.Decision).filter(models.Decision.decision_id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    if decision.decision_status != "pending":
        raise HTTPException(status_code=400, detail="Only pending decisions can be approved")

    decision.decision_status = "approved"
    decision.approval_reason = f"Approved by {payload.approver_id}"
    decision.updated_at = datetime.utcnow()
    db.commit()
    return {"decision": schemas.DecisionOut.model_validate(decision), "approved_at": datetime.utcnow().isoformat() + "Z"}


@router.post("/decisions/{decision_id}/reject")
def reject_decision(
    decision_id: str,
    payload: schemas.RejectDecisionIn,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles({"admin", "seller"})),
):
    decision = db.query(models.Decision).filter(models.Decision.decision_id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    if decision.decision_status != "pending":
        raise HTTPException(status_code=400, detail="Only pending decisions can be rejected")

    decision.decision_status = "rejected"
    decision.approval_reason = f"Rejected by {payload.approver_id}: {payload.reason}"
    decision.updated_at = datetime.utcnow()
    db.commit()
    return {"decision": schemas.DecisionOut.model_validate(decision), "rejected_at": datetime.utcnow().isoformat() + "Z"}


@router.get("/history", response_model=schemas.DecisionHistoryResponse)
def hitl_history(db: Session = Depends(get_db), _: models.User = Depends(require_roles({"admin", "seller"}))):
    decisions = (
        db.query(models.Decision)
        .filter(models.Decision.decision_status.in_(["approved", "rejected", "auto_executed"]))
        .order_by(models.Decision.updated_at.desc())
        .all()
    )
    return schemas.DecisionHistoryResponse(decisions=[schemas.DecisionOut.model_validate(d) for d in decisions], total=len(decisions))


@router.get("/analytics", response_model=schemas.HitlAnalyticsResponse)
def hitl_analytics(db: Session = Depends(get_db), _: models.User = Depends(require_roles({"admin", "seller"}))):
    total = db.query(models.Decision).count()
    approved = db.query(models.Decision).filter(models.Decision.decision_status == "approved").count()
    rejected = db.query(models.Decision).filter(models.Decision.decision_status == "rejected").count()
    avg_wait_seconds = (
        db.query(func.avg(func.strftime("%s", models.Decision.updated_at) - func.strftime("%s", models.Decision.created_at))).scalar()
        if total > 0
        else 0
    )

    if total == 0:
        return schemas.HitlAnalyticsResponse(approval_rate=0, rejection_rate=0, avg_wait_time_ms=0)

    return schemas.HitlAnalyticsResponse(
        approval_rate=round((approved / total) * 100, 2),
        rejection_rate=round((rejected / total) * 100, 2),
        avg_wait_time_ms=int((avg_wait_seconds or 0) * 1000),
    )
