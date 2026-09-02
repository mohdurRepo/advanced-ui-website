/* ==========================================================================
   Company Status Filters
   ========================================================================== */

/*
 * Filter configuration and UI coordination for:
 *
 * - suspended companies
 * - delisted companies
 * - suspended funds
 * - delisted funds
 *
 * Responsibilities:
 *
 * - define and normalize the four legacy form types
 * - resolve the active table/card presentation
 * - provide the default one-calendar-month date range
 * - coordinate filter changes and reset behavior
 * - synchronize enhanced select and date controls
 * - coalesce related control changes into one reload
 *
 * This module intentionally has no:
 *
 * - endpoint URLs
 * - AJAX transport
 * - request parameter formatting
 * - table rendering
 * - card rendering
 * - response normalization
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { formatInputDate } from "../../../shared/trading/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

export const COMPANY_STATUS_TYPES = Object.freeze({
  suspension: "Suspension",

  delisting: "Delisting",

  suspensionFunds: "Suspension_Funds",

  delistedFunds: "Delisted_Funds",
});

export const COMPANY_STATUS_VIEWS = Object.freeze({
  suspension: "suspension",

  delisting: "delisting",
});

export const COMPANY_STATUS_FILTER_SELECTORS = Object.freeze({
  form: "[data-company-status-filters]",

  type: "[data-company-status-type]",

  dateFrom: "[data-company-status-date-from]",

  dateTo: "[data-company-status-date-to]",

  reset: "[data-company-status-reset]",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function getRootElement(root) {
  if (
    root &&
    typeof root.querySelector === "function" &&
    typeof root.querySelectorAll === "function"
  ) {
    return root;
  }

  throw new TypeError("Company Status filters require a valid root element.");
}

function dispatchControlChange(element) {
  if (!(element instanceof Element)) {
    return;
  }

  element.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );
}

/* ==========================================================================
   Type Normalization
   ========================================================================== */

export function normalizeCompanyStatusType(value) {
  const normalized = normalizeString(value);

  const supportedTypes = Object.values(COMPANY_STATUS_TYPES);

  return supportedTypes.includes(normalized)
    ? normalized
    : COMPANY_STATUS_TYPES.suspension;
}

/* ==========================================================================
   View Resolution
   ========================================================================== */

export function getCompanyStatusView(filterState = {}) {
  const type = normalizeCompanyStatusType(
    isObject(filterState) ? filterState.type : filterState,
  );

  if (
    type === COMPANY_STATUS_TYPES.suspension ||
    type === COMPANY_STATUS_TYPES.suspensionFunds
  ) {
    return COMPANY_STATUS_VIEWS.suspension;
  }

  return COMPANY_STATUS_VIEWS.delisting;
}

export function isCompanyStatusSuspensionView(filterState = {}) {
  return getCompanyStatusView(filterState) === COMPANY_STATUS_VIEWS.suspension;
}

export function isCompanyStatusDelistingView(filterState = {}) {
  return getCompanyStatusView(filterState) === COMPANY_STATUS_VIEWS.delisting;
}

/* ==========================================================================
   Local Date Helpers
   ========================================================================== */

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function formatLocalInputDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

function subtractCalendarMonth(date) {
  const year = date.getFullYear();

  const month = date.getMonth();

  const day = date.getDate();

  /*
   * Start from the first day of the target month, then clamp the original
   * day to the number of days available in that month.
   *
   * Example:
   *
   * March 31 -> February 28/29
   */

  const targetMonthStart = new Date(year, month - 1, 1);

  const lastDayOfTargetMonth = new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth() + 1,
    0,
  ).getDate();

  targetMonthStart.setDate(Math.min(day, lastDayOfTargetMonth));

  return targetMonthStart;
}

/* ==========================================================================
   Default Date Range
   ========================================================================== */

export function createCompanyStatusDefaultDateRange(
  referenceDate = new Date(),
) {
  const safeReferenceDate =
    referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? new Date(referenceDate.getTime())
      : new Date();

  const toDate = formatLocalInputDate(safeReferenceDate);

  const fromDate = formatLocalInputDate(
    subtractCalendarMonth(safeReferenceDate),
  );

  return Object.freeze({
    fromDate,

    toDate,
  });
}

/* ==========================================================================
   Date Normalization
   ========================================================================== */

function normalizeDateValue(value) {
  return formatInputDate(value, "");
}

function normalizeDefaultRange(value) {
  if (!isObject(value)) {
    return createCompanyStatusDefaultDateRange();
  }

  const fromDate = normalizeDateValue(value.fromDate);

  const toDate = normalizeDateValue(value.toDate);

  if (!fromDate || !toDate) {
    return createCompanyStatusDefaultDateRange();
  }

  return Object.freeze({
    fromDate,

    toDate,
  });
}

/* ==========================================================================
   Filter Definitions
   ========================================================================== */

