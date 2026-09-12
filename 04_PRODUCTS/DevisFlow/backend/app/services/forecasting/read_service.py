from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.intelligence import (
    ForecastAvailabilityResponse,
    ForecastHistoryPointResponse,
    ForecastPointResponse,
    ForecastRunResponse,
)
from app.services.forecasting.business_service import (
    get_monthly_collections_series,
    get_monthly_quote_acceptance_rate,
    get_monthly_recurring_revenue_share,
    get_monthly_revenue_series,
)
from app.services.forecasting.persistence import (
    get_forecast_run_points,
    get_latest_forecast_run,
)


HISTORY_LIMIT = 6


def _get_indicator_history(
    db: Session,
    *,
    organization_id: str,
    indicator: str,
) -> list[ForecastHistoryPointResponse]:
    """
    Retourne les derniers points métier réellement
    utilisés pour alimenter le forecasting.

    Maximum : 6 périodes.
    """

    if indicator == "monthly_revenue":
        series = get_monthly_revenue_series(
            db,
            organization_id=organization_id,
        )

        points = [
            ForecastHistoryPointResponse(
                date=point.timestamp,
                value=float(point.value),
            )
            for point in series
        ]

    elif indicator == "monthly_collections":
        series = get_monthly_collections_series(
            db,
            organization_id=organization_id,
        )

        points = [
            ForecastHistoryPointResponse(
                date=point.timestamp,
                value=float(point.value),
            )
            for point in series
        ]

    elif indicator == "quote_acceptance_rate":
        series = get_monthly_quote_acceptance_rate(
            db,
            organization_id=organization_id,
        )

        points = [
            ForecastHistoryPointResponse(
                date=point.timestamp,
                value=float(point.value),
            )
            for point in series
            if point.value is not None
        ]

    elif indicator == "recurring_revenue_share":
        series = get_monthly_recurring_revenue_share(
            db,
            organization_id=organization_id,
        )

        points = [
            ForecastHistoryPointResponse(
                date=point.timestamp,
                value=float(point.value),
            )
            for point in series
            if point.value is not None
        ]

    else:
        return []

    return points[-HISTORY_LIMIT:]


def get_latest_persisted_forecast(
    db: Session,
    *,
    organization_id: str,
    indicator: str,
) -> ForecastAvailabilityResponse:
    run = get_latest_forecast_run(
        db,
        organization_id=organization_id,
        indicator=indicator,
    )

    if run is None:
        return ForecastAvailabilityResponse(
            indicator=indicator,
            available=False,
            forecast=None,
        )

    points = get_forecast_run_points(
        db,
        forecast_run_id=run.id,
    )

    history = _get_indicator_history(
        db,
        organization_id=organization_id,
        indicator=indicator,
    )

    return ForecastAvailabilityResponse(
        indicator=indicator,
        available=True,
        forecast=ForecastRunResponse(
            id=run.id,
            indicator=run.indicator,
            status=run.status,
            selected_model=run.selected_model,
            quality=run.quality,
            horizon=run.horizon,
            observations=run.observations,
            rmse=(
                float(run.rmse)
                if run.rmse is not None
                else None
            ),
            mae=(
                float(run.mae)
                if run.mae is not None
                else None
            ),
            smape=(
                float(run.smape)
                if run.smape is not None
                else None
            ),
            uncertainty_method=(
                run.uncertainty_method
            ),
            uncertainty_coverage=(
                float(
                    run.uncertainty_coverage
                )
                if run.uncertainty_coverage
                is not None
                else None
            ),
            uncertainty_radius=(
                float(
                    run.uncertainty_radius
                )
                if run.uncertainty_radius
                is not None
                else None
            ),
            calibration_points=(
                run.calibration_points
            ),
            calculated_at=(
                run.calculated_at
            ),
            history=history,
            points=[
                ForecastPointResponse(
                    horizon_step=(
                        point.horizon_step
                    ),
                    forecast_date=(
                        point.forecast_date
                    ),
                    value=float(
                        point.value
                    ),
                    lower_bound=(
                        float(
                            point.lower_bound
                        )
                        if point.lower_bound
                        is not None
                        else None
                    ),
                    upper_bound=(
                        float(
                            point.upper_bound
                        )
                        if point.upper_bound
                        is not None
                        else None
                    ),
                )
                for point in points
            ],
        ),
    )
