/* *
 *
 *  Market Chart — Options
 *
 *  Builds the Highstock configuration object for one Market Chart
 *  instance.
 *
 *  Responsibilities
 *  -----------------
 *  - Chart layout.
 *  - Main axes.
 *  - Tooltip.
 *  - Primary series presentation.
 *  - Navigator presentation / geometry.
 *  - Exporting.
 *  - Accessibility.
 *  - Responsive behavior.
 *
 *  Data ownership remains with `MarketChartController` — this module is a
 *  pure function of its inputs and never mutates chart state itself.
 *
 *  Important axis / navigator rules
 *  ---------------------------------
 *  1. The navigator always receives trend / close-price data.
 *  2. The main x-axis and the navigator share one intraday tick model.
 *  3. Historical labels use an equal visual cadence instead of
 *     independent Highcharts auto-tick decisions.
 *  4. Historical edge labels are inset from the plot boundary so rotated
 *     labels are not clipped.
 *  5. The navigator x-axis remains data-driven; live min/max are never
 *     frozen.
 *  6. Navigator labels render inside the mini-chart.
 *  7. Navigator data itself is synchronized manually by the controller.
 *
 * */

"use strict";

import {
  getMarketChartNavigatorTheme,
  getMarketChartSeriesTheme,
  getMarketChartTheme,
} from "./market-chart-theme.js";

import {
  normalizeMarketChartMode,
  normalizeMarketChartRange,
} from "./market-chart-data.js";

/* *
 *
 *  Constants
 *
 * */

const DEFAULT_LANGUAGE = "en";
const DEFAULT_TIME_ZONE = "Asia/Riyadh";
const DEFAULT_DECIMALS = 2;

const DEFAULT_RANGE = "1D";
const INTRADAY_RANGE = "1D";

const DEFAULT_ANIMATION_DURATION = 250;
const MAX_ANIMATION_DURATION = 1_000;

const MINUTE = 60_000;

/* *
 *
 *  Layout
 *
 *  Per-context spacing/geometry. `"overview"` is a compact presentation
 *  (e.g. a dashboard card); `"performance"` is the full detail view.
 *
 * */

