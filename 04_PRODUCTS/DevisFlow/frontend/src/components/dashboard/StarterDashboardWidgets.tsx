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


interface StarterDashboardWidgetsProps {
  clients: Client[];
  requests: Request[];
  quotes: Quote[];
  invoices: Invoice[];
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


export default function StarterDashboardWidgets({
  clients,
  requests,
  quotes,
  invoices,
  recurringInvoices,
  reminderCockpit,
  loading = false,
}: StarterDashboardWidgetsProps) {
  const navigate = useNavigate();

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


  return (
    <section className="dashboard-pilotage dashboard-pilotage-v3">

      <div className="dashboard-section-header">
        <div>
          <span className="eyebrow">
            Pilotage
          </span>

          <h2>
            Comprendre l'activité en un coup d'œil
          </h2>

          <p>
            Activité commerciale, clients clés
            et premiers signaux à surveiller.
          </p>
        </div>

        <span className="starter-insight-badge">
          Starter
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

    </section>
  );
}
