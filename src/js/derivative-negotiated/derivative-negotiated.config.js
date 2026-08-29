/* ==========================================================================
   Derivative Negotiated Configuration
   ========================================================================== */

/*
 * Validated configuration boundary between the JSP and JavaScript modules.
 *
 * Responsibilities:
 *
 * - read window.DerivativeNegotiatedConfig
 * - validate required endpoints and assets
 * - normalize locale and labels
 * - provide safe fallback labels
 * - return one immutable configuration object
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - request code
 * - filter behavior
 * - rendering logic
 * - DataTables configuration
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const GLOBAL_CONFIG_KEY = "DerivativeNegotiatedConfig";

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_VALUE = "—";

const DEFAULT_LABELS = Object.freeze({
  loading: "Loading…",

  noData: "No data available.",

  error: "Unable to load data.",

  results: "Results",

  total: "Total",

  filters: Object.freeze({
    allCategories: "All",

    allContracts: "All",
  }),

  table: Object.freeze({
    date: "Date",

    contract: "Contract",

    price: "Price",

    volume: "Volume Traded",

    value: "Value Traded",

    time: "Time",
  }),

  mobile: Object.freeze({
    showDetails: "More details",

    hideDetails: "Less details",
  }),
});

/* ==========================================================================
   Cached Configuration
   ========================================================================== */

let cachedConfig = null;

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

function normalizeLocale(value) {
  return normalizeString(value, DEFAULT_LOCALE);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach((childValue) => {
    deepFreeze(childValue);
  });

  return Object.freeze(value);
}

/* ==========================================================================
   Source Configuration
   ========================================================================== */

function getSourceConfig() {
  const source = window[GLOBAL_CONFIG_KEY];

  if (!isObject(source)) {
    throw new Error(
      `window.${GLOBAL_CONFIG_KEY} was not found or is not a valid configuration object.`,
    );
  }

  return source;
}

/* ==========================================================================
   Endpoint Validation
   ========================================================================== */

function getRequiredEndpoint(endpoints, key) {
  const endpoint = normalizeString(endpoints?.[key]);

  if (!endpoint) {
    throw new Error(`Derivative Negotiated endpoint "${key}" is required.`);
  }

  return endpoint;
}

function normalizeEndpoints(source = {}) {
  if (!isObject(source)) {
    throw new TypeError(
      "Derivative Negotiated endpoints must be a configuration object.",
    );
  }

  return {
    contractsByCategory: getRequiredEndpoint(source, "contractsByCategory"),

    negotiatedDeals: getRequiredEndpoint(source, "negotiatedDeals"),
  };
}

/* ==========================================================================
   Asset Validation
   ========================================================================== */

function getRequiredAsset(assets, key) {
  const asset = normalizeString(assets?.[key]);

  if (!asset) {
    throw new Error(`Derivative Negotiated asset "${key}" is required.`);
  }

  return asset;
}

function normalizeAssets(source = {}) {
  if (!isObject(source)) {
    throw new TypeError(
      "Derivative Negotiated assets must be a configuration object.",
    );
  }

  const companyLogoUrlTemplate = getRequiredAsset(
    source,
    "companyLogoUrlTemplate",
  );

  if (!companyLogoUrlTemplate.includes("{companyCode}")) {
    throw new Error(
      'Derivative Negotiated companyLogoUrlTemplate must contain "{companyCode}".',
    );
  }

  return {
    companyLogoUrlTemplate,

    companyLogoFallbackUrl: getRequiredAsset(source, "companyLogoFallbackUrl"),

    noDataImageUrl: getRequiredAsset(source, "noDataImageUrl"),
  };
}

/* ==========================================================================
   Filter Labels
   ========================================================================== */

function normalizeFilterLabels(source = {}) {
  const labels = isObject(source) ? source : {};

  return {
    allCategories: normalizeString(
      labels.allCategories,
      DEFAULT_LABELS.filters.allCategories,
    ),

    allContracts: normalizeString(
      labels.allContracts,
      DEFAULT_LABELS.filters.allContracts,
    ),
  };
}

/* ==========================================================================
   Table Labels
   ========================================================================== */

function normalizeTableLabels(source = {}) {
  const labels = isObject(source) ? source : {};

  return {
    date: normalizeString(labels.date, DEFAULT_LABELS.table.date),

    contract: normalizeString(labels.contract, DEFAULT_LABELS.table.contract),

    price: normalizeString(labels.price, DEFAULT_LABELS.table.price),

    volume: normalizeString(labels.volume, DEFAULT_LABELS.table.volume),

    value: normalizeString(labels.value, DEFAULT_LABELS.table.value),

    time: normalizeString(labels.time, DEFAULT_LABELS.table.time),
  };
}

/* ==========================================================================
   Mobile Labels
   ========================================================================== */

function normalizeMobileLabels(source = {}) {
  const labels = isObject(source) ? source : {};

  return {
    showDetails: normalizeString(
      labels.showDetails,
      DEFAULT_LABELS.mobile.showDetails,
    ),

    hideDetails: normalizeString(
      labels.hideDetails,
      DEFAULT_LABELS.mobile.hideDetails,
    ),
  };
}

/* ==========================================================================
   General Labels
   ========================================================================== */

function normalizeLabels(source = {}) {
  const labels = isObject(source) ? source : {};

  return {
    loading: normalizeString(labels.loading, DEFAULT_LABELS.loading),

    noData: normalizeString(labels.noData, DEFAULT_LABELS.noData),

    error: normalizeString(labels.error, DEFAULT_LABELS.error),

    results: normalizeString(labels.results, DEFAULT_LABELS.results),

    total: normalizeString(labels.total, DEFAULT_LABELS.total),

    emptyValue: normalizeString(labels.emptyValue, DEFAULT_EMPTY_VALUE),

    filters: normalizeFilterLabels(labels.filters),

    table: normalizeTableLabels(labels.table),

    mobile: normalizeMobileLabels(labels.mobile),
  };
}

/* ==========================================================================
   Configuration Construction
   ========================================================================== */

function createConfig(source) {
  return deepFreeze({
    locale: normalizeLocale(source.locale),

    endpoints: normalizeEndpoints(source.endpoints),

    assets: normalizeAssets(source.assets),

    labels: normalizeLabels(source.labels),
  });
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function getDerivativeNegotiatedConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = createConfig(getSourceConfig());

  return cachedConfig;
}
