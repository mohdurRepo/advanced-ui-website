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

function createAbortError(message) {
  return new DOMException(message, "AbortError");
}

/* ==========================================================================
   Controller
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

      alignToInterval: true,
      immediate: false,

      retry: true,
      maxRetryDelay: DEFAULT_MAX_RETRY_DELAY,

      requestTimeout: 0,

      onPoint: null,
      onStateChange: null,
      onError: null,

      ...configuration,
    };

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
     Environment
     ===================================================================== */

  bindEnvironment() {
    const signal = this.listenerController.signal;

    document.addEventListener("visibilitychange", this.handleVisibilityChange, {
      signal,
    });

    window.addEventListener("online", this.handleOnline, { signal });

    window.addEventListener("offline", this.handleOffline, { signal });

    window.addEventListener("pagehide", this.handlePageHide, { signal });

    window.addEventListener("pageshow", this.handlePageShow, { signal });
  }

  synchronizeEnvironment() {
    if (document.hidden) {
      this.pauseReasons.add("document-hidden");
    } else {
      this.pauseReasons.delete("document-hidden");
    }

    if ("onLine" in navigator && !navigator.onLine) {
      this.pauseReasons.add("offline");
    } else {
      this.pauseReasons.delete("offline");
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.addPauseReason("document-hidden");

      return;
    }

    this.removePauseReason("document-hidden");
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

  /* ========================================================================
     State
     ===================================================================== */

  setState(state, detail = {}) {
    if (this.destroyed || state === this.state) {
      return;
    }

    this.state = state;

    if (typeof this.configuration.onStateChange !== "function") {
      return;
    }

    try {
      this.configuration.onStateChange({
        state,

        active: this.active,
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
     ===================================================================== */

  addPauseReason(reason) {
    if (this.destroyed || !reason || this.pauseReasons.has(reason)) {
      return;
    }

    this.pauseReasons.add(reason);

    this.clearTimer();
    this.abortRequest(`Live chart paused: ${reason}.`);

    if (this.active) {
      this.setState(this.resolvePausedState());
    }
  }

  removePauseReason(reason) {
    if (this.destroyed || !this.pauseReasons.has(reason)) {
      return;
    }

    this.pauseReasons.delete(reason);

    if (!this.active || this.pauseReasons.size > 0) {
      if (this.active) {
        this.setState(this.resolvePausedState());
      }

      return;
    }

    this.setState("waiting");

    /*
     * Refresh quickly after returning to the page instead of waiting for one
     * complete interval.
     */

    this.schedule(0);
  }

  /* ========================================================================
     Timer
     ===================================================================== */

  clearTimer() {
    if (this.timer === null) {
      return;
    }

    window.clearTimeout(this.timer);
    this.timer = null;
  }

  getAlignedDelay() {
    if (!this.configuration.alignToInterval) {
      return this.interval;
    }

    const remainder = Date.now() % this.interval;

    return remainder === 0 ? this.interval : this.interval - remainder;
  }

  schedule(delay = null) {
    this.clearTimer();

    if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
      return;
    }

    const resolvedDelay =
      delay === null ? this.getAlignedDelay() : Math.max(0, delay);

    this.setState("waiting", {
      nextUpdateIn: resolvedDelay,
    });

    this.timer = window.setTimeout(() => {
      this.timer = null;

      this.execute();
    }, resolvedDelay);
  }

  getRetryDelay() {
    const multiplier = 2 ** Math.max(0, this.failureCount - 1);

    return Math.min(this.interval * multiplier, this.maxRetryDelay);
  }

  /* ========================================================================
     Request
     ===================================================================== */

  clearRequestTimeout() {
    if (this.requestTimer === null) {
      return;
    }

    window.clearTimeout(this.requestTimer);

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

    this.requestController = new AbortController();

    if (this.requestTimeout > 0) {
      this.requestTimer = window.setTimeout(() => {
        this.requestController?.abort(
          new DOMException("The live chart request timed out.", "TimeoutError"),
        );
      }, this.requestTimeout);
    }

    return this.requestController;
  }

  /* ========================================================================
     Execute
     ===================================================================== */

  async execute() {
    if (
      this.destroyed ||
      !this.active ||
      this.inFlight ||
      this.pauseReasons.size > 0
    ) {
      return;
    }

    this.inFlight = true;

    const request = this.createRequestController();

    const requestedAt = Date.now();

    this.setState("updating", {
      requestedAt,
    });

    try {
      const point = await this.configuration.fetchPoint({
        signal: request.signal,

        requestedAt,

        sequence: this.sequence + 1,
      });

      if (request.signal.aborted || this.destroyed || !this.active) {
        return;
      }

      if (point === null || point === undefined) {
        throw new Error("The live chart request returned no point.");
      }

      const updatedAt = Date.now();

      if (typeof this.configuration.onPoint === "function") {
        await this.configuration.onPoint(point, {
          requestedAt,
          updatedAt,

          sequence: this.sequence + 1,
        });
      }

      this.sequence += 1;
      this.failureCount = 0;

      this.setState("live", {
        requestedAt,
        updatedAt,

        point,
      });
    } catch (error) {
      if (
        isAbortError(error) ||
        request.signal.aborted ||
        this.destroyed ||
        !this.active
      ) {
        return;
      }

      this.failureCount += 1;

      this.setState("error", {
        error,
      });

      if (typeof this.configuration.onError === "function") {
        try {
          this.configuration.onError(error, {
            requestedAt,

            failureCount: this.failureCount,

            sequence: this.sequence,
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

        return;
      }
    } finally {
      this.clearRequestTimeout();

      if (this.requestController === request) {
        this.requestController = null;
      }

      this.inFlight = false;

      if (!this.destroyed && this.active && this.pauseReasons.size === 0) {
        const delay = this.failureCount > 0 ? this.getRetryDelay() : null;

        this.schedule(delay);
      }
    }
  }

  /* ========================================================================
     Public Lifecycle
     ===================================================================== */

  start() {
    if (this.destroyed) {
      return false;
    }

    if (this.active) {
      return true;
    }

    this.active = true;
    this.failureCount = 0;

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

    this.clearTimer();
    this.abortRequest("Live chart stopped.");

    this.failureCount = 0;

    this.pauseReasons.delete("manual");

    this.setState("stopped");

    return true;
  }

  /*
   * Runs one immediate update without creating a second recurring timer.
   * Useful for testing from the browser console.
   */

  refresh() {
    if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
      return false;
    }

    this.clearTimer();

    if (!this.inFlight) {
      this.execute();
    }

    return true;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.active = false;

    this.clearTimer();
    this.abortRequest("Live chart controller destroyed.");

    this.listenerController.abort();

    this.pauseReasons.clear();

    this.setState("destroyed");

    this.destroyed = true;
  }

  /* ========================================================================
     Public State
     ===================================================================== */

  getState() {
    return {
      state: this.state,

      active: this.active,
      destroyed: this.destroyed,
      inFlight: this.inFlight,

      paused: this.pauseReasons.size > 0,

      pauseReasons: [...this.pauseReasons],

      interval: this.interval,

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
