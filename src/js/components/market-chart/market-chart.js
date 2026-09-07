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
  normalizeMarketChartTimestamp,
  setMarketChartRangeData,
} from "./market-chart-data";

import { createMarketChartLiveController } from "./market-chart-live";

import { createMarketChartOptions } from "./market-chart-options";

/* ==========================================================================
   Registry
   ========================================================================== */

const chartRegistry = new Map();

/* ==========================================================================
   Constants
   ========================================================================== */

const MARKET_CHART_MODES = Object.freeze(["trend", "line", "candlestick"]);

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

  liveWindowDuration: null,

  controls: {},

  live: null,

  /*
   * market-chart-options.js defaults
   * exporting to disabled for this
   * component.
   */
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
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && value.ownerDocument);
}

function toFiniteNumber(value) {
  if (
    value === null ||
    value === undefined ||
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

function clonePoints(points) {
  return Array.isArray(points)
    ? points.map((point) => (Array.isArray(point) ? [...point] : point))
    : [];
}

/* ==========================================================================
   DOM Helpers
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
      // Fall through.
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
    return;
  }

  const CustomEventConstructor =
    element.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;

  if (typeof CustomEventConstructor !== "function") {
    return;
  }

  element.dispatchEvent(
    new CustomEventConstructor(type, {
      bubbles: true,

      detail,
    }),
  );
}

/* ==========================================================================
   Configuration
   ========================================================================== */

function normalizeConfiguration(
  configuration = {},
  document = globalThis.document,
) {
  const source = isPlainObject(configuration) ? configuration : {};

  const capabilities = normalizeMarketChartCapabilities(source.capabilities);

  /*
   * Supplying live configuration
   * enables live capability unless
   * the page explicitly disables it.
   */
  if (source.live && source.capabilities?.live === undefined) {
    capabilities.live = source.live.enabled !== false;
  }

  const suppliedMessages = isPlainObject(source.messages)
    ? source.messages
    : {};

  const messages = {
    ...DEFAULT_MESSAGES,

    ...suppliedMessages,
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

    language: source.language || document?.documentElement?.lang || "en",

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

    controls: isPlainObject(source.controls) ? source.controls : {},

    navigator: isPlainObject(source.navigator) ? source.navigator : {},

    exporting: isPlainObject(source.exporting) ? source.exporting : {},

    messages,
  };
}

/* ==========================================================================
   Stored Data Helpers
   ========================================================================== */

function getStoredRangeData(record, mode) {
  if (!record) {
    return [];
  }

  const normalizedMode = normalizeMarketChartMode(mode);

  const direct = Array.isArray(record[normalizedMode])
    ? record[normalizedMode]
    : [];

  if (direct.length) {
    return direct;
  }

  /*
   * Trend and line have the same
   * [x, y] geometry.
   */
  if (normalizedMode === "trend") {
    return Array.isArray(record.line) ? record.line : [];
  }

  if (normalizedMode === "line") {
    return Array.isArray(record.trend) ? record.trend : [];
  }

  return [];
}

function getPointValue(point, mode) {
  if (!Array.isArray(point)) {
    return null;
  }

  return normalizeMarketChartMode(mode) === "candlestick"
    ? toFiniteNumber(point[4])
    : toFiniteNumber(point[1]);
}

function getDataDirection(data, mode) {
  if (!Array.isArray(data) || data.length < 2) {
    return "neutral";
  }

  const first = getPointValue(data[0], mode);

  const last = getPointValue(data[data.length - 1], mode);

  if (first === null || last === null) {
    return "neutral";
  }

  if (last > first) {
    return "up";
  }

  if (last < first) {
    return "down";
  }

  return "neutral";
}

/* ==========================================================================
   Data Bounds
   ========================================================================== */

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

function getBoundsDuration(bounds) {
  if (!bounds) {
    return 0;
  }

  return Math.max(0, bounds.maximum - bounds.minimum);
}

function clampViewport(viewport, bounds) {
  if (!viewport || !bounds) {
    return null;
  }

  const dataDuration = getBoundsDuration(bounds);

  const viewportDuration = Math.min(getBoundsDuration(viewport), dataDuration);

  if (viewportDuration <= 0) {
    return {
      ...bounds,
    };
  }

  let minimum = Math.max(
    bounds.minimum,

    Math.min(
      viewport.minimum,

      bounds.maximum - viewportDuration,
    ),
  );

  let maximum = minimum + viewportDuration;

  if (maximum > bounds.maximum) {
    maximum = bounds.maximum;

    minimum = Math.max(
      bounds.minimum,

      maximum - viewportDuration,
    );
  }

  return {
    minimum,
    maximum,
  };
}

/* ==========================================================================
   Point Storage
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

function trimLiveData(data, maxPoints) {
  const overflow = data.length - maxPoints;

  if (overflow <= 0) {
    return 0;
  }

  data.splice(0, overflow);

  return overflow;
}

function upsertPoint(data, point, maxPoints) {
  const timestamp = point[0];

  const lastIndex = data.length - 1;

  const last = lastIndex >= 0 ? data[lastIndex] : null;

  /* ------------------------------------------------------------------------
     Append
     ------------------------------------------------------------------------ */

  if (!last || timestamp > last[0]) {
    data.push(point);

    const removed = trimLiveData(data, maxPoints);

    /*
     * Highcharts addPoint(..., shift)
     * can shift one point efficiently.
     *
     * If more than one old point
     * needed trimming, perform one
     * setData() instead.
     */
    if (removed > 1) {
      return {
        type: "reset",

        point,

        shifted: false,
      };
    }

    return {
      type: "append",

      point,

      shifted: removed === 1,
    };
  }

  /* ------------------------------------------------------------------------
     Replace Latest
     ------------------------------------------------------------------------ */

  if (timestamp === last[0]) {
    data[lastIndex] = point;

    return {
      type: "replace",

      point,

      shifted: false,
    };
  }

  /* ------------------------------------------------------------------------
     Historical Replacement / Insert
     ------------------------------------------------------------------------ */

  const index = findPointIndex(data, timestamp);

  if (data[index]?.[0] === timestamp) {
    data[index] = point;
  } else {
    data.splice(index, 0, point);
  }

  trimLiveData(data, maxPoints);

  /*
   * Out-of-order traffic is uncommon.
   *
   * setData() is safer and simpler
   * than trying to patch arbitrary
   * Highcharts point positions.
   */
  return {
    type: "reset",

    point,

    shifted: false,
  };
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
    } else if (Array.isArray(payload.data)) {
      value = payload.data;
    }
  }

  /*
   * Array of points.
   */
  if (
    Array.isArray(value) &&
    value.length &&
    (Array.isArray(value[0]) || isPlainObject(value[0]))
  ) {
    return value;
  }

  /*
   * One point.
   */
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

