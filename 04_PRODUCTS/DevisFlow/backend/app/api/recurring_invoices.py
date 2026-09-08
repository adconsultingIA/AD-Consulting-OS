from calendar import monthrange
from datetime import date, datetime
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
    ClientDB,
    InvoiceDB,
    InvoiceItemDB,
    QuoteDB,
    QuoteItemDB,
    RecurringInvoiceDB,
    RequestDB,
)

from app.schemas.recurring_invoice import (
    RecurringInvoiceCreate,
    RecurringInvoiceResponse,
    RecurringInvoiceStatusUpdate,
    RecurringInvoiceUpdate,
)

from app.core.devisflow_context import (
    get_devisflow_context,
)

from app.services.coreflow_client import (
    get_payment_preferences,
    get_devisflow_organization_id,
)

from app.services.quote_acceptance_service import (
    ensure_quote_acceptance_is_valid,
)

from app.services.document_number_service import (
    next_document_number,
)


router = APIRouter(
    prefix="/api/v1/recurring-invoices",
    tags=["Recurring Invoices"],
)


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

def serialize_recurring_invoice(
    recurring: RecurringInvoiceDB,
    db: Session,
    organization_id: str,
) -> RecurringInvoiceResponse:
    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id ==
            recurring.quote_id,
            QuoteDB.organization_id
            == organization_id,
        )
        .first()
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
        if quote
        else None
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
        if request
        else None
    )

    generated_count = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.recurring_invoice_id
            == recurring.id,
            InvoiceDB.organization_id
            == organization_id,
        )
        .count()
    )

    return RecurringInvoiceResponse(
        id=UUID(recurring.id),
        quote_id=UUID(
            recurring.quote_id
        ),
        quote_number=(
            quote.quote_number
            if quote
            else None
        ),
        client_name=(
            client.company_name
            if client
            else None
        ),
        organization_id=(
            UUID(
                recurring.organization_id
            )
            if recurring.organization_id
            else None
        ),
        service_name=
            recurring.service_name,
        frequency=
            recurring.frequency,
        start_date=
            recurring.start_date,
        next_invoice_date=
            recurring.next_invoice_date,
        status=
            recurring.status,
        last_generated_at=
            recurring.last_generated_at,
        generated_invoices_count=
            generated_count,
        created_at=
            recurring.created_at,
        updated_at=
            recurring.updated_at,
    )


