from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.database_models import ClientDB, RequestDB
from app.schemas.request import (
    RequestCreate,
    RequestResponse,
    RequestUpdate,
)
from app.core.devisflow_context import (
    get_devisflow_context,
)
from app.services.request_service import (
    create_request_for_organization,
)


router = APIRouter(
    prefix="/api/v1/requests",
    tags=["requests"],
)


@router.post(
    "",
    response_model=RequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_request(
    payload: RequestCreate,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    return create_request_for_organization(
        db,
        organization_id=organization_id,
        payload=payload,
        )

@router.get(
    "",
    response_model=list[RequestResponse],
)
def list_requests(
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    requests = (
        db.query(RequestDB)
        .filter(
            RequestDB.organization_id
            == organization_id
        )
        .order_by(RequestDB.created_at.desc())
        .all()
    )

    return [
        RequestResponse(
            id=UUID(request.id),
            client_id=UUID(request.client_id),
            title=request.title,
            description=request.description,
            budget=request.budget,
            deadline=request.deadline,
            status=request.status,
            created_at=request.created_at,
        )
        for request in requests
    ]


@router.get(
    "/{request_id}",
    response_model=RequestResponse,
)
def get_request(
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
            RequestDB.id
            == str(request_id),
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


@router.patch(
    "/{request_id}",
    response_model=RequestResponse,
)
def update_request(
    request_id: UUID,
    payload: RequestUpdate,
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
            RequestDB.id
            == str(request_id),
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

    update_data = payload.model_dump(
        exclude_unset=True
    )

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data to update",
        )

    if "client_id" in update_data:
        client_id = update_data["client_id"]

        if client_id is not None:
            client = (
                db.query(ClientDB)
                .filter(
                    ClientDB.id
                    == str(client_id),
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

            update_data[
                "client_id"
            ] = str(client_id)

    for key, value in update_data.items():
        setattr(
            request,
            key,
            value,
        )

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


@router.get(
    "/client/{client_id}",
    response_model=list[RequestResponse],
)
def list_client_requests(
    client_id: UUID,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    client = (
        db.query(ClientDB)
        .filter(
            ClientDB.id == str(client_id),
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

    requests = (
        db.query(RequestDB)
        .filter(
            RequestDB.client_id
            == str(client_id),
            RequestDB.organization_id
            == organization_id,
        )
        .order_by(RequestDB.created_at.desc())
        .all()
    )

    return [
        RequestResponse(
            id=UUID(request.id),
            client_id=UUID(request.client_id),
            title=request.title,
            description=request.description,
            budget=request.budget,
            deadline=request.deadline,
            status=request.status,
            created_at=request.created_at,
        )
        for request in requests
    ]
