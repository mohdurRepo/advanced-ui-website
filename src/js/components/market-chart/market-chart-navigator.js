/* ==========================================================================
   Market Chart Navigator
   ========================================================================== */

/**
 * The navigator controller manages only the
 * visible viewport.
 *
 * It does not:
 *
 * - Select a named chart range.
 * - Infer 1W, 1M, or ALL from viewport width.
 * - Load chart data.
 * - Modify toolbar controls.
 * - Create a second Highstock navigator.
 *
 * The parent Market Chart controller owns the
 * active range, active mode, data loading, and
 * live-feed lifecycle.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_RANGE = "1D";

const DEFAULT_EDGE_TOLERANCE_RATIO = 0.01;

const DEFAULT_EDGE_TOLERANCE_MINIMUM = 1_000;

const DEFAULT_LIVE_WINDOW_DURATION = null;

const INTERNAL_TRIGGERS = new Set([
  "market-chart-initialize",
  "market-chart-range",
  "market-chart-data",
  "market-chart-live",
  "market-chart-resize",
  "market-chart-restore",
]);

const USER_TRIGGERS = new Set([
  "navigator",
  "scrollbar",
  "pan",
  "zoom",
  "mousewheel",
  "rangeSelectorButton",
]);

/* ==========================================================================
   Numeric Helpers
   ========================================================================== */

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toPositiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, minimum, maximum) {
  const safeMaximum = Math.max(minimum, maximum);

  return Math.min(Math.max(value, minimum), safeMaximum);
}

/* ==========================================================================
   Range Helpers
   ========================================================================== */

function normalizeRange(range) {
  if (range === null || range === undefined || range === "") {
    return DEFAULT_RANGE;
  }

  return String(range).trim().toUpperCase();
}

function resolveRangeDuration(value, range) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const normalizedRange = normalizeRange(range);

    return toPositiveNumber(
      value[normalizedRange] ?? value.default,

      DEFAULT_LIVE_WINDOW_DURATION,
    );
  }

  return toPositiveNumber(value, DEFAULT_LIVE_WINDOW_DURATION);
}

function normalizeBounds(minimum, maximum) {
  const normalizedMinimum = toFiniteNumber(minimum);

  const normalizedMaximum = toFiniteNumber(maximum);

  if (normalizedMinimum === null || normalizedMaximum === null) {
    return null;
  }

  return normalizedMinimum <= normalizedMaximum
    ? {
        minimum: normalizedMinimum,

        maximum: normalizedMaximum,
      }
    : {
        minimum: normalizedMaximum,

        maximum: normalizedMinimum,
      };
}

function getBoundsDuration(bounds) {
  if (!bounds) {
    return 0;
  }

  return Math.max(0, bounds.maximum - bounds.minimum);
}

/* ==========================================================================
   Point Helpers
   ========================================================================== */

function getPointTimestamp(point) {
  if (Array.isArray(point)) {
    return toFiniteNumber(point[0]);
  }

  if (point && typeof point === "object") {
    return toFiniteNumber(
      point.x ?? point.timestamp ?? point.time ?? point.dateTime ?? point.date,
    );
  }

  return null;
}

function getDataBounds(data) {
  if (!Array.isArray(data) || !data.length) {
    return null;
  }

  let minimum = Infinity;

  let maximum = -Infinity;

  data.forEach((point) => {
    const timestamp = getPointTimestamp(point);

    if (timestamp === null) {
      return;
    }

    minimum = Math.min(minimum, timestamp);

    maximum = Math.max(maximum, timestamp);
  });

  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    return null;
  }

  return {
    minimum,
    maximum,
  };
}

/* ==========================================================================
   Viewport Helpers
   ========================================================================== */

function normalizeViewport(viewport, dataBounds) {
  if (!viewport || !dataBounds) {
    return null;
  }

  const bounds = normalizeBounds(
    viewport.minimum ?? viewport.min,

    viewport.maximum ?? viewport.max,
  );

  if (!bounds) {
    return null;
  }

  const dataDuration = getBoundsDuration(dataBounds);

  if (dataDuration <= 0) {
    return {
      minimum: dataBounds.minimum,

      maximum: dataBounds.maximum,
    };
  }

  let duration = Math.min(getBoundsDuration(bounds), dataDuration);

  if (duration <= 0) {
    duration = dataDuration;
  }

  let minimum = clamp(
    bounds.minimum,
    dataBounds.minimum,
    dataBounds.maximum - duration,
  );

  let maximum = minimum + duration;

  if (maximum > dataBounds.maximum) {
    maximum = dataBounds.maximum;

    minimum = Math.max(
      dataBounds.minimum,

      maximum - duration,
    );
  }

  return {
    minimum,
    maximum,
  };
}

