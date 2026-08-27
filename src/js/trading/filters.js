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

/**
 * Subtract exactly one calendar month.
 *
 * Examples:
 *
 * 27 Aug -> 27 Jul
 * 31 Mar -> 28/29 Feb
 * 31 May -> 30 Apr
 *
 * @param {Date} date
 * @returns {Date}
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

/**
 * Trading business default:
 *
 * fromDate = exactly one calendar month before today
 * toDate   = today
 *
 * Native date values are returned as:
 *
 * YYYY-MM-DD
 *
 * @param {Date} today
 * @returns {{fromDate:string,toDate:string}}
 */
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

/**
 * Convert native date:
 *
 * YYYY-MM-DD
 *
 * to the existing Trading backend format:
 *
 * DD-MM-YYYY
 *
 * Existing DD-MM-YYYY values are preserved.
 *
 * @param {*} value
 * @returns {string}
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
 * and the visible value:
 *
 * .custom-date__initial-value
 *
 * createDataFilters() owns the actual native input values.
 *
 * These helpers keep the enhanced presentation synchronized whenever
 * Trading changes those native values programmatically during:
 *
 * - initialization
 * - Reset
 */

/* ==========================================================================
   Date Range Root
   ========================================================================== */

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

  /*
   * First paint the progressive-enhancement value directly.
   */

  updateDateRangeDisplay(fromInput, toInput);

  /*
   * Then notify the enhanced custom-date implementation.
   *
   * filters.sync() must have already happened before this function is called.
   */

  notifyDateInput(fromInput);

  notifyDateInput(toInput);

  /*
   * Some custom-date implementations repaint after handling the native events.
   *
   * Reassert the visible value after that synchronous event pass.
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
   Company Status Date Synchronization
   ========================================================================== */

/*
 * Same reusable date contract.
 *
 * We expose this now so Suspended / Delisted can use exactly the same
 * initialization/reset behavior when we polish that tab.
 */

function syncCompanyStatusDateRange(root) {
  syncDateRangeControl(root, {
    fromSelector: SELECTORS.companyStatus.fromDate,

    toSelector: SELECTORS.companyStatus.toDate,
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
          return normalizeString(value);
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
          return normalizeString(value);
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
   * 1. setState() writes the initial filter values
   * 2. sync() aligns createDataFilters' DOM snapshot
   * 3. custom-date presentation is synchronized
   *
   * This prevents initialization from creating an unwanted Trading reload.
   */

  filters.sync();

  syncNegotiatedDateRange(root);

  return filters;
}

/* ==========================================================================
   Accumulated Losses Filters
   ========================================================================== */

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

  /* =========================================================================
     Initial State
     ========================================================================= */

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

  /*
   * Keep native inputs + internal snapshot synchronized first.
   */

  filters.sync();

  /*
   * Use the same date-range presentation contract as Negotiated.
   *
   * This also prepares Suspended / Delisted for the later tab polish without
   * introducing a second date implementation.
   */

  syncCompanyStatusDateRange(root);

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
     Negotiated Reset
     ========================================================================= */

  function resetNegotiated(options = {}) {
    /*
     * Business defaults:
     *
     * Type    -> Negotiated Deals
     * Sector  -> All
     * Company -> All Companies
     * From    -> one calendar month ago
     * To      -> today
     */

    const changed = negotiated.reset({
      type: "reset",

      effect: "reload",

      ...options,
    });

    /*
     * createDataFilters.reset() updates the native controls.
     *
     * Synchronize the internal DOM snapshot before notifying custom-date.
     */

    negotiated.sync();

    syncNegotiatedDateRange(root);

    return changed;
  }

  /* =========================================================================
     Accumulated Reset
     ========================================================================= */

  function resetAccumulated(options = {}) {
    const changed = accumulated.reset({
      type: "reset",

      effect: "reload",

      ...options,
    });

    accumulated.sync();

    return changed;
  }

  /* =========================================================================
     Company Status Reset
     ========================================================================= */

  function resetCompanyStatus(options = {}) {
    const changed = companyStatus.reset({
      type: "reset",

      effect: "reload",

      ...options,
    });

    companyStatus.sync();

    syncCompanyStatusDateRange(root);

    return changed;
  }

  /* =========================================================================
     Manual Date UI Synchronization
     ========================================================================= */

  /*
   * These methods are intentionally exposed for page orchestration after any
   * future programmatic date update.
   *
   * They do not mutate business state.
   *
   * They only ensure:
   *
   * native inputs
   *    ↓
   * createDataFilters snapshot
   *    ↓
   * enhanced custom-date UI
   *
   * remain synchronized.
   */

  function refreshNegotiatedDateRange() {
    negotiated.sync();

    syncNegotiatedDateRange(root);
  }

  function refreshCompanyStatusDateRange() {
    companyStatus.sync();

    syncCompanyStatusDateRange(root);
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
    /* -----------------------------------------------------------------------
       Filter Instances
       ----------------------------------------------------------------------- */

    negotiated,

    accumulated,

    companyStatus,

    /* -----------------------------------------------------------------------
       Request State
       ----------------------------------------------------------------------- */

    getNegotiatedRequestState,

    getAccumulatedRequestState,

    getCompanyStatusRequestState,

    /* -----------------------------------------------------------------------
       Reset
       ----------------------------------------------------------------------- */

    resetNegotiated,

    resetAccumulated,

    resetCompanyStatus,

    /* -----------------------------------------------------------------------
       Date UI
       ----------------------------------------------------------------------- */

    refreshNegotiatedDateRange,

    refreshCompanyStatusDateRange,

    /* -----------------------------------------------------------------------
       Lifecycle
       ----------------------------------------------------------------------- */

    destroy,
  });
}
