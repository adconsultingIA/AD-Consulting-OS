from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    func,
)
from datetime import datetime
from app.core.database import Base


# ---------------------------------------------------------------------
# CLIENTS
# ---------------------------------------------------------------------

class ClientDB(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True, index=True)

    organization_id = Column(
        String,
        nullable=True,
        index=True,
    )

    company_name = Column(
        String(200),
        nullable=False,
    )

    contact_name = Column(
        String(200),
        nullable=False,
    )

    email = Column(
        String(320),
        nullable=False,
    )

    phone = Column(
        String(100),
        nullable=True,
    )

    address = Column(
        Text,
        nullable=True,
    )

    country_code = Column(
        String(2),
        nullable=True,
    )

    region = Column(
        String(100),
        nullable=True,
    )

    customer_type = Column(
        String(20),
        nullable=False,
        default="business",
    )

    tax_system = Column(
        String(50),
        nullable=True,
    )

    tax_registered = Column(
        Boolean,
        nullable=True,
    )

    tax_identifier = Column(
        String(255),
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    active = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


# ---------------------------------------------------------------------
# REQUESTS
# ---------------------------------------------------------------------

class RequestDB(Base):
    __tablename__ = "requests"

    id = Column(String, primary_key=True, index=True)

    organization_id = Column(
        String,
        nullable=True,
        index=True,
    )

    client_id = Column(
        String,
        ForeignKey("clients.id"),
        nullable=False,
        index=True,
    )

    title = Column(
        String(250),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    budget = Column(
        Numeric(12, 2),
        nullable=True,
    )

    deadline = Column(
        Date,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="new",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


# ---------------------------------------------------------------------
# QUOTES
# ---------------------------------------------------------------------

class QuoteDB(Base):
    __tablename__ = "quotes"

    id = Column(String, primary_key=True, index=True)

    request_id = Column(
        String,
        ForeignKey("requests.id"),
        nullable=False,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=True,
        index=True,
    )

    issuer_snapshot = Column(
        JSON,
        nullable=True,
    )

    quote_number = Column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="draft",
    )

    version = Column(
        Integer,
        nullable=False,
        default=1,
    )

    valid_until = Column(
        Date,
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    # -------------------------------------------------
    # CONTROLLED ACCEPTANCE
    # -------------------------------------------------

    acceptance_checked = Column(
        Integer,
        nullable=False,
        default=0,
    )

    acceptance_method = Column(
        String(50),
        nullable=True,
    )

    accepted_at = Column(
        DateTime,
        nullable=True,
    )

    accepted_by_user_id = Column(
        String,
        nullable=True,
    )

    acceptance_reference = Column(
        Text,
        nullable=True,
    )

    acceptance_note = Column(
        Text,
        nullable=True,
    )

    acceptance_document_path = Column(
        Text,
        nullable=True,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class QuoteItemDB(Base):
    __tablename__ = "quote_items"

    id = Column(String, primary_key=True, index=True)

    quote_id = Column(
        String,
        ForeignKey("quotes.id"),
        nullable=False,
        index=True,
    )

    description = Column(
        Text,
        nullable=False,
    )

    service_category = Column(
        String(50),
        nullable=False,
        default="other",
    )

    tax_type = Column(
        String(50),
        nullable=True,
    )

    tax_treatment = Column(
        String(50),
        nullable=True,
    )

    tax_reason = Column(
        Text,
        nullable=True,
    )

    requires_manual_review = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    quantity = Column(
        Numeric(12, 2),
        nullable=False,
    )

    unit_price = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_rate = Column(
        Numeric(5, 2),
        nullable=False,
        default=20,
    )

    tax_type = Column(
        String(50),
        nullable=True,
    )

    tax_treatment = Column(
        String(50),
        nullable=True,
    )

    tax_reason = Column(
        Text,
        nullable=True,
    )

    requires_manual_review = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
    )


# ---------------------------------------------------------------------
# RECURRING INVOICES
# ---------------------------------------------------------------------

class RecurringInvoiceDB(Base):
    __tablename__ = "recurring_invoices"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    quote_id = Column(
        String,
        ForeignKey("quotes.id"),
        nullable=False,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=True,
        index=True,
    )

    issuer_snapshot = Column(
        JSON,
        nullable=True,
    )

    service_name = Column(
        String(250),
        nullable=False,
    )

    frequency = Column(
        String(30),
        nullable=False,
    )

    start_date = Column(
        Date,
        nullable=False,
    )

    next_invoice_date = Column(
        Date,
        nullable=False,
        index=True,
    )

    status = Column(
        String(30),
        nullable=False,
        default="active",
        index=True,
    )

    last_generated_at = Column(
        DateTime,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


# ---------------------------------------------------------------------
# INVOICES
# ---------------------------------------------------------------------

class InvoiceDB(Base):
    __tablename__ = "invoices"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    quote_id = Column(
        String,
        ForeignKey("quotes.id"),
        nullable=False,
        index=True,
    )

    recurring_invoice_id = Column(
        String,
        ForeignKey("recurring_invoices.id"),
        nullable=True,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=True,
        index=True,
    )

    issuer_snapshot = Column(
        JSON,
        nullable=True,
    )

    invoice_number = Column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="draft",
    )

    invoice_type = Column(
        String(20),
        nullable=False,
        default="standard",
    )

    billing_percentage = Column(
        Numeric(7, 4),
        nullable=True,
    )

    billing_sequence = Column(
        Integer,
        nullable=True,
    )


    issue_date = Column(
        Date,
        nullable=True,
    )

    due_date = Column(
        Date,
        nullable=True,
    )

    payment_terms = Column(
        Text,
        nullable=True,
    )

    payment_method = Column(
        String(50),
        nullable=True,
    )

    payment_terms_days = Column(
        Integer,
        nullable=True,
    )

    next_reminder_date = Column(
        Date,
        nullable=True,
    )

    reminder_interval_days = Column(
        Integer,
        nullable=False,
        default=7,
    )

    reminder_paused = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    amount_paid = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    amount_due = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )
    
    credit_total = Column(
    Numeric(12, 2),
    nullable=False,
    default=0,
    )

    net_total = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    customer_credit = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )
    
    refunded_total = Column(
    Numeric(12, 2),
    nullable=False,
    default=0,
)


    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class InvoiceItemDB(Base):
    __tablename__ = "invoice_items"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    invoice_id = Column(
        String,
        ForeignKey("invoices.id"),
        nullable=False,
        index=True,
    )

    quote_item_id = Column(
        String,
        ForeignKey("quote_items.id"),
        nullable=True,
        index=True,
    )

    description = Column(
        Text,
        nullable=False,
    )

    quantity = Column(
        Numeric(12, 2),
        nullable=False,
    )

    unit_price = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_rate = Column(
        Numeric(5, 2),
        nullable=False,
        default=20,
    )

    tax_type = Column(
        String(50),
        nullable=True,
    )

    tax_treatment = Column(
        String(50),
        nullable=True,
    )

    tax_reason = Column(
        Text,
        nullable=True,
    )

    requires_manual_review = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
    )


