from __future__ import annotations

from dataclasses import dataclass
from math import ceil

from app.services.forecasting.schemas import (
    ForecastPoint,
)


@dataclass(frozen=True)
class EmpiricalUncertainty:
    coverage: float
    radius: float | None
    calibration_points: int
    method: str = "rolling_backtest_absolute_residuals"


def estimate_empirical_uncertainty(
    residuals: tuple[float, ...],
    *,
    coverage: float = 0.80,
    minimum_calibration_points: int = 3,
) -> EmpiricalUncertainty:
    """
    Estime une marge d'incertitude à partir des erreurs
    absolues observées pendant le rolling backtesting.

    V1 model-agnostic :
    - aucune hypothèse de normalité ;
    - aucune fausse promesse de confiance statistique ;
    - quantile empirique inspiré de la calibration conformale.
    """

    if not 0 < coverage < 1:
        raise ValueError(
            "coverage doit être compris entre 0 et 1."
        )

    absolute_residuals = sorted(
        abs(float(residual))
        for residual in residuals
    )

    calibration_points = len(
        absolute_residuals
    )

    if (
        calibration_points
        < minimum_calibration_points
    ):
        return EmpiricalUncertainty(
            coverage=coverage,
            radius=None,
            calibration_points=calibration_points,
        )

    rank = ceil(
        (calibration_points + 1)
        * coverage
    )

    index = min(
        calibration_points - 1,
        max(0, rank - 1),
    )

    return EmpiricalUncertainty(
        coverage=coverage,
        radius=absolute_residuals[index],
        calibration_points=calibration_points,
    )


def apply_empirical_uncertainty(
    forecast: list[ForecastPoint],
    *,
    residuals: tuple[float, ...],
    coverage: float = 0.80,
    lower_bound: float | None = None,
    upper_bound: float | None = None,
) -> tuple[
    list[ForecastPoint],
    EmpiricalUncertainty,
]:
    uncertainty = (
        estimate_empirical_uncertainty(
            residuals,
            coverage=coverage,
        )
    )

    if uncertainty.radius is None:
        return forecast, uncertainty

    bounded_forecast: list[
        ForecastPoint
    ] = []

    for point in forecast:
        lower = (
            point.value
            - uncertainty.radius
        )

        upper = (
            point.value
            + uncertainty.radius
        )

        if lower_bound is not None:
            lower = max(
                lower_bound,
                lower,
            )

        if upper_bound is not None:
            upper = min(
                upper_bound,
                upper,
            )

        bounded_forecast.append(
            ForecastPoint(
                timestamp=point.timestamp,
                value=point.value,
                lower_bound=lower,
                upper_bound=upper,
            )
        )

    return (
        bounded_forecast,
        uncertainty,
    )
