/* ==========================================================================
   Market Watch Schema
   ========================================================================== */

/*
 * One source of truth for:
 *
 * - table-view column models
 * - DataTables widths
 * - grouped headers
 * - Show/Hide Column groups
 * - desktop and mobile field visibility
 */

const GROUP_ORDER = [
  "range",
  "last-trade",
  "cumulative",
  "trading",
  "best-bid",
  "best-offer",
];

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

function joinClasses(...values) {
  return values
    .flatMap((value) => String(value || "").split(/\s+/))
    .filter(Boolean)
    .filter((value, index, classes) => classes.indexOf(value) === index)
    .join(" ");
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

function numericColumn(width, definition) {
  return fixedWidth(width, {
    ...definition,
    className: joinClasses(
      definition.className,
      "table-market__number",
      "text-end",
    ),
  });
}

/* ==========================================================================
   Reusable Columns
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
  return numericColumn(WIDTHS.price, {
    key: "last-trade-price",
    visibilityGroup: "last-trade",
    headerGroup: options.headerGroup ? "last-trade" : undefined,
    label: cleanLabel(labels.price, "Price"),
    data: "lastTradePriceModified",
    type: "auction-value",
    className: "table-market__price",
  });
}

function createChangeValueColumn(labels, options = {}) {
  return numericColumn(WIDTHS.change, {
    key: "change-value",
    visibilityGroup: "last-trade",
    headerGroup: options.headerGroup ? "last-trade" : undefined,
    label: cleanLabel(labels.changeValue, "Change Value"),
    data: "netChangeModified",
    numericData: "netChange",
    type: "change",
    className: "table-market__change",
  });
}

function createChangePercentColumn(labels, options = {}) {
  return numericColumn(WIDTHS.change, {
    key: "change-percent",
    visibilityGroup: "last-trade",
    headerGroup: options.headerGroup ? "last-trade" : undefined,
    label: cleanLabel(labels.changePercent, "Change %"),
    data: "precentChangeModified",
    numericData: "precentChange",
    type: "percent-change",
    className: "table-market__change",
  });
}

function createTradingColumns(labels, options = {}) {
  const headerGroup = options.headerGroup ? "trading" : undefined;

  return [
    numericColumn(WIDTHS.tradingPrice, {
      key: "open",
      visibilityGroup: "trading",
      headerGroup,
      label: cleanLabel(labels.open, "Open"),
      data: "todayOpenModified",
      type: "auction-value",
    }),

    numericColumn(WIDTHS.tradingPrice, {
      key: "high",
      visibilityGroup: "trading",
      headerGroup,
      label: cleanLabel(labels.high, "High"),
      data: "highPriceModified",
      type: "auction-value",
    }),

    numericColumn(WIDTHS.tradingPrice, {
      key: "low",
      visibilityGroup: "trading",
      headerGroup,
      label: cleanLabel(labels.low, "Low"),
      data: "lowPriceModified",
      type: "auction-value",
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

    numericColumn(WIDTHS.quantity, {
      key: "last-trade-volume",
      visibilityGroup: "last-trade",
      headerGroup: "last-trade",
      label: cleanLabel(labels.volume, "Volume"),
      data: "lastTradeQuantity",
      type: "auction-quantity",
      className: "table-market__volume",
    }),

    createChangeValueColumn(labels, {
      headerGroup: true,
    }),

    createChangePercentColumn(labels, {
      headerGroup: true,
    }),

    numericColumn(WIDTHS.trades, {
      key: "number-of-trades",
      visibilityGroup: "cumulative",
      headerGroup: "cumulative",
      label: cleanLabel(labels.numberOfTrades, "No. of Trades"),
      data: "nuOfTrades",
      type: "auction-full-number",
      className: "table-market__trades",
    }),

    numericColumn(WIDTHS.volumeTraded, {
      key: "volume-traded",
      visibilityGroup: "cumulative",
      headerGroup: "cumulative",
      label: cleanLabel(labels.volumeTraded, "Volume Traded"),
      data: "volumeTraded",
      type: "auction-full-number",
      className: "table-market__volume-traded",
    }),

    ...createTradingColumns(labels, {
      headerGroup: true,
    }),

    numericColumn(WIDTHS.bidOfferPrice, {
      key: "best-bid-price",
      visibilityGroup: "best-bid",
      headerGroup: "best-bid",
      label: cleanLabel(labels.price, "Price"),
      data: "bidPriceModified",
      type: "market-order",
    }),

    numericColumn(WIDTHS.bidOfferVolume, {
      key: "best-bid-volume",
      visibilityGroup: "best-bid",
      headerGroup: "best-bid",
      label: cleanLabel(labels.volume, "Volume"),
      data: "bidQuantity",
      type: "auction-full-number",
      mobileLabel: cleanLabel(labels.volume, "Volume"),
    }),

    numericColumn(WIDTHS.bidOfferPrice, {
      key: "best-offer-price",
      visibilityGroup: "best-offer",
      headerGroup: "best-offer",
      label: cleanLabel(labels.price, "Price"),
      data: "askPriceModified",
      type: "market-order",
    }),

    numericColumn(WIDTHS.bidOfferVolume, {
      key: "best-offer-volume",
      visibilityGroup: "best-offer",
      headerGroup: "best-offer",
      label: cleanLabel(labels.volume, "Volume"),
      data: "askQuantityModified",
      type: "auction-full-number",
      mobileLabel: cleanLabel(labels.volume, "Volume"),
    }),
  ];
}

/* ==========================================================================
   Price Data
   ========================================================================== */

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
      className: "table-market__symbol",
    }),

    createCompanyColumn(labels),
    createRangeColumn(labels),

    numericColumn(WIDTHS.marketCap, {
      key: "market-cap",
      label: cleanLabel(labels.marketCap, "Market Cap"),
      data: "marketCap",
      type: "full-number",
    }),

    numericColumn(WIDTHS.performanceValue, {
      key: "per",
      label: cleanLabel(labels.per, "P/E"),
      data: "PER",
      type: "text",
    }),

    numericColumn(WIDTHS.quantity, {
      key: "volume",
      visibilityGroup: "cumulative",
      label: cleanLabel(labels.volume, "Volume"),
      data: "lastTradeQuantity",
      type: "auction-full-number",
    }),

    numericColumn(WIDTHS.performanceValue, {
      key: "yield",
      label: cleanLabel(labels.yield, "Yield"),
      data: "yield",
      type: "text",
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
    columns.map((column) => column.visibilityGroup).filter(Boolean),
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

  return getColumns(config, view).filter((column) => {
    return (
      !column.visibilityGroup || selectedGroups.has(column.visibilityGroup)
    );
  });
}

export function getColumnIndexesByGroup(config = {}, view = "1") {
  return getColumns(config, view).reduce((groups, column, index) => {
    if (!column.visibilityGroup) {
      return groups;
    }

    if (!groups[column.visibilityGroup]) {
      groups[column.visibilityGroup] = [];
    }

    groups[column.visibilityGroup].push(index);

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
      const columns = getColumns(config, view).filter((column) => {
        return column.headerGroup === groupId;
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
  return getVisibleColumns(config, view, visibleGroups).filter((column) => {
    return column.mobile;
  });
}

export function getColumnByKey(config = {}, view = "1", key) {
  return getColumns(config, view).find((column) => column.key === key) || null;
}
