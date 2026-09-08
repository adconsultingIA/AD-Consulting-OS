import RowActionsMenu from "../components/RowActionsMenu";
import DocumentEmailTrace from "../components/DocumentEmailTrace";
import InvoiceActivityPopup, {
  type InvoiceActivityType,
} from "../components/InvoiceActivityPopup";
import { compactCompanyName } from "../utils/display";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import type {
  FormEvent,
} from "react";

import type {
  Client,
  Invoice,
  Quote,
  Request,
} from "../types";

import {
  getClients,
  getQuotes,
  getRequests,
  updateInvoiceStatus,
} from "../services/api";

import {
  deleteInvoice,
  getInvoices,
  openInvoicePdf,
  sendInvoice,
  updateInvoice,
} from "../services/invoicesService";

import {
  createPayment,
  getInvoicePayments,
} from "../services/paymentsService";

import type {
  Payment,
} from "../services/paymentsService";


import {
  createInvoiceReminder,
  getInvoiceReminders,
  getReminderCounts,
} from "../services/remindersService";

import type {
  PaymentReminder,
} from "../services/remindersService";


import {
  createInvoiceCreditNote,
  getInvoiceCreditNotes,
} from "../services/creditNotesService";

import type {
  CreditNote,
} from "../services/creditNotesService";

import {
  getInvoiceStatusClass,
  getInvoiceStatusLabel,
} from "../utils/invoiceStatus";

import {
  createInvoiceRefund,
  getInvoiceRefunds,
} from "../services/refundsService";

import {
  getInvoiceActivitySummary,
  type InvoiceActivitySummaryMap,
} from "../services/historyService";


import type {
  Refund,
} from "../services/refundsService";


type InvoicePeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


type InvoiceSort =
  | "date_desc"
  | "date_asc"
  | "amount_asc"
  | "amount_desc";


function getInvoiceReferenceDate(
  invoice: Invoice
) {
  if (invoice.issue_date) {
    return new Date(
      `${invoice.issue_date}T00:00:00`
    );
  }

  return new Date(invoice.created_at);
}


