import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import RowActionsMenu from "../components/RowActionsMenu";

import {
  getClients,
  getQuotes,
  getRequests,
} from "../services/api";

import {
  getInvoices,
} from "../services/invoicesService";

import {
  getInvoicePayments,
  type Payment,
} from "../services/paymentsService";

import {
  getReceipts,
  openReceiptPdf,
  sendReceipt,
  type Receipt,
} from "../services/receiptsService";

import type {
  Client,
  Invoice,
  Quote,
  Request,
} from "../types";


type PaymentPeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


type PaymentSort =
  | "date_desc"
  | "date_asc"
  | "amount_asc"
  | "amount_desc";


interface PaymentRow {
  payment: Payment;
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


function getPaymentMethodLabel(
  method?: string | null
) {
  const labels: Record<
    string,
    string
  > = {
    bank_transfer: "Virement",
    card: "Carte",
    cash: "Espèces",
    check: "Chèque",
    other: "Autre",
  };

  if (!method) {
    return "Non renseigné";
  }

  return labels[method] ?? method;
}


function isPaymentInPeriod(
  payment: Payment,
  period: PaymentPeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date =
    new Date(
      `${payment.payment_date}T00:00:00`
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


function getPaymentClientLabel(
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


export default function PaymentsPage() {
  const navigate = useNavigate();

  const [
    payments,
    setPayments,
  ] = useState<PaymentRow[]>([]);

  const [
    receipts,
    setReceipts,
  ] = useState<Receipt[]>([]);

  const [
    sendingReceiptId,
    setSendingReceiptId,
  ] = useState<string | null>(null);

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
  ] = useState<PaymentPeriodFilter>(
    "current"
  );

  const [
    sort,
    setSort,
  ] = useState<PaymentSort>(
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
        receiptsData,
      ] = await Promise.all([
        getInvoices(),
        getQuotes(),
        getRequests(),
        getClients(),
        getReceipts(),
      ]);

      const paymentsByInvoice =
        await Promise.all(
          invoicesData.map(
            async (invoice) => {
              const invoicePayments =
                await getInvoicePayments(
                  invoice.id
                );

              return invoicePayments.map(
                (payment) => ({
                  payment,
                  invoice,
                })
              );
            }
          )
        );

      setQuotes(quotesData);
      setRequests(requestsData);
      setClients(clientsData);
      setReceipts(receiptsData);

      setPayments(
        paymentsByInvoice.flat()
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les paiements."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadData();
  }, []);


  async function handleSendReceipt(
    receipt: Receipt
  ) {
    try {
      setError("");
      setSendingReceiptId(
        receipt.id
      );

      const updatedReceipt =
        await sendReceipt(
          receipt.id
        );

      setReceipts(
        (current) =>
          current.map((item) =>
            item.id ===
            updatedReceipt.id
              ? updatedReceipt
              : item
          )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer le reçu."
      );
    } finally {
      setSendingReceiptId(null);
    }
  }


  function getReceiptForPayment(
    paymentId: string
  ) {
    return receipts.find(
      (receipt) =>
        receipt.payment_id ===
        paymentId
    );
  }


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
        request.id === quote.request_id
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
    const periodPayments =
      payments.filter((row) =>
        isPaymentInPeriod(
          row.payment,
          periodFilter,
        ),
      );

    const totalCollected =
      periodPayments.reduce(
        (total, row) =>
          total +
          Number(
            row.payment.amount || 0,
          ),
        0,
      );

    const invoicesWithPayments =
      new Set(
        periodPayments.map(
          (row) =>
            row.invoice.id,
        ),
      ).size;

    const averagePayment =
      periodPayments.length > 0
        ? totalCollected /
          periodPayments.length
        : 0;

    return {
      totalCollected,
      invoicesWithPayments,
      averagePayment,
      paymentsCount:
        periodPayments.length,
    };
  }, [
    payments,
    periodFilter,
  ]);


