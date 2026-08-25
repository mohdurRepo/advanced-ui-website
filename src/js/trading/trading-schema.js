/* ==========================================================================
   Trading Schema
   ========================================================================== */

/*
 * Single source of truth for Trading data presentation.
 *
 * Responsibilities:
 *
 * - Trading view identifiers
 * - Trading tab identifiers
 * - tab -> view relationships
 * - column order
 * - backend field mappings
 * - column widths
 * - renderer type metadata
 * - mobile field availability
 * - table configuration resolution
 * - negotiated-deal variant resolution
 * - suspended/delisted variant resolution
 *
 * This module intentionally has no:
 *
 * - DOM manipulation
 * - DataTables lifecycle
 * - AJAX
 * - filter state
 * - tab event handling
 * - business-value formatting
 * - card markup
 * - date conversion implementation
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
   Widths
   ========================================================================== */

const WIDTHS = Object.freeze({
  date: "8rem",

  company: "15rem",

  symbol: "7rem",

  price: "7rem",

  quantity: "8rem",

  value: "9rem",

  time: "7rem",

  security: "15rem",

  reason: "12rem",

  generic: "9rem",
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

function column(definition = {}) {
  return {
    mobile: true,

    orderable: true,

    searchable: true,

    ...definition,
  };
}

function sizedColumn(width, definition = {}) {
  return column({
    width,

    ...definition,
  });
}

/* ==========================================================================
   Negotiated Deals Labels
   ========================================================================== */

function getNegotiatedLabels(config = {}) {
  return config.labels?.negotiatedDeals || {};
}

/* ==========================================================================
   Negotiated Deals
   ========================================================================== */

function createNegotiatedDealsColumns(config = {}) {
  const labels = getNegotiatedLabels(config);

  return [
    /* ----------------------------------------------------------------------
       Date
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.date, {
      key: "date",

      label: cleanLabel(labels.date, "Date"),

      data: "strDate",

      type: "negotiated-date",

      className: "table-market__date",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    /*
     * The refined Trading static combines company name and symbol into one
     * identity column:
     *
     * Company Name
     * Symbol
     *
     * `company` is therefore the visible table value while `symbol` remains
     * supporting identity metadata.
     */

    sizedColumn(WIDTHS.company, {
      key: "company",

      label: cleanLabel(labels.company, "Company"),

      data: "company",

      symbolData: "symbol",

      urlData: "companyURL",

      type: "negotiated-company",

      className: "table-market__company",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Price
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.price, {
      key: "trade-price",

      label: cleanLabel(labels.price, "Price"),

      data: "tradePrice",

      type: "money",

      className: "table-market__price",

      numeric: true,

      /*
       * Price is already shown in the mobile card summary.
       */
      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Volume
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.quantity, {
      key: "trade-volume",

      label: cleanLabel(labels.volume, "Volume"),

      data: "tradeVolume",

      type: "quantity",

      className: "table-market__number",

      numeric: true,
    }),

    /* ----------------------------------------------------------------------
       Value
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.value, {
      key: "turnover",

      label: cleanLabel(labels.value, "Value"),

      data: "turnOver",

      type: "money",

      className: "table-market__number",

      numeric: true,

      /*
       * Value is shown next to Price in the mobile summary.
       */
      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Time
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.time, {
      key: "time",

      label: cleanLabel(labels.time, "Time"),

      data: "strTime",

      type: "time",

      className: "table-market__number",

      numeric: true,
    }),
  ];
}

/* ==========================================================================
   Minimum Size
   ========================================================================== */

function createMinimumSizeColumns(config = {}) {
  const labels = config.labels?.minimumSize || {};

  /*
   * Legacy Minimum Size data is a matrix-style structure.
   *
   * The endpoint returns:
   *
   * col1
   * col2
   * col3
   * col4
   *
   * while the table markup contains five columns because the first column
   * represents the row heading/category.
   */

  return [
    sizedColumn(WIDTHS.generic, {
      key: "minimum-size-label",

      label: cleanLabel(labels.label, ""),

      data: null,

      type: "empty",

      mobile: false,

      orderable: false,

      searchable: false,
    }),

    sizedColumn(WIDTHS.generic, {
      key: "col1",

      label: cleanLabel(labels.col1, "Column 1"),

      data: "col1",

      type: "security-reference",
    }),

    sizedColumn(WIDTHS.generic, {
      key: "col2",

      label: cleanLabel(labels.col2, "Column 2"),

      data: "col2",

      type: "security-reference",
    }),

    sizedColumn(WIDTHS.generic, {
      key: "col3",

      label: cleanLabel(labels.col3, "Column 3"),

      data: "col3",

      type: "security-reference",
    }),

    sizedColumn(WIDTHS.generic, {
      key: "col4",

      label: cleanLabel(labels.col4, "Column 4"),

      data: "col4",

      type: "security-reference",
    }),
  ];
}

/* ==========================================================================
   Accumulated Losses
   ========================================================================== */

function createAccumulatedLossesColumns(config = {}) {
  const labels = config.labels?.accumulated || {};

  return [
    sizedColumn(WIDTHS.symbol, {
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "symbol",

      statusData: "companyStatus",

      type: "symbol-status",

      className: "table-market__symbol",

      /*
       * Symbol is already shown in mobile identity.
       */
      mobile: false,
    }),

    sizedColumn(WIDTHS.company, {
      key: "company",

      label: cleanLabel(labels.company, "Company Name"),

      data: "company",

      urlData: "companyURL",

      statusData: "companyStatus",

      type: "company-status-link",

      className: "table-market__company",

      /*
       * Company is already shown in mobile identity.
       */
      mobile: false,
    }),
  ];
}

/* ==========================================================================
   Listed Tradable Rights Labels
   ========================================================================== */

function getListedTradableLabels(config = {}) {
  return config.labels?.listedTradable || {};
}

/* ==========================================================================
   Listed Tradable Rights
   ========================================================================== */

function createListedTradableRightsColumns(config = {}) {
  const labels = getListedTradableLabels(config);

  return [
    /* ----------------------------------------------------------------------
       Security
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.security, {
      key: "tradable-right",

      label: cleanLabel(labels.security, "Tradable Rights"),

      data: "acrynomName",

      urlData: "pageUrl",

      type: "security-link",

      className: "table-market__security",

      /*
       * Security is already used as mobile identity.
       */
      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Last Trade
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.price, {
      key: "last-trade-price",

      label: cleanLabel(labels.lastTradePrice, "Price"),

      data: "lastTradePriceModified",

      type: "display-value",

      headerGroup: "lastTrade",

      className: "table-market__number",

      numeric: true,

      /*
       * Price is part of the mobile card summary.
       */
      mobile: false,
    }),

    sizedColumn(WIDTHS.quantity, {
      key: "last-trade-volume",

      label: cleanLabel(labels.lastTradeVolume, "Volume"),

      data: "lastTradeQuantity",

      type: "quantity",

      headerGroup: "lastTrade",

      className: "table-market__number",

      numeric: true,
    }),

    sizedColumn(WIDTHS.price, {
      key: "change-value",

      label: cleanLabel(labels.changeValue, "Change Value"),

      data: "netChangeModified",

      numericData: "netChangeDoubleModified",

      type: "price-change",

      headerGroup: "lastTrade",

      className: "table-market__number",

      numeric: true,
    }),

    sizedColumn(WIDTHS.price, {
      key: "change-percent",

      label: cleanLabel(labels.changePercent, "Change %"),

      data: "percentChangeModified",

      numericData: "percentChangeDoubleModified",

      type: "price-change",

      headerGroup: "lastTrade",

      className: "table-market__number",

      numeric: true,

      /*
       * Percentage change is shown in the mobile card summary.
       */
      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Today's Trading
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.price, {
      key: "open",

      label: cleanLabel(labels.open, "Open"),

      data: "todayOpenModified",

      type: "display-value",

      headerGroup: "today",

      className: "table-market__number",

      numeric: true,
    }),

    sizedColumn(WIDTHS.price, {
      key: "high",

      label: cleanLabel(labels.high, "High"),

      data: "highPriceModified",

      type: "display-value",

      headerGroup: "today",

      className: "table-market__number",

      numeric: true,
    }),

    sizedColumn(WIDTHS.price, {
      key: "low",

      label: cleanLabel(labels.low, "Low"),

      data: "lowPriceModified",

      type: "display-value",

      headerGroup: "today",

      className: "table-market__number",

      numeric: true,
    }),

    /* ----------------------------------------------------------------------
       Cumulative
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.quantity, {
      key: "number-of-trades",

      label: cleanLabel(labels.numberOfTrades, "Number of Trades"),

      data: "nuOfTrades",

      type: "quantity",

      headerGroup: "cumulative",

      className: "table-market__number",

      numeric: true,
    }),

    sizedColumn(WIDTHS.quantity, {
      key: "volume-traded",

      label: cleanLabel(labels.volumeTraded, "Volume Traded"),

      data: "volumeTraded",

      type: "quantity",

      headerGroup: "cumulative",

      className: "table-market__number",

      numeric: true,
    }),

    /* ----------------------------------------------------------------------
       Best Bid
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.price, {
      key: "bid-price",

      label: cleanLabel(labels.bidPrice, "Bid Price"),

      data: "bidPriceModified",

      type: "display-value",

      headerGroup: "bestBid",

      className: "table-market__number",

      numeric: true,
    }),

    sizedColumn(WIDTHS.quantity, {
      key: "bid-volume",

      label: cleanLabel(labels.bidVolume, "Bid Volume"),

      data: "bidQuantity",

      type: "quantity",

      headerGroup: "bestBid",

      className: "table-market__number",

      numeric: true,
    }),

    /* ----------------------------------------------------------------------
       Best Offer
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.price, {
      key: "ask-price",

      label: cleanLabel(labels.askPrice, "Ask Price"),

      data: "askPriceModified",

      type: "display-value",

      headerGroup: "bestOffer",

      className: "table-market__number",

      numeric: true,
    }),

    sizedColumn(WIDTHS.quantity, {
      key: "ask-volume",

      label: cleanLabel(labels.askVolume, "Ask Volume"),

      data: "askQuantity",

      type: "quantity",

      headerGroup: "bestOffer",

      className: "table-market__number",

      numeric: true,
    }),
  ];
}

/* ==========================================================================
   Suspended Companies
   ========================================================================== */

function createSuspendedCompaniesColumns(config = {}) {
  const labels = config.labels?.suspended || {};

  return [
    /* ----------------------------------------------------------------------
       Symbol
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.symbol, {
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "symbol",

      type: "text",

      className: "table-market__symbol",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.company, {
      key: "company",

      label: cleanLabel(labels.company, "Company Name"),

      data: "name",

      urlData: "companyURL",

      statusData: "companyStatus",

      type: "company-status-link",

      className: "table-market__company",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       From
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.date, {
      key: "from-date",

      label: cleanLabel(labels.fromDate, "From"),

      data: "fromDate",

      type: "date",

      className: "table-market__date",
    }),

    /* ----------------------------------------------------------------------
       To
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.date, {
      key: "to-date",

      label: cleanLabel(labels.toDate, "To"),

      data: "toDate",

      type: "date",

      className: "table-market__date",
    }),

    /* ----------------------------------------------------------------------
       Reason
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.reason, {
      key: "reason",

      label: cleanLabel(labels.reason, "Reason"),

      data: null,

      primaryUrlData: "annUrl",

      fallbackUrlData: "newsUrl",

      type: "suspended-news-link",

      orderable: false,

      searchable: false,
    }),
  ];
}

/* ==========================================================================
   Delisted Companies
   ========================================================================== */

function createDelistedCompaniesColumns(config = {}) {
  const labels = config.labels?.delisted || {};

  return [
    /* ----------------------------------------------------------------------
       Symbol
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.symbol, {
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "symbol",

      type: "text",

      className: "table-market__symbol",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.company, {
      key: "company",

      label: cleanLabel(labels.company, "Company Name"),

      data: "name",

      urlData: "companyURL",

      statusData: "companyStatus",

      type: "company-status-link",

      className: "table-market__company",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Date
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.date, {
      key: "date",

      label: cleanLabel(labels.date, "Date"),

      data: "fromDate",

      type: "date",

      className: "table-market__date",
    }),

    /* ----------------------------------------------------------------------
       Reason
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.reason, {
      key: "reason",

      label: cleanLabel(labels.reason, "Reason"),

      data: null,

      urlData: "newsUrl",

      type: "delisted-news-link",

      orderable: false,

      searchable: false,
    }),
  ];
}

/* ==========================================================================
   OTC Trading
   ========================================================================== */

function createOtcTradingColumns(config = {}) {
  const labels = config.labels?.otc || {};

  return [
    /* ----------------------------------------------------------------------
       Symbol
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.symbol, {
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "symbol",

      type: "text",

      className: "table-market__symbol",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.company, {
      key: "company",

      label: cleanLabel(labels.company, "Company"),

      data: "companyName",

      urlData: "companyURL",

      type: "company-link",

      className: "table-market__company",

      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Traded Volume
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.quantity, {
      key: "traded-volume",

      label: cleanLabel(labels.tradedVolume, "Traded Volume"),

      data: "lastTradeVolume",

      type: "quantity",

      className: "table-market__number",

      numeric: true,

      /*
       * Volume is part of the compact mobile summary.
       */
      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       Last Update
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.date, {
      key: "last-update",

      label: cleanLabel(labels.lastUpdate, "Last Update"),

      /*
       * Preserve the existing backend/render contract.
       *
       * The legacy implementation maps the column labelled
       * `OTC.LastUpdatePrice` to `lastTradeDate`.
       */
      data: "lastTradeDate",

      type: "display-value",

      className: "table-market__date",
    }),
  ];
}

/* ==========================================================================
   Schema Registry
   ========================================================================== */

const SCHEMA_FACTORIES = Object.freeze({
  [TRADING_VIEWS.negotiatedDeals]: createNegotiatedDealsColumns,

  [TRADING_VIEWS.minimumSize]: createMinimumSizeColumns,

  [TRADING_VIEWS.accumulatedLosses]: createAccumulatedLossesColumns,

  [TRADING_VIEWS.listedTradableRights]: createListedTradableRightsColumns,

  [TRADING_VIEWS.suspendedCompanies]: createSuspendedCompaniesColumns,

  [TRADING_VIEWS.delistedCompanies]: createDelistedCompaniesColumns,

  [TRADING_VIEWS.otcTrading]: createOtcTradingColumns,
});

/* ==========================================================================
   Public Columns API
   ========================================================================== */

export function getColumns(view, config = {}) {
  const factory = SCHEMA_FACTORIES[view];

  if (!factory) {
    throw new Error(`Unknown Trading view: ${view}`);
  }

  return factory(config);
}

/* ==========================================================================
   Mobile Columns
   ========================================================================== */

export function getMobileColumns(view, config = {}) {
  return getColumns(view, config).filter((item) => item.mobile !== false);
}

/* ==========================================================================
   Column Lookup
   ========================================================================== */

export function getColumnByKey(view, key, config = {}) {
  return getColumns(view, config).find((item) => item.key === key) || null;
}

/* ==========================================================================
   Table Configuration
   ========================================================================== */

export function getTableConfig(view, config = {}) {
  const defaults = config.tableDefaults || {};

  const specific = config.tables?.[view] || {};

  return {
    ...defaults,
    ...specific,

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
  return String(type) === "Minimum-Size"
    ? TRADING_VIEWS.minimumSize
    : TRADING_VIEWS.negotiatedDeals;
}

/* ==========================================================================
   Company Status Variant Resolution
   ========================================================================== */

export function getSuspendedDelistedView(type) {
  const normalized = String(type || "");

  /*
   * Suspension_Funds shares the Suspension presentation.
   */
  if (normalized === "Suspension" || normalized === "Suspension_Funds") {
    return TRADING_VIEWS.suspendedCompanies;
  }

  /*
   * Delisting and Delisted_Funds share the Delisting presentation.
   */
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
   View Validation
   ========================================================================== */

export function isTradingView(view) {
  return Boolean(SCHEMA_FACTORIES[view]);
}

/* ==========================================================================
   Tab Validation
   ========================================================================== */

export function isTradingTab(tab) {
  return Object.values(TRADING_TABS).includes(tab);
}

/* ==========================================================================
   Negotiated Deals Metadata
   ========================================================================== */

/*
 * Negotiated Deals is unique because both desktop and mobile organize data
 * around trading date.
 *
 * This metadata is intentionally declarative. The actual grouping/rendering
 * stays in trading.js / trading-formatters.js.
 */

export function getNegotiatedGrouping() {
  return Object.freeze({
    field: "strDate",

    totalRowType: "total",

    mobileGroup: true,

    mobileDailyTotal: true,
  });
}
