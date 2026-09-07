/* ==========================================================================
   Market Chart Live
   ========================================================================== */

/*
 * Owns the network polling lifecycle only.
 *
 * It does not:
 *
 * - render Highcharts;
 * - mutate chart series;
 * - control the navigator;
 * - manage chart ranges.
 *
 * The chart controller decides what to do with received market data.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_INTERVAL = 60_000;

const DEFAULT_MAX_RETRY_DELAY = 5 * 60_000;

/* ==========================================================================
   Helpers
   ========================================================================== */

function toPositiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createTimeoutError() {
  const error = new Error("Live market request timed out.");

  error.name = "TimeoutError";

  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === 20;
}

/* ==========================================================================
   Live Controller
   ========================================================================== */

export class MarketChartLiveController {
  constructor(configuration = {}) {
    if (typeof configuration.fetchPoint !== "function") {
      throw new TypeError("Market Chart Live requires fetchPoint().");
    }

    this.configuration = {
      interval: DEFAULT_INTERVAL,

      alignToInterval: true,

      immediate: false,

      pauseWhenHidden: true,

      retry: true,

      maxRetryDelay: DEFAULT_MAX_RETRY_DELAY,

      requestTimeout: 0,

      onPoint: null,
      onStateChange: null,
      onError: null,

      ...configuration,
    };

    const environment = configuration.environment || {};

    this.window = environment.window || globalThis.window;

    this.document = environment.document || globalThis.document;

    this.navigator = environment.navigator || globalThis.navigator;

    this.now =
      typeof environment.now === "function" ? environment.now : Date.now;

    this.setTimeout =
      environment.setTimeout ||
      this.window?.setTimeout?.bind(this.window) ||
      globalThis.setTimeout;

    this.clearTimeout =
      environment.clearTimeout ||
      this.window?.clearTimeout?.bind(this.window) ||
      globalThis.clearTimeout;

    const AbortControllerConstructor =
      environment.AbortController ||
      this.window?.AbortController ||
      globalThis.AbortController;

    if (typeof AbortControllerConstructor !== "function") {
      throw new TypeError("Market Chart Live requires AbortController.");
    }

    this.AbortController = AbortControllerConstructor;

    this.interval = toPositiveNumber(
      this.configuration.interval,
      DEFAULT_INTERVAL,
    );

    this.maxRetryDelay = toPositiveNumber(
      this.configuration.maxRetryDelay,
      DEFAULT_MAX_RETRY_DELAY,
    );

    this.requestTimeout = Math.max(
      0,
      Number(this.configuration.requestTimeout) || 0,
    );

    /* ----------------------------------------------------------------------
       Runtime State
       ---------------------------------------------------------------------- */

    this.active = false;

    this.destroyed = false;

    this.inFlight = false;

    this.timer = null;

    this.requestTimer = null;

    this.requestController = null;

    this.refreshPending = false;

    this.pauseReasons = new Set();

    this.state = "idle";

    this.failureCount = 0;

    this.sequence = 0;

    this.requestSequence = 0;

    this.lastRequestedAt = null;

    this.lastUpdatedAt = null;

    this.nextUpdateAt = null;

    /* ----------------------------------------------------------------------
       Event Lifecycle
       ---------------------------------------------------------------------- */

    this.listenerController = new AbortControllerConstructor();

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    this.handleOnline = this.handleOnline.bind(this);

    this.handleOffline = this.handleOffline.bind(this);

    this.handlePageHide = this.handlePageHide.bind(this);

    this.handlePageShow = this.handlePageShow.bind(this);

    this.bindEnvironment();

    this.synchronizeEnvironment();
  }

  /* ==========================================================================
     Environment
     ========================================================================== */

  bindEnvironment() {
    const signal = this.listenerController.signal;

    this.document?.addEventListener?.(
      "visibilitychange",
      this.handleVisibilityChange,
      {
        signal,
      },
    );

    this.window?.addEventListener?.("online", this.handleOnline, {
      signal,
    });

    this.window?.addEventListener?.("offline", this.handleOffline, {
      signal,
    });

    /*
     * BFCache / page navigation support.
     */
    this.window?.addEventListener?.("pagehide", this.handlePageHide, {
      signal,
    });

    this.window?.addEventListener?.("pageshow", this.handlePageShow, {
      signal,
    });
  }

  synchronizeEnvironment() {
    if (this.configuration.pauseWhenHidden && this.document?.hidden) {
      this.pauseReasons.add("document-hidden");
    } else {
      this.pauseReasons.delete("document-hidden");
    }

    if (this.navigator?.onLine === false) {
      this.pauseReasons.add("offline");
    } else {
      this.pauseReasons.delete("offline");
    }
  }

