/* ==========================================================================
   Delisted Companies View
   ========================================================================== */

/*
 * Delisted Companies / Funds Trading view.
 *
 * Final desktop contract:
 *
 *   Company | Date | Reason
 *
 * Physical tbody columns:
 *
 *   1 Company
 *   2 Date
 *   3 Reason
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
 *   Date
 *   Reason / Announcement
 *
 * Responsibilities:
 *
 * - preserve JSP-owned header
 * - build the existing Suspended/Delisted backend request
 * - normalize response wrappers
 * - render three physical body columns
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

const VIEW = TRADING_VIEWS.delistedCompanies;

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
   Delisted Date
   ========================================================================== */

function getDelistedDate(row) {
  return firstDefined(
    row?.date,
    row?.delistedDate,
    row?.delistingDate,
    row?.toDate,
    row?.endDate,
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
 * Keep semantic mapping local.
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
   Company Identity
   ========================================================================== */

/*
 * Company identity and logo fallback belong to frozen formatters.js.
 *
 * Delisted contributes only the Company Status indicator.
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
    config.labels?.delistedLink || config.labels?.delisted?.reason || "View",
  );
}

/* ==========================================================================
   Columns
   ========================================================================== */

/*
 * JSP physical contract:
 *
 * Company | Date | Reason
 *
 * Therefore DataTables must expose exactly THREE body columns.
 */

function getColumns(config) {
  const labels = config.labels?.delisted || {};

  return [
    {
      key: "company",

      label: labels.company || "Company",

      data: null,

      width: "18rem",

      className: "table-market__security",

      searchable: true,
    },

    {
      key: "date",

      label: labels.date || "Date",

      data: null,

      width: "11rem",

      className: "table-market__date",
    },

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
     * Preserve the exact shared Company Status backend contract.
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

    case "date":
      return escapeHtml(formatDate(getDelistedDate(row), config));

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
  const labels = config.labels?.delisted || {};

  return {
    date: labels.date || "Date",

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
      label: labels.date,

      value: formatDate(getDelistedDate(row), config),
    },

    {
      label: labels.reason,

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
    idPrefix: "trading-delisted-details",

    rowId: `${symbol || company || "delisted"}-${context.index}`,

    className: "trading-data-card trading-data-card--delisted",

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

export function createDelistedView({ root, config, filters } = {}) {
  /* =========================================================================
     Guards
     ========================================================================= */

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
     * Company | Date | Reason
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

      /*
       * JSP owns the visible Results label.
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
     * trading.js owns active-tab / active-variant loading.
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
     * Delisted may be initialized while its Company Status variant is hidden.
     *
     * Remeasure after it becomes visible.
     */

    requestAnimationFrame(() => {
      try {
        api.columns?.adjust?.();

        api.fixedHeader?.adjust?.();

        api.responsive?.recalc?.();
      } catch (error) {
        console.warn("Delisted table adjustment failed:", error);
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
     Destroy
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
