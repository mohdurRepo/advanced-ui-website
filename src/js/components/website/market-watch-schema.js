/* ==========================================================================
   Market Watch Schema
   ========================================================================== */

/*
 * One source of truth for:
 *
 * - Market Watch table views
 * - DataTables column widths
 * - grouped headers
 * - Show/Hide Column groups
 * - desktop and mobile field visibility
 *
 * This module has no:
 *
 * - DOM code
 * - DataTables initialization
 * - AJAX code
 * - markup rendering
 */

const GROUP_ORDER = [
  "range",
  "last-trade",
  "cumulative",
  "trading",
  "best-bid",
  "best-offer",
];

/*
 * These are intentionally compact enough for the Overview table to fit a
 * standard desktop content region before horizontal navigation is needed.
 *
 * DataTables receives the same width for width, minWidth, and maxWidth so
 * initial and post-filter measurements do not drift apart.
 */

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

function cleanLabel(value, fallback = "") {
  return String(value ?? fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTableLabels(config = {}) {
  return config.labels?.table || {};
}

function createGroups(config = {}) {
  const labels = getTableLabels(config);

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

function column(definition) {
  return {
    orderable: false,
    searchable: false,
    mobile: true,
    ...definition,
  };
}

function fixedWidth(width, definition) {
  return column({
    width,
    minWidth: width,
    maxWidth: width,
    ...definition,
  });
}

/* ==========================================================================
   Reusable Column Definitions
   ========================================================================== */

function createCompanyColumn(labels) {
  return fixedWidth(WIDTHS.company, {
    key: "company",
    label: cleanLabel(labels.company, "Company"),
    type: "company",
    className: "table-market__security",
    mobile: false,
    fixed: true,
  });
}

function createRangeColumn(labels) {
  return fixedWidth(WIDTHS.range, {
    key: "range",
    visibilityGroup: "range",
    label: cleanLabel(labels.range, "52 Week Range"),
    type: "range",
    className: "table-market__range",
    mobileFullWidth: true,
  });
}

function createLastTradePriceColumn(labels, options = {}) {
  return fixedWidth(WIDTHS.price, {
    key: "last-trade-price",
    visibilityGroup: "last-trade",
    headerGroup: options.headerGroup ? "last-trade" : undefined,
    label: cleanLabel(labels.price, "Price"),
    data: "lastTradePriceModified",
    type: "auction-value",
    className: "table-market__price table-market__number",
  });
}

function createChangeValueColumn(labels, options = {}) {
  return fixedWidth(WIDTHS.change, {
    key: "change-value",
    visibilityGroup: "last-trade",
    headerGroup: options.headerGroup ? "last-trade" : undefined,
    label: cleanLabel(labels.changeValue, "Change Value"),
    data: "netChangeModified",
    numericData: "netChange",
    type: "change",
    className: "table-market__change table-market__number",
  });
}

function createChangePercentColumn(labels, options = {}) {
  return fixedWidth(WIDTHS.change, {
    key: "change-percent",
    visibilityGroup: "last-trade",
    headerGroup: options.headerGroup ? "last-trade" : undefined,
    label: cleanLabel(labels.changePercent, "Change %"),
    data: "precentChangeModified",
    numericData: "precentChange",
    type: "percent-change",
    className: "table-market__change table-market__number",
  });
}

function createTradingColumns(labels, options = {}) {
  const headerGroup = options.headerGroup ? "trading" : undefined;

  return [
    fixedWidth(WIDTHS.tradingPrice, {
      key: "open",
      visibilityGroup: "trading",
      headerGroup,
      label: cleanLabel(labels.open, "Open"),
      data: "todayOpenModified",
      type: "auction-value",
      className: "table-market__number",
    }),

    fixedWidth(WIDTHS.tradingPrice, {
      key: "high",
      visibilityGroup: "trading",
      headerGroup,
      label: cleanLabel(labels.high, "High"),
      data: "highPriceModified",
      type: "auction-value",
      className: "table-market__number",
    }),

    fixedWidth(WIDTHS.tradingPrice, {
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
  const labels = getTableLabels(config);

  return [
    createCompanyColumn(labels),
    createRangeColumn(labels),

    createLastTradePriceColumn(labels, {
      headerGroup: true,
    }),

    fixedWidth(WIDTHS.quantity, {
      key: "last-trade-volume",
      visibilityGroup: "last-trade",
      headerGroup: "last-trade",
      label: cleanLabel(labels.volume, "Volume"),
      data: "lastTradeQuantity",
      type: "auction-quantity",
      className: "table-market__volume table-market__number",
    }),

    createChangeValueColumn(labels, {
      headerGroup: true,
    }),

    createChangePercentColumn(labels, {
      headerGroup: true,
    }),

    fixedWidth(WIDTHS.trades, {
      key: "number-of-trades",
      visibilityGroup: "cumulative",
      headerGroup: "cumulative",
      label: cleanLabel(labels.numberOfTrades, "No. of Trades"),
      data: "nuOfTrades",
      type: "auction-full-number",
      className: "table-market__trades table-market__number",
    }),

    fixedWidth(WIDTHS.volumeTraded, {
      key: "volume-traded",
      visibilityGroup: "cumulative",
      headerGroup: "cumulative",
      label: cleanLabel(labels.volumeTraded, "Volume Traded"),
      data: "volumeTraded",
      type: "auction-full-number",
      className: "table-market__volume-traded table-market__number",
    }),

    ...createTradingColumns(labels, {
      headerGroup: true,
    }),

    fixedWidth(WIDTHS.bidOfferPrice, {
      key: "best-bid-price",
      visibilityGroup: "best-bid",
      headerGroup: "best-bid",
      label: cleanLabel(labels.price, "Price"),
      data: "bidPriceModified",
      type: "market-order",
      className: "table-market__number",
    }),

    fixedWidth(WIDTHS.bidOfferVolume, {
      key: "best-bid-volume",
      visibilityGroup: "best-bid",
      headerGroup: "best-bid",
      label: cleanLabel(labels.volume, "Volume"),
      data: "bidQuantity",
      type: "auction-full-number",
      className: "table-market__number",
      mobileLabel: cleanLabel(labels.volume, "Volume"),
    }),

    fixedWidth(WIDTHS.bidOfferPrice, {
      key: "best-offer-price",
      visibilityGroup: "best-offer",
      headerGroup: "best-offer",
      label: cleanLabel(labels.price, "Price"),
      data: "askPriceModified",
      type: "market-order",
      className: "table-market__number",
    }),

    fixedWidth(WIDTHS.bidOfferVolume, {
      key: "best-offer-volume",
      visibilityGroup: "best-offer",
      headerGroup: "best-offer",
      label: cleanLabel(labels.volume, "Volume"),
      data: "askQuantityModified",
      type: "auction-full-number",
      className: "table-market__number",
      mobileLabel: cleanLabel(labels.volume, "Volume"),
    }),
  ];
}

/* ==========================================================================
   Price Data
   ========================================================================== */

/*
 * Price Data intentionally uses the same two-row grouped-header pattern as
 * Overview:
 *
 * Company | Range | Last Trade | Today's Trading
 */

function createPriceDataColumns(config = {}) {
  const labels = getTableLabels(config);

  return [
    createCompanyColumn(labels),
    createRangeColumn(labels),

    createLastTradePriceColumn(labels, {
      headerGroup: true,
    }),

    createChangeValueColumn(labels, {
      headerGroup: true,
    }),

    createChangePercentColumn(labels, {
      headerGroup: true,
    }),

    ...createTradingColumns(labels, {
      headerGroup: true,
    }),
  ];
}

/* ==========================================================================
   Performance
   ========================================================================== */

function createPerformanceColumns(config = {}) {
  const labels = getTableLabels(config);

  return [
    fixedWidth(WIDTHS.sector, {
      key: "sector",
      label: cleanLabel(labels.sector, "Sector"),
      data: "sectorName",
      type: "text",
      className: "table-market__text",
      fixed: true,
    }),

    fixedWidth(WIDTHS.symbol, {
      key: "symbol",
      label: cleanLabel(labels.symbol, "Symbol"),
      data: "companySymbol",
      type: "text",
      className: "table-market__number",
    }),

    createCompanyColumn(labels),

    createRangeColumn(labels),

    fixedWidth(WIDTHS.marketCap, {
      key: "market-cap",
      label: cleanLabel(labels.marketCap, "Market Cap"),
      data: "marketCap",
      type: "full-number",
      className: "table-market__number",
    }),

    fixedWidth(WIDTHS.performanceValue, {
      key: "per",
      label: cleanLabel(labels.per, "P/E"),
      data: "PER",
      type: "text",
      className: "table-market__number",
    }),

    fixedWidth(WIDTHS.quantity, {
      key: "volume",
      visibilityGroup: "cumulative",
      label: cleanLabel(labels.volume, "Volume"),
      data: "lastTradeQuantity",
      type: "auction-full-number",
      className: "table-market__number",
    }),

    fixedWidth(WIDTHS.performanceValue, {
      key: "yield",
      label: cleanLabel(labels.yield, "Yield"),
      data: "yield",
      type: "text",
      className: "table-market__number",
    }),
  ];
}

/* ==========================================================================
   Public API
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

export function getColumnGroups(config = {}, view = "1") {
  const groups = createGroups(config);
  const columns = getColumns(config, view);

  const availableGroupIds = new Set(
    columns.map((item) => item.visibilityGroup).filter(Boolean),
  );

  return GROUP_ORDER.filter((groupId) => {
    return availableGroupIds.has(groupId);
  }).map((groupId) => groups[groupId]);
}

export function getVisibleColumns(
  config = {},
  view = "1",
  visibleGroups = GROUP_ORDER,
) {
  const selectedGroups = new Set(visibleGroups);

  return getColumns(config, view).filter((item) => {
    if (!item.visibilityGroup) {
      return true;
    }

    return selectedGroups.has(item.visibilityGroup);
  });
}

export function getColumnIndexesByGroup(config = {}, view = "1") {
  return getColumns(config, view).reduce((groups, item, index) => {
    if (!item.visibilityGroup) {
      return groups;
    }

    if (!groups[item.visibilityGroup]) {
      groups[item.visibilityGroup] = [];
    }

    groups[item.visibilityGroup].push(index);

    return groups;
  }, {});
}

export function getHeaderGroups(
  config = {},
  view = "1",
  visibleGroups = GROUP_ORDER,
) {
  const groups = createGroups(config);
  const selectedGroups = new Set(visibleGroups);

  return GROUP_ORDER.filter((groupId) => selectedGroups.has(groupId))
    .map((groupId) => {
      const columns = getColumns(config, view).filter((item) => {
        return item.headerGroup === groupId;
      });

      if (!columns.length) {
        return null;
      }

      return {
        ...groups[groupId],
        columnCount: columns.length,
      };
    })
    .filter(Boolean);
}

export function getMobileColumns(
  config = {},
  view = "1",
  visibleGroups = GROUP_ORDER,
) {
  return getVisibleColumns(config, view, visibleGroups).filter((item) => {
    return item.mobile;
  });
}

export function getColumnByKey(config = {}, view = "1", key) {
  return (
    getColumns(config, view).find((item) => {
      return item.key === key;
    }) || null
  );
}
