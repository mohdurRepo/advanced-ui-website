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
  setMarketChartRangeRecord,
} from "./market-chart-data";

import { createMarketChartLiveController } from "./market-chart-live";
import { createMarketChartOptions } from "./market-chart-options";

/* ==========================================================================
   Registry / Defaults
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
   * null keeps the complete intraday session visible.
   * A positive duration enables an optional trailing live window.
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
    new CustomEventConstructor(type, {
      bubbles: true,
      detail,
    }),
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

  const normalizedMode = normalizeMarketChartMode(mode);

  if (normalizedMode === "candlestick") {
    return Array.isArray(record.candlestick) ? record.candlestick : [];
  }

  /*
   * Trend and line are visual modes over
   * the same [timestamp, value] dataset.
   */
  if (Array.isArray(record.trend)) {
    return record.trend;
  }

  return Array.isArray(record.line) ? record.line : [];
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

  if (dataDuration <= 0) {
    return {
      ...bounds,
    };
  }

  const viewportDuration = Math.min(getBoundsDuration(viewport), dataDuration);

  if (viewportDuration <= 0) {
    return {
      ...bounds,
    };
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
     * Market closed / unchanged API response.
     */
    if (pointsEqual(last, point)) {
      return {
        type: "noop",
        point,
        shifted: false,
      };
    }

    /*
     * Same timestamp, corrected value.
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
   * Rare correction/insertion.
   * Safest Highcharts path is one setData().
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
    } else if (Array.isArray(payload.updates)) {
      value = payload.updates;
    } else if (Array.isArray(payload.data)) {
      value = payload.data;
    }
  }

  if (Array.isArray(value) && value.length === 0) {
    return [];
  }

  /*
   * Batch.
   */
  if (
    Array.isArray(value) &&
    value.length &&
    (Array.isArray(value[0]) || isPlainObject(value[0]))
  ) {
    return value;
  }

  /*
   * Single point.
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

function normalizeAcceptedLiveItems(payload) {
  const accepted = [];

  for (const sourcePoint of normalizeLivePayload(payload)) {
    const pricePoint = normalizeLivePricePoint(sourcePoint);

    if (!pricePoint) {
      continue;
    }

    accepted.push({
      sourcePoint,
      pricePoint,
    });
  }

  /*
   * Apply batches chronologically.
   */
  accepted.sort((first, second) => first.pricePoint[0] - second.pricePoint[0]);

  return accepted;
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
   * Otherwise aggregate scalar observations
   * into an OHLC bucket.
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
   * Rare correction/insertion.
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

    this.ranges = normalizeMarketChartRanges(
      this.configuration.ranges,

      {
        capabilities: this.capabilities,
      },
    );

    let availableRanges = getAvailableMarketChartRanges(
      this.ranges,
      this.capabilities,
    );

    /*
     * Backward-compatible direct `data` input.
     */
    if (!availableRanges.length) {
      const baseData = normalizeMarketChartData(
        this.configuration.data,
        this.configuration.mode,
      );

      if (baseData.length) {
        const range = this.configuration.range;

        setMarketChartRangeData(
          this.ranges,
          range,
          this.configuration.mode,
          baseData,
        );

        if (this.ranges[range]) {
          this.ranges[range].comparisonValue = toFiniteNumber(
            this.configuration.previousClose,
          );
        }

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

    /*
     * Initial 1D shows the complete session.
     */
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

    this.section?.setAttribute("data-chart-live-state", value);

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

  getRangeData(range = this.currentRange, mode = this.currentMode) {
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

    const trend = getStoredRangeData(record, "trend");

    if (trend.length) {
      return trend;
    }

    const candles = getStoredRangeData(record, "candlestick");

    /*
     * Navigator always receives
     * [timestamp, value].
     */
    return candles.map((point) => [point[0], point[4]]);
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

  getDirection(range = this.currentRange, mode = this.currentMode) {
    return getDataDirection(
      this.getRangeData(range, mode),

      mode,
    );
  }

  getLatestTimestamp(range = this.currentRange, mode = this.currentMode) {
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
     * Initial chart always starts on
     * the complete available dataset.
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

  refreshChart(options = {}) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const preserveViewport = options.preserveViewport === true;

    const previousViewport = preserveViewport ? this.getViewport() : null;

    const data = this.getActiveData();

    const chartOptions = this.createOptions(data);

    const [mainSeriesOptions] = chartOptions.series || [];

    const {
      series: ignoredSeries,

      ...chartUpdate
    } = chartOptions;

    /*
     * Navigator data is synchronized
     * explicitly after chart.update().
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

      if (mainSeriesOptions) {
        const {
          data: ignoredData,

          ...seriesOptions
        } = mainSeriesOptions;

        /*
         * Structural path only:
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
      }

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
         * Every new backend range
         * opens on the complete dataset.
         */
        this.applyDefaultViewport(false);
      }

      this.presentationDirection = this.getDirection();

      this.element.dataset.chartDirection = this.presentationDirection;

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
     * Ignore controller-generated
     * setExtremes calls.
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
     * Live-follow state belongs
     * only to 1D/intraday.
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

    /*
     * User moved away from
     * the live edge.
     */
    this.userDetachedFromLive = !atLatest;

    if (atLatest) {
      /*
       * If the user selected a smaller
       * navigator window that still ends
       * at latest, preserve that window
       * while following future points.
       */
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

    const minimum = toFiniteNumber(viewport.minimum);

    const maximum = toFiniteNumber(viewport.maximum);

    if (minimum === null || maximum === null || maximum < minimum) {
      return false;
    }

    axis.setExtremes(
      minimum,

      maximum,

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

    const resolved = clampViewport(
      viewport,

      bounds,
    );

    if (!resolved) {
      return false;
    }

    return this.applyViewport(
      resolved,

      redraw,

      "market-chart-restore",
    );
  }

  /*
   * Initial load and every
   * backend range selection
   * show the complete range.
   */
  applyDefaultViewport(redraw = true) {
    const bounds = getDataBounds(this.getActiveData());

    if (!bounds) {
      return false;
    }

    return this.applyViewport(
      bounds,

      redraw,

      "market-chart-range",
    );
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

    /*
     * Default:
     * show complete intraday session.
     */
    if (!duration || duration >= getBoundsDuration(bounds)) {
      return this.applyViewport(
        bounds,

        redraw,

        "market-chart-live",
      );
    }

    return this.applyViewport(
      {
        minimum: Math.max(
          bounds.minimum,

          bounds.maximum - duration,
        ),

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

    /*
     * Explicit autostart:false / stopped
     * controller remains stopped.
     */
    if (!state.active) {
      return true;
    }

    /*
     * Historical ranges never poll
     * the intraday endpoint.
     */
    if (!this.isIntradayRange()) {
      if (state.pauseReasons.includes(LIVE_PAUSE_HISTORICAL_RANGE)) {
        return true;
      }

      return this.liveController.pause(LIVE_PAUSE_HISTORICAL_RANGE);
    }

    /*
     * Returning to 1D removes only the
     * range-owned pause reason.
     *
     * Other reasons such as:
     * - offline
     * - document hidden
     * - market closed
     *
     * remain untouched.
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

    /* ------------------------------------------------------------------------
       Same Range
       ------------------------------------------------------------------------ */

    if (normalizedRange === this.currentRange && options.force !== true) {
      if (options.resetViewport === true) {
        this.userDetachedFromLive = false;

        this.liveViewportDuration = this.configuration.liveWindowDuration;

        this.setFollowLatest(
          false,

          {
            source: "range-reset",
          },
        );

        this.applyDefaultViewport(options.redraw !== false);
      }

      /*
       * Re-selecting 1D is also
       * a useful reconciliation point.
       */
      this.synchronizeLiveRange({
        refresh: options.refreshLive !== false,
      });

      return true;
    }

    /* ------------------------------------------------------------------------
       Range Change
       ------------------------------------------------------------------------ */

    const previousRange = this.currentRange;

    const previousMode = this.currentMode;

    /*
     * Pause live before rendering a
     * historical range so any active
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

    /*
     * Every backend range starts
     * with a clean viewport state.
     */
    this.userDetachedFromLive = false;

    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.setFollowLatest(
      false,

      {
        source: "range",
      },
    );

    const updated = this.refreshChart({
      preserveViewport: false,

      redraw: options.redraw !== false,

      animation: options.animation ?? false,
    });

    if (!updated) {
      this.currentRange = previousRange;

      this.currentMode = previousMode;

      /*
       * Restore live lifecycle
       * belonging to the old range.
       */
      this.synchronizeLiveRange({
        refresh: false,
      });

      return false;
    }

    this.updateControls();

    this.updateLastUpdated(this.getLatestTimestamp());

    /*
     * Historical:
     * stays paused.
     *
     * Returning to 1D:
     * immediately reconciles missed data.
     */
    this.synchronizeLiveRange({
      refresh: options.refreshLive !== false,
    });

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
     * Trend/line ↔ candlestick changes
     * Highcharts series type.
     */
    const crossesCandlestick =
      previousMode === "candlestick" || normalizedMode === "candlestick";

    const updated = this.refreshChart({
      /*
       * Visual representation changes
       * preserve navigator viewport.
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
     External Data
     ========================================================================== */

  /*
   * Preferred API.
   *
   * Atomically replaces one complete
   * backend range.
   */
  setRangeRecord(range, record, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeMarketChartRange(range);

    if (
      !isMarketChartRangeSupported(
        normalizedRange,

        this.capabilities,
      )
    ) {
      return false;
    }

    if (
      !setMarketChartRangeRecord(
        this.ranges,

        normalizedRange,

        record,
      )
    ) {
      return false;
    }

    this.refreshAvailableRanges();

    this.updateControls();

    /*
     * Inactive range is only stored.
     */
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

  /*
   * Compatibility API.
   *
   * Kept while page integrations
   * are migrated to setRangeRecord().
   */
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

    if (
      !setMarketChartRangeData(
        this.ranges,

        normalizedRange,

        normalizedMode,

        data,
      )
    ) {
      return false;
    }

    this.refreshAvailableRanges();

    this.updateControls();

    /*
     * Inactive named ranges do not
     * touch the displayed chart.
     */
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

    const normalized = normalizeMarketChartRanges(
      ranges,

      {
        capabilities: this.capabilities,
      },
    );

    this.ranges =
      options.merge === true
        ? {
            ...this.ranges,

            ...normalized,
          }
        : normalized;

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

    this.setFollowLatest(
      false,

      {
        source: "ranges",
      },
    );

    this.updateControls();

    const updated = this.refreshChart({
      preserveViewport: options.preserveViewport === true,

      redraw: options.redraw !== false,

      animation: options.animation ?? false,
    });

    if (updated) {
      this.updateLastUpdated(this.getLatestTimestamp());

      this.synchronizeLiveRange({
        refresh: options.refreshLive === true,
      });
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

    if (
      !button ||
      !this.controlsRoot?.contains(button) ||
      button.disabled ||
      button.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }

    event.preventDefault();

    this.setRange(
      button.dataset.chartRange || button.dataset.range,

      {
        /*
         * Clicking the active range
         * resets to the complete dataset.
         */
        resetViewport: true,
      },
    );
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
     Intraday Record
     ========================================================================== */

  ensureIntradayRecord() {
    const range = this.getIntradayRange();

    let record = this.ranges[range];

    if (record) {
      /*
       * Preserve canonical scalar alias.
       */
      if (Array.isArray(record.trend)) {
        record.line = record.trend;
      }

      return record;
    }

    const trend = [];

    record = {
      comparisonValue: toFiniteNumber(this.configuration.previousClose),

      trend,

      line: trend,

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

      mainSeries.update(
        presentation,

        false,
      );
    }

    /*
     * Series.update() may recreate
     * Highcharts objects.
     */
    mainSeries = this.getMainSeries() || mainSeries;

    if (mainSeries) {
      mainSeries.setData(
        this.getActiveData(),

        false,

        false,

        false,
      );
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
     * OHLC high/low changes while
     * close remains unchanged.
     *
     * Candlestick must redraw while
     * trend/navigator may remain unchanged.
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
     * More than one changed point
     * is treated as one batch.
     */
    const batch =
      changedMainOperations.length > 1 || changedNavigatorOperations.length > 1;

    if (batch || requiresReset) {
      if (mainChanged) {
        mainSeries.setData(
          mainData,

          false,

          false,

          false,
        );
      }

      if (navigatorChanged && navigatorSeries) {
        navigatorSeries.setData(
          navigatorData,

          false,

          false,

          false,
        );
      }

      return true;
    }

    let changed = false;

    if (mainChanged) {
      changed =
        applySeriesOperation(
          mainSeries,

          changedMainOperations[0],

          mainData,
        ) || changed;
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

    const accepted = normalizeAcceptedLiveItems(payload);

    if (!accepted.length) {
      return false;
    }

    const range = this.getIntradayRange();

    const record = this.ensureIntradayRecord();

    const visible = this.currentRange === range;

    const activeWasEmpty = visible && !this.hasActiveData();

    /*
     * Capture before mutation.
     *
     * Only a larger value can
     * move the live viewport.
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

    for (const { sourcePoint, pricePoint } of accepted) {
      latestAcceptedPoint = pricePoint;

      const trendOperation = upsertPoint(
        record.trend,

        pricePoint,

        this.configuration.maxPoints,
      );

      trendOperations.push(trendOperation);

      /*
       * One scalar array.
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
     * MARKET CLOSED / UNCHANGED API
     *
     * Exact duplicate:
     *
     * - no Highcharts work;
     * - no navigator work;
     * - no redraw;
     * - no setExtremes;
     * - no updated-time change;
     * - no live-update event.
     */
    if (!trendChanged && !candlesChanged) {
      return false;
    }

    const currentLatestTimestamp = record.trend.length
      ? record.trend[record.trend.length - 1][0]
      : null;

    /*
     * Same-timestamp correction
     * does NOT satisfy this.
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
         * Recovery from initially
         * empty intraday data.
         */
        this.userDetachedFromLive = false;

        this.liveViewportDuration = this.configuration.liveWindowDuration;

        this.setFollowLatest(
          false,

          {
            source: "live-recovery",
          },
        );

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
           * Only a genuinely newer
           * timestamp may move viewport.
           */
          if (genuinelyNewTimestamp && !this.userDetachedFromLive) {
            this.setFollowLatest(
              true,

              {
                source: "new-data",
              },
            );

            this.applyLiveViewport(false);
          }

          /*
           * Exactly one redraw for
           * the live transaction.
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
       Observation Time
       ------------------------------------------------------------------------ */

    this.updateLastUpdated(currentLatestTimestamp ?? latestAcceptedPoint?.[0]);

    /* ------------------------------------------------------------------------
       Public Event
       ------------------------------------------------------------------------ */

    dispatchChartEvent(
      this.element,

      "marketchartliveupdate",

      {
        point: latestAcceptedPoint,

        points: accepted.map(({ sourcePoint }) => sourcePoint),

        metadata,

        range,

        visibleRange: this.currentRange,

        visible,

        genuinelyNewTimestamp,

        chartChanged,

        controller: this,
      },
    );

    /*
     * market-chart-live.js uses
     * this boolean to distinguish:
     *
     * successful response
     * vs
     * actual data change.
     */
    return true;
  }

  /* ==========================================================================
     Live Controller
     ========================================================================== */

  initializeLiveUpdates() {
    const live = this.configuration.live;

    const fetchUpdates =
      typeof live?.fetchUpdates === "function"
        ? live.fetchUpdates
        : typeof live?.fetchPoint === "function"
          ? live.fetchPoint
          : null;

    if (
      this.destroyed ||
      this.capabilities.live !== true ||
      !live ||
      live.enabled === false ||
      !fetchUpdates
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

    /*
     * One polling controller
     * per chart controller.
     */
    this.liveController?.destroy();

    this.liveController = createMarketChartLiveController({
      interval: live.interval ?? 60_000,

      alignToInterval: live.alignToInterval ?? true,

      /*
       * Usually false because
       * initial snapshot is already loaded.
       */
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

      fetchUpdates: ({
        signal,

        requestedAt,

        sequence,

        requestId,
      }) =>
        fetchUpdates({
          signal,

          requestedAt,

          sequence,

          requestId,

          symbol: this.configuration.symbol,

          range: intradayRange,

          mode: "trend",

          /*
           * Inclusive reconciliation boundary.
           *
           * The adapter may return:
           *
           * - the equal latest timestamp;
           * - a newer point;
           * - a batch from `since` onward.
           *
           * applyLiveData() owns:
           *
           * noop
           * replace
           * append
           * reset
           */
          since: this.getLatestTimestamp(
            intradayRange,

            "trend",
          ),

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
        dispatchChartEvent(
          this.element,

          "marketchartliveerror",

          {
            error,

            metadata,

            controller: this,
          },
        );

        live.onError?.(
          error,

          metadata,

          this,
        );
      },
    });

    if (live.autostart !== false) {
      this.liveController.start();

      /*
       * If initial selected range
       * is historical, pause immediately.
       */
      this.synchronizeLiveRange({
        refresh: false,
      });
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
      this.synchronizeLiveRange({
        refresh: this.isIntradayRange(),
      });
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

    /*
     * Never let an external resume
     * override historical-range ownership.
     */
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

  /*
   * Programmatically follow
   * the latest intraday edge.
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

    this.userDetachedFromLive = true;

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
    if (this.destroyed) {
      return false;
    }

    /*
     * null / false / 0 means:
     * show complete intraday session.
     */
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
      this.lastUpdatedFormatter = new Intl.DateTimeFormat(
        "en",

        {
          timeZone: "Asia/Riyadh",

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

    /*
     * Highstock owns chart,
     * axis and navigator geometry.
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
     * Theme changes are rare and
     * legitimately use structural refresh.
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
       * Observe the host only.
       * Never observe Highcharts SVG.
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
       * Theme and direction only.
       *
       * Market tabs belong to page lifecycle.
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
     * Start on complete dataset.
     */
    this.userDetachedFromLive = false;

    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.setFollowLatest(
      false,

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
      return false;
    }

    /*
     * Set first so callbacks cannot
     * perform chart work during teardown.
     */
    this.destroyed = true;

    /* ------------------------------------------------------------------------
       Live / Network
       ------------------------------------------------------------------------ */

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

    /*
     * Delete only if this controller
     * is still the registered owner.
     */
    if (chartRegistry.get(this.element) === this) {
      chartRegistry.delete(this.element);
    }

    dispatchChartEvent(
      this.element,

      "marketchartdestroy",

      {
        controller: this,
      },
    );

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
    /*
     * Validate replacement first.
     */
    controller = new MarketChartController(element, source);

    /*
     * One host owns one controller.
     *
     * Replacement completely destroys:
     *
     * - old Highcharts instance;
     * - old live request;
     * - old polling timer;
     * - old observers;
     * - old listeners.
     */
    existing?.destroy();

    chartRegistry.set(element, controller);

    controller.initialize();

    return controller;
  } catch (error) {
    controller?.destroy();

    /*
     * Constructor failure can retain
     * a still-valid existing controller.
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

  return controller.destroy();
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
