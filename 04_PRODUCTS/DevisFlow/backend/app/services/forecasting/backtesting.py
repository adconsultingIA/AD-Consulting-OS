from __future__ import annotations

from app.services.forecasting.metrics import (
    calculate_metrics,
)
from app.services.forecasting.models.base import (
    ForecastModel,
)
from app.services.forecasting.schemas import (
    ForecastMetrics,
    ModelEvaluation,
    TimeSeriesPoint,
)


def rolling_origin_backtest(
    model: ForecastModel,
    series: list[TimeSeriesPoint],
    *,
    minimum_train_size: int = 3,
    maximum_folds: int = 6,
) -> ModelEvaluation:
    if len(series) <= minimum_train_size:
        raise ValueError(
            "Historique insuffisant pour le backtesting."
        )

    available_folds = (
        len(series)
        - minimum_train_size
    )

    fold_count = min(
        maximum_folds,
        available_folds,
    )

    first_test_index = (
        len(series)
        - fold_count
    )

    actual: list[float] = []
    predicted: list[float] = []

    for test_index in range(
        first_test_index,
        len(series),
    ):
        train_series = series[:test_index]
        test_point = series[test_index]

        candidate = type(model)()

        candidate.fit(train_series)

        prediction = candidate.predict(
            horizon=1
        )[0]

        actual.append(
            float(test_point.value)
        )

        predicted.append(
            float(prediction)
        )

    metrics: ForecastMetrics = (
        calculate_metrics(
            actual,
            predicted,
        )
    )

    residuals = tuple(
        actual_value - predicted_value
        for actual_value, predicted_value
        in zip(actual, predicted)
    )

    return ModelEvaluation(
        model_code=model.code,
        metrics=metrics,
        folds=fold_count,
        observations=len(series),
        residuals=residuals,
    )


def rolling_origin_weighted_backtest(
    model: ForecastModel,
    series,
    *,
    minimum_train_size: int = 3,
    maximum_folds: int = 6,
) -> ModelEvaluation:
    from app.services.forecasting.metrics import (
        calculate_weighted_metrics,
    )
    from app.services.forecasting.schemas import (
        TimeSeriesPoint,
    )

    if len(series) <= minimum_train_size:
        raise ValueError(
            "Historique insuffisant pour le backtesting pondéré."
        )

    available_folds = (
        len(series)
        - minimum_train_size
    )

    fold_count = min(
        maximum_folds,
        available_folds,
    )

    first_test_index = (
        len(series)
        - fold_count
    )

    actual: list[float] = []
    predicted: list[float] = []
    weights: list[float] = []

    for test_index in range(
        first_test_index,
        len(series),
    ):
        train_series = [
            TimeSeriesPoint(
                timestamp=point.timestamp,
                value=point.value,
            )
            for point in series[:test_index]
        ]

        test_point = (
            series[test_index]
        )

        candidate = type(model)()

        candidate.fit(
            train_series
        )

        prediction = candidate.predict(
            horizon=1
        )[0]

        actual.append(
            float(
                test_point.value
            )
        )

        predicted.append(
            float(
                prediction
            )
        )

        weights.append(
            float(
                test_point.weight
            )
        )

    metrics = calculate_weighted_metrics(
        actual,
        predicted,
        weights,
    )

    residuals = tuple(
        actual_value - predicted_value
        for actual_value, predicted_value
        in zip(actual, predicted)
    )

    return ModelEvaluation(
        model_code=model.code,
        metrics=metrics,
        folds=fold_count,
        observations=len(series),
        residuals=residuals,
    )
