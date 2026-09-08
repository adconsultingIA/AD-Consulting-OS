from decimal import Decimal
from html import escape
from io import BytesIO
from pathlib import Path
from app.services.documents.header import build_document_header
from app.services.documents.metadata import build_document_metadata
import requests
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# -------------------------------------------------------------------
# Fallback local
# CoreFlow reste la source de vérité.
# -------------------------------------------------------------------

COMPANY_NAME = "AD Consulting IA"
COMPANY_PRODUCT = "DevisFlow"
COMPANY_EMAIL = "contact@adconsultingia.ch"
COMPANY_PHONE = ""
COMPANY_ADDRESS = ""
COMPANY_WEBSITE = ""

LOGO_PATH = Path("app/assets/logo.png")

DEFAULT_PRIMARY_COLOR = "#0B1F4D"
DEFAULT_SECONDARY_COLOR = "#155EEF"
DEFAULT_ACCENT_COLOR = "#06B6D4"

LOGO_TIMEOUT = 8


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def money(
    value: Decimal,
    currency: str = "EUR",
) -> str:
    value = Decimal(value)

    formatted = (
        f"{value:,.2f}"
        .replace(",", " ")
    )

    return f"{formatted} {currency}"


def percentage(value) -> str:
    if value is None:
        return "—"

    value = Decimal(value)

    if value == value.to_integral():
        return f"{int(value)} %"

    return f"{value} %"


def safe_text(value) -> str:
    if value is None:
        return ""

    return escape(str(value))


def resolve_tax_label(
    commercial_context,
) -> str:
    if not commercial_context:
        return "Taxe"

    tax_profile = commercial_context.tax_profile

    if not tax_profile:
        return "Taxe"

    tax_system = (
        tax_profile.tax_system
        or ""
    ).lower()

    labels = {
        "vat": "TVA",
        "gst": "GST",
        "sales_tax": "Sales Tax",
    }

    return labels.get(
        tax_system,
        "Taxe",
    )


def collect_tax_information(items) -> list[str]:
    messages = []

    for item in items:
        treatment = getattr(
            item,
            "tax_treatment",
            None,
        )

        reason = getattr(
            item,
            "tax_reason",
            None,
        )

        if treatment == "standard":
            continue

        if reason:
            text = str(reason).strip()

            if (
                text
                and text not in messages
            ):
                messages.append(text)

    return messages


def format_quote_status(
    value: str | None,
) -> str:
    statuses = {
        "draft": "Brouillon",
        "ready": "Prêt",
        "sent": "Envoyé",
        "accepted": "Accepté",
        "rejected": "Refusé",
        "expired": "Expiré",
        "cancelled": "Annulé",
    }

    normalized = (
        str(value).strip().lower()
        if value is not None
        else ""
    )

    return statuses.get(
        normalized,
        normalized.capitalize()
        if normalized
        else "—",
    )


def build_logo(
    *,
    document_logo_url: str | None,
):
    if document_logo_url:
        try:
            response = requests.get(
                document_logo_url,
                timeout=LOGO_TIMEOUT,
            )

            response.raise_for_status()

            logo_stream = BytesIO(
                response.content
            )

            return Image(
                logo_stream,
                width=40 * mm,
                height=18 * mm,
                kind="proportional",
            )

        except requests.RequestException:
            pass
        except Exception:
            pass

    if LOGO_PATH.exists():
        try:
            return Image(
                str(LOGO_PATH),
                width=40 * mm,
                height=18 * mm,
                kind="proportional",
            )
        except Exception:
            pass

    return None


# -------------------------------------------------------------------
# PDF
# -------------------------------------------------------------------

