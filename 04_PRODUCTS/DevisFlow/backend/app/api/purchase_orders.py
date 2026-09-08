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
from app.core.devisflow_context import (
    get_devisflow_context,
)
from app.models.database_models import (
    PurchaseOrderDB,
    PurchaseOrderItemDB,
    QuoteDB,
    QuoteItemDB,
    RequestDB,
    ClientDB,
)
from fastapi.responses import StreamingResponse

from app.schemas.coreflow import CoreCommercialContext
from app.services.coreflow_client import (
    get_commercial_context,
    get_devisflow_organization_id,
)
from app.services.purchase_order_pdf_service import (
    generate_purchase_order_pdf,
)

from app.services.quote_acceptance_service import (
    ensure_quote_acceptance_is_valid,
)

from app.models.document_email import DocumentEmailDB
from app.services.email_service import (
    EmailAttachment,
    send_email,
)

from app.schemas.purchase_order import (
    PurchaseOrderItemResponse,
    PurchaseOrderResponse,
    PurchaseOrderStatusUpdate,
    PurchaseOrderUpdate,
)


from app.services.document_number_service import next_document_number

router = APIRouter(
    prefix="/api/v1/purchase-orders",
    tags=["Purchase Orders"],
)


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

def generate_purchase_order_number(
    db: Session,
) -> str:
    year = date.today().year

    return next_document_number(
        db,
        document_type="purchase_order",
        prefix="BC",
        table_name="purchase_orders",
        column_name="purchase_order_number",
        year=year,
    )

def serialize_purchase_order(
    purchase_order: PurchaseOrderDB,
    db: Session,
    organization_id: str,
) -> PurchaseOrderResponse:
    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id == purchase_order.quote_id,
            QuoteDB.organization_id
            == organization_id,
        )
        .first()
    )

    items = (
        db.query(PurchaseOrderItemDB)
        .filter(
            PurchaseOrderItemDB.purchase_order_id
            == purchase_order.id
        )
        .all()
    )

    return PurchaseOrderResponse(
        id=purchase_order.id,
        quote_id=purchase_order.quote_id,
        quote_number=(
            quote.quote_number
            if quote
            else None
        ),
        organization_id=(
            purchase_order.organization_id
        ),
        purchase_order_number=(
            purchase_order.purchase_order_number
        ),
        status=purchase_order.status,
        order_date=purchase_order.order_date,
        intervention_address=(
            purchase_order.intervention_address
        ),
        notes=purchase_order.notes,
        items=[
            PurchaseOrderItemResponse(
                id=item.id,
                description=item.description,
                quantity=Decimal(item.quantity),
                unit_price=Decimal(item.unit_price),
                vat_rate=Decimal(item.vat_rate),
                tax_type=item.tax_type,
                tax_treatment=item.tax_treatment,
                tax_reason=item.tax_reason,
                requires_manual_review=(
                    item.requires_manual_review
                ),
                subtotal=Decimal(item.subtotal),
                vat_amount=Decimal(item.vat_amount),
                total=Decimal(item.total),
            )
            for item in items
        ],
        subtotal=Decimal(
            purchase_order.subtotal or 0
        ),
        vat_amount=Decimal(
            purchase_order.vat_amount or 0
        ),
        total=Decimal(
            purchase_order.total or 0
        ),
        created_at=purchase_order.created_at,
        updated_at=purchase_order.updated_at,
    )


# ---------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------

