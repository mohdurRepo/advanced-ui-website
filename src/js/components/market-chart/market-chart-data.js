import {
  DEFAULT_TIME_ZONE,
  createDateTimeFormat,
  isPlainObject,
  toFiniteNumber,
  toKeyword,
} from "./market-chart-utils.js";

/* ==========================================================================
   Market Chart Data
   ==========================================================================

   Canonical data boundary between the application/API and the chart layer.
   Pure functions only: no Highcharts, no DOM, no requests, no timers.

   Highcharts receives only these shapes:

     Trend / line:  [timestamp, value]
     Candlestick:   [timestamp, open, high, low, close]

   A range record stores exactly:

     { comparisonValue, trend, candlestick }

   `trend` is the single source of truth for scalar data. "line" mode is a
   presentation of the same trend array, not a second dataset. When a range
   only provides candles, `trend` is derived from the candle closes so the
   navigator and direction logic always have data.

   Responsibilities:

   - modes, ranges and capabilities
   - timestamps (epoch seconds / milliseconds / ISO strings / Dates)
   - trend and OHLC point normalization (one implementation for both
     snapshot and live data)
   - range records and range collections
   - live payload normalization
   - live mutations of canonical arrays (append / replace / reset)

   Time zones:

   ISO strings without an offset ("2026-09-28T10:00:00", "2026-09-28") are
   wall-clock times in the configured market time zone (default
   Asia/Riyadh), never in the viewer's browser time zone. Strings with "Z"
   or an explicit offset are absolute and parsed as-is.
   ========================================================================== */

/* ==========================================================================
   Constants
   ========================================================================== */

export const MARKET_CHART_MODES = Object.freeze([
  "trend",
  "line",
  "candlestick",
]);

/*
 * Canonical display order. Unknown ranges are still accepted and are
 * listed after these, in their original order.
 */
export const MARKET_CHART_RANGE_ORDER = Object.freeze([
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "3Y",
  "5Y",
  "10Y",
  "ALL",
]);

export const DEFAULT_MODE = "trend";
export const DEFAULT_RANGE = "1D";
export const DEFAULT_INTRADAY_RANGE = "1D";

export const DEFAULT_MAX_POINTS = 1_000;
export const DEFAULT_CANDLE_BUCKET_SIZE = 60_000;

/*
 * Live mutation operation types.
 *
 *   noop     nothing changed
 *   append   new latest timestamp
 *   replace  latest timestamp, changed value
 *   reset    historical correction / insertion / multi-point trim
 */
export const LIVE_OPERATION = Object.freeze({
  NOOP: "noop",
  APPEND: "append",
  REPLACE: "replace",
  RESET: "reset",
});

const MODE_SET = new Set(MARKET_CHART_MODES);

const RANGE_ORDER_INDEX = new Map(
  MARKET_CHART_RANGE_ORDER.map((range, index) => [range, index]),
);

const TIMESTAMP_KEYS = Object.freeze([
  "x",
  "timestamp",
  "time",
  "dateTime",
  "date",
  "tradingDate",
]);

const VALUE_KEYS = Object.freeze([
  "y",
  "value",
  "price",
  "indexPrice",
  "close",
  "closePrice",
  "lastPrice",
]);

const CANDLE_CLOSE_KEYS = Object.freeze([
  "close",
  "closePrice",
  "indexPrice",
  "lastPrice",
]);

const PAYLOAD_POINT_KEYS = Object.freeze(["points", "updates", "data"]);

/*
 * Epoch values below this are treated as seconds (≈ March 1973 in ms).
 * Market data never predates it.
 */
const EPOCH_SECONDS_THRESHOLD = 100_000_000_000;

const NUMERIC_STRING = /^[+-]?\d+(?:\.\d+)?$/;

/*
 * ISO-8601 date or date-time WITHOUT a zone designator.
 */
const LOCAL_ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/;

/* ==========================================================================
   Small Helpers
   ========================================================================== */

function pickFirst(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }

  return undefined;
}

function sortByTimestamp(points) {
  return points.sort((first, second) => first[0] - second[0]);
}

