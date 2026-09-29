import {
  DEFAULT_CAPABILITIES,
  isMarketChartIntradayRange,
  normalizeMarketChartMode,
  normalizeMarketChartRange,
} from "./market-chart-data.js";

import { getMarketChartStrings, isRTLLanguage } from "./market-chart-i18n.js";

import {
  getMarketChartNavigatorTheme,
  getMarketChartSeriesTheme,
  getMarketChartTheme,
} from "./market-chart-theme.js";

import {
  DEFAULT_LANGUAGE,
  DEFAULT_TIME_ZONE,
  MINUTE,
  NAVIGATOR_SERIES_ID,
  asPlainObject,
  clamp,
  createDateTimeFormat,
  createNumberFormat,
  escapeHTML,
  getMainSeriesId,
  isElement,
  isPlainObject,
  toFiniteNumber,
  toNonNegativeNumber,
} from "./market-chart-utils.js";

/* ==========================================================================
   Market Chart Options
   ==========================================================================

   Builds the complete Highstock configuration object. Pure: it reads theme
   tokens from the host element but never mutates chart state. Data
   ownership stays in the controller.

   Axis / navigator rules:

   1. The navigator always receives trend / close-price data.
   2. Main x-axis and navigator share one tick model per range type, so
      their labels always agree.
   3. Intraday ticks sit on clean market-time boundaries (10:00, 10:15, …).
      When the session starts just after a boundary (first bar at 10:00:30
      or 10:01), that boundary is labelled at the axis edge so the session
      start is never left unlabelled.
   4. Historical ticks are evenly spaced by data index and always sit on
      real market timestamps (never on non-trading days).
   5. Navigator x-axis stays data-driven; min/max are never frozen.
   6. Navigator labels render inside the mini-chart.
   7. First / last axis labels are nudged inside the chart container after
      each render instead of being ellipsized or clipped.
   8. The controller owns resizing (ResizeObserver), so Highcharts' own
      reflow is disabled.
   ========================================================================== */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_DECIMALS = 2;

const DEFAULT_ANIMATION_DURATION = 250;
const MAX_ANIMATION_DURATION = 1_000;

/*
 * Minimum distance (px) between an edge label and the container border.
 */
const EDGE_LABEL_GUTTER = 4;

/* ==========================================================================
   Layout
   ========================================================================== */

export const CONTEXT_LAYOUT = Object.freeze({
  overview: Object.freeze({
    spacing: 12,
    bottomSpacing: 18,
    yAxisTickPixelInterval: 52,
    navigatorHeight: 32,
    navigatorMargin: 12,
    navigatorLabels: true,
  }),

  performance: Object.freeze({
    spacing: 16,
    bottomSpacing: 24,
    yAxisTickPixelInterval: 56,
    navigatorHeight: 40,
    navigatorMargin: 14,
    navigatorLabels: true,
  }),
});

const DEFAULT_CONTEXT = "performance";

/* ==========================================================================
   Date Formats
   ========================================================================== */

/*
 * The "1D" entries are the intraday formats. They apply to whichever range
 * is configured as intraday (capabilities.intradayRange).
 */
