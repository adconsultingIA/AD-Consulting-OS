import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  History,
  LoaderCircle,
  PauseCircle,
  Settings2,
  Zap,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useWorkspace,
} from "../../context/WorkspaceContext";

import {
  getAutomationExecutions,
  getAutomationRules,
  updateAutomationRule,
  type AutomationExecution,
  type AutomationRule,
} from "../../services/automationService";

import "../../styles/intelligence-automation.css";


function formatDateTime(
  value?: string | null,
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const diffDays = Math.round(
    (
      today.getTime()
      - targetDay.getTime()
    )
    / 86400000
  );

  const time =
    new Intl.DateTimeFormat(
      "fr-CH",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date);

  if (diffDays === 0) {
    return `Aujourd'hui à ${time}`;
  }

  if (diffDays === 1) {
    return `Hier à ${time}`;
  }

  return new Intl.DateTimeFormat(
    "fr-CH",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
}


function statusLabel(
  status?: string,
) {
  switch (status) {
    case "completed":
      return "Terminée";
    case "running":
      return "En cours";
    case "pending":
      return "En attente";
    case "failed":
      return "Échec";
    default:
      return "Aucune";
  }
}


function StatusIcon({
  status,
}: {
  status?: string;
}) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={16} />;
    case "failed":
      return <CircleAlert size={16} />;
    case "running":
    case "pending":
      return <LoaderCircle size={16} />;
    default:
      return <Clock3 size={16} />;
  }
}


