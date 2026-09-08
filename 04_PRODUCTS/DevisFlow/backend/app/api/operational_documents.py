from datetime import date, datetime
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

from app.models.database_models import (
    OperationalDocumentDB,
    OperationalDocumentItemDB,
    QuoteDB,
    QuoteItemDB,
    RequestDB,
    ClientDB,
)

from app.schemas.operational_document import (
    OperationalDocumentCreateFromQuote,
    OperationalDocumentResponse,
    OperationalDocumentStatusUpdate,
    OperationalDocumentUpdate,
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

from app.services.operational_document_pdf_service import (
    generate_operational_document_pdf,
)

from app.models.document_email import (
    DocumentEmailDB,
)

from app.services.email_service import (
    EmailAttachment,
    send_email,
)


router = APIRouter(
    prefix="/api/v1/operational-documents",
    tags=["Operational Documents"],
)


DOCUMENT_CONFIG = {
    "delivery_note": {
        "prefix": "BL",
        "counter_type": "delivery_note",
    },
    "intervention_note": {
        "prefix": "BI",
        "counter_type": "intervention_note",
    },
}


def serialize_operational_document(
    document: OperationalDocumentDB,
    db: Session,
    organization_id: str,
):
    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id ==
            document.quote_id,
            QuoteDB.organization_id
            == organization_id,
        )
        .first()
    )

    items = (
        db.query(
            OperationalDocumentItemDB
        )
        .filter(
            OperationalDocumentItemDB
            .operational_document_id
            == document.id
        )
        .all()
    )

    return {
        "id": document.id,
        "quote_id": document.quote_id,
        "quote_number": (
            quote.quote_number
            if quote
            else None
        ),
        "organization_id":
            document.organization_id,
        "document_type":
            document.document_type,
        "document_number":
            document.document_number,
        "status":
            document.status,
        "issue_date":
            document.issue_date,
        "execution_date":
            document.execution_date,
        "location_address":
            document.location_address,
        "notes":
            document.notes,
        "items": [
            {
                "id": item.id,
                "quote_item_id":
                    item.quote_item_id,
                "description":
                    item.description,
                "quantity":
                    item.quantity,
                "unit_price":
                    item.unit_price,
                "vat_rate":
                    item.vat_rate,
                "tax_type":
                    item.tax_type,
                "tax_treatment":
                    item.tax_treatment,
                "tax_reason":
                    item.tax_reason,
                "requires_manual_review":
                    item.requires_manual_review,
                "subtotal":
                    item.subtotal,
                "vat_amount":
                    item.vat_amount,
                "total":
                    item.total,
            }
            for item in items
        ],
        "subtotal":
            document.subtotal,
        "vat_amount":
            document.vat_amount,
        "total":
            document.total,
        "created_at":
            document.created_at,
        "updated_at":
            document.updated_at,
    }