export function createCompanyStatusFilterDefinitions(options = {}) {
  const defaultRange = normalizeDefaultRange(options.defaultRange);

  return {
    type: {
      selector: COMPANY_STATUS_FILTER_SELECTORS.type,

      required: true,

      effect: "view",

      resetValue: COMPANY_STATUS_TYPES.suspension,

      normalize: normalizeCompanyStatusType,
    },

    fromDate: {
      selector: COMPANY_STATUS_FILTER_SELECTORS.dateFrom,

      required: true,

      effect: "reload",

      resetValue: defaultRange.fromDate,

      normalize: normalizeDateValue,
    },

    toDate: {
      selector: COMPANY_STATUS_FILTER_SELECTORS.dateTo,

      required: true,

      effect: "reload",

      resetValue: defaultRange.toDate,

      normalize: normalizeDateValue,
    },
  };
}

/* ==========================================================================
   Filter Binding
   ========================================================================== */

export function bindCompanyStatusFilters(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("bindCompanyStatusFilters requires an options object.");
  }

  const root = getRootElement(options.root);

  const filters = options.filters;

  if (
    !filters ||
    typeof filters.getState !== "function" ||
    typeof filters.reset !== "function" ||
    typeof filters.setState !== "function" ||
    typeof filters.subscribe !== "function" ||
    typeof filters.sync !== "function"
  ) {
    throw new TypeError(
      "Company Status requires a valid data-filter controller.",
    );
  }

  const form = root.querySelector(COMPANY_STATUS_FILTER_SELECTORS.form);

  const typeElement = root.querySelector(COMPANY_STATUS_FILTER_SELECTORS.type);

  const dateFromElement = root.querySelector(
    COMPANY_STATUS_FILTER_SELECTORS.dateFrom,
  );

  const dateToElement = root.querySelector(
    COMPANY_STATUS_FILTER_SELECTORS.dateTo,
  );

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Company Status filter form was not found.");
  }

  if (!(typeElement instanceof HTMLSelectElement)) {
    throw new Error("Company Status Type filter was not found.");
  }

  if (
    !(dateFromElement instanceof HTMLInputElement) ||
    !(dateToElement instanceof HTMLInputElement)
  ) {
    throw new Error("Company Status date filters were not found.");
  }

  const defaultRange = normalizeDefaultRange(options.defaultRange);

  const abortController = new AbortController();

  let reloadFrame = null;

  let destroyed = false;

  /* ========================================================================
     Enhanced Control Synchronization
     ======================================================================== */

  function announceControlUpdates() {
    [typeElement, dateFromElement, dateToElement].forEach(
      dispatchControlChange,
    );
  }

  /* ========================================================================
     Reload Coordination
     ======================================================================== */

  function cancelScheduledReload() {
    if (reloadFrame === null) {
      return;
    }

    window.cancelAnimationFrame(reloadFrame);

    reloadFrame = null;
  }

  function scheduleReload(source = null) {
    if (destroyed) {
      return;
    }

    cancelScheduledReload();

    reloadFrame = window.requestAnimationFrame(() => {
      reloadFrame = null;

      if (destroyed) {
        return;
      }

      const filterState = filters.getState();

      options.onReload?.({
        filters: filterState,

        source,

        view: getCompanyStatusView(filterState),
      });
    });
  }

  /* ========================================================================
     Initial State
     ======================================================================== */

  const initialState = filters.getState();

  filters.setState(
    {
      type: normalizeCompanyStatusType(initialState.type),

      fromDate:
        normalizeDateValue(initialState.fromDate) || defaultRange.fromDate,

      toDate: normalizeDateValue(initialState.toDate) || defaultRange.toDate,
    },
    {
      notify: false,
    },
  );

  filters.sync();

  /*
   * Notify the existing design-system controls after the native values have
   * been synchronized. DataFilters already owns the same values, so these
   * events do not create duplicate filter notifications.
   */

  announceControlUpdates();

  /* ========================================================================
     Filter Changes
     ======================================================================== */

  const unsubscribe = filters.subscribe((event) => {
    if (destroyed) {
      return;
    }

    scheduleReload(event.source);
  });

  /* ========================================================================
     Form Submission
     ======================================================================== */

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      filters.sync();

      scheduleReload(event);
    },
    {
      signal: abortController.signal,
    },
  );

  /* ========================================================================
     Reset
     ======================================================================== */

  form.addEventListener(
    "reset",
    (event) => {
      event.preventDefault();

      cancelScheduledReload();

      const changed = filters.reset({
        type: "reset",

        effect: "view",

        source: event,
      });

      /*
       * Synchronize the enhanced visual controls after the native values have
       * been reset to:
       *
       * - Suspension
       * - one calendar month ago
       * - today
       */

      announceControlUpdates();

      /*
       * If the form was already at its defaults, DataFilters emits no change.
       * Reset still acts as an explicit refresh action.
       */

      if (!changed) {
        scheduleReload(event);
      }
    },
    {
      signal: abortController.signal,
    },
  );

  /* ========================================================================
     Public Synchronization
     ======================================================================== */

  function sync() {
    if (destroyed) {
      return;
    }

    filters.sync();

    announceControlUpdates();
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    cancelScheduledReload();

    abortController.abort();

    unsubscribe();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    destroy,
    sync,

    getDefaultRange() {
      return {
        ...defaultRange,
      };
    },
  });
}
