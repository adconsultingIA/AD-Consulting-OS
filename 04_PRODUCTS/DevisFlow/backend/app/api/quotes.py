from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.database_models import (
    InvoiceDB,
    PurchaseOrderDB,
    QuoteDB,
    QuoteItemDB,
    RequestDB,
)
from app.models.quote_status import QuoteStatus
from app.schemas.quote import (
    QuoteAcceptanceCreate,
    QuoteCreate,
    QuoteItemCreate,
    QuoteItemResponse,
    QuoteResponse,
    QuoteStatusUpdate,
    QuoteUpdate,
)

from app.schemas.coreflow import (
    CoreCommercialContext,
)
from fastapi.responses import StreamingResponse

from app.models.database_models import ClientDB
from app.services.pdf_service import generate_quote_pdf
from app.services.tax_engine import (
    CustomerTaxContext,
    TaxDecision,
    resolve_issuer_tax,
    resolve_tax,
)
from app.services.coreflow_client import (
    get_commercial_context,
    upload_internal_document,
)

from app.services.quote_acceptance_service import (
    ensure_quote_acceptance_is_valid,
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

from app.services.quote_service import (
    create_quote_for_organization,
)

router = APIRouter(
    prefix="/api/v1/quotes",
    tags=["quotes"],
)


MONEY = Decimal("0.01")


ALLOWED_TRANSITIONS = {
    QuoteStatus.DRAFT: {
        QuoteStatus.READY,
        QuoteStatus.CANCELLED,
    },
    QuoteStatus.READY: {
        QuoteStatus.DRAFT,
        QuoteStatus.CANCELLED,
    },
    QuoteStatus.SENT: {
        QuoteStatus.REJECTED,
        QuoteStatus.EXPIRED,
        QuoteStatus.CANCELLED,
    },
    QuoteStatus.ACCEPTED: set(),
    QuoteStatus.REJECTED: set(),
    QuoteStatus.EXPIRED: set(),
    QuoteStatus.CANCELLED: set(),
}


EDITABLE_STATUSES = {
    QuoteStatus.DRAFT,
    QuoteStatus.READY,
}


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(
        MONEY,
        rounding=ROUND_HALF_UP,
    )


def generate_quote_number(db: Session) -> str:
    year = datetime.now(timezone.utc).year

    return next_document_number(
        db,
        document_type="quote",
        prefix="DEV",
        table_name="quotes",
        column_name="quote_number",
        year=year,
    )

def build_customer_tax_context(
    client: ClientDB,
) -> CustomerTaxContext:
    return CustomerTaxContext(
        country_code=client.country_code,
        region=client.region,
        customer_type=(
            client.customer_type
            or "business"
        ),
        tax_system=client.tax_system,
        tax_registered=client.tax_registered,
        tax_identifier=client.tax_identifier,
    )


def calculate_item(
    item: QuoteItemCreate,
    tax_decision: TaxDecision,
):
    tax_rate = money(
        tax_decision.tax_rate
    )

    subtotal = money(
        item.quantity * item.unit_price
    )

    vat_amount = money(
        subtotal
        * tax_rate
        / Decimal("100")
    )

    total = money(
        subtotal + vat_amount
    )

    return (
        subtotal,
        vat_amount,
        total,
        tax_rate,
    )


def get_quote_items(
    db: Session,
    quote_id: str,
):
    items = (
        db.query(QuoteItemDB)
        .filter(QuoteItemDB.quote_id == quote_id)
        .all()
    )

    return [
        QuoteItemResponse(
            id=UUID(item.id),
            description=item.description,
            service_category=(
                item.service_category
                or "other"
            ),
            quantity=item.quantity,
            unit_price=item.unit_price,
            vat_rate=item.vat_rate,
            tax_type=item.tax_type,
            tax_treatment=item.tax_treatment,
            tax_reason=item.tax_reason,
            requires_manual_review=(
                item.requires_manual_review
                or False
            ),
            subtotal=item.subtotal,
            vat_amount=item.vat_amount,
            total=item.total,
        )
        for item in items
    ]


def build_quote_response(
    db: Session,
    quote: QuoteDB,
):
    return QuoteResponse(
        id=UUID(quote.id),
        quote_number=quote.quote_number,
        request_id=UUID(quote.request_id),
        organization_id=(
            UUID(quote.organization_id)
            if quote.organization_id
            else None
        ),
        status=QuoteStatus(quote.status),
        version=quote.version,
        valid_until=quote.valid_until,
        notes=quote.notes,
        acceptance_checked=bool(
            quote.acceptance_checked
        ),
        acceptance_method=(
            quote.acceptance_method
        ),
        accepted_at=quote.accepted_at,
        accepted_by_user_id=(
            quote.accepted_by_user_id
        ),
        acceptance_reference=(
            quote.acceptance_reference
        ),
        acceptance_note=(
            quote.acceptance_note
        ),
        acceptance_document_path=(
            quote.acceptance_document_path
        ),
        items=get_quote_items(db, quote.id),
        subtotal=quote.subtotal,
        vat_amount=quote.vat_amount,
        total=quote.total,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
    )


@router.post(
    "",
    response_model=QuoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_quote(
    payload: QuoteCreate,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    return create_quote_for_organization(
        db,
        organization_id=organization_id,
        payload=payload,
        )


@router.delete(
    "/{quote_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_quote(
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

    if quote.status != QuoteStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only a draft quote can be deleted"
            ),
        )

    linked_invoice = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.quote_id == quote.id
        )
        .first()
    )

    if linked_invoice:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Quote cannot be deleted because "
                "an invoice is linked to it"
            ),
        )

    linked_purchase_order = (
        db.query(PurchaseOrderDB)
        .filter(
            PurchaseOrderDB.quote_id == quote.id
        )
        .first()
    )

    if linked_purchase_order:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Quote cannot be deleted because "
                "a purchase order is linked to it"
            ),
        )

    db.query(QuoteItemDB).filter(
        QuoteItemDB.quote_id == quote.id
    ).delete(
        synchronize_session=False
    )

    db.delete(quote)
    db.commit()

    return None


