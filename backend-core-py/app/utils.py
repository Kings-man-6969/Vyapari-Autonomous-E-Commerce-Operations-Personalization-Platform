import uuid
from typing import Any
from fastapi import HTTPException


def is_valid_uuid(val: Any) -> bool:
    """Returns True if val is a valid UUID string, False otherwise."""
    if not val:
        return False
    try:
        uuid.UUID(str(val).strip())
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def to_valid_uuid(val: Any) -> str | None:
    """Returns the normalized UUID string if valid, None otherwise."""
    if not val:
        return None
    try:
        return str(uuid.UUID(str(val).strip()))
    except (ValueError, AttributeError, TypeError):
        return None


def require_valid_uuid(val: Any, error_code: str = "NOT_FOUND", message: str = "Resource not found.") -> str:
    """Raises a 404 HTTPException if val is not a valid UUID, otherwise returns normalized UUID string."""
    norm = to_valid_uuid(val)
    if not norm:
        raise HTTPException(status_code=404, detail={"code": error_code, "message": message})
    return norm
