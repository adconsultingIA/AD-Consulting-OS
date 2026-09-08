from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


RecurringFrequency = Literal[
    "monthly",
    "quarterly",
    "yearly",
]

RecurringInvoiceStatus = Literal[
    "active",
    "paused",
    "stopped",
]


class RecurringInvoiceCreate(BaseModel):
    service_name: str = Field(
        min_length=1,
        max_length=250,
    )

    frequency: RecurringFrequency

    start_date: date

    next_invoice_date: Optional[date] = None


class RecurringInvoiceUpdate(BaseModel):
    service_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=250,
    )

    frequency: Optional[
        RecurringFrequency
    ] = None

    next_invoice_date: Optional[
        date
    ] = None


class RecurringInvoiceStatusUpdate(
    BaseModel
):
    status: RecurringInvoiceStatus


class RecurringInvoiceResponse(BaseModel):
    id: UUID
    quote_id: UUID
    quote_number: Optional[str] = None
    client_name: Optional[str] = None
    organization_id: Optional[UUID] = None

    service_name: str
    frequency: RecurringFrequency

    start_date: date
    next_invoice_date: date

    status: RecurringInvoiceStatus

    last_generated_at: Optional[
        datetime
    ] = None

    generated_invoices_count: int = 0

    created_at: datetime
    updated_at: datetime
