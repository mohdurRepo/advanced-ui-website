/* ==========================================================================
   Market Watch Schema
   ========================================================================== */

/*
 * One source of truth for:
 * - Market Watch table views
 * - table columns and widths
 * - grouped headers
 * - column-picker groups
 * - desktop and mobile field visibility
 *
 * This module has no:
 * - DOM code
 * - DataTables initialization
 * - AJAX code
 * - formatting markup
 */

const GROUP_ORDER = [
  "range",
  "last-trade",
  "cumulative",
  "trading",
  "best-bid",
  "best-offer",
];

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

/* ==========================================================================
   Views
   ========================================================================== */

function createOverviewColumns(config = {}) {
  const labels = getTableLabels(config);

  return [
    column({
      key: "company",
      label: cleanLabel(labels.company, "Company"),
      type: "company",
      className: "table-market__security",
      width: "16rem",
      minWidth: "16rem",
      maxWidth: "16rem",
      mobile: false,
      fixed: true,
    }),

    column({
      key: "range",
      visibilityGroup: "range",
      label: cleanLabel(labels.range, "52 Week Range"),
      type: "range",
      className: "table-market__range",
      width: "10rem",
      minWidth: "10rem",
      maxWidth: "10rem",
      mobile: true,
      mobileFullWidth: true,
    }),

    column({
      key: "last-trade-price",
      visibilityGroup: "last-trade",
      headerGroup: "last-trade",
      label: cleanLabel(labels.price, "Price"),
      data: "lastTradePriceModified",
      type: "auction-value",
      className: "table-market__price table-market__number",
      width: "5.5rem",
    }),

    column({
      key: "last-trade-volume",
      visibilityGroup: "last-trade",
      headerGroup: "last-trade",
      label: cleanLabel(labels.volume, "Volume"),
      data: "lastTradeQuantity",
      type: "auction-quantity",
      className: "table-market__volume table-market__number",
      width: "6rem",
    }),

    column({
      key: "change-value",
      visibilityGroup: "last-trade",
      headerGroup: "last-trade",
      label: cleanLabel(labels.changeValue, "Change Value"),
      data: "netChangeModified",
      numericData: "netChange",
      type: "change",
      className: "table-market__change table-market__number",
      width: "6rem",
    }),

    column({
      key: "change-percent",
      visibilityGroup: "last-trade",
      headerGroup: "last-trade",
      label: cleanLabel(labels.changePercent, "Change%"),
      data: "precentChangeModified",
      numericData: "precentChange",
      type: "percent-change",
      className: "table-market__change table-market__number",
      width: "6rem",
    }),

    column({
      key: "number-of-trades",
      visibilityGroup: "cumulative",
      headerGroup: "cumulative",
      label: cleanLabel(labels.numberOfTrades, "No. of Trades"),
      data: "nuOfTrades",
      type: "auction-full-number",
      className: "table-market__number",
      width: "6.5rem",
    }),

    column({
      key: "volume-traded",
      visibilityGroup: "cumulative",
      headerGroup: "cumulative",
      label: cleanLabel(labels.volumeTraded, "Volume Traded"),
      data: "volumeTraded",
      type: "auction-full-number",
      className: "table-market__number",
      width: "8rem",
    }),

    column({
      key: "open",
      visibilityGroup: "trading",
      headerGroup: "trading",
      label: cleanLabel(labels.open, "Open"),
      data: "todayOpenModified",
      type: "auction-value",
      className: "table-market__number",
      width: "5.5rem",
    }),

    column({
      key: "high",
      visibilityGroup: "trading",
      headerGroup: "trading",
      label: cleanLabel(labels.high, "High"),
      data: "highPriceModified",
      type: "auction-value",
      className: "table-market__number",
      width: "5.5rem",
    }),

    column({
      key: "low",
      visibilityGroup: "trading",
      headerGroup: "trading",
      label: cleanLabel(labels.low, "Low"),
      data: "lowPriceModified",
      type: "auction-value",
      className: "table-market__number",
      width: "5.5rem",
    }),

    column({
      key: "best-bid-price",
      visibilityGroup: "best-bid",
      headerGroup: "best-bid",
      label: cleanLabel(labels.price, "Price"),
      data: "bidPriceModified",
      type: "market-order",
      className: "table-market__number",
      width: "5.5rem",
    }),

    column({
      key: "best-bid-volume",
      visibilityGroup: "best-bid",
      headerGroup: "best-bid",
      label: cleanLabel(labels.volume, "Volume"),
      data: "bidQuantity",
      type: "auction-full-number",
      className: "table-market__number",
      width: "7rem",
    }),

    column({
      key: "best-offer-price",
      visibilityGroup: "best-offer",
      headerGroup: "best-offer",
      label: cleanLabel(labels.price, "Price"),
      data: "askPriceModified",
      type: "market-order",
      className: "table-market__number",
      width: "5.5rem",
    }),

    column({
      key: "best-offer-volume",
      visibilityGroup: "best-offer",
      headerGroup: "best-offer",
      label: cleanLabel(labels.volume, "Volume"),
      data: "askQuantityModified",
      type: "auction-full-number",
      className: "table-market__number",
      width: "7rem",
    }),
  ];
}

