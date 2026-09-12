
from uuid import UUID
import os
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Header,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.devisflow_context import (
    get_devisflow_context,
)
from app.models.database_models import (
    AutomationExecutionDB,
)
from app.schemas.automation import (
    AutomationExecutionResponse,
    AutomationRuleCreate,
    AutomationRuleResponse,
    AutomationRuleUpdate,
    AutomationExecutionCallback,
    AutomationExecutionResponse,
)
from app.services.automation_scanner import (
    scan_due_invoice_payment_reminders,
)

from app.services.automation_service import (
    create_automation_rule,
    get_automation_rule,
    list_automation_executions,
    list_automation_rules,
    update_automation_rule,
    get_automation_execution,
    mark_automation_execution_completed,
    mark_automation_execution_failed,
)
from app.services.coreflow_client import (
    get_workspace_context,
    has_workspace_entitlement,
)


router = APIRouter(
    prefix="/api/v1/intelligence/automations",
    tags=["Intelligence automations"],
)


def require_advanced_automation(
    organization_id: str,
) -> None:
    try:
        workspace = get_workspace_context(
            organization_id
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    if not has_workspace_entitlement(
        workspace,
        "advanced_automation",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "L'automatisation avancée "
                "n'est pas disponible pour ce plan."
            ),
        )


def build_rule_response(
    rule,
) -> AutomationRuleResponse:
    return AutomationRuleResponse(
        id=rule.id,
        organization_id=rule.organization_id,
        automation_type=rule.automation_type,
        name=rule.name,
        enabled=bool(rule.enabled),
        trigger_type=rule.trigger_type,
        conditions=rule.conditions or {},
        action_config=rule.action_config or {},
        requires_confirmation=bool(
            rule.requires_confirmation
        ),
        last_run_at=rule.last_run_at,
        next_run_at=rule.next_run_at,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


@router.get(
    "",
    response_model=list[AutomationRuleResponse],
)
def get_automation_rules(
    context: dict = Depends(
        get_devisflow_context
    ),
    db: Session = Depends(
        get_db
    ),
):
    organization_id = context[
        "organization_id"
    ]

    require_advanced_automation(
        organization_id
    )

    rules = list_automation_rules(
        db=db,
        organization_id=organization_id,
    )

    return [
        build_rule_response(rule)
        for rule in rules
    ]


@router.post(
    "",
    response_model=AutomationRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_rule(
    payload: AutomationRuleCreate,
    context: dict = Depends(
        get_devisflow_context
    ),
    db: Session = Depends(
        get_db
    ),
):
    organization_id = context[
        "organization_id"
    ]

    require_advanced_automation(
        organization_id
    )

    rule = create_automation_rule(
        db=db,
        organization_id=organization_id,
        payload=payload,
    )

    return build_rule_response(rule)


@router.patch(
    "/{rule_id}",
    response_model=AutomationRuleResponse,
)
def patch_rule(
    rule_id: UUID,
    payload: AutomationRuleUpdate,
    context: dict = Depends(
        get_devisflow_context
    ),
    db: Session = Depends(
        get_db
    ),
):
    organization_id = context[
        "organization_id"
    ]

    require_advanced_automation(
        organization_id
    )

    rule = get_automation_rule(
        db=db,
        organization_id=organization_id,
        rule_id=str(rule_id),
    )

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation rule not found",
        )

    rule = update_automation_rule(
        db=db,
        rule=rule,
        payload=payload,
    )

    return build_rule_response(rule)



@router.post(
    "/internal/scan-due",
)
def scan_due_automations_internal(
    dry_run: bool = True,
    x_devisflow_automation_secret: str | None = Header(
        default=None,
        alias="X-DevisFlow-Automation-Secret",
    ),
    db: Session = Depends(get_db),
):
    expected_secret = os.getenv(
        "MAKE_DEVISFLOW_AUTOMATION_SECRET"
    )

    if not expected_secret:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "MAKE_DEVISFLOW_AUTOMATION_SECRET "
                "non configuré."
            ),
        )

    if (
        x_devisflow_automation_secret
        != expected_secret
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Automation scanner "
                "non autorisé."
            ),
        )

    return scan_due_invoice_payment_reminders(
        db,
        dry_run=dry_run,
    )


@router.post(
    "/internal/executions/{execution_id}/callback",
    response_model=AutomationExecutionResponse,
)
def automation_execution_internal_callback(
    execution_id: UUID,
    payload: AutomationExecutionCallback,
    x_devisflow_automation_secret: str | None = Header(
        default=None,
        alias="X-DevisFlow-Automation-Secret",
    ),
    db: Session = Depends(
        get_db
    ),
):
    expected_secret = os.getenv(
        "MAKE_DEVISFLOW_AUTOMATION_SECRET"
    )

    if not expected_secret:
        raise HTTPException(
    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    detail=(
        "MAKE_DEVISFLOW_AUTOMATION_SECRET "
        "non configuré."
    ),
)

    if (
        x_devisflow_automation_secret
        != expected_secret
    ):
        raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Callback Make non autorisé.",
    )

    execution = (
        db.query(AutomationExecutionDB)
        .filter(
            AutomationExecutionDB.id
            == str(execution_id)
        )
        .first()
    )

    if not execution:
        raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="Automation execution not found",
    )

    existing_result = (
        execution.result_payload or {}
    )

    callback_result = (
        payload.result_payload or {}
    )

    merged_result = {
        **existing_result,
        **callback_result,
    }

    if payload.status == "completed":
        execution = (
            mark_automation_execution_completed(
                db,
                execution,
                result_payload=merged_result,
            )
        )
    else:
        execution = (
            mark_automation_execution_failed(
                db,
                execution,
                error_message=(
                    payload.error_message
                    or "Automation failed"
                ),
                result_payload=merged_result,
            )
        )

    return build_execution_response(
        execution
    )


def build_execution_response(
    execution,
) -> AutomationExecutionResponse:
    return AutomationExecutionResponse(
        id=execution.id,
        automation_rule_id=(
            execution.automation_rule_id
        ),
        organization_id=(
            execution.organization_id
        ),
        entity_type=execution.entity_type,
        entity_id=execution.entity_id,
        status=execution.status,
        trigger_payload=(
            execution.trigger_payload or {}
        ),
        result_payload=(
            execution.result_payload
        ),
        error_message=(
            execution.error_message
        ),
        started_at=execution.started_at,
        completed_at=execution.completed_at,
    )


@router.get(
    "/{rule_id}/executions",
    response_model=list[
        AutomationExecutionResponse
    ],
)
def get_rule_executions(
    rule_id: UUID,
    context: dict = Depends(
        get_devisflow_context
    ),
    db: Session = Depends(
        get_db
    ),
):
    organization_id = context[
        "organization_id"
    ]

    require_advanced_automation(
        organization_id
    )

    rule = get_automation_rule(
        db=db,
        organization_id=organization_id,
        rule_id=str(rule_id),
    )

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation rule not found",
                )

    executions = list_automation_executions(
            db=db,
            organization_id=organization_id,
            rule_id=str(rule_id),
        )

    return [
            build_execution_response(execution)
            for execution in executions
        ]
