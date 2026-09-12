from __future__ import annotations

from app.services.forecasting.models.base import (
    ForecastModel,
)
from app.services.forecasting.schemas import (
    ForecastProblemType,
    TimeSeriesPoint,
)


class LinearTrendModel(ForecastModel):
    code = "linear_trend"
    problem_type = (
        ForecastProblemType.TIME_SERIES_REGRESSION
    )
    minimum_observations = 4

    def __init__(self) -> None:
        self._intercept: float | None = None
        self._slope: float | None = None
        self._observations = 0

    def fit(
        self,
        series: list[TimeSeriesPoint],
    ) -> None:
        if len(series) < self.minimum_observations:
            raise ValueError(
                "Historique insuffisant pour linear_trend."
            )

        values = [
            float(point.value)
            for point in series
        ]

        n = len(values)

        x_values = [
            float(index)
            for index in range(n)
        ]

        x_mean = sum(x_values) / n
        y_mean = sum(values) / n

        numerator = sum(
            (x - x_mean)
            * (y - y_mean)
            for x, y in zip(
                x_values,
                values,
            )
        )

        denominator = sum(
            (x - x_mean) ** 2
            for x in x_values
        )

        if denominator == 0:
            raise ValueError(
                "Impossible de calculer la tendance linéaire."
            )

        self._slope = (
            numerator
            / denominator
        )

        self._intercept = (
            y_mean
            - self._slope
            * x_mean
        )

        self._observations = n

    def predict(
        self,
        horizon: int,
    ) -> list[float]:
        if (
            self._intercept is None
            or self._slope is None
        ):
            raise RuntimeError(
                "Le modèle doit être entraîné avant predict()."
            )

        return [
            max(
                0.0,
                self._intercept
                + self._slope
                * (
                    self._observations
                    + step
                ),
            )
            for step in range(horizon)
        ]