function createFullViewport(dataBounds) {
  if (!dataBounds) {
    return null;
  }

  return {
    minimum: dataBounds.minimum,

    maximum: dataBounds.maximum,
  };
}

function createTrailingViewport(dataBounds, duration) {
  if (!dataBounds) {
    return null;
  }

  const dataDuration = getBoundsDuration(dataBounds);

  const windowDuration = toPositiveNumber(duration, dataDuration);

  if (dataDuration <= 0 || windowDuration >= dataDuration) {
    return createFullViewport(dataBounds);
  }

  return {
    minimum: dataBounds.maximum - windowDuration,

    maximum: dataBounds.maximum,
  };
}

/* ==========================================================================
   Highcharts Helpers
   ========================================================================== */

function getMainXAxis(chart) {
  if (!chart?.xAxis?.length) {
    return null;
  }

  return (
    chart.xAxis.find((axis) => !axis?.options?.isInternal) ||
    chart.xAxis[0] ||
    null
  );
}

function getAxisViewport(axis) {
  if (!axis) {
    return null;
  }

  const minimum = toFiniteNumber(axis.min);

  const maximum = toFiniteNumber(axis.max);

  if (minimum === null || maximum === null) {
    return null;
  }

  return normalizeBounds(minimum, maximum);
}

function resolveEventTrigger(event) {
  return String(
    event?.trigger || event?.triggerOp || event?.eventArguments?.trigger || "",
  );
}

/* ==========================================================================
   Public State Helpers
   ========================================================================== */

function cloneBounds(bounds) {
  if (!bounds) {
    return null;
  }

  return {
    minimum: bounds.minimum,

    maximum: bounds.maximum,
  };
}

function cloneRangeState(state) {
  if (!state) {
    return null;
  }

  return {
    range: state.range,

    dataBounds: cloneBounds(state.dataBounds),

    viewport: cloneBounds(state.viewport),

    followLatest: state.followLatest,

    liveWindowDuration: state.liveWindowDuration,

    userControlled: state.userControlled,

    initialized: state.initialized,
  };
}

/* ==========================================================================
   Navigator Controller
   ========================================================================== */

class MarketChartNavigatorController {
  constructor(configuration = {}) {
    if (!configuration.chart) {
      throw new TypeError(
        "Market Chart Navigator requires a Highcharts chart.",
      );
    }

    this.chart = configuration.chart;

    const chartWindow = this.chart.renderTo?.ownerDocument?.defaultView;

    this.Highcharts =
      configuration.Highcharts ||
      chartWindow?.Highcharts ||
      globalThis.Highcharts ||
      null;

    this.configuration = {
      range: DEFAULT_RANGE,

      data: [],

      enabled: true,

      followLatest: true,

      liveWindowDuration: DEFAULT_LIVE_WINDOW_DURATION,

      edgeToleranceRatio: DEFAULT_EDGE_TOLERANCE_RATIO,

      edgeToleranceMinimum: DEFAULT_EDGE_TOLERANCE_MINIMUM,

      onViewportChange: null,

      onFollowChange: null,

      ...configuration,
    };

    this.enabled = this.configuration.enabled !== false;

    this.activeRange = normalizeRange(this.configuration.range);

    this.rangeStates = new Map();

    this.destroyed = false;

    this.applyingExtremes = false;

    this.removeAxisEvent = null;

    this.handleAfterSetExtremes = this.handleAfterSetExtremes.bind(this);

    this.initializeRangeState(this.activeRange, this.configuration.data, {
      followLatest: this.configuration.followLatest !== false,

      resetViewport: true,
    });

    this.bind();
  }

  /* ========================================================================
     Axis Event
     ======================================================================== */

