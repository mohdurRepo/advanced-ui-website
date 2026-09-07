/* ==========================================================================
   Market Chart Data
   ========================================================================== */

/*
 * Data boundary between the application/API and Highcharts.
 *
 * Highcharts receives canonical data only:
 *
 * Line / trend:
 *   [timestamp, value]
 *
 * Candlestick:
 *   [timestamp, open, high, low, close]
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const CHART_MODES = new Set(["trend", "line", "candlestick"]);

const DEFAULT_MODE = "trend";

const DEFAULT_RANGE = "1D";

const DEFAULT_INTRADAY_RANGE = "1D";

/*
 * Temporary compatibility exports.
 *
 * These remain while market-chart.js is being simplified.
 */
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
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function clonePoints(points) {
  return Array.isArray(points)
    ? points.map((point) => (Array.isArray(point) ? [...point] : point))
    : [];
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
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();

    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    /*
     * Treat smaller Unix values as seconds.
     *
     * Highcharts datetime x values use milliseconds.
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
   * Reject invalid OHLC geometry.
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
   Data Normalization
   ========================================================================== */

export function normalizeMarketChartData(data, mode = DEFAULT_MODE) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const normalizedMode = normalizeMarketChartMode(mode);

  const pointsByTimestamp = new Map();

  for (const sourcePoint of data) {
    const point =
      normalizedMode === "candlestick"
        ? normalizeCandlestickPoint(sourcePoint)
        : normalizeTrendPoint(sourcePoint);

    if (!point) {
      continue;
    }

    /*
     * Last occurrence wins when timestamps are duplicated.
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

function normalizeRangeRecord(record) {
  /*
   * Simple array means trend/line data.
   */
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

  const trendSource = record.trend ?? record.line ?? sharedData;

  const lineSource = record.line ?? record.trend ?? sharedData;

  const trend = normalizeMarketChartData(trendSource, "trend");

  const line =
    lineSource === trendSource
      ? clonePoints(trend)
      : normalizeMarketChartData(lineSource, "line");

  const candlestick = normalizeMarketChartData(
    record.candlestick ?? record.candles ?? record.ohlc ?? [],
    "candlestick",
  );

  return {
    comparisonValue: toFiniteNumber(
      record.comparisonValue ?? record.previousClose,
    ),

    trend,

    line,

    candlestick,
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

  const normalizedRanges = {};

  for (const [range, record] of Object.entries(ranges)) {
    const normalizedRange = normalizeMarketChartRange(range);

    if (!isMarketChartRangeSupported(normalizedRange, capabilities)) {
      continue;
    }

    const normalizedRecord = normalizeRangeRecord(record);

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

  const available = [];

  for (const range of Object.keys(ranges)) {
    const normalizedRange = normalizeMarketChartRange(range);

    if (
      !available.includes(normalizedRange) &&
      isMarketChartRangeSupported(normalizedRange, capabilities)
    ) {
      available.push(normalizedRange);
    }
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
   Range Data Update
   ========================================================================== */

export function setMarketChartRangeData(ranges, range, mode, data) {
  if (!isPlainObject(ranges)) {
    return false;
  }

  const normalizedRange = normalizeMarketChartRange(range);

  const normalizedMode = normalizeMarketChartMode(mode);

  const normalizedData = normalizeMarketChartData(data, normalizedMode);

  const record = normalizeRangeRecord(ranges[normalizedRange]) ?? {
    comparisonValue: null,
    trend: [],
    line: [],
    candlestick: [],
  };

  record[normalizedMode] = normalizedData;

  /*
   * Trend and line share the same [x, y] format.
   */
  if (normalizedMode === "trend") {
    record.line = clonePoints(normalizedData);
  }

  if (normalizedMode === "line") {
    record.trend = clonePoints(normalizedData);
  }

  ranges[normalizedRange] = record;

  return true;
}

/* ==========================================================================
   Compatibility Exports
   ========================================================================== */

export {
  CHART_MODES,
  DEFAULT_CAPABILITIES,
  DEFAULT_CANDLE_BUCKET_SIZE,
  DEFAULT_INTRADAY_RANGE,
  DEFAULT_MAX_POINTS,
};
