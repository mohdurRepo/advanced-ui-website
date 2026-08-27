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
 * - expose stable request state per Trading area
 *
 * This file intentionally has no:
 *
 * - AJAX
 * - Sector -> Company loading
 * - DataTables
 * - cards
 * - tabs
 * - result rendering
 *
 * Those responsibilities belong to:
 *
 * - dependencies.js
 * - trading.js
 * - individual Trading views
 * - common/data-view
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import { createDataFilters } from "../common/data-view/index.js";

/* ==========================================================================
   Trading Constants
   ========================================================================== */

import {
  COMPANY_STATUS_TYPES,
  NEGOTIATED_TYPES,
  SELECTORS,
  TRADING_VALUES,
} from "./constants.js";

/* ==========================================================================
   Generic Helpers
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
 * This is intentionally calendar-month subtraction rather than a fixed
 * 30-day subtraction.
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
 * Shared Trading business default:
 *
 * fromDate = exactly one calendar month before today
 * toDate   = today
 *
 * Native date values:
 *
 * YYYY-MM-DD
 *
 * The same helper is used by:
 *
 * - Negotiated Deals
 * - Suspended / Delisted
 * - initial load
 * - Reset
 *
 * This guarantees that initial state and Reset never calculate different
 * date ranges.
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
   Backend Date Conversion
   ========================================================================== */

/**
 * Convert the native Trading date format:
 *
 * YYYY-MM-DD
 *
 * to the existing backend request format:
 *
 * DD-MM-YYYY
 *
 * Existing DD-MM-YYYY values are preserved.
 *
 * Empty values remain empty.
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
   * Preserve an already backend-formatted value.
   */

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    return text;
  }

  /*
   * Do not silently reinterpret an unknown format.
   *
   * Preserve it and allow the backend/request layer to expose the issue.
   */

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
 * and exposes the visible range through:
 *
 * .custom-date__initial-value
 *
 * createDataFilters() remains the owner of the native input values.
 *
 * The helpers below synchronize the enhanced presentation whenever Trading
 * changes those native values programmatically during:
 *
 * - initialization
 * - Reset
 * - future programmatic state changes
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
 * Programmatic input.value assignment does not emit browser events.
 *
 * The custom-date component may therefore retain an old visible value after
 * Trading initializes or resets the native controls.
 *
 * Important ordering:
 *
 *   filters state / native input
 *          ↓
 *   filters.sync()
 *          ↓
 *   notify enhanced date control
 *
 * filters.sync() must happen first.
 *
 * At that point createDataFilters already knows the current native value, so
 * the synthetic events refresh the design-system presentation without
 * becoming a second logical Trading filter change.
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
   * First update the progressive-enhancement display directly.
   */

  updateDateRangeDisplay(fromInput, toInput);

  /*
   * Then notify the enhanced custom-date implementation.
   *
   * filters.sync() must already have happened.
   */

  notifyDateInput(fromInput);

  notifyDateInput(toInput);

  /*
   * Some custom-date implementations repaint synchronously after handling
   * the native events.
   *
   * Reassert the canonical visible value after that event pass.
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
 * Suspended and Delisted deliberately use the same date-control contract as
 * Negotiated Deals.
 *
 * There must not be a second Company Status date implementation.
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

        /*
         * Type does not simply reload the same table.
         *
         * It switches:
         *
         * Negotiated Deals
         *        ↕
         * Minimum Size
         */

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
           Sector / Industry Group
           ------------------------------------------------------------------ */

      sector: {
        selector: SELECTORS.negotiated.sector,

        required: true,

        /*
         * Sector first changes the dependent Company options.
         *
         * trading.js performs the final dataset reload after the dependency
         * has settled.
         */

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
         * Clearing Company means All Companies.
         *
         * An empty Company value must never be sent to the backend.
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
     Negotiated Initial State
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
       * JSP deliberately leaves the dates blank.
       *
       * Runtime business default:
       *
       * fromDate = exactly one calendar month before today
       * toDate   = today
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
   * Initialization order is important:
   *
   * 1. setState()
   *    writes canonical initial filter values
   *
   * 2. sync()
   *    aligns createDataFilters' DOM snapshot
   *
   * 3. syncNegotiatedDateRange()
   *    updates the enhanced custom-date presentation
   *
   * This prevents initialization from causing an unwanted AJAX reload.
   */

  filters.sync();

  syncNegotiatedDateRange(root);

  return filters;
}

