import { API_URL } from "../config/api";


export type CopilotIntent =
  | "business_analysis"
  | "materialize_request"
  | "prepare_action"
  | "general_assistance";


export type CopilotSuggestedAction = {
  code: string;
  label: string;
  description?: string | null;
  requires_confirmation: boolean;
};


export type CopilotRequestDraft = {
  client_name?: string | null;
  client_id?: string | null;
  title?: string | null;
  description?: string | null;
  budget?: number | null;
  deadline?: string | null;
  missing_fields: string[];
};


export type CopilotQuoteItemDraft = {
  description: string;

  service_category:
    | "consulting"
    | "software"
    | "implementation"
    | "training"
    | "other";

  quantity: number;
  unit_price: number;
};


export type CopilotQuoteDraft = {
  request_id?: string | null;
  request_title?: string | null;
  client_name?: string | null;
  valid_until?: string | null;
  notes?: string | null;

  items: CopilotQuoteItemDraft[];

  missing_fields: string[];
};


export type CopilotMessageResponse = {
  answer: string;

  intent: CopilotIntent;

  suggested_actions:
    CopilotSuggestedAction[];

  draft?:
    CopilotRequestDraft | null;

  quote_draft?:
    CopilotQuoteDraft | null;

  requires_confirmation: boolean;

  proposal_id?: string | null;

  proposal_expires_at?:
    string | null;
};


export type CopilotExecuteResponse = {
  ok: boolean;

  action_code: string;
  message: string;

  request_id?: string | null;
  quote_id?: string | null;

  proposal_id?: string | null;

  replayed: boolean;
};


type CopilotAuth = {
  accessToken: string;
  organizationId: string;
};


async function readError(
  response: Response
): Promise<string> {
  try {
    const body =
      await response.json();

    if (
      typeof body?.detail
      === "string"
    ) {
      return body.detail;
    }
  } catch {
    // Réponse non JSON.
  }

  return (
    `Erreur Copilot `
    + `(${response.status})`
  );
}


export async function sendCopilotMessage(
  auth: CopilotAuth,
  message: string
): Promise<CopilotMessageResponse> {
  const response = await fetch(
    `${API_URL}/intelligence/copilot`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${auth.accessToken}`,

        "X-Organization-Id":
          auth.organizationId,

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        message,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readError(response)
    );
  }

  return response.json();
}


export async function executeCopilotAction(
  auth: CopilotAuth,
  proposalId: string
): Promise<CopilotExecuteResponse> {
  const response = await fetch(
    `${API_URL}/intelligence/copilot/execute`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${auth.accessToken}`,

        "X-Organization-Id":
          auth.organizationId,

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        proposal_id:
          proposalId,

        confirmed: true,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readError(response)
    );
  }

  return response.json();
}
