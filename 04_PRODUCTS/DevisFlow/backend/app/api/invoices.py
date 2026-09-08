from datetime import date, datetime
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
    CreditNoteDB,
    InvoiceDB,
    InvoiceItemDB,
    PaymentDB,
    PaymentReminderDB,
    QuoteDB,
    QuoteItemDB,
    RefundDB,
    RequestDB,
)

from app.schemas.invoice import (
    InvoiceCreateFromQuote,
    InvoiceItemResponse,
    InvoiceResponse,
    InvoiceStatusUpdate,
    InvoiceUpdate,
)

from app.schemas.coreflow import (
    CoreCommercialContext,
)

from app.services.invoice_pdf_service import (
    generate_invoice_pdf,
)

from app.services.quote_acceptance_service import (
    ensure_quote_acceptance_is_valid,
)

from app.services.coreflow_client import (
    get_commercial_context,
    get_payment_preferences,
)

from app.core.devisflow_context import (
    get_devisflow_context,
)


from app.services.document_number_service import next_document_number
from app.models.document_email import DocumentEmailDB
from app.services.email_service import (
    EmailAttachment,
    send_email,
)

router = APIRouter(
    prefix="/api/v1/invoices",
    tags=["Invoices"],
)


# ---------------------------------------------------------------------
# STATUS TRANSITIONS
# ---------------------------------------------------------------------

ALLOWED_STATUS_TRANSITIONS = {
    "draft": {
        "issued",
        "cancelled",
    },
    "issued": {
        "cancelled",
    },
    "sent": {
        "overdue",
        "cancelled",
    },
    "partial": {
        "overdue",
    },
    "overdue": set(),
    "paid": set(),
    "cancelled": set(),
}

# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

def apply_overdue_status(
    invoice: InvoiceDB,
) -> bool:
    """
    Passe automatiquement une facture à overdue
    uniquement lorsqu'elle est déjà dans le cycle
    de recouvrement et qu'un solde reste dû.
    """

    eligible_statuses = {
        "sent",
        "partial",
    }

    if invoice.status not in eligible_statuses:
        return False

    if not invoice.due_date:
        return False

    if invoice.due_date >= date.today():
        return False

    if Decimal(
        invoice.amount_due or 0
    ) <= Decimal("0"):
        return False

    invoice.status = "overdue"
    return True

def generate_invoice_number(
    db: Session,
) -> str:
    year = date.today().year

    return next_document_number(
        db,
        document_type="invoice",
        prefix="FAC",
        table_name="invoices",
        column_name="invoice_number",
        year=year,
    )

def get_invoice_items(
    db: Session,
    invoice_id: str,
) -> list[InvoiceItemResponse]:
    items = (
        db.query(InvoiceItemDB)
        .filter(
            InvoiceItemDB.invoice_id
            == invoice_id
        )
        .all()
    )

    return [
        InvoiceItemResponse(
            id=UUID(item.id),
            description=item.description,
            quantity=Decimal(
                item.quantity
            ),
            unit_price=Decimal(
                item.unit_price
            ),
            vat_rate=Decimal(
                item.vat_rate
            ),
            tax_type=item.tax_type,
            tax_treatment=(
                item.tax_treatment
            ),
            tax_reason=item.tax_reason,
            requires_manual_review=(
                bool(
                    item.requires_manual_review
                )
            ),
            subtotal=Decimal(
                item.subtotal
            ),
            vat_amount=Decimal(
                item.vat_amount
            ),
            total=Decimal(
                item.total
            ),
        )
        for item in items
    ]


