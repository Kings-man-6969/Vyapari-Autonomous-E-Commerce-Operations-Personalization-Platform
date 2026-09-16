"""
Vyapari — Common Pydantic Schemas (shared across modules)
"""
from __future__ import annotations

from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

DataT = TypeVar("DataT")


class VyapariBaseModel(BaseModel):
    """Base with orm_mode enabled for all response schemas."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PaginatedResponse(VyapariBaseModel, Generic[DataT]):
    """Generic paginated list response."""
    items: list[DataT]
    total: int
    page: int
    page_size: int
    has_next: bool
    has_prev: bool


class MessageResponse(VyapariBaseModel):
    """Simple success message."""
    message: str


class ErrorDetail(VyapariBaseModel):
    """Standard error detail."""
    field: str | None = None
    message: str


class ErrorResponse(VyapariBaseModel):
    """Standard error response body."""
    detail: str
    errors: list[ErrorDetail] | None = None
