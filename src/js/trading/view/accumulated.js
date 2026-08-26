/* ==========================================================================
   Accumulated Losses View
   ========================================================================== */

/*
 * Accumulated Losses Trading view.
 *
 * Responsibilities:
 *
 * - define the two-column dataset
 * - build the exact backend request contract
 * - preserve the JSP-owned table header
 * - render Symbol + accumulated-loss status
 * - render linked Company name
 * - render compact mobile cards
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
  getTradingIdentity,
  renderIdentityCell,
  renderMobileIdentity,
  renderTradingCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.accumulatedLosses;

/* ==========================================================================
   Columns
   ========================================================================== */

/*
 * JSP owns:
 *
 * Symbol | Company
 *
 * Status indication belongs with Symbol.
 */

function getColumns(config) {
  const labels = config.labels?.accumulated || {};

  return [
    {
      key: "symbol",

      label: labels.symbol || "Symbol",

      data: "symbol",

      /*
       * We render the Symbol cell locally because the status marker belongs
       * beside Symbol, while the shared identity renderer includes Company.
       */
      format: "accumulated-symbol",

      width: "24%",

      className: "table-market__symbol",
    },

    {
      key: "company",

      label: labels.company || "Company",

      /*
       * Actual backend field.
       */
      data: "company",

      format: "link",

      urlData: "companyURL",

      width: "76%",

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
    /*
     * IMPORTANT:
     *
     * UI concept = report
     * backend parameter = percentage
     */
    percentage: state.report,

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
   Status
   ========================================================================== */

function getStatusClass(status) {
  if (status === null || status === undefined) {
    return "";
  }

  const value = String(status).trim().toLowerCase();

  /*
   * Keep these semantic classes local.
   *
   * Existing Trading SCSS can map them to the established accumulated-loss
   * colors.
   */
  if (
    value.includes("50") ||
    value.includes("red") ||
    value.includes("danger")
  ) {
    return "is-danger";
  }

  if (
    value.includes("35") ||
    value.includes("orange") ||
    value.includes("warning")
  ) {
    return "is-warning";
  }

  if (
    value.includes("20") ||
    value.includes("yellow") ||
    value.includes("primary")
  ) {
    return "is-primary";
  }

  return "";
}

function renderAccumulatedSymbol(row) {
  const identity = getTradingIdentity(row, VIEW);

  const statusClass = getStatusClass(row?.companyStatus);

  return `
    <div class="trading-symbol-status">

      ${
        statusClass
          ? `
            <span
              class="
                trading-symbol-status__indicator
                ${statusClass}
              "
              aria-hidden="true"
            ></span>
          `
          : ""
      }

      <span class="trading-symbol-status__symbol">
        ${identity.code || "-"}
      </span>

    </div>
  `.trim();
}

/* ==========================================================================
   Table Cell
   ========================================================================== */

function renderCell(args, config) {
  if (args.column.key === "symbol") {
    return renderAccumulatedSymbol(args.row);
  }

  return renderTradingCell({
    ...args,

    config,
    view: VIEW,
  });
}

/* ==========================================================================
   Mobile Summary
   ========================================================================== */

function renderMobileSummary(row) {
  return renderMobileIdentity(row, VIEW);
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

/*
 * Accumulated Losses is intentionally compact.
 *
 * There are only two meaningful fields:
 *
 * Symbol/status + Company
 *
 * Therefore no expand/collapse control is required.
 */

function renderMobileCard(row, context) {
  const identity = getTradingIdentity(row, VIEW);

  return renderStandardDataCard({
    rowId: `${
      identity.code || identity.name || "accumulated"
    }-${context.index}`,

    className: "trading-data-card trading-data-card--accumulated",

    summary: renderMobileSummary(row),

    expandable: false,
  });
}

/* ==========================================================================
   Public View
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
    endpoint: config.endpoints.accumulatedLosses,

    buildRequestData() {
      return buildRequestData(filters, config);
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
     * Symbol | Company
     */
    headerMode: "existing",

    getColumns() {
      return columns;
    },

    renderCell(args) {
      return renderCell(args, config);
    },

    tableOptions: {
      ...config.tableDefaults,

      ...config.tables?.accumulatedLosses,

      scrollX: false,

      scrollCollapse: false,

      fixedHeader: false,

      fixedColumns: false,
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
      return renderMobileCard(row, context);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load trading data.",

    afterRender(container) {
      container?.classList?.add(
        "trading-data-card-list",
        "trading-accumulated-card-list",
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
   * JS owns runtime busy state.
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
        console.warn("Accumulated table adjustment failed:", error);
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
