/* ==========================================================================
   Market Chart Data
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
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date),
  );
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toPositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createEmptyRangeRecord() {
  return {
    comparisonValue: null,

    trend: [],
    line: [],
    candlestick: [],
  };
}

function clonePoint(point) {
  return Array.isArray(point) ? [...point] : point;
}

function clonePoints(points) {
  return Array.isArray(points) ? points.map(clonePoint) : [];
}

/* ==========================================================================
   Mode and Range
   ========================================================================== */

export function normalizeMarketChartMode(mode, fallback = DEFAULT_MODE) {
  const normalizedMode = String(mode ?? "")
    .trim()
    .toLowerCase();

  if (CHART_MODES.has(normalizedMode)) {
    return normalizedMode;
  }

  const normalizedFallback = String(fallback ?? "")
    .trim()
    .toLowerCase();

  return CHART_MODES.has(normalizedFallback)
    ? normalizedFallback
    : DEFAULT_MODE;
}

export function normalizeMarketChartRange(range, fallback = DEFAULT_RANGE) {
  if (range === null || range === undefined || range === "") {
    return String(fallback || DEFAULT_RANGE)
      .trim()
      .toUpperCase();
  }

  const normalizedRange = String(range).trim().toUpperCase();

  return (
    normalizedRange ||
    String(fallback || DEFAULT_RANGE)
      .trim()
      .toUpperCase()
  );
}

/* ==========================================================================
   Capabilities
   ========================================================================== */

