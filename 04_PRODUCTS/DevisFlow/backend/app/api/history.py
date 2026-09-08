from datetime import datetime, time

from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.models.database_models import (
    ClientDB,
    CreditNoteDB,
    InvoiceDB,
    PaymentDB,
    PaymentReminderDB,
    QuoteDB,
    RefundDB,
    RequestDB,
)

from app.models.document_email import (
    DocumentEmailDB,
)

from app.schemas.history import (
    HistoryEventResponse,
)

from app.services.coreflow_client import (
    get_devisflow_organization_id,
)


router = APIRouter(
    prefix="/api/v1/history",
    tags=["History"],
)


def as_datetime(
    value,
    fallback=None,
):
    if isinstance(value, datetime):
        return value

    if value is not None:
        return datetime.combine(
            value,
            time.min,
        )

    return fallback or datetime.min


def invoice_context(
    db: Session,
    organization_id: str,
):
    rows = (
        db.query(
            InvoiceDB,
            QuoteDB,
            RequestDB,
            ClientDB,
        )
        .join(
            QuoteDB,
            QuoteDB.id == InvoiceDB.quote_id,
        )
        .join(
            RequestDB,
            RequestDB.id == QuoteDB.request_id,
        )
        .join(
            ClientDB,
            ClientDB.id == RequestDB.client_id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id,
            QuoteDB.organization_id
            == organization_id,
            RequestDB.organization_id
            == organization_id,
            ClientDB.organization_id
            == organization_id,
        )
        .all()
    )

    result = {}

    for invoice, quote, request, client in rows:
        result[invoice.id] = {
            "invoice": invoice,
            "quote": quote,
            "request": request,
            "client": client,
        }

    return result


