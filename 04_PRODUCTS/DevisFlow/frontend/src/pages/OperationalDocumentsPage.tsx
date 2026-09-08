import {
  useEffect,
  useMemo,
  useState,
} from "react";

import RowActionsMenu from "../components/RowActionsMenu";

import {
  deleteOperationalDocument,
  getOperationalDocuments,
  openOperationalDocumentPdf,
  sendOperationalDocument,
  updateOperationalDocumentStatus,
  type OperationalDocument,
  type OperationalDocumentStatus,
  type OperationalDocumentType,
} from "../services/operationalDocumentsService";


type TypeFilter =
  | "all"
  | OperationalDocumentType;

type PeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";

type SortMode =
  | "date_desc"
  | "date_asc";


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


function formatExecutionDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-CH",
    {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }
  ).format(
    new Date(
      `${value.substring(0, 10)}T00:00:00`
    )
  );
}


function getTypeLabel(
  type: OperationalDocumentType
) {
  return type === "delivery_note"
    ? "Livraison"
    : "Intervention";
}


function getStatusLabel(
  status: OperationalDocumentStatus
) {
  const labels: Record<
    OperationalDocumentStatus,
    string
  > = {
    draft: "Brouillon",
    issued: "Émis",
    sent: "Envoyé",
    cancelled: "Annulé",
  };

  return labels[status];
}


function getStatusClass(
  status: OperationalDocumentStatus
) {
  const classes: Record<
    OperationalDocumentStatus,
    string
  > = {
    draft: "status-draft",
    issued: "status-issued",
    sent: "status-sent",
    cancelled: "status-cancelled",
  };

  return classes[status];
}


function isInPeriod(
  document: OperationalDocument,
  period: PeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date = new Date(
    document.created_at
  );

  const now = new Date();

  if (period === "current") {
    return (
      date.getFullYear() ===
        now.getFullYear() &&
      date.getMonth() ===
        now.getMonth()
    );
  }

  if (period === "previous") {
    const previous =
      new Date(
        now.getFullYear(),
        now.getMonth() - 1,
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
        now.getFullYear(),
        now.getMonth() - 2,
        1
      );

    return date >= start;
  }

  return (
    date.getFullYear() ===
    now.getFullYear()
  );
}


