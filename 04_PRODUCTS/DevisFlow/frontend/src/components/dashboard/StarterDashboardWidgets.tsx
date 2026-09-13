import {
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import type {
  Client,
  Invoice,
  Quote,
  Request,
} from "../../types";

import type {
  RecurringInvoice,
} from "../../services/recurringInvoicesService";

import type {
  PaymentReminderCockpitItem,
} from "../../services/remindersService";


import type {
  Payment,
} from "../../services/paymentsService";

import {
  useWorkspace,
} from "../../context/WorkspaceContext";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


type BusinessPeriod =
  | "3m"
  | "6m"
  | "12m"
  | "ytd"
  | "all";


type DiagnosticPeriod =
  | "3m"
  | "6m"
  | "12m"
  | "ytd";

type BusinessView =
  | "top"
  | "last";

type BusinessLimit =
  | 5
  | 10
  | 20;


type BusinessQuoteSort =
  | "accepted"
  | "sent"
  | "rate";

type BusinessCashView =
  | "total"
  | "standard"
  | "recurring";

type BusinessExposureSort =
  | "revenue"
  | "outstanding"
  | "overdue";


interface StarterDashboardWidgetsProps {
  clients: Client[];
  requests: Request[];
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  recurringInvoices: RecurringInvoice[];
  reminderCockpit: PaymentReminderCockpitItem[];
  loading?: boolean;
}


function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(value);
}


function getPercentage(
  value: number,
  maximum: number
) {
  if (maximum <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      value > 0 ? 4 : 0,
      (value / maximum) * 100
    )
  );
}




function getAverage(
  values: number[]
) {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    )
    / values.length
  );
}


