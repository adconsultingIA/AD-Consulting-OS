import { API_URL } from "../config/api";


export type OperationalDocumentType =
  | "delivery_note"
  | "intervention_note";


export type OperationalDocumentStatus =
  | "draft"
  | "issued"
  | "sent"
  | "cancelled";


export interface OperationalDocumentItem {
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


export interface OperationalDocument {
  id: string;
  quote_id: string;
  quote_number?: string | null;

  organization_id?: string | null;

  document_type: OperationalDocumentType;
  document_number: string;
  status: OperationalDocumentStatus;

  issue_date?: string | null;
  execution_date?: string | null;

  location_address?: string | null;
  notes?: string | null;

  items: OperationalDocumentItem[];

  subtotal: string;
  vat_amount: string;
  total: string;

  created_at: string;
  updated_at: string;
}


export interface CreateOperationalDocument {
  document_type: OperationalDocumentType;
}


export interface OperationalDocumentUpdate {
  execution_date?: string | null;
  location_address?: string | null;
  notes?: string | null;
}


async function readApiError(
  response: Response,
  fallback: string
) {
  const error = await response
    .json()
    .catch(() => null);

  return error?.detail || fallback;
}


export async function getOperationalDocuments():
Promise<OperationalDocument[]> {
  const response = await fetch(
    `${API_URL}/operational-documents`
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible de charger les livraisons et interventions."
      )
    );
  }

  return response.json();
}


export async function createOperationalDocumentFromQuote(
  quoteId: string,
  documentType: OperationalDocumentType
): Promise<OperationalDocument> {
  const response = await fetch(
    `${API_URL}/operational-documents/from-quote/${quoteId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_type: documentType,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible de créer le document opérationnel."
      )
    );
  }

  return response.json();
}


export async function updateOperationalDocument(
  documentId: string,
  data: OperationalDocumentUpdate
): Promise<OperationalDocument> {
  const response = await fetch(
    `${API_URL}/operational-documents/${documentId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible de modifier le document."
      )
    );
  }

  return response.json();
}


export async function updateOperationalDocumentStatus(
  documentId: string,
  status: OperationalDocumentStatus
): Promise<OperationalDocument> {
  const response = await fetch(
    `${API_URL}/operational-documents/${documentId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
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


export async function sendOperationalDocument(
  documentId: string
): Promise<OperationalDocument> {
  const response = await fetch(
    `${API_URL}/operational-documents/${documentId}/send`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible d'envoyer le document."
      )
    );
  }

  return response.json();
}


export async function deleteOperationalDocument(
  documentId: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/operational-documents/${documentId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Impossible de supprimer le document."
      )
    );
  }
}


export function openOperationalDocumentPdf(
  documentId: string
) {
  window.open(
    `${API_URL}/operational-documents/${documentId}/pdf`,
    "_blank"
  );
}
