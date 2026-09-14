from __future__ import annotations

import hashlib
import json

from datetime import (
    datetime,
    timedelta,
)
from uuid import uuid4

from fastapi import (
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.models.copilot_models import (
    CopilotActionProposalDB,
)

from app.schemas.copilot import (
    CopilotExecuteResponse,
    CopilotMessageResponse,
    CopilotQuoteDraft,
    CopilotRequestDraft,
)

from app.services.copilot_service import (
    execute_copilot_action,
)


EXECUTABLE_ACTIONS = {
    "create_request",
    "create_quote",
}

PROPOSAL_TTL_MINUTES = 10


def _utcnow() -> datetime:
    """
    SQLite stocke ici des DateTime naïfs.
    On utilise donc UTC sans tzinfo de manière
    cohérente pour éviter les comparaisons
    aware / naive.
    """
    return datetime.utcnow()


def _canonical_payload(
    *,
    action_code: str,
    draft: dict | None,
    quote_draft: dict | None,
) -> dict:
    return {
        "action_code": action_code,
        "draft": draft,
        "quote_draft": quote_draft,
    }


def _payload_hash(
    payload: dict,
) -> str:
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")

    return hashlib.sha256(
        encoded
    ).hexdigest()


def create_copilot_proposal(
    db: Session,
    *,
    organization_id: str,
    user_id: str,
    response: CopilotMessageResponse,
) -> CopilotActionProposalDB | None:
    """
    Crée une proposition serveur uniquement
    pour une action métier réellement exécutable.
    """

    action = next(
        (
            item
            for item
            in response.suggested_actions
            if (
                item.code
                in EXECUTABLE_ACTIONS
                and item.requires_confirmation
            )
        ),
        None,
    )

    if action is None:
        return None

    draft_payload = (
        response.draft.model_dump(
            mode="json"
        )
        if response.draft
        else None
    )

    quote_draft_payload = (
        response.quote_draft.model_dump(
            mode="json"
        )
        if response.quote_draft
        else None
    )

    payload = _canonical_payload(
        action_code=action.code,
        draft=draft_payload,
        quote_draft=quote_draft_payload,
    )

    now = _utcnow()

    proposal = CopilotActionProposalDB(
        id=str(uuid4()),
        organization_id=organization_id,
        user_id=user_id,
        action_code=action.code,
        payload=payload,
        payload_hash=_payload_hash(
            payload
        ),
        status="pending",
        expires_at=(
            now
            + timedelta(
                minutes=PROPOSAL_TTL_MINUTES
            )
        ),
    )

    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    return proposal


def _load_proposal(
    db: Session,
    *,
    proposal_id: str,
    organization_id: str,
    user_id: str,
) -> CopilotActionProposalDB:
    proposal = (
        db.query(
            CopilotActionProposalDB
        )
        .filter(
            CopilotActionProposalDB.id
            == proposal_id,
            CopilotActionProposalDB.organization_id
            == organization_id,
            CopilotActionProposalDB.user_id
            == user_id,
        )
        .first()
    )

    if proposal is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Proposition Copilot "
                "introuvable."
            ),
        )

    return proposal


def _idempotent_result(
    proposal: CopilotActionProposalDB,
) -> CopilotExecuteResponse:
    return CopilotExecuteResponse(
        ok=True,
        action_code=proposal.action_code,
        message=(
            "Action déjà exécutée."
        ),
        request_id=(
            proposal.result_entity_id
            if (
                proposal.result_entity_type
                == "request"
            )
            else None
        ),
        quote_id=(
            proposal.result_entity_id
            if (
                proposal.result_entity_type
                == "quote"
            )
            else None
        ),
        proposal_id=proposal.id,
        replayed=True,
    )