  bind() {
    if (!this.enabled || this.destroyed || this.removeAxisEvent) {
      return;
    }

    const axis = getMainXAxis(this.chart);

    if (!axis) {
      return;
    }

    if (this.Highcharts && typeof this.Highcharts.addEvent === "function") {
      this.removeAxisEvent = this.Highcharts.addEvent(
        axis,
        "afterSetExtremes",
        this.handleAfterSetExtremes,
      );

      return;
    }

    /*
     * Fallback for Highcharts builds that do
     * not expose addEvent().
     */
    const originalHandler = axis.options?.events?.afterSetExtremes;

    const controller = this;

    const fallbackHandler = function fallbackAfterSetExtremes(event) {
      if (typeof originalHandler === "function") {
        originalHandler.call(this, event);
      }

      controller.handleAfterSetExtremes(event);
    };

    axis.update(
      {
        events: {
          afterSetExtremes: fallbackHandler,
        },
      },
      false,
    );

    this.removeAxisEvent = () => {
      if (this.destroyed || !this.chart) {
        return;
      }

      const currentAxis = getMainXAxis(this.chart);

      currentAxis?.update(
        {
          events: {
            afterSetExtremes: originalHandler,
          },
        },
        false,
      );
    };
  }
  unbind() {
    if (typeof this.removeAxisEvent === "function") {
      this.removeAxisEvent();
    }

    this.removeAxisEvent = null;
  }

  /* ========================================================================
     Range State
     ======================================================================== */

  initializeRangeState(range, data, options = {}) {
    const normalizedRange = normalizeRange(range);

    const dataBounds = getDataBounds(data);

    const existing = this.rangeStates.get(normalizedRange);

    const resetViewport = options.resetViewport === true;

    const followLatest =
      options.followLatest ??
      existing?.followLatest ??
      this.configuration.followLatest !== false;

    const liveWindowDuration = resolveRangeDuration(
      options.liveWindowDuration ??
        existing?.liveWindowDuration ??
        this.configuration.liveWindowDuration,

      normalizedRange,
    );

    let viewport = null;

    if (dataBounds && existing?.viewport && !resetViewport) {
      viewport = normalizeViewport(existing.viewport, dataBounds);
    }

    if (!viewport && dataBounds) {
      viewport = followLatest
        ? createTrailingViewport(dataBounds, liveWindowDuration)
        : createFullViewport(dataBounds);
    }

    const state = {
      range: normalizedRange,

      dataBounds,

      viewport,

      followLatest: Boolean(followLatest),

      liveWindowDuration,

      userControlled: resetViewport ? false : Boolean(existing?.userControlled),

      initialized: true,
    };

    this.rangeStates.set(normalizedRange, state);

    return state;
  }

  getRangeState(range = this.activeRange) {
    return this.rangeStates.get(normalizeRange(range)) || null;
  }

  ensureRangeState(range, data = [], options = {}) {
    const normalizedRange = normalizeRange(range);

    const existing = this.rangeStates.get(normalizedRange);

    if (existing) {
      return existing;
    }

    return this.initializeRangeState(normalizedRange, data, options);
  }

  /* ========================================================================
     Edge Detection
     ======================================================================== */

  getEdgeTolerance(viewport, dataBounds) {
    const duration =
      getBoundsDuration(viewport) || getBoundsDuration(dataBounds);

    const ratio = toPositiveNumber(
      this.configuration.edgeToleranceRatio,

      DEFAULT_EDGE_TOLERANCE_RATIO,
    );

    const minimum = toPositiveNumber(
      this.configuration.edgeToleranceMinimum,

      DEFAULT_EDGE_TOLERANCE_MINIMUM,
    );

    return Math.max(minimum, duration * ratio);
  }

  isAtLatestEdge(viewport, dataBounds) {
    if (!viewport || !dataBounds) {
      return true;
    }

    const tolerance = this.getEdgeTolerance(viewport, dataBounds);

    return dataBounds.maximum - viewport.maximum <= tolerance;
  }

  /* ========================================================================
     Notifications
     ======================================================================== */

  notifyViewportChange(state, detail = {}) {
    if (typeof this.configuration.onViewportChange !== "function") {
      return;
    }

    try {
      this.configuration.onViewportChange(
        {
          range: state.range,

          viewport: cloneBounds(state.viewport),

          dataBounds: cloneBounds(state.dataBounds),

          followLatest: state.followLatest,

          userControlled: state.userControlled,

          ...detail,
        },

        this,
      );
    } catch (error) {
      console.error("Market Chart viewport callback failed.", error);
    }
  }

  notifyFollowChange(state, detail = {}) {
    if (typeof this.configuration.onFollowChange !== "function") {
      return;
    }

    try {
      this.configuration.onFollowChange(
        {
          range: state.range,

          followLatest: state.followLatest,

          viewport: cloneBounds(state.viewport),

          dataBounds: cloneBounds(state.dataBounds),

          ...detail,
        },

        this,
      );
    } catch (error) {
      console.error("Market Chart follow callback failed.", error);
    }
  }

