/* ==========================================================================
   Market Watch
   ========================================================================== */

import {
  applyWatchlistFilter,
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
  getMobileColumns,
} from "./market-watch-schema.js";

import {
  escapeHtml,
  formatAuctionQuantity,
  formatAuctionValue,
  formatFullNumber,
  formatMarketOrder,
  getCompanyName,
  getCompanyReference,
  getDisplayValue,
  isZeroLike,
  renderChange,
  renderCompanyCell,
  renderMobileIdentity,
  renderMobileQuote,
  renderRange,
} from "./market-watch-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const SELECTORS = {
  industry: "[data-market-watch-industry]",
  tableView: "[data-market-watch-table-view]",
  watchlist: "[data-market-watch-watchlist]",

  columnsTrigger: "[data-market-watch-columns]",
  columnsMenu: "[data-market-watch-columns-menu]",
  columnsLabel: "[data-market-watch-columns-label]",
  columnInput: "[data-market-watch-column]",
  columnAction: "[data-market-watch-columns-action]",

  table: "[data-market-watch-table]",
  cards: "[data-market-watch-mobile-cards]",

  resultCount: "[data-market-watch-result-count]",

  favorite: "[data-market-watch-favorite]",
  logo: "[data-market-watch-logo]",
};

const instances = new WeakMap();

/* ==========================================================================
   Configuration
   ========================================================================== */

