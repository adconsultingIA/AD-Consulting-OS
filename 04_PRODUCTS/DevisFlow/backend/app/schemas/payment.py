from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_date: date
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: UUID
    invoice_id: UUID

    amount: Decimal
    payment_date: date

    payment_method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

    created_at: datetime
