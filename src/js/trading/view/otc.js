/* ==========================================================================
   OTC Trading View
   ========================================================================== */

/*
 * OTC Trading view.
 *
 * Responsibilities:
 *
 * - preserve the JSP-owned four-column header
 * - define the exact OTC backend/body contract
 * - build the exact backend request
 * - render Company + Symbol correctly
 * - render traded volume
 * - render last update
 * - render standard expandable mobile cards
 *
 * Shared behavior remains in common/data-view.
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
  renderMobileIdentity,
  renderOtcMobileSummary,
  renderTradingCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.otcTrading;

/* ==========================================================================
   Columns
   ========================================================================== */

/*
 * JSP owns exactly:
 *
 * Symbol | Company | Traded Volume | Last Update
 */

function getColumns(config) {
  const labels = config.labels?.otc || {};

  return [
    {
      key: "symbol",

      label: labels.symbol || "Symbol",

      data: "symbol",

      width: "10rem",

      className: "table-market__symbol table-market__identity-symbol",

      searchable: true,
    },

    {
      key: "company",

      label: labels.company || "Company",

      /*
       * Exact OTC backend property.
       */
      data: "companyName",

      format: "link",

      urlData: "companyURL",

      width: "20rem",

      className: "table-market__company table-market__identity-company",

      searchable: true,
    },

    {
      key: "traded-volume",

      label: labels.tradedVolume || "Traded Volume",

      data: "lastTradeVolume",

      format: "quantity",

      numeric: true,

      width: "11rem",

      className: "table-market__number",
    },

    {
      key: "last-update",

      label: labels.lastUpdate || "Last Update",

      /*
       * Backend already provides the display value.
       */
      data: "lastTradeDate",

      width: "12rem",

      className: "table-market__date",
    },
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

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

function getMobileFields(row, config) {
  const labels = config.labels?.otc || {};

  return [
    {
      label: labels.lastUpdate || "Last Update",

      /*
       * Preserve backend display string exactly.
       */
      value: escapeHtml(getDisplayValue(row?.lastTradeDate, "-")),

      fullWidth: true,
    },
  ];
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderMobileCard(row, context, config) {
  const identity = getTradingIdentity(row, VIEW);

  return renderStandardDataCard({
    idPrefix: "trading-otc-details",

    rowId: `${identity.code || identity.name || "otc"}-${context.index}`,

    className: "trading-data-card trading-data-card--otc",

    summary: `
      ${renderMobileIdentity(row, VIEW)}

      ${renderOtcMobileSummary(row, config)}
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

export function createOtcView({ root, config } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError("OTC Trading view requires a valid root element.");
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
    endpoint: config.endpoints.otcTrading,

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
     * JSP owns:
     *
     * Symbol | Company | Traded Volume | Last Update
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

      ...config.tables?.otcTrading,

      /*
       * The design-system .table-responsive wrapper owns overflow.
       *
       * This prevents the leftmost Symbol column clipping we saw when
       * DataTables created a separate scroll-head / scroll-body structure.
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
        "trading-otc-card-list",
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
       * JSP already renders "Results:".
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

  const unsubscribeState = state.subscribe(({ state: snapshot }) => {
    root.setAttribute("aria-busy", String(Boolean(snapshot.loading)));
  });

  /*
   * JS owns runtime loading state.
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
        console.warn("OTC table adjustment failed:", error);
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