  handleVisibilityChange() {
    if (this.configuration.pauseWhenHidden) {
      if (this.document?.hidden) {
        this.addPauseReason("document-hidden");
      } else {
        this.removePauseReason("document-hidden");
      }

      return;
    }

    /*
     * Even when background polling is allowed,
     * browsers may throttle timers.
     *
     * Refresh immediately when returning.
     */
    if (!this.document?.hidden) {
      this.refresh();
    }
  }

  handleOnline() {
    this.removePauseReason("offline");
  }

  handleOffline() {
    this.addPauseReason("offline");
  }

  handlePageHide() {
    this.addPauseReason("page-hidden");
  }

  handlePageShow() {
    this.removePauseReason("page-hidden");
  }

  /* ==========================================================================
     State
     ========================================================================== */

  emitState(state, detail = {}) {
    if (this.destroyed) {
      return;
    }

    const previousState = this.state;

    this.state = state;

    if (typeof this.configuration.onStateChange !== "function") {
      return;
    }

    this.configuration.onStateChange({
      ...this.getState(),

      previousState,

      ...detail,
    });
  }

  getPausedState() {
    if (this.pauseReasons.has("offline")) {
      return "offline";
    }

    if (
      this.pauseReasons.has("document-hidden") ||
      this.pauseReasons.has("page-hidden")
    ) {
      return "hidden";
    }

    return "paused";
  }

  /* ==========================================================================
     Pause
     ========================================================================== */

  addPauseReason(reason) {
    if (this.destroyed || !reason || this.pauseReasons.has(reason)) {
      return false;
    }

    this.pauseReasons.add(reason);

    this.clearTimer();

    this.refreshPending = false;

    this.abortRequest();

    if (this.active) {
      this.emitState(this.getPausedState(), {
        reason,
      });
    }

    return true;
  }

  removePauseReason(reason) {
    if (this.destroyed || !this.pauseReasons.has(reason)) {
      return false;
    }

    this.pauseReasons.delete(reason);

    if (!this.active || this.pauseReasons.size > 0) {
      return true;
    }

    /*
     * Always catch up immediately
     * after becoming active again.
     */
    this.schedule(0);

    return true;
  }

  /* ==========================================================================
     Scheduling
     ========================================================================== */

  clearTimer() {
    if (this.timer !== null) {
      this.clearTimeout(this.timer);

      this.timer = null;
    }

    this.nextUpdateAt = null;
  }

  getNextDelay() {
    if (!this.configuration.alignToInterval) {
      return this.interval;
    }

    const now = this.now();

    const remainder = now % this.interval;

    return remainder === 0 ? this.interval : this.interval - remainder;
  }

  schedule(delay = null) {
    this.clearTimer();

    if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
      return false;
    }

    const resolvedDelay =
      delay === null ? this.getNextDelay() : Math.max(0, Number(delay) || 0);

    this.nextUpdateAt = this.now() + resolvedDelay;

    this.emitState("waiting", {
      nextUpdateAt: this.nextUpdateAt,

      nextUpdateIn: resolvedDelay,
    });

    this.timer = this.setTimeout(() => {
      this.timer = null;

      this.nextUpdateAt = null;

      void this.execute();
    }, resolvedDelay);

