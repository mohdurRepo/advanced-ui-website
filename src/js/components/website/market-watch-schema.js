/* ==========================================================================
   Market Watch Schema
   ========================================================================== */

/*
 * One source of truth for:
 *
 * - available table views
 * - column labels and API fields
 * - grouped headers
 * - visible-column picker groups
 * - desktop and mobile column metadata
 *
 * This module intentionally has no DOM, DataTables, jQuery, or API code.
 */

const DEFAULT_VIEW_ID = "1";

const DEFAULT_LABELS = Object.freeze({
  sector: "Sector",
  symbol: "Symbol",
  company: "Company",

  range: "52 Week Range",
  lastTrade: "Last Trade",
  cumulative: "Cumulative",
  trading: "Today's Trading",
  bestBid: "Best Bid",
  bestOffer: "Best Offer",

  price: "Price",
  volume: "Volume",
  changeValue: "Change Value",
  changePercent: "Change%",
  numberOfTrades: "No. of Trades",
  volumeTraded: "Volume Traded",

  open: "Open",
  high: "High",
  low: "Low",

  marketCap: "Market Cap",
  per: "P/E Ratio",
  yield: "Yield",
});

/* ==========================================================================
   Labels
   ========================================================================== */

/*
 * Some legacy properties contain `<br>` for historic table headings.
 * Labels are always plain text in the refactored table; wrapping is CSS-owned.
 */

