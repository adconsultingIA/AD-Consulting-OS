from __future__ import annotations

from datetime import (
    date,
    datetime,
)
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
)


CopilotIntent = Literal[
    "business_analysis",
    "materialize_request",
    "prepare_action",
    "general_assistance",
]


class CopilotRequestDraft(BaseModel):
    client_name: str | None = None
    client_id: str | None = None

    title: str | None = None
    description: str | None = None

    budget: float | None = Field(
        default=None,
        ge=0,
    )

    deadline: date | None = None

    missing_fields: list[str] = Field(
        default_factory=list
    )


class CopilotQuoteItemDraft(BaseModel):
    description: str

    service_category: Literal[
        "consulting",
        "software",
        "implementation",
        "training",
        "other",
    ] = "other"

    quantity: float = Field(
        gt=0
    )

    unit_price: float = Field(
        ge=0
    )


class CopilotQuoteDraft(BaseModel):
    request_id: str | None = None
    request_title: str | None = None
    client_name: str | None = None

    valid_until: date | None = None
    notes: str | None = None

    items: list[
        CopilotQuoteItemDraft
    ] = Field(
        default_factory=list
    )

    missing_fields: list[str] = Field(
        default_factory=list
    )


class CopilotSuggestedAction(BaseModel):
    code: str
    label: str
    description: str | None = None

    requires_confirmation: bool = True


class CopilotMessageRequest(BaseModel):
    message: str = Field(
        min_length=2,
        max_length=4000,
    )


class CopilotMessageResponse(BaseModel):
    answer: str
    intent: CopilotIntent

    suggested_actions: list[
        CopilotSuggestedAction
    ] = Field(
        default_factory=list
    )

    draft: CopilotRequestDraft | None = None

    quote_draft: (
        CopilotQuoteDraft | None
    ) = None

    requires_confirmation: bool = False

    proposal_id: str | None = None

    proposal_expires_at: (
        datetime | None
    ) = None


class CopilotExecuteRequest(BaseModel):
    proposal_id: str = Field(
        min_length=1,
    )

    confirmed: bool = False


class CopilotExecuteResponse(BaseModel):
    ok: bool

    action_code: str
    message: str

    request_id: str | None = None
    quote_id: str | None = None

    proposal_id: str | None = None

    replayed: bool = False
