import {
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
const INTRADAY_RANGE = "1D";

const DEFAULT_ANIMATION_DURATION = 250;
const MAX_ANIMATION_DURATION = 1_000;
const MINUTE = 60_000;

const CONTEXT_LAYOUT = Object.freeze({
  overview: Object.freeze({
    spacing: 12,
    bottomSpacing: 18,
    yAxisTickPixelInterval: 52,
    navigatorHeight: 32,
    navigatorMargin: 12,
    navigatorLabels: false,
    navigatorTickPixelInterval: 120,
  }),

  performance: Object.freeze({
    spacing: 16,
    bottomSpacing: 24,
    yAxisTickPixelInterval: 56,
    navigatorHeight: 40,
    navigatorMargin: 14,
    navigatorLabels: true,
    navigatorTickPixelInterval: 110,
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

const INTRADAY_TICK_INTERVALS = Object.freeze([
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  60 * MINUTE,
  2 * 60 * MINUTE,
]);

/* ==========================================================================
   Generic Helpers
   ========================================================================== */

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && value.ownerDocument);
}

function toFiniteNumber(value) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toNonNegativeNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resolveRangeValue(value, range, fallback) {
  if (isPlainObject(value)) {
    return value[range] ?? value.default ?? fallback;
  }

  return value ?? fallback;
}

function resolveContext(element, context) {
  const value = String(
    context || element?.dataset?.chartContext || "performance",
  )
    .trim()
    .toLowerCase();

  return CONTEXT_LAYOUT[value] ? value : "performance";
}

function isArabicLanguage(language) {
  return String(language || DEFAULT_LANGUAGE)
    .toLowerCase()
    .startsWith("ar");
}

function resolveRTL(element, language) {
  const direction =
    element?.closest?.("[dir]")?.getAttribute?.("dir") ||
    element?.ownerDocument?.documentElement?.dir;

  if (direction === "rtl") {
    return true;
  }

  if (direction === "ltr") {
    return false;
  }

  return isArabicLanguage(language);
}

/* ==========================================================================
   Motion
   ========================================================================== */

function prefersReducedMotion(element) {
  const document = element?.ownerDocument;

  if (document?.documentElement?.dataset?.motion === "reduce") {
    return true;
  }

  try {
    return (
      document?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")
        ?.matches === true
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
      MAX_ANIMATION_DURATION,
    );

    if (!duration) {
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
      ? clamp(animation, 0, MAX_ANIMATION_DURATION)
      : DEFAULT_ANIMATION_DURATION;

  return duration
    ? {
        duration,
      }
    : false;
}

/* ==========================================================================
   Formatting
   ========================================================================== */

function createNumberFormatter({
  language,
  decimals = DEFAULT_DECIMALS,
  useGrouping = true,
}) {
  const parsed = Number.parseInt(decimals, 10);

  const precision = clamp(
    Number.isFinite(parsed) ? parsed : DEFAULT_DECIMALS,
    0,
    8,
  );

  let formatter;

  try {
    formatter = new Intl.NumberFormat(language || DEFAULT_LANGUAGE, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
      useGrouping,
    });
  } catch {
    formatter = new Intl.NumberFormat(DEFAULT_LANGUAGE, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
      useGrouping,
    });
  }

  return (value) => {
    const number = toFiniteNumber(value);

    return number === null ? "—" : formatter.format(number);
  };
}

function getDateFormat(range, customFormats, defaults) {
  const normalizedRange = normalizeMarketChartRange(range);

  return (
    customFormats?.[normalizedRange] ||
    customFormats?.default ||
    defaults?.[normalizedRange] ||
    defaults?.default ||
    DEFAULT_X_AXIS_FORMATS.ALL
  );
}

function createDateFormatter({ language, timeZone, options }) {
  let formatter;

  try {
    formatter = new Intl.DateTimeFormat(language || DEFAULT_LANGUAGE, {
      timeZone: timeZone || DEFAULT_TIME_ZONE,

      ...options,
    });
  } catch {
    formatter = new Intl.DateTimeFormat(DEFAULT_LANGUAGE, {
      timeZone: DEFAULT_TIME_ZONE,

      ...options,
    });
  }

  return (timestamp) => {
    const value = toFiniteNumber(timestamp);

    if (value === null) {
      return "";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
  };
}

/* ==========================================================================
   Intraday Ticks
   ========================================================================== */

function chooseIntradayTickInterval(span, axisLength, configuredInterval) {
  const explicit = toFiniteNumber(configuredInterval);

  if (explicit !== null && explicit > 0) {
    return explicit;
  }

  const width = Math.max(1, toFiniteNumber(axisLength) ?? 1);

  const targetTicks = clamp(Math.floor(width / 88), 3, 8);

  const desired = span / Math.max(1, targetTicks - 1);

  return (
    INTRADAY_TICK_INTERVALS.find((interval) => interval >= desired) ||
    INTRADAY_TICK_INTERVALS[INTRADAY_TICK_INTERVALS.length - 1]
  );
}

function createIntradayTickPositioner(configuration = {}) {
  return function intradayTickPositioner() {
    const dataMinimum = toFiniteNumber(this.dataMin);

    const dataMaximum = toFiniteNumber(this.dataMax);

    const axisMinimum = toFiniteNumber(this.min);

    const axisMaximum = toFiniteNumber(this.max);

    if (
      dataMinimum === null ||
      dataMaximum === null ||
      axisMinimum === null ||
      axisMaximum === null ||
      axisMaximum < axisMinimum
    ) {
      return undefined;
    }

    const minimum = Math.max(dataMinimum, axisMinimum);

    const maximum = Math.min(dataMaximum, axisMaximum);

    if (maximum <= minimum) {
      return [minimum];
    }

    const interval = chooseIntradayTickInterval(
      maximum - minimum,
      this.len,
      configuration.tickInterval,
    );

    const positions = [minimum];

    let tick = Math.ceil(minimum / interval) * interval;

    if (tick <= minimum + 500) {
      tick += interval;
    }

    while (tick < maximum - 500) {
      positions.push(tick);

      tick += interval;
    }

    return positions;
  };
}

/* ==========================================================================
   X Axis
   ========================================================================== */

function createXAxisOptions({
  range,
  language,
  timeZone,
  theme,
  configuration = {},
  dateFormats = {},
}) {
  const normalizedRange = normalizeMarketChartRange(range);

  const intraday = normalizedRange === INTRADAY_RANGE;

  const formatDate = createDateFormatter({
    language,
    timeZone,

    options: getDateFormat(
      normalizedRange,
      dateFormats,
      DEFAULT_X_AXIS_FORMATS,
    ),
  });

  const title = resolveRangeValue(
    configuration.title,
    normalizedRange,
    intraday ? "Time" : "Date",
  );

  const rotation =
    Number(resolveRangeValue(configuration.rotation, normalizedRange, 0)) || 0;

  const labelOptions = isPlainObject(configuration.labelOptions)
    ? configuration.labelOptions
    : {};

  return {
    type: "datetime",

    /*
     * Intraday preserves elapsed-time spacing.
     * Historical uses Highstock ordinal spacing.
     */
    ordinal: configuration.ordinal ?? !intraday,

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

    tickPixelInterval: toNonNegativeNumber(
      configuration.tickPixelInterval,

      intraday ? 88 : 100,
    ),

    tickPositioner:
      intraday && configuration.tickPositioner !== false
        ? createIntradayTickPositioner(configuration)
        : undefined,

    minRange: configuration.minRange ?? undefined,

    crosshair:
      configuration.crosshair === false
        ? false
        : {
            color: theme.crosshair,

            width: 1,

            dashStyle: "ShortDot",

            snap: true,

            ...(isPlainObject(configuration.crosshair)
              ? configuration.crosshair
              : {}),
          },

    labels: {
      enabled: configuration.labels !== false,

      autoRotation: false,

      rotation,

      align: rotation === 0 ? "center" : "right",

      reserveSpace: true,

      y: rotation === 0 ? 18 : 22,

      overflow: "justify",

      crop: true,

      style: {
        color: theme.muted,

        fontSize: "11px",

        textOverflow: "none",

        ...(isPlainObject(labelOptions.style) ? labelOptions.style : {}),
      },

      formatter() {
        return formatDate(this.value);
      },

      ...labelOptions,
    },

    showFirstLabel: configuration.showFirstLabel !== false,

    showLastLabel: configuration.showLastLabel !== false,

    title: {
      text: title === false ? null : title,

      margin: toNonNegativeNumber(configuration.titleMargin, 14),

      style: {
        color: theme.muted,

        fontSize: "11px",

        fontWeight: "500",

        ...(isPlainObject(configuration.titleStyle)
          ? configuration.titleStyle
          : {}),
      },
    },
  };
}

/* ==========================================================================
   Y Axis
   ========================================================================== */

function createYAxisOptions({
  language,
  theme,
  layout,
  configuration = {},
  decimals,
  rtl,
}) {
  const formatConfiguration = isPlainObject(configuration.format)
    ? configuration.format
    : {};

  const formatNumber = createNumberFormatter({
    language,

    decimals: formatConfiguration.decimals ?? decimals,

    useGrouping: formatConfiguration.useGrouping !== false,
  });

  const opposite =
    typeof configuration.opposite === "boolean" ? configuration.opposite : !rtl;

  const labelOptions = isPlainObject(configuration.labelOptions)
    ? configuration.labelOptions
    : {};

  const titleOptions = isPlainObject(configuration.titleOptions)
    ? configuration.titleOptions
    : {};

  return {
    opposite,

    minPadding: toNonNegativeNumber(configuration.minPadding, 0.06),

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

    gridLineDashStyle: configuration.gridLineDashStyle || "ShortDot",

    crosshair:
      configuration.crosshair === false
        ? false
        : {
            color: theme.crosshair,

            width: 1,

            dashStyle: "ShortDot",

            snap: true,

            ...(isPlainObject(configuration.crosshair)
              ? configuration.crosshair
              : {}),
          },

    labels: {
      enabled: configuration.labels !== false,

      reserveSpace: true,

      align: opposite ? "left" : "right",

      x: opposite ? 10 : -10,

      style: {
        color: theme.muted,

        fontSize: "11px",

        textOverflow: "none",

        ...(isPlainObject(labelOptions.style) ? labelOptions.style : {}),
      },

      formatter() {
        return formatNumber(this.value);
      },

      ...labelOptions,
    },

    title: {
      text:
        configuration.title === false
          ? null
          : configuration.title || "Index Value",

      margin: toNonNegativeNumber(
        configuration.titleMargin,

        18,
      ),

      style: {
        color: theme.muted,

        fontSize: "11px",

        fontWeight: "600",

        ...(isPlainObject(titleOptions.style) ? titleOptions.style : {}),
      },

      ...titleOptions,
    },
  };
}

/* ==========================================================================
   Tooltip
   ========================================================================== */

function getTooltipLabels(language) {
  return isArabicLanguage(language)
    ? {
        value: "القيمة",

        open: "الافتتاح",

        high: "الأعلى",

        low: "الأدنى",

        close: "الإغلاق",
      }
    : {
        value: "Value",

        open: "Open",

        high: "High",

        low: "Low",

        close: "Close",
      };
}

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

  return value === null
    ? null
    : {
        value,
      };
}

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
  configuration = {},
}) {
  const normalizedMode = normalizeMarketChartMode(mode);

  const labels = getTooltipLabels(language);

  const formatDate = createDateFormatter({
    language,
    timeZone,

    options: getDateFormat(
      range,

      tooltipDateFormats,

      DEFAULT_TOOLTIP_DATE_FORMATS,
    ),
  });

  const formatNumber = createNumberFormatter({
    language,
    decimals,
  });

  const formatPercent = createNumberFormatter({
    language,

    decimals: 2,

    useGrouping: false,
  });

  const row = (label, value) => `
      <div class="market-chart-tooltip__row">
        <span class="market-chart-tooltip__label">
          ${escapeHTML(label)}
        </span>

        <span class="market-chart-tooltip__value">
          ${escapeHTML(formatNumber(value))}
        </span>
      </div>
    `;

  return {
    enabled: configuration.enabled !== false,

    useHTML: true,

    shared: false,

    split: false,

    followTouchMove: true,

    animation: false,

    borderColor: theme.tooltipBorder,

    backgroundColor: theme.tooltipBackground,

    borderWidth: 1,

    borderRadius: 10,

    padding: 0,

    shadow: false,

    style: {
      color: theme.text,

      fontSize: "12px",

      ...(isPlainObject(configuration.style) ? configuration.style : {}),
    },

    formatter() {
      const point = this.point || this.points?.[0]?.point || this;

      const values = getTooltipValues(
        point,

        normalizedMode,
      );

      if (!values) {
        return false;
      }

      const body =
        normalizedMode === "candlestick"
          ? [
              row(labels.open, values.open),

              row(labels.high, values.high),

              row(labels.low, values.low),

              row(labels.close, values.close),
            ].join("")
          : row(labels.value, values.value);

      const reference = toFiniteNumber(previousClose);

      let changeHTML = "";

      if (reference !== null) {
        const change = values.value - reference;

        const percent =
          reference === 0 ? null : (change / Math.abs(reference)) * 100;

        const direction = change > 0 ? "up" : change < 0 ? "down" : "neutral";

        const sign = change > 0 ? "+" : "";

        const percentage =
          percent === null ? "" : ` (${sign}${formatPercent(percent)}%)`;

        changeHTML = `
          <div
            class="market-chart-tooltip__change market-chart-tooltip__change--${direction}"
          >
            ${escapeHTML(`${sign}${formatNumber(change)}${percentage}`)}
          </div>
        `;
      }

      return `
        <div class="market-chart-tooltip">

          <div class="market-chart-tooltip__header">

            <strong class="market-chart-tooltip__title">
              ${escapeHTML(seriesName)}
            </strong>

            <span class="market-chart-tooltip__date">
              ${escapeHTML(formatDate(point.x))}
            </span>

          </div>

          <div class="market-chart-tooltip__body">

            ${
              currency
                ? `
                  <div class="market-chart-tooltip__currency">
                    ${escapeHTML(currency)}
                  </div>
                `
                : ""
            }

            ${body}

          </div>

          ${changeHTML}

        </div>
      `;
    },

    ...(isPlainObject(configuration.options) ? configuration.options : {}),
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
    id: `market-chart-${String(symbol || "series").toLowerCase()}`,

    name: seriesName || symbol || "Market",

    type,

    data: Array.isArray(data) ? data : [],

    animation,

    showInLegend: false,

    /*
     * Explicit navigator series.
     */
    showInNavigator: false,

    /*
     * Keep exact canonical controller points.
     */
    dataGrouping: {
      enabled: false,
    },

    ...seriesTheme,
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
  layout,
  configuration = {},
}) {
  if (!enabled || !Array.isArray(data) || !data.length) {
    return {
      enabled: false,
    };
  }

  const normalizedRange = normalizeMarketChartRange(range);

  const intraday = normalizedRange === INTRADAY_RANGE;

  const navigatorTheme = getMarketChartNavigatorTheme(
    Highcharts,

    theme,

    direction,
  );

  const formatDate = createDateFormatter({
    language,
    timeZone,

    options: intraday
      ? {
          hour: "2-digit",

          minute: "2-digit",

          hourCycle: "h23",
        }
      : getDateFormat(
          normalizedRange,

          configuration.formats,

          DEFAULT_X_AXIS_FORMATS,
        ),
  });

  const labelsEnabled =
    configuration.labels === true ||
    (configuration.labels !== false && layout.navigatorLabels === true);

  return {
    enabled: true,

    /*
     * Navigator data is explicitly
     * synchronized by market-chart.js.
     */
    adaptToUpdatedData: false,

    /*
     * The controller alone owns
     * live-follow behavior.
     */
    stickToMax: false,

    height: toNonNegativeNumber(
      configuration.height,

      layout.navigatorHeight,
    ),

    margin: toNonNegativeNumber(
      configuration.margin,

      layout.navigatorMargin,
    ),

    maskInside: configuration.maskInside !== false,

    maskFill: navigatorTheme.maskFill,

    outlineWidth: toNonNegativeNumber(
      configuration.outlineWidth,

      0,
    ),

    outlineColor: configuration.outlineColor || theme.border,

    handles: {
      enabled: configuration.handles !== false,

      width: toNonNegativeNumber(
        configuration.handleWidth,

        7,
      ),

      height: toNonNegativeNumber(
        configuration.handleHeight,

        layout.navigatorHeight <= 32 ? 14 : 18,
      ),

      backgroundColor: navigatorTheme.handles.backgroundColor,

      borderColor: navigatorTheme.handles.borderColor,

      ...(isPlainObject(configuration.handleOptions)
        ? configuration.handleOptions
        : {}),
    },

    xAxis: {
      type: "datetime",

      ordinal: configuration.ordinal ?? !intraday,

      overscroll: 0,

      minPadding: 0,

      maxPadding: 0,

      startOnTick: false,

      endOnTick: false,

      lineWidth: 0,

      tickWidth: 0,

      gridLineWidth: 0,

      tickPixelInterval: toNonNegativeNumber(
        configuration.tickPixelInterval,

        layout.navigatorTickPixelInterval,
      ),

      labels: {
        enabled: labelsEnabled,

        inside: false,

        reserveSpace: labelsEnabled,

        y: 16,

        rotation: 0,

        overflow: "justify",

        crop: true,

        style: {
          color: theme.muted,

          fontSize: "10px",

          textOutline: "none",

          ...(isPlainObject(configuration.labelStyle)
            ? configuration.labelStyle
            : {}),
        },

        formatter() {
          return formatDate(this.value);
        },
      },

      /*
       * Avoid labels colliding
       * with the handles.
       */
      showFirstLabel: configuration.showFirstLabel === true,

      showLastLabel: configuration.showLastLabel === true,
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

      type: "areaspline",

      data,

      animation: false,

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

      /*
       * Optional visual-only grouping.
       */
      dataGrouping: {
        enabled: configuration.dataGrouping === true,
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
   Export
   ========================================================================== */

function createExportingOptions(exporting = {}) {
  const configuration = isPlainObject(exporting) ? exporting : {};

  const enabled = configuration.enabled === true;

  const showContextButton = enabled && configuration.showContextButton === true;

  return {
    enabled,

    filename: configuration.filename || "market-chart",

    fallbackToExportServer: configuration.fallbackToExportServer ?? false,

    sourceWidth: toNonNegativeNumber(
      configuration.sourceWidth,

      1_200,
    ),

    sourceHeight: toNonNegativeNumber(
      configuration.sourceHeight,

      675,
    ),

    scale: toNonNegativeNumber(
      configuration.scale,

      2,
    ),

    printMaxWidth: toNonNegativeNumber(
      configuration.printMaxWidth,

      1_200,
    ),

    buttons: {
      contextButton: {
        enabled: showContextButton,
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
            spacingTop: 10,

            spacingRight: 14,

            spacingBottom: 20,

            spacingLeft: 14,
          },

          xAxis: {
            tickPixelInterval: 78,

            labels: {
              style: {
                fontSize: "10px",
              },
            },
          },

          yAxis: {
            tickPixelInterval: 48,

            labels: {
              style: {
                fontSize: "10px",
              },
            },

            title: {
              margin: 14,

              style: {
                fontSize: "10px",
              },
            },
          },

          navigator: {
            height: 34,

            margin: 12,

            handles: {
              width: 7,

              height: 16,
            },

            xAxis: {
              tickPixelInterval: 100,

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
            spacingTop: 8,

            spacingRight: 12,

            spacingBottom: 18,

            spacingLeft: 12,
          },

          xAxis: {
            tickPixelInterval: 70,

            labels: {
              style: {
                fontSize: "9px",
              },
            },
          },

          yAxis: {
            labels: {
              style: {
                fontSize: "9px",
              },
            },

            title: {
              margin: 12,

              style: {
                fontSize: "9px",
              },
            },
          },

          navigator: {
            height: 32,

            margin: 10,

            handles: {
              width: 7,

              height: 14,
            },

            xAxis: {
              tickPixelInterval: 96,
            },
          },
        },
      },
    ],
  };
}

/* ==========================================================================
   Factory
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
  if (!Highcharts || typeof Highcharts.stockChart !== "function") {
    throw new TypeError("createMarketChartOptions() requires Highstock.");
  }

  if (!isElement(element)) {
    throw new TypeError(
      "createMarketChartOptions() requires a valid chart element.",
    );
  }

  const normalizedMode = normalizeMarketChartMode(mode);

  const normalizedRange = normalizeMarketChartRange(range);

  const hasData = Array.isArray(data) && data.length > 0;

  const resolvedContext = resolveContext(
    element,

    context,
  );

  const layout = CONTEXT_LAYOUT[resolvedContext];

  const rtl = resolveRTL(
    element,

    language,
  );

  const theme = getMarketChartTheme(element);

  const seriesTheme = getMarketChartSeriesTheme(
    Highcharts,

    theme,

    normalizedMode,

    direction,
  );

  const resolvedAnimation = normalizeMarketChartAnimation(
    animation,

    {
      element,

      mode: normalizedMode,
    },
  );

  /* ------------------------------------------------------------------------
     Axis Configuration
     ------------------------------------------------------------------------ */

  const axisConfiguration = isPlainObject(axis) ? axis : {};

  const xAxisConfiguration = {
    ...(isPlainObject(axisConfiguration.x) ? axisConfiguration.x : {}),

    ...(isPlainObject(xAxis) ? xAxis : {}),
  };

  const yAxisConfiguration = {
    ...(isPlainObject(axisConfiguration.y) ? axisConfiguration.y : {}),

    ...(isPlainObject(yAxis) ? yAxis : {}),
  };

  if (xAxisTitle !== null && xAxisTitle !== undefined) {
    xAxisConfiguration.title = xAxisTitle;
  }

  if (yAxisTitle !== null && yAxisTitle !== undefined) {
    yAxisConfiguration.title = yAxisTitle;
  }

  /* ------------------------------------------------------------------------
     Navigator
     ------------------------------------------------------------------------ */

  const navigatorConfiguration = isPlainObject(navigator) ? navigator : {};

  const navigatorAllowed =
    capabilities?.navigator !== false &&
    navigatorEnabled !== false &&
    navigatorConfiguration.enabled !== false;

  const resolvedNavigatorData = Array.isArray(navigatorData)
    ? navigatorData
    : data;

  /* ------------------------------------------------------------------------
     Export
     ------------------------------------------------------------------------ */

  const exportingOptions = createExportingOptions(exporting);

  const nativeChartMenuEnabled =
    exportingOptions.buttons.contextButton.enabled === true;

  /* ------------------------------------------------------------------------
     Main Series
     ------------------------------------------------------------------------ */

  const mainSeries = createMainSeries({
    mode: normalizedMode,

    symbol,

    seriesName,

    data,

    seriesTheme,

    animation: resolvedAnimation,
  });

  /* ------------------------------------------------------------------------
     Accessibility
     ------------------------------------------------------------------------ */

  const keyboardOrder = [
    "series",

    ...(navigatorAllowed && hasData ? ["navigator"] : []),

    ...(nativeChartMenuEnabled ? ["chartMenu"] : []),

    "zoom",
  ];

  const arabic = isArabicLanguage(language);

  /* ========================================================================
     Highstock Options
     ======================================================================== */

  return {
    chart: {
      backgroundColor: theme.background,

      animation: resolvedAnimation,

      spacingTop: layout.spacing,

      spacingRight: layout.spacing,

      spacingBottom: layout.bottomSpacing,

      spacingLeft: layout.spacing,

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

      className:
        resolvedContext === "overview"
          ? "market-chart-highstock market-chart-highstock--overview"
          : "market-chart-highstock market-chart-highstock--performance",
    },

    /*
     * One timezone source.
     */
    time: {
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

    /*
     * Application buttons select
     * backend datasets.
     */
    rangeSelector: {
      enabled: false,
    },

    /*
     * Navigator is the viewport control.
     * No duplicate scrollbar UI.
     */
    scrollbar: {
      enabled: false,
    },

    navigator: createNavigatorOptions({
      Highcharts,

      enabled: navigatorAllowed && hasData,

      range: normalizedRange,

      data: resolvedNavigatorData,

      direction,

      language,

      timeZone,

      theme,

      layout,

      configuration: navigatorConfiguration,
    }),

    xAxis: {
      ...createXAxisOptions({
        range: normalizedRange,

        language,

        timeZone,

        theme,

        configuration: xAxisConfiguration,

        dateFormats,
      }),

      visible: hasData,
    },

    yAxis: {
      ...createYAxisOptions({
        language,

        theme,

        layout,

        configuration: yAxisConfiguration,

        decimals,

        rtl,
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

        configuration: isPlainObject(tooltip) ? tooltip : {},
      }),

      enabled: hasData && tooltip?.enabled !== false,
    },

    plotOptions: {
      series: {
        animation: resolvedAnimation,

        /*
         * Exact controller-owned data.
         */
        dataGrouping: {
          enabled: false,
        },

        states: {
          inactive: {
            opacity: 1,
          },
        },
      },

      line: {
        marker: {
          enabled: false,
        },
      },

      areaspline: {
        threshold: null,

        marker: {
          enabled: false,
        },
      },

      candlestick: {
        animation: false,

        dataGrouping: {
          enabled: false,
        },

        pointPadding: 0.08,

        groupPadding: 0.04,
      },
    },

    series: [mainSeries],

    accessibility: {
      enabled: accessibilityEnabled !== false,

      description: accessibilityDescription || "",

      landmarkVerbosity: "one",

      keyboardNavigation: {
        enabled: true,

        order: keyboardOrder,
      },

      announceNewData: {
        enabled: false,
      },
    },

    exporting: exportingOptions,

    responsive: createResponsiveOptions(),
  };
}

/* ==========================================================================
   Public Constants
   ========================================================================== */

export { CONTEXT_LAYOUT, DEFAULT_TOOLTIP_DATE_FORMATS, DEFAULT_X_AXIS_FORMATS };
