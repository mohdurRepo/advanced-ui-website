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
 * - keep stable backend contracts separate from localized presentation labels
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
 *
 * Those responsibilities belong to:
 *
 * - trading.js
 * - filters.js
 * - dependencies.js
 * - formatters.js
 * - individual Trading views
 * - common/data-view
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

    /* ----------------------------------------------------------------------
       Negotiated Deals
       ---------------------------------------------------------------------- */

    negotiatedDeals: {
      type: "Negotiated-Deals",

      sector: "All",

      company: "All",

      /*
       * Empty means filters.js calculates the runtime business default:
       *
       * fromDate = exactly one calendar month before today
       * toDate   = today
       */

      fromDate: "",

      toDate: "",
    },

    /* ----------------------------------------------------------------------
       Accumulated Losses
       ---------------------------------------------------------------------- */

    accumulated: {
      report: "All",
    },

    /* ----------------------------------------------------------------------
       Suspended / Delisted Companies
       ---------------------------------------------------------------------- */

    deListedCompanies: {
      type: "Suspension",

      /*
       * Same runtime date default owned by filters.js:
       *
       * fromDate = exactly one calendar month before today
       * toDate   = today
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
     * Shared Trading business default:
     *
     * start = one calendar month before today
     * end   = today
     */

    defaultMode: "lastMonthToToday",

    /*
     * Native:
     *
     * <input type="date">
     */

    inputFormat: "yyyy-MM-dd",

    /*
     * Existing backend request contract.
     */

    requestFormat: "dd-MM-yyyy",
  },

  /* =========================================================================
     Dependencies
     ========================================================================= */

  dependencies: {
    sectorCompany: {
      /*
       * The endpoint is normally derived from:
       *
       * endpoints.companiesBySector
       *
       * during configuration normalization.
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

  /*
   * These are stable application/backend values.
   *
   * They must never be replaced by localized display labels.
   */

  filters: {
    /* ----------------------------------------------------------------------
       Negotiated Deals
       ---------------------------------------------------------------------- */

    negotiatedDeals: {
      defaults: {
        type: "Negotiated-Deals",

        sector: "All",

        company: "All",
      },

      /*
       * Clearing Company means All Companies.
       *
       * An empty Company value must never become a backend filter value.
       */

      companyClearValue: "All",
    },

    /* ----------------------------------------------------------------------
       Accumulated Losses
       ---------------------------------------------------------------------- */

    accumulated: {
      defaults: {
        report: "All",
      },
    },

    /* ----------------------------------------------------------------------
       Suspended / Delisted Companies
       ---------------------------------------------------------------------- */

    /*
     * Exact backend values:
     *
     * Suspended:
     *
     * - Suspension
     * - Suspension_Funds
     *
     * Delisted:
     *
     * - Delisting
     * - Delisting_Funds
     */

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
     * Trading owns loading state through common/data-view.
     *
     * Do not create a second DataTables processing overlay.
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
     * Horizontal overflow belongs to .table-responsive.
     *
     * DataTables must not create a competing:
     *
     * dt-scroll-head
     * dt-scroll-body
     *
     * hierarchy.
     */

    scrollX: false,

    scrollCollapse: false,

    /*
     * Conservative shared defaults.
     *
     * Individual views explicitly enable FixedHeader when their structure
     * supports it.
     */

    fixedHeader: false,

    /*
     * DataTables FixedColumns is disabled by default.
     *
     * Where we need a visually fixed identity column, the shared table-market
     * CSS owns that presentation unless a view explicitly proves that the
     * DataTables extension is required.
     */

    fixedColumns: 0,

    /*
     * Trading JSP/data-view owns:
     *
     * - result toolbar
     * - result count
     * - surrounding controls
     *
     * DataTables therefore renders no additional control regions.
     */

    layout: {
      topStart: null,

      topEnd: null,

      bottomStart: null,

      bottomEnd: null,
    },
  },

  /* =========================================================================
     Per-view Table Configuration
     ========================================================================= */

  tables: {
    /* ----------------------------------------------------------------------
       Negotiated Deals
       ---------------------------------------------------------------------- */

    /*
     * Final physical table:
     *
     * Date
     * Company
     * Price
     * Volume
     * Value
     * Time
     *
     * Company contains:
     *
     * [logo] Company Name
     *        Symbol
     */

    negotiatedDeals: {
      paging: true,

      pageLength: 25,

      ordering: false,

      searching: false,

      scrollX: false,

      scrollCollapse: false,

      /*
       * Standard six-column table.
       */

      fixedHeader: true,

      fixedColumns: 0,

      responsive: false,
    },

    /* ----------------------------------------------------------------------
       Minimum Size
       ---------------------------------------------------------------------- */

    /*
     * Minimum Size is a native matrix.
     *
     * It does not use the standard Trading DataTables FixedHeader or
     * FixedColumns behavior.
     *
     * Sticky presentation belongs to its native table classes.
     */

    minimumSize: {
      paging: false,

      ordering: false,

      searching: false,

      scrollX: false,

      scrollCollapse: false,

      fixedHeader: false,

      fixedColumns: 0,

      responsive: false,
    },

    /* ----------------------------------------------------------------------
       Accumulated Losses
       ---------------------------------------------------------------------- */

    /*
     * Final physical table:
     *
     * Company
     *
     * Identity:
     *
     * [logo] Company Name
     *        Symbol + loss-status indicator
     */

    accumulatedLosses: {
      paging: true,

      pageLength: 25,

      ordering: false,

      searching: false,

      scrollX: false,

      scrollCollapse: false,

      fixedHeader: true,

      fixedColumns: 0,

      responsive: false,
    },

    /* ----------------------------------------------------------------------
       Listed Tradable Rights
       ---------------------------------------------------------------------- */

    /*
     * Complex financial table.
     *
     * JSP owns the complete two-row grouped header.
     *
     * Physical leaf-column contract:
     *
     * 1  Tradable Rights
     *
     * Last Trade:
     * 2  Price
     * 3  Volume
     * 4  Change Value
     * 5  Change %
     *
     * Today's Trading:
     * 6  Open
     * 7  High
     * 8  Low
     *
     * Cumulative:
     * 9  Number of Trades
     * 10 Volume Traded
     *
     * Best Bid:
     * 11 Price
     * 12 Volume
     *
     * Best Offer:
     * 13 Price
     * 14 Volume
     *
     * Important:
     *
     * - JSP remains authoritative for <thead>
     * - outer .table-responsive owns horizontal overflow
     * - DataTables FixedHeader is enabled
     * - DataTables FixedColumns is NOT enabled
     * - shared table-market CSS owns the visual sticky identity column
     * - mobile uses cards rather than Responsive child rows
     */

    listedTradableRights: {
      paging: false,

      ordering: false,

      searching: false,

      scrollX: false,

      scrollCollapse: false,

      complexHeader: true,

      fixedHeader: true,

      fixedColumns: 0,

      responsive: false,
    },

    /* ----------------------------------------------------------------------
       Suspended Companies / Funds
       ---------------------------------------------------------------------- */

    /*
     * Final grouped desktop contract:
     *
     *              Period
     * Company      From      To       Reason
     *
     * Four physical tbody columns:
     *
     * 1 Company
     * 2 From
     * 3 To
     * 4 Reason
     *
     * Company contains:
     *
     * [logo] Company Name
     *        Symbol + optional status
     *
     * There is no separate Symbol column.
     */

    suspendedCompanies: {
      paging: false,

      ordering: false,

      searching: false,

      scrollX: false,

      scrollCollapse: false,

      complexHeader: true,

      fixedHeader: true,

      fixedColumns: 0,

      responsive: false,
    },

    /* ----------------------------------------------------------------------
       Delisted Companies / Funds
       ---------------------------------------------------------------------- */

    /*
     * Final desktop contract:
     *
     * Company | Date | Reason
     *
     * Three physical tbody columns:
     *
     * 1 Company
     * 2 Date
     * 3 Reason
     *
     * Company contains:
     *
     * [logo] Company Name
     *        Symbol + optional status
     */

    delistedCompanies: {
      paging: false,

      ordering: false,

      searching: false,

      scrollX: false,

      scrollCollapse: false,

      fixedHeader: true,

      fixedColumns: 0,

      responsive: false,
    },

    /* ----------------------------------------------------------------------
       OTC Trading
       ---------------------------------------------------------------------- */

    /*
     * OTC has not yet been finalized in the current tab-by-tab pass.
     *
     * Keep conservative common behavior here until its JSP and view module
     * are reviewed together.
     */

    otcTrading: {
      paging: false,

      ordering: false,

      searching: false,

      scrollX: false,

      scrollCollapse: false,

      fixedHeader: true,

      fixedColumns: 0,

      responsive: false,
    },
  },
  /* =========================================================================
     Labels
     ========================================================================= */

  /*
   * Only genuinely generic fallback text belongs in config.js.
   *
   * Business/page labels should normally be supplied by the JSP through
   * localized <fmt:message> values.
   *
   * Empty objects below establish the expected configuration shape without
   * inventing English business labels in JavaScript.
   */

  labels: {
    /* ----------------------------------------------------------------------
       Shared Data States
       ---------------------------------------------------------------------- */

    loading: "Loading…",

    noData: "No data available",

    loadError: "Unable to load data.",

    results: "Results",

    total: "Total",

    reset: "Reset",

    /* ----------------------------------------------------------------------
       Shared Action Labels
       ---------------------------------------------------------------------- */

    suspendedLink: "",

    delistedLink: "",

    /* ----------------------------------------------------------------------
       Common Controls
       ---------------------------------------------------------------------- */

    controls: {
      search: "Search",

      searchPlaceholder: "Search",

      all: "All",
    },

    /* ----------------------------------------------------------------------
       Mobile
       ---------------------------------------------------------------------- */

    mobile: {
      showDetails: "Show details",

      hideDetails: "Hide details",

      daily: "Daily",

      total: "Total",
    },

    /* ----------------------------------------------------------------------
       Tabs
       ---------------------------------------------------------------------- */

    tabs: {},

    /* ----------------------------------------------------------------------
       Negotiated Deals
       ---------------------------------------------------------------------- */

    /*
     * Expected JSP shape:
     *
     * {
     *   date,
     *   company,
     *   price,
     *   volume,
     *   value,
     *   time
     * }
     */

    negotiatedDeals: {},

    /* ----------------------------------------------------------------------
       Minimum Size
       ---------------------------------------------------------------------- */

    /*
     * Expected JSP shape:
     *
     * {
     *   columns: [
     *     {
     *       key,
     *       levels: [...]
     *     }
     *   ],
     *
     *   rows: [...]
     * }
     */

    minimumSize: {},

    /* ----------------------------------------------------------------------
       Accumulated Losses
       ---------------------------------------------------------------------- */

    /*
     * Expected JSP shape:
     *
     * {
     *   company,
     *   loss50More,
     *   loss35To50,
     *   loss20To35
     * }
     *
     * Symbol is supporting Company identity metadata.
     *
     * There is no standalone Symbol column label.
     */

    accumulated: {},

    /* ----------------------------------------------------------------------
       Listed Tradable Rights
       ---------------------------------------------------------------------- */

    /*
     * IMPORTANT:
     *
     * Final canonical key:
     *
     * labels.listedTradableRights
     *
     * Do not use the old:
     *
     * labels.listedTradable
     *
     * Expected JSP shape includes both grouped labels and leaf labels:
     *
     * {
     *   tradableRight,
     *
     *   lastTrade,
     *   todaysTrading,
     *   cumulative,
     *   bestBid,
     *   bestOffer,
     *
     *   price,
     *   volume,
     *   changeValue,
     *   changePercent,
     *   open,
     *   high,
     *   low,
     *   numberOfTrades,
     *   volumeTraded,
     *   bidPrice,
     *   bidVolume,
     *   askPrice,
     *   askVolume
     * }
     */

    listedTradableRights: {},

    /* ----------------------------------------------------------------------
       Company Status
       ---------------------------------------------------------------------- */

    /*
     * Localized presentation labels for the Type control.
     *
     * IMPORTANT:
     *
     * These are labels only.
     *
     * Backend identifiers remain under:
     *
     * filters.deListedCompanies
     *
     * and remain exactly:
     *
     * Suspension
     * Suspension_Funds
     * Delisting
     * Delisting_Funds
     */

    companyStatus: {
      type: {
        label: "",

        suspension: "",

        suspensionFunds: "",

        delisting: "",

        delistingFunds: "",
      },
    },

    /* ----------------------------------------------------------------------
       Suspended Companies / Funds
       ---------------------------------------------------------------------- */

    /*
     * Expected JSP shape:
     *
     * {
     *   company,
     *   period,
     *   fromDate,
     *   toDate,
     *   reason
     * }
     *
     * Symbol is supporting Company identity metadata.
     */

    suspended: {},

    /* ----------------------------------------------------------------------
       Delisted Companies / Funds
       ---------------------------------------------------------------------- */

    /*
     * Expected JSP shape:
     *
     * {
     *   company,
     *   date,
     *   reason
     * }
     *
     * Symbol is supporting Company identity metadata.
     */

    delisted: {},

    /* ----------------------------------------------------------------------
       OTC Trading
       ---------------------------------------------------------------------- */

    /*
     * OTC remains unchanged until its tab is reviewed.
     */

    otc: {},
  },
});

