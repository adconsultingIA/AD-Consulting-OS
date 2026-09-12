from __future__ import annotations

import calendar
from datetime import datetime, timedelta

from app.services.forecasting.schemas import (
    ForecastFrequency,
)


def add_forecast_period(
    timestamp: datetime,
    step: int,
    frequency: ForecastFrequency,
) -> datetime:
    if step <= 0:
        raise ValueError(
            "step doit être supérieur à zéro."
        )

    if frequency == ForecastFrequency.DAILY:
        return timestamp + timedelta(
            days=step
        )

    if frequency == ForecastFrequency.WEEKLY:
        return timestamp + timedelta(
            weeks=step
        )

    if frequency == ForecastFrequency.MONTHLY:
        month_index = (
            timestamp.month
            - 1
            + step
        )

        year = (
            timestamp.year
            + month_index // 12
        )

        month = (
            month_index % 12
            + 1
        )

        day = min(
            timestamp.day,
            calendar.monthrange(
                year,
                month,
            )[1],
        )

        return timestamp.replace(
            year=year,
            month=month,
            day=day,
        )

    raise ValueError(
        f"Fréquence non supportée : {frequency}"
    )
