from datetime import date

from pydantic import BaseModel, Field


class CoreCommercialProfile(BaseModel):
    id: str | None = None
    organization_id: str

    legal_name: str | None = None
    commercial_email: str | None = None

    country_code: str = "FR"
    default_currency: str = "EUR"

    locale: str | None = "fr-FR"
    timezone: str | None = "Europe/Paris"

    legal_form: str | None = None

    address_line1: str | None = None
    address_line2: str | None = None
    postal_code: str | None = None
    city: str | None = None
    region: str | None = None

    electronic_invoicing_enabled: bool = False
    electronic_invoicing_provider: str | None = None
    electronic_invoicing_identifier: str | None = None
    electronic_invoicing_status: str | None = None


class CoreLegalIdentifier(BaseModel):
    id: str | None = None
    organization_id: str

    country_code: str
    identifier_type: str
    identifier_value: str
    is_primary: bool = False


class CoreBankAccount(BaseModel):
    id: str | None = None
    organization_id: str

    label: str | None = None
    account_holder_name: str

    iban: str
    bic: str | None = None
    bank_name: str | None = None

    currency: str = "EUR"
    country_code: str = "FR"

    is_default: bool = False
    is_active: bool = True


class CorePaymentPreferences(BaseModel):
    id: str | None = None
    organization_id: str

    default_payment_method: str = "bank_transfer"
    default_payment_terms_days: int = 30

    require_deposit: bool = False
    default_deposit_percentage: float = 0

    allow_partial_payment: bool = False
    reminder_enabled: bool = True

    payment_instructions: str | None = None


class CoreTaxProfile(BaseModel):
    id: str | None = None
    organization_id: str

    tax_country: str
    tax_region: str | None = None

    tax_system: str

    tax_registered: bool = False

    tax_identifier: str | None = None
    tax_regime: str | None = None

    default_tax_rate: float | None = None

    effective_from: date | None = None

    notes: str | None = None


class CoreProductBrand(BaseModel):
    product_name: str
    monogram: str

    primary_color: str | None = None
    secondary_color: str | None = None
    accent_color: str | None = None

    logo_mark_url: str | None = None
    document_logo_url: str | None = None

    visual_settings: dict = Field(
        default_factory=dict
    )


class CoreCommercialContext(BaseModel):
    organization_id: str

    commercial_profile: CoreCommercialProfile | None = None

    legal_identifiers: list[CoreLegalIdentifier] = Field(
        default_factory=list
    )

    default_bank_account: CoreBankAccount | None = None

    payment_preferences: CorePaymentPreferences | None = None

    tax_profile: CoreTaxProfile | None = None

    product_brand: CoreProductBrand | None = None


class CoreWorkspaceOrganization(BaseModel):
    id: str
    name: str
    slug: str
    active: bool = True


class CoreWorkspaceProduct(BaseModel):
    code: str
    name: str
    description: str | None = None
    category: str | None = None
    status: str | None = None
    active: bool = True


class CoreWorkspaceAccess(BaseModel):
    organization_product_id: str | None = None
    product_code: str
    enabled: bool
    status: str | None = None
    plan: str | None = None

    activated_at: str | None = None
    expires_at: str | None = None

    entitlements: dict = Field(
        default_factory=dict
    )


class CoreWorkspaceBranding(BaseModel):
    organization: dict = Field(
        default_factory=dict
    )

    product: dict = Field(
        default_factory=dict
    )


class CoreWorkspaceContext(BaseModel):
    organization: CoreWorkspaceOrganization
    product: CoreWorkspaceProduct
    access: CoreWorkspaceAccess
    branding: CoreWorkspaceBranding
