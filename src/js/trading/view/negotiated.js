/* ==========================================================================
   Negotiated Deals View
   ========================================================================== */

/*
 * Negotiated Deals Trading view.
 *
 * Responsibilities:
 *
 * - define the six Negotiated body columns
 * - preserve the JSP-owned table header
 * - build the exact backend request contract
 * - normalize the legacy/current response shapes
 * - preserve daily total rows
 * - render grouped mobile cards
 * - render daily totals
 *
 * Shared responsibilities remain in common/data-view:
 *
 * - request cancellation
 * - loading skeletons
 * - table lifecycle
 * - mobile card lifecycle
 * - empty/error states
 * - result state
 * - DataViewCard enhancement
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
  formatMoney,
  formatQuantity,
  formatTradingDate,
  getTradingIdentity,
  isTotalRow,
  renderMobileIdentity,
  renderNegotiatedDailyTotalCard,
  renderNegotiatedMobileSummary,
  renderTradingCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.negotiatedDeals;

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
 * IMPORTANT:
 *
 * These six body columns correspond exactly to the six physical JSP header
 * cells.
 *
 * Symbol is supporting metadata inside Company. It is not a seventh column.
 */

function getColumns(config) {
  const labels = config.labels?.negotiatedDeals || {};

  return [
    /* ----------------------------------------------------------------------
       Date
       ---------------------------------------------------------------------- */

    {
      key: "date",

      label: labels.date || "Date",

      data: "strDate",

      format: "date",

      width: "10%",

      className: "table-market__date",
    },

    /* ----------------------------------------------------------------------
       Company + Symbol
       ---------------------------------------------------------------------- */

    {
      key: "company",

      label: labels.company || "Company",

      data: "company",

      /*
       * renderTradingCell() uses the complete Negotiated identity:
       *
       * symbol
       * company
       * companyURL
       */
      format: "identity",

      view: VIEW,

      width: "28%",

      className: "table-market__company table-market__identity",
    },

    /* ----------------------------------------------------------------------
       Price
       ---------------------------------------------------------------------- */

    {
      key: "trade-price",

      label: labels.price || "Price",

      data: "tradePrice",

      format: "money",

      numeric: true,

      width: "14%",

      className: "table-market__number table-market__price",
    },

    /* ----------------------------------------------------------------------
       Volume
       ---------------------------------------------------------------------- */

    {
      key: "trade-volume",

      label: labels.volume || "Volume",

      data: "tradeVolume",

      format: "quantity",

      numeric: true,

      width: "16%",

      className: "table-market__number",
    },

    /* ----------------------------------------------------------------------
       Value
       ---------------------------------------------------------------------- */

    {
      key: "turnover",

      label: labels.value || "Value",

      data: "turnOver",

      format: "money",

      numeric: true,

      width: "18%",

      className: "table-market__number",
    },

    /* ----------------------------------------------------------------------
       Time
       ---------------------------------------------------------------------- */

    {
      key: "time",

      label: labels.time || "Time",

      data: "strTime",

      width: "14%",

      className: "table-market__number",
    },
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

/**
 * Preserve the exact working backend request contract.
 */
function buildRequestData(filters, config) {
  const state = filters.getNegotiatedRequestState();

  return {
    type: state.type,

    sector: state.sector,

    company: state.company,

    fromDate: state.fromDate,

    toDate: state.toDate,

    /*
     * IMPORTANT:
     *
     * Existing Trading endpoints expect requestLocale.
     * Do not rename this to locale.
     */
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

  /*
   * Legacy DataTables-style endpoint response.
   */
  if (Array.isArray(value?.aaData)) {
    return value.aaData;
  }

  return [];
}

/* ==========================================================================
   Group Normalization
   ========================================================================== */

/**
 * Daily-total rows have historically not always repeated strDate.
 *
 * Carry the previous Negotiated date onto an internal presentation-only field
 * so the common card grouping system can keep each total with its date group.
 */
function normalizeGrouping(rows) {
  let currentDate = "";

  return rows.map((row) => {
    if (!row || typeof row !== "object") {
      return row;
    }

    const rowDate = formatTradingDate(row.strDate);

    if (hasValue(rowDate)) {
      currentDate = rowDate;
    }

    return {
      ...row,

      __tradingGroupDate: rowDate || currentDate || "",
    };
  });
}

/* ==========================================================================
   Result Count
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

  /*
   * Daily-total rows are presentation rows, not individual deals.
   */
  return rows.filter((row) => !isTotalRow(row)).length;
}

/* ==========================================================================
   Normalized Response
   ========================================================================== */

function normalizeResponse(response) {
  const raw = parseResponse(response);

  const rows = normalizeGrouping(getResponseRows(raw));

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
   Total Row
   ========================================================================== */

/*
 * Keep six physical <td> cells.
 *
 * Never convert the row into one colspan cell because the table header and
 * DataTables body must remain structurally compatible.
 */

function renderTotalCell({ row, column, config }) {
  const labels = config.labels?.negotiatedDeals || {};

  switch (column.key) {
    case "company":
      return `
        <strong>
          ${escapeHtml(
            firstDefined(row.label, row.company, config.labels?.total, "Total"),
          )}
        </strong>
      `.trim();

    case "trade-volume":
      return escapeHtml(
        formatQuantity(
          firstDefined(row.volume, row.totalVolume, row.tradeVolume),
          config,
        ),
      );

    case "turnover":
      return escapeHtml(
        formatMoney(
          firstDefined(row.value, row.totalValue, row.turnOver),
          config,
        ),
      );

    case "date":
    case "trade-price":
    case "time":
    default:
      return "";
  }
}

/* ==========================================================================
   Table Cell
   ========================================================================== */

function renderCell(args, config) {
  if (isTotalRow(args.row)) {
    return renderTotalCell({
      ...args,
      config,
    });
  }

  return renderTradingCell({
    ...args,

    config,
    view: VIEW,
  });
}

/* ==========================================================================
   Mobile Details
   ========================================================================== */

function getMobileFields(row, config) {
  const labels = config.labels?.negotiatedDeals || {};

  return [
    {
      label: labels.volume || "Volume",

      value: escapeHtml(formatQuantity(row?.tradeVolume, config)),

      numeric: true,
    },

    {
      label: labels.time || "Time",

      value: escapeHtml(firstDefined(row?.strTime, "-")),

      numeric: true,
    },
  ];
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderNegotiatedCard(row, context, config) {
  if (isTotalRow(row)) {
    return renderNegotiatedDailyTotalCard(row, config);
  }

  const identity = getTradingIdentity(row, VIEW);

  return renderStandardDataCard({
    idPrefix: "trading-negotiated-details",

    rowId: `${identity.code || identity.name || "deal"}-${context.index}`,

    className: "trading-data-card trading-data-card--negotiated",

    summary: `
      ${renderMobileIdentity(row, VIEW)}

      ${renderNegotiatedMobileSummary(row, config)}
    `.trim(),

    fields: getMobileFields(row, config),

    expandable: true,

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",
  });
}

/* ==========================================================================
   Mobile Group
   ========================================================================== */

function createGroupId(groupKey, index) {
  const normalized = String(groupKey || `group-${index}`)
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `trading-negotiated-group-${normalized || index}`;
}

function renderGroup({ groupKey, cards, groupIndex }) {
  const titleId = createGroupId(groupKey, groupIndex);

  return `
    <section
      class="
        data-card-group
        trading-negotiated-group
      "
      ${groupKey ? `aria-labelledby="${escapeHtml(titleId)}"` : ""}
    >

      ${
        groupKey
          ? `
            <h3
              class="data-card-group__title"
              id="${escapeHtml(titleId)}"
            >
              ${escapeHtml(groupKey)}
            </h3>
          `
          : ""
      }

      <div
        class="
          data-card-group__items
          trading-card-list
        "
      >
        ${cards}
      </div>

    </section>
  `.trim();
}

/* ==========================================================================
   Public View
   ========================================================================== */

export function createNegotiatedView({ root, config, filters } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError("Negotiated Deals view requires a valid root element.");
  }

  if (!filters?.negotiated) {
    throw new TypeError("Negotiated Deals view requires Trading filters.");
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
    endpoint: config.endpoints.negotiatedDeals,

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
     * JSP is authoritative.
     *
     * This is essential because the JSP already owns:
     *
     * Date | Company | Price | Volume | Value | Time
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

      ...config.tables?.negotiatedDeals,

      /*
       * Trading uses the design-system .table-responsive wrapper as the
       * horizontal overflow owner.
       */
      scrollX: false,

      scrollCollapse: false,

      fixedHeader: false,

      fixedColumns: false,
    },

    createdRow(rowElement, row) {
      const total = isTotalRow(row);

      rowElement.classList.toggle("table-total-row", total);

      rowElement.classList.toggle("table-market__summary-row", total);
    },
  });

  /* =========================================================================
     Cards
     ========================================================================= */

  const cards = createDataCards({
    root,

    container: getCardsSelector(VIEW),

    initialView: VIEW,

    /*
     * Common cards own their professional skeleton / loading lifecycle.
     */
    renderCard(row, context) {
      return renderNegotiatedCard(row, context, config);
    },

    /*
     * All normalized rows, including total rows, carry the correct logical
     * group date.
     */
    getGroupKey(row) {
      return row?.__tradingGroupDate || "";
    },

    getGroupLabel(groupKey) {
      return groupKey;
    },

    renderGroup,

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load trading data.",

    afterRender(container) {
      container?.classList?.add(
        "trading-data-card-list",
        "trading-negotiated-card-list",
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

  /*
   * The common controller normally uses rows.length.
   *
   * Negotiated contains daily total rows, so its displayed result count must
   * use the backend/business count instead.
   */
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
     * trading.js explicitly decides when this active view loads.
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
     Loading State
     ========================================================================= */

  /*
   * Common table/cards/results already render their own skeleton/loading
   * states. This subscription only synchronizes the outer data-view ARIA
   * state so Trading never leaves cursor:wait behind after the request.
   */

  const unsubscribeState = state.subscribe(({ state: snapshot }) => {
    const loading = Boolean(snapshot.loading);

    root.setAttribute("aria-busy", String(loading));
  });

  /*
   * The JSP may currently ship aria-busy="true".
   *
   * The JS lifecycle becomes authoritative immediately after initialization.
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
        console.warn("Negotiated table adjustment failed:", error);
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
