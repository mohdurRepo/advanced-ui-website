/* ==========================================================================
   Listed Tradable Rights Table
   ========================================================================== */

/*
 * Desktop and tablet table view for Listed Tradable Rights.
 *
 * Responsibilities:
 *
 * - bind normalized rows to the existing grouped JSP header
 * - configure the 14 DataTables columns
 * - enable column sorting
 * - preserve numeric sorting through orthogonal renderers
 * - render loading, empty, and error states
 * - maintain the FixedHeader layout
 *
 * This module intentionally has no:
 *
 * - endpoint code
 * - request lifecycle
 * - response normalization
 * - mobile card rendering
 * - tab activation behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataTable } from "../../../../../common/data-view/index.js";

import { createTradingTableOptions } from "../../../../shared/trading/trading-table-options.js";

import { createListedTradableRightsFormatters } from "../listed-tradable-rights.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const SELECTORS = Object.freeze({
  table: "[data-listed-tradable-rights-table]",

  region: "[data-listed-tradable-rights-table-region]",
});

const COLUMN_CLASSES = Object.freeze({
  identity: "table-market__security",

  number: "table-market__number",

  change: "table-market__change table-market__number",
});

const SKELETON_SIZES = Object.freeze({
  identity: "table-skeleton-lg",

  price: "table-skeleton-sm",

  quantity: "table-skeleton-md",

  change: "table-skeleton-sm",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1);
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function getRootElement(root) {
  if (root && typeof root.querySelector === "function") {
    return root;
  }

  throw new TypeError(
    "Listed Tradable Rights table requires a valid root element.",
  );
}

function resolveRequiredElement(root, selector, name) {
  const element = root.querySelector(selector);

  if (!isElement(element)) {
    throw new Error(`Listed Tradable Rights ${name} was not found.`);
  }

  return element;
}

function isLoadingRow(row = {}) {
  return row.__dataViewState === "loading";
}

/* ==========================================================================
   Loading Cell
   ========================================================================== */

