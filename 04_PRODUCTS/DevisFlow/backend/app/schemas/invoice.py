from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


InvoiceStatus = Literal[
    "draft",
    "issued",
    "sent",
    "partial",
    "paid",
    "overdue",
    "cancelled",
]

InvoiceType = Literal[
    "standard",
    "deposit",
    "balance",
]


class InvoiceItemResponse(BaseModel):
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


class InvoiceCreateFromQuote(BaseModel):
    invoice_type: InvoiceType = "standard"

    billing_percentage: Optional[Decimal] = Field(
        default=None,
        gt=0,
        le=100,
    )


class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus


class InvoiceUpdate(BaseModel):
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    payment_terms_days: Optional[int] = None
    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: UUID
    quote_id: UUID
    organization_id: Optional[UUID] = None
    recurring_invoice_id: Optional[UUID] = None
    recurring_invoice_id: Optional[UUID] = None

    invoice_number: str
    status: InvoiceStatus

    invoice_type: InvoiceType = "standard"
    billing_percentage: Optional[Decimal] = None
    billing_sequence: Optional[int] = None

    issue_date: Optional[date] = None
    due_date: Optional[date] = None

    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    payment_terms_days: Optional[int] = None

    next_reminder_date: Optional[date] = None
    reminder_interval_days: int = 7
    reminder_paused: bool = False

    notes: Optional[str] = None

    
    items: list[InvoiceItemResponse] = Field(
        default_factory=list
        
   
    )
    

    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal

    amount_paid: Decimal
    amount_due: Decimal

    created_at: datetime
    updated_at: datetime
    
    credit_total: Decimal
    net_total: Decimal
    customer_credit: Decimal
    refunded_total: Decimal
