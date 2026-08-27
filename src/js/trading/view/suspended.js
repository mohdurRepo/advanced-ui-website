/* ==========================================================================
   Suspended Companies View
   ========================================================================== */

/*
 * Suspended Companies / Funds Trading view.
 *
 * Final desktop contract:
 *
 *   Company | Period        | Reason
 *           | From | To
 *
 * Physical tbody columns:
 *
 *   1 Company
 *   2 From
 *   3 To
 *   4 Reason
 *
 * Company identity:
 *
 *   [logo] Company Name
 *          SYMBOL + status
 *
 * Mobile:
 *
 *   [logo] Company Name
 *          SYMBOL + status
 *
 *   expandable:
 *
 *   Period
 *     From
 *     To
 *
 *   Reason / Announcement
 *
 * Responsibilities:
 *
 * - preserve JSP-owned grouped header
 * - build the existing Suspended/Delisted backend request
 * - normalize response wrappers
 * - render four physical body columns
 * - render status-aware company identity
 * - render mobile cards
 * - synchronize result count
 * - expose standard Trading view lifecycle
 *
 * This module intentionally does not own:
 *
 * - global tab switching
 * - Company Status filter orchestration
 * - date-range initialization
 * - AJAX transport implementation
 * - company-name field normalization
 * - company-symbol field normalization
 * - company-logo resolution / fallback
 * - generic date formatting
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
  formatDate,
  getAnnouncementUrl,
  getCompanyName,
  getCompanySymbol,
  renderAnnouncementLink,
  renderTradingCardIdentity,
  renderTradingCompanyCell,
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
   Suspended Field Accessors
   ========================================================================== */

function getFromDate(row) {
  return firstDefined(
    row?.fromDate,
    row?.startDate,
    row?.suspensionFrom,
    row?.suspendFrom,
    row?.dateFrom,
    "",
  );
}

function getToDate(row) {
  return firstDefined(
    row?.toDate,
    row?.endDate,
    row?.suspensionTo,
    row?.suspendTo,
    row?.dateTo,
    "",
  );
}

/* ==========================================================================
   Status
   ========================================================================== */

/*
 * companyStatus has historically arrived in several forms:
 *
 * - Red / Orange / Yellow
 * - danger / warning / primary
 * - percentage-oriented status values
 *
 * Keep only semantic mapping here.
 *
 * SCSS owns the actual colors.
 */

function getStatusTone(status) {
  if (!hasValue(status)) {
    return "";
  }

  const value = String(status).trim().toLowerCase();

  if (
    value.includes("red") ||
    value.includes("danger") ||
    value.includes("50")
  ) {
    return "danger";
  }

  if (
    value.includes("orange") ||
    value.includes("warning") ||
    value.includes("35")
  ) {
    return "warning";
  }

  if (
    value.includes("yellow") ||
    value.includes("primary") ||
    value.includes("20")
  ) {
    return "primary";
  }

  return "";
}

/* ==========================================================================
   Status Indicator
   ========================================================================== */

