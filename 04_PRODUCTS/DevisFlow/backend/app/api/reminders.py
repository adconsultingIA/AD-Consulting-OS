from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.models.database_models import (
    ClientDB,
    CreditNoteDB,
    InvoiceDB,
    InvoiceItemDB,
    PaymentDB,
    PaymentReminderDB,
    QuoteDB,
    RefundDB,
    RequestDB,
)

from app.models.document_email import (
    DocumentEmailDB,
)

from app.schemas.coreflow import (
    CoreCommercialContext,
)

from app.schemas.reminder import (
    PaymentReminderCockpitItem,
    PaymentReminderCreate,
    PaymentReminderResponse,
)

from app.services.coreflow_client import (
    get_commercial_context,
    get_devisflow_organization_id,
)

from app.services.email_service import (
    EmailAttachment,
    send_email,
)

from app.services.invoice_pdf_service import (
    generate_invoice_pdf,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["Payment reminders"],
)


def build_reminder_response(
    reminder: PaymentReminderDB,
) -> PaymentReminderResponse:
    return PaymentReminderResponse(
        id=UUID(reminder.id),
        invoice_id=UUID(reminder.invoice_id),
        reminder_date=reminder.reminder_date,
        channel=reminder.channel,
        subject=reminder.subject,
        message=reminder.message,
        created_at=reminder.created_at,
    )


def get_invoice_context(
    *,
    db: Session,
    invoice: InvoiceDB,
    organization_id: str,
):
    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id == invoice.quote_id,
            QuoteDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )

    request = (
        db.query(RequestDB)
        .filter(
            RequestDB.id == quote.request_id,
            RequestDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    client = (
        db.query(ClientDB)
        .filter(
            ClientDB.id == request.client_id,
            ClientDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    return quote, request, client


def get_invoice_commercial_context(
    invoice: InvoiceDB,
) -> CoreCommercialContext:
    if invoice.issuer_snapshot:
        return CoreCommercialContext.model_validate(
            invoice.issuer_snapshot
        )

    if not invoice.organization_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Invoice organization is required "
                "before sending a reminder"
            ),
        )

    try:
        commercial_context = (
            get_commercial_context(
                invoice.organization_id
            )
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "CoreFlow commercial context "
                "is unavailable. Reminder cannot "
                "be sent."
            ),
        ) from exc

    if not commercial_context:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Commercial context is required "
                "before sending a reminder"
            ),
        )

    return commercial_context


def schedule_next_payment_reminder(
    invoice: InvoiceDB,
    reminder_date,
) -> None:
    interval_days = int(
        invoice.reminder_interval_days
        or 7
    )

    if interval_days <= 0:
        interval_days = 7

    invoice.next_reminder_date = (
        reminder_date
        + timedelta(days=interval_days)
    )


@router.post(
    "/invoices/{invoice_id}/reminders",
    response_model=PaymentReminderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment_reminder(
    invoice_id: UUID,
    payload: PaymentReminderCreate,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id == str(invoice_id),
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    if invoice.status != "overdue":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Payment reminders can only be "
                "created for overdue invoices"
            ),
        )

    if Decimal(
        invoice.amount_due or 0
    ) <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Payment reminder cannot be created "
                "for an invoice with no amount due"
            ),
        )

    reminder_id = str(uuid4())

    # --------------------------------------------------------------
    # Non-email channels:
    # business trace only, no SMTP delivery.
    # --------------------------------------------------------------

    if payload.channel != "email":
        reminder = PaymentReminderDB(
            id=reminder_id,
            invoice_id=invoice.id,
            reminder_date=payload.reminder_date,
            channel=payload.channel,
            subject=payload.subject,
            message=payload.message,
        )

        db.add(reminder)

        schedule_next_payment_reminder(
            invoice,
            payload.reminder_date,
        )

        db.commit()
        db.refresh(reminder)

        return build_reminder_response(
            reminder
        )

    # --------------------------------------------------------------
    # Email reminder
    # --------------------------------------------------------------

    quote, request, client = (
        get_invoice_context(
            db=db,
            invoice=invoice,
            organization_id=organization_id,
        )
    )

    if not client.email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Client email is required "
                "before sending a reminder"
            ),
        )

    items = (
        db.query(InvoiceItemDB)
        .filter(
            InvoiceItemDB.invoice_id
            == invoice.id
        )
        .all()
    )

    if not items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Invoice must contain at least "
                "one item before sending a reminder"
            ),
        )

    payments = (
        db.query(PaymentDB)
        .filter(
            PaymentDB.invoice_id
            == invoice.id
        )
        .order_by(
            PaymentDB.payment_date.asc(),
            PaymentDB.created_at.asc(),
        )
        .all()
    )

    credit_notes = (
        db.query(CreditNoteDB)
        .filter(
            CreditNoteDB.invoice_id
            == invoice.id
        )
        .order_by(
            CreditNoteDB.issue_date.asc(),
            CreditNoteDB.created_at.asc(),
        )
        .all()
    )

    refunds = (
        db.query(RefundDB)
        .filter(
            RefundDB.invoice_id
            == invoice.id
        )
        .order_by(
            RefundDB.refund_date.asc(),
            RefundDB.created_at.asc(),
        )
        .all()
    )

    commercial_context = (
        get_invoice_commercial_context(
            invoice
        )
    )

    pdf_buffer = generate_invoice_pdf(
        invoice=invoice,
        client=client,
        request=request,
        quote=quote,
        items=items,
        payments=payments,
        credit_notes=credit_notes,
        refunds=refunds,
        commercial_context=(
            commercial_context
        ),
    )

    pdf_bytes = pdf_buffer.getvalue()

    subject = (
        payload.subject
        or (
            "Relance – facture "
            f"{invoice.invoice_number}"
        )
    )

    contact_name = (
        client.contact_name
        or client.company_name
        or "Madame, Monsieur"
    )

    if payload.message:
        body = (
            f"Bonjour {contact_name},\n\n"
            f"{payload.message.strip()}\n\n"
            "Vous trouverez à nouveau la facture "
            "concernée en pièce jointe.\n\n"
            "Cordialement"
        )
    else:
        body = (
            f"Bonjour {contact_name},\n\n"
            "Sauf erreur de notre part, la facture "
            f"{invoice.invoice_number} reste à ce "
            "jour en attente de règlement.\n\n"
            "Vous trouverez à nouveau la facture "
            "concernée en pièce jointe.\n\n"
            "Cordialement"
        )

    email_log = DocumentEmailDB(
        id=str(uuid4()),
        organization_id=(
            invoice.organization_id
        ),
        document_type="invoice_reminder",
        document_id=reminder_id,
        recipient=client.email,
        subject=subject,
        status="pending",
        provider="smtp",
    )

    db.add(email_log)
    db.commit()
    db.refresh(email_log)

    result = send_email(
        recipient=client.email,
        subject=subject,
        body=body,
        attachment=EmailAttachment(
            filename=(
                f"{invoice.invoice_number}.pdf"
            ),
            content=pdf_bytes,
            mime_type="application/pdf",
        ),
    )

    now = datetime.now()

    if not result.success:
        email_log.status = "failed"
        email_log.provider = result.provider
        email_log.error_message = (
            result.error_message
        )

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Reminder email delivery failed. "
                "The reminder was not recorded "
                "as completed."
            ),
        )

    reminder = PaymentReminderDB(
        id=reminder_id,
        invoice_id=invoice.id,
        reminder_date=payload.reminder_date,
        channel="email",
        subject=subject,
        message=payload.message,
    )

    db.add(reminder)

    schedule_next_payment_reminder(
        invoice,
        payload.reminder_date,
    )

    email_log.status = "sent"
    email_log.provider = result.provider
    email_log.provider_message_id = (
        result.provider_message_id
    )
    email_log.error_message = None
    email_log.sent_at = now

    db.commit()

    db.refresh(reminder)
    db.refresh(email_log)

    return build_reminder_response(
        reminder
    )


