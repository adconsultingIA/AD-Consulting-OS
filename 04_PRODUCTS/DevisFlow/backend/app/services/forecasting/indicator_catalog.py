from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.services.forecasting.schemas import (
    ForecastFrequency,
    ForecastProblemType,
)


class IndicatorKind(StrEnum):
    AMOUNT = "amount"
    RATE = "rate"


class IndicatorWeighting(StrEnum):
    NONE = "none"
    VOLUME = "volume"
    FINANCIAL = "financial"


@dataclass(frozen=True)
class IndicatorDefinition:
    code: str
    kind: IndicatorKind
    frequency: ForecastFrequency
    problem_type: ForecastProblemType

    minimum_observations: int

    lower_bound: float | None = None
    upper_bound: float | None = None

    weighting: IndicatorWeighting = (
        IndicatorWeighting.NONE
    )

    allow_zero: bool = True

    # Un challenger doit améliorer la meilleure baseline
    # d'au moins ce pourcentage de RMSE pour devenir Champion.
    minimum_challenger_gain_pct: float = 2.0

    # Lorsqu'un Champion existe déjà en production,
    # son remplaçant doit améliorer son RMSE courant
    # d'au moins ce pourcentage.
    minimum_champion_replacement_gain_pct: float = 3.0


INDICATOR_CATALOG: dict[
    str,
    IndicatorDefinition,
] = {
    "monthly_revenue": IndicatorDefinition(
        code="monthly_revenue",
        kind=IndicatorKind.AMOUNT,
        frequency=ForecastFrequency.MONTHLY,
        problem_type=(
            ForecastProblemType.TIME_SERIES_REGRESSION
        ),
        minimum_observations=6,
        lower_bound=0.0,
        weighting=IndicatorWeighting.NONE,
        allow_zero=True,
    ),

    "monthly_collections": IndicatorDefinition(
        code="monthly_collections",
        kind=IndicatorKind.AMOUNT,
        frequency=ForecastFrequency.MONTHLY,
        problem_type=(
            ForecastProblemType.TIME_SERIES_REGRESSION
        ),
        minimum_observations=6,
        lower_bound=0.0,
        weighting=IndicatorWeighting.NONE,
        allow_zero=True,
    ),

    "quote_acceptance_rate": IndicatorDefinition(
        code="quote_acceptance_rate",
        kind=IndicatorKind.RATE,
        frequency=ForecastFrequency.MONTHLY,
        problem_type=(
            ForecastProblemType.TIME_SERIES_REGRESSION
        ),
        minimum_observations=6,
        lower_bound=0.0,
        upper_bound=100.0,
        weighting=IndicatorWeighting.VOLUME,
        allow_zero=True,
    ),

    "recurring_revenue_share": IndicatorDefinition(
        code="recurring_revenue_share",
        kind=IndicatorKind.RATE,
        frequency=ForecastFrequency.MONTHLY,
        problem_type=(
            ForecastProblemType.TIME_SERIES_REGRESSION
        ),
        minimum_observations=6,
        lower_bound=0.0,
        upper_bound=100.0,
        weighting=IndicatorWeighting.FINANCIAL,
        allow_zero=True,
    ),
}


def get_indicator_definition(
    indicator: str,
) -> IndicatorDefinition:
    try:
        return INDICATOR_CATALOG[
            indicator
        ]
    except KeyError as exc:
        raise ValueError(
            f"Indicateur forecasting inconnu : {indicator}"
        ) from exc
