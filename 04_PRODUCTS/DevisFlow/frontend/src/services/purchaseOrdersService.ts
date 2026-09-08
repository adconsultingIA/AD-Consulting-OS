import { API_URL } from "../config/api";
import { getAuthHeaders } from "./api";


export type PurchaseOrderStatus =
  | "draft"
  | "issued"
  | "sent"
  | "cancelled";


export interface PurchaseOrderItem {
  id: string;
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


export interface PurchaseOrder {
  id: string;
  quote_id: string;
  quote_number?: string | null;
  organization_id?: string | null;

  purchase_order_number: string;
  status: PurchaseOrderStatus;

  order_date?: string | null;
  intervention_address?: string | null;
  notes?: string | null;

  items: PurchaseOrderItem[];

  subtotal: string;
  vat_amount: string;
  total: string;

  created_at: string;
  updated_at: string;
}


export interface PurchaseOrderUpdate {
  order_date?: string | null;
  intervention_address?: string | null;
  notes?: string | null;
}


export async function getPurchaseOrders(): Promise<
  PurchaseOrder[]
> {
  const response = await fetch(
    `${API_URL}/purchase-orders`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger les bons de commande."
    );
  }

  return response.json();
}


export async function createPurchaseOrderFromQuote(
  quoteId: string
): Promise<PurchaseOrder> {
  const response = await fetch(
    `${API_URL}/purchase-orders/from-quote/${quoteId}`,
    {
      method: "POST",
      headers:
        await getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(
      () => null
    );

    throw new Error(
      error?.detail ??
        "Impossible de créer le bon de commande."
    );
  }

  return response.json();
}


export async function updatePurchaseOrder(
  purchaseOrderId: string,
  payload: PurchaseOrderUpdate
): Promise<PurchaseOrder> {
  const response = await fetch(
    `${API_URL}/purchase-orders/${purchaseOrderId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(
      () => null
    );

    throw new Error(
      error?.detail ??
        "Impossible de modifier le bon de commande."
    );
  }

  return response.json();
}


export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  status: PurchaseOrderStatus
): Promise<PurchaseOrder> {
  const response = await fetch(
    `${API_URL}/purchase-orders/${purchaseOrderId}/status`,
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
    const error = await response.json().catch(
      () => null
    );

    throw new Error(
      error?.detail ??
        "Impossible de modifier le statut du bon de commande."
    );
  }

  return response.json();
}


export async function deletePurchaseOrder(
  purchaseOrderId: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/purchase-orders/${purchaseOrderId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ??
        "Impossible de supprimer le bon de commande."
    );
  }
}


export function openPurchaseOrderPdf(
  purchaseOrderId: string
) {
  window.open(
    `${API_URL}/purchase-orders/${purchaseOrderId}/pdf`,
    "_blank",
    "noopener,noreferrer"
  );
}


export async function sendPurchaseOrder(
  purchaseOrderId: string
): Promise<PurchaseOrder> {
  const response = await fetch(
    `${API_URL}/purchase-orders/${purchaseOrderId}/send`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail ??
        "Impossible d'envoyer le bon de commande."
    );
  }

  return response.json();
}
