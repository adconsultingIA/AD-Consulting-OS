from __future__ import annotations

from dataclasses import dataclass

from app.services.forecasting.schemas import (
    ModelEvaluation,
)


@dataclass(frozen=True)
class PersistentChampionDecision:
    evaluation: ModelEvaluation
    previous_model_code: str | None
    candidate_model_code: str
    replacement_gain_pct: float | None
    replaced: bool
    reason: str


def resolve_persistent_champion(
    *,
    evaluations: list[ModelEvaluation],
    selected_evaluation: ModelEvaluation,
    persisted_model_code: str | None,
    minimum_replacement_gain_pct: float,
) -> PersistentChampionDecision:
    # Aucun Champion existant :
    # on adopte la sélection normale du moteur.
    if persisted_model_code is None:
        return PersistentChampionDecision(
            evaluation=selected_evaluation,
            previous_model_code=None,
            candidate_model_code=(
                selected_evaluation.model_code
            ),
            replacement_gain_pct=None,
            replaced=True,
            reason="initial_selection",
        )

    current_evaluation = next(
        (
            evaluation
            for evaluation in evaluations
            if evaluation.model_code
            == persisted_model_code
        ),
        None,
    )

    # Le Champion historique n'est plus compatible
    # ou n'a pas pu être évalué.
    if current_evaluation is None:
        return PersistentChampionDecision(
            evaluation=selected_evaluation,
            previous_model_code=(
                persisted_model_code
            ),
            candidate_model_code=(
                selected_evaluation.model_code
            ),
            replacement_gain_pct=None,
            replaced=True,
            reason="current_champion_unavailable",
        )

    # Le moteur sélectionne déjà le Champion actuel :
    # aucune rotation.
    if (
        selected_evaluation.model_code
        == persisted_model_code
    ):
        return PersistentChampionDecision(
            evaluation=current_evaluation,
            previous_model_code=(
                persisted_model_code
            ),
            candidate_model_code=(
                persisted_model_code
            ),
            replacement_gain_pct=0.0,
            replaced=False,
            reason="current_champion_remains_best",
        )

    current_rmse = (
        current_evaluation.metrics.rmse
    )

    candidate_rmse = (
        selected_evaluation.metrics.rmse
    )

    if current_rmse <= 0:
        return PersistentChampionDecision(
            evaluation=current_evaluation,
            previous_model_code=(
                persisted_model_code
            ),
            candidate_model_code=(
                selected_evaluation.model_code
            ),
            replacement_gain_pct=0.0,
            replaced=False,
            reason="current_champion_zero_error",
        )

    replacement_gain_pct = (
        (
            current_rmse
            - candidate_rmse
        )
        / current_rmse
    ) * 100

    if (
        replacement_gain_pct
        >= minimum_replacement_gain_pct
    ):
        return PersistentChampionDecision(
            evaluation=selected_evaluation,
            previous_model_code=(
                persisted_model_code
            ),
            candidate_model_code=(
                selected_evaluation.model_code
            ),
            replacement_gain_pct=(
                replacement_gain_pct
            ),
            replaced=True,
            reason="replacement_threshold_reached",
        )

    return PersistentChampionDecision(
        evaluation=current_evaluation,
        previous_model_code=(
            persisted_model_code
        ),
        candidate_model_code=(
            selected_evaluation.model_code
        ),
        replacement_gain_pct=(
            replacement_gain_pct
        ),
        replaced=False,
        reason="replacement_gain_too_small",
    )