def build_invoice_response(
    db: Session,
    invoice: InvoiceDB,
) -> InvoiceResponse:
    return InvoiceResponse(
        id=UUID(invoice.id),
        quote_id=UUID(
            invoice.quote_id
        ),
        organization_id=(
            UUID(invoice.organization_id)
            if invoice.organization_id
            else None
        ),
        recurring_invoice_id=(
            UUID(invoice.recurring_invoice_id)
            if invoice.recurring_invoice_id
            else None
        ),
        invoice_number=(
            invoice.invoice_number
        ),
        status=invoice.status,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        payment_terms=(
            invoice.payment_terms
        ),
        payment_method=(
            invoice.payment_method
        ),
        payment_terms_days=(
            invoice.payment_terms_days
        ),
        next_reminder_date=(
            invoice.next_reminder_date
        ),
        reminder_interval_days=(
            invoice.reminder_interval_days
            or 7
        ),
        reminder_paused=bool(
            invoice.reminder_paused
        ),
        notes=invoice.notes,
        items=get_invoice_items(
            db,
            invoice.id,
        ),
        subtotal=Decimal(
            invoice.subtotal or 0
        ),
        vat_amount=Decimal(
            invoice.vat_amount or 0
        ),
        total=Decimal(
            invoice.total or 0
        ),
        amount_paid=Decimal(
            invoice.amount_paid or 0
        ),
        amount_due=Decimal(
            invoice.amount_due or 0
        ),
        credit_total=Decimal(
            invoice.credit_total or 0
        ),
        net_total=Decimal(
            invoice.net_total
            or invoice.total
            or 0
        ),
        customer_credit=Decimal(
            invoice.customer_credit or 0
        ),
        refunded_total=Decimal(
            invoice.refunded_total or 0
        ),
        created_at=(
            invoice.created_at
        ),
        updated_at=(
            invoice.updated_at
        ),
    )


def get_quote_billing_progress(
    db: Session,
    quote_id: str,
    quote_total: Decimal,
    organization_id: str,
) -> tuple[Decimal, Decimal, int]:
    invoices = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.quote_id == quote_id,
            InvoiceDB.organization_id
            == organization_id,
            InvoiceDB.status != "cancelled",
            InvoiceDB.recurring_invoice_id.is_(None),
        )
        .all()
    )

    billed_total = sum(
        (
            Decimal(
                str(invoice.total or 0)
            )
            for invoice in invoices
        ),
        Decimal("0.00"),
    )

    remaining = (
        quote_total - billed_total
    )

    if remaining < Decimal("0.00"):
        remaining = Decimal("0.00")

    sequence = (
        max(
            (
                invoice.billing_sequence or 0
                for invoice in invoices
            ),
            default=0,
        )
        + 1
    )

    return (
        billed_total,
        remaining,
        sequence,
    )


def prorate_amount(
    amount: Decimal,
    percentage: Decimal,
) -> Decimal:
    return (
        amount
        * percentage
        / Decimal("100")
    ).quantize(
        Decimal("0.01")
    )


# ---------------------------------------------------------------------
# CREATE FROM ACCEPTED QUOTE
# ---------------------------------------------------------------------

