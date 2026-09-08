import { API_URL } from "../config/api";

export interface CreditNote {
  id: string;
  invoice_id: string;
  credit_note_number: string;
  issue_date: string;
  reason: string;
  amount: number | string;
  status: string;
  notes?: string | null;
  created_at: string;
}

export interface CreditNoteCreate {
  issue_date: string;
  reason: string;
  amount: number;
  notes?: string | null;
}

export async function getInvoiceCreditNotes(
  invoiceId: string
): Promise<CreditNote[]> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/credit-notes`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger les avoirs."
    );
  }

  return response.json();
}

export async function createInvoiceCreditNote(
  invoiceId: string,
  data: CreditNoteCreate
): Promise<CreditNote> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/credit-notes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible de créer l'avoir."
    );
  }

  return response.json();
}
