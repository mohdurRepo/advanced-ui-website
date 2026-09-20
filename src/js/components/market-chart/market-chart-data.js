/* *
 *
 *  Market Chart — Data
 *
 *  Canonical data boundary between the application/API layer and the chart
 *  layer. Every value that reaches Highcharts has already passed through
 *  this module.
 *
 *  Highcharts only ever receives one of two point shapes:
 *
 *  - Trend / line:  `[timestamp, value]`
 *  - Candlestick:   `[timestamp, open, high, low, close]`
 *
 *  Responsibilities
 *  -----------------
 *  - Normalize chart modes, ranges, capabilities and timestamps.
 *  - Normalize raw trend/line and OHLC input into the shapes above.
 *  - Sort points by timestamp and de-duplicate them.
 *  - Normalize range records and range collections.
 *
 *  A *range record* stores exactly two arrays plus a comparison value:
 *
 *  ```js
 *  { comparisonValue, trend, candlestick }
 *  ```
 *
 *  `trend` is the single source of truth for scalar (close-price) data.
 *  "line" mode is a *presentation* of that same trend array — a different
 *  Highcharts series `type` — not a second stored dataset. There is nothing
 *  to keep in sync between "trend" and "line".
 *
 *  This module has no knowledge of Highcharts chart instances, DOM
 *  elements, network requests, live polling, navigator state, or viewport
 *  behavior. See `market-chart-live.js` and `market-chart.js` for those
 *  concerns.
 *
 * */

"use strict";

/* *
 *
 *  Constants
 *
 * */

/**
 * The set of chart presentation modes this module understands.
 *
 * @type {Set<string>}
 */
const CHART_MODES = new Set(["trend", "line", "candlestick"]);

/**
 * @type {string}
 */
const DEFAULT_MODE = "trend";

/**
 * @type {string}
 */
const DEFAULT_RANGE = "1D";

/**
 * @type {string}
 */
const DEFAULT_INTRADAY_RANGE = "1D";

/**
 * Hard ceiling on points retained per canonical array (trend or
 * candlestick) before the oldest points are evicted. Applied by the
 * controller's live-update path, not by this module directly.
 *
 * @type {number}
 */
const DEFAULT_MAX_POINTS = 1_000;

/**
 * Bucket width, in milliseconds, used to assemble a forming intraday
 * candle out of streaming last-price ticks when the backend does not
 * already provide complete OHLC.
 *
 * @type {number}
 */
const DEFAULT_CANDLE_BUCKET_SIZE = 60_000;

/**
 * Default chart capabilities, applied whenever the caller does not specify
 * its own. See {@link normalizeMarketChartCapabilities}.
 *
 * @type {Readonly<MarketChartCapabilities>}
 */
const DEFAULT_CAPABILITIES = Object.freeze({
  intraday: true,
  historical: true,
  live: false,
  navigator: true,
  intradayRange: DEFAULT_INTRADAY_RANGE,
});

/* *
 *
 *  Type Definitions (JSDoc only — no runtime effect)
 *
 *  @typedef {[number, number]} MarketChartTrendPoint
 *  @typedef {[number, number, number, number, number]} MarketChartCandlestickPoint
 *
 *  @typedef {object} MarketChartCapabilities
 *  @property {boolean} intraday          Whether the intraday range may be requested.
 *  @property {boolean} historical        Whether non-intraday ranges may be requested.
 *  @property {boolean} live              Whether live polling is permitted.
 *  @property {boolean} navigator         Whether the navigator may render.
 *  @property {string}  intradayRange     Which normalized range is "intraday" (default `"1D"`).
 *
 *  @typedef {object} MarketChartRangeRecord
 *  @property {number|null} comparisonValue          Reference value (e.g. previous close) for change display.
 *  @property {MarketChartTrendPoint[]} trend         Canonical trend/close-price series.
 *  @property {MarketChartCandlestickPoint[]} candlestick  Canonical OHLC series.
 *
 * */

/* *
 *
 *  Generic Helpers
 *
 * */

