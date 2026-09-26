"""
Shared validation helpers.

The UUID guards exist because asyncpg will happily accept a non-UUID string for
a uuid column and then fail the whole query with
``invalid input for query argument $1: '1' (invalid UUID '1')``. That surfaces
as a 500 with a database-internal message attached, for what is plainly a
malformed request by the caller.
"""
import uuid
from typing import Any
from fastapi import HTTPException, Query


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


def require_valid_uuid_param(val: Any, field: str) -> str:
    """Validated UUID for a *query* parameter — raises 400, not 404.

    A path segment that is not a UUID is a missing resource and correctly
    404s. A query filter like ``?category_id=1`` is a malformed request, and
    letting it reach asyncpg produced a 500 that leaked a database-internal
    message for what is plainly the caller's fault.
    """
    norm = to_valid_uuid(val)
    if not norm:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": f"'{field}' must be a valid UUID.",
                "details": {"field": field, "value": str(val)[:64]},
            },
        )
    return norm


def uuid_query_param(field: str):
    """Build a dependency that validates a UUID query parameter.

    This must be a dependency rather than a check at the top of the handler
    body: FastAPI resolves every dependency (``get_db`` among them) *before*
    calling the handler, so an in-body check runs only after the pool has
    already been handed out, and cannot run at all when the pool is
    unavailable. As a dependency it is evaluated left-to-right in the
    signature, so declaring it before ``db=Depends(get_db)`` rejects the
    malformed request without ever checking a connection out.

    Usage:
        category_id: Annotated[str | None, Depends(uuid_query_param("category_id"))] = None,
    """

    def dependency(value: str | None = Query(None, alias=field)) -> str | None:
        # The alias is load-bearing. FastAPI names a dependency's own parameter
        # as the query key, so without `alias` this would read `?value=1` and
        # silently validate nothing — which is exactly the bug the first
        # version of this helper had.
        if value is None or not str(value).strip():
            return None
        return require_valid_uuid_param(value, field)

    dependency.__name__ = f"uuid_query_{field}"
    return dependency