export function pointsEqual(first, second) {
  if (
    !Array.isArray(first) ||
    !Array.isArray(second) ||
    first.length !== second.length
  ) {
    return false;
  }

  return first.every((value, index) => value === second[index]);
}

/* ==========================================================================
   Mode
   ========================================================================== */

export function normalizeMarketChartMode(mode, fallback = DEFAULT_MODE) {
  const value = toKeyword(mode);

  if (MODE_SET.has(value)) {
    return value;
  }

  const fallbackValue = toKeyword(fallback);

  return MODE_SET.has(fallbackValue) ? fallbackValue : DEFAULT_MODE;
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

function compareRanges(first, second) {
  const firstIndex = RANGE_ORDER_INDEX.get(first) ?? Number.MAX_SAFE_INTEGER;
  const secondIndex = RANGE_ORDER_INDEX.get(second) ?? Number.MAX_SAFE_INTEGER;

  return firstIndex - secondIndex;
}

/* ==========================================================================
   Capabilities
   ========================================================================== */

const NORMALIZED_CAPABILITIES = new WeakSet();

/**
 * Returns a frozen, normalized capabilities object.
 *
 * Already-normalized objects are returned as-is, so hot paths
 * (updateControls, range checks) do not re-normalize on every call.
 */
export function normalizeMarketChartCapabilities(capabilities = {}) {
  if (NORMALIZED_CAPABILITIES.has(capabilities)) {
    return capabilities;
  }

  const source = isPlainObject(capabilities) ? capabilities : {};

  const normalized = Object.freeze({
    intraday: source.intraday !== false,
    historical: source.historical !== false,
    live: source.live === true,
    navigator: source.navigator !== false,
    intradayRange: normalizeMarketChartRange(
      source.intradayRange,
      DEFAULT_INTRADAY_RANGE,
    ),
  });

  NORMALIZED_CAPABILITIES.add(normalized);

  return normalized;
}

export const DEFAULT_CAPABILITIES = normalizeMarketChartCapabilities({});

export function isMarketChartIntradayRange(
  range,
  capabilities = DEFAULT_CAPABILITIES,
) {
  return (
    normalizeMarketChartRange(range) ===
    normalizeMarketChartCapabilities(capabilities).intradayRange
  );
}

export function isMarketChartRangeSupported(
  range,
  capabilities = DEFAULT_CAPABILITIES,
) {
  const normalized = normalizeMarketChartCapabilities(capabilities);

  return normalizeMarketChartRange(range) === normalized.intradayRange
    ? normalized.intraday
    : normalized.historical;
}

/* ==========================================================================
   Time Zone
   ========================================================================== */

const OFFSET_FORMATTERS = new Map();

function getOffsetFormatter(timeZone) {
  let formatter = OFFSET_FORMATTERS.get(timeZone);

  if (!formatter) {
    formatter = createDateTimeFormat(
      "en-US",
      timeZone,
      {
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      },
      "en-US",
    );

    OFFSET_FORMATTERS.set(timeZone, formatter);
  }

  return formatter;
}

/**
 * Offset (ms) of `timeZone` from UTC at the given instant.
 */
function getTimeZoneOffset(timestamp, timeZone) {
  const parts = {};

  for (const part of getOffsetFormatter(timeZone).formatToParts(
    new Date(timestamp),
  )) {
    parts[part.type] = Number(part.value);
  }

  const wallClockAsUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second,
  );

  const wholeSecond = timestamp - (((timestamp % 1_000) + 1_000) % 1_000);

  return wallClockAsUTC - wholeSecond;
}

/**
 * Converts a wall-clock time in `timeZone` into an epoch timestamp.
 * The second pass corrects instants that sit on a DST transition.
 */
function zonedWallTimeToTimestamp(fields, timeZone) {
  const [year, month, day, hour, minute, second, millisecond] = fields;

  const wall = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );

  const date = new Date(wall);

  /*
   * Reject rolled-over input such as 2026-02-31 or 25:00.
   */
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }

  const firstGuess = wall - getTimeZoneOffset(wall, timeZone);

  return wall - getTimeZoneOffset(firstGuess, timeZone);
}

