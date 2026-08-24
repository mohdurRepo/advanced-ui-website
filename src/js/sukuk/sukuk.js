/* ==========================================================================
   Sukuk & Bonds
   ========================================================================== */

import {
  createDataCards,
  createDataColumnPicker,
  createDataColumnVisibility,
  createDataFilters,
  createDataResults,
  createDataSource,
  createDataState,
  createDataTable,
  createDataViewController,
  renderStandardDataCard,
} from "../../common/data-view/index.js";

import {
  getColumnGroups,
  getColumns,
  getDefaultVisibleGroups,
  getMobileColumns,
} from "./sukuk-schema.js";

import {
  escapeHtml,
  formatCouponFrequency,
  formatCouponType,
  formatDayCountConvention,
  formatMaturity,
  formatPrice,
  formatQuantity,
  formatYield,
  getColumnValue,
  getDisplayValue,
  getInstrumentName,
  getInstrumentReference,
  renderInstrument,
  renderMobileIdentity,
  renderMobilePrice,
  renderWatchlist,
} from "./sukuk-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = "1";

const SELECTORS = {
  bondType: "[data-sukuk-bond-type]",

  columnsTrigger: "[data-sukuk-columns]",

  columnsMenu: "[data-sukuk-columns-menu]",

  columnsLabel: "[data-sukuk-columns-label]",

  columnInput: "[data-sukuk-column]",

  columnAction: "[data-sukuk-columns-action]",

  table: "[data-sukuk-table]",

  cards: "[data-sukuk-mobile-cards]",

  resultCount: "[data-sukuk-result-count]",

  favorite: "[data-sukuk-favorite]",
};

const instances = new WeakMap();

/* ==========================================================================
   Configuration
   ========================================================================== */