@router.get(
    "",
    response_model=list[QuoteResponse],
)
def list_quotes(
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    quotes = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.organization_id
            == organization_id
        )
        .order_by(QuoteDB.created_at.desc())
        .all()
    )

    return [
        build_quote_response(db, quote)
        for quote in quotes
    ]


@router.get(
    "/request/{request_id}",
    response_model=list[QuoteResponse],
)
def list_request_quotes(
    request_id: UUID,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    request = (
        db.query(RequestDB)
        .filter(
            RequestDB.id == str(request_id),
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

    quotes = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.request_id
            == str(request_id),
            QuoteDB.organization_id
            == organization_id,
        )
        .order_by(QuoteDB.created_at.desc())
        .all()
    )

    return [
        build_quote_response(db, quote)
        for quote in quotes
    ]


@router.get(
    "/{quote_id}",
    response_model=QuoteResponse,
)
def get_quote(
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

    return build_quote_response(db, quote)


@router.patch(
    "/{quote_id}",
    response_model=QuoteResponse,
)
def update_quote(
    quote_id: UUID,
    payload: QuoteUpdate,
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

    current_status = QuoteStatus(quote.status)

    if current_status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Quote cannot be modified after it has been sent",
        )

    if payload.valid_until is not None:
        quote.valid_until = payload.valid_until

    if payload.notes is not None:
        quote.notes = payload.notes

    if payload.items is not None:
        if not quote.organization_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Quote organization is required "
                    "for tax calculation"
                ),
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

        customer_tax_context = (
            build_customer_tax_context(
                client
            )
        )

        try:
            commercial_context = (
                get_commercial_context(
                    quote.organization_id
                )
            )
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "CoreFlow est indisponible. "
                    "Impossible de recalculer "
                    "la fiscalité du devis."
                ),
            ) from exc

        if not payload.items:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A quote must contain at least one item",
            )

        (
            db.query(QuoteItemDB)
            .filter(QuoteItemDB.quote_id == quote.id)
            .delete()
        )

        subtotal = Decimal("0")
        vat_amount = Decimal("0")

        for item in payload.items:
            tax_decision = resolve_tax(
                issuer_tax_profile=(
                    commercial_context.tax_profile
                ),
                customer=(
                    customer_tax_context
                ),
                service_category=(
                    item.service_category
                ),
            )

            if tax_decision.requires_manual_review:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Fiscal review required for "
                        f"'{item.description}': "
                        f"{tax_decision.tax_reason}"
                    ),
                )

            (
                item_subtotal,
                item_vat,
                item_total,
                item_tax_rate,
            ) = calculate_item(
                item,
                tax_decision,
            )

            subtotal += item_subtotal
            vat_amount += item_vat

            db.add(
                QuoteItemDB(
                    id=str(uuid4()),
                    quote_id=quote.id,
                    description=item.description,
                    service_category=(
                        item.service_category
                    ),
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    vat_rate=item_tax_rate,
                    tax_type=(
                        tax_decision.tax_type
                    ),
                    tax_treatment=(
                        tax_decision.tax_treatment
                    ),
                    tax_reason=(
                        tax_decision.tax_reason
                    ),
                    requires_manual_review=(
                        tax_decision
                        .requires_manual_review
                    ),
                    subtotal=item_subtotal,
                    vat_amount=item_vat,
                    total=item_total,
                )
            )

        quote.subtotal = money(subtotal)
        quote.vat_amount = money(vat_amount)
        quote.total = money(
            quote.subtotal + quote.vat_amount
        )

    quote.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(quote)

    return build_quote_response(db, quote)


