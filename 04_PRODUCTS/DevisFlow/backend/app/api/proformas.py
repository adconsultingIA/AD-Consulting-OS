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
from fastapi.responses import StreamingResponse

from app.core.database import get_db
from app.core.devisflow_context import (
    get_devisflow_context,
)

from app.models.database_models import (
    ClientDB,
    ProformaDB,
    ProformaItemDB,
    QuoteDB,
    QuoteItemDB,
    RequestDB,
)

from app.schemas.proforma import (
    ProformaItemResponse,
    ProformaResponse,
    ProformaStatusUpdate,
    ProformaUpdate,
)

from app.services.document_number_service import (
    next_document_number,
)

from app.schemas.coreflow import (
    CoreCommercialContext,
)

from app.services.coreflow_client import (
    get_commercial_context,
    get_devisflow_organization_id,
)

from app.services.proforma_pdf_service import (
    generate_proforma_pdf,
)

from app.services.quote_acceptance_service import (
    ensure_quote_acceptance_is_valid,
)

from app.models.document_email import (
    DocumentEmailDB,
)

from app.services.email_service import (
    EmailAttachment,
    send_email,
)


router = APIRouter(
    prefix="/api/v1/proformas",
    tags=["Proformas"],
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
        "cancelled",
    },
    "cancelled": set(),
}


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

def generate_proforma_number(
    db: Session,
) -> str:
    year = date.today().year

    return next_document_number(
        db,
        document_type="proforma",
        prefix="PRO",
        table_name="proformas",
        column_name="proforma_number",
        year=year,
    )


