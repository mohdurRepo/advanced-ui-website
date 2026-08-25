/* ==========================================================================
   Delisted Companies View
   ========================================================================== */

/*
 * Delisted Companies / Funds Trading view.
 *
 * Responsibilities:
 *
 * - define the Delisted dataset
 * - build the shared Suspended/Delisted backend request
 * - render Symbol + company-status indicator
 * - render linked Company name
 * - render delisting date
 * - render delisting reason / news action
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
  formatTradingDate,
  getDisplayValue,
  renderCompanyLink,
  renderDelistedNewsLink,
  renderSymbolWithStatus,
  renderTradingCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.delistedCompanies;

/* ==========================================================================
   Columns
   ========================================================================== */

function getColumns(config) {
  const labels = config.labels?.delisted || {};

  return [
    {
      key: "symbol",

      data: "symbol",

      fallbackData: ["companySymbol", "securitySymbol"],

      label: labels.symbol || "Symbol",

      type: "symbol-status",

      statusData: "companyStatus",

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

      width: "16rem",
    },

    {
      key: "date",

      data: "fromDate",

      fallbackData: ["date", "delistingDate"],

      label: labels.date || "Date",

      type: "date",

      className: "table-market__date",

      width: "9rem",
    },

    {
      key: "reason",

      data: "reason",

      fallbackData: ["delistingReason", "statusReason"],

      label: labels.reason || "Reason",

      type: "display-value",

      className: "table-market__reason",
    },
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

function buildRequestData(filters, config) {
  const state = filters.getCompanyStatusRequestState();

  return {
    formType: state.type,

    fromDate: state.fromDate,

    toDate: state.toDate,

    locale: config.locale,

    renderType: "Search",
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

function renderMobileSummary(row) {
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
   Mobile Fields
   ========================================================================== */

function getMobileFields(row, config) {
  const labels = config.labels?.delisted || {};

  const reason = getDisplayValue(row?.reason ?? row?.delistingReason, "-");

  const news = renderDelistedNewsLink(row, config);

  return [
    {
      label: labels.date || "Date",

      value: escapeHtml(
        formatTradingDate(row?.fromDate ?? row?.date ?? row?.delistingDate),
      ),
    },

    {
      label: labels.reason || "Reason",

      value: escapeHtml(reason),

      fullWidth: true,
    },

    ...(news !== "-"
      ? [
          {
            label: config.labels?.delistedLink || "News",

            value: news,

            fullWidth: true,
          },
        ]
      : []),
  ];
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderMobileCard(row, context, config) {
  return renderStandardDataCard({
    rowId: row?.id ?? row?.symbol ?? context.index,

    idPrefix: "delisted-company-card-details",

    summary: renderMobileSummary(row),

    fields: getMobileFields(row, config),

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",

    className: "trading-card trading-card--delisted",
  });
}

/* ==========================================================================
   Public View Factory
   ========================================================================== */

export function createDelistedView({ root, config, filters } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError(
      "Delisted Companies view requires a valid root element.",
    );
  }

  if (!filters?.companyStatus) {
    throw new TypeError(
      "Delisted Companies view requires Company Status filters.",
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
    endpoint: config.endpoints.suspendedDelisted,

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
     * Symbol | Company | Date | Reason
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
      ...config.tables?.delistedCompanies,
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
        "trading-delisted-card-list",
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
