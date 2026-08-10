import {
  createColorWithOpacity,
  getMarketChartNavigatorTheme,
  getMarketChartSeriesTheme,
  getMarketChartTheme,
} from "./market-chart-theme";

import {
  normalizeMarketChartMode,
  normalizeMarketChartRange,
} from "./market-chart-data";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LANGUAGE = "en";

const DEFAULT_TIME_ZONE = "Asia/Riyadh";

const DEFAULT_DECIMALS = 2;

const DEFAULT_RANGE = "1D";

const DEFAULT_ANIMATION_DURATION = 420;

const MAXIMUM_ANIMATION_DURATION = 2_000;

/* ==========================================================================
   Layout
   ========================================================================== */

const CONTEXT_LAYOUT = Object.freeze({
  overview: Object.freeze({
    spacingTop: 8,
    spacingRight: 14,
    spacingBottom: 8,
    spacingLeft: 18,

    marginTop: 8,
    marginRight: 64,
    marginLeft: 18,

    yAxisTickPixelInterval: 52,

    navigatorHeight: 36,
    navigatorMargin: 9,

    navigatorHandleHeight: 18,
  }),

  performance: Object.freeze({
    spacingTop: 8,
    spacingRight: 14,
    spacingBottom: 8,
    spacingLeft: 20,

    marginTop: 8,
    marginRight: 72,
    marginLeft: 20,

    yAxisTickPixelInterval: 56,

    navigatorHeight: 38,
    navigatorMargin: 10,

    navigatorHandleHeight: 20,
  }),
});

/* ==========================================================================
   Date Formats
   ========================================================================== */

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
});

