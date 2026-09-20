/* *
 *
 *  Market Chart — Controller
 *
 *  Owns one Highstock instance per chart host.
 *
 *  Responsibilities
 *  -----------------
 *  - Canonical range data.
 *  - Range switching.
 *  - Chart mode switching.
 *  - Live data reconciliation.
 *  - Navigator synchronization.
 *  - Follow-live viewport behavior.
 *  - Controls.
 *  - Theme / resize observation.
 *  - Teardown.
 *
 *  Important live rules
 *  ---------------------
 *  1. Ordinary live points use Highcharts incremental operations:
 *       append  -> addPoint()
 *       replace -> Point.update()
 *       reset   -> setData()
 *
 *  2. The navigator uses the same incremental operation model. A normal
 *     new tick must NOT call `navigatorSeries.setData()` with the
 *     complete session.
 *
 *  3. Direction changes are presentation changes. A red/green change must
 *     NOT call `Series.update()` on the live hot path.
 *
 *  4. One live transaction ends with one `chart.redraw(false)`.
 *
 *  5. The navigator source is always trend / close-price data, even when
 *     the primary chart is candlestick.
 *
 *  6. A main-series renderer change never uses `Series.update({ type })`.
 *     trend / line / candlestick transitions remove the old primary
 *     series and create a fresh one, each step redrawn immediately
 *     (rather than deferred to the transaction's final redraw) so
 *     Highcharts fully commits the old renderer's teardown before the
 *     new one starts drawing — this is a manual, user-triggered action,
 *     never part of the live-tick hot path, so correctness there is
 *     worth more than saving one redraw. A stray series left behind
 *     on the main pane by that swap is pruned immediately via ordinary,
 *     officially-supported `Series.remove()` — see
 *     {@link MarketChartController#pruneMainSeries}. A navigator-owned
 *     series is never removed that way: the Navigator module manages its
 *     series' lifecycle internally, and detaching one directly corrupts
 *     that bookkeeping (it surfaces as `Series.remove()` throwing while
 *     reading `chart.options.accessibility`, then cascades into
 *     `Navigator.update()`/`destroy()` failing on the next, unrelated
 *     action). If the navigator ever ends up with more than one series,
 *     the only safe remedy is a full, authoritative rebuild through
 *     `Navigator.update()` itself — see
 *     {@link MarketChartController#rebuildNavigatorIfDuplicated}.
 *
 *  7. A silent polling gap (tab hidden, offline, backgrounded) must not
 *     be bridged as a smooth line across the missing period. See
 *     {@link MarketChartController#applyLiveData}, which inserts a
 *     `null` point to break the series when a gap between two consecutive
 *     points far exceeds the data's own expected minute-bar cadence
 *     (`candleBucketSize`) — not the network polling interval, which is
 *     an unrelated clock.
 *
 * */

"use strict";

import {
  DEFAULT_CANDLE_BUCKET_SIZE,
  DEFAULT_MAX_POINTS,
  getAvailableMarketChartRanges,
  getFirstAvailableMarketChartRange,
  getMarketChartRangeComparisonValue,
  isMarketChartIntradayRange,
  isMarketChartRangeSupported,
  normalizeMarketChartCapabilities,
  normalizeMarketChartData,
  normalizeMarketChartMode,
  normalizeMarketChartRange,
  normalizeMarketChartRanges,
  normalizeMarketChartRangeRecord,
  normalizeMarketChartTimestamp,
  setMarketChartRangeRecord,
} from "./market-chart-data.js";

import { createMarketChartLiveController } from "./market-chart-live.js";

import { createMarketChartOptions } from "./market-chart-options.js";

/* *
 *
 *  Registry / Constants
 *
 * */

/**
 * One host element maps to at most one live controller instance.
 *
 * @type {Map<Element, MarketChartController>}
 */
const chartRegistry = new Map();

const MARKET_CHART_MODES = Object.freeze(["trend", "line", "candlestick"]);

const LIVE_PAUSE_HISTORICAL_RANGE = "historical-range";

/**
 * Multiplier applied to the data's expected minute-bar cadence
 * (`candleBucketSize`) to decide whether a gap between two consecutive
 * trend points represents a genuine silent period (tab hidden, offline,
 * backgrounded) rather than an ordinary tick. Configurable per chart via
 * `live.gapBreakMultiplier`.
 *
 * @type {number}
 */
const DEFAULT_LIVE_GAP_BREAK_MULTIPLIER = 3;

const DEFAULT_MESSAGES = Object.freeze({
  loading: "Loading market data…",

  empty: "Market data is currently unavailable.",

  error: "Market data could not be loaded.",
});

const DEFAULT_CONFIGURATION = Object.freeze({
  context: "performance",

  symbol: "",

  name: "",

  currency: "",

  mode: "trend",

  range: "1D",

  data: [],

  ranges: {},

  previousClose: null,

  language: null,

  timeZone: "Asia/Riyadh",

  decimals: 2,

  maxPoints: DEFAULT_MAX_POINTS,

  candleBucketSize: DEFAULT_CANDLE_BUCKET_SIZE,

  // null: keep the complete intraday session visible.
  // positive milliseconds: follow a trailing live window.
  liveWindowDuration: null,

  xAxisTitle: null,

  yAxisTitle: null,

  axis: {},

  xAxis: {},

  yAxis: {},

  dateFormats: {},

  tooltipDateFormats: {},

  tooltip: {},

  navigatorEnabled: null,

  navigator: {},

  controls: {},

  live: null,

  exporting: {},

  animation: true,

  accessibilityEnabled: true,

  accessibilityDescription: "",

  messages: DEFAULT_MESSAGES,
});

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
 * @param {number|null} [fallback=null]
 * @returns {number|null}
 */
function toPositiveNumber(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function toPositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * @param {*} first
 * @param {*} second
 * @returns {boolean} Whether two point tuples are element-wise identical.
 */
function pointsEqual(first, second) {
  if (
    !Array.isArray(first) ||
    !Array.isArray(second) ||
    first.length !== second.length
  ) {
    return false;
  }

  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }

  return true;
}

/* *
 *
 *  DOM / Events
 *
 * */

/**
 * @param {Element|string} target
 * @param {Document} [document=globalThis.document]
 * @returns {Element|null}
 */
function resolveElement(target, document = globalThis.document) {
  if (isElement(target)) {
    return target;
  }

  if (typeof target !== "string" || !document) {
    return null;
  }

  try {
    return document.querySelector(target);
  } catch {
    return null;
  }
}

/**
 * @param {Element} element
 * @param {*} controls
 * @returns {Element} The element controls (range/mode buttons, status text) are scoped to.
 */
function resolveControlsRoot(element, controls) {
  const root = isPlainObject(controls) ? controls.root : null;

  if (isElement(root)) {
    return root;
  }

  if (typeof root === "string") {
    try {
      const resolved = element.ownerDocument.querySelector(root);

      if (resolved) {
        return resolved;
      }
    } catch {
      // Fall through to structural lookup.
    }
  }

  return (
    element.closest("[data-performance-chart]") ||
    element.closest(".performance-chart") ||
    element.closest("[data-market-chart-root]") ||
    element.parentElement ||
    element
  );
}

/**
 * @param {Element} element
 * @param {string} type
 * @param {object} [detail]
 * @returns {boolean}
 */
function dispatchChartEvent(element, type, detail = {}) {
  if (!isElement(element)) {
    return false;
  }

  const CustomEventConstructor =
    element.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;

  if (typeof CustomEventConstructor !== "function") {
    return false;
  }

  element.dispatchEvent(
    new CustomEventConstructor(type, {
      bubbles: true,

      detail,
    }),
  );

  return true;
}

/* *
 *
 *  Configuration
 *
 * */

/**
 * @param {object} [configuration]
 * @param {Document} [document=globalThis.document]
 * @returns {object} Fully normalized controller configuration.
 */
function normalizeConfiguration(
  configuration = {},
  document = globalThis.document,
) {
  const source = isPlainObject(configuration) ? configuration : {};

  const capabilities = {
    ...normalizeMarketChartCapabilities(source.capabilities),
  };

  const live = isPlainObject(source.live) ? source.live : null;

  if (live && source.capabilities?.live === undefined) {
    capabilities.live = live.enabled !== false;
  }

  const messages = {
    ...DEFAULT_MESSAGES,

    ...(isPlainObject(source.messages) ? source.messages : {}),
  };

  if (source.loadingMessage) {
    messages.loading = source.loadingMessage;
  }

  if (source.emptyMessage) {
    messages.empty = source.emptyMessage;
  }

  if (source.errorMessage) {
    messages.error = source.errorMessage;
  }

  return {
    ...DEFAULT_CONFIGURATION,
    ...source,

    capabilities,

    mode: normalizeMarketChartMode(source.mode ?? DEFAULT_CONFIGURATION.mode),

    range: normalizeMarketChartRange(
      source.range ?? DEFAULT_CONFIGURATION.range,
    ),

    language:
      source.language ||
      document?.documentElement?.lang ||
      DEFAULT_CONFIGURATION.language ||
      "en",

    timeZone: source.timeZone || DEFAULT_CONFIGURATION.timeZone,

    maxPoints: toPositiveInteger(source.maxPoints, DEFAULT_MAX_POINTS),

    candleBucketSize: toPositiveInteger(
      source.candleBucketSize,
      DEFAULT_CANDLE_BUCKET_SIZE,
    ),

    liveWindowDuration: toPositiveNumber(
      source.liveWindowDuration ?? source.navigator?.liveWindowDuration,
      null,
    ),

    axis: isPlainObject(source.axis) ? source.axis : {},

    xAxis: isPlainObject(source.xAxis) ? source.xAxis : {},

    yAxis: isPlainObject(source.yAxis) ? source.yAxis : {},

    dateFormats: isPlainObject(source.dateFormats) ? source.dateFormats : {},

    tooltipDateFormats: isPlainObject(source.tooltipDateFormats)
      ? source.tooltipDateFormats
      : {},

    tooltip: isPlainObject(source.tooltip) ? source.tooltip : {},

    controls: isPlainObject(source.controls) ? source.controls : {},

    navigator: isPlainObject(source.navigator) ? source.navigator : {},

    exporting: isPlainObject(source.exporting) ? source.exporting : {},

    live,

    messages,
  };
}

/* *
 *
 *  Stored Range Data
 *
 * */

/**
 * @param {object|null} record
 * @param {'trend'|'line'|'candlestick'} mode
 * @returns {Array}
 */
function getStoredRangeData(record, mode) {
  if (!record) {
    return [];
  }

  if (normalizeMarketChartMode(mode) === "candlestick") {
    return Array.isArray(record.candlestick) ? record.candlestick : [];
  }

  return Array.isArray(record.trend) ? record.trend : [];
}

/**
 * @param {Array} trendData
 * @returns {'up'|'down'|'neutral'}
 */
function getDataDirection(trendData) {
  if (!Array.isArray(trendData) || trendData.length < 2) {
    return "neutral";
  }

  const first = toFiniteNumber(trendData[0]?.[1]);

  const last = toFiniteNumber(trendData[trendData.length - 1]?.[1]);

  if (first === null || last === null || first === last) {
    return "neutral";
  }

  return last > first ? "up" : "down";
}

/* *
 *
 *  Data Bounds / Viewport
 *
 * */

/**
 * @param {Array} data
 * @returns {{minimum: number, maximum: number}|null}
 */
function getDataBounds(data) {
  if (!Array.isArray(data) || !data.length) {
    return null;
  }

  const minimum = toFiniteNumber(data[0]?.[0]);

  const maximum = toFiniteNumber(data[data.length - 1]?.[0]);

  if (minimum === null || maximum === null) {
    return null;
  }

  return {
    minimum,
    maximum,
  };
}

/**
 * @param {{minimum: number, maximum: number}|null} bounds
 * @returns {number}
 */
function getBoundsDuration(bounds) {
  return bounds ? Math.max(0, bounds.maximum - bounds.minimum) : 0;
}

/**
 * Clamps a candidate viewport to lie fully within `bounds`, preserving
 * its duration where possible.
 *
 * @param {{minimum: number, maximum: number}|null} viewport
 * @param {{minimum: number, maximum: number}|null} bounds
 * @returns {{minimum: number, maximum: number}|null}
 */
function clampViewport(viewport, bounds) {
  if (!viewport || !bounds) {
    return null;
  }

  const dataDuration = getBoundsDuration(bounds);

  if (dataDuration <= 0) {
    return {
      ...bounds,
    };
  }

  const viewportDuration = Math.min(getBoundsDuration(viewport), dataDuration);

  if (viewportDuration <= 0) {
    return {
      ...bounds,
    };
  }

  let minimum = Math.max(
    bounds.minimum,

    Math.min(viewport.minimum, bounds.maximum - viewportDuration),
  );

  let maximum = minimum + viewportDuration;

  if (maximum > bounds.maximum) {
    maximum = bounds.maximum;

    minimum = Math.max(bounds.minimum, maximum - viewportDuration);
  }

  return {
    minimum,
    maximum,
  };
}

/* *
 *
 *  Live Point Storage
 *
 * */

/**
 * Binary search for the insertion index of `timestamp` in a
 * timestamp-sorted array.
 *
 * @param {Array} data
 * @param {number} timestamp
 * @returns {number}
 */