/**
 * Type guard for a plain, JSON-like object (excludes arrays, class
 * instances, and `null`-prototype edge cases other than literal `{}`).
 *
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
 * Coerces a value to a finite number, or `null` if that is not possible.
 * Rejects booleans and empty/whitespace strings explicitly so that values
 * such as `false` or `""` are not silently coerced to `0`.
 *
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
 * @returns {MarketChartRangeRecord} A fresh, empty range record.
 */
function createEmptyRangeRecord() {
  return {
    comparisonValue: null,
    trend: [],
    candlestick: [],
  };
}

/* *
 *
 *  Mode
 *
 * */

/**
 * Normalizes a chart presentation mode string.
 *
 * @param {*} mode
 *        Candidate mode. Matched case-insensitively against
 *        {@link CHART_MODES}.
 * @param {string} [fallback=DEFAULT_MODE]
 *        Used when `mode` does not resolve to a known mode.
 * @returns {'trend'|'line'|'candlestick'}
 */
function normalizeMarketChartMode(mode, fallback = DEFAULT_MODE) {
  const value = String(mode ?? "")
    .trim()
    .toLowerCase();

  if (CHART_MODES.has(value)) {
    return value;
  }

  const fallbackValue = String(fallback ?? "")
    .trim()
    .toLowerCase();

  return CHART_MODES.has(fallbackValue) ? fallbackValue : DEFAULT_MODE;
}

/* *
 *
 *  Range
 *
 * */

/**
 * Normalizes a range key to its canonical, upper-cased form (`"1D"`,
 * `"1W"`, `"ALL"`, ...). Ranges are otherwise free-form strings — this
 * module does not hard-code the full set of supported ranges.
 *
 * @param {*} range
 * @param {string} [fallback=DEFAULT_RANGE]
 * @returns {string}
 */
function normalizeMarketChartRange(range, fallback = DEFAULT_RANGE) {
  const value = String(range ?? "")
    .trim()
    .toUpperCase();

  if (value) {
    return value;
  }

  const fallbackValue = String(fallback ?? "")
    .trim()
    .toUpperCase();

  return fallbackValue || DEFAULT_RANGE;
}

/* *
 *
 *  Capabilities
 *
 * */

/**
 * Normalizes a partial capabilities object against
 * {@link DEFAULT_CAPABILITIES}. Every flag defaults to permissive
 * (`true`) except `live`, which defaults to `false` and must be opted
 * into explicitly.
 *
 * @param {Partial<MarketChartCapabilities>} [capabilities]
 * @returns {MarketChartCapabilities}
 */
function normalizeMarketChartCapabilities(capabilities = {}) {
  const source = isPlainObject(capabilities) ? capabilities : {};

  return {
    intraday: source.intraday !== false,
    historical: source.historical !== false,
    live: source.live === true,
    navigator: source.navigator !== false,
    intradayRange: normalizeMarketChartRange(
      source.intradayRange,
      DEFAULT_INTRADAY_RANGE,
    ),
  };
}

/**
 * @param {*} range
 * @param {MarketChartCapabilities} [capabilities=DEFAULT_CAPABILITIES]
 * @returns {boolean} Whether `range` is this configuration's intraday range.
 */
function isMarketChartIntradayRange(
  range,
  capabilities = DEFAULT_CAPABILITIES,
) {
  const normalizedCapabilities = normalizeMarketChartCapabilities(capabilities);

  return (
    normalizeMarketChartRange(range) === normalizedCapabilities.intradayRange
  );
}

/**
 * @param {*} range
 * @param {MarketChartCapabilities} [capabilities=DEFAULT_CAPABILITIES]
 * @returns {boolean}
 *          Whether `range` is currently requestable: the intraday range is
 *          gated by `capabilities.intraday`, every other range by
 *          `capabilities.historical`.
 */
function isMarketChartRangeSupported(
  range,
  capabilities = DEFAULT_CAPABILITIES,
) {
  const normalizedRange = normalizeMarketChartRange(range);
  const normalizedCapabilities = normalizeMarketChartCapabilities(capabilities);

  return normalizedRange === normalizedCapabilities.intradayRange
    ? normalizedCapabilities.intraday
    : normalizedCapabilities.historical;
}

