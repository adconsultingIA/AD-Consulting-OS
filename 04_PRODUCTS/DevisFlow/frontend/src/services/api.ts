import { API_URL } from "../config/api";
import { supabase } from "../lib/supabase";
import type {
  Client,
  Invoice,
  Quote,
  Request,
} from "../types";



// ---------------------------------------------------------------------
// GENERIC
// ---------------------------------------------------------------------

export async function getAuthHeaders(
  includeJson = false
): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error(
      "Session utilisateur indisponible."
    );
  }

  const organizationId =
    sessionStorage.getItem(
      "devisflow.organization_id"
    );

  if (!organizationId) {
    throw new Error(
      "Organisation DevisFlow indisponible."
    );
  }

  const headers: Record<string, string> = {
    Authorization:
      `Bearer ${session.access_token}`,
    "X-Organization-Id":
      organizationId,
  };

  if (includeJson) {
    headers["Content-Type"] =
      "application/json";
  }

  return headers;
}


async function apiRequest<T>(
  url: string
): Promise<T> {
  const headers =
    await getAuthHeaders();

  const response = await fetch(
    `${API_URL}${url}`,
    {
      headers,
    }
  );

  if (!response.ok) {
    throw new Error(
      `API error ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}


// ---------------------------------------------------------------------
// CLIENTS
// ---------------------------------------------------------------------

export interface ClientCreatePayload {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export function getClients() {
  return apiRequest<Client[]>("/clients");
}

export type ClientUpdatePayload =
  Partial<ClientCreatePayload> & {
    active?: boolean;
  };


export async function updateClient(
  clientId: string,
  payload: ClientUpdatePayload
): Promise<Client> {
  const response = await fetch(
    `${API_URL}/clients/${clientId}`,
    {
      method: "PATCH",
      headers:
        await getAuthHeaders(true),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible de modifier le client."
    );
  }

  return response.json();
}


export async function createClient(
  payload: ClientCreatePayload
): Promise<Client> {
  const response = await fetch(`${API_URL}/clients`, {
    method: "POST",
    headers:
      await getAuthHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `API error ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}


// ---------------------------------------------------------------------
// REQUESTS
// ---------------------------------------------------------------------

export interface RequestCreatePayload {
  client_id: string;
  title: string;
  description?: string | null;
  budget?: number | null;
  deadline?: string | null;
}

export function getRequests() {
  return apiRequest<Request[]>("/requests");
}

export async function createRequest(
  payload: RequestCreatePayload
): Promise<Request> {
  const response = await fetch(`${API_URL}/requests`, {
    method: "POST",
    headers:
      await getAuthHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `API error ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}


export type RequestUpdatePayload = {
  client_id?: string;
  title?: string;
  description?: string | null;
  budget?: number | null;
  deadline?: string | null;
  status?: string;
};


export async function updateRequest(
  requestId: string,
  payload: RequestUpdatePayload
): Promise<Request> {
  const response = await fetch(
    `${API_URL}/requests/${requestId}`,
    {
      method: "PATCH",
      headers:
        await getAuthHeaders(true),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible de modifier la demande."
    );
  }

  return response.json();
}


// ---------------------------------------------------------------------
// QUOTES
// ---------------------------------------------------------------------

export interface QuoteItemCreatePayload {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

export interface QuoteCreatePayload {
  request_id: string;
  valid_until?: string | null;
  notes?: string | null;
  items: QuoteItemCreatePayload[];
}

export interface QuoteUpdatePayload {
  valid_until?: string | null;
  notes?: string | null;
  items?: QuoteItemCreatePayload[];
}

export function getQuotes() {
  return apiRequest<Quote[]>("/quotes");
}

export async function createQuote(
  payload: QuoteCreatePayload
): Promise<Quote> {
  const response = await fetch(`${API_URL}/quotes`, {
    method: "POST",
    headers:
      await getAuthHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `API error ${response.status}: ${detail}`
    );
  }

  return response.json();
}

export async function updateQuote(
  quoteId: string,
  payload: QuoteUpdatePayload
): Promise<Quote> {
  const response = await fetch(
    `${API_URL}/quotes/${quoteId}`,
    {
      method: "PATCH",
      headers:
        await getAuthHeaders(true),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `API error ${response.status}: ${detail}`
    );
  }

  return response.json();
}

export async function openQuotePdf(
  quoteId: string
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
      `${API_URL}/quotes/${quoteId}/pdf`,
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
          "Impossible d'ouvrir le PDF du devis."
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


export async function sendQuote(
  quoteId: string
): Promise<Quote> {
  const response = await fetch(
    `${API_URL}/quotes/${quoteId}/send`,
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
        "Impossible d'envoyer le devis."
    );
  }

  return response.json();
}


export type QuoteAcceptanceMethod =
  | "email"
  | "signed_quote"
  | "good_for_agreement"
  | "phone"
  | "other";


export interface QuoteAcceptancePayload {
  acceptance_checked: boolean;
  acceptance_method: QuoteAcceptanceMethod;
  accepted_at: string;
  acceptance_reference?: string | null;
  acceptance_note?: string | null;
  file?: File | null;
}


export async function acceptQuote(
  quoteId: string,
  payload: QuoteAcceptancePayload
): Promise<Quote> {
  const formData = new FormData();

  formData.append(
    "acceptance_checked",
    String(payload.acceptance_checked)
  );

  formData.append(
    "acceptance_method",
    payload.acceptance_method
  );

  formData.append(
    "accepted_at",
    payload.accepted_at
  );

  if (payload.acceptance_reference) {
    formData.append(
      "acceptance_reference",
      payload.acceptance_reference
    );
  }

  if (payload.acceptance_note) {
    formData.append(
      "acceptance_note",
      payload.acceptance_note
    );
  }

  if (payload.file) {
    formData.append(
      "file",
      payload.file
    );
  }

  const response = await fetch(
    `${API_URL}/quotes/${quoteId}/accept`,
    {
      method: "POST",
      headers:
        await getAuthHeaders(),
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ||
        "Impossible de confirmer l'acceptation du devis."
    );
  }

  return response.json();
}


export async function updateQuoteStatus(
  quoteId: string,
  status: string
): Promise<Quote> {
  const response = await fetch(
    `${API_URL}/quotes/${quoteId}/status`,
    {
      method: "PATCH",
      headers:
        await getAuthHeaders(true),
      body: JSON.stringify({ status }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `API error ${response.status}: ${detail}`
    );
  }

  return response.json();
}


// ---------------------------------------------------------------------
// INVOICES
// ---------------------------------------------------------------------

export function getInvoices() {
  return apiRequest<Invoice[]>("/invoices");
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: string
): Promise<Invoice> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/status`,
    {
      method: "PATCH",
      headers:
        await getAuthHeaders(true),
      body: JSON.stringify({ status }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `API error ${response.status}: ${detail}`
    );
  }

  return response.json();
}

export async function deleteQuote(
  quoteId: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/quotes/${quoteId}`,
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
        "Impossible de supprimer le devis."
    );
  }
}