@router.patch(
    "/{quote_id}/status",
    response_model=QuoteResponse,
)
def update_quote_status(
    quote_id: UUID,
    payload: QuoteStatusUpdate,
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

    current_status = QuoteStatus(quote.status)
    target_status = payload.status

    allowed = ALLOWED_TRANSITIONS[current_status]

    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Invalid status transition: "
                f"{current_status.value} -> {target_status.value}"
            ),
        )

    quote.status = target_status.value
    quote.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(quote)

    return build_quote_response(db, quote)


@router.post(
    "/{quote_id}/accept",
    response_model=QuoteResponse,
)
async def accept_quote(
    quote_id: UUID,
    acceptance_checked: bool = Form(...),
    acceptance_method: str = Form(...),
    accepted_at: datetime = Form(...),
    acceptance_reference: str | None = Form(
        default=None
    ),
    acceptance_note: str | None = Form(
        default=None
    ),
    file: UploadFile | None = File(
        default=None
    ),
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    user_id = (
        devisflow_context["user_id"]
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

    if (
        QuoteStatus(quote.status)
        != QuoteStatus.SENT
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Seul un devis envoyé peut "
                "être accepté."
            ),
        )

    if not acceptance_checked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Le bon pour accord doit être "
                "confirmé avant l'acceptation."
            ),
        )

    allowed_methods = {
        "email",
        "signed_quote",
        "good_for_agreement",
        "phone",
        "other",
    }

    if acceptance_method not in allowed_methods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Méthode d'acceptation invalide."
            ),
        )

    reference = (
        acceptance_reference.strip()
        if acceptance_reference
        else None
    )

    note = (
        acceptance_note.strip()
        if acceptance_note
        else None
    )

    document_path = None

    if file is not None:
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Le justificatif fourni "
                    "est vide."
                ),
            )

        try:
            document = upload_internal_document(
                organization_id=organization_id,
                product_code="devisflow",
                document_type="quote_acceptance",
                document_id=str(quote_id),
                file_name=(
                    file.filename
                    or "justificatif"
                ),
                content_type=(
                    file.content_type
                    or "application/octet-stream"
                ),
                content=content,
            )
        except RuntimeError as exc:
            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=str(exc),
            ) from exc

        document_path = document.get(
            "storage_path"
        )

        if not document_path:
            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "CoreFlow n'a pas retourné "
                    "le chemin du justificatif."
                ),
            )

    if (
        not reference
        and not note
        and not document_path
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Ajoutez une référence, une note "
                "ou un document de confirmation."
            ),
        )

    quote.acceptance_checked = 1
    quote.acceptance_method = acceptance_method
    quote.accepted_at = accepted_at
    quote.accepted_by_user_id = str(user_id)
    quote.acceptance_reference = reference
    quote.acceptance_note = note
    quote.acceptance_document_path = (
        document_path
    )

    ensure_quote_acceptance_is_valid(
        quote
    )

    quote.status = (
        QuoteStatus.ACCEPTED.value
    )

    quote.updated_at = (
        datetime.now(timezone.utc)
    )

    db.commit()
    db.refresh(quote)

    return build_quote_response(
        db,
        quote,
    )