function findPointIndex(data, timestamp) {
  let low = 0;
  let high = data.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (data[middle][0] < timestamp) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

/**
 * @param {Array} data Mutated in place.
 * @param {number} maxPoints
 * @param {(overflow: number) => void} [onEvict]
 * @returns {number} Number of points evicted from the front of `data`.
 */
function trimLiveData(data, maxPoints, onEvict) {
  const overflow = data.length - maxPoints;

  if (overflow <= 0) {
    return 0;
  }

  if (typeof onEvict === "function") {
    onEvict(overflow);
  }

  data.splice(0, overflow);

  return overflow;
}

/**
 * Inserts, replaces, or appends into a timestamp-sorted canonical array
 * and reports which incremental Highcharts operation applies.
 *
 * Operation types
 * ----------------
 * - `noop`: no change.
 * - `append`: new latest timestamp.
 * - `replace`: same latest timestamp, changed value.
 * - `reset`: historical correction/insertion or complex trimming — the
 *   series must be reset with `setData()` rather than mutated
 *   incrementally.
 *
 * @param {Array} data Mutated in place.
 * @param {Array} point
 * @param {number} maxPoints
 * @param {(overflow: number) => void} [onEvict]
 * @returns {{type: string, point: Array, shifted: boolean}}
 */
function upsertPoint(data, point, maxPoints, onEvict) {
  const timestamp = point[0];

  const lastIndex = data.length - 1;

  const last = lastIndex >= 0 ? data[lastIndex] : null;

  /* ------------------------------------------------------------------
   * Append
   * ------------------------------------------------------------------ */

  if (!last || timestamp > last[0]) {
    data.push(point);

    const removed = trimLiveData(data, maxPoints, onEvict);

    return removed > 1
      ? {
          type: "reset",

          point,

          shifted: false,
        }
      : {
          type: "append",

          point,

          shifted: removed === 1,
        };
  }

  /* ------------------------------------------------------------------
   * Replace Latest
   * ------------------------------------------------------------------ */

  if (timestamp === last[0]) {
    if (pointsEqual(last, point)) {
      return {
        type: "noop",

        point,

        shifted: false,
      };
    }

    data[lastIndex] = point;

    return {
      type: "replace",

      point,

      shifted: false,
    };
  }

  /* ------------------------------------------------------------------
   * Historical Correction / Insertion
   * ------------------------------------------------------------------ */

  const index = findPointIndex(data, timestamp);

  if (data[index]?.[0] === timestamp) {
    if (pointsEqual(data[index], point)) {
      return {
        type: "noop",

        point,

        shifted: false,
      };
    }

    data[index] = point;
  } else {
    data.splice(index, 0, point);
  }

  trimLiveData(data, maxPoints, onEvict);

  return {
    type: "reset",

    point,

    shifted: false,
  };
}

/* *
 *
 *  Live Payload
 *
 * */

/**
 * Normalizes a raw live payload into an array of raw points, accepting a
 * bare point, an array of points, or a `{ points | updates | data }`
 * wrapper object.
 *
 * @param {*} payload
 * @returns {Array}
 */
function normalizeLivePayload(payload) {
  if (payload === null || payload === undefined) {
    return [];
  }

  let value = payload;

  if (isPlainObject(payload)) {
    if (Array.isArray(payload.points)) {
      value = payload.points;
    } else if (Array.isArray(payload.updates)) {
      value = payload.updates;
    } else if (Array.isArray(payload.data)) {
      value = payload.data;
    }
  }

  if (Array.isArray(value) && value.length === 0) {
    return [];
  }

  // Batch.
  if (
    Array.isArray(value) &&
    value.length &&
    (Array.isArray(value[0]) || isPlainObject(value[0]))
  ) {
    return value;
  }

  // Single point.
  return [value];
}

/**
 * Normalizes one raw live point to a `[timestamp, price]` pair. Accepts a
 * full OHLC tuple/object (using its close), or a bare price point.
 *
 * @param {*} point
 * @returns {[number, number]|null}
 */
function normalizeLivePricePoint(point) {
  if (Array.isArray(point)) {
    const timestamp = normalizeMarketChartTimestamp(point[0]);

    const value = toFiniteNumber(point.length >= 5 ? point[4] : point[1]);

    return timestamp !== null && value !== null ? [timestamp, value] : null;
  }

  if (!isPlainObject(point)) {
    return null;
  }

  const timestamp = normalizeMarketChartTimestamp(
    point.x ??
      point.timestamp ??
      point.time ??
      point.dateTime ??
      point.date ??
      point.tradingDate,
  );

  const value = toFiniteNumber(
    point.y ??
      point.value ??
      point.price ??
      point.indexPrice ??
      point.close ??
      point.closePrice ??
      point.lastPrice,
  );

  return timestamp !== null && value !== null ? [timestamp, value] : null;
}

/**
 * @param {*} point
 * @returns {boolean} Whether `point` already carries complete OHLC data.
 */
function isOHLCPoint(point) {
  if (Array.isArray(point)) {
    return point.length >= 5;
  }

  return Boolean(
    isPlainObject(point) &&
    (point.open !== undefined || point.openPrice !== undefined) &&
    (point.high !== undefined || point.highPrice !== undefined) &&
    (point.low !== undefined || point.lowPrice !== undefined) &&
    (point.close !== undefined || point.closePrice !== undefined),
  );
}

/**
 * Normalizes and chronologically sorts every acceptable point in a raw
 * live payload, pairing each with its original source representation
 * (needed by {@link mergeLiveCandle} to detect pre-built OHLC).
 *
 * @param {*} payload
 * @returns {{sourcePoint: *, pricePoint: [number, number]}[]}
 */
function normalizeAcceptedLiveItems(payload) {
  const accepted = [];

  for (const sourcePoint of normalizeLivePayload(payload)) {
    const pricePoint = normalizeLivePricePoint(sourcePoint);

    if (pricePoint) {
      accepted.push({
        sourcePoint,
        pricePoint,
      });
    }
  }

  // Apply backend batches chronologically.
  accepted.sort((first, second) => first.pricePoint[0] - second.pricePoint[0]);

  return accepted;
}

/* *
 *
 *  Live Candlestick
 *
 * */

/**
 * Assembles a forming candle from streaming last-price ticks. If the
 * backend already provides complete OHLC, that is used directly instead.
 *
 * @param {Array} candles Mutated in place.
 * @param {*} sourcePoint
 * @param {[number, number]} pricePoint
 * @param {object} options
 * @param {number} options.bucketSize
 * @param {number} options.maxPoints
 * @param {(overflow: number) => void} [options.onEvict]
 * @returns {object|null}
 */
function mergeLiveCandle(
  candles,
  sourcePoint,
  pricePoint,
  { bucketSize, maxPoints, onEvict },
) {
  if (isOHLCPoint(sourcePoint)) {
    const candle = normalizeMarketChartData([sourcePoint], "candlestick")[0];

    return candle ? upsertPoint(candles, candle, maxPoints, onEvict) : null;
  }

  const [timestamp, price] = pricePoint;

  const bucketTimestamp = Math.floor(timestamp / bucketSize) * bucketSize;

  const index = findPointIndex(candles, bucketTimestamp);

  const existing =
    candles[index]?.[0] === bucketTimestamp ? candles[index] : null;

  if (existing) {
    return upsertPoint(
      candles,

      [
        bucketTimestamp,

        existing[1],

        Math.max(existing[2], price),

        Math.min(existing[3], price),

        price,
      ],

      maxPoints,

      onEvict,
    );
  }

  const previous = index > 0 ? candles[index - 1] : null;

  const open = previous?.[4] ?? price;

  return upsertPoint(
    candles,

    [
      bucketTimestamp,

      open,

      Math.max(open, price),

      Math.min(open, price),

      price,
    ],

    maxPoints,

    onEvict,
  );
}

/* *
 *
 *  Highcharts Incremental Data Operations
 *
 * */

/**
 * Applies one canonical mutation to one existing Highcharts series.
 *
 * @param {Highcharts.Series|null} series
 * @param {{type: string, point: Array}|null} operation
 * @param {Array} finalData Complete canonical array, used only for a `reset`.
 * @returns {boolean}
 */
function applySeriesOperation(series, operation, finalData) {
  if (!series || !operation || operation.type === "noop") {
    return false;
  }

  /* ------------------------------------------------------------------
   * Append
   * ------------------------------------------------------------------ */

  if (operation.type === "append") {
    series.addPoint(operation.point, false, operation.shifted, false);

    return true;
  }

  /* ------------------------------------------------------------------
   * Replace Current Latest Point
   * ------------------------------------------------------------------ */

  if (operation.type === "replace") {
    const points = series.data || series.points || [];

    const lastPoint = points[points.length - 1];

    if (lastPoint?.x === operation.point[0]) {
      lastPoint.update(operation.point, false, false);

      return true;
    }
  }

  /* ------------------------------------------------------------------
   * Reset
   *
   * Historical correction, insertion, or an unexpected runtime
   * mismatch.
   * ------------------------------------------------------------------ */

  series.setData(finalData, false, false, false);

  return true;
}

/**
 * Applies one live transaction to one Highcharts series. A multi-point
 * backend batch is reconciled with one `setData()`, while the normal
 * single live point remains incremental.
 *
 * @param {Highcharts.Series|null} series
 * @param {Array} operations
 * @param {Array} finalData
 * @returns {boolean}
 */
function applySeriesOperations(series, operations, finalData) {
  if (!series || !Array.isArray(operations)) {
    return false;
  }

  const changed = operations.filter(
    (operation) => operation && operation.type !== "noop",
  );

  if (!changed.length) {
    return false;
  }

  // Multiple backend mutations in one response are reconciled
  // atomically, to avoid several Highcharts SVG mutations before one
  // redraw.
  if (
    changed.length > 1 ||
    changed.some((operation) => operation.type === "reset")
  ) {
    series.setData(finalData, false, false, false);

    return true;
  }

  return applySeriesOperation(series, changed[0], finalData);
}

/* *
 *
 *  Highcharts Live Presentation
 *
 * */

/**
 * Extracts presentation-only options. Structural options are
 * deliberately excluded: `type`, `id`, `data`, `dataGrouping`,
 * `showInNavigator`.
 *
 * @param {object} options
 * @returns {object|null}
 */
function getSeriesPresentation(options) {
  if (!isPlainObject(options)) {
    return null;
  }

  const presentation = {};

  for (const key of [
    "color",
    "lineColor",
    "lineWidth",
    "fillColor",
    "upColor",
    "upLineColor",
  ]) {
    if (options[key] !== undefined) {
      presentation[key] = options[key];
    }
  }

  return Object.keys(presentation).length ? presentation : null;
}

/**
 * Recolors an existing series without `Series.update()`. This avoids
 * rebuilding a live areaspline's graph/area SVG and prevents visual
 * artifacts during semantic red/green direction changes.
 *
 * @param {Highcharts.Series|null} series
 * @param {object} options
 * @returns {boolean}
 */
function applySeriesPresentation(series, options) {
  if (!series) {
    return false;
  }

  const presentation = getSeriesPresentation(options);

  if (!presentation) {
    return false;
  }

  /* ------------------------------------------------------------------
   * Highcharts Runtime Options
   * ------------------------------------------------------------------ */

  if (isPlainObject(series.options)) {
    Object.assign(series.options, presentation);
  }

  if (isPlainObject(series.userOptions)) {
    Object.assign(series.userOptions, presentation);
  }

  if (presentation.color !== undefined) {
    series.color = presentation.color;
  }

  const stroke = presentation.lineColor ?? presentation.color;

  const strokeWidth = presentation.lineWidth;

  /* ------------------------------------------------------------------
   * Primary Graph
   * ------------------------------------------------------------------ */

  if (series.graph) {
    const attributes = {};

    if (stroke !== undefined) {
      attributes.stroke = stroke;
    }

    if (strokeWidth !== undefined) {
      attributes["stroke-width"] = strokeWidth;
    }

    if (Object.keys(attributes).length) {
      series.graph.attr(attributes);
    }
  }

  /* ------------------------------------------------------------------
   * Primary Area
   * ------------------------------------------------------------------ */

  if (series.area && presentation.fillColor !== undefined) {
    series.area.attr({
      fill: presentation.fillColor,
    });
  }

  /* ------------------------------------------------------------------
   * Secondary Graph Collection
   * ------------------------------------------------------------------ */

  if (Array.isArray(series.graphs)) {
    for (const graph of series.graphs) {
      if (!graph) {
        continue;
      }

      const attributes = {};

      if (stroke !== undefined) {
        attributes.stroke = stroke;
      }

      if (strokeWidth !== undefined) {
        attributes["stroke-width"] = strokeWidth;
      }

      if (Object.keys(attributes).length) {
        graph.attr(attributes);
      }
    }
  }

  /* ------------------------------------------------------------------
   * Secondary Area Collection
   * ------------------------------------------------------------------ */

  if (Array.isArray(series.areas) && presentation.fillColor !== undefined) {
    for (const area of series.areas) {
      area?.attr?.({
        fill: presentation.fillColor,
      });
    }
  }

  return true;
}

/* *
 *
 *  Controller
 *
 * */

/**
 * Owns one Highstock instance for one Market Chart host element: its
 * canonical range data, range/mode switching, live polling and
 * reconciliation, navigator synchronization, controls, and teardown.
 *
 * Created via {@link createMarketChart} rather than directly.
 *
 * @class
 */
class MarketChartController {
  /**
   * @param {Element} element
   * @param {object} [configuration]
   * @throws {TypeError} If `element` is not a valid DOM element, or if
   *         the resolved `Highcharts` namespace or environment is
   *         missing required capabilities (Highstock, `AbortController`).
   */
  constructor(element, configuration = {}) {
    if (!isElement(element)) {
      throw new TypeError(
        "MarketChartController requires a valid chart element.",
      );
    }

    this.element = element;

    this.document = element.ownerDocument;

    this.window = this.document.defaultView;

    this.configuration = normalizeConfiguration(configuration, this.document);

    this.Highcharts =
      this.configuration.Highcharts ||
      this.window?.Highcharts ||
      globalThis.Highcharts;

    if (!this.Highcharts || typeof this.Highcharts.stockChart !== "function") {
      throw new TypeError("Market Chart requires Highstock.");
    }

    this.capabilities = this.configuration.capabilities;

    this.controlsRoot = resolveControlsRoot(
      this.element,
      this.configuration.controls,
    );

    this.section =
      this.element.closest("[data-performance-chart]") ||
      this.element.closest(".performance-chart") ||
      this.controlsRoot;

    /* ----------------------------------------------------------------
     * Data
     * ---------------------------------------------------------------- */

    this.ranges = normalizeMarketChartRanges(this.configuration.ranges, {
      capabilities: this.capabilities,
    });

    let availableRanges = getAvailableMarketChartRanges(
      this.ranges,
      this.capabilities,
    );

    // Convenience: a flat `data` array becomes the configured range.
    if (!availableRanges.length) {
      const baseData = normalizeMarketChartData(
        this.configuration.data,
        this.configuration.mode,
      );

      if (baseData.length) {
        const range = this.configuration.range;

        const record = normalizeMarketChartRangeRecord(
          this.configuration.mode === "candlestick"
            ? {
                candlestick: baseData,

                comparisonValue: this.configuration.previousClose,
              }
            : {
                trend: baseData,

                comparisonValue: this.configuration.previousClose,
              },
        );

        this.ranges[range] = record;

        availableRanges = [range];
      }
    }

    this.availableRanges = availableRanges;

    this.currentRange =
      getFirstAvailableMarketChartRange(
        this.ranges,
        this.configuration.range,
        this.capabilities,
      ) || this.configuration.range;

    this.currentMode = normalizeMarketChartMode(this.configuration.mode);

    /* ----------------------------------------------------------------
     * Runtime
     * ---------------------------------------------------------------- */

    this.chart = null;

    this.liveController = null;

    this.destroyed = false;

    this.initialized = false;

    this.state = "idle";

    this.presentationDirection = null;

    // Initial intraday state shows the complete available session.
    this.followLatest = false;

    this.userDetachedFromLive = false;

    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.resizeFrame = null;

    this.themeFrame = null;

    this.resizeObserver = null;

    this.themeObserver = null;

    this.removeAxisEvent = null;

    this.lastUpdatedFormatters = null;

    const AbortControllerConstructor =
      this.window?.AbortController || globalThis.AbortController;

    if (typeof AbortControllerConstructor !== "function") {
      throw new TypeError("Market Chart requires AbortController.");
    }

    this.listenerController = new AbortControllerConstructor();

    this.handleRangeClick = this.handleRangeClick.bind(this);

    this.handleModeClick = this.handleModeClick.bind(this);

    this.handleAfterSetExtremes = this.handleAfterSetExtremes.bind(this);

    this.handleThemeMutation = this.handleThemeMutation.bind(this);
  }

  /* *
   *
   *  State
   *
   * */

  /**
   * @param {string} state
   * @param {string} [message='']
   * @returns {boolean}
   */
  setState(state, message = "") {
    if (this.destroyed) {
      return false;
    }

    this.state = state;

    this.element.dataset.chartState = state;

    if (message) {
      this.element.dataset.chartMessage = message;
    } else {
      delete this.element.dataset.chartMessage;
    }

    this.section?.setAttribute(
      "aria-busy",
      state === "loading" ? "true" : "false",
    );

    dispatchChartEvent(this.element, "marketchartstatechange", {
      state,
      message,
      controller: this,
    });

    return true;
  }

  /**
   * Records the live polling state on the host's dataset for CSS/QA
   * hooks. This chart no longer renders a "Live" indicator in the UI —
   * only the "Updated" timestamp is user-facing (see
   * {@link MarketChartController#updateLastUpdated}) — but the
   * dataset attribute is retained as a lightweight, no-cost hook for
   * styling or automated tests that key off live state.
   *
   * @param {string|object} state
   * @returns {boolean}
   */
  setLiveState(state) {
    if (this.destroyed) {
      return false;
    }

    const value = typeof state === "string" ? state : state?.state || "idle";

    this.element.dataset.chartLiveState = value;

    this.section?.setAttribute("data-chart-live-state", value);

    dispatchChartEvent(this.element, "marketchartlivestatechange", {
      state: value,

      detail: typeof state === "object" ? state : null,

      controller: this,
    });

    return true;
  }

  /**
   * @param {boolean} follow
   * @param {object} [detail]
   * @returns {boolean} The resolved `follow` value.
   */
  setFollowLatest(follow, detail = {}) {
    const value = Boolean(follow);

    const changed = value !== this.followLatest;

    this.followLatest = value;

    this.element.dataset.chartFollowLive = value ? "true" : "false";

    this.section?.setAttribute(
      "data-chart-follow-live",
      value ? "true" : "false",
    );

    if (changed) {
      dispatchChartEvent(this.element, "marketchartfollowchange", {
        followLatest: value,

        range: this.currentRange,

        controller: this,

        ...detail,
      });
    }

    return value;
  }

  /* *
   *
   *  Messages
   *
   * */

  /**
   * @returns {void}
   */
  clearMessage() {
    this.element
      .querySelectorAll(":scope > .market-chart__message")
      .forEach((message) => {
        message.remove();
      });
  }

  /**
   * @param {string} state
   * @returns {void}
   */
  showMessage(state) {
    this.clearMessage();

    const message = this.configuration.messages?.[state] || "";

    this.setState(state, message);

    if (!message) {
      return;
    }

    const wrapper = this.document.createElement("div");

    wrapper.className = `market-chart__message market-chart__message--${state}`;

    wrapper.setAttribute("role", state === "error" ? "alert" : "status");

    wrapper.setAttribute(
      "aria-live",
      state === "error" ? "assertive" : "polite",
    );

    const text = this.document.createElement("p");

    text.className = "market-chart__message-text";

    text.textContent = message;

    wrapper.append(text);

    this.element.append(wrapper);
  }

  /* *
   *
   *  Range / Data Access
   *
   * */

  /**
   * @returns {string[]}
   */
  refreshAvailableRanges() {
    this.availableRanges = getAvailableMarketChartRanges(
      this.ranges,
      this.capabilities,
    );

    return [...this.availableRanges];
  }

  /**
   * @param {*} range
   * @returns {boolean}
   */
  hasRange(range) {
    const normalizedRange = normalizeMarketChartRange(range);

    return Boolean(
      isMarketChartRangeSupported(normalizedRange, this.capabilities) &&
      this.ranges[normalizedRange],
    );
  }

  /**
   * @param {string} [range=this.currentRange]
   * @returns {object|null}
   */
  getRangeRecord(range = this.currentRange) {
    return this.ranges[normalizeMarketChartRange(range)] || null;
  }

  /**
   * @param {string} [range=this.currentRange]
   * @param {string} [mode=this.currentMode]
   * @returns {Array}
   */
  getRangeData(range = this.currentRange, mode = this.currentMode) {
    return getStoredRangeData(this.getRangeRecord(range), mode);
  }

  /**
   * @returns {Array}
   */
  getActiveData() {
    return this.getRangeData();
  }

  /**
   * @returns {boolean}
   */
  hasActiveData() {
    return this.getActiveData().length > 0;
  }

  /**
   * The navigator source is always trend / close-price data, regardless
   * of the primary series' mode.
   *
   * @param {string} [range=this.currentRange]
   * @returns {Array}
   */
  getNavigatorData(range = this.currentRange) {
    return this.getRangeData(range, "trend");
  }

  /**
   * @param {string} [range=this.currentRange]
   * @returns {number|null}
   */
  getComparisonValue(range = this.currentRange) {
    const normalizedRange = normalizeMarketChartRange(range);

    const fallback = this.isIntradayRange(normalizedRange)
      ? this.configuration.previousClose
      : null;

    return getMarketChartRangeComparisonValue(
      this.ranges,
      normalizedRange,
      fallback,
    );
  }

  /**
   * @param {string} [range=this.currentRange]
   * @returns {'up'|'down'|'neutral'}
   */
  getDirection(range = this.currentRange) {
    return getDataDirection(this.getRangeData(range, "trend"));
  }

  /**
   * @param {string} [range=this.currentRange]
   * @param {string} [mode=this.currentMode]
   * @returns {number|null}
   */
  getLatestTimestamp(range = this.currentRange, mode = this.currentMode) {
    const data = this.getRangeData(range, mode);

    return data.length ? data[data.length - 1][0] : null;
  }

  /* *
   *
   *  Availability
   *
   * */

  /**
   * @param {string} [range=this.currentRange]
   * @returns {boolean}
   */
  isIntradayRange(range = this.currentRange) {
    return isMarketChartIntradayRange(range, this.capabilities);
  }

  /**
   * @returns {string}
   */
  getIntradayRange() {
    return this.capabilities.intradayRange || "1D";
  }

  /**
   * Runtime/UI range availability. Historical ranges require a stored
   * backend range record. The intraday range is slightly different: it
   * remains selectable when the chart has a valid live source even if
   * its snapshot record has not been materialized yet — this prevents
   * 1D from becoming disabled after the page is currently displaying a
   * historical range.
   *
   * @param {*} range
   * @returns {boolean}
   */
  isRangeAvailable(range) {
    const normalizedRange = normalizeMarketChartRange(range);

    if (!isMarketChartRangeSupported(normalizedRange, this.capabilities)) {
      return false;
    }

    if (this.ranges[normalizedRange]) {
      return true;
    }

    if (!this.isIntradayRange(normalizedRange)) {
      return false;
    }

    const live = this.configuration.live;

    const hasLiveSource = Boolean(
      this.capabilities.live === true &&
      live &&
      live.enabled !== false &&
      typeof live.fetchUpdates === "function",
    );

    return hasLiveSource || Boolean(this.liveController);
  }

  /**
   * @param {string} mode
   * @param {string} [range=this.currentRange]
   * @returns {boolean}
   */
  isModeAvailable(mode, range = this.currentRange) {
    return this.getRangeData(range, mode).length > 0;
  }

  /**
   * @param {string} preferredMode
   * @param {string} [range=this.currentRange]
   * @returns {'trend'|'line'|'candlestick'}
   */
  resolveAvailableMode(preferredMode, range = this.currentRange) {
    const preferred = normalizeMarketChartMode(preferredMode);

    if (this.isModeAvailable(preferred, range)) {
      return preferred;
    }

    return (
      MARKET_CHART_MODES.find((mode) => this.isModeAvailable(mode, range)) ||
      preferred
    );
  }

  /* *
   *
   *  Highstock Options
   *
   * */

  /**
   * @param {Array} [data=this.getActiveData()]
   * @returns {object} A complete Highstock options object for the current state.
   */
  createOptions(data = this.getActiveData()) {
    return createMarketChartOptions({
      Highcharts: this.Highcharts,

      element: this.element,

      context: this.configuration.context,

      capabilities: this.capabilities,

      mode: this.currentMode,

      range: this.currentRange,

      direction: this.getDirection(),

      symbol: this.configuration.symbol,

      seriesName:
        this.configuration.name || this.configuration.symbol || "Market",

      currency: this.configuration.currency,

      previousClose: this.getComparisonValue(),

      data,

      navigatorData: this.getNavigatorData(),

      language: this.configuration.language,

      timeZone: this.configuration.timeZone,

      decimals: this.configuration.decimals,

      xAxisTitle: this.configuration.xAxisTitle,

      yAxisTitle: this.configuration.yAxisTitle,

      axis: this.configuration.axis,

      xAxis: this.configuration.xAxis,

      yAxis: this.configuration.yAxis,

      dateFormats: this.configuration.dateFormats,

      tooltipDateFormats: this.configuration.tooltipDateFormats,

      tooltip: this.configuration.tooltip,

      navigatorEnabled: this.configuration.navigatorEnabled,

      navigator: this.configuration.navigator,

      exporting: this.configuration.exporting,

      animation: this.configuration.animation,

      accessibilityEnabled: this.configuration.accessibilityEnabled,

      accessibilityDescription:
        this.configuration.accessibilityDescription ||
        (this.configuration.name
          ? `${this.configuration.name} market performance over time.`
          : "Market performance over time."),
    });
  }

  /* *
   *
   *  Highcharts Resolution
   *
   * */

  /**
   * @returns {Highcharts.Series|null}
   */
  getMainSeries() {
    if (!this.chart) {
      return null;
    }

    const id = `market-chart-${String(
      this.configuration.symbol || "series",
    ).toLowerCase()}`;

    return (
      this.chart.get(id) ||
      this.chart.series.find(
        (series) =>
          !series.options?.isInternal &&
          series.options?.id !== "market-chart-navigator-series",
      ) ||
      null
    );
  }

  /**
   * Every series on the chart that is a candidate "main" series — i.e.
   * everything except internal Highcharts series and the dedicated
   * navigator series. Used by {@link MarketChartController#pruneMainSeries}
   * to detect and remove anything left behind by a renderer swap.
   *
   * @returns {Highcharts.Series[]}
   */
  getMainSeriesCandidates() {
    if (!this.chart) {
      return [];
    }

    return this.chart.series.filter(
      (series) =>
        series &&
        !series.options?.isInternal &&
        series.options?.id !== "market-chart-navigator-series",
    );
  }

  /**
   * @returns {Highcharts.Axis|null}
   */
  getNavigatorXAxis() {
    return this.chart?.navigator?.xAxis || null;
  }

  /**
   * @returns {Highcharts.Series[]}
   */
  getNavigatorSeriesList() {
    const series = this.chart?.navigator?.series;

    return Array.isArray(series) ? series.filter(Boolean) : [];
  }

  /**
   * @returns {Highcharts.Series|null}
   */
  getNavigatorSeries() {
    const series = this.getNavigatorSeriesList();

    if (!series.length) {
      return null;
    }

    const identified = series.filter(
      (item) => item.options?.id === "market-chart-navigator-series",
    );

    return (
      identified[identified.length - 1] || series[series.length - 1] || null
    );
  }

  /**
   * @returns {Highcharts.Axis|null}
   */
  getMainXAxis() {
    if (!this.chart?.xAxis?.length) {
      return null;
    }

    return (
      this.chart.xAxis.find((axis) => !axis.options?.isInternal) ||
      this.chart.xAxis[0] ||
      null
    );
  }

  /**
   * @returns {{minimum: number, maximum: number}|null}
   */
  getViewport() {
    const axis = this.getMainXAxis();

    const minimum = toFiniteNumber(axis?.min);

    const maximum = toFiniteNumber(axis?.max);

    return minimum !== null && maximum !== null
      ? {
          minimum,
          maximum,
        }
      : null;
  }

  /* *
   *
   *  Series Pruning
   *
   *  A renderer swap (trend/line <-> candlestick) removes the old main
   *  series and adds a fresh one via `chart.addSeries()`. Some
   *  Highstock versions can leave the navigator's internally-derived
   *  series out of sync with that swap, or — under rapid repeated
   *  toggling — leave a previous main series instance un-removed. Left
   *  unchecked, this compounds every toggle: extra overlapping
   *  trend/candlestick lines ("branches") in the main pane, and a
   *  navigator whose translucent fill visibly darkens with each
   *  additional stacked series. These methods are the self-heal: called
   *  right after every renderer swap, they guarantee exactly one main
   *  series and exactly one navigator series survive.
   *
   * */

  /**
   * Removes every main-series candidate except `canonicalSeries`. This
   * is standard, officially-supported Highcharts usage: `Series.remove()`
   * on a normal chart-pane series is safe and well-defined.
   *
   * @param {Highcharts.Series|null} canonicalSeries The series to keep.
   * @param {string} [context] Diagnostic label for warnings.
   * @returns {Highcharts.Series|null} `canonicalSeries`, unchanged.
   */
  pruneMainSeries(canonicalSeries, context) {
    if (!this.chart) {
      return canonicalSeries;
    }

    const candidates = this.getMainSeriesCandidates();

    if (candidates.length > 1) {
      console.warn(
        `Market Chart (${this.configuration.symbol || "unknown"}): ` +
          `${candidates.length} main series present after "${context}" — ` +
          "expected 1. Removing extras.",
      );
    }

    for (const series of candidates) {
      if (series !== canonicalSeries) {
        // Defensive/rare path (this only runs when something left
        // more than one main-pane series behind). Immediate
        // redraw here, same reasoning as the type-change swap in
        // reconcileMainSeries(): correctness over micro-perf for
        // an action that is never part of the live-tick hot path.
        series.remove(true, false);
      }
    }

    return canonicalSeries;
  }

  /**
   * If more than one series is present inside the navigator, forces a
   * full, authoritative navigator rebuild.
   *
   * IMPORTANT: this deliberately never calls `Series.remove()` on a
   * navigator-owned series. The Navigator module manages its series'
   * lifecycle (event bindings, axis linkage, internal bookkeeping)
   * itself; detaching one of its series directly — even with
   * `redraw: false` — corrupts that internal state. In practice this
   * surfaces as `Series.remove()` throwing while reading
   * `chart.options.accessibility` (the accessibility module's series
   * lifecycle hooks assume a chart in a consistent state), and then
   * cascades into `Navigator.update()`/`Navigator.destroy()` throwing
   * on a subsequent, unrelated action — which is what made every
   * following click appear to do nothing.
   *
   * The safe remedy is the one Highcharts itself supports: pass the
   * navigator its complete, authoritative options again (including
   * `series`) through `Navigator.update()`, letting Highcharts fully
   * reconcile its own internal series list down to exactly one, through
   * its own safe lifecycle, rather than through direct series surgery.
   *
   * @param {string} [context] Diagnostic label.
   * @param {object|null} [chartOptions] Reused option snapshot, if the caller already has one.
   * @returns {boolean} Whether a rebuild was performed.
   */
  rebuildNavigatorIfDuplicated(context, chartOptions = null) {
    if (this.getNavigatorSeriesList().length <= 1) {
      return false;
    }

    console.warn(
      `Market Chart (${this.configuration.symbol || "unknown"}): ` +
        `duplicate navigator series detected after "${context}" — ` +
        "rebuilding the navigator.",
    );

    if (!this.chart?.navigator) {
      return false;
    }

    const navigatorConfig = (chartOptions || this.createOptions())?.navigator;

    if (!navigatorConfig) {
      return false;
    }

    // Unlike syncNavigator()'s routine structural sync — which
    // deliberately strips `series` to avoid recreating it on every
    // ordinary update — a detected duplicate needs the *full*
    // config, `series` included, so Highcharts fully reconciles its
    // internal series list back down to exactly the one
    // authoritative series this defines. This is the safe,
    // Highcharts-supported way to resolve a duplicate.
    if (typeof this.chart.navigator.update === "function") {
      this.chart.navigator.update(navigatorConfig, false);
    } else {
      this.chart.update(
        {
          navigator: navigatorConfig,
        },
        false,
        false,
        false,
      );
    }

    this.verifyNavigatorIntegrity(context);

    return true;
  }

  /* *
   *
   *  Navigator Integrity
   *
   * */

  /**
   * Diagnostic check: warns (without mutating anything) when more than
   * one navigator series is present. Callers that need to actually fix
   * a duplicate should call
   * {@link MarketChartController#rebuildNavigatorIfDuplicated} instead,
   * which performs a full, safe `Navigator.update()` rebuild rather
   * than touching series directly.
   *
   * @param {string} context Diagnostic label.
   * @returns {boolean} Whether exactly one (or zero) navigator series are present.
   */
  verifyNavigatorIntegrity(context) {
    const series = this.getNavigatorSeriesList();

    if (series.length <= 1) {
      return true;
    }

    console.warn(
      `Market Chart (${this.configuration.symbol || "unknown"}): ` +
        `navigator has ${series.length} series after "${context}" — expected 1.`,

      series.map((item, index) => ({
        index,

        id: item.options?.id,

        renderedColor: item.color,

        configuredColor: item.options?.color,

        pointCount: item.data?.length ?? item.options?.data?.length ?? 0,

        firstTimestamp:
          item.data?.[0]?.x ?? item.options?.data?.[0]?.[0] ?? null,

        lastTimestamp:
          item.data?.[item.data.length - 1]?.x ??
          item.options?.data?.[item.options.data.length - 1]?.[0] ??
          null,
      })),
    );

    return false;
  }

  /* *
   *
   *  Navigator Synchronization
   *
   * */

  /**
   * Structural/full navigator synchronization. Use this for initial
   * creation reconciliation, range changes, theme changes, or a
   * complete external data replacement. Do NOT use it for an ordinary
   * one-point live append/replace — see
   * {@link MarketChartController#applyNavigatorLiveOperations}.
   *
   * @param {object} [options]
   * @param {boolean} [options.style=true]
   * @param {boolean} [options.data=true]
   * @param {boolean} [options.structural=false]
   * @param {object|null} [options.chartOptions=null]
   * @returns {boolean}
   */
  syncNavigator({
    style = true,
    data = true,
    structural = false,
    chartOptions = null,
  } = {}) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const resolvedOptions = chartOptions || this.createOptions();

    const navigatorConfig = resolvedOptions?.navigator;

    const shouldBeEnabled = navigatorConfig?.enabled === true;

    const currentlyEnabled = this.getNavigatorSeriesList().length > 0;

    /* ------------------------------------------------------------
     * Enable / Disable
     * ------------------------------------------------------------ */

    if (shouldBeEnabled !== currentlyEnabled) {
      this.chart.update(
        {
          navigator: navigatorConfig || {
            enabled: false,
          },
        },
        false,
        false,
        false,
      );

      // chart.update() already performs the enable/disable
      // lifecycle safely through Navigator's own init/destroy.
      // This is diagnostic only — no manual series removal.
      this.verifyNavigatorIntegrity("syncNavigator:toggle");

      if (!shouldBeEnabled) {
        return true;
      }
    }

    if (!shouldBeEnabled) {
      return false;
    }

    /* ------------------------------------------------------------
     * Structural Update
     * ------------------------------------------------------------ */

    if (structural && this.chart.navigator) {
      const {
        series: ignoredNavigatorSeries,

        ...navigatorStructure
      } = navigatorConfig;

      if (typeof this.chart.navigator.update === "function") {
        this.chart.navigator.update(navigatorStructure, false);
      } else {
        this.chart.update(
          {
            navigator: navigatorStructure,
          },
          false,
          false,
          false,
        );
      }
    }

    // Navigator.update() is the authoritative, safe way to
    // reconcile the navigator's own series bookkeeping — it tears
    // down and rebuilds through Navigator's own lifecycle rather
    // than through direct series surgery. This is diagnostic only.
    this.verifyNavigatorIntegrity("syncNavigator");

    const navigatorSeriesList = this.getNavigatorSeriesList();

    if (!navigatorSeriesList.length) {
      return false;
    }

    /* ------------------------------------------------------------
     * Presentation
     * ------------------------------------------------------------ */

    if (style && isPlainObject(navigatorConfig?.series)) {
      for (const navigatorSeries of navigatorSeriesList) {
        applySeriesPresentation(navigatorSeries, navigatorConfig.series);
      }
    }

    /* ------------------------------------------------------------
     * Complete Data Reconciliation
     * ------------------------------------------------------------ */

    if (data) {
      const navigatorData = this.getNavigatorData();

      for (const navigatorSeries of navigatorSeriesList) {
        navigatorSeries.setData(navigatorData, false, false, false);
      }
    }

    return true;
  }

  /**
   * Live navigator synchronization. Ordinary ticks use the same
   * incremental operation model as the main trend series:
   * append -> `addPoint()`, replace -> `Point.update()`,
   * reset -> `setData()`.
   *
   * @param {Array} operations
   * @returns {boolean}
   */
  applyNavigatorLiveOperations(operations) {
    if (this.destroyed || !this.chart || !Array.isArray(operations)) {
      return false;
    }

    const changed = operations.filter(
      (operation) => operation && operation.type !== "noop",
    );

    if (!changed.length) {
      return false;
    }

    const navigatorSeriesList = this.getNavigatorSeriesList();

    if (!navigatorSeriesList.length) {
      return false;
    }

    const navigatorData = this.getNavigatorData();

    let changedAny = false;

    for (const navigatorSeries of navigatorSeriesList) {
      changedAny =
        applySeriesOperations(navigatorSeries, changed, navigatorData) ||
        changedAny;
    }

    this.verifyNavigatorIntegrity("applyNavigatorLiveOperations");

    return changedAny;
  }

  /* *
   *
   *  Initial Render
   *
   * */

  /**
   * @returns {Highcharts.Chart}
   */
  renderInitialChart() {
    if (this.destroyed || this.chart) {
      return this.chart;
    }

    this.clearMessage();

    this.presentationDirection = this.getDirection();

    this.element.dataset.chartDirection = this.presentationDirection;

    this.chart = this.Highcharts.stockChart(this.element, this.createOptions());

    if (!this.chart) {
      throw new Error("Highstock did not create the Market Chart.");
    }

    this.bindAxisEvents();

    this.verifyNavigatorIntegrity("renderInitialChart");

    this.setFollowLatest(false, {
      source: "initialize",
    });

    return this.chart;
  }

  /* *
   *
   *  Full Chart Rebuild
   *
   *  Unlike the incremental reconciliation used for range changes and
   *  live ticks, a manual mode toggle (trend/line <-> candlestick) is
   *  rare, user-triggered, and never part of a hot loop — so it can
   *  afford the strongest possible correctness guarantee instead of
   *  the cheapest one. This destroys the existing Highstock instance
   *  completely and creates a fresh one, exactly as though the chart
   *  were being built for the first time. It is the same strategy
   *  Market Overview already uses for its tab lifecycle (a fresh
   *  Highstock instance per active market, proven artifact-free in
   *  practice) and it leaves zero room for any stale graph, area, or
   *  navigator state to survive a mode switch — at the cost of one
   *  extra teardown/create pair on an action that only ever happens on
   *  a click, never in the live-tick hot path.
   *
   * */

  /**
   * Completely destroys and recreates the underlying Highstock
   * instance from the controller's current range/mode/data. The
   * viewport (zoom window) is preserved by default, since this exists
   * for mode toggles where the person is not also changing range.
   *
   * @param {object} [options]
   * @param {boolean} [options.preserveViewport=true]
   * @returns {boolean} `false` only when the controller is destroyed.
   * @throws {Error} If Highstock fails to (re)create the chart.
   */
  rebuildChart({ preserveViewport = true } = {}) {
    if (this.destroyed) {
      return false;
    }

    const previousViewport = preserveViewport ? this.getViewport() : null;

    this.removeAxisEvent?.();

    this.removeAxisEvent = null;

    this.chart?.destroy();

    this.chart = null;

    this.presentationDirection = this.getDirection();

    this.element.dataset.chartDirection = this.presentationDirection;

    // A manual toggle should redraw instantly, not replay the
    // chart's initial entrance animation every time it's clicked.
    const configuredAnimation = this.configuration.animation;

    let options;

    this.configuration.animation = false;

    try {
      options = this.createOptions();
    } finally {
      this.configuration.animation = configuredAnimation;
    }

    this.chart = this.Highcharts.stockChart(this.element, options);

    if (!this.chart) {
      throw new Error("Highstock did not recreate the Market Chart.");
    }

    this.bindAxisEvents();

    this.verifyNavigatorIntegrity("rebuildChart");

    if (previousViewport) {
      this.restoreViewport(previousViewport, false);
    } else {
      this.applyDefaultViewport(false);
    }

    this.chart.redraw(false);

    if (this.hasActiveData()) {
      this.clearMessage();

      this.setState("ready");
    } else {
      this.showMessage("empty");
    }

    return true;
  }

  /* *
   *
   *  Primary Series Reconciliation
   *
   * */

  /**
   * Reconciles the primary Highcharts series without ever changing its
   * renderer type through `Series.update()`. Highcharts maintains
   * different SVG/runtime structures for areaspline, line, and
   * candlestick series — reusing one `Series` instance across those
   * renderer families can leave stale graph/area paths behind after
   * repeated mode switches. A type change therefore gets a clean series
   * instance, and — critically — any stray series left on the main
   * pane by that swap is pruned via
   * {@link MarketChartController#pruneMainSeries}. The navigator's own
   * series bookkeeping, if it needs reconciling at all, is the
   * caller's responsibility (`refreshChart`), and is always done
   * through {@link MarketChartController#rebuildNavigatorIfDuplicated}
   * — never through direct series removal here.
   *
   * Same-type refreshes are deliberately lightweight: presentation is
   * updated in place, data is replaced, and neither a structural
   * `Series.update()` nor a redraw happens here.
   *
   * @param {object|null} mainSeriesOptions
   * @param {Array} data
   * @returns {{series: Highcharts.Series, replaced: boolean, previousType?: string, nextType?: string}}
   * @throws {Error} If the chart has no main series, or if recreating it after a type change fails.
   */
  reconcileMainSeries(mainSeriesOptions, data) {
    const mainSeries = this.getMainSeries();

    if (!mainSeries) {
      throw new Error("Market Chart main series is unavailable.");
    }

    if (!mainSeriesOptions) {
      mainSeries.setData(data, false, false, false);

      return {
        series: mainSeries,
        replaced: false,
      };
    }

    const currentType = String(
      mainSeries.type ||
        mainSeries.options?.type ||
        mainSeries.userOptions?.type ||
        "",
    )
      .trim()
      .toLowerCase();

    const nextType = String(mainSeriesOptions.type || currentType)
      .trim()
      .toLowerCase();

    const typeChanged =
      Boolean(currentType && nextType) && currentType !== nextType;

    if (typeChanged) {
      // A mode toggle (trend/line <-> candlestick) is a rare,
      // manual, user-triggered action — never part of the live-tick
      // hot path — so correctness is worth more here than shaving
      // one redraw. Both steps below force an IMMEDIATE redraw
      // rather than deferring to the transaction's final redraw:
      // removing the old series first commits its SVG teardown
      // completely before the replacement is even created, closing
      // off any window in which a stale graph/area path from the
      // previous renderer could still be present when the new
      // series starts drawing.
      mainSeries.remove(true, false);

      const replacement = this.chart.addSeries(
        {
          ...mainSeriesOptions,
          data,
        },
        true,
        false,
      );

      if (!replacement) {
        throw new Error(
          `Market Chart main series could not be recreated (${currentType} -> ${nextType}).`,
        );
      }

      // addSeries() can leave the old series' shadow behind on the
      // main pane. That is safe, standard series removal — prune
      // it here. The navigator's own series bookkeeping, if it
      // needs reconciling at all, is handled by the caller
      // (refreshChart) through the safe Navigator.update() path —
      // never through direct series removal; see
      // rebuildNavigatorIfDuplicated().
      this.pruneMainSeries(replacement, "reconcileMainSeries:typeChange");

      return {
        series: replacement,
        replaced: true,
        previousType: currentType,
        nextType,
      };
    }

    // Same renderer: colors/line width/fill are presentation
    // concerns and can be applied without Series.update() — the same
    // safe strategy used by the live direction-change path.
    applySeriesPresentation(mainSeries, mainSeriesOptions);

    mainSeries.setData(data, false, false, false);

    return {
      series: mainSeries,
      replaced: false,
      previousType: currentType || null,
      nextType: nextType || null,
    };
  }

  /* *
   *
   *  Structural Refresh
   *
   * */

  /**
   * @param {object} [options]
   * @param {boolean} [options.preserveViewport=false]
   * @param {boolean} [options.updateAxes=true]
   * @param {boolean} [options.syncNavigator=true]
   * @param {boolean} [options.navigatorStyle=true]
   * @param {boolean} [options.navigatorData=true]
   * @param {boolean} [options.navigatorStructural=true]
   * @param {boolean} [options.redraw=true]
   * @param {boolean|object} [options.animation=false]
   * @returns {boolean}
   */
  refreshChart(options = {}) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const preserveViewport = options.preserveViewport === true;

    const updateAxes = options.updateAxes !== false;

    const shouldSyncNavigator = options.syncNavigator !== false;

    const navigatorStyle = options.navigatorStyle !== false;

    const navigatorData = options.navigatorData !== false;

    const navigatorStructural = options.navigatorStructural !== false;

    const previousViewport = preserveViewport ? this.getViewport() : null;

    const navigatorSeriesCountBefore = this.getNavigatorSeriesList().length;

    const data = this.getActiveData();

    this.presentationDirection = this.getDirection();

    this.element.dataset.chartDirection = this.presentationDirection;

    // One coherent option snapshot for this transaction.
    const chartOptions = this.createOptions(data);

    const [mainSeriesOptions] = chartOptions.series || [];

    const {
      series: ignoredSeries,

      navigator: ignoredNavigator,

      xAxis: xAxisOptions,

      yAxis: yAxisOptions,

      ...chartUpdate
    } = chartOptions;

    try {
      /* ------------------------------------------------------------
       * Chart-Level Options
       * ------------------------------------------------------------ */

      this.chart.update(chartUpdate, false, false, options.animation ?? false);

      /* ------------------------------------------------------------
       * Primary Axes
       * ------------------------------------------------------------ */

      if (updateAxes) {
        const mainXAxis = this.getMainXAxis();

        if (mainXAxis && xAxisOptions) {
          mainXAxis.update(xAxisOptions, false);
        }

        if (this.chart.yAxis?.[0] && yAxisOptions) {
          this.chart.yAxis[0].update(yAxisOptions, false);
        }
      }

      /* ------------------------------------------------------------
       * Primary Series
       * ------------------------------------------------------------ */

      const mainResult = this.reconcileMainSeries(mainSeriesOptions, data);

      /* ------------------------------------------------------------
       * Navigator
       * ------------------------------------------------------------ */

      if (shouldSyncNavigator) {
        this.syncNavigator({
          style: navigatorStyle,
          data: navigatorData,
          structural: navigatorStructural,
          chartOptions,
        });
      } else {
        const navigatorSeriesCountAfter = this.getNavigatorSeriesList().length;

        if (mainResult.replaced && navigatorSeriesCountAfter === 0) {
          // Defensive recovery only. A pure mode switch
          // intentionally leaves the navigator untouched. If a
          // Highstock version happens to remove its internal
          // navigator series when the base series is replaced,
          // restore it once here rather than structurally
          // rebuilding the navigator on every mode change.
          this.syncNavigator({
            style: true,
            data: true,
            structural: true,
            chartOptions,
          });
        } else if (navigatorSeriesCountAfter > 1) {
          // The main-pane renderer swap left the navigator
          // with more than one series. Reconcile it the safe
          // way: a full Navigator.update() rebuild, never
          // direct series removal (see
          // rebuildNavigatorIfDuplicated() for why).
          this.rebuildNavigatorIfDuplicated(
            "refreshChart:duplicate",
            chartOptions,
          );
        } else {
          this.verifyNavigatorIntegrity("refreshChart:preserved");
        }

        void navigatorSeriesCountBefore;
      }

      // Axis.update() may replace axis internals. Pure mode
      // changes skip axis updates, so their event binding remains
      // untouched.
      if (updateAxes) {
        this.bindAxisEvents();
      }

      /* ------------------------------------------------------------
       * Viewport
       * ------------------------------------------------------------ */

      if (previousViewport && preserveViewport) {
        this.restoreViewport(previousViewport, false);
      } else {
        this.applyDefaultViewport(false);
      }

      /* ------------------------------------------------------------
       * Redraw
       * ------------------------------------------------------------ */

      if (options.redraw !== false) {
        this.chart.redraw(options.animation ?? false);
      }

      if (data.length) {
        this.clearMessage();

        this.setState("ready");
      } else {
        this.showMessage("empty");
      }

      return true;
    } catch (error) {
      console.error("Market Chart update failed.", error);

      this.showMessage("error");

      dispatchChartEvent(this.element, "marketcharterror", {
        error,

        controller: this,
      });

      return false;
    }
  }

  /* *
   *
   *  Axis Events
   *
   * */

  /**
   * @returns {void}
   */
  bindAxisEvents() {
    this.removeAxisEvent?.();

    this.removeAxisEvent = null;

    if (typeof this.Highcharts.addEvent !== "function") {
      return;
    }

    const axis = this.getMainXAxis();

    if (!axis) {
      return;
    }

    this.removeAxisEvent = this.Highcharts.addEvent(
      axis,
      "afterSetExtremes",
      this.handleAfterSetExtremes,
    );
  }

  /**
   * @param {object} event
   * @returns {void}
   */
  handleAfterSetExtremes(event) {
    if (this.destroyed) {
      return;
    }

    const trigger = String(event?.trigger || "");

    // Ignore viewport changes generated by this controller.
    if (trigger.startsWith("market-chart-")) {
      return;
    }

    const minimum = toFiniteNumber(event?.min);

    const maximum = toFiniteNumber(event?.max);

    if (minimum === null || maximum === null || maximum <= minimum) {
      return;
    }

    dispatchChartEvent(this.element, "marketchartviewportchange", {
      range: this.currentRange,

      viewport: {
        minimum,
        maximum,
      },

      trigger: trigger || "axis",

      controller: this,
    });

    if (!this.isIntradayRange()) {
      return;
    }

    const bounds = getDataBounds(this.getActiveData());

    if (!bounds) {
      return;
    }

    const duration = maximum - minimum;

    const tolerance = Math.max(1_000, duration * 0.01);

    const atLatest = bounds.maximum - maximum <= tolerance;

    this.userDetachedFromLive = !atLatest;

    if (atLatest) {
      this.liveViewportDuration = duration;
    }

    this.setFollowLatest(atLatest, {
      source: "user",

      trigger: trigger || "axis",
    });
  }

  /* *
   *
   *  Viewport
   *
   * */

  /**
   * @param {{minimum: number, maximum: number}|null} viewport
   * @param {boolean} [redraw=true]
   * @param {string} [trigger='market-chart-data']
   * @returns {boolean}
   */
  applyViewport(viewport, redraw = true, trigger = "market-chart-data") {
    const axis = this.getMainXAxis();

    if (!axis || !viewport) {
      return false;
    }

    const minimum = toFiniteNumber(viewport.minimum);

    const maximum = toFiniteNumber(viewport.maximum);

    if (minimum === null || maximum === null || maximum < minimum) {
      return false;
    }

    axis.setExtremes(minimum, maximum, redraw, false, {
      trigger,
    });

    return true;
  }

  /**
   * @param {{minimum: number, maximum: number}} viewport
   * @param {boolean} [redraw=true]
   * @returns {boolean}
   */
  restoreViewport(viewport, redraw = true) {
    const resolved = clampViewport(
      viewport,
      getDataBounds(this.getActiveData()),
    );

    return resolved
      ? this.applyViewport(resolved, redraw, "market-chart-restore")
      : false;
  }

  /**
   * @param {boolean} [redraw=true]
   * @returns {boolean}
   */
  applyDefaultViewport(redraw = true) {
    const bounds = getDataBounds(this.getActiveData());

    return bounds
      ? this.applyViewport(bounds, redraw, "market-chart-range")
      : false;
  }

  /**
   * @param {boolean} [redraw=false]
   * @returns {boolean}
   */
  applyLiveViewport(redraw = false) {
    if (
      !this.followLatest ||
      this.userDetachedFromLive ||
      !this.isIntradayRange()
    ) {
      return false;
    }

    const bounds = getDataBounds(this.getActiveData());

    if (!bounds) {
      return false;
    }

    const duration =
      this.configuration.liveWindowDuration || this.liveViewportDuration;

    if (!duration || duration >= getBoundsDuration(bounds)) {
      return this.applyViewport(bounds, redraw, "market-chart-live");
    }

    return this.applyViewport(
      {
        minimum: Math.max(
          bounds.minimum,

          bounds.maximum - duration,
        ),

        maximum: bounds.maximum,
      },

      redraw,
      "market-chart-live",
    );
  }

  /* *
   *
   *  Live Range Lifecycle
   *
   * */

  /**
   * @param {object} [options]
   * @param {boolean} [options.refresh=false]
   * @returns {boolean}
   */
  synchronizeLiveRange({ refresh = false } = {}) {
    if (this.destroyed || !this.liveController) {
      return false;
    }

    const state = this.liveController.getState();

    if (!state.active) {
      return true;
    }

    // Historical ranges never poll the intraday endpoint.
    if (!this.isIntradayRange()) {
      if (state.pauseReasons.includes(LIVE_PAUSE_HISTORICAL_RANGE)) {
        return true;
      }

      return this.liveController.pause(LIVE_PAUSE_HISTORICAL_RANGE);
    }

    // Returning to intraday removes only the range-owned pause
    // reason.
    if (state.pauseReasons.includes(LIVE_PAUSE_HISTORICAL_RANGE)) {
      const resumed = this.liveController.resume(LIVE_PAUSE_HISTORICAL_RANGE);

      // When the intraday record does not exist yet, request data
      // immediately after returning from a historical range.
      if (resumed && refresh && !this.getRangeRecord(this.getIntradayRange())) {
        this.liveController.refresh();
      }

      return resumed;
    }

    if (refresh && !state.paused) {
      return this.liveController.refresh();
    }

    return true;
  }

  /* *
   *
   *  Range Selection
   *
   * */

  /**
   * @param {*} range
   * @param {object} [options]
   * @param {boolean} [options.force=false]
   * @param {boolean} [options.resetViewport=false]
   * @param {boolean} [options.redraw=true]
   * @param {boolean|object} [options.animation=false]
   * @param {boolean} [options.refreshLive=true]
   * @returns {boolean}
   */
  setRange(range, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeMarketChartRange(range);

    // Use UI/runtime availability rather than requiring an
    // already-stored record. This is what keeps 1D selectable when
    // its live source exists.
    if (!this.isRangeAvailable(normalizedRange)) {
      console.warn(`Market Chart range "${normalizedRange}" is unavailable.`);

      return false;
    }

    /* ------------------------------------------------------------
     * Same Range
     * ------------------------------------------------------------ */

    if (normalizedRange === this.currentRange && options.force !== true) {
      if (options.resetViewport === true) {
        this.userDetachedFromLive = false;

        this.liveViewportDuration = this.configuration.liveWindowDuration;

        this.setFollowLatest(false, {
          source: "range-reset",
        });

        this.applyDefaultViewport(options.redraw !== false);
      }

      this.synchronizeLiveRange({
        refresh: options.refreshLive !== false,
      });

      return true;
    }

    /* ------------------------------------------------------------
     * New Range
     * ------------------------------------------------------------ */

    const previousRange = this.currentRange;

    const previousMode = this.currentMode;

    if (!this.isIntradayRange(normalizedRange)) {
      this.liveController?.pause(LIVE_PAUSE_HISTORICAL_RANGE);
    }

    this.currentRange = normalizedRange;

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      normalizedRange,
    );

    this.userDetachedFromLive = false;

    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.setFollowLatest(false, {
      source: "range",
    });

    const updated = this.refreshChart({
      preserveViewport: false,

      redraw: options.redraw !== false,

      animation: options.animation ?? false,
    });

    if (!updated) {
      this.currentRange = previousRange;

      this.currentMode = previousMode;

      this.synchronizeLiveRange({
        refresh: false,
      });

      return false;
    }

    this.updateControls();

    this.updateLastUpdated(this.getLatestTimestamp());

    this.synchronizeLiveRange({
      refresh: options.refreshLive !== false,
    });

    dispatchChartEvent(this.element, "marketchartrangechange", {
      range: this.currentRange,

      previousRange,

      controller: this,
    });

    return true;
  }

  /* *
   *
   *  Mode Selection
   *
   * */

  /**
   * Switches the primary series' presentation mode. Unlike range
   * changes, a mode switch always goes through
   * {@link MarketChartController#rebuildChart} — a full Highstock
   * teardown/recreate — rather than incremental series reconciliation,
   * trading a little redraw efficiency (this only ever runs on a
   * click) for a guarantee that no stale rendering state from the
   * previous renderer can survive the switch.
   *
   * @param {*} mode
   * @param {object} [options]
   * @param {boolean} [options.force=false]
   * @returns {boolean}
   */
  setMode(mode, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedMode = normalizeMarketChartMode(mode);

    if (!this.isModeAvailable(normalizedMode)) {
      console.warn(
        `Market Chart mode "${normalizedMode}" is unavailable for range "${this.currentRange}".`,
      );

      return false;
    }

    if (normalizedMode === this.currentMode && options.force !== true) {
      return true;
    }

    const previousMode = this.currentMode;

    this.currentMode = normalizedMode;

    let updated = false;

    try {
      updated = this.rebuildChart({
        preserveViewport: true,
      });
    } catch (error) {
      console.error("Market Chart mode switch failed.", error);

      this.showMessage("error");

      dispatchChartEvent(this.element, "marketcharterror", {
        error,

        controller: this,
      });

      updated = false;
    }

    if (!updated) {
      this.currentMode = previousMode;

      return false;
    }

    this.updateControls();

    dispatchChartEvent(this.element, "marketchartmodechange", {
      mode: this.currentMode,

      previousMode,

      controller: this,
    });

    return true;
  }

  /* *
   *
   *  External Range Data
   *
   * */

  /**
   * @param {*} range
   * @param {*} record
   * @param {object} [options]
   * @param {boolean} [options.preserveViewport=false]
   * @param {boolean} [options.redraw=true]
   * @param {boolean|object} [options.animation=false]
   * @returns {boolean}
   */
  setRangeRecord(range, record, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeMarketChartRange(range);

    if (!isMarketChartRangeSupported(normalizedRange, this.capabilities)) {
      return false;
    }

    if (!setMarketChartRangeRecord(this.ranges, normalizedRange, record)) {
      return false;
    }

    this.refreshAvailableRanges();

    this.updateControls();

    // Inactive ranges are data only.
    if (normalizedRange !== this.currentRange) {
      return true;
    }

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      this.currentRange,
    );

    const updated = this.refreshChart({
      preserveViewport: options.preserveViewport === true,

      redraw: options.redraw !== false,

      animation: options.animation ?? false,
    });

    if (updated) {
      this.updateLastUpdated(this.getLatestTimestamp());
    }

    return updated;
  }

  /**
   * @param {*} ranges
   * @param {object} [options]
   * @param {boolean} [options.merge=false]
   * @param {boolean} [options.preserveViewport=false]
   * @param {boolean} [options.redraw=true]
   * @param {boolean|object} [options.animation=false]
   * @param {boolean} [options.refreshLive=false]
   * @returns {boolean}
   */
  setRanges(ranges, options = {}) {
    if (this.destroyed || !isPlainObject(ranges)) {
      return false;
    }

    const normalized = normalizeMarketChartRanges(ranges, {
      capabilities: this.capabilities,
    });

    this.ranges =
      options.merge === true
        ? {
            ...this.ranges,
            ...normalized,
          }
        : normalized;

    this.refreshAvailableRanges();

    // Do not force the chart away from 1D merely because the
    // current intraday snapshot record is absent while a valid live
    // source exists.
    if (!this.isRangeAvailable(this.currentRange)) {
      this.currentRange =
        getFirstAvailableMarketChartRange(
          this.ranges,
          this.configuration.range,
          this.capabilities,
        ) || this.configuration.range;
    }

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      this.currentRange,
    );

    this.userDetachedFromLive = false;

    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.setFollowLatest(false, {
      source: "ranges",
    });

    this.updateControls();

    const updated = this.refreshChart({
      preserveViewport: options.preserveViewport === true,

      redraw: options.redraw !== false,

      animation: options.animation ?? false,
    });

    if (updated) {
      this.updateLastUpdated(this.getLatestTimestamp());

      this.synchronizeLiveRange({
        refresh: options.refreshLive === true,
      });
    }

    return updated;
  }

  /* *
   *
   *  Controls
   *
   * */

  /**
   * @returns {void}
   */
  bindControls() {
    if (!this.controlsRoot) {
      return;
    }

    const signal = this.listenerController.signal;

    this.controlsRoot.addEventListener("click", this.handleRangeClick, {
      signal,
    });

    this.controlsRoot.addEventListener("click", this.handleModeClick, {
      signal,
    });
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  handleRangeClick(event) {
    const selector =
      this.configuration.controls?.rangeSelector || "[data-chart-range]";

    const button = event.target?.closest?.(selector);

    if (
      !button ||
      !this.controlsRoot?.contains(button) ||
      button.disabled ||
      button.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }

    event.preventDefault();

    this.setRange(button.dataset.chartRange || button.dataset.range, {
      resetViewport: true,
    });
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  handleModeClick(event) {
    const selector =
      this.configuration.controls?.typeSelector ||
      "[data-chart-type], [data-chart-mode]";

    const button = event.target?.closest?.(selector);

    if (
      !button ||
      !this.controlsRoot?.contains(button) ||
      button.disabled ||
      button.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }

    event.preventDefault();

    this.setMode(button.dataset.chartType || button.dataset.chartMode);
  }

  /**
   * @returns {void}
   */
  updateControls() {
    if (!this.controlsRoot) {
      return;
    }

    /* ------------------------------------------------------------
     * Range Controls
     * ------------------------------------------------------------ */

    const rangeSelector =
      this.configuration.controls?.rangeSelector || "[data-chart-range]";

    this.controlsRoot.querySelectorAll(rangeSelector).forEach((button) => {
      const range = normalizeMarketChartRange(
        button.dataset.chartRange || button.dataset.range,
      );

      const active = range === this.currentRange;

      // Critical: 1D may be selectable from its live source even
      // before a stored snapshot record exists.
      const available = this.isRangeAvailable(range);

      button.classList.toggle("is-active", active);

      button.setAttribute("aria-pressed", active ? "true" : "false");

      button.disabled = !available;

      button.setAttribute("aria-disabled", available ? "false" : "true");
    });

    /* ------------------------------------------------------------
     * Mode Controls
     * ------------------------------------------------------------ */

    const modeSelector =
      this.configuration.controls?.typeSelector ||
      "[data-chart-type], [data-chart-mode]";

    this.controlsRoot.querySelectorAll(modeSelector).forEach((button) => {
      const mode = normalizeMarketChartMode(
        button.dataset.chartType || button.dataset.chartMode,
      );

      const active = mode === this.currentMode;

      const available = this.isModeAvailable(mode);

      button.classList.toggle("is-active", active);

      button.setAttribute("aria-pressed", active ? "true" : "false");

      button.disabled = !available;

      button.setAttribute("aria-disabled", available ? "false" : "true");
    });
  }

  /* *
   *
   *  Intraday Record
   *
   * */

  /**
   * @returns {object} The intraday range record, creating an empty one if absent.
   */
  ensureIntradayRecord() {
    const range = this.getIntradayRange();

    let record = this.ranges[range];

    if (record) {
      return record;
    }

    record = {
      comparisonValue: toFiniteNumber(this.configuration.previousClose),

      trend: [],

      candlestick: [],
    };

    this.ranges[range] = record;

    this.refreshAvailableRanges();

    this.updateControls();

    return record;
  }

  /* *
   *
   *  Live Presentation
   *
   * */

  /**
   * @param {string} [direction]
   * @returns {boolean}
   */
  synchronizeLivePresentation(direction) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const nextDirection = direction || this.getDirection();

    if (nextDirection === this.presentationDirection) {
      return false;
    }

    this.element.dataset.chartDirection = nextDirection;

    // One option snapshot for main + navigator.
    const chartOptions = this.createOptions();

    const mainOptions = chartOptions.series?.[0];

    const mainSeries = this.getMainSeries();

    if (!mainSeries || !mainOptions) {
      return false;
    }

    if (this.currentMode !== "candlestick") {
      applySeriesPresentation(mainSeries, mainOptions);
    }

    const navigatorOptions = chartOptions.navigator?.series;

    if (isPlainObject(navigatorOptions)) {
      for (const navigatorSeries of this.getNavigatorSeriesList()) {
        applySeriesPresentation(navigatorSeries, navigatorOptions);
      }
    }

    this.presentationDirection = nextDirection;

    return true;
  }

  /* *
   *
   *  Visible Live Data
   *
   * */

  /**
   * @param {object} operations
   * @param {Array} operations.trendOperations
   * @param {Array} operations.candleOperations
   * @returns {boolean}
   */
  synchronizeVisibleLiveData({ trendOperations, candleOperations }) {
    const mainSeries = this.getMainSeries();

    if (!mainSeries) {
      return false;
    }

    const mainData = this.getActiveData();

    const mainOperations =
      this.currentMode === "candlestick" ? candleOperations : trendOperations;

    const mainChanged = applySeriesOperations(
      mainSeries,
      mainOperations,
      mainData,
    );

    // Navigator receives the exact trend operations incrementally.
    const navigatorChanged = this.applyNavigatorLiveOperations(trendOperations);

    if (!mainChanged && !navigatorChanged) {
      return false;
    }

    // Presentation is applied after data mutations.
    const direction = this.getDirection();

    if (direction !== this.presentationDirection) {
      this.synchronizeLivePresentation(direction);
    }

    return true;
  }

  /* *
   *
   *  Live Application
   *
   * */

  /**
   * Applies one live payload to canonical data and, if the intraday
   * range is currently visible, to the chart itself.
   *
   * A silent polling gap (the tab was hidden, the device went offline,
   * or the connection was otherwise interrupted for far longer than
   * one normal poll interval) is not bridged as a smooth diagonal line
   * across the missing period: a `null` point is inserted immediately
   * before the new point, which — because `connectNulls` is left at
   * its default `false` on every series — breaks the line/area rather
   * than fabricating a move that never happened.
   *
   * @param {*} payload
   * @param {object} [metadata]
   * @returns {boolean} Whether canonical data changed.
   */
  applyLiveData(payload, metadata = {}) {
    if (this.destroyed) {
      return false;
    }

    const accepted = normalizeAcceptedLiveItems(payload);

    if (!accepted.length) {
      return false;
    }

    const range = this.getIntradayRange();

    const record = this.ensureIntradayRecord();

    const visible = this.currentRange === range;

    const activeWasEmpty = visible && !this.hasActiveData();

    // Capture the current latest timestamp before mutating canonical
    // data. This lets us distinguish a current-timestamp correction
    // from a historical correction from a genuinely new market
    // timestamp.
    const previousLatestTimestamp = record.trend.length
      ? record.trend[record.trend.length - 1][0]
      : null;

    const availabilityMayChange =
      record.trend.length === 0 || record.candlestick.length === 0;

    const trendOperations = [];

    const candleOperations = [];

    let latestAcceptedPoint = null;

    let evictedCount = 0;

    const onEvict = (overflow) => {
      evictedCount += overflow;
    };

    // Threshold beyond which a gap between two trend points is
    // treated as a silent period rather than an ordinary tick.
    //
    // This is deliberately based on the data's own expected cadence
    // (candleBucketSize — the minute-bar granularity of the data
    // itself), NOT on the network polling interval. Those are
    // unrelated clocks: a feed can legitimately emit points a full
    // candleBucketSize apart while being polled far more frequently
    // than that (an accelerated/simulated feed, or simply a market
    // that only produces a new minute-bar occasionally). Using the
    // poll interval as the threshold would misclassify every
    // ordinary tick as a "silent gap," fragmenting the line with a
    // break on every single update.
    const dataCadence = toPositiveNumber(
      this.configuration.candleBucketSize,
      DEFAULT_CANDLE_BUCKET_SIZE,
    );

    const gapBreakMultiplier = toPositiveNumber(
      this.configuration.live?.gapBreakMultiplier,
      DEFAULT_LIVE_GAP_BREAK_MULTIPLIER,
    );

    const gapThreshold = dataCadence * gapBreakMultiplier;

    /* ------------------------------------------------------------
     * Canonical Data Mutation
     * ------------------------------------------------------------ */

    for (const { sourcePoint, pricePoint } of accepted) {
      latestAcceptedPoint = pricePoint;

      const previousTrendPoint = record.trend[record.trend.length - 1] ?? null;

      if (
        previousTrendPoint &&
        pricePoint[0] - previousTrendPoint[0] > gapThreshold
      ) {
        // A silent gap (tab hidden, offline, backgrounded) —
        // break the series instead of bridging it with a
        // fabricated straight line. The break point sits one
        // millisecond after the last known point so it never
        // collides with, or reorders relative to, real data.
        trendOperations.push(
          upsertPoint(
            record.trend,

            [previousTrendPoint[0] + 1, null],

            this.configuration.maxPoints,

            onEvict,
          ),
        );
      }

      trendOperations.push(
        upsertPoint(
          record.trend,
          pricePoint,
          this.configuration.maxPoints,
          onEvict,
        ),
      );

      const candleOperation = mergeLiveCandle(
        record.candlestick,
        sourcePoint,
        pricePoint,
        {
          bucketSize: this.configuration.candleBucketSize,

          maxPoints: this.configuration.maxPoints,

          onEvict,
        },
      );

      if (candleOperation) {
        candleOperations.push(candleOperation);
      }
    }

    /* ------------------------------------------------------------
     * Memory Cap Diagnostic
     * ------------------------------------------------------------ */

    if (evictedCount > 0) {
      console.warn(
        `Market Chart (${this.configuration.symbol || "unknown"}): ` +
          `maxPoints (${this.configuration.maxPoints}) was exceeded and ` +
          `${evictedCount} point(s) were removed from the beginning of the ` +
          "intraday session. Increase maxPoints if the entire active session " +
          "must remain available.",
      );
    }

    /* ------------------------------------------------------------
     * Changed State
     * ------------------------------------------------------------ */

    const trendChanged = trendOperations.some(
      (operation) => operation?.type !== "noop",
    );

    const candlesChanged = candleOperations.some(
      (operation) => operation?.type !== "noop",
    );

    // Successful request but no canonical change. The market may
    // simply be closed, or the backend may have returned the
    // current unchanged timestamp.
    if (!trendChanged && !candlesChanged) {
      return false;
    }

    const currentLatestTimestamp = record.trend.length
      ? record.trend[record.trend.length - 1][0]
      : null;

    const genuinelyNewTimestamp =
      previousLatestTimestamp !== null &&
      currentLatestTimestamp !== null &&
      currentLatestTimestamp > previousLatestTimestamp;

    /* ------------------------------------------------------------
     * Controls
     * ------------------------------------------------------------ */

    if (availabilityMayChange) {
      this.updateControls();
    }

    /* ------------------------------------------------------------
     * Visible Chart Synchronization
     * ------------------------------------------------------------ */

    let chartChanged = false;

    if (visible) {
      if (activeWasEmpty) {
        // Initial empty state recovered after the first valid
        // live payload. A full refresh is appropriate here
        // because no valid chart series existed previously.
        this.userDetachedFromLive = false;

        this.liveViewportDuration = this.configuration.liveWindowDuration;

        this.setFollowLatest(false, {
          source: "live-recovery",
        });

        chartChanged = this.refreshChart({
          preserveViewport: false,

          redraw: true,

          animation: false,
        });
      } else {
        // Normal live hot path. Main series and navigator both
        // receive incremental operations.
        chartChanged = this.synchronizeVisibleLiveData({
          trendOperations,
          candleOperations,
        });

        if (chartChanged) {
          // Move the live viewport only when a genuinely newer
          // timestamp has arrived. Same-timestamp corrections
          // must not move the user.
          if (genuinelyNewTimestamp && !this.userDetachedFromLive) {
            this.setFollowLatest(true, {
              source: "new-data",
            });

            this.applyLiveViewport(false);
          }

          // Exactly one redraw for: main data mutation,
          // navigator data mutation, semantic presentation
          // mutation, and live viewport mutation.
          this.chart?.redraw(false);

          if (this.state !== "ready") {
            this.clearMessage();

            this.setState("ready");
          }
        }
      }
    }

    /* ------------------------------------------------------------
     * Updated Timestamp
     * ------------------------------------------------------------ */

    this.updateLastUpdated(currentLatestTimestamp ?? latestAcceptedPoint?.[0]);

    /* ------------------------------------------------------------
     * Public Event
     * ------------------------------------------------------------ */

    dispatchChartEvent(this.element, "marketchartliveupdate", {
      point: latestAcceptedPoint,

      points: accepted.map(({ sourcePoint }) => sourcePoint),

      metadata,

      range,

      visibleRange: this.currentRange,

      visible,

      genuinelyNewTimestamp,

      chartChanged,

      controller: this,
    });

    // true: canonical data changed.
    return true;
  }

  /* *
   *
   *  Live Controller
   *
   * */

  /**
   * @returns {MarketChartLiveController|null}
   */
  initializeLiveUpdates() {
    const live = this.configuration.live;

    if (
      this.destroyed ||
      this.capabilities.live !== true ||
      !live ||
      live.enabled === false ||
      typeof live.fetchUpdates !== "function"
    ) {
      return null;
    }

    const intradayRange = this.getIntradayRange();

    if (!isMarketChartRangeSupported(intradayRange, this.capabilities)) {
      return null;
    }

    // Exactly one live polling controller belongs to this chart
    // controller.
    this.liveController?.destroy();

    this.liveController = createMarketChartLiveController({
      interval: live.interval ?? 60_000,

      alignToInterval: live.alignToInterval ?? true,

      // Usually false because the initial snapshot has already
      // been loaded.
      immediate: live.immediate ?? false,

      pauseWhenHidden: live.pauseWhenHidden ?? true,

      retry: live.retry ?? true,

      maxRetryDelay: live.maxRetryDelay,

      requestTimeout: live.requestTimeout,

      environment: {
        window: this.window,

        document: this.document,

        navigator: this.window?.navigator,

        now: this.configuration.environment?.now,

        setTimeout: this.configuration.environment?.setTimeout,

        clearTimeout: this.configuration.environment?.clearTimeout,

        AbortController: this.configuration.environment?.AbortController,
      },

      fetchUpdates: ({ signal, requestedAt, sequence, requestId }) =>
        live.fetchUpdates({
          signal,
          requestedAt,
          sequence,
          requestId,

          symbol: this.configuration.symbol,

          range: intradayRange,

          // Canonical live timeline is always trend/close.
          mode: "trend",

          // Inclusive reconciliation boundary. The API may
          // return a correction for the latest timestamp, a
          // new timestamp, or multiple timestamps since this
          // point.
          since: this.getLatestTimestamp(intradayRange, "trend"),

          sinceInclusive: true,

          visibleRange: this.currentRange,

          visibleMode: this.currentMode,

          controller: this,
        }),

      onData: (payload, metadata) => this.applyLiveData(payload, metadata),

      onStateChange: (state) => {
        this.setLiveState(state);

        live.onStateChange?.(state, this);
      },

      onError: (error, metadata) => {
        dispatchChartEvent(this.element, "marketchartliveerror", {
          error,
          metadata,

          controller: this,
        });

        live.onError?.(error, metadata, this);
      },
    });

    if (live.autostart !== false) {
      this.liveController.start();

      // Historical initial range immediately installs its own
      // pause reason.
      this.synchronizeLiveRange({
        refresh: false,
      });
    }

    return this.liveController;
  }

  /* *
   *
   *  Live Polling API
   *
   * */

  /**
   * @returns {boolean}
   */
  startLive() {
    if (this.destroyed || !this.liveController) {
      return false;
    }

    const started = this.liveController.start();

    if (started) {
      this.synchronizeLiveRange({
        refresh: this.isIntradayRange(),
      });
    }

    return started;
  }

  /**
   * @param {string} [reason='manual']
   * @returns {boolean}
   */
  pauseLive(reason = "manual") {
    if (this.destroyed) {
      return false;
    }

    return this.liveController?.pause(reason) ?? false;
  }

  /**
   * @param {string} [reason='manual']
   * @returns {boolean}
   */
  resumeLiveUpdates(reason = "manual") {
    if (this.destroyed || !this.liveController) {
      return false;
    }

    // Historical range ownership cannot be overridden by arbitrary
    // external resume requests.
    if (reason !== LIVE_PAUSE_HISTORICAL_RANGE && !this.isIntradayRange()) {
      return false;
    }

    return this.liveController.resume(reason);
  }

  /**
   * @returns {boolean}
   */
  refreshLive() {
    if (this.destroyed || !this.isIntradayRange()) {
      return false;
    }

    return this.liveController?.refresh() ?? false;
  }

  /**
   * @returns {boolean}
   */
  stopLive() {
    if (this.destroyed) {
      return false;
    }

    return this.liveController?.stop() ?? false;
  }

  /* *
   *
   *  Live Viewport API
   *
   * */

  /**
   * @param {object} [options]
   * @param {number} [options.liveWindowDuration]
   * @param {boolean} [options.redraw=true]
   * @returns {boolean}
   */
  resumeLive(options = {}) {
    if (this.destroyed || !this.isIntradayRange()) {
      return false;
    }

    this.userDetachedFromLive = false;

    this.liveViewportDuration = toPositiveNumber(
      options.liveWindowDuration,

      this.configuration.liveWindowDuration ||
        getBoundsDuration(this.getViewport()) ||
        null,
    );

    this.setFollowLatest(true, {
      source: "programmatic",
    });

    return this.applyLiveViewport(options.redraw !== false);
  }

  /**
   * @param {object} [options]
   * @param {string} [options.source='programmatic']
   * @param {string} [options.trigger='manual']
   * @returns {boolean}
   */
  pauseLiveFollowing(options = {}) {
    if (this.destroyed) {
      return false;
    }

    this.userDetachedFromLive = true;

    this.setFollowLatest(false, {
      source: options.source || "programmatic",

      trigger: options.trigger || "manual",
    });

    return true;
  }

  /**
   * @param {number|null|false} duration `null`/`false`/`0` shows the complete intraday session.
   * @param {object} [options]
   * @param {boolean} [options.apply=false]
   * @param {boolean} [options.redraw=true]
   * @returns {boolean}
   */
  setLiveWindowDuration(duration, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const clearsWindow =
      duration === null || duration === false || Number(duration) === 0;

    const value = clearsWindow ? null : toPositiveNumber(duration, null);

    if (value === null && !clearsWindow) {
      return false;
    }

    this.configuration.liveWindowDuration = value;

    this.liveViewportDuration = value;

    if (
      options.apply === true &&
      this.followLatest &&
      !this.userDetachedFromLive &&
      this.isIntradayRange()
    ) {
      return this.applyLiveViewport(options.redraw !== false);
    }

    return true;
  }

  /* *
   *
   *  Last Updated
   *
   *  The "Updated" indicator is intentionally shown only for the
   *  intraday range: historical ranges (1W, 1M, ...) are snapshots, not
   *  a live feed, so a per-second "Updated" timestamp on them would be
   *  misleading. When the intraday session itself is stale — e.g. the
   *  person opens the chart on a new day before the market has produced
   *  a new tick — the timestamp falls back to showing the date, not
   *  just a same-day time that would otherwise read as "just now".
   *
   * */

  /**
   * @returns {{time: Intl.DateTimeFormat, dateTime: Intl.DateTimeFormat, dayKey: Intl.DateTimeFormat}}
   */
  getLastUpdatedFormatters() {
    if (this.lastUpdatedFormatters) {
      return this.lastUpdatedFormatters;
    }

    const language = this.configuration.language || "en";

    const timeZone = this.configuration.timeZone || "Asia/Riyadh";

    const build = (options) => {
      try {
        return new Intl.DateTimeFormat(language, { timeZone, ...options });
      } catch {
        return new Intl.DateTimeFormat("en", {
          timeZone: "Asia/Riyadh",

          ...options,
        });
      }
    };

    this.lastUpdatedFormatters = {
      time: build({
        hour: "2-digit",

        minute: "2-digit",

        second: "2-digit",

        hourCycle: "h23",
      }),

      dateTime: build({
        day: "2-digit",

        month: "short",

        hour: "2-digit",

        minute: "2-digit",

        hourCycle: "h23",
      }),

      dayKey: build({
        year: "numeric",

        month: "2-digit",

        day: "2-digit",
      }),
    };

    return this.lastUpdatedFormatters;
  }

  /**
   * @param {Date} date
   * @returns {string} A same-day time (`"08:15:04"`) or, when `date` falls on an earlier day than now, a dated stamp (`"20 Sep, 08:15"`).
   */
  formatLastUpdated(date) {
    const formatters = this.getLastUpdatedFormatters();

    const now = new Date(this.liveController?.now?.() ?? Date.now());

    const isSameDay =
      formatters.dayKey.format(date) === formatters.dayKey.format(now);

    return isSameDay
      ? formatters.time.format(date)
      : formatters.dateTime.format(date);
  }

  /**
   * Updates the "Updated" indicator. Only rendered for the intraday
   * range — see the section note above — and hidden entirely for every
   * other range.
   *
   * Hides the *whole* "Updated" block — its own wrapper if the markup
   * provides one (`[data-chart-updated]`, e.g. the element wrapping
   * both a static "Updated" label and this value), or the value
   * element itself if not — so no orphaned label can be left visible
   * with an empty value next to it.
   *
   * @param {*} timestamp
   * @returns {boolean}
   */
  updateLastUpdated(timestamp) {
    const element = this.controlsRoot?.querySelector(
      "[data-chart-updated-time]",
    );

    if (!element) {
      return false;
    }

    const wrapper = element.closest("[data-chart-updated]") || element;

    if (!this.isIntradayRange()) {
      wrapper.hidden = true;

      element.removeAttribute("dateTime");

      element.textContent = "";

      return false;
    }

    const value = normalizeMarketChartTimestamp(timestamp);

    if (value === null) {
      return false;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    wrapper.hidden = false;

    element.dateTime = date.toISOString();

    element.textContent = this.formatLastUpdated(date);

    return true;
  }

  /* *
   *
   *  Rendering / Resize
   *
   * */

  /**
   * @returns {boolean}
   */
  isRenderable() {
    return Boolean(
      this.element.isConnected && this.element.getClientRects().length,
    );
  }

  /**
   * @param {FrameRequestCallback} callback
   * @returns {number}
   */
  requestFrame(callback) {
    if (typeof this.window?.requestAnimationFrame === "function") {
      return this.window.requestAnimationFrame(callback);
    }

    return this.window?.setTimeout
      ? this.window.setTimeout(callback, 16)
      : globalThis.setTimeout(callback, 16);
  }

  /**
   * @param {number|null} frame
   * @returns {void}
   */
  cancelFrame(frame) {
    if (frame === null) {
      return;
    }

    if (typeof this.window?.cancelAnimationFrame === "function") {
      this.window.cancelAnimationFrame(frame);

      return;
    }

    if (typeof this.window?.clearTimeout === "function") {
      this.window.clearTimeout(frame);

      return;
    }

    globalThis.clearTimeout?.(frame);
  }

  /**
   * @returns {void}
   */
  scheduleReflow() {
    if (this.destroyed || !this.chart || this.resizeFrame !== null) {
      return;
    }

    this.resizeFrame = this.requestFrame(() => {
      this.resizeFrame = null;

      this.reflow();
    });
  }

  /**
   * @returns {boolean}
   */
  reflow() {
    if (this.destroyed || !this.chart || !this.isRenderable()) {
      return false;
    }

    this.chart.reflow();

    return true;
  }

  /* *
   *
   *  Theme
   *
   * */

  /**
   * @returns {void}
   */
  handleThemeMutation() {
    if (this.destroyed || this.themeFrame !== null) {
      return;
    }

    this.themeFrame = this.requestFrame(() => {
      this.themeFrame = null;

      this.refreshTheme();
    });
  }

  /**
   * @returns {boolean}
   */
  refreshTheme() {
    if (this.destroyed || !this.chart) {
      return false;
    }

    // Theme changes are rare structural refreshes.
    return this.refreshChart({
      preserveViewport: true,

      // Theme refresh changes navigator presentation/chrome, not
      // its data.
      navigatorData: false,

      redraw: true,

      animation: false,
    });
  }

  /* *
   *
   *  Observers
   *
   * */

  /**
   * @returns {void}
   */
  initializeObservers() {
    if (this.destroyed) {
      return;
    }

    const ResizeObserverConstructor =
      this.window?.ResizeObserver || globalThis.ResizeObserver;

    if (typeof ResizeObserverConstructor === "function") {
      this.resizeObserver = new ResizeObserverConstructor(() => {
        this.scheduleReflow();
      });

      // Observe host only.
      this.resizeObserver.observe(this.element);
    } else {
      this.window?.addEventListener(
        "resize",
        () => {
          this.scheduleReflow();
        },
        {
          passive: true,

          signal: this.listenerController.signal,
        },
      );
    }

    const MutationObserverConstructor =
      this.window?.MutationObserver || globalThis.MutationObserver;

    if (typeof MutationObserverConstructor === "function") {
      this.themeObserver = new MutationObserverConstructor(
        this.handleThemeMutation,
      );

      this.themeObserver.observe(this.document.documentElement, {
        attributes: true,

        attributeFilter: ["data-theme", "data-contrast", "dir"],
      });
    }
  }

  /* *
   *
   *  Initialization
   *
   * */

  /**
   * @returns {MarketChartController}
   */
  initialize() {
    if (this.destroyed || this.initialized) {
      return this;
    }

    this.initialized = true;

    this.showMessage("loading");

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      this.currentRange,
    );

    this.userDetachedFromLive = false;

    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.setFollowLatest(false, {
      source: "initialize",
    });

    this.bindControls();

    this.renderInitialChart();

    this.initializeLiveUpdates();

    this.initializeObservers();

    this.updateControls();

    this.updateLastUpdated(this.getLatestTimestamp());

    if (this.hasActiveData()) {
      this.clearMessage();

      this.setState("ready");
    } else {
      this.showMessage("empty");
    }

    dispatchChartEvent(this.element, "marketchartready", {
      controller: this,
    });

    return this;
  }

  /* *
   *
   *  Public State
   *
   * */

  /**
   * @returns {Highcharts.Chart|null}
   */
  getChart() {
    return this.chart;
  }

  /**
   * @returns {object} A snapshot of the controller's current public state.
   */
  getState() {
    const navigatorSeries = this.getNavigatorSeries();

    return {
      state: this.state,

      destroyed: this.destroyed,

      initialized: this.initialized,

      renderable: this.isRenderable(),

      range: this.currentRange,

      mode: this.currentMode,

      direction: this.getDirection(),

      comparisonValue: this.getComparisonValue(),

      capabilities: {
        ...this.capabilities,
      },

      // Stored backend ranges. Runtime-selectable 1D can
      // additionally be available through the live source even
      // before it appears in this stored-range list.
      availableRanges: [...this.availableRanges],

      navigator: {
        enabled: Boolean(navigatorSeries),

        followLatest: this.followLatest,

        userDetachedFromLive: this.userDetachedFromLive,

        viewport: this.getViewport(),

        dataBounds: getDataBounds(this.getActiveData()),

        liveWindowDuration: this.liveViewportDuration,

        seriesCount: this.getNavigatorSeriesList().length,

        color: navigatorSeries?.color ?? null,

        pointCount: navigatorSeries?.data?.length ?? 0,
      },

      live: this.liveController?.getState() || null,
    };
  }

  /* *
   *
   *  Destruction
   *
   * */

  /**
   * @returns {boolean}
   */
  destroy() {
    if (this.destroyed) {
      return false;
    }

    // Set first so asynchronous work cannot continue during
    // teardown.
    this.destroyed = true;

    /* ------------------------------------------------------------
     * Live
     * ------------------------------------------------------------ */

    this.liveController?.destroy();

    this.liveController = null;

    /* ------------------------------------------------------------
     * Highcharts Events
     * ------------------------------------------------------------ */

    this.removeAxisEvent?.();

    this.removeAxisEvent = null;

    /* ------------------------------------------------------------
     * DOM Events
     * ------------------------------------------------------------ */

    this.listenerController.abort();

    /* ------------------------------------------------------------
     * Observers
     * ------------------------------------------------------------ */

    this.resizeObserver?.disconnect();

    this.themeObserver?.disconnect();

    this.resizeObserver = null;

    this.themeObserver = null;

    /* ------------------------------------------------------------
     * Frames
     * ------------------------------------------------------------ */

    if (this.resizeFrame !== null) {
      this.cancelFrame(this.resizeFrame);
    }

    if (this.themeFrame !== null) {
      this.cancelFrame(this.themeFrame);
    }

    this.resizeFrame = null;

    this.themeFrame = null;

    /* ------------------------------------------------------------
     * Highstock
     * ------------------------------------------------------------ */

    this.chart?.destroy();

    this.chart = null;

    /* ------------------------------------------------------------
     * DOM State
     * ------------------------------------------------------------ */

    this.clearMessage();

    this.element.removeAttribute("data-chart-state");

    this.element.removeAttribute("data-chart-message");

    this.element.removeAttribute("data-chart-direction");

    this.element.removeAttribute("data-chart-live-state");

    this.element.removeAttribute("data-chart-follow-live");

    this.section?.removeAttribute("data-chart-live-state");

    this.section?.removeAttribute("data-chart-follow-live");

    this.section?.setAttribute("aria-busy", "false");

    /* ------------------------------------------------------------
     * Registry
     * ------------------------------------------------------------ */

    if (chartRegistry.get(this.element) === this) {
      chartRegistry.delete(this.element);
    }

    dispatchChartEvent(this.element, "marketchartdestroy", {
      controller: this,
    });

    return true;
  }
}

