/* ==========================================================================
   OTC Trading View
   ========================================================================== */

/*
 * OTC Trading view.
 *
 * Responsibilities:
 *
 * - define the four-column OTC dataset
 * - normalize the OTC response
 * - render the existing JSP-owned table header
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
  formatQuantity,
  formatTradingDate,
  getDisplayValue,
  renderCompanyLink,
  renderTradingCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.otcTrading;

/* ==========================================================================
   Columns
   ========================================================================== */

function getColumns(config) {
  const labels = config.labels?.otc || {};

  return [
    {
      key: "symbol",

      data: "symbol",

      fallbackData: ["companySymbol", "securitySymbol"],

      label: labels.symbol || "Symbol",

      type: "display-value",

      className: "table-market__symbol",

      width: "9rem",
    },

    {
      key: "company",

      data: "companyName",

      fallbackData: ["company", "name"],

      label: labels.company || "Company",

      type: "company-link",

      urlData: "companyURL",

      className: "table-market__company",
    },

    {
      key: "traded-volume",

      data: "lastTradeVolume",

      fallbackData: ["tradedVolume", "volume"],

      label: labels.tradedVolume || "Traded Volume",

      type: "quantity",

      numeric: true,

      className: "table-market__number",

      width: "10rem",
    },

    {
      key: "last-update",

      data: "lastTradeDate",

      fallbackData: ["lastUpdate", "updatedAt", "date"],

      label: labels.lastUpdate || "Last Update",

      type: "date",

      className: "table-market__date",

      width: "10rem",
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
   Mobile Summary
   ========================================================================== */

function renderMobileSummary(row, config) {
  const symbol = getDisplayValue(row?.symbol ?? row?.companySymbol, "");

  const company = getDisplayValue(row?.companyName ?? row?.company, "");

  const companyUrl = row?.companyURL ?? row?.companyUrl ?? row?.pageUrl ?? "";

  const volume = formatQuantity(
    row?.lastTradeVolume ?? row?.tradedVolume ?? row?.volume,
    config,
  );

  const volumeLabel = config.labels?.otc?.tradedVolume || "Traded Volume";

  return `
    <div class="data-card__identity">

      <div class="data-card__identity-content">

        <div class="data-card__identity-name">
          ${renderCompanyLink(company, companyUrl)}
        </div>

        ${
          symbol
            ? `
              <div class="data-card__identity-meta">
                ${escapeHtml(symbol)}
              </div>
            `
            : ""
        }

      </div>

    </div>

    <div class="data-card__quote">

      <div class="data-card__quote-item">

        <span class="data-card__quote-label">
          ${escapeHtml(volumeLabel)}
        </span>

        <span class="data-card__price">
          ${escapeHtml(volume)}
        </span>

      </div>

    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Fields
   ========================================================================== */

function getMobileFields(row, config) {
  const labels = config.labels?.otc || {};

  return [
    {
      label: labels.lastUpdate || "Last Update",

      value: escapeHtml(
        formatTradingDate(
          row?.lastTradeDate ?? row?.lastUpdate ?? row?.updatedAt,
        ),
      ),

      fullWidth: true,
    },
  ];
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderMobileCard(row, context, config) {
  return renderStandardDataCard({
    rowId: row?.id ?? row?.symbol ?? context.index,

    idPrefix: "otc-trading-card-details",

    summary: renderMobileSummary(row, config),

    fields: getMobileFields(row, config),

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",

    className: "trading-card trading-card--otc",
  });
}

/* ==========================================================================
   Public View Factory
   ========================================================================== */

export function createOtcView({ root, config } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError("OTC Trading view requires a valid root element.");
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
    endpoint: config.endpoints.otcTrading,

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
      });
    },

    tableOptions: {
      ...config.tableDefaults,
      ...config.tables?.otcTrading,
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
      container?.classList?.add("trading-card-list", "trading-otc-card-list");
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