/* ==========================================================================
   Live Candle
   ========================================================================== */

function mergeLiveCandle(
  candles,
  sourcePoint,
  pricePoint,
  { bucketSize, maxPoints },
) {
  /*
   * The backend may already provide
   * an OHLC candle.
   */
  if (isOHLCPoint(sourcePoint)) {
    const candle = normalizeMarketChartData([sourcePoint], "candlestick")[0];

    if (candle) {
      return upsertPoint(candles, candle, maxPoints);
    }
  }

  /*
   * Otherwise aggregate the price
   * tick into the current candle.
   */
  const [timestamp, price] = pricePoint;

  const bucketTimestamp = Math.floor(timestamp / bucketSize) * bucketSize;

  const index = findPointIndex(candles, bucketTimestamp);

  const existing =
    candles[index]?.[0] === bucketTimestamp ? candles[index] : null;

  if (existing) {
    const candle = [
      bucketTimestamp,

      existing[1],

      Math.max(existing[2], price),

      Math.min(existing[3], price),

      price,
    ];

    return upsertPoint(candles, candle, maxPoints);
  }

  const previous = index > 0 ? candles[index - 1] : null;

  const open = previous?.[4] ?? price;

  const candle = [
    bucketTimestamp,

    open,

    Math.max(open, price),

    Math.min(open, price),

    price,
  ];

  return upsertPoint(candles, candle, maxPoints);
}

/* ==========================================================================
   Highcharts Live Operations
   ========================================================================== */

