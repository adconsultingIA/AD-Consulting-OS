from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CreditNoteCreate(BaseModel):
    issue_date: date
    reason: str
    amount: Decimal = Field(gt=0)
    notes: Optional[str] = None


class CreditNoteResponse(BaseModel):
    id: UUID
    invoice_id: UUID

    credit_note_number: str

    issue_date: date
    reason: str
    amount: Decimal

    status: str

    notes: Optional[str] = None

    created_at: datetime
