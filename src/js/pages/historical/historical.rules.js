/* ==========================================================================
   Historical Reports Rules
   ========================================================================== */

/*
 * Centralized business logic for Historical Reports.
 *
 * Responsibilities:
 *
 * - validate the current filter selection
 * - resolve Trade Type field visibility
 * - resolve Unadjusted tab visibility
 * - resolve Derivatives Underlying routing
 * - resolve which table profile applies (performance / unadjusted /
 *   derivativesUnderlying / none)
 * - resolve contextual footnote content
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - global state
 * - DataTables lifecycle
 * - AJAX code
 * - column definitions
 * - card markup
 *
 * Legacy reference: historical.rules.js.
 *
 * Legacy reached into two globals directly: window.HistoricalManager.getFilters()
 * and window.HistoricalI18n. This module instead takes `filters` and `config`
 * as explicit parameters, matching the dependency style already used by
 * market-watch.filters.js and historical.config.js. This is a structural
 * change only -- for the same filter values and the same configured labels,
 * every function below returns exactly what legacy's resolve() returned.
 *
 * Filters here are ISO dates (YYYY-MM-DD), not legacy's DD-MM-YYYY. The
 * custom-date-range control's native inputs always hold ISO; the DD-MM-YYYY
 * conversion legacy's backend contract requires happens once, at the request
 * boundary in historical.filters.js, not here. Validation results (pass/fail,
 * ordering) are identical for the same real dates -- only the string format
 * assumption changed, and only because the date picker itself changed.
 */

import { HISTORICAL_SPECIAL_INDICES } from "./historical.columns.js";

/* ==========================================================================
   Constants
   ========================================================================== */

/*
 * Markets whose Performance tab is the only content tab shown -- i.e. the
 * Unadjusted Price tab never applies to them. DERIVATIVE is handled
 * separately below because its Unadjusted visibility additionally depends
 * on sector, not just market.
 */
const ONE_TAB_MARKETS = Object.freeze(["ETFS", "SUKUK", "INDICES", "MF", "TR"]);

const SPECIAL_INDICES_SET = new Set(HISTORICAL_SPECIAL_INDICES);

/* ==========================================================================
   Entity Parsing
   ========================================================================== */

/*
 * Entity values are colon-delimited: "<marketCode>:<symbol>:<type>",
 * e.g. "M:TASI:E". Only meaningful for market === "INDICES" in legacy, but
 * parsing is safe to run unconditionally -- an entity from any other market
 * simply will not match any of the checks below.
 */

export function getEntityParts(entity) {
  const parts = String(entity || "").split(":");

  return {
    marketCode: parts[0] || "",
    symbol: parts[1] || "",
    type: parts[2] || "",
  };
}

/* ==========================================================================
   Entity Classification
   ========================================================================== */

export function isIndexTypeEntity(filters) {
  if (filters.market !== "INDICES") {
    return false;
  }

  return getEntityParts(filters.entity).type === "I";
}

export function isMainMarketTasi(filters) {
  if (filters.market !== "INDICES") {
    return false;
  }

  const entity = getEntityParts(filters.entity);

  return entity.marketCode === "M" && entity.symbol === "TASI";
}

export function isSpecialIndex(filters) {
  if (filters.market !== "INDICES") {
    return false;
  }

  return SPECIAL_INDICES_SET.has(getEntityParts(filters.entity).symbol);
}

/* ==========================================================================
   ISO Date Parsing
   ========================================================================== */

/*
 * Self-contained rather than imported from components/custom-date -- that
 * component's parseISODate() is an internal implementation detail, not part
 * of its public API, so this page does not reach into it directly. The
 * validation rigor is equivalent: reject malformed strings and reject
 * impossible calendar dates (e.g. 2026-02-30) via a round-trip check.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseISODate(value) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return roundTrips ? date : null;
}

/* ==========================================================================
   Validation
   ========================================================================== */