/* *
 *
 *  Timestamp
 *
 * */

/**
 * Normalizes any reasonable timestamp representation to Highcharts'
 * expected millisecond epoch.
 *
 * Accepts:
 * - `Date` instances
 * - Unix seconds or milliseconds (numeric or numeric string)
 * - Any string parseable by `Date.parse`
 *
 * @param {*} value
 * @returns {number|null}
 */
function normalizeMarketChartTimestamp(value) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();

    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    /*
     * Heuristic: contemporary Unix timestamps in *seconds* fall below
     * this threshold, while millisecond timestamps fall above it. This
     * assumes real-world contemporary dates — a raw millisecond
     * timestamp before ~1973 would be misread as seconds — which is
     * safe for market data, which never predates that.
     */
    return Math.abs(numericValue) < 100_000_000_000
      ? numericValue * 1_000
      : numericValue;
  }

  const parsedValue = Date.parse(String(value));

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

/* *
 *
 *  Trend / Line Point
 *
 * */

/**
 * Normalizes one raw trend/line point, accepting either a `[x, y]` tuple
 * or an object carrying one of several conventional field-name aliases.
 *
 * @param {*} point
 * @returns {MarketChartTrendPoint|null}
 *          `null` when the point cannot be resolved to a finite
 *          `[timestamp, value]` pair.
 * @private
 */