# ---------------------------------------------------------------------
# PAYMENTS
# ---------------------------------------------------------------------

class PaymentDB(Base):
    __tablename__ = "payments"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    invoice_id = Column(
        String,
        ForeignKey("invoices.id"),
        nullable=False,
        index=True,
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    payment_date = Column(
        Date,
        nullable=False,
    )

    payment_method = Column(
        String(50),
        nullable=True,
    )

    reference = Column(
        String(250),
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


# ---------------------------------------------------------------------
# PAYMENT RECEIPTS
# ---------------------------------------------------------------------

class ReceiptDB(Base):
    __tablename__ = "receipts"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    payment_id = Column(
        String,
        ForeignKey("payments.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    invoice_id = Column(
        String,
        ForeignKey("invoices.id"),
        nullable=False,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=True,
        index=True,
    )

    receipt_number = Column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    issue_date = Column(
        Date,
        nullable=False,
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    cumulative_paid = Column(
        Numeric(12, 2),
        nullable=False,
    )

    remaining_due = Column(
        Numeric(12, 2),
        nullable=False,
    )

    payment_method = Column(
        String(50),
        nullable=True,
    )

    payment_reference = Column(
        String(250),
        nullable=True,
    )

    issuer_snapshot = Column(
        JSON,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="issued",
    )

    sent_at = Column(
        DateTime,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PaymentReminderDB(Base):
    __tablename__ = "payment_reminders"

    id = Column(String, primary_key=True)

    invoice_id = Column(
        String,
        ForeignKey("invoices.id"),
        nullable=False,
        index=True,
    )

    reminder_date = Column(
        Date,
        nullable=False,
    )

    channel = Column(
        String,
        nullable=False,
        default="email",
    )

    subject = Column(
        String,
        nullable=True,
    )

    message = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )


class CreditNoteDB(Base):
    __tablename__ = "credit_notes"

    id = Column(String, primary_key=True)

    invoice_id = Column(
        String,
        ForeignKey("invoices.id"),
        nullable=False,
        index=True,
    )

    credit_note_number = Column(
        String,
        nullable=False,
        unique=True,
        index=True,
    )

    issue_date = Column(
        Date,
        nullable=False,
    )

    reason = Column(
        String,
        nullable=False,
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    status = Column(
        String,
        nullable=False,
        default="issued",
    )

    notes = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

# ---------------------------------------------------------------------
# REFUNDS
# ---------------------------------------------------------------------

class RefundDB(Base):
    __tablename__ = "refunds"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    invoice_id = Column(
        String,
        ForeignKey("invoices.id"),
        nullable=False,
        index=True,
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    refund_date = Column(
        Date,
        nullable=False,
    )

    refund_method = Column(
        String(50),
        nullable=True,
    )

    reference = Column(
        String(250),
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

# ---------------------------------------------------------------------
# PROFORMAS
# ---------------------------------------------------------------------

class ProformaDB(Base):
    __tablename__ = "proformas"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    quote_id = Column(
        String,
        ForeignKey("quotes.id"),
        nullable=False,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=True,
        index=True,
    )

    issuer_snapshot = Column(
        JSON,
        nullable=True,
    )

    proforma_number = Column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="draft",
    )

    issue_date = Column(
        Date,
        nullable=True,
    )

    valid_until = Column(
        Date,
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ProformaItemDB(Base):
    __tablename__ = "proforma_items"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    proforma_id = Column(
        String,
        ForeignKey("proformas.id"),
        nullable=False,
        index=True,
    )

    quote_item_id = Column(
        String,
        ForeignKey("quote_items.id"),
        nullable=True,
        index=True,
    )

    description = Column(
        Text,
        nullable=False,
    )

    quantity = Column(
        Numeric(12, 2),
        nullable=False,
    )

    unit_price = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_rate = Column(
        Numeric(5, 2),
        nullable=False,
        default=0,
    )

    tax_type = Column(
        String(50),
        nullable=True,
    )

    tax_treatment = Column(
        String(50),
        nullable=True,
    )

    tax_reason = Column(
        Text,
        nullable=True,
    )

    requires_manual_review = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
    )


# ---------------------------------------------------------------------
# OPERATIONAL DOCUMENTS
# Bon de livraison / Bon d'intervention
# ---------------------------------------------------------------------

class OperationalDocumentDB(Base):
    __tablename__ = "operational_documents"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    quote_id = Column(
        String,
        ForeignKey("quotes.id"),
        nullable=False,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=True,
        index=True,
    )

    issuer_snapshot = Column(
        JSON,
        nullable=True,
    )

    document_type = Column(
        String(50),
        nullable=False,
        index=True,
    )

    document_number = Column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="draft",
    )

    issue_date = Column(
        Date,
        nullable=True,
    )

    execution_date = Column(
        Date,
        nullable=True,
    )

    location_address = Column(
        Text,
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class OperationalDocumentItemDB(Base):
    __tablename__ = "operational_document_items"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    operational_document_id = Column(
        String,
        ForeignKey("operational_documents.id"),
        nullable=False,
        index=True,
    )

    quote_item_id = Column(
        String,
        ForeignKey("quote_items.id"),
        nullable=True,
        index=True,
    )

    description = Column(
        Text,
        nullable=False,
    )

    quantity = Column(
        Numeric(12, 2),
        nullable=False,
    )

    unit_price = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_rate = Column(
        Numeric(5, 2),
        nullable=False,
        default=0,
    )

    tax_type = Column(
        String(50),
        nullable=True,
    )

    tax_treatment = Column(
        String(50),
        nullable=True,
    )

    tax_reason = Column(
        Text,
        nullable=True,
    )

    requires_manual_review = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
    )


# ---------------------------------------------------------------------
# PURCHASE ORDERS
# ---------------------------------------------------------------------

class PurchaseOrderDB(Base):
    __tablename__ = "purchase_orders"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    quote_id = Column(
        String,
        ForeignKey("quotes.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=True,
        index=True,
    )

    issuer_snapshot = Column(
        JSON,
        nullable=True,
    )

    purchase_order_number = Column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="draft",
    )

    order_date = Column(
        Date,
        nullable=True,
    )

    intervention_address = Column(
        Text,
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class PurchaseOrderItemDB(Base):
    __tablename__ = "purchase_order_items"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    purchase_order_id = Column(
        String,
        ForeignKey("purchase_orders.id"),
        nullable=False,
        index=True,
    )

    description = Column(
        Text,
        nullable=False,
    )

    quantity = Column(
        Numeric(12, 2),
        nullable=False,
    )

    unit_price = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_rate = Column(
        Numeric(5, 2),
        nullable=False,
        default=0,
    )

    tax_type = Column(
        String(50),
        nullable=True,
    )

    tax_treatment = Column(
        String(50),
        nullable=True,
    )

    tax_reason = Column(
        Text,
        nullable=True,
    )

    requires_manual_review = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    subtotal = Column(
        Numeric(12, 2),
        nullable=False,
    )

    vat_amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    total = Column(
        Numeric(12, 2),
        nullable=False,
    )


# ---------------------------------------------------------------------
# FORECASTING ENGINE
# ---------------------------------------------------------------------

class ForecastModelChampionDB(Base):
    __tablename__ = "forecast_model_champions"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=False,
        index=True,
    )

    indicator = Column(
        String(100),
        nullable=False,
        index=True,
    )

    model_code = Column(
        String(100),
        nullable=False,
    )

    rmse = Column(
        Numeric(18, 6),
        nullable=False,
    )

    mae = Column(
        Numeric(18, 6),
        nullable=False,
    )

    smape = Column(
        Numeric(18, 6),
        nullable=False,
    )

    folds = Column(
        Integer,
        nullable=False,
        default=0,
    )

    observations = Column(
        Integer,
        nullable=False,
        default=0,
    )

    selected_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ForecastModelEvaluationDB(Base):
    __tablename__ = "forecast_model_evaluations"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=False,
        index=True,
    )

    indicator = Column(
        String(100),
        nullable=False,
        index=True,
    )

    model_code = Column(
        String(100),
        nullable=False,
        index=True,
    )

    rmse = Column(
        Numeric(18, 6),
        nullable=False,
    )

    mae = Column(
        Numeric(18, 6),
        nullable=False,
    )

    smape = Column(
        Numeric(18, 6),
        nullable=False,
    )

    folds = Column(
        Integer,
        nullable=False,
        default=0,
    )

    observations = Column(
        Integer,
        nullable=False,
        default=0,
    )

    challenger_gain_pct = Column(
        Numeric(10, 4),
        nullable=True,
    )

    promoted = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    evaluation_role = Column(
        String(50),
        nullable=False,
        default="candidate",
    )

    evaluated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class ForecastRunDB(Base):
    __tablename__ = "forecast_runs"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=False,
        index=True,
    )

    indicator = Column(
        String(100),
        nullable=False,
        index=True,
    )

    status = Column(
        String(50),
        nullable=False,
    )

    selected_model = Column(
        String(100),
        nullable=True,
    )

    quality = Column(
        String(50),
        nullable=False,
    )

    horizon = Column(
        Integer,
        nullable=False,
    )

    observations = Column(
        Integer,
        nullable=False,
        default=0,
    )

    rmse = Column(
        Numeric(18, 6),
        nullable=True,
    )

    mae = Column(
        Numeric(18, 6),
        nullable=True,
    )

    smape = Column(
        Numeric(18, 6),
        nullable=True,
    )

    uncertainty_method = Column(
        String(100),
        nullable=True,
    )

    uncertainty_coverage = Column(
        Numeric(8, 6),
        nullable=True,
    )

    uncertainty_radius = Column(
        Numeric(18, 6),
        nullable=True,
    )

    calibration_points = Column(
        Integer,
        nullable=True,
    )

    calculated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        index=True,
    )


class ForecastPointDB(Base):
    __tablename__ = "forecast_points"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    forecast_run_id = Column(
        String,
        ForeignKey("forecast_runs.id"),
        nullable=False,
        index=True,
    )

    horizon_step = Column(
        Integer,
        nullable=False,
    )

    forecast_date = Column(
        DateTime,
        nullable=False,
    )

    value = Column(
        Numeric(18, 6),
        nullable=False,
    )

    lower_bound = Column(
        Numeric(18, 6),
        nullable=True,
    )

    upper_bound = Column(
        Numeric(18, 6),
        nullable=True,
    )

class AutomationRuleDB(Base):
    __tablename__ = "automation_rules"

    id = Column(
        String,
        primary_key=True,
    )

    organization_id = Column(
        String,
        nullable=False,
        index=True,
    )

    automation_type = Column(
        String(100),
        nullable=False,
    )

    name = Column(
        String(255),
        nullable=False,
    )

    enabled = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    trigger_type = Column(
        String(100),
        nullable=False,
    )

    conditions = Column(
        JSON,
        nullable=False,
        default=dict,
    )

    action_config = Column(
        JSON,
        nullable=False,
        default=dict,
    )

    requires_confirmation = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    last_run_at = Column(
        DateTime,
        nullable=True,
    )

    next_run_at = Column(
        DateTime,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class AutomationExecutionDB(Base):
    __tablename__ = "automation_executions"

    id = Column(
        String,
        primary_key=True,
    )

    automation_rule_id = Column(
        String,
        ForeignKey(
            "automation_rules.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    organization_id = Column(
        String,
        nullable=False,
        index=True,
    )

    entity_type = Column(
        String(100),
        nullable=True,
    )

    entity_id = Column(
        String,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
    )

    trigger_payload = Column(
        JSON,
        nullable=False,
        default=dict,
    )

    result_payload = Column(
        JSON,
        nullable=True,
    )

    error_message = Column(
        Text,
        nullable=True,
    )

    started_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    completed_at = Column(
        DateTime,
        nullable=True,
    )