from __future__ import annotations

from app.services.forecasting.calendar import (
    add_forecast_period,
)
from app.services.forecasting.backtesting import (
    rolling_origin_backtest,
    rolling_origin_weighted_backtest,
)
from app.services.forecasting.datasets import (
    validate_time_series,
)
from app.services.forecasting.quality import (
    determine_forecast_quality,
)
from app.services.forecasting.indicator_catalog import (
    get_indicator_definition,
)
from app.services.forecasting.registry import (
    get_candidate_models,
    get_model_by_code,
)
from app.services.forecasting.selection import (
    select_champion,
)
from app.services.forecasting.uncertainty import (
    apply_empirical_uncertainty,
)
from app.services.forecasting.schemas import (
    ForecastFrequency,
    ForecastPoint,
    ForecastProblemType,
    ForecastQuality,
    ForecastResult,
    ModelEvaluation,
    TimeSeriesPoint,
)


class ForecastingEngine:
    """
    Orchestrateur Champion / Challengers.

    V1 :
    - séries temporelles
    - plusieurs baselines
    - rolling-origin backtesting
    - RMSE / MAE / sMAPE
    - sélection du Champion
    """

    def forecast_weighted_rate(
        self,
        *,
        indicator: str,
        series,
        horizon: int,
    ) -> ForecastResult:
        definition = get_indicator_definition(
            indicator
        )

        if horizon <= 0:
            raise ValueError(
                "horizon doit être supérieur à zéro."
            )

        if (
            len(series)
            < definition.minimum_observations
        ):
            return ForecastResult(
                indicator=indicator,
                status="insufficient_data",
                problem_type=definition.problem_type,
                selected_model=None,
                horizon=horizon,
                observations=len(series),
                quality=ForecastQuality.INSUFFICIENT,
                metadata={
                    "weighted": True,
                    "weighting":
                        definition.weighting.value,
                },
            )

        candidates = get_candidate_models(
            definition.problem_type,
            indicator=indicator,
        )

        evaluations: list[
            ModelEvaluation
        ] = []

        candidate_by_code = {}

        for candidate in candidates:
            if (
                len(series)
                < candidate.minimum_observations
            ):
                continue

            try:
                evaluation = (
                    rolling_origin_weighted_backtest(
                        candidate,
                        series,
                    )
                )
            except ValueError:
                continue

            evaluations.append(
                evaluation
            )

            candidate_by_code[
                candidate.code
            ] = candidate

        if not evaluations:
            return ForecastResult(
                indicator=indicator,
                status="insufficient_data",
                problem_type=definition.problem_type,
                selected_model=None,
                horizon=horizon,
                observations=len(series),
                quality=ForecastQuality.INSUFFICIENT,
                metadata={
                    "weighted": True,
                    "weighting":
                        definition.weighting.value,
                },
            )

        ranked = sorted(
            evaluations,
            key=lambda result: (
                result.metrics.rmse,
                result.metrics.mae,
                result.metrics.smape,
            ),
        )

        selection = select_champion(
            evaluations,
            minimum_challenger_gain_pct=(
                definition.minimum_challenger_gain_pct
            ),
        )

        champion_evaluation = (
            selection.champion
        )

        champion = candidate_by_code[
            champion_evaluation.model_code
        ]

        training_series = [
            TimeSeriesPoint(
                timestamp=point.timestamp,
                value=point.value,
            )
            for point in series
        ]

        champion.fit(
            training_series
        )

        predictions = champion.predict(
            horizon=horizon
        )

        bounded_predictions = []

        for prediction in predictions:
            value = float(
                prediction
            )

            if (
                definition.lower_bound
                is not None
            ):
                value = max(
                    definition.lower_bound,
                    value,
                )

            if (
                definition.upper_bound
                is not None
            ):
                value = min(
                    definition.upper_bound,
                    value,
                )

            bounded_predictions.append(
                value
            )

        last_timestamp = (
            series[-1].timestamp
        )

        forecast_points = [
            ForecastPoint(
                timestamp=add_forecast_period(
                    last_timestamp,
                    index,
                    definition.frequency,
                ),
                value=value,
            )
            for index, value in enumerate(
                bounded_predictions,
                start=1,
            )
        ]

        forecast_points, uncertainty = (
            apply_empirical_uncertainty(
                forecast_points,
                residuals=(
                    champion_evaluation.residuals
                ),
                coverage=0.80,
                lower_bound=(
                    definition.lower_bound
                ),
                upper_bound=(
                    definition.upper_bound
                ),
            )
        )

        quality = (
            determine_forecast_quality(
                observations=len(series),
                champion=champion_evaluation,
            )
        )

        return ForecastResult(
            indicator=indicator,
            status="completed",
            problem_type=definition.problem_type,
            selected_model=(
                champion_evaluation.model_code
            ),
            horizon=horizon,
            observations=len(series),
            quality=quality,
            metrics=(
                champion_evaluation.metrics
            ),
            forecast=forecast_points,
            challengers=[
                evaluation
                for evaluation in ranked
                if evaluation.model_code
                != champion_evaluation.model_code
            ],
            evaluations=ranked,
            metadata={
                "weighted": True,
                "weighting":
                    definition.weighting.value,
                "frequency":
                    definition.frequency.value,
                "lower_bound":
                    definition.lower_bound,
                "upper_bound":
                    definition.upper_bound,
                "best_baseline":
                    selection.best_baseline.model_code,
                "best_challenger": (
                    selection.best_challenger.model_code
                    if selection.best_challenger
                    else None
                ),
                "challenger_gain_pct":
                    selection.challenger_gain_pct,
                "challenger_promoted":
                    selection.challenger_promoted,
                "minimum_challenger_gain_pct":
                    definition.minimum_challenger_gain_pct,
                "uncertainty_method":
                    uncertainty.method,
                "uncertainty_coverage":
                    uncertainty.coverage,
                "uncertainty_radius":
                    uncertainty.radius,
                "uncertainty_calibration_points":
                    uncertainty.calibration_points,
            },
        )


    def predict_with_model(
        self,
        *,
        indicator: str,
        series,
        horizon: int,
        model_code: str,
        residuals: tuple[float, ...] = (),
    ) -> list[ForecastPoint]:
        """
        Produit une prévision avec un modèle explicitement choisi.

        Utilisé après résolution du Champion persistant.
        """

        if horizon <= 0:
            raise ValueError(
                "horizon doit être supérieur à zéro."
            )

        if not series:
            return []

        definition = get_indicator_definition(
            indicator
        )

        model = get_model_by_code(
            model_code
        )

        training_series = [
            TimeSeriesPoint(
                timestamp=point.timestamp,
                value=float(point.value),
            )
            for point in series
        ]

        model.fit(
            training_series
        )

        predictions = model.predict(
            horizon=horizon
        )

        bounded_predictions: list[
            float
        ] = []

        for prediction in predictions:
            value = float(
                prediction
            )

            if (
                definition.lower_bound
                is not None
            ):
                value = max(
                    definition.lower_bound,
                    value,
                )

            if (
                definition.upper_bound
                is not None
            ):
                value = min(
                    definition.upper_bound,
                    value,
                )

            bounded_predictions.append(
                value
            )

        last_timestamp = (
            training_series[-1].timestamp
        )

        forecast_points = [
            ForecastPoint(
                timestamp=add_forecast_period(
                    last_timestamp,
                    index,
                    definition.frequency,
                ),
                value=value,
            )
            for index, value in enumerate(
                bounded_predictions,
                start=1,
            )
        ]

        forecast_points, _ = (
            apply_empirical_uncertainty(
                forecast_points,
                residuals=residuals,
                coverage=0.80,
                lower_bound=(
                    definition.lower_bound
                ),
                upper_bound=(
                    definition.upper_bound
                ),
            )
        )

        return forecast_points


    def forecast(
        self,
        *,
        indicator: str,
        series: list[TimeSeriesPoint],
        horizon: int,
        problem_type: ForecastProblemType = (
            ForecastProblemType.TIME_SERIES_REGRESSION
        ),
        frequency: ForecastFrequency = (
            ForecastFrequency.MONTHLY
        ),
    ) -> ForecastResult:
        clean_series = validate_time_series(
            series
        )

        definition = get_indicator_definition(
            indicator
        )

        if horizon <= 0:
            raise ValueError(
                "horizon doit être supérieur à zéro."
            )

        if (
            len(clean_series)
            < definition.minimum_observations
        ):
            return ForecastResult(
                indicator=indicator,
                status="insufficient_data",
                problem_type=problem_type,
                selected_model=None,
                horizon=horizon,
                observations=len(clean_series),
                quality=ForecastQuality.INSUFFICIENT,
            )

        candidates = get_candidate_models(
            definition.problem_type,
            indicator=indicator,
        )

        evaluations: list[
            ModelEvaluation
        ] = []

        candidate_by_code = {}

        for candidate in candidates:
            if (
                len(clean_series)
                < candidate.minimum_observations
            ):
                continue

            try:
                evaluation = (
                    rolling_origin_backtest(
                        candidate,
                        clean_series,
                    )
                )
            except ValueError:
                continue

            evaluations.append(
                evaluation
            )

            candidate_by_code[
                candidate.code
            ] = candidate

        if not evaluations:
            return ForecastResult(
                indicator=indicator,
                status="insufficient_data",
                problem_type=problem_type,
                selected_model=None,
                horizon=horizon,
                observations=len(clean_series),
                quality=ForecastQuality.INSUFFICIENT,
            )

        ranked = sorted(
            evaluations,
            key=lambda result: (
                result.metrics.rmse,
                result.metrics.mae,
                result.metrics.smape,
            ),
        )

        selection = select_champion(
            evaluations,
            minimum_challenger_gain_pct=(
                definition.minimum_challenger_gain_pct
            ),
        )

        champion_evaluation = (
            selection.champion
        )

        champion = candidate_by_code[
            champion_evaluation.model_code
        ]

        champion.fit(clean_series)

        predictions = champion.predict(
            horizon=horizon
        )

        bounded_predictions: list[float] = []

        for prediction in predictions:
            value = float(
                prediction
            )

            if (
                definition.lower_bound
                is not None
            ):
                value = max(
                    definition.lower_bound,
                    value,
                )

            if (
                definition.upper_bound
                is not None
            ):
                value = min(
                    definition.upper_bound,
                    value,
                )

            bounded_predictions.append(
                value
            )

        last_timestamp = (
            clean_series[-1].timestamp
        )

        forecast_points = [
            ForecastPoint(
                timestamp=add_forecast_period(
                    last_timestamp,
                    index,
                    frequency,
                ),
                value=float(value),
            )
            for index, value in enumerate(
                bounded_predictions,
                start=1,
            )
        ]

        forecast_points, uncertainty = (
            apply_empirical_uncertainty(
                forecast_points,
                residuals=(
                    champion_evaluation.residuals
                ),
                coverage=0.80,
                lower_bound=(
                    definition.lower_bound
                ),
                upper_bound=(
                    definition.upper_bound
                ),
            )
        )

        quality = (
            determine_forecast_quality(
                observations=len(
                    clean_series
                ),
                champion=champion_evaluation,
            )
        )

        return ForecastResult(
            indicator=indicator,
            status="completed",
            problem_type=problem_type,
            selected_model=(
                champion_evaluation.model_code
            ),
            horizon=horizon,
            observations=len(clean_series),
            quality=quality,
            metrics=(
                champion_evaluation.metrics
            ),
            forecast=forecast_points,
            challengers=[
                evaluation
                for evaluation in ranked
                if evaluation.model_code
                != champion_evaluation.model_code
            ],
            evaluations=ranked,
            metadata={
                "selection_method":
                    "rolling_origin_backtest",
                "ranking":
                    "rmse_mae_smape",
                "frequency":
                    definition.frequency.value,
                "indicator_kind":
                    definition.kind.value,
                "weighting":
                    definition.weighting.value,
                "minimum_observations":
                    definition.minimum_observations,
                "lower_bound":
                    definition.lower_bound,
                "upper_bound":
                    definition.upper_bound,
                "best_baseline":
                    selection.best_baseline.model_code,
                "best_challenger": (
                    selection.best_challenger.model_code
                    if selection.best_challenger
                    else None
                ),
                "challenger_gain_pct":
                    selection.challenger_gain_pct,
                "challenger_promoted":
                    selection.challenger_promoted,
                "minimum_challenger_gain_pct":
                    definition.minimum_challenger_gain_pct,
                "uncertainty_method":
                    uncertainty.method,
                "uncertainty_coverage":
                    uncertainty.coverage,
                "uncertainty_radius":
                    uncertainty.radius,
                "uncertainty_calibration_points":
                    uncertainty.calibration_points,
            },
        )