function renderStatusIndicator(row) {
  const tone = getStatusTone(row?.companyStatus);

  if (!tone) {
    return "";
  }

  return `
    <span
      class="
        table-market__status
        table-market__status--${escapeHtml(tone)}
      "
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Desktop Company Identity
   ========================================================================== */

/*
 * Company identity markup and logo fallback belong to formatters.js.
 *
 * This view adds only the Company Status indicator.
 *
 * Base formatter output:
 *
 *   [logo] Company Name
 *          SYMBOL
 *
 * Final Suspended presentation:
 *
 *   [logo] Company Name
 *          SYMBOL + status
 */

function renderCompanyIdentity(row, config) {
  const status = renderStatusIndicator(row);

  return renderTradingCompanyCell(row, config, {
    status,
  });
}

/* ==========================================================================
   Announcement
   ========================================================================== */

function renderAnnouncement(row, config) {
  const url = getAnnouncementUrl(row);

  if (!url) {
    return escapeHtml(config.labels?.notAvailable || "-");
  }

  return renderAnnouncementLink(
    row,
    config,
    config.labels?.suspendedLink || config.labels?.suspended?.reason || "View",
  );
}

/* ==========================================================================
   Columns
   ========================================================================== */

/*
 * JSP physical contract:
 *
 * Company | Period        | Reason
 *         | From | To
 *
 * Therefore DataTables must expose exactly FOUR leaf/body columns.
 */

function getColumns(config) {
  const labels = config.labels?.suspended || {};

  return [
    /* ---------------------------------------------------------------------
       Company
       --------------------------------------------------------------------- */

    {
      key: "company",

      label: labels.company || "Company",

      data: null,

      width: "18rem",

      className: "table-market__security",

      searchable: true,
    },

    /* ---------------------------------------------------------------------
       Period: From
       --------------------------------------------------------------------- */

    {
      key: "from-date",

      label: labels.fromDate || "From",

      data: "fromDate",

      width: "10rem",

      className: "table-market__date",

      headerGroup: "period",
    },

    /* ---------------------------------------------------------------------
       Period: To
       --------------------------------------------------------------------- */

    {
      key: "to-date",

      label: labels.toDate || "To",

      data: "toDate",

      width: "10rem",

      className: "table-market__date",

      headerGroup: "period",
    },

    /* ---------------------------------------------------------------------
       Reason / Announcement
       --------------------------------------------------------------------- */

    {
      key: "reason",

      label: labels.reason || "Reason",

      data: null,

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
     * Preserve the exact backend contract.
     */

    renderType: "Search",

    formType: state.type,

    fromDate: state.fromDate,

    toDate: state.toDate,

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
      return renderCompanyIdentity(row, config);

    case "from-date":
      return escapeHtml(formatDate(getFromDate(row), config));

    case "to-date":
      return escapeHtml(formatDate(getToDate(row), config));

    case "reason":
      return renderAnnouncement(row, config);

    default:
      return "";
  }
}

/* ==========================================================================
   Mobile Labels
   ========================================================================== */

function getMobileLabels(config) {
  const labels = config.labels?.suspended || {};

  return {
    period: labels.period || "Period",

    fromDate: labels.fromDate || "From",

    toDate: labels.toDate || "To",

    reason: labels.reason || "Reason",
  };
}

/* ==========================================================================
   Mobile Fields
   ========================================================================== */

function getMobileFields(row, config) {
  const labels = getMobileLabels(config);

  return [
    {
      label: labels.fromDate,

      value: formatDate(getFromDate(row), config),
    },

    {
      label: labels.toDate,

      value: formatDate(getToDate(row), config),
    },

    {
      label: labels.reason,

      /*
       * renderStandardDataCard supports HTML-valued fields in the current
       * data-view contract used by Company Status.
       */

      value: renderAnnouncement(row, config),

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

  const status = renderStatusIndicator(row);

  return renderStandardDataCard({
    idPrefix: "trading-suspended-details",

    rowId: `${symbol || company || "suspended"}-${context.index}`,

    className: "trading-data-card trading-data-card--suspended",

    /*
     * Shared Trading identity owns:
     *
     * [logo] Company Name
     *        Symbol
     *
     * Company Status contributes only the status indicator.
     */

    summary: renderTradingCardIdentity(row, config, {
      status,
    }),

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
  /* =========================================================================
     Guards
     ========================================================================= */

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

  if (!config?.endpoints?.suspendedDelisted) {
    throw new TypeError("Suspended / Delisted endpoint is required.");
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
     * Company | Period        | Reason
     *         | From | To
     *
     * Never regenerate this grouped header in JavaScript.
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
       * Horizontal containment belongs to .table-responsive.
       */

      scrollX: false,

      scrollCollapse: false,

      /*
       * Shared FixedHeader owns the sticky table header.
       *
       * There is no FixedColumns requirement for this compact table.
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
     * Company Status orchestration decides which variant is active and when
     * the associated dataset should load.
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
     * Company Status variants are shown/hidden dynamically.
     *
     * Recalculate after Suspended becomes visible.
     */

    requestAnimationFrame(() => {
      try {
        api.columns?.adjust?.();

        api.fixedHeader?.adjust?.();

        api.responsive?.recalc?.();
      } catch (error) {
        console.warn("Suspended table adjustment failed:", error);
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
