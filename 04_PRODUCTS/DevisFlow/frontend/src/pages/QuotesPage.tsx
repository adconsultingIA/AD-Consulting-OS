import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import RowActionsMenu from "../components/RowActionsMenu";
import InvoiceActivityPopup from "../components/InvoiceActivityPopup";

import {
  getDocumentEmailCounts,
  type DocumentEmailCountMap,
} from "../services/documentEmailsService";
import DocumentEmailTrace from "../components/DocumentEmailTrace";
import { compactCompanyName } from "../utils/display";
import {
  acceptQuote,
  createQuote,
  deleteQuote,
  getClients,
  getQuotes,
  openQuotePdf,
  getRequests,
  sendQuote,
  updateQuote,
  updateQuoteStatus,
  type QuoteAcceptanceMethod,
} from "../services/api";

import {
  createInvoiceFromQuote,
  getInvoices,
  type InvoiceType,
} from "../services/invoicesService";

import {
  createPurchaseOrderFromQuote,
  getPurchaseOrders,
  openPurchaseOrderPdf,
  type PurchaseOrder,
} from "../services/purchaseOrdersService";

import {
  createProformaFromQuote,
  getProformas,
  type Proforma,
} from "../services/proformasService";

import {
  createOperationalDocumentFromQuote,
  getOperationalDocuments,
  type OperationalDocument,
  type OperationalDocumentType,
} from "../services/operationalDocumentsService";

import {
  createRecurringInvoiceFromQuote,
  getRecurringInvoices,
  type RecurringFrequency,
  type RecurringInvoice,
} from "../services/recurringInvoicesService";

import type {
  Client,
  Invoice,
  Quote,
  Request,
} from "../types";

import {
  getQuoteStatusClass,
  getQuoteStatusLabel,
} from "../utils/quoteStatus";


interface QuoteLineForm {
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
}


const emptyLine = (): QuoteLineForm => ({
  description: "",
  quantity: "1",
  unitPrice: "",
  vatRate: "20",
});


type QuotePeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


type QuoteSort =
  | "date_desc"
  | "date_asc"
  | "amount_asc"
  | "amount_desc";


