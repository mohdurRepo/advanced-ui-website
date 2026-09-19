/* ==========================================================================
   Historical Reports Rules
   ========================================================================== */

/*
 * Pure business-rule resolver for Historical Reports.
 *
 * Responsibilities:
 *
 * - validate the current filter state
 * - determine Trade Type visibility
 * - determine Unadjusted tab availability
 * - identify index entity metadata
 * - resolve the active Historical profile
 * - resolve the contextual note key / target
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - translated note HTML
 * - table creation
 * - card rendering
 * - pagination behavior
 * - request implementation
 * - filter mutation
 * - tab activation
 *
 * Notes:
 *
 * JSP owns the actual localized/rich note content through:
 *
 *   <template data-historical-note-template="...">
 *
 * This rules module only returns the semantic template key.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TAB = "performance";

/*
 * These markets expose Performance only.
 *
 * Unadjusted Price is intentionally unavailable for all of them.
 */
const ONE_TAB_MARKETS = Object.freeze(
  new Set(["ETFS", "SUKUK", "INDICES", "MF", "TR"]),
);

/*
 * Trade Type is meaningful only for Sukuk/Bonds sectors G and S.
 */
const SUKUK_TRADE_TYPE_SECTORS = Object.freeze(new Set(["G", "S"]));

/*
 * Derivatives sectors where the Unadjusted tab is not available.
 *
 * OS has its own Derivatives Underlying profile.
 * I remains Performance-only.
 */
const DERIVATIVE_ONE_TAB_SECTORS = Object.freeze(new Set(["I", "OS"]));

const DERIVATIVE_UNDERLYING_SECTOR = "OS";

/* ==========================================================================
   Profile Types
   ========================================================================== */

export const HISTORICAL_PROFILE_TYPES = Object.freeze({
  performance: "performance",

  unadjusted: "unadjusted",

  derivativesUnderlying: "derivativesUnderlying",

  none: "none",
});

/* ==========================================================================
   Note Keys
   ========================================================================== */

/*
 * Must stay aligned with the JSP:
 *
 *   data-historical-note-template="indexType"
 *   data-historical-note-template="mainMarketTasi"
 *   data-historical-note-template="derivativeChangePoints"
 *   data-historical-note-template="mfNav"
 */
export const HISTORICAL_NOTE_KEYS = Object.freeze({
  indexType: "indexType",

  mainMarketTasi: "mainMarketTasi",

  derivativeChangePoints: "derivativeChangePoints",

  mfNav: "mfNav",
});

/* ==========================================================================
   Note Targets
   ========================================================================== */

