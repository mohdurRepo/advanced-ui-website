/* ==========================================================================
   Market Chart Live Controller
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Schedule one live request at a time.
 * - Prevent overlapping network requests.
 * - Align polling to interval boundaries when requested.
 * - Pause polling while the page is hidden.
 * - Pause polling while offline.
 * - Abort stale requests during pause / stop / destroy.
 * - Apply bounded exponential retry after failures.
 * - Perform an immediate catch-up request after resume.
 *
 * This controller does NOT:
 *
 * - Render Highcharts.
 * - Store chart history.
 * - Mutate series.
 * - Select chart ranges.
 * - Control navigator viewports.
 *
 * The parent MarketChartController owns those concerns.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_INTERVAL = 60_000;

const DEFAULT_MAX_RETRY_DELAY = 5 * 60_000;

const MINIMUM_INTERVAL = 250;

const MAXIMUM_RETRY_EXPONENT = 16;

/* ==========================================================================
   Numeric Helpers
   ========================================================================== */

function toPositiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/* ==========================================================================
   Error Helpers
   ========================================================================== */

function isAbortError(error) {
  return Boolean(error?.name === "AbortError" || error?.code === 20);
}

function isTimeoutError(error) {
  return error?.name === "TimeoutError";
}

function createNamedError(message, name) {
  const DOMExceptionConstructor = globalThis.DOMException;

  if (typeof DOMExceptionConstructor === "function") {
    return new DOMExceptionConstructor(message, name);
  }

  const error = new Error(message);

  error.name = name;

  return error;
}

function createAbortError(message) {
  return createNamedError(message, "AbortError");
}

function createTimeoutError(message) {
  return createNamedError(message, "TimeoutError");
}

/* ==========================================================================
   Environment
   ========================================================================== */

