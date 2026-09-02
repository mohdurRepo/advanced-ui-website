/* ==========================================================================
   Theoretical Opening Configuration
   ========================================================================== */

/*
 * Theoretical Opening page configuration boundary.
 *
 * Responsibilities:
 *
 * - read the runtime configuration
 * - validate required configuration
 * - normalize commonly used configuration sections
 * - provide stable defaults for page composition
 *
 * The JSP remains responsible for creating:
 *
 * - window.TheoreticalOpeningConfig
 * - window.NomuTheoreticalOpeningConfig
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - AJAX execution
 * - DataTables lifecycle
 * - filter binding
 * - rendering
 */

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

function normalizeObject(value) {
  return isObject(value) ? value : {};
}

/* ==========================================================================
   Raw Configuration
   ========================================================================== */

export function getTheoreticalOpeningRawConfig(
  configName = "TheoreticalOpeningConfig",
) {
  if (typeof window === "undefined") {
    throw new Error(
      "Theoretical Opening configuration requires a browser environment.",
    );
  }

  const config = window[configName];

  if (!config || !isObject(config)) {
    throw new Error(`${configName} is required.`);
  }

  return config;
}

/* ==========================================================================
   Configuration Normalization
   ========================================================================== */

export function normalizeTheoreticalOpeningConfig(config = {}) {
  const source = normalizeObject(config);

  const initialState = normalizeObject(source.initialState);

  return {
    ...source,

    endpoint: normalizeString(source.endpoint),

    locale: normalizeString(source.locale, "en"),

    labels: normalizeObject(source.labels),

    assets: normalizeObject(source.assets),

    table: normalizeObject(source.table),

    initialState: {
      ...initialState,

      sector: normalizeString(initialState.sector, "All"),
    },
  };
}

/* ==========================================================================
   Public Configuration
   ========================================================================== */

export function getTheoreticalOpeningConfig(
  configName = "TheoreticalOpeningConfig",
) {
  const config = normalizeTheoreticalOpeningConfig(
    getTheoreticalOpeningRawConfig(configName),
  );

  if (!config.endpoint) {
    throw new Error(`${configName}.endpoint is required.`);
  }

  return config;
}
