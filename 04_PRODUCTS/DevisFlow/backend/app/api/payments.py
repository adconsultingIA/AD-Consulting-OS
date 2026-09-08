from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.core.database import get_db

from app.models.database_models import (
    InvoiceDB,
    PaymentDB,
    ReceiptDB,
)

from app.schemas.payment import (
    PaymentCreate,
    PaymentResponse,
)

from app.services.document_number_service import (
    next_document_number,
)
from app.services.coreflow_client import (
    get_devisflow_organization_id,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["Payments"],
)


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

def build_payment_response(
    payment: PaymentDB,
) -> PaymentResponse:
    return PaymentResponse(
        id=UUID(payment.id),
        invoice_id=UUID(payment.invoice_id),

        amount=Decimal(payment.amount),
        payment_date=payment.payment_date,

        payment_method=payment.payment_method,
        reference=payment.reference,
        notes=payment.notes,

        created_at=payment.created_at,
    )


# ---------------------------------------------------------------------
# ADD PAYMENT TO INVOICE
# ---------------------------------------------------------------------

@router.post(
    "/invoices/{invoice_id}/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment(
    invoice_id: UUID,
    payload: PaymentCreate,
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

    if invoice.status not in {
        "sent",
        "partial",
        "overdue",
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Payments can only be recorded "
                "for sent, partial or overdue invoices"
            ),
        )

    payment_amount = Decimal(payload.amount)
    amount_due = Decimal(invoice.amount_due)

    if payment_amount > amount_due:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Payment amount cannot exceed "
                "the remaining amount due"
            ),
        )

    payment = PaymentDB(
        id=str(uuid4()),
        invoice_id=invoice.id,

        amount=payment_amount,
        payment_date=payload.payment_date,

        payment_method=payload.payment_method,
        reference=payload.reference,
        notes=payload.notes,
    )

    db.add(payment)

    invoice.amount_paid = (
        Decimal(invoice.amount_paid)
        + payment_amount
    )

    net_total = Decimal(
        invoice.net_total or invoice.total
    )

    invoice.amount_due = max(
        net_total - Decimal(invoice.amount_paid),
        Decimal("0"),
    )

    invoice.customer_credit = max(
        Decimal(invoice.amount_paid) - net_total,
        Decimal("0"),
    )

    if Decimal(invoice.amount_due) == Decimal("0.00"):
        invoice.status = "paid"
    else:
        invoice.status = "partial"

    # ---------------------------------------------------------
    # AUTOMATIC PAYMENT RECEIPT
    # ---------------------------------------------------------

    receipt_number = next_document_number(
        db,
        document_type="receipt",
        prefix="REC",
        table_name="receipts",
        column_name="receipt_number",
        year=payload.payment_date.year,
    )

    receipt = ReceiptDB(
        id=str(uuid4()),
        payment_id=payment.id,
        invoice_id=invoice.id,
        organization_id=invoice.organization_id,
        receipt_number=receipt_number,
        issue_date=payload.payment_date,
        amount=payment_amount,
        cumulative_paid=Decimal(
            invoice.amount_paid
        ),
        remaining_due=Decimal(
            invoice.amount_due
        ),
        payment_method=payload.payment_method,
        payment_reference=payload.reference,
        issuer_snapshot=invoice.issuer_snapshot,
        status="issued",
    )

    db.add(receipt)

    db.commit()
    db.refresh(payment)
    db.refresh(invoice)

    return build_payment_response(payment)


# ---------------------------------------------------------------------
# LIST PAYMENTS FOR AN INVOICE
# ---------------------------------------------------------------------

@router.get(
    "/invoices/{invoice_id}/payments",
    response_model=list[PaymentResponse],
)
def list_invoice_payments(
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

    payments = (
        db.query(PaymentDB)
        .filter(
            PaymentDB.invoice_id
            == invoice.id
        )
        .order_by(
            PaymentDB.payment_date.desc(),
            PaymentDB.created_at.desc(),
        )
        .all()
    )

    return [
        build_payment_response(payment)
        for payment in payments
    ]
