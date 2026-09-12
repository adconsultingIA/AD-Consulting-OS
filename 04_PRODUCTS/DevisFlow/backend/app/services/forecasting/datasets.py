from __future__ import annotations

from app.services.forecasting.schemas import (
    TimeSeriesPoint,
)


def validate_time_series(
    series: list[TimeSeriesPoint],
) -> list[TimeSeriesPoint]:
    clean_series = sorted(
        series,
        key=lambda point: point.timestamp,
    )

    if not clean_series:
        return []

    seen = set()

    for point in clean_series:
        if point.timestamp in seen:
            raise ValueError(
                "La série contient plusieurs observations "
                "pour le même timestamp."
            )

        seen.add(point.timestamp)

    return clean_series
