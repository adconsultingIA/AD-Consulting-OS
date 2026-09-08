import { API_URL } from "../config/api";
import { getAuthHeaders } from "./api";


export type ProformaStatus =
  | "draft"
  | "issued"
  | "sent"
  | "cancelled";


export interface ProformaItem {
  id: string;
  quote_item_id?: string | null;

  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;

  tax_type?: string | null;
  tax_treatment?: string | null;
  tax_reason?: string | null;
  requires_manual_review: boolean;

  subtotal: string;
  vat_amount: string;
  total: string;
}


export interface Proforma {
  id: string;
  quote_id: string;
  quote_number?: string | null;
  organization_id?: string | null;

  proforma_number: string;
  status: ProformaStatus;

  issue_date?: string | null;
  valid_until?: string | null;
  notes?: string | null;

  items: ProformaItem[];

  subtotal: string;
  vat_amount: string;
  total: string;

  created_at: string;
  updated_at: string;
}


export interface ProformaUpdate {
  issue_date?: string | null;
  valid_until?: string | null;
  notes?: string | null;
}


async function readApiError(
  response: Response,
  fallback: string
) {
  const error = await response
    .json()
    .catch(() => null);

  return (
    error?.detail ||
    fallback
  );
}


export async function getProformas():
Promise<Proforma[]> {
  const response = await fetch(
    `${API_URL}/proformas`,
    {
      headers:
        await getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible de charger les proformas."
      )
    );
  }

  return response.json();
}


export async function createProformaFromQuote(
  quoteId: string
): Promise<Proforma> {
  const response = await fetch(
    `${API_URL}/proformas/from-quote/${quoteId}`,
    {
      method: "POST",
      headers:
        await getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible de créer la proforma."
      )
    );
  }

  return response.json();
}


export async function updateProforma(
  proformaId: string,
  data: ProformaUpdate
): Promise<Proforma> {
  const response = await fetch(
    `${API_URL}/proformas/${proformaId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible de modifier la proforma."
      )
    );
  }

  return response.json();
}


export async function updateProformaStatus(
  proformaId: string,
  status: ProformaStatus
): Promise<Proforma> {
  const response = await fetch(
    `${API_URL}/proformas/${proformaId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible de modifier le statut."
      )
    );
  }

  return response.json();
}


export async function sendProforma(
  proformaId: string
): Promise<Proforma> {
  const response = await fetch(
    `${API_URL}/proformas/${proformaId}/send`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible d'envoyer la proforma."
      )
    );
  }

  return response.json();
}


export async function deleteProforma(
  proformaId: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/proformas/${proformaId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible de supprimer la proforma."
      )
    );
  }
}


export function openProformaPdf(
  proformaId: string
) {
  window.open(
    `${API_URL}/proformas/${proformaId}/pdf`,
    "_blank"
  );
}
