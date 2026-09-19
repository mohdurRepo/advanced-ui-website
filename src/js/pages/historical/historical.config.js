/* ==========================================================================
   Historical Reports Configuration
   ========================================================================== */

/*
 * Validated configuration for the Historical Reports page.
 *
 * Responsibilities:
 *
 * - read the JSP-provided window.HistoricalConfig object
 * - validate required endpoint configuration
 * - normalize locale
 * - normalize filter defaults / Reset targets
 * - normalize Historical business-rule constants
 * - normalize translated UI labels
 * - normalize pagination labels
 * - preserve page-owned table-label dictionaries
 * - normalize DataTables options for:
 *     - Performance / Unadjusted
 *     - Derivatives Underlying
 * - expose an immutable configuration object
 *
 * Rich Historical notes are intentionally NOT part of this configuration.
 *
 * Note content is rendered by JSP into:
 *
 *   <template data-historical-note-template="...">
 *
 * historical.rules.js will resolve only the semantic note key/target, while
 * historical.js will clone the matching template into the visible note
 * container.
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - note-template handling
 * - request implementation
 * - response normalization
 * - filter behavior
 * - table rendering
 * - card rendering
 * - pagination rendering
 * - DataTables lifecycle
 * - page initialization
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const GLOBAL_CONFIG_KEY = "HistoricalConfig";

const DEFAULT_LOCALE = "en";

/*
 * Matches Historical Reports' legacy/default Reset target.
 *
 * JSP request-scope values take precedence when they are provided.
 */
const DEFAULT_MARKET = "INDICES";
const DEFAULT_SECTOR = "M";
const DEFAULT_ENTITY = "M:TASI";
const DEFAULT_TRADE_TYPE = "OB";

/*
 * Markets whose report flow does not require the normal sector selection.
 *
 * JSP can override this through:
 *
 *   HistoricalConfig.constants.marketsWithoutSector
 */
const DEFAULT_MARKETS_WITHOUT_SECTOR = Object.freeze(["ETFS", "MF", "TR"]);

/* ==========================================================================
   Default Table Options
   ========================================================================== */

/*
 * Performance / Unadjusted:
 *
 * - server-side
 * - paged
 * - 100 records per page
 * - external design-system pagination UI
 * - DataTables search/order/info chrome disabled
 */
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

/*
 * Derivatives Underlying:
 *
 * - client-side
 * - single-shot request
 * - no pagination
 */
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

/* ==========================================================================
   Default Labels
   ========================================================================== */

/*
 * Defensive English fallbacks only.
 *
 * Normal production values come from JSP / fmt:message.
 */
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

  pagination: Object.freeze({
    page: "Page",

    of: "of",

    previous: "Previous",

    next: "Next",
  }),

  /*
   * Table labels intentionally remain open-ended.
   *
   * historical.columns.js owns the schema and its per-column fallbacks.
   */
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

  if (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "on"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "no" ||
    normalized === "n" ||
    normalized === "off"
  ) {
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
 * Liferay resource URLs may be relative or absolute.
 *
 * Do not require URL() parsing here because a valid portal-generated URL can
 * be relative to the current application context.
 *
 * We only reject URL schemes that must never be accepted as request targets.
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
 * All four endpoints are required:
 *
 * report
 *   Performance + Unadjusted server-side report data.
 *
 * underlying
 *   Derivatives Underlying data.
 *
 * sectors
 *   Market -> Sector dependency population.
 *
 * entities
 *   Market/Sector -> Entity dependency population.
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

/*
 * JSP passes the page's server-selected values.
 *
 * If a value is absent, fall back to Historical's established defaults.
 */
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
   Business Rule Constants
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
   Label Helpers
   ========================================================================== */

function normalizeLabel(value, fallback = "") {
  const normalized = normalizeString(value);

  return normalized || fallback;
}

/* ==========================================================================
   Validation Labels
   ========================================================================== */

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

/* ==========================================================================
   Filter Placeholder Labels
   ========================================================================== */

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

/* ==========================================================================
   Mobile Card Labels
   ========================================================================== */

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

/* ==========================================================================
   Pagination Labels
   ========================================================================== */

/*
 * Pagination markup is rendered dynamically by the shared data-pagination
 * component, so these labels must survive HistoricalConfig normalization.
 */
function normalizePaginationLabels(rawPagination = {}) {
  const pagination = isObject(rawPagination) ? rawPagination : {};

  return {
    page: normalizeLabel(pagination.page, DEFAULT_LABELS.pagination.page),

    of: normalizeLabel(pagination.of, DEFAULT_LABELS.pagination.of),

    previous: normalizeLabel(
      pagination.previous,
      DEFAULT_LABELS.pagination.previous,
    ),

    next: normalizeLabel(pagination.next, DEFAULT_LABELS.pagination.next),
  };
}

/* ==========================================================================
   Table Labels
   ========================================================================== */

/*
 * Historical table labels are JSP/page-owned and intentionally open-ended.
 *
 * historical.columns.js knows the actual column keys and supplies its own
 * defensive fallback labels for anything missing.
 *
 * Preserve the provided dictionary instead of duplicating the complete
 * schema here.
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

/* ==========================================================================
   Labels
   ========================================================================== */

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

    pagination: normalizePaginationLabels(labels.pagination),

    table: normalizeTableLabels(labels.table),
  };
}

/* ==========================================================================
   Report Table Options
   ========================================================================== */

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

/* ==========================================================================
   Underlying Table Options
   ========================================================================== */

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
 * Do not cache the normalized configuration at module scope.
 *
 * Reading from the supplied source keeps this function deterministic for
 * tests and prevents stale configuration if a portal fragment/portlet is
 * recreated.
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