@router.post(
    "/from-quote/{quote_id}",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_from_quote(
    quote_id: UUID,
    payload: InvoiceCreateFromQuote | None = None,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    if payload is None:
        payload = InvoiceCreateFromQuote()

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id == str(quote_id),
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

    if quote.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only an accepted quote "
                "can be invoiced"
            ),
        )

    ensure_quote_acceptance_is_valid(
        quote
    )

    quote_items = (
        db.query(QuoteItemDB)
        .filter(
            QuoteItemDB.quote_id == quote.id
        )
        .all()
    )

    if not quote_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The quote has no items",
        )

    quote_total = Decimal(
        str(quote.total or 0)
    )

    if quote_total <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Quote total must be positive "
                "before invoicing"
            ),
        )

    (
        billed_total,
        remaining_to_bill,
        billing_sequence,
    ) = get_quote_billing_progress(
        db=db,
        quote_id=quote.id,
        quote_total=quote_total,
        organization_id=organization_id,
    )

    if remaining_to_bill <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This quote is already fully invoiced"
            ),
        )

    invoice_type = payload.invoice_type

    if invoice_type == "standard":
        if billed_total > Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A standard invoice cannot be "
                    "created after progressive "
                    "invoicing has started"
                ),
            )

        billing_percentage = Decimal(
            "100.0000"
        )

    elif invoice_type == "deposit":
        if payload.billing_percentage is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "billing_percentage is required "
                    "for a deposit invoice"
                ),
            )

        billing_percentage = Decimal(
            str(payload.billing_percentage)
        )

        requested_amount = prorate_amount(
            quote_total,
            billing_percentage,
        )

        if requested_amount > remaining_to_bill:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Deposit amount exceeds the "
                    "remaining amount to invoice"
                ),
            )

    elif invoice_type == "balance":
        if billed_total <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A balance invoice requires "
                    "previous invoicing"
                ),
            )

        billing_percentage = (
            (
                remaining_to_bill
                / quote_total
            )
            * Decimal("100")
        ).quantize(
            Decimal("0.0001")
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported invoice type",
        )

    payment_preferences = None

    if quote.organization_id:
        try:
            payment_preferences = (
                get_payment_preferences(
                    quote.organization_id
                )
            )
        except RuntimeError:
            payment_preferences = None

    # ---------------------------------------------------------------
    # Existing progressive invoice lines by original quote line.
    # Needed especially to calculate the exact final balance.
    # ---------------------------------------------------------------

    previous_rows = (
        db.query(
            InvoiceItemDB,
            InvoiceDB,
        )
        .join(
            InvoiceDB,
            InvoiceItemDB.invoice_id
            == InvoiceDB.id,
        )
        .filter(
            InvoiceDB.quote_id == quote.id,
            InvoiceDB.organization_id
            == organization_id,
            InvoiceDB.status != "cancelled",
            InvoiceDB.recurring_invoice_id.is_(None),
            InvoiceItemDB.quote_item_id
            .isnot(None),
        )
        .all()
    )

    previously_billed_by_item: dict[
        str,
        dict[str, Decimal],
    ] = {}

    for previous_item, _invoice in previous_rows:
        key = str(
            previous_item.quote_item_id
        )

        current = (
            previously_billed_by_item
            .setdefault(
                key,
                {
                    "subtotal": Decimal("0.00"),
                    "vat_amount": Decimal("0.00"),
                    "total": Decimal("0.00"),
                },
            )
        )

        current["subtotal"] += Decimal(
            str(previous_item.subtotal or 0)
        )
        current["vat_amount"] += Decimal(
            str(previous_item.vat_amount or 0)
        )
        current["total"] += Decimal(
            str(previous_item.total or 0)
        )

    prepared_items: list[dict] = []

    for quote_item in quote_items:
        quote_item_subtotal = Decimal(
            str(quote_item.subtotal or 0)
        )
        quote_item_vat = Decimal(
            str(quote_item.vat_amount or 0)
        )
        quote_item_total = Decimal(
            str(quote_item.total or 0)
        )

        if invoice_type == "balance":
            previous = (
                previously_billed_by_item.get(
                    str(quote_item.id),
                    {
                        "subtotal": Decimal("0.00"),
                        "vat_amount": Decimal("0.00"),
                        "total": Decimal("0.00"),
                    },
                )
            )

            item_subtotal = (
                quote_item_subtotal
                - previous["subtotal"]
            ).quantize(
                Decimal("0.01")
            )

            item_vat = (
                quote_item_vat
                - previous["vat_amount"]
            ).quantize(
                Decimal("0.01")
            )

            item_total = (
                quote_item_total
                - previous["total"]
            ).quantize(
                Decimal("0.01")
            )

        else:
            item_subtotal = prorate_amount(
                quote_item_subtotal,
                billing_percentage,
            )

            item_vat = prorate_amount(
                quote_item_vat,
                billing_percentage,
            )

            item_total = prorate_amount(
                quote_item_total,
                billing_percentage,
            )

        if item_total <= Decimal("0.00"):
            continue

        quantity = Decimal(
            str(quote_item.quantity or 0)
        )

        if quantity > Decimal("0.00"):
            unit_price = (
                item_subtotal / quantity
            ).quantize(
                Decimal("0.01")
            )
        else:
            unit_price = Decimal("0.00")

        prepared_items.append(
            {
                "quote_item": quote_item,
                "quantity": quantity,
                "unit_price": unit_price,
                "subtotal": item_subtotal,
                "vat_amount": item_vat,
                "total": item_total,
            }
        )

    if not prepared_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No remaining invoiceable items"
            ),
        )

    invoice_subtotal = sum(
        (
            item["subtotal"]
            for item in prepared_items
        ),
        Decimal("0.00"),
    )

    invoice_vat = sum(
        (
            item["vat_amount"]
            for item in prepared_items
        ),
        Decimal("0.00"),
    )

    invoice_total = sum(
        (
            item["total"]
            for item in prepared_items
        ),
        Decimal("0.00"),
    )

    if invoice_total > remaining_to_bill:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Calculated invoice amount exceeds "
                "the remaining amount to invoice"
            ),
        )

    invoice = InvoiceDB(
        id=str(uuid4()),
        quote_id=quote.id,
        organization_id=organization_id,
        invoice_number=(
            generate_invoice_number(db)
        ),
        status="draft",
        invoice_type=invoice_type,
        billing_percentage=(
            billing_percentage
        ),
        billing_sequence=(
            billing_sequence
        ),
        issue_date=None,
        due_date=None,
        payment_terms=(
            payment_preferences
            .payment_instructions
            if payment_preferences
            else None
        ),
        payment_method=(
            payment_preferences
            .default_payment_method
            if payment_preferences
            else None
        ),
        payment_terms_days=(
            payment_preferences
            .default_payment_terms_days
            if payment_preferences
            else None
        ),
        notes=quote.notes,
        subtotal=invoice_subtotal,
        vat_amount=invoice_vat,
        total=invoice_total,
        amount_paid=Decimal("0.00"),
        amount_due=invoice_total,
        credit_total=Decimal("0.00"),
        net_total=invoice_total,
        customer_credit=Decimal("0.00"),
        refunded_total=Decimal("0.00"),
    )

    db.add(invoice)
    db.flush()

    for prepared in prepared_items:
        quote_item = prepared[
            "quote_item"
        ]

        invoice_item = InvoiceItemDB(
            id=str(uuid4()),
            invoice_id=invoice.id,
            quote_item_id=quote_item.id,
            description=quote_item.description,
            quantity=prepared["quantity"],
            unit_price=prepared["unit_price"],
            vat_rate=quote_item.vat_rate,
            tax_type=quote_item.tax_type,
            tax_treatment=(
                quote_item.tax_treatment
            ),
            tax_reason=quote_item.tax_reason,
            requires_manual_review=(
                quote_item
                .requires_manual_review
            ),
            subtotal=prepared["subtotal"],
            vat_amount=(
                prepared["vat_amount"]
            ),
            total=prepared["total"],
        )

        db.add(invoice_item)

    db.commit()
    db.refresh(invoice)

    return build_invoice_response(
        db,
        invoice,
    )


