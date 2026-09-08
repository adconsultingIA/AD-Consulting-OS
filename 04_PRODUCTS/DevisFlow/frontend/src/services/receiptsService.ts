import { API_URL } from "../config/api";


export type ReceiptStatus =
  | "issued"
  | "sent"
  | "cancelled";


export interface Receipt {
  id: string;
  payment_id: string;
  invoice_id: string;
  invoice_number?: string | null;
  organization_id?: string | null;

  receipt_number: string;
  issue_date: string;

  amount: number | string;
  cumulative_paid: number | string;
  remaining_due: number | string;

  payment_method?: string | null;
  payment_reference?: string | null;
  payment_date?: string | null;

  status: ReceiptStatus;
  sent_at?: string | null;
  created_at: string;
}


export async function getReceipts(): Promise<
  Receipt[]
> {
  const response = await fetch(
    `${API_URL}/receipts`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger les reçus."
    );
  }

  return response.json();
}


export async function sendReceipt(
  receiptId: string
): Promise<Receipt> {
  const response = await fetch(
    `${API_URL}/receipts/${receiptId}/send`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const error =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible d'envoyer le reçu."
    );
  }

  return response.json();
}


export function openReceiptPdf(
  receiptId: string
) {
  window.open(
    `${API_URL}/receipts/${receiptId}/pdf`,
    "_blank",
    "noopener,noreferrer"
  );
}