const CONTEXT_LAYOUT = Object.freeze({
  overview: Object.freeze({
    spacing: 12,
    bottomSpacing: 18,

    yAxisTickPixelInterval: 52,

    navigatorHeight: 32,
    navigatorMargin: 12,

    navigatorLabels: true,

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

/* *
 *
 *  Date Formats
 *
 *  Per-range `Intl.DateTimeFormat` option sets for axis labels and
 *  tooltips. Callers may override any entry, or provide a `default` entry
 *  to cover ranges not listed here — see {@link getDateFormat}.
 *
 * */

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

/* *
 *
 *  Intraday Tick Intervals
 *
 * */

/**
 * Candidate tick intervals for intraday axes, in milliseconds, in
 * ascending order. {@link chooseIntradayTickInterval} picks the smallest
 * one that keeps labels legibly spaced for the available pixel width.
 *
 * @type {number[]}
 */
const INTRADAY_TICK_INTERVALS = Object.freeze([
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  60 * MINUTE,
  2 * 60 * MINUTE,
]);

const INTRADAY_TARGET_LABEL_PIXEL_GAP = 88;
const MIN_LABEL_PIXEL_GAP = 40;

/* *
 *
 *  Historical Tick Model
 *
 * */

/**
 * Default number of evenly-spaced labels per historical range.
 *
 * @type {Object<string, number>}
 */
const HISTORICAL_TICK_COUNTS = Object.freeze({
  "1W": 6,
  "1M": 6,
  "3M": 6,
  "6M": 6,
  "1Y": 6,
  "5Y": 6,
  ALL: 6,
});

const HISTORICAL_TARGET_LABEL_PIXEL_GAP = 108;

/**
 * Fraction of the visible span reserved as an inset from each edge for
 * historical tick labels, keeping rotated end labels safely inside the
 * plotting area.
 *
 * A ratio (rather than a fixed millisecond duration) so it scales
 * correctly from one-week charts through multi-year charts.
 *
 * @type {number}
 */
const HISTORICAL_EDGE_INSET_RATIO = 0.035;

/* *
 *
 *  Generic Helpers
 *
 * */

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isElement(value) {
  return Boolean(value && value.nodeType === 1 && value.ownerDocument);
}

/**
 * @param {*} value
 * @returns {number|null}
 */
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

/**
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function toNonNegativeNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

/**
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Escapes a value for safe interpolation into the tooltip's HTML string.
 *
 * @param {*} value
 * @returns {string}
 */
function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Resolves a configuration value that may either be a single value shared
 * by every range, or a `{ [range]: value }` map with an optional
 * `default` entry.
 *
 * @param {*} value
 * @param {string} range Already-normalized range key.
 * @param {*} fallback
 * @returns {*}
 */
function resolveRangeValue(value, range, fallback) {
  if (isPlainObject(value)) {
    return value[range] ?? value.default ?? fallback;
  }

  return value ?? fallback;
}

/* *
 *
 *  Context
 *
 * */

/**
 * @param {Element} element
 * @param {*} context
 * @returns {'overview'|'performance'}
 */
function resolveContext(element, context) {
  const value = String(
    context || element?.dataset?.chartContext || "performance",
  )
    .trim()
    .toLowerCase();

  return CONTEXT_LAYOUT[value] ? value : "performance";
}

/* *
 *
 *  Language / Direction
 *
 * */

/**
 * @param {*} language
 * @returns {boolean}
 */
function isArabicLanguage(language) {
  return String(language || DEFAULT_LANGUAGE)
    .toLowerCase()
    .startsWith("ar");
}

/**
 * Resolves text direction from, in priority order: an ancestor `[dir]`
 * attribute, the document's own `dir`, then a language-based guess.
 *
 * @param {Element} element
 * @param {*} language
 * @returns {boolean} `true` for right-to-left.
 */
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

/* *
 *
 *  Motion
 *
 * */

/**
 * @param {Element} element
 * @returns {boolean}
 */
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

/**
 * Normalizes a Highcharts `animation` option, respecting the user's
 * reduced-motion preference and always disabling animation for
 * candlestick mode (candlestick transitions are intentionally
 * non-animated — see `MarketChartController#reconcileMainSeries`).
 *
 * @param {boolean|number|object} animation
 * @param {object} [options]
 * @param {Element} [options.element]
 * @param {string} [options.mode='trend']
 * @returns {false|{duration: number, easing?: string}}
 */
function normalizeMarketChartAnimation(
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

/* *
 *
 *  Number Formatting
 *
 * */

/**
 * @param {object} options
 * @param {string} options.language
 * @param {number} [options.decimals=DEFAULT_DECIMALS]
 * @param {boolean} [options.useGrouping=true]
 * @returns {(value: *) => string} Formats a value, or returns `"—"` for non-finite input.
 */
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

/* *
 *
 *  Date Formatting
 *
 * */

/**
 * @param {string} range Already-normalized range key.
 * @param {*} customFormats Caller-supplied override map.
 * @param {*} defaults Built-in default map.
 * @returns {object} `Intl.DateTimeFormat` options.
 */
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

/**
 * @param {object} options
 * @param {string} options.language
 * @param {string} options.timeZone
 * @param {object} options.options `Intl.DateTimeFormat` options.
 * @returns {(timestamp: *) => string} Formats a timestamp, or returns `""` for invalid input.
 */
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

/* *
 *
 *  Shared Intraday Tick Model
 *
 *  The main x-axis and the navigator must not independently decide
 *  intraday tick timestamps — both consume this exact model so their
 *  labels always agree.
 *
 *  Highstock still owns: live dataMin/dataMax, scale translation,
 *  zooming, navigator drag, and drawing. This code controls only which
 *  timestamps become labels.
 *
 * */

/**
 * Prefers `chart.plotWidth` over the axis's own `len`, since the
 * navigator axis's `len` can differ slightly from the primary x-axis
 * (navigator handles / internal margins). Using one common reference
 * width makes both axes select the same interval.
 *
 * @param {Highcharts.Axis} axis
 * @returns {number}
 */
function getSharedIntradayAxisLength(axis) {
  const plotWidth = toFiniteNumber(axis?.chart?.plotWidth);

  const axisLength = toFiniteNumber(axis?.len);

  return Math.max(1, plotWidth ?? axisLength ?? 1);
}

/**
 * @param {number} span Visible span, in milliseconds.
 * @param {number} pixelLength Available pixel width.
 * @param {*} configuredInterval Explicit override, if any.
 * @param {number} [targetPixelGap=INTRADAY_TARGET_LABEL_PIXEL_GAP]
 * @returns {number} The chosen tick interval, in milliseconds.
 */
function chooseIntradayTickInterval(
  span,
  pixelLength,
  configuredInterval,
  targetPixelGap = INTRADAY_TARGET_LABEL_PIXEL_GAP,
) {
  const explicit = toFiniteNumber(configuredInterval);

  if (explicit !== null && explicit > 0) {
    return explicit;
  }

  const width = Math.max(1, toFiniteNumber(pixelLength) ?? 1);

  const preferredGap = Math.max(
    40,
    toFiniteNumber(targetPixelGap) ?? INTRADAY_TARGET_LABEL_PIXEL_GAP,
  );

  const targetTicks = clamp(Math.floor(width / preferredGap) + 1, 3, 9);

  const desired = span / Math.max(1, targetTicks - 1);

  return (
    INTRADAY_TICK_INTERVALS.find((interval) => interval >= desired) ||
    INTRADAY_TICK_INTERVALS[INTRADAY_TICK_INTERVALS.length - 1]
  );
}

/**
 * Builds clean market-time tick positions (e.g. 10:00, 10:05, 10:10, ...)
 * for an intraday axis.
 *
 * @param {object} options
 * @param {number} options.minimum
 * @param {number} options.maximum
 * @param {number} options.pixelLength
 * @param {number|null} [options.tickInterval=null]
 * @param {number} [options.targetPixelGap=INTRADAY_TARGET_LABEL_PIXEL_GAP]
 * @param {number} [options.minimumLabelPixelGap=MIN_LABEL_PIXEL_GAP]
 * @returns {number[]|undefined}
 */
function buildIntradayTickPositions({
  minimum,
  maximum,
  pixelLength,

  tickInterval = null,

  targetPixelGap = INTRADAY_TARGET_LABEL_PIXEL_GAP,

  minimumLabelPixelGap = MIN_LABEL_PIXEL_GAP,
}) {
  const min = toFiniteNumber(minimum);

  const max = toFiniteNumber(maximum);

  const width = Math.max(1, toFiniteNumber(pixelLength) ?? 1);

  if (min === null || max === null || max < min) {
    return undefined;
  }

  if (max === min) {
    return [min];
  }

  const span = max - min;

  const interval = chooseIntradayTickInterval(
    span,
    width,
    tickInterval,
    targetPixelGap,
  );

  const millisecondsPerPixel = span / width;

  const minimumGap = Math.max(
    1_000,

    Math.max(0, toFiniteNumber(minimumLabelPixelGap) ?? MIN_LABEL_PIXEL_GAP) *
      millisecondsPerPixel,
  );

  const positions = [];

  let tick = Math.ceil(min / interval) * interval;

  const epsilon = Math.min(1_000, interval * 1e-9);

  while (tick <= max + epsilon) {
    if (
      !positions.length ||
      tick - positions[positions.length - 1] >= minimumGap
    ) {
      positions.push(tick);
    }

    tick += interval;
  }

  return positions.length ? positions : [min];
}

/**
 * Highcharts `xAxis.tickPositioner` factory for intraday axes. Bound as
 * `this` to the axis by Highcharts at call time.
 *
 * @param {object} [configuration]
 * @returns {function(this: Highcharts.Axis): (number[]|undefined)}
 */
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

    return buildIntradayTickPositions({
      minimum,
      maximum,

      pixelLength: getSharedIntradayAxisLength(this),

      tickInterval: configuration.tickInterval,

      targetPixelGap: configuration.intradayTickPixelGap,

      minimumLabelPixelGap: configuration.minimumLabelPixelGap,
    });
  };
}

/* *
 *
 *  Shared Historical Tick Model
 *
 *  Historical axes use a deliberately even label cadence. Highcharts'
 *  automatic datetime ticks are calendar-correct, but when the available
 *  series contains trading-day gaps or downsampled timestamps the
 *  resulting labels can look visually irregular. For this component we
 *  want the labels themselves to read as one calm, evenly distributed
 *  scale. Data remains timestamp-based; only label/tick placement is
 *  controlled here.
 *
 * */

/**
 * @param {*} configuredCount
 * @param {number} pixelLength
 * @param {number} [targetPixelGap=HISTORICAL_TARGET_LABEL_PIXEL_GAP]
 * @returns {number}
 */
function chooseHistoricalTickCount(
  configuredCount,
  pixelLength,
  targetPixelGap = HISTORICAL_TARGET_LABEL_PIXEL_GAP,
) {
  const requested = Math.max(
    2,
    Math.round(toFiniteNumber(configuredCount) ?? 6),
  );

  const width = Math.max(1, toFiniteNumber(pixelLength) ?? 1);

  const gap = Math.max(
    72,
    toFiniteNumber(targetPixelGap) ?? HISTORICAL_TARGET_LABEL_PIXEL_GAP,
  );

  const capacity = Math.max(2, Math.floor(width / gap) + 1);

  return Math.min(requested, capacity);
}

/**
 * Builds evenly-spaced, edge-inset tick positions for a historical axis.
 *
 * @param {object} options
 * @param {number} options.minimum
 * @param {number} options.maximum
 * @param {number} options.pixelLength
 * @param {number} [options.tickCount=6]
 * @param {number} [options.targetPixelGap=HISTORICAL_TARGET_LABEL_PIXEL_GAP]
 * @param {number} [options.edgeInsetRatio=HISTORICAL_EDGE_INSET_RATIO]
 * @returns {number[]|undefined}
 */
function buildHistoricalTickPositions({
  minimum,
  maximum,
  pixelLength,

  tickCount = 6,

  targetPixelGap = HISTORICAL_TARGET_LABEL_PIXEL_GAP,

  edgeInsetRatio = HISTORICAL_EDGE_INSET_RATIO,
}) {
  const min = toFiniteNumber(minimum);

  const max = toFiniteNumber(maximum);

  if (min === null || max === null || max < min) {
    return undefined;
  }

  if (max === min) {
    return [min];
  }

  const count = chooseHistoricalTickCount(
    tickCount,
    pixelLength,
    targetPixelGap,
  );

  const span = max - min;

  const insetRatio = clamp(
    toFiniteNumber(edgeInsetRatio) ?? HISTORICAL_EDGE_INSET_RATIO,
    0,
    0.1,
  );

  // Inset the first/last labels from the exact plot edges. This
  // prevents rotated historical labels (e.g. "04 Sat") from being
  // clipped, while preserving a mathematically even cadence.
  const inset = Math.min(span * insetRatio, span * 0.2);

  const start = min + inset;
  const end = max - inset;

  if (end <= start || count <= 2) {
    return [start, end].filter(
      (value, index, values) => index === 0 || value > values[index - 1],
    );
  }

  const step = (end - start) / (count - 1);

  const positions = [];

  for (let index = 0; index < count; index += 1) {
    positions.push(start + step * index);
  }

  return positions;
}

/**
 * Highcharts `xAxis.tickPositioner` factory for historical axes.
 *
 * @param {object} [configuration]
 * @returns {function(this: Highcharts.Axis): (number[]|undefined)}
 */
function createHistoricalTickPositioner(configuration = {}) {
  return function historicalTickPositioner() {
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

    return buildHistoricalTickPositions({
      minimum,
      maximum,

      pixelLength: getSharedIntradayAxisLength(this),

      tickCount: configuration.tickCount,

      targetPixelGap: configuration.targetPixelGap,

      edgeInsetRatio: configuration.edgeInsetRatio,
    });
  };
}

/* *
 *
 *  Main X Axis
 *
 * */

/**
 * @param {object} options
 * @returns {Highcharts.XAxisOptions}
 * @private
 */
function createXAxisOptions({
  range,
  language,
  timeZone,
  theme,

  configuration = {},
  dateFormats = {},
  intradayTicks = {},
  historicalTicks = {},
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

  const historicalTickCount = resolveRangeValue(
    configuration.historicalTickCount,
    normalizedRange,
    historicalTicks.tickCount ?? HISTORICAL_TICK_COUNTS[normalizedRange] ?? 6,
  );

  const historicalTargetPixelGap = resolveRangeValue(
    configuration.historicalTickPixelGap,
    normalizedRange,
    historicalTicks.targetPixelGap ?? HISTORICAL_TARGET_LABEL_PIXEL_GAP,
  );

  const historicalEdgeInsetRatio = resolveRangeValue(
    configuration.historicalEdgeInsetRatio,
    normalizedRange,
    historicalTicks.edgeInsetRatio ?? HISTORICAL_EDGE_INSET_RATIO,
  );

  const minPadding = toNonNegativeNumber(
    resolveRangeValue(configuration.minPadding, normalizedRange, 0),
    0,
  );

  const maxPadding = toNonNegativeNumber(
    resolveRangeValue(configuration.maxPadding, normalizedRange, 0),
    0,
  );

  return {
    type: "datetime",

    // Keep true timestamp geometry by default for both intraday and
    // historical ranges. Consumers can explicitly opt into ordinal
    // compression if a particular chart needs it.
    ordinal: configuration.ordinal ?? false,

    minPadding,

    maxPadding,

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
      configuration.tickPositioner === false
        ? undefined
        : intraday
          ? createIntradayTickPositioner({
              ...intradayTicks,

              tickInterval:
                configuration.tickInterval ?? intradayTicks.tickInterval,

              intradayTickPixelGap:
                configuration.intradayTickPixelGap ??
                intradayTicks.intradayTickPixelGap,

              minimumLabelPixelGap:
                configuration.minimumLabelPixelGap ??
                intradayTicks.minimumLabelPixelGap,
            })
          : createHistoricalTickPositioner({
              tickCount: historicalTickCount,

              targetPixelGap: historicalTargetPixelGap,

              edgeInsetRatio: historicalEdgeInsetRatio,
            }),

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

      // Historical labels are already edge-inset by the tick
      // positioner. Allow the full text to render rather than
      // Highcharts shortening the first/last rotated label.
      overflow: intraday ? "justify" : "allow",

      crop: intraday,

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

/* *
 *
 *  Y Axis
 *
 * */

/**
 * @param {object} options
 * @returns {Highcharts.YAxisOptions}
 * @private
 */
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

      margin: toNonNegativeNumber(configuration.titleMargin, 18),

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

/* *
 *
 *  Tooltip Helpers
 *
 * */

/**
 * @param {*} language
 * @returns {{value: string, open: string, high: string, low: string, close: string}}
 */
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

/**
 * @param {Highcharts.Point} point
 * @param {'trend'|'line'|'candlestick'} mode
 * @returns {object|null}
 */
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

/* *
 *
 *  Tooltip Options
 *
 * */

/**
 * @param {object} options
 * @returns {Highcharts.TooltipOptions}
 * @private
 */
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

    // Tooltip movement stays independent of chart series animation.
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

      const values = getTooltipValues(point, normalizedMode);

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
            class="
              market-chart-tooltip__change
              market-chart-tooltip__change--${direction}
            "
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

/* *
 *
 *  Main Series
 *
 * */

/**
 * @param {object} options
 * @returns {Highcharts.SeriesOptionsType}
 * @private
 */
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

    // Navigator owns a dedicated trend series.
    showInNavigator: false,

    // Controller owns exact point resolution.
    dataGrouping: {
      enabled: false,
    },

    ...seriesTheme,
  };
}

/* *
 *
 *  Navigator
 *
 * */

/**
 * @param {object} options
 * @returns {Highcharts.NavigatorOptions}
 * @private
 */
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

  dateFormats = {},

  intradayTicks = {},
  historicalTicks = {},

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

  const navigatorDateFormats = isPlainObject(configuration.formats)
    ? configuration.formats
    : dateFormats;

  const formatDate = createDateFormatter({
    language,
    timeZone,

    options: getDateFormat(
      normalizedRange,
      navigatorDateFormats,
      DEFAULT_X_AXIS_FORMATS,
    ),
  });

  const labelsEnabled =
    configuration.labels === true ||
    (configuration.labels !== false && layout.navigatorLabels === true);

  /* ----------------------------------------------------------------
   * Historical Tick Configuration
   * ---------------------------------------------------------------- */

  const historicalTickCount = resolveRangeValue(
    configuration.historicalTickCount,
    normalizedRange,
    historicalTicks.tickCount ?? HISTORICAL_TICK_COUNTS[normalizedRange] ?? 6,
  );

  const historicalTargetPixelGap = resolveRangeValue(
    configuration.historicalTickPixelGap,
    normalizedRange,
    historicalTicks.targetPixelGap ?? HISTORICAL_TARGET_LABEL_PIXEL_GAP,
  );

  const historicalEdgeInsetRatio = resolveRangeValue(
    configuration.historicalEdgeInsetRatio,
    normalizedRange,
    historicalTicks.edgeInsetRatio ?? HISTORICAL_EDGE_INSET_RATIO,
  );

  return {
    enabled: true,

    // MarketChartController explicitly owns navigator data
    // synchronization, so Highstock is not asked to mirror the
    // primary series automatically.
    adaptToUpdatedData: false,

    // MarketChartController owns follow-latest behavior for the
    // primary viewport.
    stickToMax: false,

    height: toNonNegativeNumber(configuration.height, layout.navigatorHeight),

    margin: toNonNegativeNumber(configuration.margin, layout.navigatorMargin),

    maskInside: configuration.maskInside !== false,

    maskFill: navigatorTheme.maskFill,

    outlineWidth: toNonNegativeNumber(configuration.outlineWidth, 1),

    outlineColor: configuration.outlineColor || navigatorTheme.outlineColor,

    /* ------------------------------------------------------------
     * Handles
     * ------------------------------------------------------------ */

    handles: {
      enabled: configuration.handles !== false,

      width: toNonNegativeNumber(configuration.handleWidth, 7),

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

    /* ------------------------------------------------------------
     * Navigator X Axis
     *
     * IMPORTANT: no hard min/max here. The navigator series is
     * updated directly by MarketChartController. Leaving the axis
     * data-driven lets Highstock recalculate its dataMin/dataMax
     * naturally after a live append, a same-timestamp replacement,
     * a hidden-tab catch-up batch, a complete range replacement, or
     * a structural refresh — avoiding stale navigator time domains
     * and extra per-tick Axis.update()/setExtremes()/redraw calls.
     * ------------------------------------------------------------ */

    xAxis: {
      type: "datetime",

      // Preserve true elapsed-time geometry.
      ordinal: configuration.ordinal ?? false,

      overscroll: 0,

      minPadding: 0,

      maxPadding: 0,

      startOnTick: false,

      endOnTick: false,

      offset: 0,

      lineWidth: 0,

      tickWidth: 0,

      tickLength: 0,

      gridLineWidth: 0,

      tickPixelInterval: toNonNegativeNumber(
        configuration.tickPixelInterval,
        layout.navigatorTickPixelInterval,
      ),

      // Main axis and navigator use the same timestamp-selection
      // contract.
      tickPositioner:
        configuration.tickPositioner === false
          ? undefined
          : intraday
            ? createIntradayTickPositioner(intradayTicks)
            : createHistoricalTickPositioner({
                tickCount: historicalTickCount,

                targetPixelGap: historicalTargetPixelGap,

                edgeInsetRatio: historicalEdgeInsetRatio,
              }),

      labels: {
        enabled: labelsEnabled,

        // Keep labels inside the navigator instead of reserving
        // another row underneath it.
        inside: true,

        reserveSpace: false,

        rotation: 0,

        align: "center",

        y: Number.isFinite(Number(configuration.labelY))
          ? Number(configuration.labelY)
          : -5,

        x: Number.isFinite(Number(configuration.labelX))
          ? Number(configuration.labelX)
          : 0,

        // Historical ticks already include edge-safe
        // positioning.
        overflow: intraday ? "justify" : "allow",

        crop: intraday,

        style: {
          color: theme.muted,

          fontSize: "10px",

          textOutline: "none",

          pointerEvents: "none",

          textOverflow: "none",

          ...(isPlainObject(configuration.labelStyle)
            ? configuration.labelStyle
            : {}),
        },

        formatter() {
          return formatDate(this.value);
        },
      },

      showFirstLabel: configuration.showFirstLabel !== false,

      showLastLabel: configuration.showLastLabel !== false,
    },

    /* ------------------------------------------------------------
     * Navigator Y Axis
     * ------------------------------------------------------------ */

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

    /* ------------------------------------------------------------
     * Dedicated Navigator Series
     *
     * Always trend / close-price data, even when the primary chart
     * is candlestick — the navigator remains a lightweight trend
     * representation regardless of the main series' mode.
     * ------------------------------------------------------------ */

    series: {
      id: "market-chart-navigator-series",

      name: "Navigator",

      type: "areaspline",

      data,

      // Never animate live navigator updates.
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

      // Controller owns exact data resolution.
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

/* *
 *
 *  Exporting
 *
 * */

/**
 * @param {object} [exporting]
 * @returns {Highcharts.ExportingOptions}
 * @private
 */
function createExportingOptions(exporting = {}) {
  const configuration = isPlainObject(exporting) ? exporting : {};

  const enabled = configuration.enabled === true;

  const showContextButton = enabled && configuration.showContextButton === true;

  return {
    enabled,

    filename: configuration.filename || "market-chart",

    fallbackToExportServer: configuration.fallbackToExportServer ?? false,

    sourceWidth: toNonNegativeNumber(configuration.sourceWidth, 1_200),

    sourceHeight: toNonNegativeNumber(configuration.sourceHeight, 675),

    scale: toNonNegativeNumber(configuration.scale, 2),

    printMaxWidth: toNonNegativeNumber(configuration.printMaxWidth, 1_200),

    buttons: {
      contextButton: {
        enabled: showContextButton,
      },
    },
  };
}

/* *
 *
 *  Responsive
 *
 * */

/**
 * @returns {Highcharts.ResponsiveOptions}
 * @private
 */
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
                inside: true,

                reserveSpace: false,

                y: -5,

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

              labels: {
                inside: true,

                reserveSpace: false,

                y: -4,
              },
            },
          },
        },
      },
    ],
  };
}

