from fastapi import (
    APIRouter,
    Depends,
    Query,
)

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.document_email import DocumentEmailDB
from app.schemas.document_email import DocumentEmailResponse
from app.services.coreflow_client import (
    get_devisflow_organization_id,
)


router = APIRouter(
    prefix="/api/v1/document-emails",
    tags=["Document emails"],
)


@router.get(
    "/counts",
    response_model=dict[str, int],
)
def count_document_emails(
    document_type: str = Query(...),
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    rows = (
        db.query(
            DocumentEmailDB.document_id,
            func.count(DocumentEmailDB.id),
        )
        .filter(
            DocumentEmailDB.organization_id
            == organization_id,
            DocumentEmailDB.document_type
            == document_type,
            DocumentEmailDB.status == "sent",
        )
        .group_by(
            DocumentEmailDB.document_id
        )
        .all()
    )

    return {
        document_id: count
        for document_id, count in rows
    }


@router.get(
    "",
    response_model=list[DocumentEmailResponse],
)
def list_document_emails(
    document_type: str = Query(...),
    document_id: str = Query(...),
    db: Session = Depends(get_db),
):
    organization_id = (
        get_devisflow_organization_id()
    )

    rows = (
        db.query(DocumentEmailDB)
        .filter(
            DocumentEmailDB.organization_id
            == organization_id,
            DocumentEmailDB.document_type
            == document_type,
            DocumentEmailDB.document_id
            == document_id,
        )
        .order_by(
            DocumentEmailDB.created_at.desc()
        )
        .all()
    )

    return rows