export const DEFAULT_X_AXIS_FORMATS = Object.freeze({
  "1D": Object.freeze({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  "1W": Object.freeze({ weekday: "short", day: "2-digit" }),
  "1M": Object.freeze({ day: "2-digit", month: "short" }),
  "3M": Object.freeze({ day: "2-digit", month: "short" }),
  "6M": Object.freeze({ month: "short", year: "2-digit" }),
  YTD: Object.freeze({ day: "2-digit", month: "short" }),
  "1Y": Object.freeze({ month: "short", year: "numeric" }),
  "3Y": Object.freeze({ month: "short", year: "numeric" }),
  "5Y": Object.freeze({ year: "numeric" }),
  "10Y": Object.freeze({ year: "numeric" }),
  ALL: Object.freeze({ year: "numeric" }),
  default: Object.freeze({ year: "numeric" }),
});

export const DEFAULT_TOOLTIP_DATE_FORMATS = Object.freeze({
  "1D": Object.freeze({
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }),
  default: Object.freeze({ day: "2-digit", month: "short", year: "numeric" }),
});

/* ==========================================================================
   Tick Models
   ========================================================================== */

const INTRADAY_TICK_INTERVALS = Object.freeze([
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  60 * MINUTE,
  120 * MINUTE,
]);

const INTRADAY_TARGET_LABEL_PIXEL_GAP = 88;
const MIN_LABEL_PIXEL_GAP = 40;

/*
 * A boundary is labelled at the axis edge only when the visible start is
 * this close after it (and within a quarter of the tick interval). Further
 * away, relabelling the edge would misstate the session start.
 */
const INTRADAY_EDGE_SNAP_MAX = 5 * MINUTE;

const HISTORICAL_TICK_COUNT = 6;
const HISTORICAL_TARGET_LABEL_PIXEL_GAP = 108;
const HISTORICAL_MIN_LABEL_PIXEL_GAP = 72;

/*
 * Axis property holding tick-position -> displayed-time overrides, written
 * by the tick positioners and read by the label formatters.
 */
const TICK_LABELS_KEY = "marketChartTickLabels";

/* ==========================================================================
   Helpers
   ========================================================================== */

function resolveRangeValue(value, range, fallback) {
  if (isPlainObject(value)) {
    return value[range] ?? value.default ?? fallback;
  }

  return value ?? fallback;
}

function resolveContext(element, context) {
  const value = String(
    context || element?.dataset?.chartContext || DEFAULT_CONTEXT,
  )
    .trim()
    .toLowerCase();

  return Object.hasOwn(CONTEXT_LAYOUT, value) ? value : DEFAULT_CONTEXT;
}

/**
 * DOM direction wins; language is only a fallback.
 */
function resolveRTL(element, language) {
  const direction =
    element?.closest?.("[dir]")?.getAttribute("dir") ||
    element?.ownerDocument?.documentElement?.dir;

  if (direction === "rtl" || direction === "ltr") {
    return direction === "rtl";
  }

  return isRTLLanguage(language);
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

/**
 * Resolves the effective animation setting.
 *
 * Disabled for candlesticks and when the user prefers reduced motion.
 *
 * @returns {false | { duration: number, easing?: string }}
 */
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

  const source = isPlainObject(animation) ? animation : {};

  const requested = typeof animation === "number" ? animation : source.duration;

  const duration = clamp(
    toNonNegativeNumber(requested, DEFAULT_ANIMATION_DURATION),
    0,
    MAX_ANIMATION_DURATION,
  );

  if (!duration) {
    return false;
  }

  return source.easing ? { duration, easing: source.easing } : { duration };
}

/* ==========================================================================
   Formatting
   ========================================================================== */

function createNumberFormatter({
  language,
  decimals = DEFAULT_DECIMALS,
  useGrouping = true,
}) {
  const precision = clamp(
    Math.trunc(toFiniteNumber(decimals) ?? DEFAULT_DECIMALS),
    0,
    8,
  );

  const format = createNumberFormat(language, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    useGrouping,
  });

  return (value) => {
    const number = toFiniteNumber(value);

    return number === null ? "—" : format.format(number);
  };
}

/**
 * Picks a date format: custom per-range -> custom default -> built-in
 * per-range -> built-in intraday (for the intraday range) -> built-in
 * default.
 */
function getDateFormat({ range, intraday, custom, defaults }) {
  return (
    custom?.[range] ||
    custom?.default ||
    defaults[range] ||
    (intraday ? defaults["1D"] : null) ||
    defaults.default
  );
}

function createDateFormatter({ language, timeZone, options }) {
  const format = createDateTimeFormat(language, timeZone, options);

  return (timestamp) => {
    const value = toFiniteNumber(timestamp);

    return value === null ? "" : format.format(new Date(value));
  };
}

/**
 * Axis label formatter shared by the main x-axis and the navigator: shows
 * the tick's time, or its override (session-edge boundary) when present.
 */
function createAxisLabelFormatter(formatDate) {
  return function formatAxisLabel() {
    return formatDate(
      this.axis?.[TICK_LABELS_KEY]?.get(this.value) ?? this.value,
    );
  };
}

/* ==========================================================================
   Shared Tick Geometry
   ========================================================================== */

/**
 * Reference width for tick density.
 *
 * The navigator axis length differs slightly from the main axis (handles,
 * internal margins). Using the chart plot width for both makes them choose
 * the same ticks.
 */
function getTickReferenceLength(axis) {
  return Math.max(
    1,
    toFiniteNumber(axis?.chart?.plotWidth) ?? toFiniteNumber(axis?.len) ?? 1,
  );
}

/**
 * Visible data window of an axis, or null when not yet measurable.
 */
function getVisibleDataWindow(axis) {
  const dataMin = toFiniteNumber(axis.dataMin);
  const dataMax = toFiniteNumber(axis.dataMax);
  const min = toFiniteNumber(axis.min);
  const max = toFiniteNumber(axis.max);

  if (
    dataMin === null ||
    dataMax === null ||
    min === null ||
    max === null ||
    max < min
  ) {
    return null;
  }

  return {
    minimum: Math.max(dataMin, min),
    maximum: Math.min(dataMax, max),
  };
}

/* ==========================================================================
   Intraday Tick Model
   ========================================================================== */

function chooseIntradayTickInterval(span, width, explicitInterval, pixelGap) {
  const explicit = toFiniteNumber(explicitInterval);

  if (explicit !== null && explicit > 0) {
    return explicit;
  }

  const gap = Math.max(MIN_LABEL_PIXEL_GAP, pixelGap);

  const targetTicks = clamp(Math.floor(width / gap) + 1, 3, 9);

  const desired = span / (targetTicks - 1);

  return (
    INTRADAY_TICK_INTERVALS.find((interval) => interval >= desired) ??
    INTRADAY_TICK_INTERVALS.at(-1)
  );
}

/**
 * Clean market-time tick positions for [minimum, maximum].
 *
 * @returns {{ positions: number[], labels: Map<number, number> | null }}
 *   `labels` maps a tick position to the time it should display.
 */
function buildIntradayTickPositions({
  minimum,
  maximum,
  width,
  tickInterval,
  pixelGap,
  minimumLabelPixelGap,
}) {
  if (maximum <= minimum) {
    return { positions: [minimum], labels: null };
  }

  const span = maximum - minimum;

  const interval = chooseIntradayTickInterval(
    span,
    width,
    tickInterval,
    pixelGap,
  );

  const minimumGap = Math.max(
    1_000,
    Math.max(0, minimumLabelPixelGap) * (span / width),
  );

  const epsilon = Math.min(1_000, interval * 1e-9);

  const positions = [];
  const labels = new Map();

  /*
   * Session edge: a first bar at 10:00:30 or 10:01 puts the 10:00 boundary
   * just outside the axis, so it would be skipped and the session start left
   * unlabelled. Label that boundary at the visible edge instead.
   */
  const boundary = Math.floor(minimum / interval) * interval;

  if (
    boundary < minimum &&
    minimum - boundary <= Math.min(interval / 4, INTRADAY_EDGE_SNAP_MAX)
  ) {
    positions.push(minimum);
    labels.set(minimum, boundary);
  }

  for (
    let tick = Math.ceil(minimum / interval) * interval;
    tick <= maximum + epsilon;
    tick += interval
  ) {
    if (!positions.length || tick - positions.at(-1) >= minimumGap) {
      positions.push(tick);
    }
  }

  return {
    positions: positions.length ? positions : [minimum],
    labels: labels.size ? labels : null,
  };
}

function createIntradayTickPositioner(model) {
  return function intradayTickPositioner() {
    const visible = getVisibleDataWindow(this);

    this[TICK_LABELS_KEY] = null;

    if (!visible) {
      return undefined;
    }

    const { positions, labels } = buildIntradayTickPositions({
      ...visible,
      width: getTickReferenceLength(this),
      tickInterval: model.tickInterval,
      pixelGap: model.pixelGap,
      minimumLabelPixelGap: model.minimumLabelPixelGap,
    });

    this[TICK_LABELS_KEY] = labels;

    return positions;
  };
}

/* ==========================================================================
   Historical Tick Model
   ========================================================================== */

/*
 * Highcharts' automatic datetime ticks are calendar-correct, but with
 * trading-day gaps they look irregular. Historical labels therefore use an
 * even cadence by data index, always landing on real market timestamps.
 */

function getAxisTimestamps(axis, minimum, maximum) {
  const timestamps = new Set();

  for (const series of axis.series ?? []) {
    /*
     * Highcharts 12 exposes getColumn("x"); older versions xData / points.
     */
    const values =
      typeof series.getColumn === "function"
        ? series.getColumn("x")
        : (series.xData ?? series.points?.map((point) => point?.x) ?? []);

    for (const value of values) {
      const timestamp = toFiniteNumber(value);

      if (timestamp !== null && timestamp >= minimum && timestamp <= maximum) {
        timestamps.add(timestamp);
      }
    }
  }

  return [...timestamps].sort((first, second) => first - second);
}

function buildHistoricalTickPositions({
  timestamps,
  width,
  tickCount,
  pixelGap,
}) {
  if (timestamps.length <= 1) {
    return timestamps.length ? [timestamps[0]] : undefined;
  }

  const capacity = Math.max(
    2,
    Math.floor(width / Math.max(HISTORICAL_MIN_LABEL_PIXEL_GAP, pixelGap)) + 1,
  );

  const count = Math.min(
    timestamps.length,
    capacity,
    Math.max(2, Math.round(tickCount)),
  );

  const lastIndex = timestamps.length - 1;

  const positions = [];

  for (let index = 0; index < count; index += 1) {
    const timestamp = timestamps[Math.round((lastIndex * index) / (count - 1))];

    if (positions.at(-1) !== timestamp) {
      positions.push(timestamp);
    }
  }

  return positions;
}

function createHistoricalTickPositioner(model) {
  return function historicalTickPositioner() {
    this[TICK_LABELS_KEY] = null;

    const visible = getVisibleDataWindow(this);

    if (!visible) {
      return undefined;
    }

    return buildHistoricalTickPositions({
      timestamps: getAxisTimestamps(this, visible.minimum, visible.maximum),
      width: getTickReferenceLength(this),
      tickCount: model.tickCount,
      pixelGap: model.pixelGap,
    });
  };
}

function createTickPositioner({ intraday, intradayTicks, historicalTicks }) {
  return intraday
    ? createIntradayTickPositioner(intradayTicks)
    : createHistoricalTickPositioner(historicalTicks);
}

/* ==========================================================================
   Edge Label Containment
   ========================================================================== */

/**
 * First / last ticks sit on the plot edges, so their centered (or rotated)
 * labels can extend past the container and get ellipsized or clipped.
 *
 * After each render, only those two labels are shifted inward. Tick
 * timestamps, spacing and axis geometry are untouched.
 */
function keepAxisEdgeLabelsInside(axis) {
  const container = axis?.chart?.container;
  const positions = axis?.tickPositions;

  if (!container || !axis.ticks || !positions?.length) {
    return;
  }

  const bounds = container.getBoundingClientRect();
  const minimumX = bounds.left + EDGE_LABEL_GUTTER;
  const maximumX = bounds.right - EDGE_LABEL_GUTTER;

  for (const position of new Set([positions[0], positions.at(-1)])) {
    const label = axis.ticks[position]?.label;

    if (!label?.element) {
      continue;
    }

    /*
     * Reset first so shifts never accumulate across redraws.
     */
    label.attr({ translateX: 0 });

    const rect = label.element.getBoundingClientRect();

    if (!rect.width) {
      continue;
    }

    const shift =
      rect.left < minimumX
        ? minimumX - rect.left
        : rect.right > maximumX
          ? maximumX - rect.right
          : 0;

    if (shift) {
      label.attr({ translateX: shift });
    }
  }
}

/* ==========================================================================
   Main X Axis
   ========================================================================== */

function createXAxisOptions({
  range,
  intraday,
  language,
  timeZone,
  theme,
  strings,
  configuration,
  dateFormats,
  tickModels,
}) {
  const formatDate = createDateFormatter({
    language,
    timeZone,
    options: getDateFormat({
      range,
      intraday,
      custom: dateFormats,
      defaults: DEFAULT_X_AXIS_FORMATS,
    }),
  });

  const title = resolveRangeValue(
    configuration.title,
    range,
    intraday ? strings.axis.time : strings.axis.date,
  );

  const rotation =
    toFiniteNumber(resolveRangeValue(configuration.rotation, range, 0)) ?? 0;

  /*
   * labelOptions.style is merged into the defaults (not replacing them), so
   * textOverflow: "none" always survives consumer styles.
   */
  const { style: labelStyle, ...labelOptions } = asPlainObject(
    configuration.labelOptions,
  );

  const sharedTickModel = configuration.tickPositioner !== false;

  return {
    type: "datetime",
    ordinal: configuration.ordinal ?? !intraday,

    minPadding: toNonNegativeNumber(
      resolveRangeValue(configuration.minPadding, range, 0),
      0,
    ),
    maxPadding: toNonNegativeNumber(
      resolveRangeValue(configuration.maxPadding, range, 0),
      0,
    ),

    startOnTick: configuration.startOnTick === true,
    endOnTick: configuration.endOnTick === true,

    lineWidth: 1,
    lineColor: theme.border,

    tickWidth: 1,
    tickLength: 4,
    tickColor: theme.border,

    gridLineWidth: configuration.gridLineWidth ?? 0,
    gridLineColor: theme.grid,

    /*
     * tickPixelInterval only matters when the shared tick model is off.
     */
    ...(sharedTickModel
      ? { tickPositioner: createTickPositioner({ intraday, ...tickModels }) }
      : {
          tickPixelInterval: toNonNegativeNumber(
            configuration.tickPixelInterval,
            intraday ? 88 : 100,
          ),
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
            ...asPlainObject(configuration.crosshair),
          },

    labels: {
      enabled: configuration.labels !== false,
      autoRotation: false,
      rotation,
      align: "center",
      reserveSpace: true,
      x: 0,
      y: rotation === 0 ? 18 : 22,

      /*
       * Intraday labels may be justified by Highcharts. Historical labels
       * render naturally; edge overflow is handled after render.
       */
      overflow: intraday ? "justify" : "allow",

      style: {
        color: theme.muted,
        fontSize: "11px",
        textOverflow: "none",
        whiteSpace: "nowrap",
        ...asPlainObject(labelStyle),
      },

      formatter: createAxisLabelFormatter(formatDate),

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
        ...asPlainObject(configuration.titleStyle),
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
  strings,
  configuration,
  decimals,
  rtl,
}) {
  const format = asPlainObject(configuration.format);

  const formatNumber = createNumberFormatter({
    language,
    decimals: format.decimals ?? decimals,
    useGrouping: format.useGrouping !== false,
  });

  const opposite =
    typeof configuration.opposite === "boolean" ? configuration.opposite : !rtl;

  const { style: labelStyle, ...labelOptions } = asPlainObject(
    configuration.labelOptions,
  );

  const { style: titleStyle, ...titleOptions } = asPlainObject(
    configuration.titleOptions,
  );

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
            ...asPlainObject(configuration.crosshair),
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
        whiteSpace: "nowrap",
        ...asPlainObject(labelStyle),
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
          : configuration.title || strings.axis.value,
      margin: toNonNegativeNumber(configuration.titleMargin, 18),

      style: {
        color: theme.muted,
        fontSize: "11px",
        fontWeight: "600",
        ...asPlainObject(titleStyle),
      },

      ...titleOptions,
    },
  };
}

/* ==========================================================================
   Tooltip
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

    return { open, high, low, close, value: close };
  }

  const value = toFiniteNumber(point.y);

  return value === null ? null : { value };
}

function createTooltipOptions({
  range,
  intraday,
  mode,
  seriesName,
  currency,
  previousClose,
  language,
  timeZone,
  decimals,
  theme,
  strings,
  tooltipDateFormats,
  configuration,
}) {
  const labels = strings.tooltip;

  const formatDate = createDateFormatter({
    language,
    timeZone,
    options: getDateFormat({
      range,
      intraday,
      custom: tooltipDateFormats,
      defaults: DEFAULT_TOOLTIP_DATE_FORMATS,
    }),
  });

  const formatNumber = createNumberFormatter({ language, decimals });

  const formatPercent = createNumberFormatter({
    language,
    decimals: 2,
    useGrouping: false,
  });

  const reference = toFiniteNumber(previousClose);

  const row = (label, value) => `
    <div class="market-chart-tooltip__row">
      <span class="market-chart-tooltip__label">${escapeHTML(label)}</span>
      <span class="market-chart-tooltip__value">${escapeHTML(formatNumber(value))}</span>
    </div>`;

  const renderChange = (value) => {
    if (reference === null) {
      return "";
    }

    const change = value - reference;

    const percent =
      reference === 0 ? null : (change / Math.abs(reference)) * 100;

    const direction = change > 0 ? "up" : change < 0 ? "down" : "neutral";

    const sign = change > 0 ? "+" : "";

    const percentage =
      percent === null ? "" : ` (${sign}${formatPercent(percent)}%)`;

    return `
      <div class="market-chart-tooltip__change market-chart-tooltip__change--${direction}">
        ${escapeHTML(`${sign}${formatNumber(change)}${percentage}`)}
      </div>`;
  };

  return {
    enabled: configuration.enabled !== false,

    useHTML: true,
    shared: false,
    split: false,
    followTouchMove: true,

    /*
     * Tooltip movement stays independent of series animation.
     */
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
      ...asPlainObject(configuration.style),
    },

    formatter() {
      const point = this.point ?? this.points?.[0]?.point ?? this;

      const values = getTooltipValues(point, mode);

      if (!values) {
        return false;
      }

      const body =
        mode === "candlestick"
          ? [
              row(labels.open, values.open),
              row(labels.high, values.high),
              row(labels.low, values.low),
              row(labels.close, values.close),
            ].join("")
          : row(labels.value, values.value);

      const currencyHTML = currency
        ? `<div class="market-chart-tooltip__currency">${escapeHTML(currency)}</div>`
        : "";

      return `
        <div class="market-chart-tooltip">
          <div class="market-chart-tooltip__header">
            <strong class="market-chart-tooltip__title">${escapeHTML(seriesName)}</strong>
            <span class="market-chart-tooltip__date">${escapeHTML(formatDate(point.x))}</span>
          </div>
          <div class="market-chart-tooltip__body">
            ${currencyHTML}
            ${body}
          </div>
          ${renderChange(values.value)}
        </div>`;
    },

    ...asPlainObject(configuration.options),
  };
}