def serialize_proforma(
    proforma: ProformaDB,
    db: Session,
    organization_id: str,
) -> ProformaResponse:
    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id == proforma.quote_id,
            QuoteDB.organization_id
            == organization_id,
        )
        .first()
    )

    items = (
        db.query(ProformaItemDB)
        .filter(
            ProformaItemDB.proforma_id
            == proforma.id
        )
        .all()
    )

    return ProformaResponse(
        id=proforma.id,
        quote_id=proforma.quote_id,
        quote_number=(
            quote.quote_number
            if quote
            else None
        ),
        organization_id=(
            proforma.organization_id
        ),
        proforma_number=(
            proforma.proforma_number
        ),
        status=proforma.status,
        issue_date=proforma.issue_date,
        valid_until=proforma.valid_until,
        notes=proforma.notes,
        items=[
            ProformaItemResponse(
                id=item.id,
                quote_item_id=(
                    item.quote_item_id
                ),
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
                    item.requires_manual_review
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
        ],
        subtotal=Decimal(
            proforma.subtotal or 0
        ),
        vat_amount=Decimal(
            proforma.vat_amount or 0
        ),
        total=Decimal(
            proforma.total or 0
        ),
        created_at=proforma.created_at,
        updated_at=proforma.updated_at,
    )


def get_proforma_or_404(
    proforma_id: UUID,
    db: Session,
    organization_id: str,
) -> ProformaDB:
    proforma = (
        db.query(ProformaDB)
        .filter(
            ProformaDB.id
            == str(proforma_id),
            ProformaDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not proforma:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proforma not found",
        )

    return proforma


# ---------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------

@router.get(
    "",
    response_model=list[ProformaResponse],
)
def list_proformas(
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    proformas = (
        db.query(ProformaDB)
        .filter(
            ProformaDB.organization_id
            == organization_id
        )
        .order_by(
            ProformaDB.created_at.desc()
        )
        .all()
    )

    return [
        serialize_proforma(
            proforma,
            db,
            organization_id,
        )
        for proforma in proformas
    ]


# ---------------------------------------------------------------------
# READ
# ---------------------------------------------------------------------

@router.get(
    "/{proforma_id}",
    response_model=ProformaResponse,
)
def get_proforma(
    proforma_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    proforma = get_proforma_or_404(
        proforma_id,
        db,
        organization_id,
    )

    return serialize_proforma(
        proforma,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# CREATE FROM ACCEPTED QUOTE
# ---------------------------------------------------------------------

@router.post(
    "/from-quote/{quote_id}",
    response_model=ProformaResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_proforma_from_quote(
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
                "create a proforma"
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
            status_code=status.HTTP_409_CONFLICT,
            detail="The quote has no items",
        )

    proforma = ProformaDB(
        id=str(uuid4()),
        quote_id=quote.id,
        organization_id=quote.organization_id,
        issuer_snapshot=quote.issuer_snapshot,
        proforma_number=(
            generate_proforma_number(db)
        ),
        status="draft",
        issue_date=None,
        valid_until=quote.valid_until,
        notes=quote.notes,
        subtotal=quote.subtotal,
        vat_amount=quote.vat_amount,
        total=quote.total,
    )

    db.add(proforma)
    db.flush()

    for quote_item in quote_items:
        item = ProformaItemDB(
            id=str(uuid4()),
            proforma_id=proforma.id,
            quote_item_id=quote_item.id,
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
    db.refresh(proforma)

    return serialize_proforma(
        proforma,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------

@router.patch(
    "/{proforma_id}",
    response_model=ProformaResponse,
)
def update_proforma(
    proforma_id: UUID,
    payload: ProformaUpdate,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    proforma = get_proforma_or_404(
        proforma_id,
        db,
        organization_id,
    )

    if proforma.status not in {
        "draft",
        "issued",
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only draft or issued proformas "
                "can be updated"
            ),
        )

    data = payload.model_dump(
        exclude_unset=True
    )

    for field, value in data.items():
        setattr(
            proforma,
            field,
            value,
        )

    db.commit()
    db.refresh(proforma)

    return serialize_proforma(
        proforma,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# STATUS
# ---------------------------------------------------------------------

@router.patch(
    "/{proforma_id}/status",
    response_model=ProformaResponse,
)
def update_proforma_status(
    proforma_id: UUID,
    payload: ProformaStatusUpdate,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    proforma = get_proforma_or_404(
        proforma_id,
        db,
        organization_id,
    )

    current_status = proforma.status
    target_status = payload.status

    if target_status == current_status:
        return serialize_proforma(
            proforma,
            db,
            organization_id,
        )

    allowed = (
        ALLOWED_STATUS_TRANSITIONS
        .get(
            current_status,
            set(),
        )
    )

    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Invalid proforma status transition: "
                f"{current_status} -> {target_status}"
            ),
        )

    proforma.status = target_status

    if (
        target_status == "issued"
        and proforma.issue_date is None
    ):
        proforma.issue_date = date.today()

    db.commit()
    db.refresh(proforma)

    return serialize_proforma(
        proforma,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------

@router.get(
    "/{proforma_id}/pdf",
)
def get_proforma_pdf(
    proforma_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    proforma = get_proforma_or_404(
        proforma_id,
        db,
        organization_id,
    )

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id == proforma.quote_id,
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
        db.query(ProformaItemDB)
        .filter(
            ProformaItemDB.proforma_id
            == proforma.id
        )
        .all()
    )

    if not items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Proforma must contain at least "
                "one item"
            ),
        )

    commercial_context = None

    if proforma.issuer_snapshot:
        commercial_context = (
            CoreCommercialContext.model_validate(
                proforma.issuer_snapshot
            )
        )
    elif proforma.organization_id:
        try:
            commercial_context = (
                get_commercial_context(
                    proforma.organization_id
                )
            )
        except RuntimeError:
            commercial_context = None

    pdf_buffer = generate_proforma_pdf(
        proforma=proforma,
        quote=quote,
        request=request,
        client=client,
        items=items,
        commercial_context=commercial_context,
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                f'inline; filename="{proforma.proforma_number}.pdf"'
        },
    )


# ---------------------------------------------------------------------
# SEND
# ---------------------------------------------------------------------

@router.post(
    "/{proforma_id}/send",
    response_model=ProformaResponse,
)
def send_proforma(
    proforma_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    proforma = get_proforma_or_404(
        proforma_id,
        db,
        organization_id,
    )

    if proforma.status != "issued":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only an issued proforma "
                "can be sent"
            ),
        )

    if not proforma.organization_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Proforma organization is "
                "required before sending"
            ),
        )

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id == proforma.quote_id,
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
        db.query(ProformaItemDB)
        .filter(
            ProformaItemDB.proforma_id
            == proforma.id
        )
        .all()
    )

    if not items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Proforma must contain at least "
                "one item before sending"
            ),
        )

    commercial_context = None

    if proforma.issuer_snapshot:
        commercial_context = (
            CoreCommercialContext.model_validate(
                proforma.issuer_snapshot
            )
        )
    else:
        try:
            commercial_context = (
                get_commercial_context(
                    proforma.organization_id
                )
            )
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "CoreFlow commercial context "
                    "is unavailable. Proforma "
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

    pdf_buffer = generate_proforma_pdf(
        proforma=proforma,
        quote=quote,
        request=request,
        client=client,
        items=items,
        commercial_context=commercial_context,
    )

    pdf_bytes = pdf_buffer.getvalue()

    subject = (
        f"Proforma {proforma.proforma_number}"
    )

    contact_name = (
        client.contact_name
        or client.company_name
        or "Madame, Monsieur"
    )

    body = (
        f"Bonjour {contact_name},\n\n"
        "Veuillez trouver en pièce jointe "
        f"notre proforma {proforma.proforma_number}.\n\n"
        "Nous restons à votre disposition "
        "pour toute question.\n\n"
        "Cordialement"
    )

    email_log = DocumentEmailDB(
        id=str(uuid4()),
        organization_id=(
            proforma.organization_id
        ),
        document_type="proforma",
        document_id=proforma.id,
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
                f"{proforma.proforma_number}.pdf"
            ),
            content=pdf_bytes,
            mime_type="application/pdf",
        ),
    )

    if not result.success:
        email_log.status = "failed"
        email_log.error_message = (
            result.error_message
        )

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                result.error_message
                or "Proforma email could not be sent"
            ),
        )

    email_log.status = "sent"
    email_log.provider_message_id = (
        result.provider_message_id
    )
    email_log.sent_at = datetime.now()

    proforma.status = "sent"

    db.commit()
    db.refresh(proforma)

    return serialize_proforma(
        proforma,
        db,
        organization_id,
    )


# ---------------------------------------------------------------------
# DELETE DRAFT
# ---------------------------------------------------------------------

@router.delete(
    "/{proforma_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_proforma(
    proforma_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    proforma = get_proforma_or_404(
        proforma_id,
        db,
        organization_id,
    )

    if proforma.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only a draft proforma "
                "can be deleted"
            ),
        )

    (
        db.query(ProformaItemDB)
        .filter(
            ProformaItemDB.proforma_id
            == proforma.id
        )
        .delete(
            synchronize_session=False
        )
    )

    db.delete(proforma)
    db.commit()

    return None
