from fastapi import (
    APIRouter,
    Header,
    HTTPException,
)

from app.schemas.coreflow import (
    CoreCommercialContext,
    CoreWorkspaceContext,
)
from app.services.coreflow_client import (
    get_commercial_context,
    get_current_identity,
    get_devisflow_organization_id,
    get_workspace_context,
    resolve_devisflow_context,
)


router = APIRouter(
    prefix="/api/v1/coreflow",
    tags=["CoreFlow"],
)


@router.get(
    "/organizations/{organization_id}/commercial-context",
    response_model=CoreCommercialContext,
)
def read_coreflow_commercial_context(
    organization_id: str,
):
    try:
        return get_commercial_context(
            organization_id
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


@router.get(
    "/workspace-context",
    response_model=CoreWorkspaceContext,
)
def read_coreflow_workspace_context():
    try:
        organization_id = (
            get_devisflow_organization_id()
        )

        return get_workspace_context(
            organization_id
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


@router.get(
    "/authenticated-workspace-context",
    response_model=CoreWorkspaceContext,
)
def read_authenticated_workspace_context(
    authorization: str | None = Header(
        default=None,
        alias="Authorization",
    ),
    organization_id: str | None = Header(
        default=None,
        alias="X-Organization-Id",
    ),
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization required",
        )

    prefix = "Bearer "

    if not authorization.startswith(prefix):
        raise HTTPException(
            status_code=401,
            detail="Bearer token required",
        )

    access_token = authorization[
        len(prefix):
    ].strip()

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Bearer token required",
        )

    if not organization_id:
        raise HTTPException(
            status_code=400,
            detail="X-Organization-Id required",
        )

    try:
        context = resolve_devisflow_context(
            access_token=access_token,
            organization_id=organization_id,
        )

        return get_workspace_context(
            context["organization_id"]
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        message = str(exc)

        if (
            "401" in message
            or "403" in message
        ):
            raise HTTPException(
                status_code=401,
                detail="Session utilisateur invalide.",
            ) from exc

        raise HTTPException(
            status_code=502,
            detail=message,
        ) from exc


@router.get("/me")
def read_coreflow_current_identity(
    authorization: str | None = Header(
        default=None,
        alias="Authorization",
    ),
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization required",
        )

    prefix = "Bearer "

    if not authorization.startswith(prefix):
        raise HTTPException(
            status_code=401,
            detail="Bearer token required",
        )

    access_token = authorization[
        len(prefix):
    ].strip()

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Bearer token required",
        )

    try:
        return get_current_identity(
            access_token
        )

    except RuntimeError as exc:
        message = str(exc)

        if (
            "401" in message
            or "403" in message
        ):
            raise HTTPException(
                status_code=401,
                detail="Session utilisateur invalide.",
            ) from exc

        raise HTTPException(
            status_code=502,
            detail=message,
        ) from exc
