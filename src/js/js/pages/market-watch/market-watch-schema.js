/* ==========================================================================
   Market Watch Schema
   ========================================================================== */

/*
 * Single source of truth for Market Watch presentation schema.
 *
 * Responsibilities:
 *
 * - table views
 * - column order
 * - column widths
 * - header groups
 * - visibility groups
 * - mobile field availability
 * - backend field mapping
 * - rendering type metadata
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - DataTables lifecycle
 * - AJAX code
 * - breakpoint logic
 * - card markup
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const GROUP_ORDER = Object.freeze([
  "range",
  "last-trade",
  "cumulative",
  "trading",
  "best-bid",
  "best-offer",
]);

const WIDTHS = Object.freeze({
  company: "15.5rem",
  range: "8.5rem",

  price: "4.75rem",
  quantity: "5.25rem",
  change: "5.5rem",

  trades: "5.5rem",
  volumeTraded: "6.75rem",

  tradingPrice: "4.5rem",

  bidOfferPrice: "4.75rem",
  bidOfferVolume: "6rem",

  sector: "10rem",
  symbol: "5rem",
  marketCap: "8.5rem",
  performanceValue: "5.5rem",
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
    range: {
      id: "range",

      label: cleanLabel(labels.range, "52 Week Range"),
    },

    "last-trade": {
      id: "last-trade",

      label: cleanLabel(labels.lastTrade, "Last Trade"),
    },

    cumulative: {
      id: "cumulative",

      label: cleanLabel(labels.cumulative, "Cumulative"),
    },

    trading: {
      id: "trading",

      label: cleanLabel(labels.trading, "Today's Trading"),
    },

    "best-bid": {
      id: "best-bid",

      label: cleanLabel(labels.bestBid, "Best Bid"),
    },

    "best-offer": {
      id: "best-offer",

      label: cleanLabel(labels.bestOffer, "Best Offer"),
    },
  };
}

/* ==========================================================================
   Shared Columns
   ========================================================================== */

function createCompanyColumn(labels) {
  return sizedColumn(WIDTHS.company, {
    key: "company",

    label: cleanLabel(labels.company, "Company"),

    type: "company",

    className: "table-market__security",

    /*
     * Company identity already appears in the mobile card summary.
     */
    mobile: false,
  });
}

function createRangeColumn(labels) {
  return sizedColumn(WIDTHS.range, {
    key: "range",

    visibilityGroup: "range",

    label: cleanLabel(labels.range, "52 Week Range"),

    type: "range",

    className: "table-market__range",
  });
}

function createLastTradePriceColumn(labels, { grouped = false } = {}) {
  return sizedColumn(WIDTHS.price, {
    key: "last-trade-price",

    visibilityGroup: "last-trade",

    headerGroup: grouped ? "last-trade" : undefined,

    label: cleanLabel(labels.price, "Price"),

    data: "lastTradePriceModified",

    type: "auction-value",

    className: "table-market__price table-market__number",
  });
}

function createChangeValueColumn(labels, { grouped = false } = {}) {
  return sizedColumn(WIDTHS.change, {
    key: "change-value",

    visibilityGroup: "last-trade",

    headerGroup: grouped ? "last-trade" : undefined,

    label: cleanLabel(labels.changeValue, "Change Value"),

    data: "netChangeModified",

    numericData: "netChange",

    type: "change",

    className: "table-market__change table-market__number",
  });
}

function createChangePercentColumn(labels, { grouped = false } = {}) {
  return sizedColumn(WIDTHS.change, {
    key: "change-percent",

    visibilityGroup: "last-trade",

    headerGroup: grouped ? "last-trade" : undefined,

    label: cleanLabel(labels.changePercent, "Change %"),

    data: "precentChangeModified",

    numericData: "precentChange",

    type: "percent-change",

    className: "table-market__change table-market__number",
  });
}