@router.post(
    "/{quote_id}/send",
    response_model=QuoteResponse,
)
def send_quote(
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

    if QuoteStatus(quote.status) != QuoteStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only a ready quote can be sent"
            ),
        )

    if not quote.organization_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Quote organization is required "
                "before sending"
            ),
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

    try:
        commercial_context = (
            get_commercial_context(
                quote.organization_id
            )
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "CoreFlow commercial context "
                "is unavailable. Quote cannot "
                "be sent."
            ),
        ) from exc

    if not commercial_context.commercial_profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Commercial profile is required "
                "before sending"
            ),
        )

    if not commercial_context.tax_profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Tax profile is required "
                "before sending"
            ),
        )

    tax_decision = resolve_issuer_tax(
        commercial_context.tax_profile
    )

    if tax_decision.requires_manual_review:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Fiscal review required "
                "before sending: "
                f"{tax_decision.tax_reason}"
            ),
        )

    items = (
        db.query(QuoteItemDB)
        .filter(
            QuoteItemDB.quote_id == quote.id
        )
        .all()
    )

    if not items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Quote must contain at least "
                "one item before sending"
            ),
        )

    pdf_buffer = generate_quote_pdf(
        quote=quote,
        client=client,
        request=request,
        items=items,
        commercial_context=(
            commercial_context
        ),
    )

    pdf_bytes = pdf_buffer.getvalue()

    subject = (
        f"Devis {quote.quote_number}"
    )

    contact_name = (
        client.contact_name
        or client.company_name
        or "Madame, Monsieur"
    )

    body = (
        f"Bonjour {contact_name},\n\n"
        "Veuillez trouver en pièce jointe "
        f"notre devis {quote.quote_number}.\n\n"
        "Nous restons à votre disposition "
        "pour toute question.\n\n"
        "Cordialement"
    )

    email_log = DocumentEmailDB(
        id=str(uuid4()),
        organization_id=(
            quote.organization_id
        ),
        document_type="quote",
        document_id=quote.id,
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
                f"{quote.quote_number}.pdf"
            ),
            content=pdf_bytes,
            mime_type="application/pdf",
        ),
    )

    now = datetime.now(timezone.utc)

    if not result.success:
        email_log.status = "failed"
        email_log.error_message = (
            result.error_message
        )
        email_log.provider = (
            result.provider
        )

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Email delivery failed. "
                "Quote status was not changed."
            ),
        )

    email_log.status = "sent"
    email_log.provider = result.provider
    email_log.provider_message_id = (
        result.provider_message_id
    )
    email_log.sent_at = now
    email_log.error_message = None

    quote.issuer_snapshot = (
        commercial_context.model_dump(
            mode="json"
        )
    )
    quote.status = QuoteStatus.SENT.value
    quote.updated_at = now

    db.commit()
    db.refresh(email_log)
    db.refresh(quote)

    return build_quote_response(
        db,
        quote,
    )


@router.get("/{quote_id}/pdf")
def download_quote_pdf(
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

    items = (
        db.query(QuoteItemDB)
        .filter(QuoteItemDB.quote_id == quote.id)
        .all()
    )

    commercial_context = None

    if quote.issuer_snapshot:
        commercial_context = (
            CoreCommercialContext.model_validate(
                quote.issuer_snapshot
            )
        )

    elif quote.organization_id:
        try:
            commercial_context = (
                get_commercial_context(
                    quote.organization_id
                )
            )
        except RuntimeError:
            commercial_context = None

    pdf_buffer = generate_quote_pdf(
        quote=quote,
        client=client,
        request=request,
        items=items,
        commercial_context=(
            commercial_context
        ),
    )

    filename = f"{quote.quote_number}.pdf"

    return StreamingResponse(
    pdf_buffer,
    media_type="application/pdf",
    headers={
        "Content-Disposition": (
            f'inline; filename="{filename}"'
        )
    },
    )