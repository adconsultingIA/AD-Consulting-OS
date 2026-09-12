from __future__ import annotations

from dataclasses import dataclass

from app.services.forecasting.registry import (
    is_baseline_model,
    is_challenger_model,
)
from app.services.forecasting.schemas import (
    ModelEvaluation,
)


@dataclass(frozen=True)
class ChampionSelection:
    champion: ModelEvaluation
    best_baseline: ModelEvaluation
    best_challenger: ModelEvaluation | None
    challenger_gain_pct: float | None
    challenger_promoted: bool


def _ranking_key(
    evaluation: ModelEvaluation,
):
    return (
        evaluation.metrics.rmse,
        evaluation.metrics.mae,
        evaluation.metrics.smape,
    )


def select_champion(
    evaluations: list[ModelEvaluation],
    *,
    minimum_challenger_gain_pct: float,
) -> ChampionSelection:
    if not evaluations:
        raise ValueError(
            "Aucune évaluation disponible."
        )

    baselines = sorted(
        [
            evaluation
            for evaluation in evaluations
            if is_baseline_model(
                evaluation.model_code
            )
        ],
        key=_ranking_key,
    )

    challengers = sorted(
        [
            evaluation
            for evaluation in evaluations
            if is_challenger_model(
                evaluation.model_code
            )
        ],
        key=_ranking_key,
    )

    if not baselines:
        raise ValueError(
            "Aucune baseline disponible pour "
            "sélectionner un Champion."
        )

    best_baseline = baselines[0]

    if not challengers:
        return ChampionSelection(
            champion=best_baseline,
            best_baseline=best_baseline,
            best_challenger=None,
            challenger_gain_pct=None,
            challenger_promoted=False,
        )

    best_challenger = challengers[0]

    baseline_rmse = (
        best_baseline.metrics.rmse
    )

    challenger_rmse = (
        best_challenger.metrics.rmse
    )

    if baseline_rmse <= 0:
        return ChampionSelection(
            champion=best_baseline,
            best_baseline=best_baseline,
            best_challenger=best_challenger,
            challenger_gain_pct=0.0,
            challenger_promoted=False,
        )

    gain_pct = (
        (
            baseline_rmse
            - challenger_rmse
        )
        / baseline_rmse
    ) * 100

    promoted = (
        gain_pct
        >= minimum_challenger_gain_pct
    )

    return ChampionSelection(
        champion=(
            best_challenger
            if promoted
            else best_baseline
        ),
        best_baseline=best_baseline,
        best_challenger=best_challenger,
        challenger_gain_pct=gain_pct,
        challenger_promoted=promoted,
    )
