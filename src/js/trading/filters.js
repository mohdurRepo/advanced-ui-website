/* ==========================================================================
   Trading Filters
   ========================================================================== */

/*
 * Trading-specific filter definitions built on common createDataFilters().
 *
 * Responsibilities:
 *
 * - define Trading filter fields
 * - normalize Trading filter values
 * - establish business reset values
 * - initialize Trading date ranges
 * - synchronize programmatic date values with custom-date UI
 * - convert native date values to backend request values
 * - expose stable filter state per Trading area
 *
 * This file intentionally has no:
 *
 * - AJAX
 * - Sector -> Company loading
 * - DataTables
 * - cards
 * - tabs
 * - result rendering
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import { createDataFilters } from "../common/data-view/index.js";

/* ==========================================================================
   Trading
   ========================================================================== */

import {
  COMPANY_STATUS_TYPES,
  NEGOTIATED_TYPES,
  SELECTORS,
  TRADING_VALUES,
} from "./constants.js";

/* ==========================================================================
   Helpers
   ========================================================================== */

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeString(value, fallback = "") {
  return hasValue(value) ? String(value).trim() : fallback;
}

function query(root, selector) {
  return root?.querySelector?.(selector) || null;
}

/* ==========================================================================
   Native Date Formatting
   ========================================================================== */

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatNativeDate(date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-");
}

/* ==========================================================================
   Calendar Month
   ========================================================================== */

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/*
 * Subtract exactly one calendar month.
 *
 * Examples:
 *
 * 27 Aug -> 27 Jul
 * 31 Mar -> 28/29 Feb
 * 31 May -> 30 Apr
 */

function subtractCalendarMonth(date) {
  const target = new Date(date.getFullYear(), date.getMonth() - 1, 1);

  const day = Math.min(
    date.getDate(),

    getDaysInMonth(target.getFullYear(), target.getMonth()),
  );

  target.setDate(day);

  return target;
}

/* ==========================================================================
   Default Trading Date Range
   ========================================================================== */

export function getDefaultTradingDateRange(today = new Date()) {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const from = subtractCalendarMonth(to);

  return Object.freeze({
    fromDate: formatNativeDate(from),

    toDate: formatNativeDate(to),
  });
}

/* ==========================================================================
   Backend Date
   ========================================================================== */

/*
 * Native UI:
 *
 * YYYY-MM-DD
 *
 * Existing Trading backend:
 *
 * DD-MM-YYYY
 */

export function toTradingRequestDate(value) {
  if (!hasValue(value)) {
    return "";
  }

  const text = String(value).trim();

  const nativeMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (nativeMatch) {
    return [nativeMatch[3], nativeMatch[2], nativeMatch[1]].join("-");
  }

  /*
   * Preserve existing backend-formatted values.
   */

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    return text;
  }

  return text;
}

/* ==========================================================================
   Date Range DOM
   ========================================================================== */

/*
 * The design-system custom-date range progressively enhances:
 *
 * <input data-date-start>
 * <input data-date-end>
 *
 * and the initial visible value:
 *
 * .custom-date__initial-value
 *
 * createDataFilters() correctly owns the native input values.
 *
 * This helper keeps the progressive-enhancement presentation synchronized
 * when those values are changed programmatically during:
 *
 * - initialization
 * - Reset
 */

function getDateRangeRoot(element) {
  if (!(element instanceof Element)) {
    return null;
  }

  return element.closest("[data-custom-date-range]");
}

/* ==========================================================================
   Date Range Display
   ========================================================================== */