export function normalizeMarketChartCapabilities(capabilities = {}) {
  const configuration = isPlainObject(capabilities) ? capabilities : {};

  const intradayRange = normalizeMarketChartRange(
    configuration.intradayRange,
    DEFAULT_INTRADAY_RANGE,
  );

  return {
    intraday: configuration.intraday !== false,

    historical: configuration.historical !== false,

    live: configuration.live === true,

    navigator: configuration.navigator !== false,

    intradayRange,
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

  if (normalizedRange === normalizedCapabilities.intradayRange) {
    return normalizedCapabilities.intraday;
  }

  return normalizedCapabilities.historical;
}

/* ==========================================================================
   Timestamp
   ========================================================================== */

export function normalizeMarketChartTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();

    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const numericValue =
    typeof value === "string" && value.trim() === ""
      ? Number.NaN
      : Number(value);

  if (Number.isFinite(numericValue)) {
    /*
     * Values below 100 billion are treated as
     * Unix seconds. Larger values are treated
     * as Unix milliseconds.
     */
    return Math.abs(numericValue) < 100_000_000_000
      ? numericValue * 1_000
      : numericValue;
  }

  const parsedValue = Date.parse(String(value));

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

/* ==========================================================================
   Trend Point
   ========================================================================== */

function normalizeTrendPoint(point) {
  if (Array.isArray(point)) {
    const timestamp = normalizeMarketChartTimestamp(point[0]);

    const value = toFiniteNumber(point[1]);

    if (timestamp === null || value === null) {
      return null;
    }

    return [timestamp, value];
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

  if (timestamp === null || value === null) {
    return null;
  }

  return [timestamp, value];
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
   * Reject impossible OHLC geometry.
   */
  if (
    normalizedHigh < normalizedLow ||
    normalizedHigh < normalizedOpen ||
    normalizedHigh < normalizedClose ||
    normalizedLow > normalizedOpen ||
    normalizedLow > normalizedClose
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
   Sorting and Deduplication
   ========================================================================== */

function sortAndDeduplicate(points) {
  const pointsByTimestamp = new Map();

  points.forEach((point) => {
    /*
     * The final point for a duplicate timestamp
     * wins, matching live replacement behavior.
     */
    pointsByTimestamp.set(point[0], point);
  });

  return [...pointsByTimestamp.values()].sort(
    (first, second) => first[0] - second[0],
  );
}

function findTimestampIndex(points, timestamp) {
  let low = 0;

  let high = points.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (points[middle][0] < timestamp) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return {
    index: low,

    found: low < points.length && points[low][0] === timestamp,
  };
}

/* ==========================================================================
   Data Normalization
   ========================================================================== */

export function normalizeMarketChartData(data, mode = DEFAULT_MODE) {
  if (!Array.isArray(data)) {
    return [];
  }

  const normalizedMode = normalizeMarketChartMode(mode);

  const normalizePoint =
    normalizedMode === "candlestick"
      ? normalizeCandlestickPoint
      : normalizeTrendPoint;

  const points = data.map(normalizePoint).filter(Boolean);

  return sortAndDeduplicate(points);
}

/* ==========================================================================
   Range Record
   ========================================================================== */

function normalizeRangeRecord(record) {
  if (Array.isArray(record)) {
    const trend = normalizeMarketChartData(record, "trend");

    return {
      comparisonValue: null,

      trend,

      line: clonePoints(trend),

      candlestick: [],
    };
  }

  if (!isPlainObject(record)) {
    return null;
  }

  const sharedData = record.data ?? [];

  /*
   * `comparisonValue` represents the official
   * value immediately before the range.
   * `previousClose` remains a supported alias.
   */
  const comparisonValue = toFiniteNumber(
    record.comparisonValue ?? record.previousClose,
  );

  const trend = normalizeMarketChartData(
    record.trend ?? record.line ?? sharedData,

    "trend",
  );

  const line = normalizeMarketChartData(
    record.line ?? record.trend ?? sharedData,

    "line",
  );

  const candlestick = normalizeMarketChartData(
    record.candlestick ?? record.candles ?? record.ohlc ?? [],

    "candlestick",
  );

  return {
    comparisonValue,

    trend,
    line,
    candlestick,
  };
}

/* ==========================================================================
   Range Normalization
   ========================================================================== */
export function normalizeMarketChartRanges(ranges, options = {}) {
  if (!isPlainObject(ranges)) {
    return {};
  }

  const capabilities = normalizeMarketChartCapabilities(options.capabilities);

  return Object.entries(ranges).reduce((normalizedRanges, [range, record]) => {
    const normalizedRange = normalizeMarketChartRange(range);

    if (!isMarketChartRangeSupported(normalizedRange, capabilities)) {
      return normalizedRanges;
    }

    const normalizedRecord = normalizeRangeRecord(record);

    if (!normalizedRecord) {
      return normalizedRanges;
    }

    normalizedRanges[normalizedRange] = normalizedRecord;

    return normalizedRanges;
  }, {});
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

  return Object.keys(ranges).reduce((availableRanges, range) => {
    const normalizedRange = normalizeMarketChartRange(range);

    if (
      !availableRanges.includes(normalizedRange) &&
      isMarketChartRangeSupported(normalizedRange, capabilities)
    ) {
      availableRanges.push(normalizedRange);
    }

    return availableRanges;
  }, []);
}

export function getFirstAvailableMarketChartRange(
  ranges,
  preferredRange = DEFAULT_RANGE,
  capabilities = DEFAULT_CAPABILITIES,
) {
  const availableRanges = getAvailableMarketChartRanges(ranges, capabilities);

  const normalizedPreferredRange = normalizeMarketChartRange(preferredRange);

  if (availableRanges.includes(normalizedPreferredRange)) {
    return normalizedPreferredRange;
  }

  return availableRanges[0] || null;
}

/* ==========================================================================
   Range Data
   ========================================================================== */

export function getMarketChartRangeData(ranges, range, mode = DEFAULT_MODE) {
  if (!isPlainObject(ranges)) {
    return [];
  }

  const normalizedRange = normalizeMarketChartRange(range);

  const normalizedMode = normalizeMarketChartMode(mode);

  const record = ranges[normalizedRange];

  if (!record) {
    return [];
  }

  const directData = normalizeMarketChartData(
    record[normalizedMode],
    normalizedMode,
  );

  if (directData.length) {
    return directData;
  }

  /*
   * Trend and line share the same point
   * representation and may safely fall back
   * to each other. Candlesticks never fall
   * back to trend data.
   */
  if (normalizedMode === "trend") {
    return normalizeMarketChartData(record.line, "trend");
  }

  if (normalizedMode === "line") {
    return normalizeMarketChartData(record.trend, "line");
  }

  return [];
}

/* ==========================================================================
   Official Comparison Value
   ========================================================================== */

/**
 * Returns the official value immediately before
 * the named range.
 *
 * This value is used for tooltip amount and
 * percentage calculations. It is intentionally
 * separate from visible series direction.
 */
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

  const comparisonValue = toFiniteNumber(
    ranges[normalizedRange]?.comparisonValue,
  );

  return comparisonValue ?? fallbackValue;
}

/* ==========================================================================
   Point Value
   ========================================================================== */

export function getMarketChartPointValue(point, mode = DEFAULT_MODE) {
  if (!Array.isArray(point)) {
    return null;
  }

  const normalizedMode = normalizeMarketChartMode(mode);

  return normalizedMode === "candlestick"
    ? toFiniteNumber(point[4])
    : toFiniteNumber(point[1]);
}

/* ==========================================================================
   Direction
   ========================================================================== */

/**
 * Resolves the visible series direction.
 *
 * Default behavior compares the final visible
 * value with the first visible value:
 *
 * - final > first: up
 * - final < first: down
 * - final === first: neutral
 *
 * The official comparison value remains
 * available for tooltip change calculations.
 *
 * Set `baseline: "comparison"` when an
 * integration explicitly wants the entire
 * series colored against previous close.
 */
export function getMarketChartDirection(
  data,
  mode = DEFAULT_MODE,
  comparisonValue = null,
  options = {},
) {
  const normalizedMode = normalizeMarketChartMode(mode);

  const normalizedData = normalizeMarketChartData(data, normalizedMode);

  if (normalizedData.length < 2) {
    return "neutral";
  }

  const firstValue = getMarketChartPointValue(
    normalizedData[0],
    normalizedMode,
  );

  const endValue = getMarketChartPointValue(
    normalizedData[normalizedData.length - 1],
    normalizedMode,
  );

  if (firstValue === null || endValue === null) {
    return "neutral";
  }

  const useOfficialComparison = options?.baseline === "comparison";

  const officialComparison = toFiniteNumber(comparisonValue);

  const baseline =
    useOfficialComparison && officialComparison !== null
      ? officialComparison
      : firstValue;

  if (endValue > baseline) {
    return "up";
  }

  if (endValue < baseline) {
    return "down";
  }

  return "neutral";
}

/* ==========================================================================
   Maximum Points
   ========================================================================== */

function limitMarketChartPoints(data, maxPoints) {
  const safeMaxPoints = toPositiveInteger(maxPoints, DEFAULT_MAX_POINTS);

  if (data.length <= safeMaxPoints) {
    return {
      data,
      removed: 0,
    };
  }

  const removed = data.length - safeMaxPoints;

  return {
    data: data.slice(removed),

    removed,
  };
}

/* ==========================================================================
   Trend Live Merge
   ========================================================================== */
function mergeTrendLivePoint(currentData, incomingPoint, options) {
  const data = normalizeMarketChartData(currentData, options.mode);

  const normalizedIncoming = normalizeMarketChartData(
    [incomingPoint],
    options.mode,
  );

  if (!normalizedIncoming.length) {
    return null;
  }

  const point = normalizedIncoming[0];

  const timestamp = point[0];

  const location = findTimestampIndex(data, timestamp);

  const replaced = location.found;

  const appended = !replaced && location.index === data.length;

  const inserted = !replaced && !appended;

  if (replaced) {
    data[location.index] = point;
  } else {
    data.splice(location.index, 0, point);
  }

  const limited = limitMarketChartPoints(data, options.maxPoints);

  const retainedIndex = location.index - limited.removed;

  const index =
    retainedIndex >= 0 &&
    retainedIndex < limited.data.length &&
    limited.data[retainedIndex][0] === timestamp
      ? retainedIndex
      : -1;

  return {
    data: limited.data,

    point,

    index,

    replaced,
    appended,
    inserted,

    shifted: appended && limited.removed > 0,

    bucketUpdated: false,

    bucketAppended: false,
  };
}

/* ==========================================================================
   Live Candlestick Input
   ========================================================================== */

function normalizeLiveCandlestickInput(incomingPoint) {
  const candle = normalizeCandlestickPoint(incomingPoint);

  if (candle) {
    return {
      type: "candle",

      timestamp: candle[0],

      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
    };
  }

  const trendPoint = normalizeTrendPoint(incomingPoint);

  if (!trendPoint) {
    return null;
  }

  return {
    type: "tick",

    timestamp: trendPoint[0],

    price: trendPoint[1],
  };
}

/* ==========================================================================
   Candlestick Live Merge
   ========================================================================== */

/**
 * Frequent price ticks must not create one
 * full-width candle for every request.
 *
 * Incoming ticks are aggregated into a
 * configurable candle bucket. The active
 * candle is updated until the next bucket
 * begins.
 */
function mergeCandlestickLivePoint(currentData, incomingPoint, options) {
  const data = normalizeMarketChartData(currentData, "candlestick");

  const incoming = normalizeLiveCandlestickInput(incomingPoint);

  if (!incoming) {
    return null;
  }

  const bucketSize = toPositiveInteger(
    options.candleBucketSize,
    DEFAULT_CANDLE_BUCKET_SIZE,
  );

  const bucketTimestamp =
    Math.floor(incoming.timestamp / bucketSize) * bucketSize;

  const location = findTimestampIndex(data, bucketTimestamp);

  const existingIndex = location.found ? location.index : -1;

  const previousCandle = location.index > 0 ? data[location.index - 1] : null;

  const previousClose = previousCandle ? previousCandle[4] : null;

  let candle;

  if (existingIndex >= 0) {
    const existing = data[existingIndex];

    const incomingHigh =
      incoming.type === "candle" ? incoming.high : incoming.price;

    const incomingLow =
      incoming.type === "candle" ? incoming.low : incoming.price;

    const incomingClose =
      incoming.type === "candle" ? incoming.close : incoming.price;

    candle = [
      bucketTimestamp,

      /*
       * Preserve the bucket's original open.
       */
      existing[1],

      Math.max(existing[2], incomingHigh),

      Math.min(existing[3], incomingLow),

      incomingClose,
    ];

    data[existingIndex] = candle;
  } else if (incoming.type === "candle") {
    candle = [
      bucketTimestamp,

      incoming.open,
      incoming.high,
      incoming.low,
      incoming.close,
    ];

    data.splice(location.index, 0, candle);
  } else {
    const open = previousClose ?? incoming.price;

    candle = [
      bucketTimestamp,

      open,

      Math.max(open, incoming.price),

      Math.min(open, incoming.price),

      incoming.price,
    ];

    data.splice(location.index, 0, candle);
  }

  const limited = limitMarketChartPoints(data, options.maxPoints);

  const retainedIndex = location.index - limited.removed;

  const index =
    retainedIndex >= 0 &&
    retainedIndex < limited.data.length &&
    limited.data[retainedIndex][0] === bucketTimestamp
      ? retainedIndex
      : -1;

  const replaced = existingIndex >= 0;

  const appended = !replaced && location.index === data.length - 1;

  const inserted = !replaced && !appended;

  return {
    data: limited.data,

    point: candle,

    index,

    replaced,
    appended,
    inserted,

    shifted: appended && limited.removed > 0,

    bucketUpdated: replaced,

    bucketAppended: appended,

    sourceTimestamp: incoming.timestamp,

    bucketTimestamp,

    bucketSize,
  };
}

/* ==========================================================================
   Live Point Merge
   ========================================================================== */

export function mergeMarketChartLivePoint(
  currentData,
  incomingPoint,
  {
    mode = DEFAULT_MODE,

    maxPoints = DEFAULT_MAX_POINTS,

    candleBucketSize = DEFAULT_CANDLE_BUCKET_SIZE,
  } = {},
) {
  const normalizedMode = normalizeMarketChartMode(mode);

  const options = {
    mode: normalizedMode,

    maxPoints,

    candleBucketSize,
  };

  if (normalizedMode === "candlestick") {
    return mergeCandlestickLivePoint(currentData, incomingPoint, options);
  }

  return mergeTrendLivePoint(currentData, incomingPoint, options);
}

/* ==========================================================================
   Range Mutation
   ========================================================================== */

export function setMarketChartRangeData(ranges, range, mode, data) {
  if (!isPlainObject(ranges)) {
    return false;
  }

  const normalizedRange = normalizeMarketChartRange(range);

  const normalizedMode = normalizeMarketChartMode(mode);

  const normalizedData = normalizeMarketChartData(data, normalizedMode);

  if (!ranges[normalizedRange]) {
    ranges[normalizedRange] = createEmptyRangeRecord();
  } else {
    const normalizedRecord = normalizeRangeRecord(ranges[normalizedRange]);

    ranges[normalizedRange] = normalizedRecord || createEmptyRangeRecord();
  }

  ranges[normalizedRange][normalizedMode] = normalizedData;

  /*
   * Trend and line share the same point
   * representation. Synchronizing them allows
   * a visual mode change without losing data.
   */
  if (normalizedMode === "trend") {
    ranges[normalizedRange].line = clonePoints(normalizedData);
  } else if (normalizedMode === "line") {
    ranges[normalizedRange].trend = clonePoints(normalizedData);
  }

  return true;
}

/* ==========================================================================
   Exports
   ========================================================================== */

export {
  CHART_MODES,
  DEFAULT_CAPABILITIES,
  DEFAULT_CANDLE_BUCKET_SIZE,
  DEFAULT_INTRADAY_RANGE,
  DEFAULT_MAX_POINTS,
};