function isInvoiceInPeriod(
  invoice: Invoice,
  period: InvoicePeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date =
    getInvoiceReferenceDate(invoice);

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


export default function InvoicesPage() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const dashboardStatusFilter =
    searchParams.get("status");

  const dashboardDueFilter =
    searchParams.get("due");

  const dashboardClientFilter =
    searchParams.get("client");

  const dashboardPeriodFilter =
    searchParams.get("period");

  const targetInvoiceId =
    searchParams.get("invoice");

  const [
    highlightedInvoiceId,
    setHighlightedInvoiceId,
  ] = useState<string | null>(null);

  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [quotes, setQuotes] =
    useState<Quote[]>([]);

  const [requests, setRequests] =
    useState<Request[]>([]);

  const [clients, setClients] =
    useState<Client[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    sendingInvoiceId,
    setSendingInvoiceId,
  ] = useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [
    periodFilter,
    setPeriodFilter,
  ] = useState<InvoicePeriodFilter>(
    dashboardStatusFilter ||
    dashboardDueFilter ||
    dashboardClientFilter ||
    dashboardPeriodFilter === "all"
      ? "all"
      : "current"
  );

  const [
    sort,
    setSort,
  ] = useState<InvoiceSort>(
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


  // ==========================================================
  // TARGETED INVOICE FROM QUOTE
  // ==========================================================

  useEffect(() => {
    if (
      loading ||
      !targetInvoiceId ||
      invoices.length === 0
    ) {
      return;
    }

    const exists = invoices.some(
      (invoice) =>
        invoice.id === targetInvoiceId
    );

    if (!exists) {
      return;
    }

    setHighlightedInvoiceId(
      targetInvoiceId
    );

    setCurrentPage(1);

    const frame = window.requestAnimationFrame(
      () => {
        const element =
          document.getElementById(
            `invoice-row-${targetInvoiceId}`
          );

        element?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    );

    const timeout = window.setTimeout(
      () => {
        setHighlightedInvoiceId(null);
      },
      3500
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [
    loading,
    targetInvoiceId,
    invoices,
  ]);


  // ==========================================================
  // EDIT INVOICE
  // ==========================================================

  const [
    editingInvoice,
    setEditingInvoice,
  ] = useState<Invoice | null>(null);

  const [
    issueDate,
    setIssueDate,
  ] = useState("");

  const [
    dueDate,
    setDueDate,
  ] = useState("");

  const [
    paymentTerms,
    setPaymentTerms,
  ] = useState("");

  const [
    invoiceNotes,
    setInvoiceNotes,
  ] = useState("");

  const [
    savingInvoice,
    setSavingInvoice,
  ] = useState(false);


  // ==========================================================
  // PAYMENTS
  // ==========================================================

  const [
    paymentInvoice,
    setPaymentInvoice,
  ] = useState<Invoice | null>(null);

  const [
    payments,
    setPayments,
  ] = useState<Payment[]>([]);

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [
    paymentDate,
    setPaymentDate,
  ] = useState(
    new Date()
      .toISOString()
      .slice(0, 10)
  );

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("bank_transfer");

  const [
    paymentReference,
    setPaymentReference,
  ] = useState("");

  const [
    paymentNotes,
    setPaymentNotes,
  ] = useState("");

  const [
    savingPayment,
    setSavingPayment,
  ] = useState(false);


  const [
    reminderInvoice,
    setReminderInvoice,
  ] = useState<Invoice | null>(null);

  const [
    reminders,
    setReminders,
  ] = useState<PaymentReminder[]>([]);

  const [
    reminderCounts,
    setReminderCounts,
  ] = useState<Record<string, number>>({});

  const [
    activitySummary,
    setActivitySummary,
  ] = useState<InvoiceActivitySummaryMap>({});

  const [
    activityPopup,
    setActivityPopup,
  ] = useState<{
    invoice: Invoice;
    type: InvoiceActivityType;
  } | null>(null);

  const [
    reminderDate,
    setReminderDate,
  ] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [
    reminderChannel,
    setReminderChannel,
  ] = useState("email");

  const [
    reminderSubject,
    setReminderSubject,
  ] = useState(
    "Relance facture en attente de règlement"
  );

  const [
    reminderMessage,
    setReminderMessage,
  ] = useState(
    "Bonjour, sauf erreur de notre part, cette facture reste à ce jour en attente de règlement."
  );

  const [
    savingReminder,
    setSavingReminder,
  ] = useState(false);


  const [creditInvoice, setCreditInvoice] =
    useState<Invoice | null>(null);

  const [creditNotes, setCreditNotes] =
    useState<CreditNote[]>([]);

  const [creditAmount, setCreditAmount] =
    useState("");

  const [creditDate, setCreditDate] =
    useState(
      new Date().toISOString().slice(0, 10)
    );

  const [creditReason, setCreditReason] =
    useState("");

  const [creditNotesText, setCreditNotesText] =
    useState("");

  const [savingCredit, setSavingCredit] =
    useState(false);

  const [refundInvoice, setRefundInvoice] =
  useState<Invoice | null>(null);

const [refunds, setRefunds] =
  useState<Refund[]>([]);

const [refundAmount, setRefundAmount] =
  useState("");

const [refundDate, setRefundDate] =
  useState(
    new Date().toISOString().slice(0, 10)
  );

const [refundMethod, setRefundMethod] =
  useState("bank_transfer");

const [refundReference, setRefundReference] =
  useState("");

const [refundNotes, setRefundNotes] =
  useState("");

const [savingRefund, setSavingRefund] =
  useState(false);


  // ==========================================================
  // DATA
  // ==========================================================

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        invoiceData,
        quoteData,
        requestData,
        clientData,
        reminderCountData,
        activitySummaryData,
      ] = await Promise.all([
        getInvoices(),
        getQuotes(),
        getRequests(),
        getClients(),
        getReminderCounts(),
        getInvoiceActivitySummary(),
      ]);

      setInvoices(invoiceData);
      setQuotes(quoteData);
      setRequests(requestData);
      setClients(clientData);
      setReminderCounts(
        reminderCountData
      );
      setActivitySummary(
        activitySummaryData
      );
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de charger les factures."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadData();
  }, []);


  // ==========================================================
  // HELPERS
  // ==========================================================

  function formatCurrency(
    value: string | number
  ) {
    return new Intl.NumberFormat(
      "fr-CH",
      {
        style: "currency",
        currency: "CHF",
      }
    ).format(Number(value));
  }


  function formatDate(
    value?: string | null
  ) {
    if (!value) {
      return "—";
    }

    return new Date(
      `${value.substring(0, 10)}T12:00:00`
    ).toLocaleDateString("fr-FR");
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


  function getClient(
    invoice: Invoice
  ) {
    const request = getRequest(invoice);

    if (!request) {
      return undefined;
    }

    return clients.find(
      (client) =>
        client.id === request.client_id
    );
  }


  function getClientName(
    invoice: Invoice
  ) {
    return compactCompanyName(
      getClient(invoice)?.company_name
    );
  }


  async function openPdf(
    invoiceId: string
  ) {
    try {
      await openInvoicePdf(
        invoiceId
      );
    } catch (err) {
      console.error(err);

      window.alert(
        err instanceof Error
          ? err.message
          : "Impossible d'ouvrir le PDF de la facture."
      );
    }
  }


  function getInvoiceBusinessClass(
    status: string
  ) {
    const classes: Record<string, string> = {
      draft: "business-neutral",
      issued: "business-info",
      sent: "business-cyan",
      partial: "business-warning",
      paid: "business-success",
      overdue: "business-danger",
      cancelled: "business-muted",
    };

    return (
      classes[status] ??
      "business-neutral"
    );
  }


  // ==========================================================
  // EDIT INVOICE
  // ==========================================================

  function openEditInvoice(
    invoice: Invoice
  ) {
    if (invoice.status !== "draft") {
      return;
    }

    setError("");

    setEditingInvoice(invoice);

    setIssueDate(
      invoice.issue_date?.substring(0, 10) ??
        ""
    );

    setDueDate(
      invoice.due_date?.substring(0, 10) ??
        ""
    );

    setPaymentTerms(
      invoice.payment_terms ?? ""
    );

    setInvoiceNotes(
      invoice.notes ?? ""
    );
  }


  function closeEditInvoice() {
    setEditingInvoice(null);
    setIssueDate("");
    setDueDate("");
    setPaymentTerms("");
    setInvoiceNotes("");
  }


  async function handleInvoiceSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!editingInvoice) {
      return;
    }

    if (!issueDate) {
      setError(
        "Merci de renseigner la date de facture."
      );

      return;
    }

    if (!dueDate) {
      setError(
        "Merci de renseigner la date d’échéance de cette facture."
      );

      return;
    }

    if (dueDate < issueDate) {
      setError(
        "La date d’échéance ne peut pas être antérieure à la date de facture."
      );

      return;
    }

    try {
      setSavingInvoice(true);
      setError("");

      const updated =
        await updateInvoice(
          editingInvoice.id,
          {
            issue_date: issueDate,
            due_date: dueDate,

            payment_terms:
              paymentTerms || null,

            notes:
              invoiceNotes || null,
          }
        );

      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === updated.id
            ? updated
            : invoice
        )
      );

      closeEditInvoice();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier la facture."
      );
    } finally {
      setSavingInvoice(false);
    }
  }


  // ==========================================================
  // STATUS
  // ==========================================================

  async function handleDeleteInvoice(
    invoice: Invoice
  ) {
    if (invoice.status !== "draft") {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement ${invoice.invoice_number} ?\n\n` +
      "Cette action est possible uniquement car la facture est encore en brouillon."
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteInvoice(invoice.id);

      setInvoices((current) =>
        current.filter(
          (item) => item.id !== invoice.id
        )
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer la facture."
      );
    }
  }


  async function handleSendInvoice(
    invoice: Invoice
  ) {
    if (invoice.status !== "issued") {
      return;
    }

    const confirmed = window.confirm(
      `Envoyer ${invoice.invoice_number} au client ?\n\n` +
        "La facture PDF sera envoyée par email."
    );

    if (!confirmed) {
      return;
    }

    try {
      setSendingInvoiceId(invoice.id);
      setError("");

      const updated =
        await sendInvoice(invoice.id);

      setInvoices((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item
        )
      );

      window.alert(
        `${invoice.invoice_number} a bien été envoyée.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer la facture."
      );
    } finally {
      setSendingInvoiceId(null);
    }
  }


  async function changeStatus(
    invoiceId: string,
    status: string
  ) {
    try {
      setError("");

      const updated =
        await updateInvoiceStatus(
          invoiceId,
          status
        );

      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === updated.id
            ? updated
            : invoice
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier le statut de la facture."
      );
    }
  }


  async function handleIssueInvoice(
    invoice: Invoice
  ) {
    if (
      !invoice.issue_date ||
      !invoice.due_date
    ) {
      setError(
        "Merci de compléter la date de facture et la date d’échéance avant d’émettre cette facture."
      );

      openEditInvoice(invoice);

      return;
    }

    await changeStatus(
      invoice.id,
      "issued"
    );
  }


  // ==========================================================
  // PAYMENT MODAL
  // ==========================================================

  async function openPayment(
    invoice: Invoice
  ) {
    try {
      setError("");

      const data =
        await getInvoicePayments(
          invoice.id
        );

      setPaymentInvoice(invoice);
      setPayments(data);

      setPaymentAmount(
        String(invoice.amount_due)
      );

      setPaymentDate(
        new Date()
          .toISOString()
          .slice(0, 10)
      );

      setPaymentMethod(
        "bank_transfer"
      );

      setPaymentReference("");
      setPaymentNotes("");
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de charger l'historique des paiements."
      );
    }
  }


  function closePayment() {
    setPaymentInvoice(null);
    setPayments([]);
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentNotes("");
  }

  async function openRefund(
  invoice: Invoice
) {
  try {
    setError("");

    const data =
      await getInvoiceRefunds(
        invoice.id
      );

    setRefundInvoice(invoice);
    setRefunds(data);

    setRefundAmount(
      String(
        invoice.customer_credit || ""
      )
    );

    setRefundDate(
      new Date()
        .toISOString()
        .slice(0, 10)
    );

    setRefundMethod(
      "bank_transfer"
    );

    setRefundReference("");
    setRefundNotes("");
  } catch (err) {
    console.error(err);

    setError(
      "Impossible de charger les remboursements."
    );
  }
}


function closeRefund() {
  setRefundInvoice(null);
  setRefunds([]);
  setRefundAmount("");
  setRefundReference("");
  setRefundNotes("");
}