/* ==========================================================================
   Required Endpoints
   ========================================================================== */

/*
 * Every Trading page currently initializes all view modules.
 *
 * Therefore all endpoints below are required before Trading can initialize.
 */

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
   Generic Helpers
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

/*
 * Configuration must be copied before normalization because:
 *
 * - DEFAULTS is immutable
 * - window.TradingConfig remains the JSP-owned raw configuration
 * - normalization should not mutate either source
 */

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
 * Deep-merge configuration objects.
 *
 * Arrays are replaced rather than concatenated because configuration arrays
 * represent complete contracts.
 *
 * Examples:
 *
 * - suspendedTypes
 * - delistedTypes
 * - Minimum Size matrix labels
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
   Endpoint Validation
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

/* ==========================================================================
   Raw Configuration Validation
   ========================================================================== */

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
   Table Configuration Normalization
   ========================================================================== */

/*
 * Keep DataTables extension configuration declarative.
 *
 * Supported FixedColumns configuration in this application:
 *
 * 0
 *
 * or:
 *
 * {
 *   start: 1
 * }
 *
 * false is normalized to 0 so all downstream consumers see one consistent
 * disabled representation.
 */

function normalizeTableConfig(table) {
  if (!isObject(table)) {
    return;
  }

  if (table.fixedColumns === false) {
    table.fixedColumns = 0;
  }

  if (table.fixedHeader === undefined) {
    table.fixedHeader = false;
  }

  if (table.scrollX === undefined) {
    table.scrollX = false;
  }

  if (table.scrollCollapse === undefined) {
    table.scrollCollapse = false;
  }
}

