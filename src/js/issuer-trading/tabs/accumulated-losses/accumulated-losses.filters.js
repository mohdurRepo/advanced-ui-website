/* ==========================================================================
   Accumulated Losses Filters
   ========================================================================== */

/*
 * Filter configuration and UI coordination for the Accumulated Losses tab.
 *
 * Responsibilities:
 *
 * - define the percentage filter
 * - normalize legacy percentage values
 * - reset the filter to All
 * - synchronize the native and enhanced select
 * - request one reload for every meaningful change
 *
 * This module intentionally has no:
 *
 * - endpoint configuration
 * - request transport
 * - response normalization
 * - result rendering
 * - pagination rendering
 */

/* ==========================================================================
   Constants
   ========================================================================== */

export const ACCUMULATED_LOSSES_PERCENTAGES = Object.freeze({
  all: "All",

  fiftyOrMore: "50-MORE",

  thirtyFiveToFifty: "35-50",

  twentyToThirtyFive: "20-35",
});

export const ACCUMULATED_LOSSES_FILTER_SELECTORS = Object.freeze({
  form: "[data-accumulated-losses-filters]",

  percentage: "[data-accumulated-losses-percentage]",

  reset: "[data-accumulated-losses-reset]",
});

const ALLOWED_PERCENTAGES = new Set(
  Object.values(ACCUMULATED_LOSSES_PERCENTAGES),
);

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1);
}

function isFormElement(value) {
  return isElement(value) && value.tagName === "FORM";
}

function isSelectElement(value) {
  return isElement(value) && value.tagName === "SELECT";
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function getRootElement(root) {
  if (root && typeof root.querySelector === "function") {
    return root;
  }

  throw new TypeError(
    "Accumulated Losses filters require a valid root element.",
  );
}

function dispatchControlChange(element) {
  if (!isElement(element)) {
    return;
  }

  const EventConstructor =
    element.ownerDocument?.defaultView?.Event ?? window.Event;

  element.dispatchEvent(
    new EventConstructor("change", {
      bubbles: true,
    }),
  );
}

/* ==========================================================================
   Percentage Normalization
   ========================================================================== */

export function normalizeAccumulatedLossesPercentage(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return ACCUMULATED_LOSSES_PERCENTAGES.all;
  }

  if (normalized.toLowerCase() === "all") {
    return ACCUMULATED_LOSSES_PERCENTAGES.all;
  }

  const uppercaseValue = normalized.toUpperCase();

  if (ALLOWED_PERCENTAGES.has(uppercaseValue)) {
    return uppercaseValue;
  }

  return ACCUMULATED_LOSSES_PERCENTAGES.all;
}

/* ==========================================================================
   Filter Definitions
   ========================================================================== */

export function createAccumulatedLossesFilterDefinitions() {
  return {
    percentage: {
      selector: ACCUMULATED_LOSSES_FILTER_SELECTORS.percentage,

      required: true,

      effect: "reload",

      resetValue: ACCUMULATED_LOSSES_PERCENTAGES.all,

      normalize: normalizeAccumulatedLossesPercentage,
    },
  };
}

/* ==========================================================================
   Filter Binding
   ========================================================================== */

export function bindAccumulatedLossesFilters(options = {}) {
  if (!isObject(options)) {
    throw new TypeError(
      "bindAccumulatedLossesFilters requires an options object.",
    );
  }

  const root = getRootElement(options.root);

  const filters = options.filters;

  const requiredMethods = ["getState", "reset", "subscribe", "sync"];

  const validFilterController = requiredMethods.every(
    (method) => typeof filters?.[method] === "function",
  );

  if (!validFilterController) {
    throw new TypeError(
      "Accumulated Losses requires a valid data-filter controller.",
    );
  }

  const form = root.querySelector(ACCUMULATED_LOSSES_FILTER_SELECTORS.form);

  const percentageElement = root.querySelector(
    ACCUMULATED_LOSSES_FILTER_SELECTORS.percentage,
  );

  if (!isFormElement(form)) {
    throw new Error("Accumulated Losses filter form was not found.");
  }

  if (!isSelectElement(percentageElement)) {
    throw new Error("Accumulated Losses percentage filter was not found.");
  }

  const abortController = new AbortController();

  let destroyed = false;

  /* ========================================================================
     Reload
     ======================================================================== */

  function requestReload(source = null) {
    if (destroyed) {
      return;
    }

    options.onReload?.({
      filters: filters.getState(),

      source,
    });
  }

  /* ========================================================================
     Enhanced Select Synchronization
     ======================================================================== */

  function synchronizePercentageControl() {
    filters.sync();

    dispatchControlChange(percentageElement);
  }

  /* ========================================================================
     Filter Changes
     ======================================================================== */

  const unsubscribe = filters.subscribe((event) => {
    if (destroyed) {
      return;
    }

    if (event.key === "percentage" || event.type === "reset") {
      requestReload(event.source);
    }
  });

  /* ========================================================================
     Reset
     ======================================================================== */

  function resetFilters(source = null) {
    const changed = filters.reset({
      type: "reset",

      effect: "reload",

      source,
    });

    /*
     * filters.reset() updates the native select and its cached value.
     * Dispatching change afterward updates the enhanced CustomSelect without
     * producing a second filter notification.
     */

    synchronizePercentageControl();

    /*
     * Reset should still refresh the result set when the current value is
     * already All.
     */

    if (!changed) {
      requestReload(source);
    }

    return changed;
  }

  /* ========================================================================
     Form Events
     ======================================================================== */

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      filters.sync();

      requestReload(event);
    },
    {
      signal: abortController.signal,
    },
  );

  form.addEventListener(
    "reset",
    (event) => {
      event.preventDefault();

      resetFilters(event);
    },
    {
      signal: abortController.signal,
    },
  );

  /* ========================================================================
     Initial Synchronization
     ======================================================================== */

  filters.sync();

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    abortController.abort();

    unsubscribe();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    destroy,

    reset: resetFilters,

    sync() {
      if (destroyed) {
        return;
      }

      synchronizePercentageControl();
    },
  });
}
