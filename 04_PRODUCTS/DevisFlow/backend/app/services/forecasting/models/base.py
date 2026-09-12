from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.forecasting.schemas import (
    ForecastProblemType,
    TimeSeriesPoint,
)


class ForecastModel(ABC):
    code: str
    problem_type: ForecastProblemType
    minimum_observations: int = 2

    @abstractmethod
    def fit(
        self,
        series: list[TimeSeriesPoint],
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def predict(
        self,
        horizon: int,
    ) -> list[float]:
        raise NotImplementedError

    def supports(
        self,
        problem_type: ForecastProblemType,
    ) -> bool:
        return self.problem_type == problem_type
