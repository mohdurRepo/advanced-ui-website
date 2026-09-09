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
   Registry / Defaults
   ========================================================================== */

const chartRegistry = new Map();

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

  /*
   * null:
   * keep full intraday session visible.
   *
   * positive duration:
   * focus that live window only after
   * genuinely newer data arrives.
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

  /*
   * Clone the capability result.
   *
   * Live configuration may enable
   * the live capability below.
   */
  const capabilities = {
    ...normalizeMarketChartCapabilities(source.capabilities),
  };

  if (source.live && source.capabilities?.live === undefined) {
    capabilities.live = source.live.enabled !== false;
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
   Stored Data
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
   * Trend and line share [x, y].
   */
  if (normalizedMode === "trend") {
    return Array.isArray(record.line) ? record.line : [];
  }

  if (normalizedMode === "line") {
    return Array.isArray(record.trend) ? record.trend : [];
  }

  /*
   * Candlestick never falls back
   * to scalar trend data here.
   */
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

  if (minimum === null || maximum === null) {
    return null;
  }

  return {
    minimum,
    maximum,
  };
}

function getBoundsDuration(bounds) {
  return bounds ? Math.max(0, bounds.maximum - bounds.minimum) : 0;
}

function clampViewport(viewport, bounds) {
  if (!viewport || !bounds) {
    return null;
  }

  const dataDuration = getBoundsDuration(bounds);

  const viewportDuration = Math.min(
    getBoundsDuration(viewport),

    dataDuration,
  );

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

  /* ------------------------------------------------------------------------
     Same latest timestamp
     ------------------------------------------------------------------------ */

  if (timestamp === last[0]) {
    /*
     * Critical market-close optimization.
     *
     * Backend may repeatedly return the
     * exact same last point.
     *
     * That is not a chart update.
     */
    if (pointsEqual(last, point)) {
      return {
        type: "noop",
        point,
        shifted: false,
      };
    }

    /*
     * Same timestamp but corrected value.
     */
    data[lastIndex] = point;

    return {
      type: "replace",
      point,
      shifted: false,
    };
  }

  /* ------------------------------------------------------------------------
     Historical correction / insertion
     ------------------------------------------------------------------------ */

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

  trimLiveData(data, maxPoints);

  /*
   * Rare out-of-order corrections are
   * safest with one setData().
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
   * Batch of points.
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
   Live Candlestick
   ========================================================================== */

function mergeLiveCandle(
  candles,
  sourcePoint,
  pricePoint,
  { bucketSize, maxPoints },
) {
  /*
   * Prefer real backend OHLC.
   */
  if (isOHLCPoint(sourcePoint)) {
    const candle = normalizeMarketChartData([sourcePoint], "candlestick")[0];

    return candle ? upsertPoint(candles, candle, maxPoints) : null;
  }

  /*
   * Otherwise aggregate observed
   * scalar prices into a candle.
   */
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
    series.addPoint(
      operation.point,

      false,

      operation.shifted,

      false,
    );

    return true;
  }

  if (operation.type === "replace") {
    const points = series.data || series.points || [];

    const lastPoint = points[points.length - 1];

    if (lastPoint?.x === operation.point[0]) {
      lastPoint.update(
        operation.point,

        false,

        false,
      );

      return true;
    }
  }

  /*
   * Rare correction / insertion.
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

    this.ranges = normalizeMarketChartRanges(
      this.configuration.ranges,

      {
        capabilities: this.capabilities,
      },
    );

    this.availableRanges = getAvailableMarketChartRanges(
      this.ranges,

      this.capabilities,
    );

    /*
     * Also support direct `data`
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

    this.presentationDirection = null;

    /*
     * IMPORTANT:
     *
     * Initial 1D chart shows the
     * complete available session.
     *
     * We begin following the live
     * edge only when a genuinely
     * newer timestamp arrives.
     */
    this.followLatest = false;

    /*
     * Becomes true only when the user
     * manually pans/zooms away.
     *
     * New market data must not steal
     * the viewport after that.
     */
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
     * Navigator always uses
     * [timestamp, value].
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

    return data.length ? data[data.length - 1][0] : null;
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
     Initial Render
     ========================================================================== */

  renderInitialChart() {
    if (this.destroyed || this.chart) {
      return this.chart;
    }

    this.clearMessage();

    this.chart = this.Highcharts.stockChart(
      this.element,

      this.createOptions(),
    );

    if (!this.chart) {
      throw new Error("Highstock did not create the Market Chart.");
    }

    this.presentationDirection = this.getDirection();

    this.element.dataset.chartDirection = this.presentationDirection;

    this.bindAxisEvents();

    /*
     * Highstock opens on the full
     * available dataset.
     *
     * Do NOT immediately force
     * the last-hour / live viewport.
     */
    this.setFollowLatest(
      false,

      {
        source: "initialize",
      },
    );

    return this.chart;
  }

  /* ==========================================================================
     Structural Refresh
     ========================================================================== */

  /*
   * Used only for:
   *
   * - range changes;
   * - Trend/Candlestick changes;
   * - external data replacement;
   * - theme changes;
   * - first data on an empty chart.
   *
   * Ordinary live ticks never use
   * this structural path.
   */
  refreshChart(options = {}) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const preserveViewport = options.preserveViewport === true;

    const previousViewport = preserveViewport ? this.getViewport() : null;

    const data = this.getActiveData();

    const chartOptions = this.createOptions(data);

    const [mainSeriesOptions] = chartOptions.series;

    /*
     * Data is synchronized once,
     * explicitly below.
     */
    const {
      series: ignoredSeries,

      ...chartUpdate
    } = chartOptions;

    /*
     * Navigator data is also
     * synchronized once below.
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
       * Legitimate structural change:
       *
       * areaspline
       * ↔ line
       * ↔ candlestick
       */
      mainSeries.update(
        seriesOptions,

        false,
      );

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
       * chart.update() may recreate
       * axis internals.
       */
      this.bindAxisEvents();

      if (previousViewport && preserveViewport) {
        this.restoreViewport(
          previousViewport,

          false,
        );
      } else {
        /*
         * New range starts with its
         * complete backend dataset.
         */
        this.applyDefaultViewport(false);
      }

      this.presentationDirection = this.getDirection();

      this.element.dataset.chartDirection = this.presentationDirection;

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
     * Ignore viewport changes initiated by this controller.
     */
    if (trigger.startsWith("market-chart-")) {
      return;
    }

    const minimum = toFiniteNumber(event?.min);
    const maximum = toFiniteNumber(event?.max);

    if (minimum === null || maximum === null || maximum <= minimum) {
      return;
    }

    const viewport = {
      minimum,
      maximum,
    };

    dispatchChartEvent(this.element, "marketchartviewportchange", {
      range: this.currentRange,
      viewport,
      trigger: trigger || "axis",
      controller: this,
    });

    /*
     * Live-follow state only belongs to 1D/intraday.
     */
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

    /*
     * User moved away from the latest point.
     *
     * New data must not steal their viewport.
     */
    this.userDetachedFromLive = !atLatest;

    if (atLatest) {
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

    axis.setExtremes(minimum, maximum, redraw, false, {
      trigger,
    });

    return true;
  }

  restoreViewport(viewport, redraw = true) {
    const bounds = getDataBounds(this.getActiveData());

    const resolved = clampViewport(viewport, bounds);

    if (!resolved) {
      return false;
    }

    return this.applyViewport(resolved, redraw, "market-chart-restore");
  }

  /*
   * Default viewport is always the complete dataset.
   *
   * This is important for:
   *
   * - initial page load;
   * - opening the page after market close;
   * - selecting a range;
   * - re-selecting 1D.
   */
  applyDefaultViewport(redraw = true) {
    const bounds = getDataBounds(this.getActiveData());

    if (!bounds) {
      return false;
    }

    return this.applyViewport(bounds, redraw, "market-chart-range");
  }

  /*
   * Live viewport is used only after:
   *
   * 1. a genuinely newer timestamp arrives; and
   * 2. the user has not manually moved away.
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

    /*
     * No configured live window:
     * keep the complete trading session visible.
     */
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

    /* ------------------------------------------------------------------------
       Same Range
       ------------------------------------------------------------------------ */

    if (normalizedRange === this.currentRange && options.force !== true) {
      if (options.resetViewport === true) {
        /*
         * Re-selecting 1D means:
         *
         * show the complete session again.
         */
        this.userDetachedFromLive = false;

        this.setFollowLatest(false, {
          source: "range-reset",
        });

        this.applyDefaultViewport(true);
      }

      return true;
    }

    /* ------------------------------------------------------------------------
       Change Range
       ------------------------------------------------------------------------ */

    const previousRange = this.currentRange;
    const previousMode = this.currentMode;

    this.currentRange = normalizedRange;

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      normalizedRange,
    );

    /*
     * Every named backend range starts clean.
     */
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

      return false;
    }

    this.updateControls();

    this.updateLastUpdated(this.getLatestTimestamp());

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

    /*
     * Trend ↔ Candlestick changes the Highcharts
     * series type, so that transition is structural
     * and deliberately non-animated.
     */
    const crossesCandlestick =
      previousMode === "candlestick" || normalizedMode === "candlestick";

    const updated = this.refreshChart({
      /*
       * Changing visual representation must not
       * unexpectedly move the user's viewport.
       */
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

  setRangeData(range, mode, data, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeMarketChartRange(range);
    const normalizedMode = normalizeMarketChartMode(mode);

    if (!isMarketChartRangeSupported(normalizedRange, this.capabilities)) {
      return false;
    }

    setMarketChartRangeData(this.ranges, normalizedRange, normalizedMode, data);

    this.refreshAvailableRanges();
    this.updateControls();

    /*
     * Store an inactive named range without
     * touching the currently displayed chart.
     */
    if (normalizedRange !== this.currentRange) {
      return true;
    }

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      this.currentRange,
    );

    return this.refreshChart({
      preserveViewport: options.preserveViewport === true,

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

    /*
     * External dataset replacement does not
     * automatically put the chart into live-follow.
     */
    this.setFollowLatest(false, {
      source: "ranges",
    });

    this.userDetachedFromLive = false;

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
      /*
       * Clicking the already-active range
       * restores its complete dataset.
       */
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
   * Keep the defensive setData() here because
   * this is the fix that prevents stale/branched
   * SVG spline paths when a live direction color
   * changes after a batch update.
   */
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

    const navigatorOptions = chartOptions.navigator?.series;

    let mainSeries = this.getMainSeries();

    /* ------------------------------------------------------------------------
       Main Series
       ------------------------------------------------------------------------ */

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

    /*
     * Series.update() may recreate internal
     * Highcharts objects.
     */
    mainSeries = this.getMainSeries() || mainSeries;

    if (mainSeries) {
      mainSeries.setData(this.getActiveData(), false, false, false);
    }

    /* ------------------------------------------------------------------------
       Navigator
       ------------------------------------------------------------------------ */

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

      navigatorSeries.setData(this.getNavigatorData(), false, false, false);
    }

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

    const navigatorSeries = this.getNavigatorSeries();

    const mainData = this.getActiveData();

    const navigatorData = record.trend;

    const mainOperations =
      this.currentMode === "candlestick" ? candleOperations : trendOperations;

    const changedMainOperations = mainOperations.filter(
      (operation) => operation && operation.type !== "noop",
    );

    const changedNavigatorOperations = trendOperations.filter(
      (operation) => operation && operation.type !== "noop",
    );

    /*
     * Example:
     *
     * real OHLC high/low corrected while close
     * remains unchanged.
     *
     * Candlestick must redraw, Trend does not.
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

    const requiresReset =
      changedMainOperations.some((operation) => operation.type === "reset") ||
      changedNavigatorOperations.some(
        (operation) => operation.type === "reset",
      );

    /*
     * More than one changed point is a batch.
     *
     * One setData() + one redraw is both faster
     * and safer than several intermediate spline
     * mutations.
     */
    const batch =
      changedMainOperations.length > 1 || changedNavigatorOperations.length > 1;

    if (batch || requiresReset) {
      if (mainChanged) {
        mainSeries.setData(mainData, false, false, false);
      }

      if (navigatorChanged && navigatorSeries) {
        navigatorSeries.setData(navigatorData, false, false, false);
      }

      return true;
    }

    let changed = false;

    if (mainChanged) {
      changed =
        applySeriesOperation(mainSeries, changedMainOperations[0], mainData) ||
        changed;
    }

    if (navigatorChanged && navigatorSeries) {
      changed =
        applySeriesOperation(
          navigatorSeries,
          changedNavigatorOperations[0],
          navigatorData,
        ) || changed;
    }

    return changed;
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

    const visible = this.currentRange === range;

    const activeWasEmpty = visible && !this.hasActiveData();

    /*
     * Capture this BEFORE mutating record.trend.
     *
     * The viewport is allowed to move only if
     * this value genuinely increases.
     */
    const previousLatestTimestamp = record.trend.length
      ? record.trend[record.trend.length - 1][0]
      : null;

    const availabilityMayChange = MARKET_CHART_MODES.some(
      (mode) => !getStoredRangeData(record, mode).length,
    );

    const trendOperations = [];
    const candleOperations = [];

    let latestAcceptedPoint = null;

    for (const sourcePoint of items) {
      const pricePoint = normalizeLivePricePoint(sourcePoint);

      if (!pricePoint) {
        continue;
      }

      latestAcceptedPoint = pricePoint;

      const trendOperation = upsertPoint(
        record.trend,
        pricePoint,
        this.configuration.maxPoints,
      );

      trendOperations.push(trendOperation);

      /*
       * Same scalar geometry.
       *
       * Do not clone this array on each live tick.
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

    if (!latestAcceptedPoint) {
      return false;
    }

    /* ------------------------------------------------------------------------
       Detect Real Change
       ------------------------------------------------------------------------ */

    const trendChanged = trendOperations.some(
      (operation) => operation?.type !== "noop",
    );

    const candlesChanged = candleOperations.some(
      (operation) => operation?.type !== "noop",
    );

    /*
     * MARKET CLOSED / UNCHANGED ENDPOINT
     *
     * Same timestamp + same value:
     *
     * - no Highcharts operation;
     * - no redraw;
     * - no navigator change;
     * - no setExtremes;
     * - no Updated-time change;
     * - no public live-update event.
     */
    if (!trendChanged && !candlesChanged) {
      return false;
    }

    const currentLatestTimestamp = record.trend.length
      ? record.trend[record.trend.length - 1][0]
      : null;

    /*
     * Only this condition may start/move live follow.
     *
     * A corrected value at the same timestamp does
     * NOT satisfy this condition.
     */
    const genuinelyNewTimestamp =
      previousLatestTimestamp !== null &&
      currentLatestTimestamp !== null &&
      currentLatestTimestamp > previousLatestTimestamp;

    if (availabilityMayChange) {
      this.updateControls();
    }

    /* ------------------------------------------------------------------------
       Visible Intraday Chart
       ------------------------------------------------------------------------ */

    let chartChanged = false;

    if (visible) {
      if (activeWasEmpty) {
        /*
         * Recovery from an initially-empty endpoint.
         *
         * Show the complete recovered dataset first.
         */
        this.userDetachedFromLive = false;

        this.setFollowLatest(false, {
          source: "live-recovery",
        });

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
          /*
           * NEW TIMESTAMP
           * ----------------
           * May follow latest.
           *
           * SAME-TIMESTAMP CORRECTION
           * -------------------------
           * Never moves X-axis.
           */
          if (genuinelyNewTimestamp && !this.userDetachedFromLive) {
            this.setFollowLatest(true, {
              source: "new-data",
            });

            this.applyLiveViewport(false);
          }

          /*
           * Exactly one redraw for the live transaction.
           */
          this.chart?.redraw(false);

          if (this.state !== "ready") {
            this.clearMessage();

            this.setState("ready");
          }
        }
      }
    }

    /* ------------------------------------------------------------------------
       Updated Time
       ------------------------------------------------------------------------ */

    /*
     * We update this only for an actual data change.
     *
     * If the market is closed and the endpoint keeps
     * returning the same point, the displayed time
     * remains the time of the real last observation.
     */
    this.updateLastUpdated(currentLatestTimestamp ?? latestAcceptedPoint[0]);

    /* ------------------------------------------------------------------------
       Public Event
       ------------------------------------------------------------------------ */

    dispatchChartEvent(this.element, "marketchartliveupdate", {
      point: latestAcceptedPoint,

      points: items,

      metadata,

      range,

      visibleRange: this.currentRange,

      visible,

      genuinelyNewTimestamp,

      chartChanged,

      controller: this,
    });

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

    if (!isMarketChartRangeSupported(intradayRange, this.capabilities)) {
      return null;
    }

    /*
     * Only one live controller belongs
     * to one MarketChartController.
     */
    this.liveController?.destroy();

    this.liveController = createMarketChartLiveController({
      interval: live.interval ?? 60_000,

      alignToInterval: live.alignToInterval ?? true,

      /*
       * Normally false because the page
       * already fetched the initial snapshot.
       */
      immediate: live.immediate ?? false,

      /*
       * Browser tab visibility only.
       *
       * TASI/NOMU/etc. tab switching is NOT
       * managed here anymore. The page destroys
       * the old controller instead.
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

      fetchPoint: ({ signal, requestedAt, sequence, requestId }) =>
        live.fetchPoint({
          signal,

          requestedAt,

          sequence,

          requestId,

          symbol: this.configuration.symbol,

          range: intradayRange,

          mode: "trend",

          /*
           * Reconciliation contract.
           *
           * The page/backend can return:
           *
           * - one newer point; or
           * - every point after `since`.
           */
          since: this.getLatestTimestamp(intradayRange, "trend"),

          visibleRange: this.currentRange,

          visibleMode: this.currentMode,

          controller: this,
        }),

      onPoint: (payload, metadata) => {
        this.applyLiveData(payload, metadata);
      },

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
    }

    return this.liveController;
  }

  /* ==========================================================================
     Live Polling API
     ========================================================================== */

  startLive() {
    if (this.destroyed) {
      return false;
    }

    return this.liveController?.start() ?? false;
  }

  pauseLive(reason = "manual") {
    if (this.destroyed) {
      return false;
    }

    return this.liveController?.pause(reason) ?? false;
  }

  resumeLiveUpdates(reason = "manual") {
    if (this.destroyed) {
      return false;
    }

    return this.liveController?.resume(reason) ?? false;
  }

  refreshLive() {
    if (this.destroyed) {
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

  /*
   * Explicit programmatic action.
   *
   * Normal live traffic starts following
   * automatically only when a genuinely
   * newer timestamp arrives.
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
    const value = toPositiveNumber(duration, null);

    if (this.destroyed || value === null) {
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

    /*
     * Highstock owns:
     *
     * - chart dimensions;
     * - axes;
     * - navigator sizing;
     * - plot geometry.
     */
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

    /*
     * Theme changes are rare.
     *
     * One structural presentation refresh
     * is appropriate here.
     */
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

      /*
       * Observe only the host element.
       *
       * Never Highcharts SVG descendants.
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
       * Only theme/direction inputs.
       *
       * We do NOT monitor market tabs,
       * drawers, card classes or Highcharts SVG.
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

    /*
     * Initial state:
     *
     * show complete dataset.
     *
     * Do not start focused on the
     * last point.
     */
    this.userDetachedFromLive = false;

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

      capabilities: {
        ...this.capabilities,
      },

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
      return;
    }

    /*
     * Set first so no callback can perform
     * chart work while teardown proceeds.
     */
    this.destroyed = true;

    /* ------------------------------------------------------------------------
       Live / Network
       ------------------------------------------------------------------------ */

    /*
     * market-chart-live.js aborts its
     * active request during destroy.
     *
     * This is what makes tab switching cheap:
     *
     * TASI destroy
     * -> request aborted
     * -> timer removed
     * -> no more TASI monitoring
     */
    this.liveController?.destroy();

    this.liveController = null;

    /* ------------------------------------------------------------------------
       Highcharts Axis Event
       ------------------------------------------------------------------------ */

    this.removeAxisEvent?.();

    this.removeAxisEvent = null;

    /* ------------------------------------------------------------------------
       DOM Events
       ------------------------------------------------------------------------ */

    this.listenerController.abort();

    /* ------------------------------------------------------------------------
       Observers
       ------------------------------------------------------------------------ */

    this.resizeObserver?.disconnect();

    this.themeObserver?.disconnect();

    this.resizeObserver = null;

    this.themeObserver = null;

    /* ------------------------------------------------------------------------
       Scheduled Frames
       ------------------------------------------------------------------------ */

    if (this.resizeFrame !== null) {
      this.cancelFrame(this.resizeFrame);
    }

    if (this.themeFrame !== null) {
      this.cancelFrame(this.themeFrame);
    }

    this.resizeFrame = null;

    this.themeFrame = null;

    /* ------------------------------------------------------------------------
       Highcharts
       ------------------------------------------------------------------------ */

    this.chart?.destroy();

    this.chart = null;

    /* ------------------------------------------------------------------------
       DOM State
       ------------------------------------------------------------------------ */

    this.clearMessage();

    this.element.removeAttribute("data-chart-state");

    this.element.removeAttribute("data-chart-message");

    this.element.removeAttribute("data-chart-direction");

    this.element.removeAttribute("data-chart-live-state");

    this.element.removeAttribute("data-chart-follow-live");

    this.section?.removeAttribute("data-chart-live-state");

    this.section?.removeAttribute("data-chart-follow-live");

    this.section?.setAttribute("aria-busy", "false");

    /* ------------------------------------------------------------------------
       Registry
       ------------------------------------------------------------------------ */

    chartRegistry.delete(this.element);

    dispatchChartEvent(this.element, "marketchartdestroy", {
      controller: this,
    });
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
     * Validate the replacement first.
     *
     * This lets the page safely reuse the same
     * chart host for:
     *
     * TASI → NOMU → Sukuk → REITs → MT30
     */
    controller = new MarketChartController(element, source);

    /*
     * Important new tab behavior:
     *
     * the old market is completely destroyed.
     *
     * No hidden Highcharts instance survives.
     */
    existing?.destroy();

    chartRegistry.set(element, controller);

    controller.initialize();

    return controller;
  } catch (error) {
    controller?.destroy();

    /*
     * If constructor validation failed before
     * the existing chart was destroyed, retain
     * that valid existing registry entry.
     */
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