export default function IntelligenceAdvancedAutomation() {
  const navigate = useNavigate();

  const {
    hasEntitlement,
  } = useWorkspace();

  const enabled =
    hasEntitlement(
      "advanced_automation"
    );

  const [
    rule,
    setRule,
  ] = useState<AutomationRule | null>(
    null
  );

  const [
    executions,
    setExecutions,
  ] = useState<AutomationExecution[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    showHistory,
    setShowHistory,
  ] = useState(false);


  async function load() {
    if (!enabled) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const rules =
        await getAutomationRules();

      const reminderRule =
        rules.find(
          (item) =>
            item.automation_type
            === "invoice_payment_reminder"
        )
        ?? null;

      setRule(reminderRule);

      if (!reminderRule) {
        setExecutions([]);
        return;
      }

      const history =
        await getAutomationExecutions(
          reminderRule.id
        );

      setExecutions(history);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (
            "Impossible de charger "
            + "l'automatisation."
          )
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void load();
  }, [enabled]);


  const intervalDays = useMemo(
    () => {
      const raw =
        rule?.action_config?.interval_days;

      const parsed =
        Number(raw ?? 7);

      return Number.isFinite(parsed)
        && parsed > 0
        ? parsed
        : 7;
    },
    [rule]
  );


  const latestExecution =
    executions[0] ?? null;


  async function toggleAutomation() {
    if (!rule || saving) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const updated =
        await updateAutomationRule(
          rule.id,
          {
            enabled: !rule.enabled,
          }
        );

      setRule(updated);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Modification impossible."
      );
    } finally {
      setSaving(false);
    }
  }


  async function updateInterval(
    value: number,
  ) {
    if (!rule || saving) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const updated =
        await updateAutomationRule(
          rule.id,
          {
            action_config: {
              ...rule.action_config,
              interval_days: value,
            },
          }
        );

      setRule(updated);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Modification impossible."
      );
    } finally {
      setSaving(false);
    }
  }


  if (!enabled) {
    return null;
  }


  return (
    <section className="intelligence-automation">

      <div className="intelligence-automation-header">
        <div>
          <span className="intelligence-automation-kicker">
            <Zap size={15} />
            Advanced Automation
          </span>

          <h3>
            Agir automatiquement
            au bon moment
          </h3>

          <p>
            DevisFlow applique vos règles
            métier, déclenche les actions
            nécessaires et conserve une
            trace complète de leur exécution.
          </p>
        </div>

        {rule && (
          <button
            type="button"
            className={
              rule.enabled
                ? "automation-status is-active"
                : "automation-status is-paused"
            }
            onClick={toggleAutomation}
            disabled={saving}
          >
            {rule.enabled
              ? <CheckCircle2 size={15} />
              : <PauseCircle size={15} />}

            {rule.enabled
              ? "Actif"
              : "En pause"}
          </button>
        )}
      </div>


      {loading && (
        <div className="intelligence-automation-empty">
          Chargement de l'automatisation…
        </div>
      )}


      {error && (
        <div className="intelligence-automation-error">
          {error}
        </div>
      )}


      {!loading
        && !error
        && !rule && (
          <div className="intelligence-automation-empty">
            Aucune règle d'automatisation
            configurée pour le moment.
          </div>
        )}


      {!loading && rule && (
        <>
          <div className="intelligence-automation-card">

            <div className="automation-main">
              <div className="automation-icon">
                <Zap size={22} />
              </div>

              <div>
                <span className="automation-label">
                  Workflow métier actif
                </span>

                <strong>
                  Relance automatique
                  des factures échues
                </strong>

                <small>
                  Détection quotidienne,
                  contrôle des échéances,
                  relance et historisation.
                </small>
              </div>
            </div>


            <div className="automation-metrics">

              <div>
                <span>Fréquence</span>

                <strong>
                  Tous les {intervalDays} jours
                </strong>

                <select
                  aria-label="Fréquence des relances"
                  value={intervalDays}
                  disabled={saving}
                  onChange={(event) =>
                    void updateInterval(
                      Number(
                        event.target.value
                      )
                    )
                  }
                >
                  <option value={7}>
                    7 jours
                  </option>

                  <option value={10}>
                    10 jours
                  </option>

                  <option value={14}>
                    14 jours
                  </option>

                  <option value={30}>
                    30 jours
                  </option>
                </select>
              </div>


              <div>
                <span>Dernier scan</span>

                <strong>
                  {formatDateTime(
                    rule.last_run_at
                  )}
                </strong>

                <small>
                  Scanner automatique
                </small>
              </div>


              <div>
                <span>
                  Dernière exécution
                </span>

                <strong
                  className={
                    latestExecution
                      ? `automation-execution-${latestExecution.status}`
                      : ""
                  }
                >
                  <StatusIcon
                    status={
                      latestExecution?.status
                    }
                  />

                  {statusLabel(
                    latestExecution?.status
                  )}
                </strong>

                <small>
                  {latestExecution
                    ? formatDateTime(
                        latestExecution.completed_at
                        ?? latestExecution.started_at
                      )
                    : "Aucune exécution"}
                </small>
              </div>

            </div>


            <div className="automation-actions">
              <button
                type="button"
                onClick={toggleAutomation}
                disabled={saving}
              >
                <Settings2 size={16} />

                {rule.enabled
                  ? "Mettre en pause"
                  : "Activer"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowHistory(
                    (value) => !value
                  )
                }
              >
                <History size={16} />
                Voir l'historique
              </button>

              <button
                type="button"
                className="automation-business-link"
                onClick={() =>
                  navigate(
                    "/invoices?status=overdue&from=intelligence"
                  )
                }
              >
                Factures à relancer
                <ArrowRight size={16} />
              </button>
            </div>

          </div>


          {showHistory && (
            <div className="automation-history">
              <div className="automation-history-title">
                <History size={16} />
                Exécutions récentes
              </div>

              {executions.length === 0 ? (
                <div className="intelligence-automation-empty">
                  Aucune exécution enregistrée.
                </div>
              ) : (
                executions
                  .slice(0, 5)
                  .map(
                    (execution) => (
                      <div
                        className="automation-history-row"
                        key={execution.id}
                      >
                        <div>
                          <StatusIcon
                            status={
                              execution.status
                            }
                          />

                          <span>
                            {statusLabel(
                              execution.status
                            )}
                          </span>
                        </div>

                        <span>
                          {execution.entity_type === "invoice"
                            && execution.entity_id
                            ? `Facture · ${execution.entity_id.slice(0, 8)} · `
                            : ""}

                          {formatDateTime(
                            execution.completed_at
                            ?? execution.started_at
                          )}
                        </span>
                      </div>
                    )
                  )
              )}
            </div>
          )}
        </>
      )}

    </section>
  );
}