# ---------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------

@router.get(
    "",
    response_model=(
        list[InvoiceResponse]
    ),
)
def list_invoices(
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    invoices = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .order_by(
            InvoiceDB.created_at.desc()
        )
        .all()
    )

    status_changed = False

    for invoice in invoices:
        if apply_overdue_status(
            invoice
        ):
            status_changed = True

    if status_changed:
        db.commit()

    return [
        build_invoice_response(
            db,
            invoice,
        )
        for invoice in invoices
    ]


# ---------------------------------------------------------------------
# GET ONE
# ---------------------------------------------------------------------

@router.get(
    "/{invoice_id}",
    response_model=InvoiceResponse,
)
def get_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id
            == str(invoice_id),
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Invoice not found",
        )

    if apply_overdue_status(
        invoice
    ):
        db.commit()
        db.refresh(invoice)

    return build_invoice_response(
        db,
        invoice,
    )


# ---------------------------------------------------------------------
# UPDATE DRAFT
# ---------------------------------------------------------------------

@router.patch(
    "/{invoice_id}",
    response_model=InvoiceResponse,
)
def update_invoice(
    invoice_id: UUID,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id
            == str(invoice_id),
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Invoice not found",
        )

    if invoice.status != "draft":
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Only draft invoices "
                "can be modified"
            ),
        )

    if (
        payload.issue_date
        is not None
    ):
        invoice.issue_date = (
            payload.issue_date
        )

    if (
        payload.due_date
        is not None
    ):
        invoice.due_date = (
            payload.due_date
        )

    if (
        payload.payment_terms
        is not None
    ):
        invoice.payment_terms = (
            payload.payment_terms
        )

    if payload.notes is not None:
        invoice.notes = payload.notes

    invoice.updated_at = (
        datetime.now()
    )

    db.commit()
    db.refresh(invoice)

    return build_invoice_response(
        db,
        invoice,
    )


