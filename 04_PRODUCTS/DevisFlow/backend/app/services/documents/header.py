from html import escape
from io import BytesIO
from pathlib import Path

import requests
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    Table,
    TableStyle,
)


LOGO_PATH = Path("app/assets/logo.png")
LOGO_TIMEOUT = 8


def safe_text(value) -> str:
    if value is None:
        return ""

    return escape(str(value))


def build_product_logo(
    *,
    document_logo_url: str | None,
    product_name: str,
    primary,
    fallback_parent_style,
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
                width=26 * mm,
                height=11 * mm,
                kind="proportional",
            )

        except Exception:
            pass

    if LOGO_PATH.exists():
        try:
            return Image(
                str(LOGO_PATH),
                width=26 * mm,
                height=11 * mm,
                kind="proportional",
            )
        except Exception:
            pass

    fallback_style = ParagraphStyle(
        "ProductLogoFallback",
        parent=fallback_parent_style,
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=17,
        alignment=TA_CENTER,
        textColor=primary,
    )

    return Paragraph(
        f"<b>{safe_text(product_name)}</b>",
        fallback_style,
    )


def build_document_header(
    *,
    company_name: str,
    company_email: str,
    company_phone: str,
    company_address: str,
    primary_legal_identifier,
    product_name: str,
    document_logo_url: str | None,
    client,
    primary,
    accent,
    base_style,
):
    issuer_style = ParagraphStyle(
        "DocumentIssuer",
        parent=base_style,
        fontSize=7.4,
        leading=9.2,
        textColor=colors.HexColor("#374151"),
    )

    client_style = ParagraphStyle(
        "DocumentClient",
        parent=base_style,
        fontSize=7.4,
        leading=9.2,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#374151"),
    )

    center_style = ParagraphStyle(
        "DocumentProductCenter",
        parent=base_style,
        alignment=TA_CENTER,
    )

    issuer_lines = [
        "<b>ÉMETTEUR</b>",
        f"<b>{safe_text(company_name)}</b>",
    ]

    if company_email:
        issuer_lines.append(
            safe_text(company_email)
        )

    if company_phone:
        issuer_lines.append(
            safe_text(company_phone)
        )

    if company_address:
        issuer_lines.append(
            safe_text(company_address)
        )

    if primary_legal_identifier:
        issuer_lines.append(
            (
                f"{safe_text(primary_legal_identifier.identifier_type)}"
                " : "
                f"{safe_text(primary_legal_identifier.identifier_value)}"
            )
        )

    issuer_block = Paragraph(
        "<br/>".join(issuer_lines),
        issuer_style,
    )

    client_lines = [
        "<b>CLIENT</b>",
        f"<b>{safe_text(client.company_name)}</b>",
    ]

    contact_name = getattr(
        client,
        "contact_name",
        None,
    )

    if contact_name:
        client_lines.append(
            safe_text(contact_name)
        )

    client_email = getattr(
        client,
        "email",
        None,
    )

    if client_email:
        client_lines.append(
            safe_text(client_email)
        )

    client_phone = getattr(
        client,
        "phone",
        None,
    )

    if client_phone:
        client_lines.append(
            safe_text(client_phone)
        )

    client_address = getattr(
        client,
        "address",
        None,
    )

    if client_address:
        client_lines.append(
            safe_text(client_address)
        )

    client_block = Paragraph(
        "<br/>".join(client_lines),
        client_style,
    )

    product_logo = build_product_logo(
        document_logo_url=document_logo_url,
        product_name=product_name,
        primary=primary,
        fallback_parent_style=center_style,
    )

    header = Table(
        [
            [
                issuer_block,
                product_logo,
                client_block,
            ]
        ],
        colWidths=[
            72 * mm,
            32 * mm,
            72 * mm,
        ],
    )

    header.setStyle(
        TableStyle(
            [
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "ALIGN",
                    (0, 0),
                    (0, 0),
                    "LEFT",
                ),
                (
                    "ALIGN",
                    (1, 0),
                    (1, 0),
                    "CENTER",
                ),
                (
                    "ALIGN",
                    (2, 0),
                    (2, 0),
                    "RIGHT",
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
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
            ]
        )
    )

    divider = Table(
        [[""]],
        colWidths=[176 * mm],
        rowHeights=[0.6 * mm],
        style=[
            (
                "BACKGROUND",
                (0, 0),
                (-1, -1),
                accent,
            )
        ],
    )

    return header, divider