  /* ========================================================================
     Axis Interaction
     ======================================================================== */

  handleAfterSetExtremes(event) {
    if (this.destroyed || !this.enabled || this.applyingExtremes) {
      return;
    }

    const trigger = resolveEventTrigger(event);

    if (INTERNAL_TRIGGERS.has(trigger)) {
      return;
    }

    const state = this.getRangeState();

    if (!state?.dataBounds) {
      return;
    }

    const eventViewport = normalizeBounds(event?.min, event?.max);

    const axisViewport = getAxisViewport(getMainXAxis(this.chart));

    const viewport = normalizeViewport(
      eventViewport || axisViewport,

      state.dataBounds,
    );

    if (!viewport) {
      return;
    }

    const previousFollow = state.followLatest;

    state.viewport = viewport;

    /*
     * Navigator drag, scrollbar drag, pan, and
     * zoom never select a named range.
     */
    state.userControlled =
      USER_TRIGGERS.has(trigger) || Boolean(event?.DOMEvent);

    state.followLatest = this.isAtLatestEdge(viewport, state.dataBounds);

    this.notifyViewportChange(state, {
      source: "user",

      trigger: trigger || "axis",
    });

    if (previousFollow !== state.followLatest) {
      this.notifyFollowChange(state, {
        source: "user",

        trigger: trigger || "axis",
      });
    }
  }

  /* ========================================================================
     Axis Extremes
     ======================================================================== */

  applyViewport(viewport, options = {}) {
    if (this.destroyed || !this.enabled) {
      return false;
    }

    const state = this.getRangeState();

    if (!state?.dataBounds) {
      return false;
    }

    const normalizedViewport = normalizeViewport(viewport, state.dataBounds);

    if (!normalizedViewport) {
      return false;
    }

    const axis = getMainXAxis(this.chart);

    if (!axis) {
      return false;
    }

    const redraw = options.redraw !== false;

    const animation = options.animation ?? false;

    const trigger = options.trigger || "market-chart-data";

    state.viewport = normalizedViewport;

    this.applyingExtremes = true;

    try {
      axis.setExtremes(
        normalizedViewport.minimum,

        normalizedViewport.maximum,

        redraw,
        animation,
        {
          trigger,
        },
      );
    } finally {
      this.applyingExtremes = false;
    }

    if (options.notify === true) {
      this.notifyViewportChange(state, {
        source: options.source || "programmatic",

        trigger,
      });
    }

    return true;
  }

  applyActiveViewport(options = {}) {
    const state = this.getRangeState();

    if (!state?.dataBounds) {
      return false;
    }

    const viewport = state.viewport || createFullViewport(state.dataBounds);

    return this.applyViewport(viewport, options);
  }

  /* ========================================================================
     Range Activation
     ======================================================================== */

  activateRange(range, data, options = {}) {
    if (this.destroyed) {
      return null;
    }

    const normalizedRange = normalizeRange(range);

    const existingState = this.getRangeState(normalizedRange);

    const preserveViewport = options.preserveViewport !== false;

    const resetViewport = options.resetViewport === true || !preserveViewport;

    const state = this.initializeRangeState(normalizedRange, data, {
      resetViewport,

      followLatest:
        options.followLatest ??
        existingState?.followLatest ??
        this.configuration.followLatest !== false,

      liveWindowDuration: options.liveWindowDuration,
    });

    this.activeRange = normalizedRange;

    if (!state.dataBounds) {
      return cloneRangeState(state);
    }

    /*
     * Restore a preserved user viewport only
     * when explicitly requested. Otherwise use
     * full range or the latest live window.
     */
    if (!existingState || resetViewport || !existingState.userControlled) {
      state.viewport = state.followLatest
        ? createTrailingViewport(
            state.dataBounds,

            state.liveWindowDuration,
          )
        : createFullViewport(state.dataBounds);

      state.userControlled = false;
    }

    this.applyActiveViewport({
      redraw: options.redraw !== false,

      animation: options.animation ?? false,

      notify: options.notify === true,

      source: options.source || "range",

      trigger: "market-chart-range",
    });

    return cloneRangeState(state);
  }

  /* ========================================================================
     Data Updates
     ======================================================================== */

