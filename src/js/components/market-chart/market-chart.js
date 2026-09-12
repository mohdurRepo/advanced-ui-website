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

/* ==========================================================================
   Market Chart Controller

   Owns one Highstock instance per element: range/mode selection, the
   live-data record, "follow latest" viewport behavior, controls, resize/
   theme observers, teardown. Range shape: { comparisonValue, trend,
   candlestick }. Navigator always reads `trend` (see market-chart-options.js).
   ========================================================================== */

const chartRegistry = new Map();
const MARKET_CHART_MODES = Object.freeze(["trend", "line", "candlestick"]);
const LIVE_PAUSE_HISTORICAL_RANGE = "historical-range";
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

  /*
   * null keeps the complete intraday session visible. A positive duration
   * (ms) enables an optional trailing live window instead.
   */
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

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && value.ownerDocument);
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

function toPositiveNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toPositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

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

/* ==========================================================================
   DOM / Events
   ========================================================================== */

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
    new CustomEventConstructor(type, { bubbles: true, detail }),
  );
  return true;
}

/* ==========================================================================
   Configuration
   ========================================================================== */

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

/* ==========================================================================
   Stored Data
   ========================================================================== */

function getStoredRangeData(record, mode) {
  if (!record) {
    return [];
  }

  if (normalizeMarketChartMode(mode) === "candlestick") {
    return Array.isArray(record.candlestick) ? record.candlestick : [];
  }

  return Array.isArray(record.trend) ? record.trend : [];
}

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

/* ==========================================================================
   Data Bounds / Viewport
   ========================================================================== */

function getDataBounds(data) {
  if (!Array.isArray(data) || !data.length) {
    return null;
  }

  const minimum = toFiniteNumber(data[0]?.[0]);
  const maximum = toFiniteNumber(data[data.length - 1]?.[0]);
  return minimum === null || maximum === null ? null : { minimum, maximum };
}

function getBoundsDuration(bounds) {
  return bounds ? Math.max(0, bounds.maximum - bounds.minimum) : 0;
}

function clampViewport(viewport, bounds) {
  if (!viewport || !bounds) {
    return null;
  }

  const dataDuration = getBoundsDuration(bounds);
  if (dataDuration <= 0) {
    return { ...bounds };
  }

  const viewportDuration = Math.min(getBoundsDuration(viewport), dataDuration);
  if (viewportDuration <= 0) {
    return { ...bounds };
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

  return { minimum, maximum };
}

/* ==========================================================================
   Live Point Storage
   ========================================================================== */

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
 * Insert/replace/append a point into a sorted-by-timestamp array, reporting
 * which Highcharts operation applies:
 *
 *   noop    same timestamp, same values           -> nothing to draw
 *   append  new latest timestamp                    -> series.addPoint()
 *   replace same latest timestamp, changed values    -> point.update()
 *   reset   historical correction/insertion, or the  -> series.setData()
 *           trim discarded more than one point
 */
function upsertPoint(data, point, maxPoints, onEvict) {
  const timestamp = point[0];
  const lastIndex = data.length - 1;
  const last = lastIndex >= 0 ? data[lastIndex] : null;

  /* Append */
  if (!last || timestamp > last[0]) {
    data.push(point);
    const removed = trimLiveData(data, maxPoints, onEvict);
    return removed > 1
      ? { type: "reset", point, shifted: false }
      : { type: "append", point, shifted: removed === 1 };
  }

  /* Same latest timestamp */
  if (timestamp === last[0]) {
    if (pointsEqual(last, point)) {
      return { type: "noop", point, shifted: false };
    }

    data[lastIndex] = point;
    return { type: "replace", point, shifted: false };
  }

  /* Historical correction / insertion */
  const index = findPointIndex(data, timestamp);
  if (data[index]?.[0] === timestamp) {
    if (pointsEqual(data[index], point)) {
      return { type: "noop", point, shifted: false };
    }

    data[index] = point;
  } else {
    data.splice(index, 0, point);
  }

  trimLiveData(data, maxPoints, onEvict);
  return { type: "reset", point, shifted: false };
}

/* ==========================================================================
   Live Payload
   ========================================================================== */

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

  /* Batch. */
  if (
    Array.isArray(value) &&
    value.length &&
    (Array.isArray(value[0]) || isPlainObject(value[0]))
  ) {
    return value;
  }

  /* Single point. */
  return [value];
}

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

function normalizeAcceptedLiveItems(payload) {
  const accepted = [];
  for (const sourcePoint of normalizeLivePayload(payload)) {
    const pricePoint = normalizeLivePricePoint(sourcePoint);
    if (pricePoint) {
      accepted.push({ sourcePoint, pricePoint });
    }
  }

  /* Apply batches chronologically. */
  accepted.sort((first, second) => first.pricePoint[0] - second.pricePoint[0]);
  return accepted;
}

/* ==========================================================================
   Live Candlestick — assembles a forming candle from streaming last-price
   ticks (Highcharts' dataGrouping only aggregates static data, not this).
   Real OHLC from the backend is used directly when present.
   ========================================================================== */

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

/* ==========================================================================
   Highcharts Hot-Path Operation
   ========================================================================== */

