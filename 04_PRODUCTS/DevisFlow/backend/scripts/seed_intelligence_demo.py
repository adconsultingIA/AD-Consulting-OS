from __future__ import annotations

import argparse
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.database_models import (
    ClientDB,
    InvoiceDB,
    PaymentDB,
    QuoteDB,
    RecurringInvoiceDB,
    RequestDB,
)


PREFIX = "INTEL-DEMO-"

INDICATORS = (
    "monthly_revenue",
    "monthly_collections",
    "quote_acceptance_rate",
    "recurring_revenue_share",
)


def demo_id(kind: str) -> str:
    return str(uuid4())


def month_sequence(
    start_year: int,
    start_month: int,
    count: int,
):
    year = start_year
    month = start_month

    for _ in range(count):
        yield year, month

        month += 1

        if month == 13:
            month = 1
            year += 1


def first_client(
    db: Session,
    organization_id: str,
):
    return (
        db.query(ClientDB)
        .filter(
            ClientDB.organization_id
            == organization_id
        )
        .first()
    )


def cleanup_demo(
    db: Session,
    organization_id: str,
):
    payments = (
        db.query(PaymentDB)
        .filter(
            PaymentDB.reference.like(
                f"{PREFIX}%"
            )
        )
        .all()
    )

    for payment in payments:
        db.delete(payment)

    invoices = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.organization_id
            == organization_id,
            InvoiceDB.invoice_number.like(
                f"{PREFIX}%"
            ),
        )
        .all()
    )

    for invoice in invoices:
        db.delete(invoice)

    recurring = (
        db.query(RecurringInvoiceDB)
        .filter(
            RecurringInvoiceDB.organization_id
            == organization_id,
            RecurringInvoiceDB.service_name.like(
                f"{PREFIX}%"
            ),
        )
        .all()
    )

    for item in recurring:
        db.delete(item)

    quotes = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.organization_id
            == organization_id,
            QuoteDB.quote_number.like(
                f"{PREFIX}%"
            ),
        )
        .all()
    )

    for quote in quotes:
        db.delete(quote)

    requests = (
        db.query(RequestDB)
        .filter(
            RequestDB.organization_id
            == organization_id,
            RequestDB.title.like(
                f"{PREFIX}%"
            ),
        )
        .all()
    )

    for request in requests:
        db.delete(request)

    db.commit()

    print("✓ Données Intelligence demo supprimées")