def get_document_or_404(
    document_id: UUID,
    db: Session,
    organization_id: str,
):
    document = (
        db.query(
            OperationalDocumentDB
        )
        .filter(
            OperationalDocumentDB.id
            == str(document_id),
            OperationalDocumentDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=(
                "Operational document "
                "not found"
            ),
        )

    return document


@router.get(
    "",
    response_model=list[
        OperationalDocumentResponse
    ],
)
def list_operational_documents(
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    documents = (
        db.query(
            OperationalDocumentDB
        )
        .filter(
            OperationalDocumentDB.organization_id
            == organization_id
        )
        .order_by(
            OperationalDocumentDB
            .created_at.desc()
        )
        .all()
    )

    return [
        serialize_operational_document(
            document,
            db,
            organization_id,
        )
        for document in documents
    ]


@router.get(
    "/{document_id}",
    response_model=
        OperationalDocumentResponse,
)
def get_operational_document(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    document = get_document_or_404(
        document_id,
        db,
        organization_id,
    )

    return serialize_operational_document(
        document,
        db,
        organization_id,
    )


@router.post(
    "/from-quote/{quote_id}",
    response_model=
        OperationalDocumentResponse,
    status_code=
        status.HTTP_201_CREATED,
)
def create_operational_document_from_quote(
    quote_id: UUID,
    payload:
        OperationalDocumentCreateFromQuote,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
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
                "can create an operational "
                "document"
            ),
        )

    quote_items = (
        db.query(QuoteItemDB)
        .filter(
            QuoteItemDB.quote_id ==
            quote.id
        )
        .all()
    )

    if not quote_items:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Quote must contain at "
                "least one item"
            ),
        )

    config = DOCUMENT_CONFIG[
        payload.document_type
    ]

    document_number = (
        next_document_number(
            db,
            document_type=
                config[
                    "counter_type"
                ],
            prefix=
                config["prefix"],
            table_name=
                "operational_documents",
            column_name=
                "document_number",
            year=date.today().year,
        )
    )

    document_id = str(uuid4())

    document = (
        OperationalDocumentDB(
            id=document_id,
            quote_id=quote.id,
            organization_id=
                organization_id,
            issuer_snapshot=
                quote.issuer_snapshot,
            document_type=
                payload.document_type,
            document_number=
                document_number,
            status="draft",
            execution_date=None,
            location_address=None,
            notes=quote.notes,
            subtotal=quote.subtotal,
            vat_amount=
                quote.vat_amount,
            total=quote.total,
        )
    )

    db.add(document)

    for quote_item in quote_items:
        item = (
            OperationalDocumentItemDB(
                id=str(uuid4()),
                operational_document_id=
                    document_id,
                quote_item_id=
                    quote_item.id,
                description=
                    quote_item.description,
                quantity=
                    quote_item.quantity,
                unit_price=
                    quote_item.unit_price,
                vat_rate=
                    quote_item.vat_rate,
                tax_type=
                    quote_item.tax_type,
                tax_treatment=
                    quote_item.tax_treatment,
                tax_reason=
                    quote_item.tax_reason,
                requires_manual_review=
                    quote_item
                    .requires_manual_review,
                subtotal=
                    quote_item.subtotal,
                vat_amount=
                    quote_item.vat_amount,
                total=
                    quote_item.total,
            )
        )

        db.add(item)

    db.commit()
    db.refresh(document)

    return serialize_operational_document(
        document,
        db,
        organization_id,
    )


@router.patch(
    "/{document_id}",
    response_model=
        OperationalDocumentResponse,
)
def update_operational_document(
    document_id: UUID,
    payload:
        OperationalDocumentUpdate,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    document = get_document_or_404(
        document_id,
        db,
        organization_id,
    )

    if document.status not in {
        "draft",
        "issued",
    }:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Only draft or issued "
                "operational documents "
                "can be updated"
            ),
        )

    data = payload.model_dump(
        exclude_unset=True
    )

    for key, value in data.items():
        setattr(
            document,
            key,
            value,
        )

    db.commit()
    db.refresh(document)

    return serialize_operational_document(
        document,
        db,
        organization_id,
    )


@router.patch(
    "/{document_id}/status",
    response_model=
        OperationalDocumentResponse,
)
def update_operational_document_status(
    document_id: UUID,
    payload:
        OperationalDocumentStatusUpdate,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    document = get_document_or_404(
        document_id,
        db,
        organization_id,
    )

    current = document.status
    target = payload.status

    allowed = {
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

    if target == current:
        return serialize_operational_document(
            document,
            db,
            organization_id,
        )

    if target not in allowed[current]:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Invalid operational "
                "document status "
                f"transition: "
                f"{current} -> {target}"
            ),
        )

    document.status = target

    if target == "issued":
        document.issue_date = (
            document.issue_date
            or date.today()
        )

    db.commit()
    db.refresh(document)

    return serialize_operational_document(
        document,
        db,
        organization_id,
    )



# ---------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------

