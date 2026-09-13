import {
  API_URL,
} from "../config/api";

import {
  getAuthHeaders,
} from "./api";


export type RecommendationPriority =
  | "high"
  | "medium"
  | "low";


export type RecommendationDirection =
  | "up"
  | "down"
  | "stable";


export interface RecommendedAction {
  indicator: string;

  priority:
    RecommendationPriority;

  direction:
    RecommendationDirection;

  title: string;
  explanation: string;

  action_label: string;
  route: string;

  current_value: number;
  forecast_value: number;

  change_value: number;
  change_percent: number | null;

  lower_bound: number | null;
  upper_bound: number | null;

  quality: string;
  model: string | null;
}


export interface RecommendedActionsResponse {
  organization_id: string;
  count: number;

  actions:
    RecommendedAction[];
}


export async function getRecommendedActions():
Promise<RecommendedActionsResponse> {
  const response =
    await fetch(
      `${API_URL}/intelligence/recommended-actions`,
      {
        headers:
          await getAuthHeaders(),
      }
    );

  if (!response.ok) {
    const error =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      error?.detail
      || (
        "Impossible de charger "
        + "les actions recommandées."
      )
    );
  }

  return response.json();
}
