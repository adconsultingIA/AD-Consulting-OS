import { API_URL } from "../config/api";
import type { Invoice } from "../types";
import {
  getAuthHeaders,
} from "./api";


export interface InvoiceUpdate {
  issue_date?: string | null;
  due_date?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
}


export type InvoiceType =
  | "standard"
  | "deposit"
  | "balance";


export interface InvoiceCreateFromQuote {
  invoice_type?: InvoiceType;
  billing_percentage?: number | null;
}

export async function getInvoices(): Promise<Invoice[]> {
  const response = await fetch(
    `${API_URL}/invoices`,
    {
      headers:
        await getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger les factures."
    );
  }

  return response.json();
}

export async function createInvoiceFromQuote(
  quoteId: string,
  data?: InvoiceCreateFromQuote
): Promise<Invoice> {
  const response = await fetch(
    `${API_URL}/invoices/from-quote/${quoteId}`,
    {
      method: "POST",
      headers:
        await getAuthHeaders(
          Boolean(data)
        ),
      body: data
        ? JSON.stringify(data)
        : undefined,
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible de créer la facture."
    );
  }

  return response.json();
}

export async function sendInvoice(
  invoiceId: string
): Promise<Invoice> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/send`,
    {
      method: "POST",
      headers:
        await getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible d'envoyer la facture."
    );
  }

  return response.json();
}


export async function updateInvoice(
  invoiceId: string,
  data: InvoiceUpdate
): Promise<Invoice> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}`,
    {
      method: "PATCH",
      headers:
        await getAuthHeaders(true),
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible de modifier la facture."
    );
  }

  return response.json();
}

export async function deleteInvoice(
  invoiceId: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}`,
    {
      method: "DELETE",
      headers:
        await getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible de supprimer la facture."
    );
  }
}



export async function openInvoicePdf(
  invoiceId: string
): Promise<void> {
  const pdfWindow = window.open(
    "about:blank",
    "_blank"
  );

  if (!pdfWindow) {
    throw new Error(
      "Le navigateur a bloqué l'ouverture du PDF."
    );
  }

  try {
    const response = await fetch(
      `${API_URL}/invoices/${invoiceId}/pdf`,
      {
        headers:
          await getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => null);

      throw new Error(
        error?.detail ||
          "Impossible d'ouvrir le PDF de la facture."
      );
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    pdfWindow.location.href = url;

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      60000
    );
  } catch (error) {
    pdfWindow.close();
    throw error;
  }
}
