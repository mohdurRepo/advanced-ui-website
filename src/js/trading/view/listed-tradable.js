/* ==========================================================================
   Listed Tradable Rights View
   ========================================================================== */

/*
 * Listed Tradable Rights Trading view.
 *
 * Responsibilities:
 *
 * - define the 14-column market dataset
 * - normalize Listed Tradable response data
 * - render the existing grouped table header/body contract
 * - render standard expandable mobile cards
 *
 * Generic lifecycle behavior remains in common/data-view.
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import {
  createDataCards,
  createDataResults,
  createDataSource,
  createDataState,
  createDataTable,
  createDataViewController,
  renderStandardDataCard,
} from "../common/data-view/index.js";

/* ==========================================================================
   Trading
   ========================================================================== */

import {
  TRADING_VIEWS,
  getCardsSelector,
  getResultCountSelector,
  getTableSelector,
} from "../constants.js";

import {
  escapeHtml,
  formatMoney,
  formatQuantity,
  getDisplayValue,
  renderLink,
  renderPriceChange,
  renderTradingCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.listedTradableRights;

/* ==========================================================================
   Columns
   ========================================================================== */

function getColumns(config) {
  const labels = config.labels?.listedTradable || {};

  return [
    /* ======================================================================
       Identity
       ====================================================================== */

    {
      key: "tradable-right",

      data: "acrynomName",

      fallbackData: ["symbol", "securityName", "name"],

      label: labels.security || "Tradable Rights",

      type: "security-link",

      urlData: "pageUrl",

      className: "table-market__security",

      width: "14rem",
    },

    /* ======================================================================
       Last Trade
       ====================================================================== */

    {
      key: "last-trade-price",

      data: "lastTradePrice",

      fallbackData: ["price"],

      label: labels.lastTradePrice || "Price",

      type: "money",

      numeric: true,

      className: "table-market__number",

      group: "last-trade",

      width: "7rem",
    },

    {
      key: "last-trade-volume",

      data: "lastTradeVolume",

      fallbackData: ["volume"],

      label: labels.lastTradeVolume || "Volume",

      type: "quantity",

      numeric: true,

      className: "table-market__number",

      group: "last-trade",

      width: "8rem",
    },

    {
      key: "change-value",

      data: "changeValue",

      fallbackData: ["change"],

      label: labels.changeValue || "Change",

      type: "price-change",

      numericData: "changeValue",

      numeric: true,

      className: "table-market__number",

      group: "last-trade",

      width: "8rem",
    },

    {
      key: "change-percent",

      data: "changePercentage",

      fallbackData: ["changePercent", "percentageChange"],

      label: labels.changePercent || "Change %",

      type: "price-change",

      numericData: "changePercentage",

      numeric: true,

      className: "table-market__number",

      group: "last-trade",

      width: "8rem",
    },

    /* ======================================================================
       Today's Trading
       ====================================================================== */

    {
      key: "open",

      data: "openPrice",

      fallbackData: ["open"],

      label: labels.open || "Open",

      type: "money",

      numeric: true,

      className: "table-market__number",

      group: "today",

      width: "7rem",
    },

    {
      key: "high",

      data: "highPrice",

      fallbackData: ["high"],

      label: labels.high || "High",

      type: "money",

      numeric: true,

      className: "table-market__number",

      group: "today",

      width: "7rem",
    },

    {
      key: "low",

      data: "lowPrice",

      fallbackData: ["low"],

      label: labels.low || "Low",

      type: "money",

      numeric: true,

      className: "table-market__number",

      group: "today",

      width: "7rem",
    },

    /* ======================================================================
       Cumulative
       ====================================================================== */

    {
      key: "number-of-trades",

      data: "noOfTrades",

      fallbackData: ["numberOfTrades", "trades"],

      label: labels.numberOfTrades || "No. of Trades",

      type: "quantity",

      numeric: true,

      className: "table-market__number",

      group: "cumulative",

      width: "9rem",
    },

    {
      key: "volume-traded",

      data: "volumeTraded",

      fallbackData: ["tradedVolume", "totalVolume"],

      label: labels.volumeTraded || "Volume Traded",

      type: "quantity",

      numeric: true,

      className: "table-market__number",

      group: "cumulative",

      width: "10rem",
    },

    /* ======================================================================
       Best Bid
       ====================================================================== */

    {
      key: "bid-price",

      data: "bestBidPrice",

      fallbackData: ["bidPrice"],

      label: labels.bidPrice || "Price",

      type: "money",

      numeric: true,

      className: "table-market__number",

      group: "best-bid",

      width: "7rem",
    },

    {
      key: "bid-volume",

      data: "bestBidVolume",

      fallbackData: ["bidVolume"],

      label: labels.bidVolume || "Volume",

      type: "quantity",

      numeric: true,

      className: "table-market__number",

      group: "best-bid",

      width: "8rem",
    },

    /* ======================================================================
       Best Offer
       ====================================================================== */

    {
      key: "ask-price",

      data: "bestOfferPrice",

      fallbackData: ["askPrice", "offerPrice"],

      label: labels.askPrice || "Price",

      type: "money",

      numeric: true,

      className: "table-market__number",

      group: "best-offer",

      width: "7rem",
    },

    {
      key: "ask-volume",

      data: "bestOfferVolume",

      fallbackData: ["askVolume", "offerVolume"],

      label: labels.askVolume || "Volume",

      type: "quantity",

      numeric: true,

      className: "table-market__number",

      group: "best-offer",

      width: "8rem",
    },
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

function buildRequestData(config) {
  return {
    locale: config.locale,
  };
}

/* ==========================================================================
   Response
   ========================================================================== */

function getRows(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
}

function getTotal(response, rows) {
  const candidates = [
    response?.total,
    response?.count,
    response?.recordsFiltered,
    response?.recordsTotal,
    rows?.[0]?.count,
  ];

  for (const candidate of candidates) {
    const total = Number(candidate);

    if (Number.isFinite(total) && total >= 0) {
      return Math.floor(total);
    }
  }

  return rows.length;
}

function normalizeResponse(response) {
  const rows = getRows(response);

  return {
    rows,

    meta: {
      total: getTotal(response, rows),

      updatedAt:
        response?.updatedAt ??
        response?.lastUpdated ??
        response?.timestamp ??
        null,
    },

    raw: response,
  };
}

/* ==========================================================================
   Mobile Identity
   ========================================================================== */

function renderMobileIdentity(row) {
  const name = getDisplayValue(
    row?.acrynomName ?? row?.symbol ?? row?.securityName,
    "",
  );

  const url = row?.pageUrl ?? row?.companyURL ?? "";

  return `
    <div class="data-card__identity">

      <div class="data-card__identity-content">

        <div class="data-card__identity-name">
          ${renderLink(name, url, {
            className: "data-card__identity-link",
          })}
        </div>

      </div>

    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Summary
   ========================================================================== */

function renderMobileSummary(row, config) {
  const price = formatMoney(row?.lastTradePrice ?? row?.price, config);

  const changeValue = row?.changePercentage ?? row?.changePercent ?? "";

  return `
    ${renderMobileIdentity(row)}

    <div class="data-card__quote">

      <div class="data-card__quote-item">

        <span class="data-card__price">
          ${escapeHtml(price)}
        </span>

      </div>

      <div class="data-card__quote-item">

        ${renderPriceChange(getDisplayValue(changeValue, "-"), changeValue)}

      </div>

    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Fields
   ========================================================================== */

function getMobileFields(row, config) {
  const labels = config.labels?.listedTradable || {};

  return [
    /* Last Trade */

    {
      label: labels.lastTradeVolume || "Last Trade Volume",

      value: escapeHtml(formatQuantity(row?.lastTradeVolume, config)),

      numeric: true,
    },

    {
      label: labels.changeValue || "Change",

      value: renderPriceChange(
        getDisplayValue(row?.changeValue, "-"),
        row?.changeValue,
      ),

      numeric: true,
    },

    /* Today's */

    {
      label: labels.open || "Open",

      value: escapeHtml(formatMoney(row?.openPrice, config)),

      numeric: true,
    },

    {
      label: labels.high || "High",

      value: escapeHtml(formatMoney(row?.highPrice, config)),

      numeric: true,
    },

    {
      label: labels.low || "Low",

      value: escapeHtml(formatMoney(row?.lowPrice, config)),

      numeric: true,
    },

    /* Cumulative */

    {
      label: labels.numberOfTrades || "No. of Trades",

      value: escapeHtml(
        formatQuantity(row?.noOfTrades ?? row?.numberOfTrades, config),
      ),

      numeric: true,
    },

    {
      label: labels.volumeTraded || "Volume Traded",

      value: escapeHtml(
        formatQuantity(row?.volumeTraded ?? row?.tradedVolume, config),
      ),

      numeric: true,
    },

    /* Best Bid */

    {
      label: labels.bidPrice || "Bid Price",

      value: escapeHtml(
        formatMoney(row?.bestBidPrice ?? row?.bidPrice, config),
      ),

      numeric: true,
    },

    {
      label: labels.bidVolume || "Bid Volume",

      value: escapeHtml(
        formatQuantity(row?.bestBidVolume ?? row?.bidVolume, config),
      ),

      numeric: true,
    },

    /* Best Offer */

    {
      label: labels.askPrice || "Offer Price",

      value: escapeHtml(
        formatMoney(row?.bestOfferPrice ?? row?.askPrice, config),
      ),

      numeric: true,
    },

    {
      label: labels.askVolume || "Offer Volume",

      value: escapeHtml(
        formatQuantity(row?.bestOfferVolume ?? row?.askVolume, config),
      ),

      numeric: true,
    },
  ];
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderMobileCard(row, context, config) {
  return renderStandardDataCard({
    rowId: row?.id ?? row?.acrynomName ?? context.index,

    idPrefix: "listed-tradable-card-details",

    summary: renderMobileSummary(row, config),

    fields: getMobileFields(row, config),

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",

    className: "trading-card trading-card--listed-tradable",
  });
}

/* ==========================================================================
   Public View Factory
   ========================================================================== */

export function createListedTradableView({ root, config } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError(
      "Listed Tradable Rights view requires a valid root element.",
    );
  }

  const columns = getColumns(config);

  /* =========================================================================
     State
     ========================================================================= */

  const state = createDataState({
    loading: false,

    sourceRows: [],

    visibleRows: [],

    meta: {},

    error: null,
  });

  /* =========================================================================
     Source
     ========================================================================= */

  const source = createDataSource({
    endpoint: config.endpoints.listedTradableRights,

    buildRequestData() {
      return buildRequestData(config);
    },

    normalizeResponse,
  });

  /* =========================================================================
     Table
     ========================================================================= */

  const table = createDataTable({
    root,

    table: getTableSelector(VIEW),

    initialView: VIEW,

    /*
     * Critical:
     *
     * JSP owns the complete two-row grouped header:
     *
     * Tradable Rights
     * Last Trade
     * Today's
     * Cumulative
     * Best Bid
     * Best Offer
     */
    headerMode: "existing",

    getColumns() {
      return columns;
    },

    renderCell(args) {
      return renderTradingCell({
        ...args,
        config,
      });
    },

    tableOptions: {
      ...config.tableDefaults,
      ...config.tables?.listedTradableRights,
    },
  });

  /* =========================================================================
     Cards
     ========================================================================= */

  const cards = createDataCards({
    root,

    container: getCardsSelector(VIEW),

    initialView: VIEW,

    renderCard(row, context) {
      return renderMobileCard(row, context, config);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load data.",

    afterRender(container) {
      container?.classList?.add(
        "trading-card-list",
        "trading-listed-tradable-card-list",
      );
    },
  });

  /* =========================================================================
     Results
     ========================================================================= */

  const results = createDataResults({
    root,

    count: getResultCountSelector(VIEW),

    labels: {
      loading: config.labels?.loading,

      empty: config.labels?.noData,

      error: config.labels?.loadError,

      results: config.labels?.results,
    },
  });

  /* =========================================================================
     Controller
     ========================================================================= */

  const controller = createDataViewController({
    source,
    state,
    table,
    cards,
    results,

    autoLoad: false,

    getView() {
      return VIEW;
    },

    getEmptyMessage() {
      return config.labels?.noData || "No data available";
    },

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        config.labels?.loadError ||
        "Unable to load data."
      );
    },
  });

  controller.init();

  /* =========================================================================
     Loading
     ========================================================================= */

  function showLoading() {
    root.setAttribute("aria-busy", "true");

    table?.showLoading?.();

    cards?.showLoading?.();

    results?.showLoading?.();
  }

  /* =========================================================================
     Reload
     ========================================================================= */

  async function reload() {
    showLoading();

    try {
      return await controller.reload();
    } finally {
      root.setAttribute("aria-busy", "false");
    }
  }

  /* =========================================================================
     Adjust
     ========================================================================= */

  function adjust() {
    const api = table?.getApi?.();

    api?.columns?.adjust?.();
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    reload,
    adjust,

    getRows() {
      return controller.getSourceRows?.() || [];
    },

    getVisibleRows() {
      return controller.getVisibleRows?.() || [];
    },

    getTable() {
      return table?.getApi?.() || null;
    },

    destroy() {
      controller.destroy();
    },
  });
}
