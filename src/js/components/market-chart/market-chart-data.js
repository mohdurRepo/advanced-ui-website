/* ==========================================================================
   Market Chart Data
   ========================================================================== */

/**
 * Canonical data boundary between the application/API and the chart layer.
 *
 * Highcharts receives only these shapes:
 *
 *   Trend / line:  [timestamp, value]
 *   Candlestick:   [timestamp, open, high, low, close]
 *
 * Responsibilities:
 * - normalize modes, ranges, capabilities and timestamps
 * - normalize trend/line and OHLC input
 * - sort points by timestamp and de-duplicate them
 * - normalize range records and range collections
 *
 * A range record stores exactly two arrays:
 *
 *   { comparisonValue, trend, candlestick }
 *
 * `trend` is the single source of truth for scalar data. "line" mode is a
 * *presentation* of the same trend array (a different Highcharts series
 * `type`), not a second stored dataset — there is nothing to keep in sync.
 *
 * This module does not know about Highcharts instances, DOM elements,
 * requests, live polling, navigator state or viewport behavior.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const CHART_MODES = new Set(["trend", "line", "candlestick"]);

const DEFAULT_MODE = "trend";
const DEFAULT_RANGE = "1D";
const DEFAULT_INTRADAY_RANGE = "1D";

const DEFAULT_MAX_POINTS = 1_000;
const DEFAULT_CANDLE_BUCKET_SIZE = 60_000;

const DEFAULT_CAPABILITIES = Object.freeze({
  intraday: true,
  historical: true,
  live: false,
  navigator: true,
  intradayRange: DEFAULT_INTRADAY_RANGE,
});

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

function createEmptyRangeRecord() {
  return {
    comparisonValue: null,
    trend: [],
    candlestick: [],
  };
}

/* ==========================================================================
   Mode
   ========================================================================== */

export function normalizeMarketChartMode(mode, fallback = DEFAULT_MODE) {
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

/* ==========================================================================
   Range
   ========================================================================== */

export function normalizeMarketChartRange(range, fallback = DEFAULT_RANGE) {
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

/* ==========================================================================
   Capabilities
   ========================================================================== */

export function normalizeMarketChartCapabilities(capabilities = {}) {
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

export function isMarketChartIntradayRange(
  range,
  capabilities = DEFAULT_CAPABILITIES,
) {
  const normalizedCapabilities = normalizeMarketChartCapabilities(capabilities);

  return (
    normalizeMarketChartRange(range) === normalizedCapabilities.intradayRange
  );
}

export function isMarketChartRangeSupported(
  range,
  capabilities = DEFAULT_CAPABILITIES,
) {
  const normalizedRange = normalizeMarketChartRange(range);
  const normalizedCapabilities = normalizeMarketChartCapabilities(capabilities);

  return normalizedRange === normalizedCapabilities.intradayRange
    ? normalizedCapabilities.intraday
    : normalizedCapabilities.historical;
}

/* ==========================================================================
   Timestamp
   ========================================================================== */

export function normalizeMarketChartTimestamp(value) {
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
     * Contemporary Unix timestamps below this threshold are seconds.
     * Highcharts datetime x-values use milliseconds.
     *
     * This is a heuristic: it assumes real-world contemporary dates.
     * A raw millisecond timestamp before ~1973 would be misread as
     * seconds. Market data never predates that, so this is safe here.
     */
    return Math.abs(numericValue) < 100_000_000_000
      ? numericValue * 1_000
      : numericValue;
  }

  const parsedValue = Date.parse(String(value));

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

/* ==========================================================================
   Trend / Line Point
   ========================================================================== */

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

/* ==========================================================================
   Candlestick Point
   ========================================================================== */

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

  /*
   * Reject impossible OHLC geometry. Open and close must both sit
   * inside the low/high interval.
   */
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

/* ==========================================================================
   Data Normalization
   ========================================================================== */

export function normalizeMarketChartData(data, mode = DEFAULT_MODE) {
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

    /*
     * Last valid occurrence wins when the API sends duplicate timestamps.
     */
    pointsByTimestamp.set(point[0], point);
  }

  return [...pointsByTimestamp.values()].sort(
    (first, second) => first[0] - second[0],
  );
}

/* ==========================================================================
   Range Record
   ========================================================================== */

/**
 * Normalize one range into the canonical internal record:
 *
 *   { comparisonValue, trend, candlestick }
 *
 * A plain array is treated as trend data for convenience.
 */
export function normalizeMarketChartRangeRecord(record) {
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

/* ==========================================================================
   Range Collection
   ========================================================================== */

export function normalizeMarketChartRanges(
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

/* ==========================================================================
   Available Ranges
   ========================================================================== */

export function getAvailableMarketChartRanges(
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

export function getFirstAvailableMarketChartRange(
  ranges,
  preferredRange = DEFAULT_RANGE,
  capabilities = DEFAULT_CAPABILITIES,
) {
  const available = getAvailableMarketChartRanges(ranges, capabilities);
  const preferred = normalizeMarketChartRange(preferredRange);

  return available.includes(preferred) ? preferred : (available[0] ?? null);
}

/* ==========================================================================
   Comparison Value
   ========================================================================== */

export function getMarketChartRangeComparisonValue(
  ranges,
  range,
  fallback = null,
) {
  const fallbackValue = toFiniteNumber(fallback);

  if (!isPlainObject(ranges)) {
    return fallbackValue;
  }

  const normalizedRange = normalizeMarketChartRange(range);

  return (
    toFiniteNumber(ranges[normalizedRange]?.comparisonValue) ?? fallbackValue
  );
}

/* ==========================================================================
   Range Updates
   ========================================================================== */

/**
 * Replace one complete range record after normalization. This is the only
 * write API — a range is always replaced atomically as:
 *
 *   { comparisonValue, trend, candlestick }
 */
export function setMarketChartRangeRecord(ranges, range, record) {
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

/* ==========================================================================
   Public Constants
   ========================================================================== */

export {
  CHART_MODES,
  DEFAULT_CAPABILITIES,
  DEFAULT_CANDLE_BUCKET_SIZE,
  DEFAULT_INTRADAY_RANGE,
  DEFAULT_MAX_POINTS,
  createEmptyRangeRecord,
};
