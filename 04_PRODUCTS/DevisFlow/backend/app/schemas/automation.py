from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AutomationRuleCreate(BaseModel):
    automation_type: str
    name: str
    trigger_type: str

    enabled: bool = True
    requires_confirmation: bool = False

    conditions: dict[str, Any] = {}
    action_config: dict[str, Any] = {}


class AutomationRuleUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None

    requires_confirmation: bool | None = None

    conditions: dict[str, Any] | None = None
    action_config: dict[str, Any] | None = None


class AutomationRuleResponse(BaseModel):
    id: str
    organization_id: str

    automation_type: str
    name: str

    enabled: bool
    trigger_type: str

    conditions: dict[str, Any]
    action_config: dict[str, Any]

    requires_confirmation: bool

    last_run_at: datetime | None = None
    next_run_at: datetime | None = None

    created_at: datetime
    updated_at: datetime


class AutomationExecutionResponse(BaseModel):
    id: str
    automation_rule_id: str
    organization_id: str

    entity_type: str | None = None
    entity_id: str | None = None

    status: str

    trigger_payload: dict[str, Any]

    result_payload: dict[str, Any] | None = None
    error_message: str | None = None

    started_at: datetime
    completed_at: datetime | None = None


from typing import Literal


class AutomationExecutionCallback(BaseModel):
    status: Literal[
        "completed",
        "failed",
    ]

    result_payload: dict[str, Any] | None = None
    error_message: str | None = None