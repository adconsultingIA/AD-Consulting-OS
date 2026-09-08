import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  createInvoiceReminder,
  getReminderCockpit,
  type PaymentReminderCockpitItem,
} from "../services/remindersService";


function formatCurrency(
  value: string | number
) {
  return new Intl.NumberFormat(
    "fr-CH",
    {
      style: "currency",
      currency: "CHF",
    }
  ).format(
    Number(value || 0)
  );
}


function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-CH"
  ).format(
    new Date(
      `${value}T00:00:00`
    )
  );
}


function getReminderClientLabel(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  return value.replace(
    /^Entreprise\s+/i,
    ""
  );
}


type ReminderStatusFilter =
  | "all"
  | "due"
  | "upcoming"
  | "paused";

export default function RemindersPage() {
  const navigate = useNavigate();

  const [
    cockpit,
    setCockpit,
  ] = useState<
    PaymentReminderCockpitItem[]
  >([]);

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
    statusFilter,
    setStatusFilter,
  ] = useState<ReminderStatusFilter>(
    "all"
  );

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(10);

  const [
    sendingInvoiceId,
    setSendingInvoiceId,
  ] = useState<string | null>(null);


  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const data =
        await getReminderCockpit();

      setCockpit(data);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les relances."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadData();
  }, []);


  async function handleReminder(
    item: PaymentReminderCockpitItem
  ) {
    const confirmed = window.confirm(
      `Envoyer une nouvelle relance pour ${item.invoice_number} ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSendingInvoiceId(
        item.invoice_id
      );
      setError("");

      const today = new Date();

      const reminderDate = [
        today.getFullYear(),
        String(
          today.getMonth() + 1
        ).padStart(2, "0"),
        String(
          today.getDate()
        ).padStart(2, "0"),
      ].join("-");

      await createInvoiceReminder(
        item.invoice_id,
        {
          reminder_date:
            reminderDate,
          channel: "email",
        }
      );

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer la relance."
      );
    } finally {
      setSendingInvoiceId(null);
    }
  }


  const metrics = useMemo(() => {
    const due =
      cockpit.filter(
        (item) =>
          item.status === "due"
      ).length;

    const upcoming =
      cockpit.filter(
        (item) =>
          item.status === "upcoming"
      ).length;

    const paused =
      cockpit.filter(
        (item) =>
          item.status === "paused"
      ).length;

    const outstandingAmount =
      cockpit.reduce(
        (total, item) =>
          total +
          Number(
            item.amount_due || 0
          ),
        0
      );

    return {
      due,
      upcoming,
      paused,
      outstandingAmount,
    };
  }, [cockpit]);


  const filteredCockpit =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return cockpit
        .filter((item) => {
            if (
              statusFilter !== "all" &&
              item.status !== statusFilter
            ) {
              return false;
            }

          if (!query) {
            return true;
          }

          const haystack = [
            item.invoice_number,
            item.client_name,
            item.status,
            item.reminder_count,
            item.due_date ?? "",
            item.last_reminder_date ?? "",
            item.next_reminder_date ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            query
          );
        })
        .sort((a, b) => {
          if (
            a.status === "due" &&
            b.status !== "due"
          ) {
            return -1;
          }

          if (
            b.status === "due" &&
            a.status !== "due"
          ) {
            return 1;
          }

          if (
            a.status === "upcoming" &&
            b.status === "paused"
          ) {
            return -1;
          }

          if (
            a.status === "paused" &&
            b.status === "upcoming"
          ) {
            return 1;
          }

          const dateA =
            new Date(
              a.next_reminder_date
                ?? a.due_date
                ?? "9999-12-31"
            ).getTime();

          const dateB =
            new Date(
              b.next_reminder_date
                ?? b.due_date
                ?? "9999-12-31"
            ).getTime();

          return dateA - dateB;
        });
    }, [
      cockpit,
      search,
      statusFilter,
    ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredCockpit.length /
          pageSize
      )
    );


  const paginatedCockpit =
    useMemo(() => {
      const safePage =
        Math.min(
          currentPage,
          totalPages
        );

      const start =
        (safePage - 1) *
        pageSize;

      return filteredCockpit.slice(
        start,
        start + pageSize
      );
    }, [
      filteredCockpit,
      currentPage,
      pageSize,
      totalPages,
    ]);


  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
      statusFilter,
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
            Recouvrement
          </span>

          <h1>
            Relances
          </h1>

          <p>
            Pilotez les factures en retard,
            les prochaines échéances de relance
            et les montants restant à encaisser.
          </p>
        </div>
      </div>


      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      <section className="invoice-kpi-grid df-premium-kpi-grid">
        <article
          className="df-premium-kpi-card"
          data-tone="danger"
        >
          <span>
            À relancer
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


        <article
          className="df-premium-kpi-card"
          data-tone="cyan"
        >
          <span>
            À venir
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.upcoming}
          </strong>

          <small>
            Relances planifiées
          </small>
        </article>


        <article
          className="df-premium-kpi-card"
          data-tone="neutral"
        >
          <span>
            Suspendues
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.paused}
          </strong>

          <small>
            Cycles en pause
          </small>
        </article>


        <article
          className="df-premium-kpi-card"
          data-tone="primary"
        >
          <span>
            Montant à recouvrer
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.outstandingAmount
                )}
          </strong>

          <small>
            Solde des factures en retard
          </small>
        </article>
      </section>


      <section className="table-card">
        <div className="business-list-header">
          <div>
            <h2>
              Cockpit de recouvrement
            </h2>

            <p>
              {loading
                ? "Chargement..."
                : `${filteredCockpit.length} facture${
                    filteredCockpit.length > 1
                      ? "s"
                      : ""
                  } dans cette vue`}
            </p>
          </div>

          <input
            className="business-search-input"
            type="search"
            placeholder="Rechercher une facture..."
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
                statusFilter === "all"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setStatusFilter("all")
              }
            >
              Toutes
            </button>

            <button
              type="button"
              className={`list-filter-chip ${
                statusFilter === "due"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setStatusFilter("due")
              }
            >
              À relancer
            </button>

            <button
              type="button"
              className={`list-filter-chip ${
                statusFilter === "upcoming"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setStatusFilter("upcoming")
              }
            >
              À venir
            </button>

            <button
              type="button"
              className={`list-filter-chip ${
                statusFilter === "paused"
                  ? "list-filter-chip-active"
                  : ""
              }`}
              onClick={() =>
                setStatusFilter("paused")
              }
            >
              Suspendues
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
              <option value={10}>
                10
              </option>

              <option value={25}>
                25
              </option>

              <option value={50}>
                50
              </option>
            </select>
          </label>
        </div>


        {loading ? (
          <div className="smart-empty-state">
            Chargement du cockpit...
          </div>
        ) : filteredCockpit.length === 0 ? (
          <div className="smart-empty-state">
            <strong>
              Aucune facture à recouvrer.
            </strong>

            <span>
              Les factures en retard avec
              un solde restant dû apparaîtront ici.
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table reminders-table df-premium-table">
              <thead>
                <tr>
                  <th>
                    Facture
                  </th>

                  <th>
                    Client
                  </th>

                  <th>
                    Échéance
                  </th>

                  <th>
                    Reste dû
                  </th>

                  <th>
                    Dernière relance
                  </th>

                  <th>
                    Relance N°
                  </th>

                  <th>
                    Prochaine relance
                  </th>

                  <th>
                    Statut
                  </th>

                  <th>
                    Actions
                  </th>
                </tr>
              </thead>


              <tbody>
                {paginatedCockpit.map(
                  (item) => (
                    <tr
                      key={
                        item.invoice_id
                      }
                      className="business-row"
                    >
                      <td>
                        <strong>
                          {
                            item.invoice_number
                          }
                        </strong>
                      </td>


                      <td>
                        {getReminderClientLabel(
                          item.client_name
                        )}
                      </td>


                      <td>
                        {formatDate(
                          item.due_date
                        )}
                      </td>


                      <td>
                        <strong>
                          {formatCurrency(
                            item.amount_due
                          )}
                        </strong>
                      </td>


                      <td>
                        {item.last_reminder_date
                          ? formatDate(
                              item.last_reminder_date
                            )
                          : "Aucune"}
                      </td>


                      <td>
                        {item.reminder_count > 0
                          ? `Relance ${item.reminder_count}`
                          : "Première"}
                      </td>


                      <td>
                        {item.next_reminder_date
                          ? formatDate(
                              item.next_reminder_date
                            )
                          : "À effectuer"}
                      </td>


                      <td>
                        <span
                          className={`status-badge ${
                            item.status === "due"
                              ? "status-overdue"
                              : item.status === "paused"
                                ? "status-cancelled"
                                : "status-sent"
                          }`}
                        >
                          {item.status === "due"
                            ? "À relancer"
                            : item.status === "paused"
                              ? "Suspendue"
                              : "À venir"}
                        </span>
                      </td>


                      <td>
                        <div className="business-row-actions">
                          {item.can_remind && (
                            <button
                              type="button"
                              className="business-button business-button-primary business-button-sm"
                              disabled={
                                sendingInvoiceId ===
                                item.invoice_id
                              }
                              onClick={() =>
                                handleReminder(
                                  item
                                )
                              }
                            >
                              {sendingInvoiceId ===
                              item.invoice_id
                                ? "Envoi..."
                                : "Relancer"}
                            </button>
                          )}

                          <button
                            type="button"
                            className="business-button business-button-secondary business-button-sm"
                            onClick={() =>
                              navigate(
                                `/invoices?invoice=${item.invoice_id}`
                              )
                            }
                          >
                            Voir facture
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}


        {!loading &&
          filteredCockpit.length > 0 && (
          <div className="list-pagination">
            <div className="list-pagination-meta">
              Page{" "}
              {Math.min(
                currentPage,
                totalPages
              )}{" "}
              sur {totalPages}
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
