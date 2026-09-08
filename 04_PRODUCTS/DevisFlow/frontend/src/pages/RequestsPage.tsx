import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import type { FormEvent } from "react";

import {
  createRequest,
  getClients,
  getQuotes,
  getRequests,
  updateRequest,
} from "../services/api";

import type {
  Client,
  Quote,
  Request,
} from "../types";
import { getRequestStatusLabel } from "../utils/requestStatus";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
  }).format(value);
}


function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-CH").format(
    new Date(value)
  );
}


function getDeadlineState(deadline?: string | null) {
  if (!deadline) {
    return "none";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);

  const diffDays =
    (target.getTime() - today.getTime()) /
    (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return "overdue";
  }

  if (diffDays <= 7) {
    return "soon";
  }

  return "normal";
}


type RequestPeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


function isRequestInPeriod(
  request: Request,
  period: RequestPeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date =
    new Date(request.created_at);

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


function formatRequestMonthLabel(
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


export default function RequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [quotes, setQuotes] =
    useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [
    periodFilter,
    setPeriodFilter,
  ] = useState<RequestPeriodFilter>(
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

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");

  const [
    editingRequestId,
    setEditingRequestId,
  ] = useState<string | null>(null);


  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        requestsData,
        quotesData,
        clientsData,
      ] = await Promise.all([
        getRequests(),
        getQuotes(),
        getClients(),
      ]);

      setRequests(requestsData);
      setQuotes(quotesData);
      setClients(clientsData);

      if (clientsData.length > 0) {
        setClientId(
          (current) =>
            current || clientsData[0].id
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de charger les demandes."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadData();
  }, []);


  function resetForm() {
    setEditingRequestId(null);

    setTitle("");
    setDescription("");
    setBudget("");
    setDeadline("");

    if (clients.length > 0) {
      setClientId(clients[0].id);
    }
  }


  function openEditForm(
    request: Request
  ) {
    setEditingRequestId(
      request.id
    );

    setClientId(
      request.client_id
    );

    setTitle(
      request.title ?? ""
    );

    setDescription(
      request.description ?? ""
    );

    setBudget(
      request.budget != null
        ? String(request.budget)
        : ""
    );

    setDeadline(
      request.deadline ?? ""
    );

    setError("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      const payload = {
        client_id: clientId,
        title: title.trim(),
        description:
          description.trim() || null,
        budget:
          budget
            ? Number(budget)
            : null,
        deadline:
          deadline || null,
      };

      if (editingRequestId) {
        const updatedRequest =
          await updateRequest(
            editingRequestId,
            payload
          );

        setRequests((current) =>
          current.map((request) =>
            request.id ===
            updatedRequest.id
              ? updatedRequest
              : request
          )
        );
      } else {
        const request =
          await createRequest(
            payload
          );

        setRequests((current) => [
          ...current,
          request,
        ]);
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de créer la demande."
      );
    } finally {
      setSubmitting(false);
    }
  }


  function getClientName(id: string) {
    const name =
      clients.find(
        (client) => client.id === id
      )?.company_name
      ?? "Client inconnu";

    return name.replace(
      /^Entreprise\s+/i,
      ""
    );
  }


  const metrics = useMemo(() => {
    const totalBudget = requests.reduce(
      (total, request) =>
        total +
        Number(request.budget || 0),
      0
    );

    const overdue = requests.filter(
      (request) =>
        getDeadlineState(
          request.deadline
        ) === "overdue"
    ).length;

    const dueSoon = requests.filter(
      (request) =>
        getDeadlineState(
          request.deadline
        ) === "soon"
    ).length;

    return {
      total: requests.length,
      totalBudget,
      overdue,
      dueSoon,
    };
  }, [requests]);


  const filteredRequests = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return requests.filter(
      (request) => {
        if (
          !isRequestInPeriod(
            request,
            periodFilter
          )
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          request.title,
          request.description ?? "",
          getClientName(
            request.client_id
          ),
          request.status,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(
          query
        );
      }
    );
  }, [
    requests,
    search,
    clients,
    periodFilter,
  ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRequests.length /
          pageSize
      )
    );


  const paginatedRequests =
    useMemo(() => {
      const safePage =
        Math.min(
          currentPage,
          totalPages
        );

      const start =
        (safePage - 1) *
        pageSize;

      return filteredRequests.slice(
        start,
        start + pageSize
      );
    }, [
      filteredRequests,
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
      setCurrentPage(totalPages);
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
            Opportunités
          </span>

          <h1>Demandes</h1>

          <p>
            Centralisez les besoins clients et
            préparez leur transformation en devis.
          </p>
        </div>

        <button
          type="button"
          className="business-button business-button-primary"
          onClick={() =>
            setShowForm(
              (current) => !current
            )
          }
        >
          {showForm
            ? "Fermer"
            : "Nouvelle demande"}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <section className="df-premium-kpi-grid">
        <article
          className="df-premium-kpi-card"
          data-tone="primary"
        >
          <span>Total demandes</span>

          <strong>
            {loading
              ? "—"
              : metrics.total}
          </strong>

          <small>
            Opportunités enregistrées
          </small>
        </article>

        <article
          className="df-premium-kpi-card"
          data-tone="success"
        >
          <span>Budget estimé</span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.totalBudget
                )}
          </strong>

          <small>
            Potentiel commercial
          </small>
        </article>

        <article
          className="df-premium-kpi-card"
          data-tone={
            metrics.dueSoon > 0
              ? "cyan"
              : "neutral"
          }
        >
          <span>Échéances proches</span>

          <strong>
            {loading
              ? "—"
              : metrics.dueSoon}
          </strong>

          <small>
            Dans les 7 prochains jours
          </small>
        </article>

        <article
          className="df-premium-kpi-card"
          data-tone={
            metrics.overdue > 0
              ? "danger"
              : "neutral"
          }
        >
          <span>Demandes en retard</span>

          <strong>
            {loading
              ? "—"
              : metrics.overdue}
          </strong>

          <small>
            Échéance dépassée
          </small>
        </article>
      </section>

      {showForm && (
        <div className="business-form-overlay">
<form
          className="client-form"
          onSubmit={handleSubmit}
        >
          <div className="form-header">
            <div>
              <h2>
                Nouvelle demande
              </h2>

              <p>
                Enregistrez un nouveau besoin client.
              </p>
            </div>

            <button
              type="button"
              className="business-button business-button-secondary"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Annuler
            </button>
          </div>

          <div className="form-grid">
            <label>
              Client
              <select
                required
                value={clientId}
                onChange={(event) =>
                  setClientId(
                    event.target.value
                  )
                }
              >
                {clients.map(
                  (client) => (
                    <option
                      key={client.id}
                      value={client.id}
                    >
                      {client.company_name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Titre
              <input
                required
                placeholder="Ex. Installation système vidéosurveillance"
                value={title}
                onChange={(event) =>
                  setTitle(
                    event.target.value
                  )
                }
              />
            </label>

            <label className="full-width">
              Description
              <textarea
                rows={4}
                placeholder="Description du besoin client..."
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Budget estimé
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={budget}
                onChange={(event) =>
                  setBudget(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Échéance
              <input
                type="date"
                value={deadline}
                onChange={(event) =>
                  setDeadline(
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="business-button business-button-primary"
              disabled={
                submitting ||
                clients.length === 0
              }
            >
              {submitting
                ? (
                    editingRequestId
                      ? "Enregistrement..."
                      : "Création..."
                  )
                : (
                    editingRequestId
                      ? "Enregistrer"
                      : "Créer la demande"
                  )}
            </button>
          </div>
        </form>
        </div>
      )}

      <section className="table-card">
        <div className="client-list-header">
          <div>
            <h2>
              Demandes clients
            </h2>

            <p>
              {loading
                ? "Chargement..."
                : `${filteredRequests.length} demande${
                    filteredRequests.length > 1
                      ? "s"
                      : ""
                  } dans cette vue`}
            </p>
          </div>

          <input
            className="client-search"
            type="search"
            placeholder="Rechercher une demande..."
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
              {formatRequestMonthLabel()}
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
              {formatRequestMonthLabel(-1)}
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
            <span>Par page</span>

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
            Chargement des demandes...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="smart-empty-state">
            <strong>
              Aucune demande dans cette période.
            </strong>

            <span>
              Essayez une autre période ou affichez
              toutes les demandes.
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table df-premium-table">
              <thead>
                <tr>
                  <th>Demande</th>
                  <th>Client</th>
                  <th>Budget</th>
                  <th>Échéance</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedRequests.map(
                  (request) => {
                    const deadlineState =
                      getDeadlineState(
                        request.deadline
                      );

                    return (
                      <tr
                        key={request.id}
                        className={`business-row ${
                          deadlineState === "overdue"
                            ? "row-danger"
                            : deadlineState === "soon"
                              ? "row-warning"
                              : ""
                        }`}
                      >
                          <td
                            title={
                              request.description
                                ? `${request.title} — ${request.description}`
                                : request.title
                            }
                          >
                            <strong
                              className="df-cell-truncate"
                            >
                              {request.title}
                            </strong>

                            {request.description && (
                              <small
                                className="table-subtext df-cell-truncate"
                              >
                                {request.description}
                              </small>
                            )}
                          </td>

                          <td
                            title={getClientName(
                              request.client_id
                            )}
                          >
                            <span
                              className="df-cell-truncate"
                            >
                              {getClientName(
                                request.client_id
                              )}
                            </span>
                          </td>

                        <td>
                          {request.budget
                            ? formatCurrency(
                                Number(
                                  request.budget
                                )
                              )
                            : "—"}
                        </td>

                        <td>
                          <span
                            className={
                              deadlineState === "overdue"
                                ? "deadline deadline-danger"
                                : deadlineState === "soon"
                                  ? "deadline deadline-warning"
                                  : "deadline"
                            }
                          >
                            {formatDate(
                              request.deadline
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="status-badge">
                            {getRequestStatusLabel(request.status)}
                          </span>
                        </td>

                          <td>
                            <div className="business-row-actions">
                              <button
                                type="button"
                                className="business-button business-button-secondary business-button-sm"
                                disabled={
                                  request.status ===
                                  "cancelled"
                                }
                                onClick={() =>
                                  openEditForm(
                                    request
                                  )
                                }
                              >
                                Modifier
                              </button>

                              <button
                                type="button"
                                className="business-button business-button-secondary business-button-sm"
                                disabled={
                                  request.status ===
                                  "cancelled"
                                }
                                onClick={async () => {
                                  const confirmed =
                                    window.confirm(
                                      "Annuler cette demande ?"
                                    );

                                  if (!confirmed) {
                                    return;
                                  }

                                  try {
                                    const updatedRequest =
                                      await updateRequest(
                                        request.id,
                                        {
                                          status:
                                            "cancelled",
                                        }
                                      );

                                    setRequests(
                                      (current) =>
                                        current.map(
                                          (item) =>
                                            item.id ===
                                            updatedRequest.id
                                              ? updatedRequest
                                              : item
                                        )
                                    );
                                  } catch (err) {
                                    console.error(
                                      err
                                    );

                                    setError(
                                      "Impossible d'annuler la demande."
                                    );
                                  }
                                }}
                              >
                                Annuler
                              </button>

                              {(() => {
                                const quote =
                                  quotes.find(
                                    (item) =>
                                      item.request_id ===
                                      request.id
                                  );

                                return (
                                  <button
                                    type="button"
                                    className="business-button business-button-secondary business-button-sm"
                                    onClick={() =>
                                      navigate(
                                        quote
                                          ? `/quotes?request=${request.id}`
                                          : `/quotes?request=${request.id}&create=1`
                                      )
                                    }
                                  >
                                    {quote
                                      ? "Voir le devis"
                                      : "Créer un devis"}
                                  </button>
                                );
                              })()}
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
          filteredRequests.length > 0 && (
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
