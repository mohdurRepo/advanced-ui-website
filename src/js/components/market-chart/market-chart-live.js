/* ==========================================================================
   Market Chart Live Updates
   ========================================================================== */

/*
 * This module contains no Highcharts-specific code.
 *
 * It owns:
 * - Recursive update scheduling
 * - Request cancellation
 * - Visibility handling
 * - Online/offline handling
 * - Retry backoff
 * - One-minute interval alignment
 *
 * The Market Chart controller supplies:
 * - loadPoint()
 * - onPoint()
 * - getContext()
 */

/* ==========================================================================
   Defaults
   ========================================================================== */

const DEFAULT_INTERVAL = 60_000;
const DEFAULT_RETRY_DELAY = 5_000;
const DEFAULT_MAX_RETRY_DELAY = 60_000;
const MINIMUM_INTERVAL = 1_000;

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizeDuration(value, fallback, minimum = 0) {
  const duration = Number(value);

  if (!Number.isFinite(duration)) {
    return fallback;
  }

  return Math.max(minimum, duration);
}

function isPromiseLike(value) {
  return Boolean(value && typeof value.then === "function");
}

function isElementVisible(element) {
  if (!(element instanceof Element)) {
    return true;
  }

  if (!element.isConnected) {
    return false;
  }

  if (element.hidden || element.closest("[hidden]")) {
    return false;
  }

  const styles = window.getComputedStyle(element);

  if (styles.display === "none" || styles.visibility === "hidden") {
    return false;
  }

  return element.getClientRects().length > 0;
}

/* ==========================================================================
   Live Controller
   ========================================================================== */

export class MarketChartLiveController {
  constructor(configuration = {}) {
    this.configuration = {
      enabled: false,

      interval: DEFAULT_INTERVAL,
      immediate: false,
      alignToInterval: true,

      retryDelay: DEFAULT_RETRY_DELAY,
      maxRetryDelay: DEFAULT_MAX_RETRY_DELAY,

      pauseWhenHidden: true,
      pauseWhenOffline: true,

      element: null,

      loadPoint: null,
      onPoint: null,
      onError: null,
      onStateChange: null,
      getContext: null,

      ...configuration,
    };

    this.configuration.interval = normalizeDuration(
      this.configuration.interval,
      DEFAULT_INTERVAL,
      MINIMUM_INTERVAL,
    );

    this.configuration.retryDelay = normalizeDuration(
      this.configuration.retryDelay,
      DEFAULT_RETRY_DELAY,
      MINIMUM_INTERVAL,
    );

    this.configuration.maxRetryDelay = normalizeDuration(
      this.configuration.maxRetryDelay,
      DEFAULT_MAX_RETRY_DELAY,
      this.configuration.retryDelay,
    );

    this.running = false;
    this.paused = false;
    this.destroyed = false;
    this.updating = false;

    this.failureCount = 0;

    this.timeoutId = null;
    this.requestController = null;

    this.abortController = new AbortController();

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    this.handleOnline = this.handleOnline.bind(this);

    this.handleOffline = this.handleOffline.bind(this);
  }

  /* ========================================================================
     State
     ===================================================================== */

  setState(state, detail = {}) {
    const callback = this.configuration.onStateChange;

    if (typeof callback === "function") {
      callback({
        state,
        running: this.running,
        paused: this.paused,
        updating: this.updating,
        failureCount: this.failureCount,
        ...detail,
      });
    }
  }

  /* ========================================================================
     Capability
     ===================================================================== */

  canStart() {
    return (
      !this.destroyed &&
      this.configuration.enabled &&
      typeof this.configuration.loadPoint === "function" &&
      typeof this.configuration.onPoint === "function"
    );
  }

  canUpdate() {
    if (!this.running || this.paused || this.destroyed || this.updating) {
      return false;
    }

    if (this.configuration.pauseWhenHidden && document.hidden) {
      return false;
    }

    if (this.configuration.pauseWhenOffline && !navigator.onLine) {
      return false;
    }

    if (
      this.configuration.pauseWhenHidden &&
      !isElementVisible(this.configuration.element)
    ) {
      return false;
    }

    return true;
  }

  /* ========================================================================
     Start
     ===================================================================== */

  start() {
    if (!this.canStart()) {
      return false;
    }

    if (this.running) {
      return true;
    }

    this.running = true;
    this.paused = false;
    this.failureCount = 0;

    this.bindEvents();

    this.setState("started");

    if (this.configuration.immediate) {
      this.update();
    } else {
      this.scheduleNext();
    }

    return true;
  }

  /* ========================================================================
     Scheduling
     ===================================================================== */

  getNextDelay() {
    const interval = this.configuration.interval;

    if (!this.configuration.alignToInterval) {
      return interval;
    }

    const now = Date.now();
    const remainder = now % interval;
    const delay = interval - remainder;

    /*
     * Avoid a near-immediate request when initialization happens exactly on
     * an interval boundary.
     */

    return delay < 250 ? interval : delay;
  }