@router.get(
    "/{document_id}/pdf",
)
def download_operational_document_pdf(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    document = get_document_or_404(
        document_id,
        db,
        organization_id,
    )

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id ==
            document.quote_id,
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

    items = (
        db.query(
            OperationalDocumentItemDB
        )
        .filter(
            OperationalDocumentItemDB
            .operational_document_id
            == document.id
        )
        .all()
    )

    if not items:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Operational document "
                "must contain at least "
                "one item"
            ),
        )

    commercial_context = None

    if document.issuer_snapshot:
        commercial_context = (
            CoreCommercialContext
            .model_validate(
                document.issuer_snapshot
            )
        )

    elif document.organization_id:
        try:
            commercial_context = (
                get_commercial_context(
                    document.organization_id
                )
            )
        except RuntimeError:
            commercial_context = None

    pdf_buffer = (
        generate_operational_document_pdf(
            document=document,
            quote=quote,
            request=request,
            client=client,
            items=items,
            commercial_context=
                commercial_context,
        )
    )

    filename = (
        f"{document.document_number}.pdf"
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


# ---------------------------------------------------------------------
# SEND
# ---------------------------------------------------------------------

@router.post(
    "/{document_id}/send",
    response_model=
        OperationalDocumentResponse,
)
def send_operational_document(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    document = get_document_or_404(
        document_id,
        db,
        organization_id,
    )

    if document.status != "issued":
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Only an issued operational "
                "document can be sent"
            ),
        )

    if not document.organization_id:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Operational document "
                "organization is required "
                "before sending"
            ),
        )

    quote = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.id ==
            document.quote_id,
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

    if not client.email:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Client email is required "
                "before sending"
            ),
        )

    items = (
        db.query(
            OperationalDocumentItemDB
        )
        .filter(
            OperationalDocumentItemDB
            .operational_document_id
            == document.id
        )
        .all()
    )

    if not items:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Operational document "
                "must contain at least "
                "one item before sending"
            ),
        )

    commercial_context = None

    if document.issuer_snapshot:
        commercial_context = (
            CoreCommercialContext
            .model_validate(
                document.issuer_snapshot
            )
        )

    else:
        try:
            commercial_context = (
                get_commercial_context(
                    document.organization_id
                )
            )
        except RuntimeError as exc:
            raise HTTPException(
                status_code=
                    status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "CoreFlow commercial "
                    "context is unavailable. "
                    "Document cannot be sent."
                ),
            ) from exc

    if not commercial_context:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Commercial context is "
                "required before sending"
            ),
        )

    pdf_buffer = (
        generate_operational_document_pdf(
            document=document,
            quote=quote,
            request=request,
            client=client,
            items=items,
            commercial_context=
                commercial_context,
        )
    )

    pdf_bytes = (
        pdf_buffer.getvalue()
    )

    is_delivery_note = (
        document.document_type ==
        "delivery_note"
    )

    document_label = (
        "Bon de livraison"
        if is_delivery_note
        else "Bon d’intervention"
    )

    subject = (
        f"{document_label} "
        f"{document.document_number}"
    )

    contact_name = (
        client.contact_name
        or client.company_name
        or "Madame, Monsieur"
    )

    body = (
        f"Bonjour {contact_name},\n\n"
        "Veuillez trouver en pièce jointe "
        f"notre {document_label.lower()} "
        f"{document.document_number}.\n\n"
        "Nous restons à votre disposition "
        "pour toute question.\n\n"
        "Cordialement"
    )

    email_log = DocumentEmailDB(
        id=str(uuid4()),
        organization_id=
            document.organization_id,
        document_type=
            document.document_type,
        document_id=document.id,
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
                f"{document.document_number}.pdf"
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
                "Operational document "
                "status was not changed."
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

    document.status = "sent"

    if hasattr(
        document,
        "updated_at",
    ):
        document.updated_at = now

    db.commit()

    db.refresh(email_log)
    db.refresh(document)

    return serialize_operational_document(
        document,
        db,
        organization_id,
    )


@router.delete(
    "/{document_id}",
    status_code=
        status.HTTP_204_NO_CONTENT,
)
def delete_operational_document(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    document = get_document_or_404(
        document_id,
        db,
        organization_id,
    )

    if document.status != "draft":
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Only a draft operational "
                "document can be deleted"
            ),
        )

    db.query(
        OperationalDocumentItemDB
    ).filter(
        OperationalDocumentItemDB
        .operational_document_id
        == document.id
    ).delete(
        synchronize_session=False
    )

    db.delete(document)
    db.commit()
