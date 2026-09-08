import { getAuthHeaders } from "./api";

const API_URL = "http://127.0.0.1:8002/api/v1";


export type RecurringFrequency =
  | "monthly"
  | "quarterly"
  | "yearly";


export type RecurringInvoiceStatus =
  | "active"
  | "paused"
  | "stopped";


export interface RecurringInvoice {
  id: string;
  quote_id: string;
  quote_number?: string | null;
  client_name?: string | null;
  organization_id?: string | null;

  service_name: string;
  frequency: RecurringFrequency;

  start_date: string;
  next_invoice_date: string;

  status: RecurringInvoiceStatus;

  last_generated_at?: string | null;

  generated_invoices_count: number;

  created_at: string;
  updated_at: string;
}


export interface RecurringInvoiceCreate {
  service_name: string;
  frequency: RecurringFrequency;
  start_date: string;
  next_invoice_date?: string;
}


export interface RecurringInvoiceUpdate {
  service_name?: string;
  frequency?: RecurringFrequency;
  next_invoice_date?: string;
}


export interface GeneratedRecurringInvoice {
  ok: boolean;

  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    total: number;
    recurring_invoice_id: string;
  };

  recurring_invoice: RecurringInvoice;
}


async function parseResponse<T>(
  response: Response,
): Promise<T> {
  if (!response.ok) {
    let detail =
      `Erreur HTTP ${response.status}`;

    try {
      const data = await response.json();

      if (data?.detail) {
        detail = data.detail;
      }
    } catch {
      // Keep default HTTP message.
    }

    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}


export async function getRecurringInvoices():
Promise<RecurringInvoice[]> {
  const response = await fetch(
    `${API_URL}/recurring-invoices`,
    {
      headers: await getAuthHeaders(),
    },
  );

  return parseResponse<
    RecurringInvoice[]
  >(response);
}


export async function getRecurringInvoice(
  recurringId: string,
): Promise<RecurringInvoice> {
  const response = await fetch(
    `${API_URL}/recurring-invoices/${recurringId}`,
    {
      headers: await getAuthHeaders(),
    },
  );

  return parseResponse<
    RecurringInvoice
  >(response);
}


export async function createRecurringInvoiceFromQuote(
  quoteId: string,
  payload: RecurringInvoiceCreate,
): Promise<RecurringInvoice> {
  const response = await fetch(
    `${API_URL}/recurring-invoices/from-quote/${quoteId}`,
    {
      method: "POST",
      headers: await getAuthHeaders(true),
      body: JSON.stringify(payload),
    },
  );

  return parseResponse<
    RecurringInvoice
  >(response);
}


export async function updateRecurringInvoice(
  recurringId: string,
  payload: RecurringInvoiceUpdate,
): Promise<RecurringInvoice> {
  const response = await fetch(
    `${API_URL}/recurring-invoices/${recurringId}`,
    {
      method: "PATCH",
      headers: await getAuthHeaders(true),
      body: JSON.stringify(payload),
    },
  );

  return parseResponse<
    RecurringInvoice
  >(response);
}


export async function updateRecurringInvoiceStatus(
  recurringId: string,
  status: RecurringInvoiceStatus,
): Promise<RecurringInvoice> {
  const response = await fetch(
    `${API_URL}/recurring-invoices/${recurringId}/status`,
    {
      method: "PATCH",
      headers: await getAuthHeaders(true),
      body: JSON.stringify({
        status,
      }),
    },
  );

  return parseResponse<
    RecurringInvoice
  >(response);
}


export async function generateRecurringInvoice(
  recurringId: string,
): Promise<GeneratedRecurringInvoice> {
  const response = await fetch(
    `${API_URL}/recurring-invoices/${recurringId}/generate`,
    {
      method: "POST",
      headers: await getAuthHeaders(),
    },
  );

  return parseResponse<
    GeneratedRecurringInvoice
  >(response);
}
