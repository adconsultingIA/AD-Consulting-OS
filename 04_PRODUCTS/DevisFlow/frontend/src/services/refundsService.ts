import { API_URL } from "../config/api";

export interface Refund {
  id: string;
  invoice_id: string;
  amount: number | string;
  refund_date: string;
  refund_method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface RefundCreate {
  amount: number;
  refund_date: string;
  refund_method?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export async function getInvoiceRefunds(
  invoiceId: string
): Promise<Refund[]> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/refunds`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger les remboursements."
    );
  }

  return response.json();
}

export async function createInvoiceRefund(
  invoiceId: string,
  data: RefundCreate
): Promise<Refund> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/refunds`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible d'enregistrer le remboursement."
    );
  }

  return response.json();
}
