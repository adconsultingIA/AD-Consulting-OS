import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import RowActionsMenu from "../components/RowActionsMenu";

import {
  generateRecurringInvoice,
  getRecurringInvoices,
  updateRecurringInvoiceStatus,
  type RecurringFrequency,
  type RecurringInvoice,
} from "../services/recurringInvoicesService";


function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-CH",
  ).format(
    new Date(
      `${value.substring(0, 10)}T00:00:00`,
    ),
  );
}


function getFrequencyLabel(
  frequency: RecurringFrequency,
) {
  const labels: Record<
    RecurringFrequency,
    string
  > = {
    monthly: "Mensuelle",
    quarterly: "Trimestrielle",
    yearly: "Annuelle",
  };

  return labels[frequency];
}


function getStatusLabel(
  status: RecurringInvoice["status"],
) {
  const labels: Record<
    RecurringInvoice["status"],
    string
  > = {
    active: "Active",
    paused: "En pause",
    stopped: "Arrêtée",
  };

  return labels[status];
}


function getStatusClass(
  status: RecurringInvoice["status"],
) {
  const classes: Record<
    RecurringInvoice["status"],
    string
  > = {
    active: "status-issued",
    paused: "status-draft",
    stopped: "status-cancelled",
  };

  return classes[status];
}


function isDue(
  recurring: RecurringInvoice,
) {
  if (recurring.status !== "active") {
    return false;
  }

  const now = new Date();

  const today = [
    now.getFullYear(),
    String(
      now.getMonth() + 1,
    ).padStart(2, "0"),
    String(
      now.getDate(),
    ).padStart(2, "0"),
  ].join("-");

  return (
    recurring.next_invoice_date
      .substring(0, 10) <= today
  );
}


type RecurringPeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


