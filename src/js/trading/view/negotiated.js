/* ==========================================================================
   Negotiated Deals View
   ========================================================================== */

/*
 * Negotiated Deals Trading view.
 *
 * Responsibilities:
 *
 * - preserve the JSP-owned six-column table header
 * - build the existing backend request
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
  formatDate,
  formatMoney,
  formatQuantity,
  getCompanyName,
  getCompanySymbol,
  isNegotiatedTotalRow,
  renderNegotiatedDailyTotalCard,
  renderTradingCardIdentity,
  renderTradingCompanyCell,
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

function getRowDate(row) {
  return firstDefined(
    row?.strDate,
    row?.date,
    row?.tradeDate,
    row?.transactionDate,
    row?.dealDate,
    row?.tradingDate,
    row?.createdDate,
    "",
  );
}

function getRowPrice(row) {
  return firstDefined(
    row?.tradePrice,
    row?.price,
    row?.dealPrice,
    row?.transactionPrice,
    "",
  );
}

function getRowVolume(row) {
  return firstDefined(
    row?.tradeVolume,
    row?.volume,
    row?.quantity,
    row?.dealVolume,
    row?.transactionVolume,
    row?.shares,
    "",
  );
}

function getRowValue(row) {
  return firstDefined(
    row?.turnOver,
    row?.turnover,
    row?.tradeValue,
    row?.value,
    row?.dealValue,
    row?.transactionValue,
    row?.amount,
    "",
  );
}

function getRowTime(row) {
  return firstDefined(
    row?.strTime,
    row?.time,
    row?.tradeTime,
    row?.transactionTime,
    row?.dealTime,
    "",
  );
}

/* ==========================================================================
   Columns
   ========================================================================== */

/*
 * Exact physical table contract:
 *
 * 1 Date
 * 2 Company
 * 3 Price
 * 4 Volume
 * 5 Value
 * 6 Time
 *
 * Company contains:
 *
 * [logo] Company Name
 *        Symbol
 */

