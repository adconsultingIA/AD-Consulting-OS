from __future__ import annotations

import json
import os
import unicodedata

from openai import OpenAI
from sqlalchemy.orm import Session

from app.models.database_models import (
    ClientDB,
    InvoiceDB,
    QuoteDB,
    RequestDB,
)

from app.schemas.copilot import (
    CopilotMessageResponse,
)

from fastapi import HTTPException, status

from app.schemas.request import RequestCreate
from app.services.request_service import (
    create_request_for_organization,
)

from app.schemas.quote import (
    QuoteCreate,
    QuoteItemCreate,
)

from app.services.quote_service import (
    create_quote_for_organization,
)

from app.schemas.copilot import (
    CopilotQuoteDraft,
)


SYSTEM_PROMPT = """
Tu es le Copilot IA de DevisFlow.

Ton rôle est d'aider l'utilisateur à :
- comprendre ses données métier ;
- analyser des situations ;
- préparer des actions ;
- matérialiser une demande ;
- préparer un devis ;
- proposer des actions métier.

Tu ne dois jamais prétendre avoir exécuté une action
si elle n'a pas réellement été exécutée par DevisFlow.

Tu ne dois jamais créer, modifier, envoyer,
supprimer ou déclencher une action métier sans
confirmation explicite de l'utilisateur.

Si le contexte contient matched_client,
utilise obligatoirement ce client dans le brouillon.

N'invente jamais un client_id.

Si matched_client est null et qu'un client est nécessaire,
demande à l'utilisateur de préciser ou sélectionner le client.

RÈGLES POUR LES DEMANDES :

Si l'utilisateur souhaite matérialiser une demande :
    - utilise intent = "materialize_request" ;
    - renseigne draft ;
    - mets quote_draft à null ;
    - utilise uniquement un client_id réel fourni dans le contexte ;
    - indique dans missing_fields toute information nécessaire absente ;
    - propose create_request uniquement si cela est pertinent ;
    - create_request doit toujours avoir requires_confirmation=true ;
    - ne crée jamais réellement la demande dans cette étape.

RÈGLES STRICTES POUR LES DEVIS :

Si l'utilisateur demande de préparer un devis :
- utilise intent = "prepare_action" ;
- draft doit obligatoirement être null ;
- quote_draft doit obligatoirement être renseigné ;
- utilise uniquement une request_id réellement présente
dans recent_requests ;
- n'invente jamais de request_id ;
- request_id doit être l'identifiant exact de la demande ;
- client_name doit correspondre au client réel de la demande ;
- utilise le budget de la demande comme référence commerciale
si l'utilisateur le demande ;
- propose une ou plusieurs lignes de devis ;
- les lignes doivent contenir :
description,
service_category,
quantity,
unit_price ;
- les catégories autorisées sont :
consulting,
software,
implementation,
training,
other ;
- si un budget est utilisé comme référence,
le total proposé des lignes hors taxes doit être cohérent
avec ce budget ;
- ne calcule jamais la TVA ;
- ne propose jamais de taux de TVA ;
- DevisFlow et CoreFlow gèrent la fiscalité ;
- valid_until est facultatif ;
- ne confonds jamais valid_until avec la deadline de la demande ;
- l'absence de valid_until ne rend pas le devis incomplet ;
- indique uniquement dans missing_fields les informations
réellement indispensables ;
- propose create_quote avec requires_confirmation=true ;
- ne crée jamais réellement le devis dans cette étape.

FORMAT DE RÉPONSE :

Réponds uniquement avec un objet JSON valide.

La structure attendue est :

{
"answer": "texte de réponse à l'utilisateur",
"intent": "business_analysis | materialize_request | prepare_action | general_assistance",
"suggested_actions": [
{
    "code": "code_action",
    "label": "Libellé",
    "description": "Description",
    "requires_confirmation": true
}
],
"draft": null,
"quote_draft": null,
"requires_confirmation": false
}

Pour une demande métier :

{
"answer": "...",
"intent": "materialize_request",
"suggested_actions": [
    {
        "code": "create_request",
        "label": "Créer la demande",
        "description": "...",
        "requires_confirmation": true
    }
],
"draft": {
    "client_name": "...",
    "client_id": "...",
    "title": "...",
    "description": "...",
    "budget": 12000,
    "deadline": null,
    "missing_fields": []
},
"quote_draft": null,
"requires_confirmation": true
}

Pour un devis :

{
    "answer": "...",
    "intent": "prepare_action",
    "suggested_actions": [
        {
            "code": "create_quote",
            "label": "Créer le devis",
            "description": "...",
            "requires_confirmation": true
        }
    ],
    "draft": null,
    "quote_draft": {
        "request_id": "...",
        "request_title": "...",
        "client_name": "...",
        "valid_until": null,
        "notes": "...",
        "items": [
            {
                "description": "...",
                "service_category": "implementation",
                "quantity": 1,
                "unit_price": 12000
            }
        ],
        "missing_fields": []
    },
    "requires_confirmation": true
}

N'ajoute aucun texte avant ou après l'objet JSON.
""".strip()


