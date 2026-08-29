/* ==========================================================================
   Derivative Negotiated Table
   ========================================================================== */

/*
 * Desktop table presentation for Derivative Negotiated Deals.
 *
 * Responsibilities:
 *
 * - define the six-column desktop table schema
 * - render transaction cells
 * - render service-provided daily total cells
 * - identify and decorate total rows
 * - provide stable DataTables row identifiers
 * - expose table-specific DataTables options
 *
 * This module intentionally has no:
 *
 * - mobile card rendering
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
} from "../../issuer-trading/shared/trading-formatters.js";

import {
  createDerivativeNegotiatedFormatters,
  isDerivativeNegotiatedTotalRow,
} from "../derivative-negotiated.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "derivativeNegotiated";

const COLUMN_KEYS = Object.freeze({
  date: "tradeDate",

  contract: "contract",

  price: "price",

  volume: "volume",

  value: "value",

  time: "tradeTime",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTableRowElement(value) {
  return Boolean(value && value.nodeType === 1 && value.tagName === "TR");
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getTableLabels(config = {}) {
  const labels = isObject(config.labels?.table) ? config.labels.table : {};

  return Object.freeze({
    date: normalizeString(labels.date) || "Date",

    contract: normalizeString(labels.contract) || "Contract",

    price: normalizeString(labels.price) || "Price",

    volume: normalizeString(labels.volume) || "Volume Traded",

    value: normalizeString(labels.value) || "Value Traded",

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

      searchable: false,
    },

    {
      key: COLUMN_KEYS.contract,

      label: labels.contract,

      className: "table-market__security",

      headerClassName: "table-market__security",

      orderable: false,

      searchable: false,
    },

    {
      key: COLUMN_KEYS.price,

      label: labels.price,

      className: "table-market__price table-market__number",

      headerClassName: "table-market__number",

      orderable: false,

      searchable: false,
    },

    {
      key: COLUMN_KEYS.volume,

      label: labels.volume,

      className: "table-market__number",

      headerClassName: "table-market__number",

      orderable: false,

      searchable: false,
    },

    {
      key: COLUMN_KEYS.value,

      label: labels.value,

      className: "table-market__number",

      headerClassName: "table-market__number",

      orderable: false,

      searchable: false,
    },

    {
      key: COLUMN_KEYS.time,

      label: labels.time,

      className: "table-market__time table-market__number dt-nowrap",

      headerClassName: "table-market__number dt-nowrap",

      orderable: false,

      searchable: false,
    },
  ];
}

/* ==========================================================================
   Total Cell
   ========================================================================== */

function renderTotalCell({ column, row, type, formatters, labels }) {
  switch (column.key) {
    case COLUMN_KEYS.contract:
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
        return row.dateSort ?? "";
      }

      return "";

    case COLUMN_KEYS.price:
    case COLUMN_KEYS.time:
    default:
      return "";
  }
}

/* ==========================================================================
   Cell Renderer
   ========================================================================== */

function createCellRenderer({ formatters, labels }) {
  return function renderCell({ row, column, type }) {
    /*
     * Loading rows are created by the shared data-view table layer.
     */

    if (row?.__dataViewState === "loading") {
      return renderLoadingCell();
    }

    if (isDerivativeNegotiatedTotalRow(row)) {
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

      case COLUMN_KEYS.contract:
        return formatters.table.contract(
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
   Total Row Accessibility
   ========================================================================== */

function createTotalRowAriaLabel({ row, formatters, labels }) {
  const summary = formatters.getSummaryValues(row);

  return [
    labels.total,

    summary.dateValue,

    labels.volume,

    summary.volume,

    labels.value,

    summary.value,
  ]
    .filter(Boolean)
    .join(" ");
}

/* ==========================================================================
   Created Row
   ========================================================================== */

function createRowCallback({ formatters, labels }) {
  return function createdRow(rowElement, row) {
    if (!isTableRowElement(rowElement)) {
      return;
    }

    /* ======================================================================
       Loading
       ====================================================================== */

    if (row?.__dataViewState === "loading") {
      rowElement.classList.add("table-market__loading-row");

      return;
    }

    /* ======================================================================
       Row Metadata
       ====================================================================== */

    rowElement.dataset.rowType = normalizeString(row?.rowType) || "deal";

    if (row?.dateKey) {
      rowElement.dataset.dateGroup = row.dateKey;
    }

    /* ======================================================================
       Ordinary Transaction
       ====================================================================== */

    if (!isDerivativeNegotiatedTotalRow(row)) {
      return;
    }

    /* ======================================================================
       Daily Total
       ====================================================================== */

    rowElement.classList.add(
      "table-market__summary-row",
      "table-market__summary-row--emphasis",
    );

    const cells = rowElement.cells;

    /*
     * Column order:
     *
     * 0 Date
     * 1 Contract / Total label
     * 2 Price
     * 3 Volume
     * 4 Value
     * 5 Time
     */

    cells[0]?.classList.add("table-market__summary-empty");

    cells[1]?.classList.add("table-market__summary-label-cell");

    cells[2]?.classList.add("table-market__summary-empty");

    cells[3]?.classList.add("table-market__summary-value");

    cells[4]?.classList.add("table-market__summary-value");

    cells[5]?.classList.add("table-market__summary-empty");

    const ariaLabel = createTotalRowAriaLabel({
      row,

      formatters,

      labels,
    });

    if (ariaLabel) {
      rowElement.setAttribute(
        "aria-label",

        ariaLabel,
      );
    }
  };
}

/* ==========================================================================
   Row Identifier
   ========================================================================== */

function getRowId(row) {
  return normalizeString(row?.id);
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createDerivativeNegotiatedTableView(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createDerivativeNegotiatedTableView requires a configuration object.",
    );
  }

  const labels = getTableLabels(config);

  const formatters = createDerivativeNegotiatedFormatters(config);

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
      /*
       * Preserve the legacy page size behavior.
       *
       * Shared DataTables configuration will continue to own scrollX,
       * FixedHeader, layout, deferRender, responsive, and other generic
       * presentation defaults.
       */

      paging: true,

      pageLength: 25,

      lengthMenu: Object.freeze([25, 50, 100]),

      searching: false,

      ordering: false,

      info: false,

      lengthChange: false,

      rowGroup: false,

      createdRow,

      rowId: getRowId,
    }),
  });
}