function applySeriesOperation(series, operation, finalData) {
  if (!series || !operation || operation.type === "noop") {
    return false;
  }

  if (operation.type === "append") {
    series.addPoint(operation.point, false, operation.shifted, false);
    return true;
  }

  if (operation.type === "replace") {
    const points = series.data || series.points || [];
    const lastPoint = points[points.length - 1];
    if (lastPoint?.x === operation.point[0]) {
      lastPoint.update(operation.point, false, false);
      return true;
    }
  }

  /* Rare correction/insertion. */
  series.setData(finalData, false, false, false);
  return true;
}

/* ==========================================================================
   Controller
   ========================================================================== */

class MarketChartController {
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

    /* ----------------------------------------------------------------------
       Data
       ---------------------------------------------------------------------- */

    this.ranges = normalizeMarketChartRanges(this.configuration.ranges, {
      capabilities: this.capabilities,
    });
    let availableRanges = getAvailableMarketChartRanges(
      this.ranges,
      this.capabilities,
    );

    /*
     * Convenience path: a flat `data` array becomes the configured range.
     */
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

    /* ----------------------------------------------------------------------
       Runtime
       ---------------------------------------------------------------------- */

    this.chart = null;
    this.liveController = null;
    this.destroyed = false;
    this.initialized = false;
    this.state = "idle";
    this.presentationDirection = null;

    /* Initial 1D shows the complete session. */
    this.followLatest = false;
    this.userDetachedFromLive = false;
    this.liveViewportDuration = this.configuration.liveWindowDuration;
    this.resizeFrame = null;
    this.themeFrame = null;
    this.resizeObserver = null;
    this.themeObserver = null;
    this.removeAxisEvent = null;
    this.lastUpdatedFormatter = null;
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

  /* ==========================================================================
     State
     ========================================================================== */

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

  setLiveState(state) {
    if (this.destroyed) {
      return false;
    }

    const value = typeof state === "string" ? state : state?.state || "idle";
    this.element.dataset.chartLiveState = value;
    this.section?.setAttribute("data-chart-live-state", value);
    const status = this.controlsRoot?.querySelector("[data-chart-live-status]");
    if (status) {
      status.dataset.liveState = value;
    }

    dispatchChartEvent(this.element, "marketchartlivestatechange", {
      state: value,
      detail: typeof state === "object" ? state : null,
      controller: this,
    });
    return true;
  }

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

  /* ==========================================================================
     Messages
     ========================================================================== */

  clearMessage() {
    this.element
      .querySelectorAll(":scope > .market-chart__message")
      .forEach((message) => message.remove());
  }

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

  /* ==========================================================================
     Range / Data Access
     ========================================================================== */

  refreshAvailableRanges() {
    this.availableRanges = getAvailableMarketChartRanges(
      this.ranges,
      this.capabilities,
    );
    return [...this.availableRanges];
  }

  hasRange(range) {
    const normalizedRange = normalizeMarketChartRange(range);
    return Boolean(
      isMarketChartRangeSupported(normalizedRange, this.capabilities) &&
      this.ranges[normalizedRange],
    );
  }

  getRangeRecord(range = this.currentRange) {
    return this.ranges[normalizeMarketChartRange(range)] || null;
  }

  getRangeData(range = this.currentRange, mode = this.currentMode) {
    return getStoredRangeData(this.getRangeRecord(range), mode);
  }

  getActiveData() {
    return this.getRangeData();
  }

  hasActiveData() {
    return this.getActiveData().length > 0;
  }

  /*
   * Navigator source: always the trend (close price) array, regardless of
   * display mode — see module header.
   */
  getNavigatorData(range = this.currentRange) {
    return this.getRangeData(range, "trend");
  }

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

  getDirection(range = this.currentRange) {
    return getDataDirection(this.getRangeData(range, "trend"));
  }

  getLatestTimestamp(range = this.currentRange, mode = this.currentMode) {
    const data = this.getRangeData(range, mode);
    return data.length ? data[data.length - 1][0] : null;
  }

  /* ==========================================================================
     Availability
     ========================================================================== */

  isIntradayRange(range = this.currentRange) {
    return isMarketChartIntradayRange(range, this.capabilities);
  }

  getIntradayRange() {
    return this.capabilities.intradayRange || "1D";
  }

  isModeAvailable(mode, range = this.currentRange) {
    return this.getRangeData(range, mode).length > 0;
  }

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

  /* ==========================================================================
     Highstock Options
     ========================================================================== */

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

  /* ==========================================================================
     Highcharts Resolution
     ========================================================================== */

