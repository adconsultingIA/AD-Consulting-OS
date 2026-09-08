import RowActionsMenu from "../components/RowActionsMenu";
import DocumentEmailTrace from "../components/DocumentEmailTrace";
import InvoiceActivityPopup from "../components/InvoiceActivityPopup";

import {
  getDocumentEmailCounts,
  type DocumentEmailCountMap,
} from "../services/documentEmailsService";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  deletePurchaseOrder,
  getPurchaseOrders,
  openPurchaseOrderPdf,
  sendPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "../services/purchaseOrdersService";

import {
  getOperationalDocuments,
  type OperationalDocument,
} from "../services/operationalDocumentsService";

import {
  createInvoiceFromQuote,
  getInvoices,
  type InvoiceType,
} from "../services/invoicesService";

import type {
  Invoice,
} from "../types";


function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
  }).format(Number(value || 0));
}


function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-CH"
  ).format(
    new Date(`${value}T00:00:00`)
  );
}


function getPurchaseOrderStatusLabel(
  status: PurchaseOrderStatus
) {
  const labels: Record<
    PurchaseOrderStatus,
    string
  > = {
    draft: "Brouillon",
    issued: "Émis",
    sent: "Envoyé",
    cancelled: "Annulé",
  };

  return labels[status];
}


function getPurchaseOrderStatusClass(
  status: PurchaseOrderStatus
) {
  const classes: Record<
    PurchaseOrderStatus,
    string
  > = {
    draft: "status-draft",
    issued: "status-issued",
    sent: "status-sent",
    cancelled: "status-cancelled",
  };

  return classes[status];
}


function getBusinessClass(
  status: PurchaseOrderStatus
) {
  switch (status) {
    case "issued":
      return "purchase-order-row-info";

    case "sent":
      return "purchase-order-row-cyan";

    case "cancelled":
      return "purchase-order-row-muted";

    default:
      return "purchase-order-row-neutral";
  }
}


type PurchaseOrderPeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


type PurchaseOrderSort =
  | "date_desc"
  | "date_asc"
  | "amount_asc"
  | "amount_desc";


function getPurchaseOrderReferenceDate(
  purchaseOrder: PurchaseOrder
) {
  if (purchaseOrder.order_date) {
    return new Date(
      `${purchaseOrder.order_date}T00:00:00`
    );
  }

  return new Date(
    purchaseOrder.created_at
  );
}


