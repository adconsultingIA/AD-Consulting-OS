from decimal import Decimal
from html import escape
from io import BytesIO
from pathlib import Path
from app.services.documents.header import build_document_header
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
from app.services.documents.metadata import build_document_metadata

# -------------------------------------------------------------------
# Fallback local
# CoreFlow reste la source de vérité.
# -------------------------------------------------------------------

COMPANY_NAME = "AD Consulting IA"
COMPANY_PRODUCT = "DevisFlow"
COMPANY_EMAIL = "contact@adconsulting-ai.com"
COMPANY_PHONE = ""
COMPANY_ADDRESS = ""

BANK_ACCOUNT_HOLDER = ""
BANK_IBAN = ""
BANK_BIC = ""

LOGO_PATH = Path("app/assets/logo.png")

DEFAULT_PRIMARY_COLOR = "#0B1F4D"
DEFAULT_SECONDARY_COLOR = "#155EEF"
DEFAULT_ACCENT_COLOR = "#06B6D4"

LOGO_TIMEOUT = 8


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

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


def safe_text(value) -> str:
    if value is None:
        return ""

    return escape(str(value))


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

            return Image(
                BytesIO(response.content),
                width=28 * mm,
                height=12 * mm,
                kind="proportional",
            )

        except Exception:
            pass

    if LOGO_PATH.exists():
        try:
            return Image(
                str(LOGO_PATH),
                width=28 * mm,
                height=12 * mm,
                kind="proportional",
            )
        except Exception:
            pass

    return None


def section_table_style(
    primary,
):
    return TableStyle(
        [
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#F3F4F6"),
            ),
            (
                "TEXTCOLOR",
                (0, 0),
                (-1, 0),
                primary,
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
                (-1, -1),
                7.5,
            ),
            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.3,
                colors.HexColor("#D1D5DB"),
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
                "VALIGN",
                (0, 0),
                (-1, -1),
                "TOP",
            ),
        ]
    )


# -------------------------------------------------------------------
# PDF
# -------------------------------------------------------------------

