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
    CopilotExecuteRequest,
    CopilotExecuteResponse,
    CopilotMessageRequest,
    CopilotMessageResponse,
)

from app.services.copilot_service import (
    ask_copilot,
)

from app.services.copilot_permission_service import (
    require_copilot_write_permission,
)

from app.services.copilot_proposal_service import (
    create_copilot_proposal,
    execute_copilot_proposal,
)

from app.services.coreflow_client import (
    get_workspace_context,
    has_workspace_entitlement,
)


router = APIRouter(
    prefix=(
        "/api/v1/intelligence/copilot"
    ),
    tags=[
        "Intelligence Copilot"
    ],
)


def require_ai_copilot(
    organization_id: str,
) -> None:
    try:
        workspace = (
            get_workspace_context(
                organization_id
            )
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
    response_model=(
        CopilotMessageResponse
    ),
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

    user_id = str(
        context["user_id"]
    )

    require_ai_copilot(
        organization_id
    )

    try:
        response = ask_copilot(
            db,
            organization_id=(
                organization_id
            ),
            message=payload.message,
        )

        proposal = (
            create_copilot_proposal(
                db,
                organization_id=(
                    organization_id
                ),
                user_id=user_id,
                response=response,
            )
        )

        if proposal is None:
            return response

        return response.model_copy(
            update={
                "proposal_id":
                    proposal.id,

                "proposal_expires_at":
                    proposal.expires_at,
            }
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
    response_model=(
        CopilotExecuteResponse
    ),
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

    user_id = str(
        context["user_id"]
    )

    role = str(
        context["role"]
    )

    require_ai_copilot(
        organization_id
    )

    # -------------------------------------------------
    # CORE FLOW — SOURCE DE VÉRITÉ DES DROITS MÉTIER
    # -------------------------------------------------

    require_copilot_write_permission(
        role=role
    )

    # -------------------------------------------------
    # PROPOSITION SERVEUR / ANTI-REJEU / IDEMPOTENCE
    # -------------------------------------------------

    return execute_copilot_proposal(
        db,

        proposal_id=(
            payload.proposal_id
        ),

        organization_id=(
            organization_id
        ),

        user_id=user_id,

        confirmed=(
            payload.confirmed
        ),
    )
