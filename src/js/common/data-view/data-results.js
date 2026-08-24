/* ==========================================================================
   Data Results
   ========================================================================== */

/*
 * Shared result-count and status messaging for reusable data-view modules.
 *
 * Responsibilities:
 *
 * - synchronize result count
 * - expose loading / empty / error / ready states
 * - support page-specific labels
 * - support custom render hooks
 *
 * This module intentionally has no:
 *
 * - AJAX code
 * - DataTables code
 * - card rendering
 * - filter logic
 * - paging implementation
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const STATES = Object.freeze({
  idle: "idle",
  loading: "loading",
  ready: "ready",
  empty: "empty",
  error: "error",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveElement(root, value) {
  if (value instanceof Element) {
    return value;
  }

  if (typeof value === "string") {
    return root.querySelector(value);
  }

  return null;
}

function normalizeCount(value) {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return Math.floor(count);
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createDataResults(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("createDataResults requires an options object.");
  }

  const root = options.root || document;

  const countElement = resolveElement(root, options.count);

  const statusElement = resolveElement(root, options.status);

  let count = normalizeCount(options.initialCount || 0);

  let state = options.initialState || STATES.idle;

  let message = "";

  let destroyed = false;

  /* ========================================================================
     Labels
     ======================================================================== */

  function getLabels() {
    return {
      loading: options.labels?.loading || "Loading…",

      empty: options.labels?.empty || "No data available",

      error: options.labels?.error || "Unable to load data.",

      results: options.labels?.results || "Results",
    };
  }

  /* ========================================================================
     Count
     ======================================================================== */

  function renderCount() {
    if (destroyed || !countElement) {
      return;
    }

    if (typeof options.renderCount === "function") {
      countElement.innerHTML = options.renderCount({
        count,
        state,
        message,
      });

      return;
    }

    /*
     * If the count element contains a dedicated value node,
     * update only that node.
     *
     * Otherwise replace the count element's text content.
     */

    const valueElement = countElement.querySelector(
      "[data-result-count-value]",
    );

    if (valueElement) {
      valueElement.textContent = String(count);

      return;
    }

    countElement.textContent = `${getLabels().results}: ${count}`;
  }

  /* ========================================================================
     Status
     ======================================================================== */

  function renderStatus() {
    if (destroyed || !statusElement) {
      return;
    }

    if (typeof options.renderStatus === "function") {
      statusElement.innerHTML = options.renderStatus({
        count,
        state,
        message,
      });

      return;
    }

    statusElement.dataset.dataResultsState = state;

    switch (state) {
      case STATES.loading:
        statusElement.textContent = message || getLabels().loading;

        break;

      case STATES.empty:
        statusElement.textContent = message || getLabels().empty;

        break;

      case STATES.error:
        statusElement.textContent = message || getLabels().error;

        break;

      case STATES.ready:
      case STATES.idle:
      default:
        statusElement.textContent = message || "";
    }
  }

  /* ========================================================================
     Render
     ======================================================================== */

  function render() {
    if (destroyed) {
      return;
    }

    renderCount();
    renderStatus();

    options.afterRender?.({
      count,
      state,
      message,
    });
  }

  /* ========================================================================
     State
     ======================================================================== */

  function setState(nextState, nextMessage = "") {
    if (destroyed) {
      return;
    }

    state = nextState || STATES.idle;

    message = nextMessage || "";

    render();
  }

  /* ========================================================================
     Count API
     ======================================================================== */

  function setCount(nextCount) {
    if (destroyed) {
      return;
    }

    const normalized = normalizeCount(nextCount);

    if (normalized === count) {
      return;
    }

    count = normalized;

    renderCount();

    options.onCountChange?.(count);
  }

  /* ========================================================================
     Convenience States
     ======================================================================== */

  function showLoading(nextMessage = "") {
    setState(STATES.loading, nextMessage);
  }

  function showReady(nextCount = count) {
    count = normalizeCount(nextCount);

    state = STATES.ready;

    message = "";

    render();
  }

  function showEmpty(nextMessage = "") {
    count = 0;

    setState(STATES.empty, nextMessage);
  }

  function showError(nextMessage = "") {
    count = 0;

    setState(STATES.error, nextMessage);
  }

  /* ========================================================================
     Reset
     ======================================================================== */

  function reset() {
    if (destroyed) {
      return;
    }

    count = normalizeCount(options.initialCount || 0);

    state = options.initialState || STATES.idle;

    message = "";

    render();
  }

  /* ========================================================================
     Queries
     ======================================================================== */

  function getState() {
    return Object.freeze({
      count,
      state,
      message,
    });
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  if (options.autoRender !== false) {
    render();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    destroy,

    getState,

    reset,

    setCount,
    setState,

    showEmpty,
    showError,
    showLoading,
    showReady,
  });
}
