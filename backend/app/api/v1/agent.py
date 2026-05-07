from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
import uuid
import time
from typing import List

from ... import models, schemas
from ...core.security import get_db, require_roles
from ...database import SessionLocal

router = APIRouter()

# Mock orchestration logic for background task
def simulate_agent_task(seller_id: str, command: str, log_id: str):
    time.sleep(2)  # Simulate LLM thinking

    db = SessionLocal()
    try:
        log = db.query(models.AgentLog).filter(models.AgentLog.log_id == log_id).first()
        if log:
            log.details = f"Executed command: '{command}'. Action completed successfully."
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

@router.post("/command", response_model=schemas.AgentCommandOut)
def execute_agent_command(
    payload: schemas.AgentCommandIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles({"seller"}))
):
    log_id = f"LOG_{uuid.uuid4().hex[:8].upper()}"
    
    # Create the initial log entry
    log = models.AgentLog(
        log_id=log_id,
        seller_id=user.user_id,
        action_type="command",
        details=f"Received command: '{payload.command}'. Processing..."
    )
    db.add(log)
    db.commit()
    
    # Queue the background task
    background_tasks.add_task(simulate_agent_task, user.user_id, payload.command, log_id)
    
    return schemas.AgentCommandOut(
        status="processing",
        message="Your command has been sent to the AI assistant.",
        log_id=log_id
    )

@router.get("/logs", response_model=List[schemas.AgentLogOut])
def get_agent_logs(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles({"seller", "admin"}))
):
    query = db.query(models.AgentLog)
    if user.account_type == "seller":
        query = query.filter(models.AgentLog.seller_id == user.user_id)
    
    logs = query.order_by(models.AgentLog.created_at.desc()).all()
    return logs
