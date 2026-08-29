/* ==========================================================================
   Negotiated Deals Table
   ========================================================================== */

/*
 * Desktop table presentation for Negotiated Deals.
 *
 * Responsibilities:
 *
 * - define the six-column table schema
 * - render standard transaction cells
 * - render daily total cells
 * - identify total rows
 * - expose DataTables options
 *
 * This module intentionally has no:
 *
 * - mobile card rendering
 * - card grouping
 * - breakpoint behavior
 * - request code
 * - filter handling
 * - response normalization
 * - DataTables initialization
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  escapeHtml,
  normalizeString,
} from "../../../shared/trading-formatters.js";

import {
  createNegotiatedDealsFormatters,
  isNegotiatedDealsTotalRow,
} from "../negotiated-deals.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "negotiatedDeals";

const COLUMN_KEYS = Object.freeze({
  date: "tradeDate",

  company: "company",

  price: "price",

  volume: "volume",

  value: "value",

  time: "tradeTime",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getTableLabels(config = {}) {
  const labels = config.labels?.negotiatedDeals?.table || {};

  return Object.freeze({
    date: normalizeString(labels.date) || "Date",

    company: normalizeString(labels.company) || "Company",

    price: normalizeString(labels.price) || "Price",

    volume: normalizeString(labels.volume) || "Volume",

    value: normalizeString(labels.value) || "Value",

    time: normalizeString(labels.time) || "Time",

    total: normalizeString(config.labels?.total) || "Total",
  });
}

/* ==========================================================================
   Loading Cell
   ========================================================================== */

function renderLoadingCell() {
  return `
    <span
      class="table-skeleton table-skeleton-md"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Column Schema
   ========================================================================== */

function createColumns(labels) {
  return [
    {
      key: COLUMN_KEYS.date,

      label: labels.date,

      className: "table-market__date dt-nowrap",

      headerClassName: "table-market__date dt-nowrap",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.company,

      label: labels.company,

      className: "table-market__company",

      headerClassName: "table-market__company",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.price,

      label: labels.price,

      className: "table-market__price table-market__number",

      headerClassName: "table-market__number",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.volume,

      label: labels.volume,

      className: "table-market__number",

      headerClassName: "table-market__number",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.value,

      label: labels.value,

      className: "table-market__number",

      headerClassName: "table-market__number",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.time,

      label: labels.time,

      className: "table-market__time table-market__number dt-nowrap",

      headerClassName: "table-market__number dt-nowrap",

      orderable: false,
    },
  ];
}

/* ==========================================================================
   Total Cell
   ========================================================================== */

function renderTotalCell({ column, row, type, formatters, labels }) {
  switch (column.key) {
    case COLUMN_KEYS.company:
      if (type === "sort" || type === "type") {
        return labels.total;
      }

      if (type === "filter") {
        return [labels.total, normalizeString(row.tradeDate)]
          .filter(Boolean)
          .join(" ");
      }

      return `
        <strong class="table-market__summary-label">
          ${escapeHtml(labels.total)}
        </strong>
      `.trim();

    case COLUMN_KEYS.volume:
      return formatters.table.volume(
        null,

        type,

        row,
      );

    case COLUMN_KEYS.value:
      return formatters.table.value(
        null,

        type,

        row,
      );

    case COLUMN_KEYS.date:
      if (type === "sort" || type === "type") {
        return row.dateSort || "";
      }

      return "";

    default:
      return "";
  }
}

/* ==========================================================================
   Cell Renderer
   ========================================================================== */

function createCellRenderer({ formatters, labels }) {
  return function renderCell({ row, column, type }) {
    if (row?.__dataViewState === "loading") {
      return renderLoadingCell();
    }

    if (isNegotiatedDealsTotalRow(row)) {
      return renderTotalCell({
        column,

        row,

        type,

        formatters,

        labels,
      });
    }

    switch (column.key) {
      case COLUMN_KEYS.date:
        return formatters.table.date(
          null,

          type,

          row,
        );

      case COLUMN_KEYS.company:
        return formatters.table.company(
          null,

          type,

          row,
        );

      case COLUMN_KEYS.price:
        return formatters.table.price(
          null,

          type,

          row,
        );

      case COLUMN_KEYS.volume:
        return formatters.table.volume(
          null,

          type,

          row,
        );

      case COLUMN_KEYS.value:
        return formatters.table.value(
          null,

          type,

          row,
        );

      case COLUMN_KEYS.time:
        return formatters.table.time(
          null,

          type,

          row,
        );

      default:
        return "";
    }
  };
}

/* ==========================================================================
   Created Row
   ========================================================================== */

function createRowCallback({ formatters, labels }) {
  return function createdRow(rowElement, row) {
    if (!(rowElement instanceof HTMLTableRowElement)) {
      return;
    }

    if (row?.__dataViewState === "loading") {
      rowElement.classList.add("table-market__loading-row");

      return;
    }

    rowElement.dataset.rowType = normalizeString(row?.rowType) || "deal";

    if (row?.dateKey) {
      rowElement.dataset.dateGroup = row.dateKey;
    }

    if (!isNegotiatedDealsTotalRow(row)) {
      return;
    }

    rowElement.classList.add(
      "table-market__summary-row",
      "table-market__summary-row--emphasis",
    );

    const cells = rowElement.cells;

    cells[0]?.classList.add("table-market__summary-empty");

    cells[1]?.classList.add("table-market__summary-label-cell");

    cells[2]?.classList.add("table-market__summary-empty");

    cells[3]?.classList.add("table-market__summary-value");

    cells[4]?.classList.add("table-market__summary-value");

    cells[5]?.classList.add("table-market__summary-empty");

    const summary = formatters.getSummaryValues(row);

    const ariaLabel = [
      labels.total,

      summary.date,

      labels.volume,

      summary.volume,

      labels.value,

      summary.value,
    ]
      .filter(Boolean)
      .join(" ");

    rowElement.setAttribute(
      "aria-label",

      ariaLabel,
    );
  };
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createNegotiatedDealsTableView(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createNegotiatedDealsTableView requires a configuration object.",
    );
  }

  const labels = getTableLabels(config);

  const formatters = createNegotiatedDealsFormatters(config);

  const columns = createColumns(labels);

  const renderCell = createCellRenderer({
    formatters,

    labels,
  });

  const createdRow = createRowCallback({
    formatters,

    labels,
  });

  return Object.freeze({
    key: VIEW_KEY,

    columns,

    renderCell,

    tableOptions: Object.freeze({
      paging: false,

      searching: false,

      ordering: false,

      info: false,

      rowGroup: false,

      createdRow,

      rowId(row) {
        return normalizeString(row?.id);
      },
    }),
  });
}