function getConfig() {
  const config = window.MarketWatchConfig;

  if (!config) {
    throw new Error("MarketWatchConfig is required.");
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

function getCellValue(row, column) {
  return column.data ? row?.[column.data] : "";
}

function getNumericValue(row, column) {
  return column.numericData
    ? row?.[column.numericData]
    : getCellValue(row, column);
}

function isAuction(config) {
  return Boolean(config.market?.isAuction ?? config.openCloseAuction);
}

function renderAuctionFullNumber(value, config) {
  if (isAuction(config) && isZeroLike(value)) {
    return "-";
  }

  return formatFullNumber(value, config);
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

    companyRef: row.companyRef ?? row.companySymbol ?? row.symbol ?? "",

    companySymbol: row.companySymbol ?? row.symbol ?? row.companyRef ?? "",

    sectorName: row.sectorName ?? row.sector ?? "",
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
    sectorParameter: state.industry || "all",

    tableViewParameter: String(state.tableView || "1"),

    /*
     * Watchlist Only is presentation-only for this page.
     *
     * Always request the complete data set so disabling Watchlist Only can
     * restore every source row immediately without another request.
     */
    iswatchListSelected: "NO",

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Column Groups
   ========================================================================== */

function getAvailableGroups(config, view) {
  return getColumnGroups(config, view).map((group) => group.id);
}

/* ==========================================================================
   Table Cell Rendering
   ========================================================================== */

function renderTableCell({ row, column, type, config }) {
  /*
   * Non-display DataTables operations should receive the underlying value
   * rather than presentation markup.
   */

  if (type === "sort" || type === "type" || type === "filter") {
    return getDisplayValue(getCellValue(row, column), "");
  }

  /* ------------------------------------------------------------------------
     Loading
     ------------------------------------------------------------------------ */

  if (row?.__dataViewState === "loading") {
    const size =
      column.key === "company" || column.type === "range"
        ? "table-skeleton-lg"
        : "table-skeleton-md";

    return `
      <span
        class="table-skeleton ${size}"
        aria-hidden="true"
      ></span>
    `.trim();
  }

  /* ------------------------------------------------------------------------
     Value
     ------------------------------------------------------------------------ */

  const value = getCellValue(row, column);

  switch (column.type) {
    case "company":
      return renderCompanyCell(row, config);

    case "range":
      return renderRange(row, config);

    case "auction-value":
      return escapeHtml(formatAuctionValue(value, config));

    case "auction-quantity":
      return escapeHtml(formatAuctionQuantity(value, config));

    case "auction-full-number":
      return escapeHtml(renderAuctionFullNumber(value, config));

    case "full-number":
      return escapeHtml(formatFullNumber(value, config));

    case "market-order":
      return escapeHtml(formatMarketOrder(value, config));

    case "change":
      return renderChange(value, getNumericValue(row, column));

    case "percent-change":
      return renderChange(value, getNumericValue(row, column), {
        percent: true,
      });

    case "text":
    default:
      return escapeHtml(getDisplayValue(value));
  }
}

/* ==========================================================================
   Sector Group
   ========================================================================== */

function renderSectorGroup({ groupName, groupRows, visibleColumnCount }) {
  /*
   * Loading rows must not produce sector headings.
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
   Mobile Field Labels
   ========================================================================== */

function getMobileFieldLabel(column, config) {
  const labels = config.labels?.table || {};

  const fieldLabel = cleanLabel(
    column.mobileLabel || column.label,
    column.label,
  );

  if (column.headerGroup === "best-bid") {
    return `${cleanLabel(labels.bestBid, "Best Bid")} ${fieldLabel}`;
  }

  if (column.headerGroup === "best-offer") {
    return `${cleanLabel(labels.bestOffer, "Best Offer")} ${fieldLabel}`;
  }

  return fieldLabel;
}

/* ==========================================================================
   Mobile Field Values
   ========================================================================== */

function renderMobileFieldValue(column, row, config) {
  const value = getCellValue(row, column);

  switch (column.type) {
    case "range":
      return renderRange(row, config);

    case "auction-value":
      return escapeHtml(formatAuctionValue(value, config));

    case "auction-quantity":
      return escapeHtml(formatAuctionQuantity(value, config));

    case "auction-full-number":
      return escapeHtml(renderAuctionFullNumber(value, config));

    case "full-number":
      return escapeHtml(formatFullNumber(value, config));

    case "market-order":
      return escapeHtml(formatMarketOrder(value, config));

    case "change":
      return renderChange(value, getNumericValue(row, column));

    case "percent-change":
      return renderChange(value, getNumericValue(row, column), {
        percent: true,
      });

    case "text":
    default:
      return escapeHtml(getDisplayValue(value));
  }
}

/* ==========================================================================
   Mobile Detail Schema
   ========================================================================== */

function getMobileDetailColumns(config, view, visibleGroups) {
  /*
   * These values are already rendered in the compact card summary.
   */

  const summaryColumns = new Set(["last-trade-price", "change-percent"]);

  return getMobileColumns(config, view, visibleGroups).filter(
    (column) => !summaryColumns.has(column.key),
  );
}

/* ==========================================================================
   Market Watch Card
   ========================================================================== */

function renderMarketWatchCard(row, context, config, visibleGroups) {
  const companyName = getCompanyName(row);

  const fields = getMobileDetailColumns(
    config,
    context.view,
    visibleGroups,
  ).map((column) => ({
    label: getMobileFieldLabel(column, config),

    value: renderMobileFieldValue(column, row, config),

    fullWidth: column.type === "range",

    numeric: column.type !== "range",
  }));

  const summary = `
    ${renderMobileIdentity(row, config)}

    ${renderMobileQuote(row, config)}
  `;

  return renderStandardDataCard({
    idPrefix: "market-watch-card-details",

    rowId: `${getCompanyReference(row)}-${context.index}`,

    summary,

    fields,

    moreLabel: `${cleanLabel(
      config.labels?.mobile?.showDetails,
      "Show details",
    )} ${companyName}`,

    lessLabel: `${cleanLabel(
      config.labels?.mobile?.hideDetails,
      "Hide details",
    )} ${companyName}`,
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

  const companyRef = button.dataset.companyRef || "";

  /*
   * Preserve the existing website-level watchlist action.
   */

  if (typeof window.showAddToWatchListPopup === "function") {
    window.showAddToWatchListPopup(companyRef);
  }

  /*
   * Also expose a page-level event for integrations that prefer events.
   */

  button.dispatchEvent(
    new CustomEvent("marketwatch:favorite-request", {
      bubbles: true,

      detail: {
        companyRef,
        button,
      },
    }),
  );
}

/* ==========================================================================
   Logo Fallback
   ========================================================================== */

function handleLogoError(event, scope) {
  const image = event.target;

  if (!(image instanceof HTMLImageElement) || !image.matches(SELECTORS.logo)) {
    return;
  }

  if (scope instanceof Element && !scope.contains(image)) {
    return;
  }

  const fallbackUrl = image.dataset.marketWatchLogoFallback;

  /*
   * Attempt the configured fallback only once.
   */

  if (fallbackUrl && !image.dataset.marketWatchLogoFallbackApplied) {
    image.dataset.marketWatchLogoFallbackApplied = "true";

    image.src = fallbackUrl;

    return;
  }

  /*
   * The fallback image also failed.
   */

  image
    .closest(".table-market__logo, .data-card__logo")
    ?.classList.add("is-image-missing");

  image.remove();
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initMarketWatch(root = document) {
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
      industry: {
        selector: SELECTORS.industry,

        effect: "reload",

        normalize(value) {
          return value || "all";
        },
      },

      tableView: {
        selector: SELECTORS.tableView,

        effect: "view",

        normalize(value) {
          return String(value || "1");
        },
      },

      /*
       * Authentication is intentionally outside this implementation for
       * now.
       *
       * Watchlist Only filters the already-loaded source rows.
       */
      watchlistOnly: {
        selector: SELECTORS.watchlist,

        effect: "client-filter",

        normalize(value) {
          return Boolean(value);
        },
      },
    },
  });

  /* ========================================================================
     Column Visibility
     ======================================================================== */

  const initialView = filters.getValue("tableView") || "1";

  const initialGroups = getAvailableGroups(config, initialView);

  const columnVisibility = createDataColumnVisibility({
    initialView,

    availableGroups: initialGroups,

    visibleGroups: config.initialState?.visibleGroups || initialGroups,
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
     * Market Watch owns the page-specific DOM attributes.
     *
     * The common picker remains page-agnostic.
     */

    getGroupId(input) {
      return input.dataset.marketWatchColumn || "";
    },

    getActionType(action) {
      return action.dataset.marketWatchColumnsAction || "";
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

    initialView,

    visibleGroups: columnVisibility.getVisibleGroups(),

    getColumns(view) {
      return getColumns(config, view);
    },

    getColumnGroups(view) {
      return getColumnGroups(config, view);
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
      return row.sectorName || "";
    },

    renderRowGroupStart(args) {
      return renderSectorGroup(args);
    },
  });

  /* ========================================================================
     Cards
     ======================================================================== */

  const cards = createDataCards({
    root: scope,

    container: SELECTORS.cards,

    initialView,

    getGroupKey(row) {
      return row.sectorName || "Other";
    },

    renderCard(row, context) {
      return renderMarketWatchCard(
        row,
        context,
        config,
        columnVisibility.getVisibleGroups(),
      );
    },

    /*
     * No `enhance()` callback is required here.
     *
     * The design-system Data View observer now automatically detects and
     * initializes dynamically inserted [data-data-card] elements.
     */

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load market data.",
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

          error: config.labels?.loadError || "Unable to load market data.",
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

    getView({ filters: filterState }) {
      return filterState.tableView || "1";
    },

    getAvailableGroups(view) {
      return getAvailableGroups(config, view);
    },

    /*
     * View-specific column visibility is synchronized silently by the
     * controller so the DataTable can change schema without intermediate
     * redraws.
     *
     * Refresh the DOM adapter once the final view state has been applied.
     *
     * This fixes the picker showing groups from the previously selected
     * table view.
     */
    onViewSync() {
      columnPicker.refresh();
    },

    /* --------------------------------------------------------------------
         Watchlist
         -------------------------------------------------------------------- */

    rowProcessors: [
      (rows, context) =>
        applyWatchlistFilter(rows, Boolean(context.filters.watchlistOnly)),
    ],

    /* --------------------------------------------------------------------
         Empty
         -------------------------------------------------------------------- */

    getEmptyMessage(context) {
      if (context.filters.watchlistOnly) {
        return (
          config.labels?.noWatchlistItems ||
          config.labels?.noData ||
          "No data available"
        );
      }

      return config.labels?.noData || "No data available";
    },

    /* --------------------------------------------------------------------
         Error
         -------------------------------------------------------------------- */

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        config.labels?.loadError ||
        config.labels?.noData ||
        "Unable to load market data."
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
   * Favorite controls exist in both desktop table rows and mobile cards.
   */

  scope.addEventListener(
    "click",
    (event) => {
      handleFavorite(event, scope);
    },
    eventOptions,
  );

  /*
   * Image error events do not bubble, so use capture.
   */

  scope.addEventListener(
    "error",
    (event) => {
      handleLogoError(event, scope);
    },
    {
      ...eventOptions,

      capture: true,
    },
  );

  /*
   * Existing watchlist integration may dispatch this after a successful
   * add/remove operation.
   */

  scope.addEventListener(
    "marketwatch:watchlist-updated",
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
  initMarketWatch(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
