/* ==========================================================================
   Accumulated Losses View
   ========================================================================== */

/*
 * Accumulated Losses Trading view.
 *
 * Responsibilities:
 *
 * - define the two-column dataset
 * - map the Accumulated filter to the backend request
 * - render Symbol + loss-status indicator
 * - render linked Company name
 * - render compact non-expandable mobile cards
 *
 * All generic lifecycle behavior remains in common/data-view.
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
  getDisplayValue,
  renderCompanyLink,
  renderSymbolWithStatus,
  renderTradingCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.accumulatedLosses;

/* ==========================================================================
   Columns
   ========================================================================== */

function getColumns(config) {
  const labels = config.labels?.accumulated || {};

  return [
    {
      key: "symbol",

      data: "symbol",

      fallbackData: ["companySymbol", "securitySymbol"],

      label: labels.symbol || "Symbol",

      type: "symbol-status",

      statusData: "companyStatus",

      className: "table-market__symbol",

      width: "10rem",
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
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

function buildRequestData(filters, config) {
  const state = filters.getAccumulatedRequestState();

  return {
    report: state.report,

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

    /*
     * Legacy endpoint sometimes carries the result count on the first row.
     */
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

function renderMobileSummary(row, config) {
  const symbol = getDisplayValue(row?.symbol ?? row?.companySymbol, "");

  const company = getDisplayValue(row?.companyName ?? row?.company, "");

  const status = row?.companyStatus;

  const companyUrl = row?.companyURL ?? row?.companyUrl ?? row?.pageUrl ?? "";

  return `
    <div class="data-card__identity">

      <div class="data-card__identity-content">

        <div class="data-card__identity-name">
          ${renderSymbolWithStatus(symbol, status)}
        </div>

        ${
          company
            ? `
              <div class="data-card__identity-meta">
                ${renderCompanyLink(company, companyUrl)}
              </div>
            `
            : ""
        }

      </div>

    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

/*
 * Accumulated Losses deliberately has no expandable details.
 *
 * The dataset is already compact:
 *
 * Symbol + status
 * Company
 */

function renderMobileCard(row, context, config) {
  return renderStandardDataCard({
    rowId: row?.id ?? row?.symbol ?? context.index,

    summary: renderMobileSummary(row, config),

    expandable: false,

    className: "trading-card trading-card--accumulated",
  });
}

/* ==========================================================================
   Public View Factory
   ========================================================================== */

export function createAccumulatedView({ root, config, filters } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError(
      "Accumulated Losses view requires a valid root element.",
    );
  }

  if (!filters?.accumulated) {
    throw new TypeError("Accumulated Losses view requires Trading filters.");
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
    endpoint: config.endpoints.accumulatedLosses,

    buildRequestData() {
      return buildRequestData(filters, config);
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
     * Symbol | Company Name
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
      ...config.tables?.accumulatedLosses,
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
        "trading-accumulated-card-list",
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