# ---------------------------------------------------------------------
# STATUS
# ---------------------------------------------------------------------

@router.patch(
    "/{invoice_id}/status",
    response_model=InvoiceResponse,
)
def update_invoice_status(
    invoice_id: UUID,
    payload: InvoiceStatusUpdate,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id
            == str(invoice_id),
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Invoice not found",
        )

    current_status = (
        invoice.status
    )

    new_status = (
        payload.status
    )

    allowed = (
        ALLOWED_STATUS_TRANSITIONS.get(
            current_status,
            set(),
        )
    )

    if new_status not in allowed:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Invalid invoice status "
                f"transition: "
                f"{current_status} -> "
                f"{new_status}"
            ),
        )

    # -------------------------------------------------------------
    # VALIDATION BEFORE ISSUE
    # -------------------------------------------------------------

    if new_status == "issued":
        if not invoice.issue_date:
            raise HTTPException(
                status_code=(
                    status.HTTP_409_CONFLICT
                ),
                detail=(
                    "Invoice issue date "
                    "is required before "
                    "issuing"
                ),
            )

        if not invoice.due_date:
            raise HTTPException(
                status_code=(
                    status.HTTP_409_CONFLICT
                ),
                detail=(
                    "Invoice due date "
                    "is required before "
                    "issuing"
                ),
            )

        if (
            Decimal(
                invoice.total or 0
            )
            <= Decimal("0")
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_409_CONFLICT
                ),
                detail=(
                    "Invoice total must "
                    "be greater than zero "
                    "before issuing"
                ),
            )

        invoice_items_count = (
            db.query(InvoiceItemDB)
            .filter(
                InvoiceItemDB.invoice_id
                == invoice.id
            )
            .count()
        )

        if invoice_items_count == 0:
            raise HTTPException(
                status_code=(
                    status.HTTP_409_CONFLICT
                ),
                detail=(
                    "Invoice must contain "
                    "at least one item "
                    "before issuing"
                ),
            )

        if not invoice.organization_id:
            raise HTTPException(
                status_code=(
                    status.HTTP_409_CONFLICT
                ),
                detail=(
                    "Invoice organization "
                    "is required before issuing"
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
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "CoreFlow commercial context "
                    "is unavailable. Invoice "
                    "cannot be issued."
                ),
            ) from exc

        if not commercial_context.commercial_profile:
            raise HTTPException(
                status_code=(
                    status.HTTP_409_CONFLICT
                ),
                detail=(
                    "Commercial profile is "
                    "required before issuing"
                ),
            )

        invoice.issuer_snapshot = (
            commercial_context.model_dump(
                mode="json"
            )
        )

    invoice.status = new_status

    invoice.updated_at = (
        datetime.now()
    )

    db.commit()
    db.refresh(invoice)

    return build_invoice_response(
        db,
        invoice,
    )


# ---------------------------------------------------------------------
# DELETE DRAFT
# ---------------------------------------------------------------------

