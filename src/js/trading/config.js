/* ==========================================================================
   Trading Configuration
   ========================================================================== */

/*
 * Normalize and expose the page-provided Trading configuration.
 *
 * Responsibilities:
 *
 * - read window.TradingConfig
 * - validate required configuration
 * - normalize optional configuration
 * - provide stable defaults
 * - expose an immutable configuration snapshot
 *
 * This file intentionally has no:
 *
 * - DOM queries
 * - event listeners
 * - AJAX requests
 * - DataTables logic
 * - rendering
 * - tab behavior
 */

/* ==========================================================================
   Defaults
   ========================================================================== */

const DEFAULTS = Object.freeze({
  locale: "en",

  initialState: {
    activeTab: "negotiatedDeals",

    negotiatedDeals: {
      type: "Negotiated-Deals",
      sector: "All",
      company: "All",
      fromDate: "",
      toDate: "",
    },

    accumulated: {
      report: "All",
    },

    deListedCompanies: {
      type: "Suspension",
      fromDate: "",
      toDate: "",
    },
  },

  dateRange: {
    defaultMode: "lastMonthToToday",
    inputFormat: "yyyy-MM-dd",
    requestFormat: "dd-MM-yyyy",
  },

  dependencies: {
    sectorCompany: {
      defaultValue: "All",

      request: {
        format: "json",
        sectorParameter: "sector",
      },

      response: {
        value: "symbol",
        label: "longName",
      },
    },
  },

  filters: {
    negotiatedDeals: {
      defaults: {
        type: "Negotiated-Deals",
        sector: "All",
        company: "All",
      },
    },

    accumulated: {
      defaults: {
        report: "All",
      },
    },

    deListedCompanies: {
      defaults: {
        type: "Suspension",
      },

      suspendedTypes: ["Suspension", "Suspension_Funds"],

      delistedTypes: ["Delisting", "Delisting_Funds"],
    },
  },

  tableDefaults: {
    autoWidth: false,

    searching: false,
    info: false,
    lengthChange: false,

    serverSide: false,
    processing: false,

    deferRender: true,

    scrollX: true,
    scrollCollapse: true,

    fixedHeader: false,
    fixedColumns: 0,

    layout: {
      topStart: null,
      topEnd: null,
      bottomStart: null,
      bottomEnd: null,
    },
  },

  tables: {},

  labels: {
    loading: "Loading…",
    noData: "No data available",
    loadError: "Unable to load data.",
    results: "Results",
    total: "Total",
    reset: "Reset",

    suspendedLink: "",
    delistedLink: "",

    controls: {
      search: "Search",
      searchPlaceholder: "Search",
      all: "All",
    },

    tabs: {},

    mobile: {
      showDetails: "Show details",
      hideDetails: "Hide details",
      daily: "Daily",
      total: "Total",
    },

    negotiatedDeals: {},
    minimumSize: {},
    accumulated: {},
    listedTradable: {},
    suspended: {},
    delisted: {},
    otc: {},
  },
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    );
  }

  return value;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);

  return Object.freeze(value);
}

/**
 * Deep-merge plain objects.
 *
 * Arrays are replaced rather than merged because configuration arrays
 * represent complete ordered contracts.
 */
function mergeConfig(base, override) {
  if (!isObject(base)) {
    return cloneValue(override);
  }

  if (!isObject(override)) {
    return cloneValue(base);
  }

  const result = cloneValue(base);

  Object.entries(override).forEach(([key, value]) => {
    if (isObject(value) && isObject(result[key])) {
      result[key] = mergeConfig(result[key], value);

      return;
    }

    result[key] = cloneValue(value);
  });

  return result;
}

/* ==========================================================================
   Required Endpoints
   ========================================================================== */

const REQUIRED_ENDPOINTS = Object.freeze([
  "negotiatedDeals",
  "minimumSize",
  "accumulatedLosses",
  "listedTradableRights",
  "suspendedDelisted",
  "otcTrading",
  "companiesBySector",
]);

function validateEndpoints(endpoints) {
  if (!isObject(endpoints)) {
    throw new Error("Trading configuration requires an endpoints object.");
  }

  REQUIRED_ENDPOINTS.forEach((key) => {
    if (!isNonEmptyString(endpoints[key])) {
      throw new Error(`Trading configuration endpoint "${key}" is required.`);
    }
  });
}

/* ==========================================================================
   Configuration Validation
   ========================================================================== */

function validateRawConfig(config) {
  if (!isObject(config)) {
    throw new Error(
      "window.TradingConfig is required before Trading initializes.",
    );
  }

  validateEndpoints(config.endpoints);
}

/* ==========================================================================
   Normalization
   ========================================================================== */

function normalizeLocale(locale) {
  if (!isNonEmptyString(locale)) {
    return DEFAULTS.locale;
  }

  return locale.trim();
}

function normalizeConfig(rawConfig) {
  validateRawConfig(rawConfig);

  const config = mergeConfig(DEFAULTS, rawConfig);

  config.locale = normalizeLocale(config.locale);

  /*
   * Keep the dependency endpoint synchronized with the canonical
   * endpoint map unless the page explicitly overrides it.
   */
  if (!isNonEmptyString(rawConfig.dependencies?.sectorCompany?.endpoint)) {
    config.dependencies.sectorCompany.endpoint =
      config.endpoints.companiesBySector;
  }

  return deepFreeze(config);
}

/* ==========================================================================
   Cached Configuration
   ========================================================================== */

let cachedConfig = null;

/* ==========================================================================
   Public API
   ========================================================================== */

/**
 * Return the normalized immutable Trading configuration.
 *
 * Configuration is created once because the JSP contract is static for the
 * lifetime of the page.
 *
 * @returns {Readonly<object>}
 */
export function getTradingConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = normalizeConfig(window.TradingConfig);

  return cachedConfig;
}

/**
 * Return one configured endpoint by key.
 *
 * @param {string} key
 * @returns {string}
 */
export function getTradingEndpoint(key) {
  const config = getTradingConfig();

  if (typeof key !== "string" || !isNonEmptyString(config.endpoints?.[key])) {
    throw new Error(`Unknown Trading endpoint "${String(key)}".`);
  }

  return config.endpoints[key];
}

/**
 * Return merged DataTable configuration for one Trading view.
 *
 * Per-view options override shared table defaults.
 *
 * @param {string} view
 * @returns {Readonly<object>}
 */
export function getTradingTableConfig(view) {
  const config = getTradingConfig();

  const specific = isObject(config.tables?.[view]) ? config.tables[view] : {};

  return deepFreeze(mergeConfig(config.tableDefaults, specific));
}

/**
 * Return one localized label group.
 *
 * @param {string} key
 * @returns {Readonly<object>}
 */
export function getTradingLabels(key) {
  const config = getTradingConfig();

  if (!key) {
    return config.labels;
  }

  const labels = config.labels?.[key];

  return isObject(labels) ? labels : Object.freeze({});
}

/**
 * Return one filter configuration.
 *
 * @param {string} key
 * @returns {Readonly<object>}
 */
export function getTradingFilterConfig(key) {
  const config = getTradingConfig();

  const filter = config.filters?.[key];

  return isObject(filter) ? filter : Object.freeze({});
}