function isQuoteInPeriod(
  quote: Quote,
  period: QuotePeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date =
    new Date(quote.created_at);

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


function formatQuoteMonthLabel(
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


export default function QuotesPage() {
  const navigate = useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const dashboardStatusFilter =
    searchParams.get("status");

  const requestFromUrl =
    searchParams.get("request");

  const createFromRequest =
    searchParams.get("create") === "1";

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrder[]>([]);

  const [proformas, setProformas] =
    useState<Proforma[]>([]);

  const [
    operationalDocuments,
    setOperationalDocuments,
  ] = useState<OperationalDocument[]>([]);

  const [
    recurringInvoices,
    setRecurringInvoices,
  ] = useState<RecurringInvoice[]>([]);

  const [
    recurringQuote,
    setRecurringQuote,
  ] = useState<Quote | null>(null);

  const [
    recurringServiceName,
    setRecurringServiceName,
  ] = useState("");

  const [
    recurringFrequency,
    setRecurringFrequency,
  ] = useState<RecurringFrequency>(
    "monthly"
  );

  const [
    recurringStartDate,
    setRecurringStartDate,
  ] = useState("");

  const [
    recurringNextDate,
    setRecurringNextDate,
  ] = useState("");

  const [
    creatingRecurring,
    setCreatingRecurring,
  ] = useState(false);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [editingQuoteId, setEditingQuoteId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [
    sendingQuoteId,
    setSendingQuoteId,
  ] = useState<string | null>(null);

  const [
    emailCounts,
    setEmailCounts,
  ] = useState<DocumentEmailCountMap>({});

  const [
    emailPopupQuote,
    setEmailPopupQuote,
  ] = useState<Quote | null>(null);

  const [
    acceptanceQuote,
    setAcceptanceQuote,
  ] = useState<Quote | null>(null);

  const [
    acceptanceChecked,
    setAcceptanceChecked,
  ] = useState(false);

  const [
    acceptanceMethod,
    setAcceptanceMethod,
  ] = useState<QuoteAcceptanceMethod>(
    "email"
  );

  const [
    acceptanceDate,
    setAcceptanceDate,
  ] = useState("");

  const [
    acceptanceReference,
    setAcceptanceReference,
  ] = useState("");

  const [
    acceptanceNote,
    setAcceptanceNote,
  ] = useState("");

  const [
    acceptanceFile,
    setAcceptanceFile,
  ] = useState<File | null>(null);


  const [
    confirmingAcceptance,
    setConfirmingAcceptance,
  ] = useState(false);


  const [
    billingQuote,
    setBillingQuote,
  ] = useState<Quote | null>(null);

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
    periodFilter,
    setPeriodFilter,
  ] = useState<QuotePeriodFilter>(
    dashboardStatusFilter || requestFromUrl
      ? "all"
      : "current"
  );

  const [
    sort,
    setSort,
  ] = useState<QuoteSort>(
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

  const [requestId, setRequestId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<QuoteLineForm[]>([
    emptyLine(),
  ]);


  // -------------------------------------------------------------------
  // LOAD DATA
  // -------------------------------------------------------------------

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        quotesData,
        requestsData,
        clientsData,
        invoicesData,
        purchaseOrdersData,
        proformasData,
        operationalDocumentsData,
        emailCountsData,
      ] = await Promise.all([
        getQuotes(),
        getRequests(),
        getClients(),
        getInvoices(),
        getPurchaseOrders(),
        getProformas(),
        getOperationalDocuments(),
        getDocumentEmailCounts("quote"),
      ]);

      setQuotes(quotesData);
      setRequests(requestsData);
      setClients(clientsData);
      setInvoices(invoicesData);
      setPurchaseOrders(
        purchaseOrdersData
      );

      setProformas(
        proformasData
      );

      setOperationalDocuments(
        operationalDocumentsData
      );

      setEmailCounts(
        emailCountsData
      );

      if (requestsData.length > 0) {
        setRequestId((current) =>
          current || requestsData[0].id
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de charger les données des devis."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (
      !createFromRequest ||
      !requestFromUrl ||
      requests.length === 0
    ) {
      return;
    }

    const requestExists =
      requests.some(
        (request) =>
          request.id === requestFromUrl
      );

    if (!requestExists) {
      return;
    }

    setEditingQuoteId(null);
    setValidUntil("");
    setNotes("");
    setLines([emptyLine()]);
    setRequestId(requestFromUrl);
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [
    createFromRequest,
    requestFromUrl,
    requests,
  ]);


  // -------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------

  function getRequest(quote: Quote) {
    return requests.find(
      (request) => request.id === quote.request_id
    );
  }


  function getClientNameByRequest(request: Request) {
    return (
      compactCompanyName(
        clients.find(
          (client) => client.id === request.client_id
        )?.company_name
      )
    );
  }


  function getClientName(quote: Quote) {
    const request = getRequest(quote);

    if (!request) {
      return "Client inconnu";
    }

    return getClientNameByRequest(request);
  }


  function truncateLabel(
    value: string,
    maxLength = 16
  ) {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value
      .slice(0, maxLength)
      .trimEnd()}…`;
  }


  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat("fr-CH", {
      style: "currency",
      currency: "CHF",
    }).format(Number(value));
  }


  function formatDate(value?: string | null) {
    if (!value) {
      return "—";
    }

    return new Date(value).toLocaleDateString("fr-FR");
  }


  async function openPdf(
    quoteId: string
  ) {
    try {
      await openQuotePdf(
        quoteId
      );
    } catch (err) {
      console.error(err);

      window.alert(
        err instanceof Error
          ? err.message
          : "Impossible d'ouvrir le PDF du devis."
      );
    }
  }


  function getInvoicesForQuote(
    quoteId: string
  ) {
    return invoices
      .filter(
        (invoice) =>
          invoice.quote_id === quoteId &&
          invoice.status !== "cancelled"
      )
      .sort(
        (a, b) =>
          (a.billing_sequence ?? 0) -
          (b.billing_sequence ?? 0)
      );
  }


  function getBilledTotalForQuote(
    quoteId: string
  ) {
    return getInvoicesForQuote(
      quoteId
    ).reduce(
      (total, invoice) =>
        total + Number(invoice.total || 0),
      0
    );
  }


  function getRemainingToBill(
    quote: Quote
  ) {
    return Math.max(
      0,
      Number(quote.total || 0) -
        getBilledTotalForQuote(quote.id)
    );
  }


  function getBillingProgress(
    quote: Quote
  ) {
    const quoteTotal =
      Number(quote.total || 0);

    if (quoteTotal <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (
          getBilledTotalForQuote(
            quote.id
          ) /
          quoteTotal
        ) * 100
      )
    );
  }


  function openBillingPopup(
    quote: Quote
  ) {
    if (!hasValidAcceptance(quote)) {
      setError(
        "Validation d'acceptation requise avant création d'une facture."
      );
      return;
    }

    const linkedInvoices =
      getInvoicesForQuote(
        quote.id
      );

    const remaining =
      getRemainingToBill(
        quote
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

    setBillingQuote(quote);

    setBillingInvoiceType(
      linkedInvoices.length === 0
        ? "standard"
        : "deposit"
    );

    setBillingPercentage("30");
  }


  function getQuoteBusinessClass(status: string) {
    const classes: Record<string, string> = {
      draft: "business-neutral",
      ready: "business-info",
      sent: "business-cyan",
      accepted: "business-success",
      rejected: "business-danger",
      expired: "business-danger",
      cancelled: "business-muted",
    };

    return classes[status] ?? "business-neutral";
  }


  function isQuoteDueSoon(quote: Quote) {
    if (
      !quote.valid_until ||
      !["ready", "sent"].includes(quote.status)
    ) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validity = new Date(quote.valid_until);
    validity.setHours(0, 0, 0, 0);

    const diffDays =
      (validity.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24);

    return diffDays >= 0 && diffDays <= 7;
  }


  function hasValidAcceptance(
    quote: Quote
  ) {
    return Boolean(
      quote.status === "accepted" &&
      quote.acceptance_checked &&
      quote.acceptance_method &&
      quote.accepted_at &&
      quote.accepted_by_user_id &&
      (
        quote.acceptance_reference ||
        quote.acceptance_note ||
        quote.acceptance_document_path
      )
    );
  }


  function isQuotePastValidity(quote: Quote) {
    if (
      !quote.valid_until ||
      !["ready", "sent"].includes(quote.status)
    ) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validity = new Date(quote.valid_until);
    validity.setHours(0, 0, 0, 0);

    return validity < today;
  }


  // -------------------------------------------------------------------
  // CREATE INVOICE FROM QUOTE
  // -------------------------------------------------------------------

  async function handleCreateInvoice() {
    if (!billingQuote) {
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
          billingQuote.id,
          payload
        );

      setInvoices((current) => [
        invoice,
        ...current,
      ]);

      setBillingQuote(null);

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


  // -------------------------------------------------------------------
  // CREATE PROFORMA FROM QUOTE
  // -------------------------------------------------------------------

  async function handleCreateProforma(
    quoteId: string
  ) {
    const quote = quotes.find(
      (item) => item.id === quoteId
    );

    if (
      !quote ||
      !hasValidAcceptance(quote)
    ) {
      setError(
        "Validation d'acceptation requise avant création de la proforma."
      );
      return;
    }

    try {
      setError("");

      const proforma =
        await createProformaFromQuote(
          quoteId
        );

      setProformas((current) => [
        proforma,
        ...current,
      ]);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer la proforma."
      );
    }
  }


  // -------------------------------------------------------------------
  // RECURRING INVOICES
  // -------------------------------------------------------------------

  useEffect(() => {
    async function loadRecurringInvoices() {
      try {
        const rows =
          await getRecurringInvoices();

        setRecurringInvoices(rows);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les récurrences."
        );
      }
    }

    void loadRecurringInvoices();
  }, []);


  function openRecurringPopup(
    quote: Quote
  ) {
    if (!hasValidAcceptance(quote)) {
      setError(
        "Validation d'acceptation requise avant création d'une récurrence."
      );
      return;
    }

    const today =
      new Date()
        .toISOString()
        .substring(0, 10);

    setRecurringQuote(quote);

    setRecurringServiceName("");

    setRecurringFrequency(
      "monthly"
    );

    setRecurringStartDate(
      today
    );

    setRecurringNextDate(
      today
    );
  }


  function closeRecurringPopup() {
    if (creatingRecurring) {
      return;
    }

    setRecurringQuote(null);
    setRecurringServiceName("");
    setRecurringFrequency(
      "monthly"
    );
    setRecurringStartDate("");
    setRecurringNextDate("");
  }


  async function handleCreateRecurringInvoice(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!recurringQuote) {
      return;
    }

    const serviceName =
      recurringServiceName.trim();

    if (!serviceName) {
      setError(
        "Le service concerné est obligatoire."
      );
      return;
    }

    if (!recurringStartDate) {
      setError(
        "La date de début est obligatoire."
      );
      return;
    }

    try {
      setCreatingRecurring(true);
      setError("");

      const recurring =
        await createRecurringInvoiceFromQuote(
          recurringQuote.id,
          {
            service_name:
              serviceName,
            frequency:
              recurringFrequency,
            start_date:
              recurringStartDate,
            next_invoice_date:
              recurringNextDate ||
              recurringStartDate,
          }
        );

      setRecurringInvoices(
        (current) => [
          recurring,
          ...current,
        ]
      );

      setRecurringQuote(null);
      setRecurringServiceName("");
      setRecurringFrequency(
        "monthly"
      );
      setRecurringStartDate("");
      setRecurringNextDate("");

      navigate(
        "/recurrences"
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer la récurrence."
      );
    } finally {
      setCreatingRecurring(false);
    }
  }


  // -------------------------------------------------------------------
  // CREATE OPERATIONAL DOCUMENT FROM QUOTE
  // -------------------------------------------------------------------

  async function handleCreateOperationalDocument(
    quoteId: string,
    documentType: OperationalDocumentType
  ) {
    try {
      setError("");

      const document =
        await createOperationalDocumentFromQuote(
          quoteId,
          documentType
        );

      setOperationalDocuments(
        (current) => [
          document,
          ...current,
        ]
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le document d'exécution."
      );
    }
  }


  // -------------------------------------------------------------------
  // CREATE PURCHASE ORDER FROM QUOTE
  // -------------------------------------------------------------------

  async function handleCreatePurchaseOrder(
    quoteId: string
  ) {
    const quote = quotes.find(
      (item) => item.id === quoteId
    );

    if (
      !quote ||
      !hasValidAcceptance(quote)
    ) {
      setError(
        "Validation d'acceptation requise avant création du bon de commande."
      );
      return;
    }

    try {
      setError("");

      const purchaseOrder =
        await createPurchaseOrderFromQuote(
          quoteId
        );

      setPurchaseOrders((current) => [
        purchaseOrder,
        ...current,
      ]);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le bon de commande."
      );
    }
  }


  // -------------------------------------------------------------------
  // FORM
  // -------------------------------------------------------------------

  function resetForm() {
    setEditingQuoteId(null);
    setValidUntil("");
    setNotes("");
    setLines([emptyLine()]);

    if (requests.length > 0) {
      setRequestId(requests[0].id);
    }
  }


  function closeForm() {
    setShowForm(false);
    resetForm();
  }


  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }


  function startEdit(quote: Quote) {
    setEditingQuoteId(quote.id);

    setRequestId(quote.request_id);

    setValidUntil(
      quote.valid_until
        ? quote.valid_until.substring(0, 10)
        : ""
    );

    setNotes(quote.notes ?? "");

    setLines(
      quote.items.map((item) => ({
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unit_price),
        vatRate: String(item.vat_rate),
      }))
    );

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  // -------------------------------------------------------------------
  // STATUS
  // -------------------------------------------------------------------

  async function handleDeleteQuote(
    quote: Quote
  ) {
    if (quote.status !== "draft") {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement ${quote.quote_number} ?\n\n` +
      "Cette action est possible uniquement car le devis est encore en brouillon."
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteQuote(quote.id);

      setQuotes((current) =>
        current.filter(
          (item) => item.id !== quote.id
        )
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer le devis."
      );
    }
  }


  async function handleSendQuote(
    quote: Quote
  ) {
    if (quote.status !== "ready") {
      return;
    }

    const confirmed = window.confirm(
      `Envoyer ${quote.quote_number} au client ?\n\n` +
        "Le devis PDF sera envoyé par email."
    );

    if (!confirmed) {
      return;
    }

    try {
      setSendingQuoteId(quote.id);
      setError("");

      const updatedQuote =
        await sendQuote(quote.id);

      setQuotes((current) =>
        current.map((item) =>
          item.id === updatedQuote.id
            ? updatedQuote
            : item
        )
      );

      window.alert(
        `${quote.quote_number} a bien été envoyé.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer le devis."
      );
    } finally {
      setSendingQuoteId(null);
    }
  }


  function openAcceptanceModal(
    quote: Quote
  ) {
    const today =
      new Date().toISOString().slice(0, 10);

    setAcceptanceQuote(quote);
    setAcceptanceChecked(false);
    setAcceptanceMethod("email");
    setAcceptanceDate(today);
    setAcceptanceReference("");
    setAcceptanceNote("");
    setAcceptanceFile(null);
    setError("");
  }


  function closeAcceptanceModal() {
    if (confirmingAcceptance) {
      return;
    }

    setAcceptanceQuote(null);
    setAcceptanceChecked(false);
    setAcceptanceReference("");
    setAcceptanceNote("");
    setAcceptanceFile(null);
  }


  async function handleConfirmAcceptance() {
    if (!acceptanceQuote) {
      return;
    }

    if (!acceptanceChecked) {
      setError(
        "Confirmez que le bon pour accord a bien été reçu."
      );
      return;
    }

    if (!acceptanceDate) {
      setError(
        "La date d'acceptation est obligatoire."
      );
      return;
    }

    if (
      !acceptanceReference.trim() &&
      !acceptanceNote.trim() &&
      !acceptanceFile
    ) {
      setError(
        "Ajoutez une référence ou une note de confirmation."
      );
      return;
    }

    if (acceptanceFile) {
      const allowedTypes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
      ];

      if (
        !allowedTypes.includes(
          acceptanceFile.type
        )
      ) {
        setError(
          "Le justificatif doit être un PDF, PNG ou JPEG."
        );
        return;
      }

      if (
        acceptanceFile.size >
        10 * 1024 * 1024
      ) {
        setError(
          "Le justificatif ne doit pas dépasser 10 Mo."
        );
        return;
      }
    }

    try {
      setConfirmingAcceptance(true);
      setError("");

      const updatedQuote =
        await acceptQuote(
          acceptanceQuote.id,
          {
            acceptance_checked: true,
            acceptance_method:
              acceptanceMethod,
            accepted_at:
              `${acceptanceDate}T12:00:00`,
            acceptance_reference:
              acceptanceReference.trim()
                || null,
            acceptance_note:
              acceptanceNote.trim()
                || null,
            file:
              acceptanceFile,
          }
        );

      setQuotes((current) =>
        current.map((quote) =>
          quote.id === updatedQuote.id
            ? updatedQuote
            : quote
        )
      );

      setAcceptanceQuote(null);
      setAcceptanceChecked(false);
      setAcceptanceReference("");
      setAcceptanceNote("");
    setAcceptanceFile(null);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de confirmer l'acceptation du devis."
      );
    } finally {
      setConfirmingAcceptance(false);
    }
  }


  async function changeStatus(
    quoteId: string,
    newStatus: string
  ) {
    try {
      setError("");

      const updatedQuote =
        await updateQuoteStatus(
          quoteId,
          newStatus
        );

      setQuotes((current) =>
        current.map((quote) =>
          quote.id === updatedQuote.id
            ? updatedQuote
            : quote
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de modifier le statut du devis."
      );
    }
  }


  // -------------------------------------------------------------------
  // QUOTE LINES
  // -------------------------------------------------------------------

  function updateLine(
    index: number,
    field: keyof QuoteLineForm,
    value: string
  ) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              [field]: value,
            }
          : line
      )
    );
  }


  function addLine() {
    setLines((current) => [
      ...current,
      emptyLine(),
    ]);
  }


  function removeLine(index: number) {
    setLines((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (_, lineIndex) => lineIndex !== index
      );
    });
  }


  // -------------------------------------------------------------------
  // TOTALS
  // -------------------------------------------------------------------

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const quantity =
          Number(line.quantity) || 0;

        const unitPrice =
          Number(line.unitPrice) || 0;

        const vatRate =
          Number(line.vatRate) || 0;

        const subtotal =
          quantity * unitPrice;

        const vatAmount =
          subtotal * (vatRate / 100);

        acc.subtotal += subtotal;
        acc.vat += vatAmount;
        acc.total += subtotal + vatAmount;

        return acc;
      },
      {
        subtotal: 0,
        vat: 0,
        total: 0,
      }
    );
  }, [lines]);


  const quoteMetrics = useMemo(() => {
    const sentQuotes = quotes.filter(
      (quote) => quote.status === "sent"
    );

    const acceptedQuotes = quotes.filter(
      (quote) => quote.status === "accepted"
    );

    const toWatch = quotes.filter(
      (quote) =>
        quote.status === "expired" ||
        isQuoteDueSoon(quote) ||
        isQuotePastValidity(quote)
    );

    return {
      total: quotes.length,

      sentAmount: sentQuotes.reduce(
        (total, quote) =>
          total + Number(quote.total || 0),
        0
      ),

      acceptedAmount: acceptedQuotes.reduce(
        (total, quote) =>
          total + Number(quote.total || 0),
        0
      ),

      acceptedCount: acceptedQuotes.length,
      toWatchCount: toWatch.length,
    };
  }, [quotes]);


  const filteredQuotes = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return quotes.filter((quote) => {
      if (
        requestFromUrl &&
        !createFromRequest &&
        quote.request_id !== requestFromUrl
      ) {
        return false;
      }

      if (
        !isQuoteInPeriod(
          quote,
          periodFilter
        )
      ) {
        return false;
      }

      if (
        dashboardStatusFilter &&
        quote.status !==
          dashboardStatusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const request =
        getRequest(quote);

      const haystack = [
        quote.quote_number,
        getClientName(quote),
        request?.title ?? "",
        getQuoteStatusLabel(
          quote.status
        ),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [
    quotes,
    search,
    requests,
    clients,
    periodFilter,
    dashboardStatusFilter,
  ]);


  const sortedQuotes = useMemo(() => {
    const result = [...filteredQuotes];

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
        new Date(a.created_at).getTime();

      const dateB =
        new Date(b.created_at).getTime();

      if (sort === "date_asc") {
        return dateA - dateB;
      }

      return dateB - dateA;
    });

    return result;
  }, [
    filteredQuotes,
    sort,
  ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedQuotes.length /
          pageSize
      )
    );


  const paginatedQuotes =
    useMemo(() => {
      const safePage =
        Math.min(
          currentPage,
          totalPages
        );

      const start =
        (safePage - 1) *
        pageSize;

      return sortedQuotes.slice(
        start,
        start + pageSize
      );
    }, [
      sortedQuotes,
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



  // -------------------------------------------------------------------
  // CREATE / UPDATE QUOTE
  // -------------------------------------------------------------------

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!requestId) {
      setError(
        "Sélectionnez une demande."
      );

      return;
    }

    if (
      lines.some(
        (line) =>
          !line.description.trim() ||
          Number(line.quantity) <= 0 ||
          Number(line.unitPrice) < 0
      )
    ) {
      setError(
        "Vérifiez les lignes du devis."
      );

      return;
    }

    const items = lines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      unit_price: Number(line.unitPrice),
      vat_rate: Number(line.vatRate),
    }));

    try {
      setError("");

      if (editingQuoteId) {
        const updatedQuote =
          await updateQuote(
            editingQuoteId,
            {
              valid_until:
                validUntil || null,

              notes:
                notes || null,

              items,
            }
          );

        setQuotes((current) =>
          current.map((quote) =>
            quote.id === updatedQuote.id
              ? updatedQuote
              : quote
          )
        );
      } else {
        const quote =
          await createQuote({
            request_id: requestId,
            valid_until:
              validUntil || null,

            notes:
              notes || null,

            items,
          });

        setQuotes((current) => [
          quote,
          ...current,
        ]);
      }

      closeForm();
    } catch (err) {
      console.error(err);

      setError(
        editingQuoteId
          ? "Impossible de modifier le devis."
          : "Impossible de créer le devis."
      );
    }
  }


  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">
            Commercial
          </span>

          <h1>Devis</h1>

          <p>
            Créez, suivez et envoyez vos propositions
            commerciales.
          </p>
        </div>

        <button
          className="business-button business-button-primary"
          onClick={openCreateForm}
        >
          Nouveau devis
        </button>
      </div>


      {dashboardStatusFilter && (
        <div className="business-context-filter">
          <div>
            <span>
              Vue pilotée
            </span>

            <strong>
              {dashboardStatusFilter ===
              "accepted"
                ? "Devis acceptés"
                : `Statut : ${dashboardStatusFilter}`}
            </strong>
          </div>

          <button
            type="button"
            className="business-context-filter-clear"
            onClick={() => {
              setSearchParams({});
              setPeriodFilter("current");
            }}
          >
            × Effacer
          </button>
        </div>
      )}


      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      <section className="df-premium-kpi-grid">
        <article className="df-premium-kpi-card" data-tone="primary">
          <span>Total devis</span>

          <strong>
            {loading
              ? "—"
              : quoteMetrics.total}
          </strong>

          <small>
            Propositions commerciales
          </small>
        </article>

        <article className="df-premium-kpi-card" data-tone="cyan">
          <span>Devis envoyés</span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  quoteMetrics.sentAmount
                )}
          </strong>

          <small>
            En attente de décision
          </small>
        </article>

        <article className="df-premium-kpi-card" data-tone="success">
          <span>Devis acceptés</span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  quoteMetrics.acceptedAmount
                )}
          </strong>

          <small>
            {loading
              ? "—"
              : `${quoteMetrics.acceptedCount} accepté${
                  quoteMetrics.acceptedCount > 1
                    ? "s"
                    : ""
                }`}
          </small>
        </article>

        <article
          className="df-premium-kpi-card"
          data-tone={
            quoteMetrics.toWatchCount > 0
              ? "danger"
              : "neutral"
          }
        >
          <span>À surveiller</span>

          <strong>
            {loading
              ? "—"
              : quoteMetrics.toWatchCount}
          </strong>

          <small>
            Expirés ou validité proche
          </small>
        </article>
      </section>


      {showForm && (
        <div className="business-form-overlay">
<form
          className="quote-form"
          onSubmit={handleSubmit}
        >
          <div className="form-header">
            <div>
              <h2>
                {editingQuoteId
                  ? "Modifier le devis"
                  : "Nouveau devis"}
              </h2>

              <p>
                {editingQuoteId
                  ? "Corrigez les informations du devis."
                  : "Construisez votre proposition commerciale."}
              </p>
            </div>

            <button
              type="button"
              className="business-button business-button-secondary"
              onClick={closeForm}
            >
              Annuler
            </button>
          </div>


          <div className="form-grid">
            <label>
              Demande

              <select
                required
                value={requestId}
                disabled={Boolean(
                  editingQuoteId
                )}
                onChange={(event) =>
                  setRequestId(
                    event.target.value
                  )
                }
              >
                {requests.map((request) => (
                  <option
                    key={request.id}
                    value={request.id}
                  >
                    {request.title}
                    {" — "}
                    {getClientNameByRequest(
                      request
                    )}
                  </option>
                ))}
              </select>
            </label>


            <label>
              Valable jusqu'au

              <input
                type="date"
                value={validUntil}
                onChange={(event) =>
                  setValidUntil(
                    event.target.value
                  )
                }
              />
            </label>


            <label className="full-width">
              Notes

              <textarea
                rows={3}
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
              />
            </label>
          </div>


          <div className="quote-lines-header">
            <div>
              <h3>
                Prestations
              </h3>

              <p>
                Ajoutez ou modifiez les lignes du devis.
              </p>
            </div>

            <button
              type="button"
              className="business-button business-button-secondary"
              onClick={addLine}
            >
              + Ajouter une ligne
            </button>
          </div>


          <div className="quote-lines">
            {lines.map((line, index) => {
              const lineSubtotal =
                (Number(line.quantity) || 0) *
                (Number(line.unitPrice) || 0);

              return (
                <div
                  className="quote-line"
                  key={index}
                >
                  <label className="quote-line-description">
                    Description

                    <input
                      required
                      value={line.description}
                      onChange={(event) =>
                        updateLine(
                          index,
                          "description",
                          event.target.value
                        )
                      }
                    />
                  </label>


                  <label>
                    Qté

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(
                          index,
                          "quantity",
                          event.target.value
                        )
                      }
                    />
                  </label>


                  <label>
                    Prix HT

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={line.unitPrice}
                      onChange={(event) =>
                        updateLine(
                          index,
                          "unitPrice",
                          event.target.value
                        )
                      }
                    />
                  </label>


                  <label>
                    TVA %

                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      value={line.vatRate}
                      onChange={(event) =>
                        updateLine(
                          index,
                          "vatRate",
                          event.target.value
                        )
                      }
                    />
                  </label>


                  <div className="quote-line-total">
                    <span>
                      Total HT
                    </span>

                    <strong>
                      {formatCurrency(
                        lineSubtotal
                      )}
                    </strong>
                  </div>


                  <button
                    type="button"
                    className="business-button business-button-danger business-button-icon business-button-square"
                    onClick={() =>
                      removeLine(index)
                    }
                    disabled={
                      lines.length === 1
                    }
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>


          <div className="quote-summary">
            <div>
              <span>
                Total HT
              </span>

              <strong>
                {formatCurrency(
                  totals.subtotal
                )}
              </strong>
            </div>

            <div>
              <span>
                TVA
              </span>

              <strong>
                {formatCurrency(
                  totals.vat
                )}
              </strong>
            </div>

            <div className="quote-summary-total">
              <span>
                Total TTC
              </span>

              <strong>
                {formatCurrency(
                  totals.total
                )}
              </strong>
            </div>
          </div>


          <div className="form-actions">
            <button
              type="submit"
              className="business-button business-button-primary"
            >
              {editingQuoteId
                ? "Enregistrer les modifications"
                : "Créer le devis"}
            </button>
          </div>
        </form>
        </div>
      )}


      <section className="table-card">
        <div className="client-list-header">
          <div>
            <h2>
              Suivi des devis
            </h2>

            <p>
              {loading
                ? "Chargement..."
                : `${filteredQuotes.length} devis dans cette vue`}
            </p>
          </div>

          <input
            className="client-search"
            type="search"
            placeholder="Rechercher un devis..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
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
                setPeriodFilter("current")
              }
            >
              {formatQuoteMonthLabel()}
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
              {formatQuoteMonthLabel(-1)}
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
                setPeriodFilter("year")
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
                setPeriodFilter("all")
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
                  event.target.value as QuoteSort
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
            Chargement des devis...
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="smart-empty-state">
            <strong>
              Aucun devis dans cette période.
            </strong>

            <span>
              Essayez une autre période ou affichez
              tous les devis.
            </span>
          </div>
        ) : (
          <div className="table-scroll">
<table className="data-table df-premium-table quote-table">
            <thead>
              <tr>
                <th>Devis</th>
                <th>Client</th>
                <th>Demande</th>
                <th>Total TTC</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>


            <tbody>
              {paginatedQuotes.map((quote) => {
                const request =
                  getRequest(quote);

                const linkedInvoices =
                  getInvoicesForQuote(
                    quote.id
                  );

                const billingProgress =
                  getBillingProgress(
                    quote
                  );

                const remainingToBill =
                  getRemainingToBill(
                    quote
                  );

                return (
                  <tr
                    key={quote.id}
                    className={`business-row quote-business-row ${getQuoteBusinessClass(
                      quote.status
                    )} ${
                      isQuotePastValidity(quote)
                        ? "quote-row-overdue"
                        : isQuoteDueSoon(quote)
                          ? "quote-row-warning"
                          : ""
                    }`}
                  >
                    <td>
                      <strong>
                        {quote.quote_number}
                      </strong>
                    </td>

                    <td
                        title={getClientName(
                          quote
                        )}
                      >
                        {truncateLabel(
                          getClientName(
                            quote
                          ),
                          14
                        )}
                      </td>

                      <td
                        title={
                          request?.title ??
                          "—"
                        }
                      >
                        {truncateLabel(
                          request?.title ??
                            "—",
                          18
                        )}
                      </td>

                    <td>
                      <strong>
                        {formatCurrency(
                          quote.total
                        )}
                      </strong>
                    </td>


                    <td>
                      <div className="document-status-cell">
                        <span
                          className={`status-badge ${getQuoteStatusClass(
                            quote.status
                          )}`}
                        >
                          {getQuoteStatusLabel(
                            quote.status
                          )}
                        </span>

                        <DocumentEmailTrace
                          documentType="quote"
                          documentId={quote.id}
                          documentStatus={quote.status}
                        />

                          {isQuotePastValidity(quote) ? (
                            <small
                              className="quote-validity-trace quote-validity-danger"
                              title={`Validité : ${formatDate(
                                quote.valid_until
                              )}`}
                            >
                              Expiré · {formatDate(
                                quote.valid_until
                              )}
                            </small>
                          ) : isQuoteDueSoon(quote) ? (
                            <small
                              className="quote-validity-trace quote-validity-warning"
                              title={`Validité : ${formatDate(
                                quote.valid_until
                              )}`}
                            >
                              Expire bientôt · {formatDate(
                                quote.valid_until
                              )}
                            </small>
                          ) : null}
                      </div>
                    </td>

                    <td>
                      <div className="quote-actions business-row-actions">

                        {quote.status === "draft" && (
                          <>
                            <button
                              className="business-button business-button-primary business-button-sm business-primary-action"
                              onClick={() =>
                                changeStatus(
                                  quote.id,
                                  "ready"
                                )
                              }
                            >
                              Prêt
                            </button>

                            <button
                              className="business-button business-button-secondary business-button-sm"
                              onClick={() =>
                                startEdit(
                                  quote
                                )
                              }
                            >
                              Modifier
                            </button>

                            <RowActionsMenu>
                              <button
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  openPdf(
                                    quote.id
                                  )
                                }
                              >
                                PDF
                              </button>

                              <button
                                type="button"
                                className="business-button business-button-danger business-button-sm"
                                onClick={() =>
                                  handleDeleteQuote(
                                    quote
                                  )
                                }
                              >
                                Supprimer
                              </button>
                            </RowActionsMenu>
                          </>
                        )}


                        {quote.status === "ready" && (
                          <>
                            <button
                              type="button"
                              className="business-button business-button-cyan business-button-sm business-primary-action"
                              disabled={
                                sendingQuoteId ===
                                quote.id
                              }
                              onClick={() =>
                                handleSendQuote(
                                  quote
                                )
                              }
                            >
                              {sendingQuoteId ===
                              quote.id
                                ? "Envoi..."
                                : "Envoyer le devis"}
                            </button>

                            <button
                              className="business-button business-button-secondary business-button-sm"
                              onClick={() =>
                                startEdit(
                                  quote
                                )
                              }
                            >
                              Modifier
                            </button>

                            <RowActionsMenu>
                              <button
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  openPdf(
                                    quote.id
                                  )
                                }
                              >
                                PDF
                              </button>

                              <button
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  changeStatus(
                                    quote.id,
                                    "draft"
                                  )
                                }
                              >
                                Brouillon
                              </button>
                            </RowActionsMenu>
                          </>
                        )}


                        {quote.status === "sent" && (
                          <>
                            <button
                              className="business-button business-button-success business-button-sm business-primary-action"
                              onClick={() =>
                                openAcceptanceModal(
                                  quote
                                )
                              }
                            >
                              Accepter
                            </button>

                            <button
                              className="business-button business-button-danger business-button-sm"
                              onClick={() =>
                                changeStatus(
                                  quote.id,
                                  "rejected"
                                )
                              }
                            >
                              Refusé
                            </button>

                            <RowActionsMenu>
                              <button
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  openPdf(
                                    quote.id
                                  )
                                }
                              >
                                PDF
                              </button>

                              {(emailCounts[
                                quote.id
                              ] ?? 0) > 0 && (
                                <button
                                  type="button"
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    setEmailPopupQuote(
                                      quote
                                    )
                                  }
                                >
                                  Envoi {
                                    emailCounts[
                                      quote.id
                                    ] ?? 0
                                  }
                                </button>
                              )}
                            </RowActionsMenu>
                          </>
                        )}


                        {quote.status === "accepted" && (
                          <>
                            {(() => {
                              const linkedProformas =
                                proformas.filter(
                                  (item) =>
                                    item.quote_id ===
                                      quote.id &&
                                    item.status !==
                                      "cancelled"
                                );

                              return linkedProformas.length >
                                0 ? (
                                <button
                                  type="button"
                                  className="purchase-order-created-badge business-linked-document"
                                  onClick={() =>
                                    navigate(
                                      "/proformas"
                                    )
                                  }
                                  title={
                                    linkedProformas.length >
                                    1
                                      ? `${linkedProformas.length} proformas liées`
                                      : "Ouvrir la proforma"
                                  }
                                >
                                  PRO{" "}
                                  {
                                    linkedProformas.length
                                  }
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="business-button business-button-secondary business-button-sm business-complementary-action"
                                  onClick={() =>
                                    void handleCreateProforma(
                                      quote.id
                                    )
                                  }
                                >
                                  Créer proforma
                                </button>
                              );
                            })()}

                            {(() => {
                              const purchaseOrder =
                                purchaseOrders.find(
                                  (item) =>
                                    item.quote_id ===
                                    quote.id
                                );

                              return purchaseOrder ? (
                                <button
                                  className="purchase-order-created-badge business-linked-document"
                                  onClick={() =>
                                    openPurchaseOrderPdf(
                                      purchaseOrder.id
                                    )
                                  }
                                  title="Ouvrir le bon de commande"
                                >
                                  BC 1
                                </button>
                              ) : (
                                <button
                                  className="business-button business-button-cyan business-button-sm business-complementary-action"
                                  onClick={() =>
                                    handleCreatePurchaseOrder(
                                      quote.id
                                    )
                                  }
                                >
                                  Créer BC
                                </button>
                              );
                            })()}

                            {(() => {
                              const linkedDeliveryNotes =
                                operationalDocuments.filter(
                                  (item) =>
                                    item.quote_id ===
                                      quote.id &&
                                    item.document_type ===
                                      "delivery_note" &&
                                    item.status !==
                                      "cancelled"
                                );

                              return linkedDeliveryNotes.length >
                                0 ? (
                                <button
                                  type="button"
                                  className="purchase-order-created-badge business-linked-document"
                                  onClick={() =>
                                    navigate(
                                      "/execution"
                                    )
                                  }
                                  title={`${linkedDeliveryNotes.length} bon${
                                    linkedDeliveryNotes.length > 1
                                      ? "s"
                                      : ""
                                  } de livraison`}
                                >
                                  BL{" "}
                                  {
                                    linkedDeliveryNotes.length
                                  }
                                </button>
                              ) : null;
                            })()}


                            {(() => {
                              const linkedInterventionNotes =
                                operationalDocuments.filter(
                                  (item) =>
                                    item.quote_id ===
                                      quote.id &&
                                    item.document_type ===
                                      "intervention_note" &&
                                    item.status !==
                                      "cancelled"
                                );

                              return linkedInterventionNotes.length >
                                0 ? (
                                <button
                                  type="button"
                                  className="purchase-order-created-badge business-linked-document"
                                  onClick={() =>
                                    navigate(
                                      "/execution"
                                    )
                                  }
                                  title={`${linkedInterventionNotes.length} bon${
                                    linkedInterventionNotes.length > 1
                                      ? "s"
                                      : ""
                                  } d'intervention`}
                                >
                                  BI{" "}
                                  {
                                    linkedInterventionNotes.length
                                  }
                                </button>
                              ) : null;
                            })()}


                            {(() => {
                              const linkedRecurring =
                                recurringInvoices.filter(
                                  (item) =>
                                    item.quote_id ===
                                    quote.id
                                );

                              return linkedRecurring.length >
                                0 ? (
                                <button
                                  type="button"
                                  className="purchase-order-created-badge business-linked-document"
                                  onClick={() =>
                                    navigate(
                                      "/recurrences"
                                    )
                                  }
                                  title={`${linkedRecurring.length} récurrence${
                                    linkedRecurring.length > 1
                                      ? "s"
                                      : ""
                                  }`}
                                >
                                  REC{" "}
                                  {
                                    linkedRecurring.length
                                  }
                                </button>
                              ) : null;
                            })()}


                            <button
                              type="button"
                              className={
                                linkedInvoices.length > 0
                                  ? "invoice-created-badge invoice-created-button business-linked-document"
                                  : "business-button business-button-primary business-button-sm business-primary-action"
                              }
                              onClick={() =>
                                openBillingPopup(
                                  quote
                                )
                              }
                              title={
                                remainingToBill <= 0
                                  ? `Facturation terminée · ${linkedInvoices.length} facture${
                                      linkedInvoices.length > 1
                                        ? "s"
                                        : ""
                                    }`
                                  : linkedInvoices.length > 0
                                    ? `${formatCurrency(
                                        remainingToBill
                                      )} reste à facturer`
                                    : "Créer une facture"
                              }
                            >
                              {remainingToBill <= 0
                                ? `${linkedInvoices.length} facture${
                                    linkedInvoices.length > 1
                                      ? "s"
                                      : ""
                                  }`
                                : linkedInvoices.length > 0
                                  ? `Facturation ${billingProgress} %`
                                  : "Créer facture"}
                            </button>

                            <RowActionsMenu>
                              <button
                                type="button"
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  openRecurringPopup(
                                    quote
                                  )
                                }
                              >
                                Créer une récurrence
                              </button>

                              {operationalDocuments.filter(
                                (item) =>
                                  item.quote_id ===
                                    quote.id &&
                                  item.document_type ===
                                    "delivery_note" &&
                                  item.status !==
                                    "cancelled"
                              ).length === 0 && (
                                <button
                                  type="button"
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    void handleCreateOperationalDocument(
                                      quote.id,
                                      "delivery_note"
                                    )
                                  }
                                >
                                  Créer BL
                                </button>
                              )}

                              {operationalDocuments.filter(
                                (item) =>
                                  item.quote_id ===
                                    quote.id &&
                                  item.document_type ===
                                    "intervention_note" &&
                                  item.status !==
                                    "cancelled"
                              ).length === 0 && (
                                <button
                                  type="button"
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    void handleCreateOperationalDocument(
                                      quote.id,
                                      "intervention_note"
                                    )
                                  }
                                >
                                  Créer BI
                                </button>
                              )}

                              <button
                                className="business-button business-button-secondary business-button-sm"
                                onClick={() =>
                                  openPdf(
                                    quote.id
                                  )
                                }
                              >
                                PDF
                              </button>

                              {(emailCounts[
                                quote.id
                              ] ?? 0) > 0 && (
                                <button
                                  type="button"
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    setEmailPopupQuote(
                                      quote
                                    )
                                  }
                                >
                                  Envoi {
                                    emailCounts[
                                      quote.id
                                    ] ?? 0
                                  }
                                </button>
                              )}
                            </RowActionsMenu>
                          </>
                        )}


                        {[
                          "rejected",
                          "expired",
                          "cancelled",
                        ].includes(
                          quote.status
                        ) && (
                          <button
                            className="business-button business-button-secondary business-button-sm"
                            onClick={() =>
                              openPdf(
                                quote.id
                              )
                            }
                          >
                            PDF
                          </button>
                        )}

                      </div>  
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}


        {!loading &&
          filteredQuotes.length > 0 && (
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

      {recurringQuote && (
        <div
          className="recurring-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeRecurringPopup();
            }
          }}
        >
          <form
            className="recurring-modal-card"
            onSubmit={
              handleCreateRecurringInvoice
            }
          >
            <div className="recurring-modal-header">
              <div>
                <span className="eyebrow">
                  Facturation récurrente
                </span>

                <h2>
                  Créer une récurrence
                </h2>

                <p>
                  {
                    recurringQuote.quote_number
                  }
                </p>
              </div>

              <button
                type="button"
                className="recurring-modal-close"
                onClick={
                  closeRecurringPopup
                }
                disabled={
                  creatingRecurring
                }
                aria-label="Fermer"
              >
                ×
              </button>
            </div>


            <div className="recurring-modal-body">
              <label className="recurring-field">
                <span>
                  Service concerné
                </span>

                <input
                  type="text"
                  value={
                    recurringServiceName
                  }
                  onChange={(event) =>
                    setRecurringServiceName(
                      event.target.value
                    )
                  }
                  placeholder="Ex. Maintenance solution IA"
                  maxLength={250}
                  required
                  autoFocus
                />
              </label>


              <label className="recurring-field">
                <span>
                  Fréquence
                </span>

                <select
                  value={
                    recurringFrequency
                  }
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    if (
                      value === "monthly" ||
                      value === "quarterly" ||
                      value === "yearly"
                    ) {
                      setRecurringFrequency(
                        value
                      );
                    }
                  }}
                >
                  <option value="monthly">
                    Mensuelle
                  </option>

                  <option value="quarterly">
                    Trimestrielle
                  </option>

                  <option value="yearly">
                    Annuelle
                  </option>
                </select>
              </label>


              <div className="recurring-date-grid">
                <label className="recurring-field">
                  <span>
                    Date de début
                  </span>

                  <input
                    type="date"
                    value={
                      recurringStartDate
                    }
                    onChange={(event) => {
                      const value =
                        event.target.value;

                      setRecurringStartDate(
                        value
                      );

                      if (
                        !recurringNextDate
                      ) {
                        setRecurringNextDate(
                          value
                        );
                      }
                    }}
                    required
                  />
                </label>


                <label className="recurring-field">
                  <span>
                    Première échéance
                  </span>

                  <input
                    type="date"
                    value={
                      recurringNextDate
                    }
                    min={
                      recurringStartDate ||
                      undefined
                    }
                    onChange={(event) =>
                      setRecurringNextDate(
                        event.target.value
                      )
                    }
                    required
                  />
                </label>
              </div>


              <div className="recurring-modal-info">
                <strong>
                  Fonctionnement
                </strong>

                <span>
                  À l'échéance, DevisFlow
                  signalera qu'une facture
                  est à générer. Aucun envoi
                  automatique n'est effectué.
                </span>
              </div>
            </div>


            <div className="recurring-modal-footer">
              <button
                type="button"
                className="business-button business-button-secondary"
                onClick={
                  closeRecurringPopup
                }
                disabled={
                  creatingRecurring
                }
              >
                Annuler
              </button>

              <button
                type="submit"
                className="business-button business-button-primary"
                disabled={
                  creatingRecurring
                }
              >
                {creatingRecurring
                  ? "Création..."
                  : "Créer la récurrence"}
              </button>
            </div>
          </form>
        </div>
      )}


      {acceptanceQuote && (
        <div
          className="billing-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAcceptanceModal();
            }
          }}
        >
          <form
            className="billing-modal"
            onSubmit={(event) => {
              event.preventDefault();
              void handleConfirmAcceptance();
            }}
          >
            <div className="billing-modal-header">
              <div>
                <span className="billing-modal-eyebrow">
                  Validation commerciale
                </span>

                <h2>
                  Confirmer l'acceptation
                </h2>

                <p>
                  {acceptanceQuote.quote_number}
                </p>
              </div>

              <button
                type="button"
                className="business-button business-button-secondary business-button-sm"
                disabled={confirmingAcceptance}
                onClick={closeAcceptanceModal}
              >
                Fermer
              </button>
            </div>

            <div className="form-grid">
              <label
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                <span>
                  <input
                    type="checkbox"
                    checked={acceptanceChecked}
                    onChange={(event) =>
                      setAcceptanceChecked(
                        event.target.checked
                      )
                    }
                  />
                  {" "}
                  Bon pour accord reçu et vérifié
                </span>
              </label>

              <label>
                Mode de confirmation

                <select
                  value={acceptanceMethod}
                  onChange={(event) =>
                    setAcceptanceMethod(
                      (
                        event.target.value
                      ) as QuoteAcceptanceMethod
                    )
                  }
                >
                  <option value="email">
                    Email
                  </option>

                  <option value="signed_quote">
                    Devis signé
                  </option>

                  <option value="good_for_agreement">
                    Bon pour accord
                  </option>

                  <option value="phone">
                    Téléphone
                  </option>

                  <option value="other">
                    Autre
                  </option>
                </select>
              </label>

              <label>
                Date d'acceptation

                <input
                  type="date"
                  required
                  value={acceptanceDate}
                  onChange={(event) =>
                    setAcceptanceDate(
                      event.target.value
                    )
                  }
                />
              </label>

              <label
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                Référence de confirmation

                <input
                  type="text"
                  value={acceptanceReference}
                  placeholder="Ex. Email reçu le 08/09/2026"
                  onChange={(event) =>
                    setAcceptanceReference(
                      event.target.value
                    )
                  }
                />
              </label>

              <label
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                Note de confirmation

                <textarea
                  value={acceptanceNote}
                  placeholder="Précision complémentaire sur l'accord du client..."
                  onChange={(event) =>
                    setAcceptanceNote(
                      event.target.value
                    )
                  }
                />
              </label>

              <label
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                Justificatif d'acceptation

                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  disabled={
                    confirmingAcceptance
                  }
                  onChange={(event) => {
                    const selectedFile =
                      event.target.files?.[0]
                      ?? null;

                    setAcceptanceFile(
                      selectedFile
                    );

                    setError("");
                  }}
                />

                <small>
                  PDF, PNG ou JPEG — 10 Mo maximum.
                  Le document sera conservé de manière
                  privée dans CoreFlow.
                </small>

                {acceptanceFile && (
                  <small>
                    Fichier sélectionné :{" "}
                    <strong>
                      {acceptanceFile.name}
                    </strong>
                  </small>
                )}
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="business-button business-button-secondary"
                disabled={confirmingAcceptance}
                onClick={closeAcceptanceModal}
              >
                Annuler
              </button>

              <button
                type="submit"
                className="business-button business-button-success"
                disabled={confirmingAcceptance}
              >
                {confirmingAcceptance
                  ? "Validation..."
                  : "Confirmer l'acceptation"}
              </button>
            </div>
          </form>
        </div>
      )}


      {billingQuote && (() => {
        const linkedInvoices =
          getInvoicesForQuote(
            billingQuote.id
          );

        const billedTotal =
          getBilledTotalForQuote(
            billingQuote.id
          );

        const remaining =
          getRemainingToBill(
            billingQuote
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
                setBillingQuote(null);
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
                    {billingQuote.quote_number}
                  </p>
                </div>

                <button
                  type="button"
                  className="business-button business-button-secondary business-button-sm"
                  disabled={creatingInvoice}
                  onClick={() =>
                    setBillingQuote(null)
                  }
                >
                  Fermer
                </button>
              </div>

              <div className="billing-summary">
                <div>
                  <span>
                    Total devis
                  </span>

                  <strong>
                    {formatCurrency(
                      billingQuote.total
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
                <label htmlFor="billing-invoice-type">
                  Type de facture
                </label>

                <select
                  id="billing-invoice-type"
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
                  <label htmlFor="billing-percentage">
                    Pourcentage d'acompte
                  </label>

                  <div className="billing-percentage-input">
                    <input
                      id="billing-percentage"
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
                        billingQuote.total
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
                    setBillingQuote(null)
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

      {emailPopupQuote && (
        <InvoiceActivityPopup
          invoiceId={emailPopupQuote.id}
          invoiceNumber={
            emailPopupQuote.quote_number
          }
          type="email"
          documentType="quote"
          contextLabel="Activité devis"
          onClose={() =>
            setEmailPopupQuote(null)
          }
        />
      )}
    </div>
  );
}
