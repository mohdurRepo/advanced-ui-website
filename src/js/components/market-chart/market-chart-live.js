import {
  isPlainObject,
  toNonNegativeNumber,
  toPositiveNumber,
} from "./market-chart-utils.js";

/* ==========================================================================
   Market Chart Live
   ==========================================================================

   Polling scheduler for live market data. Knows nothing about Highcharts,
   ranges or chart state: it decides WHEN to call `fetchUpdates()` and hands
   the response to `onData()`.

   Lifecycle:

     start() -> waiting -> updating -> live | error -> waiting -> …
     pause(reason) / resume(reason)   named pause reasons (ref-counted set)
     refresh(context)                 request now (or right after the
                                      in-flight request)
     stop() / destroy()

   Rules:

   1. At most one request is in flight.
   2. Any pause reason aborts the in-flight request and cancels the timer.
   3. A refresh context (e.g. { fullSnapshot: true }) is never lost:
      - queued while paused, sent on the first request after resuming
      - restored when its request is cancelled or fails, so the retry
        carries it too
   4. Every request has a timeout, so a stalled fetch can never stop
      polling permanently.
   5. Failed requests retry with capped exponential backoff and jitter.

   Built-in pause reasons: "document-hidden", "page-hidden", "offline",
   "manual". Consumers may add their own (e.g. "historical-range").
   ========================================================================== */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_INTERVAL = 60_000;
const DEFAULT_MAX_RETRY_DELAY = 5 * 60_000;
const DEFAULT_REQUEST_TIMEOUT = 20_000;

const MAX_BACKOFF_EXPONENT = 8;

export const LIVE_PAUSE_REASON = Object.freeze({
  DOCUMENT_HIDDEN: "document-hidden",
  PAGE_HIDDEN: "page-hidden",
  OFFLINE: "offline",
  MANUAL: "manual",
});

