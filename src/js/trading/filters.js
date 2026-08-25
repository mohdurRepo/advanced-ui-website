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
 * - expose one stable filter API per filter group
 *
 * This file intentionally has no:
 *
 * - AJAX
 * - Sector -> Company loading
 * - DataTables
 * - cards
 * - tabs
 * - variant visibility
 * - result rendering
 * - loading states
 */

import { createDataFilters } from "../common/data-view/index.js";

import {
  NEGOTIATED_TYPES,
  COMPANY_STATUS_TYPES,
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
   Native Dates
   ========================================================================== */

/**
 * Format a Date as YYYY-MM-DD for <input type="date">.
 *
 * Local date parts are deliberately used so timezone conversion cannot move
 * the user's calendar date backward or forward.
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
 * Return the last valid day of a calendar month.
 *
 * @param {number} year
 * @param {number} month Zero-based month.
 * @returns {number}
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Subtract one calendar month while safely clamping dates such as:
 *
 * March 31 -> February 28/29
 *
 * rather than allowing JavaScript Date rollover into March.
 *
 * @param {Date} date
 * @returns {Date}
 */
function subtractCalendarMonth(date) {
  const year = date.getFullYear();

  const previousMonth = date.getMonth() - 1;

  const target = new Date(year, previousMonth, 1);

  const day = Math.min(
    date.getDate(),
    getDaysInMonth(target.getFullYear(), target.getMonth()),
  );

  target.setDate(day);

  return target;
}

/* ==========================================================================
   Default Date Range
   ========================================================================== */

/**
 * Trading legacy/default range:
 *
 * from = one calendar month before today
 * to   = today
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
 * Convert the native input date:
 *
 * YYYY-MM-DD
 *
 * to the Trading backend contract:
 *
 * DD-MM-YYYY
 *
 * Already-normalized DD-MM-YYYY values are preserved.
 *
 * Unknown values are preserved rather than guessed.
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
   Negotiated Deals
   ========================================================================== */

function createNegotiatedFilters({ root, config }) {
  const defaults = config.filters?.negotiatedDeals?.defaults || {};

  const dates = getDefaultTradingDateRange();

  const filters = createDataFilters({
    root,

    fields: {
      /* --------------------------------------------------------------------
         Type
         -------------------------------------------------------------------- */

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

      /* --------------------------------------------------------------------
         Sector / Industry
         -------------------------------------------------------------------- */

      sector: {
        selector: SELECTORS.negotiated.sector,

        required: true,

        /*
         * Sector has a dependency side-effect.
         *
         * dependencies.js decides how the Company options are reloaded.
         */
        effect: "dependency",

        resetValue: normalizeString(defaults.sector, TRADING_VALUES.all),

        normalize(value) {
          return normalizeString(value, TRADING_VALUES.all);
        },
      },

      /* --------------------------------------------------------------------
         Company
         -------------------------------------------------------------------- */

      company: {
        selector: SELECTORS.negotiated.company,

        required: true,

        effect: "reload",

        /*
         * Company has no empty/clear state.
         *
         * "All" is the business default.
         */
        resetValue: normalizeString(defaults.company, TRADING_VALUES.all),

        normalize(value) {
          return normalizeString(value, TRADING_VALUES.all);
        },
      },

      /* --------------------------------------------------------------------
         From Date
         -------------------------------------------------------------------- */

      fromDate: {
        selector: SELECTORS.negotiated.fromDate,

        required: true,

        effect: "reload",

        resetValue: dates.fromDate,

        normalize(value) {
          return normalizeString(value, "");
        },
      },

      /* --------------------------------------------------------------------
         To Date
         -------------------------------------------------------------------- */

      toDate: {
        selector: SELECTORS.negotiated.toDate,

        required: true,

        effect: "reload",

        resetValue: dates.toDate,

        normalize(value) {
          return normalizeString(value, "");
        },
      },
    },
  });

  /*
   * JSP date inputs intentionally start empty.
   *
   * Populate the initial default range without notifying subscribers because
   * initialization must not trigger an AJAX request by itself.
   */
  filters.setState(
    {
      fromDate: normalizeString(
        config.initialState?.negotiatedDeals?.fromDate,
        dates.fromDate,
      ),

      toDate: normalizeString(
        config.initialState?.negotiatedDeals?.toDate,
        dates.toDate,
      ),
    },
    {
      notify: false,

      source: "initialization",
    },
  );

  return filters;
}

/* ==========================================================================
   Accumulated Losses
   ========================================================================== */

function createAccumulatedFilters({ root, config }) {
  const defaults = config.filters?.accumulated?.defaults || {};

  return createDataFilters({
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
}

/* ==========================================================================
   Suspended / Delisted
   ========================================================================== */

function createCompanyStatusFilters({ root, config }) {
  const defaults = config.filters?.deListedCompanies?.defaults || {};

  const dates = getDefaultTradingDateRange();

  const filters = createDataFilters({
    root,

    fields: {
      /* --------------------------------------------------------------------
         Type
         -------------------------------------------------------------------- */

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

      /* --------------------------------------------------------------------
         From Date
         -------------------------------------------------------------------- */

      fromDate: {
        selector: SELECTORS.companyStatus.fromDate,

        required: true,

        effect: "reload",

        resetValue: dates.fromDate,

        normalize(value) {
          return normalizeString(value, "");
        },
      },

      /* --------------------------------------------------------------------
         To Date
         -------------------------------------------------------------------- */

      toDate: {
        selector: SELECTORS.companyStatus.toDate,

        required: true,

        effect: "reload",

        resetValue: dates.toDate,

        normalize(value) {
          return normalizeString(value, "");
        },
      },
    },
  });

  filters.setState(
    {
      fromDate: normalizeString(
        config.initialState?.deListedCompanies?.fromDate,
        dates.fromDate,
      ),

      toDate: normalizeString(
        config.initialState?.deListedCompanies?.toDate,
        dates.toDate,
      ),
    },
    {
      notify: false,

      source: "initialization",
    },
  );

  return filters;
}

/* ==========================================================================
   Public Trading Filters
   ========================================================================== */

/**
 * Create all page-level Trading filter groups.
 *
 * Each group remains an ordinary common createDataFilters() instance.
 *
 * The wrapper provides only convenient grouping and lifecycle management.
 *
 * @param {object} options
 * @param {Document|Element} options.root
 * @param {object} options.config
 * @returns {Readonly<object>}
 */
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

  /* ========================================================================
     Request State
     ======================================================================== */

  /**
   * Return Negotiated filters in backend-ready form.
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
   * Return Accumulated Loss filters in backend-ready form.
   */
  function getAccumulatedRequestState() {
    const state = accumulated.getState();

    return Object.freeze({
      report: state.report,
    });
  }

  /**
   * Return Suspended / Delisted filters in backend-ready form.
   */
  function getCompanyStatusRequestState() {
    const state = companyStatus.getState();

    return Object.freeze({
      type: state.type,

      fromDate: toTradingRequestDate(state.fromDate),

      toDate: toTradingRequestDate(state.toDate),
    });
  }

  /* ========================================================================
     Reset
     ======================================================================== */

  function resetNegotiated(settings = {}) {
    return negotiated.reset({
      type: "reset",

      effect: "reload",

      ...settings,
    });
  }

  function resetAccumulated(settings = {}) {
    return accumulated.reset({
      type: "reset",

      effect: "reload",

      ...settings,
    });
  }

  function resetCompanyStatus(settings = {}) {
    return companyStatus.reset({
      type: "reset",

      effect: "reload",

      ...settings,
    });
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    negotiated.destroy();

    accumulated.destroy();

    companyStatus.destroy();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

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
