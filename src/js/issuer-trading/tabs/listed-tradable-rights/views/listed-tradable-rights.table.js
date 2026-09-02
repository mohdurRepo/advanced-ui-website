/* ==========================================================================
   Listed Tradable Rights Table
   ========================================================================== */

/*
 * Desktop and tablet presentation for Listed Tradable Rights.
 *
 * Responsibilities:
 *
 * - define the 14-column table schema
 * - preserve the existing grouped JSP header
 * - connect normalized rows to presentation formatters
 * - preserve numeric sorting through orthogonal renderers
 * - expose Listed Tradable Rights DataTables options
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - DataTables initialization
 * - request lifecycle
 * - loading / empty / error coordination
 * - response normalization
 * - mobile card rendering
 * - tab activation behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createListedTradableRightsFormatters } from "../listed-tradable-rights.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "listed-tradable-rights";

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

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function isLoadingRow(row = {}) {
  return row.__dataViewState === "loading";
}

/* ==========================================================================
   Loading
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
   Column Factory
   ========================================================================== */

function createColumn({
  key,
  className,
  formatter,
  skeletonSize,
  searchable = false,
}) {
  return Object.freeze({
    key,

    className,

    orderable: true,

    searchable,

    /*
     * Common createDataTable() gives column-level renderers priority over
     * the page-level renderCell callback.
     */
    render({ row, type, meta }) {
      if (isLoadingRow(row)) {
        return type === "display" ? renderLoadingCell(skeletonSize) : "";
      }

      return formatter(null, type, row, meta);
    },
  });
}

/* ==========================================================================
   Column Schema
   ========================================================================== */

function createColumns(formatters) {
  const table = formatters.table;

  return Object.freeze([
    /* ----------------------------------------------------------------------
       Tradable Right Identity
       ---------------------------------------------------------------------- */

    createColumn({
      key: "identity",

      className: COLUMN_CLASSES.identity,

      formatter: table.identity,

      skeletonSize: SKELETON_SIZES.identity,

      searchable: true,
    }),

    /* ----------------------------------------------------------------------
       Last Trade
       ---------------------------------------------------------------------- */

    createColumn({
      key: "last-trade-price",

      className: COLUMN_CLASSES.number,

      formatter: table.lastTradePrice,

      skeletonSize: SKELETON_SIZES.price,
    }),

    createColumn({
      key: "last-trade-volume",

      className: COLUMN_CLASSES.number,

      formatter: table.lastTradeVolume,

      skeletonSize: SKELETON_SIZES.quantity,
    }),

    createColumn({
      key: "change-value",

      className: COLUMN_CLASSES.change,

      formatter: table.changeValue,

      skeletonSize: SKELETON_SIZES.change,
    }),

    createColumn({
      key: "change-percent",

      className: COLUMN_CLASSES.change,

      formatter: table.changePercent,

      skeletonSize: SKELETON_SIZES.change,
    }),

    /* ----------------------------------------------------------------------
       Today
       ---------------------------------------------------------------------- */

    createColumn({
      key: "today-open",

      className: COLUMN_CLASSES.number,

      formatter: table.todayOpen,

      skeletonSize: SKELETON_SIZES.price,
    }),

    createColumn({
      key: "today-high",

      className: COLUMN_CLASSES.number,

      formatter: table.todayHigh,

      skeletonSize: SKELETON_SIZES.price,
    }),

    createColumn({
      key: "today-low",

      className: COLUMN_CLASSES.number,

      formatter: table.todayLow,

      skeletonSize: SKELETON_SIZES.price,
    }),

    /* ----------------------------------------------------------------------
       Cumulative
       ---------------------------------------------------------------------- */

    createColumn({
      key: "number-of-trades",

      className: COLUMN_CLASSES.number,

      formatter: table.numberOfTrades,

      skeletonSize: SKELETON_SIZES.quantity,
    }),

    createColumn({
      key: "volume-traded",

      className: COLUMN_CLASSES.number,

      formatter: table.volumeTraded,

      skeletonSize: SKELETON_SIZES.quantity,
    }),

    /* ----------------------------------------------------------------------
       Best Bid
       ---------------------------------------------------------------------- */

    createColumn({
      key: "bid-price",

      className: COLUMN_CLASSES.number,

      formatter: table.bidPrice,

      skeletonSize: SKELETON_SIZES.price,
    }),

    createColumn({
      key: "bid-volume",

      className: COLUMN_CLASSES.number,

      formatter: table.bidVolume,

      skeletonSize: SKELETON_SIZES.quantity,
    }),

    /* ----------------------------------------------------------------------
       Best Offer
       ---------------------------------------------------------------------- */

    createColumn({
      key: "offer-price",

      className: COLUMN_CLASSES.number,

      formatter: table.offerPrice,

      skeletonSize: SKELETON_SIZES.price,
    }),

    createColumn({
      key: "offer-volume",

      className: COLUMN_CLASSES.number,

      formatter: table.offerVolume,

      skeletonSize: SKELETON_SIZES.quantity,
    }),
  ]);
}

/* ==========================================================================
   Row Behavior
   ========================================================================== */

function createdRow(rowElement, row) {
  if (!isLoadingRow(row)) {
    return;
  }

  rowElement.classList.add("is-loading");

  rowElement.setAttribute("aria-hidden", "true");
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createListedTradableRightsTable(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createListedTradableRightsTable requires a configuration object.",
    );
  }

  const formatters = createListedTradableRightsFormatters(config);

  const columns = createColumns(formatters);

  const noDataMessage =
    normalizeString(config.labels?.noData) || "No data available.";

  return Object.freeze({
    key: VIEW_KEY,

    initialView: VIEW_KEY,

    /*
     * Listed Tradable Rights already has its semantic multi-row grouped
     * header in the JSP.
     *
     * createTradingTab() will pass this through to common createDataTable().
     */
    headerMode: "existing",

    getColumns() {
      return columns;
    },

    getColumnGroups() {
      return [];
    },

    /*
     * createTradingTab() requires a table-level renderer.
     *
     * Normal Listed Tradable Rights columns already own their renderer, so
     * this remains only a safe fallback.
     */
    renderCell({ row, column, type, meta }) {
      if (typeof column?.render === "function") {
        return column.render({
          row,

          column,

          type,

          meta,
        });
      }

      return "";
    },

    tableOptions: Object.freeze({
      paging: false,

      searching: false,

      ordering: true,

      /*
       * Preserve service order on initial load.
       *
       * Users can still sort any leaf column after rendering.
       */
      order: Object.freeze([]),

      info: false,

      lengthChange: false,

      scrollX: true,

      scrollCollapse: true,

      fixedHeader: Object.freeze({
        header: true,

        footer: false,
      }),

      fixedColumns: false,

      rowGroup: false,

      responsive: false,

      language: Object.freeze({
        emptyTable: noDataMessage,

        zeroRecords: noDataMessage,
      }),

      createdRow,
    }),
  });
}
