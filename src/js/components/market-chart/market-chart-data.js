/* ==========================================================================
   Market Chart Data
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Normalize external market data.
 * - Normalize named ranges and chart modes.
 * - Validate trend and OHLC points.
 * - Sort and deduplicate data at ingestion boundaries.
 * - Resolve range availability and comparison values.
 * - Provide safe reusable public data helpers.
 * - Provide an optimized general live-merge utility.
 *
 * Performance contract:
 *
 * This module is the DEFENSIVE boundary for external data.
 *
 * It is correct for normalization here to:
 *
 * - allocate;
 * - validate;
 * - deduplicate;
 * - sort.
 *
 * The high-frequency live-render path in market-chart.js does not repeatedly
 * call these full-array normalization functions. Controller-owned runtime data
 * is already normalized and is updated incrementally.
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
   Mode
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

/* ==========================================================================
   Range
   ========================================================================== */

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
     * Values below 100 billion are interpreted as Unix seconds.
     *
     * Larger values are interpreted as Unix milliseconds.
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
   *
   * High must contain both open and close.
   * Low must contain both open and close.
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
   Point Normalization
   ========================================================================== */

function normalizePointForMode(point, mode) {
  return mode === "candlestick"
    ? normalizeCandlestickPoint(point)
    : normalizeTrendPoint(point);
}

/* ==========================================================================
   Sorting and Deduplication
   ========================================================================== */

function sortAndDeduplicate(points) {
  if (!Array.isArray(points) || !points.length) {
    return [];
  }

  /*
   * Last point wins when duplicate timestamps exist.
   *
   * This matches live replacement semantics.
   */

  const pointsByTimestamp = new Map();

  points.forEach((point) => {
    pointsByTimestamp.set(point[0], point);
  });

  return [...pointsByTimestamp.values()].sort(
    (first, second) => first[0] - second[0],
  );
}

/* ==========================================================================
   Timestamp Search
   ========================================================================== */

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
   Normalized Data Detection
   ========================================================================== */

/*
 * Used by the reusable live-merge helpers.
 *
 * Instead of automatically rebuilding a Map + sorting the complete existing
 * dataset, first check whether it is already in the canonical internal form.
 *
 * This performs no allocations.
 */

function isNormalizedTrendPoint(point) {
  return Boolean(
    Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]),
  );
}

function isNormalizedCandlestickPoint(point) {
  if (!Array.isArray(point) || point.length < 5) {
    return false;
  }

  const [timestamp, open, high, low, close] = point;

  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close)
  ) {
    return false;
  }

  return !(
    high < low ||
    high < open ||
    high < close ||
    low > open ||
    low > close
  );
}

function isNormalizedOrderedData(data, mode) {
  if (!Array.isArray(data)) {
    return false;
  }

  if (!data.length) {
    return true;
  }

  const validatePoint =
    mode === "candlestick"
      ? isNormalizedCandlestickPoint
      : isNormalizedTrendPoint;

  let previousTimestamp = -Infinity;

  for (let index = 0; index < data.length; index += 1) {
    const point = data[index];

    if (!validatePoint(point)) {
      return false;
    }

    const timestamp = point[0];

    /*
     * Strictly increasing timestamps guarantee both ordering and
     * deduplication.
     */

    if (timestamp <= previousTimestamp) {
      return false;
    }

    previousTimestamp = timestamp;
  }

  return true;
}

/* ==========================================================================
   Live Merge Preparation
   ========================================================================== */

/*
 * Public mergeMarketChartLivePoint() remains pure:
 *
 * it never mutates the caller's outer data array.
 *
 * If the input is already canonical we need only a shallow array copy.
 * Existing point arrays are never mutated by the merge algorithms.
 *
 * If input is arbitrary external data, fall back to complete normalization.
 */

function prepareDataForLiveMerge(data, mode) {
  if (isNormalizedOrderedData(data, mode)) {
    return data.slice();
  }

  return normalizeMarketChartData(data, mode);
}

/* ==========================================================================
   Data Normalization
   ========================================================================== */

