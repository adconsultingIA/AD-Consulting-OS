from __future__ import annotations

from app.services.forecasting.schemas import (
    ForecastQuality,
    ModelEvaluation,
)


def determine_forecast_quality(
    *,
    observations: int,
    champion: ModelEvaluation | None,
) -> ForecastQuality:
    """
    Évalue la qualité exploitable de la prévision.

    La qualité combine :
    - profondeur historique ;
    - quantité de validation rolling-origin ;
    - erreur relative du Champion ;
    - disponibilité des résidus de calibration.
    """

    if (
        observations < 6
        or champion is None
        or champion.folds < 3
        or len(champion.residuals) < 3
    ):
        return ForecastQuality.INSUFFICIENT

    smape = champion.metrics.smape

    if (
        observations < 12
        or champion.folds < 4
    ):
        return ForecastQuality.LOW

    if smape > 35:
        return ForecastQuality.LOW

    if (
        observations >= 24
        and champion.folds >= 6
        and smape <= 15
    ):
        return ForecastQuality.GOOD

    return ForecastQuality.MODERATE