/* ==========================================================================
   Normalization
   ========================================================================== */

function normalizeConfig(rawConfig) {
  validateRawConfig(rawConfig);

  const config = mergeConfig(DEFAULTS, rawConfig);

  /* ------------------------------------------------------------------------
     Locale
     ------------------------------------------------------------------------ */

  config.locale = normalizeLocale(config.locale);

  /* ------------------------------------------------------------------------
     Company Dependency Endpoint
     ------------------------------------------------------------------------ */

  /*
   * Keep one canonical Company endpoint.
   *
   * JSP does not need to duplicate the same resource URL under:
   *
   * endpoints.companiesBySector
   *
   * and:
   *
   * dependencies.sectorCompany.endpoint
   */

  if (!isNonEmptyString(rawConfig.dependencies?.sectorCompany?.endpoint)) {
    config.dependencies.sectorCompany.endpoint =
      config.endpoints.companiesBySector;
  }

  /* ------------------------------------------------------------------------
     Company Clear Value
     ------------------------------------------------------------------------ */

  /*
   * Company clear/reset must always resolve to a valid backend value.
   */

  if (!isNonEmptyString(config.filters?.negotiatedDeals?.companyClearValue)) {
    config.filters.negotiatedDeals.companyClearValue =
      config.filters?.negotiatedDeals?.defaults?.company || "All";
  }

  /* ------------------------------------------------------------------------
     Table Contracts
     ------------------------------------------------------------------------ */

  Object.values(config.tables || {}).forEach(normalizeTableConfig);

  return deepFreeze(config);
}

