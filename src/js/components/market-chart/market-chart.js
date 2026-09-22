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
   ==========================================================================

   Owns one Highstock instance per chart host.

   Responsibilities:

   - canonical range data
   - range switching
   - chart mode switching
   - live data reconciliation
   - navigator synchronization
   - follow-live viewport behavior
   - controls
   - theme / resize observation
   - teardown

   Important live rules:

   1. Ordinary live points use Highcharts incremental operations:
        append  -> addPoint()
        replace -> Point.update()
        reset   -> setData()

   2. The navigator uses the same incremental operation model.

      A normal new tick must NOT call navigatorSeries.setData() with the
      complete session.

   3. Direction changes are presentation changes.

      A red/green change must NOT call Series.update() on the live hot path.

   4. One live transaction ends with one chart.redraw(false).

   5. Navigator source is always trend / close-price data, even when the
      primary chart is candlestick.

   6. A renderer-family change rebuilds the Highstock instance.

      Highstock owns navigator SVG, masks and internal series outside the
      public primary-series lifecycle. Recreating the chart for a trend/line
      <-> candlestick transition guarantees that those internals are disposed
      before a new navigator is drawn.
   ========================================================================== */

/* ==========================================================================
   Registry / Constants
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

  showEmptyState: false,
  /*
   * null:
   * keep the complete intraday session visible.
   *
   * positive milliseconds:
   * follow a trailing live window.
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
      /*
       * Fall through to structural lookup.
       */
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
   Stored Range Data
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
 * Insert / replace / append into a timestamp-sorted canonical array.
 *
 * Operation types:
 *
 * noop
 *   no change.
 *
 * append
 *   new latest timestamp.
 *
 * replace
 *   same latest timestamp, changed value.
 *
 * reset
 *   historical correction/insertion or complex trimming.
 */
