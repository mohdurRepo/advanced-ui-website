/* ==========================================================================
   Market Watch Schema
   ========================================================================== */

/*
 * This module defines data only.
 *
 * It does not:
 * - fetch data
 * - use jQuery
 * - initialize DataTables
 * - create HTML
 * - touch the DOM
 *
 * The schema is consumed by the table, mobile, and filter modules.
 */

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

const DEFAULT_VIEW_ID = "1";

function labelFor(labels, key) {
  return labels[key] || DEFAULT_LABELS[key] || key;
}

function defineColumn(definition) {
  return Object.freeze({
    data: null,
    format: "text",
    headerGroup: null,
    visibilityGroup: null,
    orderable: true,
    pinned: false,

    /*
     * `mobilePrimary` appears in the top card identity area.
     * `mobile` appears in the expandable mobile detail grid.
     */
    mobilePrimary: false,
    mobile: true,

    ...definition,
  });
}

function getGroups(labels) {
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
      picker: false,
    }),

    "best-offer": Object.freeze({
      id: "best-offer",
      label: labelFor(labels, "bestOffer"),
      picker: false,
    }),

    "bid-offer": Object.freeze({
      id: "bid-offer",
      label: `${labelFor(labels, "bestBid")} / ${labelFor(
        labels,
        "bestOffer",
      )}`,
      picker: true,
    }),
  });
}

function createOverviewColumns(labels) {
  return Object.freeze([
    defineColumn({
      key: "security",
      label: labelFor(labels, "company"),
      format: "security",
      pinned: true,
      orderable: false,
      mobilePrimary: true,
      mobile: false,
    }),

    defineColumn({
      key: "range",
      label: labelFor(labels, "range"),
      format: "range",
      visibilityGroup: "range",
      orderable: false,
    }),

    defineColumn({
      key: "last-price",
      label: labelFor(labels, "price"),
      data: "lastTradePriceModified",
      format: "price",
      headerGroup: "last-trade",
      visibilityGroup: "last-trade",
    }),

    defineColumn({
      key: "last-volume",
      label: labelFor(labels, "volume"),
      data: "lastTradeQuantity",
      format: "quantity",
      headerGroup: "last-trade",
      visibilityGroup: "last-trade",
    }),

    defineColumn({
      key: "change-value",
      label: labelFor(labels, "changeValue"),
      data: "netChangeModified",
      format: "change",
      changeField: "netChangeModified",
      headerGroup: "last-trade",
      visibilityGroup: "last-trade",
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
    }),

    defineColumn({
      key: "trade-count",
      label: labelFor(labels, "numberOfTrades"),
      data: "nuOfTrades",
      format: "quantity",
      headerGroup: "cumulative",
      visibilityGroup: "cumulative",
    }),

    defineColumn({
      key: "traded-volume",
      label: labelFor(labels, "volumeTraded"),
      data: "volumeTraded",
      format: "quantity",
      headerGroup: "cumulative",
      visibilityGroup: "cumulative",
    }),

    defineColumn({
      key: "open",
      label: labelFor(labels, "open"),
      data: "todayOpenModified",
      format: "price",
      headerGroup: "trading",
      visibilityGroup: "trading",
    }),

    defineColumn({
      key: "high",
      label: labelFor(labels, "high"),
      data: "highPriceModified",
      format: "price",
      headerGroup: "trading",
      visibilityGroup: "trading",
    }),

    defineColumn({
      key: "low",
      label: labelFor(labels, "low"),
      data: "lowPriceModified",
      format: "price",
      headerGroup: "trading",
      visibilityGroup: "trading",
    }),

    defineColumn({
      key: "best-bid-price",
      label: labelFor(labels, "price"),
      data: "bidPriceModified",
      format: "market-order-or-price",
      headerGroup: "best-bid",
      visibilityGroup: "bid-offer",
    }),

    defineColumn({
      key: "best-bid-volume",
      label: labelFor(labels, "volume"),
      data: "bidQuantity",
      format: "quantity",
      headerGroup: "best-bid",
      visibilityGroup: "bid-offer",
    }),

    defineColumn({
      key: "best-offer-price",
      label: labelFor(labels, "price"),
      data: "askPrice",
      format: "market-order-or-price",
      headerGroup: "best-offer",
      visibilityGroup: "bid-offer",
    }),

    defineColumn({
      key: "best-offer-volume",
      label: labelFor(labels, "volume"),
      data: "askQuantityModified",
      format: "quantity",
      headerGroup: "best-offer",
      visibilityGroup: "bid-offer",
    }),
  ]);
}

