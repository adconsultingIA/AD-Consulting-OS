from fastapi import HTTPException, status


def ensure_quote_acceptance_is_valid(
    quote,
) -> None:
    """
    Vérifie qu'un devis possède une preuve
    d'acceptation exploitable avant toute
    conséquence commerciale ou financière.
    """

    if not quote.acceptance_checked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Le bon pour accord doit être "
                "confirmé."
            ),
        )

    if not quote.acceptance_method:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Le mode de confirmation "
                "est obligatoire."
            ),
        )

    if not quote.accepted_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "La date d'acceptation "
                "est obligatoire."
            ),
        )

    if not quote.accepted_by_user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "L'utilisateur ayant enregistré "
                "l'acceptation est obligatoire."
            ),
        )

    has_evidence = any(
        (
            quote.acceptance_reference,
            quote.acceptance_note,
            quote.acceptance_document_path,
        )
    )

    if not has_evidence:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Une preuve d'acceptation est "
                "obligatoire : référence, note "
                "ou document justificatif."
            ),
        )