/* ==========================================================================
   Main Series
   ========================================================================== */

const SERIES_TYPE_BY_MODE = Object.freeze({
  trend: "area",
  line: "line",
  candlestick: "candlestick",
});

function createMainSeries({
  mode,
  symbol,
  seriesName,
  data,
  seriesTheme,
  animation,
}) {
  return {
    id: getMainSeriesId(symbol),
    name: seriesName,
    type: SERIES_TYPE_BY_MODE[mode],
    data: Array.isArray(data) ? data : [],

    ...(mode !== "candlestick" ? { threshold: null } : {}),

    animation,
    showInLegend: false,

    /*
     * The navigator owns a dedicated trend series.
     */
    showInNavigator: false,

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
  intraday,
  data,
  direction,
  language,
  timeZone,
  theme,
  layout,
  dateFormats,
  tickModels,
  configuration,
}) {
  if (!enabled || !Array.isArray(data) || !data.length) {
    return { enabled: false };
  }

  const navigatorTheme = getMarketChartNavigatorTheme(
    Highcharts,
    theme,
    direction,
  );

  const formatDate = createDateFormatter({
    language,
    timeZone,
    options: getDateFormat({
      range,
      intraday,
      custom: isPlainObject(configuration.formats)
        ? configuration.formats
        : dateFormats,
      defaults: DEFAULT_X_AXIS_FORMATS,
    }),
  });

  const labelsEnabled =
    configuration.labels === true ||
    (configuration.labels !== false && layout.navigatorLabels);

  /*
   * The navigator may override the historical cadence; intraday always
   * shares the main axis model.
   */
  const navigatorTickModels = {
    intradayTicks: tickModels.intradayTicks,
    historicalTicks: {
      tickCount:
        toFiniteNumber(
          resolveRangeValue(configuration.historicalTickCount, range, null),
        ) ?? tickModels.historicalTicks.tickCount,
      pixelGap:
        toFiniteNumber(
          resolveRangeValue(configuration.historicalTickPixelGap, range, null),
        ) ?? tickModels.historicalTicks.pixelGap,
    },
  };

  return {
    enabled: true,

    /*
     * The controller synchronizes navigator data and follow-latest
     * behavior explicitly.
     */
    adaptToUpdatedData: false,
    stickToMax: false,

    height: toNonNegativeNumber(configuration.height, layout.navigatorHeight),
    margin: toNonNegativeNumber(configuration.margin, layout.navigatorMargin),

    maskInside: configuration.maskInside !== false,
    maskFill: navigatorTheme.maskFill,

    outlineWidth: toNonNegativeNumber(configuration.outlineWidth, 1),
    outlineColor: configuration.outlineColor || navigatorTheme.outlineColor,

    handles: {
      enabled: configuration.handles !== false,
      width: toNonNegativeNumber(configuration.handleWidth, 7),
      height: toNonNegativeNumber(
        configuration.handleHeight,
        layout.navigatorHeight <= 32 ? 14 : 18,
      ),
      backgroundColor: navigatorTheme.handles.backgroundColor,
      borderColor: navigatorTheme.handles.borderColor,
      ...asPlainObject(configuration.handleOptions),
    },

    xAxis: {
      type: "datetime",

      /*
       * Same geometry as the main axis: linear intraday, ordinal historical.
       */
      ordinal: configuration.ordinal ?? !intraday,

      overscroll: 0,
      minPadding: 0,
      maxPadding: 0,
      startOnTick: false,
      endOnTick: false,

      lineWidth: 0,
      tickWidth: 0,
      tickLength: 0,
      gridLineWidth: 0,

      ...(configuration.tickPositioner === false
        ? {}
        : {
            tickPositioner: createTickPositioner({
              intraday,
              ...navigatorTickModels,
            }),
          }),

      labels: {
        enabled: labelsEnabled,

        /*
         * Labels render inside the mini-chart.
         */
        inside: true,
        reserveSpace: false,
        rotation: 0,
        align: "center",
        x: toFiniteNumber(configuration.labelX) ?? 0,
        y: toFiniteNumber(configuration.labelY) ?? -5,

        overflow: intraday ? "justify" : "allow",

        style: {
          color: theme.muted,
          fontSize: "10px",
          textOutline: "none",
          pointerEvents: "none",
          textOverflow: "none",
          whiteSpace: "nowrap",
          ...asPlainObject(configuration.labelStyle),
        },

        formatter: createAxisLabelFormatter(formatDate),
      },

      showFirstLabel: configuration.showFirstLabel !== false,
      showLastLabel: configuration.showLastLabel !== false,
    },

    yAxis: {
      gridLineWidth: 0,
      startOnTick: false,
      endOnTick: false,
      minPadding: 0.08,
      maxPadding: 0.08,
      labels: { enabled: false },
      title: { text: null },
    },

    series: {
      id: NAVIGATOR_SERIES_ID,
      name: "Navigator",
      type: "area",

      /*
       * Always trend / close-price data, even for a candlestick chart.
       */
      data,

      animation: false,

      color: navigatorTheme.color,
      lineColor: navigatorTheme.lineColor,
      lineWidth: navigatorTheme.lineWidth,
      fillColor: navigatorTheme.fillColor,
      threshold: null,

      marker: { enabled: false },
      enableMouseTracking: false,
      showInLegend: false,

      dataGrouping: { enabled: configuration.dataGrouping === true },

      states: {
        hover: { enabled: false },
        inactive: { opacity: 1 },
      },
    },
  };
}

