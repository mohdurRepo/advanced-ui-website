/* ==========================================================================
   Market Chart Data
   ========================================================================== */

const CHART_MODES = new Set(["trend", "line", "candlestick"]);

const DEFAULT_MAX_POINTS = 500;

/* ==========================================================================
   Numeric Helpers
   ========================================================================== */

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/* ==========================================================================
   Timestamp Helpers
   ========================================================================== */

function normalizeTimestamp(value) {
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
     * Values below one trillion are normally Unix seconds.
     */
    return numericValue < 1_000_000_000_000
      ? numericValue * 1000
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
    const timestamp = normalizeTimestamp(point[0]);
    const value = toFiniteNumber(point[1]);

    if (timestamp === null || value === null) {
      return null;
    }

    return [timestamp, value];
  }

  if (!point || typeof point !== "object") {
    return null;
  }

  const timestamp = normalizeTimestamp(
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
  } else if (point && typeof point === "object") {
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

  const normalizedTimestamp = normalizeTimestamp(timestamp);

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
    pointsByTimestamp.set(point[0], point);
  });

  return [...pointsByTimestamp.values()].sort(
    (first, second) => first[0] - second[0],
  );
}

/* ==========================================================================
   Data Normalization
   ========================================================================== */

export function normalizeMarketChartData(data, mode = "trend") {
  if (!Array.isArray(data)) {
    return [];
  }

  const normalizedMode = CHART_MODES.has(mode) ? mode : "trend";

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
      trend,
      line: [...trend],
      candlestick: [],
    };
  }

  if (!record || typeof record !== "object") {
    return null;
  }

  const trend = normalizeMarketChartData(
    record.trend ?? record.line ?? record.data ?? [],
    "trend",
  );

  const line = normalizeMarketChartData(
    record.line ?? record.trend ?? record.data ?? [],
    "line",
  );

  const candlestick = normalizeMarketChartData(
    record.candlestick ?? record.candles ?? record.ohlc ?? [],
    "candlestick",
  );

  return {
    trend,
    line,
    candlestick,
  };
}

/* ==========================================================================
   Range Normalization
   ========================================================================== */

export function normalizeMarketChartRanges(ranges) {
  if (!ranges || typeof ranges !== "object") {
    return {};
  }

  return Object.entries(ranges).reduce((normalizedRanges, [range, record]) => {
    const normalizedRecord = normalizeRangeRecord(record);

    if (!normalizedRecord) {
      return normalizedRanges;
    }

    normalizedRanges[String(range)] = normalizedRecord;

    return normalizedRanges;
  }, {});
}

/* ==========================================================================
   Point Value
   ========================================================================== */

function getPointValue(point, mode) {
  if (!Array.isArray(point)) {
    return null;
  }

  if (mode === "candlestick") {
    return toFiniteNumber(point[4]);
  }

  return toFiniteNumber(point[1]);
}

/* ==========================================================================
   Direction
   ========================================================================== */

export function getMarketChartDirection(data, mode = "trend") {
  const normalizedData = normalizeMarketChartData(data, mode);

  if (normalizedData.length < 2) {
    return "neutral";
  }

  const previousValue = getPointValue(
    normalizedData[normalizedData.length - 2],
    mode,
  );

  const currentValue = getPointValue(
    normalizedData[normalizedData.length - 1],
    mode,
  );

  if (previousValue === null || currentValue === null) {
    return "neutral";
  }

  if (currentValue > previousValue) {
    return "up";
  }

  if (currentValue < previousValue) {
    return "down";
  }

  return "neutral";
}

/* ==========================================================================
   Live Point Merge
   ========================================================================== */

export function mergeMarketChartLivePoint(
  currentData,
  incomingPoint,
  { mode = "trend", maxPoints = DEFAULT_MAX_POINTS } = {},
) {
  const normalizedCurrentData = normalizeMarketChartData(currentData, mode);

  const normalizedIncomingData = normalizeMarketChartData(
    [incomingPoint],
    mode,
  );

  if (!normalizedIncomingData.length) {
    return null;
  }

  const point = normalizedIncomingData[0];
  const timestamp = point[0];

  const nextData = [...normalizedCurrentData];

  const existingIndex = nextData.findIndex(
    (existingPoint) => existingPoint[0] === timestamp,
  );

  let replaced = false;
  let appended = false;

  if (existingIndex >= 0) {
    nextData[existingIndex] = point;
    replaced = true;
  } else {
    nextData.push(point);
    appended = true;
  }

  nextData.sort((first, second) => first[0] - second[0]);

  const parsedMaxPoints = Number.parseInt(maxPoints, 10);

  const safeMaxPoints =
    Number.isFinite(parsedMaxPoints) && parsedMaxPoints > 1
      ? parsedMaxPoints
      : DEFAULT_MAX_POINTS;

  let shifted = false;

  if (nextData.length > safeMaxPoints) {
    const excess = nextData.length - safeMaxPoints;

    nextData.splice(0, excess);

    shifted = appended && excess > 0;
  }

  const index = nextData.findIndex(
    (existingPoint) => existingPoint[0] === timestamp,
  );

  return {
    data: nextData,
    point,
    index,

    replaced,
    appended,
    shifted,
  };
}