def generate_invoice_pdf(
    *,
    invoice,
    client,
    request,
    quote,
    items,
    payments,
    credit_notes,
    refunds,
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

    bank_account_holder = (
        BANK_ACCOUNT_HOLDER
    )
    bank_iban = BANK_IBAN
    bank_bic = BANK_BIC
    bank_name = ""

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

        bank_account = getattr(
            commercial_context,
            "default_bank_account",
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

        if bank_account:
            bank_account_holder = (
                bank_account.account_holder_name
            )

            bank_iban = (
                bank_account.iban
                or ""
            )

            bank_bic = (
                bank_account.bic
                or ""
            )

            bank_name = (
                bank_account.bank_name
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
    # Identifiant légal
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
        title=(
            f"Facture "
            f"{invoice.invoice_number}"
        ),
        author=company_name,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=24,
        textColor=primary,
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

    section_title = ParagraphStyle(
        "SectionTitle",
        parent=body_style,
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=primary,
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

    invoice_date = (
    invoice.issue_date.strftime(
        "%d/%m/%Y"
    )
    if invoice.issue_date
    else "Non émise"
    )

    due_date = (
        invoice.due_date.strftime(
            "%d/%m/%Y"
        )
        if invoice.due_date
        else "Non définie"
    )

    document_header = build_document_metadata(
        document_type="FACTURE",
        object_title=request.title,
        description=None,
        rows=[
            (
                "N°",
                invoice.invoice_number,
            ),
            (
                "Date",
                invoice_date,
            ),
            (
                "Échéance",
                due_date,
            ),
            (
                "Devis lié",
                (
                    quote.quote_number
                    if quote
                    else "—"
                ),
            ),
            (
                "Statut",
                str(invoice.status).upper(),
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
    # Items
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
                    "ALIGN",
                    (1, 1),
                    (-1, -1),
                    "RIGHT",
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "FONTSIZE",
                    (0, 1),
                    (-1, -1),
                    8,
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
        Spacer(1, 3 * mm)
    )

    # ---------------------------------------------------------------
    # Totaux
    # ---------------------------------------------------------------

    totals_data = [
        [
            "Total HT",
            money(
                invoice.subtotal,
                currency,
            ),
        ],
        [
            tax_label,
            money(
                invoice.vat_amount,
                currency,
            ),
        ],
        [
            "TOTAL TTC ORIGINAL",
            money(
                invoice.total,
                currency,
            ),
        ],
    ]

    if Decimal(
        invoice.credit_total or 0
    ) > Decimal("0"):
        totals_data.append(
            [
                "Avoirs",
                (
                    "- "
                    + money(
                        invoice.credit_total,
                        currency,
                    )
                ),
            ]
        )

        totals_data.append(
            [
                "NET FACTURÉ",
                money(
                    invoice.net_total,
                    currency,
                ),
            ]
        )

    totals_data.append(
        [
            "Paiements reçus",
            money(
                invoice.amount_paid,
                currency,
            ),
        ]
    )

    if Decimal(
        invoice.refunded_total or 0
    ) > Decimal("0"):
        totals_data.append(
            [
                "Remboursé",
                money(
                    invoice.refunded_total,
                    currency,
                ),
            ]
        )

    totals_data.append(
        [
            "RESTE DÛ",
            money(
                invoice.amount_due,
                currency,
            ),
        ]
    )

    if Decimal(
        invoice.customer_credit or 0
    ) > Decimal("0"):
        totals_data.append(
            [
                "Crédit client",
                money(
                    invoice.customer_credit,
                    currency,
                ),
            ]
        )

    totals = Table(
        totals_data,
        colWidths=[
            48 * mm,
            42 * mm,
        ],
        hAlign="RIGHT",
    )

    totals_style = [
        (
            "ALIGN",
            (0, 0),
            (-1, -1),
            "RIGHT",
        ),
        (
            "FONTNAME",
            (0, 0),
            (-1, -1),
            "Helvetica",
        ),
        (
            "FONTSIZE",
            (0, 0),
            (-1, -1),
            9,
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
        (
            "FONTNAME",
            (0, 2),
            (-1, 2),
            "Helvetica-Bold",
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
    ]

    # Mise en évidence du reste dû
    amount_due_row = None

    for index, row in enumerate(
        totals_data
    ):
        if row[0] == "RESTE DÛ":
            amount_due_row = index
            break

    if amount_due_row is not None:
        totals_style.extend(
            [
                (
                    "FONTNAME",
                    (0, amount_due_row),
                    (-1, amount_due_row),
                    "Helvetica-Bold",
                ),
                (
                    "TEXTCOLOR",
                    (0, amount_due_row),
                    (-1, amount_due_row),
                    primary,
                ),
            ]
        )

    totals.setStyle(
        TableStyle(totals_style)
    )

    story.append(totals)

    # ---------------------------------------------------------------
    # Information fiscale
    # ---------------------------------------------------------------

    if tax_information:
        story.append(
            Spacer(1, 3 * mm)
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
    # Paiements
    # ---------------------------------------------------------------

    if payments:
        story.append(
            Spacer(1, 3 * mm)
        )

        story.append(
            Paragraph(
                "PAIEMENTS",
                section_title,
            )
        )

        story.append(
            Spacer(1, 2 * mm)
        )

        payment_data = [
            [
                "DATE",
                "MONTANT",
                "MODE",
                "RÉFÉRENCE",
            ]
        ]

        for payment in payments:
            payment_data.append(
                [
                    payment.payment_date.strftime(
                        "%d/%m/%Y"
                    ),
                    money(
                        payment.amount,
                        currency,
                    ),
                    safe_text(
                        payment.payment_method
                        or "—"
                    ),
                    safe_text(
                        payment.reference
                        or "—"
                    ),
                ]
            )

        payments_table = Table(
            payment_data,
            colWidths=[
                34 * mm,
                38 * mm,
                46 * mm,
                58 * mm,
            ],
            repeatRows=1,
        )

        payment_style = (
            section_table_style(primary)
        )

        payment_style.add(
            "ALIGN",
            (1, 1),
            (1, -1),
            "RIGHT",
        )

        payments_table.setStyle(
            payment_style
        )

        story.append(payments_table)

    # ---------------------------------------------------------------
    # Avoirs
    # ---------------------------------------------------------------

    if credit_notes:
        story.append(
            Spacer(1, 3 * mm)
        )

        story.append(
            Paragraph(
                "AVOIRS",
                section_title,
            )
        )

        story.append(
            Spacer(1, 2 * mm)
        )

        credit_data = [
            [
                "N° AVOIR",
                "DATE",
                "MONTANT",
                "MOTIF",
            ]
        ]

        for credit in credit_notes:
            credit_data.append(
                [
                    safe_text(
                        credit.credit_note_number
                    ),
                    credit.issue_date.strftime(
                        "%d/%m/%Y"
                    ),
                    money(
                        credit.amount,
                        currency,
                    ),
                    Paragraph(
                        safe_text(
                            credit.reason
                        ),
                        small_style,
                    ),
                ]
            )

        credit_table = Table(
            credit_data,
            colWidths=[
                38 * mm,
                30 * mm,
                32 * mm,
                76 * mm,
            ],
            repeatRows=1,
        )

        credit_style = (
            section_table_style(primary)
        )

        credit_style.add(
            "ALIGN",
            (2, 1),
            (2, -1),
            "RIGHT",
        )

        credit_table.setStyle(
            credit_style
        )

        story.append(credit_table)

    # ---------------------------------------------------------------
    # Remboursements
    # ---------------------------------------------------------------

    if refunds:
        story.append(
            Spacer(1, 3 * mm)
        )

        story.append(
            Paragraph(
                "REMBOURSEMENTS",
                section_title,
            )
        )

        story.append(
            Spacer(1, 2 * mm)
        )

        refund_data = [
            [
                "DATE",
                "MONTANT",
                "MODE",
                "RÉFÉRENCE",
            ]
        ]

        for refund in refunds:
            refund_data.append(
                [
                    refund.refund_date.strftime(
                        "%d/%m/%Y"
                    ),
                    money(
                        refund.amount,
                        currency,
                    ),
                    safe_text(
                        refund.refund_method
                        or "—"
                    ),
                    safe_text(
                        refund.reference
                        or "—"
                    ),
                ]
            )

        refund_table = Table(
            refund_data,
            colWidths=[
                34 * mm,
                38 * mm,
                46 * mm,
                58 * mm,
            ],
            repeatRows=1,
        )

        refund_style = (
            section_table_style(primary)
        )

        refund_style.add(
            "ALIGN",
            (1, 1),
            (1, -1),
            "RIGHT",
        )

        refund_table.setStyle(
            refund_style
        )

        story.append(refund_table)

    # ---------------------------------------------------------------
    # Conditions / notes
    # ---------------------------------------------------------------

    if invoice.payment_terms:
        story.append(
            Spacer(1, 3 * mm)
        )

        story.append(
            Paragraph(
                "<b>Conditions de paiement</b>",
                section_title,
            )
        )

        story.append(
            Paragraph(
                safe_text(
                    invoice.payment_terms
                ),
                small_style,
            )
        )

    if invoice.notes:
        story.append(
            Spacer(1, 3 * mm)
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
                    invoice.notes
                ),
                small_style,
            )
        )

    # ---------------------------------------------------------------
    # Footer
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
                (
                    "Banque : "
                    f"{bank_name}"
                )
            )

        if bank_iban:
            footer_parts.append(
                (
                    "IBAN : "
                    f"{bank_iban}"
                )
            )

        if bank_bic:
            footer_parts.append(
                (
                    "BIC : "
                    f"{bank_bic}"
                )
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
    # Build
    # ---------------------------------------------------------------

    doc.build(
        story,
        onFirstPage=draw_footer,
        onLaterPages=draw_footer,
    )

    buffer.seek(0)

    return buffer