const DEFAULT_TOOLTIP_DATE_FORMATS = Object.freeze({
  "1D": Object.freeze({
    day: "2-digit",
    month: "short",
    year: "numeric",

    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",

    hourCycle: "h23",
  }),

  default: Object.freeze({
    day: "2-digit",
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
});

/* ==========================================================================
   Generic Helpers
   ========================================================================== */

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isElement(element) {
  return Boolean(element && element.nodeType === 1 && element.ownerDocument);
}

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toNonNegativeNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resolveContext(element, context) {
  const resolvedContext = String(
    context || element?.dataset?.chartContext || "performance",
  ).toLowerCase();

  return CONTEXT_LAYOUT[resolvedContext] ? resolvedContext : "performance";
}

function resolveRangeValue(value, range, fallback) {
  if (!isPlainObject(value)) {
    return value ?? fallback;
  }

  const normalizedRange = normalizeMarketChartRange(range);

  return value[normalizedRange] ?? value.default ?? fallback;
}

function mergeRangeFormats(defaults, customFormats) {
  const merged = {
    ...defaults,
  };

  if (!isPlainObject(customFormats)) {
    return merged;
  }

  Object.entries(customFormats).forEach(([range, format]) => {
    const normalizedRange =
      range === "default" ? "default" : normalizeMarketChartRange(range);

    merged[normalizedRange] = {
      ...(defaults[normalizedRange] || {}),

      ...(isPlainObject(format) ? format : {}),
    };
  });

  return merged;
}

/* ==========================================================================
   Motion
   ========================================================================== */

function prefersReducedMotion(element) {
  const view = element?.ownerDocument?.defaultView || globalThis;

  const root = element?.ownerDocument?.documentElement;

  if (root?.dataset?.motion === "reduce") {
    return true;
  }

  try {
    return (
      view.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
    );
  } catch {
    return false;
  }
}

export function normalizeMarketChartAnimation(
  animation,
  { element = null, mode = "trend" } = {},
) {
  if (
    animation === false ||
    normalizeMarketChartMode(mode) === "candlestick" ||
    prefersReducedMotion(element)
  ) {
    return false;
  }

  if (isPlainObject(animation)) {
    const duration = clamp(
      toNonNegativeNumber(animation.duration, DEFAULT_ANIMATION_DURATION),
      0,
      MAXIMUM_ANIMATION_DURATION,
    );

    if (duration === 0) {
      return false;
    }

    return {
      duration,

      ...(animation.easing
        ? {
            easing: animation.easing,
          }
        : {}),
    };
  }

  const duration =
    typeof animation === "number"
      ? clamp(animation, 0, MAXIMUM_ANIMATION_DURATION)
      : DEFAULT_ANIMATION_DURATION;

  return duration === 0
    ? false
    : {
        duration,
      };
}

/* ==========================================================================
   Theme
   ========================================================================== */

function resolveTheme(element, direction) {
  const theme = getMarketChartTheme(element);

  return {
    ...theme,

    directionColor:
      direction === "up"
        ? theme.success
        : direction === "down"
          ? theme.danger
          : theme.line,
  };
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

function createNumberFormatter({ language, decimals, useGrouping = true }) {
  const parsedDecimals = Number.parseInt(decimals, 10);

  const safeDecimals = Number.isFinite(parsedDecimals)
    ? clamp(parsedDecimals, 0, 8)
    : 0;

  let formatter;

  try {
    formatter = new Intl.NumberFormat(language || DEFAULT_LANGUAGE, {
      minimumFractionDigits: safeDecimals,

      maximumFractionDigits: safeDecimals,

      useGrouping: useGrouping !== false,
    });
  } catch {
    formatter = new Intl.NumberFormat(DEFAULT_LANGUAGE, {
      minimumFractionDigits: safeDecimals,

      maximumFractionDigits: safeDecimals,

      useGrouping: useGrouping !== false,
    });
  }

  return (value) => {
    const number = toFiniteNumber(value);

    return number === null ? "—" : formatter.format(number);
  };
}

/* ==========================================================================
   Date Formatting
   ========================================================================== */

function createDateFormatter({ language, timeZone, options }) {
  let formatter;

  try {
    formatter = new Intl.DateTimeFormat(language || DEFAULT_LANGUAGE, {
      timeZone: timeZone || DEFAULT_TIME_ZONE,

      ...options,
    });
  } catch {
    formatter = new Intl.DateTimeFormat(DEFAULT_LANGUAGE, options);
  }

  return (timestamp) => {
    const number = toFiniteNumber(timestamp);

    if (number === null) {
      return "";
    }

    return formatter.format(new Date(number));
  };
}

function createRangeDateFormatter({ language, timeZone, range, formats }) {
  const normalizedRange = normalizeMarketChartRange(range);

  const format =
    formats[normalizedRange] ||
    formats.default ||
    DEFAULT_X_AXIS_FORMATS[normalizedRange] ||
    DEFAULT_X_AXIS_FORMATS.ALL;

  return createDateFormatter({
    language,
    timeZone,
    options: format,
  });
}

/* ==========================================================================
   Axis Configuration
   ========================================================================== */

function normalizeAxisConfiguration({
  axis = {},
  xAxis = {},
  yAxis = {},

  xAxisTitle = null,
  yAxisTitle = null,

  decimals = DEFAULT_DECIMALS,
} = {}) {
  const axisConfiguration = isPlainObject(axis) ? axis : {};

  const normalizedXAxis = {
    ...(isPlainObject(axisConfiguration.x) ? axisConfiguration.x : {}),

    ...(isPlainObject(xAxis) ? xAxis : {}),
  };

  const normalizedYAxis = {
    ...(isPlainObject(axisConfiguration.y) ? axisConfiguration.y : {}),

    ...(isPlainObject(yAxis) ? yAxis : {}),
  };

  if (xAxisTitle !== null && xAxisTitle !== undefined) {
    normalizedXAxis.title = xAxisTitle;
  }

  if (yAxisTitle !== null && yAxisTitle !== undefined) {
    normalizedYAxis.title = yAxisTitle;
  }

  normalizedYAxis.format = {
    decimals,

    ...(isPlainObject(normalizedYAxis.format) ? normalizedYAxis.format : {}),
  };

  return {
    x: normalizedXAxis,
    y: normalizedYAxis,
  };
}

/* ==========================================================================
   X Axis
   ========================================================================== */
function createCrosshairOptions(configuration, theme, { formatValue } = {}) {
  if (configuration === false || configuration?.enabled === false) {
    return false;
  }

  const {
    enabled: ignoredEnabled,

    label: labelConfiguration = {},

    ...customOptions
  } = isPlainObject(configuration) ? configuration : {};

  const normalizedLabel = isPlainObject(labelConfiguration)
    ? labelConfiguration
    : {};

  return {
    width: 1,

    color: theme.crosshair,

    dashStyle: "ShortDot",

    snap: true,

    zIndex: 4,

    ...customOptions,

    label:
      labelConfiguration === false
        ? {
            enabled: false,
          }
        : {
            enabled: normalizedLabel.enabled !== false,

            backgroundColor: theme.tooltipBackground,

            borderColor: theme.tooltipBorder,

            borderWidth: 1,

            borderRadius: 6,

            padding: 5,

            formatter(value) {
              return typeof formatValue === "function"
                ? formatValue(value)
                : String(value ?? "");
            },

            style: {
              color: theme.heading,

              fontSize: "10px",

              fontWeight: "600",

              textOutline: "none",

              ...(isPlainObject(normalizedLabel.style)
                ? normalizedLabel.style
                : {}),
            },

            ...normalizedLabel,
          },
  };
}
function createXAxisOptions({
  range,

  language,
  timeZone,

  theme,

  configuration,
  dateFormats,
}) {
  const normalizedRange = normalizeMarketChartRange(range);

  const formatDate = createRangeDateFormatter({
    language,
    timeZone,

    range: normalizedRange,

    formats: dateFormats,
  });

  const title = resolveRangeValue(
    configuration.title,
    normalizedRange,

    normalizedRange === "1D" ? "Time" : "Date",
  );

  const rotation = resolveRangeValue(
    configuration.rotation,
    normalizedRange,

    DEFAULT_ROTATIONS[normalizedRange] ?? 0,
  );

  return {
    type: "datetime",

    ordinal: normalizedRange !== "1D",

    minPadding: toNonNegativeNumber(configuration.minPadding, 0),

    maxPadding: toNonNegativeNumber(configuration.maxPadding, 0),

    startOnTick: configuration.startOnTick === true,

    endOnTick: configuration.endOnTick === true,

    lineWidth: 1,
    lineColor: theme.border,

    tickWidth: 1,
    tickLength: 4,
    tickColor: theme.border,

    gridLineWidth: configuration.gridLineWidth ?? 0,

    gridLineColor: theme.grid,

    crosshair: createCrosshairOptions(configuration.crosshair, theme, {
      formatValue: formatDate,
    }),

    labels: {
      enabled: configuration.labels !== false,

      autoRotation: false,

      rotation,

      align: rotation === 0 ? "center" : "right",

      reserveSpace: true,

      y: rotation === 0 ? 18 : 22,

      style: {
        color: theme.muted,

        fontSize: "11px",

        textOverflow: "none",
      },

      formatter() {
        return formatDate(this.value);
      },

      ...(isPlainObject(configuration.labelOptions)
        ? configuration.labelOptions
        : {}),
    },

    showFirstLabel: configuration.showFirstLabel !== false,

    showLastLabel: configuration.showLastLabel !== false,

    title: {
      text: title === false ? null : title,

      margin: 16,

      style: {
        color: theme.muted,

        fontSize: "11px",

        fontWeight: "500",
      },
    },
  };
}

/* ==========================================================================
   Y Axis
   ========================================================================== */

function createYAxisOptions({ language, theme, layout, configuration }) {
  const formatConfiguration = isPlainObject(configuration.format)
    ? configuration.format
    : {};

  const decimals = Number.parseInt(formatConfiguration.decimals, 10);

  const formatNumber = createNumberFormatter({
    language,

    decimals: Number.isFinite(decimals) ? decimals : DEFAULT_DECIMALS,

    useGrouping: formatConfiguration.useGrouping !== false,
  });

  const title = resolveRangeValue(
    configuration.title,
    DEFAULT_RANGE,
    "Index Value",
  );

  return {
    opposite: configuration.opposite !== false,

    minPadding: toNonNegativeNumber(configuration.minPadding, 0.04),

    maxPadding: toNonNegativeNumber(configuration.maxPadding, 0.06),

    startOnTick: configuration.startOnTick !== false,

    endOnTick: configuration.endOnTick !== false,

    tickPixelInterval:
      configuration.tickPixelInterval ?? layout.yAxisTickPixelInterval,

    minRange: configuration.minRange ?? undefined,

    lineWidth: 0,
    tickWidth: 0,

    gridLineWidth: configuration.gridLineWidth ?? 1,

    gridLineColor: theme.grid,

    gridLineDashStyle: "ShortDot",

    /*
     * This is the horizontal guide that was
     * missing from the original chart.
     */
    crosshair: createCrosshairOptions(configuration.crosshair, theme, {
      formatValue: formatNumber,
    }),

    labels: {
      enabled: configuration.labels !== false,

      align: configuration.opposite === false ? "right" : "left",

      x: configuration.opposite === false ? -8 : 8,

      reserveSpace: true,

      style: {
        color: theme.muted,

        fontSize: "11px",

        textOverflow: "none",
      },

      formatter() {
        return formatNumber(this.value);
      },

      ...(isPlainObject(configuration.labelOptions)
        ? configuration.labelOptions
        : {}),
    },

    title: {
      text: title === false ? null : title,

      margin: 14,

      style: {
        color: theme.muted,

        fontSize: "11px",

        fontWeight: "600",
      },
    },

    plotLines: [],
  };
}

/* ==========================================================================
   Tooltip Helpers
   ========================================================================== */

function getTooltipValues(point, mode) {
  if (!point) {
    return null;
  }

  if (mode === "candlestick") {
    const open = toFiniteNumber(point.open);

    const high = toFiniteNumber(point.high);

    const low = toFiniteNumber(point.low);

    const close = toFiniteNumber(point.close);

    if (open === null || high === null || low === null || close === null) {
      return null;
    }

    return {
      open,
      high,
      low,
      close,

      value: close,
    };
  }

  const value = toFiniteNumber(point.y);

  if (value === null) {
    return null;
  }

  return {
    value,
  };
}

function calculateChange(value, reference) {
  const normalizedValue = toFiniteNumber(value);

  const normalizedReference = toFiniteNumber(reference);

  if (normalizedValue === null || normalizedReference === null) {
    return null;
  }

  const amount = normalizedValue - normalizedReference;

  const percent =
    normalizedReference === 0
      ? null
      : (amount / Math.abs(normalizedReference)) * 100;

  return {
    amount,
    percent,

    direction: amount > 0 ? "up" : amount < 0 ? "down" : "neutral",
  };
}

function resolveTooltipLabels(configuration) {
  const labels = isPlainObject(configuration.labels)
    ? configuration.labels
    : {};

  return {
    open: labels.open || "Open",

    high: labels.high || "High",

    low: labels.low || "Low",

    close: labels.close || "Close",

    value: labels.value || "Value",
  };
}

function createTooltipRow(label, value, formatPrice) {
  return [
    '<div class="market-chart-tooltip__row">',

    '<span class="market-chart-tooltip__label">',
    escapeHTML(label),
    "</span>",

    '<span class="market-chart-tooltip__value">',
    escapeHTML(formatPrice(value)),
    "</span>",

    "</div>",
  ].join("");
}

/* ==========================================================================
   Tooltip
   ========================================================================== */

function createTooltipOptions({
  range,
  mode,

  seriesName,
  currency,
  previousClose,

  language,
  timeZone,
  decimals,

  theme,

  tooltipDateFormats,

  configuration,
}) {
  const normalizedRange = normalizeMarketChartRange(range);

  const normalizedMode = normalizeMarketChartMode(mode);

  const dateFormats = mergeRangeFormats(
    DEFAULT_TOOLTIP_DATE_FORMATS,
    tooltipDateFormats,
  );

  const formatDate = createRangeDateFormatter({
    language,
    timeZone,

    range: normalizedRange,

    formats: dateFormats,
  });

  const formatPrice = createNumberFormatter({
    language,
    decimals,
    useGrouping: true,
  });

  const formatPercent = createNumberFormatter({
    language,
    decimals: 2,
    useGrouping: false,
  });

  const labels = resolveTooltipLabels(configuration);

  return {
    enabled: configuration.enabled !== false,

    useHTML: true,

    outside: configuration.outside === true,

    /*
     * Shared tracking makes Highcharts search
     * by X throughout the plot instead of
     * requiring direct contact with the line.
     */
    shared: configuration.shared !== false,

    split: false,

    followPointer: false,

    followTouchMove: configuration.followTouchMove !== false,

    snap: toNonNegativeNumber(configuration.snap, 24),

    hideDelay: toNonNegativeNumber(configuration.hideDelay, 80),

    borderWidth: 1,

    borderRadius: toNonNegativeNumber(configuration.borderRadius, 12),

    borderColor: theme.tooltipBorder,

    backgroundColor: theme.tooltipBackground,

    padding: 0,

    shadow: {
      color: "rgb(0 0 0 / 0.14)",

      offsetX: 0,
      offsetY: 6,

      opacity: 0.14,
      width: 12,

      ...(isPlainObject(configuration.shadow) ? configuration.shadow : {}),
    },

    style: {
      color: theme.text,

      fontSize: "12px",

      pointerEvents: "none",

      ...(isPlainObject(configuration.style) ? configuration.style : {}),
    },

    positioner(labelWidth, labelHeight, point) {
      const chart = this.chart;

      const spacing = toNonNegativeNumber(configuration.spacing, 12);

      const plotX = Number.isFinite(point?.plotX)
        ? point.plotX
        : chart.plotWidth / 2;

      const plotY = Number.isFinite(point?.plotY)
        ? point.plotY
        : chart.plotHeight / 2;

      let x = chart.plotLeft + plotX + spacing;

      let y = chart.plotTop + plotY - labelHeight / 2;

      const minimumX = spacing;

      const maximumX = Math.max(
        minimumX,
        chart.chartWidth - labelWidth - spacing,
      );

      if (x > maximumX) {
        x = chart.plotLeft + plotX - labelWidth - spacing;
      }

      x = clamp(x, minimumX, maximumX);

      const minimumY = spacing;

      const maximumY = Math.max(
        minimumY,
        chart.chartHeight - labelHeight - spacing,
      );

      y = clamp(y, minimumY, maximumY);

      return {
        x,
        y,
      };
    },

    formatter() {
      /*
       * Highcharts versions expose shared
       * formatter context in slightly different
       * shapes. Support all relevant forms.
       */
      const point = this.point || this.points?.[0]?.point || this;

      const values = getTooltipValues(point, normalizedMode);

      if (!values) {
        return false;
      }

      const date = formatDate(point.x);

      const change = calculateChange(values.value, previousClose);

      const body =
        normalizedMode === "candlestick"
          ? [
              createTooltipRow(labels.open, values.open, formatPrice),

              createTooltipRow(labels.high, values.high, formatPrice),

              createTooltipRow(labels.low, values.low, formatPrice),

              createTooltipRow(labels.close, values.close, formatPrice),
            ].join("")
          : createTooltipRow(labels.value, values.value, formatPrice);

      let changeHTML = "";

      if (change) {
        const sign = change.amount > 0 ? "+" : "";

        const percent =
          change.percent === null
            ? ""
            : ` (${sign}${formatPercent(change.percent)}%)`;

        changeHTML = [
          '<div class="market-chart-tooltip__change ',

          `market-chart-tooltip__change--${escapeHTML(change.direction)}">`,

          escapeHTML(`${sign}${formatPrice(change.amount)}${percent}`),

          "</div>",
        ].join("");
      }

      /*
       * Highcharts-safe div and span elements
       * prevent AST warning #33.
       */
      return [
        '<div class="market-chart-tooltip">',

        '<div class="market-chart-tooltip__header">',

        '<div class="market-chart-tooltip__title">',
        escapeHTML(seriesName),
        "</div>",

        '<div class="market-chart-tooltip__date">',
        escapeHTML(date),
        "</div>",

        "</div>",

        '<div class="market-chart-tooltip__body">',

        '<div class="market-chart-tooltip__currency">',
        escapeHTML(currency),
        "</div>",

        body,

        "</div>",

        changeHTML,

        "</div>",
      ].join("");
    },
  };
}

/* ==========================================================================
   Main Series
   ========================================================================== */
function createMainSeries({
  mode,
  symbol,
  seriesName,
  data,
  seriesTheme,
  animation,
}) {
  const normalizedMode = normalizeMarketChartMode(mode);

  const type =
    normalizedMode === "candlestick"
      ? "candlestick"
      : normalizedMode === "line"
        ? "line"
        : "areaspline";

  return {
    name: seriesName || symbol || "Market",

    animation,

    dataGrouping: {
      enabled: false,
    },

    ...seriesTheme,

    /*
     * Structural options remain after the
     * theme spread so a theme cannot replace
     * series identity, type, or data.
     */
    id: `market-chart-${String(symbol || "series").toLowerCase()}`,

    type,

    data: Array.isArray(data) ? data : [],

    showInNavigator: false,

    showInLegend: false,
  };
}

/* ==========================================================================
   Plot Options
   ========================================================================== */

function createPlotOptions({ seriesTheme, animation, tooltip }) {
  const trackAcrossPlot = tooltip.trackAcrossPlot !== false;

  return {
    series: {
      animation,

      enableMouseTracking: tooltip.enabled !== false,

      dataGrouping: {
        enabled: false,
      },

      cropThreshold: 1_000,

      turboThreshold: 0,

      /*
       * Shared tooltip tracking performs a
       * nearest-X search anywhere in the plot.
       */
      stickyTracking: trackAcrossPlot,

      findNearestPointBy: trackAcrossPlot ? "x" : "xy",

      trackByArea: trackAcrossPlot,

      states: {
        inactive: {
          opacity: 1,
        },

        hover: {
          enabled: true,

          halo: {
            size: 0,
          },
        },
      },
    },

    line: {
      ...seriesTheme,

      marker: {
        enabled: false,

        states: {
          hover: {
            enabled: true,

            radius: toNonNegativeNumber(tooltip.markerRadius, 3),

            lineWidth: 1,
          },
        },
      },
    },

    areaspline: {
      ...seriesTheme,

      threshold: null,

      marker: {
        enabled: false,

        states: {
          hover: {
            enabled: true,

            radius: toNonNegativeNumber(tooltip.markerRadius, 3),

            lineWidth: 1,
          },
        },
      },
    },

    candlestick: {
      ...seriesTheme,

      /*
       * Candle width derives from real bucket
       * spacing rather than a fixed pixel width.
       */
      pointPadding: 0.08,

      groupPadding: 0.08,

      dataGrouping: {
        enabled: false,
      },

      states: {
        hover: {
          enabled: true,

          lineWidth: 2,
        },
      },
    },

    ohlc: {
      dataGrouping: {
        enabled: false,
      },
    },

    flags: {
      enableMouseTracking: false,
    },
  };
}

/* ==========================================================================
   Navigator Configuration
   ========================================================================== */

function normalizeNavigatorConfiguration({
  navigator,
  navigatorEnabled,
  capabilities,
  layout,
  overview,
}) {
  const configuration = isPlainObject(navigator) ? navigator : {};

  const capabilityEnabled = capabilities.navigator !== false;

  const enabled =
    navigatorEnabled === null || navigatorEnabled === undefined
      ? capabilityEnabled
      : Boolean(navigatorEnabled && capabilityEnabled);

  return {
    enabled,

    height: toNonNegativeNumber(configuration.height, layout.navigatorHeight),

    margin: toNonNegativeNumber(configuration.margin, layout.navigatorMargin),

    labels: configuration.labels !== false,

    labelsInside: configuration.labelsInside !== false,

    insideLabelOffset: Number.isFinite(Number(configuration.insideLabelOffset))
      ? Number(configuration.insideLabelOffset)
      : -7,

    handles: configuration.handles !== false,

    handleWidth: toNonNegativeNumber(configuration.handleWidth, 7),

    handleHeight: toNonNegativeNumber(
      configuration.handleHeight,
      layout.navigatorHandleHeight,
    ),

    tickPixelInterval: toNonNegativeNumber(
      configuration.tickPixelInterval,
      overview ? 92 : 108,
    ),

    dataGrouping: configuration.dataGrouping === true,

    /*
     * Visual intensity defaults belong to
     * market-chart-theme.js.
     */
    lineWidth: toNonNegativeNumber(configuration.lineWidth, 1.25),

    lineOpacity: configuration.lineOpacity,

    maskOpacity: configuration.maskOpacity,

    fillStartOpacity: configuration.fillStartOpacity,

    fillEndOpacity: configuration.fillEndOpacity,

    outlineOpacity: configuration.outlineOpacity,

    handleBorderOpacity: configuration.handleBorderOpacity,

    handleBackground: configuration.handleBackground,

    outlineWidth: toNonNegativeNumber(configuration.outlineWidth, 0),

    formats: isPlainObject(configuration.formats) ? configuration.formats : {},

    rotation: configuration.rotation ?? 0,
  };
}

/* ==========================================================================
   Navigator
   ========================================================================== */

function createNavigatorOptions({
  Highcharts,

  enabled,
  range,

  data,
  direction,

  language,
  timeZone,

  theme,
  configuration,
}) {
  if (!enabled || !Array.isArray(data) || !data.length) {
    return {
      enabled: false,
    };
  }

  const navigatorTheme = getMarketChartNavigatorTheme(
    Highcharts,
    theme,
    direction,
    {
      lineWidth: configuration.lineWidth,

      lineOpacity: configuration.lineOpacity,

      maskOpacity: configuration.maskOpacity,

      fillStartOpacity: configuration.fillStartOpacity,

      fillEndOpacity: configuration.fillEndOpacity,

      outlineOpacity: configuration.outlineOpacity,

      handleBorderOpacity: configuration.handleBorderOpacity,

      handleBackground: configuration.handleBackground,
    },
  );

  const formats = mergeRangeFormats(
    DEFAULT_X_AXIS_FORMATS,
    configuration.formats,
  );

  const formatDate = createRangeDateFormatter({
    language,
    timeZone,
    range,
    formats,
  });

  return {
    enabled: true,

    adaptToUpdatedData: false,

    height: configuration.height,

    margin: configuration.margin,

    maskInside: true,

    maskFill: navigatorTheme.maskFill,

    outlineWidth: configuration.outlineWidth,

    outlineColor:
      configuration.outlineWidth > 0
        ? navigatorTheme.outlineColor
        : "transparent",

    handles: {
      enabled: configuration.handles,

      width: configuration.handleWidth,

      height: configuration.handleHeight,

      borderWidth: 1,

      backgroundColor: navigatorTheme.handles.backgroundColor,

      borderColor: navigatorTheme.handles.borderColor,

      lineColor: navigatorTheme.handles.borderColor,
    },

    xAxis: {
      type: "datetime",

      ordinal: normalizeMarketChartRange(range) !== "1D",

      overscroll: 0,

      minPadding: 0,
      maxPadding: 0,

      startOnTick: false,
      endOnTick: false,

      lineWidth: 0,
      tickWidth: 0,
      gridLineWidth: 0,

      tickPixelInterval: configuration.tickPixelInterval,

      labels: {
        enabled: configuration.labels,

        inside: configuration.labelsInside,

        y: configuration.labelsInside ? configuration.insideLabelOffset : 12,

        rotation: resolveRangeValue(configuration.rotation, range, 0),

        align: "center",

        reserveSpace: !configuration.labelsInside,

        style: {
          color: theme.muted,

          fontSize: "10px",

          textOutline: "none",
        },

        formatter() {
          return formatDate(this.value);
        },
      },
    },

    yAxis: {
      gridLineWidth: 0,

      startOnTick: false,
      endOnTick: false,

      minPadding: 0.08,
      maxPadding: 0.08,

      labels: {
        enabled: false,
      },

      title: {
        text: null,
      },
    },

    series: {
      id: "market-chart-navigator-series",

      name: "Navigator",

      /*
       * Navigator remains a lightweight trend,
       * including for candlestick mode.
       */
      type: "areaspline",

      data,

      color: navigatorTheme.color,

      lineColor: navigatorTheme.lineColor,

      lineWidth: navigatorTheme.lineWidth,

      fillColor: navigatorTheme.fillColor,

      threshold: null,

      marker: {
        enabled: false,
      },

      enableMouseTracking: false,

      showInLegend: false,

      animation: false,

      dataGrouping: {
        enabled: configuration.dataGrouping,
      },

      states: {
        hover: {
          enabled: false,
        },

        inactive: {
          opacity: 1,
        },
      },
    },
  };
}

/* ==========================================================================
   Exporting
   ========================================================================== */

function createExportingOptions(exporting) {
  const configuration = isPlainObject(exporting) ? exporting : {};

  return {
    /*
     * The native context button remains hidden;
     * the custom accessible menu owns actions.
     */
    enabled: false,

    fallbackToExportServer: configuration.fallbackToExportServer ?? false,

    libURL: configuration.libURL || "https://code.highcharts.com/12.4.0/lib/",

    filename: configuration.filename || "market-chart",

    sourceWidth: toNonNegativeNumber(configuration.sourceWidth, 1_200),

    sourceHeight: toNonNegativeNumber(configuration.sourceHeight, 675),

    scale: toNonNegativeNumber(configuration.scale, 2),

    printMaxWidth: toNonNegativeNumber(configuration.printMaxWidth, 1_200),

    chartOptions: {
      chart: {
        backgroundColor: configuration.exportBackground || "#ffffff",
      },

      ...(isPlainObject(configuration.chartOptions)
        ? configuration.chartOptions
        : {}),
    },

    buttons: {
      contextButton: {
        enabled: false,
      },
    },
  };
}

/* ==========================================================================
   Responsive
   ========================================================================== */

function createResponsiveOptions() {
  return {
    rules: [
      {
        condition: {
          maxWidth: 640,
        },

        chartOptions: {
          chart: {
            spacingLeft: 8,
            spacingRight: 8,

            marginLeft: 8,
            marginRight: 56,
          },

          xAxis: {
            labels: {
              style: {
                fontSize: "10px",
              },
            },

            title: {
              margin: 12,
            },
          },

          yAxis: {
            tickPixelInterval: 48,

            labels: {
              x: 6,

              style: {
                fontSize: "10px",
              },
            },

            title: {
              margin: 10,

              style: {
                fontSize: "10px",
              },
            },
          },

          navigator: {
            height: 34,
            margin: 8,

            handles: {
              width: 7,
              height: 18,
            },

            xAxis: {
              tickPixelInterval: 92,

              labels: {
                style: {
                  fontSize: "9px",
                },
              },
            },
          },
        },
      },

      {
        condition: {
          maxWidth: 420,
        },

        chartOptions: {
          chart: {
            marginRight: 50,
          },

          yAxis: {
            labels: {
              style: {
                fontSize: "9px",
              },
            },
          },

          navigator: {
            xAxis: {
              tickPixelInterval: 112,
            },
          },
        },
      },
    ],
  };
}

/* ==========================================================================
   Options Factory
   ========================================================================== */
export function createMarketChartOptions({
  Highcharts,
  element,

  context = null,

  capabilities = {},

  mode = "trend",
  range = DEFAULT_RANGE,
  direction = "neutral",

  symbol = "TASI",

  seriesName = symbol,

  currency = "",

  previousClose = null,

  data = [],

  navigatorData = null,

  language = globalThis.document?.documentElement?.lang || DEFAULT_LANGUAGE,

  timeZone = DEFAULT_TIME_ZONE,

  decimals = DEFAULT_DECIMALS,

  xAxisTitle = null,
  yAxisTitle = null,

  axis = {},
  xAxis = {},
  yAxis = {},

  dateFormats = {},

  tooltipDateFormats = {},

  tooltip = {},

  animation = true,

  navigatorEnabled = null,

  navigator = {},

  exporting = {},

  accessibilityEnabled = true,

  accessibilityDescription = "",
} = {}) {
  if (!Highcharts) {
    throw new TypeError("createMarketChartOptions() requires Highcharts.");
  }

  if (!isElement(element)) {
    throw new TypeError(
      "createMarketChartOptions() requires a valid chart element.",
    );
  }

  const normalizedMode = normalizeMarketChartMode(mode);

  const normalizedRange = normalizeMarketChartRange(range);

  const hasData = Array.isArray(data) && data.length > 0;

  const resolvedContext = resolveContext(element, context);

  const overview = resolvedContext === "overview";

  const layout = CONTEXT_LAYOUT[resolvedContext];

  const resolvedCapabilities = {
    navigator: true,

    ...(isPlainObject(capabilities) ? capabilities : {}),
  };

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

    capabilities: resolvedCapabilities,

    layout,
    overview,
  });

  const tooltipConfiguration = isPlainObject(tooltip) ? tooltip : {};

  const theme = resolveTheme(element, direction);

  const seriesTheme = getMarketChartSeriesTheme(
    Highcharts,
    theme,
    normalizedMode,
    direction,
  );

  const resolvedAnimation = normalizeMarketChartAnimation(animation, {
    element,

    mode: normalizedMode,
  });

  const resolvedDateFormats = mergeRangeFormats(
    DEFAULT_X_AXIS_FORMATS,
    dateFormats,
  );

  const mainSeries = createMainSeries({
    mode: normalizedMode,

    symbol,
    seriesName,

    data,
    seriesTheme,

    animation: resolvedAnimation,
  });

  const resolvedNavigatorData = Array.isArray(navigatorData)
    ? navigatorData
    : data;

  const normalizedLanguage = String(language || DEFAULT_LANGUAGE).toLowerCase();

  const arabic =
    normalizedLanguage === "ar" || normalizedLanguage.startsWith("ar-");

  return {
    chart: {
      backgroundColor: theme.background,

      animation: resolvedAnimation,

      spacingTop: layout.spacingTop,

      spacingRight: layout.spacingRight,

      spacingBottom: layout.spacingBottom,

      spacingLeft: layout.spacingLeft,

      marginTop: layout.marginTop,

      marginRight: layout.marginRight,

      marginLeft: layout.marginLeft,

      marginBottom: null,

      reflow: true,

      styledMode: false,

      zooming: {
        type: "x",

        mouseWheel: {
          enabled: false,
        },

        pinchType: "x",

        resetButton: {
          theme: {
            display: "none",
          },
        },
      },

      panning: {
        enabled: true,

        type: "x",
      },

      panKey: "shift",

      className: [
        "market-chart-highstock",

        overview
          ? "market-chart-highstock--overview"
          : "market-chart-highstock--performance",
      ].join(" "),
    },

    time: {
      useUTC: true,

      timezone: timeZone || DEFAULT_TIME_ZONE,
    },

    lang: {
      noData: arabic ? "لا تتوفر بيانات للسوق." : "No market data available.",

      loading: arabic ? "جارٍ تحميل بيانات السوق…" : "Loading market data…",

      resetZoom: arabic ? "إعادة ضبط التكبير" : "Reset zoom",

      resetZoomTitle: arabic
        ? "إعادة ضبط مستوى تكبير الرسم البياني"
        : "Reset chart zoom",
    },

    title: {
      text: null,
    },

    subtitle: {
      text: null,
    },

    credits: {
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

    /*
     * Do not render empty navigator chrome.
     */
    navigator: createNavigatorOptions({
      Highcharts,

      enabled: navigatorConfiguration.enabled && hasData,

      range: normalizedRange,

      data: resolvedNavigatorData,

      direction,

      language,
      timeZone,

      theme,

      configuration: navigatorConfiguration,
    }),

    /*
     * Empty charts retain their dimensions but
     * do not display misleading chart chrome.
     */
    xAxis: {
      ...createXAxisOptions({
        range: normalizedRange,

        language,
        timeZone,

        theme,

        configuration: axisConfiguration.x,

        dateFormats: resolvedDateFormats,
      }),

      visible: hasData,
    },

    yAxis: {
      ...createYAxisOptions({
        language,

        theme,
        layout,

        configuration: axisConfiguration.y,
      }),

      visible: hasData,
    },

    tooltip: {
      ...createTooltipOptions({
        range: normalizedRange,

        mode: normalizedMode,

        seriesName,
        currency,
        previousClose,

        language,
        timeZone,
        decimals,

        theme,

        tooltipDateFormats,

        configuration: tooltipConfiguration,
      }),

      enabled: hasData && tooltipConfiguration.enabled !== false,
    },

    plotOptions: createPlotOptions({
      seriesTheme,

      animation: resolvedAnimation,

      tooltip: tooltipConfiguration,
    }),

    series: [mainSeries],

    loading: {
      labelStyle: {
        color: theme.text,

        fontSize: "13px",

        fontWeight: "600",
      },

      style: {
        backgroundColor: createColorWithOpacity(
          Highcharts,

          theme.background === "transparent"
            ? theme.tooltipBackground
            : theme.background,

          0.82,
        ),

        opacity: 1,
      },

      showDuration: 0,

      hideDuration: 0,
    },

    accessibility: {
      enabled: accessibilityEnabled !== false,

      description: accessibilityDescription || "",

      landmarkVerbosity: "one",

      keyboardNavigation: {
        enabled: true,

        order: ["series", "zoom"],
      },

      announceNewData: {
        enabled: false,
      },
    },

    exporting: createExportingOptions(exporting),

    responsive: createResponsiveOptions(),
  };
}

/* ==========================================================================
   Exports
   ========================================================================== */

export { CONTEXT_LAYOUT, DEFAULT_TOOLTIP_DATE_FORMATS, DEFAULT_X_AXIS_FORMATS };
