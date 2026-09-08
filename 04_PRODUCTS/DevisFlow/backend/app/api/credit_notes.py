from datetime import date
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
    CreditNoteDB,
    InvoiceDB,
)

from app.schemas.credit_note import (
    CreditNoteCreate,
    CreditNoteResponse,
)


from app.services.document_number_service import next_document_number
from app.services.coreflow_client import (
    get_devisflow_organization_id,
)

router = APIRouter(
    prefix="/api/v1",
    tags=["Credit notes"],
)


def build_credit_note_response(
    credit_note: CreditNoteDB,
) -> CreditNoteResponse:
    return CreditNoteResponse(
        id=UUID(credit_note.id),
        invoice_id=UUID(credit_note.invoice_id),

        credit_note_number=credit_note.credit_note_number,

        issue_date=credit_note.issue_date,
        reason=credit_note.reason,
        amount=Decimal(credit_note.amount),

        status=credit_note.status,

        notes=credit_note.notes,

        created_at=credit_note.created_at,
    )


def generate_credit_note_number(
    db: Session,
) -> str:
    year = date.today().year

    return next_document_number(
        db,
        document_type="credit_note",
        prefix="AVO",
        table_name="credit_notes",
        column_name="credit_note_number",
        year=year,
    )

@router.post(
    "/invoices/{invoice_id}/credit-notes",
    response_model=CreditNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_credit_note(
    invoice_id: UUID,
    payload: CreditNoteCreate,
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

    if invoice.status in {
        "draft",
        "cancelled",
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A credit note cannot be created "
                "for a draft or cancelled invoice"
            ),
        )

    existing_credit_total = (
        db.query(CreditNoteDB)
        .filter(
            CreditNoteDB.invoice_id == invoice.id
        )
        .all()
    )

    total_already_credited = sum(
        (
            Decimal(credit.amount)
            for credit in existing_credit_total
        ),
        Decimal("0"),
    )

    invoice_total = Decimal(invoice.total)
    new_credit_amount = Decimal(payload.amount)

    remaining_creditable_amount = (
        invoice_total
        - total_already_credited
    )

    if (
        new_credit_amount
        > remaining_creditable_amount
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Credit note amount cannot exceed "
                "the remaining creditable amount"
            ),
        )

    credit_note = CreditNoteDB(
        id=str(uuid4()),
        invoice_id=invoice.id,

        credit_note_number=
            generate_credit_note_number(db),

        issue_date=payload.issue_date,
        reason=payload.reason,
        amount=new_credit_amount,

        status="issued",

        notes=payload.notes,
    )

    db.add(credit_note)
    new_credit_total = (
        total_already_credited
        + new_credit_amount
        )

    net_total = (
        invoice_total
        - new_credit_total
    )

    amount_paid = Decimal(
        invoice.amount_paid or 0
    )

    amount_due = max(
        net_total - amount_paid,
        Decimal("0"),
    )

    customer_credit = max(
        amount_paid - net_total,
        Decimal("0"),
    )


    invoice.credit_total = (
        new_credit_total
    )

    invoice.net_total = (
        net_total
    )

    invoice.amount_due = (
        amount_due
    )

    invoice.customer_credit = (
        customer_credit
    )


    if amount_due == Decimal("0"):
        invoice.status = "paid"

    elif invoice.status == "overdue":
        # Un avoir réduit la dette,
        # mais ne supprime pas le retard
        # tant qu'un solde reste dû.
        invoice.status = "overdue"

    elif amount_paid > Decimal("0"):
        invoice.status = "partial"

    db.commit()
    db.refresh(credit_note)

    return build_credit_note_response(
        credit_note
    )


@router.get(
    "/invoices/{invoice_id}/credit-notes",
    response_model=list[CreditNoteResponse],
)
def list_credit_notes(
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

    credit_notes = (
        db.query(CreditNoteDB)
        .filter(
            CreditNoteDB.invoice_id == invoice.id
        )
        .order_by(
            CreditNoteDB.issue_date.asc(),
            CreditNoteDB.created_at.asc(),
        )
        .all()
    )

    return [
        build_credit_note_response(
            credit_note
        )
        for credit_note in credit_notes
    ]
