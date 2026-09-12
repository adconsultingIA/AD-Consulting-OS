from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.intelligence import (
    RecommendedActionResponse,
)
from app.services.forecasting.read_service import (
    get_latest_persisted_forecast,
)


INDICATORS = (
    "monthly_revenue",
    "monthly_collections",
    "quote_acceptance_rate",
    "recurring_revenue_share",
)


def _change_percent(
    current: float,
    forecast: float,
) -> float | None:
    if current == 0:
        return None

    return (
        (forecast - current)
        / abs(current)
    ) * 100


def _priority(
    *,
    current: float,
    forecast: float,
    lower_bound: float | None,
) -> str:
    """
    V1 explicable.

    high:
        baisse centrale + scénario bas
        sensiblement inférieur au réel.

    medium:
        baisse prévue.

    low:
        situation stable ou favorable.
    """

    if (
        forecast < current
        and lower_bound is not None
        and lower_bound < current * 0.75
    ):
        return "high"

    if forecast < current:
        return "medium"

    return "low"


def _direction(
    current: float,
    forecast: float,
) -> str:
    if forecast > current:
        return "up"

    if forecast < current:
        return "down"

    return "stable"


def _content(
    indicator: str,
    *,
    direction: str,
) -> tuple[str, str, str, str]:
    if indicator == "monthly_revenue":
        if direction == "down":
            return (
                "Chiffre d'affaires à surveiller",
                (
                    "Le chiffre d'affaires prévu "
                    "est inférieur au dernier niveau "
                    "réel observé."
                ),
                "Examiner les factures",
                "/invoices?period=all",
            )

        return (
            "Dynamique de chiffre d'affaires favorable",
            (
                "Le chiffre d'affaires prévu "
                "reste supérieur au dernier niveau "
                "réel observé."
            ),
            "Voir les factures",
            "/invoices?period=all",
        )

    if indicator == "monthly_collections":
        if direction == "down":
            return (
                "Encaissements à surveiller",
                (
                    "Les encaissements prévus "
                    "reculent par rapport au dernier "
                    "niveau réel observé."
                ),
                "Examiner les paiements",
                "/payments",
            )

        return (
            "Encaissements orientés favorablement",
            (
                "Les prochains encaissements "
                "sont orientés au-dessus du dernier "
                "niveau réel observé."
            ),
            "Voir les paiements",
            "/payments",
        )

    if indicator == "quote_acceptance_rate":
        if direction == "down":
            return (
                "Conversion commerciale à surveiller",
                (
                    "Le taux d'acceptation prévu "
                    "est inférieur au dernier taux "
                    "réel observé."
                ),
                "Examiner les devis",
                "/quotes",
            )

        return (
            "Conversion commerciale favorable",
            (
                "Le taux d'acceptation prévu "
                "reste supérieur au dernier taux "
                "réel observé."
            ),
            "Voir les devis",
            "/quotes",
        )

    if indicator == "recurring_revenue_share":
        if direction == "down":
            return (
                "Revenu récurrent à renforcer",
                (
                    "La part de revenu récurrent "
                    "prévue recule par rapport au "
                    "dernier niveau observé."
                ),
                "Examiner les récurrences",
                "/invoices?period=all",
            )

        return (
            "Revenu récurrent bien orienté",
            (
                "La part de revenu récurrent "
                "prévue progresse par rapport au "
                "dernier niveau observé."
            ),
            "Voir les factures récurrentes",
            "/invoices?period=all",
        )

    raise ValueError(
        f"Indicateur non supporté : {indicator}"
    )


def build_recommended_actions(
    db: Session,
    *,
    organization_id: str,
) -> list[RecommendedActionResponse]:
    actions: list[
        RecommendedActionResponse
    ] = []

    for indicator in INDICATORS:
        availability = (
            get_latest_persisted_forecast(
                db,
                organization_id=organization_id,
                indicator=indicator,
            )
        )

        forecast = availability.forecast

        if (
            not availability.available
            or forecast is None
            or not forecast.history
            or not forecast.points
        ):
            continue

        current = float(
            forecast.history[-1].value
        )

        next_point = forecast.points[0]

        predicted = float(
            next_point.value
        )

        direction = _direction(
            current,
            predicted,
        )

        priority = _priority(
            current=current,
            forecast=predicted,
            lower_bound=(
                next_point.lower_bound
            ),
        )

        (
            title,
            explanation,
            action_label,
            route,
        ) = _content(
            indicator,
            direction=direction,
        )

        change = (
            predicted - current
        )

        actions.append(
            RecommendedActionResponse(
                indicator=indicator,
                priority=priority,
                direction=direction,
                title=title,
                explanation=explanation,
                action_label=action_label,
                route=route,
                current_value=current,
                forecast_value=predicted,
                change_value=change,
                change_percent=(
                    _change_percent(
                        current,
                        predicted,
                    )
                ),
                lower_bound=(
                    next_point.lower_bound
                ),
                upper_bound=(
                    next_point.upper_bound
                ),
                quality=forecast.quality,
                model=(
                    forecast.selected_model
                ),
            )
        )

    priority_order = {
        "high": 0,
        "medium": 1,
        "low": 2,
    }

    actions.sort(
        key=lambda action: (
            priority_order.get(
                action.priority,
                99,
            ),
            action.indicator,
        )
    )

    return actions