def seed_demo(
    db: Session,
    organization_id: str,
    client_id: str | None,
):
    existing = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.organization_id
            == organization_id,
            QuoteDB.quote_number.like(
                f"{PREFIX}%"
            ),
        )
        .first()
    )

    if existing:
        raise SystemExit(
            "Des données INTEL-DEMO existent déjà. "
            "Lancez d'abord --cleanup."
        )

    if client_id:
        client = (
            db.query(ClientDB)
            .filter(
                ClientDB.id == client_id,
                ClientDB.organization_id
                == organization_id,
            )
            .first()
        )
    else:
        client = first_client(
            db,
            organization_id,
        )

    if client is None:
        raise SystemExit(
            "Aucun client disponible pour cette "
            "organisation. Créez un client de démo "
            "dans DevisFlow puis relancez le script."
        )

    recurring_quote_id = None

    # Avril 2025 -> septembre 2026 = 18 mois
    months = list(
        month_sequence(
            2025,
            4,
            18,
        )
    )

    created_requests = 0
    created_quotes = 0
    created_invoices = 0
    created_payments = 0

    recurring_record = None

    for month_index, (
        year,
        month,
    ) in enumerate(months):

        # Tendance progressive mais non parfaitement linéaire.
        variation = (
            900
            if month_index % 4 == 0
            else -450
            if month_index % 5 == 0
            else 250
        )

        monthly_revenue = (
            18000
            + month_index * 1150
            + variation
        )

        # 10 devis mensuels.
        # Acceptation : 5 -> 8/10 selon la période.
        accepted_count = min(
            8,
            5 + month_index // 5,
        )

        monthly_quotes = []

        for quote_index in range(10):
            request_id = demo_id("REQ")
            quote_id = demo_id("QUOTE")

            request = RequestDB(
                id=request_id,
                organization_id=organization_id,
                client_id=client.id,
                title=(
                    f"{PREFIX}Demande "
                    f"{year}-{month:02d}-"
                    f"{quote_index + 1:02d}"
                ),
                description=(
                    "Donnée de démonstration "
                    "Intelligence Forecasting"
                ),
                budget=Decimal(
                    str(
                        2500
                        + quote_index * 175
                    )
                ),
                deadline=date(
                    year,
                    month,
                    min(
                        25,
                        8 + quote_index,
                    ),
                ),
                status="qualified",
                created_at=datetime(
                    year,
                    month,
                    min(
                        20,
                        2 + quote_index,
                    ),
                    10,
                    0,
                    0,
                ),
            )

            accepted = (
                quote_index
                < accepted_count
            )

            quote = QuoteDB(
                id=quote_id,
                request_id=request_id,
                organization_id=organization_id,
                quote_number=(
                    f"{PREFIX}Q-"
                    f"{year}{month:02d}-"
                    f"{quote_index + 1:02d}"
                ),
                status=(
                    "accepted"
                    if accepted
                    else "sent"
                ),
                version=1,
                valid_until=date(
                    year,
                    month,
                    28,
                ),
                notes=(
                    "Donnée Intelligence demo"
                ),
                acceptance_checked=(
                    1 if accepted else 0
                ),
                acceptance_method=(
                    "demo"
                    if accepted
                    else None
                ),
                accepted_at=(
                    datetime(
                        year,
                        month,
                        min(
                            25,
                            10 + quote_index,
                        ),
                        12,
                        0,
                        0,
                    )
                    if accepted
                    else None
                ),
                subtotal=Decimal("2000"),
                vat_amount=Decimal("0"),
                total=Decimal("2000"),
                created_at=datetime(
                    year,
                    month,
                    min(
                        20,
                        3 + quote_index,
                    ),
                    9,
                    0,
                    0,
                ),
                updated_at=datetime(
                    year,
                    month,
                    min(
                        25,
                        10 + quote_index,
                    ),
                    12,
                    0,
                    0,
                ),
            )

            db.add(request)
            db.add(quote)

            monthly_quotes.append(
                quote
            )

            created_requests += 1
            created_quotes += 1

        db.flush()

        # Crée le support de facturation récurrente
        # à partir du premier devis accepté.
        if recurring_record is None:
            recurring_quote_id = (
                monthly_quotes[0].id
            )

            recurring_record = (
                RecurringInvoiceDB(
                    id=demo_id("REC"),
                    quote_id=recurring_quote_id,
                    organization_id=organization_id,
                    service_name=(
                        f"{PREFIX}"
                        "Abonnement mensuel"
                    ),
                    frequency="monthly",
                    start_date=date(
                        year,
                        month,
                        1,
                    ),
                    next_invoice_date=date(
                        year,
                        month,
                        28,
                    ),
                    status="active",
                    created_at=datetime(
                        year,
                        month,
                        1,
                        8,
                        0,
                        0,
                    ),
                    updated_at=datetime(
                        year,
                        month,
                        1,
                        8,
                        0,
                        0,
                    ),
                )
            )

            db.add(
                recurring_record
            )

            db.flush()

        # Environ 25 à 40 % récurrent,
        # avec progression graduelle.
        recurring_share = min(
            0.42,
            0.24
            + month_index * 0.01,
        )

        recurring_amount = round(
            monthly_revenue
            * recurring_share,
            2,
        )

        standard_amount = round(
            monthly_revenue
            - recurring_amount,
            2,
        )

        invoice_specs = [
            (
                standard_amount,
                None,
                "STD",
            ),
            (
                recurring_amount,
                recurring_record.id,
                "REC",
            ),
        ]

        for (
            amount,
            recurring_id,
            kind,
        ) in invoice_specs:
            invoice_id = (
                demo_id("INV")
            )

            invoice = InvoiceDB(
                id=invoice_id,
                quote_id=(
                    monthly_quotes[0].id
                    if kind == "REC"
                    else monthly_quotes[1].id
                ),
                recurring_invoice_id=(
                    recurring_id
                ),
                organization_id=organization_id,
                invoice_number=(
                    f"{PREFIX}INV-"
                    f"{kind}-"
                    f"{year}{month:02d}"
                ),
                status="paid",
                invoice_type="standard",
                issue_date=date(
                    year,
                    month,
                    5,
                ),
                due_date=date(
                    year,
                    month,
                    25,
                ),
                payment_terms=(
                    "Donnée Intelligence demo"
                ),
                payment_method="bank_transfer",
                payment_terms_days=20,
                reminder_interval_days=7,
                reminder_paused=False,
                notes=(
                    "Donnée de démonstration "
                    "Forecasting"
                ),
                subtotal=Decimal(
                    str(amount)
                ),
                vat_amount=Decimal("0"),
                total=Decimal(
                    str(amount)
                ),
                amount_paid=Decimal(
                    str(amount)
                ),
                amount_due=Decimal("0"),
                credit_total=Decimal("0"),
                net_total=Decimal(
                    str(amount)
                ),
                customer_credit=Decimal("0"),
                refunded_total=Decimal("0"),
                created_at=datetime(
                    year,
                    month,
                    5,
                    9,
                    0,
                    0,
                ),
                updated_at=datetime(
                    year,
                    month,
                    25,
                    9,
                    0,
                    0,
                ),
            )

            db.add(invoice)
            db.flush()

            # Encaissement volontairement légèrement
            # inférieur certains mois pour créer
            # une série réaliste mais cohérente.
            collection_factor = (
                0.96
                if month_index % 6 == 0
                else 0.985
                if month_index % 4 == 0
                else 1.0
            )

            paid_amount = round(
                amount
                * collection_factor,
                2,
            )

            payment = PaymentDB(
                id=demo_id("PAY"),
                invoice_id=invoice_id,
                amount=Decimal(
                    str(paid_amount)
                ),
                payment_date=date(
                    year,
                    month,
                    24,
                ),
                payment_method="bank_transfer",
                reference=(
                    f"{PREFIX}PAY-"
                    f"{year}{month:02d}-"
                    f"{kind}"
                ),
                notes=(
                    "Encaissement Intelligence demo"
                ),
                created_at=datetime(
                    year,
                    month,
                    24,
                    14,
                    0,
                    0,
                ),
            )

            db.add(payment)

            created_invoices += 1
            created_payments += 1

    db.commit()

    print("")
    print("✓ Seed Intelligence créé")
    print(
        f"  Organisation : {organization_id}"
    )
    print(
        f"  Client utilisé : {client.id}"
    )
    print(
        f"  Mois : {len(months)}"
    )
    print(
        f"  Demandes : {created_requests}"
    )
    print(
        f"  Devis : {created_quotes}"
    )
    print(
        f"  Factures : {created_invoices}"
    )
    print(
        f"  Paiements : {created_payments}"
    )
    print("")
    print(
        "Étape suivante : recalculer les forecasts."
    )


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--organization-id",
        required=True,
    )

    parser.add_argument(
        "--client-id",
        default=None,
    )

    parser.add_argument(
        "--cleanup",
        action="store_true",
    )

    args = parser.parse_args()

    db_path = (
        Path(__file__)
        .resolve()
        .parent
        .parent
        / "devisflow.db"
    )

    if not db_path.exists():
        raise SystemExit(
            f"Base SQLite introuvable : {db_path}"
        )

    engine = create_engine(
        f"sqlite:///{db_path}"
    )

    with Session(engine) as db:
        if args.cleanup:
            cleanup_demo(
                db,
                args.organization_id,
            )
        else:
            seed_demo(
                db,
                args.organization_id,
                args.client_id,
            )


if __name__ == "__main__":
    main()