/* *
 *
 *  Factory
 *
 * */

/**
 * Builds a complete Highstock configuration object for one Market Chart
 * instance. Pure function of its inputs — creates no chart, touches no
 * DOM beyond reading theme/context/direction from `element`.
 *
 * @param {object} options
 * @param {typeof Highcharts} options.Highcharts Highstock namespace (must expose `stockChart`).
 * @param {Element} options.element Chart host element.
 * @param {string} [options.context] `"overview"` or `"performance"`; inferred from `element.dataset.chartContext` when omitted.
 * @param {object} [options.capabilities]
 * @param {'trend'|'line'|'candlestick'} [options.mode='trend']
 * @param {string} [options.range='1D']
 * @param {'up'|'down'|'neutral'} [options.direction='neutral']
 * @param {string} [options.symbol='TASI']
 * @param {string} [options.seriesName]
 * @param {string} [options.currency='']
 * @param {number|null} [options.previousClose=null]
 * @param {Array} [options.data=[]] Points for the currently selected range/mode.
 * @param {Array} [options.navigatorData=[]] Trend/close-price points for the navigator (always trend data, regardless of `mode`).
 * @param {string} [options.language]
 * @param {string} [options.timeZone='Asia/Riyadh']
 * @param {number} [options.decimals=2]
 * @param {*} [options.xAxisTitle]
 * @param {*} [options.yAxisTitle]
 * @param {object} [options.axis] `{ x, y }` shared configuration, overridden by `xAxis`/`yAxis`.
 * @param {object} [options.xAxis]
 * @param {object} [options.yAxis]
 * @param {object} [options.dateFormats]
 * @param {object} [options.tooltipDateFormats]
 * @param {object} [options.tooltip]
 * @param {boolean|null} [options.navigatorEnabled]
 * @param {object} [options.navigator]
 * @param {object} [options.exporting]
 * @param {boolean|number|object} [options.animation=true]
 * @param {boolean} [options.accessibilityEnabled=true]
 * @param {string} [options.accessibilityDescription]
 * @returns {object} A complete Highstock options object suitable for `Highcharts.stockChart()`.
 * @throws {TypeError} If `Highcharts` is not a valid Highstock namespace, or `element` is not a DOM element.
 */
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

  // Trend / close-price data for the current range. The navigator
  // always consumes this array regardless of the primary mode.
  navigatorData = [],

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
  /* ------------------------------------------------------------------
   * Validation
   * ------------------------------------------------------------------ */

  if (!Highcharts || typeof Highcharts.stockChart !== "function") {
    throw new TypeError("createMarketChartOptions() requires Highstock.");
  }

  if (!isElement(element)) {
    throw new TypeError(
      "createMarketChartOptions() requires a valid chart element.",
    );
  }

  /* ------------------------------------------------------------------
   * Normalized State
   * ------------------------------------------------------------------ */

  const normalizedMode = normalizeMarketChartMode(mode);

  const normalizedRange = normalizeMarketChartRange(range);

  const hasData = Array.isArray(data) && data.length > 0;

  /* ------------------------------------------------------------------
   * Context / Theme
   * ------------------------------------------------------------------ */

  const resolvedContext = resolveContext(element, context);

  const layout = CONTEXT_LAYOUT[resolvedContext];

  const rtl = resolveRTL(element, language);

  const theme = getMarketChartTheme(element);

  /* ------------------------------------------------------------------
   * Series Theme
   * ------------------------------------------------------------------ */

  const seriesTheme = getMarketChartSeriesTheme(
    Highcharts,
    theme,
    normalizedMode,
    direction,
  );

  /* ------------------------------------------------------------------
   * Animation
   * ------------------------------------------------------------------ */

  const resolvedAnimation = normalizeMarketChartAnimation(animation, {
    element,

    mode: normalizedMode,
  });

  /* ------------------------------------------------------------------
   * Axis Configuration
   * ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------
   * Shared Intraday Tick Contract
   * ------------------------------------------------------------------ */

  const intradayTicks = {
    tickInterval: xAxisConfiguration.tickInterval ?? null,

    intradayTickPixelGap:
      xAxisConfiguration.intradayTickPixelGap ??
      INTRADAY_TARGET_LABEL_PIXEL_GAP,

    minimumLabelPixelGap:
      xAxisConfiguration.minimumLabelPixelGap ?? MIN_LABEL_PIXEL_GAP,
  };

  /* ------------------------------------------------------------------
   * Shared Historical Tick Contract
   *
   * The primary x-axis configuration is authoritative; the navigator
   * receives the same historical cadence contract.
   * ------------------------------------------------------------------ */

  const historicalTicks = {
    tickCount: resolveRangeValue(
      xAxisConfiguration.historicalTickCount,
      normalizedRange,
      HISTORICAL_TICK_COUNTS[normalizedRange] ?? 6,
    ),

    targetPixelGap: resolveRangeValue(
      xAxisConfiguration.historicalTickPixelGap,
      normalizedRange,
      HISTORICAL_TARGET_LABEL_PIXEL_GAP,
    ),

    edgeInsetRatio: resolveRangeValue(
      xAxisConfiguration.historicalEdgeInsetRatio,
      normalizedRange,
      HISTORICAL_EDGE_INSET_RATIO,
    ),
  };

  /* ------------------------------------------------------------------
   * Navigator
   * ------------------------------------------------------------------ */

  const navigatorConfiguration = isPlainObject(navigator) ? navigator : {};

  const navigatorAllowed =
    capabilities?.navigator !== false &&
    navigatorEnabled !== false &&
    navigatorConfiguration.enabled !== false;

  /* ------------------------------------------------------------------
   * Exporting
   * ------------------------------------------------------------------ */

  const exportingOptions = createExportingOptions(exporting);

  const nativeChartMenuEnabled =
    exportingOptions.buttons.contextButton.enabled === true;

  /* ------------------------------------------------------------------
   * Main Series
   * ------------------------------------------------------------------ */

  const mainSeries = createMainSeries({
    mode: normalizedMode,

    symbol,
    seriesName,

    data,

    seriesTheme,

    animation: resolvedAnimation,
  });

  /* ------------------------------------------------------------------
   * Accessibility
   * ------------------------------------------------------------------ */

  const keyboardOrder = [
    "series",

    ...(navigatorAllowed && hasData ? ["navigator"] : []),

    ...(nativeChartMenuEnabled ? ["chartMenu"] : []),

    "zoom",
  ];

  const arabic = isArabicLanguage(language);

  /* ====================================================================
   * Highstock Options
   * ==================================================================== */

  return {
    /* ----------------------------------------------------------------
     * Chart
     * ---------------------------------------------------------------- */

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

    /* ----------------------------------------------------------------
     * Time
     * ---------------------------------------------------------------- */

    time: {
      timezone: timeZone || DEFAULT_TIME_ZONE,
    },

    /* ----------------------------------------------------------------
     * Language
     * ---------------------------------------------------------------- */

    lang: {
      noData: arabic ? "لا تتوفر بيانات للسوق." : "No market data available.",

      loading: arabic ? "جارٍ تحميل بيانات السوق…" : "Loading market data…",

      resetZoom: arabic ? "إعادة ضبط التكبير" : "Reset zoom",

      resetZoomTitle: arabic
        ? "إعادة ضبط مستوى تكبير الرسم البياني"
        : "Reset chart zoom",
    },

    /* ----------------------------------------------------------------
     * Native Highcharts Decoration
     * ---------------------------------------------------------------- */

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

    // Application controls own backend range selection.
    rangeSelector: {
      enabled: false,
    },

    // Navigator is the viewport controller.
    scrollbar: {
      enabled: false,
    },

    /* ----------------------------------------------------------------
     * Navigator
     * ---------------------------------------------------------------- */

    navigator: createNavigatorOptions({
      Highcharts,

      enabled: navigatorAllowed && hasData,

      range: normalizedRange,

      data: navigatorData,

      direction,

      language,
      timeZone,

      theme,
      layout,

      dateFormats,

      intradayTicks,
      historicalTicks,

      configuration: navigatorConfiguration,
    }),

    /* ----------------------------------------------------------------
     * Main X Axis
     * ---------------------------------------------------------------- */

    xAxis: {
      ...createXAxisOptions({
        range: normalizedRange,

        language,
        timeZone,

        theme,

        configuration: xAxisConfiguration,

        dateFormats,

        intradayTicks,
        historicalTicks,
      }),

      visible: hasData,
    },

    /* ----------------------------------------------------------------
     * Main Y Axis
     * ---------------------------------------------------------------- */

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

    /* ----------------------------------------------------------------
     * Tooltip
     * ---------------------------------------------------------------- */

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

    /* ----------------------------------------------------------------
     * Plot Options
     * ---------------------------------------------------------------- */

    plotOptions: {
      series: {
        animation: resolvedAnimation,

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
        // Candlestick transitions intentionally remain
        // non-animated.
        animation: false,

        dataGrouping: {
          enabled: false,
        },

        pointPadding: 0.08,

        groupPadding: 0.04,
      },
    },

    /* ----------------------------------------------------------------
     * Main Series
     * ---------------------------------------------------------------- */

    series: [mainSeries],

    /* ----------------------------------------------------------------
     * Accessibility
     * ---------------------------------------------------------------- */

    accessibility: {
      enabled: accessibilityEnabled !== false,

      description: accessibilityDescription || "",

      landmarkVerbosity: "one",

      keyboardNavigation: {
        enabled: true,

        order: keyboardOrder,
      },

      // Application status UI owns live-market announcements.
      announceNewData: {
        enabled: false,
      },
    },

    /* ----------------------------------------------------------------
     * Exporting
     * ---------------------------------------------------------------- */

    exporting: exportingOptions,

    /* ----------------------------------------------------------------
     * Responsive
     * ---------------------------------------------------------------- */

    responsive: createResponsiveOptions(),
  };
}

/* *
 *
 *  Default Export
 *
 * */

const MarketChartOptions = {
  CONTEXT_LAYOUT,
  DEFAULT_TOOLTIP_DATE_FORMATS,
  DEFAULT_X_AXIS_FORMATS,
  normalizeMarketChartAnimation,
  createMarketChartOptions,
};

export default MarketChartOptions;

/* *
 *
 *  Named Exports
 *
 * */

export {
  CONTEXT_LAYOUT,
  DEFAULT_TOOLTIP_DATE_FORMATS,
  DEFAULT_X_AXIS_FORMATS,
  normalizeMarketChartAnimation,
};
