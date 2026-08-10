import {
  getAvailableMarketChartRanges,
  getFirstAvailableMarketChartRange,
  getMarketChartDirection,
  getMarketChartRangeComparisonValue,
  getMarketChartRangeData,
  isMarketChartIntradayRange,
  isMarketChartRangeSupported,
  mergeMarketChartLivePoint,
  normalizeMarketChartCapabilities,
  normalizeMarketChartData,
  normalizeMarketChartMode,
  normalizeMarketChartRange,
  normalizeMarketChartRanges,
  setMarketChartRangeData,
} from "./market-chart-data";

import { createMarketChartNavigatorController } from "./market-chart-navigator";

import { createMarketChartExportController } from "./market-chart-export";

import { createMarketChartLiveController } from "./market-chart-live";

import {
  createMarketChartOptions,
  normalizeMarketChartAnimation,
} from "./market-chart-options";

import {
  getMarketChartNavigatorTheme,
  getMarketChartSeriesTheme,
  getMarketChartTheme,
} from "./market-chart-theme";

/* ==========================================================================
   Registry
   ========================================================================== */

const chartRegistry = new Map();

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_MAX_POINTS = 1_000;

const DEFAULT_CANDLE_BUCKET_SIZE = 60_000;

const DEFAULT_RAPID_TRANSITION_THRESHOLD = 220;

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

  followLive: true,
  liveWindowDuration: null,

  controls: {},

  live: null,

  exporting: {},

  animation: true,

  accessibilityEnabled: true,

  accessibilityDescription: "",

  messages: DEFAULT_MESSAGES,

  /*
   * Backward-compatible aliases. Prefer `messages`.
   */
  loadingMessage: null,
  emptyMessage: null,
  errorMessage: null,
});