function createTradingColumns(labels) {
  return Object.freeze([
    defineColumn({
      key: "security",
      label: labelFor(labels, "company"),
      format: "security",
      pinned: true,
      orderable: false,
      mobilePrimary: true,
      mobile: false,
    }),

    defineColumn({
      key: "range",
      label: labelFor(labels, "range"),
      format: "range",
      visibilityGroup: "range",
      orderable: false,
    }),

    defineColumn({
      key: "last-price",
      label: labelFor(labels, "price"),
      data: "lastTradePriceModified",
      format: "price",
      headerGroup: "last-trade",
      visibilityGroup: "last-trade",
    }),

    defineColumn({
      key: "change-value",
      label: labelFor(labels, "changeValue"),
      data: "netChangeModified",
      format: "change",
      changeField: "netChangeModified",
      headerGroup: "last-trade",
      visibilityGroup: "last-trade",
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
    }),

    defineColumn({
      key: "open",
      label: labelFor(labels, "open"),
      data: "todayOpenModified",
      format: "price",
      headerGroup: "trading",
      visibilityGroup: "trading",
    }),

    defineColumn({
      key: "high",
      label: labelFor(labels, "high"),
      data: "highPriceModified",
      format: "price",
      headerGroup: "trading",
      visibilityGroup: "trading",
    }),

    defineColumn({
      key: "low",
      label: labelFor(labels, "low"),
      data: "lowPriceModified",
      format: "price",
      headerGroup: "trading",
      visibilityGroup: "trading",
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
    }),

    defineColumn({
      key: "symbol",
      label: labelFor(labels, "symbol"),
      data: "companySymbol",
      format: "text",
    }),

    defineColumn({
      key: "security",
      label: labelFor(labels, "company"),
      format: "security",
      pinned: true,
      orderable: false,
      mobilePrimary: true,
      mobile: false,
    }),

    defineColumn({
      key: "range",
      label: labelFor(labels, "range"),
      format: "range",
      visibilityGroup: "range",
      orderable: false,
    }),

    defineColumn({
      key: "market-cap",
      label: labelFor(labels, "marketCap"),
      data: "marketCap",
      format: "plain-number",
    }),

    defineColumn({
      key: "per",
      label: labelFor(labels, "per"),
      data: "PER",
      format: "plain-number",
    }),

    defineColumn({
      key: "volume",
      label: labelFor(labels, "volume"),
      data: "lastTradeQuantity",
      format: "quantity",
      headerGroup: "cumulative",
      visibilityGroup: "cumulative",
    }),

    defineColumn({
      key: "yield",
      label: labelFor(labels, "yield"),
      data: "yield",
      format: "plain-number",
    }),
  ]);
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketWatchSchema(config = {}) {
  const labels = config.labels?.table || {};
  const groups = getGroups(labels);

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
    const result = [];

    getColumns(viewId).forEach((column) => {
      if (!column.headerGroup) {
        return;
      }

      const existing = result.find((group) => group.id === column.headerGroup);

      if (existing) {
        existing.columns.push(column);

        return;
      }

      result.push({
        id: column.headerGroup,
        label: groups[column.headerGroup].label,
        columns: [column],
      });
    });

    return result;
  }

  function getPickerGroups(viewId) {
    const activeGroups = new Set(
      getColumns(viewId)
        .map((column) => column.visibilityGroup)
        .filter(Boolean),
    );

    return Object.values(groups).filter(
      (group) => group.picker && activeGroups.has(group.id),
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
