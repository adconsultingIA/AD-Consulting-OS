import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Lightbulb,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useWorkspace,
} from "../../context/WorkspaceContext";

import {
  getRecommendedActions,
  type RecommendedAction,
} from "../../services/recommendedActionsService";


function indicatorLabel(
  indicator: string
) {
  switch (indicator) {
    case "monthly_revenue":
      return "Chiffre d'affaires";

    case "monthly_collections":
      return "Encaissements";

    case "quote_acceptance_rate":
      return "Taux d'acceptation";

    case "recurring_revenue_share":
      return "Revenu récurrent";

    default:
      return indicator;
  }
}


function isPercentageIndicator(
  indicator: string
) {
  return (
    indicator
      === "quote_acceptance_rate"
    || indicator
      === "recurring_revenue_share"
  );
}


function formatValue(
  action: RecommendedAction,
  value: number
) {
  if (
    isPercentageIndicator(
      action.indicator
    )
  ) {
    return `${value.toFixed(1)} %`;
  }

  return new Intl.NumberFormat(
    "fr-CH",
    {
      style: "currency",
      currency: "CHF",
      maximumFractionDigits: 0,
    }
  ).format(value);
}


function priorityLabel(
  priority: string
) {
  switch (priority) {
    case "high":
      return "Priorité élevée";

    case "medium":
      return "À surveiller";

    default:
      return "Situation favorable";
  }
}

function buildIntelligenceBusinessRoute(
  action: RecommendedAction
) {
  const separator =
    action.route.includes("?")
      ? "&"
      : "?";

  const params =
    new URLSearchParams({
      from: "intelligence",
      indicator: action.indicator,
    });

  return (
    `${action.route}${separator}`
    + params.toString()
  );
}


export default function IntelligenceRecommendedActions() {
  const navigate =
    useNavigate();

  const {
    hasEntitlement,
  } = useWorkspace();

  const enabled =
    hasEntitlement(
      "recommended_actions"
    );

  const [
    actions,
    setActions,
  ] = useState<
    RecommendedAction[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const result =
          await getRecommendedActions();

        if (!cancelled) {
          setActions(
            result.actions
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : (
                "Impossible de charger "
                + "les recommandations."
              )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled]);


  if (!enabled) {
    return null;
  }


  return (
    <div className="intelligence-actions-layer">

      <div className="intelligence-actions-header">
        <div>
          <span className="intelligence-actions-kicker">
            <Lightbulb size={14} />
            Actions recommandées
          </span>

          <h3>
            Transformer les signaux
            en décisions
          </h3>

          <p>
            DevisFlow analyse les tendances
            prévisionnelles et propose les
            prochains points d'attention
            ou actions métier.
          </p>
        </div>

        <span className="intelligence-actions-count">
          {actions.length}
          {" "}
          signal
          {actions.length > 1
            ? "s"
            : ""}
        </span>
      </div>


      {loading && (
        <div className="intelligence-actions-empty">
          Analyse des recommandations…
        </div>
      )}


      {error && (
        <div className="intelligence-actions-error">
          {error}
        </div>
      )}


      {!loading
        && !error
        && actions.length === 0 && (
          <div className="intelligence-actions-empty">
            Aucune recommandation
            disponible pour le moment.
          </div>
        )}


      {!loading
        && !error
        && actions.length > 0 && (
          <div className="intelligence-actions-list">

            {actions.map(
              (action) => {
                const change =
                  action.change_percent;

                const positive =
                  action.direction
                    === "up";

                const negative =
                  action.direction
                    === "down";

                return (
                  <article
                    key={
                      action.indicator
                    }
                    className={
                      `intelligence-action-card `
                      + `priority-${action.priority}`
                    }
                  >
                    <div className="intelligence-action-top">
                      <div className="intelligence-action-icon">
                        {action.priority
                          === "high" ? (
                            <CircleAlert
                              size={18}
                            />
                          ) : positive ? (
                            <TrendingUp
                              size={18}
                            />
                          ) : negative ? (
                            <TrendingDown
                              size={18}
                            />
                          ) : (
                            <CheckCircle2
                              size={18}
                            />
                          )}
                      </div>

                      <div>
                        <span className="intelligence-action-indicator">
                          {indicatorLabel(
                            action.indicator
                          )}
                        </span>

                        <h4>
                          {action.title}
                        </h4>
                      </div>

                      <span
                        className={
                          `intelligence-priority-badge `
                          + `priority-${action.priority}`
                        }
                        title={
                          action.priority
                            === "high"
                            ? (
                              "Une évolution défavorable "
                              + "nécessite une attention "
                              + "plus rapide."
                            )
                            : action.priority
                              === "medium"
                              ? (
                                "Le signal mérite "
                                + "une surveillance."
                              )
                              : (
                                "La tendance centrale "
                                + "est actuellement favorable."
                              )
                        }
                      >
                        {priorityLabel(
                          action.priority
                        )}
                      </span>
                    </div>


                    <p className="intelligence-action-explanation">
                      {action.explanation}
                    </p>


                    <div className="intelligence-action-values">
                      <div>
                        <span>
                          Dernier réel
                        </span>

                        <strong>
                          {formatValue(
                            action,
                            action.current_value
                          )}
                        </strong>
                      </div>

                      <ArrowRight
                        size={17}
                      />

                      <div>
                        <span>
                          Prévision H+1
                        </span>

                        <strong>
                          {formatValue(
                            action,
                            action.forecast_value
                          )}
                        </strong>
                      </div>

                      {change !== null && (
                        <div
                          className={
                            positive
                              ? "intelligence-action-change is-positive"
                              : negative
                                ? "intelligence-action-change is-negative"
                                : "intelligence-action-change"
                          }
                        >
                          <span>
                            Variation
                          </span>

                          <strong>
                            {change > 0
                              ? "+"
                              : ""}
                            {change.toFixed(
                              1
                            )}
                            %
                          </strong>
                        </div>
                      )}
                    </div>


                    {action.lower_bound !== null
                      && action.upper_bound !== null && (
                        <div
                          className="intelligence-action-range"
                          title={
                            "Plage basse / haute issue "
                            + "de l'incertitude observée "
                            + "lors du backtest."
                          }
                        >
                          <span>
                            Plage prévisionnelle
                          </span>

                          <strong>
                            {formatValue(
                              action,
                              action.lower_bound
                            )}

                            {" → "}

                            {formatValue(
                              action,
                              action.upper_bound
                            )}
                          </strong>
                        </div>
                      )}


                    <div className="intelligence-action-footer">
                      <span>
                        Qualité :
                        {" "}
                        <strong>
                          {action.quality}
                        </strong>
                      </span>

                      {action.model && (
                        <span>
                          Modèle :
                          {" "}
                          <strong>
                            {action.model}
                          </strong>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            buildIntelligenceBusinessRoute(
                              action
                            )
                          )
                                                  }
                      >
                        {action.action_label}

                        <ArrowRight
                          size={15}
                        />
                      </button>
                    </div>
                  </article>
                );
              }
            )}

          </div>
        )}

    </div>
  );
}
