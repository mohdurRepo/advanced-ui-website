/* ==========================================================================
   Trading Configuration
   ========================================================================== */

/*
 * Normalize and expose the JSP-provided window.TradingConfig.
 *
 * Responsibilities:
 *
 * - validate the page configuration
 * - apply safe application defaults
 * - normalize Trading configuration once
 * - expose immutable configuration
 * - provide per-view table configuration
 *
 * This file intentionally has no:
 *
 * - DOM queries
 * - AJAX
 * - request payload construction
 * - DataTables initialization
 * - filtering
 * - rendering
 * - tab behavior
 */

/* ==========================================================================
   Defaults
   ========================================================================== */

const DEFAULTS = Object.freeze({
  locale: "en",

  /* =========================================================================
     Initial State
     ========================================================================= */

  initialState: {
    activeTab: "negotiatedDeals",

    negotiatedDeals: {
      type: "Negotiated-Deals",
      sector: "All",
      company: "All",

      /*
       * Empty means filters.js calculates:
       *
       * fromDate = one calendar month ago
       * toDate   = today
       */
      fromDate: "",
      toDate: "",
    },

    accumulated: {
      report: "All",
    },

    deListedCompanies: {
      type: "Suspension",

      /*
       * Same calculated one-month default from filters.js.
       */
      fromDate: "",
      toDate: "",
    },
  },

  /* =========================================================================
     Date Contract
     ========================================================================= */

  dateRange: {
    /*
     * Trading business default:
     *
     * start = one calendar month before today
     * end   = today
     */
    defaultMode: "lastMonthToToday",

    /*
     * Native <input type="date">.
     */
    inputFormat: "yyyy-MM-dd",

    /*
     * Existing Trading backend contract.
     */
    requestFormat: "dd-MM-yyyy",
  },

  /* =========================================================================
     Dependencies
     ========================================================================= */

  dependencies: {
    sectorCompany: {
      /*
       * Actual endpoint is derived from endpoints.companiesBySector when not
       * explicitly provided by the JSP.
       */
      endpoint: "",

      defaultValue: "All",

      request: {
        sectorParameter: "sector",
      },

      response: {
        value: "symbol",
        label: "longName",
      },
    },
  },

  /* =========================================================================
     Filter Contracts
     ========================================================================= */

  filters: {
    negotiatedDeals: {
      defaults: {
        type: "Negotiated-Deals",
        sector: "All",
        company: "All",
      },

      /*
       * Clearing Company must mean "All Companies", never an empty backend
       * value.
       */
      companyClearValue: "All",
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

  /* =========================================================================
     Shared Table Defaults
     ========================================================================= */

  tableDefaults: {
    autoWidth: false,

    searching: false,
    ordering: false,
    info: false,
    lengthChange: false,

    serverSide: false,

    /*
     * Trading owns its loading lifecycle through common data-view.
     *
     * Do not enable DataTables' separate Processing overlay.
     */
    processing: false,

    deferRender: true,

    /*
     * IMPORTANT:
     *
     * Trading tables already live inside the design-system:
     *
     * .table-shell
     *   -> .table-responsive
     *      -> .table
     *
     * Therefore DataTables must NOT create an additional dt-scroll-head /
     * dt-scroll-body hierarchy.
     *
     * Horizontal overflow remains owned by .table-responsive.
     *
     * This is particularly important for:
     *
     * - grouped <thead>s
     * - Suspended Period headers
     * - Listed Tradable grouped headers
     * - first-column alignment
     * - RTL
     */
    scrollX: false,
    scrollCollapse: false,

    /*
     * Keep cloning/fixed-column extensions disabled while Trading uses hidden
     * tabs and grouped headers.
     */
    fixedHeader: false,
    fixedColumns: 0,

    /*
     * Trading JSP/data-view owns its own toolbar/results presentation.
     */
    layout: {
      topStart: null,
      topEnd: null,
      bottomStart: null,
      bottomEnd: null,
    },
  },

  /* =========================================================================
     Per-view Tables
     ========================================================================= */

  tables: {
    negotiatedDeals: {
      paging: true,
      pageLength: 25,

      ordering: false,
      searching: false,
    },

    /*
     * Minimum Size is not initialized through the normal DataTable adapter.
     */
    minimumSize: {
      paging: false,
      ordering: false,
      searching: false,
    },

    accumulatedLosses: {
      paging: true,
      pageLength: 25,

      ordering: false,
      searching: false,
    },

    listedTradableRights: {
      paging: false,

      ordering: false,
      searching: false,

      /*
       * Metadata only. The JSP remains authoritative for its grouped header.
       */
      complexHeader: true,
    },

    suspendedCompanies: {
      paging: false,

      ordering: false,
      searching: false,

      complexHeader: true,
    },

    delistedCompanies: {
      paging: false,

      ordering: false,
      searching: false,
    },

    otcTrading: {
      paging: false,

      ordering: false,
      searching: false,
    },
  },

  /* =========================================================================
     Labels
     ========================================================================= */

  /*
   * Only genuinely generic fallbacks live here.
   *
   * Page/business labels must come from JSP localization rather than being
   * invented in JavaScript.
   */
  labels: {
    loading: "Loading…",
    noData: "No data available",
    loadError: "Unable to load data.",
    results: "Results",
    total: "Total",

    controls: {
      all: "All",
    },

    mobile: {
      showDetails: "Show details",
      hideDetails: "Hide details",
    },

    tabs: {},

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
 * Deep merge configuration objects.
 *
 * Arrays are replaced rather than concatenated because configuration arrays
 * represent complete contracts.
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
   Validation
   ========================================================================== */

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

function validateRawConfig(config) {
  if (!isObject(config)) {
    throw new Error(
      "window.TradingConfig must be defined before Trading initializes.",
    );
  }

  validateEndpoints(config.endpoints);
}

/* ==========================================================================
   Locale
   ========================================================================== */

function normalizeLocale(locale) {
  if (!isNonEmptyString(locale)) {
    return DEFAULTS.locale;
  }

  return locale.trim();
}

/* ==========================================================================
   Normalization
   ========================================================================== */

function normalizeConfig(rawConfig) {
  validateRawConfig(rawConfig);

  const config = mergeConfig(DEFAULTS, rawConfig);

  config.locale = normalizeLocale(config.locale);

  /*
   * Keep one canonical Company endpoint.
   *
   * JSP does not need to duplicate the same resourceURL in both:
   *
   * endpoints.companiesBySector
   * dependencies.sectorCompany.endpoint
   */
  if (!isNonEmptyString(rawConfig.dependencies?.sectorCompany?.endpoint)) {
    config.dependencies.sectorCompany.endpoint =
      config.endpoints.companiesBySector;
  }

  /*
   * The Company business default must always be usable.
   */
  if (!isNonEmptyString(config.filters?.negotiatedDeals?.companyClearValue)) {
    config.filters.negotiatedDeals.companyClearValue =
      config.filters?.negotiatedDeals?.defaults?.company || "All";
  }

  return deepFreeze(config);
}

/* ==========================================================================
   Cached Configuration
   ========================================================================== */

let cachedConfig = null;

/* ==========================================================================
   Public Configuration
   ========================================================================== */

/**
 * Return the normalized immutable Trading configuration.
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

/* ==========================================================================
   Endpoints
   ========================================================================== */

/**
 * Return one configured Trading endpoint.
 *
 * @param {string} key
 * @returns {string}
 */
export function getTradingEndpoint(key) {
  const config = getTradingConfig();

  const endpoint = config.endpoints?.[key];

  if (!isNonEmptyString(endpoint)) {
    throw new Error(`Unknown Trading endpoint "${String(key)}".`);
  }

  return endpoint;
}

/* ==========================================================================
   Table Configuration
   ========================================================================== */

/**
 * Return merged DataTables configuration for one Trading view.
 *
 * @param {string} view
 * @returns {Readonly<object>}
 */
export function getTradingTableConfig(view) {
  const config = getTradingConfig();

  const specific = isObject(config.tables?.[view]) ? config.tables[view] : {};

  return deepFreeze(mergeConfig(config.tableDefaults, specific));
}

/* ==========================================================================
   Labels
   ========================================================================== */

/**
 * Return one Trading label group.
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

/* ==========================================================================
   Filters
   ========================================================================== */

/**
 * Return one Trading filter configuration.
 *
 * @param {string} key
 * @returns {Readonly<object>}
 */
export function getTradingFilterConfig(key) {
  const config = getTradingConfig();

  const filter = config.filters?.[key];

  return isObject(filter) ? filter : Object.freeze({});
}
