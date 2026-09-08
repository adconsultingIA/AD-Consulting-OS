from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.quote_status import QuoteStatus


ServiceCategory = Literal[
    "consulting",
    "software",
    "implementation",
    "training",
    "other",
]


class QuoteItemCreate(BaseModel):
    description: str = Field(
        min_length=2,
        max_length=500,
    )

    service_category: ServiceCategory = "other"

    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    vat_rate: Decimal | None = Field(
        default=None,
        ge=0,
        le=100,
    )


class QuoteItemResponse(QuoteItemCreate):
    id: UUID

    tax_type: Optional[str] = None
    tax_treatment: Optional[str] = None
    tax_reason: Optional[str] = None

    requires_manual_review: bool = False

    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal


class QuoteCreate(BaseModel):
    request_id: UUID
    valid_until: Optional[date] = None
    notes: Optional[str] = None
    items: list[QuoteItemCreate] = Field(min_length=1)


class QuoteUpdate(BaseModel):
    valid_until: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[list[QuoteItemCreate]] = None


class QuoteStatusUpdate(BaseModel):
    status: QuoteStatus


QuoteAcceptanceMethod = Literal[
    "email",
    "signed_quote",
    "good_for_agreement",
    "phone",
    "other",
]


class QuoteAcceptanceCreate(BaseModel):
    acceptance_checked: bool
    acceptance_method: QuoteAcceptanceMethod
    accepted_at: datetime

    acceptance_reference: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    acceptance_note: Optional[str] = Field(
        default=None,
        max_length=2000,
    )


class QuoteResponse(BaseModel):
    id: UUID
    quote_number: str
    request_id: UUID
    organization_id: Optional[UUID] = None
    status: QuoteStatus
    version: int = 1

    valid_until: Optional[date] = None
    notes: Optional[str] = None

    acceptance_checked: bool = False
    acceptance_method: Optional[str] = None
    accepted_at: Optional[datetime] = None
    accepted_by_user_id: Optional[str] = None
    acceptance_reference: Optional[str] = None
    acceptance_note: Optional[str] = None
    acceptance_document_path: Optional[str] = None

    items: list[QuoteItemResponse]

    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal

    created_at: datetime
    updated_at: datetime