function getConfig() {
  const config = window.SukukConfig;

  if (!config) {
    throw new Error("SukukConfig is required.");
  }

  return config;
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function cleanLabel(value, fallback = "") {
  return String(value ?? fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAvailableGroups(config) {
  return getColumnGroups(config, VIEW).map((group) => group.id);
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

function getResponseRows(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    ...row,

    /*
     * Stable aliases useful to integrations without mutating/removing
     * any original API fields.
     */
    instrumentRef: getInstrumentReference(row),

    instrumentName: getInstrumentName(row),
  };
}

function normalizeResponse(response) {
  const rows = getResponseRows(response).map(normalizeRow).filter(Boolean);

  const total = Number(
    response?.total ??
      response?.recordsTotal ??
      response?.recordsFiltered ??
      rows.length,
  );

  return {
    rows,

    meta: {
      total: Number.isFinite(total) ? total : rows.length,

      updatedAt:
        response?.updatedAt ??
        response?.lastUpdated ??
        response?.timestamp ??
        null,
    },

    raw: response,
  };
}

/* ==========================================================================
   Request
   ========================================================================== */

function buildRequestData(config, state) {
  return {
    /*
     * Preserve the existing backend parameter name.
     */
    sectorParameter: state.bondType || "all",

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Table Cell Rendering
   ========================================================================== */

function renderTableCell({ row, column, type, config }) {
  /*
   * Return plain values for DataTables' non-display operations.
   *
   * Sukuk ordering/searching are currently disabled, but keeping this
   * distinction makes the renderer safe if those capabilities are enabled
   * later.
   */

  if (type === "sort" || type === "type" || type === "filter") {
    if (column.type === "instrument") {
      return getInstrumentName(row);
    }

    return getDisplayValue(getColumnValue(row, column, ""), "");
  }

  /* ------------------------------------------------------------------------
     Loading
     ------------------------------------------------------------------------ */

  if (row?.__dataViewState === "loading") {
    const size =
      column.type === "instrument" ? "table-skeleton-lg" : "table-skeleton-md";

    return `
      <span
        class="table-skeleton ${size}"
        aria-hidden="true"
      ></span>
    `.trim();
  }

  /* ------------------------------------------------------------------------
     Display
     ------------------------------------------------------------------------ */

  const value = getColumnValue(row, column, "");

  switch (column.type) {
    case "instrument":
      return renderInstrument(row);

    case "coupon-type":
      return escapeHtml(formatCouponType(value, config));

    case "maturity":
      return escapeHtml(formatMaturity(row, config));

    case "yield":
      return escapeHtml(formatYield(value));

    case "price":
      return escapeHtml(formatPrice(value));

    case "quantity":
      return escapeHtml(formatQuantity(value, config));

    case "coupon-frequency":
      return escapeHtml(formatCouponFrequency(value, config));

    case "day-count-convention":
      return escapeHtml(formatDayCountConvention(value, config));

    case "watchlist":
      return renderWatchlist(row);

    case "display-value":
    case "text":
    default:
      return escapeHtml(getDisplayValue(value));
  }
}

/* ==========================================================================
   Sukuk Group
   ========================================================================== */

function getSukukGroup(row, config) {
  const bondType = String(row?.bondType ?? "")
    .trim()
    .toUpperCase();

  if (bondType === "G") {
    return config.labels?.government || "Government Sukuk";
  }

  return config.labels?.corporate || "Corporate Sukuk";
}

/* ==========================================================================
   Row Group Renderer
   ========================================================================== */

function renderSukukGroup({ groupName, groupRows, visibleColumnCount }) {
  /*
   * Do not render a group heading for table skeleton rows.
   */

  const loading = groupRows
    .data()
    .toArray()
    .some((row) => row?.__dataViewState === "loading");

  if (loading) {
    return null;
  }

  const row = document.createElement("tr");

  row.className = "table-market__group-row table-group-row";

  const label = document.createElement("th");

  label.scope = "rowgroup";

  label.className =
    "table-market__group-label table-group-label table-group-label-sticky";

  label.textContent = groupName || "";

  const fill = document.createElement("td");

  fill.className = "table-market__group-fill table-group-fill";

  fill.colSpan = Math.max(1, visibleColumnCount - 1);

  fill.setAttribute("aria-hidden", "true");

  row.append(label, fill);

  return row;
}

/* ==========================================================================
   Mobile Field Rendering
   ========================================================================== */

function renderMobileFieldValue(column, row, config) {
  const value = getColumnValue(row, column, "");

  switch (column.type) {
    case "coupon-type":
      return escapeHtml(formatCouponType(value, config));

    case "maturity":
      return escapeHtml(formatMaturity(row, config));

    case "yield":
      return escapeHtml(formatYield(value));

    case "price":
      return escapeHtml(formatPrice(value));

    case "quantity":
      return escapeHtml(formatQuantity(value, config));

    case "coupon-frequency":
      return escapeHtml(formatCouponFrequency(value, config));

    case "day-count-convention":
      return escapeHtml(formatDayCountConvention(value, config));

    case "watchlist":
      return renderWatchlist(row);

    case "display-value":
    case "text":
    default:
      return escapeHtml(getDisplayValue(value));
  }
}

/* ==========================================================================
   Mobile Detail Columns
   ========================================================================== */

function getMobileDetailColumns(config, visibleGroups) {
  /*
   * Last Trade Price is already displayed in the compact summary.
   */

  const summaryColumns = new Set(["last-trade-price"]);

  return getMobileColumns(config, VIEW, visibleGroups).filter(
    (column) => !summaryColumns.has(column.key),
  );
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderSukukCard(row, context, config, visibleGroups) {
  const instrumentName = getInstrumentName(row);

  const instrumentRef = getInstrumentReference(row);

  const fields = getMobileDetailColumns(config, visibleGroups).map(
    (column) => ({
      label: cleanLabel(column.label, column.key),

      value: renderMobileFieldValue(column, row, config),

      numeric: ["yield", "price", "quantity"].includes(column.type),
    }),
  );

  const summary = `
    ${renderMobileIdentity(row)}

    ${renderMobilePrice(row)}
  `;

  return renderStandardDataCard({
    idPrefix: "sukuk-card-details",

    rowId: `${instrumentRef || "instrument"}-${context.index}`,

    summary,

    fields,

    moreLabel: `${cleanLabel(
      config.labels?.mobile?.showDetails,
      "Show details",
    )} ${instrumentName}`,

    lessLabel: `${cleanLabel(
      config.labels?.mobile?.hideDetails,
      "Hide details",
    )} ${instrumentName}`,
  });
}

/* ==========================================================================
   Favorite Action
   ========================================================================== */

function handleFavorite(event, scope) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest(SELECTORS.favorite);

  if (!button) {
    return;
  }

  if (scope instanceof Element && !scope.contains(button)) {
    return;
  }

  event.preventDefault();

  const instrumentRef = button.dataset.instrumentRef || "";

  /*
   * Preserve the existing site-level watchlist integration.
   */

  if (typeof window.showAddToWatchListPopup === "function") {
    window.showAddToWatchListPopup(instrumentRef);
  }

  /*
   * Also provide a module event for future integrations.
   */

  button.dispatchEvent(
    new CustomEvent("sukuk:favorite-request", {
      bubbles: true,

      detail: {
        instrumentRef,
        button,
      },
    }),
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initSukuk(root = document) {
  const scope = root;

  const existing = instances.get(scope);

  if (existing) {
    return existing;
  }

  const config = getConfig();

  /* ========================================================================
     State
     ======================================================================== */

  const state = createDataState({
    loading: false,

    sourceRows: [],
    visibleRows: [],

    meta: {},

    error: null,
  });

  /* ========================================================================
     Filters
     ======================================================================== */

  const filters = createDataFilters({
    root: scope,

    fields: {
      bondType: {
        selector: SELECTORS.bondType,

        effect: "reload",

        normalize(value) {
          return value || "all";
        },
      },
    },
  });

  /* ========================================================================
     Column Visibility
     ======================================================================== */

  const availableGroups = getAvailableGroups(config);

  const configuredGroups = config.initialState?.visibleGroups;

  const initialVisibleGroups = Array.isArray(configuredGroups)
    ? configuredGroups
    : getDefaultVisibleGroups();

  const columnVisibility = createDataColumnVisibility({
    initialView: VIEW,

    availableGroups,

    visibleGroups: initialVisibleGroups,
  });

  /* ========================================================================
     Column Picker
     ======================================================================== */

  const columnPicker = createDataColumnPicker({
    root: scope,

    visibility: columnVisibility,

    trigger: SELECTORS.columnsTrigger,

    menu: SELECTORS.columnsMenu,

    label: SELECTORS.columnsLabel,

    inputs: SELECTORS.columnInput,

    inputSelector: SELECTORS.columnInput,

    actionSelector: SELECTORS.columnAction,

    optionSelector: ".filter-bar__columns-option",

    /*
     * Keep the common column picker completely unaware of Sukuk-specific
     * data attributes.
     */

    getGroupId(input) {
      return input.dataset.sukukColumn || "";
    },

    getActionType(action) {
      return action.dataset.sukukColumnsAction || "";
    },

    labels: {
      all: config.labels?.showAll || "Show All",

      none: config.labels?.noColumns || "No Columns",

      selectedSuffix: config.labels?.selectedSuffix || "Selected",
    },
  });

  /* ========================================================================
     Data Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoint,

    buildRequestData(filterState) {
      return buildRequestData(config, filterState);
    },

    normalizeResponse,
  });

  /* ========================================================================
     Table
     ======================================================================== */

  const table = createDataTable({
    root: scope,

    table: SELECTORS.table,

    initialView: VIEW,

    visibleGroups: columnVisibility.getVisibleGroups(),

    getColumns() {
      return getColumns(config, VIEW);
    },

    getColumnGroups() {
      return getColumnGroups(config, VIEW);
    },

    renderCell(args) {
      return renderTableCell({
        ...args,

        config,
      });
    },

    tableOptions: {
      autoWidth: config.table?.autoWidth ?? false,

      paging: config.table?.paging ?? false,

      pageLength: config.table?.pageLength ?? 25,

      lengthChange: config.table?.lengthChange ?? false,

      searching: config.table?.searching ?? false,

      ordering: config.table?.ordering ?? false,

      info: config.table?.info ?? false,

      serverSide: config.table?.serverSide ?? false,

      processing: config.table?.processing ?? false,

      scrollX: config.table?.scrollX !== false,

      scrollCollapse: config.table?.scrollCollapse !== false,

      fixedHeader: config.table?.fixedHeader ?? true,

      fixedColumns: config.table?.fixedColumns ?? 1,

      rowGroup: {},

      layout: {
        topStart: null,
        topEnd: null,
        bottomStart: null,
        bottomEnd: null,
      },
    },

    getRowGroup(row) {
      return getSukukGroup(row, config);
    },

    renderRowGroupStart(args) {
      return renderSukukGroup(args);
    },
  });

  /* ========================================================================
     Cards
     ======================================================================== */

  const cards = createDataCards({
    root: scope,

    container: SELECTORS.cards,

    initialView: VIEW,

    /*
     * Mobile cards use the same Government / Corporate grouping as the
     * desktop table.
     */

    getGroupKey(row) {
      return getSukukGroup(row, config);
    },

    renderCard(row, context) {
      return renderSukukCard(
        row,
        context,
        config,
        columnVisibility.getVisibleGroups(),
      );
    },

    /*
     * No page-specific design-system enhancement is necessary.
     *
     * common/data-cards.js already calls Theme.dataView.refresh(container)
     * after dynamic rendering.
     */

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load Sukuk data.",
  });

  /* ========================================================================
     Results
     ======================================================================== */

  const resultCountElement = scope.querySelector(SELECTORS.resultCount);

  const results = resultCountElement
    ? createDataResults({
        root: scope,

        count: resultCountElement,

        labels: {
          results: config.labels?.results || "Results",

          empty: config.labels?.noData || "No data available",

          error: config.labels?.loadError || "Unable to load Sukuk data.",
        },
      })
    : null;

  /* ========================================================================
     Controller
     ======================================================================== */

  const controller = createDataViewController({
    source,
    state,
    filters,
    columnVisibility,
    table,
    cards,
    results,

    /*
     * Sukuk currently has one schema/view.
     */

    getView() {
      return VIEW;
    },

    getAvailableGroups() {
      return getAvailableGroups(config);
    },

    /*
     * Column visibility is synchronized silently by the controller.
     * Refresh the picker once final state is ready.
     *
     * This uses the same fix validated on Market Watch.
     */
    onViewSync() {
      columnPicker.refresh();
    },

    getEmptyMessage() {
      return config.labels?.noData || "No data available";
    },

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        config.labels?.loadError ||
        config.labels?.noData ||
        "Unable to load Sukuk data."
      );
    },

    autoLoad: true,
  });

  /* ========================================================================
     Page Events
     ======================================================================== */

  const abortController = new AbortController();

  const eventOptions = {
    signal: abortController.signal,
  };

  /*
   * Watchlist/favorite controls may appear in desktop cells and mobile cards.
   */

  scope.addEventListener(
    "click",
    (event) => {
      handleFavorite(event, scope);
    },
    eventOptions,
  );

  /*
   * Existing application watchlist integration can dispatch this event after
   * an add/remove action succeeds.
   *
   * Reloading refreshes the star state returned by the backend.
   */

  scope.addEventListener(
    "sukuk:watchlist-updated",
    () => {
      controller.reload();
    },
    eventOptions,
  );

  /* ========================================================================
     Initialization
     ======================================================================== */

  controller.init();

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    destroy() {
      abortController.abort();

      columnPicker.destroy();

      controller.destroy();

      instances.delete(scope);
    },

    reload() {
      return controller.reload();
    },

    getFilters() {
      return filters.getState();
    },

    getRows() {
      return controller.getSourceRows();
    },

    getVisibleRows() {
      return controller.getVisibleRows();
    },

    getTable() {
      return table.getApi();
    },

    getColumnVisibility() {
      return columnVisibility;
    },
  });

  instances.set(scope, instance);

  return instance;
}

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  initSukuk(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
