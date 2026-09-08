import os
from uuid import UUID

import requests
from dotenv import load_dotenv

from app.schemas.coreflow import (
    CoreBankAccount,
    CoreCommercialContext,
    CoreCommercialProfile,
    CoreLegalIdentifier,
    CorePaymentPreferences,
    CoreProductBrand,
    CoreTaxProfile,
    CoreWorkspaceContext,
)


load_dotenv(".env")

DEFAULT_TIMEOUT = 10


def get_devisflow_organization_id() -> str:
    organization_id = os.getenv(
        "DEVISFLOW_ORGANIZATION_ID"
    )

    if not organization_id:
        raise RuntimeError(
            "DEVISFLOW_ORGANIZATION_ID "
            "n'est pas configuré."
        )

    try:
        UUID(organization_id)
    except ValueError as exc:
        raise RuntimeError(
            "DEVISFLOW_ORGANIZATION_ID "
            "n'est pas un UUID valide."
        ) from exc

    return organization_id


def _coreflow_api_url() -> str:
    url = os.getenv(
        "COREFLOW_API_URL",
        "http://127.0.0.1:8000",
    )

    return url.rstrip("/")


def _service_headers() -> dict[str, str]:
    service_key = os.getenv(
        "COREFLOW_SERVICE_KEY"
    )

    if not service_key:
        raise RuntimeError(
            "COREFLOW_SERVICE_KEY "
            "n'est pas configurée dans DevisFlow."
        )

    return {
        "Accept": "application/json",
        "X-CoreFlow-Service-Key": service_key,
    }


def upload_internal_document(
    *,
    organization_id: str,
    product_code: str,
    document_type: str,
    document_id: str,
    file_name: str,
    content_type: str,
    content: bytes,
) -> dict:
    url = (
        f"{_coreflow_api_url()}"
        "/api/v1/internal/documents/upload"
    )

    try:
        response = requests.post(
            url,
            headers=_service_headers(),
            data={
                "organization_id":
                    organization_id,
                "product_code":
                    product_code,
                "document_type":
                    document_type,
                "document_id":
                    document_id,
            },
            files={
                "file": (
                    file_name,
                    content,
                    content_type,
                ),
            },
            timeout=30,
        )

    except requests.RequestException as exc:
        raise RuntimeError(
            "CoreFlow document storage "
            "est indisponible."
        ) from exc

    if not response.ok:
        raise RuntimeError(
            "Erreur stockage CoreFlow "
            f"{response.status_code}: "
            f"{response.text}"
        )

    return response.json()


def get_commercial_context(
    organization_id: str,
) -> CoreCommercialContext:
    url = (
        f"{_coreflow_api_url()}"
        "/api/v1/internal/organizations/"
        f"{organization_id}/commercial-context"
    )

    try:
        response = requests.get(
            url,
            params={
                "product_code": "DF",
            },
            headers=_service_headers(),
            timeout=DEFAULT_TIMEOUT,
        )

    except requests.RequestException as exc:
        raise RuntimeError(
            "CoreFlow est indisponible."
        ) from exc

    if not response.ok:
        raise RuntimeError(
            "Erreur CoreFlow "
            f"{response.status_code}: "
            f"{response.text}"
        )

    return CoreCommercialContext(
        **response.json()
    )


# ==========================================================
# Compatibility helpers
# ==========================================================


def get_commercial_profile(
    organization_id: str,
) -> CoreCommercialProfile | None:
    return get_commercial_context(
        organization_id
    ).commercial_profile


def get_legal_identifiers(
    organization_id: str,
) -> list[CoreLegalIdentifier]:
    return get_commercial_context(
        organization_id
    ).legal_identifiers


def get_default_bank_account(
    organization_id: str,
) -> CoreBankAccount | None:
    return get_commercial_context(
        organization_id
    ).default_bank_account


def get_bank_accounts(
    organization_id: str,
) -> list[CoreBankAccount]:
    account = get_default_bank_account(
        organization_id
    )

    if account is None:
        return []

    return [account]


def get_payment_preferences(
    organization_id: str,
) -> CorePaymentPreferences | None:
    return get_commercial_context(
        organization_id
    ).payment_preferences


def get_tax_profile(
    organization_id: str,
) -> CoreTaxProfile | None:
    return get_commercial_context(
        organization_id
    ).tax_profile


def get_product_brand(
    organization_id: str,
    product_code: str = "DF",
) -> CoreProductBrand | None:
    context = get_commercial_context(
        organization_id
    )

    return context.product_brand


def get_workspace_context(
    organization_id: str,
) -> CoreWorkspaceContext:
    url = (
        f"{_coreflow_api_url()}"
        "/api/v1/internal/organizations/"
        f"{organization_id}/workspace-context"
    )

    try:
        response = requests.get(
            url,
            params={
                "product_code": "devisflow",
            },
            headers=_service_headers(),
            timeout=DEFAULT_TIMEOUT,
        )

    except requests.RequestException as exc:
        raise RuntimeError(
            "CoreFlow est indisponible."
        ) from exc

    if not response.ok:
        raise RuntimeError(
            "Erreur CoreFlow "
            f"{response.status_code}: "
            f"{response.text}"
        )

    return CoreWorkspaceContext(
        **response.json()
    )


def get_current_identity(
    access_token: str,
) -> dict:
    url = (
        f"{_coreflow_api_url()}"
        "/api/v1/auth/me"
    )

    try:
        response = requests.get(
            url,
            headers={
                "Accept": "application/json",
                "Authorization": (
                    f"Bearer {access_token}"
                ),
            },
            timeout=DEFAULT_TIMEOUT,
        )

    except requests.RequestException as exc:
        raise RuntimeError(
            "CoreFlow est indisponible."
        ) from exc

    if not response.ok:
        raise RuntimeError(
            "Erreur identité CoreFlow "
            f"{response.status_code}: "
            f"{response.text}"
        )

    return response.json()


def resolve_devisflow_context(
    access_token: str,
    organization_id: str,
) -> dict:
    """
    Résout le contexte utilisateur DevisFlow
    à partir de l'identité authentifiée CoreFlow.

    L'organisation demandée n'est acceptée que si
    l'utilisateur possède un membership actif dessus.
    """

    try:
        UUID(organization_id)
    except ValueError as exc:
        raise ValueError(
            "organization_id invalide."
        ) from exc

    identity = get_current_identity(
        access_token
    )

    membership = next(
        (
            item
            for item in identity.get(
                "memberships",
                [],
            )
            if (
                str(
                    item.get(
                        "organization_id"
                    )
                )
                == organization_id
                and item.get("status")
                == "active"
            )
        ),
        None,
    )

    if not membership:
        raise PermissionError(
            "Accès refusé à cette organisation."
        )

    return {
        "organization_id": organization_id,
        "user_id": identity["user_id"],
        "role": membership["role"],
        "membership": membership,
        "identity": identity,
    }