function isRecurringInPeriod(
  recurring: RecurringInvoice,
  period: RecurringPeriodFilter,
) {
  if (period === "all") {
    return true;
  }

  const value =
    recurring.next_invoice_date?.substring(
      0,
      10,
    );

  if (!value) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00`,
  );

  const now = new Date();

  const currentYear =
    now.getFullYear();

  const currentMonth =
    now.getMonth();

  if (period === "current") {
    return (
      date.getFullYear() ===
        currentYear &&
      date.getMonth() ===
        currentMonth
    );
  }

  if (period === "previous") {
    const previous =
      new Date(
        currentYear,
        currentMonth - 1,
        1,
      );

    return (
      date.getFullYear() ===
        previous.getFullYear() &&
      date.getMonth() ===
        previous.getMonth()
    );
  }

  if (period === "three_months") {
    const start =
      new Date(
        currentYear,
        currentMonth - 2,
        1,
      );

    const end =
      new Date(
        currentYear,
        currentMonth + 1,
        0,
        23,
        59,
        59,
      );

    return (
      date >= start &&
      date <= end
    );
  }

  if (period === "year") {
    return (
      date.getFullYear() ===
      currentYear
    );
  }

  return true;
}


function getRecurringClientLabel(
  value?: string | null,
) {
  if (!value) {
    return "—";
  }

  return value.replace(
    /^Entreprise\s+/i,
    "",
  );
}


export default function RecurringInvoicesPage() {
  const navigate = useNavigate();

  const [
    recurringInvoices,
    setRecurringInvoices,
  ] = useState<RecurringInvoice[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
      search,
      setSearch,
    ] = useState("");

    const [
      periodFilter,
      setPeriodFilter,
    ] = useState<RecurringPeriodFilter>(
      "current",
    );

  const [
    workingId,
    setWorkingId,
  ] = useState<string | null>(
    null,
  );


  async function loadData() {
    try {
      setLoading(true);
      setError("");

      setRecurringInvoices(
        await getRecurringInvoices(),
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Erreur de chargement.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadData();
  }, []);


  const metrics = useMemo(() => {
    const active =
      recurringInvoices.filter(
        (item) =>
          item.status === "active",
      );

    const due =
      active.filter(isDue);

    const paused =
      recurringInvoices.filter(
        (item) =>
          item.status === "paused",
      );

    const generated =
        recurringInvoices.reduce(
          (total, item) =>
            total +
            Number(
              item.generated_invoices_count || 0,
            ),
          0,
        );

      return {
        active: active.length,
        due: due.length,
        paused: paused.length,
        generated,
      };
  }, [recurringInvoices]);


  const filteredRecurringInvoices =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLowerCase();

      return recurringInvoices.filter(
        (item) => {
          if (
            !isRecurringInPeriod(
              item,
              periodFilter,
            )
          ) {
            return false;
          }

          if (!normalized) {
            return true;
          }

          return (
            item.service_name
              .toLowerCase()
              .includes(normalized) ||
            (
              item.quote_number ??
              ""
            )
              .toLowerCase()
              .includes(normalized) ||
            (
              item.client_name ??
              ""
            )
              .toLowerCase()
              .includes(normalized) ||
            getFrequencyLabel(
              item.frequency,
            )
              .toLowerCase()
              .includes(normalized) ||
            getStatusLabel(
              item.status,
            )
              .toLowerCase()
              .includes(normalized)
          );
        },
      );
    }, [
      recurringInvoices,
      search,
      periodFilter,
    ]);


  async function handleGenerate(
    recurring: RecurringInvoice,
  ) {
    if (
      !window.confirm(
        `Générer la facture pour « ${recurring.service_name} » ?`,
      )
    ) {
      return;
    }

    try {
      setWorkingId(
        recurring.id,
      );

      setError("");

      const result =
        await generateRecurringInvoice(
          recurring.id,
        );

      setRecurringInvoices(
        (current) =>
          current.map((item) =>
            item.id === recurring.id
              ? result.recurring_invoice
              : item,
          ),
      );

      window.alert(
        `${result.invoice.invoice_number} a été créée en brouillon.`,
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de générer la facture.",
      );
    } finally {
      setWorkingId(null);
    }
  }


  async function handleStatus(
    recurring: RecurringInvoice,
    target:
      | "active"
      | "paused"
      | "stopped",
  ) {
    if (
      target === "stopped" &&
      !window.confirm(
        `Arrêter définitivement « ${recurring.service_name} » ?`,
      )
    ) {
      return;
    }

    try {
      setWorkingId(
        recurring.id,
      );

      setError("");

      const updated =
        await updateRecurringInvoiceStatus(
          recurring.id,
          target,
        );

      setRecurringInvoices(
        (current) =>
          current.map((item) =>
            item.id === updated.id
              ? updated
              : item,
          ),
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier la récurrence.",
      );
    } finally {
      setWorkingId(null);
    }
  }


  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">
            Facturation
          </span>

          <h1>
            Récurrences
          </h1>

          <p>
            Pilotez vos contrats,
            maintenances et abonnements
            facturés périodiquement.
          </p>
        </div>
      </div>


      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      <section className="quote-kpi-grid df-premium-kpi-grid">
        <article className="df-premium-kpi-card" data-tone="primary">
          <span>
            Récurrences actives
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.active}
          </strong>

          <small>
            Contrats en cours
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="cyan">
          <span>
            À générer
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.due}
          </strong>

          <small>
            Échéances arrivées
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="neutral">
          <span>
            En pause
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.paused}
          </strong>

          <small>
            Récurrences suspendues
          </small>
        </article>

        <article
          className="df-premium-kpi-card"
          data-tone="success"
        >
          <span>
            Factures générées
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.generated}
          </strong>

          <small>
            Depuis les récurrences
          </small>
        </article>
      </section>


      <section className="business-card recurring-list-card">
        <div className="recurring-list-header">
          <div>
            <h2>
              Facturation récurrente
            </h2>

            <p>
              {
                filteredRecurringInvoices.length
              }{" "}
              récurrence
              {
                filteredRecurringInvoices.length >
                1
                  ? "s"
                  : ""
              }{" "}
              dans cette vue
            </p>
          </div>

          <input
            className="recurring-search"
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Rechercher un service ou un devis..."
          />
        </div>

        <div className="list-foundation-toolbar">
          <div className="list-period-chips">
            <button
              type="button"
              className={`list-filter-chip ${
                periodFilter === "current"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setPeriodFilter("current")
              }
            >
              Septembre 2026
            </button>

            <button
              type="button"
              className={`list-filter-chip ${
                periodFilter === "previous"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setPeriodFilter("previous")
              }
            >
              Août 2026
            </button>

            <button
              type="button"
              className={`list-filter-chip ${
                periodFilter === "three_months"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setPeriodFilter(
                  "three_months",
                )
              }
            >
              3 mois
            </button>

            <button
              type="button"
              className={`list-filter-chip ${
                periodFilter === "year"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setPeriodFilter("year")
              }
            >
              2026
            </button>

            <button
              type="button"
              className={`list-filter-chip ${
                periodFilter === "all"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setPeriodFilter("all")
              }
            >
              Toutes
            </button>
          </div>
        </div>


        {loading ? (
          <div className="recurring-empty">
            Chargement...
          </div>
        ) : filteredRecurringInvoices.length ===
          0 ? (
          <div className="recurring-empty">
            <strong>
              Aucune récurrence
            </strong>

            <span>
              Les récurrences seront
              créées depuis les devis
              acceptés.
            </span>
          </div>
        ) : (
          <div className="recurring-table-wrap">
            <div className="table-scroll">
<table className="recurring-table df-premium-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Client</th>
                  <th>Devis</th>
                  <th>Fréquence</th>
                  <th>
                    Prochaine échéance
                  </th>
                  <th>Statut</th>
                  <th>
                    Factures générées
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecurringInvoices.map(
                  (recurring) => {
                    const due =
                      isDue(
                        recurring,
                      );

                    const working =
                      workingId ===
                      recurring.id;

                    return (
                      <tr
                        key={
                          recurring.id
                        }
                      >
                        <td>
                            <strong
                              className="recurring-service-name"
                              title={
                                recurring.service_name
                              }
                            >
                              {
                                recurring.service_name
                              }
                            </strong>

                          
                        </td>
                          <td>
                            {
                                getRecurringClientLabel(
                                  recurring.client_name,
                                )
                              }
                          </td>


                        <td>
                          {
                            recurring.quote_number ??
                            "—"
                          }
                        </td>


                        <td>
                          {getFrequencyLabel(
                            recurring.frequency,
                          )}
                        </td>

                        <td>
                          {formatDate(
                            recurring.next_invoice_date,
                          )}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${getStatusClass(
                              recurring.status,
                            )}`}
                          >
                            {getStatusLabel(
                              recurring.status,
                            )}
                          </span>
                        </td>

                        <td>
                          {
                            recurring.generated_invoices_count
                          }
                        </td>

                        <td>

                          <div className="recurring-actions df-table-actions">
                            {due && (
                              <button
                                type="button"
                                className="business-button business-button-cyan business-button-sm business-primary-action"
                                disabled={
                                  working
                                }
                                onClick={() =>
                                  void handleGenerate(
                                    recurring,
                                  )
                                }
                              >
                                {working
                                  ? "..."
                                  : "Générer"}
                              </button>
                            )}

                            <RowActionsMenu>
                              {recurring.status ===
                                "active" && (
                                <button
                                  type="button"
                                  className="business-button business-button-secondary business-button-sm"
                                  disabled={
                                    working
                                  }
                                  onClick={() =>
                                    void handleStatus(
                                      recurring,
                                      "paused",
                                    )
                                  }
                                >
                                  Pause
                                </button>
                              )}

                              {recurring.status ===
                                "paused" && (
                                <button
                                  type="button"
                                  className="business-button business-button-secondary business-button-sm"
                                  disabled={
                                    working
                                  }
                                  onClick={() =>
                                    void handleStatus(
                                      recurring,
                                      "active",
                                    )
                                  }
                                >
                                  Reprendre
                                </button>
                              )}

                              {recurring.status !==
                                "stopped" && (
                                <button
                                  type="button"
                                  className="business-button business-button-danger business-button-sm"
                                  disabled={
                                    working
                                  }
                                  onClick={() =>
                                    void handleStatus(
                                      recurring,
                                      "stopped",
                                    )
                                  }
                                >
                                  Arrêter
                                </button>
                              )}

                              {recurring.generated_invoices_count >
                                0 && (
                                <button
                                  type="button"
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    navigate(
                                      "/invoices",
                                    )
                                  }
                                >
                                  Factures
                                </button>
                              )}
                            </RowActionsMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
