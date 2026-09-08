import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

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

import {
  getRecurringInvoices,
  type RecurringInvoice,
} from "../services/recurringInvoicesService";

import {
  getReminderCockpit,
  type PaymentReminderCockpitItem,
} from "../services/remindersService";


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

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [
          clientsData,
          requestsData,
          quotesData,
          invoicesData,
          recurringInvoicesData,
          reminderCockpitData,
        ] = await Promise.all([
          getClients(),
          getRequests(),
          getQuotes(),
          getInvoices(),
          getRecurringInvoices(),
          getReminderCockpit(),
        ]);

        setClients(clientsData);
        setRequests(requestsData);
        setQuotes(quotesData);
        setInvoices(invoicesData);
        setRecurringInvoices(
          recurringInvoicesData
        );
        setReminderCockpit(
          reminderCockpitData
        );
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
        recurringInvoices={
          recurringInvoices
        }
        reminderCockpit={
          reminderCockpit
        }
        loading={loading}
      />

    </div>
  );
}