/* ==========================================================================
   Accumulated Losses Filters
   ========================================================================== */

/*
 * Accumulated has one page-level filter:
 *
 * Report
 *
 * The individual accumulated.js view must consume this through:
 *
 * filters.getAccumulatedRequestState()
 *
 * It should not search for the Report <select> inside its own data-view root.
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
 * Company Status is one logical filter group with two presentation variants:
 *
 * Suspended
 * Delisted
 *
 * The Type value determines which variant is visible.
 *
 * Stable backend values:
 *
 * Suspension
 * Suspension_Funds
 * Delisting
 * Delisting_Funds
 *
 * IMPORTANT:
 *
 * These values must remain backend identifiers.
 *
 * Localized dropdown text comes from:
 *
 * config.labels.companyStatus.type
 *
 * The localized labels must never replace the actual Type value.
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

        /*
         * Type switches Suspended <-> Delisted.
         *
         * trading.js owns that variant orchestration.
         */

        effect: "variant",

        resetValue: normalizeString(
          defaults.type,

          COMPANY_STATUS_TYPES.suspension,
        ),

        normalize(value) {
          return normalizeString(
            value,

            COMPANY_STATUS_TYPES.suspension,
          );
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

        /*
         * Unlike a manually cleared native date, Company Status always has
         * a valid business date range.
         *
         * Empty therefore resolves back to the one-month default.
         */

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
     Company Status Initial State
     ========================================================================= */

  const initial = config.initialState?.deListedCompanies || {};

  filters.setState(
    {
      type: normalizeString(
        initial.type,

        defaults.type || COMPANY_STATUS_TYPES.suspension,
      ),

      /*
       * JSP intentionally leaves these blank.
       *
       * Runtime default:
       *
       * fromDate = one calendar month before today
       * toDate   = today
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
   * Same initialization order as Negotiated:
   *
   * setState()
   *    ↓
   * filters.sync()
   *    ↓
   * enhanced custom-date synchronization
   */

  filters.sync();

  syncCompanyStatusDateRange(root);

  return filters;
}
/* ==========================================================================
   Public Trading Filters
   ========================================================================== */

export function createTradingFilters({ root = document, config = {} } = {}) {
  /* =========================================================================
     Filter Instances
     ========================================================================= */

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
     Negotiated Request State
     ========================================================================= */

  /*
   * Native filter state:
   *
   * YYYY-MM-DD
   *
   * Backend request state:
   *
   * DD-MM-YYYY
   *
   * Individual view modules should consume this method instead of repeating
   * date conversion logic.
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

  /* =========================================================================
     Accumulated Request State
     ========================================================================= */

  /*
   * Accumulated has only one request filter.
   *
   * Backend values remain exactly:
   *
   * All
   * 50-MORE
   * 35-50
   * 20-35
   */

  function getAccumulatedRequestState() {
    const state = accumulated.getState();

    return Object.freeze({
      report: state.report,
    });
  }

  /* =========================================================================
     Company Status Request State
     ========================================================================= */

  /*
   * Both Suspended and Delisted consume this request state.
   *
   * Type remains the exact backend identifier:
   *
   * Suspension
   * Suspension_Funds
   * Delisting
   * Delisting_Funds
   *
   * Dates are converted once here before either view builds its request.
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
     Negotiated Reset
     ========================================================================= */

  function resetNegotiated(options = {}) {
    /*
     * Business defaults:
     *
     * Type
     *   -> Negotiated Deals
     *
     * Sector
     *   -> All
     *
     * Company
     *   -> All Companies
     *
     * From
     *   -> exactly one calendar month before today
     *
     * To
     *   -> today
     */

    const changed = negotiated.reset({
      type: "reset",

      effect: "reload",

      ...options,
    });

    /*
     * createDataFilters.reset() writes the native controls.
     *
     * Align its internal snapshot before notifying the enhanced date control.
     */

    negotiated.sync();

    syncNegotiatedDateRange(root);

    return changed;
  }

  /* =========================================================================
     Accumulated Reset
     ========================================================================= */

  function resetAccumulated(options = {}) {
    /*
     * Business default:
     *
     * Report -> All
     */

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
    /*
     * Business defaults:
     *
     * Type
     *   -> Suspension
     *
     * From
     *   -> exactly one calendar month before today
     *
     * To
     *   -> today
     *
     * Reset therefore also returns the Company Status presentation to the
     * Suspended variant.
     */

    const changed = companyStatus.reset({
      type: "reset",

      effect: "reload",

      ...options,
    });

    /*
     * Same synchronization contract as Negotiated.
     */

    companyStatus.sync();

    syncCompanyStatusDateRange(root);

    return changed;
  }

  /* =========================================================================
     Manual Negotiated Date UI Synchronization
     ========================================================================= */

  /*
   * Exposed for page orchestration after any future programmatic mutation.
   *
   * This method does not calculate a new date range.
   *
   * It only synchronizes:
   *
   * native input
   *      ↓
   * createDataFilters snapshot
   *      ↓
   * enhanced custom-date presentation
   */

  function refreshNegotiatedDateRange() {
    negotiated.sync();

    syncNegotiatedDateRange(root);
  }

  /* =========================================================================
     Manual Company Status Date UI Synchronization
     ========================================================================= */

  function refreshCompanyStatusDateRange() {
    companyStatus.sync();

    syncCompanyStatusDateRange(root);
  }

  /* =========================================================================
     Filter Value Helpers
     ========================================================================= */

  /*
   * Keep a small common value API at this composition layer.
   *
   * This avoids individual views reaching into unrelated filter instances.
   */

  function getNegotiatedValue(key) {
    return negotiated.getValue(key);
  }

  function getAccumulatedValue(key) {
    return accumulated.getValue(key);
  }

  function getCompanyStatusValue(key) {
    return companyStatus.getValue(key);
  }

  /* =========================================================================
     State Helpers
     ========================================================================= */

  function getNegotiatedState() {
    return Object.freeze({
      ...negotiated.getState(),
    });
  }

  function getAccumulatedState() {
    return Object.freeze({
      ...accumulated.getState(),
    });
  }

  function getCompanyStatusState() {
    return Object.freeze({
      ...companyStatus.getState(),
    });
  }

  /* =========================================================================
     Synchronization
     ========================================================================= */

  /*
   * Synchronize every Trading filter instance with the current DOM.
   *
   * This is useful after a higher-level page operation that changes several
   * controls programmatically.
   *
   * It intentionally does not issue a dataset reload.
   */

  function sync() {
    negotiated.sync();

    accumulated.sync();

    companyStatus.sync();

    syncNegotiatedDateRange(root);

    syncCompanyStatusDateRange(root);
  }

  /* =========================================================================
     Lifecycle
     ========================================================================= */

  let destroyed = false;

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    negotiated.destroy();

    accumulated.destroy();

    companyStatus.destroy();
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    /* -----------------------------------------------------------------------
       Individual Filter Instances
       ----------------------------------------------------------------------- */

    negotiated,

    accumulated,

    companyStatus,

    /* -----------------------------------------------------------------------
       Request States
       ----------------------------------------------------------------------- */

    getNegotiatedRequestState,

    getAccumulatedRequestState,

    getCompanyStatusRequestState,

    /* -----------------------------------------------------------------------
       Individual Values
       ----------------------------------------------------------------------- */

    getNegotiatedValue,

    getAccumulatedValue,

    getCompanyStatusValue,

    /* -----------------------------------------------------------------------
       Complete States
       ----------------------------------------------------------------------- */

    getNegotiatedState,

    getAccumulatedState,

    getCompanyStatusState,

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
       General Synchronization
       ----------------------------------------------------------------------- */

    sync,

    /* -----------------------------------------------------------------------
       Lifecycle
       ----------------------------------------------------------------------- */

    destroy,
  });
}