function isPurchaseOrderInPeriod(
  purchaseOrder: PurchaseOrder,
  period: PurchaseOrderPeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date =
    getPurchaseOrderReferenceDate(
      purchaseOrder
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


function formatPurchaseOrderMonthLabel(
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


export default function PurchaseOrdersPage() {
  const navigate = useNavigate();

  const [
    purchaseOrders,
    setPurchaseOrders,
  ] = useState<PurchaseOrder[]>([]);

  const [
    invoices,
    setInvoices,
  ] = useState<Invoice[]>([]);

  const [
    operationalDocuments,
    setOperationalDocuments,
  ] = useState<OperationalDocument[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    billingPurchaseOrder,
    setBillingPurchaseOrder,
  ] = useState<PurchaseOrder | null>(null);

  const [
    billingInvoiceType,
    setBillingInvoiceType,
  ] = useState<InvoiceType>("standard");

  const [
    billingPercentage,
    setBillingPercentage,
  ] = useState("30");

  const [
    creatingInvoice,
    setCreatingInvoice,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    periodFilter,
    setPeriodFilter,
  ] = useState<PurchaseOrderPeriodFilter>(
    "current"
  );

  const [
    sort,
    setSort,
  ] = useState<PurchaseOrderSort>(
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

  const [
    editing,
    setEditing,
  ] = useState<PurchaseOrder | null>(
    null
  );

  const [
    editOrderDate,
    setEditOrderDate,
  ] = useState("");

  const [
    editAddress,
    setEditAddress,
  ] = useState("");

  const [
    editNotes,
    setEditNotes,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    sendingPurchaseOrderId,
    setSendingPurchaseOrderId,
  ] = useState<string | null>(null);

  const [
    emailCounts,
    setEmailCounts,
  ] = useState<DocumentEmailCountMap>({});

  const [
    emailPopupPurchaseOrder,
    setEmailPopupPurchaseOrder,
  ] = useState<PurchaseOrder | null>(null);


  async function loadPurchaseOrders() {
    try {
      setLoading(true);
      setError("");

      const [
        purchaseOrdersData,
        invoicesData,
        operationalDocumentsData,
        emailCountsData,
      ] = await Promise.all([
        getPurchaseOrders(),
        getInvoices(),
        getOperationalDocuments(),
        getDocumentEmailCounts(
          "purchase_order"
        ),
      ]);

      setPurchaseOrders(
        purchaseOrdersData
      );

      setInvoices(
        invoicesData
      );

      setOperationalDocuments(
        operationalDocumentsData
      );

      setEmailCounts(
        emailCountsData
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors du chargement."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadPurchaseOrders();
  }, []);


  const metrics = useMemo(() => {
    const total = purchaseOrders.length;

    const drafts =
      purchaseOrders.filter(
        (purchaseOrder) =>
          purchaseOrder.status ===
          "draft"
      ).length;

    const active =
      purchaseOrders.filter(
        (purchaseOrder) =>
          [
            "issued",
            "sent",
          ].includes(
            purchaseOrder.status
          )
      ).length;

    const totalAmount =
      purchaseOrders
        .filter(
          (purchaseOrder) =>
            purchaseOrder.status !==
            "cancelled"
        )
        .reduce(
          (sum, purchaseOrder) =>
            sum +
            Number(
              purchaseOrder.total || 0
            ),
          0
        );

    return {
      total,
      drafts,
      active,
      totalAmount,
    };
  }, [purchaseOrders]);


  const filteredPurchaseOrders =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return purchaseOrders.filter(
        (purchaseOrder) => {
          if (
            !isPurchaseOrderInPeriod(
              purchaseOrder,
              periodFilter
            )
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const haystack = [
            purchaseOrder
              .purchase_order_number,
            purchaseOrder.quote_number ??
              purchaseOrder.quote_id,
            purchaseOrder.status,
            getPurchaseOrderStatusLabel(
              purchaseOrder.status
            ),
            purchaseOrder
              .intervention_address ?? "",
            purchaseOrder.notes ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            query
          );
        }
      );
    }, [
      purchaseOrders,
      search,
      periodFilter,
    ]);


  const sortedPurchaseOrders =
    useMemo(() => {
      const result = [
        ...filteredPurchaseOrders,
      ];

      result.sort((a, b) => {
        if (sort === "amount_asc") {
          return (
            Number(a.total || 0) -
            Number(b.total || 0)
          );
        }

        if (sort === "amount_desc") {
          return (
            Number(b.total || 0) -
            Number(a.total || 0)
          );
        }

        const dateA =
          getPurchaseOrderReferenceDate(
            a
          ).getTime();

        const dateB =
          getPurchaseOrderReferenceDate(
            b
          ).getTime();

        if (sort === "date_asc") {
          return dateA - dateB;
        }

        return dateB - dateA;
      });

      return result;
    }, [
      filteredPurchaseOrders,
      sort,
    ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedPurchaseOrders.length /
          pageSize
      )
    );


  const paginatedPurchaseOrders =
    useMemo(() => {
      const safePage =
        Math.min(
          currentPage,
          totalPages
        );

      const start =
        (safePage - 1) *
        pageSize;

      return sortedPurchaseOrders.slice(
        start,
        start + pageSize
      );
    }, [
      sortedPurchaseOrders,
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



  function getInvoicesForPurchaseOrder(
    purchaseOrder: PurchaseOrder
  ) {
    return invoices
      .filter(
        (invoice) =>
          invoice.quote_id ===
            purchaseOrder.quote_id &&
          invoice.status !== "cancelled"
      )
      .sort(
        (a, b) =>
          (a.billing_sequence ?? 0) -
          (b.billing_sequence ?? 0)
      );
  }


  function getBilledTotalForPurchaseOrder(
    purchaseOrder: PurchaseOrder
  ) {
    return getInvoicesForPurchaseOrder(
      purchaseOrder
    ).reduce(
      (total, invoice) =>
        total + Number(invoice.total || 0),
      0
    );
  }


  function getRemainingToBill(
    purchaseOrder: PurchaseOrder
  ) {
    return Math.max(
      0,
      Number(purchaseOrder.total || 0) -
        getBilledTotalForPurchaseOrder(
          purchaseOrder
        )
    );
  }


  function getBillingProgress(
    purchaseOrder: PurchaseOrder
  ) {
    const total =
      Number(purchaseOrder.total || 0);

    if (total <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (
          getBilledTotalForPurchaseOrder(
            purchaseOrder
          ) /
          total
        ) * 100
      )
    );
  }


  function openBillingPopup(
    purchaseOrder: PurchaseOrder
  ) {
    const linkedInvoices =
      getInvoicesForPurchaseOrder(
        purchaseOrder
      );

    const remaining =
      getRemainingToBill(
        purchaseOrder
      );

    if (remaining <= 0) {
      const latestInvoice =
        linkedInvoices[
          linkedInvoices.length - 1
        ];

      if (latestInvoice) {
        navigate(
          `/invoices?invoice=${latestInvoice.id}`
        );
      }

      return;
    }

    setBillingPurchaseOrder(
      purchaseOrder
    );

    setBillingInvoiceType(
      linkedInvoices.length === 0
        ? "standard"
        : "deposit"
    );

    setBillingPercentage("30");
  }


  async function handleCreateInvoice() {
    if (!billingPurchaseOrder) {
      return;
    }

    const percentage =
      Number(billingPercentage);

    if (
      billingInvoiceType === "deposit" &&
      (
        !Number.isFinite(percentage) ||
        percentage <= 0 ||
        percentage > 100
      )
    ) {
      setError(
        "Le pourcentage d'acompte doit être compris entre 0 et 100 %."
      );
      return;
    }

    try {
      setCreatingInvoice(true);
      setError("");

      const payload =
        billingInvoiceType === "deposit"
          ? {
              invoice_type:
                billingInvoiceType,
              billing_percentage:
                percentage,
            }
          : {
              invoice_type:
                billingInvoiceType,
            };

      const invoice =
        await createInvoiceFromQuote(
          billingPurchaseOrder.quote_id,
          payload
        );

      setInvoices((current) => [
        ...current,
        invoice,
      ]);

      setBillingPurchaseOrder(null);

      navigate(
        `/invoices?invoice=${invoice.id}`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer la facture."
      );
    } finally {
      setCreatingInvoice(false);
    }
  }


  function openEdit(
    purchaseOrder: PurchaseOrder
  ) {
    setEditing(purchaseOrder);

    setEditOrderDate(
      purchaseOrder.order_date ?? ""
    );

    setEditAddress(
      purchaseOrder
        .intervention_address ?? ""
    );

    setEditNotes(
      purchaseOrder.notes ?? ""
    );
  }


  function closeEdit() {
    if (saving) {
      return;
    }

    setEditing(null);
    setEditOrderDate("");
    setEditAddress("");
    setEditNotes("");
  }


  async function saveEdit() {
    if (!editing) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const updated =
        await updatePurchaseOrder(
          editing.id,
          {
            order_date:
              editOrderDate || null,
            intervention_address:
              editAddress.trim() ||
              null,
            notes:
              editNotes.trim() || null,
          }
        );

      setPurchaseOrders(
        (current) =>
          current.map(
            (purchaseOrder) =>
              purchaseOrder.id ===
              updated.id
                ? updated
                : purchaseOrder
          )
      );

      closeEdit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier le bon de commande."
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleDeletePurchaseOrder(
    purchaseOrder: PurchaseOrder
  ) {
    if (purchaseOrder.status !== "draft") {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement ${purchaseOrder.purchase_order_number} ?\n\n` +
      "Cette action est possible uniquement car le bon de commande est encore en brouillon."
    );

    if (!confirmed) {
      return;
    }

    try {
      await deletePurchaseOrder(
        purchaseOrder.id
      );

      setPurchaseOrders((current) =>
        current.filter(
          (item) =>
            item.id !== purchaseOrder.id
        )
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer le bon de commande."
      );
    }
  }


  async function handleSendPurchaseOrder(
    purchaseOrder: PurchaseOrder
  ) {
    const confirmed = window.confirm(
      `Envoyer ${purchaseOrder.purchase_order_number} au client ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSendingPurchaseOrderId(
        purchaseOrder.id
      );

      const updated =
        await sendPurchaseOrder(
          purchaseOrder.id
        );

      setPurchaseOrders(
        (current) =>
          current.map((item) =>
            item.id === updated.id
              ? updated
              : item
          )
      );

      window.alert(
        `${purchaseOrder.purchase_order_number} envoyé avec succès.`
      );
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'envoi."
      );
    } finally {
      setSendingPurchaseOrderId(null);
    }
  }


  async function changeStatus(
    purchaseOrder: PurchaseOrder,
    status: PurchaseOrderStatus
  ) {
    try {
      setError("");

      const updated =
        await updatePurchaseOrderStatus(
          purchaseOrder.id,
          status
        );

      setPurchaseOrders(
        (current) =>
          current.map(
            (item) =>
              item.id === updated.id
                ? updated
                : item
          )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier le statut."
      );
    }
  }


  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">
            COMMANDES
          </span>

          <h1>
            Bons de commande
          </h1>

          <p>
            Préparez et suivez les bons de
            commande issus de vos devis
            acceptés.
          </p>
        </div>
      </div>


      {error && (
        <div className="form-error">
          {error}
        </div>
      )}


      <section className="df-premium-kpi-grid">
        <article className="df-premium-kpi-card" data-tone="primary">
          <span>
            Total
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.total}
          </strong>

          <small>
            Bons de commande
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="neutral">
          <span>
            Brouillons
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.drafts}
          </strong>

          <small>
            À préparer
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="cyan">
          <span>
            Émis / envoyés
          </span>

          <strong>
            {loading
              ? "—"
              : metrics.active}
          </strong>

          <small>
            Commandes actives
          </small>
        </article>


        <article className="df-premium-kpi-card" data-tone="success">
          <span>
            Montant commandé
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.totalAmount
                )}
          </strong>

          <small>
            Hors annulations
          </small>
        </article>
      </section>


      <section className="business-card proforma-list-card purchase-order-list-card">
        <div className="business-list-header">
          <div>
            <h2>
              Suivi des bons de commande
            </h2>

            <p>
              {loading
                ? "Chargement..."
                : `${filteredPurchaseOrders.length} bon${
                    filteredPurchaseOrders.length >
                    1
                      ? "s"
                      : ""
                  } dans cette vue`}
            </p>
          </div>

          <input
            className="business-search-input"
            type="search"
            placeholder="Rechercher un bon..."
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
              {formatPurchaseOrderMonthLabel()}
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
              {formatPurchaseOrderMonthLabel(
                -1
              )}
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
                  event.target.value as PurchaseOrderSort
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


        <div className="table-scroll">
          <table className="business-table purchase-orders-table df-premium-table">
            <thead>
              <tr>
                <th>
                  BON
                </th>

                <th>
                  DEVIS
                </th>

                <th>
                  DATE
                </th>

                <th>
                  EXÉCUTION
                </th>

                <th>
                  TOTAL
                </th>

                <th>
                  STATUT
                </th>

                <th>
                  ACTIONS
                </th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredPurchaseOrders.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="table-empty"
                    >
                      <div className="table-smart-empty">
                        <strong>
                          Aucun bon de commande dans cette période.
                        </strong>

                        <span>
                          Essayez une autre période ou affichez
                          tous les bons de commande.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}


              {paginatedPurchaseOrders.map(
                (purchaseOrder) => (
                  <tr
                    key={
                      purchaseOrder.id
                    }
                    className={`business-row ${getBusinessClass(
                      purchaseOrder.status
                    )}`}
                  >
                    <td>
                      <strong>
                        {
                          purchaseOrder.purchase_order_number
                        }
                      </strong>
                    </td>

                    <td>
                      <span className="table-reference">
                        {purchaseOrder.quote_number ??
                          purchaseOrder.quote_id}
                      </span>
                    </td>

                    <td>
                      {formatDate(
                        purchaseOrder.order_date
                      )}
                    </td>

                      <td>
                        {(() => {
                          const linkedExecution =
                            operationalDocuments.filter(
                              (document) =>
                                document.quote_id ===
                                  purchaseOrder.quote_id &&
                                document.status !==
                                  "cancelled"
                            );

                          const deliveryCount =
                            linkedExecution.filter(
                              (document) =>
                                document.document_type ===
                                "delivery_note"
                            ).length;

                          const interventionCount =
                            linkedExecution.filter(
                              (document) =>
                                document.document_type ===
                                "intervention_note"
                            ).length;

                          if (
                            deliveryCount === 0 &&
                            interventionCount === 0
                          ) {
                            return "—";
                          }

                          return (
                            <div className="df-execution-links">
                              {deliveryCount > 0 && (
                                <button
                                  type="button"
                                  className="purchase-order-created-badge business-linked-document"
                                  onClick={() =>
                                    navigate("/execution")
                                  }
                                  title={`${deliveryCount} bon${
                                    deliveryCount > 1
                                      ? "s"
                                      : ""
                                  } de livraison`}
                                >
                                  BL {deliveryCount}
                                </button>
                              )}

                              {interventionCount > 0 && (
                                <button
                                  type="button"
                                  className="purchase-order-created-badge business-linked-document"
                                  onClick={() =>
                                    navigate("/execution")
                                  }
                                  title={`${interventionCount} bon${
                                    interventionCount > 1
                                      ? "s"
                                      : ""
                                  } d'intervention`}
                                >
                                  BI {interventionCount}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                    <td>
                      <strong>
                        {formatCurrency(
                          purchaseOrder.total
                        )}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${getPurchaseOrderStatusClass(
                          purchaseOrder.status
                        )}`}
                      >
                        {getPurchaseOrderStatusLabel(
                          purchaseOrder.status
                        )}
                      </span>

                        <DocumentEmailTrace
                          documentType="purchase_order"
                          documentId={purchaseOrder.id}
                          documentStatus={purchaseOrder.status}
                        />
                    </td>

                    <td>
                      <div className="purchase-order-actions business-row-actions df-table-actions">

                        {purchaseOrder.status === "draft" && (
                          <>
                            <button
                              className="business-button business-button-primary business-button-sm business-primary-action"
                              onClick={() =>
                                changeStatus(
                                  purchaseOrder,
                                  "issued"
                                )
                              }
                            >
                              Émettre
                            </button>

                            <RowActionsMenu>
                              <button
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  openEdit(
                                    purchaseOrder
                                  )
                                }
                              >
                                Modifier
                              </button>

                              <button
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  openPurchaseOrderPdf(
                                    purchaseOrder.id
                                  )
                                }
                              >
                                PDF
                              </button>

                              <button
                                className="business-button business-button-danger business-button-sm"
                                onClick={() =>
                                  changeStatus(
                                    purchaseOrder,
                                    "cancelled"
                                  )
                                }
                              >
                                Annuler
                              </button>

                              <button
                                type="button"
                                className="business-button business-button-danger business-button-sm"
                                onClick={() =>
                                  handleDeletePurchaseOrder(
                                    purchaseOrder
                                  )
                                }
                              >
                                Supprimer
                              </button>
                            </RowActionsMenu>
                          </>
                        )}


                        {purchaseOrder.status === "issued" && (
                          <>
                            <button
                              className="business-button business-button-cyan business-button-sm business-primary-action"
                              disabled={
                                sendingPurchaseOrderId ===
                                purchaseOrder.id
                              }
                              onClick={() =>
                                handleSendPurchaseOrder(
                                  purchaseOrder
                                )
                              }
                            >
                              {sendingPurchaseOrderId ===
                              purchaseOrder.id
                                ? "Envoi..."
                                : "Envoyer"}
                            </button>

                            <RowActionsMenu>
                              <button
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  openPurchaseOrderPdf(
                                    purchaseOrder.id
                                  )
                                }
                              >
                                PDF
                              </button>

                              <button
                                className="business-button business-button-danger business-button-sm"
                                onClick={() =>
                                  changeStatus(
                                    purchaseOrder,
                                    "cancelled"
                                  )
                                }
                              >
                                Annuler
                              </button>
                            </RowActionsMenu>
                          </>
                        )}


                        {purchaseOrder.status === "sent" && (
                          <>
                            {(() => {
                              const linkedInvoices =
                                getInvoicesForPurchaseOrder(
                                  purchaseOrder
                                );

                              const progress =
                                getBillingProgress(
                                  purchaseOrder
                                );

                              const remaining =
                                getRemainingToBill(
                                  purchaseOrder
                                );

                              return (
                                <button
                                  type="button"
                                  className={
                                    linkedInvoices.length > 0
                                      ? "invoice-created-badge invoice-created-button business-linked-document"
                                      : "business-button business-button-primary business-button-sm business-primary-action"
                                  }
                                  onClick={() =>
                                    openBillingPopup(
                                      purchaseOrder
                                    )
                                  }
                                  title={
                                    remaining <= 0
                                      ? `Facturation terminée · ${linkedInvoices.length} facture${
                                          linkedInvoices.length > 1
                                            ? "s"
                                            : ""
                                        }`
                                      : linkedInvoices.length > 0
                                        ? `${formatCurrency(
                                            remaining
                                          )} reste à facturer`
                                        : "Créer une facture"
                                  }
                                >
                                  {remaining <= 0
                                    ? `${linkedInvoices.length} facture${
                                        linkedInvoices.length > 1
                                          ? "s"
                                          : ""
                                      }`
                                    : linkedInvoices.length > 0
                                      ? `Facturation ${progress} %`
                                      : "Créer facture"}
                                </button>
                              );
                            })()}

                            <RowActionsMenu>
                              <button
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  openPurchaseOrderPdf(
                                    purchaseOrder.id
                                  )
                                }
                              >
                                PDF
                              </button>

                              {(emailCounts[
                                purchaseOrder.id
                              ] ?? 0) > 0 && (
                                <button
                                  type="button"
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    setEmailPopupPurchaseOrder(
                                      purchaseOrder
                                    )
                                  }
                                >
                                  Envoi {
                                    emailCounts[
                                      purchaseOrder.id
                                    ] ?? 0
                                  }
                                </button>
                              )}

                              <button
                                className="business-button business-button-danger business-button-sm"
                                onClick={() =>
                                  changeStatus(
                                    purchaseOrder,
                                    "cancelled"
                                  )
                                }
                              >
                                Annuler
                              </button>
                            </RowActionsMenu>
                          </>
                        )}


                        {purchaseOrder.status === "cancelled" && (
                          <button
                            className="business-button business-button-secondary business-button-sm"
                            onClick={() =>
                              openPurchaseOrderPdf(
                                purchaseOrder.id
                              )
                            }
                          >
                            PDF
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>


        {!loading &&
          filteredPurchaseOrders.length >
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


      {billingPurchaseOrder && (() => {
        const linkedInvoices =
          getInvoicesForPurchaseOrder(
            billingPurchaseOrder
          );

        const billedTotal =
          getBilledTotalForPurchaseOrder(
            billingPurchaseOrder
          );

        const remaining =
          getRemainingToBill(
            billingPurchaseOrder
          );

        const hasBillingStarted =
          linkedInvoices.length > 0;

        return (
          <div
            className="billing-modal-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setBillingPurchaseOrder(
                  null
                );
              }
            }}
          >
            <form
              className="billing-modal"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateInvoice();
              }}
            >
              <div className="billing-modal-header">
                <div>
                  <span className="billing-modal-eyebrow">
                    Facturation
                  </span>

                  <h2>
                    Créer une facture
                  </h2>

                  <p>
                    {
                      billingPurchaseOrder
                        .purchase_order_number
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="business-button business-button-secondary business-button-sm"
                  disabled={creatingInvoice}
                  onClick={() =>
                    setBillingPurchaseOrder(
                      null
                    )
                  }
                >
                  Fermer
                </button>
              </div>

              <div className="billing-summary">
                <div>
                  <span>
                    Total bon de commande
                  </span>

                  <strong>
                    {formatCurrency(
                      billingPurchaseOrder.total
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Déjà facturé
                  </span>

                  <strong>
                    {formatCurrency(
                      billedTotal
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Reste à facturer
                  </span>

                  <strong>
                    {formatCurrency(
                      remaining
                    )}
                  </strong>
                </div>
              </div>

              <div className="billing-modal-field">
                <label htmlFor="purchase-order-billing-type">
                  Type de facture
                </label>

                <select
                  id="purchase-order-billing-type"
                  value={billingInvoiceType}
                  disabled={creatingInvoice}
                  onChange={(event) =>
                    setBillingInvoiceType(
                      event.target
                        .value as InvoiceType
                    )
                  }
                >
                  {!hasBillingStarted && (
                    <option value="standard">
                      Facture standard
                    </option>
                  )}

                  <option value="deposit">
                    Facture d'acompte
                  </option>

                  {hasBillingStarted && (
                    <option value="balance">
                      Facture de solde
                    </option>
                  )}
                </select>
              </div>

              {billingInvoiceType ===
                "deposit" && (
                <div className="billing-modal-field">
                  <label htmlFor="purchase-order-billing-percentage">
                    Pourcentage d'acompte
                  </label>

                  <div className="billing-percentage-input">
                    <input
                      id="purchase-order-billing-percentage"
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      required
                      value={
                        billingPercentage
                      }
                      disabled={
                        creatingInvoice
                      }
                      onChange={(event) =>
                        setBillingPercentage(
                          event.target.value
                        )
                      }
                    />

                    <span>%</span>
                  </div>

                  <small>
                    Montant estimé :{" "}
                    {formatCurrency(
                      Number(
                        billingPurchaseOrder.total
                      ) *
                        (
                          Number(
                            billingPercentage ||
                              0
                          ) /
                          100
                        )
                    )}
                  </small>
                </div>
              )}

              {billingInvoiceType ===
                "balance" && (
                <div className="billing-balance-note">
                  Le solde sera calculé
                  automatiquement sur le montant
                  restant à facturer.
                </div>
              )}

              <div className="billing-modal-actions">
                <button
                  type="button"
                  className="business-button business-button-secondary"
                  disabled={creatingInvoice}
                  onClick={() =>
                    setBillingPurchaseOrder(
                      null
                    )
                  }
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="business-button business-button-primary"
                  disabled={creatingInvoice}
                >
                  {creatingInvoice
                    ? "Création..."
                    : billingInvoiceType ===
                        "deposit"
                      ? "Créer l'acompte"
                      : billingInvoiceType ===
                          "balance"
                        ? "Créer le solde"
                        : "Créer la facture"}
                </button>
              </div>
            </form>
          </div>
        );
      })()}


      {emailPopupPurchaseOrder && (
        <InvoiceActivityPopup
          invoiceId={
            emailPopupPurchaseOrder.id
          }
          invoiceNumber={
            emailPopupPurchaseOrder
              .purchase_order_number
          }
          type="email"
          documentType="purchase_order"
          contextLabel="Activité bon de commande"
          onClose={() =>
            setEmailPopupPurchaseOrder(null)
          }
        />
      )}


      {editing && (
        <div className="modal-overlay">
          <div className="modal-card purchase-order-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  BON DE COMMANDE
                </span>

                <h2>
                  {
                    editing.purchase_order_number
                  }
                </h2>
              </div>

              <button
                className="business-button business-button-secondary business-button-icon business-button-square"
                onClick={closeEdit}
                disabled={saving}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>


            <div className="form-grid">
              <label>
                <span>
                  Date
                </span>

                <input
                  type="date"
                  value={editOrderDate}
                  onChange={(event) =>
                    setEditOrderDate(
                      event.target.value
                    )
                  }
                />
              </label>


              <label className="form-field-full">
                <span>
                  Adresse d'intervention / livraison
                </span>

                <textarea
                  rows={3}
                  value={editAddress}
                  onChange={(event) =>
                    setEditAddress(
                      event.target.value
                    )
                  }
                  placeholder="Adresse d'intervention ou de livraison"
                />
              </label>


              <label className="form-field-full">
                <span>
                  Instructions / notes
                </span>

                <textarea
                  rows={4}
                  value={editNotes}
                  onChange={(event) =>
                    setEditNotes(
                      event.target.value
                    )
                  }
                  placeholder="Instructions particulières..."
                />
              </label>
            </div>


            <div className="modal-actions">
              <button
                className="business-button business-button-secondary"
                onClick={closeEdit}
                disabled={saving}
              >
                Annuler
              </button>

              <button
                className="business-button business-button-primary"
                onClick={saveEdit}
                disabled={saving}
              >
                {saving
                  ? "Enregistrement..."
                  : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
