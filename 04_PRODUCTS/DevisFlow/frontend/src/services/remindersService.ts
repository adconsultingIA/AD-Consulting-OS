import { API_URL } from "../config/api";

export interface PaymentReminder {
  id: string;
  invoice_id: string;
  reminder_date: string;
  channel: string;
  subject?: string | null;
  message?: string | null;
  created_at: string;
}

export type ReminderCockpitStatus =
  | "due"
  | "upcoming"
  | "paused";


export interface PaymentReminderCockpitItem {
  invoice_id: string;
  invoice_number: string;
  client_name: string;

  due_date?: string | null;
  amount_due: number | string;

  last_reminder_date?: string | null;
  reminder_count: number;

  next_reminder_date?: string | null;
  reminder_interval_days: number;
  reminder_paused: boolean;

  status: ReminderCockpitStatus;
  can_remind: boolean;
}


export interface PaymentReminderCreate {
  reminder_date: string;
  channel: string;
  subject?: string | null;
  message?: string | null;
}

export async function getInvoiceReminders(
  invoiceId: string
): Promise<PaymentReminder[]> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/reminders`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger les relances."
    );
  }

  return response.json();
}

export async function createInvoiceReminder(
  invoiceId: string,
  data: PaymentReminderCreate
): Promise<PaymentReminder> {
  const response = await fetch(
    `${API_URL}/invoices/${invoiceId}/reminders`,
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
        "Impossible d'enregistrer la relance."
    );
  }

  return response.json();
}

export async function getReminderCounts(): Promise<
  Record<string, number>
> {
  const response = await fetch(
    `${API_URL}/reminders/counts`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger les compteurs de relances."
    );
  }

  return response.json();
}




export async function getReminderCockpit():
Promise<PaymentReminderCockpitItem[]> {
  const response = await fetch(
    `${API_URL}/reminders/cockpit`
  );

  if (!response.ok) {
    throw new Error(
      "Impossible de charger le cockpit des relances."
    );
  }

  return response.json();
}