export function validateHistoricalFilters(filters, config) {
  const labels = config?.labels?.validation ?? {};

  const market = filters?.market;
  const entity = filters?.entity;
  const startDate = filters?.startDate;
  const endDate = filters?.endDate;

  if (!market || market === "-1" || market === "0") {
    return {
      valid: false,
      message: labels.market || "Please select a market.",
    };
  }

  if (!entity || entity === "0") {
    return {
      valid: false,
      message: labels.entity || "Please select an entity.",
    };
  }

  if (!startDate || !endDate) {
    return {
      valid: false,
      message: labels.dateRange || "Please select a date range.",
    };
  }

  const start = parseISODate(startDate);
  const end = parseISODate(endDate);

  if (!start || !end) {
    return {
      valid: false,
      message: labels.dateRange || "Please select a valid date range.",
    };
  }

  if (start > end) {
    return {
      valid: false,
      message: labels.dateOrder || "Start date must be before end date.",
    };
  }

  return {
    valid: true,
    message: null,
  };
}

/* ==========================================================================
   Unadjusted Tab Visibility
   ========================================================================== */

function resolveUnadjustedVisibility(filters) {
  const market = filters.market;
  const sector = filters.sector;

  if (market === "DERIVATIVE") {
    return sector !== "I" && sector !== "OS";
  }

  return !ONE_TAB_MARKETS.includes(market);
}

/* ==========================================================================
   Profile Type
   ========================================================================== */

function resolveProfileType(filters, rules) {
  if (rules.isDerivativeUnderlying) {
    return "derivativesUnderlying";
  }

  if (rules.noTable) {
    return "none";
  }

  if (filters.activeTab === "unadjusted" && rules.showUnadjustedTab) {
    return "unadjusted";
  }

  return "performance";
}

/* ==========================================================================
   Footnote
   ========================================================================== */

/*
 * Requires config.labels.notes.{indexType, mainMarketTasi,
 * derivativeChangePoints, mfNav}. See the historical.config.js and JSP
 * patches accompanying this file -- these keys were not yet wired through
 * when historical.config.js was first written.
 */

function resolveNote(filters, rules, config) {
  if (!rules.ready) {
    return null;
  }

  const notes = config?.labels?.notes ?? {};

  if (isIndexTypeEntity(filters)) {
    return {
      visible: true,
      target: "default",
      message: notes.indexType || "",
    };
  }

  if (isMainMarketTasi(filters)) {
    return {
      visible: true,
      target: "default",
      message: notes.mainMarketTasi || "",
    };
  }

  if (filters.market === "DERIVATIVE") {
    return {
      visible: true,
      target: rules.isDerivativeUnderlying ? "derivatives" : "default",
      message: notes.derivativeChangePoints || "",
    };
  }

  if (filters.market === "MF") {
    return {
      visible: true,
      target: "default",
      message: notes.mfNav || "",
    };
  }

  return {
    visible: false,
    target: "default",
    message: "",
  };
}

/* ==========================================================================
   Resolve
   ========================================================================== */

/*
 * The single entry point, equivalent to legacy's HistoricalRules.resolve().
 * Takes the current filter state and the page config explicitly rather than
 * reaching into window.HistoricalManager / window.HistoricalI18n.
 */

export function resolveHistoricalRules(filters, config) {
  const validation = validateHistoricalFilters(filters, config);

  const rules = {
    filters,

    ready: validation.valid,
    message: validation.message,

    showTradeType:
      filters.market === "SUKUK" &&
      (filters.sector === "G" || filters.sector === "S"),

    isDerivativeUnderlying:
      filters.market === "DERIVATIVE" && filters.sector === "OS",

    isIndexTypeEntity: isIndexTypeEntity(filters),
    isMainMarketTasi: isMainMarketTasi(filters),
    isSpecialIndex: isSpecialIndex(filters),

    noTable: false,

    showUnadjustedTab: false,
    profileType: "performance",

    note: null,
  };

  rules.noTable = rules.ready && rules.isIndexTypeEntity;

  rules.showUnadjustedTab = validation.valid
    ? resolveUnadjustedVisibility(filters)
    : false;

  rules.profileType = resolveProfileType(filters, rules);

  rules.note = resolveNote(filters, rules, config);

  return rules;
}
