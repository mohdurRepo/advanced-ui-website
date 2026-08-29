/* ==========================================================================
   Market Watch Columns
   ========================================================================== */

/*
 * Column and view definitions for Market Watch.
 *
 * Responsibilities:
 *
 * - define supported Market Watch table views
 * - normalize table-view values
 * - define column order and widths
 * - define visibility groups
 * - define grouped table headings
 * - define backend-field mappings
 * - define rendering-type metadata
 * - define mobile field availability
 * - expose column/group lookup helpers
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - DataTables lifecycle
 * - request logic
 * - response normalization
 * - filter event handling
 * - table-cell rendering
 * - mobile card markup
 */

/* ==========================================================================
   Views
   ========================================================================== */

/*
 * Preserve the existing backend values:
 *
 * 1 -> Overview
 * 2 -> Price Data / Trading
 * 3 -> Performance
 *
 * Named aliases are accepted because page markup may use descriptive values
 * such as "overview", "trading", and "performance".
 */

export const MARKET_WATCH_VIEWS = Object.freeze({
  overview: "1",
  priceData: "2",
  performance: "3",
});

export function normalizeMarketWatchView(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "2":
    case "price-data":
    case "pricedata":
    case "trading":
      return MARKET_WATCH_VIEWS.priceData;

    case "3":
    case "performance":
      return MARKET_WATCH_VIEWS.performance;

    case "1":
    case "overview":
    default:
      return MARKET_WATCH_VIEWS.overview;
  }
}

/* ==========================================================================
   Visibility Groups
   ========================================================================== */

export const MARKET_WATCH_COLUMN_GROUPS = Object.freeze({
  range: "range",
  lastTrade: "last-trade",
  cumulative: "cumulative",
  trading: "trading",
  bestBid: "best-bid",
  bestOffer: "best-offer",
});

export const MARKET_WATCH_COLUMN_GROUP_ORDER = Object.freeze([
  MARKET_WATCH_COLUMN_GROUPS.range,
  MARKET_WATCH_COLUMN_GROUPS.lastTrade,
  MARKET_WATCH_COLUMN_GROUPS.cumulative,
  MARKET_WATCH_COLUMN_GROUPS.trading,
  MARKET_WATCH_COLUMN_GROUPS.bestBid,
  MARKET_WATCH_COLUMN_GROUPS.bestOffer,
]);

/* ==========================================================================
   Column Widths
   ========================================================================== */

