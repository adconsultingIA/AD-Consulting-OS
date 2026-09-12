from __future__ import annotations

from app.services.forecasting.models.base import (
    ForecastModel,
)
from app.services.forecasting.schemas import (
    ForecastProblemType,
    TimeSeriesPoint,
)


class HoltLinearTrendModel(ForecastModel):
    code = "holt_linear"
    problem_type = (
        ForecastProblemType.TIME_SERIES_REGRESSION
    )
    minimum_observations = 4

    def __init__(
        self,
        alpha: float = 0.8,
        beta: float = 0.2,
    ) -> None:
        self.alpha = alpha
        self.beta = beta

        self._level: float | None = None
        self._trend: float | None = None

    def fit(
        self,
        series: list[TimeSeriesPoint],
    ) -> None:
        if len(series) < self.minimum_observations:
            raise ValueError(
                "Historique insuffisant pour holt_linear."
            )

        values = [
            float(point.value)
            for point in series
        ]

        level = values[0]
        trend = (
            values[1]
            - values[0]
        )

        for value in values[1:]:
            previous_level = level

            level = (
                self.alpha
                * value
                + (
                    1 - self.alpha
                )
                * (
                    level
                    + trend
                )
            )

            trend = (
                self.beta
                * (
                    level
                    - previous_level
                )
                + (
                    1 - self.beta
                )
                * trend
            )

        self._level = level
        self._trend = trend

    def predict(
        self,
        horizon: int,
    ) -> list[float]:
        if (
            self._level is None
            or self._trend is None
        ):
            raise RuntimeError(
                "Le modèle doit être entraîné avant predict()."
            )

        return [
            max(
                0.0,
                self._level
                + self._trend
                * step,
            )
            for step in range(
                1,
                horizon + 1,
            )
        ]