  const filteredPayments =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return payments.filter(
        (row) => {
          if (
            !isPaymentInPeriod(
              row.payment,
              periodFilter
            )
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const haystack = [
            row.invoice.invoice_number,
            getClientName(
              row.invoice
            ),
            row.payment.reference ?? "",
            getPaymentMethodLabel(
              row.payment.payment_method
            ),
            row.payment.notes ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            query
          );
        }
      );
    }, [
      payments,
      search,
      periodFilter,
      quotes,
      requests,
      clients,
    ]);


  const sortedPayments =
    useMemo(() => {
      const result = [
        ...filteredPayments,
      ];

      result.sort((a, b) => {
        if (sort === "amount_asc") {
          return (
            Number(
              a.payment.amount || 0
            ) -
            Number(
              b.payment.amount || 0
            )
          );
        }

        if (sort === "amount_desc") {
          return (
            Number(
              b.payment.amount || 0
            ) -
            Number(
              a.payment.amount || 0
            )
          );
        }

        const dateA =
          new Date(
            `${a.payment.payment_date}T00:00:00`
          ).getTime();

        const dateB =
          new Date(
            `${b.payment.payment_date}T00:00:00`
          ).getTime();

        if (sort === "date_asc") {
          return dateA - dateB;
        }

        return dateB - dateA;
      });

      return result;
    }, [
      filteredPayments,
      sort,
    ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedPayments.length /
          pageSize
      )
    );


  const paginatedPayments =
    useMemo(() => {
      const safePage =
        Math.min(
          currentPage,
          totalPages
        );

      const start =
        (safePage - 1) *
        pageSize;

      return sortedPayments.slice(
        start,
        start + pageSize
      );
    }, [
      sortedPayments,
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
            Encaissements
          </span>

          <h1>Paiements</h1>

          <p>
            Suivez les encaissements,
            les factures réglées et
            l'historique des paiements.
          </p>
        </div>
      </div>


      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      <section className="invoice-kpi-grid df-premium-kpi-grid">

        <article className="df-premium-kpi-card" data-tone="success">
          <span>
            Total encaissé
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.totalCollected
                )}
          </strong>

          <small>
            Encaissements sur la période
          </small>
        </article>



          <article
            className="df-premium-kpi-card"
            data-tone="cyan"
          >
            <span>
              Nombre de paiements
            </span>

            <strong>
              {loading
                ? "—"
                : metrics.paymentsCount}
            </strong>

            <small>
              Paiements sur la période
            </small>
          </article>


        <article className="df-premium-kpi-card" data-tone="primary">
          <span>
            Factures encaissées
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.invoicesWithPayments}
          </strong>

          <small>
            Factures payées sur la période
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="neutral">
          <span>
            Paiement moyen
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.averagePayment
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
              Suivi des paiements
            </h2>

            <p>
              {loading
                ? "Chargement..."
                : `${filteredPayments.length} paiement${
                    filteredPayments.length >
                    1
                      ? "s"
                      : ""
                  } dans cette vue`}
            </p>
          </div>

          <input
            className="business-search-input"
            type="search"
            placeholder="Rechercher un paiement..."
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
              Tous
            </button>

          </div>


          <label className="list-page-size">
            <span>Trier par</span>

            <select
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target.value as PaymentSort
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
            Chargement des paiements...
          </div>
        ) : filteredPayments.length ===
          0 ? (
          <div className="smart-empty-state">
            <strong>
              Aucun paiement dans cette période.
            </strong>

            <span>
              Les encaissements enregistrés
              depuis les factures apparaîtront ici.
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table payments-table df-premium-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Facture</th>
                  <th>Client</th>
                  <th>Montant</th>
                  <th>Mode</th>
                  <th>Référence</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedPayments.map(
                  ({
                    payment,
                    invoice,
                  }) => (
                    <tr
                      key={payment.id}
                      className="business-row row-success"
                    >
                      <td>
                        {formatDate(
                          payment.payment_date
                        )}
                      </td>

                      <td>
                        <strong>
                          {
                            invoice.invoice_number
                          }
                        </strong>
                      </td>

                      <td>
                        {
                            getPaymentClientLabel(
                              getClientName(
                                invoice
                              )
                            )
                          }
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(
                            payment.amount
                          )}
                        </strong>
                      </td>

                      <td>
                        <span className="status-badge status-paid">
                          {getPaymentMethodLabel(
                            payment.payment_method
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                            className="df-cell-truncate"
                            title={
                              payment.reference ??
                              undefined
                            }
                          >
                            {payment.reference ?? "—"}
                          </span>
                      </td>

                      <td>
                        {(() => {
                          const receipt =
                            getReceiptForPayment(
                              payment.id
                            );

                          return (
                            <div className="business-row-actions">
                              {receipt && (
                                <button
                                  type="button"
                                  className="purchase-order-created-badge business-linked-document"
                                  onClick={() =>
                                    openReceiptPdf(
                                      receipt.id
                                    )
                                  }
                                  title={`Ouvrir ${receipt.receipt_number}`}
                                >
                                  REC 1
                                </button>
                              )}

                              <RowActionsMenu>
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

                                {receipt?.status ===
                                  "issued" && (
                                  <button
                                    type="button"
                                    className="business-button business-button-secondary business-button-sm"
                                    disabled={
                                      sendingReceiptId ===
                                      receipt.id
                                    }
                                    onClick={() =>
                                      void handleSendReceipt(
                                        receipt
                                      )
                                    }
                                  >
                                    {sendingReceiptId ===
                                    receipt.id
                                      ? "Envoi..."
                                      : "Envoyer le reçu"}
                                  </button>
                                )}

                                {receipt?.status ===
                                  "sent" && (
                                  <button
                                    type="button"
                                    className="business-button business-button-secondary business-button-sm"
                                    onClick={() =>
                                      openReceiptPdf(
                                        receipt.id
                                      )
                                    }
                                  >
                                    Reçu envoyé
                                  </button>
                                )}
                              </RowActionsMenu>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}


        {!loading &&
          filteredPayments.length > 0 && (
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
