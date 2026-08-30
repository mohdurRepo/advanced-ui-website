/* ==========================================================================
   Sukuk Configuration
   ========================================================================== */

/*
 * Sukuk & Bonds page configuration boundary.
 *
 * Responsibilities:
 *
 * - read window.SukukConfig
 * - validate required configuration
 * - normalize commonly used configuration sections
 * - provide stable defaults for page composition
 *
 * The JSP remains responsible for creating window.SukukConfig.
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
   Constants
   ========================================================================== */

export const SUKUK_VIEW = "1";

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

export function getSukukRawConfig() {
  if (typeof window === "undefined") {
    throw new Error("SukukConfig requires a browser environment.");
  }

  const config = window.SukukConfig;

  if (!config || !isObject(config)) {
    throw new Error("SukukConfig is required.");
  }

  return config;
}

/* ==========================================================================
   Configuration Normalization
   ========================================================================== */

export function normalizeSukukConfig(config = {}) {
  const source = normalizeObject(config);

  return {
    ...source,

    endpoint: normalizeString(source.endpoint),

    locale: normalizeString(source.locale, "en"),

    labels: normalizeObject(source.labels),

    assets: normalizeObject(source.assets),

    table: normalizeObject(source.table),

    initialState: normalizeObject(source.initialState),
  };
}

/* ==========================================================================
   Public Configuration
   ========================================================================== */

export function getSukukConfig() {
  const config = normalizeSukukConfig(getSukukRawConfig());

  if (!config.endpoint) {
    throw new Error("SukukConfig.endpoint is required.");
  }

  return config;
}

/* ==========================================================================
   Initial Visible Groups
   ========================================================================== */

export function getConfiguredVisibleGroups(config = {}) {
  const groups = config.initialState?.visibleGroups;

  return Array.isArray(groups) ? [...groups] : null;
}