@router.get(
    "",
    response_model=list[PurchaseOrderResponse],
)
def list_purchase_orders(
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    purchase_orders = (
        db.query(PurchaseOrderDB)
        .filter(
            PurchaseOrderDB.organization_id
            == organization_id
        )
        .order_by(
            PurchaseOrderDB.created_at.desc()
        )
        .all()
    )

    return [
        serialize_purchase_order(
            purchase_order,
            db,
            organization_id,
        )
        for purchase_order in purchase_orders
    ]


# ---------------------------------------------------------------------
# READ
# ---------------------------------------------------------------------

@router.get(
    "/{purchase_order_id}",
    response_model=PurchaseOrderResponse,
)
def get_purchase_order(
    purchase_order_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    purchase_order = (
        db.query(PurchaseOrderDB)
        .filter(
            PurchaseOrderDB.id
            == str(purchase_order_id),
            PurchaseOrderDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not purchase_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )

    return serialize_purchase_order(
        purchase_order,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# CREATE FROM ACCEPTED QUOTE
# ---------------------------------------------------------------------

@router.post(
    "/from-quote/{quote_id}",
    response_model=PurchaseOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase_order_from_quote(
    quote_id: UUID,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

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
                "Only an accepted quote can "
                "create a purchase order"
            ),
        )

    ensure_quote_acceptance_is_valid(
        quote
    )

    existing = (
        db.query(PurchaseOrderDB)
        .filter(
            PurchaseOrderDB.quote_id == quote.id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A purchase order already exists "
                "for this quote"
            ),
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

    purchase_order = PurchaseOrderDB(
        id=str(uuid4()),
        quote_id=quote.id,
        organization_id=quote.organization_id,
        issuer_snapshot=quote.issuer_snapshot,
        purchase_order_number=(
            generate_purchase_order_number(db)
        ),
        status="draft",
        order_date=None,
        intervention_address=None,
        notes=quote.notes,
        subtotal=quote.subtotal,
        vat_amount=quote.vat_amount,
        total=quote.total,
    )

    db.add(purchase_order)
    db.flush()

    for quote_item in quote_items:
        item = PurchaseOrderItemDB(
            id=str(uuid4()),
            purchase_order_id=purchase_order.id,
            description=quote_item.description,
            quantity=quote_item.quantity,
            unit_price=quote_item.unit_price,
            vat_rate=quote_item.vat_rate,
            tax_type=quote_item.tax_type,
            tax_treatment=(
                quote_item.tax_treatment
            ),
            tax_reason=quote_item.tax_reason,
            requires_manual_review=(
                quote_item.requires_manual_review
            ),
            subtotal=quote_item.subtotal,
            vat_amount=quote_item.vat_amount,
            total=quote_item.total,
        )

        db.add(item)

    db.commit()
    db.refresh(purchase_order)

    return serialize_purchase_order(
        purchase_order,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------

@router.put(
    "/{purchase_order_id}",
    response_model=PurchaseOrderResponse,
)
def update_purchase_order(
    purchase_order_id: UUID,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    purchase_order = (
        db.query(PurchaseOrderDB)
        .filter(
            PurchaseOrderDB.id
            == str(purchase_order_id),
            PurchaseOrderDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not purchase_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )

    if purchase_order.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only a draft purchase order "
                "can be edited"
            ),
        )

    values = payload.model_dump(
        exclude_unset=True
    )

    for field, value in values.items():
        setattr(
            purchase_order,
            field,
            value,
        )

    db.commit()
    db.refresh(purchase_order)

    return serialize_purchase_order(
        purchase_order,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# STATUS
# ---------------------------------------------------------------------

@router.patch(
    "/{purchase_order_id}/status",
    response_model=PurchaseOrderResponse,
)
def update_purchase_order_status(
    purchase_order_id: UUID,
    payload: PurchaseOrderStatusUpdate,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    purchase_order = (
        db.query(PurchaseOrderDB)
        .filter(
            PurchaseOrderDB.id
            == str(purchase_order_id),
            PurchaseOrderDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not purchase_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )

    allowed_transitions = {
        "draft": {
            "issued",
            "cancelled",
        },
        "issued": {
            "cancelled",
        },
        "sent": {
            "cancelled",
        },
        "cancelled": set(),
    }

    if payload.status == purchase_order.status:
        return serialize_purchase_order(
            purchase_order,
            db,
            organization_id,
        )

    if payload.status not in allowed_transitions.get(
        purchase_order.status,
        set(),
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Invalid purchase order transition: "
                f"{purchase_order.status} "
                f"-> {payload.status}"
            ),
        )

    if (
        payload.status == "issued"
        and purchase_order.order_date is None
    ):
        purchase_order.order_date = date.today()

    purchase_order.status = payload.status

    db.commit()
    db.refresh(purchase_order)

    return serialize_purchase_order(
        purchase_order,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# DELETE DRAFT
# ---------------------------------------------------------------------

@router.delete(
    "/{purchase_order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_purchase_order(
    purchase_order_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    purchase_order = (
        db.query(PurchaseOrderDB)
        .filter(
            PurchaseOrderDB.id
            == str(purchase_order_id),
            PurchaseOrderDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not purchase_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )

    if purchase_order.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only a draft purchase order "
                "can be deleted"
            ),
        )

    db.query(
        PurchaseOrderItemDB
    ).filter(
        PurchaseOrderItemDB.purchase_order_id
        == purchase_order.id
    ).delete(
        synchronize_session=False
    )

    db.delete(purchase_order)
    db.commit()

    return None


# ---------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------

@router.post(
    "/{purchase_order_id}/send",
    response_model=PurchaseOrderResponse,
)
def send_purchase_order(
    purchase_order_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    purchase_order = (
        db.query(PurchaseOrderDB)
        .filter(
            PurchaseOrderDB.id
            == str(purchase_order_id),
            PurchaseOrderDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not purchase_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )

    if purchase_order.status != "issued":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only an issued purchase order "
                "can be sent"
            ),
        )

    if not purchase_order.organization_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Purchase order organization "
                "is required before sending"
            ),
        )

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id
            == purchase_order.quote_id,
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
            RequestDB.id
            == quote.request_id,
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
            ClientDB.id
            == request.client_id,
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
        db.query(PurchaseOrderItemDB)
        .filter(
            PurchaseOrderItemDB.purchase_order_id
            == purchase_order.id
        )
        .all()
    )

    if not items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Purchase order must contain "
                "at least one item before sending"
            ),
        )

    commercial_context = None

    if purchase_order.issuer_snapshot:
        commercial_context = (
            CoreCommercialContext.model_validate(
                purchase_order.issuer_snapshot
            )
        )
    else:
        try:
            commercial_context = (
                get_commercial_context(
                    purchase_order.organization_id
                )
            )
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "CoreFlow commercial context "
                    "is unavailable. Purchase order "
                    "cannot be sent."
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

    pdf_buffer = generate_purchase_order_pdf(
        purchase_order=purchase_order,
        quote=quote,
        request=request,
        client=client,
        items=items,
        commercial_context=commercial_context,
    )

    pdf_bytes = pdf_buffer.getvalue()

    subject = (
        "Bon de commande "
        f"{purchase_order.purchase_order_number}"
    )

    contact_name = (
        client.contact_name
        or client.company_name
        or "Madame, Monsieur"
    )

    body = (
        f"Bonjour {contact_name},\n\n"
        "Veuillez trouver en pièce jointe "
        "notre bon de commande "
        f"{purchase_order.purchase_order_number}.\n\n"
        "Nous restons à votre disposition "
        "pour toute question.\n\n"
        "Cordialement"
    )

    email_log = DocumentEmailDB(
        id=str(uuid4()),
        organization_id=(
            purchase_order.organization_id
        ),
        document_type="purchase_order",
        document_id=purchase_order.id,
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
                f"{purchase_order.purchase_order_number}.pdf"
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
                "Purchase order status "
                "was not changed."
            ),
        )

    email_log.status = "sent"
    email_log.provider = result.provider
    email_log.provider_message_id = (
        result.provider_message_id
    )
    email_log.error_message = None
    email_log.sent_at = now

    purchase_order.status = "sent"

    if hasattr(
        purchase_order,
        "updated_at",
    ):
        purchase_order.updated_at = now

    db.commit()

    db.refresh(email_log)
    db.refresh(purchase_order)

    return serialize_purchase_order(
        purchase_order,
        db,
        organization_id,
    )


@router.get(
    "/{purchase_order_id}/pdf",
)
def download_purchase_order_pdf(
    purchase_order_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    purchase_order = (
        db.query(PurchaseOrderDB)
        .filter(
            PurchaseOrderDB.id
            == str(purchase_order_id),
            PurchaseOrderDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not purchase_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id
            == purchase_order.quote_id,
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
            RequestDB.id
            == quote.request_id,
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
            ClientDB.id
            == request.client_id,
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

    items = (
        db.query(PurchaseOrderItemDB)
        .filter(
            PurchaseOrderItemDB.purchase_order_id
            == purchase_order.id
        )
        .all()
    )

    commercial_context = None

    if purchase_order.issuer_snapshot:
        commercial_context = (
            CoreCommercialContext.model_validate(
                purchase_order.issuer_snapshot
            )
        )

    elif purchase_order.organization_id:
        try:
            commercial_context = (
                get_commercial_context(
                    purchase_order.organization_id
                )
            )
        except RuntimeError:
            commercial_context = None

    pdf_buffer = generate_purchase_order_pdf(
        purchase_order=purchase_order,
        quote=quote,
        request=request,
        client=client,
        items=items,
        commercial_context=commercial_context,
    )

    filename = (
        f"{purchase_order.purchase_order_number}.pdf"
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="{filename}"'
            )
        },
    )
