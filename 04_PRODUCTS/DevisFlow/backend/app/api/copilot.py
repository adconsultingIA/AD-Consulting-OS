from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.core.database import get_db

from app.core.devisflow_context import (
    get_devisflow_context,
)

from app.schemas.copilot import (
    CopilotMessageRequest,
    CopilotMessageResponse,
)

from app.services.copilot_service import (
    ask_copilot,
)

from app.services.coreflow_client import (
    get_workspace_context,
    has_workspace_entitlement,
)

from app.schemas.copilot import (
    CopilotExecuteRequest,
    CopilotExecuteResponse,
)

from app.services.copilot_service import (
    execute_copilot_action,
)


router = APIRouter(
    prefix="/api/v1/intelligence/copilot",
    tags=["Intelligence Copilot"],
)


def require_ai_copilot(
    organization_id: str,
) -> None:
    try:
        workspace = get_workspace_context(
            organization_id
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=str(exc),
        ) from exc

    if not has_workspace_entitlement(
        workspace,
        "ai_copilot",
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "AI Copilot n'est pas "
                "disponible pour ce plan."
            ),
        )


@router.post(
    "",
    response_model=CopilotMessageResponse,
)
def copilot_message(
    payload: CopilotMessageRequest,
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

    require_ai_copilot(
        organization_id
    )

    try:
        return ask_copilot(
            db,
            organization_id=organization_id,
            message=payload.message,
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=str(exc),
        ) from exc


@router.post(
    "/execute",
    response_model=CopilotExecuteResponse,
)
def execute_action(
    payload: CopilotExecuteRequest,
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

    require_ai_copilot(
        organization_id
    )

    result = execute_copilot_action(
        db,
        organization_id=organization_id,
        action_code=payload.action_code,
        confirmed=payload.confirmed,
        draft=payload.draft,
        quote_draft=payload.quote_draft,
    )

    if payload.action_code == "create_request":
        return CopilotExecuteResponse(
    ok=True,
    action_code=payload.action_code,
    message="Request created successfully",
    request_id=str(result.id),
)

    if payload.action_code == "create_quote":
        return CopilotExecuteResponse(
    ok=True,
    action_code=payload.action_code,
    message="Quote created successfully",
    quote_id=str(result.id),
    )

    raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="Unsupported Copilot action",
    )