function createTradingColumns(config = {}) {
  const labels = getTableLabels(config);

  return [
    column({
      key: "company",
      label: cleanLabel(labels.company, "Company"),
      type: "company",
      className: "table-market__security",
      width: "16rem",
      minWidth: "16rem",
      maxWidth: "16rem",
      mobile: false,
      fixed: true,
    }),

    column({
      key: "range",
      visibilityGroup: "range",
      label: cleanLabel(labels.range, "52 Week Range"),
      type: "range",
      className: "table-market__range",
      width: "10rem",
      minWidth: "10rem",
      maxWidth: "10rem",
      mobileFullWidth: true,
    }),

    column({
      key: "last-trade-price",
      visibilityGroup: "last-trade",
      label: cleanLabel(labels.price, "Price"),
      data: "lastTradePriceModified",
      type: "auction-value",
      className: "table-market__price table-market__number",
      width: "6rem",
    }),

    column({
      key: "change-value",
      visibilityGroup: "last-trade",
      label: cleanLabel(labels.changeValue, "Change Value"),
      data: "netChangeModified",
      numericData: "netChange",
      type: "change",
      className: "table-market__change table-market__number",
      width: "7rem",
    }),

    column({
      key: "change-percent",
      visibilityGroup: "last-trade",
      label: cleanLabel(labels.changePercent, "Change%"),
      data: "precentChangeModified",
      numericData: "precentChange",
      type: "percent-change",
      className: "table-market__change table-market__number",
      width: "7rem",
    }),

    column({
      key: "open",
      visibilityGroup: "trading",
      label: cleanLabel(labels.open, "Open"),
      data: "todayOpenModified",
      type: "auction-value",
      className: "table-market__number",
      width: "6rem",
    }),

    column({
      key: "high",
      visibilityGroup: "trading",
      label: cleanLabel(labels.high, "High"),
      data: "highPriceModified",
      type: "auction-value",
      className: "table-market__number",
      width: "6rem",
    }),

    column({
      key: "low",
      visibilityGroup: "trading",
      label: cleanLabel(labels.low, "Low"),
      data: "lowPriceModified",
      type: "auction-value",
      className: "table-market__number",
      width: "6rem",
    }),
  ];
}

function createPerformanceColumns(config = {}) {
  const labels = getTableLabels(config);

  return [
    column({
      key: "sector",
      label: cleanLabel(labels.sector, "Sector"),
      data: "sectorName",
      type: "text",
      className: "table-market__text",
      width: "12rem",
      fixed: true,
    }),

    column({
      key: "symbol",
      label: cleanLabel(labels.symbol, "Symbol"),
      data: "companySymbol",
      type: "text",
      className: "table-market__number",
      width: "6rem",
    }),

    column({
      key: "company",
      label: cleanLabel(labels.company, "Company"),
      type: "company",
      className: "table-market__security",
      width: "16rem",
      minWidth: "16rem",
      maxWidth: "16rem",
      mobile: false,
    }),

    column({
      key: "range",
      visibilityGroup: "range",
      label: cleanLabel(labels.range, "52 Week Range"),
      type: "range",
      className: "table-market__range",
      width: "10rem",
      minWidth: "10rem",
      maxWidth: "10rem",
      mobileFullWidth: true,
    }),

    column({
      key: "market-cap",
      label: cleanLabel(labels.marketCap, "Market Cap"),
      data: "marketCap",
      type: "full-number",
      className: "table-market__number",
      width: "10rem",
    }),

    column({
      key: "per",
      label: cleanLabel(labels.per, "P/E"),
      data: "PER",
      type: "text",
      className: "table-market__number",
      width: "6rem",
    }),

    column({
      key: "volume",
      visibilityGroup: "cumulative",
      label: cleanLabel(labels.volume, "Volume"),
      data: "lastTradeQuantity",
      type: "auction-full-number",
      className: "table-market__number",
      width: "8rem",
    }),

    column({
      key: "yield",
      label: cleanLabel(labels.yield, "Yield"),
      data: "yield",
      type: "text",
      className: "table-market__number",
      width: "6rem",
    }),
  ];
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function getColumns(config = {}, view = "1") {
  switch (String(view)) {
    case "2":
      return createTradingColumns(config);

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

  return GROUP_ORDER.filter((groupId) => availableGroupIds.has(groupId)).map(
    (groupId) => groups[groupId],
  );
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
      const columns = getColumns(config, view).filter(
        (item) => item.headerGroup === groupId,
      );

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
  return getVisibleColumns(config, view, visibleGroups).filter(
    (item) => item.mobile,
  );
}

export function getColumnByKey(config = {}, view = "1", key) {
  return getColumns(config, view).find((item) => item.key === key) || null;
}
