from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.database_models import (
    ForecastModelChampionDB,
    ForecastModelEvaluationDB,
    ForecastRunDB,
    ForecastPointDB,
)
from app.services.forecasting.registry import (
    is_baseline_model,
    is_challenger_model,
)
from app.services.forecasting.schemas import (
    ModelEvaluation,
)


def get_persisted_champion(
    db: Session,
    *,
    organization_id: str,
    indicator: str,
) -> ForecastModelChampionDB | None:
    return (
        db.query(
            ForecastModelChampionDB
        )
        .filter(
            ForecastModelChampionDB.organization_id
            == organization_id,
            ForecastModelChampionDB.indicator
            == indicator,
        )
        .order_by(
            ForecastModelChampionDB.updated_at.desc()
        )
        .first()
    )


def save_model_evaluations(
    db: Session,
    *,
    organization_id: str,
    indicator: str,
    evaluations: list[ModelEvaluation],
    promoted_model_code: str | None = None,
    gain_pct: float | None = None,
) -> None:
    for evaluation in evaluations:
        if is_baseline_model(
            evaluation.model_code
        ):
            role = "baseline"
        elif is_challenger_model(
            evaluation.model_code
        ):
            role = "challenger"
        else:
            role = "candidate"

        db.add(
            ForecastModelEvaluationDB(
                id=str(uuid4()),
                organization_id=organization_id,
                indicator=indicator,
                model_code=evaluation.model_code,
                rmse=Decimal(
                    str(
                        evaluation.metrics.rmse
                    )
                ),
                mae=Decimal(
                    str(
                        evaluation.metrics.mae
                    )
                ),
                smape=Decimal(
                    str(
                        evaluation.metrics.smape
                    )
                ),
                folds=evaluation.folds,
                observations=(
                    evaluation.observations
                ),
                challenger_gain_pct=(
                    Decimal(
                        str(gain_pct)
                    )
                    if (
                        gain_pct is not None
                        and evaluation.model_code
                        == promoted_model_code
                    )
                    else None
                ),
                promoted=(
                    evaluation.model_code
                    == promoted_model_code
                ),
                evaluation_role=role,
            )
        )


def upsert_champion(
    db: Session,
    *,
    organization_id: str,
    indicator: str,
    evaluation: ModelEvaluation,
) -> ForecastModelChampionDB:
    champion = get_persisted_champion(
        db,
        organization_id=organization_id,
        indicator=indicator,
    )

    if champion is None:
        champion = ForecastModelChampionDB(
            id=str(uuid4()),
            organization_id=organization_id,
            indicator=indicator,
            model_code=evaluation.model_code,
            rmse=Decimal(
                str(
                    evaluation.metrics.rmse
                )
            ),
            mae=Decimal(
                str(
                    evaluation.metrics.mae
                )
            ),
            smape=Decimal(
                str(
                    evaluation.metrics.smape
                )
            ),
            folds=evaluation.folds,
            observations=(
                evaluation.observations
            ),
        )

        db.add(champion)

        return champion

    champion.model_code = (
        evaluation.model_code
    )

    champion.rmse = Decimal(
        str(
            evaluation.metrics.rmse
        )
    )

    champion.mae = Decimal(
        str(
            evaluation.metrics.mae
        )
    )

    champion.smape = Decimal(
        str(
            evaluation.metrics.smape
        )
    )

    champion.folds = (
        evaluation.folds
    )

    champion.observations = (
        evaluation.observations
    )

    champion.selected_at = (
        datetime.utcnow()
    )

    champion.updated_at = (
        datetime.utcnow()
    )

    return champion


def save_forecast_run(
    db: Session,
    *,
    organization_id: str,
    result,
) -> ForecastRunDB:
    """
    Persiste le résultat final d'une exécution forecasting
    ainsi que tous ses points LOW / CENTRAL / HIGH.
    """

    metrics = result.metrics

    run = ForecastRunDB(
        id=str(uuid4()),
        organization_id=organization_id,
        indicator=result.indicator,
        status=result.status,
        selected_model=result.selected_model,
        quality=result.quality.value,
        horizon=result.horizon,
        observations=result.observations,
        rmse=(
            Decimal(str(metrics.rmse))
            if metrics
            else None
        ),
        mae=(
            Decimal(str(metrics.mae))
            if metrics
            else None
        ),
        smape=(
            Decimal(str(metrics.smape))
            if metrics
            else None
        ),
        uncertainty_method=(
            result.metadata.get(
                "uncertainty_method"
            )
        ),
        uncertainty_coverage=(
            Decimal(
                str(
                    result.metadata.get(
                        "uncertainty_coverage"
                    )
                )
            )
            if result.metadata.get(
                "uncertainty_coverage"
            ) is not None
            else None
        ),
        uncertainty_radius=(
            Decimal(
                str(
                    result.metadata.get(
                        "uncertainty_radius"
                    )
                )
            )
            if result.metadata.get(
                "uncertainty_radius"
            ) is not None
            else None
        ),
        calibration_points=(
            result.metadata.get(
                "uncertainty_calibration_points"
            )
        ),
    )

    db.add(run)

    for horizon_step, point in enumerate(
        result.forecast,
        start=1,
    ):
        db.add(
            ForecastPointDB(
                id=str(uuid4()),
                forecast_run_id=run.id,
                horizon_step=horizon_step,
                forecast_date=point.timestamp,
                value=Decimal(
                    str(point.value)
                ),
                lower_bound=(
                    Decimal(
                        str(point.lower_bound)
                    )
                    if point.lower_bound
                    is not None
                    else None
                ),
                upper_bound=(
                    Decimal(
                        str(point.upper_bound)
                    )
                    if point.upper_bound
                    is not None
                    else None
                ),
            )
        )

    return run


def get_latest_forecast_run(
    db: Session,
    *,
    organization_id: str,
    indicator: str,
) -> ForecastRunDB | None:
    """
    Retourne le dernier run calculé pour
    une organisation et un indicateur.
    """

    return (
        db.query(
            ForecastRunDB
        )
        .filter(
            ForecastRunDB.organization_id
            == organization_id,
            ForecastRunDB.indicator
            == indicator,
        )
        .order_by(
            ForecastRunDB.calculated_at.desc(),
            ForecastRunDB.id.desc(),
        )
        .first()
    )


def get_forecast_run_points(
    db: Session,
    *,
    forecast_run_id: str,
) -> list[ForecastPointDB]:
    return (
        db.query(
            ForecastPointDB
        )
        .filter(
            ForecastPointDB.forecast_run_id
            == forecast_run_id
        )
        .order_by(
            ForecastPointDB.horizon_step.asc()
        )
        .all()
    )
