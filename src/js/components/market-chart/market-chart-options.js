import {
  getMarketChartSeriesTheme,
  getMarketChartTheme,
} from "./market-chart-theme";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LANGUAGE = "en";
const DEFAULT_TIME_ZONE = "Asia/Riyadh";
const DEFAULT_DECIMALS = 2;

const HOUR_MS = 60 * 60 * 1000;

const MOBILE_BREAKPOINT = 576;
const TABLET_BREAKPOINT = 768;

const CONTEXT_LAYOUT = Object.freeze({
  overview: Object.freeze({
    spacingTop: 8,
    spacingRight: 16,
    spacingBottom: 8,
    spacingLeft: 28,

    marginTop: 8,
    marginRight: 72,
    marginLeft: 28,

    yAxisTickPixelInterval: 54,
    yAxisMinPadding: 0.05,
    yAxisMaxPadding: 0.06,

    navigatorHeight: 36,
    navigatorMargin: 10,
    navigatorHandleHeight: 18,
  }),

  performance: Object.freeze({
    spacingTop: 6,
    spacingRight: 12,
    spacingBottom: 6,
    spacingLeft: 20,

    marginTop: 6,
    marginRight: 64,
    marginLeft: 20,

    yAxisTickPixelInterval: 58,
    yAxisMinPadding: 0.03,
    yAxisMaxPadding: 0.04,

    navigatorHeight: 34,
    navigatorMargin: 8,
    navigatorHandleHeight: 17,
  }),
});

/* ==========================================================================
   Text
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
   Numbers
   ========================================================================== */

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

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

function getAxisDecimals(value, configuredDecimals) {
  const number = Math.abs(Number(value));

  if (!Number.isFinite(number)) {
    return configuredDecimals;
  }

  if (number >= 1000) {
    return 0;
  }

  if (number >= 100) {
    return Math.min(configuredDecimals, 1);
  }

  return Math.min(configuredDecimals, 2);
}

function formatAxisNumber(value, { language, decimals }) {
  return formatNumber(value, {
    language,

    decimals: getAxisDecimals(value, decimals),
  });
}

/* ==========================================================================
   Context
   ========================================================================== */

function resolveContext(element, context) {
  if (context === "overview" || context === "performance") {
    return context;
  }

  return element.classList.contains("market-chart--overview")
    ? "overview"
    : "performance";
}

/* ==========================================================================
   Directional Theme
   ========================================================================== */

function getDirectionColor(theme, direction) {
  if (direction === "up") {
    return theme.success;
  }

  if (direction === "down") {
    return theme.danger;
  }

  return theme.line;
}

function resolveTheme(element, direction) {
  const theme = getMarketChartTheme(element);

  return {
    ...theme,

    /*
     * Highcharts writes series colors directly into the SVG. Resolve the
     * semantic direction before creating the main and Navigator series.
     */

    line: getDirectionColor(theme, direction),
  };
}

/* ==========================================================================
   Date Formatters
   ========================================================================== */

function createIntradayFormatter({ language, timeZone }) {
  return new Intl.DateTimeFormat(language, {
    timeZone,

    hour: "2-digit",
    minute: "2-digit",

    hourCycle: "h23",
  });
}

function createDailyFormatter({ language, timeZone, includeYear = false }) {
  return new Intl.DateTimeFormat(language, {
    timeZone,

    day: "2-digit",
    month: "short",

    year: includeYear ? "numeric" : undefined,
  });
}

function createXAxisDateFormatter({ language, timeZone, range }) {
  if (range === "1D") {
    return createIntradayFormatter({
      language,
      timeZone,
    });
  }

  return createDailyFormatter({
    language,
    timeZone,

    includeYear: range === "1Y" || range === "5Y" || range === "ALL",
  });
}

function createTooltipDateFormatter({ language, timeZone, range }) {
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

          hourCycle: "h23",
        }
      : {}),
  });
}

/* ==========================================================================
   Point Values
   ========================================================================== */

function getPointTimestamp(point) {
  return toFiniteNumber(point?.x);
}

function getPointValue(point, mode) {
  if (!point) {
    return null;
  }

  return mode === "candlestick"
    ? toFiniteNumber(point.close)
    : toFiniteNumber(point.y);
}

