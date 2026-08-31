/* ==========================================================================
   Dividends Filters
   ========================================================================== */

/*
 * Dividends-specific filter definitions and presentation helpers.
 *
 * Responsibilities:
 *
 * - define the Dividends filter selectors
 * - define reset values and filter effects
 * - normalize Market and Period values
 * - validate the custom date range
 * - convert native dates to the service date format
 * - enable or disable the custom date controls according to Period
 *
 * This module intentionally has no:
 *
 * - event subscriptions
 * - API request code
 * - Sector option loading
 * - table or card rendering
 * - tab lifecycle behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createFinancialCalendarDefaultDateRange,
  FINANCIAL_CALENDAR_FILTER_EFFECTS,
  FINANCIAL_CALENDAR_FILTER_FIELDS,
  formatFinancialCalendarServiceDate,
  validateFinancialCalendarDateRange,
} from "../../shared/financial-calendar-filters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

export const DIVIDENDS_MARKETS = Object.freeze({
  MAIN: "M",

  NOMU: "S",
});

export const DIVIDENDS_PERIODS = Object.freeze({
  CUSTOM: "CUSTOM",

  ONE_WEEK: "7",

  TWO_WEEKS: "14",

  ONE_MONTH: "30",

  THREE_MONTHS: "90",

  SIX_MONTHS: "180",

  NINE_MONTHS: "270",

  ONE_YEAR: "365",

  TWO_YEARS: "730",

  THREE_YEARS: "1095",

  FIVE_YEARS: "1825",
});

export const DIVIDENDS_FILTER_FIELDS = Object.freeze({
  market: FINANCIAL_CALENDAR_FILTER_FIELDS.market,

  sector: FINANCIAL_CALENDAR_FILTER_FIELDS.sector,

  company: FINANCIAL_CALENDAR_FILTER_FIELDS.company,

  period: FINANCIAL_CALENDAR_FILTER_FIELDS.period,

  fromDate: FINANCIAL_CALENDAR_FILTER_FIELDS.fromDate,

  toDate: FINANCIAL_CALENDAR_FILTER_FIELDS.toDate,
});

const PERIOD_VALUES = Object.freeze(Object.values(DIVIDENDS_PERIODS));

const SELECTORS = Object.freeze({
  market: "[data-dividends-market]",

  sector: "[data-dividends-sector]",

  company: "[data-dividends-company]",

  period: "[data-dividends-period]",

  fromDate: "[data-dividends-date-from]",

  toDate: "[data-dividends-date-to]",

  dateField: "[data-dividends-date-field]",

  dateRange: "[data-dividends-date-field] [data-custom-date-range]",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function resolveElement(root, selector) {
  if (!root || typeof root.querySelector !== "function") {
    return null;
  }

  return root.querySelector(selector);
}

/* ==========================================================================
   Value Normalization
   ========================================================================== */

export function normalizeDividendsMarket(value) {
  const normalized = normalizeString(value).toUpperCase();

  return normalized === DIVIDENDS_MARKETS.NOMU
    ? DIVIDENDS_MARKETS.NOMU
    : DIVIDENDS_MARKETS.MAIN;
}

export function normalizeDividendsPeriod(value) {
  const normalized = normalizeString(value).toUpperCase();

  return PERIOD_VALUES.includes(normalized)
    ? normalized
    : DIVIDENDS_PERIODS.CUSTOM;
}

export function isCustomDividendsPeriod(value) {
  return normalizeDividendsPeriod(value) === DIVIDENDS_PERIODS.CUSTOM;
}

/* ==========================================================================
   Filter Definitions
   ========================================================================== */

