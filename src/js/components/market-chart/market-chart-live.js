/* ==========================================================================
   Market Chart Live Controller
   ========================================================================== */

const DEFAULT_INTERVAL = 60_000;
const DEFAULT_MAX_RETRY_DELAY = 5 * 60_000;
const MINIMUM_INTERVAL = 250;

/* ==========================================================================
   Helpers
   ========================================================================== */

function toPositiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === 20;
}

function isTimeoutError(error) {
  return error?.name === "TimeoutError";
}

function createAbortError(message) {
  return new DOMException(message, "AbortError");
}

function createTimeoutError(message) {
  return new DOMException(message, "TimeoutError");
}

function createEnvironment(environment = {}) {
  const root = typeof globalThis === "object" ? globalThis : {};

  return {
    window: environment.window ?? root.window ?? null,
    document: environment.document ?? root.document ?? null,
    navigator: environment.navigator ?? root.navigator ?? null,
    now: typeof environment.now === "function" ? environment.now : Date.now,
    setTimeout:
      environment.setTimeout ?? root.setTimeout?.bind(root) ?? (() => null),
    clearTimeout:
      environment.clearTimeout ?? root.clearTimeout?.bind(root) ?? (() => {}),
  };
}

/* ==========================================================================
   Live Controller
   ========================================================================== */

class MarketChartLiveController {
  constructor(configuration = {}) {
    if (typeof configuration.fetchPoint !== "function") {
      throw new TypeError(
        "Market Chart Live requires a fetchPoint() function.",
      );
    }

    this.configuration = {
      interval: DEFAULT_INTERVAL,

      /*
       * Align requests to clock boundaries.
       *
       * Example:
       * interval: 5_000
       *
       * Requests occur near:
       * 10:00:00
       * 10:00:05
       * 10:00:10
       */
      alignToInterval: true,

      /*
       * When true, the first request runs immediately after start().
       */
      immediate: false,

      /*
       * Keep attempting background polling.
       *
       * Browsers may throttle background timers, but this controller does not
       * intentionally stop them. It also performs an immediate catch-up
       * request when the page becomes visible again.
       */
      pauseWhenHidden: false,

      retry: true,
      maxRetryDelay: DEFAULT_MAX_RETRY_DELAY,

      /*
       * Zero disables request timeout handling.
       */
      requestTimeout: 0,

      onPoint: null,
      onStateChange: null,
      onError: null,

      ...configuration,
    };

    this.environment = createEnvironment(this.configuration.environment);

    this.interval = Math.max(
      MINIMUM_INTERVAL,
      toPositiveNumber(this.configuration.interval, DEFAULT_INTERVAL),
    );

    this.maxRetryDelay = toPositiveNumber(
      this.configuration.maxRetryDelay,
      DEFAULT_MAX_RETRY_DELAY,
    );

    this.requestTimeout = Math.max(
      0,
      Number(this.configuration.requestTimeout) || 0,
    );

    this.active = false;
    this.destroyed = false;
    this.inFlight = false;

    this.timer = null;
    this.requestTimer = null;

    this.requestController = null;
    this.listenerController = new AbortController();

    this.pauseReasons = new Set();

    this.failureCount = 0;
    this.sequence = 0;
    this.lifecycle = 0;
    this.requestSequence = 0;
    this.refreshPending = false;

    this.state = "idle";

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    this.handleOnline = this.handleOnline.bind(this);

    this.handleOffline = this.handleOffline.bind(this);

    this.handlePageHide = this.handlePageHide.bind(this);

    this.handlePageShow = this.handlePageShow.bind(this);

    this.bindEnvironment();
    this.synchronizeEnvironment();
  }

  /* ========================================================================
     Environment Events
     ======================================================================== */

  bindEnvironment() {
    const { document, window } = this.environment;
    const { signal } = this.listenerController;

    document?.addEventListener?.(
      "visibilitychange",
      this.handleVisibilityChange,
      { signal },
    );

    window?.addEventListener?.("online", this.handleOnline, { signal });

    window?.addEventListener?.("offline", this.handleOffline, { signal });

    window?.addEventListener?.("pagehide", this.handlePageHide, { signal });

    window?.addEventListener?.("pageshow", this.handlePageShow, { signal });
  }

  synchronizeEnvironment() {
    const { document, navigator } = this.environment;

    if (this.configuration.pauseWhenHidden && document?.hidden) {
      this.pauseReasons.add("document-hidden");
    } else {
      this.pauseReasons.delete("document-hidden");
    }

    if (navigator && "onLine" in navigator && !navigator.onLine) {
      this.pauseReasons.add("offline");
    } else {
      this.pauseReasons.delete("offline");
    }
  }