function upsertPoint(data, point, maxPoints, onEvict) {
  const timestamp = point[0];

  const lastIndex = data.length - 1;

  const last = lastIndex >= 0 ? data[lastIndex] : null;

  /* ------------------------------------------------------------------------
     Append
     ------------------------------------------------------------------------ */

  if (!last || timestamp > last[0]) {
    data.push(point);

    const removed = trimLiveData(data, maxPoints, onEvict);

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
     Replace latest
     ------------------------------------------------------------------------ */

  if (timestamp === last[0]) {
    if (pointsEqual(last, point)) {
      return {
        type: "noop",

        point,

        shifted: false,
      };
    }

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

  trimLiveData(data, maxPoints, onEvict);

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

    if (pricePoint) {
      accepted.push({
        sourcePoint,
        pricePoint,
      });
    }
  }

  /*
   * Apply backend batches chronologically.
   */
  accepted.sort((first, second) => first.pricePoint[0] - second.pricePoint[0]);

  return accepted;
}

/* ==========================================================================
   Live Candlestick
   ========================================================================== */

/**
 * Assemble a forming candle from streaming last-price ticks.
 *
 * If backend already provides complete OHLC, use that directly.
 */
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
   Highcharts Incremental Data Operations
   ========================================================================== */

/**
 * Apply one canonical mutation to one existing Highcharts series.
 */
function applySeriesOperation(series, operation, finalData) {
  if (!series || !operation || operation.type === "noop") {
    return false;
  }

  /* ------------------------------------------------------------------------
     Append
     ------------------------------------------------------------------------ */

  if (operation.type === "append") {
    series.addPoint(operation.point, false, operation.shifted, false);

    return true;
  }

  /* ------------------------------------------------------------------------
     Replace Current Latest Point
     ------------------------------------------------------------------------ */

  if (operation.type === "replace") {
    const points = series.data || series.points || [];

    const lastPoint = points[points.length - 1];

    if (lastPoint?.x === operation.point[0]) {
      lastPoint.update(operation.point, false, false);

      return true;
    }
  }

  /* ------------------------------------------------------------------------
     Reset
     ------------------------------------------------------------------------ */

  /*
   * Historical correction, insertion, or an unexpected runtime mismatch.
   */
  series.setData(finalData, false, false, false);

  return true;
}

/**
 * Apply one live transaction to one Highcharts series.
 *
 * A multi-point backend batch is reconciled with one setData(), while the
 * normal single live point remains incremental.
 */
function applySeriesOperations(series, operations, finalData) {
  if (!series || !Array.isArray(operations)) {
    return false;
  }

  const changed = operations.filter(
    (operation) => operation && operation.type !== "noop",
  );

  if (!changed.length) {
    return false;
  }

  /*
   * Multiple backend mutations in one response are reconciled atomically.
   *
   * This avoids several Highcharts SVG mutations before one redraw.
   */
  if (
    changed.length > 1 ||
    changed.some((operation) => operation.type === "reset")
  ) {
    series.setData(finalData, false, false, false);

    return true;
  }

  return applySeriesOperation(series, changed[0], finalData);
}

/* ==========================================================================
   Highcharts Live Presentation
   ========================================================================== */

/**
 * Extract presentation-only options.
 *
 * Structural options deliberately excluded:
 *
 * - type
 * - id
 * - data
 * - dataGrouping
 * - showInNavigator
 */
function getSeriesPresentation(options) {
  if (!isPlainObject(options)) {
    return null;
  }

  const presentation = {};

  for (const key of [
    "color",
    "lineColor",
    "lineWidth",
    "fillColor",
    "upColor",
    "upLineColor",
  ]) {
    if (options[key] !== undefined) {
      presentation[key] = options[key];
    }
  }

  return Object.keys(presentation).length ? presentation : null;
}

/**
 * Recolor an existing series without Series.update().
 *
 * This avoids rebuilding a live areaspline's graph/area SVG and prevents the
 * branch/tree artifact during semantic red/green changes.
 */
function applySeriesPresentation(series, options) {
  if (!series) {
    return false;
  }

  const presentation = getSeriesPresentation(options);

  if (!presentation) {
    return false;
  }

  /* ------------------------------------------------------------------------
     Highcharts Runtime Options
     ------------------------------------------------------------------------ */

  if (isPlainObject(series.options)) {
    Object.assign(series.options, presentation);
  }

  if (isPlainObject(series.userOptions)) {
    Object.assign(series.userOptions, presentation);
  }

  if (presentation.color !== undefined) {
    series.color = presentation.color;
  }

  const stroke = presentation.lineColor ?? presentation.color;

  const strokeWidth = presentation.lineWidth;

  /* ------------------------------------------------------------------------
     Primary Graph
     ------------------------------------------------------------------------ */

  if (series.graph) {
    const attributes = {};

    if (stroke !== undefined) {
      attributes.stroke = stroke;
    }

    if (strokeWidth !== undefined) {
      attributes["stroke-width"] = strokeWidth;
    }

    if (Object.keys(attributes).length) {
      series.graph.attr(attributes);
    }
  }

  /* ------------------------------------------------------------------------
         Primary Area
     ------------------------------------------------------------------------ */

  if (series.area && presentation.fillColor !== undefined) {
    series.area.attr({
      fill: presentation.fillColor,
    });
  }

  /* ------------------------------------------------------------------------
     Secondary Graph Collection
     ------------------------------------------------------------------------ */

  if (Array.isArray(series.graphs)) {
    for (const graph of series.graphs) {
      if (!graph) {
        continue;
      }

      const attributes = {};

      if (stroke !== undefined) {
        attributes.stroke = stroke;
      }

      if (strokeWidth !== undefined) {
        attributes["stroke-width"] = strokeWidth;
      }

      if (Object.keys(attributes).length) {
        graph.attr(attributes);
      }
    }
  }

  /* ------------------------------------------------------------------------
     Secondary Area Collection
     ------------------------------------------------------------------------ */

  if (Array.isArray(series.areas) && presentation.fillColor !== undefined) {
    for (const area of series.areas) {
      area?.attr?.({
        fill: presentation.fillColor,
      });
    }
  }

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
     * Convenience:
     * a flat `data` array becomes the configured range.
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

    /*
     * Initial intraday state shows complete available session.
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
   * Navigator source is always trend / close-price data.
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

  /**
   * Runtime/UI range availability.
   *
   * Historical ranges require a stored backend range record.
   *
   * The intraday range is slightly different: it remains selectable when the
   * chart has a valid live source even if its snapshot record has not been
   * materialized yet. This prevents 1D from becoming disabled after the page
   * is currently displaying a historical range.
   */
  isRangeAvailable(range) {
    const normalizedRange = normalizeMarketChartRange(range);

    if (!isMarketChartRangeSupported(normalizedRange, this.capabilities)) {
      return false;
    }

    if (this.ranges[normalizedRange]) {
      return true;
    }

    if (!this.isIntradayRange(normalizedRange)) {
      return false;
    }

    const live = this.configuration.live;

    const hasLiveSource = Boolean(
      this.capabilities.live === true &&
      live &&
      live.enabled !== false &&
      typeof live.fetchUpdates === "function",
    );

    return hasLiveSource || Boolean(this.liveController);
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

      showEmptyState: this.configuration.showEmptyState,

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

  getNavigatorXAxis() {
    return this.chart?.navigator?.xAxis || null;
  }

  getNavigatorSeriesList() {
    const series = this.chart?.navigator?.series;

    return Array.isArray(series) ? series.filter(Boolean) : [];
  }

  getNavigatorSeries() {
    const series = this.getNavigatorSeriesList();

    if (!series.length) {
      return null;
    }

    const identified = series.filter(
      (item) => item.options?.id === "market-chart-navigator-series",
    );

    return (
      identified[identified.length - 1] || series[series.length - 1] || null
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
     Navigator Integrity
     ========================================================================== */

  verifyNavigatorIntegrity(context) {
    const series = this.getNavigatorSeriesList();

    if (series.length <= 1) {
      return true;
    }

    console.warn(
      `Market Chart (${this.configuration.symbol || "unknown"}): ` +
        `navigator has ${series.length} series after "${context}" — expected 1.`,

      series.map((item, index) => ({
        index,

        id: item.options?.id,

        renderedColor: item.color,

        configuredColor: item.options?.color,

        pointCount: item.data?.length ?? item.options?.data?.length ?? 0,

        firstTimestamp:
          item.data?.[0]?.x ?? item.options?.data?.[0]?.[0] ?? null,

        lastTimestamp:
          item.data?.[item.data.length - 1]?.x ??
          item.options?.data?.[item.options.data.length - 1]?.[0] ??
          null,
      })),
    );

    return false;
  }

  /* ==========================================================================
     Navigator Synchronization
     ========================================================================== */

  /**
   * Structural/full navigator synchronization.
   *
   * Use this for:
   *
   * - initial creation reconciliation
   * - range changes
   * - theme changes
   * - complete external data replacement
   *
   * Do NOT use it for an ordinary one-point live append/replace.
   */
  syncNavigator({
    style = true,
    data = true,
    structural = false,
    chartOptions = null,
  } = {}) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const resolvedOptions = chartOptions || this.createOptions();

    const navigatorConfig = resolvedOptions?.navigator;

    const shouldBeEnabled = navigatorConfig?.enabled === true;

    const currentlyEnabled = this.getNavigatorSeriesList().length > 0;

    /* ----------------------------------------------------------------------
       Enable / Disable
       ---------------------------------------------------------------------- */

    if (shouldBeEnabled !== currentlyEnabled) {
      this.chart.update(
        {
          navigator: navigatorConfig || {
            enabled: false,
          },
        },
        false,
        false,
        false,
      );

      this.verifyNavigatorIntegrity("syncNavigator:toggle");

      if (!shouldBeEnabled) {
        return true;
      }
    }

    if (!shouldBeEnabled) {
      return false;
    }

    /* ----------------------------------------------------------------------
       Structural Update
       ---------------------------------------------------------------------- */

    if (structural && this.chart.navigator) {
      const {
        series: ignoredNavigatorSeries,

        ...navigatorStructure
      } = navigatorConfig;

      if (typeof this.chart.navigator.update === "function") {
        this.chart.navigator.update(navigatorStructure, false);
      } else {
        this.chart.update(
          {
            navigator: navigatorStructure,
          },
          false,
          false,
          false,
        );
      }
    }

    const navigatorSeriesList = this.getNavigatorSeriesList();

    if (!navigatorSeriesList.length) {
      this.verifyNavigatorIntegrity("syncNavigator:missing");

      return false;
    }

    /* ----------------------------------------------------------------------
       Presentation
       ---------------------------------------------------------------------- */

    if (style && isPlainObject(navigatorConfig?.series)) {
      for (const navigatorSeries of navigatorSeriesList) {
        applySeriesPresentation(navigatorSeries, navigatorConfig.series);
      }
    }

    /* ----------------------------------------------------------------------
       Complete Data Reconciliation
       ---------------------------------------------------------------------- */

    if (data) {
      const navigatorData = this.getNavigatorData();

      for (const navigatorSeries of navigatorSeriesList) {
        navigatorSeries.setData(navigatorData, false, false, false);
      }
    }

    this.verifyNavigatorIntegrity("syncNavigator");

    return true;
  }

  /**
   * Live navigator synchronization.
   *
   * Ordinary ticks use the same incremental operation model as the main
   * trend series:
   *
   * append  -> addPoint()
   * replace -> Point.update()
   * reset   -> setData()
   */
  applyNavigatorLiveOperations(operations) {
    if (this.destroyed || !this.chart || !Array.isArray(operations)) {
      return false;
    }

    const changed = operations.filter(
      (operation) => operation && operation.type !== "noop",
    );

    if (!changed.length) {
      return false;
    }

    const navigatorSeriesList = this.getNavigatorSeriesList();

    if (!navigatorSeriesList.length) {
      return false;
    }

    const navigatorData = this.getNavigatorData();

    let changedAny = false;

    for (const navigatorSeries of navigatorSeriesList) {
      changedAny =
        applySeriesOperations(navigatorSeries, changed, navigatorData) ||
        changedAny;
    }

    this.verifyNavigatorIntegrity("applyNavigatorLiveOperations");

    return changedAny;
  }

  /* ==========================================================================
     Initial Render
     ========================================================================== */

  renderInitialChart() {
    if (this.destroyed || this.chart) {
      return this.chart;
    }

    this.clearMessage();

    this.presentationDirection = this.getDirection();

    this.element.dataset.chartDirection = this.presentationDirection;

    this.chart = this.Highcharts.stockChart(this.element, this.createOptions());

    if (!this.chart) {
      throw new Error("Highstock did not create the Market Chart.");
    }

    this.bindAxisEvents();

    this.verifyNavigatorIntegrity("renderInitialChart");

    this.setFollowLatest(false, {
      source: "initialize",
    });

    return this.chart;
  }
  rebuildChart({ preserveViewport = true, animation = false } = {}) {
    if (this.destroyed) {
      return false;
    }

    const viewport = preserveViewport ? this.getViewport() : null;

    this.removeAxisEvent?.();
    this.removeAxisEvent = null;

    this.chart?.destroy();
    this.chart = null;

    try {
      this.renderInitialChart();

      if (viewport) {
        this.restoreViewport(viewport, false);
      } else {
        this.applyDefaultViewport(false);
      }

      this.chart?.redraw(animation);

      return true;
    } catch (error) {
      console.error("Market Chart rebuild failed.", error);
      this.showMessage("error");
      return false;
    }
  }
  /* ==========================================================================
     Primary Series Reconciliation
     ========================================================================== */

  /**
   * Reconcile the primary Highcharts series without ever changing its renderer
   * type through Series.update().
   *
   * Highcharts maintains different SVG/runtime structures for areaspline, line
   * and candlestick series. Reusing one Series instance across those renderer
   * families can leave stale graph/area paths behind after repeated mode
   * switches. A type change therefore gets a clean series instance.
   *
   * Same-type refreshes are deliberately lightweight:
   *
   * - update presentation in place
   * - replace data
   * - no structural Series.update()
   * - no redraw here
   */
  reconcileMainSeries(mainSeriesOptions, data) {
    let mainSeries = this.getMainSeries();

    if (!mainSeries) {
      throw new Error("Market Chart main series is unavailable.");
    }

    if (!mainSeriesOptions) {
      mainSeries.setData(data, false, false, false);

      return {
        series: mainSeries,
        replaced: false,
      };
    }

    const currentType = String(
      mainSeries.type ||
        mainSeries.options?.type ||
        mainSeries.userOptions?.type ||
        "",
    )
      .trim()
      .toLowerCase();

    const nextType = String(mainSeriesOptions.type || currentType)
      .trim()
      .toLowerCase();

    const typeChanged =
      Boolean(currentType && nextType) && currentType !== nextType;

    if (typeChanged) {
      /*
       * Remove first so the previous renderer's graph/area SVG is destroyed
       * completely before the replacement series is created.
       *
       * Both operations run without redraw/animation.
       */
      mainSeries.remove(false, false);

      const replacement = this.chart.addSeries(
        {
          ...mainSeriesOptions,
          data,
        },
        false,
        false,
      );

      if (!replacement) {
        throw new Error(
          `Market Chart main series could not be recreated (${currentType} -> ${nextType}).`,
        );
      }

      return {
        series: replacement,
        replaced: true,
        previousType: currentType,
        nextType,
      };
    }

    /*
     * Same renderer: colors/line width/fill are presentation concerns and can
     * be applied without Series.update(). This is the same safe strategy used
     * by the live direction-change path.
     */
    applySeriesPresentation(mainSeries, mainSeriesOptions);

    mainSeries.setData(data, false, false, false);

    return {
      series: mainSeries,
      replaced: false,
      previousType: currentType || null,
      nextType: nextType || null,
    };
  }

  /* ==========================================================================
     Structural Refresh
     ========================================================================== */

  refreshChart(options = {}) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const preserveViewport = options.preserveViewport === true;

    const updateAxes = options.updateAxes !== false;

    const shouldSyncNavigator = options.syncNavigator !== false;

    const navigatorStyle = options.navigatorStyle !== false;

    const navigatorData = options.navigatorData !== false;

    const navigatorStructural = options.navigatorStructural !== false;

    const previousViewport = preserveViewport ? this.getViewport() : null;

    const navigatorSeriesCountBefore = this.getNavigatorSeriesList().length;

    const data = this.getActiveData();

    this.presentationDirection = this.getDirection();

    this.element.dataset.chartDirection = this.presentationDirection;

    /*
     * One coherent option snapshot for this transaction.
     */
    const chartOptions = this.createOptions(data);

    const [mainSeriesOptions] = chartOptions.series || [];

    const {
      series: ignoredSeries,

      navigator: ignoredNavigator,

      xAxis: xAxisOptions,

      yAxis: yAxisOptions,

      ...chartUpdate
    } = chartOptions;
    try {
      /* --------------------------------------------------------------------
         Chart-Level Options
         -------------------------------------------------------------------- */

      this.chart.update(chartUpdate, false, false, options.animation ?? false);

      /* --------------------------------------------------------------------
         Primary Axes
         -------------------------------------------------------------------- */

      if (updateAxes) {
        const mainXAxis = this.getMainXAxis();

        if (mainXAxis && xAxisOptions) {
          mainXAxis.update(xAxisOptions, false);
        }

        if (this.chart.yAxis?.[0] && yAxisOptions) {
          this.chart.yAxis[0].update(yAxisOptions, false);
        }
      }

      /* --------------------------------------------------------------------
         Primary Series
         -------------------------------------------------------------------- */

      const mainResult = this.reconcileMainSeries(mainSeriesOptions, data);

      /* --------------------------------------------------------------------
         Navigator
         -------------------------------------------------------------------- */

      if (shouldSyncNavigator) {
        this.syncNavigator({
          style: navigatorStyle,
          data: navigatorData,
          structural: navigatorStructural,
          chartOptions,
        });
      } else if (
        mainResult.replaced &&
        navigatorSeriesCountBefore > 0 &&
        this.getNavigatorSeriesList().length === 0
      ) {
        /*
         * Defensive recovery only.
         *
         * A pure mode switch intentionally leaves the navigator untouched. If
         * a Highstock version happens to remove its internal navigator series
         * when the base series is replaced, restore it once here rather than
         * structurally rebuilding the navigator on every mode change.
         */
        this.syncNavigator({
          style: true,
          data: true,
          structural: true,
          chartOptions,
        });
      } else {
        this.verifyNavigatorIntegrity("refreshChart:preserved");
      }

      /*
       * Axis.update() may replace axis internals. Pure mode changes skip axis
       * updates, so their event binding remains untouched.
       */
      if (updateAxes) {
        this.bindAxisEvents();
      }

      /* --------------------------------------------------------------------
         Viewport
         -------------------------------------------------------------------- */

      if (previousViewport && preserveViewport) {
        this.restoreViewport(previousViewport, false);
      } else {
        this.applyDefaultViewport(false);
      }

      /* --------------------------------------------------------------------
         Redraw
         -------------------------------------------------------------------- */

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

    /*
     * Ignore viewport changes generated by this controller.
     */
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

      viewport: {
        minimum,
        maximum,
      },

      trigger: trigger || "axis",

      controller: this,
    });

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
    const resolved = clampViewport(
      viewport,
      getDataBounds(this.getActiveData()),
    );

    return resolved
      ? this.applyViewport(resolved, redraw, "market-chart-restore")
      : false;
  }

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

    if (!duration || duration >= getBoundsDuration(bounds)) {
      return this.applyViewport(bounds, redraw, "market-chart-live");
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

    if (!state.active) {
      return true;
    }

    /*
     * Historical ranges never poll the intraday endpoint.
     */
    if (!this.isIntradayRange()) {
      if (state.pauseReasons.includes(LIVE_PAUSE_HISTORICAL_RANGE)) {
        return true;
      }

      return this.liveController.pause(LIVE_PAUSE_HISTORICAL_RANGE);
    }

    /*
     * Returning to intraday removes only the range-owned pause reason.
     */
    if (state.pauseReasons.includes(LIVE_PAUSE_HISTORICAL_RANGE)) {
      const resumed = this.liveController.resume(LIVE_PAUSE_HISTORICAL_RANGE);

      /*
       * When the intraday record does not exist yet, request data immediately
       * after returning from a historical range.
       */
      if (resumed && refresh && !this.getRangeRecord(this.getIntradayRange())) {
        this.liveController.refresh();
      }

      return resumed;
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

    /*
     * Use UI/runtime availability rather than requiring an already-stored
     * record. This is what keeps 1D selectable when its live source exists.
     */
    if (!this.isRangeAvailable(normalizedRange)) {
      console.warn(`Market Chart range "${normalizedRange}" is unavailable.`);

      return false;
    }

    /* ----------------------------------------------------------------------
       Same Range
       ---------------------------------------------------------------------- */

    if (normalizedRange === this.currentRange && options.force !== true) {
      if (options.resetViewport === true) {
        this.userDetachedFromLive = false;

        this.liveViewportDuration = this.configuration.liveWindowDuration;

        this.setFollowLatest(false, {
          source: "range-reset",
        });

        this.applyDefaultViewport(options.redraw !== false);
      }

      this.synchronizeLiveRange({
        refresh: options.refreshLive !== false,
      });

      return true;
    }

    /* ----------------------------------------------------------------------
       New Range
       ---------------------------------------------------------------------- */

    const previousRange = this.currentRange;

    const previousMode = this.currentMode;

    if (!this.isIntradayRange(normalizedRange)) {
      this.liveController?.pause(LIVE_PAUSE_HISTORICAL_RANGE);
    }

    this.currentRange = normalizedRange;

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      normalizedRange,
    );

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

      this.synchronizeLiveRange({
        refresh: false,
      });

      return false;
    }

    this.updateControls();

    this.updateLastUpdated(this.getLatestTimestamp());

    this.synchronizeLiveRange({
      refresh: options.refreshLive !== false,
    });

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

    const crossesRendererFamily =
      previousMode === "candlestick" || normalizedMode === "candlestick";

    /*
     * A navigator is not just another series: Highstock creates internal
     * masks, outline paths and a dedicated series for it. Updating only the
     * visible series across renderer families can retain those internals and
     * layer the navigator fill after every toggle. Rebuild the chart instead,
     * while retaining the user's current time window.
     */
    const viewport = crossesRendererFamily ? this.getViewport() : null;

    if (crossesRendererFamily) {
      const rebuilt = this.rebuildChart({
        preserveViewport: true,
        animation: this.configuration.animation,
      });

      if (!rebuilt) {
        this.currentMode = previousMode;

        this.rebuildChart({
          preserveViewport: Boolean(viewport),
          animation: false,
        });

        return false;
      }
    } else {
      const updated = this.refreshChart({
        preserveViewport: true,
        updateAxes: false,
        syncNavigator: false,
        redraw: options.redraw !== false,
        animation: options.animation ?? false,
      });

      if (!updated) {
        this.currentMode = previousMode;

        return false;
      }
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
     External Range Data
     ========================================================================== */

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

    /*
     * Inactive ranges are data only.
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

    /*
     * Do not force the chart away from 1D merely because the current
     * intraday snapshot record is absent while a valid live source exists.
     */
    if (!this.isRangeAvailable(this.currentRange)) {
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

    this.setFollowLatest(false, {
      source: "ranges",
    });

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

    /* ----------------------------------------------------------------------
       Range Controls
       ---------------------------------------------------------------------- */

    const rangeSelector =
      this.configuration.controls?.rangeSelector || "[data-chart-range]";

    this.controlsRoot.querySelectorAll(rangeSelector).forEach((button) => {
      const range = normalizeMarketChartRange(
        button.dataset.chartRange || button.dataset.range,
      );

      const active = range === this.currentRange;

      /*
       * Critical:
       * 1D may be selectable from its live source even before a stored
       * snapshot record exists.
       */
      const available = this.isRangeAvailable(range);

      button.classList.toggle("is-active", active);

      button.setAttribute("aria-pressed", active ? "true" : "false");

      button.disabled = !available;

      button.setAttribute("aria-disabled", available ? "false" : "true");
    });

    /* ----------------------------------------------------------------------
       Mode Controls
       ---------------------------------------------------------------------- */

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

    this.updateControls();

    return record;
  }

  /* ==========================================================================
     Live Presentation
     ========================================================================== */

  synchronizeLivePresentation(direction) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    const nextDirection = direction || this.getDirection();

    if (nextDirection === this.presentationDirection) {
      return false;
    }

    this.element.dataset.chartDirection = nextDirection;

    /*
     * One option snapshot for main + navigator.
     */
    const chartOptions = this.createOptions();

    const mainOptions = chartOptions.series?.[0];

    const mainSeries = this.getMainSeries();

    if (!mainSeries || !mainOptions) {
      return false;
    }

    if (this.currentMode !== "candlestick") {
      applySeriesPresentation(mainSeries, mainOptions);
    }

    const navigatorOptions = chartOptions.navigator?.series;

    if (isPlainObject(navigatorOptions)) {
      for (const navigatorSeries of this.getNavigatorSeriesList()) {
        applySeriesPresentation(navigatorSeries, navigatorOptions);
      }
    }

    this.presentationDirection = nextDirection;

    return true;
  }

  /* ==========================================================================
     Visible Live Data
     ========================================================================== */

  synchronizeVisibleLiveData({ trendOperations, candleOperations }) {
    const mainSeries = this.getMainSeries();

    if (!mainSeries) {
      return false;
    }

    const mainData = this.getActiveData();

    const mainOperations =
      this.currentMode === "candlestick" ? candleOperations : trendOperations;

    const mainChanged = applySeriesOperations(
      mainSeries,
      mainOperations,
      mainData,
    );

    /*
     * Navigator receives the exact trend operations incrementally.
     */
    const navigatorChanged = this.applyNavigatorLiveOperations(trendOperations);

    if (!mainChanged && !navigatorChanged) {
      return false;
    }

    /*
     * Presentation is applied after data mutations.
     */
    const direction = this.getDirection();

    if (direction !== this.presentationDirection) {
      this.synchronizeLivePresentation(direction);
    }

    return true;
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

    /*
     * A browser-tab return deliberately requests the whole intraday session.
     * It must replace the canonical record, not be merged as an incremental
     * update; otherwise stale points and missed timestamps can coexist and
     * make the candlestick series and navigator disagree.
     */
    if (metadata.fullSnapshot === true) {
      const snapshot = {
        comparisonValue: record.comparisonValue,
        trend: [],
        candlestick: [],
      };

      for (const { sourcePoint, pricePoint } of accepted) {
        upsertPoint(snapshot.trend, pricePoint, this.configuration.maxPoints);

        mergeLiveCandle(snapshot.candlestick, sourcePoint, pricePoint, {
          bucketSize: this.configuration.candleBucketSize,
          maxPoints: this.configuration.maxPoints,
        });
      }

      /*
       * Replace canonical 1D data, then recreate Highstock so the main series
       * and navigator are both built from the same complete snapshot.
       */
      if (!setMarketChartRangeRecord(this.ranges, range, snapshot)) {
        return false;
      }

      this.refreshAvailableRanges();
      this.updateControls();

      const updated = visible
        ? this.rebuildChart({
            preserveViewport: true,
            animation: this.configuration.animation,
          })
        : true;

      const latestTimestamp = snapshot.trend.at(-1)?.[0] ?? null;

      this.updateLastUpdated(latestTimestamp);

      dispatchChartEvent(this.element, "marketchartliveupdate", {
        point: accepted.at(-1)?.pricePoint ?? null,
        points: accepted.map(({ sourcePoint }) => sourcePoint),
        metadata,
        range,
        visibleRange: this.currentRange,
        visible,
        fullSnapshot: true,
        genuinelyNewTimestamp: false,
        chartChanged: Boolean(updated && visible),
        controller: this,
      });

      return true;
    }

    const activeWasEmpty = visible && !this.hasActiveData();

    /*
     * Capture current latest timestamp before mutating canonical data.
     *
     * This lets us distinguish:
     *
     * - current timestamp correction
     * - historical correction
     * - genuinely new market timestamp
     */
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

    /* ----------------------------------------------------------------------
       Canonical Data Mutation
       ---------------------------------------------------------------------- */

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

    /* ----------------------------------------------------------------------
       Memory Cap Diagnostic
       ---------------------------------------------------------------------- */

    if (evictedCount > 0) {
      console.warn(
        `Market Chart (${this.configuration.symbol || "unknown"}): ` +
          `maxPoints (${this.configuration.maxPoints}) was exceeded and ` +
          `${evictedCount} point(s) were removed from the beginning of the ` +
          "intraday session. Increase maxPoints if the entire active session " +
          "must remain available.",
      );
    }

    /* ----------------------------------------------------------------------
       Changed State
       ---------------------------------------------------------------------- */

    const trendChanged = trendOperations.some(
      (operation) => operation?.type !== "noop",
    );

    const candlesChanged = candleOperations.some(
      (operation) => operation?.type !== "noop",
    );

    /*
     * Successful request but no canonical change.
     *
     * Market may simply be closed or backend may have returned the current
     * unchanged timestamp.
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

    /* ----------------------------------------------------------------------
       Controls
       ---------------------------------------------------------------------- */

    if (availabilityMayChange) {
      this.updateControls();
    }

    /* ----------------------------------------------------------------------
       Visible Chart Synchronization
       ---------------------------------------------------------------------- */

    let chartChanged = false;

    if (visible) {
      if (activeWasEmpty) {
        /*
         * Initial empty state recovered after first valid live payload.
         *
         * A full refresh is appropriate here because no valid chart series
         * existed previously.
         */
        this.userDetachedFromLive = false;

        this.liveViewportDuration = this.configuration.liveWindowDuration;

        this.setFollowLatest(false, {
          source: "live-recovery",
        });

        chartChanged = this.refreshChart({
          preserveViewport: false,

          redraw: true,

          animation: false,
        });
      } else {
        /*
         * Normal live hot path.
         *
         * Main series and navigator both receive incremental operations.
         */
        chartChanged = this.synchronizeVisibleLiveData({
          trendOperations,
          candleOperations,
        });

        if (chartChanged) {
          /*
           * Move the live viewport only when a genuinely newer timestamp has
           * arrived.
           *
           * Same-timestamp corrections must not move the user.
           */
          if (genuinelyNewTimestamp && !this.userDetachedFromLive) {
            this.setFollowLatest(true, {
              source: "new-data",
            });

            this.applyLiveViewport(false);
          }

          /*
           * Exactly one redraw for:
           *
           * - main data mutation
           * - navigator data mutation
           * - semantic presentation mutation
           * - live viewport mutation
           */
          this.chart?.redraw(false);

          if (this.state !== "ready") {
            this.clearMessage();

            this.setState("ready");
          }
        }
      }
    }

    /* ----------------------------------------------------------------------
       Updated Timestamp
       ---------------------------------------------------------------------- */

    this.updateLastUpdated(currentLatestTimestamp ?? latestAcceptedPoint?.[0]);

    /* ----------------------------------------------------------------------
       Public Event
       ---------------------------------------------------------------------- */

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
     * true:
     * canonical data changed.
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

    /*
     * Exactly one live polling controller belongs to this chart controller.
     */
    this.liveController?.destroy();

    this.liveController = createMarketChartLiveController({
      interval: live.interval ?? 60_000,

      alignToInterval: live.alignToInterval ?? true,

      /*
       * Usually false because the initial snapshot has already been loaded.
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
        fullSnapshot = false,
      }) =>
        live.fetchUpdates({
          signal,
          requestedAt,
          sequence,
          requestId,
          fullSnapshot,

          symbol: this.configuration.symbol,

          range: intradayRange,

          /*
           * Canonical live timeline is always trend/close.
           */
          mode: "trend",

          /*
           * Inclusive reconciliation boundary.
           *
           * API may return:
           *
           * - correction for latest timestamp
           * - new timestamp
           * - multiple timestamps since this point
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

      /*
       * Historical initial range immediately installs its own pause reason.
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
     * Historical range ownership cannot be overridden by arbitrary external
     * resume requests.
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
    if (this.destroyed) {
      return false;
    }

    /*
     * null / false / 0:
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
     * Theme changes are rare structural refreshes.
     */
    return this.refreshChart({
      preserveViewport: true,

      /*
       * Theme refresh changes navigator presentation/chrome, not its data.
       */
      navigatorData: false,

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
       * Observe host only.
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

    this.userDetachedFromLive = false;

    this.liveViewportDuration = this.configuration.liveWindowDuration;

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
    const navigatorSeries = this.getNavigatorSeries();

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

      /*
       * Stored backend ranges.
       *
       * Runtime-selectable 1D can additionally be available through the live
       * source even before it appears in this stored-range list.
       */
      availableRanges: [...this.availableRanges],

      navigator: {
        enabled: Boolean(navigatorSeries),

        followLatest: this.followLatest,

        userDetachedFromLive: this.userDetachedFromLive,

        viewport: this.getViewport(),

        dataBounds: getDataBounds(this.getActiveData()),

        liveWindowDuration: this.liveViewportDuration,

        seriesCount: this.getNavigatorSeriesList().length,

        color: navigatorSeries?.color ?? null,

        pointCount: navigatorSeries?.data?.length ?? 0,
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
     * Set first so asynchronous work cannot continue during teardown.
     */
    this.destroyed = true;

    /* ----------------------------------------------------------------------
       Live
       ---------------------------------------------------------------------- */

    this.liveController?.destroy();

    this.liveController = null;

    /* ----------------------------------------------------------------------
       Highcharts Events
       ---------------------------------------------------------------------- */

    this.removeAxisEvent?.();

    this.removeAxisEvent = null;

    /* ----------------------------------------------------------------------
       DOM Events
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
       Highstock
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
   Public Factory
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
     * Build/validate replacement before destroying current owner.
     */
    controller = new MarketChartController(element, source);

    /*
     * One host owns one controller.
     */
    existing?.destroy();

    chartRegistry.set(element, controller);

    controller.initialize();

    return controller;
  } catch (error) {
    controller?.destroy();

    /*
     * Restore existing controller only if it is still alive.
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

/* ==========================================================================
   Registry API
   ========================================================================== */

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
