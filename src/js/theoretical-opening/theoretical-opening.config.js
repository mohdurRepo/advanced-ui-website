/* ==========================================================================
   Theoretical Opening Configuration
   ========================================================================== */

/*
 * Shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 *
 * Responsibilities:
 *
 * - read the correct global JSP configuration
 * - validate the endpoint
 * - normalize locale / initial state
 * - normalize labels
 * - expose immutable page configuration
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const CONFIG_KEYS = Object.freeze({
  main: "TheoreticalOpeningConfig",
  nomu: "NomuTheoreticalOpeningConfig",
});

const DEFAULT_LOCALE = "en";
const DEFAULT_SECTOR = "All";

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);

  return Object.freeze(value);
}

/* ==========================================================================
   Endpoint
   ========================================================================== */

function normalizeEndpoint(value) {
  const endpoint = normalizeString(value);

  if (!endpoint) {
    throw new Error("Theoretical Opening endpoint is required.");
  }

  return endpoint;
}

/* ==========================================================================
   Initial State
   ========================================================================== */

function normalizeInitialState(value) {
  const state = isObject(value) ? value : {};

  return {
    sector: normalizeString(state.sector) || DEFAULT_SECTOR,
  };
}

/* ==========================================================================
   Labels
   ========================================================================== */

function normalizeLabels(value) {
  const labels = isObject(value) ? value : {};
  const mobile = isObject(labels.mobile) ? labels.mobile : {};
  const table = isObject(labels.table) ? labels.table : {};

  return {
    loading: normalizeString(labels.loading) || "Loading...",

    noData: normalizeString(labels.noData) || "No data available",

    loadError: normalizeString(labels.loadError) || "",

    results: normalizeString(labels.results) || "Results",

    mobile: {
      showDetails: normalizeString(mobile.showDetails) || "Show details",

      hideDetails: normalizeString(mobile.hideDetails) || "Hide details",

      symbolCompany: normalizeString(mobile.symbolCompany),

      priceVolume: normalizeString(mobile.priceVolume),
    },

    table: {
      companyName: normalizeString(table.companyName),

      previousClose: normalizeString(table.previousClose),

      top: normalizeString(table.top),

      tov: normalizeString(table.tov),
    },
  };
}

/* ==========================================================================
   Table Options
   ========================================================================== */

function normalizeTableOptions(value) {
  if (!isObject(value)) {
    return {};
  }

  /*
   * Common createDataTable() already owns the default DataTables options.
   *
   * Only preserve page-provided overrides here.
   */
  return {
    ...value,
  };
}

/* ==========================================================================
   Configuration Factory
   ========================================================================== */

export function createTheoreticalOpeningConfig(
  rawConfig = {},
  { variant = "main" } = {},
) {
  if (!isObject(rawConfig)) {
    throw new TypeError("Theoretical Opening configuration must be an object.");
  }

  const config = {
    variant: variant === "nomu" ? "nomu" : "main",

    endpoint: normalizeEndpoint(rawConfig.endpoint),

    locale: normalizeString(rawConfig.locale) || DEFAULT_LOCALE,

    initialState: normalizeInitialState(rawConfig.initialState),

    labels: normalizeLabels(rawConfig.labels),

    table: normalizeTableOptions(rawConfig.table),
  };

  return deepFreeze(config);
}

/* ==========================================================================
   Global Configuration
   ========================================================================== */

export function getTheoreticalOpeningConfig({
  source = globalThis,
  variant = "main",
} = {}) {
  if (!source || typeof source !== "object") {
    throw new TypeError(
      "Theoretical Opening configuration requires a valid source object.",
    );
  }

  const normalizedVariant = variant === "nomu" ? "nomu" : "main";

  const configKey = CONFIG_KEYS[normalizedVariant];

  const rawConfig = source[configKey];

  if (!rawConfig) {
    throw new Error(`${configKey} is required.`);
  }

  return createTheoreticalOpeningConfig(rawConfig, {
    variant: normalizedVariant,
  });
}