def _client() -> OpenAI:
    api_key = os.getenv(
        "OPENAI_API_KEY"
    )

    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY non configurée."
        )

    return OpenAI(
        api_key=api_key
    )


def _normalize_text(
    value: str,
) -> str:
    normalized = unicodedata.normalize(
        "NFKD",
        value,
    )

    normalized = "".join(
        character
        for character in normalized
        if not unicodedata.combining(
            character
        )
    )

    return " ".join(
        normalized
        .casefold()
        .strip()
        .split()
    )


def _find_client_match(
    db: Session,
    *,
    organization_id: str,
    message: str,
) -> dict | None:
    normalized_message = _normalize_text(
        message
    )

    clients = (
        db.query(ClientDB)
        .filter(
            ClientDB.organization_id
            == organization_id
        )
        .all()
    )

    matches: list[ClientDB] = []

    for client in clients:
        candidates = [
            client.company_name,
            client.contact_name,
        ]

        for candidate in candidates:
            if not candidate:
                continue

            normalized_candidate = (
                _normalize_text(
                    candidate
                )
            )

            if (
                len(normalized_candidate) >= 3
                and normalized_candidate
                in normalized_message
            ):
                matches.append(client)
                break

    unique_matches = {
        client.id: client
        for client in matches
    }

    if len(unique_matches) != 1:
        return None

    client = next(
        iter(
            unique_matches.values()
        )
    )

    return {
        "id": client.id,
        "company_name": (
            client.company_name
        ),
        "contact_name": (
            client.contact_name
        ),
    }


def _build_business_context(
    db: Session,
    *,
    organization_id: str,
) -> dict:
    clients = (
        db.query(ClientDB)
        .filter(
            ClientDB.organization_id
            == organization_id
        )
        .all()
    )

    request_count = (
        db.query(RequestDB)
        .filter(
            RequestDB.organization_id
            == organization_id
        )
        .count()
    )

    requests = (
        db.query(RequestDB)
        .filter(
            RequestDB.organization_id
            == organization_id
        )
        .order_by(
            RequestDB.created_at.desc()
        )
        .limit(20)
        .all()
    )

    quotes = (
        db.query(QuoteDB)
        .filter(
            QuoteDB.organization_id
            == organization_id
        )
        .all()
    )

    invoices = (
        db.query(InvoiceDB)
        .filter(
            InvoiceDB.organization_id
            == organization_id
        )
        .all()
    )

    overdue_invoices = [
        invoice
        for invoice in invoices
        if invoice.status == "overdue"
    ]

    return {
        "clients": [
            {
                "id": client.id,
                "company_name": client.company_name,
                "contact_name": client.contact_name,
            }
            for client in clients[:50]
        ],

        "summary": {
            "currency": "CHF",
            "clients": len(clients),
            "requests": request_count,
            "quotes": len(quotes),
            "invoices": len(invoices),
            "overdue_invoices": len(
                overdue_invoices
            ),
            "overdue_amount": sum(
                float(
                    invoice.amount_due or 0
                )
                for invoice
                in overdue_invoices
            ),
        },

        "recent_requests": [
            {
                "id": request.id,
                "client_id": request.client_id,
                "title": request.title,
                "description": request.description,
                "budget": (
                    float(request.budget)
                    if request.budget is not None
                    else None
                ),
                "deadline": (
                    request.deadline.isoformat()
                    if request.deadline
                    else None
                ),
                "status": request.status,
            }
            for request in requests
        ],
}


