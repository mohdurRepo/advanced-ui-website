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
 * - initialize default Trading date ranges
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

/* ==========================================================================
   Dates
   ========================================================================== */

/**
 * Format a Date for <input type="date">.
 *
 * Local date parts are intentionally used.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatNativeDate(date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Return number of days in a calendar month.
 *
 * @param {number} year
 * @param {number} month Zero-based month.
 * @returns {number}
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Subtract exactly one calendar month.
 *
 * Example:
 *
 * 31 March -> 28/29 February
 *
 * rather than allowing native Date rollover.
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

/**
 * Trading business default:
 *
 * fromDate = one calendar month before today
 * toDate   = today
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
 * Convert:
 *
 * YYYY-MM-DD
 *
 * to:
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

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    return text;
  }

  return text;
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
         * Company must never become empty.
         *
         * Clearing the enhanced control or Reset always means All Companies.
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

  /**
   * Negotiated backend-ready filter values.
   */
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

  /**
   * Accumulated state.
   *
   * Important:
   *
   * The UI calls this field `report`.
   * The backend parameter name is `percentage`.
   *
   * That mapping belongs in views/accumulated.js, not in the generic filter
   * state.
   */
  function getAccumulatedRequestState() {
    const state = accumulated.getState();

    return Object.freeze({
      report: state.report,
    });
  }

  /**
   * Suspended / Delisted backend-ready filter values.
   */
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
    return negotiated.reset({
      type: "reset",

      effect: "reload",

      ...options,
    });
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

    destroy,
  });
}