  getMainSeries() {
    if (!this.chart) {
      return null;
    }

    const id = `market-chart-${String(this.configuration.symbol || "series").toLowerCase()}`;
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

  getNavigatorXAxis() {
    return this.chart?.navigator?.xAxis || null;
  }

  /**
   * The single place in this controller allowed to touch the navigator.
   * Every other method (refreshChart, synchronizeLivePresentation, live
   * ticks) calls this instead of talking to the navigator directly — that
   * used to be three separate call sites each with their own slightly
   * different update logic, which is exactly how the navigator ended up
   * with a color that didn't match the main chart (one path updated style
   * without data, or vice versa) and a stale "1D" time format frozen onto
   * historical ranges (see below).
   *
   * `structural` controls whether navigator.xAxis/yAxis/handles/mask/
   * outline get refreshed. This is deliberately NOT part of every call:
   *
   *   The navigator's own xAxis config — including its label formatter and
   *   its `ordinal` flag — lives in `navigator.xAxis`, a completely
   *   separate options tree from `navigator.series`. Earlier, to fix
   *   duplicate navigator series (highcharts/highcharts#6158, #5846), this
   *   controller stopped ever pushing `navigator` through chart.update()
   *   except on enable/disable. That correctly stopped the duplication,
   *   but it also froze navigator.xAxis at whatever it was when the chart
   *   was first created — so a chart created on "1D" keeps that range's
   *   intraday HH:MM formatter and non-ordinal axis forever, even after
   *   switching to "1W"/"1M"/etc. That's the literal cause of "00:00"
   *   labels showing up on historical-range navigators: the label
   *   formatter never updated, only the series data did.
   *
   *   The fix is to update `chart.navigator.xAxis` (and yAxis/handles/
   *   mask/outline) directly, scoped to that object — the same principle
   *   already applied to the main chart's xAxis. This does NOT touch
   *   `navigator.series` at all, so it carries none of the duplication
   *   risk that pushing the whole `navigator` object through chart.update()
   *   did. `structural` only needs to run on range/mode changes, not on
   *   every live tick, since none of those properties depend on price data.
   */
  syncNavigator({ style = true, data = true, structural = false } = {}) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const chartOptions = this.createOptions();
    const navigatorConfig = chartOptions.navigator;
    const shouldBeEnabled = navigatorConfig?.enabled === true;
    const currentlyEnabled = Boolean(this.chart.navigator?.series?.length);

    /*
     * Structural enable/disable — the only case that still touches
     * navigator.series via chart.update(), because there's no way to
     * create/destroy the navigator's series without it. Rare (data going
     * from empty to available or back), so the residual duplication risk
     * documented at that call's original introduction remains an
     * acceptable trade-off here specifically.
     */
    if (shouldBeEnabled !== currentlyEnabled) {
      this.chart.update({ navigator: navigatorConfig }, false);
      this.verifyNavigatorIntegrity("syncNavigator:toggle");

      return true;
    }

    if (!shouldBeEnabled) {
      return false;
    }

    if (structural && this.chart.navigator) {
      /*
       * Scoped update on the navigator's own sub-objects, explicitly
       * excluding `series` — this is what keeps the label format/ordinal
       * flag/handles/mask in sync with the current range without ever
       * re-touching navigator.series.
       */
      this.chart.navigator.update(
        {
          height: navigatorConfig.height,
          margin: navigatorConfig.margin,
          maskInside: navigatorConfig.maskInside,
          maskFill: navigatorConfig.maskFill,
          outlineWidth: navigatorConfig.outlineWidth,
          outlineColor: navigatorConfig.outlineColor,
          handles: navigatorConfig.handles,
          xAxis: navigatorConfig.xAxis,
          yAxis: navigatorConfig.yAxis,
        },
        false,
      );
    }

    const navigatorSeries = this.getNavigatorSeries();

    if (!navigatorSeries) {
      return false;
    }

    if (style && isPlainObject(navigatorConfig?.series)) {
      const { data: ignoredNavigatorData, ...navigatorStyle } =
        navigatorConfig.series;

      navigatorSeries.update(navigatorStyle, false);
    }

    if (data) {
      (this.getNavigatorSeries() || navigatorSeries).setData(
        this.getNavigatorData(),
        false,
        false,
        false,
      );
    }

    this.verifyNavigatorIntegrity("syncNavigator");

    return true;
  }

  getNavigatorSeries() {
    const series = this.chart?.navigator?.series;
    if (!Array.isArray(series) || !series.length) {
      return null;
    }

    return (
      series.find(
        (item) => item.options?.id === "market-chart-navigator-series",
      ) ||
      series[0] ||
      null
    );
  }

  /**
   * More than one navigator series existing at once means Highcharts
   * didn't replace the previous one when it should have — see the
   * duplicate-navigator-series notes in refreshChart(). getNavigatorSeries()
   * always returns the *first* id match, so if a stale duplicate exists,
   * every .update() call above keeps hitting whichever one Highcharts put
   * first in the array — which may not be the one actually visible on top,
   * leaving the visible one stuck with a stale color and a stale time
   * extent (hence its own tick labels landing in the wrong place). This
   * check surfaces exactly which series exist, with enough detail (color,
   * point count, time range) to identify the actual trigger instead of
   * guessing at it again.
   */
  verifyNavigatorIntegrity(context) {
    const series = this.chart?.navigator?.series;

    if (!Array.isArray(series) || series.length <= 1) {
      return true;
    }

    console.warn(
      `Market Chart (${this.configuration.symbol || "unknown"}): navigator has ` +
        `${series.length} series after "${context}" — expected exactly 1. This is the ` +
        "duplicate-navigator-series bug. Details per series follow:",
      series.map((item, index) => ({
        index,
        id: item.options?.id,
        renderedColor: item.color,
        configuredLineColor: item.options?.lineColor,
        pointCount: item.data?.length ?? item.options?.data?.length ?? 0,
        firstTimestamp:
          item.data?.[0]?.x ?? item.options?.data?.[0]?.[0] ?? null,
        lastTimestamp:
          item.data?.at(-1)?.x ?? item.options?.data?.at(-1)?.[0] ?? null,
      })),
    );

    return false;
  }

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

