from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    JSON,
    String,
    func,
)

from app.core.database import Base


class CopilotActionProposalDB(Base):
    __tablename__ = "copilot_action_proposals"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=False,
        index=True,
    )

    user_id = Column(
        String,
        nullable=False,
        index=True,
    )

    action_code = Column(
        String(100),
        nullable=False,
        index=True,
    )

    payload = Column(
        JSON,
        nullable=False,
    )

    payload_hash = Column(
        String(64),
        nullable=False,
    )

    status = Column(
        String(30),
        nullable=False,
        default="pending",
        index=True,
    )

    expires_at = Column(
        DateTime,
        nullable=False,
        index=True,
    )

    consumed_at = Column(
        DateTime,
        nullable=True,
    )

    result_entity_type = Column(
        String(50),
        nullable=True,
    )

    result_entity_id = Column(
        String,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
