/* ==========================================================================
   Trading Schema
   ========================================================================== */

/*
 * Single source of truth for Trading presentation contracts.
 *
 * Responsibilities:
 *
 * - Trading tab/view identifiers
 * - table presentation modes
 * - stable column definitions
 * - stable column widths
 * - authoritative-header metadata
 * - mobile summary/detail metadata
 * - Minimum Size matrix metadata
 * - variant resolution
 *
 * This module intentionally has no:
 *
 * - DOM manipulation
 * - DataTables lifecycle
 * - AJAX
 * - event listeners
 * - filter state
 * - value formatting
 * - card markup
 *
 * Important:
 *
 * Standard views may use ordinary DataTables column handling.
 *
 * Complex-header and matrix views MUST preserve the <thead> already rendered
 * by the JSP. The page JavaScript must never rebuild those headers.
 */

/* ==========================================================================
   Views
   ========================================================================== */

export const TRADING_VIEWS = Object.freeze({
  negotiatedDeals: "negotiatedDeals",

  minimumSize: "minimumSize",

  accumulatedLosses: "accumulatedLosses",

  listedTradableRights: "listedTradableRights",

  suspendedCompanies: "suspendedCompanies",

  delistedCompanies: "delistedCompanies",

  otcTrading: "otcTrading",
});

/* ==========================================================================
   Tabs
   ========================================================================== */

export const TRADING_TABS = Object.freeze({
  negotiatedDeals: "negotiatedDeals",

  accumulated: "accumulated",

  listedTradable: "listedTradable",

  deListedCompanies: "deListedCompanies",

  otcTrading: "otcTrading",
});

/* ==========================================================================
   Table Modes
   ========================================================================== */

/*
 * STANDARD
 *
 * Normal one-row <thead>.
 *
 * COMPLEX
 *
 * Multi-row / grouped <thead> rendered by JSP and preserved exactly.
 *
 * MATRIX
 *
 * Specialized multi-row matrix structure. JSP owns the complete heading
 * structure and Trading uses a dedicated renderer/lifecycle.
 */

export const TRADING_TABLE_MODES = Object.freeze({
  standard: "standard",

  complex: "complex",

  matrix: "matrix",
});

/* ==========================================================================
   Tab -> View Mapping
   ========================================================================== */

const TAB_VIEW_MAP = Object.freeze({
  [TRADING_TABS.negotiatedDeals]: [
    TRADING_VIEWS.negotiatedDeals,
    TRADING_VIEWS.minimumSize,
  ],

  [TRADING_TABS.accumulated]: [TRADING_VIEWS.accumulatedLosses],

  [TRADING_TABS.listedTradable]: [TRADING_VIEWS.listedTradableRights],

  [TRADING_TABS.deListedCompanies]: [
    TRADING_VIEWS.suspendedCompanies,
    TRADING_VIEWS.delistedCompanies,
  ],

  [TRADING_TABS.otcTrading]: [TRADING_VIEWS.otcTrading],
});

/* ==========================================================================
   Stable Column Widths
   ========================================================================== */

/*
 * Trading previously allowed hidden DataTables instances to independently
 * calculate their widths.
 *
 * That caused:
 *
 * - Symbol width changing after filter reload
 * - Company appearing detached from Symbol
 * - grouped headings not lining up with body columns
 *
 * Widths now use percentage-oriented contracts where practical so each
 * complete table remains internally stable.
 */