  handleVisibilityChange() {
    const { document } = this.environment;

    /*
     * Optional mode for projects that explicitly want hidden-tab pausing.
     */
    if (this.configuration.pauseWhenHidden) {
      if (document?.hidden) {
        this.addPauseReason("document-hidden");
      } else {
        this.removePauseReason("document-hidden");
      }

      return;
    }

    /*
     * Background timers may have been throttled.
     *
     * Do not pause when hidden. When the page becomes visible again, request
     * the latest point immediately instead of waiting for the next interval.
     */
    if (!document?.hidden && this.active && this.pauseReasons.size === 0) {
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
    /*
     * pagehide normally means navigation, unload, or entry into the
     * back-forward cache. Requests should not continue in that state.
     */
    this.addPauseReason("page-hidden");
  }

  handlePageShow() {
    this.removePauseReason("page-hidden");
  }

  /* ========================================================================
     State
     ======================================================================== */

  setState(state, detail = {}) {
    if (this.destroyed) {
      return;
    }

    const previousState = this.state;
    this.state = state;

    if (typeof this.configuration.onStateChange !== "function") {
      return;
    }

    try {
      this.configuration.onStateChange({
        state,
        previousState,

        active: this.active,
        destroyed: this.destroyed,
        inFlight: this.inFlight,

        paused: this.pauseReasons.size > 0,
        pauseReasons: [...this.pauseReasons],

        failureCount: this.failureCount,
        sequence: this.sequence,

        ...detail,
      });
    } catch (error) {
      console.error("Market Chart Live state callback failed.", error);
    }
  }

  resolvePausedState() {
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

  /* ========================================================================
     Pause Reasons
     ======================================================================== */

  addPauseReason(reason) {
    if (this.destroyed || !reason || this.pauseReasons.has(reason)) {
      return;
    }

    this.pauseReasons.add(reason);

    this.clearTimer();

    this.abortRequest(`Live chart paused: ${reason}.`);

    if (this.active) {
      this.setState(this.resolvePausedState(), {
        reason,
      });
    }
  }

  removePauseReason(reason) {
    if (this.destroyed || !this.pauseReasons.has(reason)) {
      return;
    }

    this.pauseReasons.delete(reason);

    if (!this.active) {
      return;
    }

    if (this.pauseReasons.size > 0) {
      this.setState(this.resolvePausedState(), {
        reason,
      });

      return;
    }

    /*
     * Catch up immediately after reconnecting or returning from pagehide.
     */
    this.setState("waiting", {
      reason,
      nextUpdateIn: 0,
    });

    this.schedule(0);
  }

  /* ========================================================================
     Timer
     ======================================================================== */

  clearTimer() {
    if (this.timer === null) {
      return;
    }

    this.environment.clearTimeout(this.timer);

    this.timer = null;
  }

  getAlignedDelay() {
    if (!this.configuration.alignToInterval) {
      return this.interval;
    }

    const remainder = this.environment.now() % this.interval;

    return remainder === 0 ? this.interval : this.interval - remainder;
  }

  schedule(delay = null) {
    this.clearTimer();

    if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
      return false;
    }

    const resolvedDelay =
      delay === null ? this.getAlignedDelay() : Math.max(0, Number(delay) || 0);

    this.setState("waiting", {
      nextUpdateIn: resolvedDelay,
    });

    this.timer = this.environment.setTimeout(() => {
      this.timer = null;

      this.execute();
    }, resolvedDelay);

    return true;
  }

  getRetryDelay() {
    const multiplier = 2 ** Math.max(0, this.failureCount - 1);

    return Math.min(this.interval * multiplier, this.maxRetryDelay);
  }

  /* ========================================================================
     Request Management
     ======================================================================== */

  clearRequestTimeout() {
    if (this.requestTimer === null) {
      return;
    }

    this.environment.clearTimeout(this.requestTimer);

    this.requestTimer = null;
  }

  abortRequest(message) {
    this.clearRequestTimeout();

    if (!this.requestController || this.requestController.signal.aborted) {
      return;
    }

    this.requestController.abort(createAbortError(message));
  }

  createRequestController() {
    this.abortRequest(
      "A newer live chart request replaced the previous request.",
    );

    const controller = new AbortController();

    this.requestController = controller;
    this.requestSequence += 1;

    const requestId = this.requestSequence;

    if (this.requestTimeout > 0) {
      this.requestTimer = this.environment.setTimeout(() => {
        if (controller.signal.aborted) {
          return;
        }

        controller.abort(
          createTimeoutError("The live chart request timed out."),
        );
      }, this.requestTimeout);
    }

    return {
      controller,
      requestId,
      lifecycle: this.lifecycle,
    };
  }

  /* ========================================================================
     Update Execution
     ======================================================================== */

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

    const request = this.createRequestController();
    const { controller } = request;

    const requestedAt = this.environment.now();
    const nextSequence = this.sequence + 1;

    this.setState("updating", {
      requestedAt,
      sequence: nextSequence,
    });

    try {
      const point = await this.configuration.fetchPoint({
        signal: controller.signal,

        requestedAt,
        sequence: nextSequence,
        requestId: request.requestId,
      });

      /*
       * The timeout protects transport latency only. Applying a valid point
       * may include an asynchronous renderer and must not turn a successful
       * response into a timeout failure.
       */
      this.clearRequestTimeout();

      if (
        controller.signal.aborted ||
        request.lifecycle !== this.lifecycle ||
        this.requestController !== controller ||
        this.destroyed ||
        !this.active
      ) {
        return false;
      }

      /*
       * null means the endpoint responded successfully but there is no new
       * market point yet. This is not treated as a network failure.
       */
      if (
        point !== null &&
        point !== undefined &&
        typeof this.configuration.onPoint === "function"
      ) {
        await this.configuration.onPoint(point, {
          requestedAt,
          updatedAt: this.environment.now(),

          sequence: nextSequence,
          requestId: request.requestId,
        });
      }

      if (
        request.lifecycle !== this.lifecycle ||
        this.requestController !== controller ||
        this.destroyed ||
        !this.active
      ) {
        return false;
      }

      this.sequence = nextSequence;
      this.failureCount = 0;

      this.setState("live", {
        requestedAt,
        updatedAt: this.environment.now(),

        point,
        sequence: this.sequence,
        requestId: request.requestId,
      });

      return true;
    } catch (error) {
      const resolvedError = controller.signal.aborted
        ? controller.signal.reason || error
        : error;

      const cancelled =
        !isTimeoutError(resolvedError) &&
        (isAbortError(resolvedError) || controller.signal.aborted);

      if (
        cancelled ||
        request.lifecycle !== this.lifecycle ||
        this.destroyed ||
        !this.active
      ) {
        return false;
      }

      this.failureCount += 1;

      this.setState("error", {
        error: resolvedError,
        requestedAt,
        failureCount: this.failureCount,
        requestId: request.requestId,
      });

      if (typeof this.configuration.onError === "function") {
        try {
          this.configuration.onError(resolvedError, {
            requestedAt,

            failureCount: this.failureCount,
            sequence: this.sequence,
            requestId: request.requestId,
          });
        } catch (callbackError) {
          console.error(
            "Market Chart Live error callback failed.",
            callbackError,
          );
        }
      }

      if (!this.configuration.retry) {
        this.active = false;
      }

      return false;
    } finally {
      this.clearRequestTimeout();

      if (this.requestController === controller) {
        this.requestController = null;
      }

      this.inFlight = false;

      if (!this.destroyed && this.active && this.pauseReasons.size === 0) {
        const delay = this.refreshPending
          ? 0
          : this.failureCount > 0
            ? this.getRetryDelay()
            : null;

        this.refreshPending = false;

        this.schedule(delay);
      }
    }
  }