  getViewport() {
    const axis = this.getMainXAxis();
    const minimum = toFiniteNumber(axis?.min);
    const maximum = toFiniteNumber(axis?.max);
    return minimum !== null && maximum !== null ? { minimum, maximum } : null;
  }

  /* ==========================================================================
     Initial Render
     ========================================================================== */

  renderInitialChart() {
    if (this.destroyed || this.chart) {
      return this.chart;
    }

    this.clearMessage();

    /*
     * Set the direction attribute BEFORE createOptions() reads computed
     * styles — market-chart-theme.js resolves --chart-line from CSS based
     * on this attribute, so reading it first would use the base .market-
     * chart neutral default for one frame instead of the real direction.
     */
    this.presentationDirection = this.getDirection();
    this.element.dataset.chartDirection = this.presentationDirection;

    this.chart = this.Highcharts.stockChart(this.element, this.createOptions());
    if (!this.chart) {
      throw new Error("Highstock did not create the Market Chart.");
    }

    this.bindAxisEvents();
    this.verifyNavigatorIntegrity("renderInitialChart");

    /* Initial chart always starts on the complete available dataset. */
    this.setFollowLatest(false, { source: "initialize" });
    return this.chart;
  }

  /* ==========================================================================
     Structural Refresh
     ========================================================================== */

  refreshChart(options = {}) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const preserveViewport = options.preserveViewport === true;
    const previousViewport = preserveViewport ? this.getViewport() : null;
    const data = this.getActiveData();

    /* See renderInitialChart() — direction attribute must precede createOptions(). */
    this.presentationDirection = this.getDirection();
    this.element.dataset.chartDirection = this.presentationDirection;

    const chartOptions = this.createOptions(data);
    const [mainSeriesOptions] = chartOptions.series || [];

    /*
     * `navigator` is deliberately never included in the payload sent to
     * chart.update() here — see syncNavigator() for the full reasoning.
     * Its series/xAxis/handles/etc. are synced separately, below, through
     * that single centralized method.
     *
     * `xAxis` (the main chart's) is excluded from the same broad payload
     * for a related reason: this factory builds a brand-new
     * `tickPositioner` closure on every call, and pushing that through the
     * top-level chart.update() risks the same class of wider internal
     * rebuild as the navigator case. Updating the Axis object directly is
     * the scoped, lower-risk equivalent.
     */
    const {
      series: ignoredSeries,
      navigator: ignoredNavigator,
      xAxis: xAxisOptions,
      yAxis: yAxisOptions,
      ...chartUpdate
    } = chartOptions;

    try {
      this.chart.update(chartUpdate, false, false, options.animation ?? false);

      const mainXAxis = this.getMainXAxis();

      if (mainXAxis && xAxisOptions) {
        mainXAxis.update(xAxisOptions, false);
      }

      if (this.chart.yAxis?.[0] && yAxisOptions) {
        this.chart.yAxis[0].update(yAxisOptions, false);
      }

      let mainSeries = this.getMainSeries();
      if (!mainSeries) {
        throw new Error("Market Chart main series is unavailable.");
      }

      if (mainSeriesOptions) {
        const { data: ignoredData, ...seriesOptions } = mainSeriesOptions;

        /* Structural path only: areaspline <-> line <-> candlestick. */
        mainSeries.update(seriesOptions, false);
        mainSeries = this.getMainSeries() || mainSeries;
      }

      mainSeries.setData(data, false, false, false);

      /*
       * Range/mode changes are exactly the case that needs `structural:
       * true` — the navigator's own label format and ordinal flag depend
       * on which range is active.
       */
      this.syncNavigator({ style: true, data: true, structural: true });

      /* chart.update() may recreate axis internals. */
      this.bindAxisEvents();
      if (previousViewport && preserveViewport) {
        this.restoreViewport(previousViewport, false);
      } else {
        /* Every new backend range opens on the complete dataset. */
        this.applyDefaultViewport(false);
      }

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

  /* ==========================================================================
     Axis Events
     ========================================================================== */

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

  handleAfterSetExtremes(event) {
    if (this.destroyed) {
      return;
    }

    const trigger = String(event?.trigger || "");

    /* Ignore controller-generated setExtremes calls. */
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
      viewport: { minimum, maximum },
      trigger: trigger || "axis",
      controller: this,
    });

    /* Live-follow state belongs only to 1D/intraday. */
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

    /* User moved away from the live edge. */
    this.userDetachedFromLive = !atLatest;
    if (atLatest) {
      /*
       * If the user selected a smaller navigator window that still ends
       * at latest, preserve that window while following future points.
       */
      this.liveViewportDuration = duration;
    }