function createTradingColumns(labels, { grouped = false } = {}) {
  const headerGroup = grouped ? "trading" : undefined;

  return [
    sizedColumn(WIDTHS.tradingPrice, {
      key: "open",

      visibilityGroup: "trading",

      headerGroup,

      label: cleanLabel(labels.open, "Open"),

      data: "todayOpenModified",

      type: "auction-value",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.tradingPrice, {
      key: "high",

      visibilityGroup: "trading",

      headerGroup,

      label: cleanLabel(labels.high, "High"),

      data: "highPriceModified",

      type: "auction-value",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.tradingPrice, {
      key: "low",

      visibilityGroup: "trading",

      headerGroup,

      label: cleanLabel(labels.low, "Low"),

      data: "lowPriceModified",

      type: "auction-value",

      className: "table-market__number",
    }),
  ];
}

/* ==========================================================================
   Overview
   ========================================================================== */

function createOverviewColumns(config = {}) {
  const labels = getLabels(config);

  return [
    createCompanyColumn(labels),

    createRangeColumn(labels),

    createLastTradePriceColumn(labels, {
      grouped: true,
    }),

    sizedColumn(WIDTHS.quantity, {
      key: "last-trade-volume",

      visibilityGroup: "last-trade",

      headerGroup: "last-trade",

      label: cleanLabel(labels.volume, "Volume"),

      data: "lastTradeQuantity",

      type: "auction-quantity",

      className: "table-market__volume table-market__number",
    }),

    createChangeValueColumn(labels, {
      grouped: true,
    }),

    createChangePercentColumn(labels, {
      grouped: true,
    }),

    sizedColumn(WIDTHS.trades, {
      key: "number-of-trades",

      visibilityGroup: "cumulative",

      headerGroup: "cumulative",

      label: cleanLabel(labels.numberOfTrades, "No. of Trades"),

      data: "nuOfTrades",

      type: "auction-full-number",

      className: "table-market__trades table-market__number",
    }),

    sizedColumn(WIDTHS.volumeTraded, {
      key: "volume-traded",

      visibilityGroup: "cumulative",

      headerGroup: "cumulative",

      label: cleanLabel(labels.volumeTraded, "Volume Traded"),

      data: "volumeTraded",

      type: "auction-full-number",

      className: "table-market__volume-traded table-market__number",
    }),

    ...createTradingColumns(labels, {
      grouped: true,
    }),

    sizedColumn(WIDTHS.bidOfferPrice, {
      key: "best-bid-price",

      visibilityGroup: "best-bid",

      headerGroup: "best-bid",

      label: cleanLabel(labels.price, "Price"),

      data: "bidPriceModified",

      type: "market-order",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.bidOfferVolume, {
      key: "best-bid-volume",

      visibilityGroup: "best-bid",

      headerGroup: "best-bid",

      label: cleanLabel(labels.volume, "Volume"),

      mobileLabel: cleanLabel(labels.volume, "Volume"),

      data: "bidQuantity",

      type: "auction-full-number",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.bidOfferPrice, {
      key: "best-offer-price",

      visibilityGroup: "best-offer",

      headerGroup: "best-offer",

      label: cleanLabel(labels.price, "Price"),

      data: "askPriceModified",

      type: "market-order",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.bidOfferVolume, {
      key: "best-offer-volume",

      visibilityGroup: "best-offer",

      headerGroup: "best-offer",

      label: cleanLabel(labels.volume, "Volume"),

      mobileLabel: cleanLabel(labels.volume, "Volume"),

      data: "askQuantityModified",

      type: "auction-full-number",

      className: "table-market__number",
    }),
  ];
}

/* ==========================================================================
   Price Data
   ========================================================================== */

function createPriceDataColumns(config = {}) {
  const labels = getLabels(config);

  return [
    createCompanyColumn(labels),

    createRangeColumn(labels),

    createLastTradePriceColumn(labels, {
      grouped: true,
    }),

    createChangeValueColumn(labels, {
      grouped: true,
    }),

    createChangePercentColumn(labels, {
      grouped: true,
    }),

    ...createTradingColumns(labels, {
      grouped: true,
    }),
  ];
}

/* ==========================================================================
   Performance
   ========================================================================== */

/*
 * Performance intentionally starts with Sector.
 *
 * Therefore:
 *
 * fixedColumns: 1
 *
 * fixes Sector for this view.
 *
 * If the future requirement becomes "Company must always be fixed",
 * implement that explicitly in table configuration rather than adding
 * schema-only metadata that DataTables never consumes.
 */

function createPerformanceColumns(config = {}) {
  const labels = getLabels(config);

  return [
    sizedColumn(WIDTHS.sector, {
      key: "sector",

      label: cleanLabel(labels.sector, "Sector"),

      data: "sectorName",

      type: "text",

      className: "table-market__text",
    }),

    sizedColumn(WIDTHS.symbol, {
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "companySymbol",

      type: "text",

      className: "table-market__number",
    }),

    createCompanyColumn(labels),

    createRangeColumn(labels),

    sizedColumn(WIDTHS.marketCap, {
      key: "market-cap",

      label: cleanLabel(labels.marketCap, "Market Cap"),

      data: "marketCap",

      type: "full-number",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.performanceValue, {
      key: "per",

      label: cleanLabel(labels.per, "P/E"),

      data: "PER",

      type: "text",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.quantity, {
      key: "volume",

      visibilityGroup: "cumulative",

      label: cleanLabel(labels.volume, "Volume"),

      data: "lastTradeQuantity",

      type: "auction-full-number",

      className: "table-market__number",
    }),

    sizedColumn(WIDTHS.performanceValue, {
      key: "yield",

      label: cleanLabel(labels.yield, "Yield"),

      data: "yield",

      type: "text",

      className: "table-market__number",
    }),
  ];
}

/* ==========================================================================
   Public Columns
   ========================================================================== */

export function getColumns(config = {}, view = "1") {
  switch (String(view)) {
    case "2":
      return createPriceDataColumns(config);

    case "3":
      return createPerformanceColumns(config);

    case "1":
    default:
      return createOverviewColumns(config);
  }
}

/* ==========================================================================
   Column Groups
   ========================================================================== */

export function getColumnGroups(config = {}, view = "1") {
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
  view = "1",
  visibleGroups = GROUP_ORDER,
) {
  const selected = new Set(visibleGroups);

  return getColumns(config, view).filter((item) => {
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
  view = "1",
  visibleGroups = GROUP_ORDER,
) {
  return getVisibleColumns(config, view, visibleGroups).filter(
    (item) => item.mobile !== false,
  );
}

/* ==========================================================================
   Column Indexes by Group
   ========================================================================== */

export function getColumnIndexesByGroup(config = {}, view = "1") {
  return getColumns(config, view).reduce((result, column, index) => {
    const groupId = column.visibilityGroup;

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
   Header Groups
   ========================================================================== */

export function getHeaderGroups(
  config = {},
  view = "1",
  visibleGroups = GROUP_ORDER,
) {
  const groups = createGroups(config);

  const columns = getColumns(config, view);

  const selected = new Set(visibleGroups);

  return GROUP_ORDER.filter((groupId) => selected.has(groupId))
    .map((groupId) => {
      const groupColumns = columns.filter(
        (column) => column.headerGroup === groupId,
      );

      if (!groupColumns.length) {
        return null;
      }

      return {
        ...groups[groupId],

        columnCount: groupColumns.length,
      };
    })
    .filter(Boolean);
}

/* ==========================================================================
   Column Lookup
   ========================================================================== */

export function getColumnByKey(config = {}, view = "1", key) {
  return getColumns(config, view).find((column) => column.key === key) || null;
}
