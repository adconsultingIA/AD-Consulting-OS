import { API_URL } from "../config/api";
import { getAuthHeaders } from "./api";


export type AutomationExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";


export interface AutomationRule {
  id: string;
  organization_id: string;
  automation_type: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  conditions: Record<string, unknown>;
  action_config: Record<string, unknown>;
  requires_confirmation: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
}


export interface AutomationExecution {
  id: string;
  automation_rule_id: string;
  organization_id: string;
  entity_type?: string | null;
  entity_id?: string | null;
  status: AutomationExecutionStatus;
  trigger_payload: Record<string, unknown>;
  result_payload?: Record<string, unknown> | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
}


export interface AutomationRuleUpdate {
  enabled?: boolean;
  action_config?: Record<string, unknown>;
}


async function parseResponse<T>(
  response: Response,
): Promise<T> {
  if (!response.ok) {
    let detail =
      `Erreur HTTP ${response.status}`;

    try {
      const data = await response.json();

      if (data?.detail) {
        detail = data.detail;
      }
    } catch {
      // Conserver le message HTTP par défaut.
    }

    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}


export async function getAutomationRules():
Promise<AutomationRule[]> {
  const response = await fetch(
    `${API_URL}/intelligence/automations`,
    {
      headers: await getAuthHeaders(),
    },
  );

  return parseResponse<AutomationRule[]>(
    response
  );
}


export async function getAutomationExecutions(
  ruleId: string,
): Promise<AutomationExecution[]> {
  const response = await fetch(
    `${API_URL}/intelligence/automations/${ruleId}/executions`,
    {
      headers: await getAuthHeaders(),
    },
  );

  return parseResponse<AutomationExecution[]>(
    response
  );
}


export async function updateAutomationRule(
  ruleId: string,
  payload: AutomationRuleUpdate,
): Promise<AutomationRule> {
  const response = await fetch(
    `${API_URL}/intelligence/automations/${ruleId}`,
    {
      method: "PATCH",
      headers: await getAuthHeaders(true),
      body: JSON.stringify(payload),
    },
  );

  return parseResponse<AutomationRule>(
    response
  );
}