@router.get(
    "/activity-summary",
)
def get_invoice_activity_summary(
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    summary: dict[str, dict[str, int]] = {}

    def ensure(invoice_id: str):
        if invoice_id not in summary:
            summary[invoice_id] = {
                "payments": 0,
                "emails": 0,
                "reminders": 0,
                "credit_notes": 0,
                "refunds": 0,
            }

        return summary[invoice_id]

    payment_rows = (
        db.query(
            PaymentDB.invoice_id,
            func.count(PaymentDB.id),
        )
        .join(
            InvoiceDB,
            InvoiceDB.id == PaymentDB.invoice_id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .group_by(PaymentDB.invoice_id)
        .all()
    )

    for invoice_id, count in payment_rows:
        ensure(invoice_id)["payments"] = int(count)

    reminder_rows = (
        db.query(
            PaymentReminderDB.invoice_id,
            func.count(PaymentReminderDB.id),
        )
        .join(
            InvoiceDB,
            InvoiceDB.id
            == PaymentReminderDB.invoice_id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .group_by(
            PaymentReminderDB.invoice_id
        )
        .all()
    )

    for invoice_id, count in reminder_rows:
        ensure(invoice_id)["reminders"] = int(count)

    credit_rows = (
        db.query(
            CreditNoteDB.invoice_id,
            func.count(CreditNoteDB.id),
        )
        .join(
            InvoiceDB,
            InvoiceDB.id
            == CreditNoteDB.invoice_id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .group_by(CreditNoteDB.invoice_id)
        .all()
    )

    for invoice_id, count in credit_rows:
        ensure(invoice_id)["credit_notes"] = int(count)

    refund_rows = (
        db.query(
            RefundDB.invoice_id,
            func.count(RefundDB.id),
        )
        .join(
            InvoiceDB,
            InvoiceDB.id == RefundDB.invoice_id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .group_by(RefundDB.invoice_id)
        .all()
    )

    for invoice_id, count in refund_rows:
        ensure(invoice_id)["refunds"] = int(count)

    email_rows = (
        db.query(
            DocumentEmailDB.document_id,
            func.count(DocumentEmailDB.id),
        )
        .filter(
            DocumentEmailDB.organization_id
            == organization_id,
            DocumentEmailDB.document_type == "invoice",
            DocumentEmailDB.status == "sent",
        )
        .group_by(DocumentEmailDB.document_id)
        .all()
    )

    for invoice_id, count in email_rows:
        ensure(invoice_id)["emails"] = int(count)

    return summary


@router.get(
    "",
    response_model=list[HistoryEventResponse],
)
def list_history(
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    contexts = invoice_context(
        db,
        organization_id,
    )

    events: list[HistoryEventResponse] = []

    # ----------------------------------------------------------
    # FACTURES CRÉÉES
    # ----------------------------------------------------------

    for context in contexts.values():
        invoice = context["invoice"]
        client = context["client"]

        events.append(
            HistoryEventResponse(
                id=f"invoice:{invoice.id}",
                event_type="invoice_created",
                entity_type="invoice",
                entity_id=invoice.id,
                document_number=(
                    invoice.invoice_number
                ),
                client_name=(
                    client.company_name
                    or client.contact_name
                ),
                event_at=invoice.created_at,
                title="Facture créée",
                detail=(
                    invoice.invoice_number
                ),
                amount=float(
                    invoice.total or 0
                ),
                status=invoice.status,
                metadata={},
            )
        )

    # ----------------------------------------------------------
    # PAIEMENTS
    # ----------------------------------------------------------

    payments = (
        db.query(PaymentDB)
        .join(
            InvoiceDB,
            InvoiceDB.id == PaymentDB.invoice_id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .order_by(
            PaymentDB.created_at.desc()
        )
        .all()
    )

    for payment in payments:
        context = contexts.get(
            payment.invoice_id
        )

        if not context:
            continue

        invoice = context["invoice"]
        client = context["client"]

        events.append(
            HistoryEventResponse(
                id=f"payment:{payment.id}",
                event_type="payment",
                entity_type="payment",
                entity_id=payment.id,
                document_number=(
                    invoice.invoice_number
                ),
                client_name=(
                    client.company_name
                    or client.contact_name
                ),
                event_at=as_datetime(
                    payment.payment_date,
                    payment.created_at,
                ),
                title="Paiement enregistré",
                detail=(
                    payment.reference
                    or payment.payment_method
                    or "Paiement"
                ),
                amount=float(
                    payment.amount or 0
                ),
                status="recorded",
                metadata={
                    "invoice_id":
                        payment.invoice_id,
                    "payment_method":
                        payment.payment_method,
                    "reference":
                        payment.reference,
                    "notes":
                        payment.notes,
                },
            )
        )

    # ----------------------------------------------------------
    # RELANCES
    # ----------------------------------------------------------

    reminders = (
        db.query(PaymentReminderDB)
        .join(
            InvoiceDB,
            InvoiceDB.id
            == PaymentReminderDB.invoice_id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .order_by(
            PaymentReminderDB.created_at.desc()
        )
        .all()
    )

    for reminder in reminders:
        context = contexts.get(
            reminder.invoice_id
        )

        if not context:
            continue

        invoice = context["invoice"]
        client = context["client"]

        email_log = (
            db.query(DocumentEmailDB)
            .filter(
                DocumentEmailDB.organization_id
                == organization_id,
                DocumentEmailDB.document_type
                == "invoice_reminder",
                DocumentEmailDB.document_id
                == reminder.id,
            )
            .order_by(
                DocumentEmailDB.created_at.desc()
            )
            .first()
        )

        events.append(
            HistoryEventResponse(
                id=f"reminder:{reminder.id}",
                event_type="reminder",
                entity_type="reminder",
                entity_id=reminder.id,
                document_number=(
                    invoice.invoice_number
                ),
                client_name=(
                    client.company_name
                    or client.contact_name
                ),
                event_at=(
                    email_log.sent_at
                    if (
                        email_log
                        and email_log.sent_at
                    )
                    else as_datetime(
                        reminder.reminder_date,
                        reminder.created_at,
                    )
                ),
                title="Relance client",
                detail=(
                    reminder.subject
                    or reminder.message
                    or "Relance"
                ),
                amount=float(
                    invoice.amount_due or 0
                ),
                status=(
                    email_log.status
                    if email_log
                    else "recorded"
                ),
                metadata={
                    "invoice_id":
                        reminder.invoice_id,
                    "channel":
                        reminder.channel,
                    "recipient":
                        (
                            email_log.recipient
                            if email_log
                            else None
                        ),
                    "provider":
                        (
                            email_log.provider
                            if email_log
                            else None
                        ),
                    "error_message":
                        (
                            email_log.error_message
                            if email_log
                            else None
                        ),
                },
            )
        )

    # ----------------------------------------------------------
    # AVOIRS
    # ----------------------------------------------------------

    credit_notes = (
        db.query(CreditNoteDB)
        .join(
            InvoiceDB,
            InvoiceDB.id
            == CreditNoteDB.invoice_id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .order_by(
            CreditNoteDB.created_at.desc()
        )
        .all()
    )

    for credit in credit_notes:
        context = contexts.get(
            credit.invoice_id
        )

        if not context:
            continue

        invoice = context["invoice"]
        client = context["client"]

        events.append(
            HistoryEventResponse(
                id=f"credit_note:{credit.id}",
                event_type="credit_note",
                entity_type="credit_note",
                entity_id=credit.id,
                document_number=(
                    credit.credit_note_number
                ),
                client_name=(
                    client.company_name
                    or client.contact_name
                ),
                event_at=as_datetime(
                    credit.issue_date,
                    credit.created_at,
                ),
                title="Avoir créé",
                detail=credit.reason,
                amount=float(
                    credit.amount or 0
                ),
                status=credit.status,
                metadata={
                    "invoice_id":
                        credit.invoice_id,
                    "invoice_number":
                        invoice.invoice_number,
                    "notes":
                        credit.notes,
                },
            )
        )

    # ----------------------------------------------------------
    # REMBOURSEMENTS
    # ----------------------------------------------------------

    refunds = (
        db.query(RefundDB)
        .join(
            InvoiceDB,
            InvoiceDB.id == RefundDB.invoice_id,
        )
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .order_by(
            RefundDB.created_at.desc()
        )
        .all()
    )

    for refund in refunds:
        context = contexts.get(
            refund.invoice_id
        )

        if not context:
            continue

        invoice = context["invoice"]
        client = context["client"]

        events.append(
            HistoryEventResponse(
                id=f"refund:{refund.id}",
                event_type="refund",
                entity_type="refund",
                entity_id=refund.id,
                document_number=(
                    invoice.invoice_number
                ),
                client_name=(
                    client.company_name
                    or client.contact_name
                ),
                event_at=as_datetime(
                    refund.refund_date,
                    refund.created_at,
                ),
                title="Remboursement",
                detail=(
                    refund.reference
                    or refund.refund_method
                    or "Remboursement"
                ),
                amount=float(
                    refund.amount or 0
                ),
                status="recorded",
                metadata={
                    "invoice_id":
                        refund.invoice_id,
                    "refund_method":
                        refund.refund_method,
                    "reference":
                        refund.reference,
                    "notes":
                        refund.notes,
                },
            )
        )

    # ----------------------------------------------------------
    # ENVOIS DE FACTURES
    # ----------------------------------------------------------

    invoice_emails = (
        db.query(DocumentEmailDB)
        .filter(
            DocumentEmailDB.organization_id
            == organization_id,
            DocumentEmailDB.document_type
            == "invoice"
        )
        .order_by(
            DocumentEmailDB.created_at.desc()
        )
        .all()
    )

    for email in invoice_emails:
        context = contexts.get(
            email.document_id
        )

        if not context:
            continue

        invoice = context["invoice"]
        client = context["client"]

        events.append(
            HistoryEventResponse(
                id=f"invoice_email:{email.id}",
                event_type="invoice_sent",
                entity_type="invoice_email",
                entity_id=email.id,
                document_number=(
                    invoice.invoice_number
                ),
                client_name=(
                    client.company_name
                    or client.contact_name
                ),
                event_at=(
                    email.sent_at
                    or email.created_at
                ),
                title=(
                    "Facture envoyée"
                    if email.status == "sent"
                    else "Envoi de facture"
                ),
                detail=(
                    f"À {email.recipient}"
                ),
                amount=float(
                    invoice.total or 0
                ),
                status=email.status,
                metadata={
                    "invoice_id":
                        invoice.id,
                    "recipient":
                        email.recipient,
                    "provider":
                        email.provider,
                    "error_message":
                        email.error_message,
                },
            )
        )

    events.sort(
        key=lambda event: event.event_at,
        reverse=True,
    )

    return events
