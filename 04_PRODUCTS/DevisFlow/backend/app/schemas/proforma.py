from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


ProformaStatus = Literal[
    "draft",
    "issued",
    "sent",
    "cancelled",
]


class ProformaItemResponse(BaseModel):
    id: UUID
    quote_item_id: Optional[UUID] = None

    description: str
    quantity: Decimal
    unit_price: Decimal
    vat_rate: Decimal

    tax_type: Optional[str] = None
    tax_treatment: Optional[str] = None
    tax_reason: Optional[str] = None
    requires_manual_review: bool = False

    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal


class ProformaUpdate(BaseModel):
    issue_date: Optional[date] = None
    valid_until: Optional[date] = None
    notes: Optional[str] = None


class ProformaStatusUpdate(BaseModel):
    status: ProformaStatus


class ProformaResponse(BaseModel):
    id: UUID
    quote_id: UUID
    quote_number: Optional[str] = None
    organization_id: Optional[UUID] = None

    proforma_number: str
    status: ProformaStatus

    issue_date: Optional[date] = None
    valid_until: Optional[date] = None
    notes: Optional[str] = None

    items: list[ProformaItemResponse] = Field(
        default_factory=list
    )

    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal

    created_at: datetime
    updated_at: datetime