async function handleRefundSubmit(
  event: FormEvent
) {
  event.preventDefault();

  if (!refundInvoice) {
    return;
  }

  const amount =
    Number(refundAmount);

  const availableCredit =
    Number(
      refundInvoice.customer_credit || 0
    );

  if (amount <= 0) {
    setError(
      "Le montant du remboursement doit être supérieur à zéro."
    );
    return;
  }

  if (amount > availableCredit) {
    setError(
      "Le remboursement ne peut pas dépasser le crédit client disponible."
    );
    return;
  }

  try {
    setSavingRefund(true);
    setError("");

    await createInvoiceRefund(
      refundInvoice.id,
      {
        amount,
        refund_date:
          refundDate,
        refund_method:
          refundMethod || null,
        reference:
          refundReference || null,
        notes:
          refundNotes || null,
      }
    );

    const [
      updatedRefunds,
      updatedInvoices,
    ] = await Promise.all([
      getInvoiceRefunds(
        refundInvoice.id
      ),
      getInvoices(),
    ]);

    setRefunds(
      updatedRefunds
    );

    setInvoices(
      updatedInvoices
    );

    const updatedInvoice =
      updatedInvoices.find(
        (invoice) =>
          invoice.id ===
          refundInvoice.id
      );

    if (updatedInvoice) {
      setRefundInvoice(
        updatedInvoice
      );

      setRefundAmount(
        String(
          updatedInvoice.customer_credit || ""
        )
      );
    }

    setRefundReference("");
    setRefundNotes("");
  } catch (err) {
    console.error(err);

    setError(
      err instanceof Error
        ? err.message
        : "Impossible d'enregistrer le remboursement."
    );
  } finally {
    setSavingRefund(false);
  }
}


  async function openCreditNote(
    invoice: Invoice
  ) {
    try {
      setError("");

      const data =
        await getInvoiceCreditNotes(
          invoice.id
        );

      setCreditInvoice(invoice);
      setCreditNotes(data);

      setCreditAmount("");
      setCreditDate(
        new Date()
          .toISOString()
          .slice(0, 10)
      );
      setCreditReason("");
      setCreditNotesText("");
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de charger les avoirs."
      );
    }
  }


  function closeCreditNote() {
    setCreditInvoice(null);
    setCreditNotes([]);
    setCreditAmount("");
    setCreditReason("");
    setCreditNotesText("");
  }


  async function handleCreditNoteSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!creditInvoice) {
      return;
    }

    const amount =
      Number(creditAmount);

    if (amount <= 0) {
      setError(
        "Le montant de l'avoir doit être supérieur à zéro."
      );
      return;
    }

    const remainingCreditable =
      Number(creditInvoice.total) -
      Number(
        creditInvoice.credit_total || 0
      );

    if (amount > remainingCreditable) {
      setError(
        "Le montant de l'avoir dépasse le montant encore créditable."
      );
      return;
    }

    if (!creditReason.trim()) {
      setError(
        "Merci de renseigner le motif de l'avoir."
      );
      return;
    }

    try {
      setSavingCredit(true);
      setError("");

      await createInvoiceCreditNote(
        creditInvoice.id,
        {
          issue_date: creditDate,
          reason: creditReason,
          amount,
          notes:
            creditNotesText || null,
        }
      );

      const [
        updatedCreditNotes,
        updatedInvoices,
      ] = await Promise.all([
        getInvoiceCreditNotes(
          creditInvoice.id
        ),
        getInvoices(),
      ]);

      setCreditNotes(
        updatedCreditNotes
      );

      setInvoices(
        updatedInvoices
      );

      const updatedInvoice =
        updatedInvoices.find(
          (invoice) =>
            invoice.id ===
            creditInvoice.id
        );

      if (updatedInvoice) {
        setCreditInvoice(
          updatedInvoice
        );
      }

      setCreditAmount("");
      setCreditReason("");
      setCreditNotesText("");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer l'avoir."
      );
    } finally {
      setSavingCredit(false);
    }
  }


  function openPaymentAction(
    invoice: Invoice
  ) {
    const count =
      activitySummary[
        invoice.id
      ]?.payments ?? 0;

    if (count > 0) {
      setActivityPopup({
        invoice,
        type: "payment",
      });

      return;
    }

    openPayment(invoice);
  }


  function openReminderAction(
    invoice: Invoice
  ) {
    const count =
      activitySummary[
        invoice.id
      ]?.reminders ?? 0;

    if (count > 0) {
      setActivityPopup({
        invoice,
        type: "reminder",
      });

      return;
    }

    openReminder(invoice);
  }


  function openCreditNoteAction(
    invoice: Invoice
  ) {
    const count =
      activitySummary[
        invoice.id
      ]?.credit_notes ?? 0;

    if (count > 0) {
      setActivityPopup({
        invoice,
        type: "credit_note",
      });

      return;
    }

    openCreditNote(invoice);
  }


  function openRefundAction(
    invoice: Invoice
  ) {
    const count =
      activitySummary[
        invoice.id
      ]?.refunds ?? 0;

    if (count > 0) {
      setActivityPopup({
        invoice,
        type: "refund",
      });

      return;
    }

    openRefund(invoice);
  }


  async function openReminder(
    invoice: Invoice
  ) {
    try {
      setError("");

      const data =
        await getInvoiceReminders(
          invoice.id
        );

      setReminderInvoice(invoice);
      setReminders(data);

      setReminderDate(
        new Date()
          .toISOString()
          .slice(0, 10)
      );

      setReminderChannel("email");

      setReminderSubject(
        "Relance facture en attente de règlement"
      );

      setReminderMessage(
        "Bonjour, sauf erreur de notre part, cette facture reste à ce jour en attente de règlement."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de charger l'historique des relances."
      );
    }
  }


  function closeReminder() {
    setReminderInvoice(null);
    setReminders([]);
  }


  async function handleReminderSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!reminderInvoice) {
      return;
    }

    try {
      setSavingReminder(true);
      setError("");

      await createInvoiceReminder(
        reminderInvoice.id,
        {
          reminder_date:
            reminderDate,

          channel:
            reminderChannel,

          subject:
            reminderSubject || null,

          message:
            reminderMessage || null,
        }
      );

      const updated =
        await getInvoiceReminders(
          reminderInvoice.id
        );

      setReminders(updated);

      setReminderCounts(
        (current) => ({
          ...current,
          [reminderInvoice.id]:
            updated.length,
        })
      );

      if (reminderChannel === "email") {
        window.alert(
          `Relance envoyée avec succès pour ${reminderInvoice.invoice_number}.`
        );
      } else {
        window.alert(
          `Relance enregistrée avec succès pour ${reminderInvoice.invoice_number}.`
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer la relance."
      );
    } finally {
      setSavingReminder(false);
    }
  }


  async function handlePaymentSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!paymentInvoice) {
      return;
    }

    const amount =
      Number(paymentAmount);

    if (amount <= 0) {
      setError(
        "Le montant du paiement doit être supérieur à zéro."
      );

      return;
    }

    if (
      amount >
      Number(paymentInvoice.amount_due)
    ) {
      setError(
        "Le paiement ne peut pas dépasser le reste dû."
      );

      return;
    }

    try {
      setSavingPayment(true);
      setError("");

      await createPayment(
        paymentInvoice.id,
        {
          amount,

          payment_date:
            paymentDate,

          payment_method:
            paymentMethod,

          reference:
            paymentReference || null,

          notes:
            paymentNotes || null,
        }
      );

      const updatedInvoices =
        await getInvoices();

      setInvoices(
        updatedInvoices
      );

      const updatedInvoice =
        updatedInvoices.find(
          (invoice) =>
            invoice.id ===
            paymentInvoice.id
        );

      const updatedPayments =
        await getInvoicePayments(
          paymentInvoice.id
        );

      setPayments(
        updatedPayments
      );

      if (updatedInvoice) {
        setPaymentInvoice(
          updatedInvoice
        );

        setPaymentAmount(
          String(
            updatedInvoice.amount_due
          )
        );
      }

      setPaymentReference("");
      setPaymentNotes("");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer le paiement."
      );
    } finally {
      setSavingPayment(false);
    }
  }


  const invoiceMetrics = useMemo(() => {
    const activeInvoices =
      invoices.filter(
        (invoice) =>
          invoice.status !== "cancelled"
      );

    const invoicedAmount =
      activeInvoices.reduce(
        (total, invoice) =>
          total +
          Number(
            invoice.net_total ??
            invoice.total ??
            0
          ),
        0
      );

    const paidAmount =
      invoices.reduce(
        (total, invoice) =>
          total +
          Number(
            invoice.amount_paid || 0
          ),
        0
      );

    const outstandingAmount =
      invoices
        .filter(
          (invoice) =>
            ![
              "paid",
              "cancelled",
            ].includes(
              invoice.status
            )
        )
        .reduce(
          (total, invoice) =>
            total +
            Number(
              invoice.amount_due || 0
            ),
          0
        );

    const overdueInvoices =
      invoices.filter(
        (invoice) =>
          invoice.status ===
          "overdue"
      );

    const overdueAmount =
      overdueInvoices.reduce(
        (total, invoice) =>
          total +
          Number(
            invoice.amount_due || 0
          ),
        0
      );

    return {
      invoicedAmount,
      paidAmount,
      outstandingAmount,
      overdueCount:
        overdueInvoices.length,
      overdueAmount,
    };
  }, [invoices]);


  const filteredInvoices =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      const result =
        invoices.filter(
          (invoice) => {
            /*
             * Une facture ciblée depuis
             * Devis / BC reste toujours
             * accessible, même hors période.
             */
            if (
              targetInvoiceId &&
              invoice.id ===
                targetInvoiceId
            ) {
              return true;
            }

            if (
              !isInvoiceInPeriod(
                invoice,
                periodFilter
              )
            ) {
              return false;
            }

            if (
              dashboardStatusFilter &&
              invoice.status !==
                dashboardStatusFilter
            ) {
              return false;
            }

            if (
              dashboardDueFilter ===
                "outstanding" &&
              Number(
                invoice.amount_due || 0
              ) <= 0
            ) {
              return false;
            }

            if (dashboardClientFilter) {
              const client =
                getClient(invoice);

              if (
                !client ||
                client.id !==
                  dashboardClientFilter
              ) {
                return false;
              }
            }

            if (!query) {
              return true;
            }

            const quote =
              getQuote(invoice);

            const haystack = [
              invoice.invoice_number,
              getClientName(invoice),
              quote?.quote_number ?? "",
              getInvoiceStatusLabel(
                invoice.status
              ),
            ]
              .join(" ")
              .toLowerCase();

            return haystack.includes(
              query
            );
          }
        );

      /*
       * La facture ciblée est placée
       * en tête pour garantir sa présence
       * sur la première page.
       */
      if (targetInvoiceId) {
        return [...result].sort(
          (a, b) => {
            if (
              a.id === targetInvoiceId
            ) {
              return -1;
            }

            if (
              b.id === targetInvoiceId
            ) {
              return 1;
            }

            return 0;
          }
        );
      }

      return result;
    }, [
      invoices,
      search,
      quotes,
      requests,
      clients,
      periodFilter,
      targetInvoiceId,
      dashboardStatusFilter,
      dashboardDueFilter,
      dashboardClientFilter,
    ]);


  const sortedInvoices =
    useMemo(() => {
      const result = [
        ...filteredInvoices,
      ];

      result.sort((a, b) => {
        /*
         * Une facture ciblée depuis
         * Devis / BC reste prioritaire,
         * quel que soit le tri choisi.
         */
        if (targetInvoiceId) {
          if (
            a.id === targetInvoiceId
          ) {
            return -1;
          }

          if (
            b.id === targetInvoiceId
          ) {
            return 1;
          }
        }

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
          getInvoiceReferenceDate(
            a
          ).getTime();

        const dateB =
          getInvoiceReferenceDate(
            b
          ).getTime();

        if (sort === "date_asc") {
          return dateA - dateB;
        }

        return dateB - dateA;
      });

      return result;
    }, [
      filteredInvoices,
      sort,
      targetInvoiceId,
    ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedInvoices.length /
          pageSize
      )
    );


  const paginatedInvoices =
    useMemo(() => {
      const safePage =
        Math.min(
          currentPage,
          totalPages
        );

      const start =
        (safePage - 1) *
        pageSize;

      return sortedInvoices.slice(
        start,
        start + pageSize
      );
    }, [
      sortedInvoices,
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



  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">
            Facturation
          </span>

          <h1>Factures</h1>

          <p>
            Préparez, émettez et suivez
            vos factures et encaissements.
          </p>
        </div>
      </div>


      {(dashboardStatusFilter ||
        dashboardDueFilter ||
        dashboardClientFilter) && (
        <div className="business-context-filter">
          <div>
            <span>
              Vue pilotée
            </span>

            <strong>
              {dashboardClientFilter
                ? `Factures du client ${
                    clients.find(
                      (client) =>
                        client.id ===
                        dashboardClientFilter
                    )?.company_name ??
                    "sélectionné"
                  }`
                : dashboardStatusFilter ===
                    "overdue"
                  ? "Factures en retard"
                  : dashboardDueFilter ===
                      "outstanding"
                    ? "Factures avec solde restant"
                    : "Filtre métier actif"}
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


      <section className="invoice-kpi-grid df-premium-kpi-grid">
        <article className="df-premium-kpi-card" data-tone="primary">
          <span>Montant facturé</span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  invoiceMetrics.invoicedAmount
                )}
          </strong>

          <small>
            Factures hors annulations
          </small>
        </article>

        <article className="df-premium-kpi-card" data-tone="success">
          <span>Encaissé</span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  invoiceMetrics.paidAmount
                )}
          </strong>

          <small>
            Paiements enregistrés
          </small>
        </article>

        <article
            className="df-premium-kpi-card"
            data-tone={
              invoiceMetrics.outstandingAmount > 0
                ? "cyan"
                : "neutral"
            }
          >
          <span>Reste à encaisser</span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  invoiceMetrics.outstandingAmount
                )}
          </strong>

          <small>
            Solde encore dû
          </small>
        </article>

        <article
            className="df-premium-kpi-card"
            data-tone={
              invoiceMetrics.overdueCount > 0
                ? "danger"
                : "neutral"
            }
          >
          <span>En retard</span>

          <strong>
            {loading
              ? "—"
              : invoiceMetrics.overdueCount}
          </strong>

          <small>
            {loading
              ? "—"
              : `${formatCurrency(
                  invoiceMetrics.overdueAmount
                )} à relancer`}
          </small>
        </article>
      </section>


      <section className="table-card">
        <div className="client-list-header">
          <div>
            <h2>
              Suivi des factures
            </h2>

            <p>
              {loading
                ? "Chargement..."
                : `${filteredInvoices.length} facture${
                    filteredInvoices.length > 1
                      ? "s"
                      : ""
                  } dans cette vue`}
            </p>
          </div>

          <input
            className="client-search"
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
                  event.target.value as InvoiceSort
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
            Chargement des factures...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="smart-empty-state">
            <strong>
              Aucune facture dans cette période.
            </strong>

            <span>
              Essayez une autre période ou affichez
              toutes les factures.
            </span>
          </div>
        ) : (
          <div className="table-scroll">
<table className="data-table invoice-table df-premium-table">
            <thead>
              <tr>
                <th>Facture</th>
                <th>Client</th>
                <th>Devis</th>
                <th>Origine</th>
                <th>Type</th>
                <th>Total TTC</th>
                <th>Payé</th>
                <th>Reste dû</th>
                <th>Échéance</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedInvoices.map(
                (invoice) => {
                  const quote =
                    getQuote(invoice);

                  return (
                    <tr
                      key={invoice.id}
                      id={`invoice-row-${invoice.id}`}
                      className={`business-row invoice-business-row ${getInvoiceBusinessClass(
                        invoice.status
                      )} ${
                        highlightedInvoiceId ===
                        invoice.id
                          ? "invoice-row-targeted"
                          : ""
                      }`}
                    >
                      <td>
                        <strong>
                          {
                            invoice.invoice_number
                          }
                        </strong>
                      </td>

                      <td>
                          <span
                            className="df-cell-truncate"
                            title={getClientName(invoice)}
                          >
                            {getClientName(invoice)}
                          </span>
                        </td>


                      <td>
                          <span
                            className="df-cell-truncate"
                            title={quote?.quote_number ?? undefined}
                          >
                            {quote?.quote_number ?? "—"}
                          </span>
                        </td>

                        <td>
                          {
                            invoice.recurring_invoice_id
                              ? "Récurrence"
                              : "Devis"
                          }
                        </td>

                        <td>
                          {
                            invoice.invoice_type ===
                            "deposit"
                              ? "Acompte"
                              : invoice.invoice_type ===
                                  "balance"
                                ? "Solde"
                                : "Standard"
                          }
                        </td>


                      <td>
                        <strong>
                          {formatCurrency(
                            invoice.total
                          )}
                        </strong>
                      </td>

                      <td>
                        {formatCurrency(
                          invoice.amount_paid
                        )}
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(
                            invoice.amount_due
                          )}
                        </strong>
                      </td>

                      <td>
                        {formatDate(
                          invoice.due_date
                        )}
                      </td>

                      <td>
                        <div className="document-status-cell">
                          <span
                            className={`status-badge ${getInvoiceStatusClass(
                              invoice.status
                            )}`}
                          >
                            {getInvoiceStatusLabel(
                              invoice.status
                            )}
                          </span>

                          <DocumentEmailTrace
                            documentType="invoice"
                            documentId={invoice.id}
                            documentStatus={invoice.status}
                          />
                        </div>
                      </td>

                      <td>
                        <div className="quote-actions business-row-actions df-table-actions">

                          {invoice.status === "draft" && (
                            <>
                              <button
                                className="business-button business-button-primary business-button-sm business-primary-action"
                                onClick={() =>
                                  handleIssueInvoice(
                                    invoice
                                  )
                                }
                              >
                                Émettre
                              </button>

                              <RowActionsMenu>
                                <button
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    openEditInvoice(
                                      invoice
                                    )
                                  }
                                >
                                  Modifier
                                </button>

                                <button
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    openPdf(
                                      invoice.id
                                    )
                                  }
                                >
                                  PDF
                                </button>

                                <button
                                  type="button"
                                  className="business-button business-button-danger business-button-sm"
                                  onClick={() =>
                                    handleDeleteInvoice(
                                      invoice
                                    )
                                  }
                                >
                                  Supprimer
                                </button>
                              </RowActionsMenu>
                            </>
                          )}


                          {invoice.status === "issued" && (
                            <>
                              <button
                                type="button"
                                className="business-button business-button-cyan business-button-sm business-primary-action"
                                disabled={
                                  sendingInvoiceId ===
                                  invoice.id
                                }
                                onClick={() =>
                                  handleSendInvoice(
                                    invoice
                                  )
                                }
                              >
                                {sendingInvoiceId ===
                                invoice.id
                                  ? "Envoi..."
                                  : "Envoyer la facture"}
                              </button>

                              <RowActionsMenu>
                                <button
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    openPdf(
                                      invoice.id
                                    )
                                  }
                                >
                                  PDF
                                </button>
                              </RowActionsMenu>
                            </>
                          )}


                          {[
                            "sent",
                            "partial",
                          ].includes(
                            invoice.status
                          ) && (
                            <>
                              <button
                                className="business-button business-button-primary business-button-sm business-primary-action"
                                onClick={() =>
                                  openPaymentAction(
                                    invoice
                                  )
                                }
                              >
                                {(activitySummary[
                                  invoice.id
                                ]?.payments ?? 0) > 0
                                  ? `Paiement ${
                                      activitySummary[
                                        invoice.id
                                      ]?.payments ?? 0
                                    }`
                                  : "Enregistrer paiement"}
                              </button>

                              <RowActionsMenu>
                                <button
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    openPdf(
                                      invoice.id
                                    )
                                  }
                                >
                                  PDF
                                </button>

                                {(activitySummary[
                                  invoice.id
                                ]?.emails ?? 0) > 0 && (
                                  <button
                                    type="button"
                                    className="business-button business-button-secondary business-button-sm"
                                    onClick={() =>
                                      setActivityPopup({
                                        invoice,
                                        type: "email",
                                      })
                                    }
                                  >
                                    Envoi {
                                      activitySummary[
                                        invoice.id
                                      ]?.emails ?? 0
                                    }
                                  </button>
                                )}

                                <button
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    openCreditNoteAction(
                                      invoice
                                    )
                                  }
                                >
                                  {(activitySummary[
                                    invoice.id
                                  ]?.credit_notes ?? 0) > 0
                                    ? `Avoir ${
                                        activitySummary[
                                          invoice.id
                                        ]?.credit_notes ?? 0
                                      }`
                                    : "Avoir"}
                                </button>

                                {Number(
                                  invoice.customer_credit || 0
                                ) > 0 && (
                                  <button
                                    className="business-button business-button-secondary business-button-sm"
                                    onClick={() =>
                                      openRefundAction(
                                        invoice
                                      )
                                    }
                                  >
                                    {(activitySummary[
                                      invoice.id
                                    ]?.refunds ?? 0) > 0
                                      ? `Remboursement ${
                                          activitySummary[
                                            invoice.id
                                          ]?.refunds ?? 0
                                        }`
                                      : "Rembourser"}
                                  </button>
                                )}
                              </RowActionsMenu>
                            </>
                          )}


                          {invoice.status === "overdue" && (
                            <>
                              <button
                                className="business-button business-button-primary business-button-sm business-primary-action"
                                onClick={() =>
                                  openPaymentAction(
                                    invoice
                                  )
                                }
                              >
                                {(activitySummary[
                                  invoice.id
                                ]?.payments ?? 0) > 0
                                  ? `Paiement ${
                                      activitySummary[
                                        invoice.id
                                      ]?.payments ?? 0
                                    }`
                                  : "Enregistrer paiement"}
                              </button>

                              <button
                                className="business-button business-button-warning business-button-sm business-complementary-action"
                                onClick={() =>
                                  openReminderAction(
                                    invoice
                                  )
                                }
                              >
                                {(reminderCounts[
                                  invoice.id
                                ] ?? 0) > 0
                                  ? `Relance ${
                                      reminderCounts[
                                        invoice.id
                                      ]
                                    }`
                                  : "Relancer"}
                              </button>

                              <RowActionsMenu>
                                <button
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    openPdf(
                                      invoice.id
                                    )
                                  }
                                >
                                  PDF
                                </button>

                                {(activitySummary[
                                  invoice.id
                                ]?.emails ?? 0) > 0 && (
                                  <button
                                    type="button"
                                    className="business-button business-button-secondary business-button-sm"
                                    onClick={() =>
                                      setActivityPopup({
                                        invoice,
                                        type: "email",
                                      })
                                    }
                                  >
                                    Envoi {
                                      activitySummary[
                                        invoice.id
                                      ]?.emails ?? 0
                                    }
                                  </button>
                                )}

                                <button
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    openCreditNoteAction(
                                      invoice
                                    )
                                  }
                                >
                                  {(activitySummary[
                                    invoice.id
                                  ]?.credit_notes ?? 0) > 0
                                    ? `Avoir ${
                                        activitySummary[
                                          invoice.id
                                        ]?.credit_notes ?? 0
                                      }`
                                    : "Avoir"}
                                </button>

                                {Number(
                                  invoice.customer_credit || 0
                                ) > 0 && (
                                  <button
                                    className="business-button business-button-secondary business-button-sm"
                                    onClick={() =>
                                      openRefundAction(
                                        invoice
                                      )
                                    }
                                  >
                                    {(activitySummary[
                                      invoice.id
                                    ]?.refunds ?? 0) > 0
                                      ? `Remboursement ${
                                          activitySummary[
                                            invoice.id
                                          ]?.refunds ?? 0
                                        }`
                                      : "Rembourser"}
                                  </button>
                                )}
                              </RowActionsMenu>
                            </>
                          )}


                          {invoice.status === "paid" && (
                            <>
                              <button
                                className="business-button business-button-secondary business-button-sm business-primary-action"
                                onClick={() =>
                                  openPaymentAction(
                                    invoice
                                  )
                                }
                              >
                                Historique
                              </button>

                              <RowActionsMenu>
                                <button
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    openPdf(
                                      invoice.id
                                    )
                                  }
                                >
                                  PDF
                                </button>

                                {(activitySummary[
                                  invoice.id
                                ]?.emails ?? 0) > 0 && (
                                  <button
                                    type="button"
                                    className="business-button business-button-secondary business-button-sm"
                                    onClick={() =>
                                      setActivityPopup({
                                        invoice,
                                        type: "email",
                                      })
                                    }
                                  >
                                    Envoi {
                                      activitySummary[
                                        invoice.id
                                      ]?.emails ?? 0
                                    }
                                  </button>
                                )}

                                <button
                                  className="business-button business-button-secondary business-button-sm"
                                  onClick={() =>
                                    openCreditNoteAction(
                                      invoice
                                    )
                                  }
                                >
                                  {(activitySummary[
                                    invoice.id
                                  ]?.credit_notes ?? 0) > 0
                                    ? `Avoir ${
                                        activitySummary[
                                          invoice.id
                                        ]?.credit_notes ?? 0
                                      }`
                                    : "Avoir"}
                                </button>

                                {Number(
                                  invoice.customer_credit || 0
                                ) > 0 && (
                                  <button
                                    className="business-button business-button-secondary business-button-sm"
                                    onClick={() =>
                                      openRefundAction(
                                        invoice
                                      )
                                    }
                                  >
                                    {(activitySummary[
                                      invoice.id
                                    ]?.refunds ?? 0) > 0
                                      ? `Remboursement ${
                                          activitySummary[
                                            invoice.id
                                          ]?.refunds ?? 0
                                        }`
                                      : "Rembourser"}
                                  </button>
                                )}
                              </RowActionsMenu>
                            </>
                          )}


                          {invoice.status === "cancelled" && (
                            <button
                              className="business-button business-button-secondary business-button-sm"
                              onClick={() =>
                                openPdf(
                                  invoice.id
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
                }
              )}
            </tbody>
          </table>
              </div>
            
        )}


        {!loading &&
          filteredInvoices.length > 0 && (
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


      {/* ====================================================
          EDIT INVOICE
         ==================================================== */}

      {editingInvoice && (
        <div className="payment-modal-backdrop">
          <div className="payment-modal">

            <div className="payment-modal-header">
              <div>
                <span className="eyebrow">
                  Préparation
                </span>

                <h2>
                  {
                    editingInvoice.invoice_number
                  }
                </h2>

                <p>
                  Complétez les informations
                  avant émission.
                </p>
              </div>

              <button
                type="button"
                className="business-button business-button-secondary"
                onClick={
                  closeEditInvoice
                }
              >
                Fermer
              </button>
            </div>


            <form
              className="payment-form"
              onSubmit={
                handleInvoiceSubmit
              }
            >
              <h3>
                Informations de facturation
              </h3>

              <div className="payment-form-grid">

                <label>
                  Date de facture

                  <input
                    type="date"
                    required
                    value={
                      issueDate
                    }
                    onChange={(
                      event
                    ) =>
                      setIssueDate(
                        event.target.value
                      )
                    }
                  />
                </label>


                <label>
                  Date d’échéance

                  <input
                    type="date"
                    required
                    min={
                      issueDate ||
                      undefined
                    }
                    value={
                      dueDate
                    }
                    onChange={(
                      event
                    ) =>
                      setDueDate(
                        event.target.value
                      )
                    }
                  />
                </label>


                <label className="payment-notes">
                  Conditions de paiement

                  <input
                    value={
                      paymentTerms
                    }
                    placeholder="Ex. Paiement sous 30 jours par virement"
                    onChange={(
                      event
                    ) =>
                      setPaymentTerms(
                        event.target.value
                      )
                    }
                  />
                </label>


                <label className="payment-notes">
                  Notes

                  <textarea
                    rows={4}
                    value={
                      invoiceNotes
                    }
                    placeholder="Informations complémentaires..."
                    onChange={(
                      event
                    ) =>
                      setInvoiceNotes(
                        event.target.value
                      )
                    }
                  />
                </label>

              </div>


              <button
                type="submit"
                className="business-button business-button-primary"
                disabled={
                  savingInvoice
                }
              >
                {savingInvoice
                  ? "Enregistrement..."
                  : "Enregistrer la facture"}
              </button>
            </form>

          </div>
        </div>
      )}

    {/* ====================================================
    REFUNDS
   ==================================================== */}

{refundInvoice && (
  <div className="payment-modal-backdrop">
    <div className="payment-modal">

      <div className="payment-modal-header">
        <div>
          <span className="eyebrow">
            Remboursement
          </span>

          <h2>
            {refundInvoice.invoice_number}
          </h2>

          <p>
            Crédit client disponible :{" "}
            <strong>
              {formatCurrency(
                refundInvoice.customer_credit || 0
              )}
            </strong>
          </p>
        </div>

        <button
          type="button"
          className="business-button business-button-secondary"
          onClick={closeRefund}
        >
          Fermer
        </button>
      </div>


      <form
        className="payment-form"
        onSubmit={
          handleRefundSubmit
        }
      >
        <h3>
          Enregistrer un remboursement
        </h3>

        <div className="payment-form-grid">

          <label>
            Montant

            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={refundAmount}
              onChange={(event) =>
                setRefundAmount(
                  event.target.value
                )
              }
            />
          </label>


          <label>
            Date

            <input
              type="date"
              required
              value={refundDate}
              onChange={(event) =>
                setRefundDate(
                  event.target.value
                )
              }
            />
          </label>


          <label>
            Mode

            <select
              value={refundMethod}
              onChange={(event) =>
                setRefundMethod(
                  event.target.value
                )
              }
            >
              <option value="bank_transfer">
                Virement bancaire
              </option>

              <option value="card">
                Carte
              </option>

              <option value="cash">
                Espèces
              </option>

              <option value="other">
                Autre
              </option>
            </select>
          </label>


          <label>
            Référence

            <input
              value={refundReference}
              placeholder="Ex. REM-2026-001"
              onChange={(event) =>
                setRefundReference(
                  event.target.value
                )
              }
            />
          </label>


          <label className="payment-notes">
            Notes

            <textarea
              rows={4}
              value={refundNotes}
              placeholder="Informations complémentaires..."
              onChange={(event) =>
                setRefundNotes(
                  event.target.value
                )
              }
            />
          </label>

        </div>


        <button
          type="submit"
          className="business-button business-button-primary"
          disabled={savingRefund}
        >
          {savingRefund
            ? "Enregistrement..."
            : "Rembourser"}
        </button>
      </form>


      <div className="payment-history">
        <h3>
          Historique des remboursements
        </h3>

        {refunds.length === 0 ? (
          <p>
            Aucun remboursement enregistré.
          </p>
        ) : (
          <div className="payment-history-list">
            {refunds.map(
              (refund, index) => (
                <div
                  className="payment-history-item"
                  key={refund.id}
                >
                  <div>
                    <strong>
                      Remboursement #{index + 1}
                    </strong>

                    <span>
                      {formatDate(
                        refund.refund_date
                      )}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {formatCurrency(
                        refund.amount
                      )}
                    </strong>

                    <span>
                      {refund.refund_method || "—"}
                    </span>
                  </div>

                  {refund.reference && (
                    <p>
                      Référence :{" "}
                      {refund.reference}
                    </p>
                  )}

                  {refund.notes && (
                    <p>
                      {refund.notes}
                    </p>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

    </div>
  </div>
)}

      {/* ====================================================
          CREDIT NOTES
         ==================================================== */}

      {creditInvoice && (
        <div className="payment-modal-backdrop">
          <div className="payment-modal">

            <div className="payment-modal-header">
              <div>
                <span className="eyebrow">
                  Avoir
                </span>

                <h2>
                  {creditInvoice.invoice_number}
                </h2>

                <p>
                  Total original :{" "}
                  <strong>
                    {formatCurrency(
                      creditInvoice.total
                    )}
                  </strong>

                  {" · "}

                  Avoirs :{" "}
                  <strong>
                    {formatCurrency(
                      creditInvoice.credit_total || 0
                    )}
                  </strong>

                  {" · "}

                  Net :{" "}
                  <strong>
                    {formatCurrency(
                      creditInvoice.net_total ||
                      creditInvoice.total
                    )}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                className="business-button business-button-secondary"
                onClick={closeCreditNote}
              >
                Fermer
              </button>
            </div>

            <form
              className="payment-form"
              onSubmit={
                handleCreditNoteSubmit
              }
            >
              <h3>
                Créer un avoir
              </h3>

              <div className="payment-form-grid">

                <label>
                  Montant

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={creditAmount}
                    onChange={(event) =>
                      setCreditAmount(
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Date

                  <input
                    type="date"
                    required
                    value={creditDate}
                    onChange={(event) =>
                      setCreditDate(
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="payment-notes">
                  Motif

                  <input
                    required
                    value={creditReason}
                    placeholder="Ex. Correction partielle de facturation"
                    onChange={(event) =>
                      setCreditReason(
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="payment-notes">
                  Notes

                  <textarea
                    rows={4}
                    value={creditNotesText}
                    placeholder="Informations complémentaires..."
                    onChange={(event) =>
                      setCreditNotesText(
                        event.target.value
                      )
                    }
                  />
                </label>

              </div>

              <button
                type="submit"
                className="business-button business-button-primary"
                disabled={savingCredit}
              >
                {savingCredit
                  ? "Création..."
                  : "Créer l'avoir"}
              </button>
            </form>

            <div className="payment-history">
              <h3>
                Synthèse
              </h3>

              <div className="payment-history-list">
                <div className="payment-history-item">
                  <div>
                    <span>Total original</span>
                    <strong>
                      {formatCurrency(
                        creditInvoice.total
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Avoirs</span>
                    <strong>
                      {formatCurrency(
                        creditInvoice.credit_total || 0
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Net facturé</span>
                    <strong>
                      {formatCurrency(
                        creditInvoice.net_total ||
                        creditInvoice.total
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Payé</span>
                    <strong>
                      {formatCurrency(
                        creditInvoice.amount_paid
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Reste dû</span>
                    <strong>
                      {formatCurrency(
                        creditInvoice.amount_due
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Crédit client</span>
                    <strong>
                      {formatCurrency(
                        creditInvoice.customer_credit || 0
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="payment-history">
              <h3>
                Historique des avoirs
              </h3>

              {creditNotes.length === 0 ? (
                <p>
                  Aucun avoir enregistré.
                </p>
              ) : (
                <div className="payment-history-list">
                  {creditNotes.map(
                    (credit, index) => (
                      <div
                        className="payment-history-item"
                        key={credit.id}
                      >
                        <div>
                          <strong>
                            {credit.credit_note_number}
                          </strong>

                          <span>
                            Avoir #{index + 1}
                            {" · "}
                            {formatDate(
                              credit.issue_date
                            )}
                          </span>
                        </div>

                        <div>
                          <strong>
                            {formatCurrency(
                              credit.amount
                            )}
                          </strong>

                          <span>
                            {credit.reason}
                          </span>
                        </div>

                        {credit.notes && (
                          <p>
                            {credit.notes}
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}


      {/* ====================================================
          REMINDERS
         ==================================================== */}

      {reminderInvoice && (
        <div className="payment-modal-backdrop">
          <div className="payment-modal">

            <div className="payment-modal-header">
              <div>
                <span className="eyebrow">
                  Relance client
                </span>

                <h2>
                  {
                    reminderInvoice.invoice_number
                  }
                </h2>

                <p>
                  Reste dû :{" "}
                  <strong>
                    {formatCurrency(
                      reminderInvoice.amount_due
                    )}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                className="business-button business-button-secondary"
                onClick={closeReminder}
              >
                Fermer
              </button>
            </div>


            <form
              className="payment-form"
              onSubmit={
                handleReminderSubmit
              }
            >
              <h3>
                Nouvelle relance
              </h3>

              <div className="payment-form-grid">

                <label>
                  Date

                  <input
                    type="date"
                    required
                    value={
                      reminderDate
                    }
                    onChange={(
                      event
                    ) =>
                      setReminderDate(
                        event.target.value
                      )
                    }
                  />
                </label>


                <label>
                  Canal

                  <select
                    value={
                      reminderChannel
                    }
                    onChange={(
                      event
                    ) =>
                      setReminderChannel(
                        event.target.value
                      )
                    }
                  >
                    <option value="email">
                      Email
                    </option>

                    <option value="phone">
                      Téléphone
                    </option>

                    <option value="sms">
                      SMS
                    </option>

                    <option value="other">
                      Autre
                    </option>
                  </select>
                </label>


                <label className="payment-notes">
                  Objet

                  <input
                    value={
                      reminderSubject
                    }
                    onChange={(
                      event
                    ) =>
                      setReminderSubject(
                        event.target.value
                      )
                    }
                  />
                </label>


                <label className="payment-notes">
                  Message

                  <textarea
                    rows={5}
                    value={
                      reminderMessage
                    }
                    onChange={(
                      event
                    ) =>
                      setReminderMessage(
                        event.target.value
                      )
                    }
                  />
                </label>

              </div>


              <button
                type="submit"
                className="business-button business-button-primary"
                disabled={
                  savingReminder
                }
              >
                {savingReminder
                  ? reminderChannel === "email"
                    ? "Envoi..."
                    : "Enregistrement..."
                  : reminderChannel === "email"
                    ? "Envoyer la relance"
                    : "Enregistrer la relance"}
              </button>
            </form>


            <div className="payment-history">
              <h3>
                Historique des relances
              </h3>

              {reminders.length === 0 ? (
                <p>
                  Aucune relance enregistrée.
                </p>
              ) : (
                <div className="payment-history-list">
                  {reminders.map(
                    (
                      reminder,
                      index
                    ) => (
                      <div
                        className="payment-history-item"
                        key={
                          reminder.id
                        }
                      >
                        <div>
                          <strong>
                            Relance #
                            {index + 1}
                          </strong>

                          <span>
                            {formatDate(
                              reminder.reminder_date
                            )}
                          </span>
                        </div>

                        <div>
                          <strong>
                            {
                              reminder.channel
                            }
                          </strong>

                          <span>
                            {
                              reminder.subject ||
                              "Sans objet"
                            }
                          </span>
                        </div>

                        {reminder.message && (
                          <p>
                            {
                              reminder.message
                            }
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}


      {activityPopup && (
        <InvoiceActivityPopup
          invoiceId={activityPopup.invoice.id}
          invoiceNumber={
            activityPopup.invoice.invoice_number
          }
          type={activityPopup.type}
          onClose={() =>
            setActivityPopup(null)
          }
          actionLabel={
            activityPopup.type === "payment"
              ? "Enregistrer un paiement"
              : activityPopup.type === "reminder"
                ? "Nouvelle relance"
                : activityPopup.type === "credit_note"
                  ? "Nouvel avoir"
                  : activityPopup.type === "refund"
                    ? "Nouveau remboursement"
                    : undefined
          }
          onAction={
            activityPopup.type === "email"
              ? undefined
              : () => {
                  const {
                    invoice,
                    type,
                  } = activityPopup;

                  setActivityPopup(null);

                  if (type === "payment") {
                    openPayment(invoice);
                  }

                  if (type === "reminder") {
                    openReminder(invoice);
                  }

                  if (type === "credit_note") {
                    openCreditNote(invoice);
                  }

                  if (type === "refund") {
                    openRefund(invoice);
                  }
                }
          }
        />
      )}


      {/* ====================================================
          PAYMENT
         ==================================================== */}

      {paymentInvoice && (
        <div className="payment-modal-backdrop">
          <div className="payment-modal">

            <div className="payment-modal-header">
              <div>
                <span className="eyebrow">
                  Encaissement
                </span>

                <h2>
                  {
                    paymentInvoice.invoice_number
                  }
                </h2>

                <p>
                  Total :{" "}
                  <strong>
                    {formatCurrency(
                      paymentInvoice.total
                    )}
                  </strong>

                  {" · "}

                  Payé :{" "}
                  <strong>
                    {formatCurrency(
                      paymentInvoice.amount_paid
                    )}
                  </strong>

                  {" · "}

                  Reste dû :{" "}
                  <strong>
                    {formatCurrency(
                      paymentInvoice.amount_due
                    )}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                className="business-button business-button-secondary"
                onClick={closePayment}
              >
                Fermer
              </button>
            </div>


            {Number(
              paymentInvoice.amount_due
            ) > 0 && (
              <form
                className="payment-form"
                onSubmit={
                  handlePaymentSubmit
                }
              >
                <h3>
                  Enregistrer un paiement
                </h3>

                <div className="payment-form-grid">

                  <label>
                    Montant

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={Number(
                        paymentInvoice.amount_due
                      )}
                      required
                      value={
                        paymentAmount
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentAmount(
                          event.target.value
                        )
                      }
                    />
                  </label>


                  <label>
                    Date

                    <input
                      type="date"
                      required
                      value={
                        paymentDate
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentDate(
                          event.target.value
                        )
                      }
                    />
                  </label>


                  <label>
                    Mode de paiement

                    <select
                      value={
                        paymentMethod
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentMethod(
                          event.target.value
                        )
                      }
                    >
                      <option value="bank_transfer">
                        Virement bancaire
                      </option>

                      <option value="card">
                        Carte bancaire
                      </option>

                      <option value="cash">
                        Espèces
                      </option>

                      <option value="check">
                        Chèque
                      </option>

                      <option value="other">
                        Autre
                      </option>
                    </select>
                  </label>


                  <label>
                    Référence

                    <input
                      value={
                        paymentReference
                      }
                      placeholder="Ex. VIR-002"
                      onChange={(
                        event
                      ) =>
                        setPaymentReference(
                          event.target.value
                        )
                      }
                    />
                  </label>


                  <label className="payment-notes">
                    Note

                    <input
                      value={
                        paymentNotes
                      }
                      placeholder="Ex. Solde de la facture"
                      onChange={(
                        event
                      ) =>
                        setPaymentNotes(
                          event.target.value
                        )
                      }
                    />
                  </label>

                </div>


                <button
                  type="submit"
                  className="business-button business-button-primary"
                  disabled={
                    savingPayment
                  }
                >
                  {savingPayment
                    ? "Enregistrement..."
                    : "Enregistrer le paiement"}
                </button>
              </form>
            )}


            <div className="payment-history">
              <h3>
                Historique des paiements
              </h3>

              {payments.length === 0 ? (
                <p>
                  Aucun paiement enregistré.
                </p>
              ) : (
                <div className="payment-history-list">
                  {payments
                    .slice()
                    .reverse()
                    .map(
                      (
                        payment,
                        index
                      ) => (
                        <div
                          className="payment-history-item"
                          key={
                            payment.id
                          }
                        >
                          <div>
                            <strong>
                              Paiement #
                              {index + 1}
                            </strong>

                            <span>
                              {formatDate(
                                payment.payment_date
                              )}
                            </span>
                          </div>

                          <div>
                            <strong>
                              {formatCurrency(
                                payment.amount
                              )}
                            </strong>

                            <span>
                              {payment.reference ||
                                "Sans référence"}
                            </span>
                          </div>

                          {payment.notes && (
                            <p>
                              {
                                payment.notes
                              }
                            </p>
                          )}
                        </div>
                      )
                    )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
