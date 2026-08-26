/* ==========================================================================
   Delisted Companies View
   ========================================================================== */

/*
 * Delisted Companies / Funds Trading view.
 *
 * Responsibilities:
 *
 * - preserve the JSP-owned four-column header
 * - define the exact backend/body contract
 * - build the shared Suspended/Delisted request
 * - render Symbol + company status
 * - render linked Company name
 * - render delisting Date
 * - render delisting news/action
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
  formatTradingDate,
  getDisplayValue,
  getTradingIdentity,
  renderMobileIdentity,
  renderTradingCell,
  safeUrl,
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

      label: labels.symbol || "Symbol",

      data: "symbol",

      format: "delisted-symbol",

      width: "10rem",

      className: "table-market__symbol table-market__identity-symbol",

      searchable: true,
    },

    {
      key: "company",

      label: labels.company || "Company Name",

      /*
       * Actual backend property.
       */
      data: "name",

      format: "link",

      urlData: "companyURL",

      width: "20rem",

      className: "table-market__company table-market__identity-company",

      searchable: true,
    },

    {
      key: "date",

      label: labels.date || "Date",

      /*
       * Existing Delisted endpoint uses fromDate as the event date.
       */
      data: "fromDate",

      format: "date",

      width: "11rem",

      className: "table-market__date",
    },

    {
      key: "reason",

      label: labels.reason || "Reason",

      /*
       * Action-only column.
       */
      data: null,

      format: "delisted-news",

      width: "12rem",

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
    renderType: "Search",

    formType: state.type,

    fromDate: state.fromDate,

    toDate: state.toDate,

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
  if (status === null || status === undefined || String(status).trim() === "") {
    return "";
  }

  const value = String(status).trim().toLowerCase();

  if (
    value.includes("red") ||
    value.includes("danger") ||
    value.includes("50")
  ) {
    return "is-danger";
  }

  if (
    value.includes("orange") ||
    value.includes("warning") ||
    value.includes("35")
  ) {
    return "is-warning";
  }

  if (
    value.includes("yellow") ||
    value.includes("primary") ||
    value.includes("20")
  ) {
    return "is-primary";
  }

  return "";
}

function renderSymbol(row) {
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
        ${escapeHtml(identity.code || "-")}
      </span>

    </div>
  `.trim();
}

/* ==========================================================================
   News
   ========================================================================== */

function getNewsUrl(row) {
  /*
   * Exact Delisted contract:
   *
   * newsUrl only.
   *
   * Do not reuse Suspended annUrl behavior here.
   */
  return safeUrl(row?.newsUrl);
}

function renderNewsLink(row, config) {
  const url = getNewsUrl(row);

  if (!url) {
    return "-";
  }

  const label =
    config.labels?.delistedLink || config.labels?.delisted?.reason || "View";

  return `
    <a
      class="trading-announcement-link"
      href="${escapeHtml(url)}"
    >
      ${escapeHtml(label)}
    </a>
  `.trim();
}

/* ==========================================================================
   Table Cell
   ========================================================================== */

function renderCell(args, config) {
  switch (args.column.key) {
    case "symbol":
      return renderSymbol(args.row);

    case "reason":
      return renderNewsLink(args.row, config);

    default:
      return renderTradingCell({
        ...args,

        config,

        view: VIEW,
      });
  }
}

/* ==========================================================================
   Mobile Fields
   ========================================================================== */

function getMobileFields(row, config) {
  const labels = config.labels?.delisted || {};

  return [
    {
      label: labels.date || "Date",

      value: escapeHtml(getDisplayValue(formatTradingDate(row?.fromDate), "-")),
    },

    {
      label: labels.reason || "Reason",

      value: renderNewsLink(row, config),

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
    idPrefix: "trading-delisted-details",

    rowId: `${identity.code || identity.name || "delisted"}-${context.index}`,

    className: "trading-data-card trading-data-card--delisted",

    summary: renderMobileIdentity(row, VIEW),

    fields: getMobileFields(row, config),

    expandable: true,

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",
  });
}

/* ==========================================================================
   Public View
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
    endpoint: config.endpoints.suspendedDelisted,

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
     * Symbol | Company | Date | Reason
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

      ...config.tables?.delistedCompanies,

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
        "trading-delisted-card-list",
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
   * Remove any stale server-rendered busy state.
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
        console.warn("Delisted table adjustment failed:", error);
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
