/* ==========================================================================
   Accumulated Losses View
   ========================================================================== */

/*
 * Accumulated Losses Trading view.
 *
 * Final desktop contract:
 *
 *   Company
 *
 *   [logo] Company Name
 *          SYMBOL + accumulated-loss status
 *
 * Final mobile contract:
 *
 *   [logo] Company Name
 *          SYMBOL + accumulated-loss status
 *
 * Responsibilities:
 *
 * - preserve the JSP-owned one-column table header
 * - build the exact backend request contract
 * - normalize backend response wrappers
 * - render one physical desktop cell per row
 * - render compact mobile cards
 * - preserve accumulated-loss status presentation
 * - synchronize result count
 * - expose the standard Trading view lifecycle
 *
 * This module intentionally does not own:
 *
 * - the Report <select> DOM
 * - filter reset orchestration
 * - global tab switching
 * - AJAX transport implementation
 * - company-logo URL construction
 * - company-name / symbol field normalization
 * - accumulated-loss tone calculation
 * - common loading / empty / error presentation
 *
 * Those responsibilities belong to:
 *
 * - filters.js
 * - trading.js
 * - formatters.js
 * - common/data-view
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
  getCompanyName,
  getCompanySymbol,
  renderAccumulatedMobileCard,
  renderAccumulatedStatus,
  renderTradingCompanyCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.accumulatedLosses;

/* ==========================================================================
   Columns
   ========================================================================== */

/*
 * IMPORTANT:
 *
 * JSP now owns exactly ONE physical header:
 *
 * Company
 *
 * Symbol is supporting company identity metadata.
 *
 * It is not a second DataTables column.
 */

function getColumns(config) {
  const labels = config.labels?.accumulated || {};

  return [
    {
      key: "company",

      label: labels.company || "Company",

      data: null,

      width: "100%",

      className: "table-market__security",

      searchable: true,
    },
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

/*
 * filters.js owns the page-level Report filter.
 *
 * Accumulated must consume that shared state rather than querying the
 * <select> from its inner data-view root.
 */

function buildRequestData(filters, config) {
  const state = filters.getAccumulatedRequestState();

  return {
    /*
     * UI concept:
     *
     * report
     *
     * Backend parameter:
     *
     * percentage
     *
     * Exact values remain:
     *
     * All
     * 50-MORE
     * 35-50
     * 20-35
     */

    percentage: state.report,

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Response Parsing
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

/* ==========================================================================
   Response Rows
   ========================================================================== */

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

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  /*
   * Compatibility with the legacy DataTables response wrapper.
   */

  if (Array.isArray(value?.aaData)) {
    return value.aaData;
  }

  return [];
}

/* ==========================================================================
   Response Count
   ========================================================================== */

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

/* ==========================================================================
   Response Normalization
   ========================================================================== */

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
   Desktop Identity
   ========================================================================== */

/*
 * renderTradingCompanyCell() owns:
 *
 * [logo] Company Name
 *        Symbol
 *
 * Accumulated adds only its semantic loss-status indicator to the supporting
 * identity line.
 */

function renderAccumulatedCompanyCell(row, config) {
  const status = renderAccumulatedStatus(row, config);

  return renderTradingCompanyCell(row, config, {
    status,
  });
}

/* ==========================================================================
   Desktop Cell
   ========================================================================== */

function renderCell({ row, column }, config) {
  switch (column.key) {
    case "company":
      return renderAccumulatedCompanyCell(row, config);

    default:
      return "";
  }
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

/*
 * The common formatter owns the compact Accumulated card.
 *
 * Expected presentation:
 *
 * [logo] Company Name
 *        SYMBOL + status
 *
 * No expandable details are required because the dataset contains no
 * additional business fields.
 */

function renderMobileCard(row, context, config) {
  return renderAccumulatedMobileCard(row, context, config);
}

/* ==========================================================================
   Public View
   ========================================================================== */

export function createAccumulatedView({ root, config, filters } = {}) {
  /* =========================================================================
     Guards
     ========================================================================= */

  if (!(root instanceof Element)) {
    throw new TypeError(
      "Accumulated Losses view requires a valid root element.",
    );
  }

  if (
    !filters?.accumulated ||
    typeof filters.getAccumulatedRequestState !== "function"
  ) {
    throw new TypeError(
      "Accumulated Losses view requires Trading accumulated filters.",
    );
  }

  if (!config?.endpoints?.accumulatedLosses) {
    throw new TypeError("Accumulated Losses endpoint is required.");
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
     * Company
     *
     * The header must not be regenerated.
     */

    headerMode: "existing",

    getColumns() {
      return columns;
    },

    renderCell(args) {
      return renderCell(args, config);
    },

    tableOptions: {
      /*
       * Shared Trading defaults.
       */

      ...config.tableDefaults,

      /*
       * Accumulated-specific configuration.
       */

      ...config.tables?.accumulatedLosses,

      /*
       * The outer .table-responsive owns horizontal containment.
       */

      scrollX: false,

      scrollCollapse: false,

      /*
       * Standard single-row header.
       */

      fixedHeader: true,

      /*
       * There is only one physical column.
       */

      fixedColumns: false,

      /*
       * Mobile uses our card presentation rather than DataTables
       * Responsive child rows.
       */

      responsive: false,
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

      /*
       * JSP already renders:
       *
       * Results:
       *
       * JS writes only the count.
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

    /*
     * trading.js owns active-tab loading.
     */

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
   * JSP does not permanently own runtime busy state.
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

    /*
     * Accumulated may initialize after its tab becomes active.
     *
     * Recalculate the single column and FixedHeader when required.
     */

    requestAnimationFrame(() => {
      try {
        api.columns?.adjust?.();

        api.fixedHeader?.adjust?.();

        api.responsive?.recalc?.();
      } catch (error) {
        console.warn("Accumulated table adjustment failed:", error);
      }
    });
  }

  /* =========================================================================
     Queries
     ========================================================================= */

  function getRows() {
    return controller.getSourceRows?.() || [];
  }

  function getVisibleRows() {
    return controller.getVisibleRows?.() || [];
  }

  function getTable() {
    return table.getApi?.() || null;
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

    getRows,

    getVisibleRows,

    getTable,

    destroy,
  });
}