function updateDateRangeDisplay(startInput, endInput) {
  const rangeRoot = getDateRangeRoot(startInput) || getDateRangeRoot(endInput);

  if (!rangeRoot) {
    return;
  }

  const display = rangeRoot.querySelector(".custom-date__initial-value");

  if (!display) {
    return;
  }

  const fromDate = normalizeString(startInput?.value);

  const toDate = normalizeString(endInput?.value);

  const placeholder = normalizeString(
    rangeRoot.dataset.placeholder,
    "YYYY-MM-DD – YYYY-MM-DD",
  );

  if (!fromDate && !toDate) {
    display.textContent = placeholder;

    display.classList.add("is-placeholder");

    return;
  }

  const fromDisplay = fromDate || "YYYY-MM-DD";

  const toDisplay = toDate || "YYYY-MM-DD";

  display.textContent = `${fromDisplay} – ${toDisplay}`;

  display.classList.remove("is-placeholder");
}

/* ==========================================================================
   Date Control Notification
   ========================================================================== */

/*
 * The custom-date enhancement listens to the native controls.
 *
 * Programmatic .value assignment does not emit browser events, therefore the
 * enhanced control may retain an old visible value.
 *
 * We intentionally synchronize AFTER createDataFilters.sync().
 *
 * At that point createDataFilters' lastValue already equals the native value,
 * so these events refresh the design-system control without producing another
 * Trading filter change / AJAX request.
 */

function notifyDateInput(input) {
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  input.dispatchEvent(
    new Event("input", {
      bubbles: true,
    }),
  );

  input.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );
}

/* ==========================================================================
   Date Range Synchronization
   ========================================================================== */

function syncDateRangeControl(root, { fromSelector, toSelector }) {
  const fromInput = query(root, fromSelector);

  const toInput = query(root, toSelector);

  updateDateRangeDisplay(fromInput, toInput);

  /*
   * Notify the enhanced date component only after the underlying native values
   * and createDataFilters snapshot are already synchronized.
   */

  notifyDateInput(fromInput);

  notifyDateInput(toInput);

  /*
   * Some implementations repaint after handling the native events.
   * Reassert the progressive-enhancement display after that synchronous pass.
   */

  updateDateRangeDisplay(fromInput, toInput);
}

/* ==========================================================================
   Negotiated Date Synchronization
   ========================================================================== */

function syncNegotiatedDateRange(root) {
  syncDateRangeControl(root, {
    fromSelector: SELECTORS.negotiated.fromDate,

    toSelector: SELECTORS.negotiated.toDate,
  });
}

/* ==========================================================================
   Negotiated Deals Filters
   ========================================================================== */

