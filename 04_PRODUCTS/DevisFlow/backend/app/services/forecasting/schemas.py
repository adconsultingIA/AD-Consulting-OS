from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class ForecastProblemType(StrEnum):
    TIME_SERIES_REGRESSION = "time_series_regression"
    TABULAR_REGRESSION = "tabular_regression"
    CLASSIFICATION = "classification"


class ForecastFrequency(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ForecastQuality(StrEnum):
    INSUFFICIENT = "insufficient"
    LOW = "low"
    MODERATE = "moderate"
    GOOD = "good"


@dataclass(frozen=True)
class TimeSeriesPoint:
    timestamp: datetime
    value: float



@dataclass(frozen=True)
class RateSeriesPoint:
    timestamp: datetime
    numerator: float
    denominator: float

    @property
    def value(self) -> float | None:
        if self.denominator <= 0:
            return None

        return (
            self.numerator
            / self.denominator
        ) * 100



@dataclass(frozen=True)
class WeightedTimeSeriesPoint:
    timestamp: datetime
    value: float
    weight: float


@dataclass(frozen=True)
class ForecastMetrics:
    rmse: float
    mae: float
    smape: float


@dataclass(frozen=True)
class ModelEvaluation:
    model_code: str
    metrics: ForecastMetrics
    folds: int
    observations: int
    residuals: tuple[float, ...] = ()


@dataclass(frozen=True)
class ForecastPoint:
    timestamp: datetime
    value: float
    lower_bound: float | None = None
    upper_bound: float | None = None


@dataclass
class ForecastResult:
    indicator: str
    status: str
    problem_type: ForecastProblemType
    selected_model: str | None
    horizon: int
    observations: int
    quality: ForecastQuality
    metrics: ForecastMetrics | None = None
    forecast: list[ForecastPoint] = field(default_factory=list)
    challengers: list[ModelEvaluation] = field(default_factory=list)
    evaluations: list[ModelEvaluation] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