def ask_copilot(
    db: Session,
    *,
    organization_id: str,
    message: str,
) -> CopilotMessageResponse:
    context = _build_business_context(
        db,
        organization_id=organization_id,
    )

    matched_client = _find_client_match(
        db,
        organization_id=organization_id,
        message=message,
    )

    context[
        "matched_client"
    ] = matched_client

    model = os.getenv(
        "OPENAI_COPILOT_MODEL",
        "gpt-5.6-luna",
    )

    response = _client().responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": (
                    "Contexte métier DevisFlow :\n"
                    + json.dumps(
                        context,
                        ensure_ascii=False,
                        default=str,
                    )
                    + "\n\nDemande utilisateur :\n"
                    + message
                ),
            },
        ],
    )

    raw = response.output_text.strip()

    if raw.startswith("```"):
        raw = raw.strip("`")

        if raw.startswith("json"):
            raw = raw[4:].strip()

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "Réponse Copilot invalide."
        ) from exc

    draft = payload.get(
        "draft"
    )

    if (
        matched_client
        and isinstance(
            draft,
            dict,
        )
    ):
        draft[
            "client_id"
        ] = matched_client[
            "id"
        ]

        draft[
            "client_name"
        ] = matched_client[
            "company_name"
        ]

        missing_fields = (
            draft.get(
                "missing_fields"
            )
            or []
        )

        draft[
            "missing_fields"
        ] = [
            field
            for field
            in missing_fields
            if "client"
            not in str(
                field
            ).casefold()
        ]

    suggested_actions = (
        payload.get(
            "suggested_actions"
        )
        or []
    )

    payload[
        "requires_confirmation"
    ] = any(
        bool(
            action.get(
                "requires_confirmation"
            )
        )
        for action
        in suggested_actions
    )

    return CopilotMessageResponse(
        **payload
    )

def execute_copilot_action(
    db: Session,
    *,
    organization_id: str,
    action_code: str,
    confirmed: bool,
    draft: CopilotRequestDraft | None = None,
    quote_draft: CopilotQuoteDraft | None = None,
    ):
        if not confirmed:
            raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Explicit confirmation required",
        )

        if action_code == "create_request":
            if draft is None:
                raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request draft is required",
        )

            if not draft.client_id:
                raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client is required",
            )

            if not draft.title:
                raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request title is required",
            )

            if draft.missing_fields:
                raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Draft is incomplete. "
                "Resolve missing fields first."
            ),
            )

            payload = RequestCreate(
                client_id=draft.client_id,
                title=draft.title,
                description=draft.description,
                budget=draft.budget,
                deadline=draft.deadline,
            )

            return create_request_for_organization(
            db,
            organization_id=organization_id,
            payload=payload,
            )

        if action_code == "create_quote":
            if quote_draft is None:
                raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quote draft is required",
            )

            if not quote_draft.request_id:
                raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request id is required",
            )

            if quote_draft.missing_fields:
                raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Quote draft is incomplete. "
                "Resolve missing fields first."
            ),
            )

            if not quote_draft.items:
                raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one quote item is required",
            )

            items = [
                QuoteItemCreate(
                    description=item.description,
                    service_category=(
                        item.service_category
                    ),
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                )
                for item in quote_draft.items
            ]

            payload = QuoteCreate(
                request_id=quote_draft.request_id,
                valid_until=quote_draft.valid_until,
                notes=quote_draft.notes,
                items=items,
            )

            return create_quote_for_organization(
                db,
                organization_id=organization_id,
                payload=payload,
            )

        raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported Copilot action",
        
        )