def execute_copilot_proposal(
    db: Session,
    *,
    proposal_id: str,
    organization_id: str,
    user_id: str,
    confirmed: bool,
) -> CopilotExecuteResponse:
    """
    Exécute une proposition serveur.

    Sécurité :
    - confirmation explicite obligatoire ;
    - même organisation ;
    - même utilisateur ;
    - expiration ;
    - hash du payload vérifié ;
    - claim atomique ;
    - proposition consommée une seule fois ;
    - replay d'une proposition consommée :
      retourne le résultat existant sans recréer.
    """

    if not confirmed:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Confirmation explicite "
                "requise."
            ),
        )

    proposal = _load_proposal(
        db,
        proposal_id=proposal_id,
        organization_id=organization_id,
        user_id=user_id,
    )

    if proposal.status == "consumed":
        return _idempotent_result(
            proposal
        )

    if proposal.status == "expired":
        raise HTTPException(
            status_code=(
                status.HTTP_410_GONE
            ),
            detail=(
                "Cette proposition Copilot "
                "a expiré."
            ),
        )

    if proposal.status == "executing":
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Cette proposition est déjà "
                "en cours d'exécution."
            ),
        )

    if proposal.status != "pending":
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Cette proposition Copilot "
                "n'est plus exécutable."
            ),
        )

    now = _utcnow()

    if proposal.expires_at <= now:
        proposal.status = "expired"

        db.commit()

        raise HTTPException(
            status_code=(
                status.HTTP_410_GONE
            ),
            detail=(
                "Cette proposition Copilot "
                "a expiré."
            ),
        )

    expected_hash = _payload_hash(
        proposal.payload
    )

    if (
        expected_hash
        != proposal.payload_hash
    ):
        proposal.status = "invalid"

        db.commit()

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "La proposition Copilot "
                "n'est plus valide."
            ),
        )

    claimed = (
        db.query(
            CopilotActionProposalDB
        )
        .filter(
            CopilotActionProposalDB.id
            == proposal.id,
            CopilotActionProposalDB.status
            == "pending",
        )
        .update(
            {
                CopilotActionProposalDB.status:
                    "executing",
            },
            synchronize_session=False,
        )
    )

    db.commit()

    if claimed != 1:
        current = _load_proposal(
            db,
            proposal_id=proposal_id,
            organization_id=organization_id,
            user_id=user_id,
        )

        if current.status == "consumed":
            return _idempotent_result(
                current
            )

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Cette proposition est déjà "
                "prise en charge."
            ),
        )

    payload = proposal.payload

    draft_payload = payload.get(
        "draft"
    )

    quote_draft_payload = payload.get(
        "quote_draft"
    )

    draft = (
        CopilotRequestDraft.model_validate(
            draft_payload
        )
        if draft_payload is not None
        else None
    )

    quote_draft = (
        CopilotQuoteDraft.model_validate(
            quote_draft_payload
        )
        if quote_draft_payload
        is not None
        else None
    )

    action_code = proposal.action_code

    try:
        result = execute_copilot_action(
            db,
            organization_id=organization_id,
            action_code=action_code,
            confirmed=True,
            draft=draft,
            quote_draft=quote_draft,
        )

    except Exception:
        """
        On ne remet volontairement PAS la
        proposition en pending.

        Si une erreur intervient après une
        écriture métier, autoriser un nouveau
        replay pourrait créer un doublon.

        Une proposition bloquée en executing
        est donc préférable à une double
        création.
        """
        raise

    proposal = _load_proposal(
        db,
        proposal_id=proposal_id,
        organization_id=organization_id,
        user_id=user_id,
    )

    result_id = str(
        result.id
    )

    if action_code == "create_request":
        entity_type = "request"

    elif action_code == "create_quote":
        entity_type = "quote"

    else:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Action Copilot "
                "non supportée."
            ),
        )

    proposal.status = "consumed"
    proposal.consumed_at = _utcnow()
    proposal.result_entity_type = (
        entity_type
    )
    proposal.result_entity_id = result_id

    db.commit()
    db.refresh(proposal)

    return CopilotExecuteResponse(
        ok=True,
        action_code=action_code,
        message=(
            "Request created successfully"
            if entity_type == "request"
            else "Quote created successfully"
        ),
        request_id=(
            result_id
            if entity_type == "request"
            else None
        ),
        quote_id=(
            result_id
            if entity_type == "quote"
            else None
        ),
        proposal_id=proposal.id,
        replayed=False,
    )
