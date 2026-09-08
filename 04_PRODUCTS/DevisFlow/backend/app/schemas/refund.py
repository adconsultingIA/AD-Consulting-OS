from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RefundCreate(BaseModel):
    amount: Decimal = Field(gt=0)

    refund_date: date

    refund_method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None


class RefundResponse(BaseModel):
    id: UUID
    invoice_id: UUID

    amount: Decimal
    refund_date: date

    refund_method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

    created_at: datetime

    class Config:
        from_attributes = True
