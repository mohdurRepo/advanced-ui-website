import {
  DEFAULT_CANDLE_BUCKET_SIZE,
  DEFAULT_MAX_POINTS,
  LIVE_OPERATION,
  MARKET_CHART_MODES,
  applyMarketChartLiveItems,
  createEmptyMarketChartRangeRecord,
  createMarketChartSnapshotRecord,
  getAvailableMarketChartRanges,
  getFirstAvailableMarketChartRange,
  getMarketChartRangeComparisonValue,
  hasMarketChartChanges,
  isMarketChartIntradayRange,
  isMarketChartRangeSupported,
  normalizeMarketChartCapabilities,
  normalizeMarketChartLivePayload,
  normalizeMarketChartMode,
  normalizeMarketChartRange,
  normalizeMarketChartRangeRecord,
  normalizeMarketChartRanges,
  setMarketChartRangeRecord,
} from "./market-chart-data.js";

import { getMarketChartStrings } from "./market-chart-i18n.js";

import { createMarketChartLiveController } from "./market-chart-live.js";

import { createMarketChartOptions } from "./market-chart-options.js";

import {
  getMarketChartNavigatorTheme,
  getMarketChartSeriesTheme,
  getMarketChartTheme,
} from "./market-chart-theme.js";

import {
  DEFAULT_TIME_ZONE,
  NAVIGATOR_SERIES_ID,
  asPlainObject,
  createDateTimeFormat,
  getMainSeriesId,
  isElement,
  isPlainObject,
  toFiniteNumber,
  toPositiveInteger,
  toPositiveNumber,
} from "./market-chart-utils.js";

/* ==========================================================================
   Market Chart Controller
   ==========================================================================

   Owns one Highstock instance per chart host.

   Responsibilities: canonical range data, range / mode switching, live data
   reconciliation, follow-live viewport, controls, theme / resize
   observation, teardown.

   Rendering rules:

   1. Structural changes REBUILD the chart:
        range, mode, range data replacement, full live snapshot, theme.
      Highstock keeps navigator masks, ordinal state and internal series
      outside the public update API; a fresh instance can never carry stale
      internals across an ordinal / renderer change.

   2. Live ticks are INCREMENTAL:
        append  -> addPoint()
        replace -> Point.update()
        reset   -> setData()
      applied to the main series and the navigator, followed by exactly one
      chart.redraw(false).

   3. Direction changes (red / green) are presentation-only: SVG attributes
      are recolored in place, never through Series.update().

   Live snapshot rules:

   4. Entering the intraday range renders cached data immediately and
      requests one authoritative full snapshot. Incremental responses are
      ignored until that snapshot arrives (`awaitingSnapshot`).

   5. A new trading date is never merged into the previous session; it
      triggers a full snapshot. Its previous close comes from the payload,
      or falls back to the last close of the previous session.
   ========================================================================== */

/* ==========================================================================
   Constants
   ========================================================================== */

const chartRegistry = new Map();

const LIVE_PAUSE_HISTORICAL_RANGE = "historical-range";

const DEFAULT_LIVE_INTERVAL = 60_000;

const DEFAULT_RANGE_SELECTOR = "[data-chart-range]";

const DEFAULT_MODE_SELECTOR = "[data-chart-type], [data-chart-mode]";

/*
 * Controls root lookup, in priority order. There is deliberately no
 * parentElement fallback: two charts sharing a parent must never react to
 * each other's buttons.
 */
const CONTROLS_ROOT_SELECTORS = Object.freeze([
  "[data-market-chart-root]",
  "[data-performance-chart]",
  ".performance-chart",
]);

const FOLLOW_TOLERANCE_RATIO = 0.01;
const FOLLOW_TOLERANCE_MINIMUM = 1_000;

