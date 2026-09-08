from decimal import Decimal
from uuid import uuid4

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
    RefundDB,
)
from app.schemas.refund import (
    RefundCreate,
    RefundResponse,
)
from app.services.coreflow_client import (
    get_devisflow_organization_id,
)


router = APIRouter(
    prefix="/api/v1",
    tags=["refunds"],
)


@router.get(
    "/invoices/{invoice_id}/refunds",
    response_model=list[RefundResponse],
)
def get_invoice_refunds(
    invoice_id: str,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id == invoice_id,
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    return (
        db.query(RefundDB)
        .filter(
            RefundDB.invoice_id
            == invoice_id
        )
        .order_by(
            RefundDB.refund_date.asc(),
            RefundDB.created_at.asc(),
        )
        .all()
    )


@router.post(
    "/invoices/{invoice_id}/refunds",
    response_model=RefundResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_refund(
    invoice_id: str,
    payload: RefundCreate,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id == invoice_id,
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    customer_credit = Decimal(
        invoice.customer_credit or 0
    )

    refund_amount = Decimal(
        payload.amount
    )

    if customer_credit <= Decimal("0"):
        raise HTTPException(
            status_code=409,
            detail=(
                "This invoice has no customer "
                "credit available for refund"
            ),
        )

    if refund_amount > customer_credit:
        raise HTTPException(
            status_code=409,
            detail=(
                "Refund amount cannot exceed "
                "available customer credit"
            ),
        )

    refund = RefundDB(
        id=str(uuid4()),
        invoice_id=invoice.id,
        amount=refund_amount,
        refund_date=payload.refund_date,
        refund_method=payload.refund_method,
        reference=payload.reference,
        notes=payload.notes,
    )

    db.add(refund)

    current_refunded_total = Decimal(
        invoice.refunded_total or 0
    )

    new_refunded_total = (
        current_refunded_total
        + refund_amount
    )

    amount_paid = Decimal(
        invoice.amount_paid or 0
    )

    net_total = Decimal(
        invoice.net_total
        or invoice.total
        or 0
    )

    customer_credit_after_refund = max(
        amount_paid
        - net_total
        - new_refunded_total,
        Decimal("0"),
    )

    invoice.refunded_total = (
        new_refunded_total
    )

    invoice.customer_credit = (
        customer_credit_after_refund
    )

    db.commit()
    db.refresh(refund)

    return refund
