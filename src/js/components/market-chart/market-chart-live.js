/* *
 *
 *  Market Chart — Live
 *
 *  Network polling lifecycle for Market Chart.
 *
 *  Highcharts has no equivalent of this module: deciding *when* a request
 *  runs, pausing/resuming on visibility and connectivity changes, retrying
 *  with backoff, enforcing a request timeout, and reporting whether a
 *  response actually changed data are all application concerns. This
 *  module owns exactly that, and nothing about rendering.
 *
 *  Contract
 *  --------
 *  ```
 *  fetchUpdates(metadata) -> payload
 *  onData(payload, metadata) -> boolean | Promise<boolean>
 *  ```
 *
 *  `onData` must return `true` only when the payload changed canonical
 *  market data. Returning `false` (or omitting a return) means the
 *  request succeeded but nothing changed — no redraw, no "last updated"
 *  bump. See `MarketChartController#applyLiveData` for the consumer of
 *  this contract.
 *
 * */

"use strict";

/* *
 *
 *  Constants
 *
 * */

/**
 * Default polling interval, in milliseconds.
 *
 * @type {number}
 */
const DEFAULT_INTERVAL = 60_000;

/**
 * Ceiling for exponential retry backoff, in milliseconds.
 *
 * @type {number}
 */
const DEFAULT_MAX_RETRY_DELAY = 5 * 60_000;

/**
 * Pause reason: `document.visibilityState` is `"hidden"`.
 *
 * @type {string}
 */
const PAUSE_REASON_DOCUMENT_HIDDEN = "document-hidden";

/**
 * Pause reason: the page has entered the browser's back/forward cache, or
 * is otherwise navigating away (`pagehide`).
 *
 * @type {string}
 */
const PAUSE_REASON_PAGE_HIDDEN = "page-hidden";

/**
 * Pause reason: `navigator.onLine` is `false`.
 *
 * @type {string}
 */
const PAUSE_REASON_OFFLINE = "offline";

/**
 * Pause reason: an explicit caller-requested pause with no other reason
 * given.
 *
 * @type {string}
 */
const PAUSE_REASON_MANUAL = "manual";

/* *
 *
 *  Type Definitions (JSDoc only — no runtime effect)
 *
 *  @typedef {object} MarketChartLiveFetchMetadata
 *  @property {AbortSignal} signal
 *  @property {number} requestedAt
 *  @property {number} sequence
 *  @property {number} requestId
 *
 *  @typedef {object} MarketChartLiveConfiguration
 *  @property {(metadata: MarketChartLiveFetchMetadata) => Promise<*>} fetchUpdates
 *          Required. Performs the network request and resolves with the raw payload.
 *  @property {number} [interval]                Polling interval, in milliseconds.
 *  @property {boolean} [alignToInterval]        Align ticks to interval boundaries rather than to start time.
 *  @property {boolean} [immediate]               Fire an initial request as soon as `start()` is called.
 *  @property {boolean} [pauseWhenHidden]         Pause polling while `document.hidden` is `true`.
 *  @property {boolean} [retry]                   Retry with exponential backoff after a failed request.
 *  @property {number} [maxRetryDelay]            Ceiling for exponential retry backoff, in milliseconds.
 *  @property {number} [requestTimeout]           Abort a request that exceeds this duration, in milliseconds. `0` disables the timeout.
 *  @property {(state: object) => void} [onStateChange]
 *  @property {(error: Error, metadata: object) => void} [onError]
 *  @property {(payload: *, metadata: object) => boolean|Promise<boolean>} [onData]
 *  @property {object} [environment]              Injectable environment for testing (`window`, `document`, `navigator`, `now`, timers, `AbortController`).
 *
 * */

/* *
 *
 *  Generic Helpers
 *
 * */

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {*} value
 * @param {number} fallback
 * @returns {number} `value` if it is a finite number greater than zero, else `fallback`.
 */
function toPositiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * @param {*} value
 * @param {number} [fallback=0]
 * @returns {number} `value` if it is a finite number greater than or equal to zero, else `fallback`.
 */
function toNonNegativeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

/**
 * @returns {Error} A named `TimeoutError` for a request-timeout abort.
 */
function createTimeoutError() {
  const error = new Error("Live market request timed out.");

  error.name = "TimeoutError";

  return error;
}

/**
 * @param {*} error
 * @returns {boolean} Whether `error` represents a `fetch`/`AbortController` cancellation.
 */
function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === 20;
}

/**
 * Resolves an `onData` return value to a plain boolean, per the module
 * contract. Accepts either a bare boolean or `{ changed: boolean }`, so
 * callers may return richer metadata without breaking the contract.
 *
 * @param {*} result
 * @returns {boolean}
 */
