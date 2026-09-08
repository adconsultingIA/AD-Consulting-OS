export interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  created_at: string;
}

export interface Request {
  id: string;
  client_id: string;
  title: string;
  description?: string | null;
  budget?: string | number | null;
  deadline?: string | null;
  status: string;
  created_at: string;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
  subtotal: string;
  vat_amount: string;
  total: string;
}

export interface Quote {
  id: string;
  quote_number: string;
  request_id: string;
  status: string;
  version: number;
  valid_until?: string | null;
  notes?: string | null;

  acceptance_checked?: boolean;
  acceptance_method?: string | null;
  accepted_at?: string | null;
  accepted_by_user_id?: string | null;
  acceptance_reference?: string | null;
  acceptance_note?: string | null;
  acceptance_document_path?: string | null;

  items: QuoteItem[];
  subtotal: string;
  vat_amount: string;
  total: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  quote_item_id?: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
  subtotal: string;
  vat_amount: string;
  total: string;
}

export interface Invoice {
  id: string;
  quote_id: string;
  recurring_invoice_id?: string | null;
  invoice_number: string;
  status: string;

  invoice_type:
    | "standard"
    | "deposit"
    | "balance";

  billing_percentage?:
    | number
    | string
    | null;

  billing_sequence?:
    | number
    | null;

  issue_date?: string | null;
  due_date?: string | null;

  payment_terms?: string | null;

  next_reminder_date?: string | null;
  reminder_interval_days: number;
  reminder_paused: boolean;

  notes?: string | null;

  items: InvoiceItem[];

  subtotal: string;
  vat_amount: string;
  total: string;

  amount_paid: string;
  amount_due: string;

  credit_total: number | string;
  net_total: number | string;
  customer_credit: number | string;
  refunded_total: number | string;

  created_at: string;
  updated_at: string;
}
