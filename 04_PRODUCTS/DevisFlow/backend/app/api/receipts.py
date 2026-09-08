from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.models.database_models import (
    ClientDB,
    InvoiceDB,
    PaymentDB,
    QuoteDB,
    ReceiptDB,
    RequestDB,
)

from app.models.document_email import (
    DocumentEmailDB,
)

from app.schemas.coreflow import (
    CoreCommercialContext,
)

from app.services.coreflow_client import (
    get_commercial_context,
    get_devisflow_organization_id,
)

from app.services.email_service import (
    EmailAttachment,
    send_email,
)

from app.services.receipt_pdf_service import (
    generate_receipt_pdf,
)


router = APIRouter(
    prefix="/api/v1/receipts",
    tags=["Receipts"],
)


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

def serialize_receipt(
    receipt: ReceiptDB,
    db: Session,
    organization_id: str,
):
    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id ==
            receipt.invoice_id,
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    payment = (
        db.query(PaymentDB)
        .filter(
            PaymentDB.id ==
            receipt.payment_id
        )
        .first()
    )

    return {
        "id": receipt.id,
        "payment_id": receipt.payment_id,
        "invoice_id": receipt.invoice_id,
        "invoice_number": (
            invoice.invoice_number
            if invoice
            else None
        ),
        "organization_id":
            receipt.organization_id,
        "receipt_number":
            receipt.receipt_number,
        "issue_date":
            receipt.issue_date,
        "amount":
            receipt.amount,
        "cumulative_paid":
            receipt.cumulative_paid,
        "remaining_due":
            receipt.remaining_due,
        "payment_method":
            receipt.payment_method,
        "payment_reference":
            receipt.payment_reference,
        "payment_date": (
            payment.payment_date
            if payment
            else None
        ),
        "status":
            receipt.status,
        "sent_at":
            receipt.sent_at,
        "created_at":
            receipt.created_at,
    }


