import uuid
import time
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import AgentLog, User
from app.schemas import AgentCommandIn, AgentCommandOut, AgentLogOut
from app.core.auth import require_seller

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def simulate_agent_task(seller_id: str, command: str, log_id: str):
    time.sleep(1)  # Simulate agent asynchronous execution
    db = SessionLocal()
    try:
        log = db.query(AgentLog).filter(AgentLog.log_id == log_id).first()
        if log:
            log.details = f"Autonomous Agent executed: '{command}'. Verification complete with 0 anomalies."
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@router.post("/command", response_model=AgentCommandOut)
def execute_agent_command(
    payload: AgentCommandIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    log_id = f"LOG_{uuid.uuid4().hex[:8].upper()}"
    log = AgentLog(
        log_id=log_id,
        seller_id=user.user_id,
        action_type="command",
        details=f"Received command: '{payload.command}'. Dispatching to agent...",
        created_at=_now(),
    )
    db.add(log)
    db.commit()

    background_tasks.add_task(simulate_agent_task, user.user_id, payload.command, log_id)

    return AgentCommandOut(
        status="processing",
        message="Command dispatched to autonomous agent orchestrator.",
        log_id=log_id,
    )


@router.get("/logs", response_model=List[AgentLogOut])
def get_agent_logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    query = db.query(AgentLog)
    if user.account_type == "seller":
        query = query.filter(AgentLog.seller_id == user.user_id)

    logs = query.order_by(AgentLog.created_at.desc()).limit(100).all()
    return [
        AgentLogOut(
            log_id=l.log_id,
            action_type=l.action_type,
            details=l.details,
            created_at=l.created_at,
        )
        for l in logs
    ]
