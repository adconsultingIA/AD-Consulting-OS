from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from app.schemas.coreflow import CoreTaxProfile


ServiceCategory = Literal[
    "consulting",
    "software",
    "implementation",
    "training",
    "other",
]


CustomerType = Literal[
    "business",
    "consumer",
]


@dataclass(frozen=True)
class CustomerTaxContext:
    country_code: str | None
    region: str | None
    customer_type: CustomerType
    tax_system: str | None
    tax_registered: bool | None
    tax_identifier: str | None


@dataclass(frozen=True)
class TaxDecision:
    tax_type: str
    tax_rate: Decimal
    tax_treatment: str
    tax_reason: str
    requires_manual_review: bool = False


def resolve_tax(
    *,
    issuer_tax_profile: CoreTaxProfile | None,
    customer: CustomerTaxContext,
    service_category: ServiceCategory,
) -> TaxDecision:
    # ---------------------------------------------------------
    # 1. Profil fiscal émetteur obligatoire
    # ---------------------------------------------------------

    if issuer_tax_profile is None:
        return TaxDecision(
            tax_type="unknown",
            tax_rate=Decimal("0"),
            tax_treatment="manual_review",
            tax_reason=(
                "Aucun profil fiscal CoreFlow "
                "n'est configuré pour l'émetteur."
            ),
            requires_manual_review=True,
        )

    tax_type = (
        issuer_tax_profile.tax_system
        or "unknown"
    ).lower()

    issuer_country = (
        issuer_tax_profile.tax_country.upper()
        if issuer_tax_profile.tax_country
        else None
    )

    customer_country = (
        customer.country_code.upper()
        if customer.country_code
        else None
    )

    # ---------------------------------------------------------
    # 2. Émetteur non enregistré à la taxe
    # ---------------------------------------------------------

    if not issuer_tax_profile.tax_registered:
        return TaxDecision(
            tax_type=tax_type,
            tax_rate=Decimal("0"),
            tax_treatment="not_registered",
            tax_reason=(
                "L'organisation émettrice n'est "
                "pas enregistrée pour cette taxe."
            ),
            requires_manual_review=False,
        )

    # ---------------------------------------------------------
    # 3. Informations client insuffisantes
    # ---------------------------------------------------------

    if not customer_country:
        return TaxDecision(
            tax_type=tax_type,
            tax_rate=Decimal("0"),
            tax_treatment="manual_review",
            tax_reason=(
                "Le pays fiscal du client "
                "n'est pas renseigné."
            ),
            requires_manual_review=True,
        )

    # ---------------------------------------------------------
    # 4. Transaction domestique
    # ---------------------------------------------------------

    if (
        issuer_country
        and customer_country == issuer_country
    ):
        if issuer_tax_profile.default_tax_rate is None:
            return TaxDecision(
                tax_type=tax_type,
                tax_rate=Decimal("0"),
                tax_treatment="manual_review",
                tax_reason=(
                    "Transaction domestique mais "
                    "aucun taux fiscal par défaut "
                    "n'est configuré."
                ),
                requires_manual_review=True,
            )

        return TaxDecision(
            tax_type=tax_type,
            tax_rate=Decimal(
                str(
                    issuer_tax_profile
                    .default_tax_rate
                )
            ),
            tax_treatment="standard",
            tax_reason=(
                "Transaction domestique utilisant "
                "le taux fiscal par défaut "
                "de l'émetteur."
            ),
            requires_manual_review=False,
        )

    # ---------------------------------------------------------
    # 5. Transaction transfrontalière
    # ---------------------------------------------------------
    #
    # On ne déduit volontairement PAS encore ici :
    # - reverse charge
    # - exonération
    # - lieu de prestation
    # - TVA locale du pays client
    #
    # Ces règles seront ajoutées juridiction par juridiction.
    # ---------------------------------------------------------

    if customer.customer_type == "business":
        return TaxDecision(
            tax_type=tax_type,
            tax_rate=Decimal("0"),
            tax_treatment="manual_review",
            tax_reason=(
                "Transaction B2B transfrontalière "
                f"{issuer_country or '?'} -> "
                f"{customer_country}, service "
                f"'{service_category}'. "
                "La règle fiscale spécifique "
                "à cette juridiction doit être "
                "confirmée."
            ),
            requires_manual_review=True,
        )

    return TaxDecision(
        tax_type=tax_type,
        tax_rate=Decimal("0"),
        tax_treatment="manual_review",
        tax_reason=(
            "Transaction B2C transfrontalière "
            f"{issuer_country or '?'} -> "
            f"{customer_country}, service "
            f"'{service_category}'. "
            "Une règle fiscale spécifique "
            "est requise."
        ),
        requires_manual_review=True,
    )


# -------------------------------------------------------------
# Compatibilité temporaire avec Tax Engine v1
# -------------------------------------------------------------

def resolve_issuer_tax(
    tax_profile: CoreTaxProfile | None,
) -> TaxDecision:
    if tax_profile is None:
        return TaxDecision(
            tax_type="unknown",
            tax_rate=Decimal("0"),
            tax_treatment="manual_review",
            tax_reason=(
                "Aucun profil fiscal CoreFlow "
                "n'est configuré."
            ),
            requires_manual_review=True,
        )

    tax_type = (
        tax_profile.tax_system
        or "unknown"
    ).lower()

    if not tax_profile.tax_registered:
        return TaxDecision(
            tax_type=tax_type,
            tax_rate=Decimal("0"),
            tax_treatment="not_registered",
            tax_reason=(
                "L'organisation émettrice n'est "
                "pas enregistrée pour cette taxe."
            ),
            requires_manual_review=False,
        )

    if tax_profile.default_tax_rate is not None:
        return TaxDecision(
            tax_type=tax_type,
            tax_rate=Decimal(
                str(tax_profile.default_tax_rate)
            ),
            tax_treatment="standard",
            tax_reason=(
                "Taux fiscal par défaut du profil "
                "CoreFlow."
            ),
            requires_manual_review=False,
        )

    return TaxDecision(
        tax_type=tax_type,
        tax_rate=Decimal("0"),
        tax_treatment="manual_review",
        tax_reason=(
            "Organisation enregistrée fiscalement "
            "mais aucun taux par défaut n'est défini."
        ),
        requires_manual_review=True,
    )
