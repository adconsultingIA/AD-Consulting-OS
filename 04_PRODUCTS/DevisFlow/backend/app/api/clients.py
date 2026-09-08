from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.database_models import ClientDB
from app.schemas.client import (
    ClientCreate,
    ClientResponse,
    ClientUpdate,
)
from app.core.devisflow_context import (
    get_devisflow_context,
)


router = APIRouter(
    prefix="/api/v1/clients",
    tags=["clients"],
)


def build_client_response(
    client: ClientDB,
) -> ClientResponse:
    return ClientResponse(
        id=client.id,
        company_name=client.company_name,
        contact_name=client.contact_name,
        email=client.email,
        phone=client.phone,
        address=client.address,
        country_code=client.country_code,
        region=client.region,
        customer_type=(
            client.customer_type
            or "business"
        ),
        tax_system=client.tax_system,
        tax_registered=client.tax_registered,
        tax_identifier=client.tax_identifier,
        notes=client.notes,
        active=client.active,
        created_at=client.created_at,
    )


@router.post(
    "",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    client = ClientDB(
        id=str(uuid4()),
        organization_id=organization_id,
        company_name=payload.company_name,
        contact_name=payload.contact_name,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        country_code=(
            payload.country_code.upper()
            if payload.country_code
            else None
        ),
        region=payload.region,
        customer_type=payload.customer_type,
        tax_system=payload.tax_system,
        tax_registered=payload.tax_registered,
        tax_identifier=payload.tax_identifier,
        notes=payload.notes,
        active=True,
    )

    db.add(client)
    db.commit()
    db.refresh(client)

    return build_client_response(client)


@router.get(
    "",
    response_model=list[ClientResponse],
)
def list_clients(
    db: Session = Depends(get_db),
    devisflow_context: dict = Depends(
        get_devisflow_context
    ),
):
    organization_id = (
        devisflow_context["organization_id"]
    )

    clients = (
        db.query(ClientDB)
        .filter(
            ClientDB.organization_id
            == organization_id
        )
        .order_by(ClientDB.company_name.asc())
        .all()
    )

    return [
        build_client_response(client)
        for client in clients
    ]


@router.get(
    "/{client_id}",
    response_model=ClientResponse,
)
def get_client(
    client_id: str,
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
            ClientDB.id == client_id,
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

    return build_client_response(client)


@router.patch(
    "/{client_id}",
    response_model=ClientResponse,
)
def update_client(
    client_id: str,
    payload: ClientUpdate,
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
            ClientDB.id == client_id,
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

    update_data = payload.model_dump(
        exclude_unset=True
    )

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data to update",
        )

    if (
        "country_code" in update_data
        and update_data["country_code"]
    ):
        update_data["country_code"] = (
            update_data["country_code"].upper()
        )

    for key, value in update_data.items():
        setattr(client, key, value)

    db.commit()
    db.refresh(client)

    return build_client_response(client)
