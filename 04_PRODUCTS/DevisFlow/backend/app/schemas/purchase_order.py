from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


PurchaseOrderStatus = Literal[
    "draft",
    "issued",
    "sent",
    "cancelled",
]


class PurchaseOrderItemResponse(BaseModel):
    id: UUID

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


class PurchaseOrderUpdate(BaseModel):
    order_date: Optional[date] = None
    intervention_address: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderStatusUpdate(BaseModel):
    status: PurchaseOrderStatus


class PurchaseOrderResponse(BaseModel):
    id: UUID
    quote_id: UUID
    quote_number: Optional[str] = None
    organization_id: Optional[UUID] = None

    purchase_order_number: str
    status: PurchaseOrderStatus

    order_date: Optional[date] = None
    intervention_address: Optional[str] = None
    notes: Optional[str] = None

    items: list[PurchaseOrderItemResponse] = Field(
        default_factory=list
    )

    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal

    created_at: datetime
    updated_at: datetime