function getColumns(config) {
  const labels = config.labels?.negotiatedDeals || {};

  return [
    {
      key: "date",
      label: labels.date || "Date",
      data: "strDate",
      width: "10%",
      className: "table-market__date",
    },

    {
      key: "company",
      label: labels.company || "Company",
      data: null,
      width: "17rem",
      className: "table-market__security",
    },

    {
      key: "trade-price",
      label: labels.price || "Price",
      data: "tradePrice",
      numeric: true,
      width: "8rem",
      className: "table-market__number table-market__price",
    },

    {
      key: "trade-volume",
      label: labels.volume || "Volume",
      data: "tradeVolume",
      numeric: true,
      width: "10rem",
      className: "table-market__number",
    },

    {
      key: "turnover",
      label: labels.value || "Value",
      data: "turnOver",
      numeric: true,
      width: "11rem",
      className: "table-market__number",
    },

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
   * Compatibility with the historical DataTables response.
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
 * Carry the most recent date onto a presentation-only property so the total
 * remains inside the correct mobile date group.
 */

function normalizeGrouping(rows, config) {
  let currentDate = "";

  return rows.map((row) => {
    if (!row || typeof row !== "object") {
      return row;
    }

    const rawDate = getRowDate(row);

    const rowDate = hasValue(rawDate) ? formatDate(rawDate, config) : "";

    if (hasValue(rowDate) && rowDate !== (config.labels?.notAvailable || "-")) {
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
   * Daily summary rows do not represent individual negotiated deals.
   */

  return rows.filter((row) => !isNegotiatedTotalRow(row)).length;
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

function normalizeResponse(response, config) {
  const raw = parseResponse(response);

  const rows = normalizeGrouping(getResponseRows(raw), config);

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
 * Keep six physical cells.
 *
 * Do not turn the total into a colspan row because the DataTable body must
 * remain geometrically compatible with the JSP-owned six-column header.
 */

function renderTotalCell({ row, column, config }) {
  switch (column.key) {
    case "company":
      return `
        <span
          class="table-market__summary-label"
        >
          ${escapeHtml(
            firstDefined(
              row?.label,
              row?.company,
              config.labels?.negotiatedDeals?.total,
              config.labels?.total,
              "Total",
            ),
          )}
        </span>
      `.trim();

    case "trade-volume":
      return `
        <span
          class="table-market__summary-value"
        >
          ${escapeHtml(
            formatQuantity(
              firstDefined(
                row?.totalVolume,
                row?.volumeTotal,
                row?.totalQuantity,
                row?.totalShares,
                row?.volume,
                row?.tradeVolume,
              ),
              config,
            ),
          )}
        </span>
      `.trim();

    case "turnover":
      return `
        <span
          class="table-market__summary-value"
        >
          ${escapeHtml(
            formatMoney(
              firstDefined(
                row?.totalValue,
                row?.valueTotal,
                row?.totalAmount,
                row?.value,
                row?.turnOver,
                row?.turnover,
              ),
              config,
            ),
          )}
        </span>
      `.trim();

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
  const { row, column } = args;

  if (isNegotiatedTotalRow(row)) {
    return renderTotalCell({
      ...args,
      config,
    });
  }

  switch (column.key) {
    case "date":
      return escapeHtml(formatDate(getRowDate(row), config));

    case "company":
      return renderTradingCompanyCell(row, config);

    case "trade-price":
      return escapeHtml(formatMoney(getRowPrice(row), config));

    case "trade-volume":
      return escapeHtml(formatQuantity(getRowVolume(row), config));

    case "turnover":
      return escapeHtml(formatMoney(getRowValue(row), config));

    case "time":
      return escapeHtml(
        firstDefined(getRowTime(row), config.labels?.notAvailable, "-"),
      );

    default:
      return "";
  }
}

/* ==========================================================================
   Mobile Details
   ========================================================================== */

function getMobileFields(row, config) {
  const labels = config.labels?.negotiatedDeals || {};

  return [
    {
      label: labels.volume || "Volume",

      value: formatQuantity(getRowVolume(row), config),

      numeric: true,
    },

    {
      label: labels.time || "Time",

      value: firstDefined(getRowTime(row), config.labels?.notAvailable, "-"),

      numeric: true,
    },
  ];
}

/* ==========================================================================
   Mobile Summary
   ========================================================================== */

function renderNegotiatedMobileSummary(row, config) {
  const labels = config.labels?.negotiatedDeals || {};

  return `
    <div
      class="data-card__quote"
    >
      <span
        class="data-card__symbol"
      >
        ${escapeHtml(labels.price || "Price")}
      </span>

      <span
        class="data-card__price"
      >
        ${escapeHtml(formatMoney(getRowPrice(row), config))}
      </span>

      <span
        class="data-card__meta"
      >
        ${escapeHtml(labels.value || "Value")}:
        ${escapeHtml(formatMoney(getRowValue(row), config))}
      </span>
    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderNegotiatedCard(row, context, config) {
  /*
   * Daily total is its own compact summary card.
   */

  if (isNegotiatedTotalRow(row)) {
    return renderNegotiatedDailyTotalCard(row, config);
  }

  const symbol = getCompanySymbol(row);

  const company = getCompanyName(row, config);

  return renderStandardDataCard({
    idPrefix: "trading-negotiated-details",

    rowId: `${symbol || company || "deal"}-${context.index}`,

    className: "trading-data-card trading-data-card--negotiated",

    /*
     * LEFT:
     *
     * logo + company + symbol
     *
     * RIGHT:
     *
     * price + value
     */
    summary: `
      ${renderTradingCardIdentity(row, config)}

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
      const normalized = normalizeResponse(response, config);

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
       * Shared Trading defaults.
       */
      ...config.tableDefaults,

      /*
       * Negotiated-specific overrides.
       */
      ...config.tables?.negotiatedDeals,

      /*
       * Negotiated remains a normal six-column DataTable.
       *
       * Horizontal scrolling belongs to .table-responsive.
       */
      scrollX: false,

      scrollCollapse: false,

      fixedHeader: true,

      fixedColumns: false,
    },

    /* ---------------------------------------------------------------------
       Row State
       --------------------------------------------------------------------- */

    createdRow(rowElement, row) {
      const total = isNegotiatedTotalRow(row);

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
   * Common table/cards own their visual loading state.
   *
   * This subscription synchronizes the outer data-view accessibility state.
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