export function normalizeMarketChartData(data, mode = DEFAULT_MODE) {
  if (!Array.isArray(data) || !data.length) {
    return [];
  }

  const normalizedMode = normalizeMarketChartMode(mode);

  const points = [];

  /*
   * Avoid intermediate map().filter() arrays.
   *
   * External data is normalized in one pass before deduplication / sorting.
   */

  for (let index = 0; index < data.length; index += 1) {
    const normalizedPoint = normalizePointForMode(data[index], normalizedMode);

    if (normalizedPoint) {
      points.push(normalizedPoint);
    }
  }

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

      /*
       * Keep trend / line externally independent at ingestion.
       *
       * The runtime controller may intentionally share them later while
       * processing live ticks.
       */

      line: clonePoints(trend),

      candlestick: [],
    };
  }

  if (!isPlainObject(record)) {
    return null;
  }

  const sharedData = record.data ?? [];

  /*
   * comparisonValue is the official value immediately before the named
   * range. previousClose remains a supported integration alias.
   */

  const comparisonValue = toFiniteNumber(
    record.comparisonValue ?? record.previousClose,
  );

  const trendSource = record.trend ?? record.line ?? sharedData;

  const lineSource = record.line ?? record.trend ?? sharedData;

  const trend = normalizeMarketChartData(trendSource, "trend");

  /*
   * When line and trend resolve to the same source, normalize it only once.
   */

  const line =
    lineSource === trendSource
      ? clonePoints(trend)
      : normalizeMarketChartData(lineSource, "line");

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

  const normalizedRanges = {};

  Object.entries(ranges).forEach(([range, record]) => {
    const normalizedRange = normalizeMarketChartRange(range);

    if (!isMarketChartRangeSupported(normalizedRange, capabilities)) {
      return;
    }

    const normalizedRecord = normalizeRangeRecord(record);

    if (!normalizedRecord) {
      return;
    }

    normalizedRanges[normalizedRange] = normalizedRecord;
  });

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

  const availableRanges = [];

  Object.keys(ranges).forEach((range) => {
    const normalizedRange = normalizeMarketChartRange(range);

    if (availableRanges.includes(normalizedRange)) {
      return;
    }

    if (!isMarketChartRangeSupported(normalizedRange, capabilities)) {
      return;
    }

    availableRanges.push(normalizedRange);
  });

  return availableRanges;
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

/*
 * Public helper.
 *
 * This function intentionally remains defensive because callers outside the
 * MarketChartController may pass arbitrary range objects.
 *
 * The optimized runtime controller does NOT use this method for every live
 * read; it accesses its already-normalized range record directly.
 */

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
   * Trend and line share [timestamp, value] geometry and may safely fall back
   * to each other.
   *
   * Candlesticks must never fall back to trend data.
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
 * Returns the official value immediately before a named range.
 *
 * This value is intended for:
 *
 * - tooltip amount change;
 * - tooltip percentage change;
 * - integrations explicitly requesting comparison-baseline direction.
 *
 * It remains separate from default visible-series direction.
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
 * Resolves visible-series direction.
 *
 * Default:
 *
 *   final value > first value  → up
 *   final value < first value  → down
 *   final value = first value  → neutral
 *
 * `comparisonValue` remains available for callers that explicitly request:
 *
 *   { baseline: "comparison" }
 *
 * Public callers may pass untrusted data, so this helper intentionally
 * normalizes its input. The runtime chart controller has its own O(1)
 * direction resolver for already-normalized storage.
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

/*
 * The live-merge helpers operate on their own outer-array copy, so trimming
 * that working array in place does not mutate the caller's array.
 */

function limitMarketChartPoints(data, maxPoints) {
  const safeMaxPoints = toPositiveInteger(maxPoints, DEFAULT_MAX_POINTS);

  const removed = Math.max(0, data.length - safeMaxPoints);

  if (removed > 0) {
    data.splice(0, removed);
  }

  return {
    data,

    removed,
  };
}

/* ==========================================================================
   Trend Live Merge
   ========================================================================== */

