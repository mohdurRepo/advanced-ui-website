/* ==========================================================================
   Market Chart Live
   ========================================================================== */

const DEFAULT_INTERVAL = 60_000;
const DEFAULT_MAX_RETRY_DELAY = 5 * 60_000;

const PAUSE_REASON_DOCUMENT_HIDDEN = "document-hidden";
const PAUSE_REASON_PAGE_HIDDEN = "page-hidden";
const PAUSE_REASON_OFFLINE = "offline";
const PAUSE_REASON_MANUAL = "manual";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function toPositiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toNonNegativeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function createTimeoutError() {
  const error = new Error("Live market request timed out.");
  error.name = "TimeoutError";

  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === 20;
}

function resolveChangedResult(result) {
  if (typeof result === "boolean") {
    return result;
  }

  if (isPlainObject(result) && typeof result.changed === "boolean") {
    return result.changed;
  }

  return false;
}

export class MarketChartLiveController {
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

    this.active = false;
    this.destroyed = false;
    this.inFlight = false;

    this.timer = null;
    this.requestTimer = null;
    this.requestController = null;

    this.refreshPending = false;
    this.pendingRefreshContext = null;
    this.pauseReasons = new Set();

    this.state = "idle";
    this.failureCount = 0;
    this.sequence = 0;
    this.requestSequence = 0;

    this.lastRequestedAt = null;
    this.lastResponseAt = null;
    this.lastDataUpdatedAt = null;
    this.nextUpdateAt = null;

    this.listenerController = new AbortControllerConstructor();

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
    this.handlePageShow = this.handlePageShow.bind(this);

    this.bindEnvironment();
    this.synchronizeEnvironment();
  }

  bindEnvironment() {
    const signal = this.listenerController.signal;

    this.document?.addEventListener?.(
      "visibilitychange",
      this.handleVisibilityChange,
      { signal },
    );

    this.window?.addEventListener?.("online", this.handleOnline, { signal });
    this.window?.addEventListener?.("offline", this.handleOffline, { signal });
    this.window?.addEventListener?.("pagehide", this.handlePageHide, {
      signal,
    });
    this.window?.addEventListener?.("pageshow", this.handlePageShow, {
      signal,
    });
  }

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

  handleVisibilityChange() {
    if (this.destroyed) {
      return;
    }

    if (this.document?.hidden) {
      this.addPauseReason(PAUSE_REASON_DOCUMENT_HIDDEN);
      return;
    }

    this.removePauseReason(PAUSE_REASON_DOCUMENT_HIDDEN);
  }

  handleOnline() {
    this.removePauseReason(PAUSE_REASON_OFFLINE);
  }

  handleOffline() {
    this.addPauseReason(PAUSE_REASON_OFFLINE);
  }

  handlePageHide() {
    this.addPauseReason(PAUSE_REASON_PAGE_HIDDEN);
  }

  handlePageShow() {
    this.removePauseReason(PAUSE_REASON_PAGE_HIDDEN);
  }

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

    this.schedule(0);

    return true;
  }

  clearTimer() {
    if (this.timer !== null) {
      this.clearTimeout(this.timer);
      this.timer = null;
    }

    this.nextUpdateAt = null;
  }

  getNextDelay() {
    if (this.configuration.alignToInterval === false) {
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

    return Math.min(this.interval * 2 ** exponent, this.maxRetryDelay);
  }

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

  clearRequestTimeout() {
    if (this.requestTimer === null) {
      return;
    }

    this.clearTimeout(this.requestTimer);
    this.requestTimer = null;
  }

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
    const refreshContext = this.pendingRefreshContext;

    this.pendingRefreshContext = null;
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
        ...refreshContext,
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

      const respondedAt = this.now();
      this.lastResponseAt = respondedAt;

      const changed = await this.applyPayload(payload, {
        requestedAt,
        respondedAt,
        sequence: nextSequence,
        requestId,
        ...refreshContext,
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

      this.schedule();
    }
  }

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

  pause(reason = PAUSE_REASON_MANUAL) {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.addPauseReason(reason);
  }

  resume(reason = PAUSE_REASON_MANUAL) {
    if (this.destroyed || !this.active) {
      return false;
    }

    return this.removePauseReason(reason);
  }

  refresh(context = null) {
    if (this.destroyed || !this.active || this.pauseReasons.size > 0) {
      return false;
    }

    if (isPlainObject(context)) {
      this.pendingRefreshContext = {
        ...(this.pendingRefreshContext || {}),
        ...context,
      };
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
    this.pauseReasons.delete(PAUSE_REASON_MANUAL);

    this.emitState("stopped");

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
    this.pauseReasons.clear();

    this.emitState("destroyed", { destroyed: true });

    this.destroyed = true;
    this.requestController = null;
    this.inFlight = false;
    this.pendingRefreshContext = null;

    return true;
  }

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

export function createMarketChartLiveController(configuration = {}) {
  return new MarketChartLiveController(configuration);
}
