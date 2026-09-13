import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  getClients,
  getInvoices,
  getQuotes,
  getRequests,
} from "../services/api";

import type {
  Client,
  Invoice,
  Quote,
  Request,
} from "../types";

import StarterDashboardWidgets from "../components/dashboard/StarterDashboardWidgets";

import IntelligenceForecasting from "../components/intelligence/IntelligenceForecasting";
import IntelligenceAdvancedAutomation from "../components/intelligence/IntelligenceAdvancedAutomation";

import {
  getRecurringInvoices,
  type RecurringInvoice,
} from "../services/recurringInvoicesService";

import {
  getReminderCockpit,
  type PaymentReminderCockpitItem,
} from "../services/remindersService";


import {
  getInvoicePayments,
  type Payment,
} from "../services/paymentsService";

import IntelligenceCopilot from "../components/intelligence/IntelligenceCopilot";

const CURRENCY = "CHF";


function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}


export default function DashboardPage() {
  const navigate = useNavigate();

  const [searchParams] =
  useSearchParams();

const requestedIntelligence =
  searchParams.get(
    "intelligence"
  );

  const [clients, setClients] =
    useState<Client[]>([]);

  const [requests, setRequests] =
    useState<Request[]>([]);

  const [quotes, setQuotes] =
    useState<Quote[]>([]);

  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [
    recurringInvoices,
    setRecurringInvoices,
  ] = useState<RecurringInvoice[]>([]);

  const [
    reminderCockpit,
    setReminderCockpit,
  ] = useState<PaymentReminderCockpitItem[]>([]);

  const [
    payments,
    setPayments,
  ] = useState<Payment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const results =
          await Promise.allSettled([
            getClients(),
            getRequests(),
            getQuotes(),
            getInvoices(),
            getRecurringInvoices(),
            getReminderCockpit(),
          ]);

        const [
          clientsResult,
          requestsResult,
          quotesResult,
          invoicesResult,
          recurringInvoicesResult,
          reminderCockpitResult,
        ] = results;

        const clientsData =
          clientsResult.status === "fulfilled"
            ? clientsResult.value
            : [];

        const requestsData =
          requestsResult.status === "fulfilled"
            ? requestsResult.value
            : [];

        const quotesData =
          quotesResult.status === "fulfilled"
            ? quotesResult.value
            : [];

        const invoicesData =
          invoicesResult.status === "fulfilled"
            ? invoicesResult.value
            : [];

        const recurringInvoicesData =
          recurringInvoicesResult.status === "fulfilled"
            ? recurringInvoicesResult.value
            : [];

        const reminderCockpitData =
          reminderCockpitResult.status === "fulfilled"
            ? reminderCockpitResult.value
            : [];

        setClients(clientsData);
        setRequests(requestsData);
        setQuotes(quotesData);
        setInvoices(invoicesData);

        const paymentResults =
          await Promise.allSettled(
            invoicesData.map(
              (invoice) =>
                getInvoicePayments(
                  invoice.id
                )
            )
          );

        const paymentGroups =
          paymentResults
            .filter(
              (
                result
              ): result is PromiseFulfilledResult<
                Payment[]
              > =>
                result.status
                === "fulfilled"
            )
            .map(
              (result) =>
                result.value
            );

        setPayments(
          paymentGroups.flat()
        );

        setRecurringInvoices(
          recurringInvoicesData
        );

        setReminderCockpit(
          reminderCockpitData
        );

        const failedSources =
          results.filter(
            (result) =>
              result.status === "rejected"
          );

        if (failedSources.length > 0) {
          console.warn(
            "Dashboard partiellement chargé :",
            failedSources
          );

          setError(
            "Certaines données du dashboard sont temporairement indisponibles."
          );
        }
      } catch (err) {
        console.error(err);

        setError(
          "Impossible de charger les données du dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);


  useEffect(() => {
    if (!requestedIntelligence) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          const element =
            document.getElementById(
              "dashboard-intelligence"
            );

          element?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        },
        250
      );

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    requestedIntelligence,
  ]);


  const metrics = useMemo(() => {
    const activeInvoices =
      invoices.filter(
        (invoice) =>
          invoice.status !== "cancelled"
      );


    const revenue =
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


    const collected =
      activeInvoices.reduce(
        (total, invoice) =>
          total +
          Number(
            invoice.amount_paid || 0
          ),
        0
      );


    const outstanding =
      activeInvoices.reduce(
        (total, invoice) =>
          total +
          Number(
            invoice.amount_due || 0
          ),
        0
      );


    const overdueInvoices =
      activeInvoices.filter(
        (invoice) =>
          invoice.status === "overdue"
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


    const collectionRate =
      revenue > 0
        ? Math.min(
            100,
            Math.max(
              0,
              (collected / revenue) * 100
            )
          )
        : 0;


    return {
      revenue,
      collected,
      outstanding,
      overdueAmount,
      overdueCount:
        overdueInvoices.length,
      collectionRate,
    };
  }, [invoices]);


  return (
    <div className="dashboard-page">

      <div className="page-header">
        <div>
          <span className="eyebrow">
            Vue d'ensemble
          </span>

          <h1>Dashboard</h1>

          <p>
            Pilotez votre chiffre d'affaires,
            vos encaissements et les actions
            commerciales à suivre.
          </p>
        </div>

        <button
          className="business-button business-button-primary"
          type="button"
          onClick={() =>
            navigate("/quotes")
          }
        >
          Nouveau devis
        </button>
      </div>


      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      {/* ====================================================
          KPI MÉTIER
          ==================================================== */}

      <section className="dashboard-business-kpis">

        <button
          type="button"
          className="business-card business-info dashboard-business-kpi dashboard-clickable-card"
          onClick={() => navigate("/invoices?period=all")}
        >
          <span className="dashboard-kpi-label">
            CA facturé
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.revenue
                )}
          </strong>

          <small>
            Factures nettes d'avoirs
          </small>
        </button>


        <button
          type="button"
          className="business-card business-success dashboard-business-kpi dashboard-clickable-card"
          onClick={() => navigate("/payments")}
        >
          <span className="dashboard-kpi-label">
            Encaissé
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.collected
                )}
          </strong>

          <small>
            {loading
              ? "—"
              : `${metrics.collectionRate.toFixed(
                  0
                )} % du CA facturé`}
          </small>
        </button>


        <button
          type="button"
          className="business-card business-warning dashboard-business-kpi dashboard-clickable-card"
          onClick={() => navigate("/invoices?due=outstanding")}
        >
          <span className="dashboard-kpi-label">
            À encaisser
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.outstanding
                )}
          </strong>

          <small>
            Solde client restant
          </small>
        </button>


        <button
          type="button"
          onClick={() =>
            navigate("/invoices?status=overdue")
          }
          className={
            metrics.overdueCount > 0
              ? "business-card business-danger dashboard-business-kpi dashboard-business-kpi-alert dashboard-clickable-card"
              : "business-card business-neutral dashboard-business-kpi dashboard-clickable-card"
          }
        >
          <span className="dashboard-kpi-label">
            Retards
          </span>

          <strong>
            {loading
              ? "—"
              : formatCurrency(
                  metrics.overdueAmount
                )}
          </strong>

          <small>
            {loading
              ? "—"
              : metrics.overdueCount === 0
                ? "Aucune facture en retard"
                : `${metrics.overdueCount} facture${
                    metrics.overdueCount > 1
                      ? "s"
                      : ""
                  } à relancer`}
          </small>
        </button>

      </section>


      <StarterDashboardWidgets
        clients={clients}
        requests={requests}
        quotes={quotes}
        invoices={invoices}
        payments={payments}
        recurringInvoices={
          recurringInvoices
        }
        reminderCockpit={
          reminderCockpit
        }
        loading={loading}
      />

      <div id="dashboard-intelligence">
        <IntelligenceForecasting />
        <IntelligenceAdvancedAutomation />
        <IntelligenceCopilot />
      </div>

    </div>
  );
}