function renderLoadingCell(size = SKELETON_SIZES.price) {
  return `
    <span
      class="table-skeleton ${size}"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Column Renderer Adapter
   ========================================================================== */

function createColumnRenderer(renderer, skeletonSize) {
  return function renderColumn({ row, type, meta }) {
    if (isLoadingRow(row)) {
      return type === "display" ? renderLoadingCell(skeletonSize) : "";
    }

    return renderer(null, type, row, meta);
  };
}

/* ==========================================================================
   Column Definitions
   ========================================================================== */

function createColumns(formatters) {
  const table = formatters.table;

  return [
    /* ----------------------------------------------------------------------
       Tradable Right Identity
       ---------------------------------------------------------------------- */

    {
      key: "identity",

      className: COLUMN_CLASSES.identity,

      orderable: true,

      searchable: true,

      render: createColumnRenderer(table.identity, SKELETON_SIZES.identity),
    },

    /* ----------------------------------------------------------------------
       Last Trade
       ---------------------------------------------------------------------- */

    {
      key: "last-trade-price",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.lastTradePrice, SKELETON_SIZES.price),
    },

    {
      key: "last-trade-volume",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(
        table.lastTradeVolume,
        SKELETON_SIZES.quantity,
      ),
    },

    {
      key: "change-value",

      className: COLUMN_CLASSES.change,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.changeValue, SKELETON_SIZES.change),
    },

    {
      key: "change-percent",

      className: COLUMN_CLASSES.change,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.changePercent, SKELETON_SIZES.change),
    },

    /* ----------------------------------------------------------------------
       Today
       ---------------------------------------------------------------------- */

    {
      key: "today-open",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.todayOpen, SKELETON_SIZES.price),
    },

    {
      key: "today-high",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.todayHigh, SKELETON_SIZES.price),
    },

    {
      key: "today-low",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.todayLow, SKELETON_SIZES.price),
    },

    /* ----------------------------------------------------------------------
       Cumulative
       ---------------------------------------------------------------------- */

    {
      key: "number-of-trades",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(
        table.numberOfTrades,
        SKELETON_SIZES.quantity,
      ),
    },

    {
      key: "volume-traded",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.volumeTraded, SKELETON_SIZES.quantity),
    },

    /* ----------------------------------------------------------------------
       Best Bid
       ---------------------------------------------------------------------- */

    {
      key: "bid-price",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.bidPrice, SKELETON_SIZES.price),
    },

    {
      key: "bid-volume",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.bidVolume, SKELETON_SIZES.quantity),
    },

    /* ----------------------------------------------------------------------
       Best Offer
       ---------------------------------------------------------------------- */

    {
      key: "offer-price",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.offerPrice, SKELETON_SIZES.price),
    },

    {
      key: "offer-volume",

      className: COLUMN_CLASSES.number,

      orderable: true,

      searchable: false,

      render: createColumnRenderer(table.offerVolume, SKELETON_SIZES.quantity),
    },
  ];
}

/* ==========================================================================
   Public Table View
   ========================================================================== */

export function createListedTradableRightsTable(options = {}) {
  if (!isObject(options)) {
    throw new TypeError(
      "createListedTradableRightsTable requires an options object.",
    );
  }

  const root = getRootElement(options.root);

  const config = isObject(options.config) ? options.config : {};

  const formatters =
    options.formatters || createListedTradableRightsFormatters(config);

  const tableElement = resolveRequiredElement(root, SELECTORS.table, "table");

  const regionElement = resolveRequiredElement(
    root,
    SELECTORS.region,
    "table region",
  );

  const columns = createColumns(formatters);

  const noDataMessage =
    normalizeString(config.labels?.noData) || "No data available.";

  const errorMessage =
    normalizeString(config.labels?.error) || "Unable to load data.";

  let destroyed = false;

  /* ========================================================================
     DataTables Options
     ======================================================================== */

  const tableOptions = createTradingTableOptions({
    paging: false,

    searching: false,

    ordering: true,

    /*
     * Preserve service order on initial load.
     *
     * A user can sort any leaf column after the table is rendered.
     */

    order: [],

    info: false,

    lengthChange: false,

    scrollX: true,

    scrollCollapse: true,

    fixedHeader: {
      header: true,

      footer: false,
    },

    fixedColumns: false,

    rowGroup: false,

    responsive: false,

    language: {
      emptyTable: noDataMessage,

      zeroRecords: noDataMessage,
    },

    createdRow(row, data) {
      if (!isLoadingRow(data)) {
        return;
      }

      row.classList.add("is-loading");

      row.setAttribute("aria-hidden", "true");
    },
  });

  /* ========================================================================
     Shared Table
     ======================================================================== */

  const table = createDataTable({
    root,

    table: tableElement,

    /*
     * Preserve the semantic grouped header rendered by the JSP.
     */

    headerMode: "existing",

    autoInit: false,

    getColumns() {
      return columns;
    },

    tableOptions,

    loadingRowCount: options.loadingRowCount || 6,

    emptyMessage: noDataMessage,

    errorMessage,

    onDraw(api, context) {
      options.onDraw?.(api, context);
    },

    onInit(api, context) {
      options.onInit?.(api, context);
    },
  });

  /* ========================================================================
     Busy State
     ======================================================================== */

  function setBusy(busy) {
    const value = String(Boolean(busy));

    regionElement.setAttribute("aria-busy", value);

    tableElement.setAttribute("aria-busy", value);
  }

  /* ========================================================================
     Loading
     ======================================================================== */

  function renderLoading() {
    if (destroyed) {
      return;
    }

    setBusy(true);

    table.showLoading();
  }

  /* ========================================================================
     Rows
     ======================================================================== */

  function renderRows(rows = []) {
    if (destroyed) {
      return;
    }

    const normalizedRows = Array.isArray(rows) ? rows : [];

    setBusy(false);

    if (!normalizedRows.length) {
      renderEmpty();

      return;
    }

    table.setRows(normalizedRows);
  }

  /* ========================================================================
     Empty
     ======================================================================== */

  function renderEmpty(message = noDataMessage) {
    if (destroyed) {
      return;
    }

    setBusy(false);

    table.showEmpty(normalizeString(message) || noDataMessage);
  }

  /* ========================================================================
     Error
     ======================================================================== */

  function renderError(message = errorMessage) {
    if (destroyed) {
      return;
    }

    setBusy(false);

    table.showError(normalizeString(message) || errorMessage);
  }

  /* ========================================================================
     Layout
     ======================================================================== */

  function adjust() {
    if (destroyed) {
      return;
    }

    /*
     * The panel may have become visible during the same event cycle.
     * Waiting one frame allows DataTables and FixedHeader to measure it.
     */

    window.requestAnimationFrame(() => {
      if (!destroyed) {
        table.adjust();
      }
    });
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    setBusy(false);

    table.destroy();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    adjust,
    destroy,

    renderEmpty,
    renderError,
    renderLoading,
    renderRows,

    getApi() {
      return table.getApi();
    },

    getRows() {
      return table.getRows();
    },

    getState() {
      return table.getState();
    },
  });
}
