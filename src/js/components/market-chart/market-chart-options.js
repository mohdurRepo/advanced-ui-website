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

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

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

    navigatorHeight: 38,
    navigatorMargin: 10,
    navigatorHandleHeight: 20,
  }),

  performance: Object.freeze({
    spacingTop: 8,
    spacingRight: 14,
    spacingBottom: 8,
    spacingLeft: 22,

    marginTop: 8,
    marginRight: 72,
    marginLeft: 22,

    yAxisTickPixelInterval: 58,

    navigatorHeight: 38,
    navigatorMargin: 10,
    navigatorHandleHeight: 20,
  }),
});

const DEFAULT_X_AXIS_FORMATS = Object.freeze({
  "1D": Object.freeze({
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }),

  "1W": Object.freeze({
    weekday: "short",
    day: "2-digit",
  }),

  "1M": Object.freeze({
    day: "2-digit",
    month: "short",
  }),

  "3M": Object.freeze({
    day: "2-digit",
    month: "short",
  }),

  "6M": Object.freeze({
    month: "short",
    year: "2-digit",
  }),

  "1Y": Object.freeze({
    month: "short",
    year: "numeric",
  }),

  "5Y": Object.freeze({
    year: "numeric",
  }),

  ALL: Object.freeze({
    year: "numeric",
  }),

  default: Object.freeze({
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
});

const DEFAULT_NAVIGATOR_FORMATS = Object.freeze({
  "1D": Object.freeze({
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }),

  "1W": Object.freeze({
    weekday: "short",
    day: "2-digit",
  }),

  "1M": Object.freeze({
    day: "2-digit",
    month: "short",
  }),

  "3M": Object.freeze({
    month: "short",
    year: "2-digit",
  }),

  "6M": Object.freeze({
    month: "short",
    year: "2-digit",
  }),

  "1Y": Object.freeze({
    month: "short",
    year: "numeric",
  }),

  "5Y": Object.freeze({
    year: "numeric",
  }),

  ALL: Object.freeze({
    year: "numeric",
  }),

  default: Object.freeze({
    month: "short",
    year: "numeric",
  }),
});

const DEFAULT_ROTATIONS = Object.freeze({
  "1D": 0,
  "1W": -20,
  "1M": -25,
  "3M": -30,
  "6M": -30,
  "1Y": -35,
  "5Y": -35,
  ALL: -35,
  default: 0,
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function resolveContext(element, context) {
  if (context === "overview" || context === "performance") {
    return context;
  }

  return element.closest("[data-market-detail-panel]")
    ? "overview"
    : "performance";
}

function resolveRangeValue(value, range, fallback) {
  if (typeof value === "function") {
    return value;
  }

  if (!isPlainObject(value)) {
    return value ?? fallback;
  }

  return value[range] ?? value.default ?? fallback;
}

function mergeRangeFormats(defaults, customFormats = {}) {
  const result = {};

  const names = new Set([
    ...Object.keys(defaults),
    ...Object.keys(customFormats || {}),
  ]);

  names.forEach((name) => {
    result[name] = {
      ...(defaults[name] || defaults.default || {}),
      ...(customFormats?.[name] || {}),
    };
  });

  return result;
}

/* ==========================================================================
   Theme
   ========================================================================== */

function resolveTheme(element, direction) {
  const previousDirection = element.dataset.chartDirection;

  element.dataset.chartDirection = direction;

  const theme = getMarketChartTheme(element);

  if (previousDirection === undefined) {
    delete element.dataset.chartDirection;
  } else {
    element.dataset.chartDirection = previousDirection;
  }

  return theme;
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

function createNumberFormatter(language, options = {}) {
  return new Intl.NumberFormat(language, {
    useGrouping: true,
    ...options,
  });
}

function normalizeNumberFormat(format, fallbackDecimals = DEFAULT_DECIMALS) {
  return {
    decimals: format?.decimals ?? fallbackDecimals,
    useGrouping: format?.useGrouping ?? true,
    prefix: format?.prefix ?? "",
    suffix: format?.suffix ?? "",
  };
}

function formatNumber(
  value,
  { language, decimals, useGrouping = true, prefix = "", suffix = "" },
) {
  const number = toFiniteNumber(value);

  if (number === null) {
    return "—";
  }

  const formatted = createNumberFormatter(language, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  }).format(number);

  return `${prefix}${formatted}${suffix}`;
}

function formatAxisNumber(value, configuration) {
  return formatNumber(value, configuration);
}

function formatSignedNumber(value, { language, decimals }) {
  const number = toFiniteNumber(value);

  if (number === null) {
    return "—";
  }

  const formatted = formatNumber(Math.abs(number), {
    language,
    decimals,
  });

  if (number > 0) {
    return `+${formatted}`;
  }

  if (number < 0) {
    return `−${formatted}`;
  }

  return formatted;
}

function formatPercentage(value, { language, decimals }) {
  const number = toFiniteNumber(value);

  if (number === null) {
    return "—";
  }

  return `${formatSignedNumber(number, {
    language,
    decimals,
  })}%`;
}

/* ==========================================================================
   Date Formatting
   ========================================================================== */

function createDateFormatter(language, timeZone, format) {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    ...format,
  });
}

function resolveDateFormat(formats, range) {
  return formats[range] || formats.default;
}

function formatTimestamp(timestamp, formatter) {
  const value = toFiniteNumber(timestamp);

  if (value === null) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
}

function createDateLabelFormatter({
  language,
  timeZone,
  range,
  formats,
  customFormatter,
}) {
  const formatter = createDateFormatter(
    language,
    timeZone,
    resolveDateFormat(formats, range),
  );

  return function dateLabelFormatter() {
    const timestamp = toFiniteNumber(this.value);

    if (timestamp === null) {
      return "";
    }

    if (typeof customFormatter === "function") {
      const result = customFormatter.call(this, {
        value: timestamp,
        date: new Date(timestamp),
        range,
        language,
        timeZone,
      });

      if (result !== undefined && result !== null) {
        return String(result);
      }
    }

    return formatTimestamp(timestamp, formatter);
  };
}

function createTooltipDateFormatter({ language, timeZone, range, formats }) {
  const defaultFormat =
    range === "1D"
      ? {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }
      : {
          day: "2-digit",
          month: "short",
          year: "numeric",
        };

  const customFormat = resolveRangeValue(formats, range, {});

  return createDateFormatter(language, timeZone, {
    ...defaultFormat,
    ...(isPlainObject(customFormat) ? customFormat : {}),
  });
}

/* ==========================================================================
   Point Helpers
   ========================================================================== */

function getPointClose(point, mode) {
  if (!point) {
    return null;
  }

  if (Array.isArray(point)) {
    return toFiniteNumber(mode === "candlestick" ? point[4] : point[1]);
  }

  return toFiniteNumber(
    mode === "candlestick" ? (point.close ?? point.y) : point.y,
  );
}

function getPointIndex(point, data) {
  const timestamp = toFiniteNumber(point?.x);

  if (timestamp === null) {
    return -1;
  }

  return data.findIndex((item) => {
    const itemTimestamp = Array.isArray(item) ? item[0] : item?.x;

    return Number(itemTimestamp) === timestamp;
  });
}

function getPointChange(point, mode, previousClose, data) {
  const close = getPointClose(point, mode);

  if (close === null) {
    return null;
  }

  const index = getPointIndex(point, data);

  const reference =
    index > 0
      ? getPointClose(data[index - 1], mode)
      : toFiniteNumber(previousClose);

  if (reference === null) {
    return null;
  }

  const value = close - reference;

  const percentage = reference === 0 ? 0 : (value / reference) * 100;

  return {
    value,
    percentage,
    direction: value > 0 ? "up" : value < 0 ? "down" : "neutral",
  };
}

/* ==========================================================================
   Tooltip Markup
   ========================================================================== */

function escapeMarkup(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createChangeMarkup(change, { language, decimals }) {
  if (!change) {
    return "";
  }

  return `
    <div
      class="
        market-chart-tooltip__change
        market-chart-tooltip__change--${change.direction}
      "
    >
      <span>
        ${formatSignedNumber(change.value, {
          language,
          decimals,
        })}
      </span>

      <span>
        (${formatPercentage(change.percentage, {
          language,
          decimals,
        })})
      </span>
    </div>
  `;
}

function createTrendTooltip(point, options) {
  const {
    currency,
    data,
    dateFormatter,
    decimals,
    language,
    previousClose,
    seriesName,
  } = options;

  const value = getPointClose(point, "trend");

  const change = getPointChange(point, "trend", previousClose, data);

  const formattedDate = formatTimestamp(point.x, dateFormatter);

  const formattedValue = formatNumber(value, {
    language,
    decimals,
  });

  return `
    <div class="market-chart-tooltip">
      <div class="market-chart-tooltip__header">
        <strong>${escapeMarkup(seriesName)}</strong>

        <time>${escapeMarkup(formattedDate)}</time>
      </div>

      <div class="market-chart-tooltip__body">
        <div class="market-chart-tooltip__value">
          ${currency ? `<span>${escapeMarkup(currency)}</span>` : ""}

          <strong>${formattedValue}</strong>
        </div>

        ${createChangeMarkup(change, {
          language,
          decimals,
        })}
      </div>
    </div>
  `;
}

function createCandlestickTooltip(point, options) {
  const {
    currency,
    data,
    dateFormatter,
    decimals,
    language,
    previousClose,
    seriesName,
  } = options;

  const change = getPointChange(point, "candlestick", previousClose, data);

  const rows = [
    ["Open", point.open],
    ["High", point.high],
    ["Low", point.low],
    ["Close", point.close],
  ]
    .map(
      ([label, value]) => `
        <div class="market-chart-tooltip__row">
          <span>${label}</span>

          <strong>
            ${formatNumber(value, {
              language,
              decimals,
            })}
          </strong>
        </div>
      `,
    )
    .join("");

  return `
    <div
      class="
        market-chart-tooltip
        market-chart-tooltip--candlestick
      "
    >
      <div class="market-chart-tooltip__header">
        <strong>${escapeMarkup(seriesName)}</strong>

        <time>
          ${escapeMarkup(formatTimestamp(point.x, dateFormatter))}
        </time>
      </div>

      <div class="market-chart-tooltip__body">
        ${
          currency
            ? `
              <div class="market-chart-tooltip__currency">
                ${escapeMarkup(currency)}
              </div>
            `
            : ""
        }

        <div class="market-chart-tooltip__rows">
          ${rows}
        </div>

        ${createChangeMarkup(change, {
          language,
          decimals,
        })}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Axis Configuration
   ========================================================================== */

function getXAxisTickOptions(range) {
  switch (range) {
    case "1D":
      return {
        tickInterval: HOUR_MS,
        tickPixelInterval: undefined,
      };

    case "1W":
      return {
        tickInterval: undefined,
        tickPixelInterval: 88,
      };

    case "1M":
      return {
        tickInterval: undefined,
        tickPixelInterval: 94,
      };

    case "3M":
      return {
        tickInterval: undefined,
        tickPixelInterval: 100,
      };

    case "6M":
    case "1Y":
      return {
        tickInterval: undefined,
        tickPixelInterval: 108,
      };

    case "5Y":
    case "ALL":
      return {
        tickInterval: undefined,
        tickPixelInterval: 116,
      };

    default:
      return {
        tickInterval: undefined,
        tickPixelInterval: 100,
      };
  }
}

function normalizeAxisConfiguration({
  axis,
  xAxis,
  yAxis,
  xAxisTitle,
  yAxisTitle,
  decimals,
}) {
  const resolvedXAxis = {
    ...(axis?.x || {}),
    ...(xAxis || {}),
  };

  const resolvedYAxis = {
    ...(axis?.y || {}),
    ...(yAxis || {}),
  };

  if (resolvedXAxis.title === undefined) {
    resolvedXAxis.title = xAxisTitle;
  }

  if (resolvedYAxis.title === undefined) {
    resolvedYAxis.title = yAxisTitle;
  }

  if (resolvedYAxis.decimals === undefined) {
    resolvedYAxis.decimals = decimals;
  }

  resolvedYAxis.format = normalizeNumberFormat(
    resolvedYAxis.format,
    resolvedYAxis.decimals,
  );

  return {
    x: resolvedXAxis,
    y: resolvedYAxis,
  };
}

/* ==========================================================================
   Navigator Configuration
   ========================================================================== */

function normalizeNavigatorConfiguration({
  navigator,
  navigatorEnabled,
  overview,
}) {
  const configuration = isPlainObject(navigator) ? navigator : {};

  const enabled =
    navigatorEnabled === null
      ? toBoolean(configuration.enabled, overview)
      : Boolean(navigatorEnabled);

  return {
    ...configuration,

    enabled,

    labels: toBoolean(configuration.labels, true),
  };
}

function createNavigatorOptions({
  Highcharts,
  layout,
  theme,
  language,
  timeZone,
  range,
  configuration,
  data,
}) {
  //const handleSymbols = registerNavigatorHandleSymbols(Highcharts);

  const formats = mergeRangeFormats(
    DEFAULT_NAVIGATOR_FORMATS,
    configuration.formats || configuration.labelFormat,
  );

  return {
    enabled: configuration.enabled,

    height: configuration.height ?? layout.navigatorHeight,

    margin: configuration.margin ?? layout.navigatorMargin,

    adaptToUpdatedData: true,

    maskInside: true,

    maskFill: Highcharts.color(theme.line)
      .setOpacity(configuration.maskOpacity ?? 0.1)
      .get("rgba"),

    outlineColor: theme.borderStrong,
    outlineWidth: 1,

    handles: {
      enabled: configuration.handles !== false,

      width: configuration.handleWidth ?? 7,

      height: configuration.handleHeight ?? layout.navigatorHandleHeight,

      backgroundColor: theme.tooltipBackground,

      borderColor: theme.borderStrong,

      lineWidth: 1,
    },

    xAxis: {
      ordinal: false,

      gridLineWidth: 0,

      lineColor: theme.border,
      lineWidth: 1,

      tickColor: theme.border,

      tickLength: configuration.labels ? 3 : 0,

      tickPixelInterval: configuration.tickPixelInterval ?? 110,

      /*
       * Boundary labels sit underneath the Navigator handles and become clipped.
       * Internal labels remain available.
       */

      showFirstLabel: false,
      showLastLabel: false,

      labels: {
        enabled: configuration.labels,

        align: "center",

        rotation: resolveRangeValue(configuration.rotation, range, 0),

        y:
          configuration.labelsInside !== false
            ? (configuration.insideLabelOffset ?? -7)
            : (configuration.labelOffset ?? 15),

        style: {
          color: theme.muted,
          fontFamily: "var(--font-sans)",
          fontSize: "10px",
          fontWeight: "500",
          textOverflow: "none",
          textShadow: "none",
        },

        formatter: createDateLabelFormatter({
          language,
          timeZone,
          range,
          formats,

          customFormatter: configuration.formatter,
        }),
      },
    },
    series: {
      type: "areaspline",

      /*
       * Navigator interaction is owned by its mask and handles. Disabling series
       * tracking prevents Highcharts from applying hover state to its internally
       * generated Navigator series.
       */

      enableMouseTracking: false,
      stickyTracking: false,

      data,

      color: theme.line,
      lineColor: theme.line,
      lineWidth: 1.5,

      fillColor: Highcharts.color(theme.line)
        .setOpacity(configuration.fillOpacity ?? 0.14)
        .get("rgba"),

      fillOpacity: configuration.fillOpacity ?? 0.14,

      dataGrouping: {
        enabled: configuration.dataGrouping ?? false,
      },

      marker: {
        enabled: false,

        states: {
          hover: {
            enabled: false,
          },

          select: {
            enabled: false,
          },
        },
      },

      states: {
        normal: {
          animation: false,
          lineWidth: 1.5,
          opacity: 1,
        },

        hover: {
          enabled: false,
          animation: false,
          lineWidth: 1.5,
          lineWidthPlus: 0,
          opacity: 1,
        },

        inactive: {
          enabled: false,
          animation: false,
          lineWidth: 1.5,
          opacity: 1,
        },

        select: {
          enabled: false,
          animation: false,
          lineWidth: 1.5,
          opacity: 1,
        },
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

  axis = {},
  xAxis = {},
  yAxis = {},

  dateFormats = {},
  tooltipDateFormats = {},

  animation = true,

  navigatorEnabled = null,
  navigator = {},

  /*
   * The Navigator can use a dataset and formatting range independent of the
   * primary series.
   *
   * Expected behavior:
   * - 1D: intraday Navigator data and time labels.
   * - Other ranges: ALL-history data and date/year labels.
   */

  navigatorData = null,
  navigatorRange = range,

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

  const axisConfiguration = normalizeAxisConfiguration({
    axis,
    xAxis,
    yAxis,
    xAxisTitle,
    yAxisTitle,
    decimals,
  });

  const navigatorConfiguration = normalizeNavigatorConfiguration({
    navigator,
    navigatorEnabled,
    overview,
  });

  const theme = resolveTheme(element, direction);

  const seriesTheme = getMarketChartSeriesTheme(Highcharts, theme, mode);

  const xAxisFormats = mergeRangeFormats(DEFAULT_X_AXIS_FORMATS, dateFormats);

  const tooltipFormatter = createTooltipDateFormatter({
    language,
    timeZone,
    range,

    formats: tooltipDateFormats,
  });

  const xAxisTicks = getXAxisTickOptions(range);

  const xAxisRotation = Number(
    resolveRangeValue(
      axisConfiguration.x.rotation,
      range,

      DEFAULT_ROTATIONS[range] ?? DEFAULT_ROTATIONS.default,
    ),
  );

  const seriesType =
    mode === "candlestick"
      ? "candlestick"
      : mode === "line"
        ? "line"
        : "areaspline";

  const seriesLineWidth = mode === "candlestick" ? 1 : 2;

  const navigatorOptions = createNavigatorOptions({
    Highcharts,
    layout,
    theme,
    language,
    timeZone,

    /*
     * This is intentionally independent from the selected chart range.
     */

    range: navigatorRange,

    configuration: navigatorConfiguration,

    data:
      Array.isArray(navigatorData) && navigatorData.length
        ? navigatorData
        : data,
  });

  const resolvedXAxisTitle = resolveRangeValue(
    axisConfiguration.x.title,
    range,
    null,
  );

  const resolvedYAxisTitle = resolveRangeValue(
    axisConfiguration.y.title,
    range,
    null,
  );

  const chartMarginRight = layout.marginRight + (resolvedYAxisTitle ? 20 : 0);

  return {
    chart: {
      backgroundColor: theme.background,

      spacingTop: layout.spacingTop,
      spacingRight: layout.spacingRight,
      spacingBottom: layout.spacingBottom,
      spacingLeft: layout.spacingLeft,

      marginTop: layout.marginTop,
      marginRight: chartMarginRight,
      marginLeft: layout.marginLeft,

      animation,

      style: {
        fontFamily: "var(--font-sans)",
      },
    },

    accessibility: {
      enabled: true,

      description: accessibilityDescription,

      keyboardNavigation: {
        enabled: true,
      },

      series: {
        describeSingleSeries: true,
      },
    },

    boost: {
      enabled: false,
    },

    credits: {
      enabled: false,
    },

    exporting: {
      enabled: false,
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

    navigator: navigatorOptions,

    /* ======================================================================
       X Axis
       ====================================================================== */

    xAxis: {
      type: "datetime",

      ordinal: false,
      reversed: false,

      lineColor: theme.border,
      lineWidth: 1,

      tickColor: theme.border,
      tickLength: 4,
      tickWidth: 1,

      tickInterval: axisConfiguration.x.tickInterval ?? xAxisTicks.tickInterval,

      tickPixelInterval:
        axisConfiguration.x.tickPixelInterval ?? xAxisTicks.tickPixelInterval,

      minPadding: axisConfiguration.x.minPadding ?? 0,

      maxPadding: axisConfiguration.x.maxPadding ?? 0,

      overscroll: axisConfiguration.x.overscroll ?? 0,

      startOnTick: axisConfiguration.x.startOnTick ?? false,

      endOnTick: axisConfiguration.x.endOnTick ?? false,

      showFirstLabel: axisConfiguration.x.showFirstLabel ?? true,

      showLastLabel: axisConfiguration.x.showLastLabel ?? true,

      crosshair: {
        color: theme.crosshair,
        dashStyle: "ShortDash",
        width: 1,
        snap: true,
        zIndex: 3,
      },

      labels: {
        enabled: axisConfiguration.x.labels !== false,

        align: xAxisRotation === 0 ? "center" : "right",

        autoRotation: false,
        rotation: xAxisRotation,

        reserveSpace: true,

        allowOverlap: axisConfiguration.x.allowOverlap ?? false,

        crop: false,
        overflow: "allow",

        x: xAxisRotation === 0 ? 0 : -3,

        y: axisConfiguration.x.labelOffset ?? 20,

        style: {
          color: theme.muted,
          fontFamily: "var(--font-sans)",

          fontSize: axisConfiguration.x.fontSize ?? "11px",

          fontWeight: "500",
          textOverflow: "none",
          textShadow: "none",
        },

        formatter: createDateLabelFormatter({
          language,
          timeZone,
          range,

          formats: xAxisFormats,

          customFormatter: axisConfiguration.x.formatter,
        }),
      },

      title: {
        text: resolvedXAxisTitle,

        margin: axisConfiguration.x.titleMargin ?? 14,

        style: {
          color: theme.muted,
          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          fontWeight: "600",
        },
      },
    },

    /* ======================================================================
       Y Axis
       ====================================================================== */

    yAxis: {
      opposite: axisConfiguration.y.opposite ?? true,

      alignTicks: false,

      gridLineColor: theme.grid,
      gridLineDashStyle: "ShortDot",
      gridLineWidth: 1,

      lineColor: theme.border,
      lineWidth: 0,

      tickColor: theme.border,
      tickLength: 0,
      tickWidth: 0,

      tickAmount: axisConfiguration.y.tickAmount,

      tickInterval: axisConfiguration.y.tickInterval,

      tickPixelInterval:
        axisConfiguration.y.tickPixelInterval ?? layout.yAxisTickPixelInterval,

      startOnTick:
        axisConfiguration.y.includeBoundaryTicks ??
        axisConfiguration.y.startOnTick ??
        true,

      endOnTick:
        axisConfiguration.y.includeBoundaryTicks ??
        axisConfiguration.y.endOnTick ??
        true,

      softThreshold: false,

      minPadding: axisConfiguration.y.minPadding ?? 0.02,

      maxPadding: axisConfiguration.y.maxPadding ?? 0.02,

      softMin: axisConfiguration.y.softMin,

      softMax: axisConfiguration.y.softMax,

      min: axisConfiguration.y.min,
      max: axisConfiguration.y.max,

      crosshair: {
        color: theme.crosshair,
        dashStyle: "ShortDash",
        width: 1,
        snap: false,
        zIndex: 3,

        label: {
          enabled: true,

          align: axisConfiguration.y.opposite === false ? "right" : "left",

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
            textShadow: "none",
          },

          formatter(value) {
            return formatAxisNumber(value, {
              language,

              ...axisConfiguration.y.format,
            });
          },
        },
      },

      labels: {
        enabled: axisConfiguration.y.labels !== false,

        align: axisConfiguration.y.opposite === false ? "right" : "left",

        reserveSpace: true,

        x: axisConfiguration.y.opposite === false ? -10 : 10,

        y: 4,

        style: {
          color: theme.muted,
          fontFamily: "var(--font-sans)",

          fontSize: axisConfiguration.y.fontSize ?? "11px",

          fontWeight: "500",
          textOverflow: "none",
          textShadow: "none",
        },

        formatter() {
          if (typeof axisConfiguration.y.formatter === "function") {
            const result = axisConfiguration.y.formatter.call(this, {
              value: this.value,
              range,
              language,
            });

            if (result !== undefined && result !== null) {
              return String(result);
            }
          }

          return formatAxisNumber(this.value, {
            language,

            ...axisConfiguration.y.format,
          });
        },
      },

      title: {
        text: resolvedYAxisTitle,

        margin: axisConfiguration.y.titleMargin ?? 16,

        rotation: axisConfiguration.y.titleRotation ?? 90,

        style: {
          color: theme.muted,
          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          fontWeight: "600",
        },
      },
    },

    /* ======================================================================
       Tooltip
       ====================================================================== */

    tooltip: {
      enabled: true,

      useHTML: true,
      outside: false,

      animation,

      /*
       * The component markup owns the complete tooltip appearance.
       */

      backgroundColor: "transparent",

      borderWidth: 0,
      borderRadius: 0,

      padding: 0,
      shadow: false,

      shared: false,
      split: false,

      hideDelay: 60,

      followPointer: false,
      followTouchMove: true,

      positioner(labelWidth, labelHeight, point) {
        const chart = this.chart;

        const anchorX = chart.plotLeft + Number(point?.plotX || 0);

        const anchorY = chart.plotTop + Number(point?.plotY || 0);

        const minimumX = chart.plotLeft + 6;

        const maximumX = chart.chartWidth - labelWidth - 6;

        const minimumY = chart.plotTop + 6;

        const maximumY = chart.chartHeight - labelHeight - 6;

        let x = anchorX + 14;

        /*
         * Move the tooltip to the opposite side when it would overflow.
         */

        if (x > maximumX) {
          x = anchorX - labelWidth - 14;
        }

        return {
          x: Math.max(minimumX, Math.min(x, maximumX)),

          y: Math.max(
            minimumY,

            Math.min(
              anchorY - labelHeight / 2,

              maximumY,
            ),
          ),
        };
      },

      formatter() {
        const point = this.point;

        if (!point) {
          return false;
        }

        const options = {
          currency,
          data,

          dateFormatter: tooltipFormatter,

          decimals,
          language,
          previousClose,
          seriesName,
        };

        return mode === "candlestick"
          ? createCandlestickTooltip(point, options)
          : createTrendTooltip(point, options);
      },
    },

    /* ======================================================================
       Plot Options
       ====================================================================== */

    plotOptions: {
      series: {
        animation,

        boostThreshold: 0,
        turboThreshold: 0,

        stickyTracking: true,

        dataGrouping: {
          enabled: false,
        },

        states: {
          inactive: {
            opacity: 1,
          },

          hover: {
            enabled: true,

            halo: {
              size: 0,
              opacity: 0,
            },
          },

          select: {
            enabled: false,
          },
        },

        /*
         * Disabling both normal and state markers prevents dots remaining
         * visible after hovering or switching ranges.
         */

        marker: {
          enabled: false,
          radius: 0,
          lineWidth: 0,

          states: {
            normal: {
              enabled: false,
              radius: 0,
            },

            hover: {
              enabled: false,
              radius: 0,
              lineWidth: 0,
            },

            select: {
              enabled: false,
              radius: 0,
              lineWidth: 0,
            },
          },
        },
      },

      areaspline: {
        lineWidth: 2,
        threshold: null,

        marker: {
          enabled: false,
        },
      },

      line: {
        lineWidth: 2,

        marker: {
          enabled: false,
        },
      },

      candlestick: {
        lineWidth: 1,
      },
    },

    /* ======================================================================
       Main Series
       ====================================================================== */

    series: [
      {
        id: [String(symbol).toLowerCase(), String(range).toLowerCase()].join(
          "-",
        ),

        name: seriesName,
        type: seriesType,

        data,

        color: seriesTheme.color,

        lineColor: seriesTheme.lineColor || seriesTheme.color,

        fillColor: seriesTheme.fillColor,

        upColor: seriesTheme.upColor,

        upLineColor: seriesTheme.upLineColor,

        threshold: null,

        /*
         * The Navigator owns a dedicated series and dataset.
         */

        showInNavigator: false,

        dataGrouping: {
          enabled: false,
        },

        marker: {
          enabled: false,
          radius: 0,
          lineWidth: 0,

          states: {
            hover: {
              enabled: false,
              radius: 0,
              lineWidth: 0,
            },

            select: {
              enabled: false,
              radius: 0,
              lineWidth: 0,
            },
          },
        },
      },
    ],

    /* ======================================================================
       Responsive
       ====================================================================== */

    responsive: {
      rules: [
        {
          condition: {
            maxWidth: 768,
          },

          chartOptions: {
            chart: {
              spacingLeft: 12,
              spacingRight: 10,

              marginLeft: 12,
              marginRight: 64,
            },

            navigator: {
              height: 34,
              margin: 8,

              handles: {
                height: 18,
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
                style: {
                  fontSize: "10px",
                },
              },
            },
          },
        },

        {
          condition: {
            maxWidth: 576,
          },

          chartOptions: {
            chart: {
              spacingLeft: 8,
              spacingRight: 8,

              marginLeft: 8,
              marginRight: 58,
            },

            navigator: {
              height: 32,
              margin: 7,

              handles: {
                height: 17,
              },
            },

            xAxis: {
              labels: {
                style: {
                  fontSize: "9px",
                },
              },
            },

            yAxis: {
              tickPixelInterval: 46,

              labels: {
                style: {
                  fontSize: "9px",
                },
              },
            },
          },
        },
      ],
    },
  };
}
