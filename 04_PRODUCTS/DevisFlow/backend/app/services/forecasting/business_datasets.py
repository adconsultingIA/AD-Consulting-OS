from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Iterable

from app.services.forecasting.schemas import (
    RateSeriesPoint,
    TimeSeriesPoint,
)


def _month_start(
    value: date | datetime,
) -> datetime:
    return datetime(
        value.year,
        value.month,
        1,
    )


def _next_month(
    value: datetime,
) -> datetime:
    if value.month == 12:
        return datetime(
            value.year + 1,
            1,
            1,
        )

    return datetime(
        value.year,
        value.month + 1,
        1,
    )


def _to_float(
    value: object,
) -> float:
    if value is None:
        return 0.0

    if isinstance(
        value,
        Decimal,
    ):
        return float(value)

    return float(value)


def build_monthly_revenue_series(
    invoices: Iterable[object],
) -> list[TimeSeriesPoint]:
    """
    Construit une série mensuelle de CA facturé.

    Règles :
    - date métier = issue_date puis created_at
    - montant métier = net_total puis total
    - agrégation par mois
    - les mois sans facturation sont conservés à zéro
    """

    revenue_by_month: dict[
        datetime,
        float,
    ] = defaultdict(float)

    for invoice in invoices:
        issue_date = getattr(
            invoice,
            "issue_date",
            None,
        )

        created_at = getattr(
            invoice,
            "created_at",
            None,
        )

        invoice_date = (
            issue_date
            or created_at
        )

        if invoice_date is None:
            continue

        if isinstance(
            invoice_date,
            str,
        ):
            invoice_date = (
                datetime.fromisoformat(
                    invoice_date.replace(
                        "Z",
                        "+00:00",
                    )
                )
            )

        month = _month_start(
            invoice_date
        )

        net_total = getattr(
            invoice,
            "net_total",
            None,
        )

        total = getattr(
            invoice,
            "total",
            None,
        )

        amount = _to_float(
            net_total
            if net_total is not None
            else total
        )

        revenue_by_month[
            month
        ] += amount

    if not revenue_by_month:
        return []

    first_month = min(
        revenue_by_month
    )

    last_month = max(
        revenue_by_month
    )

    series: list[
        TimeSeriesPoint
    ] = []

    current_month = (
        first_month
    )

    while (
        current_month
        <= last_month
    ):
        series.append(
            TimeSeriesPoint(
                timestamp=current_month,
                value=float(
                    revenue_by_month.get(
                        current_month,
                        0.0,
                    )
                ),
            )
        )

        current_month = (
            _next_month(
                current_month
            )
        )

    return series




def build_monthly_collections_series(
    payments: Iterable[object],
) -> list[TimeSeriesPoint]:
    """
    Construit la série mensuelle des encaissements.

    Règles :
    - date métier = payment_date
    - montant métier = payment.amount
    - agrégation mensuelle
    - mois sans paiement conservés à zéro
    """

    collections_by_month: dict[
        datetime,
        float,
    ] = defaultdict(float)

    for payment in payments:
        payment_date = getattr(
            payment,
            "payment_date",
            None,
        )

        if payment_date is None:
            continue

        if isinstance(
            payment_date,
            str,
        ):
            payment_date = datetime.fromisoformat(
                payment_date.replace(
                    "Z",
                    "+00:00",
                )
            )

        month = _month_start(
            payment_date
        )

        amount = _to_float(
            getattr(
                payment,
                "amount",
                0,
            )
        )

        collections_by_month[
            month
        ] += amount

    if not collections_by_month:
        return []

    first_month = min(
        collections_by_month
    )

    last_month = max(
        collections_by_month
    )

    series: list[
        TimeSeriesPoint
    ] = []

    current_month = first_month

    while (
        current_month
        <= last_month
    ):
        series.append(
            TimeSeriesPoint(
                timestamp=current_month,
                value=float(
                    collections_by_month.get(
                        current_month,
                        0.0,
                    )
                ),
            )
        )

        current_month = _next_month(
            current_month
        )

    return series




