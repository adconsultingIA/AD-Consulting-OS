from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.database_models import (
    ClientDB,
    QuoteDB,
    QuoteItemDB,
    RequestDB,
)
from app.models.quote_status import QuoteStatus
from app.schemas.quote import (
    QuoteCreate,
    QuoteItemCreate,
    QuoteItemResponse,
    QuoteResponse,
)
from app.services.coreflow_client import (
    get_commercial_context,
)
from app.services.document_number_service import (
    next_document_number,
)
from app.services.tax_engine import (
    CustomerTaxContext,
    TaxDecision,
    resolve_tax,
)


MONEY = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(
MONEY,
rounding=ROUND_HALF_UP,
)


def generate_quote_number(
    db: Session,
) -> str:
    year = datetime.now(
        timezone.utc
    ).year

    return next_document_number(
db,
document_type="quote",
prefix="DEV",
table_name="quotes",
column_name="quote_number",
year=year,
)


def build_customer_tax_context(
    client: ClientDB,
) -> CustomerTaxContext:
    return CustomerTaxContext(
country_code=client.country_code,
region=client.region,
customer_type=(
    client.customer_type
    or "business"
),
tax_system=client.tax_system,
tax_registered=client.tax_registered,
tax_identifier=client.tax_identifier,
)


def calculate_item(
    item: QuoteItemCreate,
    tax_decision: TaxDecision,
):
    tax_rate = money(
        tax_decision.tax_rate
    )

    subtotal = money(
        item.quantity
        * item.unit_price
    )

    vat_amount = money(
        subtotal
        * tax_rate
        / Decimal("100")
    )

    total = money(
        subtotal
        + vat_amount
    )

    return (
subtotal,
vat_amount,
total,
tax_rate,
)


def get_quote_items(
    db: Session,
    quote_id: str,
):
    items = (
        db.query(QuoteItemDB)
        .filter(
            QuoteItemDB.quote_id
            == quote_id
        )
        .all()
    )

    return [
QuoteItemResponse(
    id=UUID(item.id),
    description=item.description,
    service_category=(
        item.service_category
        or "other"
    ),
    quantity=item.quantity,
    unit_price=item.unit_price,
    vat_rate=item.vat_rate,
    tax_type=item.tax_type,
    tax_treatment=(
        item.tax_treatment
    ),
    tax_reason=item.tax_reason,
    requires_manual_review=(
        item.requires_manual_review
        or False
    ),
    subtotal=item.subtotal,
    vat_amount=item.vat_amount,
    total=item.total,
)
for item in items
]


def build_quote_response(
    db: Session,
    quote: QuoteDB,
) -> QuoteResponse:
    return QuoteResponse(
id=UUID(quote.id),
quote_number=quote.quote_number,
request_id=UUID(
    quote.request_id
),
organization_id=(
    UUID(
        quote.organization_id
    )
    if quote.organization_id
    else None
),
status=QuoteStatus(
    quote.status
),
version=quote.version,
valid_until=quote.valid_until,
notes=quote.notes,
acceptance_checked=bool(
    quote.acceptance_checked
),
acceptance_method=(
    quote.acceptance_method
),
accepted_at=(
    quote.accepted_at
),
accepted_by_user_id=(
    quote.accepted_by_user_id
),
acceptance_reference=(
    quote.acceptance_reference
),
acceptance_note=(
    quote.acceptance_note
),
acceptance_document_path=(
    quote.acceptance_document_path
),
items=get_quote_items(
    db,
    quote.id,
),
subtotal=quote.subtotal,
vat_amount=quote.vat_amount,
total=quote.total,
created_at=quote.created_at,
updated_at=quote.updated_at,
)


def create_quote_for_organization(
    db: Session,
    *,
    organization_id: str,
    payload: QuoteCreate,
) -> QuoteResponse:
    request = (
        db.query(RequestDB)
        .filter(
            RequestDB.id
            == str(payload.request_id),
            RequestDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    client = (
        db.query(ClientDB)
        .filter(
            ClientDB.id == request.client_id,
            ClientDB.organization_id
            == organization_id,
        )
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    customer_tax_context = (
        build_customer_tax_context(
            client
        )
    )

    try:
        commercial_context = (
            get_commercial_context(
                organization_id
            )
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "CoreFlow est indisponible. "
                "Impossible de déterminer "
                "le traitement fiscal."
            ),
        ) from exc

    subtotal = Decimal("0")
    vat_amount = Decimal("0")

    calculated_items = []

    for item in payload.items:
        tax_decision = resolve_tax(
            issuer_tax_profile=(
                commercial_context.tax_profile
            ),
            customer=(
                customer_tax_context
            ),
            service_category=(
                item.service_category
            ),
        )

        if (
            tax_decision
            .requires_manual_review
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_409_CONFLICT
                ),
                detail=(
                    "Fiscal review required for "
                    f"'{item.description}': "
                    f"{tax_decision.tax_reason}"
                ),
            )

        (
            item_subtotal,
            item_vat,
            item_total,
            item_tax_rate,
        ) = calculate_item(
            item,
            tax_decision,
        )

        subtotal += item_subtotal
        vat_amount += item_vat

        calculated_items.append(
            {
                "payload": item,
                "subtotal": item_subtotal,
                "vat_amount": item_vat,
                "total": item_total,
                "vat_rate": item_tax_rate,
                "tax_decision": (
                    tax_decision
                ),
            }
        )

    subtotal = money(
        subtotal
    )
    vat_amount = money(
        vat_amount
    )
    total = money(
        subtotal + vat_amount
    )

    now = datetime.now(
        timezone.utc
    )

    quote_id = str(
        uuid4()
    )

    quote = QuoteDB(
        id=quote_id,
        request_id=str(
            payload.request_id
        ),
        organization_id=(
            organization_id
        ),
        quote_number=(
            generate_quote_number(
                db
            )
        ),
        status=(
            QuoteStatus.DRAFT.value
        ),
        version=1,
        valid_until=(
            payload.valid_until
        ),
        notes=payload.notes,
        subtotal=subtotal,
        vat_amount=vat_amount,
        total=total,
        created_at=now,
        updated_at=now,
    )

    db.add(quote)

    for calculated in (
        calculated_items
    ):
        item = calculated[
            "payload"
        ]

        quote_item = QuoteItemDB(
            id=str(
                uuid4()
            ),
            quote_id=quote_id,
            description=(
                item.description
            ),
            service_category=(
                item.service_category
            ),
            quantity=(
                item.quantity
            ),
            unit_price=(
                item.unit_price
            ),
            vat_rate=(
                calculated[
                    "vat_rate"
                ]
            ),
            tax_type=(
                calculated[
                    "tax_decision"
                ].tax_type
            ),
            tax_treatment=(
                calculated[
                    "tax_decision"
                ].tax_treatment
            ),
            tax_reason=(
                calculated[
                    "tax_decision"
                ].tax_reason
            ),
            requires_manual_review=(
                calculated[
                    "tax_decision"
                ].requires_manual_review
            ),
            subtotal=(
                calculated[
                    "subtotal"
                ]
            ),
            vat_amount=(
                calculated[
                    "vat_amount"
                ]
            ),
            total=(
                calculated[
                    "total"
                ]
            ),
        )

        db.add(
            quote_item
        )

    request.status = "quoted"

    db.commit()
    db.refresh(quote)

    return build_quote_response(
        db,
        quote,
    )
