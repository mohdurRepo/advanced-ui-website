/* ==========================================================================
   Market Watch Configuration
   ========================================================================== */

/*
 * Validated configuration for the standalone Market Watch page.
 *
 * Responsibilities:
 *
 * - read the JSP-provided MarketWatchConfig object
 * - validate required endpoint configuration
 * - validate asset URLs
 * - normalize locale
 * - normalize market state
 * - normalize labels
 * - normalize initial column visibility
 * - normalize DataTable options
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
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const GLOBAL_CONFIG_KEY = "MarketWatchConfig";

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_VALUE = "—";

const DEFAULT_VISIBLE_GROUPS = Object.freeze([
  "range",
  "last-trade",
  "cumulative",
  "trading",
  "best-bid",
  "best-offer",
]);

const DEFAULT_LABELS = Object.freeze({
  loading: "Loading...",
  noData: "No data available",
  noWatchlistItems: "No watchlist items available",
  loadError: "Unable to load market data.",
  results: "Results",

  showAll: "Show All",
  noColumns: "No Columns",
  selectedSuffix: "Selected",

  marketOrder: "MO",

  status: Object.freeze({
    losses20To35: "",
    losses35To50: "",
    losses50More: "",
  }),

  mobile: Object.freeze({
    showDetails: "Show details",
    hideDetails: "Hide details",
  }),

  table: Object.freeze({}),
});

const DEFAULT_TABLE_OPTIONS = Object.freeze({
  autoWidth: false,

  paging: false,
  pageLength: 25,
  lengthChange: false,

  searching: false,
  ordering: false,
  info: false,

  serverSide: false,
  processing: false,

  scrollX: true,
  scrollCollapse: true,

  fixedHeader: true,
  fixedColumns: 1,
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
 * JSP resource URLs may be relative or absolute.
 *
 * We therefore do not require URL() parsing here. We only reject schemes that
 * must never be accepted as application/request or image URLs.
 */

function isUnsafeUrl(value) {
  return /^(?:javascript|data|vbscript):/i.test(normalizeString(value));
}

function requireSafeUrl(value, description) {
  const url = normalizeString(value);

  if (!url) {
    throw new Error(`Market Watch ${description} is required.`);
  }

  if (isUnsafeUrl(url)) {
    throw new Error(`Market Watch ${description} contains an unsafe URL.`);
  }

  return url;
}

function optionalSafeUrl(value, description) {
  const url = normalizeString(value);

  if (!url) {
    return "";
  }

  if (isUnsafeUrl(url)) {
    throw new Error(`Market Watch ${description} contains an unsafe URL.`);
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
   Endpoint
   ========================================================================== */

function normalizeEndpoint(rawConfig) {
  /*
   * Preserve the existing Market Watch JSP contract:
   *
   *     MarketWatchConfig.endpoint
   *
   * We can later change the JSP to an `endpoints` object if the page gains
   * multiple services. There is currently only one Market Watch data endpoint,
   * so adding another level provides no benefit.
   */

  return requireSafeUrl(rawConfig.endpoint, "endpoint");
}

/* ==========================================================================
   Assets
   ========================================================================== */

function normalizeAssets(rawAssets = {}) {
  const assets = isObject(rawAssets) ? rawAssets : {};

  const companyLogoUrlTemplate = optionalSafeUrl(
    assets.companyLogoUrlTemplate,
    "company logo URL template",
  );

  const companyLogoFallbackUrl = optionalSafeUrl(
    assets.companyLogoFallbackUrl,
    "company logo fallback URL",
  );

  if (
    companyLogoUrlTemplate &&
    !companyLogoUrlTemplate.includes("{companyCode}")
  ) {
    throw new Error(
      'Market Watch company logo URL template must contain "{companyCode}".',
    );
  }

  return {
    companyLogoUrlTemplate,
    companyLogoFallbackUrl,
  };
}

/* ==========================================================================
   Market State
   ========================================================================== */

function normalizeMarket(rawConfig) {
  const rawMarket = isObject(rawConfig.market) ? rawConfig.market : {};

  /*
   * `openCloseAuction` is retained as an input compatibility alias.
   *
   * The normalized application contract is always:
   *
   *     config.market.isAuction
   *
   * Downstream modules therefore do not need to understand both shapes.
   */

  const isAuction = normalizeBoolean(
    rawMarket.isAuction ?? rawConfig.openCloseAuction,
    false,
  );

  return {
    isAuction,
  };
}

/* ==========================================================================
   Labels
   ========================================================================== */

function normalizeLabel(value, fallback = "") {
  const normalized = normalizeString(value);

  return normalized || fallback;
}

function normalizeLabels(rawLabels = {}) {
  const labels = isObject(rawLabels) ? rawLabels : {};

  const status = isObject(labels.status) ? labels.status : {};

  const mobile = isObject(labels.mobile) ? labels.mobile : {};

  const table = isObject(labels.table) ? labels.table : {};

  return {
    loading: normalizeLabel(labels.loading, DEFAULT_LABELS.loading),

    noData: normalizeLabel(labels.noData, DEFAULT_LABELS.noData),

    noWatchlistItems: normalizeLabel(
      labels.noWatchlistItems,
      DEFAULT_LABELS.noWatchlistItems,
    ),

    loadError: normalizeLabel(labels.loadError, DEFAULT_LABELS.loadError),

    results: normalizeLabel(labels.results, DEFAULT_LABELS.results),

    showAll: normalizeLabel(labels.showAll, DEFAULT_LABELS.showAll),

    noColumns: normalizeLabel(labels.noColumns, DEFAULT_LABELS.noColumns),

    selectedSuffix: normalizeLabel(
      labels.selectedSuffix,
      DEFAULT_LABELS.selectedSuffix,
    ),

    marketOrder: normalizeLabel(labels.marketOrder, DEFAULT_LABELS.marketOrder),

    emptyValue: normalizeLabel(labels.emptyValue, DEFAULT_EMPTY_VALUE),

    status: {
      losses20To35: normalizeLabel(
        status.losses20To35,
        DEFAULT_LABELS.status.losses20To35,
      ),

      losses35To50: normalizeLabel(
        status.losses35To50,
        DEFAULT_LABELS.status.losses35To50,
      ),

      losses50More: normalizeLabel(
        status.losses50More,
        DEFAULT_LABELS.status.losses50More,
      ),
    },

    mobile: {
      showDetails: normalizeLabel(
        mobile.showDetails,
        DEFAULT_LABELS.mobile.showDetails,
      ),

      hideDetails: normalizeLabel(
        mobile.hideDetails,
        DEFAULT_LABELS.mobile.hideDetails,
      ),
    },

    /*
     * Table labels are page/JSP-owned and can grow as Market Watch evolves.
     *
     * Do not hard-code the complete set here. Preserve the provided dictionary
     * while still copying it so the final configuration owns its own object.
     */

    table: {
      ...table,
    },
  };
}

/* ==========================================================================
   Initial State
   ========================================================================== */

function normalizeVisibleGroups(value) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_VISIBLE_GROUPS];
  }

  const groups = value.map(normalizeString).filter(Boolean);

  return [...new Set(groups)];
}