    this.setFollowLatest(atLatest, {
      source: "user",
      trigger: trigger || "axis",
    });
  }

  /* ==========================================================================
     Viewport
     ========================================================================== */

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

    axis.setExtremes(minimum, maximum, redraw, false, { trigger });
    return true;
  }

  restoreViewport(viewport, redraw = true) {
    const resolved = clampViewport(
      viewport,
      getDataBounds(this.getActiveData()),
    );
    return resolved
      ? this.applyViewport(resolved, redraw, "market-chart-restore")
      : false;
  }

  /* Initial load and every backend range selection show the complete range. */
  applyDefaultViewport(redraw = true) {
    const bounds = getDataBounds(this.getActiveData());
    return bounds
      ? this.applyViewport(bounds, redraw, "market-chart-range")
      : false;
  }

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

    /* Default: show the complete intraday session. */
    if (!duration || duration >= getBoundsDuration(bounds)) {
      return this.applyViewport(bounds, redraw, "market-chart-live");
    }

    return this.applyViewport(
      {
        minimum: Math.max(bounds.minimum, bounds.maximum - duration),
        maximum: bounds.maximum,
      },
      redraw,
      "market-chart-live",
    );
  }

  /* ==========================================================================
     Live Range Lifecycle
     ========================================================================== */

  synchronizeLiveRange({ refresh = false } = {}) {
    if (this.destroyed || !this.liveController) {
      return false;
    }

    const state = this.liveController.getState();

    /* Explicit autostart:false / stopped controller remains stopped. */
    if (!state.active) {
      return true;
    }

    /* Historical ranges never poll the intraday endpoint. */
    if (!this.isIntradayRange()) {
      if (state.pauseReasons.includes(LIVE_PAUSE_HISTORICAL_RANGE)) {
        return true;
      }

      return this.liveController.pause(LIVE_PAUSE_HISTORICAL_RANGE);
    }

    /*
     * Returning to 1D removes only the range-owned pause reason. Other
     * reasons (offline, document hidden, market closed) remain untouched.
     */
    if (state.pauseReasons.includes(LIVE_PAUSE_HISTORICAL_RANGE)) {
      return this.liveController.resume(LIVE_PAUSE_HISTORICAL_RANGE);
    }

    if (refresh && !state.paused) {
      return this.liveController.refresh();
    }

    return true;
  }

  /* ==========================================================================
     Range Selection
     ========================================================================== */

  setRange(range, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeMarketChartRange(range);
    if (!this.hasRange(normalizedRange)) {
      console.warn(`Market Chart range "${normalizedRange}" is unavailable.`);
      return false;
    }

    /* Same Range */
    if (normalizedRange === this.currentRange && options.force !== true) {
      if (options.resetViewport === true) {
        this.userDetachedFromLive = false;
        this.liveViewportDuration = this.configuration.liveWindowDuration;
        this.setFollowLatest(false, { source: "range-reset" });
        this.applyDefaultViewport(options.redraw !== false);
      }

      this.synchronizeLiveRange({ refresh: options.refreshLive !== false });
      return true;
    }

    /* Range Change */
    const previousRange = this.currentRange;
    const previousMode = this.currentMode;

    /*
     * Pause live before rendering a historical range so any active
     * intraday request is aborted.
     */
    if (!this.isIntradayRange(normalizedRange)) {
      this.liveController?.pause(LIVE_PAUSE_HISTORICAL_RANGE);
    }

    this.currentRange = normalizedRange;
    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      normalizedRange,
    );

    /* Every backend range starts with a clean viewport state. */
    this.userDetachedFromLive = false;
    this.liveViewportDuration = this.configuration.liveWindowDuration;
    this.setFollowLatest(false, { source: "range" });
    const updated = this.refreshChart({
      preserveViewport: false,
      redraw: options.redraw !== false,
      animation: options.animation ?? false,
    });
    if (!updated) {
      this.currentRange = previousRange;
      this.currentMode = previousMode;
      this.synchronizeLiveRange({ refresh: false });
      return false;
    }

    this.updateControls();
    this.updateLastUpdated(this.getLatestTimestamp());
    this.synchronizeLiveRange({ refresh: options.refreshLive !== false });
    dispatchChartEvent(this.element, "marketchartrangechange", {
      range: this.currentRange,
      previousRange,
      controller: this,
    });
    return true;
  }

  /* ==========================================================================
     Mode Selection
     ========================================================================== */

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
    const crossesCandlestick =
      previousMode === "candlestick" || normalizedMode === "candlestick";
    const updated = this.refreshChart({
      /* Visual representation changes preserve navigator viewport. */
      preserveViewport: true,
      redraw: options.redraw !== false,
      animation: crossesCandlestick ? false : (options.animation ?? false),
    });
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

  /* ==========================================================================
     External Data
     ========================================================================== */

  /**
   * Atomically replace one complete backend range.
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

    /* Inactive range is only stored. */
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

  setRanges(ranges, options = {}) {
    if (this.destroyed || !isPlainObject(ranges)) {
      return false;
    }

    const normalized = normalizeMarketChartRanges(ranges, {
      capabilities: this.capabilities,
    });
    this.ranges =
      options.merge === true ? { ...this.ranges, ...normalized } : normalized;
    this.refreshAvailableRanges();
    if (!this.hasRange(this.currentRange)) {
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
    this.setFollowLatest(false, { source: "ranges" });
    this.updateControls();
    const updated = this.refreshChart({
      preserveViewport: options.preserveViewport === true,
      redraw: options.redraw !== false,
      animation: options.animation ?? false,
    });
    if (updated) {
      this.updateLastUpdated(this.getLatestTimestamp());
      this.synchronizeLiveRange({ refresh: options.refreshLive === true });
    }

    return updated;
  }

  /* ==========================================================================
     Controls
     ========================================================================== */

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
      /* Clicking the active range resets to the complete dataset. */
      resetViewport: true,
    });
  }

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

  updateControls() {
    if (!this.controlsRoot) {
      return;
    }

    const rangeSelector =
      this.configuration.controls?.rangeSelector || "[data-chart-range]";
    this.controlsRoot.querySelectorAll(rangeSelector).forEach((button) => {
      const range = normalizeMarketChartRange(
        button.dataset.chartRange || button.dataset.range,
      );
      const active = range === this.currentRange;
      const available = this.hasRange(range);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.disabled = !available;
      button.setAttribute("aria-disabled", available ? "false" : "true");
    });
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

  /* ==========================================================================
     Intraday Record
     ========================================================================== */

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
    return record;
  }

  /* ==========================================================================
     Live Presentation
     ========================================================================== */

  synchronizeLivePresentation(direction) {
    if (
      this.destroyed ||
      !this.chart ||
      direction === this.presentationDirection
    ) {
      return false;
    }

    this.element.dataset.chartDirection = direction;
    const chartOptions = this.createOptions();
    const mainOptions = chartOptions.series?.[0];
    let mainSeries = this.getMainSeries();
    if (mainSeries && mainOptions && this.currentMode !== "candlestick") {
      const presentation = {
        color: mainOptions.color,
        lineColor: mainOptions.lineColor,
        lineWidth: mainOptions.lineWidth,
      };
      if (mainOptions.fillColor !== undefined) {
        presentation.fillColor = mainOptions.fillColor;
      }

      mainSeries.update(presentation, false);
    }

    /* series.update() may recreate Highcharts objects. */
    mainSeries = this.getMainSeries() || mainSeries;
    if (mainSeries) {
      mainSeries.setData(this.getActiveData(), false, false, false);
    }

    /*
     * A direction flip never changes range/mode, so the navigator's own
     * xAxis format/ordinal flag don't need refreshing — only its series
     * color and data do, and always together, in the same call, so they
     * can never drift apart the way they could when this used to be its
     * own separate hand-written block.
     */
    this.syncNavigator({ style: true, data: true, structural: false });

    this.presentationDirection = direction;
    return true;
  }

  /* ==========================================================================
     Visible Live Synchronization
     ========================================================================== */

  synchronizeVisibleLiveData({ record, trendOperations, candleOperations }) {
    const mainSeries = this.getMainSeries();
    if (!mainSeries) {
      return false;
    }

    const mainData = this.getActiveData();
    const mainOperations =
      this.currentMode === "candlestick" ? candleOperations : trendOperations;
    const changedMainOperations = mainOperations.filter(
      (operation) => operation && operation.type !== "noop",
    );
    const changedNavigatorOperations = trendOperations.filter(
      (operation) => operation && operation.type !== "noop",
    );

    /*
     * Example: OHLC high/low changes while close stays the same —
     * candlestick must redraw while the trend-based navigator may not.
     */
    const mainChanged = changedMainOperations.length > 0;
    const navigatorChanged = changedNavigatorOperations.length > 0;
    if (!mainChanged && !navigatorChanged) {
      return false;
    }

    const direction = this.getDirection();
    const directionChanged = direction !== this.presentationDirection;
    if (directionChanged) {
      this.synchronizeLivePresentation(direction);
      return true;
    }

    /*
     * Main series keeps the fine-grained addPoint()/point.update() path
     * below — that's where animation smoothness actually matters. The
     * navigator, however, always goes through syncNavigator() with a
     * plain setData(): a handful of live points landing on an already-
     * small navigator dataset is cheap enough that the extra complexity
     * of tracking append/replace/reset separately for it isn't worth
     * carrying — it was also the second place (besides the color/data
     * split fixed above) where the navigator could end up inconsistent
     * with the main chart, since this path used to have its own
     * independent operation-application logic for the navigator series.
     */
    const requiresReset = changedMainOperations.some(
      (operation) => operation.type === "reset",
    );
    const batch = changedMainOperations.length > 1;

    if (batch || requiresReset) {
      if (mainChanged) {
        mainSeries.setData(mainData, false, false, false);
      }
    } else if (mainChanged) {
      applySeriesOperation(mainSeries, changedMainOperations[0], mainData);
    }

    if (navigatorChanged) {
      this.syncNavigator({ style: false, data: true, structural: false });
    }

    return mainChanged || navigatorChanged;
  }

  /* ==========================================================================
     Live Application
     ========================================================================== */

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

    /* Captured before mutation — only a genuinely larger value may move the viewport. */
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

    for (const { sourcePoint, pricePoint } of accepted) {
      latestAcceptedPoint = pricePoint;
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

    if (evictedCount > 0) {
      /*
       * maxPoints is a hard cap enforced per array, not a "keep today's
       * session" rule — if it's set below what a real trading session
       * produces at the configured poll cadence, the session's own early
       * data gets silently evicted well before the session even ends, no
       * backgrounded tab required. That's a config sizing problem, not
       * expected behavior, so it's surfaced loudly rather than silently.
       */
      console.warn(
        `Market Chart (${this.configuration.symbol || "unknown"}): ` +
          `maxPoints (${this.configuration.maxPoints}) was exceeded and ${evictedCount} ` +
          "point(s) were evicted from the start of the current intraday session. " +
          "If the session is still open, this is real data loss on the 1D chart — " +
          "raise maxPoints to comfortably exceed a full session's expected point count.",
      );
    }

    const trendChanged = trendOperations.some(
      (operation) => operation?.type !== "noop",
    );
    const candlesChanged = candleOperations.some(
      (operation) => operation?.type !== "noop",
    );

    /*
     * Market closed / unchanged API response: no Highcharts work, no
     * redraw, no updated-time change, no live-update event.
     */
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
    if (availabilityMayChange) {
      this.updateControls();
    }

    let chartChanged = false;
    if (visible) {
      if (activeWasEmpty) {
        /* Recovery from initially empty intraday data. */
        this.userDetachedFromLive = false;
        this.liveViewportDuration = this.configuration.liveWindowDuration;
        this.setFollowLatest(false, { source: "live-recovery" });
        chartChanged = this.refreshChart({
          preserveViewport: false,
          redraw: true,
          animation: false,
        });
      } else {
        chartChanged = this.synchronizeVisibleLiveData({
          record,
          trendOperations,
          candleOperations,
        });
        if (chartChanged) {
          /* Only a genuinely newer timestamp may move the viewport. */
          if (genuinelyNewTimestamp && !this.userDetachedFromLive) {
            this.setFollowLatest(true, { source: "new-data" });
            this.applyLiveViewport(false);
          }

          /* Exactly one redraw for the live transaction. */
          this.chart?.redraw(false);
          if (this.state !== "ready") {
            this.clearMessage();
            this.setState("ready");
          }
        }
      }
    }

    this.updateLastUpdated(currentLatestTimestamp ?? latestAcceptedPoint?.[0]);
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

    /*
     * market-chart-live.js uses this boolean to distinguish a successful
     * response from an actual data change.
     */
    return true;
  }

  /* ==========================================================================
     Live Controller
     ========================================================================== */

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

    /* One polling controller per chart controller. */
    this.liveController?.destroy();
    this.liveController = createMarketChartLiveController({
      interval: live.interval ?? 60_000,
      alignToInterval: live.alignToInterval ?? true,

      /* Usually false because the initial snapshot is already loaded. */
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
          mode: "trend",

          /*
           * Inclusive reconciliation boundary — the adapter may return the
           * equal latest timestamp, a newer point, or a batch from `since`
           * onward. applyLiveData() owns noop/replace/append/reset.
           */
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

      /* If the initial selected range is historical, pause immediately. */
      this.synchronizeLiveRange({ refresh: false });
    }

    return this.liveController;
  }

  /* ==========================================================================
     Live Polling API
     ========================================================================== */

  startLive() {
    if (this.destroyed || !this.liveController) {
      return false;
    }

    const started = this.liveController.start();
    if (started) {
      this.synchronizeLiveRange({ refresh: this.isIntradayRange() });
    }

    return started;
  }

  pauseLive(reason = "manual") {
    if (this.destroyed) {
      return false;
    }

    return this.liveController?.pause(reason) ?? false;
  }

  resumeLiveUpdates(reason = "manual") {
    if (this.destroyed || !this.liveController) {
      return false;
    }

    /* Never let an external resume override historical-range ownership. */
    if (reason !== LIVE_PAUSE_HISTORICAL_RANGE && !this.isIntradayRange()) {
      return false;
    }

    return this.liveController.resume(reason);
  }

  refreshLive() {
    if (this.destroyed || !this.isIntradayRange()) {
      return false;
    }

    return this.liveController?.refresh() ?? false;
  }

  stopLive() {
    if (this.destroyed) {
      return false;
    }

    return this.liveController?.stop() ?? false;
  }

  /* ==========================================================================
     Live Viewport API
     ========================================================================== */

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
    this.setFollowLatest(true, { source: "programmatic" });
    return this.applyLiveViewport(options.redraw !== false);
  }

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

  setLiveWindowDuration(duration, options = {}) {
    if (this.destroyed) {
      return false;
    }

    /* null / false / 0 means: show the complete intraday session. */
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

  /* ==========================================================================
     Last Updated
     ========================================================================== */

  getLastUpdatedFormatter() {
    if (this.lastUpdatedFormatter) {
      return this.lastUpdatedFormatter;
    }

    try {
      this.lastUpdatedFormatter = new Intl.DateTimeFormat(
        this.configuration.language || "en",
        {
          timeZone: this.configuration.timeZone || "Asia/Riyadh",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        },
      );
    } catch {
      this.lastUpdatedFormatter = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });
    }

    return this.lastUpdatedFormatter;
  }

  updateLastUpdated(timestamp) {
    const value = normalizeMarketChartTimestamp(timestamp);
    if (value === null) {
      return false;
    }

    const element = this.controlsRoot?.querySelector(
      "[data-chart-updated-time]",
    );
    if (!element) {
      return false;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return false;
    }

    element.dateTime = date.toISOString();
    element.textContent = this.getLastUpdatedFormatter().format(date);
    return true;
  }

  /* ==========================================================================
     Rendering / Resize
     ========================================================================== */

  isRenderable() {
    return Boolean(
      this.element.isConnected && this.element.getClientRects().length,
    );
  }

  requestFrame(callback) {
    if (typeof this.window?.requestAnimationFrame === "function") {
      return this.window.requestAnimationFrame(callback);
    }

    return this.window?.setTimeout
      ? this.window.setTimeout(callback, 16)
      : globalThis.setTimeout(callback, 16);
  }

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

  scheduleReflow() {
    if (this.destroyed || !this.chart || this.resizeFrame !== null) {
      return;
    }

    this.resizeFrame = this.requestFrame(() => {
      this.resizeFrame = null;
      this.reflow();
    });
  }

  reflow() {
    if (this.destroyed || !this.chart || !this.isRenderable()) {
      return false;
    }

    /* Highstock owns chart, axis and navigator geometry. */
    this.chart.reflow();
    return true;
  }

  /* ==========================================================================
     Theme
     ========================================================================== */

  handleThemeMutation() {
    if (this.destroyed || this.themeFrame !== null) {
      return;
    }

    this.themeFrame = this.requestFrame(() => {
      this.themeFrame = null;
      this.refreshTheme();
    });
  }

  refreshTheme() {
    if (this.destroyed || !this.chart) {
      return false;
    }

    /* Theme changes are rare and legitimately use a structural refresh. */
    return this.refreshChart({
      preserveViewport: true,
      redraw: true,
      animation: false,
    });
  }

  /* ==========================================================================
     Observers
     ========================================================================== */

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

      /* Observe the host only — never observe the Highcharts SVG. */
      this.resizeObserver.observe(this.element);
    } else {
      this.window?.addEventListener(
        "resize",
        () => {
          this.scheduleReflow();
        },
        { passive: true, signal: this.listenerController.signal },
      );
    }

    const MutationObserverConstructor =
      this.window?.MutationObserver || globalThis.MutationObserver;
    if (typeof MutationObserverConstructor === "function") {
      this.themeObserver = new MutationObserverConstructor(
        this.handleThemeMutation,
      );

      /* Theme and direction only — market tabs belong to page lifecycle. */
      this.themeObserver.observe(this.document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "data-contrast", "dir"],
      });
    }
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

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

    /* Start on the complete dataset. */
    this.userDetachedFromLive = false;
    this.liveViewportDuration = this.configuration.liveWindowDuration;
    this.setFollowLatest(false, { source: "initialize" });
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

    dispatchChartEvent(this.element, "marketchartready", { controller: this });
    return this;
  }

  /* ==========================================================================
     Public State
     ========================================================================== */

  getChart() {
    return this.chart;
  }

  getState() {
    return {
      state: this.state,
      destroyed: this.destroyed,
      initialized: this.initialized,
      renderable: this.isRenderable(),

      range: this.currentRange,
      mode: this.currentMode,
      direction: this.getDirection(),
      comparisonValue: this.getComparisonValue(),

      capabilities: { ...this.capabilities },
      availableRanges: [...this.availableRanges],

      navigator: {
        enabled: Boolean(this.chart?.navigator),
        followLatest: this.followLatest,
        userDetachedFromLive: this.userDetachedFromLive,
        viewport: this.getViewport(),
        dataBounds: getDataBounds(this.getActiveData()),
        liveWindowDuration: this.liveViewportDuration,
      },

      live: this.liveController?.getState() || null,
    };
  }

  /* ==========================================================================
     Destruction
     ========================================================================== */

  destroy() {
    if (this.destroyed) {
      return false;
    }

    /* Set first so callbacks cannot perform chart work during teardown. */
    this.destroyed = true;
    this.liveController?.destroy();
    this.liveController = null;
    this.removeAxisEvent?.();
    this.removeAxisEvent = null;
    this.listenerController.abort();
    this.resizeObserver?.disconnect();
    this.themeObserver?.disconnect();
    this.resizeObserver = null;
    this.themeObserver = null;
    if (this.resizeFrame !== null) {
      this.cancelFrame(this.resizeFrame);
    }

    if (this.themeFrame !== null) {
      this.cancelFrame(this.themeFrame);
    }

    this.resizeFrame = null;
    this.themeFrame = null;
    this.chart?.destroy();
    this.chart = null;
    this.clearMessage();
    this.element.removeAttribute("data-chart-state");
    this.element.removeAttribute("data-chart-message");
    this.element.removeAttribute("data-chart-direction");
    this.element.removeAttribute("data-chart-live-state");
    this.element.removeAttribute("data-chart-follow-live");
    this.section?.removeAttribute("data-chart-live-state");
    this.section?.removeAttribute("data-chart-follow-live");
    this.section?.setAttribute("aria-busy", "false");

    /* Delete only if this controller is still the registered owner. */
    if (chartRegistry.get(this.element) === this) {
      chartRegistry.delete(this.element);
    }

    dispatchChartEvent(this.element, "marketchartdestroy", {
      controller: this,
    });
    return true;
  }
}

/* ==========================================================================
   Creation Error
   ========================================================================== */

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

/* ==========================================================================
   Public API
   ========================================================================== */

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
    /* Validate replacement first. */
    controller = new MarketChartController(element, source);

    /*
     * One host owns one controller. Replacement completely destroys the
     * old Highcharts instance, live request, polling timer, observers,
     * and listeners.
     */
    existing?.destroy();
    chartRegistry.set(element, controller);
    controller.initialize();
    return controller;
  } catch (error) {
    controller?.destroy();

    /* Constructor failure can retain a still-valid existing controller. */
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

export function getMarketChart(target) {
  const element = resolveElement(target);
  return element ? chartRegistry.get(element) || null : null;
}

export function destroyMarketChart(target) {
  const controller = getMarketChart(target);
  return controller ? controller.destroy() : false;
}

export function destroyAllMarketCharts() {
  const controllers = [...chartRegistry.values()];
  for (const controller of controllers) {
    controller.destroy();
  }

  chartRegistry.clear();
  return controllers.length;
}

/* ==========================================================================
   Class Export
   ========================================================================== */

export { MarketChartController };
