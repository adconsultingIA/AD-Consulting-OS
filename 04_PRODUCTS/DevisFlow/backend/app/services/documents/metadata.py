from html import escape

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    Table,
    TableStyle,
)


def safe_text(value) -> str:
    if value is None:
        return ""

    return escape(str(value))


def build_document_metadata(
    *,
    document_type: str,
    object_title: str,
    description: str | None,
    rows: list[tuple[str, str]],
    primary,
    base_style,
):
    title_style = ParagraphStyle(
        f"{document_type.title()}TitleCompact",
        parent=base_style,
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=21,
        textColor=primary,
        spaceAfter=2 * mm,
    )

    description_html = ""

    if description:
        description_html = (
            "<br/>"
            "<font size='7.5'>"
            f"{safe_text(description)}"
            "</font>"
        )

    document_left = Paragraph(
        (
            f"<b>{safe_text(document_type.upper())}</b>"
            "<br/>"
            f"<font size='8'><b>Objet :</b> "
            f"{safe_text(object_title)}</font>"
            f"{description_html}"
        ),
        title_style,
    )

    metadata_data = [
        [
            "" if label is None else str(label),
            "" if value is None else str(value),
        ]
        for label, value in rows
    ]

    metadata = Table(
        metadata_data,
        colWidths=[
            35 * mm,
            45 * mm,
        ],
        hAlign="RIGHT",
    )

    metadata.setStyle(
        TableStyle(
            [
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
                        "#4B5563"
                    ),
                ),
                (
                    "ALIGN",
                    (1, 0),
                    (1, -1),
                    "RIGHT",
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
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
                    1,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    3,
                ),
            ]
        )
    )

    document_header = Table(
        [
            [
                document_left,
                metadata,
            ]
        ],
        colWidths=[
            96 * mm,
            80 * mm,
        ],
    )

    document_header.setStyle(
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
                    (1, 0),
                    (1, 0),
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
                    0,
                ),
            ]
        )
    )

    return document_header
