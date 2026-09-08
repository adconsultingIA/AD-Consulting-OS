from decimal import Decimal
from html import escape
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.documents.header import (
    build_document_header,
)
from app.services.documents.metadata import (
    build_document_metadata,
)


# -------------------------------------------------------------------
# Fallback local
# CoreFlow reste la source de vérité.
# -------------------------------------------------------------------

COMPANY_NAME = "AD Consulting IA"
COMPANY_PRODUCT = "DevisFlow"
COMPANY_EMAIL = "contact@adconsulting-ai.com"
COMPANY_PHONE = ""
COMPANY_ADDRESS = ""

DEFAULT_PRIMARY_COLOR = "#0B1F4D"
DEFAULT_SECONDARY_COLOR = "#155EEF"
DEFAULT_ACCENT_COLOR = "#06B6D4"


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def safe_text(value) -> str:
    if value is None:
        return ""

    return escape(str(value))


def money(
    value,
    currency: str = "EUR",
) -> str:
    value = Decimal(value or 0)

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


def resolve_tax_label(
    commercial_context,
) -> str:
    if not commercial_context:
        return "Taxe"

    tax_profile = getattr(
        commercial_context,
        "tax_profile",
        None,
    )

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


def collect_tax_information(
    items,
) -> list[str]:
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

            if text and text not in messages:
                messages.append(text)

    return messages


def get_status_label(
    status: str,
) -> str:
    labels = {
        "draft": "BROUILLON",
        "issued": "ÉMIS",
        "sent": "ENVOYÉ",
        "cancelled": "ANNULÉ",
    }

    return labels.get(
        status,
        str(status).upper(),
    )


# -------------------------------------------------------------------
# PDF
# -------------------------------------------------------------------

