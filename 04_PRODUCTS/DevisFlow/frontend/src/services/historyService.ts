import { API_URL } from "../config/api";


export type HistoryEventType =
  | "invoice_created"
  | "invoice_sent"
  | "payment"
  | "reminder"
  | "credit_note"
  | "refund";


export interface HistoryEvent {
  id: string;

  event_type: HistoryEventType;

  entity_type: string;
  entity_id: string;

  document_number: string | null;
  client_name: string | null;

  event_at: string;

  title: string;
  detail: string | null;

  amount: number | null;
  status: string | null;

  metadata: Record<string, unknown>;
}


export async function getHistory(): Promise<
  HistoryEvent[]
> {
  const response = await fetch(
    `${API_URL}/history`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger l'historique."
    );
  }

  return response.json();
}


export interface InvoiceActivitySummary {
  payments: number;
  emails: number;
  reminders: number;
  credit_notes: number;
  refunds: number;
}


export type InvoiceActivitySummaryMap =
  Record<string, InvoiceActivitySummary>;


export async function getInvoiceActivitySummary():
Promise<InvoiceActivitySummaryMap> {
  const response = await fetch(
    `${API_URL}/history/activity-summary`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger le résumé d'activité."
    );
  }

  return response.json();
}
