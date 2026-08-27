/* ==========================================================================
   OTC Trading View
   ========================================================================== */

/*
 * OTC Trading view.
 *
 * Final desktop contract:
 *
 *   Company | Traded Volume | Last Update Price
 *
 * Physical tbody columns:
 *
 *   1 Company
 *   2 Traded Volume
 *   3 Last Update Price
 *
 * Company identity:
 *
 *   [logo] Company Name
 *          SYMBOL
 *
 * Mobile:
 *
 *   [logo] Company Name
 *          SYMBOL
 *
 *   Traded Volume
 *
 *   expandable:
 *
 *   Last Update Price
 *
 * Responsibilities:
 *
 * - preserve the JSP-owned three-column header
 * - build the OTC backend request
 * - normalize response wrappers
 * - render three physical body columns
 * - render shared company identity
 * - render traded volume
 * - preserve the backend last-update display value
 * - render mobile cards
 * - synchronize result count
 * - expose standard Trading view lifecycle
 *
 * This module intentionally does not own:
 *
 * - global tab switching
 * - AJAX transport implementation
 * - company-name normalization
 * - company-symbol normalization
 * - company-logo resolution / fallback
 * - common loading / empty / error UI
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
  getCompanyName,
  getCompanySymbol,
  getDisplayValue,
  renderTradingCardIdentity,
  renderTradingCompanyCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.otcTrading;

/* ==========================================================================
   Helpers
   ========================================================================== */

function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

/* ==========================================================================
   OTC Field Accessors
   ========================================================================== */

/*
 * Keep OTC backend-field knowledge local to this view.
 *
 * The first value in each accessor is the current known backend property.
 * Additional aliases provide harmless compatibility with alternate wrappers.
 */

function getTradedVolume(row) {
  return firstDefined(row?.lastTradeVolume, row?.tradedVolume, row?.volume, "");
}

function getLastUpdate(row) {
  return firstDefined(
    row?.lastTradeDate,
    row?.lastUpdate,
    row?.lastUpdatePrice,
    "",
  );
}

/* ==========================================================================
   Traded Volume
   ========================================================================== */

function renderTradedVolume(row) {
  return escapeHtml(getDisplayValue(getTradedVolume(row), "-"));
}

/* ==========================================================================
   Last Update
   ========================================================================== */

/*
 * OTC currently receives this field as an already prepared display value.
 *
 * Do not pass it through the generic Trading date formatter unless the backend
 * contract is explicitly changed later.
 */

function renderLastUpdate(row) {
  return escapeHtml(getDisplayValue(getLastUpdate(row), "-"));
}

/* ==========================================================================
   Columns
   ========================================================================== */

/*
 * JSP owns exactly:
 *
 * Company | Traded Volume | Last Update Price
 *
 * Symbol is supporting Company identity metadata.
 *
 * Therefore DataTables must expose exactly THREE physical body columns.
 */

function getColumns(config) {
  const labels = config.labels?.otc || {};

  return [
    /* ---------------------------------------------------------------------
       Company
       --------------------------------------------------------------------- */

    {
      key: "company",

      label: labels.company || "Company",

      data: null,

      width: "20rem",

      className: "table-market__company table-market__security",

      searchable: true,
    },

    /* ---------------------------------------------------------------------
       Traded Volume
       --------------------------------------------------------------------- */

    {
      key: "traded-volume",

      label: labels.tradedVolume || "Traded Volume",

      data: null,

      width: "11rem",

      className: "table-market__number",

      numeric: true,
    },

    /* ---------------------------------------------------------------------
       Last Update Price
       --------------------------------------------------------------------- */

    {
      key: "last-update",

      label: labels.lastUpdate || "Last Update",

      data: null,

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
   * Legacy DataTables wrapper.
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

      updatedAt: firstDefined(
        raw?.updatedAt,
        raw?.lastUpdated,
        raw?.timestamp,
        null,
      ),
    },

    raw,
  };
}

/* ==========================================================================
   Desktop Cell Rendering
   ========================================================================== */

function renderCell({ row, column }, config) {
  switch (column.key) {
    case "company":
      return renderTradingCompanyCell(row, config);

    case "traded-volume":
      return renderTradedVolume(row);

    case "last-update":
      return renderLastUpdate(row);

    default:
      return "";
  }
}

/* ==========================================================================
   Mobile Fields
   ========================================================================== */

function getMobileFields(row, config) {
  const labels = config.labels?.otc || {};

  return [
    {
      label: labels.tradedVolume || "Traded Volume",

      value: getDisplayValue(getTradedVolume(row), "-"),
    },

    {
      label: labels.lastUpdate || "Last Update",

      value: getDisplayValue(getLastUpdate(row), "-"),

      fullWidth: true,
    },
  ];
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderMobileCard(row, context, config) {
  const symbol = getCompanySymbol(row);

  const company = getCompanyName(row, config);

  return renderStandardDataCard({
    idPrefix: "trading-otc-details",

    rowId: `${symbol || company || "otc"}-${context.index}`,

    className: "trading-data-card trading-data-card--otc",

    /*
     * Shared Trading formatter owns:
     *
     * [logo] Company Name
     *        Symbol
     */

    summary: renderTradingCardIdentity(row, config),

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
  /* =========================================================================
     Guards
     ========================================================================= */

  if (!(root instanceof Element)) {
    throw new TypeError("OTC Trading view requires a valid root element.");
  }

  if (!config?.endpoints?.otcTrading) {
    throw new TypeError("OTC Trading endpoint is required.");
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
     * Company | Traded Volume | Last Update Price
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

      ...config.tables?.otcTrading,

      /*
       * The design-system .table-responsive wrapper owns overflow.
       */

      scrollX: false,

      scrollCollapse: false,

      /*
       * OTC is now aligned with the other compact Trading tables.
       */

      fixedHeader: true,

      fixedColumns: false,

      ordering: false,

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
       * JSP already renders the visible Results label.
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
     * OTC may initialize while its tab panel is hidden.
     *
     * Recalculate after the tab becomes visible.
     */

    requestAnimationFrame(() => {
      try {
        api.columns?.adjust?.();

        api.fixedHeader?.adjust?.();

        api.responsive?.recalc?.();
      } catch (error) {
        console.warn("OTC table adjustment failed:", error);
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