function previousMonthLabel() {
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


export default function OperationalDocumentsPage() {
  const [
    documents,
    setDocuments,
  ] =
    useState<OperationalDocument[]>([]);

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
    typeFilter,
    setTypeFilter,
  ] =
    useState<TypeFilter>("all");

  const [
    periodFilter,
    setPeriodFilter,
  ] =
    useState<PeriodFilter>("current");

  const [
    sort,
    setSort,
  ] =
    useState<SortMode>("date_desc");

  const [
    pageSize,
    setPageSize,
  ] = useState(10);

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    sendingId,
    setSendingId,
  ] = useState<string | null>(
    null
  );


  async function loadData() {
    try {
      setLoading(true);
      setError("");

      setDocuments(
        await getOperationalDocuments()
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les documents."
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
    typeFilter,
    periodFilter,
    sort,
    pageSize,
  ]);


  const metrics =
    useMemo(() => {
      const active =
        documents.filter(
          (document) =>
            document.status !==
            "cancelled"
        );

      const sent =
        active.filter(
          (document) =>
            document.status === "sent"
        ).length;

      return {
        total: active.length,

        deliveries:
          active.filter(
            (document) =>
              document.document_type ===
              "delivery_note"
          ).length,

        interventions:
          active.filter(
            (document) =>
              document.document_type ===
              "intervention_note"
          ).length,

        sent,
      };
    }, [documents]);


  const filteredDocuments =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLowerCase();

      const result =
        documents.filter(
          (document) => {
            if (
              typeFilter !== "all" &&
              document.document_type !==
                typeFilter
            ) {
              return false;
            }

            if (
              !isInPeriod(
                document,
                periodFilter
              )
            ) {
              return false;
            }

            if (!normalized) {
              return true;
            }

            return (
              document
                .document_number
                .toLowerCase()
                .includes(normalized) ||
              (
                document.quote_number ??
                ""
              )
                .toLowerCase()
                .includes(normalized) ||
              getTypeLabel(
                document.document_type
              )
                .toLowerCase()
                .includes(normalized)
            );
          }
        );

      return result.sort(
        (a, b) => {
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
      documents,
      search,
      typeFilter,
      periodFilter,
      sort,
    ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredDocuments.length /
          pageSize
      )
    );


  const paginatedDocuments =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        pageSize;

      return filteredDocuments.slice(
        start,
        start + pageSize
      );
    }, [
      filteredDocuments,
      currentPage,
      pageSize,
    ]);


  async function changeStatus(
    document: OperationalDocument,
    status: OperationalDocumentStatus
  ) {
    try {
      setError("");

      const updated =
        await updateOperationalDocumentStatus(
          document.id,
          status
        );

      setDocuments(
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
    document: OperationalDocument
  ) {
    const label =
      getTypeLabel(
        document.document_type
      ).toLowerCase();

    if (
      !window.confirm(
        `Envoyer ce bon de ${label} ?`
      )
    ) {
      return;
    }

    try {
      setSendingId(
        document.id
      );

      setError("");

      const updated =
        await sendOperationalDocument(
          document.id
        );

      setDocuments(
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
          : "Impossible d'envoyer le document."
      );
    } finally {
      setSendingId(null);
    }
  }


  async function handleDelete(
    document: OperationalDocument
  ) {
    if (
      !window.confirm(
        `Supprimer ${document.document_number} ?`
      )
    ) {
      return;
    }

    try {
      setError("");

      await deleteOperationalDocument(
        document.id
      );

      setDocuments(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              document.id
          )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer le document."
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
            Exécution
          </span>

          <h1>
            Livraisons & interventions
          </h1>

          <p>
            Suivez l'exécution des
            prestations après acceptation
            du devis.
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
            Total documents
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


        <article className="df-premium-kpi-card" data-tone="cyan">
          <span>
            Livraisons
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.deliveries}
          </strong>

          <small>
            Bons de livraison
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="success">
          <span>
            Interventions
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.interventions}
          </strong>

          <small>
            Bons d’intervention
          </small>
        </article>

        <article
          className="df-premium-kpi-card"
          data-tone={
            metrics.sent > 0
              ? "cyan"
              : "neutral"
          }
        >
          <span>
            Envoyés
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.sent}
          </strong>

          <small>
            BL / BI transmis
          </small>
        </article>
      </section>


      <section className="business-card proforma-list-card">
        <div className="proforma-list-header">
          <div>
            <h2>
              Suivi de l'exécution
            </h2>

            <p>
              {filteredDocuments.length}{" "}
              document
              {filteredDocuments.length >
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
            placeholder="Rechercher un document..."
          />
        </div>


        <div className="operational-type-tabs">
          <button
            type="button"
            className={
              typeFilter === "all"
                ? "proforma-filter-button proforma-filter-button-active"
                : "proforma-filter-button"
            }
            onClick={() =>
              setTypeFilter("all")
            }
          >
            Tous
          </button>

          <button
            type="button"
            className={
              typeFilter ===
              "delivery_note"
                ? "proforma-filter-button proforma-filter-button-active"
                : "proforma-filter-button"
            }
            onClick={() =>
              setTypeFilter(
                "delivery_note"
              )
            }
          >
            Livraisons
          </button>

          <button
            type="button"
            className={
              typeFilter ===
              "intervention_note"
                ? "proforma-filter-button proforma-filter-button-active"
                : "proforma-filter-button"
            }
            onClick={() =>
              setTypeFilter(
                "intervention_note"
              )
            }
          >
            Interventions
          </button>
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
              {previousMonthLabel()}
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
            <label>
              Trier par
            </label>

            <select
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target
                    .value as SortMode
                )
              }
            >
              <option value="date_desc">
                Plus récents
              </option>

              <option value="date_asc">
                Plus anciens
              </option>
            </select>
          </div>


          <div className="proforma-page-size-control">
            <label>
              Par page
            </label>

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
          </div>
        </div>


        {loading ? (
          <div className="smart-empty-state">
            Chargement...
          </div>
        ) : paginatedDocuments.length ===
          0 ? (
          <div className="smart-empty-state">
            <strong>
              Aucun document dans cette vue.
            </strong>

            <span>
              Les BL et BI sont créés
              depuis un devis accepté.
            </span>
          </div>
        ) : (
          <div className="proforma-table-wrap">
              <div className="table-scroll">
<table className="data-table execution-table df-premium-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Devis</th>
                  <th>Date</th>
                  <th>Exécution</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedDocuments.map(
                  (document) => (
                    <tr key={document.id}>
                      <td>
                        <strong>
                          {
                            document
                              .document_number
                          }
                        </strong>
                      </td>

                      <td>
                        {getTypeLabel(
                          document
                            .document_type
                        )}
                      </td>

                      <td>
                        {
                          document
                            .quote_number ??
                          "—"
                        }
                      </td>

                      <td>
                        {formatDate(
                          document.issue_date
                        )}
                      </td>

                        <td
                          title={
                            document.execution_date
                              ? `${
                                  document.document_type ===
                                  "delivery_note"
                                    ? "Livré"
                                    : "Intervenu"
                                } le ${formatExecutionDate(
                                  document.execution_date
                                )}`
                              : "Date d'exécution non renseignée"
                          }
                        >
                          {formatExecutionDate(
                            document.execution_date
                          )}
                        </td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            document.status
                          )}`}
                        >
                          {getStatusLabel(
                            document.status
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="row-actions df-table-actions">
                          {document.status ===
                            "draft" && (
                            <button
                              type="button"
                              className="business-button business-button-primary business-button-sm"
                              onClick={() =>
                                void changeStatus(
                                  document,
                                  "issued"
                                )
                              }
                            >
                              Émettre
                            </button>
                          )}

                          {document.status ===
                            "issued" && (
                            <button
                              type="button"
                              className="business-button business-button-primary business-button-sm"
                              disabled={
                                sendingId ===
                                document.id
                              }
                              onClick={() =>
                                void handleSend(
                                  document
                                )
                              }
                            >
                              {sendingId ===
                              document.id
                                ? "Envoi..."
                                : "Envoyer"}
                            </button>
                          )}

                          <RowActionsMenu>
                            <button
                              type="button"
                              className="business-button business-button-secondary business-button-sm"
                              onClick={() =>
                                openOperationalDocumentPdf(
                                  document.id
                                )
                              }
                            >
                              PDF
                            </button>

                            {document.status ===
                              "draft" && (
                              <button
                                type="button"
                                className="business-button business-button-danger business-button-sm"
                                onClick={() =>
                                  void handleDelete(
                                    document
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
                              document.status
                            ) && (
                              <button
                                type="button"
                                className="business-button business-button-danger business-button-sm"
                                onClick={() =>
                                  void changeStatus(
                                    document,
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
          filteredDocuments.length >
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