def build_monthly_quote_acceptance_rate(
    quotes: Iterable[object],
) -> list[RateSeriesPoint]:
    """
    Taux d'acceptation mensuel par cohorte de création.

    IMPORTANT :
    QuoteDB ne possède actuellement pas sent_at.
    La date de cohorte est donc created_at.

    Un mois sans devis :
    numerator = 0
    denominator = 0
    value = None

    Ce mois n'est donc PAS interprété comme 0 %.
    """

    sent_by_month: dict[
        datetime,
        int,
    ] = defaultdict(int)

    accepted_by_month: dict[
        datetime,
        int,
    ] = defaultdict(int)

    activity_months: list[
        datetime
    ] = []

    for quote in quotes:
        created_at = getattr(
            quote,
            "created_at",
            None,
        )

        if created_at is None:
            continue

        if isinstance(
            created_at,
            str,
        ):
            created_at = datetime.fromisoformat(
                created_at.replace(
                    "Z",
                    "+00:00",
                )
            )

        month = _month_start(
            created_at
        )

        status = getattr(
            quote,
            "status",
            None,
        )

        if status not in {
            "sent",
            "accepted",
        }:
            continue

        # Un devis accepté a nécessairement
        # appartenu à l'ensemble des devis envoyés.
        sent_by_month[
            month
        ] += 1

        if status == "accepted":
            accepted_by_month[
                month
            ] += 1

        activity_months.append(
            month
        )

    if not activity_months:
        return []

    first_month = min(
        activity_months
    )

    last_month = max(
        activity_months
    )

    series: list[
        RateSeriesPoint
    ] = []

    current_month = first_month

    while (
        current_month
        <= last_month
    ):
        series.append(
            RateSeriesPoint(
                timestamp=current_month,
                numerator=(
                    accepted_by_month.get(
                        current_month,
                        0,
                    )
                ),
                denominator=(
                    sent_by_month.get(
                        current_month,
                        0,
                    )
                ),
            )
        )

        current_month = _next_month(
            current_month
        )

    return series




def build_monthly_recurring_revenue_share(
    invoices: Iterable[object],
) -> list[RateSeriesPoint]:
    """
    Part mensuelle du CA provenant de la facturation récurrente.

    numerator   = CA récurrent
    denominator = CA total
    value       = part récurrente en %

    Un mois sans CA :
    numerator = 0
    denominator = 0
    value = None

    Il n'est donc pas interprété comme 0 % de récurrence.
    """

    total_by_month: dict[
        datetime,
        float,
    ] = defaultdict(float)

    recurring_by_month: dict[
        datetime,
        float,
    ] = defaultdict(float)

    activity_months: list[
        datetime
    ] = []

    for invoice in invoices:
        issue_date = getattr(
            invoice,
            "issue_date",
            None,
        )

        created_at = getattr(
            invoice,
            "created_at",
            None,
        )

        invoice_date = (
            issue_date
            or created_at
        )

        if invoice_date is None:
            continue

        if isinstance(
            invoice_date,
            str,
        ):
            invoice_date = datetime.fromisoformat(
                invoice_date.replace(
                    "Z",
                    "+00:00",
                )
            )

        month = _month_start(
            invoice_date
        )

        net_total = getattr(
            invoice,
            "net_total",
            None,
        )

        total = getattr(
            invoice,
            "total",
            None,
        )

        amount = _to_float(
            net_total
            if net_total is not None
            else total
        )

        total_by_month[
            month
        ] += amount

        recurring_invoice_id = getattr(
            invoice,
            "recurring_invoice_id",
            None,
        )

        if recurring_invoice_id:
            recurring_by_month[
                month
            ] += amount

        activity_months.append(
            month
        )

    if not activity_months:
        return []

    first_month = min(
        activity_months
    )

    last_month = max(
        activity_months
    )

    series: list[
        RateSeriesPoint
    ] = []

    current_month = first_month

    while current_month <= last_month:
        series.append(
            RateSeriesPoint(
                timestamp=current_month,
                numerator=float(
                    recurring_by_month.get(
                        current_month,
                        0.0,
                    )
                ),
                denominator=float(
                    total_by_month.get(
                        current_month,
                        0.0,
                    )
                ),
            )
        )

        current_month = _next_month(
            current_month
        )

    return series


SUPPORTED_BUSINESS_DATASETS = {
    "monthly_revenue",
    "monthly_collections",
    "recurring_revenue_share",
}


def build_business_time_series(
    *,
    indicator: str,
    invoices: Iterable[object],
) -> list[TimeSeriesPoint]:
    if indicator == "monthly_revenue":
        return build_monthly_revenue_series(
            invoices
        )

    raise ValueError(
        f"Dataset métier non supporté : {indicator}"
    )
