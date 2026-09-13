import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  useWorkspace,
} from "../../context/WorkspaceContext";

import {
  getForecast,
  recalculateForecasts,
  type ForecastAvailability,
  type ForecastIndicator,
} from "../../services/intelligenceService";

import "../../styles/intelligence-forecasting.css";

import IntelligenceRecommendedActions
  from "./IntelligenceRecommendedActions";


const INDICATORS: Array<{
  code: ForecastIndicator;
  label: string;
  description: string;
  actionLabel: string;
  route: string;
  format: "currency" | "percentage";
}> = [
  {
    code: "monthly_revenue",
    label: "Chiffre d'affaires",
    description:
      "Projection du chiffre d'affaires facturé.",
    actionLabel:
      "Examiner les factures",
    route:
      "/invoices?period=all",
    format:
      "currency",
  },
  {
    code: "monthly_collections",
    label: "Encaissements",
    description:
      "Projection des règlements encaissés.",
    actionLabel:
      "Voir les encaissements",
    route:
      "/payments",
    format:
      "currency",
  },
  {
    code: "quote_acceptance_rate",
    label: "Taux d'acceptation",
    description:
      "Projection du taux de conversion des devis.",
    actionLabel:
      "Analyser les devis",
    route:
      "/quotes",
    format:
      "percentage",
  },
  {
    code: "recurring_revenue_share",
    label: "Revenu récurrent",
    description:
      "Projection de la part du revenu récurrent.",
    actionLabel:
      "Voir les factures",
    route:
      "/invoices?period=all",
    format:
      "percentage",
  },
];


function formatValue(
  value: number,
  format: "currency" | "percentage"
) {
  if (format === "percentage") {
    return `${value.toFixed(1)} %`;
  }

  return new Intl.NumberFormat(
    "fr-CH",
    {
      style: "currency",
      currency: "CHF",
      maximumFractionDigits: 0,
    }
  ).format(value);
}


function formatPeriod(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      month: "short",
      year: "2-digit",
    }
  ).format(date);
}


function qualityLabel(
  quality?: string | null
) {
  switch (quality) {
    case "good":
      return "Bonne";
    case "moderate":
      return "Modérée";
    case "low":
      return "Faible";
    default:
      return "Indéterminée";
  }
}



function getSmapeLevel(
  value: number
) {
  if (value <= 15) {
    return {
      label: "Bonne",
      className: "is-good",
    };
  }

  if (value <= 35) {
    return {
      label: "À surveiller",
      className: "is-moderate",
    };
  }

  return {
    label: "Faible",
    className: "is-low",
  };
}


function getCoverageLevel(
  value: number
) {
  const percent =
    value * 100;

  if (percent >= 80) {
    return {
      label: "Bonne",
      className: "is-good",
    };
  }

  if (percent >= 60) {
    return {
      label: "À surveiller",
      className: "is-moderate",
    };
  }

  return {
    label: "Faible",
    className: "is-low",
  };
}


function getCalibrationLevel(
  value: number
) {
  if (value >= 6) {
    return {
      label: "Suffisante",
      className: "is-good",
    };
  }

  if (value >= 3) {
    return {
      label: "Limitée",
      className: "is-moderate",
    };
  }

  return {
    label: "Insuffisante",
    className: "is-low",
  };
}


function formatErrorMetric(
  value: number,
  format: "currency" | "percentage"
) {
  if (format === "currency") {
    return formatValue(
      value,
      "currency"
    );
  }

  return `${value.toFixed(1)} pts`;
}


