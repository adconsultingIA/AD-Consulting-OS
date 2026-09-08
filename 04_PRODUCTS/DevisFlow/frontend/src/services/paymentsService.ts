import { API_URL } from "../config/api";

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number | string;
  payment_date: string;
  payment_method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface PaymentCreate {
  amount: number;
  payment_date: string;
  payment_method?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export async function getInvoicePayments(
  invoiceId: string
): Promise<Payment[]> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/payments`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger les paiements."
    );
  }

  return response.json();
}

export async function createPayment(
  invoiceId: string,
  data: PaymentCreate
): Promise<Payment> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/payments`,
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
        "Impossible d'enregistrer le paiement."
    );
  }

  return response.json();
}
