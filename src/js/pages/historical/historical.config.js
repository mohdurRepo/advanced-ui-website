/* ==========================================================================
   Historical Reports Configuration
   ========================================================================== */

/*
 * Validated configuration for the standalone Historical Reports page.
 *
 * Responsibilities:
 *
 * - read the JSP-provided HistoricalConfig object
 * - validate required endpoint configuration
 * - normalize locale
 * - normalize filter defaults (including the Reset target)
 * - normalize business-rule constants
 * - normalize labels, including contextual footnote messages
 * - normalize DataTable options for both the Performance/Unadjusted tables
 *   and the Underlying table, which are genuinely different integrations
 * - expose an immutable configuration object
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - request implementation
 * - response normalization
 * - filter behavior
 * - table rendering
 * - card rendering
 * - DataTables lifecycle
 * - page initialization
 *
 * Legacy reference: the three separate globals (HistoricalConfig,
 * HistoricalEndpoints, HistoricalI18n) plus DROPDOWN_CONFIG. Endpoints and
 * labels are consolidated into this one config's shape; DROPDOWN_CONFIG has
 * no equivalent here since DropdownManager no longer exists -- the cascading
 * Market -> Sector -> Entity population is built directly against
 * config.endpoints.sectors / config.endpoints.entities in
 * historical.filters.js.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const GLOBAL_CONFIG_KEY = "HistoricalConfig";

const DEFAULT_LOCALE = "en";

/*
 * Matches legacy's resetFilters() fallback values exactly. These are also
 * used as the Reset button's target, not just as defensive fallbacks for a
 * misconfigured page.
 */
const DEFAULT_MARKET = "INDICES";
const DEFAULT_SECTOR = "M";
const DEFAULT_ENTITY = "M:TASI";
const DEFAULT_TRADE_TYPE = "OB";

const DEFAULT_MARKETS_WITHOUT_SECTOR = Object.freeze(["ETFS", "MF", "TR"]);

const DEFAULT_REPORT_TABLE_OPTIONS = Object.freeze({
  serverSide: true,
  paging: true,
  pagingType: "simple",
  pageLength: 100,
  searching: false,
  ordering: false,
  info: false,
  scrollX: true,
  scrollCollapse: true,
  autoWidth: true,
  fixedHeader: true,
});

const DEFAULT_UNDERLYING_TABLE_OPTIONS = Object.freeze({
  serverSide: false,
  paging: false,
  searching: false,
  ordering: false,
  info: false,
  scrollX: true,
  scrollCollapse: true,
  autoWidth: true,
  fixedHeader: true,
});