function getMonthParam(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}`;
}


function getBusinessRoute(
  baseRoute: string,
  indicator: ForecastIndicator,
  date?: string | null
) {
  const separator =
    baseRoute.includes("?")
      ? "&"
      : "?";

  const params =
    new URLSearchParams({
      from: "intelligence",
      indicator,
    });

  if (date) {
    const month =
      getMonthParam(date);

    if (month) {
      params.set(
        "month",
        month
      );
    }
  }

  return (
    `${baseRoute}${separator}`
    + params.toString()
  );
}


function ForecastTooltip({
  active,
  payload,
  indicatorFormat,
}: {
  active?: boolean;
  payload?: any[];
  indicatorFormat:
    | "currency"
    | "percentage";
}) {
  if (
    !active
    || !payload
    || payload.length === 0
  ) {
    return null;
  }

  const item =
    payload[0]?.payload;

  if (!item) {
    return null;
  }

  return (
    <div className="intelligence-tooltip">
      <strong>
        {item.label}
      </strong>

      {item.actual !== null
        && item.actual !== undefined && (
          <div className="is-real">
            <span>
              Valeur réelle
            </span>

            <b>
              {formatValue(
                Number(item.actual),
                indicatorFormat
              )}
            </b>
          </div>
        )}

      {item.kind === "forecast" && (
        <>
          <div className="is-low">
            <span>
              Tendance basse
            </span>

            <b>
              {formatValue(
                Number(
                  item.lower
                  ?? item.forecast
                ),
                indicatorFormat
              )}
            </b>
          </div>

          <div className="is-central">
            <span>
              Prévision centrale
            </span>

            <b>
              {formatValue(
                Number(
                  item.forecast
                ),
                indicatorFormat
              )}
            </b>
          </div>

          <div className="is-high">
            <span>
              Tendance haute
            </span>

            <b>
              {formatValue(
                Number(
                  item.upper
                  ?? item.forecast
                ),
                indicatorFormat
              )}
            </b>
          </div>
        </>
      )}
    </div>
  );
}


export default function IntelligenceForecasting() {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] = useSearchParams();

  const requestedIndicator =
    searchParams.get(
      "intelligence"
    ) as ForecastIndicator | null;

  const requestedMonth =
    searchParams.get("month");

  const {
    hasEntitlement,
  } = useWorkspace();

  const forecastingEnabled =
    hasEntitlement("forecasting");

  const [
    forecasts,
    setForecasts,
  ] = useState<
    Partial<
      Record<
        ForecastIndicator,
        ForecastAvailability
      >
    >
  >({});

  const [
    openIndicator,
    setOpenIndicator,
  ] = useState<
    ForecastIndicator | null
  >(null);

  const [
    selectedPoint,
    setSelectedPoint,
  ] = useState<number | null>(
    null
  );

  const [
    selectedHistoryPoint,
    setSelectedHistoryPoint,
  ] = useState<number | null>(
    null
  );

  const [
    historyMonths,
    setHistoryMonths,
  ] = useState<3 | 6>(6);


  useEffect(() => {
    if (
      !requestedIndicator
      || !INDICATORS.some(
        (item) =>
          item.code === requestedIndicator
      )
    ) {
      return;
    }

    setOpenIndicator(
      requestedIndicator
    );

    const forecast =
      forecasts[
        requestedIndicator
      ]?.forecast;

    if (
      requestedMonth
      && forecast?.history
    ) {
      const visibleRequestedHistory =
        forecast.history.slice(
          -historyMonths
        );

      const historyIndex =
        visibleRequestedHistory.findIndex(
          (point) =>
            point.date.substring(
              0,
              7
            ) === requestedMonth
        );

      if (historyIndex >= 0) {
        setSelectedHistoryPoint(
          historyIndex
        );
      }
    }
  }, [
    requestedIndicator,
    requestedMonth,
    forecasts,
    historyMonths,
  ]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    recalculating,
    setRecalculating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  async function loadForecasts() {
    if (!forecastingEnabled) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const results =
        await Promise.all(
          INDICATORS.map(
            async (indicator) => [
              indicator.code,
              await getForecast(
                indicator.code
              ),
            ] as const
          )
        );

      setForecasts(
        Object.fromEntries(
          results
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les prévisions."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadForecasts();
  }, [forecastingEnabled]);


  async function recalculate() {
    try {
      setRecalculating(true);
      setError("");

      await recalculateForecasts(
        3
      );

      await loadForecasts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de recalculer."
      );
    } finally {
      setRecalculating(false);
    }
  }


  if (!forecastingEnabled) {
    return null;
  }


  return (
    <section className="intelligence-forecasting">

      <div className="intelligence-ai-badge">
        <BrainCircuit size={22} />
      </div>

      <div className="intelligence-forecasting-header">
        <div>
          <span className="intelligence-eyebrow">
            <Sparkles size={14} />
            Intelligence
          </span>

          <h2>
            Tendances prédictives
          </h2>

          <p>
            Explorez l'évolution probable de
            votre activité et accédez directement
            aux données métier concernées.
          </p>
        </div>

        <button
          type="button"
          className="intelligence-refresh-button"
          disabled={
            recalculating
            || loading
          }
          onClick={() =>
            void recalculate()
          }
        >
          <RefreshCw
            size={15}
            className={
              recalculating
                ? "is-spinning"
                : ""
            }
          />

          {recalculating
            ? "Recalcul…"
            : "Actualiser"}
        </button>
      </div>


      {error && (
        <div className="intelligence-error">
          {error}
        </div>
      )}


      <div className="intelligence-forecast-grid">
        {INDICATORS.map(
          (indicator) => {
            const result =
              forecasts[
                indicator.code
              ];

            const open =
              openIndicator
              === indicator.code;

            const forecast =
              result?.forecast;

            const points =
              forecast?.points ?? [];

            const history =
              forecast?.history ?? [];

            const visibleHistory =
              history.slice(
                -historyMonths
              );

            const chartData = [
              ...visibleHistory.map(
                (point) => ({
                  date: point.date,
                  label:
                    formatPeriod(
                      point.date
                    ),
                  actual: point.value,
                  forecast:
                    null as number | null,
                  lower:
                    null as number | null,
                  upper:
                    null as number | null,
                  range:
                    null as number | null,
                  kind:
                    "actual" as const,
                })
              ),
              ...points.map(
                (point) => ({
                  date:
                    point.forecast_date,
                  label:
                    formatPeriod(
                      point.forecast_date
                    ),
                  actual:
                    null as number | null,
                  forecast:
                    point.value,
                  lower:
                    point.lower_bound,
                  upper:
                    point.upper_bound,
                  range:
                    point.lower_bound !== null
                    && point.upper_bound !== null
                      ? (
                        point.upper_bound
                        - point.lower_bound
                      )
                      : null,
                  kind:
                    "forecast" as const,
                })
              ),
            ];

            if (
              visibleHistory.length > 0
              && chartData.length
                > visibleHistory.length
            ) {
              chartData[
                visibleHistory.length - 1
              ].forecast =
                visibleHistory[
                  visibleHistory.length - 1
                ].value;
            }

            const todayLabel =
              visibleHistory.length > 0
                ? formatPeriod(
                    visibleHistory[
                      visibleHistory.length - 1
                    ].date
                  )
                : null;

            const firstForecast =
              points[0];

            const lastForecast =
              points[
                points.length - 1
              ];

            const hasNumericForecast =
              Boolean(
                firstForecast
                && lastForecast
                && Number.isFinite(
                  firstForecast.value
                )
                && Number.isFinite(
                  lastForecast.value
                )
              );

            const rising =
              hasNumericForecast
                ? (
                  lastForecast.value
                  >= firstForecast.value
                )
                : null;

            const selectedHistory =
              selectedHistoryPoint !== null
                ? visibleHistory[
                    selectedHistoryPoint
                  ]
                : null;

            const selectedForecast =
              selectedPoint !== null
                ? points[
                    selectedPoint
                  ]
                : null;

            return (
              <article
                key={indicator.code}
                className={
                  open
                    ? "intelligence-forecast-card is-open"
                    : "intelligence-forecast-card"
                }
              >
                <button
                  type="button"
                  className="intelligence-forecast-summary"
                  onClick={() => {
                    setSelectedPoint(
                      null
                    );

                    setSelectedHistoryPoint(
                      null
                    );

                    setOpenIndicator(
                      open
                        ? null
                        : indicator.code
                    );
                  }}
                >
                  <div>
                    <span className="intelligence-card-label">
                      {indicator.label}
                    </span>

                    <small>
                      {indicator.description}
                    </small>
                  </div>

                  <div className="intelligence-card-status">
                    {result?.available
                      && hasNumericForecast
                      && rising !== null ? (
                        <>
                          {rising ? (
                            <TrendingUp
                              size={17}
                            />
                          ) : (
                            <TrendingDown
                              size={17}
                            />
                          )}

                          <strong>
                            {rising
                              ? "Hausse"
                              : "Baisse"}
                          </strong>
                        </>
                      ) : (
                        <span>
                          À analyser
                        </span>
                      )}

                    {open ? (
                      <ChevronUp
                        size={17}
                      />
                    ) : (
                      <ChevronDown
                        size={17}
                      />
                    )}
                  </div>
                </button>


                {open && (
                  <div className="intelligence-forecast-detail">

                    {loading ? (
                      <div className="intelligence-empty-state">
                        Analyse des tendances…
                      </div>

                    ) : !result?.available
                      || !forecast
                      || points.length === 0 ? (
                        <div className="intelligence-empty-state">
                          <BrainCircuit
                            size={28}
                          />

                          <strong>
                            Historique insuffisant
                          </strong>

                          <p>
                            DevisFlow ne dispose pas encore
                            d'assez de données pour produire
                            une prévision fiable.
                          </p>

                          <button
                            type="button"
                            className="intelligence-business-action"
                            onClick={() =>
                              navigate(
                                indicator.route
                              )
                            }
                          >
                            {
                              indicator.actionLabel
                            }

                            <ArrowRight
                              size={15}
                            />
                          </button>
                        </div>

                    ) : (
                      <>
                        <div className="intelligence-history-toolbar">
                          <span>
                            Historique
                          </span>

                          <div>
                            <button
                              type="button"
                              className={
                                historyMonths === 3
                                  ? "is-active"
                                  : ""
                              }
                              onClick={() => {
                                setHistoryMonths(3);
                                setSelectedHistoryPoint(
                                  null
                                );
                              }}
                            >
                              3 mois
                            </button>

                            <button
                              type="button"
                              className={
                                historyMonths === 6
                                  ? "is-active"
                                  : ""
                              }
                              onClick={() => {
                                setHistoryMonths(6);
                                setSelectedHistoryPoint(
                                  null
                                );
                              }}
                            >
                              6 mois
                            </button>
                          </div>
                        </div>


                        <div className="intelligence-chart-shell">
                          <ResponsiveContainer
                            width="100%"
                            height={300}
                          >
                            <ComposedChart
                              data={chartData}
                              margin={{
                                top: 28,
                                right: 26,
                                bottom: 32,
                                left: 26,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 6"
                                vertical={false}
                              />

                              <XAxis
                                dataKey="label"
                                label={{
                                  value: "Période",
                                  position:
                                    "insideBottom",
                                  offset: -8,
                                }}
                              />

                              <YAxis
                                width={88}
                                label={{
                                  value:
                                    indicator.format
                                    === "currency"
                                      ? "Montant (CHF)"
                                      : "Taux (%)",
                                  angle: -90,
                                  position:
                                    "insideLeft",
                                }}
                              />

                              <Tooltip
                                content={(props) => (
                                  <ForecastTooltip
                                    active={props.active}
                                    payload={props.payload as any[]}
                                    indicatorFormat={
                                      indicator.format
                                    }
                                  />
                                )}
                              />


                              {todayLabel && (
                                <ReferenceLine
                                  x={todayLabel}
                                  stroke="#94a3b8"
                                  strokeDasharray="4 5"
                                  label={{
                                    value:
                                      "Aujourd’hui",
                                    position:
                                      "insideTopRight",
                                  }}
                                />
                              )}


                              <Area
                                type="monotone"
                                dataKey="lower"
                                stackId="forecast-band"
                                stroke="none"
                                fill="transparent"
                                connectNulls={false}
                                name="Tendance basse"
                              />

                              <Area
                                type="monotone"
                                dataKey="range"
                                stackId="forecast-band"
                                stroke="none"
                                fill="#7c3aed"
                                fillOpacity={0.10}
                                connectNulls={false}
                                name="Plage prévisionnelle"
                              />


                              <Line
                                type="monotone"
                                dataKey="actual"
                                name="Réel"
                                stroke="#2563eb"
                                strokeWidth={2.8}
                                connectNulls={false}
                                dot={({
                                  cx,
                                  cy,
                                  index,
                                }: any) => {
                                  const item =
                                    chartData[
                                      index
                                    ];

                                  if (
                                    !item
                                    || item.kind
                                      !== "actual"
                                  ) {
                                    return <g />;
                                  }

                                  return (
                                    <g
                                      className="actual-business-point"
                                      onClick={() => {
                                        setSelectedPoint(
                                          null
                                        );

                                        setSelectedHistoryPoint(
                                          index
                                        );
                                      }}
                                    >
                                      <circle
                                        className="actual-business-point-halo"
                                        cx={cx}
                                        cy={cy}
                                        r={11}
                                      />

                                      <circle
                                        className="actual-business-point-core"
                                        cx={cx}
                                        cy={cy}
                                        r={4.5}
                                      />
                                    </g>
                                  );
                                }}
                                activeDot={{
                                  r: 6,
                                }}
                              />


                              <Line
                                type="monotone"
                                dataKey="forecast"
                                name="Prévision centrale"
                                stroke="#7c3aed"
                                strokeWidth={2.8}
                                strokeDasharray="7 7"
                                connectNulls={false}
                                dot={({
                                  cx,
                                  cy,
                                  index,
                                }: any) => {
                                  const item =
                                    chartData[
                                      index
                                    ];

                                  if (
                                    !item
                                    || item.kind
                                      !== "forecast"
                                  ) {
                                    return <g />;
                                  }

                                  const forecastIndex =
                                    index
                                    - visibleHistory.length;

                                  return (
                                    <g
                                      className="forecast-bubble-group"
                                      onClick={() => {
                                        setSelectedHistoryPoint(
                                          null
                                        );

                                        setSelectedPoint(
                                          forecastIndex
                                        );
                                      }}
                                    >
                                      <circle
                                        className="forecast-bubble-halo"
                                        cx={cx}
                                        cy={cy}
                                        r={15}
                                      />

                                      <circle
                                        className="forecast-bubble"
                                        cx={cx}
                                        cy={cy}
                                        r={6}
                                      />
                                    </g>
                                  );
                                }}
                                activeDot={{
                                  r: 8,
                                }}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>


                        <div className="intelligence-chart-legend">
                          <span>
                            <i className="legend-real" />
                            Réel
                          </span>

                          <span>
                            <i className="legend-forecast" />
                            Prévision centrale
                          </span>

                          <span>
                            <i className="legend-band" />
                            Basse ↔ haute
                          </span>
                        </div>


                        {selectedHistory && (
                          <div className="intelligence-history-detail">
                            <div>
                              <span>
                                Donnée réelle
                              </span>

                              <strong>
                                {formatPeriod(
                                  selectedHistory.date
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Valeur observée
                              </span>

                              <strong>
                                {formatValue(
                                  selectedHistory.value,
                                  indicator.format
                                )}
                              </strong>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  getBusinessRoute(
                                    indicator.route,
                                    indicator.code,
                                    selectedHistory.date
                                  )
                                )
                              }
                            >
                              {
                                indicator.actionLabel
                              }

                              <ArrowRight
                                size={15}
                              />
                            </button>
                          </div>
                        )}


                        <div className="intelligence-horizon-row">
                          {points.map(
                            (
                              point,
                              index
                            ) => (
                              <button
                                key={
                                  point.forecast_date
                                }
                                type="button"
                                className={
                                  selectedPoint
                                    === index
                                    ? "intelligence-horizon is-selected"
                                    : "intelligence-horizon"
                                }
                                onClick={() => {
                                  setSelectedHistoryPoint(
                                    null
                                  );

                                  setSelectedPoint(
                                    index
                                  );
                                }}
                              >
                                <span>
                                  H+{
                                    point.horizon_step
                                  }
                                </span>

                                <strong>
                                  {formatValue(
                                    point.value,
                                    indicator.format
                                  )}
                                </strong>

                                <small>
                                  {formatPeriod(
                                    point.forecast_date
                                  )}
                                </small>
                              </button>
                            )
                          )}
                        </div>


                        {selectedForecast && (
                          <div className="intelligence-point-panel">
                            <div>
                              <span>
                                Prévision centrale
                              </span>

                              <strong>
                                {formatValue(
                                  selectedForecast.value,
                                  indicator.format
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Tendance basse
                              </span>

                              <strong>
                                {formatValue(
                                  selectedForecast.lower_bound
                                    ?? selectedForecast.value,
                                  indicator.format
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Tendance haute
                              </span>

                              <strong>
                                {formatValue(
                                  selectedForecast.upper_bound
                                    ?? selectedForecast.value,
                                  indicator.format
                                )}
                              </strong>
                            </div>
                          </div>
                        )}


                        <div className="intelligence-model-insights">
                          <div className="intelligence-model-title">
                            <strong>
                              Fiabilité du modèle
                            </strong>

                            <span>
                              Qualité{" "}
                              <b>
                                {qualityLabel(
                                  forecast.quality
                                )}
                              </b>
                            </span>
                          </div>

                          <div className="intelligence-model-metrics">

                            {forecast.rmse !== null && (
                              <div
                                className="intelligence-metric-card"
                                title="Erreur quadratique : cette métrique pénalise davantage les gros écarts entre prévision et réalité."
                              >
                                <span>
                                  RMSE
                                </span>

                                <strong>
                                  {formatErrorMetric(
                                    forecast.rmse,
                                    indicator.format
                                  )}
                                </strong>

                                <small>
                                  sensibilité aux gros écarts
                                </small>
                              </div>
                            )}

                            {forecast.mae !== null && (
                              <div
                                className="intelligence-metric-card"
                                title="Écart moyen entre les prévisions du modèle et les valeurs réellement observées."
                              >
                                <span>
                                  MAE
                                </span>

                                <strong>
                                  {formatErrorMetric(
                                    forecast.mae,
                                    indicator.format
                                  )}
                                </strong>

                                <small>
                                  erreur moyenne
                                </small>
                              </div>
                            )}

                            {forecast.smape !== null && (() => {
                              const level =
                                getSmapeLevel(
                                  forecast.smape
                                );

                              return (
                                <div
                                  className={`intelligence-metric-card ${level.className}`}
                                  title="Erreur relative moyenne du modèle. Plus le sMAPE est faible, plus la prévision est proche de la réalité."
                                >
                                  <span>
                                    sMAPE
                                  </span>

                                  <strong>
                                    {forecast.smape.toFixed(
                                      1
                                    )} %
                                  </strong>

                                  <small>
                                    erreur relative
                                  </small>

                                  <em>
                                    {level.label}
                                  </em>
                                </div>
                              );
                            })()}

                            {forecast.uncertainty_coverage
                              !== null && (() => {
                                const level =
                                  getCoverageLevel(
                                    forecast
                                      .uncertainty_coverage
                                  );

                                return (
                                  <div
                                    className={`intelligence-metric-card ${level.className}`}
                                    title="Part des erreurs historiques que la plage basse/haute est conçue pour couvrir. Ce n'est pas une probabilité de réussite de la prévision."
                                  >
                                    <span>
                                      Couverture
                                    </span>

                                    <strong>
                                      {Math.round(
                                        forecast
                                          .uncertainty_coverage
                                        * 100
                                      )} %
                                    </strong>

                                    <small>
                                      plage basse / haute
                                    </small>

                                    <em>
                                      {level.label}
                                    </em>
                                  </div>
                                );
                              })()}
                          </div>

                          <div className="intelligence-model-secondary">
                            <div>
                              <span>
                                Modèle retenu
                              </span>

                              <strong>
                                {
                                  forecast.selected_model
                                  ?? "—"
                                }
                              </strong>
                            </div>

                            {forecast.calibration_points
                              !== null && (() => {
                                const level =
                                  getCalibrationLevel(
                                    forecast
                                      .calibration_points
                                  );

                                return (
                                  <div
                                    className={`intelligence-calibration ${level.className}`}
                                    title="Nombre de résidus historiques issus du backtest utilisés pour calibrer la largeur de la plage basse/haute. Plus il y a de points, plus cette estimation devient généralement stable."
                                  >
                                    <span>
                                      Calibration de l'incertitude
                                    </span>

                                    <strong>
                                      {
                                        forecast
                                          .calibration_points
                                      } points historiques
                                    </strong>

                                    <small>
                                      {level.label}
                                    </small>
                                  </div>
                                );
                              })()}
                          </div>

                          <div className="intelligence-model-explanation">
                            <strong>
                              Comment lire ces indicateurs ?
                            </strong>

                            <p>
                              Le modèle estime une prévision centrale
                              et une plage basse / haute à partir
                              de ses erreurs observées sur l'historique.
                              Le sMAPE mesure la précision relative,
                              tandis que la calibration indique
                              combien de points historiques ont servi
                              à estimer l'incertitude.
                            </p>
                          </div>
                        </div>


                        <button
                          type="button"
                          className="intelligence-business-action"
                          onClick={() =>
                            navigate(
                              indicator.route
                            )
                          }
                        >
                          {
                            indicator.actionLabel
                          }

                          <ArrowRight
                            size={15}
                          />
                        </button>
                      </>
                    )}

                  </div>
                )}

              </article>
            );
          }
        )}
      </div>
      <IntelligenceRecommendedActions />

    </section>
  );
}