  /* ========================================================================
     Public Lifecycle
     ======================================================================== */

  start() {
    if (this.destroyed) {
      return false;
    }

    if (this.active) {
      return true;
    }

    this.active = true;
    this.failureCount = 0;
    this.lifecycle += 1;
    this.refreshPending = false;

    this.synchronizeEnvironment();

    if (this.pauseReasons.size > 0) {
      this.setState(this.resolvePausedState());

      return true;
    }

    this.setState("starting");

    this.schedule(this.configuration.immediate ? 0 : null);

    return true;
  }

  pause(reason = "manual") {
    if (this.destroyed || !this.active) {
      return false;
    }

    this.addPauseReason(reason);

    return true;
  }

  resume(reason = "manual") {
    if (this.destroyed || !this.active) {
      return false;
    }

    this.removePauseReason(reason);

    return true;
  }

  stop() {
    if (this.destroyed) {
      return false;
    }

    this.active = false;
    this.lifecycle += 1;
    this.refreshPending = false;

    this.clearTimer();

    this.abortRequest("Live chart stopped.");

    this.failureCount = 0;

    this.pauseReasons.delete("manual");

    this.setState("stopped");

    return true;
  }

  /*
   * Runs one immediate request without creating a second polling loop.
   */
  refresh() {
    if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
      return false;
    }

    this.clearTimer();

    if (this.inFlight) {
      /*
       * The current request will schedule the next update when it finishes.
       */
      this.refreshPending = true;

      return true;
    }

    this.execute();

    return true;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.active = false;
    this.lifecycle += 1;
    this.refreshPending = false;

    this.clearTimer();

    this.abortRequest("Live chart controller destroyed.");

    this.listenerController.abort();

    this.pauseReasons.clear();

    /*
     * Mark destroyed after the final state callback has been emitted.
     */
    this.setState("destroyed");

    this.destroyed = true;
  }

  /* ========================================================================
     Public State
     ======================================================================== */

  getState() {
    return {
      state: this.state,

      active: this.active,
      destroyed: this.destroyed,
      inFlight: this.inFlight,

      paused: this.pauseReasons.size > 0,
      pauseReasons: [...this.pauseReasons],

      interval: this.interval,
      requestTimeout: this.requestTimeout,

      failureCount: this.failureCount,
      sequence: this.sequence,
    };
  }
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createMarketChartLiveController(configuration = {}) {
  return new MarketChartLiveController(configuration);
}
