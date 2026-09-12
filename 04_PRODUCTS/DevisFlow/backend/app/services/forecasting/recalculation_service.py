from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.forecasting.business_service import (
    get_monthly_collections_series,
    get_monthly_quote_acceptance_rate,
    get_monthly_recurring_revenue_share,
    get_monthly_revenue_series,
)
from app.services.forecasting.feature_engineering import (
    rate_points_to_weighted_series,
)
from app.services.forecasting.orchestrator import (
    run_persistent_forecast,
)
from app.services.forecasting.schemas import (
    ForecastResult,
)


def recalculate_business_forecasts(
    db: Session,
    *,
    organization_id: str,
    horizon: int = 3,
) -> list[ForecastResult]:
    """
    Recalcule les quatre indicateurs Intelligence
    à partir des données métier réelles de l'organisation.

    Les résultats exploitables sont persistés par
    run_persistent_forecast().
    """

    revenue_series = (
        get_monthly_revenue_series(
            db,
            organization_id=organization_id,
        )
    )

    collections_series = (
        get_monthly_collections_series(
            db,
            organization_id=organization_id,
        )
    )

    acceptance_rate = (
        get_monthly_quote_acceptance_rate(
            db,
            organization_id=organization_id,
        )
    )

    recurring_share = (
        get_monthly_recurring_revenue_share(
            db,
            organization_id=organization_id,
        )
    )

    acceptance_weighted = (
        rate_points_to_weighted_series(
            acceptance_rate
        )
    )

    recurring_weighted = (
        rate_points_to_weighted_series(
            recurring_share
        )
    )

    return [
        run_persistent_forecast(
            db,
            organization_id=organization_id,
            indicator="monthly_revenue",
            series=revenue_series,
            horizon=horizon,
        ),
        run_persistent_forecast(
            db,
            organization_id=organization_id,
            indicator="monthly_collections",
            series=collections_series,
            horizon=horizon,
        ),
        run_persistent_forecast(
            db,
            organization_id=organization_id,
            indicator="quote_acceptance_rate",
            series=acceptance_weighted,
            horizon=horizon,
            weighted=True,
        ),
        run_persistent_forecast(
            db,
            organization_id=organization_id,
            indicator="recurring_revenue_share",
            series=recurring_weighted,
            horizon=horizon,
            weighted=True,
        ),
    ]
