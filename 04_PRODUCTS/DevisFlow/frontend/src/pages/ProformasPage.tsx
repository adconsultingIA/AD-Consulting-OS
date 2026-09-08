import {
  useEffect,
  useMemo,
  useState,
} from "react";

import RowActionsMenu from "../components/RowActionsMenu";
import DocumentEmailTrace from "../components/DocumentEmailTrace";

import {
  deleteProforma,
  getProformas,
  openProformaPdf,
  sendProforma,
  updateProformaStatus,
  type Proforma,
  type ProformaStatus,
} from "../services/proformasService";


type ProformaPeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


type ProformaSort =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc";


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
      `${value.substring(0, 10)}T00:00:00`
    )
  );
}


function getProformaValidityState(
  proforma: Proforma
): "normal" | "soon" | "expired" {
  if (
    !proforma.valid_until ||
    !["issued", "sent"].includes(
      proforma.status
    )
  ) {
    return "normal";
  }

  const validity = new Date(
    `${proforma.valid_until.substring(
      0,
      10
    )}T00:00:00`
  );

  if (
    Number.isNaN(
      validity.getTime()
    )
  ) {
    return "normal";
  }

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const difference =
    validity.getTime() -
    today.getTime();

  const days =
    Math.ceil(
      difference /
        (1000 * 60 * 60 * 24)
    );

  if (days < 0) {
    return "expired";
  }

  if (days <= 7) {
    return "soon";
  }

  return "normal";
}


function getStatusLabel(
  status: ProformaStatus
) {
  const labels: Record<
    ProformaStatus,
    string
  > = {
    draft: "Brouillon",
    issued: "Émise",
    sent: "Envoyée",
    cancelled: "Annulée",
  };

  return labels[status];
}


function getStatusClass(
  status: ProformaStatus
) {
  const classes: Record<
    ProformaStatus,
    string
  > = {
    draft: "status-draft",
    issued: "status-issued",
    sent: "status-sent",
    cancelled: "status-cancelled",
  };

  return classes[status];
}


function getPreviousMonthLabel() {
  const date = new Date();

  date.setMonth(
    date.getMonth() - 1
  );

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      month: "long",
    }
  ).format(date);
}


function isProformaInPeriod(
  proforma: Proforma,
  period: ProformaPeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date = new Date(
    proforma.created_at
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
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

    return date >= start;
  }


  return (
    date.getFullYear() ===
    currentYear
  );
}


