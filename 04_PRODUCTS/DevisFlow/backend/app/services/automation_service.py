from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.database_models import (
    AutomationExecutionDB,
    AutomationRuleDB,
)


DEFAULT_REMINDER_INTERVAL_DAYS = 7


def create_automation_rule(
    db: Session,
    organization_id: str,
    payload,
) -> AutomationRuleDB:
    action_config = dict(payload.action_config or {})

    if (
        payload.automation_type == "invoice_payment_reminder"
        and "interval_days" not in action_config
    ):
        action_config["interval_days"] = (
            DEFAULT_REMINDER_INTERVAL_DAYS
        )

    rule = AutomationRuleDB(
        id=str(uuid4()),
        organization_id=organization_id,
        automation_type=payload.automation_type,
        name=payload.name,
        enabled=payload.enabled,
        trigger_type=payload.trigger_type,
        conditions=dict(payload.conditions or {}),
        action_config=action_config,
        requires_confirmation=(
            payload.requires_confirmation
        ),
    )

    db.add(rule)
    db.commit()
    db.refresh(rule)

    return rule


def list_automation_rules(
    db: Session,
    organization_id: str,
) -> list[AutomationRuleDB]:
    return (
        db.query(AutomationRuleDB)
        .filter(
            AutomationRuleDB.organization_id
            == organization_id
        )
        .order_by(
            AutomationRuleDB.created_at.asc()
        )
        .all()
    )


def get_automation_rule(
    db: Session,
    organization_id: str,
    rule_id: str,
) -> AutomationRuleDB | None:
    return (
        db.query(AutomationRuleDB)
        .filter(
            AutomationRuleDB.id == rule_id,
            AutomationRuleDB.organization_id
            == organization_id,
        )
        .first()
    )


def update_automation_rule(
    db: Session,
    rule: AutomationRuleDB,
    payload,
) -> AutomationRuleDB:
    updates = payload.model_dump(
        exclude_unset=True
    )

    for field, value in updates.items():
        setattr(rule, field, value)

    rule.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(rule)

    return rule


def create_automation_execution(
    db: Session,
    rule: AutomationRuleDB,
    *,
    entity_type: str | None = None,
    entity_id: str | None = None,
    trigger_payload: dict | None = None,
) -> AutomationExecutionDB:
    execution = AutomationExecutionDB(
        id=str(uuid4()),
        automation_rule_id=rule.id,
        organization_id=rule.organization_id,
        entity_type=entity_type,
        entity_id=entity_id,
        status="pending",
        trigger_payload=trigger_payload or {},
    )

    db.add(execution)
    db.commit()
    db.refresh(execution)

    return execution


def list_automation_executions(
    db: Session,
    organization_id: str,
    rule_id: str,
) -> list[AutomationExecutionDB]:
    return (
        db.query(AutomationExecutionDB)
        .filter(
            AutomationExecutionDB.organization_id
            == organization_id,
            AutomationExecutionDB.automation_rule_id
            == rule_id,
        )
        .order_by(
            AutomationExecutionDB.started_at.desc()
        )
        .all()
    )


def get_active_automation_execution(
    db: Session,
    *,
    rule: AutomationRuleDB,
    entity_type: str,
    entity_id: str,
) -> AutomationExecutionDB | None:
    return (
        db.query(AutomationExecutionDB)
        .filter(
            AutomationExecutionDB.organization_id
            == rule.organization_id,
            AutomationExecutionDB.automation_rule_id
            == rule.id,
            AutomationExecutionDB.entity_type
            == entity_type,
            AutomationExecutionDB.entity_id
            == entity_id,
            AutomationExecutionDB.status.in_(
                [
                    "pending",
                    "running",
                ]
            ),
        )
        .order_by(
            AutomationExecutionDB.started_at.desc()
        )
        .first()
    )



def mark_automation_execution_running(
    db: Session,
    execution: AutomationExecutionDB,
) -> AutomationExecutionDB:
    execution.status = "running"

    db.commit()
    db.refresh(execution)

    return execution


def mark_automation_execution_completed(
    db: Session,
    execution: AutomationExecutionDB,
    result_payload: dict | None = None,
) -> AutomationExecutionDB:
    execution.status = "completed"
    execution.result_payload = (
        result_payload or {}
    )
    execution.error_message = None
    execution.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(execution)

    return execution


def mark_automation_execution_failed(
    db: Session,
    execution: AutomationExecutionDB,
    error_message: str,
    result_payload: dict | None = None,
) -> AutomationExecutionDB:
    execution.status = "failed"
    execution.result_payload = result_payload
    execution.error_message = error_message
    execution.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(execution)

    return execution

def get_automation_execution(
    db: Session,
    organization_id: str,
    execution_id: str,
) -> AutomationExecutionDB | None:
    return (
db.query(AutomationExecutionDB)
.filter(
    AutomationExecutionDB.id
    == execution_id,
    AutomationExecutionDB.organization_id
    == organization_id,
)
.first()
)