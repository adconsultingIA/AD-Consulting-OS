from __future__ import annotations

from math import sqrt

from app.services.forecasting.schemas import ForecastMetrics


def mean_absolute_error(
    actual: list[float],
    predicted: list[float],
) -> float:
    _validate_lengths(actual, predicted)

    if not actual:
        return 0.0

    return sum(
        abs(a - p)
        for a, p in zip(actual, predicted)
    ) / len(actual)


def root_mean_squared_error(
    actual: list[float],
    predicted: list[float],
) -> float:
    _validate_lengths(actual, predicted)

    if not actual:
        return 0.0

    mse = sum(
        (a - p) ** 2
        for a, p in zip(actual, predicted)
    ) / len(actual)

    return sqrt(mse)


def symmetric_mean_absolute_percentage_error(
    actual: list[float],
    predicted: list[float],
) -> float:
    _validate_lengths(actual, predicted)

    if not actual:
        return 0.0

    errors: list[float] = []

    for actual_value, predicted_value in zip(
        actual,
        predicted,
    ):
        denominator = (
            abs(actual_value)
            + abs(predicted_value)
        )

        if denominator == 0:
            errors.append(0.0)
            continue

        errors.append(
            200
            * abs(actual_value - predicted_value)
            / denominator
        )

    return sum(errors) / len(errors)


def calculate_metrics(
    actual: list[float],
    predicted: list[float],
) -> ForecastMetrics:
    return ForecastMetrics(
        rmse=root_mean_squared_error(
            actual,
            predicted,
        ),
        mae=mean_absolute_error(
            actual,
            predicted,
        ),
        smape=symmetric_mean_absolute_percentage_error(
            actual,
            predicted,
        ),
    )


def _validate_lengths(
    actual: list[float],
    predicted: list[float],
) -> None:
    if len(actual) != len(predicted):
        raise ValueError(
            "actual et predicted doivent avoir "
            "le même nombre d'observations."
        )


def weighted_mean_absolute_error(
    actual: list[float],
    predicted: list[float],
    weights: list[float],
) -> float:
    _validate_weighted_inputs(
        actual,
        predicted,
        weights,
    )

    total_weight = sum(weights)

    if total_weight <= 0:
        return 0.0

    return sum(
        weight * abs(a - p)
        for a, p, weight in zip(
            actual,
            predicted,
            weights,
        )
    ) / total_weight


def weighted_root_mean_squared_error(
    actual: list[float],
    predicted: list[float],
    weights: list[float],
) -> float:
    _validate_weighted_inputs(
        actual,
        predicted,
        weights,
    )

    total_weight = sum(weights)

    if total_weight <= 0:
        return 0.0

    mse = sum(
        weight * ((a - p) ** 2)
        for a, p, weight in zip(
            actual,
            predicted,
            weights,
        )
    ) / total_weight

    return sqrt(mse)


def weighted_symmetric_mean_absolute_percentage_error(
    actual: list[float],
    predicted: list[float],
    weights: list[float],
) -> float:
    _validate_weighted_inputs(
        actual,
        predicted,
        weights,
    )

    weighted_errors: list[
        tuple[float, float]
    ] = []

    for actual_value, predicted_value, weight in zip(
        actual,
        predicted,
        weights,
    ):
        denominator = (
            abs(actual_value)
            + abs(predicted_value)
        )

        if denominator == 0:
            error = 0.0
        else:
            error = (
                200
                * abs(
                    actual_value
                    - predicted_value
                )
                / denominator
            )

        weighted_errors.append(
            (
                error,
                weight,
            )
        )

    total_weight = sum(
        weight
        for _, weight
        in weighted_errors
    )

    if total_weight <= 0:
        return 0.0

    return sum(
        error * weight
        for error, weight
        in weighted_errors
    ) / total_weight


def calculate_weighted_metrics(
    actual: list[float],
    predicted: list[float],
    weights: list[float],
) -> ForecastMetrics:
    return ForecastMetrics(
        rmse=weighted_root_mean_squared_error(
            actual,
            predicted,
            weights,
        ),
        mae=weighted_mean_absolute_error(
            actual,
            predicted,
            weights,
        ),
        smape=weighted_symmetric_mean_absolute_percentage_error(
            actual,
            predicted,
            weights,
        ),
    )


def _validate_weighted_inputs(
    actual: list[float],
    predicted: list[float],
    weights: list[float],
) -> None:
    if not (
        len(actual)
        == len(predicted)
        == len(weights)
    ):
        raise ValueError(
            "actual, predicted et weights doivent "
            "avoir le même nombre d'observations."
        )

    if any(
        weight < 0
        for weight in weights
    ):
        raise ValueError(
            "Les poids ne peuvent pas être négatifs."
        )