def generate_quote_pdf(
    *,
    quote,
    client,
    request,
    items,
    commercial_context=None,
):
    buffer = BytesIO()

    # ---------------------------------------------------------------
    # Valeurs par défaut / fallback
    # ---------------------------------------------------------------

    company_name = COMPANY_NAME
    company_address = COMPANY_ADDRESS
    company_email = COMPANY_EMAIL
    company_phone = COMPANY_PHONE
    product_name = COMPANY_PRODUCT

    currency = "EUR"

    primary_color = DEFAULT_PRIMARY_COLOR
    secondary_color = DEFAULT_SECONDARY_COLOR
    accent_color = DEFAULT_ACCENT_COLOR

    document_logo_url = None

    bank_account_holder = ""
    bank_name = ""
    bank_iban = ""
    bank_bic = ""

    legal_identifiers = []

    # ---------------------------------------------------------------
    # Héritage CoreFlow
    # ---------------------------------------------------------------

    if commercial_context:
        profile = (
            commercial_context.commercial_profile
        )

        bank_account = (
            commercial_context.default_bank_account
        )

        legal_identifiers = (
            commercial_context.legal_identifiers
        )

        product_brand = getattr(
            commercial_context,
            "product_brand",
            None,
        )

        if profile:
            company_name = (
                profile.legal_name
                or COMPANY_NAME
            )

            company_email = (
                profile.commercial_email
                or COMPANY_EMAIL
            )

            currency = (
                profile.default_currency
                or "EUR"
            )

            address_parts = [
                profile.address_line1,
                profile.address_line2,
                (
                    f"{profile.postal_code or ''} "
                    f"{profile.city or ''}"
                ).strip(),
                profile.country_code,
            ]

            company_address = ", ".join(
                part.strip()
                for part in address_parts
                if part and part.strip()
            )

        if bank_account:
            bank_account_holder = (
                bank_account.account_holder_name
            )

            bank_name = (
                bank_account.bank_name
                or ""
            )

            bank_iban = (
                bank_account.iban
                or ""
            )

            bank_bic = (
                bank_account.bic
                or ""
            )

        if product_brand:
            product_name = (
                product_brand.product_name
                or COMPANY_PRODUCT
            )

            primary_color = (
                product_brand.primary_color
                or DEFAULT_PRIMARY_COLOR
            )

            secondary_color = (
                product_brand.secondary_color
                or DEFAULT_SECONDARY_COLOR
            )

            accent_color = (
                product_brand.accent_color
                or DEFAULT_ACCENT_COLOR
            )

            document_logo_url = (
                product_brand.document_logo_url
            )

    primary = colors.HexColor(
        primary_color
    )

    secondary = colors.HexColor(
        secondary_color
    )

    accent = colors.HexColor(
        accent_color
    )

    tax_label = resolve_tax_label(
        commercial_context
    )

    tax_information = (
        collect_tax_information(items)
    )

    # ---------------------------------------------------------------
    # Identifiant légal principal
    # ---------------------------------------------------------------

    primary_legal_identifier = None

    for identifier in legal_identifiers:
        if identifier.is_primary:
            primary_legal_identifier = (
                identifier
            )
            break

    if (
        primary_legal_identifier is None
        and legal_identifiers
    ):
        primary_legal_identifier = (
            legal_identifiers[0]
        )

    # ---------------------------------------------------------------
    # Document
    # ---------------------------------------------------------------

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=12 * mm,
        bottomMargin=24 * mm,
        title=f"Devis {quote.quote_number}",
        author=company_name,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "QuoteTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=24,
        textColor=primary,
        spaceAfter=2 * mm,
    )

    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=primary,
        spaceAfter=2 * mm,
    )

    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor(
            "#374151"
        ),
    )

    small_style = ParagraphStyle(
        "Small",
        parent=body_style,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor(
            "#6B7280"
        ),
    )

    fiscal_style = ParagraphStyle(
        "Fiscal",
        parent=small_style,
        fontSize=7.3,
        leading=9.2,
        textColor=colors.HexColor(
            "#4B5563"
        ),
    )

    right_style = ParagraphStyle(
        "Right",
        parent=body_style,
        alignment=TA_RIGHT,
    )

    brand_fallback_style = ParagraphStyle(
        "BrandFallback",
        parent=body_style,
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=18,
        textColor=primary,
    )

    story = []

    # ---------------------------------------------------------------
    # En-tête commun : émetteur / produit / client
    # ---------------------------------------------------------------

    header_table, header_divider = build_document_header(
        company_name=company_name,
        company_email=company_email,
        company_phone=company_phone,
        company_address=company_address,
        primary_legal_identifier=primary_legal_identifier,
        product_name=product_name,
        document_logo_url=document_logo_url,
        client=client,
        primary=primary,
        accent=accent,
        base_style=small_style,
    )

    story.append(header_table)
    story.append(header_divider)
    story.append(
        Spacer(1, 3 * mm)
    )
    
    # ---------------------------------------------------------------
    # Document compact : titre / objet face aux métadonnées
    # ---------------------------------------------------------------
    created_date = quote.created_at.strftime(
        "%d/%m/%Y"
    )

    validity = (
        quote.valid_until.strftime(
            "%d/%m/%Y"
        )
        if quote.valid_until
        else "Non définie"
    )

    document_header = build_document_metadata(
        document_type="DEVIS",
        object_title=request.title,
        description=request.description,
        rows=[
            (
                "N°",
                quote.quote_number,
            ),
            (
                "Version",
                str(quote.version),
            ),
            (
                "Date",
                created_date,
            ),
            (
                "Valable jusqu'au",
                validity,
            ),
            (
                "Statut",
                format_quote_status(
                    quote.status
                ),
            ),
        ],
        primary=primary,
        base_style=body_style,
    )

    story.append(document_header)
    story.append(
        Spacer(1, 5 * mm)
    )
    # ---------------------------------------------------------------
    # Lignes
    # ---------------------------------------------------------------

    table_data = [
        [
            "DESCRIPTION",
            "QTÉ",
            "PRIX UNIT.",
            tax_label.upper(),
            "TOTAL HT",
        ]
    ]

    for item in items:
        table_data.append(
            [
                Paragraph(
                    safe_text(
                        item.description
                    ),
                    body_style,
                ),
                str(item.quantity),
                money(
                    item.unit_price,
                    currency,
                ),
                percentage(
                    item.vat_rate
                ),
                money(
                    item.subtotal,
                    currency,
                ),
            ]
        )

    items_table = Table(
        table_data,
        colWidths=[
            76 * mm,
            15 * mm,
            31 * mm,
            18 * mm,
            36 * mm,
        ],
        repeatRows=1,
    )

    items_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    primary,
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold",
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, 0),
                    7.5,
                ),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [
                        colors.white,
                        colors.HexColor(
                            "#F9FAFB"
                        ),
                    ],
                ),
                (
                    "LINEBELOW",
                    (0, 1),
                    (-1, -1),
                    0.25,
                    colors.HexColor(
                        "#E5E7EB"
                    ),
                ),
                (
                    "FONTSIZE",
                    (0, 1),
                    (-1, -1),
                    8,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "ALIGN",
                    (1, 1),
                    (-1, -1),
                    "RIGHT",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
            ]
        )
    )

    story.append(items_table)
    story.append(
        Spacer(1, 6 * mm)
    )

    # ---------------------------------------------------------------
    # Totaux
    # ---------------------------------------------------------------

    totals_data = [
        [
            "Total HT",
            money(
                quote.subtotal,
                currency,
            ),
        ],
        [
            tax_label,
            money(
                quote.vat_amount,
                currency,
            ),
        ],
        [
            "TOTAL TTC",
            money(
                quote.total,
                currency,
            ),
        ],
    ]

    totals_table = Table(
        totals_data,
        colWidths=[
            42 * mm,
            38 * mm,
        ],
        hAlign="RIGHT",
    )

    totals_table.setStyle(
        TableStyle(
            [
                (
                    "ALIGN",
                    (0, 0),
                    (-1, -1),
                    "RIGHT",
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 1),
                    "Helvetica",
                ),
                (
                    "FONTNAME",
                    (0, 2),
                    (-1, 2),
                    "Helvetica-Bold",
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, 1),
                    9,
                ),
                (
                    "FONTSIZE",
                    (0, 2),
                    (-1, 2),
                    11,
                ),
                (
                    "BACKGROUND",
                    (0, 2),
                    (-1, 2),
                    colors.HexColor(
                        "#F3F4F6"
                    ),
                ),
                (
                    "TEXTCOLOR",
                    (0, 2),
                    (-1, 2),
                    primary,
                ),
                (
                    "LINEABOVE",
                    (0, 2),
                    (-1, 2),
                    1,
                    accent,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
            ]
        )
    )

    story.append(totals_table)

    # ---------------------------------------------------------------
    # Information fiscale
    # ---------------------------------------------------------------

    if tax_information:
        story.append(
            Spacer(1, 4 * mm)
        )

        story.append(
            Paragraph(
                "<b>Information fiscale</b>",
                section_title,
            )
        )

        for message in tax_information:
            story.append(
                Paragraph(
                    safe_text(message),
                    fiscal_style,
                )
            )

    # ---------------------------------------------------------------
    # Notes
    # ---------------------------------------------------------------

    if quote.notes:
        story.append(
            Spacer(1, 6 * mm)
        )

        story.append(
            Paragraph(
                "<b>Notes</b>",
                section_title,
            )
        )

        story.append(
            Paragraph(
                safe_text(
                    quote.notes
                ),
                small_style,
            )
        )

    # ---------------------------------------------------------------
    # Footer bancaire
    # ---------------------------------------------------------------

    def draw_footer(canvas, doc):
        canvas.saveState()

        footer_y = 10 * mm

        canvas.setStrokeColor(
            accent
        )

        canvas.setLineWidth(
            0.6
        )

        canvas.line(
            16 * mm,
            footer_y + 12 * mm,
            A4[0] - 16 * mm,
            footer_y + 12 * mm,
        )

        canvas.setFont(
            "Helvetica-Bold",
            7.5,
        )

        canvas.setFillColor(
            primary
        )

        canvas.drawString(
            16 * mm,
            footer_y + 8 * mm,
            "Coordonnées bancaires",
        )

        canvas.setFont(
            "Helvetica",
            7,
        )

        canvas.setFillColor(
            colors.HexColor(
                "#374151"
            )
        )

        footer_parts = []

        if bank_account_holder:
            footer_parts.append(
                (
                    "Titulaire : "
                    f"{bank_account_holder}"
                )
            )

        if bank_name:
            footer_parts.append(
                f"Banque : {bank_name}"
            )

        if bank_iban:
            footer_parts.append(
                f"IBAN : {bank_iban}"
            )

        if bank_bic:
            footer_parts.append(
                f"BIC : {bank_bic}"
            )

        footer_text = (
            "   |   ".join(
                footer_parts
            )
        )

        if footer_text:
            canvas.drawString(
                16 * mm,
                footer_y + 4 * mm,
                footer_text,
            )

        canvas.setFillColor(
            colors.HexColor(
                "#6B7280"
            )
        )

        canvas.drawRightString(
            A4[0] - 16 * mm,
            footer_y,
            (
                f"{company_name} • "
                f"{product_name}"
            ),
        )

        canvas.restoreState()

    # ---------------------------------------------------------------
    # Construction finale
    # ---------------------------------------------------------------

    doc.build(
        story,
        onFirstPage=draw_footer,
        onLaterPages=draw_footer,
    )

    buffer.seek(0)

    return buffer