function getPreviousVisiblePoint(point) {
  const points = point?.series?.points;

  if (!Array.isArray(points)) {
    return null;
  }

  const index = points.indexOf(point);

  return index > 0 ? points[index - 1] : null;
}

function getRawPointTimestamp(point) {
  if (Array.isArray(point)) {
    return toFiniteNumber(point[0]);
  }

  return toFiniteNumber(point?.x);
}

function getRawPointValue(point, mode) {
  if (Array.isArray(point)) {
    return toFiniteNumber(mode === "candlestick" ? point[4] : point[1]);
  }

  return mode === "candlestick"
    ? toFiniteNumber(point?.close)
    : toFiniteNumber(point?.y);
}

/*
 * Source data is preferred over series.points because Highcharts may crop
 * series.points when the user changes the Navigator selection.
 */

function getPointChange(point, mode, previousClose, data = []) {
  const currentValue = getPointValue(point, mode);

  const timestamp = getPointTimestamp(point);

  const rawIndex = Array.isArray(data)
    ? data.findIndex((item) => getRawPointTimestamp(item) === timestamp)
    : -1;

  const precedingRawPoint = rawIndex > 0 ? data[rawIndex - 1] : null;

  const precedingVisiblePoint = getPreviousVisiblePoint(point);

  const previousValue = precedingRawPoint
    ? getRawPointValue(precedingRawPoint, mode)
    : precedingVisiblePoint
      ? getPointValue(precedingVisiblePoint, mode)
      : toFiniteNumber(previousClose);

  if (currentValue === null || previousValue === null) {
    return {
      amount: null,
      percentage: null,
      direction: "neutral",
    };
  }

  const amount = currentValue - previousValue;

  const percentage =
    previousValue === 0 ? null : (amount / Math.abs(previousValue)) * 100;

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
   Tooltip Theme
   ========================================================================== */

function createTooltipVariables(theme) {
  return [
    `--chart-tooltip-bg:${theme.tooltipBackground}`,
    `--chart-tooltip-border:${theme.tooltipBorder}`,

    `--chart-text:${theme.text}`,
    `--chart-heading:${theme.heading}`,
    `--chart-muted:${theme.muted}`,

    `--chart-success:${theme.success}`,
    `--chart-danger:${theme.danger}`,
    `--chart-neutral:${theme.neutral || theme.muted}`,

    `--chart-border:${theme.border}`,
  ]
    .filter(Boolean)
    .join(";");
}

/* ==========================================================================
   Tooltip Change
   ========================================================================== */

function createChangeMarkup(change, { language, decimals }) {
  if (change.amount === null) {
    return "";
  }

  const amountSign = change.amount > 0 ? "+" : "";

  const percentageSign = change.percentage > 0 ? "+" : "";

  const percentageMarkup =
    change.percentage === null
      ? ""
      : `
        <span class="market-chart-tooltip__percentage">
          (${percentageSign}${escapeHTML(
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
      <span>
        ${amountSign}${escapeHTML(
          formatNumber(change.amount, {
            language,
            decimals,
          }),
        )}
      </span>

      ${percentageMarkup}
    </div>
  `;
}

/* ==========================================================================
   Trend Tooltip
   ========================================================================== */

function createTrendTooltip(
  point,
  {
    symbol,
    currency,

    previousClose,
    data,

    language,
    decimals,

    dateFormatter,
    theme,
  },
) {
  const timestamp = getPointTimestamp(point);

  const value = getPointValue(point, "trend");

  const change = getPointChange(point, "trend", previousClose, data);

  const date =
    timestamp === null ? "" : dateFormatter.format(new Date(timestamp));

  const currencyMarkup = currency
    ? `
      <span class="market-chart-tooltip__currency">
        ${escapeHTML(currency)}
      </span>
    `
    : "";

  return `
    <div
      class="market-chart-tooltip"
      style="${escapeHTML(createTooltipVariables(theme))}"
    >
      <div class="market-chart-tooltip__header">
        <span class="market-chart-tooltip__symbol">
          ${escapeHTML(symbol)}
        </span>

        <time class="market-chart-tooltip__date">
          ${escapeHTML(date)}
        </time>
      </div>

      <div class="market-chart-tooltip__primary">
        ${currencyMarkup}

        <span>
          ${escapeHTML(
            formatNumber(value, {
              language,
              decimals,
            }),
          )}
        </span>
      </div>

      ${createChangeMarkup(change, {
        language,
        decimals,
      })}
    </div>
  `;
}

/* ==========================================================================
   Candlestick Tooltip
   ========================================================================== */

function createCandlestickTooltip(
  point,
  {
    symbol,
    currency,

    previousClose,
    data,

    language,
    decimals,

    dateFormatter,
    theme,
  },
) {
  const timestamp = getPointTimestamp(point);

  const change = getPointChange(point, "candlestick", previousClose, data);

  const date =
    timestamp === null ? "" : dateFormatter.format(new Date(timestamp));

  const values = [
    ["Open", point.open],
    ["High", point.high],
    ["Low", point.low],
    ["Close", point.close],
  ];

  const rows = values
    .map(([label, value]) => {
      return `
        <div class="market-chart-tooltip__row">
          <span class="market-chart-tooltip__label">
            ${escapeHTML(label)}
          </span>

          <span class="market-chart-tooltip__value">
            ${
              currency
                ? `
                  <span class="market-chart-tooltip__currency">
                    ${escapeHTML(currency)}
                  </span>
                `
                : ""
            }

            ${escapeHTML(
              formatNumber(value, {
                language,
                decimals,
              }),
            )}
          </span>
        </div>
      `;
    })
    .join("");

  return `
    <div
      class="market-chart-tooltip"
      style="${escapeHTML(createTooltipVariables(theme))}"
    >
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
   Axis Formatters
   ========================================================================== */

function createXAxisLabelFormatter({ language, timeZone, range }) {
  const formatter = createXAxisDateFormatter({
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
    return formatAxisNumber(this.value, {
      language,
      decimals,
    });
  };
}

/* ==========================================================================
   X-Axis Ticks
   ========================================================================== */

function getXAxisTickOptions(range) {
  if (range === "1D") {
    return {
      tickInterval: HOUR_MS,
      tickPixelInterval: undefined,
    };
  }

  switch (range) {
    case "1W":
      return {
        tickInterval: undefined,
        tickPixelInterval: 90,
      };

    case "1M":
    case "3M":
      return {
        tickInterval: undefined,
        tickPixelInterval: 100,
      };

    case "6M":
    case "1Y":
      return {
        tickInterval: undefined,
        tickPixelInterval: 110,
      };

    case "5Y":
    case "ALL":
      return {
        tickInterval: undefined,
        tickPixelInterval: 120,
      };

    default:
      return {
        tickInterval: undefined,
        tickPixelInterval: 100,
      };
  }
}

/* ==========================================================================
   Navigator
   ========================================================================== */

function createNavigatorOptions({ Highcharts, layout, enabled, theme }) {
  return {
    enabled,

    height: layout.navigatorHeight,

    margin: layout.navigatorMargin,

    adaptToUpdatedData: true,

    maskInside: true,

    maskFill: Highcharts.color(theme.line).setOpacity(0.1).get("rgba"),

    outlineColor: theme.borderStrong,

    outlineWidth: 1,

    handles: {
      enabled: true,

      width: 7,

      height: layout.navigatorHandleHeight,

      backgroundColor: theme.tooltipBackground,

      borderColor: theme.borderStrong,

      lineWidth: 1,
    },

    xAxis: {
      ordinal: false,

      gridLineWidth: 0,

      labels: {
        enabled: false,
      },

      lineColor: theme.border,
      lineWidth: 1,

      tickLength: 0,
    },

    series: {
      type: "areaspline",

      color: theme.line,

      lineColor: theme.line,
      lineWidth: 1.5,

      fillColor: Highcharts.color(theme.line).setOpacity(0.14).get("rgba"),

      fillOpacity: 0.14,

      dataGrouping: {
        enabled: false,
      },

      marker: {
        enabled: false,
      },
    },
  };
}

/* ==========================================================================
   Options Factory
   ========================================================================== */

export function createMarketChartOptions({
  Highcharts,
  element,

  context = null,

  mode = "trend",
  range = "1D",
  direction = "neutral",

  symbol = "TASI",
  seriesName = symbol,
  currency = "",

  previousClose = null,

  data = [],

  language = document.documentElement.lang || DEFAULT_LANGUAGE,

  timeZone = DEFAULT_TIME_ZONE,

  decimals = DEFAULT_DECIMALS,

  xAxisTitle = null,
  yAxisTitle = null,

  animation = true,

  navigatorEnabled = null,

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

  const resolvedContext = resolveContext(element, context);

  const overview = resolvedContext === "overview";

  const layout = CONTEXT_LAYOUT[resolvedContext];

  const showNavigator =
    navigatorEnabled === null ? overview : Boolean(navigatorEnabled);

  const theme = resolveTheme(element, direction);

  const seriesTheme = getMarketChartSeriesTheme(Highcharts, theme, mode);

  const tooltipDateFormatter = createTooltipDateFormatter({
    language,
    timeZone,
    range,
  });

  const xAxisTicks = getXAxisTickOptions(range);

  const seriesType =
    mode === "candlestick"
      ? "candlestick"
      : mode === "line"
        ? "line"
        : "areaspline";

  const navigator = createNavigatorOptions({
    Highcharts,
    layout,
    enabled: showNavigator,
    theme,
  });

  return {
    /* ----------------------------------------------------------------------
       Chart
       ------------------------------------------------------------------- */

    chart: {
      backgroundColor: theme.background,

      spacingTop: layout.spacingTop,

      spacingRight: layout.spacingRight,

      spacingBottom: showNavigator ? layout.spacingBottom : 10,

      spacingLeft: layout.spacingLeft,

      marginTop: layout.marginTop,

      marginRight: layout.marginRight,

      marginBottom: undefined,

      marginLeft: layout.marginLeft,

      animation,

      reflow: false,
      styledMode: false,

      alignTicks: false,
    },

    time: {
      timezone: timeZone,
    },

    /* ----------------------------------------------------------------------
       Built-in Highcharts UI
       ------------------------------------------------------------------- */

    credits: {
      enabled: false,
    },

    exporting: {
      enabled: false,

      fallbackToExportServer: false,

      buttons: {
        contextButton: {
          enabled: false,
        },
      },

      filename: symbol
        ? `${String(symbol).toLowerCase()}-${String(range).toLowerCase()}`
        : "market-chart",
    },

    navigation: {
      buttonOptions: {
        enabled: false,
      },
    },

    stockTools: {
      gui: {
        enabled: false,
      },
    },

    legend: {
      enabled: false,
    },

    rangeSelector: {
      enabled: false,
    },

    scrollbar: {
      enabled: false,
    },

    title: {
      text: null,
    },

    subtitle: {
      text: null,
    },

    /* ----------------------------------------------------------------------
       Accessibility
       ------------------------------------------------------------------- */

    accessibility: {
      enabled: true,

      description: accessibilityDescription || undefined,

      keyboardNavigation: {
        enabled: true,
      },

      series: {
        describeSingleSeries: true,
      },
    },

    /* ----------------------------------------------------------------------
       Navigator
       ------------------------------------------------------------------- */

    navigator,

    /* ----------------------------------------------------------------------
       X Axis
       ------------------------------------------------------------------- */

    xAxis: {
      type: "datetime",

      ordinal: false,
      reversed: false,

      lineColor: theme.border,
      lineWidth: 1,

      tickColor: theme.border,
      tickLength: 4,
      tickWidth: 1,

      tickInterval: xAxisTicks.tickInterval,

      tickPixelInterval: xAxisTicks.tickPixelInterval,

      minPadding: 0,
      maxPadding: 0,

      overscroll: 0,

      startOnTick: false,
      endOnTick: false,

      showFirstLabel: true,
      showLastLabel: true,

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

        allowOverlap: false,

        crop: false,
        overflow: "allow",

        y: 20,

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

        margin: 12,

        style: {
          color: theme.muted,

          fontFamily: "var(--font-sans)",

          fontSize: "11px",
          fontWeight: "600",
        },
      },
    },

    /* ----------------------------------------------------------------------
       Y Axis
       ------------------------------------------------------------------- */

    yAxis: {
      opposite: true,

      alignTicks: false,

      gridLineColor: theme.grid,
      gridLineDashStyle: "ShortDot",
      gridLineWidth: 1,

      lineColor: theme.border,
      lineWidth: 0,

      tickColor: theme.border,
      tickLength: 0,
      tickWidth: 0,

      tickPixelInterval: layout.yAxisTickPixelInterval,

      startOnTick: false,
      endOnTick: false,

      softThreshold: false,

      minPadding: layout.yAxisMinPadding,

      maxPadding: layout.yAxisMaxPadding,

      crosshair: {
        color: theme.crosshair,

        dashStyle: "ShortDash",

        width: 1,

        snap: false,

        zIndex: 3,

        label: {
          enabled: true,

          align: "left",

          backgroundColor: theme.tooltipBackground,

          borderColor: theme.tooltipBorder,

          borderRadius: 5,
          borderWidth: 1,

          padding: 5,

          style: {
            color: theme.heading,

            fontFamily: "var(--font-sans)",

            fontSize: "11px",
            fontWeight: "700",

            textOutline: "none",
          },

          formatter(value) {
            return formatAxisNumber(value, {
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

        margin: 14,
        rotation: 90,

        style: {
          color: theme.muted,

          fontFamily: "var(--font-sans)",

          fontSize: "11px",
          fontWeight: "600",
        },
      },
    },

    /* ----------------------------------------------------------------------
       Tooltip
       ------------------------------------------------------------------- */

    tooltip: {
      enabled: true,

      useHTML: true,
      outside: true,

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
        color: "rgb(0 0 0 / 0.2)",

        offsetX: 0,
        offsetY: 7,

        opacity: 0.18,
        width: 16,
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

        const options = {
          symbol,
          currency,

          previousClose,
          data,

          language,
          decimals,

          dateFormatter: tooltipDateFormatter,

          theme,
        };

        return mode === "candlestick"
          ? createCandlestickTooltip(point, options)
          : createTrendTooltip(point, options);
      },
    },

    /* ----------------------------------------------------------------------
       Plot
       ------------------------------------------------------------------- */

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
              element.dataset.chartHover = "true";
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
        softThreshold: false,
      },

      line: {
        softThreshold: false,
      },

      candlestick: {
        pointPadding: 0.08,
        groupPadding: 0.08,
      },
    },

    /* ----------------------------------------------------------------------
       Series
       ------------------------------------------------------------------- */

    series: [
      {
        id: `${symbol}-${mode}`,

        type: seriesType,

        name: seriesName,

        data,

        showInNavigator: showNavigator,

        ...seriesTheme,
      },
    ],

    /* ----------------------------------------------------------------------
       Responsive
       ------------------------------------------------------------------- */

    responsive: {
      rules: [
        {
          condition: {
            maxWidth: TABLET_BREAKPOINT,
          },

          chartOptions: {
            chart: {
              spacingTop: 8,
              spacingRight: 12,
              spacingLeft: 22,

              marginTop: 8,
              marginRight: 64,
              marginLeft: 22,
            },

            navigator: {
              height: 32,
              margin: 8,

              handles: {
                width: 7,
                height: 16,
              },
            },

            xAxis: {
              labels: {
                style: {
                  fontSize: "10px",
                },
              },
            },

            yAxis: {
              tickPixelInterval: 50,

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
              spacingTop: 8,
              spacingRight: 10,
              spacingBottom: 10,
              spacingLeft: 18,

              marginTop: 8,
              marginRight: 60,
              marginLeft: 18,
            },

            navigator: {
              height: 30,
              margin: 7,

              handles: {
                width: 6,
                height: 15,
              },
            },

            xAxis: {
              labels: {
                align: range === "1D" ? "center" : "right",

                rotation: range === "1D" ? 0 : -45,

                x: range === "1D" ? 0 : -3,

                y: range === "1D" ? 19 : 18,

                style: {
                  fontSize: "10px",
                },
              },
            },

            yAxis: {
              tickPixelInterval: 46,

              minPadding: 0.05,
              maxPadding: 0.06,

              labels: {
                x: 7,

                style: {
                  fontSize: "10px",
                },
              },
            },
          },
        },
      ],
    },
  };
}