function parseTimestampString(value, timeZone) {
  const match = LOCAL_ISO_DATE_TIME.exec(value);

  if (match) {
    const fraction = (match[7] ?? "").slice(0, 3).padEnd(3, "0");

    return zonedWallTimeToTimestamp(
      [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        Number(match[4] ?? 0),
        Number(match[5] ?? 0),
        Number(match[6] ?? 0),
        Number(fraction),
      ],
      timeZone,
    );
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/* ==========================================================================
   Timestamp
   ========================================================================== */

/**
 * Normalizes any supported timestamp input to epoch milliseconds.
 *
 * Accepted:
 * - Date instances
 * - epoch seconds or milliseconds (number or numeric string)
 * - ISO strings with "Z" / offset (absolute)
 * - ISO strings without offset (market wall-clock time in `timeZone`)
 *
 * @param {*} value
 * @param {{ timeZone?: string }} [options]
 * @returns {number | null}
 */
export function normalizeMarketChartTimestamp(
  value,
  { timeZone = DEFAULT_TIME_ZONE } = {},
) {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();

    return Number.isFinite(timestamp) ? timestamp : null;
  }

  let numeric = null;

  if (typeof value === "number") {
    numeric = Number.isFinite(value) ? value : null;

    if (numeric === null) {
      return null;
    }
  } else {
    const text = String(value).trim();

    if (!text) {
      return null;
    }

    if (!NUMERIC_STRING.test(text)) {
      return parseTimestampString(text, timeZone || DEFAULT_TIME_ZONE);
    }

    numeric = Number(text);
  }

  return Math.abs(numeric) < EPOCH_SECONDS_THRESHOLD
    ? numeric * 1_000
    : numeric;
}

/* ==========================================================================
   Points
   ========================================================================== */

/**
 * True when the source point carries complete OHLC data.
 */
export function isMarketChartOHLCPoint(point) {
  if (Array.isArray(point)) {
    return point.length >= 5;
  }

  return Boolean(
    isPlainObject(point) &&
    (point.open ?? point.openPrice) !== undefined &&
    (point.high ?? point.highPrice) !== undefined &&
    (point.low ?? point.lowPrice) !== undefined &&
    (point.close ?? point.closePrice) !== undefined,
  );
}

/**
 * Normalizes any point to [timestamp, value].
 *
 * OHLC arrays use their close (index 4), never their open.
 * This is the single scalar-point normalizer for snapshot and live data.
 */
export function normalizeMarketChartPricePoint(point, options) {
  let timestamp;
  let value;

  if (Array.isArray(point)) {
    timestamp = point[0];
    value = point.length >= 5 ? point[4] : point[1];
  } else if (isPlainObject(point)) {
    timestamp = pickFirst(point, TIMESTAMP_KEYS);
    value = pickFirst(point, VALUE_KEYS);
  } else {
    return null;
  }

  const normalizedTimestamp = normalizeMarketChartTimestamp(timestamp, options);
  const normalizedValue = toFiniteNumber(value);

  return normalizedTimestamp !== null && normalizedValue !== null
    ? [normalizedTimestamp, normalizedValue]
    : null;
}

/**
 * Normalizes any OHLC point to [timestamp, open, high, low, close].
 *
 * Impossible geometry (open/close outside low..high) is rejected, with a
 * tiny relative tolerance for backend floating-point rounding.
 */
export function normalizeMarketChartCandlestickPoint(point, options) {
  let source;

  if (Array.isArray(point)) {
    const [timestamp, open, high, low, close] = point;

    source = { timestamp, open, high, low, close };
  } else if (isPlainObject(point)) {
    source = {
      timestamp: pickFirst(point, TIMESTAMP_KEYS),
      open: point.open ?? point.openPrice,
      high: point.high ?? point.highPrice,
      low: point.low ?? point.lowPrice,
      close: pickFirst(point, CANDLE_CLOSE_KEYS),
    };
  } else {
    return null;
  }

  const timestamp = normalizeMarketChartTimestamp(source.timestamp, options);
  const open = toFiniteNumber(source.open);
  const high = toFiniteNumber(source.high);
  const low = toFiniteNumber(source.low);
  const close = toFiniteNumber(source.close);

  if (
    timestamp === null ||
    open === null ||
    high === null ||
    low === null ||
    close === null
  ) {
    return null;
  }

  const tolerance = Math.max(Math.abs(high), Math.abs(low), 1) * 1e-9;

  const inside = (value) =>
    value >= low - tolerance && value <= high + tolerance;

  if (high < low - tolerance || !inside(open) || !inside(close)) {
    return null;
  }

  return [timestamp, open, high, low, close];
}

/* ==========================================================================
   Data Normalization
   ========================================================================== */

/**
 * Normalizes a dataset for one mode: invalid points are dropped, points are
 * sorted by timestamp, and for duplicate timestamps the last valid
 * occurrence wins.
 *
 * @param {Array} data
 * @param {string} [mode]
 * @param {{ timeZone?: string }} [options]
 */
export function normalizeMarketChartData(data, mode = DEFAULT_MODE, options) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const normalizePoint =
    normalizeMarketChartMode(mode) === "candlestick"
      ? normalizeMarketChartCandlestickPoint
      : normalizeMarketChartPricePoint;

  const pointsByTimestamp = new Map();

  for (const sourcePoint of data) {
    const point = normalizePoint(sourcePoint, options);

    if (point) {
      pointsByTimestamp.set(point[0], point);
    }
  }

  return sortByTimestamp([...pointsByTimestamp.values()]);
}

