from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    String,
    Text,
    func,
)

from app.core.database import Base


class DocumentEmailDB(Base):
    __tablename__ = "document_emails"

    id = Column(
        String,
        primary_key=True,
    )

    organization_id = Column(
        String,
        nullable=False,
        index=True,
    )

    document_type = Column(
        String(20),
        nullable=False,
        index=True,
    )

    document_id = Column(
        String,
        nullable=False,
        index=True,
    )

    recipient = Column(
        String(320),
        nullable=False,
    )

    subject = Column(
        String(500),
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="pending",
        index=True,
    )

    provider = Column(
        String(50),
        nullable=False,
        default="smtp",
    )

    provider_message_id = Column(
        String(500),
        nullable=True,
    )

    error_message = Column(
        Text,
        nullable=True,
    )

    sent_at = Column(
        DateTime,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        default=datetime.utcnow,
    )
