import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getHistory,
  type HistoryEvent,
  type HistoryEventType,
} from "../services/historyService";


type HistoryPeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


function formatCurrency(
  value?: number | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "fr-CH",
    {
      style: "currency",
      currency: "CHF",
    }
  ).format(value);
}


function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-CH"
  ).format(date);
}


function getEventLabel(
  type: HistoryEventType
) {
  const labels: Record<
    HistoryEventType,
    string
  > = {
    invoice_created:
      "Facture créée",

    invoice_sent:
      "Facture envoyée",

    payment:
      "Paiement",

    reminder:
      "Relance",

    credit_note:
      "Avoir",

    refund:
      "Remboursement",
  };

  return labels[type];
}


function getEventClass(
  type: HistoryEventType
) {
  const classes: Record<
    HistoryEventType,
    string
  > = {
    invoice_created:
      "status-issued",

    invoice_sent:
      "status-sent",

    payment:
      "status-paid",

    reminder:
      "status-sent",

    credit_note:
      "status-issued",

    refund:
      "status-cancelled",
  };

  return classes[type];
}


function isHistoryEventInPeriod(
  event: HistoryEvent,
  period: HistoryPeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date = new Date(
    event.event_at
  );

  if (Number.isNaN(date.getTime())) {
    return false;
  }

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
        1
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
        1
      );

    const end =
      new Date(
        currentYear,
        currentMonth + 1,
        1
      );

    return (
      date >= start &&
      date < end
    );
  }


  return (
    date.getFullYear() ===
    currentYear
  );
}


function formatMonthLabel(
  offset = 0
) {
  const now = new Date();

  const date =
    new Date(
      now.getFullYear(),
      now.getMonth() + offset,
      1
    );

  const label =
    new Intl.DateTimeFormat(
      "fr-CH",
      {
        month: "long",
        year:
          offset === 0
            ? "numeric"
            : undefined,
      }
    ).format(date);

  return (
    label.charAt(0).toUpperCase() +
    label.slice(1)
  );
}


function getInvoiceId(
  event: HistoryEvent
): string | null {
  if (
    event.event_type ===
    "invoice_created"
  ) {
    return event.entity_id;
  }

  const invoiceId =
    event.metadata.invoice_id;

  return typeof invoiceId === "string"
    ? invoiceId
    : null;
}


