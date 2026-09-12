from __future__ import annotations

from app.services.forecasting.schemas import (
    TimeSeriesPoint,
)


def extract_values(
    series: list[TimeSeriesPoint],
) -> list[float]:
    return [
        float(point.value)
        for point in series
    ]


# Les features métier seront ajoutées ici :
# - mois / trimestre / saison
# - ancienneté client
# - récurrence
# - statut commercial
# - délai de paiement
# - montant facture
# - exposition client
# etc.


def rate_points_to_weighted_series(
    points,
):
    from app.services.forecasting.schemas import (
        WeightedTimeSeriesPoint,
    )

    series = []

    for point in points:
        value = point.value

        if value is None:
            continue

        if point.denominator <= 0:
            continue

        series.append(
            WeightedTimeSeriesPoint(
                timestamp=point.timestamp,
                value=float(value),
                weight=float(
                    point.denominator
                ),
            )
        )

    return series