export const HISTORICAL_NOTE_TARGETS = Object.freeze({
  default: "default",

  derivatives: "derivatives",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeMarket(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeSector(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeEntity(value) {
  return normalizeString(value);
}

function normalizeTradeType(value) {
  return normalizeString(value).toUpperCase() || "OB";
}

function normalizeTab(value) {
  const tab = normalizeString(value);

  return tab === "unadjusted" ? "unadjusted" : DEFAULT_TAB;
}

/* ==========================================================================
   Date Validation
   ========================================================================== */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value) {
  const normalized = normalizeString(value);
  const match = ISO_DATE_PATTERN.exec(normalized);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  /*
   * Reject values such as 2026-02-31 that Date would otherwise normalize
   * into another calendar date.
   */
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/* ==========================================================================
   Filter Normalization
   ========================================================================== */

export function normalizeHistoricalRuleFilters(filters = {}) {
  return {
    market: normalizeMarket(filters.market),

    sector: normalizeSector(filters.sector),

    entity: normalizeEntity(filters.entity),

    tradeType: normalizeTradeType(filters.tradeType),

    startDate: normalizeString(filters.startDate),

    endDate: normalizeString(filters.endDate),

    activeTab: normalizeTab(filters.activeTab),
  };
}

/* ==========================================================================
   Index Entity Metadata
   ========================================================================== */

/*
 * Historical index entities use the legacy colon-delimited shape:
 *
 *   <prefix>:<indexCode>:<indexType>
 *
 * Examples may omit the final type:
 *
 *   M:TASI
 *
 * Existing Historical column rules use:
 *
 *   parts[1] -> index code
 *   parts[2] -> index type
 */
export function parseHistoricalIndexEntity(entity) {
  const parts = normalizeEntity(entity).split(":");

  return Object.freeze({
    raw: normalizeEntity(entity),

    prefix: parts[0] || "",

    indexCode: parts[1] || "",

    indexType: parts[2] || "",
  });
}

/* ==========================================================================
   Validation
   ========================================================================== */

/*
 * Preserve Historical's established validation contract:
 *
 * - Market required
 * - Entity required
 * - Start/end dates required and valid
 * - Start must not be after End
 *
 * Sector is deliberately NOT treated as a required validation field here.
 * Historical's legacy behavior did not reject the page merely because the
 * sector value was the default/sentinel value.
 */
export function validateHistoricalFilters(filters, config = {}) {
  const normalized = normalizeHistoricalRuleFilters(filters);

  const labels = config.labels?.validation ?? {};

  const errors = [];

  /* ------------------------------------------------------------------------
     Market
     ------------------------------------------------------------------------ */

  if (!normalized.market || normalized.market === "-1") {
    errors.push({
      field: "market",

      message: labels.market || "Please select a market.",
    });
  }

  /* ------------------------------------------------------------------------
     Entity
     ------------------------------------------------------------------------ */

  if (!normalized.entity || normalized.entity === "0") {
    errors.push({
      field: "entity",

      message: labels.entity || "Please select an entity.",
    });
  }

  /* ------------------------------------------------------------------------
     Date Range
     ------------------------------------------------------------------------ */

  const startDate = parseIsoDate(normalized.startDate);

  const endDate = parseIsoDate(normalized.endDate);

  if (!startDate || !endDate) {
    errors.push({
      field: "dateRange",

      message: labels.dateRange || "Please select a valid date range.",
    });
  } else if (startDate.getTime() > endDate.getTime()) {
    errors.push({
      field: "dateOrder",

      message: labels.dateOrder || "Start date must be before end date.",
    });
  }

  return Object.freeze({
    valid: errors.length === 0,

    errors: Object.freeze(errors),

    message: errors[0]?.message || "",

    filters: Object.freeze(normalized),
  });
}

/* ==========================================================================
   Trade Type Visibility
   ========================================================================== */

export function shouldShowHistoricalTradeType(filters) {
  const { market, sector } = normalizeHistoricalRuleFilters(filters);

  return market === "SUKUK" && SUKUK_TRADE_TYPE_SECTORS.has(sector);
}

/* ==========================================================================
   Unadjusted Tab Visibility
   ========================================================================== */

export function shouldShowHistoricalUnadjustedTab(filters) {
  const { market, sector } = normalizeHistoricalRuleFilters(filters);

  /*
   * No meaningful market selection yet.
   */
  if (!market || market === "-1") {
    return false;
  }

  /*
   * Performance-only markets.
   */
  if (ONE_TAB_MARKETS.has(market)) {
    return false;
  }

  /*
   * Derivatives has additional sector-specific restrictions.
   */
  if (market === "DERIVATIVE" && DERIVATIVE_ONE_TAB_SECTORS.has(sector)) {
    return false;
  }

  return true;
}

/* ==========================================================================
   Derivatives Underlying
   ========================================================================== */

export function isHistoricalDerivativesUnderlying(filters) {
  const { market, sector } = normalizeHistoricalRuleFilters(filters);

  return market === "DERIVATIVE" && sector === DERIVATIVE_UNDERLYING_SECTOR;
}

/* ==========================================================================
   No-Table Index Profile
   ========================================================================== */

export function isHistoricalIndexTypeOnly(filters) {
  const normalized = normalizeHistoricalRuleFilters(filters);

  if (normalized.market !== "INDICES") {
    return false;
  }

  const { indexType } = parseHistoricalIndexEntity(normalized.entity);

  return indexType === "I";
}

/* ==========================================================================
   Profile Resolution
   ========================================================================== */

/*
 * Precedence is important and intentionally explicit:
 *
 * 1. Derivatives Underlying
 * 2. Index type with no report table
 * 3. Unadjusted when the selected tab is actually available
 * 4. Performance
 */
export function resolveHistoricalProfileType(filters) {
  const normalized = normalizeHistoricalRuleFilters(filters);

  if (isHistoricalDerivativesUnderlying(normalized)) {
    return HISTORICAL_PROFILE_TYPES.derivativesUnderlying;
  }

  if (isHistoricalIndexTypeOnly(normalized)) {
    return HISTORICAL_PROFILE_TYPES.none;
  }

  const showUnadjustedTab = shouldShowHistoricalUnadjustedTab(normalized);

  if (normalized.activeTab === "unadjusted" && showUnadjustedTab) {
    return HISTORICAL_PROFILE_TYPES.unadjusted;
  }

  return HISTORICAL_PROFILE_TYPES.performance;
}

/* ==========================================================================
   Note Resolution
   ========================================================================== */

/*
 * Rules return only:
 *
 * {
 *   visible,
 *   target,
 *   key
 * }
 *
 * No localized HTML/string is returned from this module.
 *
 * historical.js will later locate:
 *
 *   [data-historical-note-template="<key>"]
 *
 * and clone its template content.
 */
export function resolveHistoricalNote(filters, profileType) {
  const normalized = normalizeHistoricalRuleFilters(filters);

  const { market, sector, activeTab } = normalized;

  const { indexCode, indexType } = parseHistoricalIndexEntity(
    normalized.entity,
  );

  /* ------------------------------------------------------------------------
     Index Type

     This is the note-only / no-table profile.
     ------------------------------------------------------------------------ */

  if (market === "INDICES" && indexType === "I") {
    return Object.freeze({
      visible: true,

      target: HISTORICAL_NOTE_TARGETS.default,

      key: HISTORICAL_NOTE_KEYS.indexType,
    });
  }

  /* ------------------------------------------------------------------------
     TASI
     ------------------------------------------------------------------------ */

  if (market === "INDICES" && indexCode === "TASI") {
    return Object.freeze({
      visible: true,

      target: HISTORICAL_NOTE_TARGETS.default,

      key: HISTORICAL_NOTE_KEYS.mainMarketTasi,
    });
  }

  /* ------------------------------------------------------------------------
     Derivatives Performance

     OS is the independent Underlying profile and therefore does not receive
     the Performance "Change Points" note.

     When Unadjusted is available and selected, this Performance-specific
     note is also suppressed.
     ------------------------------------------------------------------------ */

  if (
    market === "DERIVATIVE" &&
    sector !== DERIVATIVE_UNDERLYING_SECTOR &&
    activeTab === "performance" &&
    profileType === HISTORICAL_PROFILE_TYPES.performance
  ) {
    return Object.freeze({
      visible: true,

      target: HISTORICAL_NOTE_TARGETS.derivatives,

      key: HISTORICAL_NOTE_KEYS.derivativeChangePoints,
    });
  }

  /* ------------------------------------------------------------------------
     Mutual Funds

     MF is Performance-only, so no separate tab check is necessary.
     ------------------------------------------------------------------------ */

  if (market === "MF") {
    return Object.freeze({
      visible: true,

      target: HISTORICAL_NOTE_TARGETS.default,

      key: HISTORICAL_NOTE_KEYS.mfNav,
    });
  }

  return Object.freeze({
    visible: false,

    target: HISTORICAL_NOTE_TARGETS.default,

    key: "",
  });
}

/* ==========================================================================
   Main Rule Resolver
   ========================================================================== */

export function resolveHistoricalRules(filters = {}, config = {}) {
  const validation = validateHistoricalFilters(filters, config);

  const normalized = validation.filters;

  const showTradeType = shouldShowHistoricalTradeType(normalized);

  const showUnadjustedTab = shouldShowHistoricalUnadjustedTab(normalized);

  /*
   * Do not resolve a live data profile while required input is invalid.
   *
   * Performance is retained as the neutral fallback identifier so callers
   * never receive an undefined profile value, but `ready` is authoritative.
   */
  const profileType = validation.valid
    ? resolveHistoricalProfileType(normalized)
    : HISTORICAL_PROFILE_TYPES.performance;

  const note = validation.valid
    ? resolveHistoricalNote(normalized, profileType)
    : Object.freeze({
        visible: false,

        target: HISTORICAL_NOTE_TARGETS.default,

        key: "",
      });

  return Object.freeze({
    ready: validation.valid,

    message: validation.message,

    validation,

    filters: normalized,

    showTradeType,

    showUnadjustedTab,

    profileType,

    note,
  });
}