/* ==========================================================================
   Generic Helpers
   ========================================================================== */

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toPositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toPositiveNumber(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clonePoint(point) {
  return Array.isArray(point) ? [...point] : point;
}

function clonePoints(points) {
  return Array.isArray(points) ? points.map(clonePoint) : [];
}

function getPointTimestamp(point) {
  if (Array.isArray(point)) {
    return toFiniteNumber(point[0]);
  }

  if (point && typeof point === "object") {
    return toFiniteNumber(point.x ?? point.timestamp ?? point.time);
  }

  return null;
}

function getPointValue(point, mode = "trend") {
  if (!Array.isArray(point)) {
    return null;
  }

  return normalizeMarketChartMode(mode) === "candlestick"
    ? toFiniteNumber(point[4])
    : toFiniteNumber(point[1]);
}

function resolveLocalizedMessage(value, language, fallback) {
  if (typeof value === "string") {
    return value;
  }

  if (!isPlainObject(value)) {
    return fallback;
  }

  const normalizedLanguage = String(language || "en").trim();

  const baseLanguage = normalizedLanguage.split("-")[0];

  const resolved =
    value[normalizedLanguage] ??
    value[baseLanguage] ??
    value.default ??
    value.en ??
    fallback;

  return typeof resolved === "string" ? resolved : fallback;
}

function normalizeMessages(configuration, language) {
  const messages = isPlainObject(configuration.messages)
    ? configuration.messages
    : {};

  return {
    loading: resolveLocalizedMessage(
      configuration.loadingMessage ?? messages.loading,
      language,
      DEFAULT_MESSAGES.loading,
    ),

    empty: resolveLocalizedMessage(
      configuration.emptyMessage ?? messages.empty,
      language,
      DEFAULT_MESSAGES.empty,
    ),

    error: resolveLocalizedMessage(
      configuration.errorMessage ?? messages.error,
      language,
      DEFAULT_MESSAGES.error,
    ),
  };
}

/* ==========================================================================
   Environment Helpers
   ========================================================================== */

function resolveDocument(element = null) {
  return element?.ownerDocument || globalThis.document || null;
}

function resolveWindow(element = null) {
  return resolveDocument(element)?.defaultView || globalThis.window || null;
}

function isElement(value, document = null) {
  const view =
    document?.defaultView ||
    value?.ownerDocument?.defaultView ||
    globalThis.window;

  if (typeof view?.Element === "function") {
    return value instanceof view.Element;
  }

  return Boolean(
    value && value.nodeType === 1 && typeof value.querySelector === "function",
  );
}

/* ==========================================================================
   Animation
   ========================================================================== */

function getChartAnimation(configuredAnimation = true, element = null) {
  const document = resolveDocument(element);

  const window = resolveWindow(element);

  const reducedMotion =
    window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ||
    document?.documentElement?.dataset?.motion === "reduce";

  if (reducedMotion) {
    return false;
  }

  return configuredAnimation;
}

function getAnimationTargets(chart) {
  const targets = new Set();

  const add = (candidate) => {
    const target = candidate?.element || candidate;

    if (target) {
      targets.add(target);
    }
  };

  add(chart?.container);

  chart?.series?.forEach((series) => {
    add(series.group);
    add(series.graph);
    add(series.area);
    add(series.markerGroup);
  });

  chart?.xAxis?.forEach((axis) => {
    add(axis.axisGroup);
    add(axis.gridGroup);
    add(axis.labelGroup);
  });

  chart?.yAxis?.forEach((axis) => {
    add(axis.axisGroup);
    add(axis.gridGroup);
    add(axis.labelGroup);
  });

  return [...targets];
}

export function createMarketChartTransitionCoordinator(configuration = {}) {
  const Highcharts = configuration.Highcharts || null;

  const now =
    typeof configuration.now === "function"
      ? configuration.now
      : () => globalThis.performance?.now?.() ?? Date.now();

  const rapidThreshold = toPositiveNumber(
    configuration.rapidThreshold,
    DEFAULT_RAPID_TRANSITION_THRESHOLD,
  );

  let revision = 0;

  let lastStartedAt = -Infinity;

  return {
    begin(chart, options = {}) {
      const startedAt = now();

      const rapid = startedAt - lastStartedAt < rapidThreshold;

      lastStartedAt = startedAt;

      revision += 1;

      if (typeof Highcharts?.stop === "function") {
        getAnimationTargets(chart).forEach((target) => {
          try {
            Highcharts.stop(target);
          } catch {
            /*
             * A stale SVG wrapper must not
             * block the next transaction.
             */
          }
        });
      }

      return Object.freeze({
        revision,
        rapid,

        animation: rapid ? false : options.animation,
      });
    },

    isCurrent(transaction) {
      return Boolean(transaction && transaction.revision === revision);
    },

    invalidate() {
      revision += 1;

      return revision;
    },

    getRevision() {
      return revision;
    },
  };
}

/* ==========================================================================
   Resolution
   ========================================================================== */

function resolveLanguage(language, document = globalThis.document) {
  return language || document?.documentElement?.lang || "en";
}

function resolveHighcharts(configuration, window) {
  return configuration.Highcharts || window?.Highcharts || null;
}

function resolveElement(target, document = globalThis.document) {
  if (isElement(target, document)) {
    return target;
  }

  if (typeof target === "string" && document) {
    return document.querySelector(target);
  }

  return null;
}

function resolveControlsRoot(element, controls, document) {
  if (isElement(controls?.root, document)) {
    return controls.root;
  }

  if (typeof controls?.root === "string") {
    return (
      element.closest(controls.root) ||
      document?.querySelector(controls.root) ||
      null
    );
  }

  return (
    element.closest("[data-performance-chart]") ||
    element.closest(".performance-chart") ||
    element.closest("[data-market-chart-root]") ||
    element.parentElement ||
    element
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

  const normalized = {
    ...DEFAULT_CONFIGURATION,
    ...source,
  };

  normalized.capabilities = normalizeMarketChartCapabilities(
    source.capabilities,
  );

  /*
   * Supplying live configuration enables the
   * live capability unless explicitly disabled.
   */
  if (source.live && source.capabilities?.live === undefined) {
    normalized.capabilities.live = source.live.enabled !== false;
  }

  normalized.mode = normalizeMarketChartMode(normalized.mode);

  normalized.range = normalizeMarketChartRange(normalized.range);

  normalized.language = resolveLanguage(normalized.language, document);

  normalized.messages = normalizeMessages(source, normalized.language);

  /*
   * Retain aliases for existing integrations.
   */
  normalized.loadingMessage = normalized.messages.loading;

  normalized.emptyMessage = normalized.messages.empty;

  normalized.errorMessage = normalized.messages.error;

  normalized.maxPoints = toPositiveInteger(
    normalized.maxPoints,
    DEFAULT_MAX_POINTS,
  );

  normalized.candleBucketSize = toPositiveInteger(
    normalized.candleBucketSize,
    DEFAULT_CANDLE_BUCKET_SIZE,
  );

  normalized.liveWindowDuration = toPositiveNumber(
    normalized.liveWindowDuration ?? normalized.navigator?.liveWindowDuration,
    null,
  );

  normalized.axis = isPlainObject(normalized.axis) ? normalized.axis : {};

  normalized.xAxis = isPlainObject(normalized.xAxis) ? normalized.xAxis : {};

  normalized.yAxis = isPlainObject(normalized.yAxis) ? normalized.yAxis : {};

  normalized.tooltip = isPlainObject(normalized.tooltip)
    ? normalized.tooltip
    : {};

  normalized.controls = isPlainObject(normalized.controls)
    ? normalized.controls
    : {};

  normalized.navigator = isPlainObject(normalized.navigator)
    ? normalized.navigator
    : {};

  normalized.exporting = isPlainObject(normalized.exporting)
    ? normalized.exporting
    : {};

  normalized.live = isPlainObject(normalized.live)
    ? normalized.live
    : normalized.live;

  return normalized;
}

/* ==========================================================================
   Event Helper
   ========================================================================== */

function dispatchChartEvent(element, name, detail = {}) {
  const document = element?.ownerDocument || globalThis.document;

  const EventConstructor =
    document?.defaultView?.CustomEvent || globalThis.CustomEvent;

  if (
    !element ||
    typeof element.dispatchEvent !== "function" ||
    typeof EventConstructor !== "function"
  ) {
    return false;
  }

  element.dispatchEvent(
    new EventConstructor(name, {
      bubbles: true,
      detail,
    }),
  );

  return true;
}

/* ==========================================================================
   Market Chart Controller
   ========================================================================== */

class MarketChartController {
  constructor(element, configuration = {}) {
    const document = resolveDocument(element);

    if (!isElement(element, document)) {
      throw new TypeError(
        "MarketChartController requires a valid chart element.",
      );
    }

    this.element = element;

    this.document = document;

    this.window = resolveWindow(element);

    if (!this.document || !this.window) {
      throw new TypeError(
        "MarketChartController requires a browser document and window.",
      );
    }

    this.configuration = normalizeConfiguration(configuration, this.document);

    this.Highcharts = resolveHighcharts(this.configuration, this.window);

    if (!this.Highcharts || typeof this.Highcharts.stockChart !== "function") {
      throw new TypeError("Market Chart requires Highstock with stockChart().");
    }

    this.capabilities = this.configuration.capabilities;

    this.controlsRoot = resolveControlsRoot(
      this.element,
      this.configuration.controls,
      this.document,
    );
    this.section =
      this.element.closest("[data-performance-chart]") ||
      this.element.closest(".performance-chart") ||
      this.controlsRoot;

    this.baseData = normalizeMarketChartData(
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
     * A chart may use one direct dataset
     * instead of named ranges.
     */
    if (!this.availableRanges.length && this.baseData.length) {
      const fallbackRange = normalizeMarketChartRange(this.configuration.range);

      this.ranges[fallbackRange] = {
        comparisonValue: this.configuration.previousClose,

        trend:
          this.configuration.mode === "candlestick"
            ? []
            : clonePoints(this.baseData),

        line:
          this.configuration.mode === "candlestick"
            ? []
            : clonePoints(this.baseData),

        candlestick:
          this.configuration.mode === "candlestick"
            ? clonePoints(this.baseData)
            : [],
      };

      this.availableRanges = [fallbackRange];
    }

    this.currentRange =
      getFirstAvailableMarketChartRange(
        this.ranges,
        this.configuration.range,
        this.capabilities,
      ) || normalizeMarketChartRange(this.configuration.range);

    this.currentMode = normalizeMarketChartMode(this.configuration.mode);

    this.chart = null;

    this.navigatorController = null;
    this.liveController = null;
    this.exportController = null;

    this.resizeObserver = null;
    this.themeObserver = null;

    const AbortControllerConstructor =
      this.window.AbortController || globalThis.AbortController;

    if (typeof AbortControllerConstructor !== "function") {
      throw new TypeError("Market Chart requires AbortController.");
    }

    this.listenerController = new AbortControllerConstructor();

    this.destroyed = false;
    this.initialized = false;
    this.rendering = false;

    this.transitions = createMarketChartTransitionCoordinator({
      Highcharts: this.Highcharts,

      rapidThreshold: this.configuration.transition?.rapidThreshold,

      now: this.configuration.transition?.now,
    });

    this.state = "idle";

    this.themeFrame = null;
    this.resizeFrame = null;

    this.handleRangeClick = this.handleRangeClick.bind(this);

    this.handleModeClick = this.handleModeClick.bind(this);

    this.handleWindowResize = this.handleWindowResize.bind(this);

    this.handleThemeMutation = this.handleThemeMutation.bind(this);
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

    if (this.section) {
      /*
       * Live refreshes must not reopen the
       * complete loading state.
       */
      this.section.setAttribute(
        "aria-busy",
        state === "loading" ? "true" : "false",
      );
    }

    if (message) {
      this.element.dataset.chartMessage = message;
    } else {
      delete this.element.dataset.chartMessage;
    }

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

    const normalizedState =
      typeof state === "string" ? state : state?.state || "idle";

    this.element.dataset.chartLiveState = normalizedState;

    this.section?.setAttribute("data-chart-live-state", normalizedState);

    const status = this.controlsRoot?.querySelector("[data-chart-live-status]");

    if (status) {
      status.dataset.liveState = normalizedState;
    }

    dispatchChartEvent(this.element, "marketchartlivestatechange", {
      state: normalizedState,

      detail: typeof state === "object" ? state : null,

      controller: this,
    });

    return true;
  }

  /* ========================================================================
     Messages
     ======================================================================== */

  clearMessage() {
    this.element
      .querySelectorAll(":scope > .market-chart__message")
      .forEach((message) => {
        message.remove();
      });
  }

  renderMessage(state, message) {
    this.clearMessage();

    if (!message) {
      return null;
    }

    const wrapper = this.document.createElement("div");

    wrapper.className = [
      "market-chart__message",
      `market-chart__message--${state}`,
    ].join(" ");

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

    return wrapper;
  }

  showStateMessage(state) {
    const message = this.configuration.messages?.[state] || "";

    this.setState(state, message);

    this.renderMessage(state, message);

    return message;
  }

  /* ========================================================================
     Range Information
     ======================================================================== */

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

  isIntradayRange(range = this.currentRange) {
    return isMarketChartIntradayRange(range, this.capabilities);
  }

  getIntradayRange() {
    return this.capabilities.intradayRange;
  }

  getRangeRecord(range = this.currentRange) {
    return this.ranges[normalizeMarketChartRange(range)] || null;
  }

  /* ========================================================================
     Data Resolution
     ======================================================================== */

  getRangeData(range = this.currentRange, mode = this.currentMode) {
    return getMarketChartRangeData(this.ranges, range, mode);
  }

  getActiveData() {
    return this.getRangeData(this.currentRange, this.currentMode);
  }

  hasActiveData() {
    return this.getActiveData().length > 0;
  }

  getNavigatorData(range = this.currentRange) {
    const record = this.getRangeRecord(range);

    if (!record) {
      return [];
    }

    /*
     * Navigator always uses
     * [timestamp, value], never OHLC geometry.
     */
    const trend = normalizeMarketChartData(record.trend, "trend");

    if (trend.length) {
      return trend;
    }

    const line = normalizeMarketChartData(record.line, "line");

    if (line.length) {
      return line;
    }

    const candles = normalizeMarketChartData(record.candlestick, "candlestick");

    return candles.map((point) => [point[0], point[4]]);
  }

  getComparisonValue(range = this.currentRange) {
    const normalizedRange = normalizeMarketChartRange(range);

    /*
     * The global previous close is valid only
     * for the configured intraday range.
     */
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
    return getMarketChartDirection(
      this.getRangeData(range, mode),
      mode,
      this.getComparisonValue(range),
    );
  }

  /* ========================================================================
     Mode Availability
     ======================================================================== */

  isModeAvailable(mode, range = this.currentRange) {
    const normalizedMode = normalizeMarketChartMode(mode);

    return this.getRangeData(range, normalizedMode).length > 0;
  }

  getModeAvailability(range = this.currentRange) {
    return new Map(
      MARKET_CHART_MODES.map((mode) => [
        mode,
        this.isModeAvailable(mode, range),
      ]),
    );
  }

  hasModeAvailabilityChanged(previousAvailability, range = this.currentRange) {
    return MARKET_CHART_MODES.some(
      (mode) =>
        previousAvailability.get(mode) !== this.isModeAvailable(mode, range),
    );
  }

  resolveAvailableMode(preferredMode, range = this.currentRange) {
    const normalizedPreferred = normalizeMarketChartMode(preferredMode);

    if (this.isModeAvailable(normalizedPreferred, range)) {
      return normalizedPreferred;
    }

    return (
      MARKET_CHART_MODES.find((mode) => this.isModeAvailable(mode, range)) ||
      normalizedPreferred
    );
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  initialize() {
    if (this.destroyed || this.initialized) {
      return this;
    }

    this.initialized = true;

    this.showStateMessage("loading");

    try {
      this.currentMode = this.resolveAvailableMode(
        this.currentMode,
        this.currentRange,
      );

      this.bindControls();

      this.renderInitialChart();

      this.initializeNavigator();

      this.initializeLiveUpdates();

      this.initializeExport();

      this.initializeObservers();

      this.updateControls();

      this.updateLastUpdated(this.getLatestTimestamp());

      if (this.hasActiveData()) {
        this.clearMessage();

        this.setState("ready");
      } else {
        this.showStateMessage("empty");
      }

      dispatchChartEvent(this.element, "marketchartready", {
        controller: this,
      });

      return this;
    } catch (error) {
      /*
       * Leave cleanup to the factory so every
       * partially initialized subsystem is
       * destroyed consistently.
       */
      throw error;
    }
  }

  getLatestTimestamp(range = this.currentRange, mode = this.currentMode) {
    const data = this.getRangeData(range, mode);

    if (!data.length) {
      return null;
    }

    return getPointTimestamp(data[data.length - 1]);
  }

  /* ========================================================================
     Chart Options
     ======================================================================== */

  createOptions(data = this.getActiveData()) {
    const hasData = Array.isArray(data) && data.length > 0;

    const comparisonValue = this.getComparisonValue(this.currentRange);

    const direction = getMarketChartDirection(
      data,
      this.currentMode,
      comparisonValue,
    );

    return createMarketChartOptions({
      Highcharts: this.Highcharts,

      element: this.element,

      context: this.configuration.context,

      capabilities: this.capabilities,

      mode: this.currentMode,

      range: this.currentRange,

      direction,

      symbol: this.configuration.symbol,

      seriesName:
        this.configuration.name || this.configuration.symbol || "Market",

      currency: this.configuration.currency,

      /*
       * Tooltip change and semantic direction
       * share the exact comparison baseline.
       */
      previousClose: comparisonValue,

      data,

      navigatorData: this.getNavigatorData(this.currentRange),

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

      /*
       * Empty chart chrome is intentionally
       * disabled until valid data exists.
       */
      navigatorEnabled:
        hasData && this.configuration.navigatorEnabled !== false,

      navigator: this.configuration.navigator,

      exporting: this.configuration.exporting,

      animation: getChartAnimation(this.configuration.animation, this.element),

      accessibilityEnabled: this.configuration.accessibilityEnabled,

      accessibilityDescription:
        this.configuration.accessibilityDescription ||
        (this.configuration.name
          ? `${this.configuration.name} market performance over time.`
          : "Market performance over time."),
    });
  }

  /* ========================================================================
     Initial Rendering
     ======================================================================== */

  renderInitialChart() {
    if (this.destroyed || this.chart) {
      return this.chart;
    }

    const data = this.getActiveData();

    const options = this.createOptions(data);

    this.clearMessage();

    this.chart = this.Highcharts.stockChart(this.element, options);

    if (!this.chart) {
      throw new Error("Highstock did not create the Market Chart.");
    }

    return this.chart;
  }

  /* ========================================================================
     Series Resolution
     ======================================================================== */

  getMainSeries() {
    if (!this.chart?.series?.length) {
      return null;
    }

    const expectedID = `market-chart-${String(
      this.configuration.symbol || "series",
    ).toLowerCase()}`;

    return (
      this.chart.get(expectedID) ||
      this.chart.series.find(
        (series) =>
          !series.options?.isInternal &&
          series.options?.id !== "market-chart-navigator-series",
      ) ||
      null
    );
  }

  getNavigatorSeries() {
    const navigatorSeries = this.chart?.navigator?.series;

    if (!Array.isArray(navigatorSeries) || !navigatorSeries.length) {
      return null;
    }

    return (
      navigatorSeries.find(
        (series) => series.options?.id === "market-chart-navigator-series",
      ) ||
      navigatorSeries[0] ||
      null
    );
  }

  /* ========================================================================
     Navigator Controller
     ======================================================================== */

  shouldEnableNavigator(range = this.currentRange) {
    return Boolean(
      this.capabilities.navigator !== false &&
      this.configuration.navigatorEnabled !== false &&
      this.getNavigatorData(range).length,
    );
  }

  initializeNavigator() {
    if (this.destroyed || !this.chart || !this.shouldEnableNavigator()) {
      return null;
    }

    this.navigatorController?.destroy();

    this.navigatorController = createMarketChartNavigatorController({
      Highcharts: this.Highcharts,

      chart: this.chart,

      range: this.currentRange,

      data: this.getNavigatorData(this.currentRange),

      enabled: true,

      followLatest: this.isIntradayRange(),

      liveWindowDuration: this.configuration.liveWindowDuration,

      edgeToleranceRatio: this.configuration.navigator?.edgeToleranceRatio,

      edgeToleranceMinimum: this.configuration.navigator?.edgeToleranceMinimum,

      onViewportChange: (detail) => {
        /*
         * Viewport changes are not named
         * range changes.
         */
        dispatchChartEvent(this.element, "marketchartviewportchange", {
          ...detail,
          controller: this,
        });
      },

      onFollowChange: (detail) => {
        dispatchChartEvent(this.element, "marketchartfollowchange", {
          ...detail,
          controller: this,
        });
      },
    });

    return this.navigatorController;
  }

  synchronizeNavigatorController(enabled) {
    if (!enabled) {
      this.navigatorController?.destroy();

      this.navigatorController = null;

      return null;
    }

    if (!this.navigatorController) {
      return this.initializeNavigator();
    }

    return this.navigatorController;
  }

  /* ========================================================================
     Chart Updating
     ======================================================================== */

  updateChart(options = {}) {
    if (this.destroyed || !this.chart || this.rendering) {
      return false;
    }

    this.rendering = true;

    const redraw = options.redraw !== false;

    try {
      const data = this.getActiveData();

      const navigatorData = this.getNavigatorData(this.currentRange);

      const chartOptions = this.createOptions(data);

      const transaction = options.transaction || null;

      if (transaction && !this.transitions.isCurrent(transaction)) {
        return false;
      }

      const animation =
        options.animation ??
        transaction?.animation ??
        chartOptions.chart.animation;

      const mainSeries = this.getMainSeries();

      if (!mainSeries) {
        throw new Error("Market Chart main series is unavailable.");
      }

      /*
       * Preserve the existing Highstock chart
       * while updating its presentation.
       */
      this.chart.update(
        {
          chart: chartOptions.chart,

          time: chartOptions.time,

          lang: chartOptions.lang,

          xAxis: chartOptions.xAxis,

          yAxis: chartOptions.yAxis,

          tooltip: chartOptions.tooltip,

          plotOptions: chartOptions.plotOptions,

          navigator: chartOptions.navigator,

          scrollbar: chartOptions.scrollbar,

          exporting: chartOptions.exporting,

          accessibility: chartOptions.accessibility,

          responsive: chartOptions.responsive,
        },
        false,
        false,
        animation,
      );

      const navigatorEnabled = chartOptions.navigator?.enabled === true;

      this.synchronizeNavigatorController(navigatorEnabled);

      const { data: ignoredData, ...seriesOptions } = chartOptions.series[0];

      mainSeries.update(seriesOptions, false);

      mainSeries.setData(data, false, false, false);

      const navigatorSeries = this.getNavigatorSeries();

      if (navigatorEnabled && navigatorSeries) {
        navigatorSeries.setData(navigatorData, false, false, false);
      }

      if (navigatorEnabled && this.navigatorController) {
        this.navigatorController.activateRange(
          this.currentRange,
          navigatorData,
          {
            preserveViewport: options.preserveViewport !== false,

            resetViewport: options.resetViewport === true,

            followLatest: this.isIntradayRange(),

            liveWindowDuration: this.configuration.liveWindowDuration,

            redraw: false,
            animation: false,
            notify: false,

            source: options.source || "chart",
          },
        );
      }

      this.synchronizeSeriesTheme(data, false);

      if (redraw) {
        this.chart.redraw(animation);
      }

      if (data.length) {
        this.clearMessage();

        this.setState("ready");
      } else {
        this.showStateMessage("empty");
      }

      return true;
    } catch (error) {
      this.showStateMessage("error");

      console.error("Market Chart update failed.", error);

      dispatchChartEvent(this.element, "marketcharterror", {
        error,
        controller: this,
      });

      return false;
    } finally {
      this.rendering = false;
    }
  }

  /* ========================================================================
     Range Selection
     ======================================================================== */
  setRange(range, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeMarketChartRange(range);

    if (
      !isMarketChartRangeSupported(normalizedRange, this.capabilities) ||
      !this.hasRange(normalizedRange)
    ) {
      console.warn(`Market Chart range "${normalizedRange}" is unavailable.`);

      return false;
    }

    const previousRange = this.currentRange;

    const previousMode = this.currentMode;

    const transaction = this.transitions.begin(this.chart, {
      animation: options.animation,
    });

    if (normalizedRange === previousRange && options.force !== true) {
      /*
       * Re-selecting the active range may
       * reset only that range's viewport.
       */
      if (options.resetViewport === true) {
        if (this.isIntradayRange(normalizedRange)) {
          this.resumeLive({
            range: normalizedRange,

            redraw: true,
            animation: false,
            notify: true,
          });
        } else {
          this.navigatorController?.resetToFullRange({
            range: normalizedRange,

            followLatest: false,

            redraw: true,
            animation: false,
            notify: true,
          });
        }
      }

      return true;
    }

    this.currentRange = normalizedRange;

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      normalizedRange,
    );

    const updated = this.updateChart({
      source: "range",

      preserveViewport: options.preserveViewport !== false,

      resetViewport: options.resetViewport === true,

      redraw: options.redraw !== false,

      animation: transaction.animation,

      transaction,
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

  /* ========================================================================
     Mode Selection
     ======================================================================== */

  setMode(mode, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedMode = normalizeMarketChartMode(mode);

    if (!this.isModeAvailable(normalizedMode, this.currentRange)) {
      console.warn(
        `Market Chart mode "${normalizedMode}" is unavailable for range "${this.currentRange}".`,
      );

      return false;
    }

    if (normalizedMode === this.currentMode && options.force !== true) {
      return true;
    }

    const previousMode = this.currentMode;

    const crossesCandlestickBoundary =
      previousMode === "candlestick" || normalizedMode === "candlestick";

    const transaction = this.transitions.begin(this.chart, {
      animation: crossesCandlestickBoundary ? false : options.animation,
    });

    this.currentMode = normalizedMode;

    const updated = this.updateChart({
      source: "mode",

      preserveViewport: true,

      redraw: options.redraw !== false,

      animation: transaction.animation,

      transaction,
    });

    if (!updated) {
      this.currentMode = previousMode;

      return false;
    }

    this.updateControls();

    dispatchChartEvent(this.element, "marketchartmodechange", {
      mode: this.currentMode,

      previousMode,

      range: this.currentRange,

      controller: this,
    });

    return true;
  }

  /* ========================================================================
     Live Viewport
     ======================================================================== */

  resumeLive(options = {}) {
    if (this.destroyed || !this.navigatorController) {
      return false;
    }

    return this.navigatorController.followLatest({
      range: options.range ?? this.getIntradayRange(),

      liveWindowDuration:
        options.liveWindowDuration ?? this.configuration.liveWindowDuration,

      redraw: options.redraw !== false,

      animation: options.animation ?? false,

      notify: options.notify !== false,
    });
  }

  pauseLiveFollowing(options = {}) {
    if (this.destroyed || !this.navigatorController) {
      return false;
    }

    return this.navigatorController.stopFollowing({
      range: options.range ?? this.getIntradayRange(),

      userControlled: options.userControlled !== false,

      source: options.source || "programmatic",

      trigger: options.trigger || "manual",
    });
  }

  setLiveWindowDuration(duration, options = {}) {
    const normalizedDuration = toPositiveNumber(duration, null);

    if (this.destroyed || normalizedDuration === null) {
      return false;
    }

    this.configuration.liveWindowDuration = normalizedDuration;

    return (
      this.navigatorController?.setLiveWindowDuration(normalizedDuration, {
        range: options.range ?? this.getIntradayRange(),

        apply: options.apply !== false,

        redraw: options.redraw !== false,

        animation: options.animation ?? false,

        notify: options.notify !== false,
      }) ?? true
    );
  }

  /* ========================================================================
     Range Data Updates
     ======================================================================== */

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

    if (normalizedRange !== this.currentRange) {
      /*
       * Store inactive range data without
       * changing the visible chart.
       */
      this.navigatorController?.updateData(
        this.getNavigatorData(normalizedRange),
        {
          range: normalizedRange,

          live: options.live === true,

          redraw: false,
          notify: false,
        },
      );

      return true;
    }

    return this.updateChart({
      source: options.live ? "live-data" : "data",

      preserveViewport: options.preserveViewport !== false,

      redraw: options.redraw !== false,

      animation: options.animation,
    });
  }

  setRanges(ranges, options = {}) {
    if (this.destroyed || !isPlainObject(ranges)) {
      return false;
    }

    const normalizedRanges = normalizeMarketChartRanges(ranges, {
      capabilities: this.capabilities,
    });

    this.ranges =
      options.merge === true
        ? {
            ...this.ranges,
            ...normalizedRanges,
          }
        : normalizedRanges;

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

      this.showStateMessage("empty");

      return true;
    }

    this.currentMode = this.resolveAvailableMode(
      this.currentMode,
      this.currentRange,
    );

    this.updateControls();

    return this.updateChart({
      source: "ranges",

      preserveViewport: options.preserveViewport === true,

      resetViewport: options.preserveViewport !== true,

      redraw: options.redraw !== false,

      animation: options.animation,
    });
  }

  /* ========================================================================
     Controls
     ======================================================================== */

  bindControls() {
    if (!this.controlsRoot || this.destroyed) {
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

    if (!button || !this.controlsRoot.contains(button)) {
      return;
    }

    event.preventDefault();

    if (button.disabled || button.getAttribute("aria-disabled") === "true") {
      return;
    }

    const range = button.dataset.chartRange || button.dataset.range;

    /*
     * Toolbar buttons are the only named-range
     * selection source.
     */
    this.setRange(range, {
      preserveViewport: true,
    });
  }

  handleModeClick(event) {
    const selector =
      this.configuration.controls?.typeSelector ||
      "[data-chart-type], [data-chart-mode]";

    const button = event.target?.closest?.(selector);

    if (!button || !this.controlsRoot.contains(button)) {
      return;
    }

    event.preventDefault();

    if (button.disabled || button.getAttribute("aria-disabled") === "true") {
      return;
    }

    const mode = button.dataset.chartType || button.dataset.chartMode;

    this.setMode(mode);
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

      const available = this.isModeAvailable(mode, this.currentRange);

      button.classList.toggle("is-active", active);

      button.setAttribute("aria-pressed", active ? "true" : "false");

      button.disabled = !available;

      button.setAttribute("aria-disabled", available ? "false" : "true");
    });
  }

  /* ========================================================================
     Direction and Theme
     ======================================================================== */

  synchronizeSeriesTheme(data = this.getActiveData(), redraw = true) {
    if (this.destroyed || !this.chart) {
      return false;
    }

    /*
     * This is the single direction calculation
     * used by the main series, navigator, CSS
     * state, and tooltip comparison.
     */
    const direction = getMarketChartDirection(
      data,
      this.currentMode,
      this.getComparisonValue(this.currentRange),
    );

    const directionChanged = this.element.dataset.chartDirection !== direction;

    this.element.dataset.chartDirection = direction;

    const theme = getMarketChartTheme(this.element);

    const mainTheme = getMarketChartSeriesTheme(
      this.Highcharts,
      theme,
      this.currentMode,
      direction,
    );

    const mainSeries = this.getMainSeries();

    mainSeries?.update(mainTheme, false);

    const navigatorConfiguration = this.configuration.navigator || {};

    /*
     * Navigator uses its dedicated subdued
     * theme, never the main area theme.
     */
    const navigatorTheme = getMarketChartNavigatorTheme(
      this.Highcharts,
      theme,
      direction,
      {
        lineWidth: navigatorConfiguration.lineWidth ?? 1.25,

        lineOpacity: navigatorConfiguration.lineOpacity,

        maskOpacity: navigatorConfiguration.maskOpacity,

        fillStartOpacity: navigatorConfiguration.fillStartOpacity,

        fillEndOpacity: navigatorConfiguration.fillEndOpacity,

        outlineOpacity: navigatorConfiguration.outlineOpacity,

        handleBorderOpacity: navigatorConfiguration.handleBorderOpacity,

        handleBackground: navigatorConfiguration.handleBackground,
      },
    );

    const navigatorSeries = this.getNavigatorSeries();

    if (navigatorSeries) {
      navigatorSeries.update(
        {
          color: navigatorTheme.color,

          lineColor: navigatorTheme.lineColor || navigatorTheme.color,

          fillColor: navigatorTheme.fillColor,

          lineWidth: navigatorTheme.lineWidth,
        },
        false,
      );
    }

    /*
     * Navigator chrome only needs a chart-level
     * update when direction crosses its
     * comparison baseline.
     */
    if (directionChanged && this.chart.navigator) {
      const outlineWidth = navigatorConfiguration.outlineWidth ?? 0;

      this.chart.update(
        {
          navigator: {
            maskFill: navigatorTheme.maskFill,

            outlineWidth,

            outlineColor:
              outlineWidth > 0 ? navigatorTheme.outlineColor : "transparent",

            handles: {
              backgroundColor: navigatorTheme.handles.backgroundColor,

              borderColor: navigatorTheme.handles.borderColor,

              lineColor: navigatorTheme.handles.borderColor,
            },
          },
        },
        false,
        false,
        false,
      );
    }

    if (redraw) {
      this.chart.redraw(
        getChartAnimation(this.configuration.animation, this.element),
      );
    }

    return true;
  }

  /* ========================================================================
     Live Point Normalization
     ======================================================================== */
  normalizeLivePricePoint(point) {
    if (Array.isArray(point)) {
      const timestamp = toFiniteNumber(point[0]);

      const value =
        point.length >= 5 ? toFiniteNumber(point[4]) : toFiniteNumber(point[1]);

      if (timestamp === null || value === null) {
        return null;
      }

      return [timestamp, value];
    }

    if (!point || typeof point !== "object") {
      return null;
    }

    const timestamp = toFiniteNumber(point.x ?? point.timestamp ?? point.time);

    const value = toFiniteNumber(
      point.price ??
        point.value ??
        point.y ??
        point.close ??
        point.closePrice ??
        point.indexPrice ??
        point.lastPrice,
    );

    if (timestamp === null || value === null) {
      return null;
    }

    return [timestamp, value];
  }

  /* ========================================================================
     Live Storage
     ======================================================================== */

  mergeLivePointIntoIntraday(incomingPoint) {
    const intradayRange = this.getIntradayRange();

    let record = this.getRangeRecord(intradayRange);

    if (!record) {
      record = {
        /*
         * Preserve direction semantics when
         * live data creates an empty range.
         */
        comparisonValue: this.configuration.previousClose,

        trend: [],
        line: [],
        candlestick: [],
      };

      this.ranges[intradayRange] = record;

      this.refreshAvailableRanges();
    }

    const pricePoint = this.normalizeLivePricePoint(incomingPoint);

    if (!pricePoint) {
      return null;
    }

    const trendResult = mergeMarketChartLivePoint(record.trend, pricePoint, {
      mode: "trend",

      maxPoints: this.configuration.maxPoints,
    });

    if (!trendResult) {
      return null;
    }

    record.trend = trendResult.data;

    /*
     * Trend and line share the same
     * [timestamp, value] representation.
     */
    record.line = clonePoints(trendResult.data);

    const candleResult = mergeMarketChartLivePoint(
      record.candlestick,
      pricePoint,
      {
        mode: "candlestick",

        maxPoints: this.configuration.maxPoints,

        candleBucketSize: this.configuration.candleBucketSize,
      },
    );

    if (candleResult) {
      record.candlestick = candleResult.data;
    }

    return {
      range: intradayRange,

      pricePoint,

      trend: trendResult,

      line: {
        ...trendResult,

        data: record.line,

        point: clonePoint(trendResult.point),
      },

      candlestick: candleResult,
    };
  }

  /* ========================================================================
     Visible Live Series
     ======================================================================== */

  updateVisibleSeriesFromLive(results) {
    if (!results || this.currentRange !== results.range || !this.chart) {
      return false;
    }

    const result = results[this.currentMode];

    if (!result?.point || !result.data) {
      return false;
    }

    const series = this.getMainSeries();

    if (!series) {
      return false;
    }

    const timestamp = getPointTimestamp(result.point);

    const existingPoint = series.data.find(
      (seriesPoint) => seriesPoint.x === timestamp,
    );

    if (result.replaced && existingPoint) {
      existingPoint.update(result.point, false, false);
    } else if (result.appended) {
      series.addPoint(result.point, false, Boolean(result.shifted), false);
    } else {
      series.setData(result.data, false, false, false);
    }

    return true;
  }

  updateVisibleNavigatorFromLive(results) {
    if (!results || this.currentRange !== results.range) {
      return false;
    }

    const navigatorSeries = this.getNavigatorSeries();

    if (!navigatorSeries) {
      return false;
    }

    const result = results.trend;

    const timestamp = getPointTimestamp(result.point);

    const existingPoint = navigatorSeries.data.find(
      (seriesPoint) => seriesPoint.x === timestamp,
    );

    if (result.replaced && existingPoint) {
      existingPoint.update(result.point, false, false);
    } else if (result.appended) {
      navigatorSeries.addPoint(
        result.point,
        false,
        Boolean(result.shifted),
        false,
      );
    } else {
      navigatorSeries.setData(result.data, false, false, false);
    }

    return true;
  }

  /* ========================================================================
     Live Application
     ======================================================================== */

  applyLivePoint(incomingPoint, metadata = {}) {
    if (this.destroyed) {
      return false;
    }

    const intradayRange = this.getIntradayRange();

    const activeDataWasEmpty =
      this.currentRange === intradayRange && !this.getActiveData().length;

    const previousModeAvailability = this.getModeAvailability(intradayRange);

    const results = this.mergeLivePointIntoIntraday(incomingPoint);

    if (!results) {
      return false;
    }

    /*
     * An initially empty live range disables
     * its mode controls. Synchronize only when
     * actual availability changes.
     */
    if (
      this.hasModeAvailabilityChanged(previousModeAvailability, intradayRange)
    ) {
      this.updateControls();
    }

    const intradayActive = this.currentRange === results.range;

    /*
     * Keep stored intraday navigator state
     * current even while a historical range
     * is visible.
     */
    this.navigatorController?.appendLiveData(
      this.getNavigatorData(results.range),
      {
        range: results.range,

        followLatest: true,

        liveWindowDuration: this.configuration.liveWindowDuration,

        redraw: false,
        animation: false,
        notify: false,
      },
    );

    if (intradayActive) {
      if (activeDataWasEmpty) {
        /*
         * The empty chart has no navigator,
         * axes, or tooltip. Rebuild its options
         * once when the first point arrives.
         */
        this.updateChart({
          source: "live-initial-data",

          preserveViewport: false,

          resetViewport: true,

          redraw: true,
          animation: false,
        });
      } else {
        this.updateVisibleSeriesFromLive(results);

        this.updateVisibleNavigatorFromLive(results);

        /*
         * Return visible Y axes to automatic
         * scaling after a live point.
         */
        this.chart?.yAxis?.forEach((axis) => {
          if (!axis.options?.isInternal) {
            axis.setExtremes(null, null, false, false, {
              trigger: "market-chart-live",
            });
          }
        });

        const activeData = this.getActiveData();

        this.synchronizeSeriesTheme(activeData, false);

        this.chart?.redraw(
          normalizeMarketChartAnimation(this.configuration.animation, {
            element: this.element,
            mode: this.currentMode,
          }),
        );

        this.clearMessage();

        this.setState("ready");
      }
    }

    const timestamp = results.pricePoint[0];

    this.updateLastUpdated(metadata.updatedAt || timestamp || Date.now());

    dispatchChartEvent(this.element, "marketchartliveupdate", {
      point: results.pricePoint,

      results,
      metadata,

      range: results.range,

      visibleRange: this.currentRange,

      visible: intradayActive,

      controller: this,
    });

    return true;
  }

  /* ========================================================================
     Live Controller
     ======================================================================== */

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

    this.liveController?.destroy();

    this.liveController = createMarketChartLiveController({
      interval: live.interval ?? 60_000,

      alignToInterval: live.alignToInterval ?? true,

      immediate: live.immediate ?? false,

      pauseWhenHidden: live.pauseWhenHidden ?? false,

      retry: live.retry ?? true,

      maxRetryDelay: live.maxRetryDelay,

      requestTimeout: live.requestTimeout,

      environment: {
        window: this.window,

        document: this.document,

        navigator: this.window.navigator,

        now: this.configuration.environment?.now,
      },

      /*
       * Live data always belongs to the
       * configured intraday range.
       */
      fetchPoint: ({ signal, requestedAt, sequence, requestId }) => {
        return live.fetchPoint({
          signal,
          requestedAt,
          sequence,
          requestId,

          symbol: this.configuration.symbol,

          range: this.getIntradayRange(),

          mode: "trend",

          visibleRange: this.currentRange,

          visibleMode: this.currentMode,

          controller: this,
        });
      },

      onPoint: (point, pointMetadata) => {
        return this.applyLivePoint(point, pointMetadata);
      },

      onStateChange: (state) => {
        /*
         * Live updates do not reopen the
         * complete loading overlay.
         */
        this.setLiveState(state);

        if (typeof live.onStateChange === "function") {
          live.onStateChange(state, this);
        }
      },

      onError: (error, errorMetadata) => {
        dispatchChartEvent(this.element, "marketchartliveerror", {
          error,
          metadata: errorMetadata,

          controller: this,
        });

        if (typeof live.onError === "function") {
          live.onError(error, errorMetadata, this);
        }
      },
    });

    if (live.autostart !== false) {
      this.liveController.start();
    }

    return this.liveController;
  }

  startLive() {
    return this.liveController?.start() ?? false;
  }

  pauseLive(reason = "manual") {
    return this.liveController?.pause(reason) ?? false;
  }

  /*
   * This controls polling only.
   * resumeLive() controls navigator following.
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

  /* ========================================================================
     Last Updated
     ======================================================================== */

  updateLastUpdated(timestamp) {
    const normalizedTimestamp = toFiniteNumber(timestamp);

    if (normalizedTimestamp === null) {
      return false;
    }

    const time = this.controlsRoot?.querySelector("[data-chart-updated-time]");

    if (!time) {
      return false;
    }

    const date = new this.window.Date(normalizedTimestamp);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const DateTimeFormat =
      this.window.Intl?.DateTimeFormat || globalThis.Intl?.DateTimeFormat;

    if (typeof DateTimeFormat !== "function") {
      return false;
    }

    let formatter;

    try {
      formatter = new DateTimeFormat(this.configuration.language, {
        timeZone: this.configuration.timeZone,

        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",

        hourCycle: "h23",
      });
    } catch {
      formatter = new DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",

        hourCycle: "h23",
      });
    }

    time.dateTime = date.toISOString();

    time.textContent = formatter.format(date);

    return true;
  }

  /* ========================================================================
     Export
     ======================================================================== */

  initializeExport() {
    if (
      this.destroyed ||
      !this.controlsRoot ||
      this.capabilities.export === false
    ) {
      return null;
    }

    this.exportController?.destroy();

    const exporting = this.configuration.exporting || {};

    this.exportController = createMarketChartExportController({
      root: this.controlsRoot,

      chartElement: this.element,

      fullscreenElement: this.section || this.controlsRoot,

      trigger:
        this.configuration.controls?.exportTrigger || ".chart-export__trigger",

      menu: this.configuration.controls?.exportMenu || ".chart-export-menu",

      actionSelector: exporting.actionSelector || "[data-export-action]",

      allowServerExport:
        exporting.allowServerExport ??
        exporting.fallbackToExportServer ??
        false,

      pdfEnabled: exporting.pdfEnabled !== false,

      getChart: () => this.chart,

      onReflow: () => {
        this.scheduleResize();
      },

      onAction: (detail) => {
        dispatchChartEvent(this.element, "marketchartaction", {
          ...detail,
          controller: this,
        });
      },
    });

    return this.exportController;
  }

  /* ========================================================================
     Resize
     ======================================================================== */
  handleWindowResize() {
    this.scheduleResize();
  }

  requestFrame(callback) {
    if (typeof this.window.requestAnimationFrame === "function") {
      return this.window.requestAnimationFrame(callback);
    }

    return this.window.setTimeout(callback, 16);
  }

  cancelFrame(frame) {
    if (frame === null) {
      return;
    }

    if (typeof this.window.cancelAnimationFrame === "function") {
      this.window.cancelAnimationFrame(frame);

      return;
    }

    this.window.clearTimeout(frame);
  }

  scheduleResize() {
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

    this.chart.reflow();

    this.navigatorController?.resize({
      redraw: false,
    });

    this.chart.redraw(false);

    return true;
  }

  /* ========================================================================
     Theme
     ======================================================================== */

  handleThemeMutation() {
    this.scheduleThemeUpdate();
  }

  scheduleThemeUpdate() {
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

    try {
      const data = this.getActiveData();

      const chartOptions = this.createOptions(data);

      /*
       * Theme refreshes update presentation
       * without replacing main or navigator
       * data and without resetting viewport
       * state.
       */
      const { series: ignoredNavigatorSeries, ...navigatorPresentation } =
        chartOptions.navigator || {};

      this.chart.update(
        {
          chart: {
            backgroundColor: chartOptions.chart.backgroundColor,
          },

          xAxis: chartOptions.xAxis,

          yAxis: chartOptions.yAxis,

          tooltip: chartOptions.tooltip,

          plotOptions: chartOptions.plotOptions,

          navigator: navigatorPresentation,
        },
        false,
        false,
        false,
      );

      this.synchronizeSeriesTheme(data, false);

      this.chart.redraw(false);

      return true;
    } catch (error) {
      console.error("Market Chart theme refresh failed.", error);

      dispatchChartEvent(this.element, "marketcharterror", {
        error,
        source: "theme",
        controller: this,
      });

      return false;
    }
  }

  /* ========================================================================
     Observers
     ======================================================================== */

  initializeObservers() {
    if (this.destroyed) {
      return;
    }

    const ResizeObserverConstructor =
      this.window.ResizeObserver || globalThis.ResizeObserver;

    if (typeof ResizeObserverConstructor === "function") {
      this.resizeObserver = new ResizeObserverConstructor(() => {
        this.scheduleResize();
      });

      this.resizeObserver.observe(this.element);

      if (this.section && this.section !== this.element) {
        this.resizeObserver.observe(this.section);
      }
    } else {
      this.window.addEventListener("resize", this.handleWindowResize, {
        signal: this.listenerController.signal,

        passive: true,
      });
    }

    const MutationObserverConstructor =
      this.window.MutationObserver || globalThis.MutationObserver;

    if (typeof MutationObserverConstructor === "function") {
      this.themeObserver = new MutationObserverConstructor(
        this.handleThemeMutation,
      );

      this.themeObserver.observe(this.document.documentElement, {
        attributes: true,

        /*
         * Language changes require explicit
         * runtime reconfiguration because an
         * integration may have supplied a
         * fixed language. Do not treat every
         * lang mutation as a theme update.
         */
        attributeFilter: [
          "data-theme",
          "data-contrast",
          "data-motion",
          "dir",
          "class",
          "style",
        ],
      });
    }
  }

  /* ========================================================================
     Public State
     ======================================================================== */

  getChart() {
    return this.chart;
  }

  getState() {
    return {
      state: this.state,

      destroyed: this.destroyed,

      initialized: this.initialized,

      range: this.currentRange,

      mode: this.currentMode,

      direction: this.getDirection(),

      comparisonValue: this.getComparisonValue(),

      capabilities: {
        ...this.capabilities,
      },

      availableRanges: [...this.availableRanges],

      navigator: this.navigatorController?.getState() || null,

      live: this.liveController?.getState() || null,

      transitionRevision: this.transitions?.getRevision() || 0,
    };
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    this.transitions?.invalidate();

    this.liveController?.destroy();

    this.liveController = null;

    this.exportController?.destroy();

    this.exportController = null;

    this.navigatorController?.destroy();

    this.navigatorController = null;

    this.listenerController.abort();

    this.resizeObserver?.disconnect();

    this.resizeObserver = null;

    this.themeObserver?.disconnect();

    this.themeObserver = null;

    if (this.resizeFrame !== null) {
      this.cancelFrame(this.resizeFrame);

      this.resizeFrame = null;
    }

    if (this.themeFrame !== null) {
      this.cancelFrame(this.themeFrame);

      this.themeFrame = null;
    }

    if (this.chart) {
      this.chart.destroy();

      this.chart = null;
    }

    this.clearMessage();

    this.element.removeAttribute("data-chart-state");

    this.element.removeAttribute("data-chart-message");

    this.element.removeAttribute("data-chart-direction");

    this.element.removeAttribute("data-chart-live-state");

    this.element.removeAttribute("data-chart-follow-live");

    this.section?.removeAttribute("data-chart-live-state");

    this.section?.removeAttribute("data-chart-follow-live");

    this.section?.setAttribute("aria-busy", "false");

    chartRegistry.delete(this.element);

    dispatchChartEvent(this.element, "marketchartdestroy", {
      controller: this,
    });
  }
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
     * Validate and construct the replacement
     * before destroying the registered chart.
     * Rendering still begins only after the old
     * instance has been removed.
     */
    controller = new MarketChartController(element, source);

    existing?.destroy();

    chartRegistry.set(element, controller);

    controller.initialize();

    return controller;
  } catch (error) {
    /*
     * Clean every subsystem that may have been
     * created before initialization failed.
     */
    controller?.destroy();

    chartRegistry.delete(element);

    element.dataset.chartState = "error";

    const section =
      element.closest("[data-performance-chart]") ||
      element.closest(".performance-chart");

    section?.setAttribute("aria-busy", "false");

    const errorMessage =
      controller?.configuration?.messages?.error || DEFAULT_MESSAGES.error;

    element.dataset.chartMessage = errorMessage;

    const existingMessage = element.querySelector(
      ":scope > .market-chart__message",
    );

    existingMessage?.remove();

    const errorWrapper = element.ownerDocument.createElement("div");

    errorWrapper.className = [
      "market-chart__message",
      "market-chart__message--error",
    ].join(" ");

    errorWrapper.setAttribute("role", "alert");

    errorWrapper.setAttribute("aria-live", "assertive");

    const errorText = element.ownerDocument.createElement("p");

    errorText.className = "market-chart__message-text";

    errorText.textContent = errorMessage;

    errorWrapper.append(errorText);

    element.append(errorWrapper);

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
