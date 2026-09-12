from __future__ import annotations

from collections.abc import Callable

from app.services.forecasting.models.base import (
    ForecastModel,
)
from app.services.forecasting.models.naive import (
    MeanBaselineModel,
    MovingAverageBaselineModel,
    NaiveLastValueModel,
)
from app.services.forecasting.models.trend import (
    LinearTrendModel,
)
from app.services.forecasting.models.holt import (
    HoltLinearTrendModel,
)
from app.services.forecasting.schemas import (
    ForecastProblemType,
)


ModelFactory = Callable[
    [],
    ForecastModel,
]


MODEL_REGISTRY: dict[
    str,
    ModelFactory,
] = {
    "naive_last_value":
        NaiveLastValueModel,
    "mean_baseline":
        MeanBaselineModel,
    "moving_average_3":
        MovingAverageBaselineModel,
    "linear_trend":
        LinearTrendModel,
    "holt_linear":
        HoltLinearTrendModel,
}


# ------------------------------------------------------------
# MODEL ROLES
# ------------------------------------------------------------

BASELINE_MODEL_CODES = {
    "naive_last_value",
    "mean_baseline",
    "moving_average_3",
}


CHALLENGER_MODEL_CODES = {
    "linear_trend",
    "holt_linear",
}


# ------------------------------------------------------------
# INDICATOR COMPATIBILITY
#
# Ce catalogue définit quels modèles ont réellement le droit
# de concourir pour chaque problème métier.
#
# Prophet, XGBoost, modèles probabilistes, etc. viendront
# simplement s'ajouter ici plus tard.
# ------------------------------------------------------------

INDICATOR_MODEL_COMPATIBILITY: dict[
    str,
    tuple[str, ...],
] = {
    "monthly_revenue": (
        "naive_last_value",
        "mean_baseline",
        "moving_average_3",
        "linear_trend",
        "holt_linear",
    ),

    "monthly_collections": (
        "naive_last_value",
        "mean_baseline",
        "moving_average_3",
        "linear_trend",
        "holt_linear",
    ),

    "quote_acceptance_rate": (
        "naive_last_value",
        "mean_baseline",
        "moving_average_3",
        "linear_trend",
        "holt_linear",
    ),

    "recurring_revenue_share": (
        "naive_last_value",
        "mean_baseline",
        "moving_average_3",
        "linear_trend",
        "holt_linear",
    ),
}


# Fallback seulement pour les futurs indicateurs
# sans politique dédiée.
PROBLEM_MODEL_REGISTRY: dict[
    ForecastProblemType,
    tuple[str, ...],
] = {
    ForecastProblemType.TIME_SERIES_REGRESSION: (
        "naive_last_value",
        "mean_baseline",
        "moving_average_3",
        "linear_trend",
        "holt_linear",
    ),

    ForecastProblemType.TABULAR_REGRESSION: (),

    ForecastProblemType.CLASSIFICATION: (),
}


def get_candidate_model_codes(
    problem_type: ForecastProblemType,
    *,
    indicator: str | None = None,
) -> tuple[str, ...]:
    if (
        indicator
        and indicator
        in INDICATOR_MODEL_COMPATIBILITY
    ):
        return (
            INDICATOR_MODEL_COMPATIBILITY[
                indicator
            ]
        )

    return PROBLEM_MODEL_REGISTRY.get(
        problem_type,
        (),
    )


def get_candidate_models(
    problem_type: ForecastProblemType,
    *,
    indicator: str | None = None,
) -> list[ForecastModel]:
    model_codes = get_candidate_model_codes(
        problem_type,
        indicator=indicator,
    )

    return [
        MODEL_REGISTRY[
            model_code
        ]()
        for model_code in model_codes
    ]


def is_baseline_model(
    model_code: str,
) -> bool:
    return (
        model_code
        in BASELINE_MODEL_CODES
    )


def is_challenger_model(
    model_code: str,
) -> bool:
    return (
        model_code
        in CHALLENGER_MODEL_CODES
    )


def get_model_by_code(
    model_code: str,
) -> ForecastModel:
    try:
        factory = MODEL_REGISTRY[
            model_code
        ]
    except KeyError as exc:
        raise ValueError(
            f"Modèle forecasting inconnu : {model_code}"
        ) from exc

    return factory()