function normalizeInitialState(rawInitialState = {}) {
  const initialState = isObject(rawInitialState) ? rawInitialState : {};

  return {
    visibleGroups: normalizeVisibleGroups(initialState.visibleGroups),
  };
}

/* ==========================================================================
   Table Options
   ========================================================================== */

function normalizeTableOptions(rawTable = {}) {
  const table = isObject(rawTable) ? rawTable : {};

  return {
    autoWidth: normalizeBoolean(
      table.autoWidth,
      DEFAULT_TABLE_OPTIONS.autoWidth,
    ),

    paging: normalizeBoolean(table.paging, DEFAULT_TABLE_OPTIONS.paging),

    pageLength: normalizePositiveInteger(
      table.pageLength,
      DEFAULT_TABLE_OPTIONS.pageLength,
    ),

    lengthChange: normalizeBoolean(
      table.lengthChange,
      DEFAULT_TABLE_OPTIONS.lengthChange,
    ),

    searching: normalizeBoolean(
      table.searching,
      DEFAULT_TABLE_OPTIONS.searching,
    ),

    ordering: normalizeBoolean(table.ordering, DEFAULT_TABLE_OPTIONS.ordering),

    info: normalizeBoolean(table.info, DEFAULT_TABLE_OPTIONS.info),

    serverSide: normalizeBoolean(
      table.serverSide,
      DEFAULT_TABLE_OPTIONS.serverSide,
    ),

    processing: normalizeBoolean(
      table.processing,
      DEFAULT_TABLE_OPTIONS.processing,
    ),

    scrollX: normalizeBoolean(table.scrollX, DEFAULT_TABLE_OPTIONS.scrollX),

    scrollCollapse: normalizeBoolean(
      table.scrollCollapse,
      DEFAULT_TABLE_OPTIONS.scrollCollapse,
    ),

    fixedHeader: normalizeBoolean(
      table.fixedHeader,
      DEFAULT_TABLE_OPTIONS.fixedHeader,
    ),

    /*
     * Market Watch currently fixes one identity column.
     *
     * Keep this numeric because the final table view will pass it through the
     * shared trading/data-view table configuration.
     */

    fixedColumns: normalizePositiveInteger(
      table.fixedColumns,
      DEFAULT_TABLE_OPTIONS.fixedColumns,
    ),
  };
}

/* ==========================================================================
   Configuration Factory
   ========================================================================== */

export function createMarketWatchConfig(rawConfig = {}) {
  if (!isObject(rawConfig)) {
    throw new TypeError("Market Watch configuration must be an object.");
  }

  const config = {
    locale: normalizeLocale(rawConfig.locale),

    endpoint: normalizeEndpoint(rawConfig),

    market: normalizeMarket(rawConfig),

    assets: normalizeAssets(rawConfig.assets),

    labels: normalizeLabels(rawConfig.labels),

    initialState: normalizeInitialState(rawConfig.initialState),

    table: normalizeTableOptions(rawConfig.table),
  };

  return deepFreeze(config);
}

/* ==========================================================================
   Global Configuration
   ========================================================================== */

/*
 * Do not cache the configuration globally inside this module.
 *
 * Reading from the provided source keeps this function deterministic enough
 * for tests and avoids stale configuration if a portlet/page is re-created.
 */

export function getMarketWatchConfig(source = globalThis) {
  if (!source || typeof source !== "object") {
    throw new TypeError(
      "Market Watch configuration requires a valid source object.",
    );
  }

  const rawConfig = source[GLOBAL_CONFIG_KEY];

  if (!rawConfig) {
    throw new Error(`${GLOBAL_CONFIG_KEY} is required.`);
  }

  return createMarketWatchConfig(rawConfig);
}