function resolveChangedResult(result) {
  if (typeof result === "boolean") {
    return result;
  }

  if (isPlainObject(result) && typeof result.changed === "boolean") {
    return result.changed;
  }

  return false;
}

/* *
 *
 *  Live Controller
 *
 * */

/**
 * Owns the polling lifecycle for one Market Chart's intraday live data:
 * scheduling, pausing/resuming on visibility and connectivity changes,
 * retry backoff, request timeouts, and reporting whether a response
 * actually changed canonical data.
 *
 * @class
 */
class MarketChartLiveController {
  /**
   * @param {MarketChartLiveConfiguration} [configuration]
   * @throws {TypeError} If `configuration.fetchUpdates` is not a function,
   *         or if the environment is missing `AbortController` or timer
   *         functions.
   */
  constructor(configuration = {}) {
    const source = isPlainObject(configuration) ? configuration : {};

    if (typeof source.fetchUpdates !== "function") {
      throw new TypeError("Market Chart Live requires fetchUpdates().");
    }

    this.configuration = {
      interval: DEFAULT_INTERVAL,
      alignToInterval: true,
      immediate: false,
      pauseWhenHidden: true,
      retry: true,
      maxRetryDelay: DEFAULT_MAX_RETRY_DELAY,
      requestTimeout: 0,
      onStateChange: null,
      onError: null,
      onData: null,
      ...source,
    };

    /* --------------------------------------------------------------
     * Environment
     * -------------------------------------------------------------- */

    const environment = isPlainObject(source.environment)
      ? source.environment
      : {};

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

    if (
      typeof this.setTimeout !== "function" ||
      typeof this.clearTimeout !== "function"
    ) {
      throw new TypeError("Market Chart Live requires timer functions.");
    }

    this.AbortController = AbortControllerConstructor;

    /* --------------------------------------------------------------
     * Normalized Configuration
     * -------------------------------------------------------------- */

    this.interval = toPositiveNumber(
      this.configuration.interval,
      DEFAULT_INTERVAL,
    );

    this.maxRetryDelay = toPositiveNumber(
      this.configuration.maxRetryDelay,
      DEFAULT_MAX_RETRY_DELAY,
    );

    this.requestTimeout = toNonNegativeNumber(
      this.configuration.requestTimeout,
      0,
    );

    /* --------------------------------------------------------------
     * Runtime State
     * -------------------------------------------------------------- */

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

    /*
     * `sequence` counts successfully completed polling cycles.
     * `requestSequence` counts every request attempt, including
     * failures.
     */
    this.sequence = 0;
    this.requestSequence = 0;

    /*
     * `lastRequestedAt` / `lastResponseAt` track network activity.
     * `lastDataUpdatedAt` only moves when `onData()` confirms a real
     * change — a closed market can keep responding without ever
     * moving it.
     */
    this.lastRequestedAt = null;
    this.lastResponseAt = null;
    this.lastDataUpdatedAt = null;

    this.nextUpdateAt = null;

    /* --------------------------------------------------------------
     * Event Lifecycle
     * -------------------------------------------------------------- */

    this.listenerController = new AbortControllerConstructor();

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
    this.handlePageShow = this.handlePageShow.bind(this);

    this.bindEnvironment();
    this.synchronizeEnvironment();
  }

  /* *
   *
   *  Environment
   *
   * */

  /**
   * Wires visibility, connectivity, and page-lifecycle listeners. All
   * listeners share `this.listenerController`'s signal so
   * {@link MarketChartLiveController#destroy} removes every one of them
   * in a single call.
   *
   * @returns {void}
   */
  bindEnvironment() {
    const signal = this.listenerController.signal;

    this.document?.addEventListener?.(
      "visibilitychange",
      this.handleVisibilityChange,
      { signal },
    );

    this.window?.addEventListener?.("online", this.handleOnline, { signal });
    this.window?.addEventListener?.("offline", this.handleOffline, { signal });

    // BFCache / page navigation lifecycle.
    this.window?.addEventListener?.("pagehide", this.handlePageHide, {
      signal,
    });

    this.window?.addEventListener?.("pageshow", this.handlePageShow, {
      signal,
    });
  }