function applySingleSeriesOperation(series, operation, finalData) {
  if (!series || !operation) {
    return false;
  }

  if (operation.type === "append") {
    series.addPoint(
      operation.point,

      false,

      operation.shifted,

      false,
    );

    return true;
  }

  if (operation.type === "replace") {
    const timestamp = operation.point[0];

    const points = series.data || series.points || [];

    const lastPoint = points[points.length - 1];

    /*
     * Normal live replacement:
     * update the current point/candle.
     */
    if (lastPoint?.x === timestamp) {
      lastPoint.update(
        operation.point,

        false,

        false,
      );

      return true;
    }
  }

  /*
   * Rare historical replacement,
   * insertion or storage reset.
   */
  series.setData(
    finalData,

    false,

    false,

    false,
  );

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

    const baseData = normalizeMarketChartData(
      this.configuration.data,

      this.configuration.mode,
    );

    this.ranges = normalizeMarketChartRanges(this.configuration.ranges, {
      capabilities: this.capabilities,
    });

    this.availableRanges = getAvailableMarketChartRanges(
      this.ranges,

      this.capabilities,
    );

    /*
     * Allow one direct data array
     * without a ranges object.
     */
    if (!this.availableRanges.length && baseData.length) {
      const range = this.configuration.range;

      const candlestick = this.configuration.mode === "candlestick";

      this.ranges[range] = {
        comparisonValue: this.configuration.previousClose,

        trend: candlestick ? [] : clonePoints(baseData),

        line: candlestick ? [] : clonePoints(baseData),

        candlestick: candlestick ? clonePoints(baseData) : [],
      };

      this.availableRanges = [range];
    }

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

    /*
     * Current semantic series color.
     */
    this.presentationDirection = null;

    /*
     * Intraday viewport following is
     * application state.
     *
     * Highstock still owns the actual
     * navigator and x-axis rendering.
     */
    this.followLatest = this.isIntradayRange();

    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.suspensionReasons = new Set();

    this.pendingDataSync = false;

    this.themeDirty = false;

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

    dispatchChartEvent(
      this.element,

      "marketchartstatechange",

      {
        state,

        message,

        controller: this,
      },
    );

    return true;
  }

  setLiveState(state) {
    if (this.destroyed) {
      return false;
    }

    const value = typeof state === "string" ? state : state?.state || "idle";

    this.element.dataset.chartLiveState = value;

    this.section?.setAttribute(
      "data-chart-live-state",

      value,
    );

    const status = this.controlsRoot?.querySelector("[data-chart-live-status]");

    if (status) {
      status.dataset.liveState = value;
    }

    dispatchChartEvent(
      this.element,

      "marketchartlivestatechange",

      {
        state: value,

        detail: typeof state === "object" ? state : null,

        controller: this,
      },
    );

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
      dispatchChartEvent(
        this.element,

        "marketchartfollowchange",

        {
          followLatest: value,

          range: this.currentRange,

          controller: this,

          ...detail,
        },
      );
    }

    return value;
  }

  /* ==========================================================================
     Messages
     ========================================================================== */

  clearMessage() {
    this.element
      .querySelectorAll(":scope > .market-chart__message")
      .forEach((message) => {
        message.remove();
      });
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

    wrapper.setAttribute(
      "role",

      state === "error" ? "alert" : "status",
    );

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
     Range Data
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
      isMarketChartRangeSupported(
        normalizedRange,

        this.capabilities,
      ) && this.ranges[normalizedRange],
    );
  }

  getRangeRecord(range = this.currentRange) {
    return this.ranges[normalizeMarketChartRange(range)] || null;
  }

  getRangeData(
    range = this.currentRange,

    mode = this.currentMode,
  ) {
    return getStoredRangeData(
      this.getRangeRecord(range),

      mode,
    );
  }

  getActiveData() {
    return this.getRangeData();
  }

  hasActiveData() {
    return this.getActiveData().length > 0;
  }

  getNavigatorData(range = this.currentRange) {
    const record = this.getRangeRecord(range);

    if (!record) {
      return [];
    }

    if (Array.isArray(record.trend) && record.trend.length) {
      return record.trend;
    }

    if (Array.isArray(record.line) && record.line.length) {
      return record.line;
    }

    if (!Array.isArray(record.candlestick)) {
      return [];
    }

    /*
     * Navigator is always a small
     * [x, value] series.
     */
    return record.candlestick.map((point) => [point[0], point[4]]);
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

  getDirection(
    range = this.currentRange,

    mode = this.currentMode,
  ) {
    return getDataDirection(
      this.getRangeData(range, mode),

      mode,
    );
  }

  getLatestTimestamp(
    range = this.currentRange,

    mode = this.currentMode,
  ) {
    const data = this.getRangeData(range, mode);

    if (!data.length) {
      return null;
    }

    return data[data.length - 1][0];
  }

  /* ==========================================================================
     Availability
     ========================================================================== */

  isIntradayRange(range = this.currentRange) {
    return isMarketChartIntradayRange(
      range,

      this.capabilities,
    );
  }

  getIntradayRange() {
    return this.capabilities.intradayRange;
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

    return minimum !== null && maximum !== null
      ? {
          minimum,
          maximum,
        }
      : null;
  }

  /* ==========================================================================
     Initial Rendering
     ========================================================================== */

  renderInitialChart() {
    if (this.destroyed || this.chart) {
      return this.chart;
    }

    const options = this.createOptions();

    this.clearMessage();

    this.chart = this.Highcharts.stockChart(this.element, options);

    if (!this.chart) {
      throw new Error("Highstock did not create the Market Chart.");
    }

    this.presentationDirection = this.getDirection();

    this.element.dataset.chartDirection = this.presentationDirection;

    this.bindAxisEvents();

    return this.chart;
  }

  /* ==========================================================================
     Structural Chart Update
     ========================================================================== */

  /*
   * This method is intentionally NOT
   * used for ordinary live ticks.
   *
   * It is for:
   *
   * - range change;
   * - mode change;
   * - external data replacement;
   * - theme refresh;
   * - first point on an empty chart.
   */
  refreshChart(options = {}) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    if (this.isSuspended() && options.force !== true) {
      this.pendingDataSync = true;

      return true;
    }

    const preserveViewport = options.preserveViewport === true;

    const previousViewport = preserveViewport ? this.getViewport() : null;

    const data = this.getActiveData();

    const chartOptions = this.createOptions(data);

    const [mainSeriesOptions] = chartOptions.series;

    /*
     * Series data is synchronized
     * explicitly below.
     */
    const {
      series: ignoredSeries,

      ...chartUpdate
    } = chartOptions;

    /*
     * The navigator dataset is also
     * synchronized once below.
     *
     * Avoid feeding the same data
     * through chart.update() and
     * navigatorSeries.setData().
     */
    if (
      isPlainObject(chartUpdate.navigator) &&
      isPlainObject(chartUpdate.navigator.series)
    ) {
      const {
        data: ignoredNavigatorData,

        ...navigatorSeriesOptions
      } = chartUpdate.navigator.series;

      chartUpdate.navigator = {
        ...chartUpdate.navigator,

        series: navigatorSeriesOptions,
      };
    }

    try {
      this.chart.update(
        chartUpdate,

        false,

        false,

        options.animation ?? false,
      );

      let mainSeries = this.getMainSeries();

      if (!mainSeries) {
        throw new Error("Market Chart main series is unavailable.");
      }

      const {
        data: ignoredData,

        ...seriesOptions
      } = mainSeriesOptions;

      /*
       * Structural update:
       *
       * changing type between
       * areaspline / line / candlestick
       * legitimately belongs here.
       */
      mainSeries.update(
        seriesOptions,

        false,
      );

      /*
       * Series.update() may rebuild
       * the Highcharts series.
       */
      mainSeries = this.getMainSeries() || mainSeries;

      mainSeries.setData(
        data,

        false,

        false,

        false,
      );

      const navigatorSeries = this.getNavigatorSeries();

      if (chartOptions.navigator?.enabled && navigatorSeries) {
        navigatorSeries.setData(
          this.getNavigatorData(),

          false,

          false,

          false,
        );
      }

      /*
       * chart.update() may change the
       * axis internals, so rebind to
       * the current main x-axis.
       */
      this.bindAxisEvents();

      if (previousViewport && preserveViewport) {
        this.restoreViewport(
          previousViewport,

          false,
        );
      } else {
        this.applyDefaultViewport(false);
      }

      this.presentationDirection = this.getDirection();

      this.element.dataset.chartDirection = this.presentationDirection;

      this.pendingDataSync = false;

      this.themeDirty = false;

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

      dispatchChartEvent(
        this.element,

        "marketcharterror",

        {
          error,

          controller: this,
        },
      );

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

    /*
     * Ignore our own x-axis changes.
     */
    if (trigger.startsWith("market-chart-")) {
      return;
    }

    const minimum = toFiniteNumber(event?.min);

    const maximum = toFiniteNumber(event?.max);

    if (minimum === null || maximum === null) {
      return;
    }

    const viewport = {
      minimum,
      maximum,
    };

    dispatchChartEvent(
      this.element,

      "marketchartviewportchange",

      {
        range: this.currentRange,

        viewport,

        trigger: trigger || "axis",

        controller: this,
      },
    );

    /*
     * Follow-latest only matters for
     * the configured intraday range.
     */
    if (!this.isIntradayRange()) {
      return;
    }

    const bounds = getDataBounds(this.getActiveData());

    if (!bounds) {
      return;
    }

    const duration = maximum - minimum;

    const tolerance = Math.max(
      1_000,

      duration * 0.01,
    );

    const atLatest = bounds.maximum - maximum <= tolerance;

    if (atLatest) {
      this.liveViewportDuration = duration;
    }

    this.setFollowLatest(
      atLatest,

      {
        source: "user",

        trigger: trigger || "axis",
      },
    );
  }

  /* ==========================================================================
     Viewport
     ========================================================================== */

  applyViewport(viewport, redraw = true, trigger = "market-chart-data") {
    const axis = this.getMainXAxis();

    if (!axis || !viewport) {
      return false;
    }

    axis.setExtremes(
      viewport.minimum,

      viewport.maximum,

      redraw,

      false,

      {
        trigger,
      },
    );

    return true;
  }

  restoreViewport(viewport, redraw = true) {
    const bounds = getDataBounds(this.getActiveData());

    const resolved = clampViewport(viewport, bounds);

    if (!resolved) {
      return false;
    }

    return this.applyViewport(
      resolved,

      redraw,

      "market-chart-restore",
    );
  }

  applyDefaultViewport(redraw = true) {
    const bounds = getDataBounds(this.getActiveData());

    if (!bounds) {
      return false;
    }

    /*
     * Historical ranges show their
     * complete backend dataset.
     */
    if (!this.isIntradayRange()) {
      return this.applyViewport(
        bounds,

        redraw,

        "market-chart-range",
      );
    }

    /*
     * User has manually panned away
     * from the live edge.
     */
    if (!this.followLatest) {
      return false;
    }

    const duration =
      this.configuration.liveWindowDuration || this.liveViewportDuration;

    if (duration && duration < getBoundsDuration(bounds)) {
      return this.applyViewport(
        {
          minimum: bounds.maximum - duration,

          maximum: bounds.maximum,
        },

        redraw,

        "market-chart-live",
      );
    }

    return this.applyViewport(
      bounds,

      redraw,

      "market-chart-live",
    );
  }

  applyLiveViewport(redraw = false) {
    if (!this.followLatest || !this.isIntradayRange()) {
      return false;
    }

    return this.applyDefaultViewport(redraw);
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

    if (normalizedRange === this.currentRange && options.force !== true) {
      /*
       * Re-selecting the active
       * range may reset its viewport.
       */
      if (options.resetViewport === true) {
        const intraday = this.isIntradayRange(normalizedRange);

        this.setFollowLatest(
          intraday,

          {
            source: "range-reset",
          },
        );

        if (intraday) {
          this.applyLiveViewport(true);
        } else {
          const bounds = getDataBounds(this.getActiveData());

          if (bounds) {
            this.applyViewport(
              bounds,

              true,

              "market-chart-range",
            );
          }
        }
      }

      return true;
    }

    const previousRange = this.currentRange;

    const previousMode = this.currentMode;

    this.currentRange = normalizedRange;

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,

      normalizedRange,
    );

    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.setFollowLatest(
      this.isIntradayRange(normalizedRange),

      {
        source: "range",
      },
    );

    /*
     * Named ranges are separate
     * application datasets.
     *
     * Do not preserve another
     * dataset's viewport.
     */
    const updated = this.refreshChart({
      preserveViewport: false,

      redraw: options.redraw !== false,

      animation: options.animation ?? false,
    });

    if (!updated) {
      this.currentRange = previousRange;

      this.currentMode = previousMode;

      return false;
    }

    this.updateControls();

    this.updateLastUpdated(this.getLatestTimestamp());

    dispatchChartEvent(
      this.element,

      "marketchartrangechange",

      {
        range: this.currentRange,

        previousRange,

        controller: this,
      },
    );

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

    /*
     * Candlestick changes geometry,
     * so keep that structural change
     * non-animated.
     */
    const crossesCandlestick =
      previousMode === "candlestick" || normalizedMode === "candlestick";

    const updated = this.refreshChart({
      preserveViewport: true,

      redraw: options.redraw !== false,

      animation: crossesCandlestick ? false : (options.animation ?? false),
    });

    if (!updated) {
      this.currentMode = previousMode;

      return false;
    }

    this.updateControls();

    dispatchChartEvent(
      this.element,

      "marketchartmodechange",

      {
        mode: this.currentMode,

        previousMode,

        controller: this,
      },
    );

    return true;
  }

  /* ==========================================================================
     External Data Updates
     ========================================================================== */

  setRangeData(range, mode, data, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeMarketChartRange(range);

    const normalizedMode = normalizeMarketChartMode(mode);

    if (
      !isMarketChartRangeSupported(
        normalizedRange,

        this.capabilities,
      )
    ) {
      return false;
    }

    setMarketChartRangeData(
      this.ranges,

      normalizedRange,

      normalizedMode,

      data,
    );

    this.refreshAvailableRanges();

    this.updateControls();

    /*
     * Inactive dataset:
     * store only.
     */
    if (normalizedRange !== this.currentRange) {
      return true;
    }

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,

      this.currentRange,
    );

    return this.refreshChart({
      preserveViewport: options.preserveViewport !== false,

      redraw: options.redraw !== false,

      animation: options.animation ?? false,
    });
  }

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

    if (!this.hasRange(this.currentRange)) {
      this.currentRange = getFirstAvailableMarketChartRange(
        this.ranges,

        this.configuration.range,

        this.capabilities,
      );
    }

    if (!this.currentRange) {
      this.updateControls();

      this.showMessage("empty");

      return true;
    }

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,

      this.currentRange,
    );

    this.setFollowLatest(
      this.isIntradayRange(),

      {
        source: "ranges",
      },
    );

    this.updateControls();

    return this.refreshChart({
      preserveViewport: options.preserveViewport === true,

      redraw: options.redraw !== false,

      animation: options.animation ?? false,
    });
  }

  /* ==========================================================================
     Controls
     ========================================================================== */

  bindControls() {
    if (!this.controlsRoot) {
      return;
    }

    const signal = this.listenerController.signal;

    this.controlsRoot.addEventListener(
      "click",

      this.handleRangeClick,

      {
        signal,
      },
    );

    this.controlsRoot.addEventListener(
      "click",

      this.handleModeClick,

      {
        signal,
      },
    );
  }

  handleRangeClick(event) {
    const selector =
      this.configuration.controls?.rangeSelector || "[data-chart-range]";

    const button = event.target?.closest?.(selector);

    if (!button || !this.controlsRoot?.contains(button)) {
      return;
    }

    if (button.disabled || button.getAttribute("aria-disabled") === "true") {
      return;
    }

    event.preventDefault();

    this.setRange(button.dataset.chartRange || button.dataset.range);
  }

  handleModeClick(event) {
    const selector =
      this.configuration.controls?.typeSelector ||
      "[data-chart-type], [data-chart-mode]";

    const button = event.target?.closest?.(selector);

    if (!button || !this.controlsRoot?.contains(button)) {
      return;
    }

    if (button.disabled || button.getAttribute("aria-disabled") === "true") {
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

      button.setAttribute(
        "aria-pressed",

        active ? "true" : "false",
      );

      button.disabled = !available;

      button.setAttribute(
        "aria-disabled",

        available ? "false" : "true",
      );
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

      button.setAttribute(
        "aria-pressed",

        active ? "true" : "false",
      );

      button.disabled = !available;

      button.setAttribute(
        "aria-disabled",

        available ? "false" : "true",
      );
    });
  }

  /* ==========================================================================
     Intraday Storage
     ========================================================================== */

  ensureIntradayRecord() {
    const range = this.getIntradayRange();

    let record = this.ranges[range];

    if (record) {
      return record;
    }

    record = {
      comparisonValue: this.configuration.previousClose,

      trend: [],

      line: [],

      candlestick: [],
    };

    this.ranges[range] = record;

    this.refreshAvailableRanges();

    return record;
  }

  /* ==========================================================================
     Live Presentation
     ========================================================================== */

  /*
   * Direction changes are rare.
   *
   * This method is the ONLY place
   * where live traffic may issue
   * Series.update().
   *
   * It updates presentation only:
   *
   * - no type;
   * - no id;
   * - no data;
   * - no dataGrouping;
   * - no showInNavigator;
   * - no structural options.
   */
  synchronizeLivePresentation(direction) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    this.element.dataset.chartDirection = direction;

    if (direction === this.presentationDirection) {
      return false;
    }

    const chartOptions = this.createOptions();

    const mainOptions = chartOptions.series?.[0];

    const navigatorOptions = chartOptions.navigator?.series;

    let mainSeries = this.getMainSeries();

    /* ----------------------------------------------------------------------
       Main Series
       ---------------------------------------------------------------------- */

    if (mainSeries && mainOptions && this.currentMode !== "candlestick") {
      const presentation = {
        color: mainOptions.color,

        lineColor: mainOptions.lineColor,

        lineWidth: mainOptions.lineWidth,
      };

      if (mainOptions.fillColor !== undefined) {
        presentation.fillColor = mainOptions.fillColor;
      }

      mainSeries.update(
        presentation,

        false,
      );
    }

    /*
     * Series.update() may replace
     * internal Highcharts objects.
     */
    mainSeries = this.getMainSeries() || mainSeries;

    /*
     * Defensive synchronization.
     *
     * This is intentionally performed
     * only when direction changes.
     *
     * It prevents the stale spline SVG
     * path/branch seen after background
     * catch-up plus a color transition.
     */
    if (mainSeries) {
      mainSeries.setData(
        this.getActiveData(),

        false,

        false,

        false,
      );
    }

    /* ----------------------------------------------------------------------
       Navigator
       ---------------------------------------------------------------------- */

    let navigatorSeries = this.getNavigatorSeries();

    if (navigatorSeries && navigatorOptions) {
      navigatorSeries.update(
        {
          color: navigatorOptions.color,

          lineColor: navigatorOptions.lineColor,

          lineWidth: navigatorOptions.lineWidth,

          fillColor: navigatorOptions.fillColor,
        },

        false,
      );

      navigatorSeries = this.getNavigatorSeries() || navigatorSeries;

      navigatorSeries.setData(
        this.getNavigatorData(),

        false,

        false,

        false,
      );
    }

    this.presentationDirection = direction;

    return true;
  }

  /* ==========================================================================
     Live Series Synchronization
     ========================================================================== */

  synchronizeVisibleLiveData({
    record,
    trendOperations,
    candleOperations,
    receivedPointCount,
  }) {
    const mainSeries = this.getMainSeries();

    const navigatorSeries = this.getNavigatorSeries();

    if (!mainSeries) {
      return false;
    }

    const mainData = this.getActiveData();

    const mainOperations =
      this.currentMode === "candlestick" ? candleOperations : trendOperations;

    const navigatorData = record.trend;

    const direction = this.getDirection();

    const directionChanged = direction !== this.presentationDirection;

    /*
     * A background catch-up can contain
     * many points.
     *
     * For a small bounded intraday
     * dataset, one setData() is both
     * fast and considerably safer than
     * issuing several shifted spline
     * operations before one redraw.
     */
    const batch = receivedPointCount > 1;

    const requiresReset =
      mainOperations.some((operation) => operation?.type === "reset") ||
      trendOperations.some((operation) => operation?.type === "reset");

    /*
     * Direction update performs its
     * own defensive setData() for both
     * visible series.
     */
    if (directionChanged) {
      this.synchronizeLivePresentation(direction);

      return true;
    }

    /* ----------------------------------------------------------------------
       Batch / Rare Reset
       ---------------------------------------------------------------------- */

    if (batch || requiresReset) {
      mainSeries.setData(
        mainData,

        false,

        false,

        false,
      );

      navigatorSeries?.setData(
        navigatorData,

        false,

        false,

        false,
      );

      return true;
    }

    /* ----------------------------------------------------------------------
       Normal Hot Path: One Tick
       ---------------------------------------------------------------------- */

    applySingleSeriesOperation(
      mainSeries,

      mainOperations[0],

      mainData,
    );

    applySingleSeriesOperation(
      navigatorSeries,

      trendOperations[0],

      navigatorData,
    );

    return true;
  }

  /* ==========================================================================
     Live Application
     ========================================================================== */

  applyLiveData(payload, metadata = {}) {
    if (this.destroyed) {
      return false;
    }

    const items = normalizeLivePayload(payload);

    if (!items.length) {
      return false;
    }

    const range = this.getIntradayRange();

    const record = this.ensureIntradayRecord();

    /*
     * Controls need DOM synchronization
     * only while a mode is still empty.
     */
    const availabilityMayChange = MARKET_CHART_MODES.some(
      (mode) => !getStoredRangeData(record, mode).length,
    );

    const visible = this.currentRange === range;

    const activeWasEmpty = visible && !this.hasActiveData();

    const trendOperations = [];

    const candleOperations = [];

    const pricePoints = [];

    for (const sourcePoint of items) {
      const pricePoint = normalizeLivePricePoint(sourcePoint);

      if (!pricePoint) {
        continue;
      }

      pricePoints.push(pricePoint);

      const trendOperation = upsertPoint(
        record.trend,

        pricePoint,

        this.configuration.maxPoints,
      );

      trendOperations.push(trendOperation);

      /*
       * Trend and line use exactly
       * the same [x, y] geometry.
       *
       * Sharing the array avoids a
       * complete clone on each tick.
       */
      record.line = record.trend;

      const candleOperation = mergeLiveCandle(
        record.candlestick,

        sourcePoint,

        pricePoint,

        {
          bucketSize: this.configuration.candleBucketSize,

          maxPoints: this.configuration.maxPoints,
        },
      );

      if (candleOperation) {
        candleOperations.push(candleOperation);
      }
    }

    if (!pricePoints.length) {
      return false;
    }

    if (availabilityMayChange) {
      this.updateControls();
    }

    /* ----------------------------------------------------------------------
       Visible Chart
       ---------------------------------------------------------------------- */

    if (visible) {
      if (this.isSuspended() || !this.isRenderable()) {
        /*
         * Data storage remains current.
         *
         * Rendering is deferred until
         * this chart becomes active.
         */
        this.pendingDataSync = true;
      } else if (activeWasEmpty) {
        /*
         * First usable point may enable
         * axes/navigator that were hidden
         * for the empty chart.
         */
        this.refreshChart({
          preserveViewport: false,

          force: true,

          redraw: true,

          animation: false,
        });
      } else {
        /*
         * Production live transaction:
         *
         * 1. synchronize series;
         * 2. move viewport if following;
         * 3. one redraw.
         */
        this.synchronizeVisibleLiveData({
          record,

          trendOperations,

          candleOperations,

          receivedPointCount: pricePoints.length,
        });

        this.applyLiveViewport(false);

        this.chart?.redraw(false);

        if (this.state !== "ready") {
          this.clearMessage();

          this.setState("ready");
        }
      }
    }

    /* ----------------------------------------------------------------------
       Last Updated
       ---------------------------------------------------------------------- */

    const latestPoint = pricePoints[pricePoints.length - 1];

    this.updateLastUpdated(metadata.updatedAt ?? latestPoint[0]);

    /* ----------------------------------------------------------------------
       Public Event
       ---------------------------------------------------------------------- */

    dispatchChartEvent(
      this.element,

      "marketchartliveupdate",

      {
        point: latestPoint,

        points: pricePoints,

        metadata,

        range,

        visibleRange: this.currentRange,

        visible,

        controller: this,
      },
    );

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
      typeof live.fetchPoint !== "function"
    ) {
      return null;
    }

    const intradayRange = this.getIntradayRange();

    if (
      !isMarketChartRangeSupported(
        intradayRange,

        this.capabilities,
      )
    ) {
      return null;
    }

    this.liveController?.destroy();

    this.liveController = createMarketChartLiveController({
      interval: live.interval ?? 60_000,

      alignToInterval: live.alignToInterval ?? true,

      immediate: live.immediate ?? false,

      /*
       * Browser timers are not
       * guaranteed while hidden.
       *
       * We pause and catch up with
       * `since` on return.
       */
      pauseWhenHidden: live.pauseWhenHidden ?? true,

      retry: live.retry ?? true,

      maxRetryDelay: live.maxRetryDelay,

      requestTimeout: live.requestTimeout,

      environment: {
        window: this.window,

        document: this.document,

        navigator: this.window?.navigator,

        now: this.configuration.environment?.now,
      },

      fetchPoint: ({
        signal,

        requestedAt,

        sequence,

        requestId,
      }) =>
        live.fetchPoint({
          signal,

          requestedAt,

          sequence,

          requestId,

          symbol: this.configuration.symbol,

          range: intradayRange,

          mode: "trend",

          /*
           * Critical production
           * reconciliation contract.
           *
           * The backend may return
           * one point or every point
           * after this timestamp.
           */
          since: this.getLatestTimestamp(
            intradayRange,

            "trend",
          ),

          visibleRange: this.currentRange,

          visibleMode: this.currentMode,

          controller: this,
        }),

      onPoint: (
        point,

        pointMetadata,
      ) =>
        this.applyLiveData(
          point,

          pointMetadata,
        ),

      onStateChange: (state) => {
        this.setLiveState(state);

        live.onStateChange?.(
          state,

          this,
        );
      },

      onError: (
        error,

        errorMetadata,
      ) => {
        dispatchChartEvent(
          this.element,

          "marketchartliveerror",

          {
            error,

            metadata: errorMetadata,

            controller: this,
          },
        );

        live.onError?.(
          error,

          errorMetadata,

          this,
        );
      },
    });

    if (live.autostart !== false) {
      this.liveController.start();
    }

    return this.liveController;
  }

  /* ==========================================================================
     Live Polling Public API
     ========================================================================== */

  startLive() {
    return this.liveController?.start() ?? false;
  }

  pauseLive(reason = "manual") {
    return this.liveController?.pause(reason) ?? false;
  }

  /*
   * Polling and viewport following
   * remain separate concepts.
   *
   * resumeLiveUpdates()
   *   -> polling
   *
   * resumeLive()
   *   -> follow latest x-axis point
   */
  resumeLiveUpdates(reason = "manual") {
    return this.liveController?.resume(reason) ?? false;
  }

  refreshLive() {
    return this.liveController?.refresh() ?? false;
  }

  stopLive() {
    return this.liveController?.stop() ?? false;
  }

  /* ==========================================================================
     Live Viewport Public API
     ========================================================================== */

  resumeLive(options = {}) {
    if (this.destroyed || !this.isIntradayRange()) {
      return false;
    }

    this.liveViewportDuration = toPositiveNumber(
      options.liveWindowDuration,

      this.configuration.liveWindowDuration ||
        getBoundsDuration(this.getViewport()) ||
        null,
    );

    this.setFollowLatest(
      true,

      {
        source: "programmatic",
      },
    );

    return this.applyLiveViewport(options.redraw !== false);
  }

  pauseLiveFollowing(options = {}) {
    if (this.destroyed) {
      return false;
    }

    this.setFollowLatest(
      false,

      {
        source: options.source || "programmatic",

        trigger: options.trigger || "manual",
      },
    );

    return true;
  }

  setLiveWindowDuration(duration, options = {}) {
    const value = toPositiveNumber(duration, null);

    if (this.destroyed || value === null) {
      return false;
    }

    this.configuration.liveWindowDuration = value;

    this.liveViewportDuration = value;

    if (
      options.apply !== false &&
      this.followLatest &&
      this.isIntradayRange()
    ) {
      this.applyLiveViewport(options.redraw !== false);
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
      this.lastUpdatedFormatter = new Intl.DateTimeFormat(
        "en",

        {
          hour: "2-digit",

          minute: "2-digit",

          second: "2-digit",

          hourCycle: "h23",
        },
      );
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
     Activity
     ========================================================================== */

  isSuspended() {
    return this.suspensionReasons.size > 0;
  }

  isRenderable() {
    return Boolean(
      this.element.isConnected && this.element.getClientRects().length,
    );
  }

  setActive(active, reason = "inactive") {
    if (this.destroyed) {
      return false;
    }

    const normalizedReason = String(reason || "inactive");

    /* ----------------------------------------------------------------------
       Suspend
       ---------------------------------------------------------------------- */

    if (!active) {
      this.suspensionReasons.add(normalizedReason);

      /*
       * Keep Highcharts/data in memory
       * but stop network work.
       */
      this.pauseLive(normalizedReason);

      return true;
    }

    /* ----------------------------------------------------------------------
       Resume
       ---------------------------------------------------------------------- */

    this.suspensionReasons.delete(normalizedReason);

    if (this.isSuspended()) {
      return true;
    }

    /*
     * Resuming polling causes the
     * live controller to fetch again
     * immediately, using `since`.
     */
    this.resumeLiveUpdates(normalizedReason);

    /*
     * Synchronize anything received
     * while presentation was inactive.
     */
    if (this.pendingDataSync || this.themeDirty) {
      this.refreshChart({
        preserveViewport: true,

        redraw: false,

        animation: false,

        force: true,
      });
    }

    this.reflow();

    return true;
  }

  /* ==========================================================================
     Resize
     ========================================================================== */

  requestFrame(callback) {
    if (typeof this.window?.requestAnimationFrame === "function") {
      return this.window.requestAnimationFrame(callback);
    }

    return this.window.setTimeout(callback, 16);
  }

  cancelFrame(frame) {
    if (frame === null) {
      return;
    }

    if (typeof this.window?.cancelAnimationFrame === "function") {
      this.window.cancelAnimationFrame(frame);

      return;
    }

    this.window.clearTimeout(frame);
  }

  scheduleReflow() {
    if (this.destroyed || this.resizeFrame !== null) {
      return;
    }

    this.resizeFrame = this.requestFrame(() => {
      this.resizeFrame = null;

      this.reflow();
    });
  }

  reflow() {
    if (this.destroyed || !this.chart) {
      return false;
    }

    if (this.isSuspended() || !this.isRenderable()) {
      return false;
    }

    /*
     * Highstock handles navigator and
     * axis resizing through reflow.
     *
     * No second navigator resize layer.
     */
    this.chart.reflow();

    return true;
  }

  /* ==========================================================================
     Theme
     ========================================================================== */

  handleThemeMutation() {
    if (this.destroyed) {
      return;
    }

    this.themeDirty = true;

    if (this.isSuspended() || this.themeFrame !== null) {
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

    if (this.isSuspended()) {
      this.themeDirty = true;

      return false;
    }

    /*
     * Theme changes are rare and
     * legitimately structural enough
     * for one complete presentation
     * refresh.
     */
    return this.refreshChart({
      preserveViewport: true,

      redraw: true,

      animation: false,

      force: true,
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

      /*
       * Observe only the chart host.
       *
       * Never observe Highcharts SVG
       * descendants.
       */
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

      /*
       * Only semantic theme inputs.
       *
       * Drawer/layout class mutations
       * do not cause chart theme work.
       */
      this.themeObserver.observe(
        this.document.documentElement,

        {
          attributes: true,

          attributeFilter: ["data-theme", "data-contrast", "dir"],
        },
      );
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

    this.setFollowLatest(
      this.isIntradayRange(),

      {
        source: "initialize",
      },
    );

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

    dispatchChartEvent(
      this.element,

      "marketchartready",

      {
        controller: this,
      },
    );

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

      active: !this.isSuspended(),

      renderable: this.isRenderable(),

      suspendedReasons: [...this.suspensionReasons],

      range: this.currentRange,

      mode: this.currentMode,

      direction: this.getDirection(),

      comparisonValue: this.getComparisonValue(),

      capabilities: {
        ...this.capabilities,
      },

      availableRanges: [...this.availableRanges],

      navigator: {
        enabled: Boolean(this.chart?.navigator),

        followLatest: this.followLatest,

        viewport: this.getViewport(),

        dataBounds: getDataBounds(this.getActiveData()),

        liveWindowDuration: this.liveViewportDuration,
      },

      live: this.liveController?.getState() || null,

      /*
       * Legacy compatibility field.
       * The old transition subsystem
       * no longer exists.
       */
      transitionRevision: 0,
    };
  }

  /* ==========================================================================
     Destruction
     ========================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    /* ----------------------------------------------------------------------
       Live
       ---------------------------------------------------------------------- */

    this.liveController?.destroy();

    this.liveController = null;

    /* ----------------------------------------------------------------------
       Highcharts Axis Event
       ---------------------------------------------------------------------- */

    this.removeAxisEvent?.();

    this.removeAxisEvent = null;

    /* ----------------------------------------------------------------------
       DOM Listeners
       ---------------------------------------------------------------------- */

    this.listenerController.abort();

    /* ----------------------------------------------------------------------
       Observers
       ---------------------------------------------------------------------- */

    this.resizeObserver?.disconnect();

    this.themeObserver?.disconnect();

    this.resizeObserver = null;

    this.themeObserver = null;

    /* ----------------------------------------------------------------------
       Frames
       ---------------------------------------------------------------------- */

    if (this.resizeFrame !== null) {
      this.cancelFrame(this.resizeFrame);
    }

    if (this.themeFrame !== null) {
      this.cancelFrame(this.themeFrame);
    }

    this.resizeFrame = null;

    this.themeFrame = null;

    /* ----------------------------------------------------------------------
       Highcharts
       ---------------------------------------------------------------------- */

    this.chart?.destroy();

    this.chart = null;

    /* ----------------------------------------------------------------------
       DOM State
       ---------------------------------------------------------------------- */

    this.clearMessage();

    this.element.removeAttribute("data-chart-state");

    this.element.removeAttribute("data-chart-message");

    this.element.removeAttribute("data-chart-direction");

    this.element.removeAttribute("data-chart-live-state");

    this.element.removeAttribute("data-chart-follow-live");

    this.section?.removeAttribute("data-chart-live-state");

    this.section?.removeAttribute("data-chart-follow-live");

    this.section?.setAttribute("aria-busy", "false");

    /* ----------------------------------------------------------------------
       Registry
       ---------------------------------------------------------------------- */

    chartRegistry.delete(this.element);

    dispatchChartEvent(
      this.element,

      "marketchartdestroy",

      {
        controller: this,
      },
    );
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
    /*
     * Validate the new controller
     * before destroying the currently
     * working chart.
     */
    controller = new MarketChartController(element, source);

    existing?.destroy();

    chartRegistry.set(element, controller);

    controller.initialize();

    return controller;
  } catch (error) {
    controller?.destroy();

    chartRegistry.delete(element);

    const message =
      controller?.configuration?.messages?.error || DEFAULT_MESSAGES.error;

    renderCreationError(element, message);

    console.error("Market Chart creation failed.", error);

    dispatchChartEvent(
      element,

      "marketcharterror",

      {
        error,

        controller: null,
      },
    );

    return null;
  }
}

export function getMarketChart(target) {
  const element = resolveElement(target);

  if (!element) {
    return null;
  }

  return chartRegistry.get(element) || null;
}

export function destroyMarketChart(target) {
  const controller = getMarketChart(target);

  if (!controller) {
    return false;
  }

  controller.destroy();

  return true;
}

export function destroyAllMarketCharts() {
  const controllers = [...chartRegistry.values()];

  controllers.forEach((controller) => {
    controller.destroy();
  });

  chartRegistry.clear();

  return controllers.length;
}

/* ==========================================================================
   Class Export
   ========================================================================== */

export { MarketChartController };
