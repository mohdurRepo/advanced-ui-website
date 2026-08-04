import {
  getMarketChartSeriesTheme,
  getMarketChartTheme,
} from "./market-chart-theme";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TIME_ZONE = "Asia/Riyadh";

const DEFAULT_LANGUAGE = "en";

const DEFAULT_DECIMALS = 2;

const MOBILE_BREAKPOINT = 576;

const TABLET_BREAKPOINT = 768;

/* ==========================================================================
   Text Helpers
   ========================================================================== */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ==========================================================================
   Numeric Helpers
   ========================================================================== */

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function formatNumber(
  value,
  { language = DEFAULT_LANGUAGE, decimals = DEFAULT_DECIMALS } = {},
) {
  const number = toFiniteNumber(value);

  if (number === null) {
    return "—";
  }

  return new Intl.NumberFormat(language, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
}

function formatCompactNumber(
  value,
  { language = DEFAULT_LANGUAGE, decimals = DEFAULT_DECIMALS } = {},
) {
  const number = toFiniteNumber(value);

  if (number === null) {
    return "—";
  }

  const absoluteValue = Math.abs(number);

  if (absoluteValue < 1000) {
    return formatNumber(number, {
      language,
      decimals,
    });
  }

  return new Intl.NumberFormat(language, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(number);
}

/* ==========================================================================
   Date Helpers
   ========================================================================== */

function createDateFormatter({
  language = DEFAULT_LANGUAGE,
  timeZone = DEFAULT_TIME_ZONE,
  range = "1D",
} = {}) {
  const intraday = range === "1D";

  return new Intl.DateTimeFormat(language, {
    timeZone,

    ...(intraday
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {
          day: "2-digit",
          month: "short",
          year:
            range === "1Y" || range === "5Y" || range === "ALL"
              ? "numeric"
              : undefined,
        }),
  });
}

function createTooltipDateFormatter({
  language = DEFAULT_LANGUAGE,
  timeZone = DEFAULT_TIME_ZONE,
  range = "1D",
} = {}) {
  return new Intl.DateTimeFormat(language, {
    timeZone,

    day: "2-digit",
    month: "short",
    year: "numeric",

    ...(range === "1D"
      ? {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }
      : {}),
  });
}

/* ==========================================================================
   Point Helpers
   ========================================================================== */

function getPointTimestamp(point) {
  return toFiniteNumber(point?.x);
}

function getPointValue(point, mode) {
  if (mode === "candlestick") {
    return toFiniteNumber(point?.close);
  }

  return toFiniteNumber(point?.y);
}

function getPreviousPoint(point) {
  const points = point?.series?.points;

  if (!Array.isArray(points)) {
    return null;
  }

  const pointIndex = points.indexOf(point);

  if (pointIndex <= 0) {
    return null;
  }

  return points[pointIndex - 1];
}

function getPointChange(point, mode) {
  const currentValue = getPointValue(point, mode);
  const previousPoint = getPreviousPoint(point);
  const previousValue = getPointValue(previousPoint, mode);

  if (currentValue === null || previousValue === null) {
    return {
      amount: null,
      percentage: null,
      direction: "neutral",
    };
  }

  const amount = currentValue - previousValue;

  const percentage =
    previousValue === 0 ? null : (amount / previousValue) * 100;

  let direction = "neutral";

  if (amount > 0) {
    direction = "up";
  } else if (amount < 0) {
    direction = "down";
  }

  return {
    amount,
    percentage,
    direction,
  };
}

/* ==========================================================================
   Tooltip Markup
   ========================================================================== */

function createChangeMarkup(change, { language, decimals }) {
  if (change.amount === null) {
    return "";
  }

  const sign = change.amount > 0 ? "+" : "";

  const percentage =
    change.percentage === null
      ? ""
      : `
      <span class="market-chart-tooltip__percentage">
        (${sign}${escapeHTML(
          formatNumber(change.percentage, {
            language,
            decimals: 2,
          }),
        )}%)
      </span>
    `;

  return `
    <div
      class="
        market-chart-tooltip__change
        market-chart-tooltip__change--${change.direction}
      "
    >
      <span>${sign}${escapeHTML(
        formatNumber(change.amount, {
          language,
          decimals,
        }),
      )}</span>

      ${percentage}
    </div>
  `;
}

function createTrendTooltip(
  point,
  { symbol, language, decimals, dateFormatter },
) {
  const timestamp = getPointTimestamp(point);
  const value = getPointValue(point, "trend");
  const change = getPointChange(point, "trend");

  const date =
    timestamp === null ? "" : dateFormatter.format(new Date(timestamp));

  return `
    <div class="market-chart-tooltip">
      <div class="market-chart-tooltip__header">
        <span class="market-chart-tooltip__symbol">
          ${escapeHTML(symbol)}
        </span>

        <time class="market-chart-tooltip__date">
          ${escapeHTML(date)}
        </time>
      </div>

      <div class="market-chart-tooltip__primary">
        ${escapeHTML(
          formatNumber(value, {
            language,
            decimals,
          }),
        )}
      </div>

      ${createChangeMarkup(change, {
        language,
        decimals,
      })}
    </div>
  `;
}

function createCandlestickTooltip(
  point,
  { symbol, language, decimals, dateFormatter },
) {
  const timestamp = getPointTimestamp(point);
  const change = getPointChange(point, "candlestick");

  const date =
    timestamp === null ? "" : dateFormatter.format(new Date(timestamp));

  const values = [
    ["Open", point.open],
    ["High", point.high],
    ["Low", point.low],
    ["Close", point.close],
  ];

  const rows = values
    .map(
      ([label, value]) => `
        <div class="market-chart-tooltip__row">
          <span class="market-chart-tooltip__label">
            ${escapeHTML(label)}
          </span>

          <span class="market-chart-tooltip__value">
            ${escapeHTML(
              formatNumber(value, {
                language,
                decimals,
              }),
            )}
          </span>
        </div>
      `,
    )
    .join("");

  return `
    <div class="market-chart-tooltip">
      <div class="market-chart-tooltip__header">
        <span class="market-chart-tooltip__symbol">
          ${escapeHTML(symbol)}
        </span>

        <time class="market-chart-tooltip__date">
          ${escapeHTML(date)}
        </time>
      </div>

      <div class="market-chart-tooltip__ohlc">
        ${rows}
      </div>

      ${createChangeMarkup(change, {
        language,
        decimals,
      })}
    </div>
  `;
}

/* ==========================================================================
   Axis Labels
   ========================================================================== */

function createXAxisLabelFormatter({ language, timeZone, range }) {
  const formatter = createDateFormatter({
    language,
    timeZone,
    range,
  });

  return function xAxisLabelFormatter() {
    const timestamp = toFiniteNumber(this.value);

    if (timestamp === null) {
      return "";
    }

    return formatter.format(new Date(timestamp));
  };
}

function createYAxisLabelFormatter({ language, decimals }) {
  return function yAxisLabelFormatter() {
    return formatCompactNumber(this.value, {
      language,
      decimals,
    });
  };
}

/* ==========================================================================
   Tick Configuration
   ========================================================================== */

function getXAxisTickPixelInterval(range) {
  switch (range) {
    case "1D":
      return 90;

    case "1W":
      return 100;

    case "1M":
    case "3M":
      return 110;

    case "6M":
    case "1Y":
      return 120;

    case "5Y":
    case "ALL":
      return 130;

    default:
      return 100;
  }
}

/* ==========================================================================
   Shared Highcharts Options
   ========================================================================== */

export function createMarketChartOptions({
  Highcharts,
  element,

  mode = "trend",
  range = "1D",
  direction = "neutral",

  symbol = "TASI",
  seriesName = symbol,

  data = [],

  language = document.documentElement.lang || DEFAULT_LANGUAGE,
  timeZone = DEFAULT_TIME_ZONE,

  decimals = DEFAULT_DECIMALS,

  xAxisTitle = null,
  yAxisTitle = null,

  animation = true,

  accessibilityDescription = "",
} = {}) {
  if (!Highcharts) {
    throw new TypeError("createMarketChartOptions() requires Highcharts.");
  }

  if (!(element instanceof Element)) {
    throw new TypeError(
      "createMarketChartOptions() requires a valid chart element.",
    );
  }

  const theme = getMarketChartTheme(element);

  const seriesTheme = getMarketChartSeriesTheme(
    Highcharts,
    theme,
    mode,
    direction,
  );

  const tooltipDateFormatter = createTooltipDateFormatter({
    language,
    timeZone,
    range,
  });

  const seriesType =
    mode === "candlestick"
      ? "candlestick"
      : mode === "line"
        ? "line"
        : "areaspline";

  return {
    chart: {
      backgroundColor: theme.background,

      spacingTop: 18,
      spacingRight: 18,
      spacingBottom: 12,
      spacingLeft: 10,

      marginRight: 72,
      marginLeft: 10,

      animation,

      reflow: false,

      styledMode: false,
    },

    accessibility: {
      enabled: true,

      description: accessibilityDescription || undefined,

      keyboardNavigation: {
        enabled: true,
      },
    },

    credits: {
      enabled: false,
    },

    exporting: {
      enabled: false,

      fallbackToExportServer: false,
    },

    legend: {
      enabled: false,
    },

    navigator: {
      enabled: false,
    },

    scrollbar: {
      enabled: false,
    },

    rangeSelector: {
      enabled: false,
    },

    title: {
      text: null,
    },

    subtitle: {
      text: null,
    },

    xAxis: {
      type: "datetime",

      ordinal: true,

      lineColor: theme.border,
      lineWidth: 1,

      tickColor: theme.border,
      tickLength: 5,
      tickWidth: 1,

      tickPixelInterval: getXAxisTickPixelInterval(range),

      minPadding: 0.015,
      maxPadding: 0.015,

      startOnTick: false,
      endOnTick: false,

      crosshair: {
        color: theme.crosshair,
        dashStyle: "ShortDash",
        width: 1,

        snap: true,

        zIndex: 3,
      },

      labels: {
        enabled: true,

        align: "center",

        autoRotation: false,
        rotation: 0,

        reserveSpace: true,

        step: 1,

        y: 22,

        style: {
          color: theme.muted,

          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          fontWeight: "500",

          textOverflow: "none",
        },

        formatter: createXAxisLabelFormatter({
          language,
          timeZone,
          range,
        }),
      },

      title: {
        text: xAxisTitle,

        margin: 14,

        style: {
          color: theme.muted,

          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          fontWeight: "600",
        },
      },
    },

    yAxis: {
      opposite: true,

      gridLineColor: theme.grid,
      gridLineDashStyle: "ShortDot",
      gridLineWidth: 1,

      lineColor: theme.border,
      lineWidth: 0,

      tickColor: theme.border,
      tickLength: 0,
      tickWidth: 0,

      tickAmount: 5,

      startOnTick: false,
      endOnTick: false,

      minPadding: 0.08,
      maxPadding: 0.12,

      crosshair: {
        color: theme.crosshair,
        dashStyle: "ShortDash",
        width: 1,

        snap: false,

        zIndex: 3,

        label: {
          enabled: true,

          align: "left",

          backgroundColor: theme.heading,
          borderColor: theme.heading,
          borderRadius: 4,
          borderWidth: 1,

          padding: 5,

          style: {
            color:
              theme.background === "transparent" ? "#ffffff" : theme.background,

            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: "700",

            textOutline: "none",
          },

          formatter(value) {
            return formatNumber(value, {
              language,
              decimals,
            });
          },
        },
      },

      labels: {
        align: "left",

        reserveSpace: true,

        x: 10,
        y: 4,

        style: {
          color: theme.muted,

          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          fontWeight: "500",

          textOverflow: "none",
        },

        formatter: createYAxisLabelFormatter({
          language,
          decimals,
        }),
      },

      title: {
        text: yAxisTitle,

        margin: 16,

        rotation: 90,

        style: {
          color: theme.muted,

          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          fontWeight: "600",
        },
      },
    },

    tooltip: {
      enabled: true,

      useHTML: true,

      outside: false,

      shared: false,
      split: false,

      followPointer: false,
      followTouchMove: true,

      hideDelay: 80,

      animation,

      backgroundColor: theme.tooltipBackground,
      borderColor: theme.tooltipBorder,
      borderRadius: 10,
      borderWidth: 1,

      padding: 0,

      shadow: {
        color: "rgb(0 0 0 / 0.18)",
        offsetX: 0,
        offsetY: 8,
        opacity: 0.16,
        width: 18,
      },

      className: "market-chart-highcharts-tooltip",

      style: {
        color: theme.text,

        fontFamily: "var(--font-sans)",
        fontSize: "12px",

        pointerEvents: "none",
      },

      formatter() {
        const point = this.point;

        if (!point) {
          return false;
        }

        const tooltipOptions = {
          symbol,
          language,
          decimals,
          dateFormatter: tooltipDateFormatter,
        };

        if (mode === "candlestick") {
          return createCandlestickTooltip(point, tooltipOptions);
        }

        return createTrendTooltip(point, tooltipOptions);
      },

      positioner(labelWidth, labelHeight, point) {
        const chart = this.chart;

        const plotLeft = chart.plotLeft;
        const plotTop = chart.plotTop;
        const plotRight = plotLeft + chart.plotWidth;
        const plotBottom = plotTop + chart.plotHeight;

        const preferredX = point.plotX + plotLeft + 16;
        const alternateX = point.plotX + plotLeft - labelWidth - 16;

        const x =
          preferredX + labelWidth <= plotRight
            ? preferredX
            : Math.max(plotLeft, alternateX);

        const centeredY = point.plotY + plotTop - labelHeight / 2;

        const y = Math.min(
          Math.max(centeredY, plotTop),
          Math.max(plotTop, plotBottom - labelHeight),
        );

        return {
          x,
          y,
        };
      },
    },

    plotOptions: {
      series: {
        animation,

        turboThreshold: 0,

        dataGrouping: {
          enabled: false,
        },

        stickyTracking: true,

        findNearestPointBy: "x",

        cropThreshold: 5000,

        point: {
          events: {
            mouseOver() {
              element.setAttribute("data-chart-hover", "true");
            },

            mouseOut() {
              element.removeAttribute("data-chart-hover");
            },
          },
        },

        states: {
          inactive: {
            enabled: false,
          },

          hover: {
            halo: {
              size: mode === "candlestick" ? 0 : 5,

              attributes: {
                fill: theme.line,
                "fill-opacity": 0.12,
                stroke: theme.line,
                "stroke-width": 1,
              },
            },
          },
        },
      },

      areaspline: {
        threshold: null,
      },

      candlestick: {
        pointPadding: 0.08,
        groupPadding: 0.08,
      },
    },

    series: [
      {
        id: `${symbol}-${mode}`,

        type: seriesType,

        name: seriesName,

        data,

        ...seriesTheme,
      },
    ],

    responsive: {
      rules: [
        {
          condition: {
            maxWidth: TABLET_BREAKPOINT,
          },

          chartOptions: {
            chart: {
              spacingRight: 12,
              spacingLeft: 8,

              marginRight: 62,
              marginLeft: 8,
            },

            xAxis: {
              tickPixelInterval: 105,

              labels: {
                style: {
                  fontSize: "10px",
                },
              },
            },

            yAxis: {
              labels: {
                x: 8,

                style: {
                  fontSize: "10px",
                },
              },
            },
          },
        },

        {
          condition: {
            maxWidth: MOBILE_BREAKPOINT,
          },

          chartOptions: {
            chart: {
              spacingTop: 12,
              spacingRight: 8,
              spacingBottom: 18,
              spacingLeft: 6,

              marginRight: 56,
              marginLeft: 6,
            },

            xAxis: {
              tickPixelInterval: 115,

              labels: {
                align: "right",

                rotation: -45,

                x: -3,
                y: 19,

                style: {
                  fontSize: "10px",
                },
              },
            },

            yAxis: {
              tickAmount: 4,

              labels: {
                x: 7,

                style: {
                  fontSize: "10px",
                },
              },
            },

            tooltip: {
              positioner(labelWidth, labelHeight, point) {
                const chart = this.chart;

                const plotLeft = chart.plotLeft;
                const plotTop = chart.plotTop;
                const plotRight = plotLeft + chart.plotWidth;

                const centeredX = point.plotX + plotLeft - labelWidth / 2;

                const x = Math.min(
                  Math.max(centeredX, plotLeft),
                  Math.max(plotLeft, plotRight - labelWidth),
                );

                const abovePoint = point.plotY + plotTop - labelHeight - 14;

                const y =
                  abovePoint >= plotTop
                    ? abovePoint
                    : Math.min(
                        point.plotY + plotTop + 14,
                        chart.chartHeight - labelHeight - 8,
                      );

                return {
                  x,
                  y,
                };
              },
            },
          },
        },
      ],
    },
  };
}
