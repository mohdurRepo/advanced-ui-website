/* ==========================================================================
   Dividends Data Source
   ========================================================================== */

/*
 * Service contract for the Dividends calendar.
 *
 * Responsibilities:
 *
 * - identify the configured Dividends endpoint
 * - validate filters before constructing a request
 * - map the new filter model to the legacy resource parameters
 * - preserve required legacy parameter aliases
 * - connect the response to the Dividends normalizer
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - event listeners
 * - loading-state ownership
 * - Sector option loading
 * - table or card rendering
 * - tab lifecycle behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  DIVIDENDS_PERIODS,
  formatDividendsServiceDate,
  normalizeDividendsMarket,
  normalizeDividendsPeriod,
  validateDividendsFilters,
} from "./dividends.filters.js";

import { normalizeDividendsResponse } from "./dividends.normalizer.js";

/* ==========================================================================
   Constants
   ========================================================================== */

export const DIVIDENDS_ENDPOINT_KEY = "dividends";

const DEFAULT_MARKET = "M";

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function getCalendarType(config = {}) {
  const calendarType = normalizeString(config.calendarTypes?.dividends);

  if (!calendarType) {
    throw new Error(
      "Dividends calendarType is missing from Issuer Financial Calendars configuration.",
    );
  }

  return calendarType;
}

/* ==========================================================================
   Endpoint
   ========================================================================== */

export function getDividendsEndpoint(config = {}) {
  const endpoint = normalizeString(config.endpoints?.[DIVIDENDS_ENDPOINT_KEY]);

  if (!endpoint) {
    throw new Error(
      "Dividends endpoint is missing from Issuer Financial Calendars configuration.",
    );
  }

  return endpoint;
}

/* ==========================================================================
   Request Data
   ========================================================================== */

export function buildDividendsRequestData(filterState = {}, config = {}) {
  if (!isObject(filterState)) {
    throw new TypeError("Dividends filter state must be an object.");
  }

  if (!isObject(config)) {
    throw new TypeError("Dividends configuration must be an object.");
  }

  const validation = validateDividendsFilters(filterState);

  if (!validation.valid) {
    throw new TypeError(
      "Dividends cannot request results with an invalid date range.",
    );
  }

  const market = normalizeDividendsMarket(
    filterState.market ||
      filterState.marketsListId ||
      config.defaults?.market ||
      DEFAULT_MARKET,
  );

  const sector = normalizeString(filterState.sector);

  const company = normalizeString(
    filterState.company || filterState.symbolorcompany || filterState.bySymbol,
  );

  const period = normalizeDividendsPeriod(
    filterState.period ||
      config.defaults?.dividends?.period ||
      DIVIDENDS_PERIODS.CUSTOM,
  );

  const fromDate = formatDividendsServiceDate(
    filterState.fromDate || filterState.start,
  );

  const toDate = formatDividendsServiceDate(
    filterState.toDate || filterState.end,
  );

  /*
   * Keep all legacy aliases unchanged:
   *
   * - company is sent as both symbolorcompany and bySymbol
   * - Market is sent as both marketsListId and market
   *
   * The backend resource still reads these names even though the new UI uses
   * one canonical value for each filter.
   */

  return Object.freeze({
    calendarType: getCalendarType(config),

    symbolorcompany: company,

    start: fromDate,

    end: toDate,

    marketsListId: market,

    sector,

    period,

    bySymbol: company,

    market,
  });
}

/* ==========================================================================
   Response
   ========================================================================== */

export function normalizeDividendsDataSourceResponse(response, context = {}) {
  return normalizeDividendsResponse(response, context);
}

/* ==========================================================================
   Data-Source Definition
   ========================================================================== */

export function createDividendsDataSourceDefinition(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createDividendsDataSourceDefinition requires a configuration object.",
    );
  }

  /*
   * Validate required configuration immediately when the tab is created.
   */

  getDividendsEndpoint(config);

  getCalendarType(config);

  return Object.freeze({
    endpointKey: DIVIDENDS_ENDPOINT_KEY,

    sourceOptions: Object.freeze({
      method: "GET",

      dataType: "json",
    }),

    buildRequestData(filterState) {
      return buildDividendsRequestData(filterState, config);
    },

    normalizeResponse(response, context) {
      return normalizeDividendsDataSourceResponse(response, context);
    },
  });
}
