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
     * Do not enable DataTables' separate processing overlay.
     */

    processing: false,

    deferRender: true,

    /*
     * Trading tables already live inside:
     *
     * .table-shell
     *   -> .table-responsive
     *      -> .table
     *
     * Horizontal overflow remains owned by .table-responsive.
     *
     * DataTables must not create a second dt-scroll-head / dt-scroll-body
     * hierarchy.
     */

    scrollX: false,

    scrollCollapse: false,

    /*
     * Conservative shared defaults.
     *
     * Each view explicitly opts into FixedHeader / FixedColumns where its
     * structure supports them.
     */

    fixedHeader: false,

    fixedColumns: 0,

    /*
     * JSP/data-view owns toolbar and result presentation.
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
    /* ------------------------------------------------------------------------
       Negotiated Deals
       ------------------------------------------------------------------------ */

    negotiatedDeals: {
      paging: true,

      pageLength: 25,

      ordering: false,

      searching: false,

      /*
       * Standard six-column table.
       *
       * DataTables owns FixedHeader.
       *
       * No fixed body column is required.
       */

      fixedHeader: true,

      fixedColumns: 0,
    },

    /* ------------------------------------------------------------------------
       Minimum Size
       ------------------------------------------------------------------------ */

    /*
     * Minimum Size is not initialized through the normal DataTable adapter.
     *
     * It uses:
     *
     * .table-market--minimum-size
     * .table-market--native-sticky
     *
     * for its JSP-owned three-row matrix header.
     */

    minimumSize: {
      paging: false,

      ordering: false,

      searching: false,

      fixedHeader: false,

      fixedColumns: 0,
    },

    /* ------------------------------------------------------------------------
       Accumulated Losses
       ------------------------------------------------------------------------ */

    accumulatedLosses: {
      paging: true,

      pageLength: 25,

      ordering: false,

      searching: false,

      fixedHeader: true,

      fixedColumns: 0,
    },

    /* ------------------------------------------------------------------------
       Listed Tradable Rights
       ------------------------------------------------------------------------ */

    listedTradableRights: {
      paging: false,

      ordering: false,

      searching: false,

      /*
       * JSP remains authoritative for the grouped header.
       */

      complexHeader: true,

      /*
       * This is the genuinely long Trading dataset.
       *
       * FixedHeader stays active while only the first logical identity column
       * remains fixed horizontally.
       */

      fixedHeader: true,

      fixedColumns: {
        start: 1,
      },
    },

    /* ------------------------------------------------------------------------
       Suspended Companies
       ------------------------------------------------------------------------ */

    suspendedCompanies: {
      paging: false,

      ordering: false,

      searching: false,

      /*
       * JSP owns:
       *
       * Symbol | Company | Period        | Reason
       *                  | From | To
       */

      complexHeader: true,

      fixedHeader: true,

      fixedColumns: 0,
    },

    /* ------------------------------------------------------------------------
       Delisted Companies
       ------------------------------------------------------------------------ */

    delistedCompanies: {
      paging: false,

      ordering: false,

      searching: false,

      fixedHeader: true,

      fixedColumns: 0,
    },

    /* ------------------------------------------------------------------------
       OTC Trading
       ------------------------------------------------------------------------ */

    otcTrading: {
      paging: false,

      ordering: false,

      searching: false,

      fixedHeader: true,

      fixedColumns: 0,
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

/* ==========================================================================
   Clone
   ========================================================================== */

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

/* ==========================================================================
   Deep Freeze
   ========================================================================== */

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);

  return Object.freeze(value);
}

/* ==========================================================================
   Deep Merge
   ========================================================================== */

/**
 * Deep merge configuration objects.
 *
 * Arrays are replaced rather than concatenated because configuration arrays
 * represent complete contracts.
 *
 * @param {*} base
 * @param {*} override
 * @returns {*}
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
   * Company clear/reset must always resolve to a valid backend value.
   */

  if (!isNonEmptyString(config.filters?.negotiatedDeals?.companyClearValue)) {
    config.filters.negotiatedDeals.companyClearValue =
      config.filters?.negotiatedDeals?.defaults?.company || "All";
  }

  /*
   * Normalize FixedColumns contract.
   *
   * DataTables accepts:
   *
   * 0
   *
   * or:
   *
   * {
   *   start: 1
   * }
   *
   * Keep configuration declarative and avoid accidental boolean values.
   */

  Object.values(config.tables || {}).forEach((table) => {
    if (!isObject(table)) {
      return;
    }

    if (table.fixedColumns === false) {
      table.fixedColumns = 0;
    }

    if (table.fixedHeader === undefined) {
      table.fixedHeader = false;
    }
  });

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
 * Minimum Size may still call this helper for presentation metadata even
 * though it does not create a DataTables instance.
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