  /**
   * Reconciles pause reasons with the environment's *current* state.
   * Called once at construction so a controller created in a hidden or
   * offline tab starts paused, rather than firing one doomed request
   * first.
   *
   * @returns {void}
   */
  synchronizeEnvironment() {
    if (this.configuration.pauseWhenHidden !== false && this.document?.hidden) {
      this.pauseReasons.add(PAUSE_REASON_DOCUMENT_HIDDEN);
    } else {
      this.pauseReasons.delete(PAUSE_REASON_DOCUMENT_HIDDEN);
    }

    if (this.navigator?.onLine === false) {
      this.pauseReasons.add(PAUSE_REASON_OFFLINE);
    } else {
      this.pauseReasons.delete(PAUSE_REASON_OFFLINE);
    }
  }

  /**
   * `visibilitychange` handler.
   *
   * @returns {void}
   */
  handleVisibilityChange() {
    if (this.destroyed) {
      return;
    }

    if (this.configuration.pauseWhenHidden !== false) {
      if (this.document?.hidden) {
        this.addPauseReason(PAUSE_REASON_DOCUMENT_HIDDEN);
      } else {
        this.removePauseReason(PAUSE_REASON_DOCUMENT_HIDDEN);
      }

      return;
    }

    // Background polling is allowed, but browsers throttle timers in
    // hidden tabs. Reconcile immediately once visible again.
    if (!this.document?.hidden) {
      this.refresh();
    }
  }

  /**
   * `online` handler.
   *
   * @returns {void}
   */
  handleOnline() {
    this.removePauseReason(PAUSE_REASON_OFFLINE);
  }

  /**
   * `offline` handler.
   *
   * @returns {void}
   */
  handleOffline() {
    this.addPauseReason(PAUSE_REASON_OFFLINE);
  }

  /**
   * `pagehide` handler.
   *
   * @returns {void}
   */
  handlePageHide() {
    this.addPauseReason(PAUSE_REASON_PAGE_HIDDEN);
  }

  /**
   * `pageshow` handler.
   *
   * @returns {void}
   */
  handlePageShow() {
    this.removePauseReason(PAUSE_REASON_PAGE_HIDDEN);
  }

  /* *
   *
   *  State
   *
   * */

  /**
   * Invokes `configuration.onStateChange`, isolating consumer errors so
   * a throwing callback cannot break the polling loop.
   *
   * @param {object} payload
   * @returns {void}
   */
  notifyStateChange(payload) {
    if (typeof this.configuration.onStateChange !== "function") {
      return;
    }

    try {
      this.configuration.onStateChange(payload);
    } catch (error) {
      console.error("Market chart live state callback failed.", error);
    }
  }

  /**
   * @param {string} state
   * @param {object} [detail]
   * @returns {boolean} `false` when already destroyed (no-op).
   */
  emitState(state, detail = {}) {
    if (this.destroyed) {
      return false;
    }

    const previousState = this.state;

    this.state = state;

    this.notifyStateChange({
      ...this.getState(),
      previousState,
      ...detail,
    });

    return true;
  }

  /**
   * @returns {'offline'|'hidden'|'paused'}
   *          The most specific applicable paused-state label, checked
   *          in priority order: offline, then hidden, then a generic
   *          manual/other pause.
   */
  getPausedState() {
    if (this.pauseReasons.has(PAUSE_REASON_OFFLINE)) {
      return "offline";
    }

    if (
      this.pauseReasons.has(PAUSE_REASON_DOCUMENT_HIDDEN) ||
      this.pauseReasons.has(PAUSE_REASON_PAGE_HIDDEN)
    ) {
      return "hidden";
    }

    return "paused";
  }

  /* *
   *
   *  Pause Reasons
   *
   * */

  /**
   * Adds a pause reason. Polling is paused as soon as *any* reason is
   * present; the in-flight request (if any) is aborted immediately
   * rather than being allowed to complete in the background.
   *
   * @param {string} reason
   * @returns {boolean} Whether the reason was newly added.
   */
  addPauseReason(reason) {
    const normalizedReason = String(reason ?? "").trim();

    if (
      this.destroyed ||
      !normalizedReason ||
      this.pauseReasons.has(normalizedReason)
    ) {
      return false;
    }

    this.pauseReasons.add(normalizedReason);

    this.clearTimer();
    this.refreshPending = false;
    this.abortRequest();

    if (this.active) {
      this.emitState(this.getPausedState(), { reason: normalizedReason });
    }

    return true;
  }

  /**
   * Removes a pause reason. Polling only resumes once *every* reason
   * has been removed.
   *
   * @param {string} reason
   * @returns {boolean} Whether the reason was present and removed.
   */
  removePauseReason(reason) {
    const normalizedReason = String(reason ?? "").trim();

    if (
      this.destroyed ||
      !normalizedReason ||
      !this.pauseReasons.has(normalizedReason)
    ) {
      return false;
    }

    this.pauseReasons.delete(normalizedReason);

    if (!this.active || this.pauseReasons.size > 0) {
      return true;
    }

    // Resuming immediately reconciles anything missed while paused.
    // Normal interval scheduling resumes after that request completes.
    this.schedule(0);

    return true;
  }

