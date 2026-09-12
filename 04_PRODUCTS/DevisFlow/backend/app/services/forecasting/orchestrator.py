from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.forecasting.champion_policy import (
    resolve_persistent_champion,
)
from app.services.forecasting.engine import (
    ForecastingEngine,
)
from app.services.forecasting.indicator_catalog import (
    get_indicator_definition,
)
from app.services.forecasting.persistence import (
    get_persisted_champion,
    save_model_evaluations,
    save_forecast_run,
    upsert_champion,
)
from app.services.forecasting.schemas import (
    ForecastResult,
)


def run_persistent_forecast(
    db: Session,
    *,
    organization_id: str,
    indicator: str,
    series,
    horizon: int = 3,
    weighted: bool = False,
) -> ForecastResult:
    """
    Exécution forecasting avec mémoire persistante.

    1. benchmark courant
    2. lecture du Champion existant
    3. politique anti-churn
    4. historique des évaluations
    5. mise à jour éventuelle du Champion
    6. forecast final avec le Champion retenu
    """

    engine = ForecastingEngine()

    if weighted:
        result = engine.forecast_weighted_rate(
            indicator=indicator,
            series=series,
            horizon=horizon,
        )
    else:
        result = engine.forecast(
            indicator=indicator,
            series=series,
            horizon=horizon,
        )

    if (
        result.status != "completed"
        or result.selected_model is None
        or result.metrics is None
        or not result.evaluations
    ):
        return result

    definition = get_indicator_definition(
        indicator
    )

    persisted = get_persisted_champion(
        db,
        organization_id=organization_id,
        indicator=indicator,
    )

    persisted_model_code = (
        persisted.model_code
        if persisted
        else None
    )

    selected_evaluation = next(
        evaluation
        for evaluation in result.evaluations
        if evaluation.model_code
        == result.selected_model
    )

    decision = resolve_persistent_champion(
        evaluations=result.evaluations,
        selected_evaluation=selected_evaluation,
        persisted_model_code=persisted_model_code,
        minimum_replacement_gain_pct=(
            definition.minimum_champion_replacement_gain_pct
        ),
    )

    try:
        save_model_evaluations(
            db,
            organization_id=organization_id,
            indicator=indicator,
            evaluations=result.evaluations,
            promoted_model_code=(
                decision.evaluation.model_code
                if decision.replaced
                else None
            ),
            gain_pct=(
                decision.replacement_gain_pct
            ),
        )

        if (
            persisted is None
            or decision.replaced
        ):
            upsert_champion(
                db,
                organization_id=organization_id,
                indicator=indicator,
                evaluation=decision.evaluation,
            )

    except Exception:
        db.rollback()
        raise

    # Le forecast retourné doit correspondre
    # exactement au Champion final.
    if (
        decision.evaluation.model_code
        != result.selected_model
    ):
        result.forecast = (
            engine.predict_with_model(
                indicator=indicator,
                series=series,
                horizon=horizon,
                model_code=(
                    decision.evaluation.model_code
                ),
                residuals=(
                    decision.evaluation.residuals
                ),
            )
        )

        result.selected_model = (
            decision.evaluation.model_code
        )

        result.metrics = (
            decision.evaluation.metrics
        )

    result.metadata.update(
        {
            "persistent_champion":
                decision.evaluation.model_code,

            "previous_champion":
                decision.previous_model_code,

            "replacement_candidate":
                decision.candidate_model_code,

            "replacement_gain_pct":
                decision.replacement_gain_pct,

            "champion_replaced":
                decision.replaced,

            "champion_decision_reason":
                decision.reason,

            "minimum_champion_replacement_gain_pct":
                definition.minimum_champion_replacement_gain_pct,
        }
    )

    try:
        save_forecast_run(
            db,
            organization_id=organization_id,
            result=result,
        )

        db.commit()

    except Exception:
        db.rollback()
        raise

    return result
