from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ForecastHistoryPointResponse(BaseModel):
    date: datetime
    value: float


class ForecastPointResponse(BaseModel):
    horizon_step: int
    forecast_date: datetime
    value: float
    lower_bound: float | None = None
    upper_bound: float | None = None


class ForecastRunResponse(BaseModel):
    id: str
    indicator: str
    status: str
    selected_model: str | None
    quality: str
    horizon: int
    observations: int

    rmse: float | None = None
    mae: float | None = None
    smape: float | None = None

    uncertainty_method: str | None = None
    uncertainty_coverage: float | None = None
    uncertainty_radius: float | None = None
    calibration_points: int | None = None

    calculated_at: datetime

    history: list[ForecastHistoryPointResponse]
    points: list[ForecastPointResponse]


class ForecastAvailabilityResponse(BaseModel):
    indicator: str
    available: bool
    forecast: ForecastRunResponse | None = None


class ForecastRecalculationItemResponse(BaseModel):
    indicator: str
    status: str
    quality: str
    selected_model: str | None = None
    observations: int
    persisted: bool


class ForecastRecalculationResponse(BaseModel):
    organization_id: str
    horizon: int
    results: list[ForecastRecalculationItemResponse]


class RecommendedActionResponse(BaseModel):
    indicator: str
    priority: str
    direction: str

    title: str
    explanation: str

    action_label: str
    route: str

    current_value: float
    forecast_value: float

    change_value: float
    change_percent: float | None = None

    lower_bound: float | None = None
    upper_bound: float | None = None

    quality: str
    model: str | None = None


class RecommendedActionsResponse(BaseModel):
    organization_id: str
    count: int
    actions: list[RecommendedActionResponse]