export default function HistoryPage() {
  const navigate = useNavigate();

  const [
    events,
    setEvents,
  ] = useState<HistoryEvent[]>([]);

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
  ] = useState<HistoryPeriodFilter>(
    "current"
  );

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(10);


  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const data =
        await getHistory();

      setEvents(data);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger l'historique."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadData();
  }, []);


  const metrics = useMemo(() => {
    const periodEvents =
      events.filter(
        (event) =>
          isHistoryEventInPeriod(
            event,
            periodFilter
          )
      );

    const payments =
      periodEvents.filter(
        (event) =>
          event.event_type ===
          "payment"
      ).length;

    const reminders =
      periodEvents.filter(
        (event) =>
          event.event_type ===
          "reminder"
      ).length;

    const creditNotes =
      periodEvents.filter(
        (event) =>
          event.event_type ===
          "credit_note"
      ).length;

    const refunds =
      periodEvents.filter(
        (event) =>
          event.event_type ===
          "refund"
      ).length;

    return {
      total: periodEvents.length,
      payments,
      reminders,
      adjustments:
        creditNotes + refunds,
    };
  }, [
    events,
    periodFilter,
  ]);


  const filteredEvents =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return events
        .filter((event) => {
          if (
            !isHistoryEventInPeriod(
              event,
              periodFilter
            )
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const haystack = [
            getEventLabel(
              event.event_type
            ),
            event.title,
            event.detail,
            event.document_number,
            event.client_name,
            event.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            query
          );
        })
        .sort((a, b) => {
          const dateA =
            new Date(
              a.event_at
            ).getTime();

          const dateB =
            new Date(
              b.event_at
            ).getTime();

          return dateB - dateA;
        });
    }, [
      events,
      search,
      periodFilter,
    ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredEvents.length /
          pageSize
      )
    );


  const paginatedEvents =
    useMemo(() => {
      const safePage =
        Math.min(
          currentPage,
          totalPages
        );

      const start =
        (safePage - 1) *
        pageSize;

      return filteredEvents.slice(
        start,
        start + pageSize
      );
    }, [
      filteredEvents,
      currentPage,
      pageSize,
      totalPages,
    ]);


  useEffect(() => {
    setCurrentPage(1);
  }, [
    periodFilter,
    search,
    pageSize,
  ]);


  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);


  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">
            Traçabilité
          </span>

          <h1>Historique</h1>

          <p>
            Retrouvez les principaux
            événements financiers et
            commerciaux liés aux factures.
          </p>
        </div>
      </div>


      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      <section className="invoice-kpi-grid df-premium-kpi-grid">

        <article className="df-premium-kpi-card" data-tone="primary">
          <span>
            Événements
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.total}
          </strong>

          <small>
            Événements sur la période
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="success">
          <span>
            Paiements
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.payments}
          </strong>

          <small>
            Paiements sur la période
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="cyan">
          <span>
            Relances
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.reminders}
          </strong>

          <small>
            Relances sur la période
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="neutral">
          <span>
            Ajustements
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.adjustments}
          </strong>

          <small>
            Ajustements sur la période
          </small>
        </article>

      </section>


      <section className="table-card">

        <div className="business-list-header">
          <div>
            <h2>
              Fil d'activité
            </h2>

            <p>
              {loading
                ? "Chargement..."
                : `${filteredEvents.length} événement${
                    filteredEvents.length >
                    1
                      ? "s"
                      : ""
                  } dans cette vue`}
            </p>
          </div>

          <input
            className="business-search-input"
            type="search"
            placeholder="Rechercher un événement..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
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
                setPeriodFilter(
                  "current"
                )
              }
            >
              {formatMonthLabel()}
            </button>

            <button
              type="button"
              className={`list-filter-chip ${
                periodFilter === "previous"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setPeriodFilter(
                  "previous"
                )
              }
            >
              {formatMonthLabel(-1)}
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
                  "three_months"
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
                setPeriodFilter(
                  "year"
                )
              }
            >
              {new Date().getFullYear()}
            </button>

            <button
              type="button"
              className={`list-filter-chip ${
                periodFilter === "all"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setPeriodFilter(
                  "all"
                )
              }
            >
              Toutes
            </button>

          </div>


          <label className="list-page-size">
            <span>
              Par page
            </span>

            <select
              value={pageSize}
              onChange={(event) =>
                setPageSize(
                  Number(
                    event.target.value
                  )
                )
              }
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>


        {loading ? (
          <div className="smart-empty-state">
            Chargement de l'historique...
          </div>
        ) : filteredEvents.length ===
          0 ? (
          <div className="smart-empty-state">
            <strong>
              Aucun événement dans cette période.
            </strong>

            <span>
              Les événements liés aux factures
              apparaîtront ici.
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table history-table df-premium-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Événement</th>
                  <th>Document</th>
                  <th>Client</th>
                  <th>Détail</th>
                  <th>Montant</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedEvents.map(
                  (event) => {
                    const invoiceId =
                      getInvoiceId(event);

                    return (
                      <tr
                        key={event.id}
                        className="business-row"
                      >
                        <td>
                          {formatDate(
                            event.event_at
                          )}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${getEventClass(
                              event.event_type
                            )}`}
                          >
                            {getEventLabel(
                              event.event_type
                            )}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {event.document_number ??
                              "—"}
                          </strong>
                        </td>

                        <td>
                          {(
                            event.client_name ??
                            "Client inconnu"
                          ).replace(
                            /^Entreprise\s+/i,
                            ""
                          )}
                        </td>

                        <td>
                          <span
                            className="df-cell-truncate"
                            title={
                              event.detail ??
                              event.title
                            }
                          >
                            {event.detail ??
                              event.title}
                          </span>
                        </td>

                        <td>
                          {event.amount !==
                            null
                            ? (
                              <strong>
                                {formatCurrency(
                                  event.amount
                                )}
                              </strong>
                            )
                            : "—"}
                        </td>

                        <td>
                          <div className="business-row-actions">
                            {invoiceId && (
                              <button
                                type="button"
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  navigate(
                                    `/invoices?invoice=${invoiceId}`
                                  )
                                }
                              >
                                Voir facture
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}


        {!loading &&
          filteredEvents.length > 0 && (
          <div className="list-pagination">

            <div className="list-pagination-meta">
              Page {Math.min(
                currentPage,
                totalPages
              )} sur {totalPages}
            </div>


            <div className="list-pagination-controls">

              <button
                type="button"
                className="list-pagination-button"
                disabled={
                  currentPage <= 1
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.max(
                        1,
                        page - 1
                      )
                  )
                }
              >
                Précédent
              </button>


              <span className="list-pagination-current">
                {Math.min(
                  currentPage,
                  totalPages
                )}
              </span>


              <button
                type="button"
                className="list-pagination-button"
                disabled={
                  currentPage >=
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.min(
                        totalPages,
                        page + 1
                      )
                  )
                }
              >
                Suivant
              </button>

            </div>
          </div>
        )}

      </section>
    </div>
  );
}