const DEFAULT_CONFIGURATION = Object.freeze({
  context: "performance",

  symbol: "",
  name: "",
  currency: "",

  mode: "trend",
  range: "1D",

  previousClose: null,

  language: null,
  timeZone: DEFAULT_TIME_ZONE,
  decimals: 2,

  maxPoints: DEFAULT_MAX_POINTS,
  candleBucketSize: DEFAULT_CANDLE_BUCKET_SIZE,

  showEmptyState: true,

  /*
   * null: keep the complete intraday session visible.
   * positive ms: follow a trailing live window.
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

  /*
   * i18n overrides: { messages, axis, tooltip, highcharts, accessibility }.
   */
  strings: {},

  environment: {},
});

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
  const root = controls.root;

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
      /* Invalid selector: fall through to structural lookup. */
    }
  }

  for (const selector of CONTROLS_ROOT_SELECTORS) {
    const resolved = element.closest(selector);

    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function dispatchChartEvent(element, type, detail = {}) {
  const CustomEventConstructor =
    element?.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;

  if (!isElement(element) || typeof CustomEventConstructor !== "function") {
    return false;
  }

  element.dispatchEvent(
    new CustomEventConstructor(type, { bubbles: true, detail }),
  );

  return true;
}

function removeMessages(element) {
  element
    ?.querySelectorAll(":scope > .market-chart__message")
    .forEach((message) => message.remove());
}

function createMessageElement(document, state, message) {
  const assertive = state === "error";

  const wrapper = document.createElement("div");

  wrapper.className = `market-chart__message market-chart__message--${state}`;
  wrapper.setAttribute("role", assertive ? "alert" : "status");
  wrapper.setAttribute("aria-live", assertive ? "assertive" : "polite");

  const text = document.createElement("p");

  text.className = "market-chart__message-text";
  text.textContent = message;

  wrapper.append(text);

  return wrapper;
}

function syncToggleButton(button, active, available) {
  button.classList.toggle("is-active", active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.disabled = !available;
  button.setAttribute("aria-disabled", available ? "false" : "true");
}

/* ==========================================================================
   Configuration
   ========================================================================== */

/**
 * Normalizes consumer configuration.
 *
 * Raw `data` / `ranges` are intentionally NOT kept: they are normalized
 * once by the controller and the raw API payload can then be collected.
 */
function normalizeConfiguration(source, document) {
  const {
    data: ignoredData,
    ranges: ignoredRanges,
    ...rest
  } = isPlainObject(source) ? source : {};

  const live = isPlainObject(rest.live) ? rest.live : null;

  const capabilities = {
    ...normalizeMarketChartCapabilities(rest.capabilities),
  };

  /*
   * A live config implies the live capability unless stated otherwise.
   */
  if (live && rest.capabilities?.live === undefined) {
    capabilities.live = live.enabled !== false;
  }

  /*
   * Legacy message options map onto i18n overrides.
   */
  const strings = asPlainObject(rest.strings);

  const messages = {
    ...asPlainObject(strings.messages),
    ...asPlainObject(rest.messages),
    ...(rest.loadingMessage ? { loading: rest.loadingMessage } : {}),
    ...(rest.emptyMessage ? { empty: rest.emptyMessage } : {}),
    ...(rest.errorMessage ? { error: rest.errorMessage } : {}),
  };

  return {
    ...DEFAULT_CONFIGURATION,
    ...rest,

    capabilities: normalizeMarketChartCapabilities(capabilities),

    mode: normalizeMarketChartMode(rest.mode ?? DEFAULT_CONFIGURATION.mode),
    range: normalizeMarketChartRange(rest.range ?? DEFAULT_CONFIGURATION.range),

    language: rest.language || document?.documentElement?.lang || "en",
    timeZone: rest.timeZone || DEFAULT_TIME_ZONE,

    maxPoints: toPositiveInteger(rest.maxPoints, DEFAULT_MAX_POINTS),
    candleBucketSize: toPositiveInteger(
      rest.candleBucketSize,
      DEFAULT_CANDLE_BUCKET_SIZE,
    ),

    liveWindowDuration: toPositiveNumber(
      rest.liveWindowDuration ?? rest.navigator?.liveWindowDuration,
      null,
    ),

    axis: asPlainObject(rest.axis),
    xAxis: asPlainObject(rest.xAxis),
    yAxis: asPlainObject(rest.yAxis),

    dateFormats: asPlainObject(rest.dateFormats),
    tooltipDateFormats: asPlainObject(rest.tooltipDateFormats),
    tooltip: asPlainObject(rest.tooltip),

    controls: asPlainObject(rest.controls),
    navigator: asPlainObject(rest.navigator),
    exporting: asPlainObject(rest.exporting),
    environment: asPlainObject(rest.environment),

    strings: { ...strings, messages },

    live,
  };
}

/* ==========================================================================
   Data Helpers
   ========================================================================== */

function getRecordData(record, mode) {
  if (!record) {
    return [];
  }

  return normalizeMarketChartMode(mode) === "candlestick"
    ? record.candlestick
    : record.trend;
}

function getDataDirection(trendData) {
  if (trendData.length < 2) {
    return "neutral";
  }

  const first = trendData[0][1];
  const last = trendData.at(-1)[1];

  if (first === last) {
    return "neutral";
  }

  return last > first ? "up" : "down";
}

function getDataBounds(data) {
  if (!data?.length) {
    return null;
  }

  return { minimum: data[0][0], maximum: data.at(-1)[0] };
}

function getBoundsDuration(bounds) {
  return bounds ? Math.max(0, bounds.maximum - bounds.minimum) : 0;
}

/**
 * Keeps a viewport's duration but moves it inside the data bounds.
 */
function clampViewport(viewport, bounds) {
  if (!viewport || !bounds) {
    return null;
  }

  const dataDuration = getBoundsDuration(bounds);
  const duration = Math.min(getBoundsDuration(viewport), dataDuration);

  if (dataDuration <= 0 || duration <= 0) {
    return { ...bounds };
  }

  const minimum = Math.max(
    bounds.minimum,
    Math.min(viewport.minimum, bounds.maximum - duration),
  );

  return { minimum, maximum: minimum + duration };
}

/* ==========================================================================
   Highcharts Incremental Operations
   ========================================================================== */

function applySeriesOperation(series, operation, finalData) {
  if (operation.type === LIVE_OPERATION.APPEND) {
    series.addPoint(operation.point, false, operation.shifted, false);

    return;
  }

  if (operation.type === LIVE_OPERATION.REPLACE) {
    const lastPoint = (series.data?.length ? series.data : series.points)?.at(
      -1,
    );

    if (lastPoint?.x === operation.point[0]) {
      lastPoint.update(operation.point, false, false);

      return;
    }
  }

  /*
   * Reset, or an unexpected mismatch between canonical and rendered data.
   */
  series.setData(finalData, false, false, false);
}

/**
 * Applies one live transaction to one series.
 *
 * A single change stays incremental; multi-point batches and resets are
 * reconciled with one setData().
 */
function applySeriesOperations(series, operations, finalData) {
  if (!series || !hasMarketChartChanges(operations)) {
    return false;
  }

  const changed = operations.filter(
    (operation) => operation.type !== LIVE_OPERATION.NOOP,
  );

  if (changed.length > 1 || changed[0].type === LIVE_OPERATION.RESET) {
    series.setData(finalData, false, false, false);
  } else {
    applySeriesOperation(series, changed[0], finalData);
  }

  return true;
}

/* ==========================================================================
   Highcharts Presentation
   ========================================================================== */

const PRESENTATION_KEYS = Object.freeze([
  "color",
  "lineColor",
  "lineWidth",
  "fillColor",
  "upColor",
  "upLineColor",
]);

/**
 * Recolors an existing series in place, without Series.update().
 *
 * This avoids rebuilding a live area's graph/area SVG (the "branch"
 * artifact) on red/green direction changes.
 */
function applySeriesPresentation(series, options) {
  if (!series || !isPlainObject(options)) {
    return false;
  }

  const presentation = {};

  for (const key of PRESENTATION_KEYS) {
    if (options[key] !== undefined) {
      presentation[key] = options[key];
    }
  }

  if (!Object.keys(presentation).length) {
    return false;
  }

  for (const target of [series.options, series.userOptions]) {
    if (isPlainObject(target)) {
      Object.assign(target, presentation);
    }
  }

  if (presentation.color !== undefined) {
    series.color = presentation.color;
  }

  const stroke = presentation.lineColor ?? presentation.color;

  const strokeAttributes = {
    ...(stroke !== undefined ? { stroke } : {}),
    ...(presentation.lineWidth !== undefined
      ? { "stroke-width": presentation.lineWidth }
      : {}),
  };

  if (Object.keys(strokeAttributes).length) {
    for (const graph of new Set([series.graph, ...(series.graphs ?? [])])) {
      graph?.attr?.(strokeAttributes);
    }
  }

  if (presentation.fillColor !== undefined) {
    for (const area of new Set([series.area, ...(series.areas ?? [])])) {
      area?.attr?.({ fill: presentation.fillColor });
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
      this.configuration.Highcharts ??
      this.window?.Highcharts ??
      globalThis.Highcharts;

    if (typeof this.Highcharts?.stockChart !== "function") {
      throw new TypeError("Market Chart requires Highstock.");
    }

    const AbortControllerConstructor =
      this.window?.AbortController ?? globalThis.AbortController;

    if (typeof AbortControllerConstructor !== "function") {
      throw new TypeError("Market Chart requires AbortController.");
    }

    this.capabilities = this.configuration.capabilities;

    this.strings = getMarketChartStrings(
      this.configuration.language,
      this.configuration.strings,
    );

    this.controlsRoot = resolveControlsRoot(
      element,
      this.configuration.controls,
    );

    this.section = this.controlsRoot;

    /* Data --------------------------------------------------------------- */

    this.ranges = normalizeMarketChartRanges(configuration?.ranges, {
      capabilities: this.capabilities,
      timeZone: this.configuration.timeZone,
    });

    this.availableRanges = getAvailableMarketChartRanges(
      this.ranges,
      this.capabilities,
    );

    if (!this.availableRanges.length) {
      this.adoptFlatData(configuration?.data);
    }

    this.currentRange =
      getFirstAvailableMarketChartRange(
        this.ranges,
        this.configuration.range,
        this.capabilities,
      ) ?? this.configuration.range;

    this.currentMode = this.configuration.mode;

    /* Runtime ------------------------------------------------------------ */

    this.chart = null;
    this.theme = null;
    this.liveController = null;

    this.destroyed = false;
    this.initialized = false;
    this.state = "idle";

    this.presentationDirection = null;

    /*
     * True between entering the intraday range (or a session rollover) and
     * the arrival of the authoritative full snapshot.
     */
    this.awaitingSnapshot = false;

    this.followLatest = false;
    this.userDetachedFromLive = false;
    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.resizeFrame = null;
    this.themeFrame = null;

    this.resizeObserver = null;
    this.themeObserver = null;

    this.removeAxisEvent = null;
    this.tradingDateFormatter = null;

    this.listenerController = new AbortControllerConstructor();

    this.handleControlClick = this.handleControlClick.bind(this);
    this.handleAfterSetExtremes = this.handleAfterSetExtremes.bind(this);
    this.handleThemeMutation = this.handleThemeMutation.bind(this);
  }

  /**
   * Convenience: a flat `data` array becomes the configured range.
   */
  adoptFlatData(data) {
    const { mode, range, previousClose, timeZone } = this.configuration;

    const key = mode === "candlestick" ? "candlestick" : "trend";

    const record = normalizeMarketChartRangeRecord(
      { [key]: data ?? [], comparisonValue: previousClose },
      { timeZone },
    );

    if (record?.trend.length || record?.candlestick.length) {
      this.ranges[range] = record;
      this.availableRanges = [range];
    }
  }

  /* ========================================================================
     State
     ======================================================================== */

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

  setLiveState(detail) {
    if (this.destroyed) {
      return false;
    }

    const value = detail?.state || "idle";

    this.element.dataset.chartLiveState = value;

    this.section?.setAttribute("data-chart-live-state", value);

    const status = this.controlsRoot?.querySelector("[data-chart-live-status]");

    if (status) {
      status.dataset.liveState = value;
    }

    dispatchChartEvent(this.element, "marketchartlivestatechange", {
      state: value,
      detail,
      controller: this,
    });

    return true;
  }

  setFollowLatest(follow, detail = {}) {
    const value = Boolean(follow);

    const changed = value !== this.followLatest;

    this.followLatest = value;

    const attribute = value ? "true" : "false";

    this.element.dataset.chartFollowLive = attribute;

    this.section?.setAttribute("data-chart-follow-live", attribute);

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

  /**
   * Back to "show the complete session".
   */
  resetLiveFollowing(source) {
    this.userDetachedFromLive = false;
    this.liveViewportDuration = this.configuration.liveWindowDuration;

    this.setFollowLatest(false, { source });
  }

  isSnapshotPending() {
    return (
      this.awaitingSnapshot && this.liveController?.getState().active === true
    );
  }

  /**
   * Reflects the active range's data in the state / message UI.
   */
  syncDataState() {
    if (this.hasActiveData()) {
      this.clearMessage();
      this.setState("ready");
    } else {
      this.showMessage(this.isSnapshotPending() ? "loading" : "empty");
    }
  }

  reportError(error, message) {
    console.error(message, error);

    this.showMessage("error");

    dispatchChartEvent(this.element, "marketcharterror", {
      error,
      controller: this,
    });
  }

  /* ========================================================================
     Messages
     ======================================================================== */

  clearMessage() {
    removeMessages(this.element);
  }

  showMessage(state) {
    this.clearMessage();

    const message = this.strings.messages[state] ?? "";

    this.setState(state, message);

    if (message) {
      this.element.append(createMessageElement(this.document, state, message));
    }
  }

  /* ========================================================================
     Data Access
     ======================================================================== */

  refreshAvailableRanges() {
    this.availableRanges = getAvailableMarketChartRanges(
      this.ranges,
      this.capabilities,
    );
  }

  getRangeRecord(range = this.currentRange) {
    return this.ranges[normalizeMarketChartRange(range)] ?? null;
  }

  getRangeData(range = this.currentRange, mode = this.currentMode) {
    return getRecordData(this.getRangeRecord(range), mode);
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

  /**
   * Canonical time domain of a range.
   *
   * Trend data is authoritative (it keeps the real market timestamps and
   * drives the navigator), so switching renderer never changes the domain.
   * Candles are only a fallback.
   */
  getRangeDomainBounds(range = this.currentRange) {
    return (
      getDataBounds(this.getRangeData(range, "trend")) ??
      getDataBounds(this.getRangeData(range, "candlestick"))
    );
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
    return this.getRangeData(range, mode).at(-1)?.[0] ?? null;
  }

  /* ========================================================================
     Availability
     ======================================================================== */

  isIntradayRange(range = this.currentRange) {
    return isMarketChartIntradayRange(range, this.capabilities);
  }

  getIntradayRange() {
    return this.capabilities.intradayRange;
  }

  hasLiveSource() {
    const live = this.configuration.live;

    return Boolean(
      this.capabilities.live === true &&
      live &&
      live.enabled !== false &&
      typeof live.fetchUpdates === "function",
    );
  }

  /**
   * Historical ranges need a stored record. The intraday range stays
   * selectable while a live source exists, even before its first snapshot.
   */
  isRangeAvailable(range) {
    const normalizedRange = normalizeMarketChartRange(range);

    if (!isMarketChartRangeSupported(normalizedRange, this.capabilities)) {
      return false;
    }

    if (this.ranges[normalizedRange]) {
      return true;
    }

    return (
      this.isIntradayRange(normalizedRange) &&
      (this.hasLiveSource() || Boolean(this.liveController))
    );
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
      MARKET_CHART_MODES.find((mode) => this.isModeAvailable(mode, range)) ??
      preferred
    );
  }

  /* ========================================================================
     Highcharts Resolution
     ======================================================================== */

  getMainSeries() {
    return this.chart?.get(getMainSeriesId(this.configuration.symbol)) ?? null;
  }

  getNavigatorSeriesList() {
    const series = this.chart?.navigator?.series;

    return Array.isArray(series) ? series.filter(Boolean) : [];
  }

  getMainXAxis() {
    const axes = this.chart?.xAxis;

    return axes?.find((axis) => !axis.options?.isInternal) ?? axes?.[0] ?? null;
  }

  getViewport() {
    const axis = this.getMainXAxis();

    const minimum = toFiniteNumber(axis?.min);
    const maximum = toFiniteNumber(axis?.max);

    return minimum !== null && maximum !== null ? { minimum, maximum } : null;
  }

  /* ========================================================================
     Rendering
     ======================================================================== */

  createOptions() {
    const configuration = this.configuration;

    return createMarketChartOptions({
      Highcharts: this.Highcharts,
      element: this.element,

      context: configuration.context,
      capabilities: this.capabilities,

      mode: this.currentMode,
      range: this.currentRange,
      intraday: this.isIntradayRange(),
      direction: this.getDirection(),

      symbol: configuration.symbol,
      seriesName: configuration.name || configuration.symbol,
      currency: configuration.currency,
      previousClose: this.getComparisonValue(),

      data: this.getActiveData(),
      showEmptyState: configuration.showEmptyState,
      navigatorData: this.getNavigatorData(),

      language: configuration.language,
      timeZone: configuration.timeZone,
      decimals: configuration.decimals,
      strings: configuration.strings,

      xAxisTitle: configuration.xAxisTitle,
      yAxisTitle: configuration.yAxisTitle,

      axis: configuration.axis,
      xAxis: configuration.xAxis,
      yAxis: configuration.yAxis,

      dateFormats: configuration.dateFormats,
      tooltipDateFormats: configuration.tooltipDateFormats,
      tooltip: configuration.tooltip,

      navigatorEnabled: configuration.navigatorEnabled,
      navigator: configuration.navigator,

      exporting: configuration.exporting,
      animation: configuration.animation,

      accessibilityEnabled: configuration.accessibilityEnabled,
      accessibilityDescription: configuration.accessibilityDescription,
    });
  }

  /**
   * (Re)builds the Highstock instance from current state.
   *
   * @param {{ viewport?: { minimum: number, maximum: number } | null }} [options]
   *   viewport to restore (clamped to the new data); null shows the full
   *   range.
   * @returns {boolean}
   */
  render({ viewport = null } = {}) {
    if (this.destroyed) {
      return false;
    }

    this.removeAxisEvent?.();
    this.removeAxisEvent = null;

    this.chart?.destroy();
    this.chart = null;

    try {
      this.theme = getMarketChartTheme(this.element);

      this.presentationDirection = this.getDirection();
      this.element.dataset.chartDirection = this.presentationDirection;

      this.chart = this.Highcharts.stockChart(
        this.element,
        this.createOptions(),
      );

      if (!this.chart) {
        throw new Error("Highstock did not create the Market Chart.");
      }

      this.bindAxisEvents();

      if (viewport) {
        this.restoreViewport(viewport);
      }

      this.syncDataState();

      return true;
    } catch (error) {
      this.chart = null;

      this.reportError(error, "Market Chart render failed.");

      return false;
    }
  }

  /* ========================================================================
     Axis Events
     ======================================================================== */

  bindAxisEvents() {
    const axis = this.getMainXAxis();

    if (axis && typeof this.Highcharts.addEvent === "function") {
      this.removeAxisEvent = this.Highcharts.addEvent(
        axis,
        "afterSetExtremes",
        this.handleAfterSetExtremes,
      );
    }
  }

  handleAfterSetExtremes(event) {
    const trigger = String(event?.trigger ?? "");

    /*
     * Ignore viewport changes made by this controller.
     */
    if (this.destroyed || trigger.startsWith("market-chart-")) {
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

    const bounds = this.isIntradayRange() ? this.getRangeDomainBounds() : null;

    if (!bounds) {
      return;
    }

    const duration = maximum - minimum;

    const tolerance = Math.max(
      FOLLOW_TOLERANCE_MINIMUM,
      duration * FOLLOW_TOLERANCE_RATIO,
    );

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

  /* ========================================================================
     Viewport
     ======================================================================== */

  applyViewport(viewport, redraw = true, trigger = "market-chart-data") {
    const axis = this.getMainXAxis();

    if (!axis || !viewport || viewport.maximum < viewport.minimum) {
      return false;
    }

    axis.setExtremes(viewport.minimum, viewport.maximum, redraw, false, {
      trigger,
    });

    return true;
  }

  restoreViewport(viewport, redraw = true) {
    const resolved = clampViewport(viewport, this.getRangeDomainBounds());

    return this.applyViewport(resolved, redraw, "market-chart-restore");
  }

  applyDefaultViewport(redraw = true) {
    return this.applyViewport(
      this.getRangeDomainBounds(),
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

    const bounds = this.getRangeDomainBounds();

    if (!bounds) {
      return false;
    }

    const duration =
      this.configuration.liveWindowDuration || this.liveViewportDuration;

    const viewport =
      !duration || duration >= getBoundsDuration(bounds)
        ? bounds
        : {
            minimum: Math.max(bounds.minimum, bounds.maximum - duration),
            maximum: bounds.maximum,
          };

    return this.applyViewport(viewport, redraw, "market-chart-live");
  }

  /* ========================================================================
     Live / Range Coordination
     ======================================================================== */

  /**
   * Historical ranges never poll the intraday endpoint.
   */
  syncLiveWithRange() {
    const live = this.liveController;

    if (!live?.getState().active) {
      return;
    }

    if (this.isIntradayRange()) {
      live.resume(LIVE_PAUSE_HISTORICAL_RANGE);
    } else {
      live.pause(LIVE_PAUSE_HISTORICAL_RANGE);
    }
  }

  /**
   * Requests an authoritative full snapshot. While polling is paused the
   * request is queued and sent on resume.
   */
  requestSnapshot(reason) {
    return (
      this.liveController?.refresh({ fullSnapshot: true, reason }) ?? false
    );
  }

  /* ========================================================================
     Range Selection
     ======================================================================== */

  setRange(range, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeMarketChartRange(range);

    if (!this.isRangeAvailable(normalizedRange)) {
      console.warn(`Market Chart range "${normalizedRange}" is unavailable.`);

      return false;
    }

    /* Same range --------------------------------------------------------- */

    if (normalizedRange === this.currentRange && options.force !== true) {
      if (options.resetViewport === true) {
        this.resetLiveFollowing("range-reset");
        this.applyDefaultViewport();
      }

      if (options.refreshLive !== false && this.isIntradayRange()) {
        this.liveController?.refresh();
      }

      return true;
    }

    /* New range ---------------------------------------------------------- */

    const previousRange = this.currentRange;
    const previousMode = this.currentMode;

    const enteringIntraday =
      this.isIntradayRange(normalizedRange) &&
      !this.isIntradayRange(previousRange);

    this.currentRange = normalizedRange;
    this.currentMode = this.resolveAvailableMode(this.currentMode);

    this.resetLiveFollowing("range");

    this.syncLiveWithRange();

    /*
     * Cached intraday data may be stale: show it immediately, but ignore
     * incremental updates until one authoritative snapshot arrives.
     */
    this.awaitingSnapshot =
      enteringIntraday && this.liveController?.getState().active === true;

    if (this.awaitingSnapshot) {
      this.requestSnapshot("range-return");
    }

    if (!this.render()) {
      this.currentRange = previousRange;
      this.currentMode = previousMode;
      this.awaitingSnapshot = false;

      this.syncLiveWithRange();
      this.render();
      this.updateControls();

      return false;
    }

    if (
      !this.awaitingSnapshot &&
      options.refreshLive !== false &&
      this.isIntradayRange()
    ) {
      this.liveController?.refresh();
    }

    this.updateControls();

    dispatchChartEvent(this.element, "marketchartrangechange", {
      range: this.currentRange,
      previousRange,
      controller: this,
    });

    return true;
  }

  /* ========================================================================
     Mode Selection
     ======================================================================== */

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

    /*
     * The user's time window survives the rebuild.
     */
    const viewport = this.getViewport();

    this.currentMode = normalizedMode;

    if (!this.render({ viewport })) {
      this.currentMode = previousMode;
      this.render({ viewport });

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

  /* ========================================================================
     External Range Data
     ======================================================================== */

  setRangeRecord(range, record, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeMarketChartRange(range);

    if (
      !isMarketChartRangeSupported(normalizedRange, this.capabilities) ||
      !setMarketChartRangeRecord(this.ranges, normalizedRange, record, {
        timeZone: this.configuration.timeZone,
      })
    ) {
      return false;
    }

    this.refreshAvailableRanges();

    /*
     * Inactive ranges are data only.
     */
    if (normalizedRange !== this.currentRange) {
      this.updateControls();

      return true;
    }

    if (this.isIntradayRange()) {
      this.awaitingSnapshot = false;
    }

    this.currentMode = this.resolveAvailableMode(this.currentMode);

    const rendered = this.render({
      viewport: options.preserveViewport === true ? this.getViewport() : null,
    });

    this.updateControls();

    return rendered;
  }

  setRanges(ranges, options = {}) {
    if (this.destroyed || !isPlainObject(ranges)) {
      return false;
    }

    const normalized = normalizeMarketChartRanges(ranges, {
      capabilities: this.capabilities,
      timeZone: this.configuration.timeZone,
    });

    this.ranges =
      options.merge === true ? { ...this.ranges, ...normalized } : normalized;

    this.refreshAvailableRanges();

    if (!this.isRangeAvailable(this.currentRange)) {
      this.currentRange =
        getFirstAvailableMarketChartRange(
          this.ranges,
          this.configuration.range,
          this.capabilities,
        ) ?? this.configuration.range;
    }

    this.currentMode = this.resolveAvailableMode(this.currentMode);
    this.awaitingSnapshot = false;

    this.resetLiveFollowing("ranges");
    this.syncLiveWithRange();

    const viewport =
      options.preserveViewport === true ? this.getViewport() : null;

    const rendered = this.render({ viewport });

    this.updateControls();

    if (rendered && options.refreshLive === true && this.isIntradayRange()) {
      this.liveController?.refresh();
    }

    return rendered;
  }

  /* ========================================================================
     Controls
     ======================================================================== */

  getRangeSelector() {
    return this.configuration.controls.rangeSelector || DEFAULT_RANGE_SELECTOR;
  }

  getModeSelector() {
    return this.configuration.controls.typeSelector || DEFAULT_MODE_SELECTOR;
  }

  bindControls() {
    this.controlsRoot?.addEventListener("click", this.handleControlClick, {
      signal: this.listenerController.signal,
    });
  }

  findEnabledControl(event, selector) {
    const button = event.target?.closest?.(selector);

    if (
      !button ||
      !this.controlsRoot?.contains(button) ||
      button.disabled ||
      button.getAttribute("aria-disabled") === "true"
    ) {
      return null;
    }

    return button;
  }

  handleControlClick(event) {
    const rangeButton = this.findEnabledControl(event, this.getRangeSelector());

    if (rangeButton) {
      event.preventDefault();

      this.setRange(
        rangeButton.dataset.chartRange || rangeButton.dataset.range,
        { resetViewport: true },
      );

      return;
    }

    const modeButton = this.findEnabledControl(event, this.getModeSelector());

    if (modeButton) {
      event.preventDefault();

      this.setMode(
        modeButton.dataset.chartType || modeButton.dataset.chartMode,
      );
    }
  }

  updateControls() {
    if (!this.controlsRoot) {
      return;
    }

    for (const button of this.controlsRoot.querySelectorAll(
      this.getRangeSelector(),
    )) {
      const range = normalizeMarketChartRange(
        button.dataset.chartRange || button.dataset.range,
      );

      syncToggleButton(
        button,
        range === this.currentRange,
        this.isRangeAvailable(range),
      );
    }

    for (const button of this.controlsRoot.querySelectorAll(
      this.getModeSelector(),
    )) {
      const mode = normalizeMarketChartMode(
        button.dataset.chartType || button.dataset.chartMode,
      );

      syncToggleButton(
        button,
        mode === this.currentMode,
        this.isModeAvailable(mode),
      );
    }
  }

  /* ========================================================================
     Live Data
     ======================================================================== */

  getLiveDataOptions() {
    return {
      maxPoints: this.configuration.maxPoints,
      bucketSize: this.configuration.candleBucketSize,
    };
  }

  ensureIntradayRecord() {
    const range = this.getIntradayRange();

    if (!this.ranges[range]) {
      this.ranges[range] = createEmptyMarketChartRangeRecord(
        this.configuration.previousClose,
      );

      this.refreshAvailableRanges();
      this.updateControls();
    }

    return this.ranges[range];
  }

  warnEvicted(evicted) {
    if (evicted > 0) {
      console.warn(
        `Market Chart (${this.configuration.symbol || "unknown"}): ` +
          `maxPoints (${this.configuration.maxPoints}) was exceeded and ` +
          `${evicted} point(s) were removed from the start of the intraday ` +
          "session. Increase maxPoints to keep the full session.",
      );
    }
  }

  dispatchLiveUpdate(detail) {
    dispatchChartEvent(this.element, "marketchartliveupdate", {
      range: this.getIntradayRange(),
      visibleRange: this.currentRange,
      controller: this,
      ...detail,
    });
  }

  /**
   * True when `items` belong to a different trading date than the record.
   */
  isSessionRollover(record, items) {
    const previous =
      record?.trend.at(-1)?.[0] ?? record?.candlestick.at(-1)?.[0];

    const incoming = items.at(-1)?.pricePoint[0];

    if (previous === undefined || incoming === undefined) {
      return false;
    }

    return (
      this.getTradingDateKey(previous) !== this.getTradingDateKey(incoming)
    );
  }

  /**
   * Live controller entry point.
   */
  applyLiveData(payload, metadata = {}) {
    if (this.destroyed) {
      return false;
    }

    const { items, previousClose } = normalizeMarketChartLivePayload(payload, {
      timeZone: this.configuration.timeZone,
    });

    return metadata.fullSnapshot === true
      ? this.applyLiveSnapshot(items, previousClose, metadata)
      : this.applyLiveIncrement(items, metadata);
  }

  /**
   * Authoritative full snapshot. An empty snapshot is valid: it means the
   * current session has no data and any cached intraday data is replaced.
   */
  applyLiveSnapshot(items, previousClose, metadata) {
    const range = this.getIntradayRange();

    const current = this.ranges[range] ?? null;

    const visible = this.currentRange === range;

    /*
     * Previous close priority: payload -> last close of the previous
     * session (on rollover) -> stored value -> configuration.
     */
    const comparisonValue =
      previousClose ??
      (this.isSessionRollover(current, items)
        ? current.trend.at(-1)?.[1]
        : current?.comparisonValue) ??
      toFiniteNumber(this.configuration.previousClose);

    const record = createMarketChartSnapshotRecord(items, {
      comparisonValue,
      ...this.getLiveDataOptions(),
    });

    this.warnEvicted(Math.max(0, items.length - this.configuration.maxPoints));

    this.ranges[range] = record;
    this.awaitingSnapshot = false;

    this.refreshAvailableRanges();

    /*
     * Full-session recovery never keeps an old intraday viewport.
     */
    this.resetLiveFollowing("full-snapshot");

    let chartChanged = false;

    if (visible) {
      this.currentMode = this.resolveAvailableMode(this.currentMode);

      chartChanged = this.render();
    }

    this.updateControls();

    this.dispatchLiveUpdate({
      point: items.at(-1)?.pricePoint ?? null,
      points: items.map(({ sourcePoint }) => sourcePoint),
      metadata,
      visible,
      fullSnapshot: true,
      genuinelyNewTimestamp: false,
      chartChanged,
    });

    return true;
  }

  applyLiveIncrement(items, metadata) {
    /*
     * Empty polling responses change nothing, and increments are ignored
     * while an authoritative snapshot is pending.
     */
    if (!items.length || this.awaitingSnapshot) {
      return false;
    }

    const record = this.ensureIntradayRecord();

    const visible = this.currentRange === this.getIntradayRange();

    /* Trading session rollover ------------------------------------------- */

    if (this.isSessionRollover(record, items)) {
      this.awaitingSnapshot = true;
      this.requestSnapshot("session-rollover");

      return false;
    }

    /* Canonical mutation ------------------------------------------------- */

    const hadVisibleData = visible && this.hasActiveData();

    const previousLatest = record.trend.at(-1)?.[0] ?? null;

    const availabilityMayChange =
      !record.trend.length || !record.candlestick.length;

    const { trendOperations, candleOperations, evicted } =
      applyMarketChartLiveItems(record, items, this.getLiveDataOptions());

    this.warnEvicted(evicted);

    if (
      !hasMarketChartChanges(trendOperations) &&
      !hasMarketChartChanges(candleOperations)
    ) {
      return false;
    }

    const currentLatest = record.trend.at(-1)?.[0] ?? null;

    const genuinelyNewTimestamp =
      previousLatest !== null &&
      currentLatest !== null &&
      currentLatest > previousLatest;

    if (availabilityMayChange) {
      this.updateControls();
    }

    /* Visible chart ------------------------------------------------------ */

    let chartChanged = false;

    if (visible && !hadVisibleData) {
      /*
       * First real data for an empty intraday chart: rebuild.
       */
      this.resetLiveFollowing("live-recovery");

      this.currentMode = this.resolveAvailableMode(this.currentMode);

      chartChanged = this.render();
    } else if (visible) {
      chartChanged = this.applyVisibleLiveOperations(
        trendOperations,
        candleOperations,
      );

      if (chartChanged) {
        if (genuinelyNewTimestamp && !this.userDetachedFromLive) {
          this.setFollowLatest(true, { source: "new-data" });
          this.applyLiveViewport(false);
        }

        /*
         * Exactly one redraw per live transaction.
         */
        this.chart.redraw(false);

        if (this.state !== "ready") {
          this.clearMessage();
          this.setState("ready");
        }
      }
    }

    this.dispatchLiveUpdate({
      point: items.at(-1).pricePoint,
      points: items.map(({ sourcePoint }) => sourcePoint),
      metadata,
      visible,
      fullSnapshot: false,
      genuinelyNewTimestamp,
      chartChanged,
    });

    return true;
  }

  /**
   * Hot path: incremental main + navigator updates, then recolor if the
   * direction changed. No redraw here.
   */
  applyVisibleLiveOperations(trendOperations, candleOperations) {
    const mainSeries = this.getMainSeries();

    if (!mainSeries) {
      return false;
    }

    const mainChanged = applySeriesOperations(
      mainSeries,
      this.currentMode === "candlestick" ? candleOperations : trendOperations,
      this.getActiveData(),
    );

    const navigatorData = this.getNavigatorData();

    let navigatorChanged = false;

    for (const series of this.getNavigatorSeriesList()) {
      navigatorChanged =
        applySeriesOperations(series, trendOperations, navigatorData) ||
        navigatorChanged;
    }

    if (!mainChanged && !navigatorChanged) {
      return false;
    }

    this.applyDirectionPresentation(this.getDirection());

    return true;
  }

  /**
   * Recolors main + navigator for a new market direction, using the theme
   * captured at render time (no option rebuild, no style recalculation).
   */
  applyDirectionPresentation(direction) {
    if (!this.chart || direction === this.presentationDirection) {
      return false;
    }

    const theme = this.theme ?? getMarketChartTheme(this.element);

    if (this.currentMode !== "candlestick") {
      applySeriesPresentation(
        this.getMainSeries(),
        getMarketChartSeriesTheme(
          this.Highcharts,
          theme,
          this.currentMode,
          direction,
        ),
      );
    }

    const navigatorTheme = getMarketChartNavigatorTheme(
      this.Highcharts,
      theme,
      direction,
    );

    for (const series of this.getNavigatorSeriesList()) {
      applySeriesPresentation(series, navigatorTheme);
    }

    this.presentationDirection = direction;
    this.element.dataset.chartDirection = direction;

    return true;
  }

  /* ========================================================================
     Live Controller
     ======================================================================== */

  initializeLiveUpdates() {
    const intradayRange = this.getIntradayRange();

    if (
      this.destroyed ||
      !this.hasLiveSource() ||
      !isMarketChartRangeSupported(intradayRange, this.capabilities)
    ) {
      return null;
    }

    const live = this.configuration.live;
    const environment = this.configuration.environment;

    this.liveController?.destroy();

    this.liveController = createMarketChartLiveController({
      interval: live.interval ?? DEFAULT_LIVE_INTERVAL,
      alignToInterval: live.alignToInterval ?? true,

      /*
       * Usually false: the initial snapshot is already loaded.
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
        ...environment,
      },

      fetchUpdates: (request) =>
        live.fetchUpdates({
          ...request,

          symbol: this.configuration.symbol,
          range: intradayRange,

          /*
           * The canonical live timeline is always trend / close.
           */
          mode: "trend",

          /*
           * Inclusive reconciliation boundary: the API may return a
           * correction for this timestamp and anything newer.
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
      this.startLive();
    }

    return this.liveController;
  }

  /* ========================================================================
     Live Polling API
     ======================================================================== */

  startLive() {
    const live = this.liveController;

    if (this.destroyed || !live?.start()) {
      return false;
    }

    this.syncLiveWithRange();

    if (!this.isIntradayRange()) {
      return true;
    }

    /*
     * An empty intraday chart (or one still waiting after a stop) needs a
     * full snapshot rather than an incremental poll.
     */
    if (this.awaitingSnapshot || !this.hasActiveData()) {
      this.awaitingSnapshot = true;
      this.requestSnapshot("live-start");
      this.syncDataState();
    }

    return true;
  }

  pauseLive(reason = "manual") {
    return this.destroyed
      ? false
      : (this.liveController?.pause(reason) ?? false);
  }

  resumeLiveUpdates(reason = "manual") {
    if (this.destroyed || !this.liveController) {
      return false;
    }

    /*
     * The historical-range pause is owned by range selection.
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
    return this.destroyed ? false : (this.liveController?.stop() ?? false);
  }

  /* ========================================================================
     Live Viewport API
     ======================================================================== */

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

  /**
   * @param {number|null|false} duration  null / false / 0 shows the
   *   complete session; a positive number follows a trailing window.
   */
  setLiveWindowDuration(duration, options = {}) {
    if (this.destroyed) {
      return false;
    }

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

  /* ========================================================================
     Trading Session Date
     ======================================================================== */

  getTradingDateKey(timestamp) {
    this.tradingDateFormatter ??= createDateTimeFormat(
      "en-CA",
      this.configuration.timeZone,
      { year: "numeric", month: "2-digit", day: "2-digit" },
      "en-CA",
    );

    /*
     * en-CA formats as YYYY-MM-DD.
     */
    return this.tradingDateFormatter.format(new Date(timestamp));
  }

  /* ========================================================================
     Resize / Theme
     ======================================================================== */

  isRenderable() {
    return Boolean(
      this.element.isConnected && this.element.getClientRects().length,
    );
  }

  requestFrame(callback) {
    return typeof this.window?.requestAnimationFrame === "function"
      ? this.window.requestAnimationFrame(callback)
      : (this.window?.setTimeout ?? globalThis.setTimeout)(callback, 16);
  }

  cancelFrame(frame) {
    if (frame === null) {
      return;
    }

    if (typeof this.window?.cancelAnimationFrame === "function") {
      this.window.cancelAnimationFrame(frame);
    } else {
      (this.window?.clearTimeout ?? globalThis.clearTimeout)(frame);
    }
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

  handleThemeMutation() {
    if (this.destroyed || this.themeFrame !== null) {
      return;
    }

    this.themeFrame = this.requestFrame(() => {
      this.themeFrame = null;
      this.refreshTheme();
    });
  }

  /**
   * Theme / direction-attribute changes rebuild with the current viewport.
   */
  refreshTheme() {
    if (this.destroyed || !this.chart) {
      return false;
    }

    return this.render({ viewport: this.getViewport() });
  }

  initializeObservers() {
    const ResizeObserverConstructor =
      this.window?.ResizeObserver ?? globalThis.ResizeObserver;

    if (typeof ResizeObserverConstructor === "function") {
      this.resizeObserver = new ResizeObserverConstructor(() =>
        this.scheduleReflow(),
      );

      this.resizeObserver.observe(this.element);
    } else {
      this.window?.addEventListener("resize", () => this.scheduleReflow(), {
        passive: true,
        signal: this.listenerController.signal,
      });
    }

    const MutationObserverConstructor =
      this.window?.MutationObserver ?? globalThis.MutationObserver;

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

  /* ========================================================================
     Initialization
     ======================================================================== */

  initialize() {
    if (this.destroyed || this.initialized) {
      return this;
    }

    this.initialized = true;

    this.currentMode = this.resolveAvailableMode(this.currentMode);

    this.resetLiveFollowing("initialize");

    this.bindControls();

    this.render();

    this.initializeLiveUpdates();

    this.initializeObservers();

    this.updateControls();

    dispatchChartEvent(this.element, "marketchartready", { controller: this });

    return this;
  }

  /* ========================================================================
     Public State
     ======================================================================== */

  getChart() {
    return this.chart;
  }

  getState() {
    const navigatorSeries =
      this.getNavigatorSeriesList().find(
        (series) => series.options?.id === NAVIGATOR_SERIES_ID,
      ) ?? null;

    return {
      state: this.state,
      destroyed: this.destroyed,
      initialized: this.initialized,
      renderable: this.isRenderable(),

      range: this.currentRange,
      mode: this.currentMode,
      direction: this.getDirection(),
      comparisonValue: this.getComparisonValue(),
      awaitingSnapshot: this.awaitingSnapshot,

      capabilities: { ...this.capabilities },

      /*
       * Stored ranges. The intraday range can also be selectable through
       * the live source before it appears here.
       */
      availableRanges: [...this.availableRanges],

      navigator: {
        enabled: Boolean(navigatorSeries),
        followLatest: this.followLatest,
        userDetachedFromLive: this.userDetachedFromLive,
        viewport: this.getViewport(),
        dataBounds: this.getRangeDomainBounds(),
        liveWindowDuration: this.liveViewportDuration,
        color: navigatorSeries?.color ?? null,
        pointCount: navigatorSeries?.data?.length ?? 0,
      },

      live: this.liveController?.getState() ?? null,
    };
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  destroy() {
    if (this.destroyed) {
      return false;
    }

    /*
     * Set first so asynchronous work stops immediately.
     */
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

    this.cancelFrame(this.resizeFrame);
    this.cancelFrame(this.themeFrame);
    this.resizeFrame = null;
    this.themeFrame = null;

    this.chart?.destroy();
    this.chart = null;
    this.theme = null;

    this.clearMessage();

    for (const attribute of [
      "data-chart-state",
      "data-chart-message",
      "data-chart-direction",
      "data-chart-live-state",
      "data-chart-follow-live",
    ]) {
      this.element.removeAttribute(attribute);
    }

    this.section?.removeAttribute("data-chart-live-state");
    this.section?.removeAttribute("data-chart-follow-live");
    this.section?.setAttribute("aria-busy", "false");

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
   Public Factory
   ========================================================================== */

function renderCreationError(element, message) {
  element.dataset.chartState = "error";
  element.dataset.chartMessage = message;

  removeMessages(element);

  element.append(createMessageElement(element.ownerDocument, "error", message));
}

/**
 * Creates (or replaces) the Market Chart on a host element.
 *
 * @param {Element|string} target  Element or selector.
 * @param {object} [configuration]
 * @returns {MarketChartController|null}
 */
export function createMarketChart(target, configuration = {}) {
  const source = isPlainObject(configuration) ? configuration : {};

  const element = resolveElement(
    target,
    source.document ?? globalThis.document,
  );

  if (!element) {
    console.error("Market Chart target could not be found.");

    return null;
  }

  const existing = chartRegistry.get(element);

  let controller = null;

  try {
    /*
     * Build and validate the replacement before destroying the current
     * owner.
     */
    controller = new MarketChartController(element, source);

    existing?.destroy();

    chartRegistry.set(element, controller);

    controller.initialize();

    return controller;
  } catch (error) {
    controller?.destroy();

    if (existing && !existing.destroyed) {
      chartRegistry.set(element, existing);
    } else {
      chartRegistry.delete(element);
    }

    const strings =
      controller?.strings ??
      getMarketChartStrings(
        source.language || element.ownerDocument.documentElement?.lang,
        asPlainObject(source.strings),
      );

    renderCreationError(element, source.errorMessage || strings.messages.error);

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

  return element ? (chartRegistry.get(element) ?? null) : null;
}

export function destroyMarketChart(target) {
  return getMarketChart(target)?.destroy() ?? false;
}

export function destroyAllMarketCharts() {
  const controllers = [...chartRegistry.values()];

  for (const controller of controllers) {
    controller.destroy();
  }

  chartRegistry.clear();

  return controllers.length;
}

export { MarketChartController };
