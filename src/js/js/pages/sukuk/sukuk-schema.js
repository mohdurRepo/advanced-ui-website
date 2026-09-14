/* ==========================================================================
   Sukuk Schema
   ========================================================================== */

/*
 * Single source of truth for Sukuk & Bonds presentation schema.
 *
 * Responsibilities:
 *
 * - column order
 * - backend field mapping
 * - column widths
 * - column visibility groups
 * - mobile field availability
 * - rendering type metadata
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - DataTables lifecycle
 * - AJAX code
 * - breakpoint logic
 * - card markup
 * - business-value formatting
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_VIEW = "1";

const GROUP_ORDER = Object.freeze([
  "isin",
  "couponDetails",
  "maturity",
  "yieldDetails",
  "priceDetails",
  "issueDetails",
  "couponMeta",
]);

const WIDTHS = Object.freeze({
  instrument: "15rem",

  isin: "9rem",

  couponType: "7rem",
  couponRate: "7rem",

  maturity: "8rem",

  yield: "6.5rem",

  parValue: "7rem",

  price: "6.5rem",

  issuanceAmount: "9rem",
  issuanceCurrency: "7rem",

  couponFrequency: "8rem",
  dayCountConvention: "9rem",
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

function getLabels(config = {}) {
  return config.labels?.table || {};
}

function column(definition = {}) {
  return {
    mobile: true,

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
   Column Groups
   ========================================================================== */

function createGroups(config = {}) {
  const labels = getLabels(config);

  return {
    isin: {
      id: "isin",

      label: cleanLabel(labels.isin, "ISIN"),
    },

    couponDetails: {
      id: "couponDetails",

      label: cleanLabel(config.labels?.couponDetails, "Coupon Details"),
    },

    maturity: {
      id: "maturity",

      label: cleanLabel(labels.maturityDate, "Maturity Date"),
    },

    yieldDetails: {
      id: "yieldDetails",

      label: cleanLabel(config.labels?.yieldDetails, "Yield"),
    },

    priceDetails: {
      id: "priceDetails",

      label: cleanLabel(config.labels?.priceDetails, "Price"),
    },

    issueDetails: {
      id: "issueDetails",

      label: cleanLabel(config.labels?.issueDetails, "Issue Details"),
    },

    couponMeta: {
      id: "couponMeta",

      label: cleanLabel(config.labels?.couponMeta, "Coupon"),
    },
  };
}

/* ==========================================================================
   Columns
   ========================================================================== */

