from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


RequestStatus = Literal[
    "draft",
    "new",
    "qualified",
    "quoted",
    "won",
    "lost",
    "cancelled",
]


class RequestCreate(BaseModel):
    client_id: UUID
    title: str = Field(min_length=2, max_length=200)
    description: Optional[str] = Field(
        default=None,
        min_length=2,
    )
    budget: Optional[float] = Field(default=None, ge=0)
    deadline: Optional[date] = None


class RequestUpdate(BaseModel):
    client_id: Optional[UUID] = None

    title: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=200,
    )

    description: Optional[str] = Field(
        default=None,
        min_length=2,
    )

    budget: Optional[float] = Field(
        default=None,
        ge=0,
    )

    deadline: Optional[date] = None

    status: Optional[RequestStatus] = None


class RequestResponse(RequestCreate):
    id: UUID
    status: RequestStatus = "new"
    created_at: datetime