function cleanLabel(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function labelFor(labels, key) {
  return cleanLabel(labels[key] || DEFAULT_LABELS[key] || key);
}

/* ==========================================================================
   Column Definition
   ========================================================================== */

function defineColumn(definition) {
  return Object.freeze({
    data: null,
    format: "text",

    headerGroup: null,
    visibilityGroup: null,

    /*
     * Market Watch is an information table, not an interactive sorting grid.
     * All columns explicitly remain non-sortable.
     */
    orderable: false,

    pinned: false,

    /*
     * These dimensions are applied by `market-watch-table.js`.
     * They prevent the Company column from becoming full width after all
     * optional groups are temporarily hidden.
     */
    width: null,
    minWidth: null,
    maxWidth: null,

    /*
     * Mobile identity is rendered separately from the mobile detail grid.
     */
    mobilePrimary: false,
    mobile: true,

    ...definition,
  });
}

/* ==========================================================================
   Groups
   ========================================================================== */

function createGroups(labels) {
  return Object.freeze({
    range: Object.freeze({
      id: "range",
      label: labelFor(labels, "range"),
      picker: true,
    }),

    "last-trade": Object.freeze({
      id: "last-trade",
      label: labelFor(labels, "lastTrade"),
      picker: true,
    }),

    cumulative: Object.freeze({
      id: "cumulative",
      label: labelFor(labels, "cumulative"),
      picker: true,
    }),

    trading: Object.freeze({
      id: "trading",
      label: labelFor(labels, "trading"),
      picker: true,
    }),

    "best-bid": Object.freeze({
      id: "best-bid",
      label: labelFor(labels, "bestBid"),
      picker: true,
    }),

    "best-offer": Object.freeze({
      id: "best-offer",
      label: labelFor(labels, "bestOffer"),
      picker: true,
    }),
  });
}

/* ==========================================================================
   Shared Columns
   ========================================================================== */

function createSecurityColumn(labels) {
  return defineColumn({
    key: "security",
    label: labelFor(labels, "company"),
    format: "security",

    pinned: true,

    width: "15.5rem",
    minWidth: "15.5rem",
    maxWidth: "15.5rem",

    mobilePrimary: true,
    mobile: false,
  });
}

function createRangeColumn(labels) {
  return defineColumn({
    key: "range",
    label: labelFor(labels, "range"),
    format: "range",

    visibilityGroup: "range",

    width: "8.5rem",
    minWidth: "8.5rem",
  });
}

/* ==========================================================================
   Views
   ========================================================================== */

function createOverviewColumns(labels) {
  return Object.freeze([
    createSecurityColumn(labels),

    createRangeColumn(labels),

    defineColumn({
      key: "last-price",
      label: labelFor(labels, "price"),
      data: "lastTradePriceModified",
      format: "price",

      headerGroup: "last-trade",
      visibilityGroup: "last-trade",

      width: "6.25rem",
      minWidth: "6.25rem",
    }),

    defineColumn({
      key: "last-volume",
      label: labelFor(labels, "volume"),
      data: "lastTradeQuantity",
      format: "quantity",

      headerGroup: "last-trade",
      visibilityGroup: "last-trade",

      width: "6.5rem",
      minWidth: "6.5rem",
    }),

    defineColumn({
      key: "change-value",
      label: labelFor(labels, "changeValue"),
      data: "netChangeModified",
      format: "change",
      changeField: "netChangeModified",

      headerGroup: "last-trade",
      visibilityGroup: "last-trade",

      width: "6.75rem",
      minWidth: "6.75rem",
    }),

    defineColumn({
      key: "change-percent",
      label: labelFor(labels, "changePercent"),
      data: "precentChangeModified",
      format: "change",
      changeField: "precentChange",
      suffix: "%",

      headerGroup: "last-trade",
      visibilityGroup: "last-trade",

      width: "6.5rem",
      minWidth: "6.5rem",
    }),

    defineColumn({
      key: "trade-count",
      label: labelFor(labels, "numberOfTrades"),
      data: "nuOfTrades",
      format: "full-number",

      headerGroup: "cumulative",
      visibilityGroup: "cumulative",

      width: "7rem",
      minWidth: "7rem",
    }),

    defineColumn({
      key: "traded-volume",
      label: labelFor(labels, "volumeTraded"),
      data: "volumeTraded",
      format: "full-number",

      headerGroup: "cumulative",
      visibilityGroup: "cumulative",

      width: "8.5rem",
      minWidth: "8.5rem",
    }),

    defineColumn({
      key: "open",
      label: labelFor(labels, "open"),
      data: "todayOpenModified",
      format: "price",

      headerGroup: "trading",
      visibilityGroup: "trading",

      width: "6rem",
      minWidth: "6rem",
    }),

    defineColumn({
      key: "high",
      label: labelFor(labels, "high"),
      data: "highPriceModified",
      format: "price",

      headerGroup: "trading",
      visibilityGroup: "trading",

      width: "6rem",
      minWidth: "6rem",
    }),

    defineColumn({
      key: "low",
      label: labelFor(labels, "low"),
      data: "lowPriceModified",
      format: "price",

      headerGroup: "trading",
      visibilityGroup: "trading",

      width: "6rem",
      minWidth: "6rem",
    }),

    defineColumn({
      key: "best-bid-price",
      label: labelFor(labels, "price"),
      data: "bidPriceModified",
      format: "market-order-or-price",

      headerGroup: "best-bid",
      visibilityGroup: "best-bid",

      width: "6.25rem",
      minWidth: "6.25rem",
    }),

    defineColumn({
      key: "best-bid-volume",
      label: labelFor(labels, "volume"),
      data: "bidQuantity",
      format: "full-number",

      headerGroup: "best-bid",
      visibilityGroup: "best-bid",

      width: "7.5rem",
      minWidth: "7.5rem",
    }),

    defineColumn({
      key: "best-offer-price",
      label: labelFor(labels, "price"),
      data: "askPrice",
      format: "market-order-or-price",

      headerGroup: "best-offer",
      visibilityGroup: "best-offer",

      width: "6.25rem",
      minWidth: "6.25rem",
    }),

    defineColumn({
      key: "best-offer-volume",
      label: labelFor(labels, "volume"),
      data: "askQuantityModified",
      format: "full-number",

      headerGroup: "best-offer",
      visibilityGroup: "best-offer",

      width: "7.5rem",
      minWidth: "7.5rem",
    }),
  ]);
}

function createTradingColumns(labels) {
  return Object.freeze([
    createSecurityColumn(labels),

    createRangeColumn(labels),

    defineColumn({
      key: "last-price",
      label: labelFor(labels, "price"),
      data: "lastTradePriceModified",
      format: "price",

      headerGroup: "last-trade",
      visibilityGroup: "last-trade",

      width: "6.5rem",
      minWidth: "6.5rem",
    }),

    defineColumn({
      key: "change-value",
      label: labelFor(labels, "changeValue"),
      data: "netChangeModified",
      format: "change",
      changeField: "netChangeModified",

      headerGroup: "last-trade",
      visibilityGroup: "last-trade",

      width: "7rem",
      minWidth: "7rem",
    }),

    defineColumn({
      key: "change-percent",
      label: labelFor(labels, "changePercent"),
      data: "precentChangeModified",
      format: "change",
      changeField: "precentChange",
      suffix: "%",

      headerGroup: "last-trade",
      visibilityGroup: "last-trade",

      width: "6.75rem",
      minWidth: "6.75rem",
    }),

    defineColumn({
      key: "open",
      label: labelFor(labels, "open"),
      data: "todayOpenModified",
      format: "price",

      headerGroup: "trading",
      visibilityGroup: "trading",

      width: "6.25rem",
      minWidth: "6.25rem",
    }),

    defineColumn({
      key: "high",
      label: labelFor(labels, "high"),
      data: "highPriceModified",
      format: "price",

      headerGroup: "trading",
      visibilityGroup: "trading",

      width: "6.25rem",
      minWidth: "6.25rem",
    }),

    defineColumn({
      key: "low",
      label: labelFor(labels, "low"),
      data: "lowPriceModified",
      format: "price",

      headerGroup: "trading",
      visibilityGroup: "trading",

      width: "6.25rem",
      minWidth: "6.25rem",
    }),
  ]);
}

function createPerformanceColumns(labels) {
  return Object.freeze([
    defineColumn({
      key: "sector",
      label: labelFor(labels, "sector"),
      data: "sectorName",
      format: "text",

      width: "10rem",
      minWidth: "10rem",
    }),

    defineColumn({
      key: "symbol",
      label: labelFor(labels, "symbol"),
      data: "companySymbol",
      format: "text",

      width: "6rem",
      minWidth: "6rem",
    }),

    createSecurityColumn(labels),

    createRangeColumn(labels),

    defineColumn({
      key: "market-cap",
      label: labelFor(labels, "marketCap"),
      data: "marketCap",
      format: "full-number",

      width: "9rem",
      minWidth: "9rem",
    }),

    defineColumn({
      key: "per",
      label: labelFor(labels, "per"),
      data: "PER",
      format: "full-number",

      width: "6rem",
      minWidth: "6rem",
    }),

    defineColumn({
      key: "volume",
      label: labelFor(labels, "volume"),
      data: "lastTradeQuantity",
      format: "full-number",

      headerGroup: "cumulative",
      visibilityGroup: "cumulative",

      width: "8rem",
      minWidth: "8rem",
    }),

    defineColumn({
      key: "yield",
      label: labelFor(labels, "yield"),
      data: "yield",
      format: "full-number",

      width: "6rem",
      minWidth: "6rem",
    }),
  ]);
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketWatchSchema(config = {}) {
  const labels = config.labels?.table || {};
  const groups = createGroups(labels);

  const views = Object.freeze({
    1: Object.freeze({
      id: "1",
      key: "overview",
      label: "Overview",
      columns: createOverviewColumns(labels),
    }),

    2: Object.freeze({
      id: "2",
      key: "trading",
      label: "Trading",
      columns: createTradingColumns(labels),
    }),

    3: Object.freeze({
      id: "3",
      key: "performance",
      label: "Performance",
      columns: createPerformanceColumns(labels),
    }),
  });

  function getView(viewId) {
    return views[String(viewId)] || views[DEFAULT_VIEW_ID];
  }

  function getColumns(viewId) {
    return getView(viewId).columns;
  }

  function getHeaderGroups(viewId) {
    const orderedGroups = [];

    getColumns(viewId).forEach((column) => {
      if (!column.headerGroup) {
        return;
      }

      const existingGroup = orderedGroups.find(
        (group) => group.id === column.headerGroup,
      );

      if (existingGroup) {
        existingGroup.columns.push(column);

        return;
      }

      orderedGroups.push({
        id: column.headerGroup,
        label: groups[column.headerGroup].label,
        columns: [column],
      });
    });

    return orderedGroups;
  }

  function getPickerGroups(viewId) {
    const available = new Set(
      getColumns(viewId)
        .map((column) => column.visibilityGroup)
        .filter(Boolean),
    );

    return Object.values(groups).filter(
      (group) => group.picker && available.has(group.id),
    );
  }

  function getColumnIndexesForGroup(viewId, groupId) {
    return getColumns(viewId)
      .map((column, index) => ({
        column,
        index,
      }))
      .filter(({ column }) => column.visibilityGroup === groupId)
      .map(({ index }) => index);
  }

  return Object.freeze({
    defaultViewId: DEFAULT_VIEW_ID,
    rowGroupField: "sectorName",

    views,
    groups,

    getView,
    getColumns,
    getHeaderGroups,
    getPickerGroups,
    getColumnIndexesForGroup,
  });
}