function createColumns(config = {}) {
  const labels = getLabels(config);

  return [
    /* ----------------------------------------------------------------------
       Instrument
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.instrument, {
      key: "instrument",

      label: cleanLabel(labels.instrument, "Name"),

      /*
       * Always-visible first column.
       *
       * Instrument rendering follows the Market Watch hierarchy:
       *
       * code
       * name
       */
      type: "instrument",

      className: "table-market__security",

      /*
       * Identity is already shown in the mobile summary.
       */
      mobile: false,
    }),

    /* ----------------------------------------------------------------------
       ISIN
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.isin, {
      key: "isin",

      visibilityGroup: "isin",

      label: cleanLabel(labels.isin, "ISIN"),

      data: "isin",

      type: "text",

      className: "table-market__text",
    }),

    /* ----------------------------------------------------------------------
       Coupon Details
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.couponType, {
      key: "coupon-type",

      visibilityGroup: "couponDetails",

      label: cleanLabel(labels.couponType, "Coupon Type"),

      data: "rateCalcType",

      type: "coupon-type",

      className: "table-market__text",
    }),

    sizedColumn(WIDTHS.couponRate, {
      key: "coupon-rate",

      visibilityGroup: "couponDetails",

      label: cleanLabel(labels.couponRate, "Coupon Rate"),

      data: "couponRateModified",

      fallbackData: ["couponRate"],

      type: "display-value",

      className: "table-market__number",
    }),

    /* ----------------------------------------------------------------------
       Maturity
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.maturity, {
      key: "maturity-date",

      visibilityGroup: "maturity",

      label: cleanLabel(labels.maturityDate, "Maturity Date"),

      data: "maturityDate",

      fallbackData: ["maturityDateStr"],

      type: "maturity",

      className: "table-market__text",
    }),

    /* ----------------------------------------------------------------------
       Yield Details
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.yield, {
      key: "instrument-yield",

      visibilityGroup: "yieldDetails",

      label: cleanLabel(labels.instrumentYield, "Instrument Yield"),

      /*
       * Preserve the existing backend spelling while supporting the
       * correctly spelled alias as a fallback.
       */
      data: "lastTadeYield",

      fallbackData: ["lastTradeYield"],

      type: "yield",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.yield, {
      key: "bid-yield",

      visibilityGroup: "yieldDetails",

      label: cleanLabel(labels.bidYield, "Bid Yield"),

      data: "bidYield",

      type: "yield",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.yield, {
      key: "ask-yield",

      visibilityGroup: "yieldDetails",

      label: cleanLabel(labels.askYield, "Ask Yield"),

      data: "askYield",

      type: "yield",

      className: "table-market__number",
    }),

    /* ----------------------------------------------------------------------
       Issue Details
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.parValue, {
      key: "par-value",

      visibilityGroup: "issueDetails",

      label: cleanLabel(labels.parValue, "Par Value"),

      data: "parValue",

      type: "quantity",

      className: "table-market__number",
    }),

    /* ----------------------------------------------------------------------
       Price Details
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.price, {
      key: "last-trade-price",

      visibilityGroup: "priceDetails",

      label: cleanLabel(labels.lastTradePrice, "Last Trade Price"),

      data: "lastTradePrice",

      fallbackData: ["lastTradePriceModified"],

      type: "price",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.price, {
      key: "bid-price",

      visibilityGroup: "priceDetails",

      label: cleanLabel(labels.bidPrice, "Bid Price"),

      data: "bidPrice",

      fallbackData: ["bidPriceModified"],

      type: "price",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.price, {
      key: "ask-price",

      visibilityGroup: "priceDetails",

      label: cleanLabel(labels.askPrice, "Ask Price"),

      data: "askPrice",

      fallbackData: ["askPriceModified"],

      type: "price",

      className: "table-market__number",
    }),

    /* ----------------------------------------------------------------------
       Issuance Details
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.issuanceAmount, {
      key: "issuance-amount",

      visibilityGroup: "issueDetails",

      label: cleanLabel(labels.issuanceAmount, "Issuance Amount"),

      data: "outstandingAmountModified",

      fallbackData: ["issuanceAmount", "outstandingAmount"],

      type: "display-value",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.issuanceCurrency, {
      key: "issuance-currency",

      visibilityGroup: "issueDetails",

      label: cleanLabel(labels.issuanceCurrency, "Issuance Currency"),

      data: "issueCurrency",

      type: "text",

      className: "table-market__text",
    }),

    /* ----------------------------------------------------------------------
       Coupon Metadata
       ---------------------------------------------------------------------- */

    sizedColumn(WIDTHS.couponFrequency, {
      key: "coupon-frequency",

      visibilityGroup: "couponMeta",

      label: cleanLabel(labels.couponFrequency, "Coupon Frequency"),

      data: "couponFrequency",

      type: "coupon-frequency",

      className: "table-market__text",
    }),

    sizedColumn(WIDTHS.dayCountConvention, {
      key: "day-count-convention",

      visibilityGroup: "couponMeta",

      label: cleanLabel(labels.dayCountConvention, "Day Count Convention"),

      data: "dayCountMethod",

      type: "day-count-convention",

      className: "table-market__text",
    }),
  ];
}

/* ==========================================================================
   Public Columns
   ========================================================================== */

export function getColumns(config = {}, view = DEFAULT_VIEW) {
  /*
   * Sukuk currently has one presentation schema.
   *
   * Keep the view argument for compatibility with the common Data View
   * contract and possible future schemas.
   */

  void view;

  return createColumns(config);
}

/* ==========================================================================
   Column Groups
   ========================================================================== */

export function getColumnGroups(config = {}, view = DEFAULT_VIEW) {
  const groups = createGroups(config);

  const available = new Set(
    getColumns(config, view)
      .map((item) => item.visibilityGroup)
      .filter(Boolean),
  );

  return GROUP_ORDER.filter((groupId) => available.has(groupId)).map(
    (groupId) => groups[groupId],
  );
}

/* ==========================================================================
   Visible Columns
   ========================================================================== */

export function getVisibleColumns(
  config = {},
  view = DEFAULT_VIEW,
  visibleGroups = GROUP_ORDER,
) {
  const selected = new Set(visibleGroups);

  return getColumns(config, view).filter((item) => {
    /*
     * Ungrouped columns, such as Instrument/Name, are always visible.
     */
    if (!item.visibilityGroup) {
      return true;
    }

    return selected.has(item.visibilityGroup);
  });
}

/* ==========================================================================
   Mobile Columns
   ========================================================================== */

export function getMobileColumns(
  config = {},
  view = DEFAULT_VIEW,
  visibleGroups = GROUP_ORDER,
) {
  return getVisibleColumns(config, view, visibleGroups).filter(
    (item) => item.mobile !== false,
  );
}

/* ==========================================================================
   Column Indexes by Group
   ========================================================================== */

export function getColumnIndexesByGroup(config = {}, view = DEFAULT_VIEW) {
  return getColumns(config, view).reduce((result, item, index) => {
    const groupId = item.visibilityGroup;

    if (!groupId) {
      return result;
    }

    if (!result[groupId]) {
      result[groupId] = [];
    }

    result[groupId].push(index);

    return result;
  }, {});
}

/* ==========================================================================
   Column Lookup
   ========================================================================== */

export function getColumnByKey(config = {}, view = DEFAULT_VIEW, key) {
  return getColumns(config, view).find((item) => item.key === key) || null;
}

/* ==========================================================================
   Default Groups
   ========================================================================== */

export function getDefaultVisibleGroups() {
  return [...GROUP_ORDER];
}