@router.delete(
    "/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id
            == str(invoice_id),
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

    if invoice.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only a draft invoice can be deleted"
            ),
        )

    has_payment = (
        db.query(PaymentDB)
        .filter(
            PaymentDB.invoice_id == invoice.id
        )
        .first()
    )

    has_credit_note = (
        db.query(CreditNoteDB)
        .filter(
            CreditNoteDB.invoice_id == invoice.id
        )
        .first()
    )

    has_reminder = (
        db.query(PaymentReminderDB)
        .filter(
            PaymentReminderDB.invoice_id
            == invoice.id
        )
        .first()
    )

    has_refund = (
        db.query(RefundDB)
        .filter(
            RefundDB.invoice_id == invoice.id
        )
        .first()
    )

    if any(
        (
            has_payment,
            has_credit_note,
            has_reminder,
            has_refund,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Invoice cannot be deleted because "
                "financial activity is linked to it"
            ),
        )

    db.query(InvoiceItemDB).filter(
        InvoiceItemDB.invoice_id
        == invoice.id
    ).delete(
        synchronize_session=False
    )

    db.delete(invoice)
    db.commit()

    return None


# ---------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------

@router.post(
    "/{invoice_id}/send",
    response_model=InvoiceResponse,
)
def send_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id
            == str(invoice_id),
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

    if invoice.status != "issued":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only an issued invoice "
                "can be sent"
            ),
        )

    if not invoice.organization_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Invoice organization is required "
                "before sending"
            ),
        )

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

    if not client.email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Client email is required "
                "before sending"
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
                "one item before sending"
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

    commercial_context = None

    if invoice.issuer_snapshot:
        commercial_context = (
            CoreCommercialContext.model_validate(
                invoice.issuer_snapshot
            )
        )

    else:
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
                    "is unavailable. Invoice cannot "
                    "be sent."
                ),
            ) from exc

    if not commercial_context:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Commercial context is required "
                "before sending"
            ),
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
        f"Facture {invoice.invoice_number}"
    )

    contact_name = (
        client.contact_name
        or client.company_name
        or "Madame, Monsieur"
    )

    body = (
        f"Bonjour {contact_name},\n\n"
        "Veuillez trouver en pièce jointe "
        f"notre facture {invoice.invoice_number}.\n\n"
        "Nous restons à votre disposition "
        "pour toute question.\n\n"
        "Cordialement"
    )

    email_log = DocumentEmailDB(
        id=str(uuid4()),
        organization_id=(
            invoice.organization_id
        ),
        document_type="invoice",
        document_id=invoice.id,
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
                "Email delivery failed. "
                "Invoice status was not changed."
            ),
        )

    email_log.status = "sent"
    email_log.provider = result.provider
    email_log.provider_message_id = (
        result.provider_message_id
    )
    email_log.error_message = None
    email_log.sent_at = now

    invoice.status = "sent"
    invoice.updated_at = now

    db.commit()
    db.refresh(email_log)
    db.refresh(invoice)

    return build_invoice_response(
        db,
        invoice,
    )


@router.get(
    "/{invoice_id}/pdf",
)
def download_invoice_pdf(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.id
            == str(invoice_id),
            InvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Invoice not found",
        )

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id
            == invoice.quote_id,
            QuoteDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not quote:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Quote not found",
        )

    request = (
        db.query(RequestDB)
        .filter(
            RequestDB.id
            == quote.request_id,
            RequestDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Request not found",
        )

    client = (
        db.query(ClientDB)
        .filter(
            ClientDB.id
            == request.client_id,
            ClientDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Client not found",
        )

    items = (
        db.query(InvoiceItemDB)
        .filter(
            InvoiceItemDB.invoice_id
            == invoice.id
        )
        .all()
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

    commercial_context = None

    if invoice.issuer_snapshot:
        commercial_context = (
            CoreCommercialContext.model_validate(
                invoice.issuer_snapshot
            )
        )

    elif invoice.organization_id:
        try:
            commercial_context = (
                get_commercial_context(
                    invoice.organization_id
                )
            )
        except RuntimeError:
            commercial_context = None

    pdf_buffer = (
        generate_invoice_pdf(
            invoice=invoice,
            client=client,
            request=request,
            quote=quote,
            items=items,
            payments=payments,
            credit_notes=(
                credit_notes
            ),
            refunds=refunds,
            commercial_context=(
                commercial_context
            ),
        )
    )

    filename = (
        f"{invoice.invoice_number}.pdf"
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; '
                f'filename="{filename}"'
            )
        },
    )