/* ==========================================================================
   Range Record
   ========================================================================== */

export function createEmptyMarketChartRangeRecord(comparisonValue = null) {
  return {
    comparisonValue: toFiniteNumber(comparisonValue),
    trend: [],
    candlestick: [],
  };
}

/**
 * Normalizes one range into the canonical record:
 *
 *   { comparisonValue, trend, candlestick }
 *
 * - A plain array is treated as trend data.
 * - `line` / `data` are accepted as trend aliases.
 * - `candles` / `ohlc` are accepted as candlestick aliases.
 * - Missing trend is derived from candle closes.
 */
export function normalizeMarketChartRangeRecord(record, options) {
  if (Array.isArray(record)) {
    return {
      comparisonValue: null,
      trend: normalizeMarketChartData(record, "trend", options),
      candlestick: [],
    };
  }

  if (!isPlainObject(record)) {
    return null;
  }

  const candlestick = normalizeMarketChartData(
    record.candlestick ?? record.candles ?? record.ohlc ?? [],
    "candlestick",
    options,
  );

  let trend = normalizeMarketChartData(
    record.trend ?? record.line ?? record.data ?? [],
    "trend",
    options,
  );

  if (!trend.length && candlestick.length) {
    trend = candlestick.map(([timestamp, , , , close]) => [timestamp, close]);
  }

  return {
    comparisonValue: toFiniteNumber(
      record.comparisonValue ?? record.previousClose,
    ),
    trend,
    candlestick,
  };
}

/* ==========================================================================
   Range Collection
   ========================================================================== */

/**
 * Normalizes a { [range]: record } collection.
 *
 * Unsupported ranges and invalid records are dropped. Keys that normalize
 * to the same range ("1d" / "1D") resolve to the last one.
 */
export function normalizeMarketChartRanges(
  ranges,
  { capabilities = DEFAULT_CAPABILITIES, timeZone } = {},
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

    const normalizedRecord = normalizeMarketChartRangeRecord(record, {
      timeZone,
    });

    if (normalizedRecord) {
      normalizedRanges[normalizedRange] = normalizedRecord;
    }
  }

  return normalizedRanges;
}

/**
 * Supported ranges present in the collection, in canonical display order.
 */