function createNegotiatedFilters({ root, config }) {
  const defaults = config.filters?.negotiatedDeals?.defaults || {};

  const clearCompanyValue =
    config.filters?.negotiatedDeals?.companyClearValue ||
    defaults.company ||
    TRADING_VALUES.all;

  const dateRange = getDefaultTradingDateRange();

  const filters = createDataFilters({
    root,

    fields: {
      /* ------------------------------------------------------------------
           Type
           ------------------------------------------------------------------ */

      type: {
        selector: SELECTORS.negotiated.type,

        required: true,

        effect: "variant",

        resetValue: normalizeString(
          defaults.type,
          NEGOTIATED_TYPES.negotiatedDeals,
        ),

        normalize(value) {
          const normalized = normalizeString(
            value,
            NEGOTIATED_TYPES.negotiatedDeals,
          );

          return normalized === NEGOTIATED_TYPES.minimumSize
            ? NEGOTIATED_TYPES.minimumSize
            : NEGOTIATED_TYPES.negotiatedDeals;
        },
      },

      /* ------------------------------------------------------------------
           Sector
           ------------------------------------------------------------------ */

      sector: {
        selector: SELECTORS.negotiated.sector,

        required: true,

        effect: "dependency",

        resetValue: normalizeString(defaults.sector, TRADING_VALUES.all),

        normalize(value) {
          return normalizeString(value, TRADING_VALUES.all);
        },
      },

      /* ------------------------------------------------------------------
           Company
           ------------------------------------------------------------------ */

      company: {
        selector: SELECTORS.negotiated.company,

        required: true,

        effect: "reload",

        /*
         * Clearing Company means:
         *
         * All Companies
         *
         * It must never become an empty backend filter.
         */

        resetValue: clearCompanyValue,

        normalize(value) {
          return normalizeString(value, clearCompanyValue);
        },
      },

      /* ------------------------------------------------------------------
           From Date
           ------------------------------------------------------------------ */

      fromDate: {
        selector: SELECTORS.negotiated.fromDate,

        required: true,

        effect: "reload",

        resetValue: dateRange.fromDate,

        normalize(value) {
          return normalizeString(value, dateRange.fromDate);
        },
      },

      /* ------------------------------------------------------------------
           To Date
           ------------------------------------------------------------------ */

      toDate: {
        selector: SELECTORS.negotiated.toDate,

        required: true,

        effect: "reload",

        resetValue: dateRange.toDate,

        normalize(value) {
          return normalizeString(value, dateRange.toDate);
        },
      },
    },
  });

  /* =========================================================================
     Initial State
     ========================================================================= */

  const initial = config.initialState?.negotiatedDeals || {};

  filters.setState(
    {
      type: normalizeString(
        initial.type,
        defaults.type || NEGOTIATED_TYPES.negotiatedDeals,
      ),

      sector: normalizeString(
        initial.sector,
        defaults.sector || TRADING_VALUES.all,
      ),

      company: normalizeString(initial.company, clearCompanyValue),

      /*
       * JSP intentionally leaves these blank.
       *
       * Runtime business default:
       *
       * exactly one calendar month ago -> today
       */

      fromDate: normalizeString(initial.fromDate, dateRange.fromDate),

      toDate: normalizeString(initial.toDate, dateRange.toDate),
    },
    {
      notify: false,

      source: "initialization",
    },
  );

  /*
   * Important ordering:
   *
   * 1. write native values
   * 2. synchronize createDataFilters lastValue
   * 3. refresh the progressive-enhancement date UI
   *
   * This prevents initialization from producing an unwanted Trading reload.
   */

  filters.sync();

  syncNegotiatedDateRange(root);

  return filters;
}

/* ==========================================================================
   Accumulated Losses Filters
   ========================================================================== */

/*
 * No changes to this tab in the current Negotiated pass.
 */

function createAccumulatedFilters({ root, config }) {
  const defaults = config.filters?.accumulated?.defaults || {};

  const filters = createDataFilters({
    root,

    fields: {
      report: {
        selector: SELECTORS.accumulated.report,

        required: true,

        effect: "reload",

        resetValue: normalizeString(defaults.report, TRADING_VALUES.all),

        normalize(value) {
          return normalizeString(value, TRADING_VALUES.all);
        },
      },
    },
  });

  const initial = config.initialState?.accumulated || {};

  filters.setState(
    {
      report: normalizeString(
        initial.report,
        defaults.report || TRADING_VALUES.all,
      ),
    },
    {
      notify: false,

      source: "initialization",
    },
  );

  filters.sync();

  return filters;
}

/* ==========================================================================
   Suspended / Delisted Filters
   ========================================================================== */

/*
 * Keep the existing contract intact for now.
 *
 * We will polish its date-control presentation when we work on that tab.
 */