  updateData(data, options = {}) {
    if (this.destroyed) {
      return null;
    }

    const range = normalizeRange(options.range ?? this.activeRange);

    const state = this.ensureRangeState(range, data);

    const previousBounds = cloneBounds(state.dataBounds);

    const previousViewport = cloneBounds(state.viewport);

    const nextBounds = getDataBounds(data);

    state.dataBounds = nextBounds;

    if (!nextBounds) {
      state.viewport = null;

      state.userControlled = false;

      return cloneRangeState(state);
    }

    const isActiveRange = range === this.activeRange;

    const isLiveUpdate = options.live === true;

    const shouldFollowLatest =
      isLiveUpdate && state.followLatest && options.followLatest !== false;

    /*
     * New datasets begin with their complete
     * extent unless live-following requests a
     * trailing window.
     */
    if (!previousBounds || !previousViewport) {
      state.viewport = shouldFollowLatest
        ? createTrailingViewport(nextBounds, state.liveWindowDuration)
        : createFullViewport(nextBounds);
    } else if (shouldFollowLatest) {
      const previousDuration = getBoundsDuration(previousViewport);

      const dataDuration = getBoundsDuration(nextBounds);

      const configuredDuration = toPositiveNumber(
        options.liveWindowDuration ?? state.liveWindowDuration,

        null,
      );

      const duration = Math.min(
        configuredDuration || previousDuration || dataDuration,

        dataDuration,
      );

      state.liveWindowDuration = configuredDuration || state.liveWindowDuration;

      state.viewport = {
        minimum: nextBounds.maximum - duration,

        maximum: nextBounds.maximum,
      };

      state.viewport = normalizeViewport(state.viewport, nextBounds);
    } else {
      /*
       * Preserve a manually selected viewport
       * while new data arrives.
       */
      state.viewport = normalizeViewport(previousViewport, nextBounds);
    }

    /*
     * Updating an inactive range changes only
     * its stored state.
     */
    if (!isActiveRange) {
      return cloneRangeState(state);
    }

    this.applyActiveViewport({
      redraw: options.redraw !== false,

      animation: options.animation ?? false,

      notify: options.notify === true,

      source: isLiveUpdate ? "live" : "data",

      trigger: isLiveUpdate ? "market-chart-live" : "market-chart-data",
    });

    return cloneRangeState(state);
  }

  /* ========================================================================
     Live Data
     ======================================================================== */
  appendLiveData(data, options = {}) {
    const range = normalizeRange(options.range ?? this.activeRange);

    return this.updateData(data, {
      ...options,

      range,

      live: true,
    });
  }

  /**
   * Enables live-following and moves the
   * viewport to the latest edge while
   * preserving its current duration.
   */
  followLatest(options = {}) {
    if (this.destroyed) {
      return false;
    }

    const range = normalizeRange(options.range ?? this.activeRange);

    const state = this.getRangeState(range);

    if (!state?.dataBounds || !state.viewport) {
      return false;
    }

    const previousFollow = state.followLatest;

    state.followLatest = true;

    state.userControlled = false;

    const viewportDuration = getBoundsDuration(state.viewport);

    const dataDuration = getBoundsDuration(state.dataBounds);

    const requestedDuration = toPositiveNumber(
      options.liveWindowDuration ?? state.liveWindowDuration,

      viewportDuration || dataDuration,
    );

    const duration = Math.min(requestedDuration, dataDuration);

    state.liveWindowDuration = requestedDuration;

    state.viewport = {
      minimum: state.dataBounds.maximum - duration,

      maximum: state.dataBounds.maximum,
    };

    state.viewport = normalizeViewport(state.viewport, state.dataBounds);

    if (range === this.activeRange) {
      this.applyActiveViewport({
        redraw: options.redraw !== false,

        animation: options.animation ?? false,

        notify: options.notify === true,

        source: "follow",

        trigger: "market-chart-live",
      });
    }

    if (!previousFollow) {
      this.notifyFollowChange(state, {
        source: "programmatic",

        trigger: "market-chart-live",
      });
    }

    return true;
  }

  stopFollowing(options = {}) {
    if (this.destroyed) {
      return false;
    }

    const range = normalizeRange(options.range ?? this.activeRange);

    const state = this.getRangeState(range);

    if (!state) {
      return false;
    }

    const previousFollow = state.followLatest;

    state.followLatest = false;

    if (options.userControlled !== false) {
      state.userControlled = true;
    }

    if (previousFollow) {
      this.notifyFollowChange(state, {
        source: options.source || "programmatic",

        trigger: options.trigger || "manual",
      });
    }

    return true;
  }

  /* ========================================================================
     Viewport Reset
     ======================================================================== */