const WIDTHS = Object.freeze({
  /* ------------------------------------------------------------------------
     Identity
     ------------------------------------------------------------------------ */

  symbol: "10%",

  company: "24%",

  combinedCompany: "28%",

  security: "22%",

  /* ------------------------------------------------------------------------
     Dates / Time
     ------------------------------------------------------------------------ */

  date: "12%",

  shortDate: "11%",

  time: "10%",

  /* ------------------------------------------------------------------------
     Numeric
     ------------------------------------------------------------------------ */

  price: "12%",

  quantity: "14%",

  value: "16%",

  /* ------------------------------------------------------------------------
     Supporting
     ------------------------------------------------------------------------ */

  reason: "30%",

  matrixLabel: "20%",

  matrixValue: "20%",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function cleanLabel(value, fallback = "") {
  return String(value ?? fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createColumn(definition = {}) {
  return Object.freeze({
    key: "",

    label: "",

    data: null,

    type: "text",

    width: null,

    className: "",

    numeric: false,

    orderable: false,

    searchable: false,

    /*
     * `mobile` controls whether the column belongs in expandable
     * mobile details.
     *
     * Identity/summary fields are usually false because they are already
     * rendered in the card header.
     */
    mobile: true,

    ...definition,
  });
}

function createViewSchema(definition = {}) {
  return Object.freeze({
    mode: TRADING_TABLE_MODES.standard,

    preserveHeader: false,

    columns: [],

    mobile: {},

    ...definition,
  });
}

/* ==========================================================================
   Negotiated Deals
   ========================================================================== */

function createNegotiatedDealsSchema(config = {}) {
  const labels = config.labels?.negotiatedDeals || {};

  const columns = [
    /* ----------------------------------------------------------------------
       Date
       ---------------------------------------------------------------------- */

    createColumn({
      key: "date",

      label: cleanLabel(labels.date, "Date"),

      data: "strDate",

      type: "negotiated-date",

      width: WIDTHS.date,

      className: "table-market__date",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Company Identity
       ---------------------------------------------------------------------- */

    /*
     * Final desktop structure:
     *
     * Company Name
     * Symbol
     *
     * Symbol is supporting identity metadata, not a separate Negotiated
     * desktop column.
     */

    createColumn({
      key: "company",

      label: cleanLabel(labels.company, "Company"),

      data: "company",

      symbolData: "symbol",

      urlData: "companyURL",

      type: "negotiated-company",

      width: WIDTHS.combinedCompany,

      className: "table-market__company table-market__identity",

      searchable: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Price
       ---------------------------------------------------------------------- */

    createColumn({
      key: "trade-price",

      label: cleanLabel(labels.price, "Price"),

      data: "tradePrice",

      type: "money",

      width: WIDTHS.price,

      className: "table-market__number table-market__price",

      numeric: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Volume
       ---------------------------------------------------------------------- */

    createColumn({
      key: "trade-volume",

      label: cleanLabel(labels.volume, "Volume"),

      data: "tradeVolume",

      type: "quantity",

      width: WIDTHS.quantity,

      className: "table-market__number",

      numeric: true,

      mobile: true,
    }),

    /* ----------------------------------------------------------------------
       Value
       ---------------------------------------------------------------------- */

    createColumn({
      key: "turnover",

      label: cleanLabel(labels.value, "Value"),

      data: "turnOver",

      type: "money",

      width: WIDTHS.value,

      className: "table-market__number",

      numeric: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Time
       ---------------------------------------------------------------------- */

    createColumn({
      key: "time",

      label: cleanLabel(labels.time, "Time"),

      data: "strTime",

      type: "time",

      width: WIDTHS.time,

      className: "table-market__number",

      mobile: true,
    }),
  ];

  return createViewSchema({
    mode: TRADING_TABLE_MODES.standard,

    /*
     * Negotiated JSP has a simple authoritative one-row header.
     *
     * We still preserve it instead of replacing it because the JSP now owns
     * localized headings and stable data-column-key hooks.
     */
    preserveHeader: true,

    columns,

    identity: {
      codeData: "symbol",

      nameData: "company",

      urlData: "companyURL",
    },

    mobile: {
      grouped: true,

      groupBy: "strDate",

      dailyTotal: true,

      summary: ["trade-price", "turnover"],

      details: ["trade-volume", "time"],
    },

    totals: {
      enabled: true,

      rowTypeData: "rowType",

      rowTypeValue: "total",

      /*
       * Keep six physical cells in the table.
       *
       * Do not mutate a DataTables <tr> into an incompatible colspan row.
       */
      columns: {
        date: null,

        company: "label",

        "trade-price": null,

        "trade-volume": "volume",

        turnover: "value",

        time: null,
      },
    },
  });
}

/* ==========================================================================
   Minimum Size Matrix
   ========================================================================== */

function createMinimumSizeSchema(config = {}) {
  const labels = config.labels?.minimumSize || {};

  /*
   * Minimum Size is NOT a normal five-business-column table.
   *
   * Backend payload:
   *
   *   col1
   *   col2
   *   col3
   *   col4
   *
   * Visual matrix:
   *
   *   leading matrix position
   *   + four value positions
   *
   * The JSP owns all three matrix heading rows.
   *
   * We keep the leading visual position explicitly in the matrix metadata,
   * but it is not treated as a normal backend field.
   */

  const valueColumns = [
    createColumn({
      key: "col1",

      label: cleanLabel(labels.col1, ""),

      data: "col1",

      type: "security-reference",

      width: WIDTHS.matrixValue,

      searchable: true,

      mobile: true,
    }),

    createColumn({
      key: "col2",

      label: cleanLabel(labels.col2, ""),

      data: "col2",

      type: "security-reference",

      width: WIDTHS.matrixValue,

      searchable: true,

      mobile: true,
    }),

    createColumn({
      key: "col3",

      label: cleanLabel(labels.col3, ""),

      data: "col3",

      type: "security-reference",

      width: WIDTHS.matrixValue,

      searchable: true,

      mobile: true,
    }),

    createColumn({
      key: "col4",

      label: cleanLabel(labels.col4, ""),

      data: "col4",

      type: "security-reference",

      width: WIDTHS.matrixValue,

      searchable: true,

      mobile: true,
    }),
  ];

  return createViewSchema({
    mode: TRADING_TABLE_MODES.matrix,

    /*
     * Critical:
     *
     * Do not allow createDataTable() or Trading JS to regenerate the
     * three-row matrix <thead>.
     */
    preserveHeader: true,

    /*
     * These are the actual API-backed values.
     *
     * There is deliberately NO fake `minimum-size-label` business column.
     */
    columns: valueColumns,

    matrix: {
      headerRows: 3,

      visualColumnCount: 5,

      valueColumnCount: 4,

      /*
       * The first visual position belongs to the matrix structure rendered
       * by JSP. It is not response data.
       */
      leadingColumn: {
        key: "matrix-label",

        width: WIDTHS.matrixLabel,

        data: null,
      },

      valueKeys: ["col1", "col2", "col3", "col4"],

      /*
       * This tells trading.js to use the dedicated matrix renderer rather
       * than ordinary createDataTable() column/header generation.
       */
      dedicatedRenderer: true,
    },

    mobile: {
      grouped: false,

      /*
       * Minimum Size mobile content must be rendered from all four actual
       * matrix values instead of creating a card with an empty summary.
       */
      fields: ["col1", "col2", "col3", "col4"],

      dedicatedRenderer: true,
    },

    search: {
      enabled: true,

      keys: ["col1", "col2", "col3", "col4"],
    },
  });
}

/* ==========================================================================
   Accumulated Losses
   ========================================================================== */

function createAccumulatedLossesSchema(config = {}) {
  const labels = config.labels?.accumulated || {};

  const columns = [
    /* ----------------------------------------------------------------------
       Symbol + Status
       ---------------------------------------------------------------------- */

    createColumn({
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "symbol",

      statusData: "companyStatus",

      /*
       * Status belongs beside the Symbol consistently in desktop/mobile.
       */
      type: "symbol-status",

      width: WIDTHS.symbol,

      className: "table-market__symbol table-market__identity-symbol",

      searchable: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    createColumn({
      key: "company",

      label: cleanLabel(labels.company, "Company Name"),

      data: "company",

      urlData: "companyURL",

      type: "company-link",

      width: WIDTHS.company,

      className: "table-market__company table-market__identity-company",

      searchable: true,

      mobile: false,
    }),
  ];

  return createViewSchema({
    mode: TRADING_TABLE_MODES.standard,

    preserveHeader: true,

    columns,

    identity: {
      codeData: "symbol",

      nameData: "company",

      urlData: "companyURL",

      statusData: "companyStatus",

      /*
       * Explicitly standardize:
       *
       * Symbol ● | Company
       */
      statusPlacement: "symbol",
    },

    mobile: {
      grouped: false,

      /*
       * Accumulated only contains identity/status information.
       *
       * It should render as a compact card with NO meaningless expandable
       * details button.
       */
      compact: true,

      expandable: false,

      summary: [],
      details: [],
    },
  });
}

/* ==========================================================================
   Listed Tradable Rights
   ========================================================================== */

function createListedTradableRightsSchema(config = {}) {
  const labels = config.labels?.listedTradable || {};

  const columns = [
    /* ----------------------------------------------------------------------
       Security
       ---------------------------------------------------------------------- */

    createColumn({
      key: "tradable-right",

      label: cleanLabel(labels.security, "Tradable Rights"),

      data: "acrynomName",

      urlData: "pageUrl",

      type: "security-link",

      width: WIDTHS.security,

      className: "table-market__security table-market__identity",

      searchable: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Last Trade
       ---------------------------------------------------------------------- */

    createColumn({
      key: "last-trade-price",

      label: cleanLabel(labels.lastTradePrice, "Price"),

      data: "lastTradePriceModified",

      type: "display-value",

      width: WIDTHS.price,

      className: "table-market__number",

      numeric: true,

      headerGroup: "last-trade",

      mobile: false,
    }),

    createColumn({
      key: "last-trade-volume",

      label: cleanLabel(labels.lastTradeVolume, "Volume"),

      data: "lastTradeQuantity",

      type: "quantity",

      width: WIDTHS.quantity,

      className: "table-market__number",

      numeric: true,

      headerGroup: "last-trade",

      mobile: true,
    }),

    createColumn({
      key: "change-value",

      label: cleanLabel(labels.changeValue, "Change Value"),

      data: "netChangeModified",

      numericData: "netChangeDoubleModified",

      type: "price-change",

      width: WIDTHS.price,

      className: "table-market__number",

      numeric: true,

      headerGroup: "last-trade",

      mobile: true,
    }),

    createColumn({
      key: "change-percent",

      label: cleanLabel(labels.changePercent, "Change %"),

      data: "percentChangeModified",

      numericData: "percentChangeDoubleModified",

      type: "price-change",

      width: WIDTHS.price,

      className: "table-market__number",

      numeric: true,

      headerGroup: "last-trade",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Today's Trading
       ---------------------------------------------------------------------- */

    createColumn({
      key: "open",

      label: cleanLabel(labels.open, "Open"),

      data: "todayOpenModified",

      type: "display-value",

      width: WIDTHS.price,

      className: "table-market__number",

      numeric: true,

      headerGroup: "today",

      mobile: true,
    }),

    createColumn({
      key: "high",

      label: cleanLabel(labels.high, "High"),

      data: "highPriceModified",

      type: "display-value",

      width: WIDTHS.price,

      className: "table-market__number",

      numeric: true,

      headerGroup: "today",

      mobile: true,
    }),

    createColumn({
      key: "low",

      label: cleanLabel(labels.low, "Low"),

      data: "lowPriceModified",

      type: "display-value",

      width: WIDTHS.price,

      className: "table-market__number",

      numeric: true,

      headerGroup: "today",

      mobile: true,
    }),

    /* ----------------------------------------------------------------------
       Cumulative
       ---------------------------------------------------------------------- */

    createColumn({
      key: "number-of-trades",

      label: cleanLabel(labels.numberOfTrades, "Number of Trades"),

      data: "nuOfTrades",

      type: "quantity",

      width: WIDTHS.quantity,

      className: "table-market__number",

      numeric: true,

      headerGroup: "cumulative",

      mobile: true,
    }),

    createColumn({
      key: "volume-traded",

      label: cleanLabel(labels.volumeTraded, "Volume Traded"),

      data: "volumeTraded",

      type: "quantity",

      width: WIDTHS.quantity,

      className: "table-market__number",

      numeric: true,

      headerGroup: "cumulative",

      mobile: true,
    }),

    /* ----------------------------------------------------------------------
       Best Bid
       ---------------------------------------------------------------------- */

    createColumn({
      key: "bid-price",

      label: cleanLabel(labels.bidPrice, "Bid Price"),

      data: "bidPriceModified",

      type: "display-value",

      width: WIDTHS.price,

      className: "table-market__number",

      numeric: true,

      headerGroup: "best-bid",

      mobile: true,
    }),

    createColumn({
      key: "bid-volume",

      label: cleanLabel(labels.bidVolume, "Bid Volume"),

      data: "bidQuantity",

      type: "quantity",

      width: WIDTHS.quantity,

      className: "table-market__number",

      numeric: true,

      headerGroup: "best-bid",

      mobile: true,
    }),

    /* ----------------------------------------------------------------------
       Best Offer
       ---------------------------------------------------------------------- */

    createColumn({
      key: "ask-price",

      label: cleanLabel(labels.askPrice, "Ask Price"),

      data: "askPriceModified",

      type: "display-value",

      width: WIDTHS.price,

      className: "table-market__number",

      numeric: true,

      headerGroup: "best-offer",

      mobile: true,
    }),

    createColumn({
      key: "ask-volume",

      label: cleanLabel(labels.askVolume, "Ask Volume"),

      data: "askQuantity",

      type: "quantity",

      width: WIDTHS.quantity,

      className: "table-market__number",

      numeric: true,

      headerGroup: "best-offer",

      mobile: true,
    }),
  ];

  return createViewSchema({
    mode: TRADING_TABLE_MODES.complex,

    /*
     * The JSP contains the complete two-row grouped header.
     *
     * Never regenerate it in JavaScript.
     */
    preserveHeader: true,

    columns,

    headerGroups: [
      {
        id: "last-trade",

        columnKeys: [
          "last-trade-price",
          "last-trade-volume",
          "change-value",
          "change-percent",
        ],
      },

      {
        id: "today",

        columnKeys: ["open", "high", "low"],
      },

      {
        id: "cumulative",

        columnKeys: ["number-of-trades", "volume-traded"],
      },

      {
        id: "best-bid",

        columnKeys: ["bid-price", "bid-volume"],
      },

      {
        id: "best-offer",

        columnKeys: ["ask-price", "ask-volume"],
      },
    ],

    identity: {
      codeData: "",

      nameData: "acrynomName",

      urlData: "pageUrl",
    },

    mobile: {
      grouped: false,

      summary: ["last-trade-price", "change-percent"],

      details: [
        "last-trade-volume",
        "change-value",
        "open",
        "high",
        "low",
        "number-of-trades",
        "volume-traded",
        "bid-price",
        "bid-volume",
        "ask-price",
        "ask-volume",
      ],
    },
  });
}

/* ==========================================================================
   Suspended Companies / Funds
   ========================================================================== */

function createSuspendedCompaniesSchema(config = {}) {
  const labels = config.labels?.suspended || {};

  const columns = [
    /* ----------------------------------------------------------------------
       Symbol + Status
       ---------------------------------------------------------------------- */

    createColumn({
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "symbol",

      statusData: "companyStatus",

      type: "symbol-status",

      width: WIDTHS.symbol,

      className: "table-market__symbol table-market__identity-symbol",

      searchable: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    createColumn({
      key: "company",

      label: cleanLabel(labels.company, "Company Name"),

      data: "name",

      urlData: "companyURL",

      type: "company-link",

      width: WIDTHS.company,

      className: "table-market__company table-market__identity-company",

      searchable: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       From
       ---------------------------------------------------------------------- */

    createColumn({
      key: "from-date",

      label: cleanLabel(labels.fromDate, "From"),

      data: "fromDate",

      type: "date",

      width: WIDTHS.shortDate,

      className: "table-market__date",

      headerGroup: "period",

      mobile: true,
    }),

    /* ----------------------------------------------------------------------
       To
       ---------------------------------------------------------------------- */

    createColumn({
      key: "to-date",

      label: cleanLabel(labels.toDate, "To"),

      data: "toDate",

      type: "date",

      width: WIDTHS.shortDate,

      className: "table-market__date",

      headerGroup: "period",

      mobile: true,
    }),

    /* ----------------------------------------------------------------------
       Reason
       ---------------------------------------------------------------------- */

    createColumn({
      key: "reason",

      label: cleanLabel(labels.reason, "Reason"),

      data: null,

      primaryUrlData: "annUrl",

      fallbackUrlData: "newsUrl",

      type: "suspended-news-link",

      width: WIDTHS.reason,

      className: "table-market__reason",

      mobile: true,
    }),
  ];

  return createViewSchema({
    mode: TRADING_TABLE_MODES.complex,

    preserveHeader: true,

    columns,

    headerGroups: [
      {
        id: "period",

        columnKeys: ["from-date", "to-date"],
      },
    ],

    identity: {
      codeData: "symbol",

      nameData: "name",

      urlData: "companyURL",

      statusData: "companyStatus",

      statusPlacement: "symbol",
    },

    mobile: {
      grouped: false,

      summary: [],

      details: ["from-date", "to-date", "reason"],
    },
  });
}

/* ==========================================================================
   Delisted Companies / Funds
   ========================================================================== */

function createDelistedCompaniesSchema(config = {}) {
  const labels = config.labels?.delisted || {};

  const columns = [
    /* ----------------------------------------------------------------------
       Symbol + Status
       ---------------------------------------------------------------------- */

    createColumn({
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "symbol",

      statusData: "companyStatus",

      type: "symbol-status",

      width: WIDTHS.symbol,

      className: "table-market__symbol table-market__identity-symbol",

      searchable: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    createColumn({
      key: "company",

      label: cleanLabel(labels.company, "Company Name"),

      data: "name",

      urlData: "companyURL",

      type: "company-link",

      width: WIDTHS.company,

      className: "table-market__company table-market__identity-company",

      searchable: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Date
       ---------------------------------------------------------------------- */

    createColumn({
      key: "date",

      label: cleanLabel(labels.date, "Date"),

      data: "fromDate",

      type: "date",

      width: WIDTHS.shortDate,

      className: "table-market__date",

      mobile: true,
    }),

    /* ----------------------------------------------------------------------
       Reason
       ---------------------------------------------------------------------- */

    createColumn({
      key: "reason",

      label: cleanLabel(labels.reason, "Reason"),

      data: null,

      urlData: "newsUrl",

      type: "delisted-news-link",

      width: WIDTHS.reason,

      className: "table-market__reason",

      mobile: true,
    }),
  ];

  return createViewSchema({
    mode: TRADING_TABLE_MODES.standard,

    preserveHeader: true,

    columns,

    identity: {
      codeData: "symbol",

      nameData: "name",

      urlData: "companyURL",

      statusData: "companyStatus",

      statusPlacement: "symbol",
    },

    mobile: {
      grouped: false,

      summary: [],

      details: ["date", "reason"],
    },
  });
}

/* ==========================================================================
   OTC Trading
   ========================================================================== */

function createOtcTradingSchema(config = {}) {
  const labels = config.labels?.otc || {};

  const columns = [
    /* ----------------------------------------------------------------------
       Symbol
       ---------------------------------------------------------------------- */

    createColumn({
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "symbol",

      type: "text",

      width: WIDTHS.symbol,

      className: "table-market__symbol table-market__identity-symbol",

      searchable: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    createColumn({
      key: "company",

      label: cleanLabel(labels.company, "Company"),

      data: "companyName",

      urlData: "companyURL",

      type: "company-link",

      width: WIDTHS.company,

      className: "table-market__company table-market__identity-company",

      searchable: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Traded Volume
       ---------------------------------------------------------------------- */

    createColumn({
      key: "traded-volume",

      label: cleanLabel(labels.tradedVolume, "Traded Volume"),

      data: "lastTradeVolume",

      type: "quantity",

      width: WIDTHS.quantity,

      className: "table-market__number",

      numeric: true,

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Last Update
       ---------------------------------------------------------------------- */

    createColumn({
      key: "last-update",

      label: cleanLabel(labels.lastUpdate, "Last Update"),

      data: "lastTradeDate",

      type: "display-value",

      width: WIDTHS.date,

      className: "table-market__date",

      mobile: true,
    }),
  ];

  return createViewSchema({
    mode: TRADING_TABLE_MODES.standard,

    preserveHeader: true,

    columns,

    identity: {
      codeData: "symbol",

      nameData: "companyName",

      urlData: "companyURL",
    },

    mobile: {
      grouped: false,

      summary: ["traded-volume"],

      details: ["last-update"],
    },
  });
}

/* ==========================================================================
   Schema Registry
   ========================================================================== */

const SCHEMA_FACTORIES = Object.freeze({
  [TRADING_VIEWS.negotiatedDeals]: createNegotiatedDealsSchema,

  [TRADING_VIEWS.minimumSize]: createMinimumSizeSchema,

  [TRADING_VIEWS.accumulatedLosses]: createAccumulatedLossesSchema,

  [TRADING_VIEWS.listedTradableRights]: createListedTradableRightsSchema,

  [TRADING_VIEWS.suspendedCompanies]: createSuspendedCompaniesSchema,

  [TRADING_VIEWS.delistedCompanies]: createDelistedCompaniesSchema,

  [TRADING_VIEWS.otcTrading]: createOtcTradingSchema,
});

/* ==========================================================================
   Public Schema API
   ========================================================================== */

export function getViewSchema(view, config = {}) {
  const factory = SCHEMA_FACTORIES[view];

  if (!factory) {
    throw new Error(`Unknown Trading view: ${view}`);
  }

  return factory(config);
}

/* ==========================================================================
   Columns
   ========================================================================== */

export function getColumns(view, config = {}) {
  return [...getViewSchema(view, config).columns];
}

/* ==========================================================================
   Mobile Columns
   ========================================================================== */

export function getMobileColumns(view, config = {}) {
  return getColumns(view, config).filter((column) => column.mobile !== false);
}

/* ==========================================================================
   Column Lookup
   ========================================================================== */

export function getColumnByKey(view, key, config = {}) {
  return getColumns(view, config).find((column) => column.key === key) || null;
}

/* ==========================================================================
   View Mode
   ========================================================================== */

export function getTableMode(view, config = {}) {
  return getViewSchema(view, config).mode;
}

export function isStandardTable(view, config = {}) {
  return getTableMode(view, config) === TRADING_TABLE_MODES.standard;
}

export function isComplexHeaderTable(view, config = {}) {
  return getTableMode(view, config) === TRADING_TABLE_MODES.complex;
}

export function isMatrixTable(view, config = {}) {
  return getTableMode(view, config) === TRADING_TABLE_MODES.matrix;
}

/* ==========================================================================
   Header Ownership
   ========================================================================== */

export function shouldPreserveHeader(view, config = {}) {
  return Boolean(getViewSchema(view, config).preserveHeader);
}

/* ==========================================================================
   Complex Header Groups
   ========================================================================== */

export function getHeaderGroups(view, config = {}) {
  const groups = getViewSchema(view, config).headerGroups;

  return Array.isArray(groups)
    ? groups.map((group) => ({
        ...group,

        columnKeys: [...(group.columnKeys || [])],
      }))
    : [];
}

/* ==========================================================================
   Matrix Metadata
   ========================================================================== */

export function getMatrixConfig(view, config = {}) {
  const matrix = getViewSchema(view, config).matrix;

  if (!matrix) {
    return null;
  }

  return {
    ...matrix,

    valueKeys: [...(matrix.valueKeys || [])],

    leadingColumn: matrix.leadingColumn
      ? {
          ...matrix.leadingColumn,
        }
      : null,
  };
}

/* ==========================================================================
   Identity Metadata
   ========================================================================== */

export function getIdentityConfig(view, config = {}) {
  const identity = getViewSchema(view, config).identity;

  return identity
    ? {
        ...identity,
      }
    : null;
}

/* ==========================================================================
   Mobile Metadata
   ========================================================================== */

export function getMobileConfig(view, config = {}) {
  const mobile = getViewSchema(view, config).mobile || {};

  return {
    ...mobile,

    summary: Array.isArray(mobile.summary) ? [...mobile.summary] : [],

    details: Array.isArray(mobile.details) ? [...mobile.details] : [],

    fields: Array.isArray(mobile.fields) ? [...mobile.fields] : [],
  };
}

/* ==========================================================================
   Total Metadata
   ========================================================================== */

export function getTotalsConfig(view, config = {}) {
  const totals = getViewSchema(view, config).totals;

  if (!totals) {
    return null;
  }

  return {
    ...totals,

    columns: {
      ...(totals.columns || {}),
    },
  };
}

/* ==========================================================================
   Search Metadata
   ========================================================================== */

export function getSearchConfig(view, config = {}) {
  const search = getViewSchema(view, config).search;

  if (!search) {
    return {
      enabled: false,

      keys: [],
    };
  }

  return {
    ...search,

    keys: [...(search.keys || [])],
  };
}

/* ==========================================================================
   Table Configuration
   ========================================================================== */

export function getTableConfig(view, config = {}) {
  const defaults = config.tableDefaults || {};

  const specific = config.tables?.[view] || {};

  const schema = getViewSchema(view, config);

  return {
    ...defaults,
    ...specific,

    /*
     * Make presentation-mode metadata available to the page table adapter.
     */
    tradingMode: schema.mode,

    preserveHeader: Boolean(schema.preserveHeader),

    layout: {
      ...(defaults.layout || {}),

      ...(specific.layout || {}),
    },
  };
}

/* ==========================================================================
   Tab Views
   ========================================================================== */

export function getViewsForTab(tabKey) {
  return [...(TAB_VIEW_MAP[tabKey] || [])];
}

/* ==========================================================================
   Negotiated Variant Resolution
   ========================================================================== */

export function getNegotiatedView(type) {
  return String(type || "") === "Minimum-Size"
    ? TRADING_VIEWS.minimumSize
    : TRADING_VIEWS.negotiatedDeals;
}

/* ==========================================================================
   Company Status Variant Resolution
   ========================================================================== */

export function getSuspendedDelistedView(type) {
  const normalized = String(type || "");

  if (normalized === "Suspension" || normalized === "Suspension_Funds") {
    return TRADING_VIEWS.suspendedCompanies;
  }

  return TRADING_VIEWS.delistedCompanies;
}

/* ==========================================================================
   View -> Tab
   ========================================================================== */

export function getTabForView(view) {
  const entry = Object.entries(TAB_VIEW_MAP).find(([, views]) =>
    views.includes(view),
  );

  return entry ? entry[0] : null;
}

/* ==========================================================================
   Validation
   ========================================================================== */

export function isTradingView(view) {
  return Boolean(SCHEMA_FACTORIES[view]);
}

export function isTradingTab(tab) {
  return Object.values(TRADING_TABS).includes(tab);
}

/* ==========================================================================
   Negotiated Grouping
   ========================================================================== */

export function getNegotiatedGrouping(config = {}) {
  const mobile = getMobileConfig(TRADING_VIEWS.negotiatedDeals, config);

  return Object.freeze({
    field: mobile.groupBy || "strDate",

    mobileGroup: Boolean(mobile.grouped),

    mobileDailyTotal: Boolean(mobile.dailyTotal),

    totalRowType: "total",
  });
}
