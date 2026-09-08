from fastapi import (
    Header,
    HTTPException,
    status,
)

from app.services.coreflow_client import (
    resolve_devisflow_context,
)


def get_devisflow_context(
    authorization: str | None = Header(
        default=None,
        alias="Authorization",
    ),
    organization_id: str | None = Header(
        default=None,
        alias="X-Organization-Id",
    ),
) -> dict:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization required",
        )

    prefix = "Bearer "

    if not authorization.startswith(prefix):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
        )

    access_token = authorization[
        len(prefix):
    ].strip()

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
        )

    if not organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Organization-Id required",
        )

    try:
        return resolve_devisflow_context(
            access_token=access_token,
            organization_id=organization_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        message = str(exc)

        if (
            "401" in message
            or "403" in message
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session utilisateur invalide.",
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=message,
        ) from exc