function getMedian(
  values: number[]
) {
  if (values.length === 0) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (a, b) =>
        a - b
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 === 0
  ) {
    return (
      sorted[middle - 1]
      + sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}


function getDaysBetween(
  start?: string | null,
  end?: string | null
) {
  if (!start || !end) {
    return null;
  }

  const startDate =
    new Date(start);

  const endDate =
    new Date(end);

  if (
    Number.isNaN(
      startDate.getTime()
    )
    || Number.isNaN(
      endDate.getTime()
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    (
      endDate.getTime()
      - startDate.getTime()
    )
    / (
      1000
      * 60
      * 60
      * 24
    )
  );
}


export default function StarterDashboardWidgets({
  clients,
  requests,
  quotes,
  invoices,
  payments,
  recurringInvoices,
  reminderCockpit,
  loading = false,
}: StarterDashboardWidgetsProps) {

  const {
    workspace,
    hasEntitlement,
  } = useWorkspace();

  const advancedAlertsEnabled =
    hasEntitlement("advanced_alerts");

  const crossAnalysisEnabled =
    hasEntitlement("cross_analysis");


  const advancedAnalysisEnabled =
    hasEntitlement("advanced_analysis");


  const navigate = useNavigate();


  const [
    businessPeriod,
    setBusinessPeriod,
  ] = useState<BusinessPeriod>("6m");

  const [
    businessView,
    setBusinessView,
  ] = useState<BusinessView>("top");

  const [
    businessLimit,
    setBusinessLimit,
  ] = useState<BusinessLimit>(5);


  const [
    businessQuoteSort,
    setBusinessQuoteSort,
  ] = useState<BusinessQuoteSort>(
    "accepted"
  );

  const [
    businessCashView,
    setBusinessCashView,
  ] = useState<BusinessCashView>(
    "total"
  );

  const [
    businessExposureSort,
    setBusinessExposureSort,
  ] = useState<BusinessExposureSort>(
    "revenue"
  );


  const [
    diagnosticPeriod,
    setDiagnosticPeriod,
  ] = useState<DiagnosticPeriod>(
    "6m"
  );


  const businessPeriodStart =
    useMemo(
      () => {
        const now =
          new Date();

        if (
          businessPeriod === "all"
        ) {
          return null;
        }

        if (
          businessPeriod === "ytd"
        ) {
          return new Date(
            now.getFullYear(),
            0,
            1
          );
        }

        const months =
          businessPeriod === "3m"
            ? 3
            : businessPeriod === "12m"
              ? 12
              : 6;

        return new Date(
          now.getFullYear(),
          now.getMonth()
            - (months - 1),
          1
        );
      },
      [businessPeriod]
    );


  function isBusinessDateInPeriod(
    value?: string | null
  ) {
    if (
      !businessPeriodStart
    ) {
      return true;
    }

    if (!value) {
      return false;
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return false;
    }

    return (
      date >= businessPeriodStart
    );
  }

  /* ========================================================
     ACTIVITÉ COMMERCIALE
     ======================================================== */

  const acceptedQuotes =
    quotes.filter(
      (quote) =>
        quote.status === "accepted"
    );


  const activeInvoices =
    invoices.filter(
      (invoice) =>
        invoice.status !== "cancelled"
    );


  const pipeline = [
    {
      label: "Demandes",
      value: requests.length,
      tone: "cyan",
      to: "/requests",
    },
    {
      label: "Devis",
      value: quotes.length,
      tone: "blue",
      to: "/quotes",
    },
    {
      label: "Acceptés",
      value: acceptedQuotes.length,
      tone: "green",
      to: "/quotes?status=accepted",
    },
    {
      label: "Factures",
      value: activeInvoices.length,
      tone: "navy",
      to: "/invoices?period=all",
    },
  ];


  const quotedRequestIds = new Set(
    quotes.map(
      (quote) => quote.request_id
    )
  );

  const requestsWithoutQuote =
    requests.filter(
      (request) =>
        !quotedRequestIds.has(
          request.id
        )
    );

  function isDashboardQuoteDueSoon(
    quote: Quote
  ) {
    if (
      !quote.valid_until ||
      !["ready", "sent"].includes(
        quote.status
      )
    ) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validity =
      new Date(quote.valid_until);
    validity.setHours(0, 0, 0, 0);

    const diffDays =
      (validity.getTime() -
        today.getTime()) /
      (1000 * 60 * 60 * 24);

    return (
      diffDays >= 0 &&
      diffDays <= 7
    );
  }

  function isDashboardQuotePastValidity(
    quote: Quote
  ) {
    if (
      !quote.valid_until ||
      !["ready", "sent"].includes(
        quote.status
      )
    ) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validity =
      new Date(quote.valid_until);
    validity.setHours(0, 0, 0, 0);

    return validity < today;
  }

  const quotesToWatch =
    quotes.filter(
      (quote) =>
        quote.status === "expired" ||
        isDashboardQuoteDueSoon(
          quote
        ) ||
        isDashboardQuotePastValidity(
          quote
        )
    );

  const remindersDue =
    reminderCockpit.filter(
      (item) =>
        item.status === "due"
    );

  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(
      today.getMonth() + 1
    ).padStart(2, "0"),
    String(
      today.getDate()
    ).padStart(2, "0"),
  ].join("-");

  const recurringDue =
    recurringInvoices.filter(
      (item) =>
        item.status === "active" &&
        item.next_invoice_date <=
          todayKey
    );

  const actionItems = [
    {
      label: "Factures à relancer",
      value: remindersDue.length,
      detail: "Recouvrement à traiter",
      to: "/reminders",
      tone: "danger",
    },
    {
      label: "Récurrences à générer",
      value: recurringDue.length,
      detail: "Factures arrivées à échéance",
      to: "/recurrences",
      tone: "cyan",
    },
    {
      label: "Devis à surveiller",
      value: quotesToWatch.length,
      detail: "Expiration ou validité proche",
      to: "/quotes",
      tone: "warning",
    },
    {
      label: "Demandes sans devis",
      value: requestsWithoutQuote.length,
      detail: "Opportunités à convertir",
      to: "/requests",
      tone: "blue",
    },
  ];

  const pipelineMaximum =
    Math.max(
      ...pipeline.map(
        (item) => item.value
      ),
      1
    );


  /* ========================================================
     FINANCE
     ======================================================== */

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
    activeInvoices.reduce(
      (total, invoice) =>
        total +
        Number(
          invoice.amount_paid || 0
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
    invoicedAmount > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (paidAmount /
              invoicedAmount) *
              100
          )
        )
      : 0;


  const overdueRate =
    invoicedAmount > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (overdueAmount /
              invoicedAmount) *
              100
          )
        )
      : 0;


  /* ========================================================
     TOP CLIENTS

     Invoice
       → Quote
       → Request
       → Client
     ======================================================== */

  const quoteById =
    new Map(
      quotes.map(
        (quote) => [
          quote.id,
          quote,
        ]
      )
    );


  const requestById =
    new Map(
      requests.map(
        (request) => [
          request.id,
          request,
        ]
      )
    );


  const clientById =
    new Map(
      clients.map(
        (client) => [
          client.id,
          client,
        ]
      )
    );


  const revenueByClient =
    new Map<string, number>();


  activeInvoices.forEach(
    (invoice) => {
      const quote =
        quoteById.get(
          invoice.quote_id
        );

      if (!quote) {
        return;
      }

      const request =
        requestById.get(
          quote.request_id
        );

      if (!request) {
        return;
      }

      const client =
        clientById.get(
          request.client_id
        );

      if (!client) {
        return;
      }

      const amount =
        Number(
          invoice.net_total ??
          invoice.total ??
          0
        );

      revenueByClient.set(
        client.id,
        (
          revenueByClient.get(
            client.id
          ) ?? 0
        ) + amount
      );
    }
  );


  const topClients =
    [...revenueByClient.entries()]
      .map(
        ([clientId, amount]) => ({
          client:
            clientById.get(
              clientId
            ),
          amount,
        })
      )
      .filter(
        (
          item
        ): item is {
          client: Client;
          amount: number;
        } =>
          Boolean(
            item.client
          )
      )
      .sort(
        (a, b) =>
          b.amount - a.amount
      )
      .slice(0, 5);


  const topClientShare =
    invoicedAmount > 0 &&
    topClients.length > 0
      ? (
          topClients[0].amount /
          invoicedAmount
        ) * 100
      : 0;


  /* ========================================================
     ANALYSE STARTER

     Analyse descriptive uniquement.
     Pas de prédiction ni recommandation avancée.
     ======================================================== */

  const starterInsights: string[] = [];


  if (invoicedAmount <= 0) {
    starterInsights.push(
      "Votre activité facturée apparaîtra ici dès vos premières factures."
    );
  } else {

    starterInsights.push(
      `${collectionRate.toFixed(
        0
      )} % de votre CA facturé est déjà encaissé.`
    );


    if (overdueInvoices.length > 0) {
      starterInsights.push(
        `${overdueInvoices.length} facture${
          overdueInvoices.length > 1
            ? "s sont"
            : " est"
        } en retard, soit ${overdueRate.toFixed(
          0
        )} % du CA facturé.`
      );
    } else {
      starterInsights.push(
        "Aucune facture n'est actuellement en retard."
      );
    }


    if (
      topClients.length > 0 &&
      topClientShare >= 40
    ) {
      starterInsights.push(
        `${topClients[0].client.company_name} représente ${topClientShare.toFixed(
          0
        )} % de votre CA facturé.`
      );
    } else if (
      topClients.length > 0
    ) {
      starterInsights.push(
        `${topClients[0].client.company_name} est actuellement votre premier client en CA.`
      );
    }
  }


  /* ========================================================
     ANALYSES CROISÉES BUSINESS

     Constat multi-dimension uniquement.
     Pas de prédiction ni recommandation.
     ======================================================== */

  const overdueAmountByClient =
    new Map<string, number>();


  overdueInvoices.forEach(
    (invoice) => {
      const quote =
        quoteById.get(
          invoice.quote_id
        );

      if (!quote) {
        return;
      }

      const request =
        requestById.get(
          quote.request_id
        );

      if (!request) {
        return;
      }

      const client =
        clientById.get(
          request.client_id
        );

      if (!client) {
        return;
      }

      const amount =
        Number(
          invoice.amount_due || 0
        );

      overdueAmountByClient.set(
        client.id,
        (
          overdueAmountByClient.get(
            client.id
          ) ?? 0
        ) + amount
      );
    }
  );


  const quotePerformanceByClient =
    clients
      .map((client) => {
        const clientQuotes =
          quotes.filter(
            (quote) => {
              const request =
                requestById.get(
                  quote.request_id
                );

              return (
                request?.client_id
                  === client.id
                && isBusinessDateInPeriod(
                  quote.created_at
                )
              );
            }
          );

        const sent =
          clientQuotes.filter(
            (quote) =>
              [
                "sent",
                "accepted",
              ].includes(
                quote.status
              )
          );

        const accepted =
          clientQuotes.filter(
            (quote) =>
              quote.status
                === "accepted"
          );

        const latestDate =
          clientQuotes.reduce(
            (
              latest,
              quote
            ) => {
              const time =
                new Date(
                  quote.updated_at
                    ?? quote.created_at
                ).getTime();

              return Math.max(
                latest,
                Number.isNaN(time)
                  ? 0
                  : time
              );
            },
            0
          );

        return {
          clientId:
            client.id,
          label:
            client.company_name,
          sent:
            sent.length,
          accepted:
            accepted.length,
          rate:
            sent.length > 0
              ? (
                  accepted.length
                  / sent.length
                ) * 100
              : 0,
          latestDate,
        };
      })
      .filter(
        (item) =>
          item.sent > 0
      )
      .sort(
        (a, b) => {
          if (
            businessView === "last"
          ) {
            return (
              b.latestDate
              - a.latestDate
            );
          }

          if (
            businessQuoteSort
              === "sent"
          ) {
            return (
              b.sent
              - a.sent
              || b.accepted
              - a.accepted
            );
          }

          if (
            businessQuoteSort
              === "rate"
          ) {
            return (
              b.rate
              - a.rate
              || b.accepted
              - a.accepted
            );
          }

          return (
            b.accepted
            - a.accepted
            || b.sent
            - a.sent
          );
        }
      )
      .slice(
        0,
        businessLimit
      );


  const invoiceById =
    new Map(
      activeInvoices.map(
        (invoice) => [
          invoice.id,
          invoice,
        ]
      )
    );


  function getMonthKey(
    value?: string | null
  ) {
    if (!value) {
      return null;
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return (
      `${date.getFullYear()}-`
      + `${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`
    );
  }


  const now =
    new Date();

  const businessMonthCount =
    businessPeriod === "3m"
      ? 3
      : businessPeriod === "12m"
        ? 12
        : businessPeriod === "ytd"
          ? (
              now.getMonth() + 1
            )
          : businessPeriod === "all"
            ? 12
            : 6;


  const businessMonths =
    Array.from(
      {
        length:
          businessMonthCount,
      },
      (_, index) => {
        const date =
          new Date(
            now.getFullYear(),
            now.getMonth()
              - (
                businessMonthCount
                - 1
                - index
              ),
            1
          );

        const key =
          `${date.getFullYear()}-`
          + `${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;

        const label =
          new Intl.DateTimeFormat(
            "fr-CH",
            {
              month: "short",
            }
          )
            .format(date)
            .replace(".", "");

        return {
          key,
          label,
          invoicedStandard: 0,
          invoicedRecurring: 0,
          collectedStandard: 0,
          collectedRecurring: 0,
        };
      }
    );


  const businessMonthByKey =
    new Map(
      businessMonths.map(
        (item) => [
          item.key,
          item,
        ]
      )
    );


  activeInvoices.forEach(
    (invoice) => {
      const monthKey =
        getMonthKey(
          invoice.issue_date
            ?? invoice.created_at
        );

      if (!monthKey) {
        return;
      }

      const item =
        businessMonthByKey.get(
          monthKey
        );

      if (!item) {
        return;
      }

      const amount =
        Number(
          invoice.net_total
            ?? invoice.total
            ?? 0
        );

      if (
        invoice.recurring_invoice_id
      ) {
        item.invoicedRecurring +=
          amount;
      } else {
        item.invoicedStandard +=
          amount;
      }
    }
  );


  payments.forEach(
    (payment) => {
      const invoice =
        invoiceById.get(
          payment.invoice_id
        );

      if (!invoice) {
        return;
      }

      const monthKey =
        getMonthKey(
          payment.payment_date
        );

      if (!monthKey) {
        return;
      }

      const item =
        businessMonthByKey.get(
          monthKey
        );

      if (!item) {
        return;
      }

      const amount =
        Number(
          payment.amount || 0
        );

      if (
        invoice.recurring_invoice_id
      ) {
        item.collectedRecurring +=
          amount;
      } else {
        item.collectedStandard +=
          amount;
      }
    }
  );


  const billingCashData =
    businessMonths.map(
      (item) => {
        const totalInvoiced =
          item.invoicedStandard
          + item.invoicedRecurring;

        const totalCollected =
          item.collectedStandard
          + item.collectedRecurring;

        return {
          ...item,
          totalInvoiced,
          totalCollected,
          collectionRate:
            totalInvoiced > 0
              ? Math.min(
                  100,
                  (
                    totalCollected
                    / totalInvoiced
                  ) * 100
                )
              : 0,
          recurringShare:
            totalInvoiced > 0
              ? (
                  item.invoicedRecurring
                  / totalInvoiced
                ) * 100
              : 0,
        };
      }
    );


  const outstandingAmountByClient =
    new Map<string, number>();


  activeInvoices.forEach(
    (invoice) => {
      const quote =
        quoteById.get(
          invoice.quote_id
        );

      if (!quote) {
        return;
      }

      const request =
        requestById.get(
          quote.request_id
        );

      if (!request) {
        return;
      }

      const amount =
        Number(
          invoice.amount_due || 0
        );

      outstandingAmountByClient.set(
        request.client_id,
        (
          outstandingAmountByClient.get(
            request.client_id
          ) ?? 0
        ) + amount
      );
    }
  );


  const clientExposureData =
    clients
      .map((client) => {
        const clientInvoices =
          activeInvoices.filter(
            (invoice) => {
              const quote =
                quoteById.get(
                  invoice.quote_id
                );

              if (!quote) {
                return false;
              }

              const request =
                requestById.get(
                  quote.request_id
                );

              return (
                request?.client_id
                  === client.id
                && isBusinessDateInPeriod(
                  invoice.issue_date
                    ?? invoice.created_at
                )
              );
            }
          );

        const revenue =
          clientInvoices.reduce(
            (total, invoice) =>
              total
              + Number(
                  invoice.net_total
                    ?? invoice.total
                    ?? 0
                ),
            0
          );

        const outstanding =
          clientInvoices.reduce(
            (total, invoice) =>
              total
              + Number(
                  invoice.amount_due
                    || 0
                ),
            0
          );

        const overdue =
          clientInvoices
            .filter(
              (invoice) =>
                invoice.status
                  === "overdue"
            )
            .reduce(
              (total, invoice) =>
                total
                + Number(
                    invoice.amount_due
                      || 0
                  ),
              0
            );

        const latestDate =
          clientInvoices.reduce(
            (
              latest,
              invoice
            ) => {
              const time =
                new Date(
                  invoice.issue_date
                    ?? invoice.created_at
                ).getTime();

              return Math.max(
                latest,
                Number.isNaN(time)
                  ? 0
                  : time
              );
            },
            0
          );

        return {
          label:
            client.company_name,
          clientId:
            client.id,
          revenue,
          outstanding,
          overdue,
          latestDate,
        };
      })
      .filter(
        (item) =>
          item.revenue > 0
          || item.outstanding > 0
          || item.overdue > 0
      )
      .sort(
        (a, b) => {
          if (
            businessView === "last"
          ) {
            return (
              b.latestDate
              - a.latestDate
            );
          }

          if (
            businessExposureSort
              === "outstanding"
          ) {
            return (
              b.outstanding
              - a.outstanding
              || b.revenue
              - a.revenue
            );
          }

          if (
            businessExposureSort
              === "overdue"
          ) {
            return (
              b.overdue
              - a.overdue
              || b.outstanding
              - a.outstanding
            );
          }

          return (
            b.revenue
            - a.revenue
            || b.outstanding
            - a.outstanding
          );
        }
      )
      .slice(
        0,
        businessLimit
      );


  /* ========================================================
     BUSINESS — DIAGNOSTIC COMMERCIAL & FINANCIER
     ======================================================== */

  const diagnosticNow =
    new Date();


  const diagnosticPeriodStart =
    useMemo(
      () => {
        if (
          diagnosticPeriod === "ytd"
        ) {
          return new Date(
            diagnosticNow.getFullYear(),
            0,
            1
          );
        }

        const months =
          diagnosticPeriod === "3m"
            ? 3
            : diagnosticPeriod === "12m"
              ? 12
              : 6;

        return new Date(
          diagnosticNow.getFullYear(),
          diagnosticNow.getMonth()
            - (months - 1),
          1
        );
      },
      [diagnosticPeriod]
    );


  function getPreviousBusinessRange() {
    if (
      !diagnosticPeriodStart
    ) {
      return null;
    }

    if (
      diagnosticPeriod === "ytd"
    ) {
      const previousStart =
        new Date(
          diagnosticNow.getFullYear()
            - 1,
          0,
          1
        );

      const previousEnd =
        new Date(
          diagnosticNow.getFullYear()
            - 1,
          diagnosticNow.getMonth(),
          diagnosticNow.getDate(),
          23,
          59,
          59,
          999
        );

      return {
        start:
          previousStart,
        end:
          previousEnd,
      };
    }

    const months =
      diagnosticPeriod === "3m"
        ? 3
        : diagnosticPeriod === "12m"
          ? 12
          : 6;

    const previousEnd =
      new Date(
        diagnosticPeriodStart.getTime()
          - 1
      );

    const previousStart =
      new Date(
        diagnosticPeriodStart.getFullYear(),
        diagnosticPeriodStart.getMonth()
          - months,
        1
      );

    return {
      start:
        previousStart,
      end:
        previousEnd,
    };
  }


  const previousBusinessRange =
    getPreviousBusinessRange();


  function isDateInDiagnosticRange(
    value: string | null | undefined,
    start: Date | null,
    end: Date
  ) {
    if (!value) {
      return false;
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return false;
    }

    return (
      (!start || date >= start)
      && date <= end
    );
  }


  const currentDiagnosticQuotes =
    quotes.filter(
      (quote) =>
        isDateInDiagnosticRange(
          quote.created_at,
          diagnosticPeriodStart,
          diagnosticNow
        )
    );


  const previousDiagnosticQuotes =
    previousBusinessRange
      ? quotes.filter(
          (quote) =>
            isDateInDiagnosticRange(
              quote.created_at,
              previousBusinessRange.start,
              previousBusinessRange.end
            )
        )
      : [];


  const currentDiagnosticInvoices =
    activeInvoices.filter(
      (invoice) =>
        isDateInDiagnosticRange(
          invoice.issue_date
            ?? invoice.created_at,
          diagnosticPeriodStart,
          diagnosticNow
        )
    );


  const previousDiagnosticInvoices =
    previousBusinessRange
      ? activeInvoices.filter(
          (invoice) =>
            isDateInDiagnosticRange(
              invoice.issue_date
                ?? invoice.created_at,
              previousBusinessRange.start,
              previousBusinessRange.end
            )
        )
      : [];


  const currentDiagnosticPayments =
    payments.filter(
      (payment) =>
        isDateInDiagnosticRange(
          payment.payment_date,
          diagnosticPeriodStart,
          diagnosticNow
        )
    );


  const previousDiagnosticPayments =
    previousBusinessRange
      ? payments.filter(
          (payment) =>
            isDateInDiagnosticRange(
              payment.payment_date,
              previousBusinessRange.start,
              previousBusinessRange.end
            )
        )
      : [];


  function buildCommercialDiagnostic(
    diagnosticQuotes: Quote[]
  ) {
    const sent =
      diagnosticQuotes.filter(
        (quote) =>
          [
            "sent",
            "accepted",
          ].includes(
            quote.status
          )
      );

    const accepted =
      diagnosticQuotes.filter(
        (quote) =>
          quote.status
            === "accepted"
      );

    const quoteValues =
      sent.map(
        (quote) =>
          Number(
            quote.total || 0
          )
      );

    const acceptanceDelays =
      accepted
        .map(
          (quote) =>
            getDaysBetween(
              quote.created_at,
              quote.accepted_at
            )
        )
        .filter(
          (
            value
          ): value is number =>
            value !== null
        );

    return {
      acceptanceRate:
        sent.length > 0
          ? (
              accepted.length
              / sent.length
            ) * 100
          : 0,
      averageQuote:
        getAverage(
          quoteValues
        ),
      medianQuote:
        getMedian(
          quoteValues
        ),
      medianAcceptanceDays:
        getMedian(
          acceptanceDelays
        ),
    };
  }


  function buildCollectionDiagnostic(
    diagnosticInvoices: Invoice[],
    diagnosticPayments: Payment[]
  ) {
    const invoiced =
      diagnosticInvoices.reduce(
        (sum, invoice) =>
          sum
          + Number(
              invoice.net_total
                ?? invoice.total
                ?? 0
            ),
        0
      );

    const paid =
      diagnosticInvoices.reduce(
        (sum, invoice) =>
          sum
          + Number(
              invoice.amount_paid
                || 0
            ),
        0
      );

    const paymentValues =
      diagnosticPayments.map(
        (payment) =>
          Number(
            payment.amount || 0
          )
      );

    const paymentDelays =
      diagnosticPayments
        .map(
          (payment) => {
            const invoice =
              invoiceById.get(
                payment.invoice_id
              );

            if (!invoice) {
              return null;
            }

            return getDaysBetween(
              invoice.issue_date
                ?? invoice.created_at,
              payment.payment_date
            );
          }
        )
        .filter(
          (
            value
          ): value is number =>
            value !== null
        );

    return {
      collectionRate:
        invoiced > 0
          ? Math.min(
              100,
              (
                paid
                / invoiced
              ) * 100
            )
          : 0,
      averagePaymentDays:
        getAverage(
          paymentDelays
        ),
      medianPaymentDays:
        getMedian(
          paymentDelays
        ),
      averagePayment:
        getAverage(
          paymentValues
        ),
    };
  }


  function buildRevenueDiagnostic(
    diagnosticInvoices: Invoice[]
  ) {
    const values =
      diagnosticInvoices.map(
        (invoice) =>
          Number(
            invoice.net_total
              ?? invoice.total
              ?? 0
          )
      );

    const recurringRevenue =
      diagnosticInvoices
        .filter(
          (invoice) =>
            Boolean(
              invoice.recurring_invoice_id
            )
        )
        .reduce(
          (sum, invoice) =>
            sum
            + Number(
                invoice.net_total
                  ?? invoice.total
                  ?? 0
              ),
          0
        );

    const totalRevenue =
      values.reduce(
        (sum, value) =>
          sum + value,
        0
      );

    const standardRevenue =
      totalRevenue
      - recurringRevenue;

    return {
      averageInvoice:
        getAverage(values),
      medianInvoice:
        getMedian(values),
      recurringShare:
        totalRevenue > 0
          ? (
              recurringRevenue
              / totalRevenue
            ) * 100
          : 0,
      recurringRevenue,
      standardRevenue,
    };
  }


  function buildExposureDiagnostic(
    diagnosticInvoices: Invoice[]
  ) {
    const revenueByDiagnosticClient =
      new Map<string, number>();

    const exposureByDiagnosticClient =
      new Map<string, number>();

    diagnosticInvoices.forEach(
      (invoice) => {
        const quote =
          quoteById.get(
            invoice.quote_id
          );

        if (!quote) {
          return;
        }

        const request =
          requestById.get(
            quote.request_id
          );

        if (!request) {
          return;
        }

        const clientId =
          request.client_id;

        const revenue =
          Number(
            invoice.net_total
              ?? invoice.total
              ?? 0
          );

        const exposure =
          Number(
            invoice.amount_due
              || 0
          );

        revenueByDiagnosticClient.set(
          clientId,
          (
            revenueByDiagnosticClient.get(
              clientId
            ) ?? 0
          ) + revenue
        );

        exposureByDiagnosticClient.set(
          clientId,
          (
            exposureByDiagnosticClient.get(
              clientId
            ) ?? 0
          ) + exposure
        );
      }
    );

    const revenues =
      [...revenueByDiagnosticClient.values()]
        .sort(
          (a, b) =>
            b - a
        );

    const exposures =
      [...exposureByDiagnosticClient.values()];

    const totalRevenue =
      revenues.reduce(
        (sum, value) =>
          sum + value,
        0
      );

    const topOne =
      revenues[0] ?? 0;

    const topThree =
      revenues
        .slice(0, 3)
        .reduce(
          (sum, value) =>
            sum + value,
          0
        );

    return {
      topOneShare:
        totalRevenue > 0
          ? (
              topOne
              / totalRevenue
            ) * 100
          : 0,
      topThreeShare:
        totalRevenue > 0
          ? (
              topThree
              / totalRevenue
            ) * 100
          : 0,
      averageExposure:
        getAverage(
          exposures
        ),
      medianExposure:
        getMedian(
          exposures
        ),
    };
  }


  const currentCommercialDiagnostic =
    buildCommercialDiagnostic(
      currentDiagnosticQuotes
    );

  const previousCommercialDiagnostic =
    buildCommercialDiagnostic(
      previousDiagnosticQuotes
    );


  const currentCollectionDiagnostic =
    buildCollectionDiagnostic(
      currentDiagnosticInvoices,
      currentDiagnosticPayments
    );

  const previousCollectionDiagnostic =
    buildCollectionDiagnostic(
      previousDiagnosticInvoices,
      previousDiagnosticPayments
    );


  const currentRevenueDiagnostic =
    buildRevenueDiagnostic(
      currentDiagnosticInvoices
    );

  const previousRevenueDiagnostic =
    buildRevenueDiagnostic(
      previousDiagnosticInvoices
    );


  const currentExposureDiagnostic =
    buildExposureDiagnostic(
      currentDiagnosticInvoices
    );

  const previousExposureDiagnostic =
    buildExposureDiagnostic(
      previousDiagnosticInvoices
    );


  const hasPreviousCommercial =
    previousDiagnosticQuotes.length > 0;

  const hasPreviousCollection =
    previousDiagnosticInvoices.length > 0;

  const hasPreviousRevenue =
    previousDiagnosticInvoices.length > 0;

  const hasPreviousExposure =
    previousDiagnosticInvoices.length > 0;


  function formatDiagnosticDelta(
    current: number,
    previous: number,
    unit:
      | "percent"
      | "currency"
      | "days",
    hasPrevious: boolean
  ) {
    if (!hasPrevious) {
      return "—";
    }

    const delta =
      current - previous;

    const prefix =
      delta > 0
        ? "+"
        : "";

    if (
      unit === "currency"
    ) {
      return (
        prefix
        + formatCurrency(delta)
      );
    }

    if (
      unit === "days"
    ) {
      return (
        `${prefix}${delta.toFixed(0)} j`
      );
    }

    return (
      `${prefix}${delta.toFixed(1)} pts`
    );
  }


  function getDiagnosticEvolution(
    current: number,
    previous: number,
    hasPrevious: boolean,
    preference:
      | "higher"
      | "higher-soft"
      | "lower"
  ) {
    if (!hasPrevious) {
      return {
        label: "—",
        arrow: "→",
        tone: "neutral",
      };
    }

    const delta =
      current - previous;

    const absoluteDelta =
      Math.abs(delta);

    if (absoluteDelta < 0.5) {
      return {
        label:
          formatDiagnosticDelta(
            current,
            previous,
            "percent",
            true
          ),
        arrow: "→",
        tone: "neutral",
      };
    }

    if (preference === "lower") {
      if (delta < 0) {
        return {
          label:
            formatDiagnosticDelta(
              current,
              previous,
              "percent",
              true
            ),
          arrow: "↓",
          tone: "success",
        };
      }

      return {
        label:
          formatDiagnosticDelta(
            current,
            previous,
            "percent",
            true
          ),
        arrow: "↑",
        tone:
          delta >= 5
            ? "danger"
            : "warning",
      };
    }

    if (
      preference === "higher-soft"
    ) {
      if (delta > 0) {
        return {
          label:
            formatDiagnosticDelta(
              current,
              previous,
              "percent",
              true
            ),
          arrow: "↑",
          tone: "success",
        };
      }

      return {
        label:
          formatDiagnosticDelta(
            current,
            previous,
            "percent",
            true
          ),
        arrow: "↓",
        tone:
          delta <= -5
            ? "danger"
            : "warning",
      };
    }

    if (delta > 0) {
      return {
        label:
          formatDiagnosticDelta(
            current,
            previous,
            "percent",
            true
          ),
        arrow: "↑",
        tone: "success",
      };
    }

    return {
      label:
        formatDiagnosticDelta(
          current,
          previous,
          "percent",
          true
        ),
      arrow: "↓",
      tone: "danger",
    };
  }


  const commercialEvolution =
    getDiagnosticEvolution(
      currentCommercialDiagnostic.acceptanceRate,
      previousCommercialDiagnostic.acceptanceRate,
      hasPreviousCommercial,
      "higher"
    );


  const collectionEvolution =
    getDiagnosticEvolution(
      currentCollectionDiagnostic.collectionRate,
      previousCollectionDiagnostic.collectionRate,
      hasPreviousCollection,
      "higher"
    );


  const recurringEvolution =
    getDiagnosticEvolution(
      currentRevenueDiagnostic.recurringShare,
      previousRevenueDiagnostic.recurringShare,
      hasPreviousRevenue,
      "higher-soft"
    );


  const exposureEvolution =
    getDiagnosticEvolution(
      currentExposureDiagnostic.topOneShare,
      previousExposureDiagnostic.topOneShare,
      hasPreviousExposure,
      "lower"
    );



  const advancedAlerts: {
    title: string;
    detail: string;
    tone: "warning" | "danger";
  }[] = [];


  if (
    advancedAlertsEnabled
    && invoicedAmount > 0
  ) {
    if (
      topClients.length > 0
      && topClientShare >= 50
    ) {
      advancedAlerts.push({
        title:
          "Concentration du chiffre d'affaires",
        detail:
          `${topClients[0].client.company_name} représente `
          + `${topClientShare.toFixed(0)} % du CA facturé.`,
        tone:
          topClientShare >= 70
            ? "danger"
            : "warning",
      });
    }


    if (overdueRate >= 20) {
      advancedAlerts.push({
        title:
          "Part élevée de factures en retard",
        detail:
          `${overdueRate.toFixed(0)} % du CA facturé `
          + "est actuellement en retard.",
        tone:
          overdueRate >= 35
            ? "danger"
            : "warning",
      });
    }


    if (overdueInvoices.length >= 3) {
      advancedAlerts.push({
        title:
          "Volume de retards élevé",
        detail:
          `${overdueInvoices.length} factures `
          + "sont actuellement en retard.",
        tone:
          overdueInvoices.length >= 5
            ? "danger"
            : "warning",
      });
    }
  }


  return (
    <section className="dashboard-pilotage dashboard-pilotage-v3">

      <div className="dashboard-section-header">
        <div>
          <h2>
            Comprendre l'activité en un coup d'œil
          </h2>

          <p>
            Activité commerciale, clients clés
            et premiers signaux à surveiller.
          </p>
        </div>

        <span className="starter-insight-badge">
          {workspace?.access.plan
            ? workspace.access.plan.charAt(0).toUpperCase()
              + workspace.access.plan.slice(1)
            : "Starter"}
        </span>
      </div>


      <div className="dashboard-widget-grid dashboard-widget-grid-v3">

        {/* ==================================================
            ACTIVITÉ COMMERCIALE
            ================================================== */}

        <article className="business-card business-cyan dashboard-widget dashboard-widget-v3">

          <div className="dashboard-widget-header">
            <div>
              <span className="dashboard-widget-label">
                Activité commerciale
              </span>

              <h3>
                De la demande à la facture
              </h3>
            </div>

            <span className="dashboard-widget-icon">
              ↗
            </span>
          </div>


          {loading ? (
            <div className="dashboard-widget-empty">
              Chargement...
            </div>
          ) : (
            <div className="pipeline-chart">
              {pipeline.map(
                (item) => (
                  <button
                    type="button"
                    className="pipeline-item dashboard-navigation-item"
                    key={item.label}
                    onClick={() => navigate(item.to)}
                    title={`Ouvrir ${item.label}`}
                  >
                    <div className="pipeline-meta">
                      <span>
                        {item.label}
                      </span>

                      <strong>
                        {item.value}
                      </strong>
                    </div>

                    <div className="visual-track">
                      <div
                        className={`visual-fill visual-fill-${item.tone}`}
                        style={{
                          width: `${getPercentage(
                            item.value,
                            pipelineMaximum
                          )}%`,
                        }}
                      />
                    </div>
                  </button>
                )
              )}
            </div>
          )}

        </article>


          {/* ==================================================
              ACTIONS À TRAITER
              ================================================== */}

          <article className="business-card business-warning dashboard-widget dashboard-widget-v3 dashboard-action-widget">

            <div className="dashboard-widget-header">
              <div>
                <span className="dashboard-widget-label">
                  Priorités
                </span>

                <h3>
                  Actions à traiter
                </h3>
              </div>

              <span className="dashboard-widget-icon">
                !
              </span>
            </div>

            {loading ? (
              <div className="dashboard-widget-empty">
                Chargement...
              </div>
            ) : (
              <div className="dashboard-action-list">
                {actionItems.map(
                  (item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="dashboard-action-item dashboard-navigation-item"
                      data-tone={item.tone}
                      onClick={() =>
                        navigate(item.to)
                      }
                    >
                      <div className="dashboard-action-main">
                        <strong>
                          {item.label}
                        </strong>

                        <span>
                          {item.detail}
                        </span>
                      </div>

                      <span className="dashboard-action-count">
                        {item.value}
                      </span>
                    </button>
                  )
                )}
              </div>
            )}

          </article>


        {/* ==================================================
            TOP CLIENTS
            ================================================== */}

        <article className="business-card business-info dashboard-widget dashboard-widget-v3">

          <div className="dashboard-widget-header">
            <div>
              <span className="dashboard-widget-label">
                Top clients
              </span>

              <h3>
                Top clients par CA
              </h3>
            </div>

            <span className="dashboard-widget-icon">
              ★
            </span>
          </div>


          {loading ? (
            <div className="dashboard-widget-empty">
              Chargement...
            </div>
          ) : topClients.length === 0 ? (
            <div className="dashboard-widget-empty">
              Aucun chiffre d'affaires client
              disponible pour le moment.
            </div>
          ) : (
            <div className="dashboard-top-clients">

              {topClients.map(
                (
                  item,
                  index
                ) => {
                  const share =
                    invoicedAmount > 0
                      ? (
                          item.amount /
                          invoicedAmount
                        ) * 100
                      : 0;

                  return (
                    <button
                      type="button"
                      className="dashboard-top-client dashboard-navigation-item"
                      key={item.client.id}
                      onClick={() =>
                        navigate(
                          `/invoices?client=${encodeURIComponent(
                            item.client.id
                          )}`
                        )
                      }
                      title={`Voir les factures de ${item.client.company_name}`}
                    >
                      <div className="dashboard-top-client-head">
                        <span className="dashboard-top-client-rank">
                          {index + 1}
                        </span>

                        <div className="dashboard-top-client-main">
                          <strong>
                            {item.client.company_name}
                          </strong>

                          <span>
                            {share.toFixed(0)} % du CA
                          </span>
                        </div>

                        <strong className="dashboard-top-client-amount">
                          {formatCurrency(
                            item.amount
                          )}
                        </strong>
                      </div>

                      <div className="dashboard-top-client-track">
                        <div
                          className="dashboard-top-client-fill"
                          style={{
                            width: `${Math.max(
                              share,
                              share > 0 ? 4 : 0
                            )}%`,
                          }}
                        />
                      </div>
                    </button>
                  );
                }
              )}  

            </div>
          )}

        </article>


        {/* ==================================================
            ANALYSE STARTER
            ================================================== */}

        <article className="business-card business-success dashboard-widget dashboard-widget-v3 dashboard-starter-analysis">

          <div className="dashboard-widget-header">
            <div>
              <span className="dashboard-widget-label dashboard-analysis-label">
                ✦ Analyse Starter
              </span>

              <h3>
                Ce qu'il faut retenir
              </h3>
            </div>

            <span className="dashboard-widget-icon dashboard-ai-icon">
              ✦
            </span>
          </div>


          {loading ? (
            <div className="dashboard-widget-empty">
              Analyse en cours...
            </div>
          ) : (
            <>
              <div className="dashboard-insight-list">

                {starterInsights.map(
                  (
                    insight,
                    index
                  ) => (
                    <div
                      className="dashboard-insight-item"
                      key={`${index}-${insight}`}
                    >
                      <span className="dashboard-insight-dot">
                        ✦
                      </span>

                      <p>
                        {insight}
                      </p>
                    </div>
                  )
                )}

              </div>


              <div className="dashboard-insight-teaser">
                <span>
                  Besoin d'aller plus loin ?
                </span>

                <strong>
                  InsightFlow pourra expliquer,
                  anticiper et approfondir ces
                  signaux.
                </strong>
              </div>
            </>
          )}

        </article>

      </div>


      {(advancedAlertsEnabled
        || crossAnalysisEnabled
        || advancedAnalysisEnabled) && (
        <section className="dashboard-plan-section dashboard-plan-section-business">

          <div className="dashboard-plan-section-header">
            <div>
              <span className="eyebrow">
                Pilotage Business
              </span>

              <h2>
                Comprendre plus vite, agir plus facilement
              </h2>

              <p>
                Alertes avancées, analyses croisées
                et visualisations interactives.
              </p>
            </div>

            <span className="starter-insight-badge">
              Business
            </span>
          </div>


          <div className="dashboard-advanced-grid">
        {advancedAlertsEnabled && (
          <article
            className={
              advancedAlerts.length === 0
                ? "business-card dashboard-widget dashboard-widget-v3 dashboard-advanced-alerts dashboard-advanced-alerts-empty"
                : "business-card dashboard-widget dashboard-widget-v3 dashboard-advanced-alerts"
            }
          >

            <div className="dashboard-widget-header">
              <div>
                <span className="dashboard-widget-label">
                  Alertes avancées
                </span>

                <h3>
                  Signaux à surveiller
                </h3>
              </div>

              <span className="dashboard-widget-icon">
                !
              </span>
            </div>


            {loading ? (
              <div className="dashboard-widget-empty">
                Chargement...
              </div>
            ) : advancedAlerts.length === 0 ? (
              <div className="dashboard-widget-empty">
                Aucun signal avancé détecté actuellement.
              </div>
            ) : (
              <div className="dashboard-advanced-alert-list">
                {advancedAlerts.map(
                  (alert) => (
                    <div
                      key={alert.title}
                      className="dashboard-advanced-alert"
                      data-tone={alert.tone}
                    >
                      <strong>
                        {alert.title}
                      </strong>

                      <span>
                        {alert.detail}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

          </article>
        )}


          {crossAnalysisEnabled && (
            <div className="dashboard-business-cockpit">

              <div className="dashboard-business-filter">
                <label htmlFor="business-period">
                  Période
                </label>

                <select
                  id="business-period"
                  value={businessPeriod}
                  onChange={(event) =>
                    setBusinessPeriod(
                      event.target.value as BusinessPeriod
                    )
                  }
                >
                  <option value="3m">
                    3 mois
                  </option>

                  <option value="6m">
                    6 mois
                  </option>

                  <option value="12m">
                    12 mois
                  </option>

                  <option value="ytd">
                    Année en cours
                  </option>

                  <option value="all">
                    Tout
                  </option>
                </select>
              </div>


              <div className="dashboard-business-filter">
                <label htmlFor="business-view">
                  Vue
                </label>

                <select
                  id="business-view"
                  value={businessView}
                  onChange={(event) =>
                    setBusinessView(
                      event.target.value as BusinessView
                    )
                  }
                >
                  <option value="top">
                    Top
                  </option>

                  <option value="last">
                    Last
                  </option>
                </select>
              </div>


              <div className="dashboard-business-filter">
                <label htmlFor="business-limit">
                  Afficher
                </label>

                <select
                  id="business-limit"
                  value={businessLimit}
                  onChange={(event) =>
                    setBusinessLimit(
                      Number(event.target.value) as BusinessLimit
                    )
                  }
                >
                  <option value={5}>
                    5
                  </option>

                  <option value={10}>
                    10
                  </option>

                  <option value={20}>
                    20
                  </option>
                </select>
              </div>


              <div className="dashboard-business-cockpit-summary">
                <span>
                  {businessView === "top"
                    ? "Meilleures positions"
                    : "Activité récente"}
                </span>

                <strong>
                  {businessLimit} éléments ·{" "}
                  {businessPeriod === "3m"
                    ? "3 mois"
                    : businessPeriod === "6m"
                      ? "6 mois"
                      : businessPeriod === "12m"
                        ? "12 mois"
                        : businessPeriod === "ytd"
                          ? "année en cours"
                          : "toutes périodes"}
                </strong>
              </div>

            </div>
          )}



        {crossAnalysisEnabled && (
          <article className="business-card dashboard-widget dashboard-widget-v3 dashboard-cross-analysis">

            <div className="dashboard-widget-header dashboard-cross-analysis-header">
              <div>
                <span className="dashboard-widget-label">
                  Analyses croisées
                </span>

                <h3>
                  Performance commerciale & financière
                </h3>
              </div>

              <span
                className="dashboard-widget-icon"
                title="Analyses et visualisations"
                aria-label="Analyses et visualisations"
              >
                ▥
              </span>
            </div>


            {loading ? (
              <div className="dashboard-widget-empty">
                Chargement...
              </div>
            ) : (
              <div className="dashboard-cross-analysis-grid">


                {/* ==========================================
                    1. DEVIS ENVOYÉS VS ACCEPTÉS
                    ========================================== */}

                <div className="dashboard-cross-chart-card dashboard-cross-chart-third">

                  <div className="dashboard-cross-chart-header">
                    <span className="dashboard-widget-label">
                      Performance des devis
                    </span>

                    <h3>
                      Envoyés vs acceptés par client
                    </h3>


                    <div className="dashboard-chart-local-filter">
                      <label htmlFor="business-quote-sort">
                        Classer par
                      </label>

                      <select
                        id="business-quote-sort"
                        value={businessQuoteSort}
                        onChange={(event) =>
                          setBusinessQuoteSort(
                            event.target.value as BusinessQuoteSort
                          )
                        }
                        disabled={
                          businessView === "last"
                        }
                      >
                        <option value="accepted">
                          Acceptés
                        </option>

                        <option value="sent">
                          Envoyés
                        </option>

                        <option value="rate">
                          Taux d'acceptation
                        </option>
                      </select>
                    </div>


                  </div>


                  <div className="dashboard-chart-container">
                    <ResponsiveContainer
                      width="100%"
                      height={220}
                    >
                      <BarChart
                        data={
                          quotePerformanceByClient
                        }
                        layout="vertical"
                        margin={{
                          left: 4,
                          right: 8,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />

                        <XAxis
                          type="number"
                          allowDecimals={false}
                          label={{
                            value: "Nombre de devis",
                            position: "insideBottom",
                            offset: 8,
                          }}
                        />

                        <YAxis
                          type="category"
                          dataKey="label"
                          width={88}
                          label={{
                            value: "Clients",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />

                        <Tooltip
                          cursor={{
                            fill:
                              "rgba(14, 165, 233, 0.05)",
                          }}
                          formatter={(
                            value,
                            name
                          ) => [
                            Number(value),
                            name === "sent"
                              ? "Devis envoyés"
                              : "Devis acceptés",
                          ]}
                        />

                        <Bar
                          dataKey="sent"
                          name="sent"
                          fill="#0ea5e9"
                          radius={[
                            0,
                            6,
                            6,
                            0,
                          ]}
                          cursor="pointer"
                          onClick={() =>
                            navigate(
                              "/quotes"
                            )
                          }
                        />

                        <Bar
                          dataKey="accepted"
                          name="accepted"
                          fill="#10b981"
                          radius={[
                            0,
                            6,
                            6,
                            0,
                          ]}
                          cursor="pointer"
                          onClick={() =>
                            navigate(
                              "/quotes?status=accepted"
                            )
                          }
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="dashboard-cross-legend">
                                        <span>
                                          <i className="dashboard-legend-dot dashboard-legend-cyan" />
                                          Devis envoyés
                                        </span>
                  
                                        <span>
                                          <i className="dashboard-legend-dot dashboard-legend-green" />
                                          Devis acceptés
                                        </span>
                                      </div>




                </div>


                {/* ==========================================
                    2. FACTURATION & CASH
                    ========================================== */}

                <div className="dashboard-cross-chart-card dashboard-cross-chart-third">

                  <div className="dashboard-cross-chart-header">
                    <span className="dashboard-widget-label">
                      Facturation & cash
                    </span>

                    <h3>
                      Classique vs récurrente
                    </h3>


                    <div className="dashboard-chart-local-filter">
                      <label htmlFor="business-cash-view">
                        Afficher
                      </label>

                      <select
                        id="business-cash-view"
                        value={businessCashView}
                        onChange={(event) =>
                          setBusinessCashView(
                            event.target.value as BusinessCashView
                          )
                        }
                      >
                        <option value="total">
                          Total
                        </option>

                        <option value="standard">
                          Classique
                        </option>

                        <option value="recurring">
                          Récurrente
                        </option>
                      </select>
                    </div>


                  </div>


                  <div className="dashboard-chart-container">
                    <ResponsiveContainer
                      width="100%"
                      height={220}
                    >
                      <ComposedChart
                        data={
                          billingCashData
                        }
                        margin={{
                          top: 68,
                          left: 0,
                          right: 8,
                          bottom: 0,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="label"
                          label={{
                            value: "Période",
                            position: "insideBottom",
                            offset: 8,
                          }}
                        />

                        <YAxis
                          tickFormatter={(
                            value
                          ) =>
                            `${Math.round(
                              Number(value)
                              / 1000
                            )}k`
                          }
                          label={{
                            value: "Montant (CHF)",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />




                        <Tooltip
                          cursor={false}
                          position={{
                            x: 8,
                            y: 4,
                          }}
                          allowEscapeViewBox={{
                            x: false,
                            y: false,
                          }}
                          wrapperStyle={{
                            zIndex: 20,
                          }}
                          content={({
                            active,
                            payload,
                            label,
                          }: any) => {
                            if (
                              !active
                              || !payload?.length
                            ) {
                              return null;
                            }

                            const row =
                              payload[0]
                                ?.payload;

                            if (!row) {
                              return null;
                            }

                            return (
                              <div className="dashboard-business-tooltip">
                                <strong>
                                  {label}
                                </strong>

                                <span>
                                  Facturé classique :{" "}
                                  {formatCurrency(
                                    row.invoicedStandard
                                  )}
                                </span>

                                <span>
                                  Facturé récurrent :{" "}
                                  {formatCurrency(
                                    row.invoicedRecurring
                                  )}
                                </span>

                                <span>
                                  Encaissé classique :{" "}
                                  {formatCurrency(
                                    row.collectedStandard
                                  )}
                                </span>

                                <span>
                                  Encaissé récurrent :{" "}
                                  {formatCurrency(
                                    row.collectedRecurring
                                  )}
                                </span>

                                <hr />

                                <strong>
                                  Total facturé :{" "}
                                  {formatCurrency(
                                    row.totalInvoiced
                                  )}
                                </strong>

                                <strong>
                                  Total encaissé :{" "}
                                  {formatCurrency(
                                    row.totalCollected
                                  )}
                                </strong>

                                <span>
                                  Taux d'encaissement :{" "}
                                  {row.collectionRate.toFixed(
                                    0
                                  )} %
                                </span>

                                <span>
                                  Part récurrente :{" "}
                                  {row.recurringShare.toFixed(
                                    0
                                  )} %
                                </span>
                              </div>
                            );
                          }}
                        />

                        {businessCashView === "total" && (
                          <>
                            <Bar
                              dataKey="totalInvoiced"
                              name="Total facturé"
                              fill="#2563eb"
                              radius={[
                                4,
                                4,
                                0,
                                0,
                              ]}
                              cursor="pointer"
                              onClick={() =>
                                navigate(
                                  "/invoices?period=all"
                                )
                              }
                            />

                            <Line
                              type="monotone"
                              dataKey="totalCollected"
                              name="Total encaissé"
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={{
                                r: 2,
                              }}
                              cursor="pointer"
                              onClick={() =>
                                navigate(
                                  "/payments"
                                )
                              }
                            />
                          </>
                        )}


                        {businessCashView === "standard" && (
                          <>
                            <Bar
                              dataKey="invoicedStandard"
                              name="Facturé classique"
                              fill="#2563eb"
                              cursor="pointer"
                              onClick={() =>
                                navigate(
                                  "/invoices?period=all"
                                )
                              }
                              radius={[
                                4,
                                4,
                                0,
                                0,
                              ]}
                            />

                            <Line
                              type="monotone"
                              dataKey="collectedStandard"
                              name="Encaissé classique"
                              stroke="#10b981"
                              cursor="pointer"
                              onClick={() =>
                                navigate(
                                  "/payments"
                                )
                              }
                              strokeWidth={2}
                              dot={{
                                r: 2,
                              }}
                            />
                          </>
                        )}


                        {businessCashView === "recurring" && (
                          <>
                            <Bar
                              dataKey="invoicedRecurring"
                              name="Facturé récurrent"
                              fill="#0ea5e9"
                              cursor="pointer"
                              onClick={() =>
                                navigate(
                                  "/invoices?period=all"
                                )
                              }
                              radius={[
                                4,
                                4,
                                0,
                                0,
                              ]}
                            />

                            <Line
                              type="monotone"
                              dataKey="collectedRecurring"
                              name="Encaissé récurrent"
                              stroke="#f59e0b"
                              cursor="pointer"
                              onClick={() =>
                                navigate(
                                  "/payments"
                                )
                              }
                              strokeWidth={2}
                              dot={{
                                r: 2,
                              }}
                            />
                          </>
                        )}


                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="dashboard-cross-legend dashboard-cross-legend-grid">

                    {businessCashView === "total" && (
                      <>
                        <span>
                          <i className="dashboard-legend-dot dashboard-legend-blue" />
                          Total facturé
                        </span>

                        <span>
                          <i className="dashboard-legend-line dashboard-legend-green" />
                          Total encaissé
                        </span>
                      </>
                    )}

                    {businessCashView === "standard" && (
                      <>
                        <span>
                          <i className="dashboard-legend-dot dashboard-legend-blue" />
                          Facturé classique
                        </span>

                        <span>
                          <i className="dashboard-legend-line dashboard-legend-green" />
                          Encaissé classique
                        </span>
                      </>
                    )}

                    {businessCashView === "recurring" && (
                      <>
                        <span>
                          <i className="dashboard-legend-dot dashboard-legend-cyan" />
                          Facturé récurrent
                        </span>

                        <span>
                          <i className="dashboard-legend-line dashboard-legend-amber" />
                          Encaissé récurrent
                        </span>
                      </>
                    )}

                  </div>




                </div>


                {/* ==========================================
                    3. EXPOSITION FINANCIÈRE
                    ========================================== */}

                <div className="dashboard-cross-chart-card dashboard-cross-chart-third">

                  <div className="dashboard-cross-chart-header">
                    <span className="dashboard-widget-label">
                      Exposition financière
                    </span>

                    <h3>
                      Facturé, dû et retard par client
                    </h3>


                    <div className="dashboard-chart-local-filter">
                      <label htmlFor="business-exposure-sort">
                        Classer par
                      </label>

                      <select
                        id="business-exposure-sort"
                        value={businessExposureSort}
                        onChange={(event) =>
                          setBusinessExposureSort(
                            event.target.value as BusinessExposureSort
                          )
                        }
                        disabled={
                          businessView === "last"
                        }
                      >
                        <option value="revenue">
                          Facturé
                        </option>

                        <option value="outstanding">
                          Dû
                        </option>

                        <option value="overdue">
                          Retard
                        </option>
                      </select>
                    </div>


                  </div>


                  <div className="dashboard-chart-container">
                    <ResponsiveContainer
                      width="100%"
                      height={220}
                    >
                      <BarChart
                        data={
                          clientExposureData
                        }
                        layout="vertical"
                        margin={{
                          left: 4,
                          right: 8,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />

                        <XAxis
                          type="number"
                          tickFormatter={(
                            value
                          ) =>
                            `${Math.round(
                              Number(value)
                              / 1000
                            )}k`
                          }
                          label={{
                            value: "Montant (CHF)",
                            position: "insideBottom",
                            offset: 8,
                          }}
                        />

                        <YAxis
                          type="category"
                          dataKey="label"
                          width={88}
                          label={{
                            value: "Clients",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />

                        <Tooltip
                          cursor={{
                            fill:
                              "rgba(14, 165, 233, 0.04)",
                          }}
                          formatter={(
                            value,
                            name
                          ) => [
                            formatCurrency(
                              Number(value)
                            ),
                            name,
                          ]}
                        />

                        <Bar
                          dataKey="revenue"
                          name="CA facturé"
                          fill="#2563eb"
                          cursor="pointer"
                          onClick={(data) => {
                            const clientId =
                              data?.payload
                                ?.clientId;

                            if (clientId) {
                              navigate(
                                `/invoices?client=${encodeURIComponent(
                                  clientId
                                )}`
                              );
                            }
                          }}
                          radius={[
                            0,
                            6,
                            6,
                            0,
                          ]}
                        />

                        <Bar
                          dataKey="outstanding"
                          name="À encaisser"
                          fill="#0ea5e9"
                          cursor="pointer"
                          onClick={(data) => {
                            const clientId =
                              data?.payload
                                ?.clientId;

                            if (clientId) {
                              navigate(
                                `/invoices?client=${encodeURIComponent(
                                  clientId
                                )}&due=outstanding`
                              );
                            }
                          }}
                          radius={[
                            0,
                            6,
                            6,
                            0,
                          ]}
                        />

                        <Bar
                          dataKey="overdue"
                          name="En retard"
                          fill="#f59e0b"
                          radius={[
                            0,
                            6,
                            6,
                            0,
                          ]}
                          cursor="pointer"
                          onClick={(data) => {
                            const clientId =
                              data?.payload
                                ?.clientId;

                            if (clientId) {
                              navigate(
                                `/invoices?client=${encodeURIComponent(
                                  clientId
                                )}&status=overdue`
                              );
                            }
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="dashboard-cross-legend">
                                        <span>
                                          <i className="dashboard-legend-dot dashboard-legend-blue" />
                                          Facturé
                                        </span>
                  
                                        <span>
                                          <i className="dashboard-legend-dot dashboard-legend-cyan" />
                                          Dû
                                        </span>
                  
                                        <span>
                                          <i className="dashboard-legend-dot dashboard-legend-amber" />
                                          En retard
                                        </span>
                                      </div>




                </div>

              </div>
            )}

          </article>
        )}


        {advancedAnalysisEnabled && (
          <article className="business-card dashboard-widget dashboard-widget-v3 dashboard-advanced-analysis">

            <div className="dashboard-widget-header">
              <div>
                <span className="dashboard-widget-label">
                  Diagnostic commercial & financier
                </span>

                <h3>
                  Évolution et structure de votre activité
                </h3>
              </div>

              <span
                className="dashboard-widget-icon"
                title="Diagnostic avancé"
                aria-label="Diagnostic avancé"
              >
                ◫
              </span>
            </div>


            <div className="dashboard-diagnostic-toolbar">

              <div className="dashboard-diagnostic-period-filter">
                <label htmlFor="diagnostic-period">
                  Période d'analyse
                </label>

                <select
                  id="diagnostic-period"
                  value={diagnosticPeriod}
                  onChange={(event) =>
                    setDiagnosticPeriod(
                      event.target.value as DiagnosticPeriod
                    )
                  }
                >
                  <option value="3m">
                    3 mois
                  </option>

                  <option value="6m">
                    6 mois
                  </option>

                  <option value="12m">
                    12 mois
                  </option>

                  <option value="ytd">
                    Année en cours
                  </option>
                </select>
              </div>

              <span className="dashboard-diagnostic-period-caption">
                Comparaison avec la période précédente équivalente
              </span>

            </div>


            <div className="dashboard-diagnostic-period-head">
              <span>
                Précédente
              </span>

              <span>
                Actuelle
              </span>

              <span>
                Évolution
              </span>
            </div>


            <div className="dashboard-diagnostic-grid">

              <section className="dashboard-diagnostic-card">
                <div className="dashboard-diagnostic-card-head">
                  <span>
                    Efficacité commerciale
                  </span>

                  <strong>
                    Taux d'acceptation
                  </strong>
                </div>

                <div className="dashboard-diagnostic-comparison">
                  <span>
                    {hasPreviousCommercial
                      ? `${previousCommercialDiagnostic.acceptanceRate.toFixed(1)} %`
                      : "—"}
                  </span>

                  <strong>
                    {currentCommercialDiagnostic.acceptanceRate.toFixed(1)} %
                  </strong>

                  <span
                    className="dashboard-diagnostic-evolution"
                    data-tone={commercialEvolution.tone}
                  >
                    <b>
                      {commercialEvolution.arrow}
                    </b>

                    {commercialEvolution.label}
                  </span>
                </div>

                <div className="dashboard-diagnostic-details">
                  <span>
                    Devis moyen
                    <strong>
                      {formatCurrency(
                        currentCommercialDiagnostic.averageQuote
                      )}
                    </strong>
                  </span>

                  <span>
                    Devis médian
                    <strong>
                      {formatCurrency(
                        currentCommercialDiagnostic.medianQuote
                      )}
                    </strong>
                  </span>

                  <span>
                    Acceptation médiane
                    <strong>
                      {currentCommercialDiagnostic.medianAcceptanceDays.toFixed(0)} j
                    </strong>
                  </span>
                </div>
              </section>


              <section className="dashboard-diagnostic-card">
                <div className="dashboard-diagnostic-card-head">
                  <span>
                    Qualité d'encaissement
                  </span>

                  <strong>
                    Taux d'encaissement
                  </strong>
                </div>

                <div className="dashboard-diagnostic-comparison">
                  <span>
                    {hasPreviousCollection
                      ? `${previousCollectionDiagnostic.collectionRate.toFixed(1)} %`
                      : "—"}
                  </span>

                  <strong>
                    {currentCollectionDiagnostic.collectionRate.toFixed(1)} %
                  </strong>

                  <span
                    className="dashboard-diagnostic-evolution"
                    data-tone={collectionEvolution.tone}
                  >
                    <b>
                      {collectionEvolution.arrow}
                    </b>

                    {collectionEvolution.label}
                  </span>
                </div>

                <div className="dashboard-diagnostic-details">
                  <span>
                    Délai moyen
                    <strong>
                      {currentCollectionDiagnostic.averagePaymentDays.toFixed(0)} j
                    </strong>
                  </span>

                  <span>
                    Délai médian
                    <strong>
                      {currentCollectionDiagnostic.medianPaymentDays.toFixed(0)} j
                    </strong>
                  </span>

                  <span>
                    Paiement moyen
                    <strong>
                      {formatCurrency(
                        currentCollectionDiagnostic.averagePayment
                      )}
                    </strong>
                  </span>
                </div>
              </section>


              <section className="dashboard-diagnostic-card">
                <div className="dashboard-diagnostic-card-head">
                  <span>
                    Structure du revenu
                  </span>

                  <strong>
                    Part récurrente
                  </strong>
                </div>

                <div className="dashboard-diagnostic-comparison">
                  <span>
                    {hasPreviousRevenue
                      ? `${previousRevenueDiagnostic.recurringShare.toFixed(1)} %`
                      : "—"}
                  </span>

                  <strong>
                    {currentRevenueDiagnostic.recurringShare.toFixed(1)} %
                  </strong>

                  <span
                    className="dashboard-diagnostic-evolution"
                    data-tone={recurringEvolution.tone}
                  >
                    <b>
                      {recurringEvolution.arrow}
                    </b>

                    {recurringEvolution.label}
                  </span>
                </div>

                <div className="dashboard-diagnostic-details">
                  <span>
                    Facture moyenne
                    <strong>
                      {formatCurrency(
                        currentRevenueDiagnostic.averageInvoice
                      )}
                    </strong>
                  </span>

                  <span>
                    Facture médiane
                    <strong>
                      {formatCurrency(
                        currentRevenueDiagnostic.medianInvoice
                      )}
                    </strong>
                  </span>

                  <span>
                    Récurrent
                    <strong>
                      {formatCurrency(
                        currentRevenueDiagnostic.recurringRevenue
                      )}
                    </strong>
                  </span>
                </div>
              </section>


              <section className="dashboard-diagnostic-card">
                <div className="dashboard-diagnostic-card-head">
                  <span>
                    Concentration & exposition
                  </span>

                  <strong>
                    Part du premier client
                  </strong>
                </div>

                <div className="dashboard-diagnostic-comparison">
                  <span>
                    {hasPreviousExposure
                      ? `${previousExposureDiagnostic.topOneShare.toFixed(1)} %`
                      : "—"}
                  </span>

                  <strong>
                    {currentExposureDiagnostic.topOneShare.toFixed(1)} %
                  </strong>

                  <span
                    className="dashboard-diagnostic-evolution"
                    data-tone={exposureEvolution.tone}
                  >
                    <b>
                      {exposureEvolution.arrow}
                    </b>

                    {exposureEvolution.label}
                  </span>
                </div>

                <div className="dashboard-diagnostic-details">
                  <span>
                    Top 3
                    <strong>
                      {currentExposureDiagnostic.topThreeShare.toFixed(1)} %
                    </strong>
                  </span>

                  <span>
                    Exposition moyenne
                    <strong>
                      {formatCurrency(
                        currentExposureDiagnostic.averageExposure
                      )}
                    </strong>
                  </span>

                  <span>
                    Exposition médiane
                    <strong>
                      {formatCurrency(
                        currentExposureDiagnostic.medianExposure
                      )}
                    </strong>
                  </span>
                </div>
              </section>

            </div>

          </article>
        )}



          </div>

        </section>
      )}

    </section>
  );
}
