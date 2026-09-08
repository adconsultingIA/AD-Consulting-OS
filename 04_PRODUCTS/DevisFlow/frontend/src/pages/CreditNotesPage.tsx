import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getClients,
  getQuotes,
  getRequests,
} from "../services/api";

import {
  getInvoices,
} from "../services/invoicesService";

import {
  getInvoiceCreditNotes,
  type CreditNote,
} from "../services/creditNotesService";

import type {
  Client,
  Invoice,
  Quote,
  Request,
} from "../types";


type CreditNotePeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


type CreditNoteSort =
  | "date_desc"
  | "date_asc"
  | "amount_asc"
  | "amount_desc";


interface CreditNoteRow {
  creditNote: CreditNote;
  invoice: Invoice;
}


function formatCurrency(
  value: string | number
) {
  return new Intl.NumberFormat(
    "fr-CH",
    {
      style: "currency",
      currency: "CHF",
    }
  ).format(Number(value || 0));
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
    new Date(`${value}T00:00:00`)
  );
}


function isCreditNoteInPeriod(
  creditNote: CreditNote,
  period: CreditNotePeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date =
    new Date(
      `${creditNote.issue_date}T00:00:00`
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


function getCreditNoteClientLabel(
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


export default function CreditNotesPage() {
  const navigate = useNavigate();

  const [
    creditNotes,
    setCreditNotes,
  ] = useState<CreditNoteRow[]>([]);

  const [
    quotes,
    setQuotes,
  ] = useState<Quote[]>([]);

  const [
    requests,
    setRequests,
  ] = useState<Request[]>([]);

  const [
    clients,
    setClients,
  ] = useState<Client[]>([]);

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
  ] = useState<CreditNotePeriodFilter>(
    "current"
  );

  const [
    sort,
    setSort,
  ] = useState<CreditNoteSort>(
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

      const [
        invoicesData,
        quotesData,
        requestsData,
        clientsData,
      ] = await Promise.all([
        getInvoices(),
        getQuotes(),
        getRequests(),
        getClients(),
      ]);

      const creditNotesByInvoice =
        await Promise.all(
          invoicesData.map(
            async (invoice) => {
              const invoiceCreditNotes =
                await getInvoiceCreditNotes(
                  invoice.id
                );

              return invoiceCreditNotes.map(
                (creditNote) => ({
                  creditNote,
                  invoice,
                })
              );
            }
          )
        );

      setQuotes(quotesData);
      setRequests(requestsData);
      setClients(clientsData);

      setCreditNotes(
        creditNotesByInvoice.flat()
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les avoirs."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadData();
  }, []);


  function getQuote(
    invoice: Invoice
  ) {
    return quotes.find(
      (quote) =>
        quote.id === invoice.quote_id
    );
  }


  function getRequest(
    invoice: Invoice
  ) {
    const quote = getQuote(invoice);

    if (!quote) {
      return undefined;
    }

    return requests.find(
      (request) =>
        request.id ===
        quote.request_id
    );
  }


  function getClientName(
    invoice: Invoice
  ) {
    const request =
      getRequest(invoice);

    if (!request) {
      return "Client inconnu";
    }

    return (
      clients.find(
        (client) =>
          client.id ===
          request.client_id
      )?.company_name ??
      "Client inconnu"
    );
  }


  const metrics = useMemo(() => {
    const periodCreditNotes =
      creditNotes.filter((row) =>
        isCreditNoteInPeriod(
          row.creditNote,
          periodFilter,
        ),
      );

    const totalCredited =
      periodCreditNotes.reduce(
        (total, row) =>
          total +
          Number(
            row.creditNote.amount || 0,
          ),
        0,
      );

    const invoicesConcerned =
      new Set(
        periodCreditNotes.map(
          (row) =>
            row.invoice.id,
        ),
      ).size;

    const averageCredit =
      periodCreditNotes.length > 0
        ? totalCredited /
          periodCreditNotes.length
        : 0;

    return {
      totalCredited,
      creditNotesCount:
        periodCreditNotes.length,
      invoicesConcerned,
      averageCredit,
    };
  }, [
    creditNotes,
    periodFilter,
  ]);


  const filteredCreditNotes =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return creditNotes.filter(
        (row) => {
          if (
            !isCreditNoteInPeriod(
              row.creditNote,
              periodFilter
            )
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const haystack = [
            row.creditNote
              .credit_note_number,
            row.invoice.invoice_number,
            getClientName(
              row.invoice
            ),
            row.creditNote.reason,
            row.creditNote.status,
            row.creditNote.notes ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            query
          );
        }
      );
    }, [
      creditNotes,
      search,
      periodFilter,
      quotes,
      requests,
      clients,
    ]);


  const sortedCreditNotes =
    useMemo(() => {
      const result = [
        ...filteredCreditNotes,
      ];

      result.sort((a, b) => {
        if (sort === "amount_asc") {
          return (
            Number(
              a.creditNote.amount || 0
            ) -
            Number(
              b.creditNote.amount || 0
            )
          );
        }

        if (sort === "amount_desc") {
          return (
            Number(
              b.creditNote.amount || 0
            ) -
            Number(
              a.creditNote.amount || 0
            )
          );
        }

        const dateA =
          new Date(
            `${a.creditNote.issue_date}T00:00:00`
          ).getTime();

        const dateB =
          new Date(
            `${b.creditNote.issue_date}T00:00:00`
          ).getTime();

        if (sort === "date_asc") {
          return dateA - dateB;
        }

        return dateB - dateA;
      });

      return result;
    }, [
      filteredCreditNotes,
      sort,
    ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedCreditNotes.length /
          pageSize
      )
    );


  const paginatedCreditNotes =
    useMemo(() => {
      const safePage =
        Math.min(
          currentPage,
          totalPages
        );

      const start =
        (safePage - 1) *
        pageSize;

      return sortedCreditNotes.slice(
        start,
        start + pageSize
      );
    }, [
      sortedCreditNotes,
      currentPage,
      pageSize,
      totalPages,
    ]);


  useEffect(() => {
    setCurrentPage(1);
  }, [
    periodFilter,
    search,
    sort,
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
            Ajustements
          </span>

          <h1>Avoirs</h1>

          <p>
            Suivez les corrections,
            réductions et crédits appliqués
            aux factures émises.
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
            Total des avoirs
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.totalCredited
                )}
          </strong>

          <small>
            Montant crédité sur la période
          </small>
        </article>



          <article
            className="df-premium-kpi-card"
            data-tone="cyan"
          >
            <span>
              Nombre d'avoirs
            </span>

            <strong>
              {loading
                ? "—"
                : metrics.creditNotesCount}
            </strong>

            <small>
              Avoirs sur la période
            </small>
          </article>


        <article className="df-premium-kpi-card" data-tone="success">
          <span>
            Factures concernées
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.invoicesConcerned}
          </strong>

          <small>
            Factures concernées sur la période
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="neutral">
          <span>
            Avoir moyen
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.averageCredit
                )}
          </strong>

          <small>
            Moyenne sur la période
          </small>
        </article>

      </section>


      <section className="table-card">

        <div className="business-list-header">
          <div>
            <h2>
              Suivi des avoirs
            </h2>

            <p>
              {loading
                ? "Chargement..."
                : `${filteredCreditNotes.length} avoir${
                    filteredCreditNotes.length >
                    1
                      ? "s"
                      : ""
                  } dans cette vue`}
            </p>
          </div>

          <input
            className="business-search-input"
            type="search"
            placeholder="Rechercher un avoir..."
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
            <span>Trier par</span>

            <select
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target.value as CreditNoteSort
                )
              }
            >
              <option value="date_desc">
                Plus récents
              </option>

              <option value="date_asc">
                Plus anciens
              </option>

              <option value="amount_asc">
                Montant croissant
              </option>

              <option value="amount_desc">
                Montant décroissant
              </option>
            </select>
          </label>

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
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>


        {loading ? (
          <div className="smart-empty-state">
            Chargement des avoirs...
          </div>
        ) : filteredCreditNotes.length ===
          0 ? (
          <div className="smart-empty-state">
            <strong>
              Aucun avoir dans cette période.
            </strong>

            <span>
              Les avoirs créés depuis les
              factures apparaîtront ici.
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table credit-notes-table df-premium-table">
              <thead>
                <tr>
                  <th>Avoir</th>
                  <th>Date</th>
                  <th>Facture</th>
                  <th>Client</th>
                  <th>Motif</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedCreditNotes.map(
                  ({
                    creditNote,
                    invoice,
                  }) => (
                    <tr
                      key={creditNote.id}
                      className="business-row row-warning"
                    >
                      <td>
                        <strong>
                          {
                            creditNote
                              .credit_note_number
                          }
                        </strong>
                      </td>

                      <td>
                        {formatDate(
                          creditNote.issue_date
                        )}
                      </td>

                      <td>
                        {
                          invoice.invoice_number
                        }
                      </td>

                      <td>
                        {
                          getCreditNoteClientLabel(
                            getClientName(
                              invoice
                            )
                          )
                        }
                      </td>

                      <td>
                        {creditNote.reason}
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(
                            creditNote.amount
                          )}
                        </strong>
                      </td>

                      <td>
                        <span className="status-badge status-issued">
                          Émis
                        </span>
                      </td>

                      <td>
                        <div className="business-row-actions">
                          <button
                            type="button"
                            className="business-button business-button-secondary business-button-sm"
                            onClick={() =>
                              navigate(
                                `/invoices?invoice=${invoice.id}`
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
          filteredCreditNotes.length >
            0 && (
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
