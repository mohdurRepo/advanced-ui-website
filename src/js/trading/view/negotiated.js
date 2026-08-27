/* ==========================================================================
   Negotiated Deals View
   ========================================================================== */

/*
 * Negotiated Deals Trading view.
 *
 * Responsibilities:
 *
 * - define the exact six-column Negotiated contract
 * - preserve the JSP-owned table header
 * - build the exact backend request
 * - normalize legacy/current response wrappers
 * - preserve daily total rows
 * - render Market Watch-style company identity
 * - render grouped mobile cards
 * - render daily summary cards
 *
 * Shared responsibilities remain in common/data-view:
 *
 * - request cancellation
 * - loading skeletons
 * - DataTables lifecycle
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
 * Exact physical body/header contract:
 *
 * 1 Date
 * 2 Company identity
 * 3 Price
 * 4 Volume
 * 5 Value
 * 6 Time
 *
 * Symbol belongs beneath Company Name.
 *
 * It is supporting identity metadata, not a seventh table column.
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
       Company Identity
       ---------------------------------------------------------------------- */

    {
      key: "company",

      label: labels.company || "Company Name",

      data: "company",

      /*
       * Shared formatter renders:
       *
       * [logo] Company Name
       *        Symbol
       */
      format: "identity",

      view: VIEW,

      width: "17rem",

      className: "table-market__security",
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

      width: "8rem",

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

      width: "10rem",

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

      width: "11rem",

      className: "table-market__number",
    },

    /* ----------------------------------------------------------------------
       Time
       ---------------------------------------------------------------------- */

    {
      key: "time",

      label: labels.time || "Time",

      data: "strTime",

      width: "8rem",

      className: "table-market__number",
    },
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

/*
 * Exact existing backend contract.
 */

function buildRequestData(filters, config) {
  const state = filters.getNegotiatedRequestState();

  return {
    type: state.type,

    sector: state.sector,

    company: state.company,

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

  /*
   * Legacy DataTables response shape.
   */

  if (Array.isArray(value?.aaData)) {
    return value.aaData;
  }

  return [];
}

/* ==========================================================================
   Group Normalization
   ========================================================================== */

/*
 * Historical daily-total records may omit strDate.
 *
 * Carry the most recent date onto an internal presentation-only property so
 * the total remains inside the correct mobile date group.
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
   * Daily summary rows do not represent individual deals.
   */

  return rows.filter((row) => !isTotalRow(row)).length;
}

/* ==========================================================================
   Response Normalization
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
 * IMPORTANT:
 *
 * The total remains six physical cells.
 *
 * Do not mutate it into a colspan row because DataTables requires body/header
 * geometry to remain compatible.
 */

function renderTotalCell({ row, column, config }) {
  switch (column.key) {
    /* ----------------------------------------------------------------------
       Company / Label
       ---------------------------------------------------------------------- */

    case "company":
      return `
        <span
          class="table-market__summary-label"
        >
          ${escapeHtml(
            firstDefined(row.label, row.company, config.labels?.total, "Total"),
          )}
        </span>
      `.trim();

    /* ----------------------------------------------------------------------
       Volume
       ---------------------------------------------------------------------- */

    case "trade-volume":
      return `
        <span
          class="table-market__summary-value"
        >
          ${escapeHtml(
            formatQuantity(
              firstDefined(
                row.volume,
                row.totalVolume,
                row.tradeVolume,
                row.tradedVolume,
              ),
              config,
            ),
          )}
        </span>
      `.trim();

    /* ----------------------------------------------------------------------
       Value
       ---------------------------------------------------------------------- */

    case "turnover":
      return `
        <span
          class="table-market__summary-value"
        >
          ${escapeHtml(
            formatMoney(
              firstDefined(
                row.value,
                row.totalValue,
                row.turnOver,
                row.turnover,
              ),
              config,
            ),
          )}
        </span>
      `.trim();

    /* ----------------------------------------------------------------------
       Intentionally Empty
       ---------------------------------------------------------------------- */

    case "date":
    case "trade-price":
    case "time":
    default:
      return "";
  }
}

/* ==========================================================================
   Cell Rendering
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

/*
 * Mobile summary already contains:
 *
 * Company identity
 * Price
 * Value
 *
 * Therefore expandable details contain only:
 *
 * Volume
 * Time
 */

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
  /*
   * Daily total is its own compact summary card.
   */

  if (isTotalRow(row)) {
    return renderNegotiatedDailyTotalCard(row, config);
  }

  const identity = getTradingIdentity(row, VIEW);

  return renderStandardDataCard({
    idPrefix: "trading-negotiated-details",

    rowId: `${identity.code || identity.name || "deal"}-${context.index}`,

    className: "trading-data-card trading-data-card--negotiated",

    /*
     * Same composition philosophy as Market Watch:
     *
     * LEFT
     *   logo + company + symbol
     *
     * RIGHT
     *   price + value
     */
    summary: `
      ${renderMobileIdentity(row, VIEW, config)}

      ${renderNegotiatedMobileSummary(row, config)}
    `.trim(),

    fields: getMobileFields(row, config),

    expandable: true,

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",
  });
}

/* ==========================================================================
   Mobile Group ID
   ========================================================================== */

function createGroupId(groupKey, index) {
  const normalized = String(groupKey || `group-${index}`)
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `trading-negotiated-group-${normalized || index}`;
}

/* ==========================================================================
   Mobile Group
   ========================================================================== */

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
            `.trim()
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
     * JSP owns:
     *
     * Date
     * Company
     * Price
     * Volume
     * Value
     * Time
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
       * Generic Trading defaults first.
       */
      ...config.tableDefaults,

      /*
       * Negotiated overrides are authoritative.
       *
       * Current contract:
       *
       * fixedHeader   = true
       * fixedColumns  = 0
       * scrollX       = false
       *
       * .table-responsive owns containment/overflow.
       */
      ...config.tables?.negotiatedDeals,
    },

    /* ---------------------------------------------------------------------
         Row State
         --------------------------------------------------------------------- */

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
     * common/data-view owns skeletons and DataViewCard enhancement.
     */
    renderCard(row, context) {
      return renderNegotiatedCard(row, context, config);
    },

    /* ---------------------------------------------------------------------
         Date Grouping
         --------------------------------------------------------------------- */

    getGroupKey(row) {
      return row?.__tradingGroupDate || "";
    },

    getGroupLabel(groupKey) {
      return groupKey;
    },

    renderGroup,

    /* ---------------------------------------------------------------------
         States
         --------------------------------------------------------------------- */

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

      /*
       * JSP owns the visible Results label.
       *
       * Common JS updates only the value node.
       */
      results: "",
    },
  });

  /*
   * Negotiated responses may contain daily total rows.
   *
   * Use the business/backend count instead of rows.length.
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
     * trading.js owns when the active tab/variant loads.
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

  /*
   * Common table/cards own the visual skeleton state.
   *
   * This subscription synchronizes only the outer data-view accessibility
   * state.
   */

  const unsubscribeState = state.subscribe(({ state: snapshot }) => {
    root.setAttribute("aria-busy", String(Boolean(snapshot.loading)));
  });

  /*
   * JSP no longer owns static aria-busy.
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
     * Important after:
     *
     * - initial hidden tab initialization
     * - returning from Minimum Size
     * - viewport changes
     */

    requestAnimationFrame(() => {
      try {
        api.columns?.adjust?.();

        api.fixedHeader?.adjust?.();

        api.responsive?.recalc?.();
      } catch (error) {
        console.warn("Negotiated table adjustment failed:", error);
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