  getRetryDelay() {
    const baseDelay = this.configuration.retryDelay;

    const maxDelay = this.configuration.maxRetryDelay;

    const exponent = Math.max(0, this.failureCount - 1);

    return Math.min(maxDelay, baseDelay * 2 ** exponent);
  }

  scheduleNext(delay = null) {
    if (!this.running || this.paused || this.destroyed) {
      return;
    }

    this.clearSchedule();

    const nextDelay =
      delay ??
      (this.failureCount > 0 ? this.getRetryDelay() : this.getNextDelay());

    this.timeoutId = window.setTimeout(() => {
      this.timeoutId = null;

      this.update();
    }, nextDelay);

    this.setState("scheduled", {
      delay: nextDelay,
      scheduledAt: Date.now() + nextDelay,
    });
  }

  clearSchedule() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);

      this.timeoutId = null;
    }
  }

  /* ========================================================================
     Update
     ===================================================================== */

  async update() {
    if (!this.canUpdate()) {
      if (this.running && !this.paused && !this.destroyed) {
        this.scheduleNext();
      }

      return false;
    }

    this.updating = true;

    this.requestController = new AbortController();

    const context = this.createUpdateContext(this.requestController.signal);

    this.setState("updating", {
      context,
    });

    try {
      const result = this.configuration.loadPoint(context);

      const point = isPromiseLike(result) ? await result : result;

      if (this.requestController.signal.aborted) {
        return false;
      }

      if (point !== null && point !== undefined) {
        await this.configuration.onPoint(point, context);
      }

      this.failureCount = 0;

      this.setState("updated", {
        point,
        context,
        updatedAt: Date.now(),
      });

      return true;
    } catch (error) {
      if (
        error?.name === "AbortError" ||
        this.requestController?.signal.aborted
      ) {
        this.setState("aborted");

        return false;
      }

      this.failureCount += 1;

      this.setState("error", {
        error,
        context,
      });

      if (typeof this.configuration.onError === "function") {
        this.configuration.onError(error, context);
      }

      return false;
    } finally {
      this.updating = false;
      this.requestController = null;

      if (this.running && !this.paused && !this.destroyed) {
        this.scheduleNext();
      }
    }
  }

  /* ========================================================================
     Context
     ===================================================================== */

  createUpdateContext(signal) {
    let suppliedContext = {};

    if (typeof this.configuration.getContext === "function") {
      const result = this.configuration.getContext();

      if (result && typeof result === "object") {
        suppliedContext = result;
      }
    }

    return {
      ...suppliedContext,

      signal,

      requestedAt: Date.now(),
      interval: this.configuration.interval,
    };
  }

  /* ========================================================================
     Pause and Resume
     ===================================================================== */

  pause(reason = "manual") {
    if (!this.running || this.paused || this.destroyed) {
      return false;
    }

    this.paused = true;

    this.clearSchedule();
    this.abortRequest();

    this.setState("paused", {
      reason,
    });

    return true;
  }

  resume(options = {}) {
    if (!this.running || !this.paused || this.destroyed) {
      return false;
    }

    const { immediate = false, reason = "manual" } = options;

    this.paused = false;

    this.setState("resumed", {
      reason,
    });

    if (immediate) {
      this.update();
    } else {
      this.scheduleNext();
    }

    return true;
  }

  /* ========================================================================
     Visibility
     ===================================================================== */

  handleVisibilityChange() {
    if (!this.configuration.pauseWhenHidden) {
      return;
    }

    if (document.hidden) {
      this.pause("document-hidden");

      return;
    }

    if (this.paused && isElementVisible(this.configuration.element)) {
      this.resume({
        immediate: true,
        reason: "document-visible",
      });
    }
  }

  /* ========================================================================
     Network
     ===================================================================== */

  handleOnline() {
    if (!this.configuration.pauseWhenOffline) {
      return;
    }

    if (this.paused) {
      this.resume({
        immediate: true,
        reason: "online",
      });
    }
  }

  handleOffline() {
    if (!this.configuration.pauseWhenOffline) {
      return;
    }

    this.pause("offline");
  }

  /* ========================================================================
     Events
     ===================================================================== */

  bindEvents() {
    const signal = this.abortController.signal;

    document.addEventListener("visibilitychange", this.handleVisibilityChange, {
      signal,
    });

    window.addEventListener("online", this.handleOnline, { signal });

    window.addEventListener("offline", this.handleOffline, { signal });
  }

  /* ========================================================================
     Request Cancellation
     ===================================================================== */

  abortRequest() {
    this.requestController?.abort();
    this.requestController = null;
    this.updating = false;
  }

  /* ========================================================================
     Stop
     ===================================================================== */

  stop(reason = "manual") {
    if (!this.running) {
      return false;
    }

    this.running = false;
    this.paused = false;

    this.clearSchedule();
    this.abortRequest();

    this.setState("stopped", {
      reason,
    });

    return true;
  }

  /* ========================================================================
     Destroy
     ===================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.stop("destroyed");

    this.abortController.abort();

    this.destroyed = true;

    this.setState("destroyed");
  }
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createMarketChartLiveController(configuration) {
  return new MarketChartLiveController(configuration);
}