function createCompanyStatusFilters({ root, config }) {
  const defaults = config.filters?.deListedCompanies?.defaults || {};

  const dateRange = getDefaultTradingDateRange();

  const filters = createDataFilters({
    root,

    fields: {
      /* ------------------------------------------------------------------
           Type
           ------------------------------------------------------------------ */

      type: {
        selector: SELECTORS.companyStatus.type,

        required: true,

        effect: "variant",

        resetValue: normalizeString(
          defaults.type,
          COMPANY_STATUS_TYPES.suspension,
        ),

        normalize(value) {
          return normalizeString(value, COMPANY_STATUS_TYPES.suspension);
        },
      },

      /* ------------------------------------------------------------------
           From Date
           ------------------------------------------------------------------ */

      fromDate: {
        selector: SELECTORS.companyStatus.fromDate,

        required: true,

        effect: "reload",

        resetValue: dateRange.fromDate,

        normalize(value) {
          return normalizeString(value, dateRange.fromDate);
        },
      },

      /* ------------------------------------------------------------------
           To Date
           ------------------------------------------------------------------ */

      toDate: {
        selector: SELECTORS.companyStatus.toDate,

        required: true,

        effect: "reload",

        resetValue: dateRange.toDate,

        normalize(value) {
          return normalizeString(value, dateRange.toDate);
        },
      },
    },
  });

  const initial = config.initialState?.deListedCompanies || {};

  filters.setState(
    {
      type: normalizeString(
        initial.type,
        defaults.type || COMPANY_STATUS_TYPES.suspension,
      ),

      fromDate: normalizeString(initial.fromDate, dateRange.fromDate),

      toDate: normalizeString(initial.toDate, dateRange.toDate),
    },
    {
      notify: false,

      source: "initialization",
    },
  );

  filters.sync();

  return filters;
}

/* ==========================================================================
   Public Trading Filters
   ========================================================================== */

export function createTradingFilters({ root = document, config = {} } = {}) {
  const negotiated = createNegotiatedFilters({
    root,
    config,
  });

  const accumulated = createAccumulatedFilters({
    root,
    config,
  });

  const companyStatus = createCompanyStatusFilters({
    root,
    config,
  });

  /* =========================================================================
     Request States
     ========================================================================= */

  function getNegotiatedRequestState() {
    const state = negotiated.getState();

    return Object.freeze({
      type: state.type,

      sector: state.sector,

      company: state.company,

      fromDate: toTradingRequestDate(state.fromDate),

      toDate: toTradingRequestDate(state.toDate),
    });
  }

  function getAccumulatedRequestState() {
    const state = accumulated.getState();

    return Object.freeze({
      report: state.report,
    });
  }

  function getCompanyStatusRequestState() {
    const state = companyStatus.getState();

    return Object.freeze({
      type: state.type,

      fromDate: toTradingRequestDate(state.fromDate),

      toDate: toTradingRequestDate(state.toDate),
    });
  }

  /* =========================================================================
     Reset
     ========================================================================= */

  function resetNegotiated(options = {}) {
    /*
     * createDataFilters.reset() writes:
     *
     * Type    -> Negotiated Deals
     * Sector  -> All
     * Company -> All
     * From    -> one calendar month ago
     * To      -> today
     */

    const changed = negotiated.reset({
      type: "reset",

      effect: "reload",

      ...options,
    });

    /*
     * Reset writes fields directly.
     *
     * Synchronize lastValue BEFORE emitting native date events so the custom
     * date UI can refresh without those events becoming additional filter
     * notifications / AJAX calls.
     */

    negotiated.sync();

    syncNegotiatedDateRange(root);

    return changed;
  }

  function resetAccumulated(options = {}) {
    return accumulated.reset({
      type: "reset",

      effect: "reload",

      ...options,
    });
  }

  function resetCompanyStatus(options = {}) {
    return companyStatus.reset({
      type: "reset",

      effect: "reload",

      ...options,
    });
  }

  /* =========================================================================
     Manual Date UI Synchronization
     ========================================================================= */

  /*
   * Exposed primarily for orchestration after any future programmatic
   * Negotiated date update.
   */

  function refreshNegotiatedDateRange() {
    negotiated.sync();

    syncNegotiatedDateRange(root);
  }

  /* =========================================================================
     Lifecycle
     ========================================================================= */

  function destroy() {
    negotiated.destroy();

    accumulated.destroy();

    companyStatus.destroy();
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    negotiated,
    accumulated,
    companyStatus,

    getNegotiatedRequestState,
    getAccumulatedRequestState,
    getCompanyStatusRequestState,

    resetNegotiated,
    resetAccumulated,
    resetCompanyStatus,

    refreshNegotiatedDateRange,

    destroy,
  });
}
