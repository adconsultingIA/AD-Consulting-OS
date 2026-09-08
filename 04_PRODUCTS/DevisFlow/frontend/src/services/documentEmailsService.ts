import { API_URL } from "../config/api";


export interface DocumentEmail {
  id: string;
  organization_id: string;
  document_type: string;
  document_id: string;
  recipient: string;
  subject: string;
  status: string;
  provider: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}


export type DocumentEmailDocumentType =
  | "quote"
  | "invoice"
  | "purchase_order"
  | "proforma";


export async function getDocumentEmails(
  documentType: DocumentEmailDocumentType,
  documentId: string
): Promise<DocumentEmail[]> {
  const params = new URLSearchParams({
    document_type: documentType,
    document_id: documentId,
  });

  const response = await fetch(
    `${API_URL}/document-emails?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger l'historique d'envoi."
    );
  }

  return response.json();
}


export type DocumentEmailCountMap =
  Record<string, number>;


export async function getDocumentEmailCounts(
  documentType: DocumentEmailDocumentType
): Promise<DocumentEmailCountMap> {
  const params = new URLSearchParams({
    document_type: documentType,
  });

  const response = await fetch(
    `${API_URL}/document-emails/counts?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger les compteurs d'envoi."
    );
  }

  return response.json();
}