  resetToFullRange(options = {}) {
    if (this.destroyed) {
      return false;
    }

    const range = normalizeRange(options.range ?? this.activeRange);

    const state = this.getRangeState(range);

    if (!state?.dataBounds) {
      return false;
    }

    const previousFollow = state.followLatest;

    state.viewport = createFullViewport(state.dataBounds);

    state.followLatest = options.followLatest !== false;

    state.userControlled = false;

    if (range === this.activeRange) {
      this.applyActiveViewport({
        redraw: options.redraw !== false,

        animation: options.animation ?? false,

        notify: options.notify === true,

        source: "reset",

        trigger: "market-chart-restore",
      });
    }

    if (previousFollow !== state.followLatest) {
      this.notifyFollowChange(state, {
        source: "reset",

        trigger: "market-chart-restore",
      });
    }

    return true;
  }

  resetRange(range, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const normalizedRange = normalizeRange(range);

    const state = this.getRangeState(normalizedRange);

    if (!state) {
      return false;
    }

    state.viewport = createFullViewport(state.dataBounds);

    state.followLatest = options.followLatest !== false;

    state.userControlled = false;

    if (normalizedRange === this.activeRange && state.dataBounds) {
      this.applyActiveViewport({
        redraw: options.redraw !== false,

        animation: options.animation ?? false,

        notify: options.notify === true,

        source: "reset",

        trigger: "market-chart-restore",
      });
    }

    return true;
  }

  resetAll(options = {}) {
    if (this.destroyed) {
      return false;
    }

    this.rangeStates.forEach((state) => {
      state.viewport = createFullViewport(state.dataBounds);

      state.followLatest = options.followLatest !== false;

      state.userControlled = false;
    });

    if (options.apply !== false) {
      this.applyActiveViewport({
        redraw: options.redraw !== false,

        animation: options.animation ?? false,

        notify: options.notify === true,

        source: "reset",

        trigger: "market-chart-restore",
      });
    }

    return true;
  }

  /* ========================================================================
     Resize
     ======================================================================== */

  resize(options = {}) {
    if (this.destroyed || !this.enabled) {
      return false;
    }

    const state = this.getRangeState();

    if (!state?.viewport) {
      return false;
    }

    /*
     * Reapply exact logical extremes after
     * Highcharts recalculates its plot box.
     */
    return this.applyActiveViewport({
      redraw: options.redraw !== false,

      animation: false,

      notify: false,

      source: "resize",

      trigger: "market-chart-resize",
    });
  }

  /* ========================================================================
     Public State
     ======================================================================== */

  getActiveRange() {
    return this.activeRange;
  }

  getViewport(range = this.activeRange) {
    return cloneBounds(this.getRangeState(range)?.viewport);
  }

  getDataBounds(range = this.activeRange) {
    return cloneBounds(this.getRangeState(range)?.dataBounds);
  }

  isFollowing(range = this.activeRange) {
    return Boolean(this.getRangeState(range)?.followLatest);
  }

  isUserControlled(range = this.activeRange) {
    return Boolean(this.getRangeState(range)?.userControlled);
  }

  setLiveWindowDuration(duration, options = {}) {
    if (this.destroyed) {
      return false;
    }

    const range = normalizeRange(options.range ?? this.activeRange);

    const state = this.getRangeState(range);

    const normalizedDuration = toPositiveNumber(duration, null);

    if (!state || normalizedDuration === null) {
      return false;
    }

    state.liveWindowDuration = normalizedDuration;

    if (options.apply !== false && state.followLatest) {
      return this.followLatest({
        ...options,

        range,

        liveWindowDuration: normalizedDuration,
      });
    }

    return true;
  }

  getState() {
    const ranges = {};

    this.rangeStates.forEach((state, range) => {
      ranges[range] = cloneRangeState(state);
    });

    return {
      enabled: this.enabled,

      destroyed: this.destroyed,

      activeRange: this.activeRange,

      applyingExtremes: this.applyingExtremes,

      active: cloneRangeState(this.getRangeState()),

      ranges,
    };
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    /*
     * Unbind before marking destroyed because
     * the fallback cleanup requires chart
     * access.
     */
    this.unbind();

    this.rangeStates.clear();

    this.chart = null;

    this.Highcharts = null;

    this.applyingExtremes = false;

    this.destroyed = true;
  }
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createMarketChartNavigatorController(configuration = {}) {
  return new MarketChartNavigatorController(configuration);
}

/* ==========================================================================
   Utilities
   ========================================================================== */

export {
  createFullViewport,
  createTrailingViewport,
  getDataBounds,
  normalizeRange,
  normalizeViewport,
};
