from __future__ import annotations

import requests

from fastapi import (
    HTTPException,
    status,
)

from app.services.coreflow_client import (
    DEFAULT_TIMEOUT,
    _coreflow_api_url,
)


COPILOT_WRITE_PERMISSION = (
    "workflows:write"
)


def check_coreflow_permission(
    *,
    role: str,
    permission: str,
) -> bool:
    """
    Demande à CoreFlow si un rôle possède
    une permission donnée.

    CoreFlow reste l'unique source de vérité
    de la matrice rôles / permissions.
    """

    url = (
        f"{_coreflow_api_url()}"
        "/api/v1/access/check"
    )

    try:
        response = requests.get(
            url,
            params={
                "role": role,
                "permission": permission,
            },
            headers={
                "Accept": "application/json",
            },
            timeout=DEFAULT_TIMEOUT,
        )

    except requests.RequestException as exc:
        raise RuntimeError(
            "CoreFlow est indisponible "
            "pour le contrôle des permissions."
        ) from exc

    if not response.ok:
        raise RuntimeError(
            "Erreur CoreFlow "
            "lors du contrôle des permissions "
            f"({response.status_code}): "
            f"{response.text}"
        )

    payload = response.json()

    return (
        payload.get("allowed")
        is True
    )


def require_copilot_write_permission(
    *,
    role: str,
) -> None:
    """
    Les actions Copilot qui créent ou modifient
    des objets métier nécessitent exactement
    la permission CoreFlow workflows:write.
    """

    try:
        allowed = (
            check_coreflow_permission(
                role=role,
                permission=(
                    COPILOT_WRITE_PERMISSION
                ),
            )
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=str(exc),
        ) from exc

    if not allowed:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Votre rôle ne permet pas "
                "d'exécuter cette action métier."
            ),
        )