def generate_purchase_order_pdf(
    *,
    purchase_order,
    quote,
    request,
    client,
    items,
    commercial_context=None,
):
    buffer = BytesIO()

    # ---------------------------------------------------------------
    # Fallback
    # ---------------------------------------------------------------

    company_name = COMPANY_NAME
    company_address = COMPANY_ADDRESS
    company_email = COMPANY_EMAIL
    company_phone = COMPANY_PHONE

    product_name = COMPANY_PRODUCT
    currency = "EUR"

    legal_identifiers = []

    primary_color = DEFAULT_PRIMARY_COLOR
    secondary_color = DEFAULT_SECONDARY_COLOR
    accent_color = DEFAULT_ACCENT_COLOR

    document_logo_url = None

    # ---------------------------------------------------------------
    # CoreFlow
    # ---------------------------------------------------------------

    if commercial_context:
        profile = getattr(
            commercial_context,
            "commercial_profile",
            None,
        )

        legal_identifiers = getattr(
            commercial_context,
            "legal_identifiers",
            [],
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
        bottomMargin=20 * mm,
        title=(
            "Bon de commande "
            f"{purchase_order.purchase_order_number}"
        ),
        author=company_name,
    )

    styles = getSampleStyleSheet()

    body_style = ParagraphStyle(
        "PurchaseOrderBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor(
            "#374151"
        ),
    )

    small_style = ParagraphStyle(
        "PurchaseOrderSmall",
        parent=body_style,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor(
            "#6B7280"
        ),
    )

    section_title = ParagraphStyle(
        "PurchaseOrderSection",
        parent=body_style,
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=primary,
        spaceAfter=2 * mm,
    )

    fiscal_style = ParagraphStyle(
        "PurchaseOrderFiscal",
        parent=small_style,
        fontSize=7.3,
        leading=9.2,
        textColor=colors.HexColor(
            "#4B5563"
        ),
    )

    right_style = ParagraphStyle(
        "PurchaseOrderRight",
        parent=body_style,
        alignment=TA_RIGHT,
    )

    story = []

    # ---------------------------------------------------------------
    # Header commun
    # ---------------------------------------------------------------

    header_table, header_divider = (
        build_document_header(
            company_name=company_name,
            company_email=company_email,
            company_phone=company_phone,
            company_address=company_address,
            primary_legal_identifier=(
                primary_legal_identifier
            ),
            product_name=product_name,
            document_logo_url=(
                document_logo_url
            ),
            client=client,
            primary=primary,
            accent=accent,
            base_style=small_style,
        )
    )

    story.append(header_table)
    story.append(header_divider)
    story.append(
        Spacer(1, 3 * mm)
    )

    # ---------------------------------------------------------------
    # Titre / métadonnées
    # ---------------------------------------------------------------

    order_date = (
        purchase_order.order_date.strftime(
            "%d/%m/%Y"
        )
        if purchase_order.order_date
        else "Non défini"
    )

    quote_number = (
        quote.quote_number
        if quote
        else "—"
    )

    document_header = (
        build_document_metadata(
            document_type=(
                "BON DE COMMANDE"
            ),
            object_title=request.title,
            description=None,
            rows=[
                (
                    "N°",
                    purchase_order.purchase_order_number,
                ),
                (
                    "Date",
                    order_date,
                ),
                (
                    "Devis lié",
                    quote_number,
                ),
                (
                    "Statut",
                    get_status_label(
                        purchase_order.status
                    ),
                ),
            ],
            primary=primary,
            base_style=body_style,
        )
    )

    story.append(document_header)
    story.append(
        Spacer(1, 5 * mm)
    )

    # ---------------------------------------------------------------
    # Adresse d'intervention
    # ---------------------------------------------------------------

    if purchase_order.intervention_address:
        story.append(
            Paragraph(
                "ADRESSE D'INTERVENTION / LIVRAISON",
                section_title,
            )
        )

        address_box = Table(
            [
                [
                    Paragraph(
                        safe_text(
                            purchase_order.intervention_address
                        ),
                        body_style,
                    )
                ]
            ],
            colWidths=[
                176 * mm
            ],
        )

        address_box.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, -1),
                        colors.HexColor(
                            "#F8FAFC"
                        ),
                    ),
                    (
                        "BOX",
                        (0, 0),
                        (-1, -1),
                        0.5,
                        colors.HexColor(
                            "#E2E8F0"
                        ),
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

        story.append(address_box)
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
            20 * mm,
            34 * mm,
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
                    7.2,
                ),
                (
                    "FONTNAME",
                    (0, 1),
                    (-1, -1),
                    "Helvetica",
                ),
                (
                    "FONTSIZE",
                    (0, 1),
                    (-1, -1),
                    8,
                ),
                (
                    "TEXTCOLOR",
                    (0, 1),
                    (-1, -1),
                    colors.HexColor(
                        "#374151"
                    ),
                ),
                (
                    "ALIGN",
                    (1, 1),
                    (-1, -1),
                    "RIGHT",
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.35,
                    colors.HexColor(
                        "#E5E7EB"
                    ),
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
            ]
        )
    )

    story.append(items_table)
    story.append(
        Spacer(1, 5 * mm)
    )

    # ---------------------------------------------------------------
    # Totaux
    # ---------------------------------------------------------------

    totals_table = Table(
        [
            [
                "Sous-total",
                money(
                    purchase_order.subtotal,
                    currency,
                ),
            ],
            [
                tax_label,
                money(
                    purchase_order.vat_amount,
                    currency,
                ),
            ],
            [
                "TOTAL",
                money(
                    purchase_order.total,
                    currency,
                ),
            ],
        ],
        colWidths=[
            45 * mm,
            40 * mm,
        ],
        hAlign="RIGHT",
    )

    totals_table.setStyle(
        TableStyle(
            [
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, -2),
                    "Helvetica",
                ),
                (
                    "FONTNAME",
                    (0, -1),
                    (-1, -1),
                    "Helvetica-Bold",
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    8.5,
                ),
                (
                    "ALIGN",
                    (1, 0),
                    (1, -1),
                    "RIGHT",
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, -2),
                    colors.HexColor(
                        "#4B5563"
                    ),
                ),
                (
                    "TEXTCOLOR",
                    (0, -1),
                    (-1, -1),
                    primary,
                ),
                (
                    "LINEABOVE",
                    (0, -1),
                    (-1, -1),
                    1,
                    accent,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    4,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    4,
                ),
            ]
        )
    )

    story.append(totals_table)

    # ---------------------------------------------------------------
    # Informations fiscales
    # ---------------------------------------------------------------

    if tax_information:
        story.append(
            Spacer(1, 4 * mm)
        )

        for information in tax_information:
            story.append(
                Paragraph(
                    safe_text(information),
                    fiscal_style,
                )
            )

    # ---------------------------------------------------------------
    # Instructions
    # ---------------------------------------------------------------

    if purchase_order.notes:
        story.append(
            Spacer(1, 5 * mm)
        )

        story.append(
            Paragraph(
                "INSTRUCTIONS / NOTES",
                section_title,
            )
        )

        story.append(
            Paragraph(
                safe_text(
                    purchase_order.notes
                ),
                body_style,
            )
        )

    # ---------------------------------------------------------------
    # Footer discret
    # ---------------------------------------------------------------

    story.append(
        Spacer(1, 7 * mm)
    )

    footer = Table(
        [
            [
                Paragraph(
                    (
                        f"<b>{safe_text(product_name)}</b>"
                        " · Document commercial"
                    ),
                    small_style,
                ),
                Paragraph(
                    safe_text(
                        purchase_order.purchase_order_number
                    ),
                    right_style,
                ),
            ]
        ],
        colWidths=[
            100 * mm,
            76 * mm,
        ],
    )

    footer.setStyle(
        TableStyle(
            [
                (
                    "LINEABOVE",
                    (0, 0),
                    (-1, 0),
                    0.5,
                    secondary,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
            ]
        )
    )

    story.append(footer)

    doc.build(story)

    buffer.seek(0)

    return buffer