export function createDividendsFilterDefinitions(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createDividendsFilterDefinitions requires a configuration object.",
    );
  }

  const defaults = config.defaults || {};

  const dividendsDefaults = defaults.dividends || {};

  const defaultDateRange = createFinancialCalendarDefaultDateRange(
    defaults.dateRangeYears,
  );

  const defaultMarket = normalizeDividendsMarket(
    defaults.market || DIVIDENDS_MARKETS.MAIN,
  );

  const defaultSector = normalizeString(defaults.sector);

  const defaultPeriod = normalizeDividendsPeriod(
    dividendsDefaults.period || DIVIDENDS_PERIODS.CUSTOM,
  );

  const searchDebounceMs = Math.max(
    0,
    Number(defaults.searchDebounceMs) || 300,
  );

  return Object.freeze({
    [DIVIDENDS_FILTER_FIELDS.market]: Object.freeze({
      selector: SELECTORS.market,

      required: true,

      event: "change",

      effect: FINANCIAL_CALENDAR_FILTER_EFFECTS.dependency,

      resetValue: defaultMarket,

      normalize: normalizeDividendsMarket,
    }),

    [DIVIDENDS_FILTER_FIELDS.sector]: Object.freeze({
      selector: SELECTORS.sector,

      required: true,

      event: "change",

      effect: FINANCIAL_CALENDAR_FILTER_EFFECTS.reload,

      resetValue: defaultSector,

      normalize(value) {
        return normalizeString(value);
      },
    }),

    [DIVIDENDS_FILTER_FIELDS.company]: Object.freeze({
      selector: SELECTORS.company,

      required: true,

      event: "input",

      effect: FINANCIAL_CALENDAR_FILTER_EFFECTS.reload,

      debounce: true,

      debounceMs: searchDebounceMs,

      resetValue: "",

      normalize(value) {
        return normalizeString(value);
      },
    }),

    [DIVIDENDS_FILTER_FIELDS.period]: Object.freeze({
      selector: SELECTORS.period,

      required: true,

      event: "change",

      effect: FINANCIAL_CALENDAR_FILTER_EFFECTS.reload,

      resetValue: defaultPeriod,

      normalize: normalizeDividendsPeriod,
    }),

    [DIVIDENDS_FILTER_FIELDS.fromDate]: Object.freeze({
      selector: SELECTORS.fromDate,

      required: true,

      event: "change",

      effect: FINANCIAL_CALENDAR_FILTER_EFFECTS.reload,

      resetValue: defaultDateRange.fromDate,

      normalize(value) {
        return normalizeString(value);
      },
    }),

    [DIVIDENDS_FILTER_FIELDS.toDate]: Object.freeze({
      selector: SELECTORS.toDate,

      required: true,

      event: "change",

      effect: FINANCIAL_CALENDAR_FILTER_EFFECTS.reload,

      resetValue: defaultDateRange.toDate,

      normalize(value) {
        return normalizeString(value);
      },
    }),
  });
}

/* ==========================================================================
   Validation
   ========================================================================== */

export function validateDividendsFilters(filterState = {}) {
  const period = normalizeDividendsPeriod(filterState.period);

  /*
   * Predefined periods are complete without a custom date range. The service
   * determines the range from the selected number of days.
   */

  if (!isCustomDividendsPeriod(period)) {
    return Object.freeze({
      valid: true,

      reason: "",

      period,
    });
  }

  return validateFinancialCalendarDateRange(
    filterState.fromDate,

    filterState.toDate,
  );
}

/* ==========================================================================
   Service Date
   ========================================================================== */

export function formatDividendsServiceDate(value) {
  return formatFinancialCalendarServiceDate(value);
}

/* ==========================================================================
   Date-Control Presentation
   ========================================================================== */

export function syncDividendsDateControls(root, period) {
  if (!root || typeof root.querySelector !== "function") {
    return false;
  }

  const dateField = resolveElement(root, SELECTORS.dateField);

  const dateRange = resolveElement(root, SELECTORS.dateRange);

  const fromDate = resolveElement(root, SELECTORS.fromDate);

  const toDate = resolveElement(root, SELECTORS.toDate);

  const customPeriod = isCustomDividendsPeriod(period);

  const disabled = !customPeriod;

  if (fromDate) {
    fromDate.disabled = disabled;
  }

  if (toDate) {
    toDate.disabled = disabled;
  }

  dateField?.classList.toggle("is-disabled", disabled);

  dateRange?.classList.toggle("is-disabled", disabled);

  if (dateField) {
    dateField.setAttribute("aria-disabled", String(disabled));
  }

  if (dateRange) {
    dateRange.setAttribute("aria-disabled", String(disabled));

    /*
     * The enhanced CustomDate component may add trigger and clear buttons.
     * Keep those controls synchronized with the native date inputs.
     */

    dateRange.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
    });
  }

  return customPeriod;
}

/* ==========================================================================
   Public Selectors
   ========================================================================== */

export const DIVIDENDS_FILTER_SELECTORS = SELECTORS;