export function getAvailableMarketChartRanges(
  ranges,
  capabilities = DEFAULT_CAPABILITIES,
) {
  if (!isPlainObject(ranges)) {
    return [];
  }

  const normalizedCapabilities = normalizeMarketChartCapabilities(capabilities);

  const available = new Set();

  for (const range of Object.keys(ranges)) {
    const normalizedRange = normalizeMarketChartRange(range);

    if (isMarketChartRangeSupported(normalizedRange, normalizedCapabilities)) {
      available.add(normalizedRange);
    }
  }

  return [...available].sort(compareRanges);
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

export function getMarketChartRangeComparisonValue(
  ranges,
  range,
  fallback = null,
) {
  const fallbackValue = toFiniteNumber(fallback);

  if (!isPlainObject(ranges)) {
    return fallbackValue;
  }

  return (
    toFiniteNumber(ranges[normalizeMarketChartRange(range)]?.comparisonValue) ??
    fallbackValue
  );
}

/**
 * Replaces one complete range record after normalization. A range is always
 * replaced atomically.
 */
export function setMarketChartRangeRecord(ranges, range, record, options) {
  if (!isPlainObject(ranges)) {
    return false;
  }

  const normalizedRecord = normalizeMarketChartRangeRecord(record, options);

  if (!normalizedRecord) {
    return false;
  }

  ranges[normalizeMarketChartRange(range)] = normalizedRecord;

  return true;
}

/* ==========================================================================
   Live Payload
   ========================================================================== */

/**
 * Normalizes one live API response.
 *
 * Accepted payloads:
 *
 *   null / undefined                       -> no items
 *   [point, point, …]                      -> batch
 *   point                                  -> single point
 *   { points | updates | data, previousClose? | comparisonValue? }
 *
 * Returns items in chronological order:
 *
 *   {
 *     items: [{ sourcePoint, pricePoint, candle }],
 *     previousClose: number | null,
 *   }
 *
 * `candle` is:
 *   undefined  source is not OHLC (candle is built from the price)
 *   null       source claims OHLC but is invalid (candle is skipped)
 *   array      normalized [timestamp, open, high, low, close]
 */
export function normalizeMarketChartLivePayload(payload, options) {
  let points = payload;
  let previousClose = null;

  if (isPlainObject(payload)) {
    const key = PAYLOAD_POINT_KEYS.find((name) => Array.isArray(payload[name]));

    if (key) {
      points = payload[key];
      previousClose = toFiniteNumber(
        payload.previousClose ?? payload.comparisonValue,
      );
    }
  }

  let sourcePoints;

  if (points === null || points === undefined) {
    sourcePoints = [];
  } else if (!Array.isArray(points)) {
    sourcePoints = [points];
  } else if (
    points.length &&
    !Array.isArray(points[0]) &&
    !isPlainObject(points[0])
  ) {
    /*
     * A single [timestamp, value, …] tuple.
     */
    sourcePoints = [points];
  } else {
    sourcePoints = points;
  }

  const items = [];

  for (const sourcePoint of sourcePoints) {
    const pricePoint = normalizeMarketChartPricePoint(sourcePoint, options);

    if (!pricePoint) {
      continue;
    }

    items.push({
      sourcePoint,
      pricePoint,
      candle: isMarketChartOHLCPoint(sourcePoint)
        ? normalizeMarketChartCandlestickPoint(sourcePoint, options)
        : undefined,
    });
  }

  items.sort((first, second) => first.pricePoint[0] - second.pricePoint[0]);

  return { items, previousClose };
}

/* ==========================================================================
   Live Mutations
   ========================================================================== */

/**
 * Binary search: first index whose timestamp is >= `timestamp`.
 */
export function findMarketChartPointIndex(data, timestamp) {
  let low = 0;
  let high = data.length;

  while (low < high) {
    const middle = (low + high) >>> 1;

    if (data[middle][0] < timestamp) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function trimToMaxPoints(data, maxPoints) {
  const overflow = data.length - maxPoints;

  if (overflow <= 0) {
    return 0;
  }

  data.splice(0, overflow);

  return overflow;
}

/**
 * Inserts / replaces / appends one point in a timestamp-sorted array,
 * mutating it in place.
 *
 * @returns {{ type: string, point: Array, shifted: boolean, evicted: number }}
 */
export function upsertMarketChartPoint(
  data,
  point,
  maxPoints = DEFAULT_MAX_POINTS,
) {
  const timestamp = point[0];
  const lastIndex = data.length - 1;
  const last = lastIndex >= 0 ? data[lastIndex] : null;

  /* Append ---------------------------------------------------------------- */

  if (!last || timestamp > last[0]) {
    data.push(point);

    const evicted = trimToMaxPoints(data, maxPoints);

    return evicted > 1
      ? { type: LIVE_OPERATION.RESET, point, shifted: false, evicted }
      : {
          type: LIVE_OPERATION.APPEND,
          point,
          shifted: evicted === 1,
          evicted,
        };
  }

  /* Replace latest -------------------------------------------------------- */

  if (timestamp === last[0]) {
    if (pointsEqual(last, point)) {
      return { type: LIVE_OPERATION.NOOP, point, shifted: false, evicted: 0 };
    }

    data[lastIndex] = point;

    return { type: LIVE_OPERATION.REPLACE, point, shifted: false, evicted: 0 };
  }

  /* Historical correction / insertion ------------------------------------- */

  const index = findMarketChartPointIndex(data, timestamp);

  if (data[index]?.[0] === timestamp) {
    if (pointsEqual(data[index], point)) {
      return { type: LIVE_OPERATION.NOOP, point, shifted: false, evicted: 0 };
    }

    data[index] = point;
  } else {
    data.splice(index, 0, point);
  }

  const evicted = trimToMaxPoints(data, maxPoints);

  return { type: LIVE_OPERATION.RESET, point, shifted: false, evicted };
}

/**
 * Merges one live item into a candle array.
 *
 * - Backend OHLC is used as-is.
 * - Otherwise a forming candle is assembled from last-price ticks inside
 *   `bucketSize` buckets. A new bucket opens at the previous candle's close.
 *
 * Note: with polling, a bucket usually receives only one or two ticks, so
 * assembled candles are low fidelity. Prefer backend OHLC where available.
 *
 * @returns {object | null} upsert operation, or null when skipped
 */
export function mergeMarketChartLiveCandle(
  candles,
  item,
  {
    bucketSize = DEFAULT_CANDLE_BUCKET_SIZE,
    maxPoints = DEFAULT_MAX_POINTS,
  } = {},
) {
  if (item.candle === null) {
    return null;
  }

  if (item.candle) {
    return upsertMarketChartPoint(candles, item.candle, maxPoints);
  }

  const [timestamp, price] = item.pricePoint;

  const bucket = Math.floor(timestamp / bucketSize) * bucketSize;

  const index = findMarketChartPointIndex(candles, bucket);

  const existing = candles[index]?.[0] === bucket ? candles[index] : null;

  if (existing) {
    const [, open, high, low] = existing;

    return upsertMarketChartPoint(
      candles,
      [bucket, open, Math.max(high, price), Math.min(low, price), price],
      maxPoints,
    );
  }

  const open = (index > 0 ? candles[index - 1][4] : null) ?? price;

  return upsertMarketChartPoint(
    candles,
    [bucket, open, Math.max(open, price), Math.min(open, price), price],
    maxPoints,
  );
}

/**
 * Applies normalized live items to an existing range record in place.
 *
 * @returns {{ trendOperations: object[], candleOperations: object[], evicted: number }}
 */
export function applyMarketChartLiveItems(record, items, options = {}) {
  const maxPoints = options.maxPoints ?? DEFAULT_MAX_POINTS;

  const trendOperations = [];
  const candleOperations = [];

  let evicted = 0;

  for (const item of items) {
    const trendOperation = upsertMarketChartPoint(
      record.trend,
      item.pricePoint,
      maxPoints,
    );

    trendOperations.push(trendOperation);
    evicted += trendOperation.evicted;

    const candleOperation = mergeMarketChartLiveCandle(
      record.candlestick,
      item,
      options,
    );

    if (candleOperation) {
      candleOperations.push(candleOperation);
      evicted += candleOperation.evicted;
    }
  }

  return { trendOperations, candleOperations, evicted };
}

/**
 * Builds a complete canonical record from an authoritative full snapshot.
 */
export function createMarketChartSnapshotRecord(
  items,
  { comparisonValue = null, ...options } = {},
) {
  const record = createEmptyMarketChartRangeRecord(comparisonValue);

  applyMarketChartLiveItems(record, items, options);

  return record;
}

/**
 * True when at least one operation changed data.
 */
export function hasMarketChartChanges(operations) {
  return (
    Array.isArray(operations) &&
    operations.some(
      (operation) => operation && operation.type !== LIVE_OPERATION.NOOP,
    )
  );
}
