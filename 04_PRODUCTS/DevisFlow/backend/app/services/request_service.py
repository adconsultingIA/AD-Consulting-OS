from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.database_models import (
    ClientDB,
    RequestDB,
)
from app.schemas.request import (
    RequestCreate,
    RequestResponse,
)


def create_request_for_organization(
    db: Session,
    *,
    organization_id: str,
    payload: RequestCreate,
) -> RequestResponse:
    client = (
        db.query(ClientDB)
        .filter(
            ClientDB.id
            == str(payload.client_id),
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

    request = RequestDB(
        id=str(uuid4()),
        organization_id=organization_id,
        client_id=str(payload.client_id),
        title=payload.title,
        description=payload.description,
        budget=payload.budget,
        deadline=payload.deadline,
        status="new",
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return RequestResponse(
        id=UUID(request.id),
        client_id=UUID(request.client_id),
        title=request.title,
        description=request.description,
        budget=request.budget,
        deadline=request.deadline,
        status=request.status,
        created_at=request.created_at,
    )
