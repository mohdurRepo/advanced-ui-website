/* ==========================================================================
   OTC Trading Table
   ========================================================================== */

/*
 * Desktop table presentation for OTC Trading.
 *
 * Responsibilities:
 *
 * - define the OTC Trading column schema
 * - connect normalized rows to presentation formatters
 * - enable client-side DataTables pagination
 * - enable sorting
 * - configure row behavior
 *
 * This module intentionally has no:
 *
 * - request code
 * - response normalization
 * - mobile-card rendering
 * - tab lifecycle code
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createOtcTradingFormatters } from "../otc-trading.formatters.js";

import { normalizeString } from "../../../shared/trading/trading-formatters.js";

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

function getLabel(value, fallback) {
  return normalizeString(value) || fallback;
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getLabels(config = {}) {
  const table = config.labels?.otcTrading?.table || {};

  return Object.freeze({
    company: getLabel(table.company, "Company"),

    tradedVolume: getLabel(table.tradedVolume, "Traded Volume"),

    lastUpdate: getLabel(table.lastUpdate, "Last Update Price"),
  });
}

/* ==========================================================================
   Column Schema
   ========================================================================== */

function createColumns(labels) {
  return Object.freeze([
    Object.freeze({
      key: COLUMN_KEYS.company,

      label: labels.company,

      className: "otc-trading__company-cell",

      headerClassName: "otc-trading__company-heading table-market__security",

      width: "50%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.tradedVolume,

      label: labels.tradedVolume,

      className: [
        "otc-trading__volume-cell",
        "table-cell-numeric",
        "numeric",
        "text-end",
      ].join(" "),

      headerClassName: [
        "otc-trading__volume-heading",
        "table-cell-numeric",
        "text-end",
      ].join(" "),

      width: "25%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.lastUpdate,

      label: labels.lastUpdate,

      className: [
        "otc-trading__last-update-cell",
        "table-cell-numeric",
        "numeric",
        "text-end",
      ].join(" "),

      headerClassName: [
        "otc-trading__last-update-heading",
        "table-cell-numeric",
        "text-end",
      ].join(" "),

      width: "25%",
    }),
  ]);
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
   Cell Rendering
   ========================================================================== */

function createCellRenderer(formatters) {
  return function renderCell({ row, column, type }) {
    if (row?.__dataViewState === "loading") {
      return renderLoadingCell(column.key);
    }

    switch (column.key) {
      case COLUMN_KEYS.company:
        return formatters.table.company(null, type, row);

      case COLUMN_KEYS.tradedVolume:
        return formatters.table.tradedVolume(row?.tradedVolume, type);

      case COLUMN_KEYS.lastUpdate:
        return formatters.table.lastUpdate(row?.lastUpdate, type);

      default:
        return "";
    }
  };
}

/* ==========================================================================
   Row Behavior
   ========================================================================== */

function createdRow(rowElement, row) {
  if (!(rowElement instanceof HTMLTableRowElement)) {
    return;
  }

  if (row?.__dataViewState === "loading") {
    rowElement.classList.add("table-market__loading-row");

    return;
  }

  rowElement.dataset.rowType = VIEW_KEY;

  rowElement.classList.add("otc-trading__result-row");
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

  const labels = getLabels(config);

  const formatters = createOtcTradingFormatters(config);

  const columns = createColumns(labels);

  return Object.freeze({
    initialView: VIEW_KEY,

    getColumns() {
      return columns;
    },

    getColumnGroups() {
      return [];
    },

    renderCell: createCellRenderer(formatters),

    tableOptions: Object.freeze({
      /*
       * DataTables owns OTC pagination.
       */

      paging: true,

      pageLength: DEFAULT_PAGE_LENGTH,

      lengthMenu: Object.freeze([25, 50, 100]),

      lengthChange: true,

      info: true,

      /*
       * The endpoint returns the complete result set.
       *
       * Paging, ordering, and page-size changes remain client-side and do
       * not trigger additional API requests.
       */

      serverSide: false,

      searching: false,

      ordering: true,

      order: Object.freeze([Object.freeze([0, "asc"])]),

      /*
       * Expose only the DataTables controls required by this tab.
       */

      layout: Object.freeze({
        topStart: "pageLength",

        topEnd: null,

        bottomStart: "info",

        bottomEnd: "paging",
      }),

      rowGroup: false,

      createdRow,

      rowId(row) {
        return normalizeString(row?.id);
      },
    }),
  });
}