/* ==========================================================================
   Exporting
   ========================================================================== */

function createExportingOptions(exporting) {
  const configuration = asPlainObject(exporting);

  const enabled = configuration.enabled === true;

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
        enabled: enabled && configuration.showContextButton === true,
      },
    },
  };
}

/* ==========================================================================
   Responsive
   ========================================================================== */

/*
 * Tick density adapts automatically through the shared tick models, so the
 * responsive rules only tighten spacing and type size.
 */
function createResponsiveOptions() {
  const fontSize = (size) => ({ style: { fontSize: size } });

  return {
    rules: [
      {
        condition: { maxWidth: 640 },
        chartOptions: {
          chart: {
            spacingTop: 10,
            spacingRight: 14,
            spacingBottom: 20,
            spacingLeft: 14,
          },
          xAxis: { labels: fontSize("10px") },
          yAxis: {
            tickPixelInterval: 48,
            labels: fontSize("10px"),
            title: { margin: 14, ...fontSize("10px") },
          },
          navigator: {
            height: 34,
            margin: 12,
            handles: { width: 7, height: 16 },
            xAxis: { labels: { y: -5, ...fontSize("9px") } },
          },
        },
      },
      {
        condition: { maxWidth: 420 },
        chartOptions: {
          chart: {
            spacingTop: 8,
            spacingRight: 12,
            spacingBottom: 18,
            spacingLeft: 12,
          },
          xAxis: { labels: fontSize("9px") },
          yAxis: {
            labels: fontSize("9px"),
            title: { margin: 12, ...fontSize("9px") },
          },
          navigator: {
            height: 32,
            margin: 10,
            handles: { width: 7, height: 14 },
            xAxis: { labels: { y: -4 } },
          },
        },
      },
    ],
  };
}

