/* ==========================================================================
   Issuer Trading Configuration
   ========================================================================== */

/*
 * Configuration boundary for the Issuer Trading page.
 *
 * Responsibilities:
 *
 * - read the server-provided configuration
 * - validate required endpoints
 * - normalize locale, assets, and labels
 * - expose an immutable configuration object
 * - provide endpoint and label access helpers
 *
 * This module intentionally has no:
 *
 * - DOM rendering
 * - filter behavior
 * - request lifecycle
 * - DataTables logic
 * - tab lifecycle
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const CONFIG_NAME = "IssuerTradingConfig";

const REQUIRED_ENDPOINTS = Object.freeze([
  "companiesBySector",
  "negotiatedDeals",
  "minimumSize",
  "accumulatedLosses",
  "listedTradableRights",
  "companyStatus",
  "otcTrading",
]);

const UNSAFE_URL_PATTERN = /^(?:javascript|data|vbscript):/i;

/* ==========================================================================
   Object Helpers
   ========================================================================== */

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    );
  }

  return value;
}

function freezeValue(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(freezeValue);

  return Object.freeze(value);
}

function createImmutableValue(value) {
  return freezeValue(cloneValue(value));
}

/* ==========================================================================
   String Helpers
   ========================================================================== */

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

/* ==========================================================================
   URL Validation
   ========================================================================== */

function normalizeUrl(value, options = {}) {
  const { name = "URL", required = false } = options;

  const url = normalizeString(value);

  if (!url) {
    if (required) {
      throw new Error(`${name} is required.`);
    }

    return "";
  }

  if (UNSAFE_URL_PATTERN.test(url)) {
    throw new Error(`${name} uses an unsupported URL scheme.`);
  }

  return url;
}

/* ==========================================================================
   Endpoints
   ========================================================================== */

function normalizeEndpoints(endpoints) {
  if (!isPlainObject(endpoints)) {
    throw new TypeError(
      "Issuer Trading configuration requires an endpoints object.",
    );
  }

  const normalized = {};

  REQUIRED_ENDPOINTS.forEach((key) => {
    normalized[key] = normalizeUrl(endpoints[key], {
      name: `Issuer Trading endpoint "${key}"`,
      required: true,
    });
  });

  return normalized;
}

/* ==========================================================================
   Assets
   ========================================================================== */

function normalizeAssets(assets = {}) {
  if (!isPlainObject(assets)) {
    throw new TypeError(
      "Issuer Trading assets configuration must be an object.",
    );
  }

  return {
    companyLogoUrlTemplate: normalizeUrl(assets.companyLogoUrlTemplate, {
      name: "Company logo URL template",
    }),

    companyLogoFallbackUrl: normalizeUrl(assets.companyLogoFallbackUrl, {
      name: "Company logo fallback URL",
    }),

    noDataImageUrl: normalizeUrl(assets.noDataImageUrl, {
      name: "No-data image URL",
    }),
  };
}

/* ==========================================================================
   Labels
   ========================================================================== */

function normalizeLabels(labels = {}) {
  if (!isPlainObject(labels)) {
    throw new TypeError(
      "Issuer Trading labels configuration must be an object.",
    );
  }

  return cloneValue(labels);
}

/* ==========================================================================
   Locale
   ========================================================================== */

function getDocumentLocale() {
  return normalizeString(globalThis.document?.documentElement?.lang, "en");
}

/* ==========================================================================
   Configuration Factory
   ========================================================================== */

export function createIssuerTradingConfig(rawConfig = {}) {
  if (!isPlainObject(rawConfig)) {
    throw new TypeError("Issuer Trading configuration must be an object.");
  }

  return createImmutableValue({
    locale: normalizeString(rawConfig.locale, getDocumentLocale()),

    endpoints: normalizeEndpoints(rawConfig.endpoints),

    assets: normalizeAssets(rawConfig.assets),

    labels: normalizeLabels(rawConfig.labels),
  });
}

/* ==========================================================================
   Global Configuration
   ========================================================================== */

export function getIssuerTradingConfig(source = globalThis) {
  const rawConfig = source?.[CONFIG_NAME];

  if (!rawConfig) {
    throw new Error(
      `window.${CONFIG_NAME} must be defined before loading Issuer Trading.`,
    );
  }

  return createIssuerTradingConfig(rawConfig);
}

/* ==========================================================================
   Endpoint Access
   ========================================================================== */

export function getIssuerTradingEndpoint(config, key) {
  if (!isPlainObject(config)) {
    throw new TypeError("A valid Issuer Trading configuration is required.");
  }

  if (typeof key !== "string" || !key.trim()) {
    throw new TypeError(
      "Issuer Trading endpoint key must be a non-empty string.",
    );
  }

  const endpointKey = key.trim();

  return normalizeUrl(config.endpoints?.[endpointKey], {
    name: `Issuer Trading endpoint "${endpointKey}"`,
    required: true,
  });
}

/* ==========================================================================
   Label Access
   ========================================================================== */

export function getIssuerTradingLabel(config, path, fallback = "") {
  const keys = Array.isArray(path)
    ? path
    : String(path ?? "")
        .split(".")
        .filter(Boolean);

  let value = config?.labels;

  for (const key of keys) {
    if (value === null || typeof value !== "object") {
      return fallback;
    }

    value = value[key];
  }

  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
