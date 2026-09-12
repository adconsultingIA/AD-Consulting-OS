from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.database_models import (
    InvoiceDB,
    PaymentDB,
    QuoteDB,
)


REVENUE_INVOICE_STATUSES = {
    "issued",
    "sent",
    "partial",
    "overdue",
    "paid",
}


def get_revenue_invoices(
    db: Session,
    *,
    organization_id: str,
) -> list[InvoiceDB]:
    """
    Retourne les factures qui constituent le CA facturé
    exploitable par le Forecasting Engine.

    Règles métier :
    - strictement limitées à l'organisation active ;
    - draft exclu ;
    - cancelled exclu ;
    - classique et récurrente incluses ;
    - tri chronologique stable.
    """

    return (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.organization_id
            == organization_id,
            InvoiceDB.status.in_(
                REVENUE_INVOICE_STATUSES
            ),
        )
        .order_by(
            InvoiceDB.issue_date.asc(),
            InvoiceDB.created_at.asc(),
        )
        .all()
    )



def get_collection_payments(
    db: Session,
    *,
    organization_id: str,
) -> list[PaymentDB]:
    """
    Retourne les paiements réellement encaissés
    appartenant à l'organisation active.

    PaymentDB ne porte pas organization_id :
    le tenant est donc résolu via InvoiceDB.
    """

    return (
        db.query(PaymentDB)
        .join(
            InvoiceDB,
            PaymentDB.invoice_id
            == InvoiceDB.id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id,
        )
        .order_by(
            PaymentDB.payment_date.asc(),
            PaymentDB.created_at.asc(),
        )
        .all()
    )



QUOTE_ACCEPTANCE_STATUSES = {
    "sent",
    "accepted",
}


def get_acceptance_quotes(
    db: Session,
    *,
    organization_id: str,
) -> list[QuoteDB]:
    """
    Cohortes de devis exploitables pour le taux
    d'acceptation.

    En l'absence de sent_at, la cohorte temporelle
    est définie par created_at.

    - sent = devis envoyé mais non encore accepté
    - accepted = devis envoyé puis accepté
    """

    return (
        db.query(QuoteDB)
        .filter(
            QuoteDB.organization_id
            == organization_id,
            QuoteDB.status.in_(
                QUOTE_ACCEPTANCE_STATUSES
            ),
        )
        .order_by(
            QuoteDB.created_at.asc(),
        )
        .all()
    )
