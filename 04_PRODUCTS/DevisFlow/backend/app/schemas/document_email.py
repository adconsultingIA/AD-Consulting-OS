from datetime import datetime

from pydantic import BaseModel


class DocumentEmailResponse(BaseModel):
    id: str
    organization_id: str
    document_type: str
    document_id: str
    recipient: str
    subject: str
    status: str
    provider: str
    provider_message_id: str | None = None
    error_message: str | None = None
    sent_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True