  /* *
   *
   *  Scheduling
   *
   * */

  /**
   * @returns {void}
   */
  clearTimer() {
    if (this.timer !== null) {
      this.clearTimeout(this.timer);
      this.timer = null;
    }

    this.nextUpdateAt = null;
  }

  /**
   * @returns {number}
   *          Milliseconds until the next tick. When
   *          `configuration.alignToInterval` is enabled (default), this
   *          aligns ticks to clean interval boundaries (e.g. every
   *          exact minute) rather than to whenever polling happened to
   *          start.
   */
  getNextDelay() {
    if (this.configuration.alignToInterval === false) {
      return this.interval;
    }

    const now = this.now();
    const remainder = now % this.interval;

    return remainder === 0 ? this.interval : this.interval - remainder;
  }

  /**
   * Arms the next polling tick. Always clears any existing timer first,
   * so this is safe to call redundantly.
   *
   * @param {number|null} [delay]
   *        Explicit delay in milliseconds. `null` (default) uses
   *        {@link MarketChartLiveController#getNextDelay}.
   * @returns {boolean}
   *          `false` when destroyed, inactive, or paused — in which
   *          case nothing is scheduled.
   */
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

  /**
   * @returns {number}
   *          Exponential backoff delay for the current
   *          `failureCount`, capped at `maxRetryDelay`.
   */
  getRetryDelay() {
    const exponent = Math.min(Math.max(this.failureCount - 1, 0), 8);

    return Math.min(this.interval * 2 ** exponent, this.maxRetryDelay);
  }

  /* *
   *
   *  Request Lifecycle
   *
   * */

  /**
   * @param {*} [reason]
   * @returns {boolean} Whether an in-flight request was aborted.
   */
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

  /**
   * @returns {void}
   */
  clearRequestTimeout() {
    if (this.requestTimer === null) {
      return;
    }

    this.clearTimeout(this.requestTimer);
    this.requestTimer = null;
  }

  /**
   * Invokes `configuration.onData` and resolves its result per the
   * module's changed/unchanged contract.
   *
   * @param {*} payload
   * @param {object} metadata
   * @returns {Promise<boolean>}
   */
  async applyPayload(payload, metadata) {
    const onData = this.configuration.onData;

    if (
      payload === null ||
      payload === undefined ||
      typeof onData !== "function"
    ) {
      return false;
    }

    return resolveChangedResult(await onData(payload, metadata));
  }

  /**
   * Runs exactly one polling cycle: fetch, apply, then schedule the
   * next cycle (or a retry, on failure). Recursive `setTimeout`
   * scheduling — rather than `setInterval` — guarantees requests never
   * overlap, since the next cycle is only armed once this one, and its
   * `onData` callback, have both finished.
   *
   * @returns {Promise<boolean>}
   *          `true` only when the cycle completed successfully. This
   *          does **not** mean the market data necessarily changed —
   *          see the module contract.
   */
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

    let requestTimedOut = false;

    if (this.requestTimeout > 0) {
      this.requestTimer = this.setTimeout(() => {
        if (controller.signal.aborted) {
          return;
        }

        requestTimedOut = true;

        this.abortRequest(createTimeoutError());
      }, this.requestTimeout);
    }