const DEFAULT_LABELS = Object.freeze({
  placeholderSelectFilters: "Please select filters to view historical data.",
  noData: "No data available.",

  validation: Object.freeze({
    market: "Please select a market.",
    sector: "Please select a sector.",
    entity: "Please select an entity.",
    dateRange: "Please select a valid date range.",
    dateOrder: "Start date must be before end date.",
  }),

  placeholders: Object.freeze({
    market: "All Markets",
    sector: "All Sectors",
    entity: "All Entities",
  }),

  mobile: Object.freeze({
    showDetails: "Show details",
    hideDetails: "Hide details",
  }),

  notes: Object.freeze({
    indexType: "",
    mainMarketTasi: "",
    derivativeChangePoints: "",
    mfNav: "",
  }),

  table: Object.freeze({}),
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

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1") {
    return true;
  }

  if (value === 0 || value === "0") {
    return false;
  }

  const normalized = normalizeString(value).toLowerCase();

  if (["true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizePositiveInteger(value, fallback) {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return numericValue;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);

  return Object.freeze(value);
}

/* ==========================================================================
   URL Validation
   ========================================================================== */

/*
 * JSP resource URLs may be relative or absolute. We do not require URL()
 * parsing here; we only reject schemes that must never be accepted as
 * request URLs.
 */

function isUnsafeUrl(value) {
  return /^(?:javascript|data|vbscript):/i.test(normalizeString(value));
}

function requireSafeUrl(value, description) {
  const url = normalizeString(value);

  if (!url) {
    throw new Error(`Historical Reports ${description} is required.`);
  }

  if (isUnsafeUrl(url)) {
    throw new Error(
      `Historical Reports ${description} contains an unsafe URL.`,
    );
  }

  return url;
}

/* ==========================================================================
   Locale
   ========================================================================== */

function normalizeLocale(value) {
  return normalizeString(value) || DEFAULT_LOCALE;
}

/* ==========================================================================
   Endpoints
   ========================================================================== */

/*
 * All four are required. Unlike Market Watch's single endpoint, this page
 * cannot function correctly with any of these missing: the report endpoint
 * drives both content tabs, underlying drives Derivatives Underlying, and
 * sectors/entities drive the cascading dropdown chain that
 * historical.filters.js depends on.
 */

function normalizeEndpoints(rawEndpoints = {}) {
  const endpoints = isObject(rawEndpoints) ? rawEndpoints : {};

  return {
    report: requireSafeUrl(endpoints.report, "report endpoint"),
    underlying: requireSafeUrl(endpoints.underlying, "underlying endpoint"),
    sectors: requireSafeUrl(endpoints.sectors, "sectors endpoint"),
    entities: requireSafeUrl(endpoints.entities, "entities endpoint"),
  };
}

/* ==========================================================================
   Filter Defaults
   ========================================================================== */

function normalizeDefaults(rawDefaults = {}) {
  const defaults = isObject(rawDefaults) ? rawDefaults : {};

  return {
    market: normalizeString(defaults.market) || DEFAULT_MARKET,
    sector: normalizeString(defaults.sector) || DEFAULT_SECTOR,
    entity: normalizeString(defaults.entity) || DEFAULT_ENTITY,
    tradeType: normalizeString(defaults.tradeType) || DEFAULT_TRADE_TYPE,
  };
}

/* ==========================================================================
   Business-Rule Constants
   ========================================================================== */

function normalizeConstants(rawConstants = {}) {
  const constants = isObject(rawConstants) ? rawConstants : {};

  const marketsWithoutSector = Array.isArray(constants.marketsWithoutSector)
    ? constants.marketsWithoutSector.map(normalizeString).filter(Boolean)
    : [...DEFAULT_MARKETS_WITHOUT_SECTOR];

  return {
    marketsWithoutSector,
  };
}

/* ==========================================================================
   Labels
   ========================================================================== */

function normalizeLabel(value, fallback = "") {
  const normalized = normalizeString(value);

  return normalized || fallback;
}

function normalizeValidationLabels(rawValidation = {}) {
  const validation = isObject(rawValidation) ? rawValidation : {};

  return {
    market: normalizeLabel(validation.market, DEFAULT_LABELS.validation.market),
    sector: normalizeLabel(validation.sector, DEFAULT_LABELS.validation.sector),
    entity: normalizeLabel(validation.entity, DEFAULT_LABELS.validation.entity),
    dateRange: normalizeLabel(
      validation.dateRange,
      DEFAULT_LABELS.validation.dateRange,
    ),
    dateOrder: normalizeLabel(
      validation.dateOrder,
      DEFAULT_LABELS.validation.dateOrder,
    ),
  };
}

function normalizePlaceholderLabels(rawPlaceholders = {}) {
  const placeholders = isObject(rawPlaceholders) ? rawPlaceholders : {};

  return {
    market: normalizeLabel(
      placeholders.market,
      DEFAULT_LABELS.placeholders.market,
    ),
    sector: normalizeLabel(
      placeholders.sector,
      DEFAULT_LABELS.placeholders.sector,
    ),
    entity: normalizeLabel(
      placeholders.entity,
      DEFAULT_LABELS.placeholders.entity,
    ),
  };
}

function normalizeMobileLabels(rawMobile = {}) {
  const mobile = isObject(rawMobile) ? rawMobile : {};

  return {
    showDetails: normalizeLabel(
      mobile.showDetails,
      DEFAULT_LABELS.mobile.showDetails,
    ),
    hideDetails: normalizeLabel(
      mobile.hideDetails,
      DEFAULT_LABELS.mobile.hideDetails,
    ),
  };
}

/*
 * Contextual footnote messages, keyed to match historical.rules.js's
 * resolveNote(). Legacy read these directly off window.HistoricalI18n
 * (note1, main.market.indices.tasi.note1,
 * derivative.performance.foonote.change.points, mf.performance.foonote.nav)
 * -- these four keys already exist in the message bundle, no new
 * translation entries are needed for them.
 */

function normalizeNoteLabels(rawNotes = {}) {
  const notes = isObject(rawNotes) ? rawNotes : {};

  return {
    indexType: normalizeLabel(notes.indexType, DEFAULT_LABELS.notes.indexType),

    mainMarketTasi: normalizeLabel(
      notes.mainMarketTasi,
      DEFAULT_LABELS.notes.mainMarketTasi,
    ),

    derivativeChangePoints: normalizeLabel(
      notes.derivativeChangePoints,
      DEFAULT_LABELS.notes.derivativeChangePoints,
    ),

    mfNav: normalizeLabel(notes.mfNav, DEFAULT_LABELS.notes.mfNav),
  };
}

/*
 * Table labels are page/JSP-owned and grow as columns are added. Preserve
 * the provided dictionary rather than hard-coding every key here, matching
 * market-watch.config.js's normalizeLabels() approach -- historical.columns.js
 * already supplies its own per-key fallback text for anything missing.
 */

function normalizeTableLabels(rawTable = {}) {
  const table = isObject(rawTable) ? rawTable : {};

  const underlying = isObject(table.underlying) ? table.underlying : {};

  return {
    ...table,
    underlying: {
      ...underlying,
    },
  };
}

function normalizeLabels(rawLabels = {}) {
  const labels = isObject(rawLabels) ? rawLabels : {};

  return {
    placeholderSelectFilters: normalizeLabel(
      labels.placeholderSelectFilters,
      DEFAULT_LABELS.placeholderSelectFilters,
    ),

    noData: normalizeLabel(labels.noData, DEFAULT_LABELS.noData),

    validation: normalizeValidationLabels(labels.validation),

    placeholders: normalizePlaceholderLabels(labels.placeholders),

    mobile: normalizeMobileLabels(labels.mobile),

    notes: normalizeNoteLabels(labels.notes),

    table: normalizeTableLabels(labels.table),
  };
}

/* ==========================================================================
   Table Options
   ========================================================================== */

/*
 * Two dedicated normalizers rather than one parameterized function: the
 * Performance/Unadjusted ("report") and Underlying tables are genuinely
 * different DataTables integrations (server-side paged vs. client-side
 * single-shot), not variations of the same shape, so forcing them through
 * one generic normalizer would trade clarity for a false sense of reuse.
 */

function normalizeReportTableOptions(rawTable = {}) {
  const table = isObject(rawTable) ? rawTable : {};
  const defaults = DEFAULT_REPORT_TABLE_OPTIONS;

  return {
    serverSide: normalizeBoolean(table.serverSide, defaults.serverSide),
    paging: normalizeBoolean(table.paging, defaults.paging),
    pagingType: normalizeString(table.pagingType) || defaults.pagingType,
    pageLength: normalizePositiveInteger(table.pageLength, defaults.pageLength),
    searching: normalizeBoolean(table.searching, defaults.searching),
    ordering: normalizeBoolean(table.ordering, defaults.ordering),
    info: normalizeBoolean(table.info, defaults.info),
    scrollX: normalizeBoolean(table.scrollX, defaults.scrollX),
    scrollCollapse: normalizeBoolean(
      table.scrollCollapse,
      defaults.scrollCollapse,
    ),
    autoWidth: normalizeBoolean(table.autoWidth, defaults.autoWidth),
    fixedHeader: normalizeBoolean(table.fixedHeader, defaults.fixedHeader),
  };
}

function normalizeUnderlyingTableOptions(rawTable = {}) {
  const table = isObject(rawTable) ? rawTable : {};
  const defaults = DEFAULT_UNDERLYING_TABLE_OPTIONS;

  return {
    serverSide: normalizeBoolean(table.serverSide, defaults.serverSide),
    paging: normalizeBoolean(table.paging, defaults.paging),
    searching: normalizeBoolean(table.searching, defaults.searching),
    ordering: normalizeBoolean(table.ordering, defaults.ordering),
    info: normalizeBoolean(table.info, defaults.info),
    scrollX: normalizeBoolean(table.scrollX, defaults.scrollX),
    scrollCollapse: normalizeBoolean(
      table.scrollCollapse,
      defaults.scrollCollapse,
    ),
    autoWidth: normalizeBoolean(table.autoWidth, defaults.autoWidth),
    fixedHeader: normalizeBoolean(table.fixedHeader, defaults.fixedHeader),
  };
}

/* ==========================================================================
   Configuration Factory
   ========================================================================== */

export function createHistoricalConfig(rawConfig = {}) {
  if (!isObject(rawConfig)) {
    throw new TypeError("Historical Reports configuration must be an object.");
  }

  const config = {
    locale: normalizeLocale(rawConfig.locale),

    endpoints: normalizeEndpoints(rawConfig.endpoints),

    defaults: normalizeDefaults(rawConfig.defaults),

    constants: normalizeConstants(rawConfig.constants),

    labels: normalizeLabels(rawConfig.labels),

    table: {
      report: normalizeReportTableOptions(rawConfig.table?.report),
      underlying: normalizeUnderlyingTableOptions(rawConfig.table?.underlying),
    },
  };

  return deepFreeze(config);
}

/* ==========================================================================
   Global Configuration
   ========================================================================== */

/*
 * Do not cache the configuration globally inside this module. Reading from
 * the provided source keeps this function deterministic for tests and
 * avoids stale configuration if the page/portlet is re-created.
 */

export function getHistoricalConfig(source = globalThis) {
  if (!source || typeof source !== "object") {
    throw new TypeError(
      "Historical Reports configuration requires a valid source object.",
    );
  }

  const rawConfig = source[GLOBAL_CONFIG_KEY];

  if (!rawConfig) {
    throw new Error(`${GLOBAL_CONFIG_KEY} is required.`);
  }

  return createHistoricalConfig(rawConfig);
}
