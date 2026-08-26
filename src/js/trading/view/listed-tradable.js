/* ==========================================================================
   Listed Tradable Rights View
   ========================================================================== */

/*
 * Listed Tradable Rights Trading view.
 *
 * Responsibilities:
 *
 * - define the exact 14-column backend/body contract
 * - preserve the JSP-owned two-row grouped header
 * - build the exact backend request
 * - normalize legacy/current response wrappers
 * - render standard expandable mobile cards
 *
 * Shared lifecycle remains in common/data-view:
 *
 * - request cancellation
 * - table skeletons
 * - card skeletons
 * - empty/error states
 * - DataTables lifecycle
 * - DataViewCard enhancement
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
} from "../../common/data-view/index.js";

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
  getDisplayValue,
  getTradingIdentity,
  renderListedTradableMobileSummary,
  renderMobileIdentity,
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

/*
 * IMPORTANT
 *
 * These 14 columns correspond exactly to the 14 leaf positions represented
 * by the JSP-owned grouped <thead>.
 *
 * Backend property names are intentionally preserved from the working Trading
 * implementation. Do not replace them with generic guessed names.
 */

function getColumns(config) {
  const labels = config.labels?.listedTradable || {};

  return [
    /* ======================================================================
       Tradable Right
       ====================================================================== */

    {
      key: "tradable-right",

      label: labels.security || "Tradable Rights",

      /*
       * Actual backend field.
       */
      data: "acrynomName",

      format: "link",

      urlData: "pageUrl",

      width: "22%",

      className: "table-market__security table-market__identity",

      searchable: true,
    },

    /* ======================================================================
       Last Trade
       ====================================================================== */

    {
      key: "last-trade-price",

      label: labels.lastTradePrice || "Price",

      /*
       * Already formatted by backend.
       */
      data: "lastTradePriceModified",

      width: "8rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "last-trade",
    },

    {
      key: "last-trade-volume",

      label: labels.lastTradeVolume || "Volume",

      data: "lastTradeQuantity",

      format: "quantity",

      width: "9rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "last-trade",
    },

    {
      key: "change-value",

      label: labels.changeValue || "Change Value",

      data: "netChangeModified",

      numericData: "netChangeDoubleModified",

      format: "change",

      width: "8rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "last-trade",
    },

    {
      key: "change-percent",

      label: labels.changePercent || "Change %",

      data: "percentChangeModified",

      numericData: "percentChangeDoubleModified",

      /*
       * Backend display value already carries the desired formatting.
       *
       * We still use the numeric double only to determine positive/negative
       * presentation.
       */
      format: "change",

      width: "8rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "last-trade",
    },

    /* ======================================================================
       Today's Trading
       ====================================================================== */

    {
      key: "open",

      label: labels.open || "Open",

      data: "todayOpenModified",

      width: "8rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "today",
    },

    {
      key: "high",

      label: labels.high || "High",

      data: "highPriceModified",

      width: "8rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "today",
    },

    {
      key: "low",

      label: labels.low || "Low",

      data: "lowPriceModified",

      width: "8rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "today",
    },

    /* ======================================================================
       Cumulative
       ====================================================================== */

    {
      key: "number-of-trades",

      label: labels.numberOfTrades || "Number of Trades",

      /*
       * IMPORTANT:
       *
       * Backend uses nuOfTrades, not noOfTrades.
       */
      data: "nuOfTrades",

      format: "quantity",

      width: "9rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "cumulative",
    },

    {
      key: "volume-traded",

      label: labels.volumeTraded || "Volume Traded",

      data: "volumeTraded",

      format: "quantity",

      width: "10rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "cumulative",
    },

    /* ======================================================================
       Best Bid
       ====================================================================== */

    {
      key: "bid-price",

      label: labels.bidPrice || "Bid Price",

      data: "bidPriceModified",

      width: "8rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "best-bid",
    },

    {
      key: "bid-volume",

      label: labels.bidVolume || "Bid Volume",

      data: "bidQuantity",

      format: "quantity",

      width: "9rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "best-bid",
    },

    /* ======================================================================
       Best Offer
       ====================================================================== */

    {
      key: "ask-price",

      label: labels.askPrice || "Ask Price",

      data: "askPriceModified",

      width: "8rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "best-offer",
    },

    {
      key: "ask-volume",

      label: labels.askVolume || "Ask Volume",

      data: "askQuantity",

      format: "quantity",

      width: "9rem",

      numeric: true,

      className: "table-market__number",

      headerGroup: "best-offer",
    },
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

/*
 * Exact working backend contract.
 */

function buildRequestData(config) {
  return {
    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Response
   ========================================================================== */

function parseResponse(response) {
  if (typeof response !== "string") {
    return response;
  }

  try {
    return JSON.parse(response);
  } catch {
    return response;
  }
}

function getResponseRows(response) {
  const value = parseResponse(response);

  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.rows)) {
    return value.rows;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  /*
   * Preserve legacy DataTables response compatibility.
   */
  if (Array.isArray(value?.aaData)) {
    return value.aaData;
  }

  return [];
}

function getResponseCount(response, rows) {
  const value = parseResponse(response);

  const candidates = [
    value?.total,
    value?.count,
    value?.recordsTotal,
    value?.recordsFiltered,
    rows?.[0]?.count,
  ];

  for (const candidate of candidates) {
    const count = Number(candidate);

    if (Number.isFinite(count) && count >= 0) {
      return Math.floor(count);
    }
  }

  return rows.length;
}

function normalizeResponse(response) {
  const raw = parseResponse(response);

  const rows = getResponseRows(raw);

  return {
    rows,

    meta: {
      total: getResponseCount(raw, rows),

      updatedAt: raw?.updatedAt ?? raw?.lastUpdated ?? raw?.timestamp ?? null,
    },

    raw,
  };
}

/* ==========================================================================
   Mobile Details
   ========================================================================== */

/*
 * Price + Change % remain visible in the summary.
 *
 * Everything below is secondary market detail and belongs in the expandable
 * details area.
 */

function getMobileFields(row, config) {
  const labels = config.labels?.listedTradable || {};

  return [
    /* ----------------------------------------------------------------------
       Last Trade
       ---------------------------------------------------------------------- */

    {
      label: labels.lastTradeVolume || "Volume",

      value: escapeHtml(getDisplayValue(row?.lastTradeQuantity, "-")),

      numeric: true,
    },

    {
      label: labels.changeValue || "Change Value",

      value: renderPriceChange(
        row?.netChangeModified,
        row?.netChangeDoubleModified,
      ),

      numeric: true,
    },

    /* ----------------------------------------------------------------------
       Today's Trading
       ---------------------------------------------------------------------- */

    {
      label: labels.open || "Open",

      value: escapeHtml(getDisplayValue(row?.todayOpenModified, "-")),

      numeric: true,
    },

    {
      label: labels.high || "High",

      value: escapeHtml(getDisplayValue(row?.highPriceModified, "-")),

      numeric: true,
    },

    {
      label: labels.low || "Low",

      value: escapeHtml(getDisplayValue(row?.lowPriceModified, "-")),

      numeric: true,
    },

    /* ----------------------------------------------------------------------
       Cumulative
       ---------------------------------------------------------------------- */

    {
      label: labels.numberOfTrades || "Number of Trades",

      value: escapeHtml(getDisplayValue(row?.nuOfTrades, "-")),

      numeric: true,
    },

    {
      label: labels.volumeTraded || "Volume Traded",

      value: escapeHtml(getDisplayValue(row?.volumeTraded, "-")),

      numeric: true,
    },

    /* ----------------------------------------------------------------------
       Best Bid
       ---------------------------------------------------------------------- */

    {
      label: labels.bidPrice || "Bid Price",

      value: escapeHtml(getDisplayValue(row?.bidPriceModified, "-")),

      numeric: true,
    },

    {
      label: labels.bidVolume || "Bid Volume",

      value: escapeHtml(getDisplayValue(row?.bidQuantity, "-")),

      numeric: true,
    },

    /* ----------------------------------------------------------------------
       Best Offer
       ---------------------------------------------------------------------- */

    {
      label: labels.askPrice || "Ask Price",

      value: escapeHtml(getDisplayValue(row?.askPriceModified, "-")),

      numeric: true,
    },

    {
      label: labels.askVolume || "Ask Volume",

      value: escapeHtml(getDisplayValue(row?.askQuantity, "-")),

      numeric: true,
    },
  ];
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderMobileCard(row, context, config) {
  const identity = getTradingIdentity(row, VIEW);

  return renderStandardDataCard({
    idPrefix: "trading-listed-tradable-details",

    rowId: `${identity.name || "tradable-right"}-${context.index}`,

    className: "trading-data-card trading-data-card--listed-tradable",

    summary: `
      ${renderMobileIdentity(row, VIEW)}

      ${renderListedTradableMobileSummary(row, config)}
    `.trim(),

    fields: getMobileFields(row, config),

    expandable: true,

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",
  });
}

/* ==========================================================================
   Public View
   ========================================================================== */

export function createListedTradableView({ root, config } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError(
      "Listed Tradable Rights view requires a valid root element.",
    );
  }

  const columns = getColumns(config);

  let lastResultCount = 0;

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

    normalizeResponse(response) {
      const normalized = normalizeResponse(response);

      lastResultCount = Number(normalized.meta?.total) || 0;

      return normalized;
    },
  });

  /* =========================================================================
     Table
     ========================================================================= */

  const table = createDataTable({
    root,

    table: getTableSelector(VIEW),

    initialView: VIEW,

    /*
     * CRITICAL
     *
     * The JSP owns the entire two-row grouped <thead>.
     *
     * common/data-table supports headerMode:"existing", which prevents its
     * schema header lifecycle from touching that markup.
     */
    headerMode: "existing",

    getColumns() {
      return columns;
    },

    renderCell(args) {
      return renderTradingCell({
        ...args,

        config,
        view: VIEW,
      });
    },

    tableOptions: {
      ...config.tableDefaults,

      ...config.tables?.listedTradableRights,

      /*
       * The design-system .table-responsive wrapper owns horizontal
       * scrolling.
       *
       * Do not allow DataTables to clone this complex header into separate
       * dt-scroll-head / dt-scroll-body tables.
       */
      scrollX: false,

      scrollCollapse: false,

      fixedHeader: false,

      fixedColumns: false,

      ordering: false,
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

    errorMessage: config.labels?.loadError || "Unable to load trading data.",

    afterRender(container) {
      container?.classList?.add(
        "trading-data-card-list",
        "trading-listed-tradable-card-list",
      );
    },
  });

  /* =========================================================================
     Results
     ========================================================================= */

  const baseResults = createDataResults({
    root,

    count: getResultCountSelector(VIEW),

    labels: {
      loading: config.labels?.loading,

      empty: config.labels?.noData,

      error: config.labels?.loadError,

      /*
       * JSP already owns "Results:".
       */
      results: "",
    },
  });

  const results = Object.freeze({
    showLoading() {
      baseResults.showLoading();
    },

    showReady() {
      baseResults.showReady(lastResultCount);
    },

    showEmpty(message) {
      lastResultCount = 0;

      baseResults.showEmpty(message);
    },

    showError(message) {
      lastResultCount = 0;

      baseResults.showError(message);
    },

    destroy() {
      baseResults.destroy();
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
        "Unable to load trading data."
      );
    },
  });

  controller.init();

  /* =========================================================================
     Busy State
     ========================================================================= */

  /*
   * Common table/cards own the actual skeleton rendering.
   *
   * This subscription owns only the outer Data View's busy state so
   * cursor:wait cannot remain after rendering has completed.
   */

  const unsubscribeState = state.subscribe(({ state: snapshot }) => {
    root.setAttribute("aria-busy", String(Boolean(snapshot.loading)));
  });

  /*
   * Remove stale JSP initialization state immediately.
   */
  root.setAttribute("aria-busy", "false");

  /* =========================================================================
     Reload
     ========================================================================= */

  function reload() {
    return controller.reload();
  }

  /* =========================================================================
     Adjust
     ========================================================================= */

  function adjust() {
    const api = table.getApi?.();

    if (!api) {
      return;
    }

    requestAnimationFrame(() => {
      try {
        api.columns?.adjust?.();

        api.responsive?.recalc?.();
      } catch (error) {
        console.warn("Listed Tradable table adjustment failed:", error);
      }
    });
  }

  /* =========================================================================
     Lifecycle
     ========================================================================= */

  function destroy() {
    unsubscribeState();

    controller.destroy();

    root.removeAttribute("aria-busy");
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    view: VIEW,

    reload,
    adjust,

    getRows() {
      return controller.getSourceRows?.() || [];
    },

    getVisibleRows() {
      return controller.getVisibleRows?.() || [];
    },

    getTable() {
      return table.getApi?.() || null;
    },

    destroy,
  });
}