    try {
      const payload = await this.configuration.fetchUpdates({
        signal: controller.signal,
        requestedAt,
        sequence: nextSequence,
        requestId,
      });

      this.clearRequestTimeout();

      if (
        controller.signal.aborted ||
        this.requestController !== controller ||
        !this.active ||
        this.pauseReasons.size > 0
      ) {
        return false;
      }

      // The request succeeded even if the returned data is
      // unchanged.
      const respondedAt = this.now();

      this.lastResponseAt = respondedAt;

      const changed = await this.applyPayload(payload, {
        requestedAt,
        respondedAt,
        sequence: nextSequence,
        requestId,
      });

      if (
        controller.signal.aborted ||
        this.requestController !== controller ||
        !this.active ||
        this.pauseReasons.size > 0
      ) {
        return false;
      }

      const completedAt = this.now();

      if (changed) {
        this.lastDataUpdatedAt = completedAt;
      }

      this.sequence = nextSequence;
      this.failureCount = 0;

      this.emitState("live", {
        payload,
        changed,
        requestedAt,
        respondedAt,
        completedAt,
        sequence: this.sequence,
        requestId,
      });

      return true;
    } catch (error) {
      const signalReason = controller.signal.aborted
        ? controller.signal.reason
        : null;

      const resolvedError = signalReason || error;
      const timedOut =
        requestTimedOut || resolvedError?.name === "TimeoutError";

      const cancelled =
        !timedOut && (isAbortError(resolvedError) || controller.signal.aborted);

      // Intentional lifecycle cancellation (destroyed, range
      // changed, page hidden, offline) is not a polling failure.
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

      this.emitState("error", { error: resolvedError, ...metadata });

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

      this.schedule();
    }
  }

  /* *
   *
   *  Public Lifecycle
   *
   * */

  /**
   * Starts polling. Safe to call when already active (no-op, returns
   * `true`). If the environment is currently paused (hidden tab,
   * offline), the controller enters a paused state immediately rather
   * than firing a doomed first request.
   *
   * @returns {boolean} `false` only when the controller is destroyed.
   */
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

    this.schedule(this.configuration.immediate === true ? 0 : null);

    return true;
  }

  /**
   * @param {string} [reason=PAUSE_REASON_MANUAL]
   * @returns {boolean}
   */
  pause(reason = PAUSE_REASON_MANUAL) {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.addPauseReason(reason);
  }

  /**
   * @param {string} [reason=PAUSE_REASON_MANUAL]
   * @returns {boolean}
   */
  resume(reason = PAUSE_REASON_MANUAL) {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.removePauseReason(reason);
  }

  /**
   * Forces an out-of-band request. If a request is already in flight,
   * the refresh is deferred until it completes (`refreshPending`)
   * rather than firing a second, overlapping request.
   *
   * @returns {boolean}
   *          `false` when destroyed, inactive, or paused.
   */
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

  /**
   * Stops polling. Unlike {@link MarketChartLiveController#destroy},
   * the controller can be {@link MarketChartLiveController#start}ed
   * again afterward. Environment-driven pause reasons (hidden, offline)
   * survive a stop/start cycle; only a manual pause is cleared.
   *
   * @returns {boolean} `false` only when already destroyed.
   */
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

    this.pauseReasons.delete(PAUSE_REASON_MANUAL);

    this.emitState("stopped");

    return true;
  }

  /**
   * Permanently tears down the controller: aborts any in-flight
   * request, removes every environment listener, and marks the
   * instance unusable. Not reversible — use
   * {@link MarketChartLiveController#stop} for a resumable pause.
   *
   * @returns {boolean} `false` only when already destroyed.
   */
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
    this.pauseReasons.clear();

    this.emitState("destroyed", { destroyed: true });

    this.destroyed = true;
    this.requestController = null;
    this.inFlight = false;

    return true;
  }

  /* *
   *
   *  Public State
   *
   * */

  /**
   * @returns {object} A snapshot of the controller's current public state.
   */
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
      retry: this.configuration.retry !== false,
      requestTimeout: this.requestTimeout,
      maxRetryDelay: this.maxRetryDelay,

      failureCount: this.failureCount,
      sequence: this.sequence,
      requestSequence: this.requestSequence,
      refreshPending: this.refreshPending,

      lastRequestedAt: this.lastRequestedAt,
      lastResponseAt: this.lastResponseAt,
      lastDataUpdatedAt: this.lastDataUpdatedAt,

      nextUpdateAt: this.nextUpdateAt,
    };
  }
}

/* *
 *
 *  Factory
 *
 * */

/**
 * @param {MarketChartLiveConfiguration} [configuration]
 * @returns {MarketChartLiveController}
 */
function createMarketChartLiveController(configuration = {}) {
  return new MarketChartLiveController(configuration);
}

/* *
 *
 *  Default Export
 *
 * */

const MarketChartLive = {
  MarketChartLiveController,
  createMarketChartLiveController,
  PAUSE_REASON_DOCUMENT_HIDDEN,
  PAUSE_REASON_PAGE_HIDDEN,
  PAUSE_REASON_OFFLINE,
  PAUSE_REASON_MANUAL,
  DEFAULT_INTERVAL,
  DEFAULT_MAX_RETRY_DELAY,
};

export default MarketChartLive;

/* *
 *
 *  Named Exports
 *
 * */

export {
  MarketChartLiveController,
  createMarketChartLiveController,
  PAUSE_REASON_DOCUMENT_HIDDEN,
  PAUSE_REASON_PAGE_HIDDEN,
  PAUSE_REASON_OFFLINE,
  PAUSE_REASON_MANUAL,
  DEFAULT_INTERVAL,
  DEFAULT_MAX_RETRY_DELAY,
};