const COLUMN_WIDTHS = Object.freeze({
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
   General Helpers
   ========================================================================== */

function normalizeString(value) {
  return String(value ?? "").trim();
}

function cleanLabel(value, fallback = "") {
  return normalizeString(value || fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTableLabels(config = {}) {
  return config?.labels?.table ?? {};
}

function createColumn(definition = {}) {
  return {
    mobile: true,

    ...definition,
  };
}

function createSizedColumn(width, definition = {}) {
  return createColumn({
    width,

    ...definition,
  });
}

/* ==========================================================================
   Group Definitions
   ========================================================================== */

function createColumnGroups(config = {}) {
  const labels = getTableLabels(config);

  return {
    [MARKET_WATCH_COLUMN_GROUPS.range]: {
      id: MARKET_WATCH_COLUMN_GROUPS.range,

      label: cleanLabel(labels.range, "52 Week Range"),
    },

    [MARKET_WATCH_COLUMN_GROUPS.lastTrade]: {
      id: MARKET_WATCH_COLUMN_GROUPS.lastTrade,

      label: cleanLabel(labels.lastTrade, "Last Trade"),
    },

    [MARKET_WATCH_COLUMN_GROUPS.cumulative]: {
      id: MARKET_WATCH_COLUMN_GROUPS.cumulative,

      label: cleanLabel(labels.cumulative, "Cumulative"),
    },

    [MARKET_WATCH_COLUMN_GROUPS.trading]: {
      id: MARKET_WATCH_COLUMN_GROUPS.trading,

      label: cleanLabel(labels.trading, "Today's Trading"),
    },

    [MARKET_WATCH_COLUMN_GROUPS.bestBid]: {
      id: MARKET_WATCH_COLUMN_GROUPS.bestBid,

      label: cleanLabel(labels.bestBid, "Best Bid"),
    },

    [MARKET_WATCH_COLUMN_GROUPS.bestOffer]: {
      id: MARKET_WATCH_COLUMN_GROUPS.bestOffer,

      label: cleanLabel(labels.bestOffer, "Best Offer"),
    },
  };
}

/* ==========================================================================
   Shared Columns
   ========================================================================== */

function createCompanyColumn(labels) {
  return createSizedColumn(COLUMN_WIDTHS.company, {
    key: "company",

    label: cleanLabel(labels.company, "Company"),

    type: "company",

    className: "table-market__security",

    /*
     * Company identity is already rendered in the mobile card summary.
     */
    mobile: false,
  });
}

function createRangeColumn(labels) {
  return createSizedColumn(COLUMN_WIDTHS.range, {
    key: "range",

    visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.range,

    label: cleanLabel(labels.range, "52 Week Range"),

    type: "range",

    className: "table-market__range",
  });
}

function createLastTradePriceColumn(labels, { grouped = false } = {}) {
  return createSizedColumn(COLUMN_WIDTHS.price, {
    key: "last-trade-price",

    visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.lastTrade,

    headerGroup: grouped ? MARKET_WATCH_COLUMN_GROUPS.lastTrade : undefined,

    label: cleanLabel(labels.price, "Price"),

    data: "lastTradePriceModified",

    type: "auction-value",

    className: "table-market__price table-market__number",
  });
}

function createChangeValueColumn(labels, { grouped = false } = {}) {
  return createSizedColumn(COLUMN_WIDTHS.change, {
    key: "change-value",

    visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.lastTrade,

    headerGroup: grouped ? MARKET_WATCH_COLUMN_GROUPS.lastTrade : undefined,

    label: cleanLabel(labels.changeValue, "Change Value"),

    data: "netChangeModified",

    numericData: "netChange",

    type: "change",

    className: "table-market__change table-market__number",
  });
}

function createChangePercentColumn(labels, { grouped = false } = {}) {
  return createSizedColumn(COLUMN_WIDTHS.change, {
    key: "change-percent",

    visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.lastTrade,

    headerGroup: grouped ? MARKET_WATCH_COLUMN_GROUPS.lastTrade : undefined,

    label: cleanLabel(labels.changePercent, "Change %"),

    /*
     * Preserve the existing backend field names exactly.
     */
    data: "precentChangeModified",

    numericData: "precentChange",

    type: "percent-change",

    className: "table-market__change table-market__number",
  });
}

function createTradingColumns(labels, { grouped = false } = {}) {
  const headerGroup = grouped ? MARKET_WATCH_COLUMN_GROUPS.trading : undefined;

  return [
    createSizedColumn(COLUMN_WIDTHS.tradingPrice, {
      key: "open",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.trading,

      headerGroup,

      label: cleanLabel(labels.open, "Open"),

      data: "todayOpenModified",

      type: "auction-value",

      className: "table-market__number",
    }),

    createSizedColumn(COLUMN_WIDTHS.tradingPrice, {
      key: "high",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.trading,

      headerGroup,

      label: cleanLabel(labels.high, "High"),

      data: "highPriceModified",

      type: "auction-value",

      className: "table-market__number",
    }),

    createSizedColumn(COLUMN_WIDTHS.tradingPrice, {
      key: "low",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.trading,

      headerGroup,

      label: cleanLabel(labels.low, "Low"),

      data: "lowPriceModified",

      type: "auction-value",

      className: "table-market__number",
    }),
  ];
}

/* ==========================================================================
   Overview View
   ========================================================================== */

function createOverviewColumns(config = {}) {
  const labels = getTableLabels(config);

  return [
    createCompanyColumn(labels),

    createRangeColumn(labels),

    createLastTradePriceColumn(labels, {
      grouped: true,
    }),

    createSizedColumn(COLUMN_WIDTHS.quantity, {
      key: "last-trade-volume",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.lastTrade,

      headerGroup: MARKET_WATCH_COLUMN_GROUPS.lastTrade,

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

    createSizedColumn(COLUMN_WIDTHS.trades, {
      key: "number-of-trades",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.cumulative,

      headerGroup: MARKET_WATCH_COLUMN_GROUPS.cumulative,

      label: cleanLabel(labels.numberOfTrades, "No. of Trades"),

      data: "nuOfTrades",

      type: "auction-full-number",

      className: "table-market__trades table-market__number",
    }),

    createSizedColumn(COLUMN_WIDTHS.volumeTraded, {
      key: "volume-traded",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.cumulative,

      headerGroup: MARKET_WATCH_COLUMN_GROUPS.cumulative,

      label: cleanLabel(labels.volumeTraded, "Volume Traded"),

      data: "volumeTraded",

      type: "auction-full-number",

      className: "table-market__volume-traded table-market__number",
    }),

    ...createTradingColumns(labels, {
      grouped: true,
    }),

    createSizedColumn(COLUMN_WIDTHS.bidOfferPrice, {
      key: "best-bid-price",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.bestBid,

      headerGroup: MARKET_WATCH_COLUMN_GROUPS.bestBid,

      label: cleanLabel(labels.price, "Price"),

      data: "bidPriceModified",

      type: "market-order",

      className: "table-market__number",
    }),

    createSizedColumn(COLUMN_WIDTHS.bidOfferVolume, {
      key: "best-bid-volume",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.bestBid,

      headerGroup: MARKET_WATCH_COLUMN_GROUPS.bestBid,

      label: cleanLabel(labels.volume, "Volume"),

      mobileLabel: cleanLabel(labels.volume, "Volume"),

      data: "bidQuantity",

      type: "auction-full-number",

      className: "table-market__number",
    }),

    createSizedColumn(COLUMN_WIDTHS.bidOfferPrice, {
      key: "best-offer-price",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.bestOffer,

      headerGroup: MARKET_WATCH_COLUMN_GROUPS.bestOffer,

      label: cleanLabel(labels.price, "Price"),

      data: "askPriceModified",

      type: "market-order",

      className: "table-market__number",
    }),

    createSizedColumn(COLUMN_WIDTHS.bidOfferVolume, {
      key: "best-offer-volume",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.bestOffer,

      headerGroup: MARKET_WATCH_COLUMN_GROUPS.bestOffer,

      label: cleanLabel(labels.volume, "Volume"),

      mobileLabel: cleanLabel(labels.volume, "Volume"),

      data: "askQuantityModified",

      type: "auction-full-number",

      className: "table-market__number",
    }),
  ];
}

/* ==========================================================================
   Price Data / Trading View
   ========================================================================== */

function createPriceDataColumns(config = {}) {
  const labels = getTableLabels(config);

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
   Performance View
   ========================================================================== */

/*
 * Performance intentionally starts with Sector.
 *
 * Therefore, when the table uses:
 *
 *     fixedColumns: 1
 *
 * Sector is the fixed column for this view.
 *
 * If a future requirement says Company must always be fixed, that behavior
 * belongs in the table configuration rather than in these column definitions.
 */

function createPerformanceColumns(config = {}) {
  const labels = getTableLabels(config);

  return [
    createSizedColumn(COLUMN_WIDTHS.sector, {
      key: "sector",

      label: cleanLabel(labels.sector, "Sector"),

      data: "sectorName",

      type: "text",

      className: "table-market__text",
    }),

    createSizedColumn(COLUMN_WIDTHS.symbol, {
      key: "symbol",

      label: cleanLabel(labels.symbol, "Symbol"),

      data: "companySymbol",

      type: "text",

      className: "table-market__number",
    }),

    createCompanyColumn(labels),

    createRangeColumn(labels),

    createSizedColumn(COLUMN_WIDTHS.marketCap, {
      key: "market-cap",

      label: cleanLabel(labels.marketCap, "Market Cap"),

      data: "marketCap",

      type: "full-number",

      className: "table-market__number",
    }),

    createSizedColumn(COLUMN_WIDTHS.performanceValue, {
      key: "per",

      label: cleanLabel(labels.per, "P/E"),

      /*
       * Preserve the backend's existing case-sensitive property.
       */
      data: "PER",

      type: "text",

      className: "table-market__number",
    }),

    createSizedColumn(COLUMN_WIDTHS.quantity, {
      key: "volume",

      visibilityGroup: MARKET_WATCH_COLUMN_GROUPS.cumulative,

      label: cleanLabel(labels.volume, "Volume"),

      data: "lastTradeQuantity",

      type: "auction-full-number",

      className: "table-market__number",
    }),

    createSizedColumn(COLUMN_WIDTHS.performanceValue, {
      key: "yield",

      label: cleanLabel(labels.yield, "Yield"),

      data: "yield",

      type: "text",

      className: "table-market__number",
    }),
  ];
}

/* ==========================================================================
   Columns
   ========================================================================== */

export function getMarketWatchColumns(
  config = {},
  view = MARKET_WATCH_VIEWS.overview,
) {
  switch (normalizeMarketWatchView(view)) {
    case MARKET_WATCH_VIEWS.priceData:
      return createPriceDataColumns(config);

    case MARKET_WATCH_VIEWS.performance:
      return createPerformanceColumns(config);

    case MARKET_WATCH_VIEWS.overview:
    default:
      return createOverviewColumns(config);
  }
}

/* ==========================================================================
   Available Visibility Groups
   ========================================================================== */

export function getMarketWatchAvailableGroups(
  config = {},
  view = MARKET_WATCH_VIEWS.overview,
) {
  const availableGroups = new Set(
    getMarketWatchColumns(config, view)
      .map((column) => column.visibilityGroup)
      .filter(Boolean),
  );

  return MARKET_WATCH_COLUMN_GROUP_ORDER.filter((groupId) =>
    availableGroups.has(groupId),
  );
}

/* ==========================================================================
   Column Groups
   ========================================================================== */

export function getMarketWatchColumnGroups(
  config = {},
  view = MARKET_WATCH_VIEWS.overview,
) {
  const groups = createColumnGroups(config);

  return getMarketWatchAvailableGroups(config, view).map(
    (groupId) => groups[groupId],
  );
}

/* ==========================================================================
   Visible Columns
   ========================================================================== */

export function getMarketWatchVisibleColumns(
  config = {},
  view = MARKET_WATCH_VIEWS.overview,
  visibleGroups = MARKET_WATCH_COLUMN_GROUP_ORDER,
) {
  const selectedGroups = new Set(
    Array.isArray(visibleGroups)
      ? visibleGroups
      : MARKET_WATCH_COLUMN_GROUP_ORDER,
  );

  return getMarketWatchColumns(config, view).filter((column) => {
    if (!column.visibilityGroup) {
      return true;
    }

    return selectedGroups.has(column.visibilityGroup);
  });
}

/* ==========================================================================
   Mobile Columns
   ========================================================================== */

export function getMarketWatchMobileColumns(
  config = {},
  view = MARKET_WATCH_VIEWS.overview,
  visibleGroups = MARKET_WATCH_COLUMN_GROUP_ORDER,
) {
  return getMarketWatchVisibleColumns(config, view, visibleGroups).filter(
    (column) => column.mobile !== false,
  );
}

/* ==========================================================================
   Column Indexes by Visibility Group
   ========================================================================== */

export function getMarketWatchColumnIndexesByGroup(
  config = {},
  view = MARKET_WATCH_VIEWS.overview,
) {
  return getMarketWatchColumns(config, view).reduce(
    (indexesByGroup, column, index) => {
      const groupId = column.visibilityGroup;

      if (!groupId) {
        return indexesByGroup;
      }

      if (!indexesByGroup[groupId]) {
        indexesByGroup[groupId] = [];
      }

      indexesByGroup[groupId].push(index);

      return indexesByGroup;
    },
    {},
  );
}

/* ==========================================================================
   Header Groups
   ========================================================================== */

export function getMarketWatchHeaderGroups(
  config = {},
  view = MARKET_WATCH_VIEWS.overview,
  visibleGroups = MARKET_WATCH_COLUMN_GROUP_ORDER,
) {
  const groups = createColumnGroups(config);

  const columns = getMarketWatchColumns(config, view);

  const selectedGroups = new Set(
    Array.isArray(visibleGroups)
      ? visibleGroups
      : MARKET_WATCH_COLUMN_GROUP_ORDER,
  );

  return MARKET_WATCH_COLUMN_GROUP_ORDER.filter((groupId) =>
    selectedGroups.has(groupId),
  )
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

export function getMarketWatchColumnByKey(
  config = {},
  view = MARKET_WATCH_VIEWS.overview,
  key,
) {
  const normalizedKey = normalizeString(key);

  if (!normalizedKey) {
    return null;
  }

  return (
    getMarketWatchColumns(config, view).find(
      (column) => column.key === normalizedKey,
    ) ?? null
  );
}