/* ==========================================================================
   Factory
   ========================================================================== */

/**
 * Builds the complete Highstock options object.
 *
 * `intraday` may be passed explicitly by the controller; otherwise it is
 * derived from `range` + `capabilities.intradayRange`.
 */
export function createMarketChartOptions({
  Highcharts,
  element,

  context = null,
  capabilities = DEFAULT_CAPABILITIES,

  mode = "trend",
  range = "1D",
  intraday = null,

  direction = "neutral",

  symbol = "",
  seriesName = "",

  currency = "",
  previousClose = null,

  data = [],
  showEmptyState = true,

  /*
   * Trend / close-price data for the current range. The navigator always
   * uses this array, regardless of the primary mode.
   */
  navigatorData = [],

  language = globalThis.document?.documentElement?.lang || DEFAULT_LANGUAGE,
  timeZone = DEFAULT_TIME_ZONE,
  decimals = DEFAULT_DECIMALS,

  /*
   * i18n overrides, same shape as getMarketChartStrings().
   */
  strings = null,

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
  /* Validation ----------------------------------------------------------- */

  if (typeof Highcharts?.stockChart !== "function") {
    throw new TypeError("createMarketChartOptions() requires Highstock.");
  }

  if (!isElement(element)) {
    throw new TypeError(
      "createMarketChartOptions() requires a valid chart element.",
    );
  }

  /* Normalized state ----------------------------------------------------- */

  const normalizedMode = normalizeMarketChartMode(mode);
  const normalizedRange = normalizeMarketChartRange(range);

  const isIntraday =
    typeof intraday === "boolean"
      ? intraday
      : isMarketChartIntradayRange(normalizedRange, capabilities);

  const resolvedSeriesName = seriesName || symbol || "Market";

  const hasData = Array.isArray(data) && data.length > 0;
  const isEmptyScaffold = showEmptyState === true && !hasData;
  const showChartScaffold = hasData || isEmptyScaffold;

  /*
   * A flat one-hour scaffold keeps the chart frame visible while empty.
   */
  const scaffoldEnd = Date.now();
  const scaffoldStart = scaffoldEnd - 60 * MINUTE;

  /* Context / theme / strings -------------------------------------------- */

  const resolvedContext = resolveContext(element, context);
  const layout = CONTEXT_LAYOUT[resolvedContext];
  const rtl = resolveRTL(element, language);
  const theme = getMarketChartTheme(element);
  const resolvedStrings = getMarketChartStrings(language, strings);

  const resolvedAnimation = normalizeMarketChartAnimation(animation, {
    element,
    mode: normalizedMode,
  });

  /* Axis configuration --------------------------------------------------- */

  const axisConfiguration = asPlainObject(axis);

  const xAxisConfiguration = {
    ...asPlainObject(axisConfiguration.x),
    ...asPlainObject(xAxis),
  };

  const yAxisConfiguration = {
    ...asPlainObject(axisConfiguration.y),
    ...asPlainObject(yAxis),
  };

  if (xAxisTitle !== null && xAxisTitle !== undefined) {
    xAxisConfiguration.title = xAxisTitle;
  }

  if (yAxisTitle !== null && yAxisTitle !== undefined) {
    yAxisConfiguration.title = yAxisTitle;
  }

  /* Shared tick models (main axis + navigator) --------------------------- */

  const tickModels = {
    intradayTicks: {
      tickInterval: xAxisConfiguration.tickInterval ?? null,
      pixelGap:
        toFiniteNumber(xAxisConfiguration.intradayTickPixelGap) ??
        INTRADAY_TARGET_LABEL_PIXEL_GAP,
      minimumLabelPixelGap:
        toFiniteNumber(xAxisConfiguration.minimumLabelPixelGap) ??
        MIN_LABEL_PIXEL_GAP,
    },
    historicalTicks: {
      tickCount:
        toFiniteNumber(
          resolveRangeValue(
            xAxisConfiguration.historicalTickCount,
            normalizedRange,
            null,
          ),
        ) ?? HISTORICAL_TICK_COUNT,
      pixelGap:
        toFiniteNumber(
          resolveRangeValue(
            xAxisConfiguration.historicalTickPixelGap,
            normalizedRange,
            null,
          ),
        ) ?? HISTORICAL_TARGET_LABEL_PIXEL_GAP,
    },
  };

  /* Navigator / exporting ------------------------------------------------ */

  const navigatorConfiguration = asPlainObject(navigator);

  const navigatorAllowed =
    capabilities?.navigator !== false &&
    navigatorEnabled !== false &&
    navigatorConfiguration.enabled !== false;

  const exportingOptions = createExportingOptions(exporting);

  /* Accessibility -------------------------------------------------------- */

  const keyboardOrder = [
    "series",
    ...(navigatorAllowed && hasData ? ["navigator"] : []),
    ...(exportingOptions.buttons.contextButton.enabled ? ["chartMenu"] : []),
    "zoom",
  ];

  /* ======================================================================
     Highstock Options
     ====================================================================== */

  return {
    chart: {
      backgroundColor: theme.background,
      animation: resolvedAnimation,

      spacingTop: layout.spacing,
      spacingRight: layout.spacing,
      spacingBottom: layout.bottomSpacing,
      spacingLeft: layout.spacing,

      /*
       * The controller owns resizing through its ResizeObserver.
       */
      reflow: false,

      zooming: {
        type: "x",
        mouseWheel: { enabled: false },
        pinchType: "x",
        resetButton: { theme: { display: "none" } },
      },

      panning: { enabled: true, type: "x" },
      panKey: "shift",

      events: {
        /*
         * Runs after every draw / redraw / resize / navigator drag.
         */
        render() {
          keepAxisEdgeLabelsInside(this.xAxis?.[0]);
          keepAxisEdgeLabelsInside(this.navigator?.xAxis);
        },
      },

      className: `market-chart-highstock market-chart-highstock--${resolvedContext}`,
    },

    time: {
      timezone: timeZone || DEFAULT_TIME_ZONE,
    },

    /*
     * Chart-level `lang` requires Highcharts 12+. On older versions these
     * strings are applied globally by initMarketCharts().
     */
    lang: { ...resolvedStrings.highcharts },

    title: { text: null },
    subtitle: { text: null },
    credits: { enabled: false },
    legend: { enabled: false },

    /*
     * Application controls own range selection; the navigator owns the
     * viewport.
     */
    rangeSelector: { enabled: false },
    scrollbar: { enabled: false },

    navigator: createNavigatorOptions({
      Highcharts,
      enabled: navigatorAllowed && showChartScaffold,
      range: normalizedRange,
      intraday: isIntraday,
      data: isEmptyScaffold ? [] : navigatorData,
      direction,
      language,
      timeZone,
      theme,
      layout,
      dateFormats,
      tickModels,
      configuration: navigatorConfiguration,
    }),

    xAxis: {
      ...createXAxisOptions({
        range: normalizedRange,
        intraday: isIntraday,
        language,
        timeZone,
        theme,
        strings: resolvedStrings,
        configuration: xAxisConfiguration,
        dateFormats,
        tickModels,
      }),

      /*
       * Explicit tickPositions take precedence over the tick positioner.
       */
      ...(isEmptyScaffold
        ? {
            min: scaffoldStart,
            max: scaffoldEnd,
            tickPositions: [
              scaffoldStart,
              (scaffoldStart + scaffoldEnd) / 2,
              scaffoldEnd,
            ],
            labels: { enabled: false },
          }
        : {
            /*
             * Release scaffold constraints when real data returns.
             */
            min: null,
            max: null,
            tickPositions: undefined,
          }),

      visible: showChartScaffold,
    },

    yAxis: {
      ...createYAxisOptions({
        language,
        theme,
        layout,
        strings: resolvedStrings,
        configuration: yAxisConfiguration,
        decimals,
        rtl,
      }),

      ...(isEmptyScaffold
        ? {
            min: 0,
            max: 1,
            tickPositions: [0, 0.25, 0.5, 0.75, 1],
            labels: { enabled: false },
          }
        : {
            min: null,
            max: null,
            tickPositions: undefined,
          }),

      visible: showChartScaffold,
    },

    tooltip: {
      ...createTooltipOptions({
        range: normalizedRange,
        intraday: isIntraday,
        mode: normalizedMode,
        seriesName: resolvedSeriesName,
        currency,
        previousClose,
        language,
        timeZone,
        decimals,
        theme,
        strings: resolvedStrings,
        tooltipDateFormats,
        configuration: asPlainObject(tooltip),
      }),

      enabled: hasData && tooltip?.enabled !== false,
    },

    plotOptions: {
      series: {
        animation: resolvedAnimation,

        /*
         * The controller owns exact point resolution.
         */
        dataGrouping: { enabled: false },

        states: { inactive: { opacity: 1 } },
      },

      area: {
        threshold: null,
        marker: { enabled: false },
      },

      line: {
        marker: { enabled: false },
      },

      candlestick: {
        /*
         * Candlestick transitions intentionally never animate.
         */
        animation: false,
        pointPadding: 0.08,
        groupPadding: 0.04,
      },
    },

    series: [
      createMainSeries({
        mode: normalizedMode,
        symbol,
        seriesName: resolvedSeriesName,
        data: isEmptyScaffold
          ? [
              [scaffoldStart, 0],
              [scaffoldEnd, 0],
            ]
          : data,
        seriesTheme: getMarketChartSeriesTheme(
          Highcharts,
          theme,
          normalizedMode,
          direction,
        ),
        animation: resolvedAnimation,
      }),
    ],

    accessibility: {
      enabled: accessibilityEnabled !== false,
      description:
        accessibilityDescription ||
        resolvedStrings.accessibility.description(seriesName || symbol),
      landmarkVerbosity: "one",
      keyboardNavigation: {
        enabled: true,
        order: keyboardOrder,
      },

      /*
       * Application status UI owns live-market announcements.
       */
      announceNewData: { enabled: false },
    },

    exporting: exportingOptions,

    responsive: createResponsiveOptions(),
  };
}