def get_recurring_or_404(
    recurring_id: UUID,
    db: Session,
    organization_id: str,
) -> RecurringInvoiceDB:
    recurring = (
        db.query(
            RecurringInvoiceDB
        )
        .filter(
            RecurringInvoiceDB.id
            == str(recurring_id),
            RecurringInvoiceDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not recurring:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=(
                "Recurring invoice "
                "not found"
            ),
        )

    return recurring


def add_months(
    value: date,
    months: int,
) -> date:
    """
    Ajoute des mois en conservant au mieux
    le jour du calendrier.

    Exemple :
    31 janvier + 1 mois -> 28/29 février.
    """

    month_index = (
        value.month - 1 + months
    )

    year = (
        value.year
        + month_index // 12
    )

    month = (
        month_index % 12
        + 1
    )

    day = min(
        value.day,
        monthrange(
            year,
            month,
        )[1],
    )

    return date(
        year,
        month,
        day,
    )


def get_next_invoice_date(
    current_date: date,
    frequency: str,
) -> date:
    if frequency == "monthly":
        return add_months(
            current_date,
            1,
        )

    if frequency == "quarterly":
        return add_months(
            current_date,
            3,
        )

    if frequency == "yearly":
        return add_months(
            current_date,
            12,
        )

    raise HTTPException(
        status_code=
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=(
            "Unsupported recurring "
            "invoice frequency"
        ),
    )


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


# ---------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------

@router.get(
    "",
    response_model=
        list[
            RecurringInvoiceResponse
        ],
)
def list_recurring_invoices(
    db: Session = Depends(get_db),
    devisflow_context=Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    rows = (
        db.query(
            RecurringInvoiceDB
        )
        .filter(
            RecurringInvoiceDB.organization_id
            == organization_id
        )
        .order_by(
            RecurringInvoiceDB
            .next_invoice_date.asc(),
            RecurringInvoiceDB
            .created_at.desc(),
        )
        .all()
    )

    return [
        serialize_recurring_invoice(
            row,
            db,
            organization_id,
        )
        for row in rows
    ]


# ---------------------------------------------------------------------
# READ
# ---------------------------------------------------------------------

@router.get(
    "/{recurring_id}",
    response_model=
        RecurringInvoiceResponse,
)
def get_recurring_invoice(
    recurring_id: UUID,
    db: Session = Depends(get_db),
    devisflow_context=Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    recurring = (
        get_recurring_or_404(
            recurring_id,
            db,
            organization_id,
        )
    )

    return serialize_recurring_invoice(
        recurring,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# CREATE FROM ACCEPTED QUOTE
# ---------------------------------------------------------------------

@router.post(
    "/from-quote/{quote_id}",
    response_model=
        RecurringInvoiceResponse,
    status_code=
        status.HTTP_201_CREATED,
)
def create_recurring_invoice(
    quote_id: UUID,
    payload: RecurringInvoiceCreate,
    db: Session = Depends(get_db),
    devisflow_context=Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id ==
            str(quote_id),
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

    if quote.status != "accepted":
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Only an accepted quote "
                "can create a recurring "
                "invoice schedule"
            ),
        )

    ensure_quote_acceptance_is_valid(
        quote
    )

    quote_items = (
        db.query(QuoteItemDB)
        .filter(
            QuoteItemDB.quote_id
            == quote.id
        )
        .all()
    )

    if not quote_items:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "The quote must contain "
                "at least one item"
            ),
        )

    next_invoice_date = (
        payload.next_invoice_date
        or payload.start_date
    )

    if (
        next_invoice_date
        < payload.start_date
    ):
        raise HTTPException(
            status_code=
                status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "next_invoice_date cannot "
                "be before start_date"
            ),
        )

    recurring = RecurringInvoiceDB(
        id=str(uuid4()),
        quote_id=quote.id,
        organization_id=
            organization_id,
        issuer_snapshot=
            quote.issuer_snapshot,
        service_name=
            payload.service_name.strip(),
        frequency=
            payload.frequency,
        start_date=
            payload.start_date,
        next_invoice_date=
            next_invoice_date,
        status="active",
    )

    db.add(recurring)
    db.commit()
    db.refresh(recurring)

    return serialize_recurring_invoice(
        recurring,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------

@router.patch(
    "/{recurring_id}",
    response_model=
        RecurringInvoiceResponse,
)
def update_recurring_invoice(
    recurring_id: UUID,
    payload: RecurringInvoiceUpdate,
    db: Session = Depends(get_db),
    devisflow_context=Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    recurring = (
        get_recurring_or_404(
            recurring_id,
            db,
            organization_id,
        )
    )

    if recurring.status == "stopped":
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "A stopped recurring "
                "invoice cannot be edited"
            ),
        )

    data = payload.model_dump(
        exclude_unset=True
    )

    if "service_name" in data:
        data["service_name"] = (
            data["service_name"].strip()
        )

    for key, value in data.items():
        setattr(
            recurring,
            key,
            value,
        )

    if (
        recurring.next_invoice_date
        < recurring.start_date
    ):
        raise HTTPException(
            status_code=
                status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "next_invoice_date cannot "
                "be before start_date"
            ),
        )

    db.commit()
    db.refresh(recurring)

    return serialize_recurring_invoice(
        recurring,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# STATUS
# ---------------------------------------------------------------------

@router.patch(
    "/{recurring_id}/status",
    response_model=
        RecurringInvoiceResponse,
)
def update_recurring_status(
    recurring_id: UUID,
    payload:
        RecurringInvoiceStatusUpdate,
    db: Session = Depends(get_db),
    devisflow_context=Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    recurring = (
        get_recurring_or_404(
            recurring_id,
            db,
            organization_id,
        )
    )

    current = recurring.status
    target = payload.status

    allowed = {
        "active": {
            "paused",
            "stopped",
        },
        "paused": {
            "active",
            "stopped",
        },
        "stopped": set(),
    }

    if target == current:
        return serialize_recurring_invoice(
            recurring,
            db,
            organization_id,
        )

    if target not in allowed.get(
        current,
        set(),
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Invalid recurring invoice "
                f"status transition: "
                f"{current} -> {target}"
            ),
        )

    recurring.status = target

    db.commit()
    db.refresh(recurring)

    return serialize_recurring_invoice(
        recurring,
        db,
        organization_id,
    )

# ---------------------------------------------------------------------
# GENERATE INVOICE
# ---------------------------------------------------------------------

@router.post(
    "/{recurring_id}/generate",
)
def generate_recurring_invoice(
    recurring_id: UUID,
    db: Session = Depends(get_db),
    devisflow_context=Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    recurring = (
        get_recurring_or_404(
            recurring_id,
            db,
            organization_id,
        )
    )

    # ---------------------------------------------------------
    # Schedule must be active
    # ---------------------------------------------------------

    if recurring.status != "active":
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Only an active recurring "
                "invoice can generate "
                "a new invoice"
            ),
        )

    # ---------------------------------------------------------
    # Controlled V1 generation:
    # no invoice before its scheduled date.
    #
    # This also protects against accidental
    # double-generation: after one generation,
    # next_invoice_date moves to the next cycle.
    # ---------------------------------------------------------

    scheduled_date = (
        recurring.next_invoice_date
    )

    if scheduled_date > date.today():
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "The next recurring invoice "
                "is not due yet"
            ),
        )

    # ---------------------------------------------------------
    # Source quote
    # ---------------------------------------------------------

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id ==
            recurring.quote_id,
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

    if quote.status != "accepted":
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "The source quote must "
                "remain accepted"
            ),
        )

    ensure_quote_acceptance_is_valid(
        quote
    )

    quote_items = (
        db.query(QuoteItemDB)
        .filter(
            QuoteItemDB.quote_id
            == quote.id
        )
        .all()
    )

    if not quote_items:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "The source quote "
                "has no items"
            ),
        )

    # ---------------------------------------------------------
    # Totals
    # Recurring invoices always reproduce
    # the FULL quote/service amount.
    # ---------------------------------------------------------

    invoice_subtotal = sum(
        (
            Decimal(
                str(
                    item.subtotal
                    or 0
                )
            )
            for item in quote_items
        ),
        Decimal("0.00"),
    )

    invoice_vat = sum(
        (
            Decimal(
                str(
                    item.vat_amount
                    or 0
                )
            )
            for item in quote_items
        ),
        Decimal("0.00"),
    )

    invoice_total = sum(
        (
            Decimal(
                str(
                    item.total
                    or 0
                )
            )
            for item in quote_items
        ),
        Decimal("0.00"),
    )

    if invoice_total <= Decimal(
        "0.00"
    ):
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Recurring invoice total "
                "must be positive"
            ),
        )

    # ---------------------------------------------------------
    # Payment preferences from CoreFlow
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # Create standard invoice
    #
    # IMPORTANT:
    # recurring_invoice_id identifies its origin.
    # billing_percentage/billing_sequence stay null.
    # ---------------------------------------------------------

    invoice = InvoiceDB(
        id=str(uuid4()),
        quote_id=quote.id,
        recurring_invoice_id=
            recurring.id,
        organization_id=
            organization_id,
        invoice_number=
            generate_invoice_number(
                db
            ),
        status="draft",
        invoice_type="standard",
        billing_percentage=None,
        billing_sequence=None,
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
        amount_paid=
            Decimal("0.00"),
        amount_due=
            invoice_total,
        credit_total=
            Decimal("0.00"),
        net_total=
            invoice_total,
        customer_credit=
            Decimal("0.00"),
        refunded_total=
            Decimal("0.00"),
    )

    db.add(invoice)
    db.flush()

    # ---------------------------------------------------------
    # Copy quote items exactly
    # ---------------------------------------------------------

    for quote_item in quote_items:
        invoice_item = InvoiceItemDB(
            id=str(uuid4()),
            invoice_id=
                invoice.id,
            quote_item_id=
                quote_item.id,
            description=
                quote_item.description,
            quantity=Decimal(
                str(
                    quote_item.quantity
                    or 0
                )
            ),
            unit_price=Decimal(
                str(
                    quote_item.unit_price
                    or 0
                )
            ),
            vat_rate=Decimal(
                str(
                    quote_item.vat_rate
                    or 0
                )
            ),
            tax_type=
                quote_item.tax_type,
            tax_treatment=
                quote_item.tax_treatment,
            tax_reason=
                quote_item.tax_reason,
            requires_manual_review=(
                quote_item
                .requires_manual_review
            ),
            subtotal=Decimal(
                str(
                    quote_item.subtotal
                    or 0
                )
            ),
            vat_amount=Decimal(
                str(
                    quote_item.vat_amount
                    or 0
                )
            ),
            total=Decimal(
                str(
                    quote_item.total
                    or 0
                )
            ),
        )

        db.add(invoice_item)

    # ---------------------------------------------------------
    # Advance recurrence
    # ---------------------------------------------------------

    now = datetime.now()

    recurring.last_generated_at = (
        now
    )

    recurring.next_invoice_date = (
        get_next_invoice_date(
            scheduled_date,
            recurring.frequency,
        )
    )

    recurring.updated_at = now

    # ---------------------------------------------------------
    # Single transaction
    # ---------------------------------------------------------

    db.commit()

    db.refresh(invoice)
    db.refresh(recurring)

    return {
        "ok": True,
        "invoice": {
            "id": invoice.id,
            "invoice_number":
                invoice.invoice_number,
            "status":
                invoice.status,
            "total":
                invoice.total,
            "recurring_invoice_id":
                invoice.recurring_invoice_id,
        },
        "recurring_invoice":
            serialize_recurring_invoice(
                recurring,
                db,
                organization_id,
            ),
    }

