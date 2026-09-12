from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.forecasting.business_datasets import (
    build_monthly_collections_series,
    build_monthly_quote_acceptance_rate,
    build_monthly_recurring_revenue_share,
    build_monthly_revenue_series,
)
from app.services.forecasting.data_sources import (
    get_acceptance_quotes,
    get_collection_payments,
    get_revenue_invoices,
)
from app.services.forecasting.engine import (
    ForecastingEngine,
)
from app.services.forecasting.feature_engineering import (
    rate_points_to_weighted_series,
)
from app.services.forecasting.schemas import (
    ForecastFrequency,
    ForecastResult,
)


def get_monthly_revenue_series(
    db: Session,
    *,
    organization_id: str,
):
    invoices = get_revenue_invoices(
        db,
        organization_id=organization_id,
    )

    return build_monthly_revenue_series(
        invoices
    )


def forecast_monthly_revenue(
    db: Session,
    *,
    organization_id: str,
    horizon: int = 3,
) -> ForecastResult:
    series = get_monthly_revenue_series(
        db,
        organization_id=organization_id,
    )

    return ForecastingEngine().forecast(
        indicator="monthly_revenue",
        series=series,
        horizon=horizon,
        frequency=ForecastFrequency.MONTHLY,
    )



def get_monthly_collections_series(
    db: Session,
    *,
    organization_id: str,
):
    payments = get_collection_payments(
        db,
        organization_id=organization_id,
    )

    return build_monthly_collections_series(
        payments
    )


def forecast_monthly_collections(
    db: Session,
    *,
    organization_id: str,
    horizon: int = 3,
) -> ForecastResult:
    series = get_monthly_collections_series(
        db,
        organization_id=organization_id,
    )

    return ForecastingEngine().forecast(
        indicator="monthly_collections",
        series=series,
        horizon=horizon,
        frequency=ForecastFrequency.MONTHLY,
    )



def get_monthly_quote_acceptance_rate(
    db: Session,
    *,
    organization_id: str,
):
    quotes = get_acceptance_quotes(
        db,
        organization_id=organization_id,
    )

    return build_monthly_quote_acceptance_rate(
        quotes
    )



def get_monthly_recurring_revenue_share(
    db: Session,
    *,
    organization_id: str,
):
    invoices = get_revenue_invoices(
        db,
        organization_id=organization_id,
    )

    return build_monthly_recurring_revenue_share(
        invoices
    )



def forecast_quote_acceptance_rate(
    db: Session,
    *,
    organization_id: str,
    horizon: int = 3,
) -> ForecastResult:
    rate_series = (
        get_monthly_quote_acceptance_rate(
            db,
            organization_id=organization_id,
        )
    )

    weighted_series = (
        rate_points_to_weighted_series(
            rate_series
        )
    )

    return (
        ForecastingEngine()
        .forecast_weighted_rate(
            indicator="quote_acceptance_rate",
            series=weighted_series,
            horizon=horizon,
        )
    )


def forecast_recurring_revenue_share(
    db: Session,
    *,
    organization_id: str,
    horizon: int = 3,
) -> ForecastResult:
    rate_series = (
        get_monthly_recurring_revenue_share(
            db,
            organization_id=organization_id,
        )
    )

    weighted_series = (
        rate_points_to_weighted_series(
            rate_series
        )
    )

    return (
        ForecastingEngine()
        .forecast_weighted_rate(
            indicator="recurring_revenue_share",
            series=weighted_series,
            horizon=horizon,
        )
    )
