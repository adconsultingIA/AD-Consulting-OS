from datetime import datetime
from typing import Any

from pydantic import BaseModel


class HistoryEventResponse(BaseModel):
    id: str
    event_type: str

    entity_type: str
    entity_id: str

    document_number: str | None = None
    client_name: str | None = None

    event_at: datetime

    title: str
    detail: str | None = None

    amount: float | None = None
    status: str | None = None

    metadata: dict[str, Any] = {}
