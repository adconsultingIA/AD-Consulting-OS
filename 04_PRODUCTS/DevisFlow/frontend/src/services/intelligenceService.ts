import {
  API_URL,
} from "../config/api";

import {
  getAuthHeaders,
} from "./api";


export type ForecastIndicator =
  | "monthly_revenue"
  | "monthly_collections"
  | "quote_acceptance_rate"
  | "recurring_revenue_share";


export interface ForecastHistoryPoint {
  date: string;
  value: number;
}


export interface ForecastPoint {
  horizon_step: number;
  forecast_date: string;
  value: number;
  lower_bound: number | null;
  upper_bound: number | null;
}


export interface ForecastRun {
  id: string;
  indicator: string;
  status: string;
  selected_model: string | null;
  quality: string;
  horizon: number;
  observations: number;

  rmse: number | null;
  mae: number | null;
  smape: number | null;

  uncertainty_method: string | null;
  uncertainty_coverage: number | null;
  uncertainty_radius: number | null;
  calibration_points: number | null;

  calculated_at: string;

  history: ForecastHistoryPoint[];
  points: ForecastPoint[];
}


export interface ForecastAvailability {
  indicator: ForecastIndicator;
  available: boolean;
  forecast: ForecastRun | null;
}


export async function getForecast(
  indicator: ForecastIndicator
): Promise<ForecastAvailability> {
  const response = await fetch(
    `${API_URL}/intelligence/forecasts/${indicator}`,
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
      error?.detail
      || "Impossible de charger la prévision."
    );
  }

  return response.json();
}


export async function recalculateForecasts(
  horizon = 3
) {
  const response = await fetch(
    `${API_URL}/intelligence/forecasts/recalculate?horizon=${horizon}`,
    {
      method: "POST",
      headers:
        await getAuthHeaders(true),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null);

    throw new Error(
      error?.detail
      || "Impossible de recalculer les prévisions."
    );
  }

  return response.json();
}