def get_receipt_or_404(
    receipt_id: UUID,
    db: Session,
    organization_id: str,
) -> ReceiptDB:
    receipt = (
        db.query(ReceiptDB)
        .filter(
            ReceiptDB.id ==
            str(receipt_id),
            ReceiptDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not receipt:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail="Receipt not found",
        )

    return receipt


def resolve_receipt_context(
    receipt: ReceiptDB,
    db: Session,
    organization_id: str,
):
    payment = (
        db.query(PaymentDB)
        .filter(
            PaymentDB.id ==
            receipt.payment_id
        )
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id ==
            receipt.invoice_id,
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id ==
            invoice.quote_id,
            QuoteDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not quote:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )

    request = (
        db.query(RequestDB)
        .filter(
            RequestDB.id ==
            quote.request_id,
            RequestDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    client = (
        db.query(ClientDB)
        .filter(
            ClientDB.id ==
            request.client_id,
            ClientDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    return (
        payment,
        invoice,
        quote,
        request,
        client,
    )


def resolve_commercial_context(
    receipt: ReceiptDB,
):
    if receipt.issuer_snapshot:
        return (
            CoreCommercialContext
            .model_validate(
                receipt.issuer_snapshot
            )
        )

    if not receipt.organization_id:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Organization is required "
                "to resolve commercial context"
            ),
        )

    try:
        return get_commercial_context(
            receipt.organization_id
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "CoreFlow commercial context "
                "is unavailable."
            ),
        ) from exc


# ---------------------------------------------------------------------
# LIST RECEIPTS
# ---------------------------------------------------------------------

@router.get("")
def list_receipts(
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    receipts = (
        db.query(ReceiptDB)
        .filter(
            ReceiptDB.organization_id
            == organization_id
        )
        .order_by(
            ReceiptDB.issue_date.desc(),
            ReceiptDB.created_at.desc(),
        )
        .all()
    )

    return [
        serialize_receipt(
            receipt,
            db,
            organization_id,
        )
        for receipt in receipts
    ]


# ---------------------------------------------------------------------
# GET RECEIPT
# ---------------------------------------------------------------------

@router.get(
    "/{receipt_id}"
)
def get_receipt(
    receipt_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    receipt = get_receipt_or_404(
        receipt_id,
        db,
        organization_id,
    )

    return serialize_receipt(
        receipt,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------

@router.get(
    "/{receipt_id}/pdf"
)
def download_receipt_pdf(
    receipt_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    receipt = get_receipt_or_404(
        receipt_id,
        db,
        organization_id,
    )

    (
        payment,
        invoice,
        quote,
        request,
        client,
    ) = resolve_receipt_context(
        receipt,
        db,
        organization_id,
    )

    commercial_context = (
        resolve_commercial_context(
            receipt
        )
    )

    if not commercial_context:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Commercial context is "
                "required to generate receipt"
            ),
        )

    pdf_buffer = generate_receipt_pdf(
        receipt=receipt,
        payment=payment,
        invoice=invoice,
        quote=quote,
        request=request,
        client=client,
        commercial_context=
            commercial_context,
    )

    filename = (
        f"{receipt.receipt_number}.pdf"
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                f'inline; filename="{filename}"'
        },
    )


# ---------------------------------------------------------------------
# SEND RECEIPT
# ---------------------------------------------------------------------

@router.post(
    "/{receipt_id}/send"
)
def send_receipt(
    receipt_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    receipt = get_receipt_or_404(
        receipt_id,
        db,
        organization_id,
    )

    if receipt.status != "issued":
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Only an issued receipt "
                "can be sent"
            ),
        )

    (
        payment,
        invoice,
        quote,
        request,
        client,
    ) = resolve_receipt_context(
        receipt,
        db,
        organization_id,
    )

    if not client.email:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Client email is required "
                "before sending"
            ),
        )

    commercial_context = (
        resolve_commercial_context(
            receipt
        )
    )

    if not commercial_context:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Commercial context is "
                "required before sending"
            ),
        )

    pdf_buffer = generate_receipt_pdf(
        receipt=receipt,
        payment=payment,
        invoice=invoice,
        quote=quote,
        request=request,
        client=client,
        commercial_context=
            commercial_context,
    )

    pdf_bytes = (
        pdf_buffer.getvalue()
    )

    subject = (
        f"Reçu de paiement "
        f"{receipt.receipt_number}"
    )

    contact_name = (
        client.contact_name
        or client.company_name
        or "Madame, Monsieur"
    )

    if Decimal(
        receipt.remaining_due or 0
    ) == Decimal("0"):
        situation_text = (
            "La facture est désormais "
            "intégralement acquittée."
        )
    else:
        situation_text = (
            "Le reçu indique également "
            "le solde restant à payer."
        )

    body = (
        f"Bonjour {contact_name},\n\n"
        "Nous vous confirmons la réception "
        "de votre paiement relatif à la "
        f"facture {invoice.invoice_number}.\n\n"
        "Veuillez trouver en pièce jointe "
        f"le reçu {receipt.receipt_number}.\n\n"
        f"{situation_text}\n\n"
        "Nous restons à votre disposition "
        "pour toute question.\n\n"
        "Cordialement"
    )

    email_log = DocumentEmailDB(
        id=str(uuid4()),
        organization_id=
            receipt.organization_id,
        document_type="receipt",
        document_id=receipt.id,
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
                f"{receipt.receipt_number}.pdf"
            ),
            content=pdf_bytes,
            mime_type="application/pdf",
        ),
    )

    now = datetime.now()

    if not result.success:
        email_log.status = "failed"
        email_log.provider = (
            result.provider
        )
        email_log.error_message = (
            result.error_message
        )

        db.commit()

        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Email delivery failed. "
                "Receipt status was not changed."
            ),
        )

    email_log.status = "sent"
    email_log.provider = (
        result.provider
    )
    email_log.provider_message_id = (
        result.provider_message_id
    )
    email_log.error_message = None
    email_log.sent_at = now

    receipt.status = "sent"
    receipt.sent_at = now

    db.commit()

    db.refresh(email_log)
    db.refresh(receipt)

    return serialize_receipt(
        receipt,
        db,
        organization_id,
    )
