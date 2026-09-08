from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel


OperationalDocumentType = Literal[
    "delivery_note",
    "intervention_note",
]

OperationalDocumentStatus = Literal[
    "draft",
    "issued",
    "sent",
    "cancelled",
]


class OperationalDocumentCreateFromQuote(BaseModel):
    document_type: OperationalDocumentType


class OperationalDocumentUpdate(BaseModel):
    execution_date: Optional[date] = None
    location_address: Optional[str] = None
    notes: Optional[str] = None


class OperationalDocumentStatusUpdate(BaseModel):
    status: OperationalDocumentStatus


class OperationalDocumentItemResponse(BaseModel):
    id: str
    quote_item_id: Optional[str] = None

    description: str
    quantity: Decimal
    unit_price: Decimal
    vat_rate: Decimal

    tax_type: Optional[str] = None
    tax_treatment: Optional[str] = None
    tax_reason: Optional[str] = None

    requires_manual_review: bool

    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal


class OperationalDocumentResponse(BaseModel):
    id: str
    quote_id: str
    quote_number: Optional[str] = None

    organization_id: Optional[str] = None

    document_type: OperationalDocumentType
    document_number: str
    status: OperationalDocumentStatus

    issue_date: Optional[date] = None
    execution_date: Optional[date] = None

    location_address: Optional[str] = None
    notes: Optional[str] = None

    items: list[
        OperationalDocumentItemResponse
    ]

    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal

    created_at: datetime
    updated_at: datetime