export const LIVE_STATE = Object.freeze({
  IDLE: "idle",
  STARTING: "starting",
  WAITING: "waiting",
  UPDATING: "updating",
  LIVE: "live",
  ERROR: "error",
  PAUSED: "paused",
  HIDDEN: "hidden",
  OFFLINE: "offline",
  STOPPED: "stopped",
  DESTROYED: "destroyed",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function createTimeoutError() {
  const error = new Error("Live market request timed out.");

  error.name = "TimeoutError";

  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === 20;
}

function resolveChanged(result) {
  if (typeof result === "boolean") {
    return result;
  }

  return isPlainObject(result) && typeof result.changed === "boolean"
    ? result.changed
    : false;
}

function normalizeReason(reason) {
  return String(reason ?? "").trim();
}

/* ==========================================================================
   Controller
   ========================================================================== */

export class MarketChartLiveController {
  constructor(configuration = {}) {
    const source = isPlainObject(configuration) ? configuration : {};

    if (typeof source.fetchUpdates !== "function") {
      throw new TypeError("Market Chart Live requires fetchUpdates().");
    }

    this.fetchUpdates = source.fetchUpdates;

    this.onData = typeof source.onData === "function" ? source.onData : null;

    this.onStateChange =
      typeof source.onStateChange === "function" ? source.onStateChange : null;

    this.onError = typeof source.onError === "function" ? source.onError : null;

    /* Options ------------------------------------------------------------ */

    this.interval = toPositiveNumber(source.interval, DEFAULT_INTERVAL);

    this.maxRetryDelay = toPositiveNumber(
      source.maxRetryDelay,
      DEFAULT_MAX_RETRY_DELAY,
    );

    /*
     * 0 explicitly disables the timeout; anything invalid uses the default.
     */
    this.requestTimeout = toNonNegativeNumber(
      source.requestTimeout,
      DEFAULT_REQUEST_TIMEOUT,
    );

    this.alignToInterval = source.alignToInterval !== false;
    this.immediate = source.immediate === true;
    this.pauseWhenHidden = source.pauseWhenHidden !== false;
    this.retry = source.retry !== false;

    /* Environment -------------------------------------------------------- */

    const environment = isPlainObject(source.environment)
      ? source.environment
      : {};

    this.window = environment.window || globalThis.window;
    this.document = environment.document || globalThis.document;
    this.navigator = environment.navigator || globalThis.navigator;

    this.now =
      typeof environment.now === "function" ? environment.now : Date.now;

    this.random =
      typeof environment.random === "function"
        ? environment.random
        : Math.random;

    this.setTimeout =
      environment.setTimeout ||
      this.window?.setTimeout?.bind(this.window) ||
      globalThis.setTimeout;

    this.clearTimeout =
      environment.clearTimeout ||
      this.window?.clearTimeout?.bind(this.window) ||
      globalThis.clearTimeout;

    this.AbortController =
      environment.AbortController ||
      this.window?.AbortController ||
      globalThis.AbortController;

    if (typeof this.AbortController !== "function") {
      throw new TypeError("Market Chart Live requires AbortController.");
    }

    if (
      typeof this.setTimeout !== "function" ||
      typeof this.clearTimeout !== "function"
    ) {
      throw new TypeError("Market Chart Live requires timer functions.");
    }

    /* Runtime ------------------------------------------------------------ */

    this.active = false;
    this.destroyed = false;
    this.inFlight = false;

    this.timer = null;
    this.requestTimer = null;
    this.requestController = null;

    this.refreshPending = false;
    this.pendingRefreshContext = null;
    this.pauseReasons = new Set();

    this.state = LIVE_STATE.IDLE;
    this.failureCount = 0;
    this.sequence = 0;
    this.requestSequence = 0;

    this.lastRequestedAt = null;
    this.lastResponseAt = null;
    this.lastDataUpdatedAt = null;
    this.nextUpdateAt = null;

    this.listenerController = new this.AbortController();

    this.bindEnvironment();
    this.synchronizeEnvironment();
  }

  /* ========================================================================
     Environment
     ======================================================================== */

  bindEnvironment() {
    const options = { signal: this.listenerController.signal };

    this.document?.addEventListener?.(
      "visibilitychange",
      () => this.handleVisibilityChange(),
      options,
    );

    this.window?.addEventListener?.(
      "online",
      () => this.removePauseReason(LIVE_PAUSE_REASON.OFFLINE),
      options,
    );

    this.window?.addEventListener?.(
      "offline",
      () => this.addPauseReason(LIVE_PAUSE_REASON.OFFLINE),
      options,
    );

    this.window?.addEventListener?.(
      "pagehide",
      () => this.addPauseReason(LIVE_PAUSE_REASON.PAGE_HIDDEN),
      options,
    );

    this.window?.addEventListener?.(
      "pageshow",
      () => this.handlePageShow(),
      options,
    );
  }

  /**
   * Aligns environment pause reasons with the current document/network
   * state without emitting or scheduling.
   */
  synchronizeEnvironment() {
    const toggle = (reason, enabled) => {
      if (enabled) {
        this.pauseReasons.add(reason);
      } else {
        this.pauseReasons.delete(reason);
      }
    };

    toggle(
      LIVE_PAUSE_REASON.DOCUMENT_HIDDEN,
      this.pauseWhenHidden && this.document?.hidden === true,
    );

    toggle(LIVE_PAUSE_REASON.OFFLINE, this.navigator?.onLine === false);
  }

  handleVisibilityChange() {
    if (this.destroyed) {
      return;
    }

    const hidden = this.document?.hidden === true;

    if (!this.pauseWhenHidden) {
      if (!hidden) {
        this.refresh();
      }

      return;
    }

    if (hidden) {
      this.addPauseReason(LIVE_PAUSE_REASON.DOCUMENT_HIDDEN);

      return;
    }

    /*
     * The session may have moved on (or rolled over) while hidden.
     */
    this.queueRefreshContext({
      reason: "visibility-resume",
      fullSnapshot: true,
    });

    this.removePauseReason(LIVE_PAUSE_REASON.DOCUMENT_HIDDEN);
  }

  handlePageShow() {
    if (this.destroyed) {
      return;
    }

    this.queueRefreshContext({
      reason: "page-resume",
      fullSnapshot: true,
    });

    this.removePauseReason(LIVE_PAUSE_REASON.PAGE_HIDDEN);
  }

  /* ========================================================================
     State
     ======================================================================== */

  isPaused() {
    return this.pauseReasons.size > 0;
  }

  canRun() {
    return !this.destroyed && this.active && !this.isPaused();
  }

  getPausedState() {
    if (this.pauseReasons.has(LIVE_PAUSE_REASON.OFFLINE)) {
      return LIVE_STATE.OFFLINE;
    }

    if (
      this.pauseReasons.has(LIVE_PAUSE_REASON.DOCUMENT_HIDDEN) ||
      this.pauseReasons.has(LIVE_PAUSE_REASON.PAGE_HIDDEN)
    ) {
      return LIVE_STATE.HIDDEN;
    }

    return LIVE_STATE.PAUSED;
  }

  emitState(state, detail = {}) {
    if (this.destroyed) {
      return false;
    }

    const previousState = this.state;

    this.state = state;

    if (!this.onStateChange) {
      return true;
    }

    try {
      this.onStateChange({
        ...this.getState(),
        previousState,
        ...detail,
      });
    } catch (error) {
      console.error("Market Chart live state callback failed.", error);
    }

    return true;
  }

  /* ========================================================================
     Pause Reasons
     ======================================================================== */

  addPauseReason(reason) {
    const name = normalizeReason(reason);

    if (this.destroyed || !name || this.pauseReasons.has(name)) {
      return false;
    }

    this.pauseReasons.add(name);

    this.clearTimer();
    this.refreshPending = false;
    this.abortRequest();

    if (this.active) {
      this.emitState(this.getPausedState(), { reason: name });
    }

    return true;
  }

  /**
   * Removes one pause reason.
   *
   * Returns true when the reason was removed, even if other reasons still
   * keep polling paused — check `getState().paused` for that.
   */
  removePauseReason(reason) {
    const name = normalizeReason(reason);

    if (this.destroyed || !name || !this.pauseReasons.has(name)) {
      return false;
    }

    this.pauseReasons.delete(name);

    if (!this.active) {
      return true;
    }

    if (this.isPaused()) {
      /*
       * Still paused, possibly for a different kind of reason
       * (e.g. offline -> manual).
       */
      this.emitState(this.getPausedState(), { reason: name });
    } else {
      this.schedule(0);
    }

    return true;
  }

  /* ========================================================================
     Refresh Context
     ======================================================================== */

  queueRefreshContext(context) {
    if (!isPlainObject(context)) {
      return;
    }

    this.pendingRefreshContext = {
      ...this.pendingRefreshContext,
      ...context,
    };
  }

  takeRefreshContext() {
    const context = this.pendingRefreshContext;

    this.pendingRefreshContext = null;

    return context;
  }

  /**
   * Puts an unfulfilled context back without overriding anything queued in
   * the meantime (newer values win).
   */
  restoreRefreshContext(context) {
    if (!isPlainObject(context)) {
      return;
    }

    this.pendingRefreshContext = {
      ...context,
      ...this.pendingRefreshContext,
    };
  }

  /* ========================================================================
     Timers
     ======================================================================== */

  clearTimer() {
    if (this.timer !== null) {
      this.clearTimeout(this.timer);
      this.timer = null;
    }

    this.nextUpdateAt = null;
  }

  clearRequestTimeout() {
    if (this.requestTimer !== null) {
      this.clearTimeout(this.requestTimer);
      this.requestTimer = null;
    }
  }

  getNextDelay() {
    if (!this.alignToInterval) {
      return this.interval;
    }

    const remainder = this.now() % this.interval;

    return remainder === 0 ? this.interval : this.interval - remainder;
  }

  /**
   * Capped exponential backoff with jitter (50–100% of the base delay), so
   * many clients recovering from the same outage do not retry in lockstep.
   */
  getRetryDelay() {
    const exponent = Math.min(
      Math.max(this.failureCount - 1, 0),
      MAX_BACKOFF_EXPONENT,
    );

    const base = Math.min(this.interval * 2 ** exponent, this.maxRetryDelay);

    return Math.round(base * (0.5 + this.random() * 0.5));
  }

  schedule(delay = null) {
    this.clearTimer();

    if (!this.canRun()) {
      return false;
    }

    const resolvedDelay =
      delay === null ? this.getNextDelay() : Math.max(0, Number(delay) || 0);

    this.nextUpdateAt = this.now() + resolvedDelay;

    this.emitState(LIVE_STATE.WAITING, {
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

  scheduleAfterRequest() {
    if (!this.canRun()) {
      return;
    }

    if (this.refreshPending) {
      this.refreshPending = false;
      this.schedule(0);
    } else if (this.failureCount > 0) {
      this.schedule(this.getRetryDelay());
    } else {
      this.schedule();
    }
  }

  /* ========================================================================
     Request
     ======================================================================== */

  abortRequest(reason) {
    const controller = this.requestController;

    if (!controller || controller.signal.aborted) {
      return false;
    }

    try {
      controller.abort(reason);
    } catch {
      controller.abort();
    }

    return true;
  }

  isCurrentRequest(controller) {
    return (
      !controller.signal.aborted &&
      this.requestController === controller &&
      this.canRun()
    );
  }

  async execute() {
    if (!this.canRun() || this.inFlight) {
      return false;
    }

    this.inFlight = true;

    const controller = new this.AbortController();

    this.requestController = controller;

    const request = {
      requestId: ++this.requestSequence,
      requestedAt: this.now(),
      sequence: this.sequence + 1,
      context: this.takeRefreshContext(),
    };

    this.lastRequestedAt = request.requestedAt;

    let completed = false;

    try {
      completed = await this.runRequest(controller, request);
    } finally {
      this.clearRequestTimeout();

      if (this.requestController === controller) {
        this.requestController = null;
      }

      this.inFlight = false;
    }

    /*
     * A cancelled or failed request never consumes its context
     * (e.g. fullSnapshot): the next request carries it again.
     */
    if (!completed && this.active && !this.destroyed) {
      this.restoreRefreshContext(request.context);
    }

    this.scheduleAfterRequest();

    return completed;
  }

  /**
   * @returns {Promise<boolean>} true when the response was fully applied.
   */
  async runRequest(controller, { requestId, requestedAt, sequence, context }) {
    this.emitState(LIVE_STATE.UPDATING, { requestedAt, sequence, requestId });

    let timedOut = false;

    if (this.requestTimeout > 0) {
      this.requestTimer = this.setTimeout(() => {
        this.requestTimer = null;

        if (!controller.signal.aborted) {
          timedOut = true;
          this.abortRequest(createTimeoutError());
        }
      }, this.requestTimeout);
    }

    try {
      const payload = await this.fetchUpdates({
        signal: controller.signal,
        requestedAt,
        sequence,
        requestId,
        ...context,
      });

      this.clearRequestTimeout();

      if (!this.isCurrentRequest(controller)) {
        return false;
      }

      const respondedAt = this.now();

      this.lastResponseAt = respondedAt;

      const changed =
        payload === null || payload === undefined || !this.onData
          ? false
          : resolveChanged(
              await this.onData(payload, {
                requestedAt,
                respondedAt,
                sequence,
                requestId,
                ...context,
              }),
            );

      if (!this.isCurrentRequest(controller)) {
        return false;
      }

      const completedAt = this.now();

      if (changed) {
        this.lastDataUpdatedAt = completedAt;
      }

      this.sequence = sequence;
      this.failureCount = 0;

      this.emitState(LIVE_STATE.LIVE, {
        changed,
        requestedAt,
        respondedAt,
        completedAt,
        sequence,
        requestId,
      });

      return true;
    } catch (error) {
      this.handleRequestError(controller, error, {
        requestedAt,
        requestId,
        timedOut,
      });

      return false;
    }
  }

  handleRequestError(controller, error, { requestedAt, requestId, timedOut }) {
    const resolvedError =
      (controller.signal.aborted && controller.signal.reason) || error;

    const isTimeout = timedOut || resolvedError?.name === "TimeoutError";

    const cancelled =
      !isTimeout && (isAbortError(resolvedError) || controller.signal.aborted);

    /*
     * Cancellation (pause, stop, destroy, superseded request) is not a
     * failure.
     */
    if (cancelled || !this.canRun()) {
      return;
    }

    this.failureCount += 1;

    const metadata = {
      requestedAt,
      failureCount: this.failureCount,
      sequence: this.sequence,
      requestId,
      timedOut: isTimeout,
    };

    this.emitState(LIVE_STATE.ERROR, { error: resolvedError, ...metadata });

    if (this.onError) {
      try {
        this.onError(resolvedError, metadata);
      } catch (callbackError) {
        console.error(
          "Market Chart live error callback failed.",
          callbackError,
        );
      }
    }

    if (!this.retry) {
      this.active = false;
    }
  }

  /* ========================================================================
     Public API
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
    this.refreshPending = false;

    this.synchronizeEnvironment();

    if (this.isPaused()) {
      this.emitState(this.getPausedState());

      return true;
    }

    this.emitState(LIVE_STATE.STARTING);

    this.schedule(this.immediate ? 0 : null);

    return true;
  }

  pause(reason = LIVE_PAUSE_REASON.MANUAL) {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.addPauseReason(reason);
  }

  resume(reason = LIVE_PAUSE_REASON.MANUAL) {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.removePauseReason(reason);
  }

  /**
   * Requests an update now, or immediately after the in-flight request.
   *
   * The context is always queued while active — even when paused — and is
   * sent with the first request that actually runs.
   *
   * @param {object|null} [context]  e.g. { fullSnapshot: true, reason }
   * @returns {boolean} true when a request is running or queued to run now;
   *   false when inactive or paused (context is still queued if active).
   */
  refresh(context = null) {
    if (this.destroyed || !this.active) {
      return false;
    }

    this.queueRefreshContext(context);

    if (this.isPaused()) {
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
    this.pendingRefreshContext = null;
    this.failureCount = 0;

    this.clearTimer();
    this.clearRequestTimeout();
    this.abortRequest();

    this.pauseReasons.delete(LIVE_PAUSE_REASON.MANUAL);

    this.emitState(LIVE_STATE.STOPPED);

    return true;
  }

  destroy() {
    if (this.destroyed) {
      return false;
    }

    this.active = false;
    this.refreshPending = false;

    this.clearTimer();
    this.clearRequestTimeout();
    this.abortRequest();

    this.listenerController.abort();

    this.emitState(LIVE_STATE.DESTROYED, { destroyed: true });

    this.destroyed = true;
    this.requestController = null;
    this.inFlight = false;
    this.pendingRefreshContext = null;
    this.pauseReasons.clear();

    return true;
  }

  getState() {
    return {
      state: this.state,
      active: this.active,
      destroyed: this.destroyed,
      inFlight: this.inFlight,

      paused: this.isPaused(),
      pauseReasons: [...this.pauseReasons],

      refreshPending: this.refreshPending,
      pendingRefreshContext: this.pendingRefreshContext
        ? { ...this.pendingRefreshContext }
        : null,

      interval: this.interval,
      alignToInterval: this.alignToInterval,
      pauseWhenHidden: this.pauseWhenHidden,
      retry: this.retry,
      requestTimeout: this.requestTimeout,
      maxRetryDelay: this.maxRetryDelay,

      failureCount: this.failureCount,
      sequence: this.sequence,
      requestSequence: this.requestSequence,

      lastRequestedAt: this.lastRequestedAt,
      lastResponseAt: this.lastResponseAt,
      lastDataUpdatedAt: this.lastDataUpdatedAt,
      nextUpdateAt: this.nextUpdateAt,
    };
  }
}

export function createMarketChartLiveController(configuration = {}) {
  return new MarketChartLiveController(configuration);
}
