from decimal import Decimal
from html import escape
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
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


def get_receipt_status_label(
    status: str,
) -> str:
    labels = {
        "issued": "ÉMIS",
        "sent": "ENVOYÉ",
        "cancelled": "ANNULÉ",
    }

    return labels.get(
        status,
        str(status).upper(),
    )


def get_payment_method_label(
    method: str | None,
) -> str:
    labels = {
        "bank_transfer": "Virement",
        "card": "Carte",
        "cash": "Espèces",
        "check": "Chèque",
        "other": "Autre",
    }

    if not method:
        return "Non renseigné"

    return labels.get(
        method,
        str(method),
    )


# -------------------------------------------------------------------
# PDF
# -------------------------------------------------------------------

def generate_receipt_pdf(
    *,
    receipt,
    payment,
    invoice,
    quote,
    request,
    client,
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

            company_email = (
                getattr(
                    profile,
                    "email",
                    None,
                )
                or COMPANY_EMAIL
            )

            company_phone = (
                getattr(
                    profile,
                    "phone",
                    None,
                )
                or COMPANY_PHONE
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
            f"Reçu de paiement "
            f"{receipt.receipt_number}"
        ),
        author=company_name,
    )

    styles = getSampleStyleSheet()

    body_style = ParagraphStyle(
        "ReceiptBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor(
            "#374151"
        ),
    )

    small_style = ParagraphStyle(
        "ReceiptSmall",
        parent=body_style,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor(
            "#6B7280"
        ),
    )

    section_title = ParagraphStyle(
        "ReceiptSection",
        parent=body_style,
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=primary,
        spaceAfter=2 * mm,
    )

    amount_style = ParagraphStyle(
        "ReceiptAmount",
        parent=body_style,
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        alignment=TA_RIGHT,
        textColor=primary,
    )

    paid_style = ParagraphStyle(
        "ReceiptPaid",
        parent=body_style,
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        alignment=TA_CENTER,
        textColor=primary,
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

    issue_date = (
        receipt.issue_date.strftime(
            "%d/%m/%Y"
        )
        if receipt.issue_date
        else "Non défini"
    )

    invoice_number = (
        invoice.invoice_number
        if invoice
        else "—"
    )

    object_title = (
        request.title
        if request
        else (
            f"Paiement de la facture "
            f"{invoice_number}"
        )
    )

    document_header = (
        build_document_metadata(
            document_type=(
                "REÇU DE PAIEMENT"
            ),
            object_title=object_title,
            description=None,
            rows=[
                (
                    "N°",
                    receipt.receipt_number,
                ),
                (
                    "Date",
                    issue_date,
                ),
                (
                    "Facture liée",
                    invoice_number,
                ),
                (
                    "Statut",
                    get_receipt_status_label(
                        receipt.status
                    ),
                ),
            ],
            primary=primary,
            base_style=body_style,
        )
    )

    story.append(document_header)
    story.append(
        Spacer(1, 6 * mm)
    )

    # ---------------------------------------------------------------
    # Informations paiement
    # ---------------------------------------------------------------

    story.append(
        Paragraph(
            "DÉTAIL DU PAIEMENT",
            section_title,
        )
    )

    payment_date = (
        payment.payment_date.strftime(
            "%d/%m/%Y"
        )
        if payment
        and payment.payment_date
        else issue_date
    )

    payment_method = (
        get_payment_method_label(
            receipt.payment_method
        )
    )

    payment_reference = (
        receipt.payment_reference
        or "—"
    )

    payment_data = [
        [
            "Date du paiement",
            payment_date,
        ],
        [
            "Moyen de paiement",
            payment_method,
        ],
        [
            "Référence",
            safe_text(
                payment_reference
            ),
        ],
    ]

    payment_table = Table(
        payment_data,
        colWidths=[
            55 * mm,
            121 * mm,
        ],
    )

    payment_table.setStyle(
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
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.3,
                    colors.HexColor(
                        "#E2E8F0"
                    ),
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (0, -1),
                    "Helvetica-Bold",
                ),
                (
                    "FONTNAME",
                    (1, 0),
                    (1, -1),
                    "Helvetica",
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, -1),
                    colors.HexColor(
                        "#374151"
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

    story.append(payment_table)
    story.append(
        Spacer(1, 6 * mm)
    )

    # ---------------------------------------------------------------
    # Situation financière après ce paiement
    # ---------------------------------------------------------------

    story.append(
        Paragraph(
            "SITUATION APRÈS PAIEMENT",
            section_title,
        )
    )

    financial_data = [
        [
            Paragraph(
                "Montant reçu",
                body_style,
            ),
            Paragraph(
                money(
                    receipt.amount,
                    currency,
                ),
                amount_style,
            ),
        ],
        [
            Paragraph(
                "Total payé",
                body_style,
            ),
            Paragraph(
                money(
                    receipt.cumulative_paid,
                    currency,
                ),
                amount_style,
            ),
        ],
        [
            Paragraph(
                "Reste à payer",
                body_style,
            ),
            Paragraph(
                money(
                    receipt.remaining_due,
                    currency,
                ),
                amount_style,
            ),
        ],
    ]

    financial_table = Table(
        financial_data,
        colWidths=[
            100 * mm,
            76 * mm,
        ],
    )

    financial_table.setStyle(
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
                    0.7,
                    colors.HexColor(
                        "#CBD5E1"
                    ),
                ),
                (
                    "LINEABOVE",
                    (0, 2),
                    (-1, 2),
                    0.8,
                    secondary,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    10,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    10,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
            ]
        )
    )

    story.append(financial_table)

    # ---------------------------------------------------------------
    # Facture soldée
    # ---------------------------------------------------------------

    if (
        Decimal(
            receipt.remaining_due or 0
        )
        == Decimal("0")
    ):
        story.append(
            Spacer(1, 7 * mm)
        )

        paid_box = Table(
            [
                [
                    Paragraph(
                        (
                            "FACTURE "
                            "INTÉGRALEMENT "
                            "ACQUITTÉE"
                        ),
                        paid_style,
                    )
                ]
            ],
            colWidths=[
                176 * mm
            ],
        )

        paid_box.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, -1),
                        colors.HexColor(
                            "#ECFDF5"
                        ),
                    ),
                    (
                        "BOX",
                        (0, 0),
                        (-1, -1),
                        0.8,
                        colors.HexColor(
                            "#10B981"
                        ),
                    ),
                    (
                        "TOPPADDING",
                        (0, 0),
                        (-1, -1),
                        9,
                    ),
                    (
                        "BOTTOMPADDING",
                        (0, 0),
                        (-1, -1),
                        9,
                    ),
                ]
            )
        )

        story.append(paid_box)

    # ---------------------------------------------------------------
    # Mention informative
    # ---------------------------------------------------------------

    story.append(
        Spacer(1, 7 * mm)
    )

    story.append(
        Paragraph(
            (
                "Ce document atteste de la réception "
                "du paiement indiqué ci-dessus. "
                "Le solde affiché correspond à la "
                "situation de la facture immédiatement "
                "après l’enregistrement de ce paiement."
            ),
            small_style,
        )
    )

    doc.build(story)

    buffer.seek(0)

    return buffer