/* ==========================================================================
   Cached Configuration
   ========================================================================== */

/*
 * Trading configuration is normalized once per page lifecycle.
 *
 * Every consumer receives the same frozen object.
 */

let cachedConfig = null;

/* ==========================================================================
   Public Configuration
   ========================================================================== */

/**
 * Return normalized immutable Trading configuration.
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
   Endpoint Access
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
 * Return merged table configuration for one Trading view.
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
 * Examples:
 *
 * getTradingLabels("negotiatedDeals")
 * getTradingLabels("minimumSize")
 * getTradingLabels("accumulated")
 * getTradingLabels("listedTradableRights")
 * getTradingLabels("companyStatus")
 * getTradingLabels("suspended")
 * getTradingLabels("delisted")
 *
 * Calling without a key returns the complete label contract.
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
   Filter Configuration
   ========================================================================== */

/**
 * Return one Trading filter configuration.
 *
 * Examples:
 *
 * getTradingFilterConfig("negotiatedDeals")
 * getTradingFilterConfig("accumulated")
 * getTradingFilterConfig("deListedCompanies")
 *
 * @param {string} key
 * @returns {Readonly<object>}
 */

export function getTradingFilterConfig(key) {
  const config = getTradingConfig();

  const filter = config.filters?.[key];

  return isObject(filter) ? filter : Object.freeze({});
}