function createEnvironment(environment = {}) {
  const root = typeof globalThis === "object" ? globalThis : {};

  const window = environment.window ?? root.window ?? null;

  const document = environment.document ?? root.document ?? null;

  const navigator = environment.navigator ?? root.navigator ?? null;

  const AbortControllerConstructor =
    environment.AbortController ??
    window?.AbortController ??
    root.AbortController ??
    null;

  return {
    window,

    document,

    navigator,

    AbortController: AbortControllerConstructor,

    now: typeof environment.now === "function" ? environment.now : Date.now,

    setTimeout:
      environment.setTimeout ??
      window?.setTimeout?.bind(window) ??
      root.setTimeout?.bind(root) ??
      (() => null),

    clearTimeout:
      environment.clearTimeout ??
      window?.clearTimeout?.bind(window) ??
      root.clearTimeout?.bind(root) ??
      (() => {}),
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
       * Align regular polling to clock boundaries.
       *
       * interval: 5_000
       *
       * requests occur approximately at:
       *
       * 10:00:00
       * 10:00:05
       * 10:00:10
       */

      alignToInterval: true,

      /*
       * Run the first request immediately after start().
       */

      immediate: false,

      /*
       * Production default.
       *
       * Hidden browser tabs do not need to continuously render / poll live
       * market data. Browsers throttle background timers anyway.
       *
       * When the document becomes visible again, one immediate catch-up
       * request is issued.
       */

      pauseWhenHidden: true,

      retry: true,

      maxRetryDelay: DEFAULT_MAX_RETRY_DELAY,

      /*
       * Zero disables controller-level request timeout handling.
       */

      requestTimeout: 0,

      onPoint: null,

      onStateChange: null,

      onError: null,

      ...configuration,
    };

    this.environment = createEnvironment(this.configuration.environment);

    if (typeof this.environment.AbortController !== "function") {
      throw new TypeError("Market Chart Live requires AbortController.");
    }

    this.interval = Math.max(
      MINIMUM_INTERVAL,

      toPositiveNumber(
        this.configuration.interval,

        DEFAULT_INTERVAL,
      ),
    );

    this.maxRetryDelay = toPositiveNumber(
      this.configuration.maxRetryDelay,

      DEFAULT_MAX_RETRY_DELAY,
    );

    this.requestTimeout = Math.max(
      0,

      Number(this.configuration.requestTimeout) || 0,
    );

    /* -----------------------------------------------------------------------
       Lifecycle
       -------------------------------------------------------------------- */

    this.active = false;

    this.destroyed = false;

    this.inFlight = false;

    /* -----------------------------------------------------------------------
       Timers
       -------------------------------------------------------------------- */

    this.timer = null;

    this.requestTimer = null;

    /* -----------------------------------------------------------------------
       Request
       -------------------------------------------------------------------- */

    this.requestController = null;

    this.requestSequence = 0;

    /* -----------------------------------------------------------------------
       Event Listeners
       -------------------------------------------------------------------- */

    this.listenerController = new this.environment.AbortController();

    /* -----------------------------------------------------------------------
       Pause State
       -------------------------------------------------------------------- */

    this.pauseReasons = new Set();

    /* -----------------------------------------------------------------------
       Poll State
       -------------------------------------------------------------------- */

    this.failureCount = 0;

    this.sequence = 0;

    /*
     * lifecycle invalidates asynchronous work belonging to an earlier
     * start/stop/destroy generation.
     */

    this.lifecycle = 0;

    /*
     * When refresh() is requested while a request is already in flight,
     * queue exactly one follow-up request.
     */

    this.refreshPending = false;

    this.state = "idle";

    /* -----------------------------------------------------------------------
       Diagnostics
       -------------------------------------------------------------------- */

    this.lastRequestedAt = null;

    this.lastUpdatedAt = null;

    this.nextUpdateAt = null;

    /* -----------------------------------------------------------------------
       Bindings
       -------------------------------------------------------------------- */

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

    const signal = this.listenerController.signal;

    document?.addEventListener?.(
      "visibilitychange",
      this.handleVisibilityChange,
      {
        signal,
      },
    );

    window?.addEventListener?.("online", this.handleOnline, {
      signal,
    });

    window?.addEventListener?.("offline", this.handleOffline, {
      signal,
    });

    window?.addEventListener?.("pagehide", this.handlePageHide, {
      signal,
    });

    window?.addEventListener?.("pageshow", this.handlePageShow, {
      signal,
    });
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

    if (this.configuration.pauseWhenHidden) {
      if (document?.hidden) {
        this.addPauseReason("document-hidden");
      } else {
        this.removePauseReason("document-hidden");
      }

      return;
    }

    /*
     * Explicit opt-out mode:
     *
     * polling continues while hidden, but browser throttling may delay timers.
     * Catch up immediately when the tab becomes visible again.
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
     * pagehide covers:
     *
     * - normal navigation;
     * - unload;
     * - back-forward cache entry.
     *
     * Requests should not remain active in that state.
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

        lastRequestedAt: this.lastRequestedAt,

        lastUpdatedAt: this.lastUpdatedAt,

        nextUpdateAt: this.nextUpdateAt,

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
      return false;
    }

    this.pauseReasons.add(reason);

    /*
     * A pause owns the polling lifecycle immediately:
     *
     * - clear pending timer;
     * - clear queued refresh;
     * - cancel transport.
     */

    this.clearTimer();

    this.refreshPending = false;

    this.abortRequest(`Live chart paused: ${reason}.`);

    if (this.active) {
      this.setState(this.resolvePausedState(), {
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

    if (!this.active) {
      return true;
    }

    if (this.pauseReasons.size > 0) {
      this.setState(this.resolvePausedState(), {
        reason,
      });

      return true;
    }

    /*
     * Catch up immediately after:
     *
     * - reconnect;
     * - tab visibility restore;
     * - BFCache restore;
     * - manual resume.
     *
     * If an aborted request has not finished unwinding yet, queue one refresh
     * instead of starting a second request.
     */

    if (this.inFlight) {
      this.refreshPending = true;

      this.setState("waiting", {
        reason,

        nextUpdateIn: 0,
      });

      return true;
    }

    this.schedule(0, {
      reason,
    });

    return true;
  }

  /* ========================================================================
     Timer
     ======================================================================== */

  clearTimer() {
    if (this.timer === null) {
      this.nextUpdateAt = null;

      return;
    }

    this.environment.clearTimeout(this.timer);

    this.timer = null;

    this.nextUpdateAt = null;
  }

  getAlignedDelay() {
    if (!this.configuration.alignToInterval) {
      return this.interval;
    }

    const now = this.environment.now();

    const remainder = now % this.interval;

    return remainder === 0 ? this.interval : this.interval - remainder;
  }

  schedule(delay = null, detail = {}) {
    this.clearTimer();

    if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
      return false;
    }

    const resolvedDelay =
      delay === null ? this.getAlignedDelay() : Math.max(0, Number(delay) || 0);

    const now = this.environment.now();

    this.nextUpdateAt = now + resolvedDelay;

    this.setState("waiting", {
      nextUpdateIn: resolvedDelay,

      nextUpdateAt: this.nextUpdateAt,

      ...detail,
    });

    this.timer = this.environment.setTimeout(() => {
      this.timer = null;

      this.nextUpdateAt = null;

      this.execute();
    }, resolvedDelay);

    return true;
  }

  /* ========================================================================
     Retry
     ======================================================================== */

  getRetryDelay() {
    const exponent = Math.min(
      Math.max(0, this.failureCount - 1),
      MAXIMUM_RETRY_EXPONENT,
    );

    const multiplier = 2 ** exponent;

    return Math.min(
      this.interval * multiplier,

      this.maxRetryDelay,
    );
  }

  /* ========================================================================
     Request Timeout
     ======================================================================== */

  clearRequestTimeout() {
    if (this.requestTimer === null) {
      return;
    }

    this.environment.clearTimeout(this.requestTimer);

    this.requestTimer = null;
  }

  /* ========================================================================
     Request Cancellation
     ======================================================================== */

  abortRequest(message) {
    this.clearRequestTimeout();

    const controller = this.requestController;

    if (!controller || controller.signal.aborted) {
      return false;
    }

    controller.abort(createAbortError(message));

    return true;
  }

  /* ========================================================================
     Request Creation
     ======================================================================== */

  createRequestController() {
    /*
     * Defensive invariant:
     *
     * There should never be two requests. If an unexpected stale controller
     * remains, cancel it before creating the next generation.
     */

    this.abortRequest(
      "A newer live chart request replaced the previous request.",
    );

    const controller = new this.environment.AbortController();

    this.requestController = controller;

    this.requestSequence += 1;

    const requestId = this.requestSequence;

    const lifecycle = this.lifecycle;

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

      lifecycle,
    };
  }

  /* ========================================================================
     Request Validity
     ======================================================================== */

  isCurrentRequest(request) {
    return Boolean(
      request &&
      !this.destroyed &&
      this.active &&
      request.lifecycle === this.lifecycle &&
      this.requestController === request.controller,
    );
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

    this.lastRequestedAt = requestedAt;

    this.setState("updating", {
      requestedAt,

      sequence: nextSequence,

      requestId: request.requestId,
    });

    try {
      /* -------------------------------------------------------------------
         Fetch
         ---------------------------------------------------------------- */

      const point = await this.configuration.fetchPoint({
        signal: controller.signal,

        requestedAt,

        sequence: nextSequence,

        requestId: request.requestId,
      });

      /*
       * Timeout covers transport latency.
       *
       * Once transport has completed successfully, onPoint() may perform
       * application work without being incorrectly converted into a transport
       * timeout.
       */

      this.clearRequestTimeout();

      if (controller.signal.aborted || !this.isCurrentRequest(request)) {
        return false;
      }

      /* -------------------------------------------------------------------
         Apply Point
         ---------------------------------------------------------------- */

      /*
       * null / undefined means:
       *
       * request succeeded, but the endpoint has no newer market point.
       *
       * This is not considered an error and must not increase retry backoff.
       */

      if (
        point !== null &&
        point !== undefined &&
        typeof this.configuration.onPoint === "function"
      ) {
        const updatedAt = this.environment.now();

        await this.configuration.onPoint(point, {
          requestedAt,

          updatedAt,

          sequence: nextSequence,

          requestId: request.requestId,
        });

        this.lastUpdatedAt = updatedAt;
      }

      if (!this.isCurrentRequest(request)) {
        return false;
      }

      /* -------------------------------------------------------------------
         Success
         ---------------------------------------------------------------- */

      this.sequence = nextSequence;

      this.failureCount = 0;

      const completedAt = this.environment.now();

      if (
        this.lastUpdatedAt === null &&
        point !== null &&
        point !== undefined
      ) {
        this.lastUpdatedAt = completedAt;
      }

      this.setState("live", {
        requestedAt,

        updatedAt: completedAt,

        point,

        sequence: this.sequence,

        requestId: request.requestId,
      });

      return true;
    } catch (error) {
      const resolvedError = controller.signal.aborted
        ? controller.signal.reason || error
        : error;

      const timedOut = isTimeoutError(resolvedError);

      const cancelled =
        !timedOut && (isAbortError(resolvedError) || controller.signal.aborted);

      /*
       * Pause / stop / destroy aborts are lifecycle control, not failures.
       */

      if (
        cancelled ||
        request.lifecycle !== this.lifecycle ||
        this.destroyed ||
        !this.active
      ) {
        return false;
      }

      /* -------------------------------------------------------------------
         Failure
         ---------------------------------------------------------------- */

      this.failureCount += 1;

      this.setState("error", {
        error: resolvedError,

        requestedAt,

        failureCount: this.failureCount,

        requestId: request.requestId,

        timedOut,
      });

      if (typeof this.configuration.onError === "function") {
        try {
          this.configuration.onError(resolvedError, {
            requestedAt,

            failureCount: this.failureCount,

            sequence: this.sequence,

            requestId: request.requestId,

            timedOut,
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
      /* -------------------------------------------------------------------
         Always Clean Request State
         ---------------------------------------------------------------- */

      this.clearRequestTimeout();

      if (this.requestController === controller) {
        this.requestController = null;
      }

      this.inFlight = false;

      /* -------------------------------------------------------------------
         Schedule Exactly One Next Request
         ---------------------------------------------------------------- */

      if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
        return;
      }

      const pendingRefresh = this.refreshPending;

      this.refreshPending = false;

      if (pendingRefresh) {
        this.schedule(0);

        return;
      }

      if (this.failureCount > 0) {
        this.schedule(this.getRetryDelay(), {
          retry: true,

          failureCount: this.failureCount,
        });

        return;
      }

      /*
       * null means normal aligned scheduling.
       */

      this.schedule(null);
    }
  }

  /* ========================================================================
     Start
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

  /* ========================================================================
     Pause
     ======================================================================== */

  pause(reason = "manual") {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.addPauseReason(reason);
  }

  /* ========================================================================
     Resume
     ======================================================================== */

  resume(reason = "manual") {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.removePauseReason(reason);
  }

  /* ========================================================================
     Stop
     ======================================================================== */

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

    /*
     * Keep environment-owned reasons such as offline / hidden. They will be
     * synchronized again on the next start().
     */

    this.pauseReasons.delete("manual");

    this.setState("stopped");

    return true;
  }

  /* ========================================================================
     Refresh
     ======================================================================== */

  /*
   * Run one immediate request without creating another polling loop.
   */

  refresh() {
    if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
      return false;
    }

    this.clearTimer();

    if (this.inFlight) {
      /*
       * Coalesce unlimited refresh requests into one pending refresh.
       */

      this.refreshPending = true;

      return true;
    }

    /*
     * execute() schedules the next normal polling cycle in finally.
     */

    void this.execute();

    return true;
  }

  /* ========================================================================
     Destroy
     ======================================================================== */

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
     * Emit the final lifecycle state before setState() becomes disabled by the
     * destroyed flag.
     */

    this.setState("destroyed", {
      destroyed: true,
    });

    this.destroyed = true;

    this.requestController = null;

    this.inFlight = false;

    this.nextUpdateAt = null;
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

/* ==========================================================================
   Class Export
   ========================================================================== */

export { MarketChartLiveController };
