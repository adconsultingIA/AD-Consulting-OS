from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class PaymentReminderCreate(BaseModel):
    reminder_date: date
    channel: str = "email"
    subject: Optional[str] = None
    message: Optional[str] = None


class PaymentReminderResponse(BaseModel):
    id: UUID
    invoice_id: UUID

    reminder_date: date
    channel: str

    subject: Optional[str] = None
    message: Optional[str] = None

    created_at: datetime



ReminderCockpitStatus = Literal[
    "due",
    "upcoming",
    "paused",
]


class PaymentReminderCockpitItem(BaseModel):
    invoice_id: UUID
    invoice_number: str
    client_name: str

    due_date: Optional[date] = None
    amount_due: Decimal

    last_reminder_date: Optional[date] = None
    reminder_count: int = 0

    next_reminder_date: Optional[date] = None
    reminder_interval_days: int = 7
    reminder_paused: bool = False

    status: ReminderCockpitStatus
    can_remind: bool