@router.get(
    "/reminders/cockpit",
    response_model=list[
        PaymentReminderCockpitItem
    ],
)
def get_payment_reminder_cockpit(
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    today = date.today()

    invoices = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.organization_id
            == organization_id,
            InvoiceDB.status.in_(
                [
                    "sent",
                    "partial",
                    "overdue",
                ]
            ),
            InvoiceDB.amount_due
            > Decimal("0"),
            InvoiceDB.due_date.isnot(None),
            InvoiceDB.due_date < today,
        )
        .order_by(
            InvoiceDB.due_date.asc(),
            InvoiceDB.invoice_number.asc(),
        )
        .all()
    )

    status_changed = False

    for invoice in invoices:
        if invoice.status in {
            "sent",
            "partial",
        }:
            invoice.status = "overdue"
            status_changed = True

    if status_changed:
        db.commit()

    rows: list[
        PaymentReminderCockpitItem
    ] = []

    for invoice in invoices:
        reminders = (
            db.query(PaymentReminderDB)
            .filter(
                PaymentReminderDB.invoice_id
                == invoice.id
            )
            .order_by(
                PaymentReminderDB
                .reminder_date.asc(),
                PaymentReminderDB
                .created_at.asc(),
            )
            .all()
        )

        reminder_count = len(reminders)

        last_reminder = (
            reminders[-1]
            if reminders
            else None
        )

        _, _, client = get_invoice_context(
            db=db,
            invoice=invoice,
            organization_id=organization_id,
        )

        next_reminder_date = (
            invoice.next_reminder_date
        )

        reminder_paused = bool(
            invoice.reminder_paused
        )

        if reminder_paused:
            cockpit_status = "paused"
            can_remind = False

        elif (
            next_reminder_date is None
            or next_reminder_date <= today
        ):
            cockpit_status = "due"
            can_remind = True

        else:
            cockpit_status = "upcoming"
            can_remind = False

        rows.append(
            PaymentReminderCockpitItem(
                invoice_id=UUID(
                    invoice.id
                ),
                invoice_number=(
                    invoice.invoice_number
                ),
                client_name=(
                    client.company_name
                    or "Client inconnu"
                ),
                due_date=invoice.due_date,
                amount_due=Decimal(
                    invoice.amount_due or 0
                ),
                last_reminder_date=(
                    last_reminder.reminder_date
                    if last_reminder
                    else None
                ),
                reminder_count=(
                    reminder_count
                ),
                next_reminder_date=(
                    next_reminder_date
                ),
                reminder_interval_days=(
                    invoice.reminder_interval_days
                    or 7
                ),
                reminder_paused=(
                    reminder_paused
                ),
                status=cockpit_status,
                can_remind=can_remind,
            )
        )

    return rows


@router.get(
    "/reminders/counts",
    response_model=dict[str, int],
)
def get_payment_reminder_counts(
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    rows = (
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

    return {
        invoice_id: int(count)
        for invoice_id, count in rows
    }


@router.get(
    "/invoices/{invoice_id}/reminders",
    response_model=list[PaymentReminderResponse],
)
def list_payment_reminders(
    invoice_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id == str(invoice_id),
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    reminders = (
        db.query(PaymentReminderDB)
        .filter(
            PaymentReminderDB.invoice_id
            == invoice.id
        )
        .order_by(
            PaymentReminderDB.reminder_date.asc(),
            PaymentReminderDB.created_at.asc(),
        )
        .all()
    )

    return [
        build_reminder_response(reminder)
        for reminder in reminders
    ]
