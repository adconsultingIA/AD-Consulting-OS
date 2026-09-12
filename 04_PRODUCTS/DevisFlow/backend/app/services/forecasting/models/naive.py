from __future__ import annotations

from statistics import mean

from app.services.forecasting.models.base import (
    ForecastModel,
)
from app.services.forecasting.schemas import (
    ForecastProblemType,
    TimeSeriesPoint,
)


class NaiveLastValueModel(ForecastModel):
    code = "naive_last_value"
    problem_type = (
        ForecastProblemType.TIME_SERIES_REGRESSION
    )
    minimum_observations = 2

    def __init__(self) -> None:
        self._value: float | None = None

    def fit(
        self,
        series: list[TimeSeriesPoint],
    ) -> None:
        if len(series) < self.minimum_observations:
            raise ValueError(
                "Historique insuffisant pour naive_last_value."
            )

        self._value = float(series[-1].value)

    def predict(
        self,
        horizon: int,
    ) -> list[float]:
        if self._value is None:
            raise RuntimeError(
                "Le modèle doit être entraîné avant predict()."
            )

        return [self._value] * horizon


class MeanBaselineModel(ForecastModel):
    code = "mean_baseline"
    problem_type = (
        ForecastProblemType.TIME_SERIES_REGRESSION
    )
    minimum_observations = 2

    def __init__(self) -> None:
        self._value: float | None = None

    def fit(
        self,
        series: list[TimeSeriesPoint],
    ) -> None:
        if len(series) < self.minimum_observations:
            raise ValueError(
                "Historique insuffisant pour mean_baseline."
            )

        self._value = mean(
            point.value
            for point in series
        )

    def predict(
        self,
        horizon: int,
    ) -> list[float]:
        if self._value is None:
            raise RuntimeError(
                "Le modèle doit être entraîné avant predict()."
            )

        return [self._value] * horizon


class MovingAverageBaselineModel(ForecastModel):
    code = "moving_average_3"
    problem_type = (
        ForecastProblemType.TIME_SERIES_REGRESSION
    )
    minimum_observations = 3

    def __init__(
        self,
        window: int = 3,
    ) -> None:
        self.window = window
        self._value: float | None = None

    def fit(
        self,
        series: list[TimeSeriesPoint],
    ) -> None:
        if len(series) < self.minimum_observations:
            raise ValueError(
                "Historique insuffisant pour moving_average."
            )

        window_values = [
            point.value
            for point in series[-self.window:]
        ]

        self._value = mean(window_values)

    def predict(
        self,
        horizon: int,
    ) -> list[float]:
        if self._value is None:
            raise RuntimeError(
                "Le modèle doit être entraîné avant predict()."
            )

        return [self._value] * horizon
