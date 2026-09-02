/* ==========================================================================
   Dividends Table
   ========================================================================== */

/*
 * Desktop table presentation for the Dividends calendar.
 *
 * Responsibilities:
 *
 * - define the six-column Dividends schema
 * - connect normalized rows to shared financial-calendar formatters
 * - preserve service date text while sorting by normalized date values
 * - configure client-side DataTables ordering and paging
 * - configure result and loading-row behavior
 *
 * This module intentionally has no:
 *
 * - request code
 * - response normalization
 * - filter handling
 * - mobile-card rendering
 * - tab lifecycle code
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createFinancialCalendarFormatters,
  FINANCIAL_CALENDAR_DATA_TYPES,
} from "../../../shared/financial-calendar-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "dividends";

const DEFAULT_PAGE_LENGTH = 25;

const DEFAULT_LENGTH_MENU = Object.freeze([25, 50, 100]);

const COLUMN_KEYS = Object.freeze({
  company: "company",

  announcementDate: "announcementDate",

  dueDate: "dueDate",

  distributionMethod: "distributionMethod",

  distributionDate: "distributionDate",

  amount: "amount",
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

function isSortRequest(type) {
  return (
    type === FINANCIAL_CALENDAR_DATA_TYPES.SORT ||
    type === FINANCIAL_CALENDAR_DATA_TYPES.TYPE
  );
}

function normalizePageLength(value) {
  const pageLength = Number(value);

  return Number.isInteger(pageLength) && pageLength > 0
    ? pageLength
    : DEFAULT_PAGE_LENGTH;
}

function normalizeLengthMenu(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_LENGTH_MENU;
  }

  const normalized = Array.from(
    new Set(
      value.map(Number).filter((item) => Number.isInteger(item) && item > 0),
    ),
  );

  return normalized.length ? Object.freeze(normalized) : DEFAULT_LENGTH_MENU;
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getLabels(config = {}) {
  const table = config.labels?.dividends?.table || {};

  return Object.freeze({
    company: normalizeString(table.company, "Company"),

    announcementDate: normalizeString(
      table.announcementDate,
      "Announcement Date",
    ),

    dueDate: normalizeString(table.dueDate, "Due Date"),

    distributionMethod: normalizeString(
      table.distributionMethod,
      "Distribution Method",
    ),

    distributionDate: normalizeString(
      table.distributionDate,
      "Distribution Date",
    ),

    amount: normalizeString(table.amount, "Amount"),
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

      className: "dividends__company-cell table-market__security",

      headerClassName: "dividends__company-heading table-market__security",

      width: "30%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.announcementDate,

      label: labels.announcementDate,

      className: "dividends__date-cell text-center",

      headerClassName: "dividends__date-heading text-center",

      width: "14%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.dueDate,

      label: labels.dueDate,

      className: "dividends__date-cell text-center",

      headerClassName: "dividends__date-heading text-center",

      width: "14%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.distributionMethod,

      label: labels.distributionMethod,

      className: "dividends__method-cell text-center",

      headerClassName: "dividends__method-heading text-center",

      width: "16%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.distributionDate,

      label: labels.distributionDate,

      className: "dividends__date-cell text-center",

      headerClassName: "dividends__date-heading text-center",

      width: "14%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.amount,

      label: labels.amount,

      className: "dividends__amount-cell table-market__number text-end",

      headerClassName:
        "dividends__amount-heading table-market__number text-end",

      width: "12%",
    }),
  ]);
}

/* ==========================================================================
   Loading Cells
   ========================================================================== */

function renderLoadingCell(columnKey) {
  let size = "md";

  if (columnKey === COLUMN_KEYS.company) {
    size = "lg";
  }

  if (columnKey === COLUMN_KEYS.amount) {
    size = "sm";
  }

  return `
    <span
      class="table-skeleton table-skeleton-${size}"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Date Rendering
   ========================================================================== */

function renderDate({ displayValue, sortValue, type, formatters }) {
  if (isSortRequest(type) && Number.isFinite(sortValue) && sortValue > 0) {
    return sortValue;
  }

  return formatters.formatDate(displayValue, type);
}

/* ==========================================================================
   Amount Rendering
   ========================================================================== */

function renderAmount(value, type, formatters) {
  const capitalValue =
    value === null || value === undefined ? "" : `SAR:${value}`;

  return formatters.formatCapital(capitalValue, type);
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
        return formatters.renderCompanyCell(row, type);

      case COLUMN_KEYS.announcementDate:
        return renderDate({
          displayValue: row?.announcementDate,

          sortValue: row?.announcementDateSort,

          type,

          formatters,
        });

      case COLUMN_KEYS.dueDate:
        return renderDate({
          displayValue: row?.dueDate,

          sortValue: row?.dueDateSort,

          type,

          formatters,
        });

      case COLUMN_KEYS.distributionMethod:
        return formatters.formatText(row?.distributionMethod, type);

      case COLUMN_KEYS.distributionDate:
        return renderDate({
          displayValue: row?.distributionDate,

          sortValue: row?.distributionDateSort,

          type,

          formatters,
        });

      case COLUMN_KEYS.amount:
        return renderAmount(row?.amountValue, type, formatters);

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

  rowElement.dataset.rowType = "dividend";

  rowElement.classList.add("dividends__result-row");
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createDividendsTable(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createDividendsTable requires a configuration object.",
    );
  }

  const labels = getLabels(config);

  const formatters = createFinancialCalendarFormatters(config);

  const columns = createColumns(labels);

  const pageLength = normalizePageLength(config.defaults?.table?.pageLength);

  const lengthMenu = normalizeLengthMenu(config.defaults?.table?.lengthMenu);

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
       * DataTables owns client-side paging.
       */

      paging: true,

      pageLength,

      lengthMenu,

      lengthChange: true,

      info: true,

      /*
       * The endpoint returns the complete result set.
       */

      serverSide: false,

      searching: false,

      ordering: true,

      /*
       * Newest announcement date first.
       */

      order: Object.freeze([Object.freeze([1, "desc"])]),

      /*
       * Avoid eagerly constructing rows outside the active page.
       */

      deferRender: true,

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
