/* ==========================================================================
   OTC Trading Table
   ========================================================================== */

/*
 * Desktop table presentation for OTC Trading.
 *
 * Responsibilities:
 *
 * - define the three-column OTC schema
 * - connect normalized rows to presentation formatters
 * - render loading cells
 * - configure DataTables sorting and pagination
 * - classify rendered rows for styling
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - request lifecycle
 * - response normalization
 * - mobile-card rendering
 * - tab lifecycle
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createOtcTradingFormatters } from "../otc-trading.formatters.js";

import { normalizeString } from "../../../../shared/trading/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "otc-trading";

const DEFAULT_PAGE_LENGTH = 25;

const COLUMN_KEYS = Object.freeze({
  company: "company",

  tradedVolume: "tradedVolume",

  lastUpdate: "lastUpdate",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTableRow(value) {
  /*
   * Avoid a direct HTMLTableRowElement dependency so this presentation
   * definition remains safe in tests or environments where DOM constructors
   * are not exposed globally.
   */
  return Boolean(
    value &&
    value.nodeType === 1 &&
    String(value.tagName || "").toUpperCase() === "TR",
  );
}

function normalizeRowId(value) {
  return normalizeString(value);
}

/* ==========================================================================
   Loading Cells
   ========================================================================== */

function renderLoadingCell(columnKey) {
  const size = columnKey === COLUMN_KEYS.company ? "lg" : "md";

  return `
    <span
      class="table-skeleton table-skeleton-${size}"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Columns
   ========================================================================== */

function createColumns(formatters) {
  return Object.freeze([
    Object.freeze({
      key: COLUMN_KEYS.company,

      data: null,

      width: "50%",

      className: "table-market__security",

      orderable: true,

      searchable: true,

      render({ row, type }) {
        if (row?.__dataViewState === "loading") {
          return renderLoadingCell(COLUMN_KEYS.company);
        }

        return formatters.table.company(null, type, row);
      },
    }),

    Object.freeze({
      key: COLUMN_KEYS.tradedVolume,

      data: "tradedVolume",

      width: "25%",

      className: "table-market__number text-end",

      orderable: true,

      searchable: false,

      render({ row, type }) {
        if (row?.__dataViewState === "loading") {
          return renderLoadingCell(COLUMN_KEYS.tradedVolume);
        }

        return formatters.table.tradedVolume(row?.tradedVolume, type, row);
      },
    }),

    Object.freeze({
      key: COLUMN_KEYS.lastUpdate,

      data: "lastUpdate",

      width: "25%",

      className: "table-market__date text-center",

      orderable: true,

      searchable: false,

      render({ row, type }) {
        if (row?.__dataViewState === "loading") {
          return renderLoadingCell(COLUMN_KEYS.lastUpdate);
        }

        return formatters.table.lastUpdate(row?.lastUpdate, type, row);
      },
    }),
  ]);
}

/* ==========================================================================
   Row Behavior
   ========================================================================== */

function createRowCallback() {
  return function createdRow(rowElement, rowData) {
    if (!isTableRow(rowElement)) {
      return;
    }

    if (rowData?.__dataViewState === "loading") {
      rowElement.classList.add("is-loading");

      rowElement.setAttribute("aria-hidden", "true");

      return;
    }

    rowElement.classList.remove("is-loading");

    rowElement.removeAttribute("aria-hidden");

    const rowType = normalizeString(rowData?.rowType);

    if (!rowType) {
      return;
    }

    rowElement.dataset.rowType = rowType;

    rowElement.classList.add(`table-market__row--${rowType}`);
  };
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createOtcTradingTable(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createOtcTradingTable requires a configuration object.",
    );
  }

  const formatters = createOtcTradingFormatters(config);

  const columns = createColumns(formatters);

  const createdRow = createRowCallback();

  return Object.freeze({
    key: VIEW_KEY,

    initialView: VIEW_KEY,

    getColumns() {
      return columns;
    },

    getColumnGroups() {
      return [];
    },

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
      paging: true,

      pageLength: DEFAULT_PAGE_LENGTH,

      lengthMenu: [25, 50, 100],

      lengthChange: true,

      info: true,

      searching: false,

      ordering: true,

      order: [[0, "asc"]],

      serverSide: false,

      scrollX: true,

      scrollCollapse: true,

      fixedHeader: false,

      fixedColumns: false,

      responsive: false,

      rowGroup: false,

      /*
       * DataTables 2 layout.
       *
       * Keep the page-length control and information/paging controls while
       * leaving search disabled.
       */
      layout: {
        topStart: "pageLength",

        topEnd: null,

        bottomStart: "info",

        bottomEnd: "paging",
      },

      createdRow,

      rowId(row) {
        return normalizeRowId(row?.id);
      },
    }),
  });
}