function normalizeTrendPoint(point) {
  if (Array.isArray(point)) {
    const timestamp = normalizeMarketChartTimestamp(point[0]);
    const value = toFiniteNumber(point[1]);

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

/* *
 *
 *  Candlestick Point
 *
 * */

/**
 * Normalizes one raw OHLC point, accepting either a `[x, o, h, l, c]`
 * tuple or an object carrying conventional field-name aliases.
 *
 * Points with geometrically impossible OHLC values (open/close outside
 * the low/high interval, or high below low) are rejected rather than
 * silently rendered incorrectly.
 *
 * @param {*} point
 * @returns {MarketChartCandlestickPoint|null}
 * @private
 */
function normalizeCandlestickPoint(point) {
  let timestamp;
  let open;
  let high;
  let low;
  let close;

  if (Array.isArray(point)) {
    [timestamp, open, high, low, close] = point;
  } else if (isPlainObject(point)) {
    timestamp =
      point.x ??
      point.timestamp ??
      point.time ??
      point.dateTime ??
      point.date ??
      point.tradingDate;

    open = point.open ?? point.openPrice;
    high = point.high ?? point.highPrice;
    low = point.low ?? point.lowPrice;
    close =
      point.close ?? point.closePrice ?? point.indexPrice ?? point.lastPrice;
  } else {
    return null;
  }

  const normalizedTimestamp = normalizeMarketChartTimestamp(timestamp);
  const normalizedOpen = toFiniteNumber(open);
  const normalizedHigh = toFiniteNumber(high);
  const normalizedLow = toFiniteNumber(low);
  const normalizedClose = toFiniteNumber(close);

  if (
    normalizedTimestamp === null ||
    normalizedOpen === null ||
    normalizedHigh === null ||
    normalizedLow === null ||
    normalizedClose === null
  ) {
    return null;
  }

  // Reject impossible OHLC geometry — open and close must both sit
  // inside the low/high interval, and high must not be below low.
  if (
    normalizedHigh < normalizedLow ||
    normalizedOpen < normalizedLow ||
    normalizedOpen > normalizedHigh ||
    normalizedClose < normalizedLow ||
    normalizedClose > normalizedHigh
  ) {
    return null;
  }

  return [
    normalizedTimestamp,
    normalizedOpen,
    normalizedHigh,
    normalizedLow,
    normalizedClose,
  ];
}

/* *
 *
 *  Data Normalization
 *
 * */

/**
 * Normalizes a raw array of points into a sorted, de-duplicated canonical
 * series ready to hand to Highcharts.
 *
 * When the backend sends duplicate timestamps, the *last* valid occurrence
 * in `data` wins — this matches typical "latest correction supersedes"
 * backend semantics.
 *
 * @param {*} data
 * @param {'trend'|'line'|'candlestick'} [mode=DEFAULT_MODE]
 *        `"candlestick"` normalizes each point as OHLC; any other mode
 *        normalizes as trend/line.
 * @returns {MarketChartTrendPoint[]|MarketChartCandlestickPoint[]}
 *          Always an array; empty when `data` is not a non-empty array.
 */
function normalizeMarketChartData(data, mode = DEFAULT_MODE) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const normalizedMode = normalizeMarketChartMode(mode);
  const normalizePoint =
    normalizedMode === "candlestick"
      ? normalizeCandlestickPoint
      : normalizeTrendPoint;

  const pointsByTimestamp = new Map();

  for (const sourcePoint of data) {
    const point = normalizePoint(sourcePoint);

    if (!point) {
      continue;
    }

    pointsByTimestamp.set(point[0], point);
  }

  return [...pointsByTimestamp.values()].sort(
    (first, second) => first[0] - second[0],
  );
}

/* *
 *
 *  Range Record
 *
 * */

/**
 * Normalizes one range into the canonical internal record shape:
 *
 * ```js
 * { comparisonValue, trend, candlestick }
 * ```
 *
 * A plain array is treated as trend data, for caller convenience.
 *
 * @param {*} record
 * @returns {MarketChartRangeRecord|null}
 *          `null` when `record` is neither an array nor a plain object.
 */
function normalizeMarketChartRangeRecord(record) {
  if (Array.isArray(record)) {
    return {
      comparisonValue: null,
      trend: normalizeMarketChartData(record, "trend"),
      candlestick: [],
    };
  }

  if (!isPlainObject(record)) {
    return null;
  }

  const trendSource = record.trend ?? record.line ?? record.data ?? [];

  return {
    comparisonValue: toFiniteNumber(
      record.comparisonValue ?? record.previousClose,
    ),

    trend: normalizeMarketChartData(trendSource, "trend"),

    candlestick: normalizeMarketChartData(
      record.candlestick ?? record.candles ?? record.ohlc ?? [],
      "candlestick",
    ),
  };
}

/* *
 *
 *  Range Collection
 *
 * */

/**
 * Normalizes a full `{ range: record }` map, dropping any range that is
 * not currently supported by `capabilities`.
 *
 * @param {*} ranges
 * @param {object} [options]
 * @param {MarketChartCapabilities} [options.capabilities=DEFAULT_CAPABILITIES]
 * @returns {Object<string, MarketChartRangeRecord>}
 */
function normalizeMarketChartRanges(
  ranges,
  { capabilities = DEFAULT_CAPABILITIES } = {},
) {
  if (!isPlainObject(ranges)) {
    return {};
  }

  const normalizedCapabilities = normalizeMarketChartCapabilities(capabilities);

  const normalizedRanges = {};

  for (const [range, record] of Object.entries(ranges)) {
    const normalizedRange = normalizeMarketChartRange(range);

    if (!isMarketChartRangeSupported(normalizedRange, normalizedCapabilities)) {
      continue;
    }

    const normalizedRecord = normalizeMarketChartRangeRecord(record);

    if (normalizedRecord) {
      normalizedRanges[normalizedRange] = normalizedRecord;
    }
  }

  return normalizedRanges;
}

/* *
 *
 *  Available Ranges
 *
 * */

/**
 * @param {*} ranges
 * @param {MarketChartCapabilities} [capabilities=DEFAULT_CAPABILITIES]
 * @returns {string[]}
 *          Normalized, de-duplicated, capability-filtered range keys, in
 *          the order they first appear in `ranges`.
 */
function getAvailableMarketChartRanges(
  ranges,
  capabilities = DEFAULT_CAPABILITIES,
) {
  if (!isPlainObject(ranges)) {
    return [];
  }

  const normalizedCapabilities = normalizeMarketChartCapabilities(capabilities);

  const available = [];
  const seen = new Set();

  for (const range of Object.keys(ranges)) {
    const normalizedRange = normalizeMarketChartRange(range);

    if (
      seen.has(normalizedRange) ||
      !isMarketChartRangeSupported(normalizedRange, normalizedCapabilities)
    ) {
      continue;
    }

    seen.add(normalizedRange);
    available.push(normalizedRange);
  }

  return available;
}

/**
 * @param {*} ranges
 * @param {string} [preferredRange=DEFAULT_RANGE]
 * @param {MarketChartCapabilities} [capabilities=DEFAULT_CAPABILITIES]
 * @returns {string|null}
 *          `preferredRange` if available, otherwise the first available
 *          range, otherwise `null` when no range is available at all.
 */
function getFirstAvailableMarketChartRange(
  ranges,
  preferredRange = DEFAULT_RANGE,
  capabilities = DEFAULT_CAPABILITIES,
) {
  const available = getAvailableMarketChartRanges(ranges, capabilities);
  const preferred = normalizeMarketChartRange(preferredRange);

  return available.includes(preferred) ? preferred : (available[0] ?? null);
}

/* *
 *
 *  Comparison Value
 *
 * */

/**
 * @param {*} ranges
 * @param {*} range
 * @param {*} [fallback=null]
 * @returns {number|null}
 *          The stored comparison value for `range`, or `fallback`
 *          (coerced to a finite number) when absent.
 */
function getMarketChartRangeComparisonValue(ranges, range, fallback = null) {
  const fallbackValue = toFiniteNumber(fallback);

  if (!isPlainObject(ranges)) {
    return fallbackValue;
  }

  const normalizedRange = normalizeMarketChartRange(range);

  return (
    toFiniteNumber(ranges[normalizedRange]?.comparisonValue) ?? fallbackValue
  );
}

/* *
 *
 *  Range Updates
 *
 * */

/**
 * Replaces one complete range record after normalization. This is the
 * only write API for a range collection — a range is always replaced
 * atomically as `{ comparisonValue, trend, candlestick }`, never mutated
 * field-by-field, so callers can never observe a partially-updated record.
 *
 * @param {Object<string, MarketChartRangeRecord>} ranges
 *        Mutated in place on success.
 * @param {*} range
 * @param {*} record
 * @returns {boolean} Whether the write succeeded.
 */
function setMarketChartRangeRecord(ranges, range, record) {
  if (!isPlainObject(ranges)) {
    return false;
  }

  const normalizedRecord = normalizeMarketChartRangeRecord(record);

  if (!normalizedRecord) {
    return false;
  }

  ranges[normalizeMarketChartRange(range)] = normalizedRecord;

  return true;
}

/* *
 *
 *  Default Export
 *
 * */

const MarketChartData = {
  CHART_MODES,
  DEFAULT_CAPABILITIES,
  DEFAULT_CANDLE_BUCKET_SIZE,
  DEFAULT_INTRADAY_RANGE,
  DEFAULT_MAX_POINTS,
  createEmptyRangeRecord,
  getAvailableMarketChartRanges,
  getFirstAvailableMarketChartRange,
  getMarketChartRangeComparisonValue,
  isMarketChartIntradayRange,
  isMarketChartRangeSupported,
  normalizeMarketChartCapabilities,
  normalizeMarketChartData,
  normalizeMarketChartMode,
  normalizeMarketChartRange,
  normalizeMarketChartRangeRecord,
  normalizeMarketChartRanges,
  normalizeMarketChartTimestamp,
  setMarketChartRangeRecord,
};

export default MarketChartData;

/* *
 *
 *  Named Exports
 *
 * */

export {
  CHART_MODES,
  DEFAULT_CAPABILITIES,
  DEFAULT_CANDLE_BUCKET_SIZE,
  DEFAULT_INTRADAY_RANGE,
  DEFAULT_MAX_POINTS,
  createEmptyRangeRecord,
  getAvailableMarketChartRanges,
  getFirstAvailableMarketChartRange,
  getMarketChartRangeComparisonValue,
  isMarketChartIntradayRange,
  isMarketChartRangeSupported,
  normalizeMarketChartCapabilities,
  normalizeMarketChartData,
  normalizeMarketChartMode,
  normalizeMarketChartRange,
  normalizeMarketChartRangeRecord,
  normalizeMarketChartRanges,
  normalizeMarketChartTimestamp,
  setMarketChartRangeRecord,
};
