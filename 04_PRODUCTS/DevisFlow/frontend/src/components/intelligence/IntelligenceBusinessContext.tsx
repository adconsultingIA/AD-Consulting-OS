import {
  ArrowLeft,
  BrainCircuit,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import "../../styles/intelligence-forecasting.css";



const INDICATOR_LABELS:
Record<string, string> = {
  monthly_revenue:
    "Chiffre d'affaires",

  monthly_collections:
    "Encaissements",

  quote_acceptance_rate:
    "Taux d'acceptation",

  recurring_revenue_share:
    "Revenu récurrent",
};


function formatMonth(
  month: string | null
) {
  if (!month) {
    return null;
  }

  const [
    year,
    monthNumber,
  ] = month.split("-");

  if (
    !year
    || !monthNumber
  ) {
    return month;
  }

  const date =
    new Date(
      Number(year),
      Number(monthNumber) - 1,
      1
    );

  const label =
    new Intl.DateTimeFormat(
      "fr-CH",
      {
        month: "long",
        year: "numeric",
      }
    ).format(date);

  return (
    label.charAt(0).toUpperCase()
    + label.slice(1)
  );
}


export default function IntelligenceBusinessContext() {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] = useSearchParams();

  const source =
    searchParams.get("from");

  const indicator =
    searchParams.get("indicator");

  const month =
    searchParams.get("month");


  if (
    source !== "intelligence"
    || !indicator
  ) {
    return null;
  }


  const indicatorLabel =
    INDICATOR_LABELS[indicator]
    ?? "Analyse Intelligence";

  const monthLabel =
    formatMonth(month);


  function returnToIntelligence() {
    if (!indicator) {
      return;
    }

    const params =
      new URLSearchParams();

    params.set(
      "intelligence",
      indicator
    );

    if (month) {
      params.set(
        "month",
        month
      );
    }

    navigate(
      `/?${params.toString()}`
    );
  }


  return (
    <div className="intelligence-business-context">

      <div className="intelligence-business-context-icon">
        <BrainCircuit size={18} />
      </div>

      <div className="intelligence-business-context-content">
        <span>
          Contexte Intelligence
        </span>

        <strong>
          {indicatorLabel}

          {monthLabel
            ? ` · ${monthLabel}`
            : ""}
        </strong>

        <p>
          Vous consultez les données métier
          liées à cette analyse.
        </p>
      </div>

      <button
        type="button"
        onClick={
          returnToIntelligence
        }
      >
        <ArrowLeft size={15} />

        Retour à l'analyse
      </button>

    </div>
  );
}