export default function ProformasPage() {
  const [
    proformas,
    setProformas,
  ] = useState<Proforma[]>([]);

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
    sendingId,
    setSendingId,
  ] = useState<string | null>(
    null
  );

  const [
    periodFilter,
    setPeriodFilter,
  ] =
    useState<ProformaPeriodFilter>(
      "current"
    );

  const [
    sort,
    setSort,
  ] =
    useState<ProformaSort>(
      "date_desc"
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

      setProformas(
        await getProformas()
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Erreur de chargement."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadData();
  }, []);


  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    periodFilter,
    sort,
    pageSize,
  ]);


  const metrics =
    useMemo(() => {
      const active =
        proformas.filter(
          (proforma) =>
            proforma.status !==
            "cancelled"
        );

      const drafts =
        active.filter(
          (proforma) =>
            proforma.status ===
            "draft"
        );

      const sent =
        active.filter(
          (proforma) =>
            proforma.status ===
            "sent"
        );

      const sentAmount =
        sent.reduce(
          (sum, proforma) =>
            sum +
            Number(
              proforma.total || 0
            ),
          0
        );

      const toWatchCount =
        active.filter(
          (proforma) => {
            const state =
              getProformaValidityState(
                proforma
              );

            return (
              state === "soon" ||
              state === "expired"
            );
          }
        ).length;

      return {
        total: active.length,
        draftCount: drafts.length,
        sentCount: sent.length,
        sentAmount,
        toWatchCount,
      };
    }, [proformas]);


  const filteredProformas =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLowerCase();

      const filtered =
        proformas.filter(
          (proforma) => {
            const matchesPeriod =
              isProformaInPeriod(
                proforma,
                periodFilter
              );

            if (!matchesPeriod) {
              return false;
            }

            if (!normalized) {
              return true;
            }

            return (
              proforma
                .proforma_number
                .toLowerCase()
                .includes(
                  normalized
                ) ||
              (
                proforma
                  .quote_number ??
                ""
              )
                .toLowerCase()
                .includes(
                  normalized
                ) ||
              getStatusLabel(
                proforma.status
              )
                .toLowerCase()
                .includes(
                  normalized
                )
            );
          }
        );

      return filtered.sort(
        (a, b) => {
          if (
            sort ===
            "amount_asc"
          ) {
            return (
              Number(a.total) -
              Number(b.total)
            );
          }

          if (
            sort ===
            "amount_desc"
          ) {
            return (
              Number(b.total) -
              Number(a.total)
            );
          }

          const dateA =
            new Date(
              a.created_at
            ).getTime();

          const dateB =
            new Date(
              b.created_at
            ).getTime();

          return sort ===
            "date_asc"
            ? dateA - dateB
            : dateB - dateA;
        }
      );
    }, [
      proformas,
      search,
      periodFilter,
      sort,
    ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredProformas.length /
          pageSize
      )
    );


  const paginatedProformas =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        pageSize;

      return filteredProformas.slice(
        start,
        start + pageSize
      );
    }, [
      filteredProformas,
      currentPage,
      pageSize,
    ]);


  async function changeStatus(
    proforma: Proforma,
    status: ProformaStatus
  ) {
    try {
      setError("");

      const updated =
        await updateProformaStatus(
          proforma.id,
          status
        );

      setProformas(
        (current) =>
          current.map((item) =>
            item.id === updated.id
              ? updated
              : item
          )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier le statut."
      );
    }
  }


  async function handleSend(
    proforma: Proforma
  ) {
    if (
      !window.confirm(
        `Envoyer ${proforma.proforma_number} ?`
      )
    ) {
      return;
    }

    try {
      setSendingId(
        proforma.id
      );

      setError("");

      const updated =
        await sendProforma(
          proforma.id
        );

      setProformas(
        (current) =>
          current.map((item) =>
            item.id === updated.id
              ? updated
              : item
          )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer la proforma."
      );
    } finally {
      setSendingId(null);
    }
  }


  async function handleDelete(
    proforma: Proforma
  ) {
    if (
      !window.confirm(
        `Supprimer ${proforma.proforma_number} ?`
      )
    ) {
      return;
    }

    try {
      setError("");

      await deleteProforma(
        proforma.id
      );

      setProformas(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              proforma.id
          )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer la proforma."
      );
    }
  }


  const currentMonthLabel =
    new Intl.DateTimeFormat(
      "fr-FR",
      {
        month: "long",
        year: "numeric",
      }
    ).format(new Date());


  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">
            Commercial
          </span>

          <h1>
            Proformas
          </h1>

          <p>
            Préparez et envoyez vos
            documents préalables à la
            facturation.
          </p>
        </div>
      </div>


      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      <section className="df-premium-kpi-grid">
        <article className="df-premium-kpi-card" data-tone="primary">
          <span>
            Total proformas
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.total}
          </strong>

          <small>
            Documents actifs
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="neutral">
          <span>
            Brouillons
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.draftCount}
          </strong>

          <small>
            À vérifier ou émettre
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="cyan">
          <span>
            Proformas envoyées
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.sentAmount
                )}
          </strong>

          <small>
            {loading
              ? "—"
              : `${metrics.sentCount} envoyée${
                  metrics.sentCount > 1
                    ? "s"
                    : ""
                }`}
          </small>
        </article>

        <article
          className="df-premium-kpi-card"
          data-tone={
            metrics.toWatchCount > 0
              ? "danger"
              : "neutral"
          }
        >
          <span>
            À surveiller
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.toWatchCount}
          </strong>

          <small>
            Expirées ou validité proche
          </small>
        </article>
      </section>


      <section className="business-card proforma-list-card">
        <div className="proforma-list-header">
          <div>
            <h2>
              Suivi des proformas
            </h2>

            <p>
              {
                filteredProformas.length
              }{" "}
              proforma
              {filteredProformas.length >
              1
                ? "s"
                : ""}{" "}
              dans cette vue
            </p>
          </div>

          <input
            className="proforma-search"
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Rechercher une proforma..."
          />
        </div>


        <div className="proforma-list-controls">
          <div className="proforma-period-controls">
            <button
              type="button"
              className={
                periodFilter ===
                "current"
                  ? "proforma-filter-button proforma-filter-button-active"
                  : "proforma-filter-button"
              }
              onClick={() =>
                setPeriodFilter(
                  "current"
                )
              }
            >
              {currentMonthLabel}
            </button>

            <button
              type="button"
              className={
                periodFilter ===
                "previous"
                  ? "proforma-filter-button proforma-filter-button-active"
                  : "proforma-filter-button"
              }
              onClick={() =>
                setPeriodFilter(
                  "previous"
                )
              }
            >
              {getPreviousMonthLabel()}
            </button>

            <button
              type="button"
              className={
                periodFilter ===
                "three_months"
                  ? "proforma-filter-button proforma-filter-button-active"
                  : "proforma-filter-button"
              }
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
              className={
                periodFilter ===
                "year"
                  ? "proforma-filter-button proforma-filter-button-active"
                  : "proforma-filter-button"
              }
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
              className={
                periodFilter ===
                "all"
                  ? "proforma-filter-button proforma-filter-button-active"
                  : "proforma-filter-button"
              }
              onClick={() =>
                setPeriodFilter(
                  "all"
                )
              }
            >
              Tous
            </button>
          </div>


          <div className="proforma-sort-control">
            <label htmlFor="proforma-sort">
              Trier par
            </label>

            <select
              id="proforma-sort"
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target
                    .value as ProformaSort
                )
              }
            >
              <option value="date_desc">
                Plus récentes
              </option>

              <option value="date_asc">
                Plus anciennes
              </option>

              <option value="amount_desc">
                Montant décroissant
              </option>

              <option value="amount_asc">
                Montant croissant
              </option>
            </select>
          </div>


          <div className="proforma-page-size-control">
            <label htmlFor="proforma-page-size">
              Par page
            </label>

            <select
              id="proforma-page-size"
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
          </div>
        </div>


        {loading ? (
          <div className="smart-empty-state">
            Chargement...
          </div>
        ) : paginatedProformas.length ===
          0 ? (
          <div className="smart-empty-state">
            <strong>
              Aucune proforma dans
              cette vue.
            </strong>

            <span>
              Les proformas sont
              créées depuis un devis
              accepté.
            </span>
          </div>
        ) : (
          <div className="proforma-table-wrap">
            <div className="table-scroll">
<table className="data-table proforma-table df-premium-table">
              <thead>
                <tr>
                  <th>Proforma</th>
                  <th>Devis</th>
                  <th>Date</th>
                  <th>Total TTC</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedProformas.map(
                  (proforma) => (
                    <tr
                      key={proforma.id}
                    >
                      <td>
                        <strong>
                          {
                            proforma
                              .proforma_number
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          proforma
                            .quote_number ??
                          "—"
                        }
                      </td>

                      <td>
                        {formatDate(
                          proforma.issue_date
                        )}
                      </td>


                      <td>
                        <strong>
                          {formatCurrency(
                            proforma.total
                          )}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            proforma.status
                          )}`}
                        >
                          {getStatusLabel(
                            proforma.status
                          )}
                        </span>

                          <DocumentEmailTrace
                            documentType="proforma"
                            documentId={proforma.id}
                            documentStatus={proforma.status}
                          />


                          {getProformaValidityState(
                            proforma
                          ) === "expired" ? (
                            <small
                              className="quote-validity-trace quote-validity-danger"
                              title={`Validité : ${formatDate(
                                proforma.valid_until
                              )}`}
                            >
                              Expirée · {formatDate(
                                proforma.valid_until
                              )}
                            </small>
                          ) : getProformaValidityState(
                              proforma
                            ) === "soon" ? (
                            <small
                              className="quote-validity-trace quote-validity-warning"
                              title={`Validité : ${formatDate(
                                proforma.valid_until
                              )}`}
                            >
                              Expire bientôt · {formatDate(
                                proforma.valid_until
                              )}
                            </small>
                          ) : null}
                      </td>

                      <td>
                        <div className="row-actions df-table-actions">
                          {proforma.status ===
                            "draft" && (
                            <button
                              type="button"
                              className="business-button business-button-primary business-button-sm"
                              onClick={() =>
                                void changeStatus(
                                  proforma,
                                  "issued"
                                )
                              }
                            >
                              Émettre
                            </button>
                          )}

                          {proforma.status ===
                            "issued" && (
                            <button
                              type="button"
                              className="business-button business-button-primary business-button-sm"
                              disabled={
                                sendingId ===
                                proforma.id
                              }
                              onClick={() =>
                                void handleSend(
                                  proforma
                                )
                              }
                            >
                              {sendingId ===
                              proforma.id
                                ? "Envoi..."
                                : "Envoyer"}
                            </button>
                          )}

                          <RowActionsMenu>
                            <button
                              type="button"
                              className="business-button business-button-secondary business-button-sm"
                              onClick={() =>
                                openProformaPdf(
                                  proforma.id
                                )
                              }
                            >
                              PDF
                            </button>

                            {proforma.status ===
                              "draft" && (
                              <button
                                type="button"
                                className="business-button business-button-danger business-button-sm"
                                onClick={() =>
                                  void handleDelete(
                                    proforma
                                  )
                                }
                              >
                                Supprimer
                              </button>
                            )}

                            {[
                              "issued",
                              "sent",
                            ].includes(
                              proforma.status
                            ) && (
                              <button
                                type="button"
                                className="business-button business-button-danger business-button-sm"
                                onClick={() =>
                                  void changeStatus(
                                    proforma,
                                    "cancelled"
                                  )
                                }
                              >
                                Annuler
                              </button>
                            )}
                          </RowActionsMenu>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}


        {!loading &&
          filteredProformas.length >
            0 && (
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