/* *
 *
 *  Creation Error
 *
 * */

/**
 * @param {Element} element
 * @param {string} message
 * @returns {void}
 */
function renderCreationError(element, message) {
  if (!element) {
    return;
  }

  element.dataset.chartState = "error";

  element.dataset.chartMessage = message;

  element.querySelector(":scope > .market-chart__message")?.remove();

  const wrapper = element.ownerDocument.createElement("div");

  wrapper.className = "market-chart__message market-chart__message--error";

  wrapper.setAttribute("role", "alert");

  wrapper.setAttribute("aria-live", "assertive");

  const text = element.ownerDocument.createElement("p");

  text.className = "market-chart__message-text";

  text.textContent = message;

  wrapper.append(text);

  element.append(wrapper);
}

/* *
 *
 *  Public Factory
 *
 * */

/**
 * Creates (or replaces) the {@link MarketChartController} owning
 * `target`. If a controller already owns the element, it is destroyed
 * only after the replacement has been successfully constructed, so a
 * failed re-creation leaves the previous, working chart in place.
 *
 * @param {Element|string} target Element or selector.
 * @param {object} [configuration]
 * @returns {MarketChartController|null} `null` if `target` cannot be resolved or creation fails.
 */
export function createMarketChart(target, configuration = {}) {
  const source = isPlainObject(configuration) ? configuration : {};

  const document = source.document || globalThis.document;

  const element = resolveElement(target, document);

  if (!element) {
    console.error("Market Chart target could not be found.");

    return null;
  }

  const existing = chartRegistry.get(element);

  let controller = null;

  try {
    // Build/validate the replacement before destroying the current
    // owner.
    controller = new MarketChartController(element, source);

    // One host owns one controller.
    existing?.destroy();

    chartRegistry.set(element, controller);

    controller.initialize();

    return controller;
  } catch (error) {
    controller?.destroy();

    // Restore the existing controller only if it is still alive.
    if (existing && !existing.destroyed) {
      chartRegistry.set(element, existing);
    } else {
      chartRegistry.delete(element);
    }

    const message =
      controller?.configuration?.messages?.error || DEFAULT_MESSAGES.error;

    renderCreationError(element, message);

    console.error("Market Chart creation failed.", error);

    dispatchChartEvent(element, "marketcharterror", {
      error,

      controller: null,
    });

    return null;
  }
}

/* *
 *
 *  Registry API
 *
 * */

/**
 * @param {Element|string} target
 * @returns {MarketChartController|null}
 */
export function getMarketChart(target) {
  const element = resolveElement(target);

  return element ? chartRegistry.get(element) || null : null;
}

/**
 * @param {Element|string} target
 * @returns {boolean}
 */
export function destroyMarketChart(target) {
  const controller = getMarketChart(target);

  return controller ? controller.destroy() : false;
}

/**
 * @returns {number} The number of controllers destroyed.
 */
export function destroyAllMarketCharts() {
  const controllers = [...chartRegistry.values()];

  for (const controller of controllers) {
    controller.destroy();
  }

  chartRegistry.clear();

  return controllers.length;
}

/* *
 *
 *  Default Export
 *
 * */

const MarketChart = {
  createMarketChart,
  getMarketChart,
  destroyMarketChart,
  destroyAllMarketCharts,
  MarketChartController,
};

export default MarketChart;

/* *
 *
 *  Named Exports
 *
 * */

export { MarketChartController };