function mergeTrendLivePoint(currentData, incomingPoint, options) {
  const mode = normalizeMarketChartMode(options.mode);

  /*
   * If currentData is already canonical this creates only one shallow outer
   * array copy. No full normalization, Map construction or sorting occurs.
   */

  const data = prepareDataForLiveMerge(currentData, mode);

  /*
   * Normalize only the incoming point.
   */

  const point = normalizePointForMode(incomingPoint, mode);

  if (!point) {
    return null;
  }

  const timestamp = point[0];

  let index = -1;

  let replaced = false;

  let appended = false;

  let inserted = false;

  const lastIndex = data.length - 1;

  const lastPoint = lastIndex >= 0 ? data[lastIndex] : null;

  /* -----------------------------------------------------------------------
     Fast Append Path
     -------------------------------------------------------------------- */

  if (!lastPoint) {
    data.push(point);

    index = 0;

    appended = true;
  } else if (timestamp > lastPoint[0]) {
    data.push(point);

    index = data.length - 1;

    appended = true;
  } else if (timestamp === lastPoint[0]) {

  /* -----------------------------------------------------------------------
     Fast Latest Replacement
     -------------------------------------------------------------------- */
    data[lastIndex] = point;

    index = lastIndex;

    replaced = true;
  } else {

  /* -----------------------------------------------------------------------
     Rare Historical Insert / Replacement
     -------------------------------------------------------------------- */
    const location = findTimestampIndex(data, timestamp);

    index = location.index;

    if (location.found) {
      data[index] = point;

      replaced = true;
    } else {
      data.splice(index, 0, point);

      inserted = true;
    }
  }

  const limited = limitMarketChartPoints(data, options.maxPoints);

  const retainedIndex = index - limited.removed;

  const finalIndex =
    retainedIndex >= 0 &&
    retainedIndex < limited.data.length &&
    limited.data[retainedIndex]?.[0] === timestamp
      ? retainedIndex
      : -1;

  return {
    data: limited.data,

    point,

    index: finalIndex,

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
  /*
   * Prefer a complete OHLC point when supplied.
   */

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

  /*
   * Otherwise treat the incoming value as an ordinary price tick.
   */

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
   Candlestick Construction
   ========================================================================== */

function createTickCandle(bucketTimestamp, price, previousClose = null) {
  const open = previousClose ?? price;

  return [
    bucketTimestamp,
    open,
    Math.max(open, price),
    Math.min(open, price),
    price,
  ];
}

function createIncomingCandle(bucketTimestamp, incoming) {
  return [
    bucketTimestamp,
    incoming.open,
    incoming.high,
    incoming.low,
    incoming.close,
  ];
}

function updateExistingCandle(existing, bucketTimestamp, incoming) {
  const incomingHigh =
    incoming.type === "candle" ? incoming.high : incoming.price;

  const incomingLow =
    incoming.type === "candle" ? incoming.low : incoming.price;

  const incomingClose =
    incoming.type === "candle" ? incoming.close : incoming.price;

  return [
    bucketTimestamp,

    /*
     * Preserve the bucket's original open.
     */

    existing[1],

    Math.max(existing[2], incomingHigh),

    Math.min(existing[3], incomingLow),

    incomingClose,
  ];
}

/* ==========================================================================
   Candlestick Live Merge
   ========================================================================== */

/**
 * Frequent price ticks are aggregated into a configurable candle bucket.
 *
 * Example with a 60-second bucket:
 *
 *   10:00:05
 *   10:00:10
 *   10:00:15
 *
 * all update one 10:00 candle rather than creating three candles.
 */

function mergeCandlestickLivePoint(currentData, incomingPoint, options) {
  const data = prepareDataForLiveMerge(currentData, "candlestick");

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

  let index = -1;

  let candle = null;

  let replaced = false;

  let appended = false;

  let inserted = false;

  const lastIndex = data.length - 1;

  const lastCandle = lastIndex >= 0 ? data[lastIndex] : null;

  /* -----------------------------------------------------------------------
     Empty Dataset
     -------------------------------------------------------------------- */

  if (!lastCandle) {
    candle =
      incoming.type === "candle"
        ? createIncomingCandle(bucketTimestamp, incoming)
        : createTickCandle(bucketTimestamp, incoming.price);

    data.push(candle);

    index = 0;

    appended = true;
  } else if (bucketTimestamp === lastCandle[0]) {

  /* -----------------------------------------------------------------------
     Current Candle Bucket
     -------------------------------------------------------------------- */
    candle = updateExistingCandle(lastCandle, bucketTimestamp, incoming);

    data[lastIndex] = candle;

    index = lastIndex;

    replaced = true;
  } else if (bucketTimestamp > lastCandle[0]) {

  /* -----------------------------------------------------------------------
     New Latest Candle Bucket
     -------------------------------------------------------------------- */
    candle =
      incoming.type === "candle"
        ? createIncomingCandle(bucketTimestamp, incoming)
        : createTickCandle(bucketTimestamp, incoming.price, lastCandle[4]);

    data.push(candle);

    index = data.length - 1;

    appended = true;
  } else {

  /* -----------------------------------------------------------------------
     Rare Historical Bucket
     -------------------------------------------------------------------- */
    const location = findTimestampIndex(data, bucketTimestamp);

    index = location.index;

    if (location.found) {
      const existing = data[index];

      candle = updateExistingCandle(existing, bucketTimestamp, incoming);

      data[index] = candle;

      replaced = true;
    } else {
      const previousCandle = index > 0 ? data[index - 1] : null;

      candle =
        incoming.type === "candle"
          ? createIncomingCandle(bucketTimestamp, incoming)
          : createTickCandle(
              bucketTimestamp,
              incoming.price,
              previousCandle ? previousCandle[4] : null,
            );

      data.splice(index, 0, candle);

      inserted = true;
    }
  }

  const limited = limitMarketChartPoints(data, options.maxPoints);

  const retainedIndex = index - limited.removed;

  const finalIndex =
    retainedIndex >= 0 &&
    retainedIndex < limited.data.length &&
    limited.data[retainedIndex]?.[0] === bucketTimestamp
      ? retainedIndex
      : -1;

  return {
    data: limited.data,

    point: candle,

    index: finalIndex,

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

/**
 * Safely merge one live point into a dataset.
 *
 * This helper remains useful for integrations outside MarketChartController.
 *
 * Performance:
 *
 * - canonical ordered input:
 *     shallow outer-array copy + incremental mutation;
 *
 * - arbitrary external input:
 *     defensive normalization + deduplication + sorting.
 *
 * The function never mutates the caller's outer array.
 */

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

function ensureRangeRecordForMutation(ranges, range) {
  const existing = ranges[range];

  if (!existing) {
    const record = createEmptyRangeRecord();

    ranges[range] = record;

    return record;
  }

  /*
   * setMarketChartRangeData() is an explicit ingestion operation rather than
   * a five-second hot-path operation.
   *
   * Preserve the defensive contract here by normalizing an arbitrary existing
   * record before modifying it.
   */

  const normalizedRecord =
    normalizeRangeRecord(existing) || createEmptyRangeRecord();

  ranges[range] = normalizedRecord;

  return normalizedRecord;
}

export function setMarketChartRangeData(ranges, range, mode, data) {
  if (!isPlainObject(ranges)) {
    return false;
  }

  const normalizedRange = normalizeMarketChartRange(range);

  const normalizedMode = normalizeMarketChartMode(mode);

  /*
   * External data enters the canonical model here.
   */

  const normalizedData = normalizeMarketChartData(data, normalizedMode);

  const record = ensureRangeRecordForMutation(ranges, normalizedRange);

  record[normalizedMode] = normalizedData;

  /*
   * Trend and line use identical [timestamp, value] geometry.
   *
   * Keep them synchronized for externally set data so mode switching cannot
   * unexpectedly produce an empty chart.
   *
   * They remain separate arrays at this public ingestion boundary to avoid
   * surprising aliasing for callers holding references.
   */

  if (normalizedMode === "trend") {
    record.line = clonePoints(normalizedData);
  } else if (normalizedMode === "line") {
    record.trend = clonePoints(normalizedData);
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