    return true;
  }

  getRetryDelay() {
    const exponent = Math.min(Math.max(this.failureCount - 1, 0), 8);

    return Math.min(
      this.interval * 2 ** exponent,

      this.maxRetryDelay,
    );
  }

  /* ==========================================================================
     Request
     ========================================================================== */

  abortRequest() {
    const controller = this.requestController;

    if (!controller || controller.signal.aborted) {
      return false;
    }

    controller.abort();

    return true;
  }

  clearRequestTimeout() {
    if (this.requestTimer === null) {
      return;
    }

    this.clearTimeout(this.requestTimer);

    this.requestTimer = null;
  }

  /* ==========================================================================
     Fetch
     ========================================================================== */

  async execute() {
    if (
      this.destroyed ||
      !this.active ||
      this.inFlight ||
      this.pauseReasons.size > 0
    ) {
      return false;
    }

    this.inFlight = true;

    const controller = new this.AbortController();

    this.requestController = controller;

    const requestId = ++this.requestSequence;

    const requestedAt = this.now();

    const nextSequence = this.sequence + 1;

    this.lastRequestedAt = requestedAt;

    this.emitState("updating", {
      requestedAt,
      sequence: nextSequence,
      requestId,
    });

    if (this.requestTimeout > 0) {
      this.requestTimer = this.setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort(createTimeoutError());
        }
      }, this.requestTimeout);
    }

    try {
      const point = await this.configuration.fetchPoint({
        signal: controller.signal,

        requestedAt,

        sequence: nextSequence,

        requestId,
      });

      this.clearRequestTimeout();

      if (
        controller.signal.aborted ||
        this.requestController !== controller ||
        !this.active
      ) {
        return false;
      }

      if (
        point !== null &&
        point !== undefined &&
        typeof this.configuration.onPoint === "function"
      ) {
        const updatedAt = this.now();

        await this.configuration.onPoint(point, {
          requestedAt,

          updatedAt,

          sequence: nextSequence,

          requestId,
        });

        this.lastUpdatedAt = updatedAt;
      }

      this.sequence = nextSequence;

      this.failureCount = 0;

      this.emitState("live", {
        point,

        requestedAt,

        updatedAt: this.now(),

        sequence: this.sequence,

        requestId,
      });

      return true;
    } catch (error) {
      const resolvedError = controller.signal.aborted
        ? controller.signal.reason || error
        : error;

      const timedOut = resolvedError?.name === "TimeoutError";

      const cancelled =
        !timedOut && (isAbortError(resolvedError) || controller.signal.aborted);

      if (
        cancelled ||
        this.destroyed ||
        !this.active ||
        this.pauseReasons.size > 0
      ) {
        return false;
      }

      this.failureCount += 1;

      const metadata = {
        requestedAt,

        failureCount: this.failureCount,

        sequence: this.sequence,

        requestId,

        timedOut,
      };

      this.emitState("error", {
        error: resolvedError,

        ...metadata,
      });

      if (typeof this.configuration.onError === "function") {
        try {
          this.configuration.onError(resolvedError, metadata);
        } catch (callbackError) {
          console.error(
            "Market chart live error callback failed.",
            callbackError,
          );
        }
      }

      if (this.configuration.retry === false) {
        this.active = false;
      }

      return false;
    } finally {
      this.clearRequestTimeout();

      if (this.requestController === controller) {
        this.requestController = null;
      }

      this.inFlight = false;

      if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
        return;
      }

      if (this.refreshPending) {
        this.refreshPending = false;

        this.schedule(0);

        return;
      }

      if (this.failureCount > 0) {
        this.schedule(this.getRetryDelay());

        return;
      }

      /*
       * Recursive setTimeout:
       *
       * schedule the next request only
       * after this one has completed.
       */
      this.schedule();
    }
  }

  /* ==========================================================================
     Public Lifecycle
     ========================================================================== */

  start() {
    if (this.destroyed) {
      return false;
    }

    if (this.active) {
      return true;
    }

    this.active = true;

    this.failureCount = 0;

    this.refreshPending = false;

    this.synchronizeEnvironment();

    if (this.pauseReasons.size > 0) {
      this.emitState(this.getPausedState());

      return true;
    }

    this.emitState("starting");

    this.schedule(this.configuration.immediate ? 0 : null);

    return true;
  }

  pause(reason = "manual") {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.addPauseReason(reason);
  }

  resume(reason = "manual") {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.removePauseReason(reason);
  }

  refresh() {
    if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
      return false;
    }

    this.clearTimer();

    if (this.inFlight) {
      this.refreshPending = true;

      return true;
    }

    void this.execute();

    return true;
  }

  stop() {
    if (this.destroyed) {
      return false;
    }

    this.active = false;

    this.refreshPending = false;

    this.clearTimer();

    this.abortRequest();

    this.clearRequestTimeout();

    this.failureCount = 0;

    this.pauseReasons.delete("manual");

    this.emitState("stopped");

    return true;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.active = false;

    this.refreshPending = false;

    this.clearTimer();

    this.clearRequestTimeout();

    this.abortRequest();

    this.listenerController.abort();

    this.pauseReasons.clear();

    this.emitState("destroyed", {
      destroyed: true,
    });

    this.destroyed = true;

    this.requestController = null;

    this.inFlight = false;
  }

  /* ==========================================================================
     Public State
     ========================================================================== */

  getState() {
    return {
      state: this.state,

      active: this.active,

      destroyed: this.destroyed,

      inFlight: this.inFlight,

      paused: this.pauseReasons.size > 0,

      pauseReasons: [...this.pauseReasons],

      interval: this.interval,

      alignToInterval: this.configuration.alignToInterval !== false,

      pauseWhenHidden: this.configuration.pauseWhenHidden !== false,

      requestTimeout: this.requestTimeout,

      maxRetryDelay: this.maxRetryDelay,

      failureCount: this.failureCount,

      sequence: this.sequence,

      requestSequence: this.requestSequence,

      refreshPending: this.refreshPending,

      lastRequestedAt: this.lastRequestedAt,

      lastUpdatedAt: this.lastUpdatedAt,

      nextUpdateAt: this.nextUpdateAt,
    };
  }
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createMarketChartLiveController(configuration = {}) {
  return new MarketChartLiveController(configuration);
}
