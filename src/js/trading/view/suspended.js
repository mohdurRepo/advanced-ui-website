/* ==========================================================================
   Suspended Companies View
   ========================================================================== */

/*
 * Suspended Companies / Funds Trading view.
 *
 * Responsibilities:
 *
 * - preserve the JSP-owned grouped Period header
 * - define the exact five-column backend/body contract
 * - build the exact Suspended backend request
 * - render Symbol + accumulated/status indicator
 * - render linked Company name
 * - render From / To period
 * - render announcement action
 * - render standard expandable mobile cards
 *
 * Shared behavior remains in common/data-view:
 *
 * - request cancellation
 * - loading skeletons
 * - table lifecycle
 * - card lifecycle
 * - empty/error states
 * - result state
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

const VIEW = TRADING_VIEWS.suspendedCompanies;

/* ==========================================================================
   Helpers
   ========================================================================== */

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

/* ==========================================================================
   Columns
   ========================================================================== */

/*
 * JSP owns:
 *
 * Symbol | Company | Period        | Reason
 *                  | From | To
 *
 * Therefore the tbody must always contain exactly five physical columns.
 */

function getColumns(config) {
  const labels = config.labels?.suspended || {};

  return [
    /* ----------------------------------------------------------------------
       Symbol
       ---------------------------------------------------------------------- */

    {
      key: "symbol",

      label: labels.symbol || "Symbol",

      data: "symbol",

      /*
       * Status rendering is local because companyStatus belongs visually beside
       * the Symbol.
       */
      format: "suspended-symbol",

      width: "10rem",

      className: "table-market__symbol table-market__identity-symbol",

      searchable: true,
    },

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    {
      key: "company",

      label: labels.company || "Company Name",

      /*
       * IMPORTANT:
       *
       * Suspended backend uses `name`, not company / companyName.
       */
      data: "name",

      format: "link",

      urlData: "companyURL",

      width: "18rem",

      className: "table-market__company table-market__identity-company",

      searchable: true,
    },

    /* ----------------------------------------------------------------------
       Period: From
       ---------------------------------------------------------------------- */

    {
      key: "from-date",

      label: labels.fromDate || "From",

      data: "fromDate",

      format: "date",

      width: "10rem",

      className: "table-market__date",

      headerGroup: "period",
    },

    /* ----------------------------------------------------------------------
       Period: To
       ---------------------------------------------------------------------- */

    {
      key: "to-date",

      label: labels.toDate || "To",

      data: "toDate",

      format: "date",

      width: "10rem",

      className: "table-market__date",

      headerGroup: "period",
    },

    /* ----------------------------------------------------------------------
       Announcement / Reason
       ---------------------------------------------------------------------- */

    {
      key: "reason",

      label: labels.reason || "Reason",

      /*
       * There is no useful scalar field here.
       *
       * The legacy/current contract is an action URL:
       *
       * primary  = annUrl
       * fallback = newsUrl
       */
      data: null,

      format: "suspended-announcement",

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
    /*
     * Exact existing backend contract.
     */
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
  if (!hasValue(status)) {
    return "";
  }

  const value = String(status).trim().toLowerCase();

  /*
   * Preserve semantic state classes only.
   *
   * SCSS owns actual colors.
   */
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
   Announcement
   ========================================================================== */

function getAnnouncementUrl(row) {
  return safeUrl(firstDefined(row?.annUrl, row?.newsUrl));
}

function renderAnnouncement(row, config) {
  const url = getAnnouncementUrl(row);

  if (!url) {
    return "-";
  }

  const label =
    config.labels?.suspendedLink || config.labels?.suspended?.reason || "View";

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
      return renderAnnouncement(args.row, config);

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
  const labels = config.labels?.suspended || {};

  return [
    {
      label: labels.fromDate || "From",

      value: escapeHtml(getDisplayValue(formatTradingDate(row?.fromDate), "-")),
    },

    {
      label: labels.toDate || "To",

      value: escapeHtml(getDisplayValue(formatTradingDate(row?.toDate), "-")),
    },

    {
      label: labels.reason || "Reason",

      value: renderAnnouncement(row, config),

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
    idPrefix: "trading-suspended-details",

    rowId: `${identity.code || identity.name || "suspended"}-${context.index}`,

    className: "trading-data-card trading-data-card--suspended",

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

export function createSuspendedView({ root, config, filters } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError(
      "Suspended Companies view requires a valid root element.",
    );
  }

  if (!filters?.companyStatus) {
    throw new TypeError(
      "Suspended Companies view requires Company Status filters.",
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
     * CRITICAL:
     *
     * JSP owns:
     *
     * Symbol | Company | Period        | Reason
     *                  | From | To
     *
     * Never rebuild this header in JavaScript.
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

      ...config.tables?.suspendedCompanies,

      /*
       * .table-responsive owns horizontal scrolling.
       *
       * Avoid dt-scroll cloned headers for this grouped table.
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
        "trading-suspended-card-list",
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
   * JS owns actual runtime loading state.
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
        console.warn("Suspended table adjustment failed:", error);
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
