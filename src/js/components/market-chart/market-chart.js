import {
  getMarketChartDirection,
  mergeMarketChartLivePoint,
  normalizeMarketChartData,
  normalizeMarketChartRanges,
} from "./market-chart-data";

import { createMarketChartExportController } from "./market-chart-export";

import { createMarketChartLiveController } from "./market-chart-live";

import { createMarketChartOptions } from "./market-chart-options";

import {
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

const CHART_MODES = new Set(["trend", "line", "candlestick"]);

const USER_AXIS_TRIGGERS = new Set([
  "navigator",
  "pan",
  "rangeSelectorButton",
  "rangeSelectorInput",
  "scrollbar",
  "zoom",
]);

const DEFAULT_CONFIGURATION = Object.freeze({
  context: "performance",

  symbol: "",
  name: "",
  currency: "",

  mode: "trend",
  range: "1D",

  language: "",
  timeZone: "Asia/Riyadh",

  decimals: 2,
  maxPoints: 500,

  previousClose: null,

  xAxisTitle: null,
  yAxisTitle: null,

  axis: {},
  xAxis: {},
  yAxis: {},

  dateFormats: {},
  tooltipDateFormats: {},

  navigatorEnabled: null,
  navigator: {},

  /*
   * Incoming live points advance the visible X-axis window until the user
   * manually changes the Navigator, zoom, scrollbar, or pan position.
   */

  followLive: true,

  /*
   * Optional fixed live window in milliseconds. When omitted, the chart
   * preserves the current visible X-axis duration.
   */

  liveWindowDuration: null,

  data: [],
  ranges: {},

  controls: {},
  live: null,

  emptyMessage: "Chart data is currently unavailable.",

  errorMessage: "The chart could not be loaded.",
});

/* ==========================================================================
   Element Resolution
   ========================================================================== */

function resolveElement(target) {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (typeof target === "string") {
    return document.querySelector(target);
  }

  return null;
}

function resolveControlsRoot(element, target) {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (typeof target === "string") {
    return element.closest(target) || document.querySelector(target);
  }

  return (
    element.closest("[data-performance-chart]") ||
    element.closest(".performance-chart") ||
    element.closest("[data-market-detail-panel]") ||
    element.parentElement
  );
}

function resolveViewport(element) {
  return (
    element.closest("[data-chart-viewport]") ||
    element.closest(".chart-surface") ||
    element.parentElement
  );
}

function resolveSection(element) {
  return (
    element.closest("[data-performance-chart]") ||
    element.closest(".performance-chart") ||
    element.closest("[data-market-detail-panel]")
  );
}

/* ==========================================================================
   Highcharts Validation
   ========================================================================== */

function getHighcharts() {
  if (!Highcharts) {
    console.error(
      "Market chart could not initialize because Highcharts is unavailable.",
    );

    return null;
  }

  if (typeof Highcharts.stockChart !== "function") {
    console.error("Market chart requires the Highcharts Stock build.");

    return null;
  }

  return Highcharts;
}

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function getPointTimestamp(point) {
  if (Array.isArray(point)) {
    return Number(point[0]);
  }

  if (point && typeof point === "object") {
    return Number(point.x);
  }

  return Number.NaN;
}

function getPointCloseValue(point, mode) {
  if (Array.isArray(point)) {
    return Number(mode === "candlestick" ? point[4] : point[1]);
  }

  if (point && typeof point === "object") {
    return Number(mode === "candlestick" ? (point.close ?? point.y) : point.y);
  }

  return Number.NaN;
}

function getEffectiveDirection(data, mode) {
  if (Array.isArray(data) && data.length) {
    const closes = data
      .map((point) => getPointCloseValue(point, mode))
      .filter(isFiniteNumber);

    if (closes.length >= 2) {
      const first = closes[0];
      const last = closes.at(-1);

      if (last > first) {
        return "up";
      }

      if (last < first) {
        return "down";
      }

      return "neutral";
    }
  }

  const direction = getMarketChartDirection(data, mode);

  if (direction === "positive") {
    return "up";
  }

  if (direction === "negative") {
    return "down";
  }

  return direction === "up" || direction === "down" ? direction : "neutral";
}
function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getChartAnimation() {
  return prefersReducedMotion()
    ? false
    : {
        duration: 180,
      };
}

/* ==========================================================================
   State Messages
   ========================================================================== */

function removeStateMessage(element) {
  element.querySelector(":scope > .market-chart__message")?.remove();
}

function setStateMessage(element, message, state) {
  removeStateMessage(element);

  const wrapper = document.createElement("div");

  wrapper.className = `market-chart__message market-chart__message--${state}`;

  wrapper.setAttribute("role", state === "error" ? "alert" : "status");

  const text = document.createElement("p");

  text.className = "market-chart__message-text";

  text.textContent = message;

  wrapper.append(text);
  element.append(wrapper);
}

/* ==========================================================================
   Date Formatting
   ========================================================================== */

function formatUpdatedTime(timestamp, { language, timeZone }) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(language, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/* ==========================================================================
   Controller
   ========================================================================== */

class MarketChartController {
  constructor(element, configuration, highcharts) {
    this.element = element;
    this.Highcharts = highcharts;

    this.configuration = {
      ...DEFAULT_CONFIGURATION,
      ...configuration,

      controls: {
        ...DEFAULT_CONFIGURATION.controls,
        ...(configuration.controls || {}),
      },
    };

    this.configuration.language =
      this.configuration.language || document.documentElement.lang || "en";

    this.currentMode = CHART_MODES.has(this.configuration.mode)
      ? this.configuration.mode
      : "trend";

    this.currentRange = this.configuration.range || "1D";

    this.baseData = normalizeMarketChartData(
      this.configuration.data,
      this.currentMode,
    );

    this.ranges = normalizeMarketChartRanges(this.configuration.ranges);

    this.chart = null;

    this.controlsRoot = resolveControlsRoot(
      element,
      this.configuration.controls.root,
    );

    this.viewport = resolveViewport(element);

    this.section = resolveSection(element);

    this.abortController = new AbortController();

    this.themeObserver = null;
    this.resizeObserver = null;

    this.liveController = null;
    this.exportController = null;

    this.resizeFrame = null;
    this.themeFrame = null;

    this.lastViewportWidth = 0;
    this.lastViewportHeight = 0;

    this.isComparing = false;
    this.destroyed = false;

    this.followLive = this.configuration.followLive !== false;

    this.internalAxisUpdate = false;

    /*
     * Stores the closest UI range while the user changes Navigator extremes.
     * It does not replace currentRange or load another dataset.
     */

    this.navigatorRange = null;

    this.rangeButtons = [];
    this.modeButtons = [];
    this.compareButton = null;

    this.handleThemeMutation = this.handleThemeMutation.bind(this);

    this.handleViewportResize = this.handleViewportResize.bind(this);

    this.handleAxisExtremes = this.handleAxisExtremes.bind(this);
  }

  /* ========================================================================
     Initialization
     ===================================================================== */

  initialize() {
    this.setState("loading");

    const data = this.getActiveData();

    if (!data.length) {
      this.setState("empty", this.configuration.emptyMessage);

      this.bindControls();
      this.updateControls();

      return this;
    }

    try {
      this.chart = this.Highcharts.stockChart(
        this.element,
        this.createOptions(data),
      );

      this.bindAxisEvents();
      this.bindControls();
      this.initializeExport();
      this.observeTheme();
      this.observeResize();
      this.initializeLiveUpdates();

      this.updateControls();
      this.updateDirection(data);
      this.updateLiveFollowState();

      this.setState("ready");
      this.scheduleResize();

      return this;
    } catch (error) {
      this.setState("error", this.configuration.errorMessage);

      console.error("Market chart initialization failed.", error);

      return this;
    }
  }

  /* ========================================================================
     Options
     ===================================================================== */

  createOptions(data = this.getActiveData()) {
    const direction = getEffectiveDirection(data, this.currentMode);

    return createMarketChartOptions({
      Highcharts: this.Highcharts,
      element: this.element,

      context: this.configuration.context,

      currency: this.configuration.currency,

      mode: this.currentMode,
      range: this.currentRange,
      direction,

      symbol: this.configuration.symbol,

      seriesName:
        this.configuration.name || this.configuration.symbol || "Market",

      data,

      previousClose: this.configuration.previousClose,

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

      navigatorEnabled: this.configuration.navigatorEnabled,

      navigator: this.configuration.navigator,

      /*
       * 1D supplies intraday data and formatting.
       * Every other selected range supplies ALL-history Navigator data.
       */

      navigatorData: this.getNavigatorData(),

      navigatorRange: this.getNavigatorRange(),

      animation: getChartAnimation(),

      accessibilityDescription:
        this.configuration.accessibilityDescription ||
        (this.configuration.name
          ? `${this.configuration.name} market performance over time.`
          : "Market performance over time."),
    });
  }

  /* ========================================================================
     Data Resolution
     ===================================================================== */

  getRangeRecord(range = this.currentRange) {
    return this.ranges[range] || null;
  }

  getActiveData() {
    const rangeRecord = this.getRangeRecord();

    if (rangeRecord) {
      const data = rangeRecord[this.currentMode];

      if (Array.isArray(data)) {
        return data;
      }

      if (this.currentMode === "line" && Array.isArray(rangeRecord.trend)) {
        return rangeRecord.trend;
      }
    }

    return normalizeMarketChartData(this.baseData, this.currentMode);
  }

  getNavigatorData() {
    /*
     * Intraday charts use the intraday timeline so the Navigator displays
     * trading hours instead of unrelated historical dates.
     */

    if (this.currentRange === "1D") {
      const intradayRange = this.ranges["1D"];

      if (intradayRange?.trend?.length) {
        return intradayRange.trend;
      }

      if (intradayRange?.line?.length) {
        return intradayRange.line;
      }

      return this.getActiveData();
    }

    /*
     * All non-intraday views use a stable ALL-history Navigator. This keeps
     * the Navigator useful as a global timeline while the primary chart
     * displays the selected 1W, 1M, 3M, 1Y, or 5Y dataset.
     */

    const allRange = this.ranges.ALL;

    if (!allRange) {
      return this.getActiveData();
    }

    /*
     * The Navigator remains mode-independent. A compact trend series is more
     * readable than duplicating the active candlestick presentation.
     */

    if (allRange.trend?.length) {
      return allRange.trend;
    }

    if (allRange.line?.length) {
      return allRange.line;
    }

    return this.getActiveData();
  }

  getNavigatorRange() {
    return this.currentRange === "1D" ? "1D" : "ALL";
  }

  hasRange(range) {
    return Boolean(this.ranges[range]);
  }

  hasModeData(mode, range = this.currentRange) {
    const record = this.getRangeRecord(range);

    if (record) {
      if (record[mode]?.length) {
        return true;
      }

      return Boolean(mode === "line" && record.trend?.length);
    }

    return Boolean(
      normalizeMarketChartData(this.configuration.data, mode).length,
    );
  }

  /* ========================================================================
     State
     ===================================================================== */

  setState(state, message = "") {
    this.element.dataset.chartState = state;

    /*
     * Remove classes retained by older chart implementations. The shared
     * component uses data-chart-state as its visual state contract.
     */

    this.element.classList.remove("is-loading", "loading");

    if (this.section) {
      this.section.setAttribute("aria-busy", String(state === "loading"));
    }

    if (state === "empty" || state === "error") {
      setStateMessage(this.element, message, state);
    } else {
      removeStateMessage(this.element);
    }

    if (state === "ready") {
      this.element.dataset.chartReady = "true";
    } else if (state === "empty" || state === "error") {
      this.element.removeAttribute("data-chart-ready");
    }

    this.element.dispatchEvent(
      new CustomEvent("marketchartstatechange", {
        bubbles: true,

        detail: {
          state,
          message,
          controller: this,
        },
      }),
    );
  }

  /* ========================================================================
     Rendering
     ===================================================================== */

  render({ preserveExtremes = false, animate = true, recreate = false } = {}) {
    if (this.destroyed) {
      return false;
    }

    const data = this.getActiveData();

    if (!data.length) {
      this.chart?.destroy();
      this.chart = null;

      this.setState("empty", this.configuration.emptyMessage);

      this.updateControls();

      return false;
    }

    const previousExtremes =
      preserveExtremes && this.chart?.xAxis?.[0]
        ? this.chart.xAxis[0].getExtremes()
        : null;

    this.setState("loading");

    try {
      const options = this.createOptions(data);

      /*
       * Range and mode changes recreate Highcharts Stock. This prevents stale
       * internal Navigator series, axis formats, and candlestick state from
       * surviving a dataset change.
       */

      if (recreate && this.chart) {
        const axis = this.chart.xAxis?.[0];

        axis?.marketChartExtremesUnbind?.();

        this.chart.destroy();
        this.chart = null;

        this.exportController?.destroy();

        this.exportController = null;
      }

      if (!this.chart) {
        this.element.replaceChildren();

        this.chart = this.Highcharts.stockChart(this.element, options);

        this.bindAxisEvents();

        if (
          previousExtremes &&
          isFiniteNumber(previousExtremes.min) &&
          isFiniteNumber(previousExtremes.max)
        ) {
          this.setAxisExtremes(
            Number(previousExtremes.min),
            Number(previousExtremes.max),
            false,
          );

          this.chart.redraw(animate ? getChartAnimation() : false);
        }

        this.exportController?.destroy();

        this.exportController = null;

        this.initializeExport();
      } else {
        this.chart.update(options, false, true, false);

        this.bindAxisEvents();

        if (
          previousExtremes &&
          isFiniteNumber(previousExtremes.min) &&
          isFiniteNumber(previousExtremes.max)
        ) {
          this.setAxisExtremes(
            Number(previousExtremes.min),
            Number(previousExtremes.max),
            false,
          );
        }

        this.updateDirection(data);

        this.chart.redraw(animate ? getChartAnimation() : false);
      }

      if (!this.chart || this.chart.series.length === 0) {
        return false;
      }

      this.updateDirection(data);
      this.updateControls();

      this.setState("ready");
      this.scheduleResize();

      return true;
    } catch (error) {
      this.setState("error", this.configuration.errorMessage);

      console.error("Market chart rendering failed.", error);

      return false;
    }
  }

  getMainSeries() {
    if (!this.chart) {
      return null;
    }

    return (
      this.chart.series.find((series) => !series.options.isInternal) || null
    );
  }

  /* ========================================================================
     Axis Synchronization
     ===================================================================== */

  bindAxisEvents() {
    const axis = this.chart?.xAxis?.[0];

    if (!axis || axis.marketChartExtremesUnbind) {
      return;
    }

    axis.marketChartExtremesUnbind = this.Highcharts.addEvent(
      axis,
      "afterSetExtremes",
      this.handleAxisExtremes,
    );
  }

  handleAxisExtremes(event) {
    if (this.internalAxisUpdate || this.destroyed) {
      return;
    }

    if (USER_AXIS_TRIGGERS.has(event.trigger)) {
      this.followLive = false;

      this.syncRangeControlFromExtremes(event);

      this.updateLiveFollowState();
    }
  }

  getDataBounds(data = this.getActiveData()) {
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const timestamps = data
      .map(getPointTimestamp)
      .filter(isFiniteNumber)
      .sort((left, right) => left - right);

    if (!timestamps.length) {
      return null;
    }

    const minimum = timestamps[0];
    const maximum = timestamps.at(-1);

    return {
      min: minimum,
      max: maximum,

      duration: Math.max(0, maximum - minimum),
    };
  }

  getRangeDurations() {
    return Object.entries(this.ranges)
      .map(([range, record]) => {
        const data =
          record[this.currentMode] ||
          (this.currentMode === "line" ? record.trend : null) ||
          record.trend ||
          record.candlestick;

        const bounds = this.getDataBounds(data);

        return bounds?.duration > 0
          ? {
              range,
              duration: bounds.duration,
            }
          : null;
      })
      .filter(Boolean)
      .sort((left, right) => left.duration - right.duration);
  }

  findClosestRange(duration) {
    if (!isFiniteNumber(duration) || duration <= 0) {
      return null;
    }

    const ranges = this.getRangeDurations();

    if (!ranges.length) {
      return null;
    }

    return ranges.reduce((closest, candidate) => {
      const candidateDifference = Math.abs(
        Math.log(candidate.duration / duration),
      );

      const closestDifference = Math.abs(Math.log(closest.duration / duration));

      return candidateDifference < closestDifference ? candidate : closest;
    }).range;
  }

  syncRangeControlFromExtremes(event) {
    if (this.configuration.navigator?.synchronizeRange === false) {
      return null;
    }

    const minimum = Number(event?.min);
    const maximum = Number(event?.max);

    if (!isFiniteNumber(minimum) || !isFiniteNumber(maximum)) {
      return null;
    }

    const range = this.findClosestRange(maximum - minimum);

    if (!range || range === this.navigatorRange) {
      return range;
    }

    /*
     * Update only the visual range control. Dragging the Navigator must not
     * replace the primary dataset or recreate the chart.
     */

    this.navigatorRange = range;
    this.updateControls();

    this.element.dispatchEvent(
      new CustomEvent("marketchartnavigatorrangechange", {
        bubbles: true,

        detail: {
          range,
          minimum,
          maximum,
          controller: this,
        },
      }),
    );

    return range;
  }

  setAxisExtremes(minimum, maximum, redraw = false) {
    const axis = this.chart?.xAxis?.[0];

    if (
      !axis ||
      !isFiniteNumber(minimum) ||
      !isFiniteNumber(maximum) ||
      maximum <= minimum
    ) {
      return false;
    }

    this.internalAxisUpdate = true;

    try {
      axis.setExtremes(minimum, maximum, redraw, false, {
        trigger: "market-chart-live",
      });
    } finally {
      this.internalAxisUpdate = false;
    }

    return true;
  }

  getLiveWindow(timestamp) {
    const axis = this.chart?.xAxis?.[0];

    if (!axis || !isFiniteNumber(timestamp)) {
      return null;
    }

    const extremes = axis.getExtremes();

    const configuredDuration = Number(this.configuration.liveWindowDuration);

    let duration =
      configuredDuration > 0
        ? configuredDuration
        : Number(extremes.max) - Number(extremes.min);

    if (!isFiniteNumber(duration) || duration <= 0) {
      duration = Number(extremes.dataMax) - Number(extremes.dataMin);
    }

    if (!isFiniteNumber(duration) || duration <= 0) {
      return null;
    }

    return {
      min: timestamp - duration,
      max: timestamp,
    };
  }

  followLatestPoint(timestamp, redraw = false) {
    if (!this.followLive) {
      return false;
    }

    const window = this.getLiveWindow(timestamp);

    if (!window) {
      return false;
    }

    return this.setAxisExtremes(window.min, window.max, redraw);
  }

  resumeLiveFollow() {
    this.followLive = true;

    this.updateLiveFollowState();

    const data = this.getActiveData();
    const lastPoint = data.at(-1);

    const timestamp = getPointTimestamp(lastPoint);

    if (isFiniteNumber(timestamp)) {
      this.followLatestPoint(timestamp, true);
    }

    return this.followLive;
  }

  pauseLiveFollow() {
    this.followLive = false;

    this.updateLiveFollowState();

    return this.followLive;
  }

  updateLiveFollowState() {
    const value = String(this.followLive);

    this.element.dataset.chartFollowLive = value;

    this.section?.setAttribute("data-chart-follow-live", value);
  }
  /* ========================================================================
     Range
     ===================================================================== */

  setRange(range) {
    if (!range || !this.hasRange(range)) {
      return false;
    }

    const restoresCurrentRange =
      range === this.currentRange && Boolean(this.navigatorRange);

    if (range === this.currentRange && !restoresCurrentRange) {
      return false;
    }

    const record = this.getRangeRecord(range);

    let nextMode = this.currentMode;

    if (!record[nextMode]?.length) {
      if (nextMode === "line" && record.trend?.length) {
        nextMode = "line";
      } else if (record.trend?.length) {
        nextMode = "trend";
      } else if (record.candlestick?.length && !this.isComparing) {
        nextMode = "candlestick";
      } else {
        return false;
      }
    }

    this.currentRange = range;
    this.currentMode = nextMode;

    /*
     * Clear the temporary Navigator selection so the clicked range becomes
     * the authoritative active control.
     */

    this.navigatorRange = null;

    this.configuration.range = range;
    this.configuration.mode = nextMode;

    /*
     * Selecting a range returns the chart to the latest available point.
     * Subsequent Navigator, pan, zoom, or scrollbar interaction can pause
     * live following again.
     */

    this.followLive = this.configuration.followLive !== false;

    const rendered = this.render({
      recreate: true,
    });

    if (rendered) {
      this.updateLiveFollowState();
      this.dispatchChange("range");
    }

    return rendered;
  }

  /* ========================================================================
     Mode
     ===================================================================== */

  setMode(mode) {
    if (!CHART_MODES.has(mode) || mode === this.currentMode) {
      return false;
    }

    if (mode === "candlestick" && this.isComparing) {
      return false;
    }

    if (!this.hasModeData(mode)) {
      return false;
    }

    this.currentMode = mode;
    this.configuration.mode = mode;

    const rendered = this.render({
      preserveExtremes: true,
      recreate: true,
    });

    if (rendered) {
      this.dispatchChange("mode");
    }

    return rendered;
  }

  /* ========================================================================
     Comparison
     ===================================================================== */

  setComparing(active) {
    const nextState = Boolean(active);

    if (nextState === this.isComparing) {
      return;
    }

    this.isComparing = nextState;

    this.section?.classList.toggle("is-comparing", this.isComparing);

    this.section?.setAttribute(
      "data-chart-comparing",
      String(this.isComparing),
    );

    /*
     * Candlesticks cannot represent multiple comparison series consistently.
     * Return to trend mode before comparison begins.
     */

    if (this.isComparing && this.currentMode === "candlestick") {
      this.currentMode = "trend";
      this.configuration.mode = "trend";

      this.render({
        recreate: true,
      });
    }

    this.updateControls();

    this.element.dispatchEvent(
      new CustomEvent("marketchartcompare", {
        bubbles: true,

        detail: {
          active: this.isComparing,

          symbol: this.configuration.symbol,

          controller: this,
        },
      }),
    );
  }

  /* ========================================================================
     Static Data
     ===================================================================== */

  setData(data, options = {}) {
    const mode = options.mode || this.currentMode;

    if (!CHART_MODES.has(mode)) {
      return false;
    }

    const normalized = normalizeMarketChartData(data, mode);

    if (!normalized.length) {
      return false;
    }

    if (options.symbol) {
      this.configuration.symbol = options.symbol;
    }

    if (options.name) {
      this.configuration.name = options.name;
    }

    if (options.currency !== undefined) {
      this.configuration.currency = options.currency;
    }

    if (options.previousClose !== undefined) {
      this.configuration.previousClose = options.previousClose;
    }

    this.currentMode = mode;
    this.configuration.mode = mode;

    this.navigatorRange = null;

    this.baseData = normalized;
    this.configuration.data = normalized;

    if (options.clearRanges) {
      this.ranges = {};
      this.configuration.ranges = {};
    }

    return this.render({
      preserveExtremes: options.preserveExtremes ?? false,

      animate: options.animate ?? true,

      recreate: options.recreate ?? true,
    });
  }

  setRanges(ranges, options = {}) {
    const normalized = normalizeMarketChartRanges(ranges);

    const names = Object.keys(normalized);

    if (!names.length) {
      return false;
    }

    this.ranges = normalized;

    this.configuration.ranges = ranges;

    const requestedRange = options.range || this.currentRange || names[0];

    this.currentRange = normalized[requestedRange] ? requestedRange : names[0];

    if (!this.hasModeData(this.currentMode, this.currentRange)) {
      this.currentMode = this.hasModeData("trend", this.currentRange)
        ? "trend"
        : "candlestick";
    }

    this.configuration.range = this.currentRange;

    this.configuration.mode = this.currentMode;

    this.navigatorRange = null;

    return this.render({
      animate: options.animate ?? true,

      recreate: options.recreate ?? true,
    });
  }

  /* ========================================================================
     Live Updates
     ===================================================================== */

  initializeLiveUpdates() {
    const live = this.configuration.live;

    if (
      !live ||
      live.enabled === false ||
      typeof live.fetchPoint !== "function"
    ) {
      return;
    }

    this.liveController?.destroy();

    this.liveController = createMarketChartLiveController({
      interval: live.interval ?? 60_000,

      alignToInterval: live.alignToInterval ?? true,

      immediate: live.immediate ?? false,

      retry: live.retry ?? true,

      maxRetryDelay: live.maxRetryDelay,

      requestTimeout: live.requestTimeout,

      fetchPoint: ({ signal, requestedAt, sequence }) => {
        return live.fetchPoint({
          signal,
          requestedAt,
          sequence,

          symbol: this.configuration.symbol,

          range: this.currentRange,

          mode: this.currentMode,

          controller: this,
        });
      },

      onPoint: (point, metadata = {}) => {
        this.applyLivePoint(point, metadata);
      },

      onStateChange: (state) => {
        this.updateLiveState(state);

        if (typeof live.onStateChange === "function") {
          live.onStateChange(state, this);
        }
      },

      onError: (error, metadata = {}) => {
        this.element.dispatchEvent(
          new CustomEvent("marketchartliveerror", {
            bubbles: true,

            detail: {
              error,
              metadata,
              controller: this,
            },
          }),
        );

        if (typeof live.onError === "function") {
          live.onError(error, metadata, this);
        }
      },
    });

    if (live.autostart !== false) {
      this.liveController.start();
    }
  }

  applyLivePoint(point, metadata = {}) {
    if (this.destroyed) {
      return false;
    }

    const currentData = this.getActiveData();

    const result = mergeMarketChartLivePoint(currentData, point, {
      mode: this.currentMode,

      maxPoints: this.configuration.maxPoints,
    });

    if (!result?.data?.length || !result.point) {
      return false;
    }

    this.storeLiveData(result.data);

    const series = this.getMainSeries();

    if (!series || !this.chart) {
      return this.render({
        preserveExtremes: true,
      });
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

    /*
     * Keep the visible duration while advancing its endpoint. Manual
     * Navigator, scrollbar, pan, and zoom interaction can suspend this.
     */

    if (isFiniteNumber(timestamp)) {
      this.followLatestPoint(timestamp, false);
    }

    /*
     * Return the visible Y-axis to automatic extremes so live values remain
     * inside the scale. Ignore Highcharts' internal Navigator axis.
     */

    this.chart.yAxis.forEach((axis) => {
      if (!axis.options.isInternal) {
        axis.setExtremes(null, null, false, false, {
          trigger: "market-chart-live",
        });
      }
    });

    /*
     * Apply direction before redraw. Highcharts stores series colors in SVG,
     * so updating only data-chart-direction would not recolor the line.
     */

    this.updateDirection(result.data);

    this.chart.redraw(getChartAnimation());

    this.updateLastUpdated(metadata.updatedAt || timestamp || Date.now());

    this.element.dispatchEvent(
      new CustomEvent("marketchartliveupdate", {
        bubbles: true,

        detail: {
          point: result.point,
          result,
          metadata,

          symbol: this.configuration.symbol,

          range: this.currentRange,

          mode: this.currentMode,

          controller: this,
        },
      }),
    );

    return true;
  }

  storeLiveData(data) {
    const record = this.getRangeRecord();

    if (!record) {
      this.baseData = data;

      this.configuration.data = data;

      return;
    }

    record[this.currentMode] = data;

    /*
     * Trend and line share the same [timestamp, value] point structure.
     * Synchronize them so switching type does not discard live points.
     */

    if (this.currentMode === "trend") {
      record.line = data.map((item) => [...item]);
    } else if (this.currentMode === "line") {
      record.trend = data.map((item) => [...item]);
    }
  }

  updateLiveState(state) {
    const value = typeof state === "string" ? state : state?.state || "idle";

    this.section?.setAttribute("data-chart-live-state", value);

    this.element.dataset.chartLiveState = value;

    const status = this.controlsRoot?.querySelector("[data-chart-live-status]");

    if (status) {
      status.dataset.liveState = value;
    }
  }

  updateLastUpdated(timestamp) {
    const time = this.controlsRoot?.querySelector("[data-chart-updated-time]");

    if (!time) {
      return;
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    time.dateTime = date.toISOString();

    time.textContent = formatUpdatedTime(timestamp, {
      language: this.configuration.language,

      timeZone: this.configuration.timeZone,
    });
  }

  startLive() {
    return this.liveController?.start();
  }

  pauseLive(reason = "manual") {
    return this.liveController?.pause(reason);
  }

  resumeLive(reason = "manual") {
    return this.liveController?.resume(reason);
  }

  stopLive() {
    return this.liveController?.stop();
  }

  refreshLive() {
    return this.liveController?.refresh();
  }

  getLiveState() {
    return this.liveController?.getState() || null;
  }

  /* ========================================================================
     Direction
     ===================================================================== */

  updateDirection(data = this.getActiveData(), { redraw = false } = {}) {
    const direction = getMarketChartDirection(data, this.currentMode);

    /*
     * Set semantic attributes before reading the theme. This lets CSS resolve
     * the direction-specific --chart-line variable.
     */

    this.element.dataset.chartDirection = direction;

    this.section?.setAttribute("data-chart-direction", direction);

    if (!this.chart) {
      return direction;
    }

    const theme = getMarketChartTheme(this.element);

    const seriesTheme = getMarketChartSeriesTheme(
      this.Highcharts,
      theme,
      this.currentMode,
    );

    const mainSeries = this.getMainSeries();

    /*
     * Do not use Series.update() here. Rebuilding the main or internal
     * Navigator series can break Navigator-to-X-axis synchronization.
     *
     * Update stored options and current SVG graphics directly.
     */

    if (mainSeries) {
      Object.assign(mainSeries.options || {}, seriesTheme);

      Object.assign(mainSeries.userOptions || {}, seriesTheme);

      mainSeries.color = seriesTheme.color || theme.line;

      mainSeries.graph?.attr({
        stroke: seriesTheme.color || theme.line,
      });

      if (mainSeries.area && seriesTheme.fillColor) {
        mainSeries.area.attr({
          fill: seriesTheme.fillColor,
        });
      }

      if (this.currentMode === "candlestick") {
        mainSeries.points?.forEach((point) => {
          const rising = Number(point.close) >= Number(point.open);

          const fill = rising ? seriesTheme.upColor : seriesTheme.color;

          const stroke = rising
            ? seriesTheme.upLineColor
            : seriesTheme.lineColor;

          point.color = fill;

          point.graphic?.attr({
            fill,
            stroke,
          });
        });
      }
    }

    /*
     * Keep the Navigator synchronized with the semantic direction color,
     * including after live updates and theme/accent changes.
     */

    const navigatorSeries = this.chart.navigator?.series;

    if (Array.isArray(navigatorSeries)) {
      const navigatorTheme = getMarketChartSeriesTheme(
        this.Highcharts,
        theme,
        "trend",
      );

      navigatorSeries.forEach((series) => {
        if (!series) {
          return;
        }

        Object.assign(series.options || {}, navigatorTheme, {
          color: theme.line,
          lineColor: theme.line,
        });

        Object.assign(series.userOptions || {}, navigatorTheme, {
          color: theme.line,
          lineColor: theme.line,
        });

        series.color = theme.line;

        series.graph?.attr({
          stroke: theme.line,
        });

        if (series.area && navigatorTheme.fillColor) {
          series.area.attr({
            fill: navigatorTheme.fillColor,
          });
        }
      });
    }

    if (redraw) {
      this.chart.redraw(getChartAnimation());
    }

    return direction;
  }
  /* ========================================================================
     Events
     ===================================================================== */

  dispatchChange(source) {
    this.element.dispatchEvent(
      new CustomEvent("marketchartchange", {
        bubbles: true,

        detail: {
          source,

          range: this.currentRange,

          mode: this.currentMode,

          symbol: this.configuration.symbol,

          controller: this,
        },
      }),
    );
  }

  /* ========================================================================
     Controls
     ===================================================================== */

  bindControls() {
    if (!this.controlsRoot) {
      return;
    }

    const signal = this.abortController.signal;

    const controls = this.configuration.controls;

    const rangeSelector = controls.rangeSelector || "[data-chart-range]";

    const modeSelector =
      controls.modeSelector || controls.typeSelector || "[data-chart-type]";

    const compareSelector =
      controls.compareSelector ||
      controls.compareTrigger ||
      "[data-chart-compare]";

    this.rangeButtons = [...this.controlsRoot.querySelectorAll(rangeSelector)];

    this.modeButtons = [...this.controlsRoot.querySelectorAll(modeSelector)];

    this.compareButton = this.controlsRoot.querySelector(compareSelector);

    this.rangeButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          this.setRange(button.dataset.chartRange || button.dataset.range);
        },
        {
          signal,
        },
      );
    });

    this.modeButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          this.setMode(button.dataset.chartType || button.dataset.chartMode);
        },
        {
          signal,
        },
      );
    });

    this.compareButton?.addEventListener(
      "click",
      () => {
        this.setComparing(!this.isComparing);
      },
      {
        signal,
      },
    );
  }

  updateControls() {
    /*
     * Navigator interaction can temporarily highlight the closest available
     * range. A direct range-button selection resets navigatorRange.
     */

    const selectedRange = this.navigatorRange || this.currentRange;

    this.rangeButtons.forEach((button) => {
      const range = button.dataset.chartRange || button.dataset.range;

      const active = range === selectedRange;

      const available = this.hasModeData(this.currentMode, range);

      button.classList.toggle("is-active", active);

      button.setAttribute("aria-selected", String(active));

      button.setAttribute("aria-pressed", String(active));

      button.tabIndex = active ? 0 : -1;

      button.disabled = !available;

      button.setAttribute("aria-disabled", String(!available));
    });

    this.modeButtons.forEach((button) => {
      const mode = button.dataset.chartType || button.dataset.chartMode;

      const active = mode === this.currentMode;

      const available =
        this.hasModeData(mode) && !(mode === "candlestick" && this.isComparing);

      button.classList.toggle("is-active", active);

      button.setAttribute("aria-pressed", String(active));

      button.setAttribute("aria-selected", String(active));

      button.disabled = !available;

      button.setAttribute("aria-disabled", String(!available));
    });

    if (this.compareButton) {
      this.compareButton.classList.toggle("is-active", this.isComparing);

      this.compareButton.setAttribute("aria-pressed", String(this.isComparing));
    }
  }

  /* ========================================================================
     Export
     ===================================================================== */

  initializeExport() {
    if (!this.controlsRoot || !this.chart) {
      return;
    }

    const controls = this.configuration.controls;

    this.exportController = createMarketChartExportController({
      chart: this.chart,

      chartElement: this.element,

      root: this.controlsRoot,

      trigger: controls.exportTrigger || ".chart-export__trigger",

      menu: controls.exportMenu || ".chart-export-menu",

      onAfterFullscreen: () => {
        this.scheduleResize();
      },
    });
  }

  /* ========================================================================
     Theme
     ===================================================================== */

  observeTheme() {
    if (this.themeObserver) {
      return;
    }

    this.themeObserver = new MutationObserver(this.handleThemeMutation);

    this.themeObserver.observe(document.documentElement, {
      attributes: true,

      attributeFilter: [
        "data-theme",
        "data-accent",
        "data-contrast",
        "data-motion",
        "dir",
        "lang",
      ],
    });
  }

  handleThemeMutation(mutations) {
    const relevant = mutations.some((mutation) =>
      [
        "data-theme",
        "data-accent",
        "data-contrast",
        "data-motion",
        "dir",
        "lang",
      ].includes(mutation.attributeName),
    );

    if (!relevant || this.themeFrame || this.destroyed) {
      return;
    }

    this.themeFrame = requestAnimationFrame(() => {
      this.themeFrame = null;

      this.configuration.language =
        document.documentElement.lang || this.configuration.language;

      /*
       * Preserve the user's current Navigator/zoom position during theme,
       * contrast, language, direction, or accent changes.
       */

      this.render({
        preserveExtremes: true,
        animate: false,
      });
    });
  }

  /* ========================================================================
     Stable Resize
     ===================================================================== */

  observeResize() {
    if (!this.viewport || this.resizeObserver) {
      return;
    }

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(this.handleViewportResize);

      this.resizeObserver.observe(this.viewport);

      return;
    }

    window.addEventListener("resize", this.handleViewportResize, {
      passive: true,

      signal: this.abortController.signal,
    });
  }

  handleViewportResize() {
    this.scheduleResize();
  }

  scheduleResize() {
    if (this.destroyed || !this.chart || !this.viewport || this.resizeFrame) {
      return;
    }

    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;

      this.resizeToViewport();
    });
  }

  resizeToViewport() {
    if (this.destroyed || !this.chart || !this.viewport) {
      return;
    }

    const rectangle = this.viewport.getBoundingClientRect();

    const width = Math.round(rectangle.width);

    const height = Math.round(rectangle.height);

    if (width <= 0 || height <= 0) {
      return;
    }

    /*
     * Prevent ResizeObserver feedback loops and the previously reported
     * continuously growing dashboard height.
     */

    if (
      width === this.lastViewportWidth &&
      height === this.lastViewportHeight
    ) {
      return;
    }

    this.lastViewportWidth = width;
    this.lastViewportHeight = height;

    this.chart.setSize(width, height, false);
  }

  reflow() {
    this.scheduleResize();
  }

  /* ========================================================================
     Destruction
     ===================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    this.abortController.abort();

    this.themeObserver?.disconnect();
    this.resizeObserver?.disconnect();

    if (this.resizeFrame) {
      cancelAnimationFrame(this.resizeFrame);
    }

    if (this.themeFrame) {
      cancelAnimationFrame(this.themeFrame);
    }

    this.liveController?.destroy();
    this.exportController?.destroy();

    const axis = this.chart?.xAxis?.[0];

    axis?.marketChartExtremesUnbind?.();

    this.chart?.destroy();

    this.chart = null;
    this.liveController = null;
    this.exportController = null;

    removeStateMessage(this.element);

    this.element.classList.remove("is-loading", "loading");

    this.element.removeAttribute("data-chart-ready");

    this.element.removeAttribute("data-chart-state");

    this.element.removeAttribute("data-chart-direction");

    this.element.removeAttribute("data-chart-hover");

    this.element.removeAttribute("data-chart-live-state");

    this.element.removeAttribute("data-chart-follow-live");

    this.section?.removeAttribute("data-chart-live-state");

    this.section?.removeAttribute("data-chart-follow-live");

    chartRegistry.delete(this.element);
  }
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketChart(target, configuration = {}) {
  const element = resolveElement(target);

  if (!element) {
    console.error("Market chart target could not be found.");

    return null;
  }

  const highcharts = getHighcharts();

  if (!highcharts) {
    element.dataset.chartState = "error";

    setStateMessage(
      element,

      configuration.errorMessage || DEFAULT_CONFIGURATION.errorMessage,

      "error",
    );

    return null;
  }

  /*
   * Creating a chart for an existing element first destroys its previous
   * controller, listeners, observers, timers, and Highcharts instance.
   */

  chartRegistry.get(element)?.destroy();

  const controller = new MarketChartController(
    element,
    configuration,
    highcharts,
  ).initialize();

  chartRegistry.set(element, controller);

  return controller;
}

export function getMarketChart(target) {
  const element = resolveElement(target);

  return element ? chartRegistry.get(element) || null : null;
}

export function destroyMarketChart(target) {
  getMarketChart(target)?.destroy();
}

export function destroyAllMarketCharts() {
  [...chartRegistry.values()].forEach((controller) => {
    controller.destroy();
  });
}
