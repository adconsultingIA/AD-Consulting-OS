from __future__ import annotations

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
from app.schemas.intelligence import (
    ForecastAvailabilityResponse,
    ForecastRecalculationItemResponse,
    ForecastRecalculationResponse,
    RecommendedActionsResponse,
)
from app.services.coreflow_client import (
    get_workspace_context,
    has_workspace_entitlement,
)
from app.services.forecasting.indicator_catalog import (
    get_indicator_definition,
)
from app.services.forecasting.read_service import (
    get_latest_persisted_forecast,
)
from app.services.forecasting.recalculation_service import (
    recalculate_business_forecasts,
)
from app.services.recommended_actions_service import (
    build_recommended_actions,
)


router = APIRouter(
    prefix="/api/v1/intelligence",
    tags=["Intelligence"],
)


@router.get(
    "/forecasts/{indicator}",
    response_model=ForecastAvailabilityResponse,
)
def get_latest_forecast(
    indicator: str,
    context: dict = Depends(
        get_devisflow_context
    ),
    db: Session = Depends(
        get_db
    ),
):
    try:
        get_indicator_definition(
            indicator
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    organization_id = context[
        "organization_id"
    ]

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
        "forecasting",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "La fonctionnalité forecasting "
                "n'est pas disponible pour ce plan."
            ),
        )

    return get_latest_persisted_forecast(
        db,
        organization_id=organization_id,
        indicator=indicator,
    )


@router.post(
    "/forecasts/recalculate",
    response_model=ForecastRecalculationResponse,
)
def recalculate_forecasts(
    horizon: int = 3,
    context: dict = Depends(
        get_devisflow_context
    ),
    db: Session = Depends(
        get_db
    ),
):
    if horizon < 1 or horizon > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "horizon doit être compris "
                "entre 1 et 12."
            ),
        )

    organization_id = context[
        "organization_id"
    ]

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
        "forecasting",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "La fonctionnalité forecasting "
                "n'est pas disponible pour ce plan."
            ),
        )

    results = recalculate_business_forecasts(
        db,
        organization_id=organization_id,
        horizon=horizon,
    )

    return ForecastRecalculationResponse(
        organization_id=organization_id,
        horizon=horizon,
        results=[
            ForecastRecalculationItemResponse(
                indicator=result.indicator,
                status=result.status,
                quality=result.quality.value,
                selected_model=(
                    result.selected_model
                ),
                observations=(
                    result.observations
                ),
                persisted=(
                    result.status
                    == "completed"
                ),
            )
            for result in results
        ],
    )


@router.get(
    "/recommended-actions",
    response_model=RecommendedActionsResponse,
)
def get_recommended_actions(
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
        "recommended_actions",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Les actions recommandées "
                "ne sont pas disponibles "
                "pour ce plan."
            ),
        )

    actions = build_recommended_actions(
        db,
        organization_id=organization_id,
    )

    return RecommendedActionsResponse(
        organization_id=organization_id,
        count=len(actions),
        actions=actions,
    )
