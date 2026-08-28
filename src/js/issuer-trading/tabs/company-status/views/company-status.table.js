/* ==========================================================================
   Company Status Table
   ========================================================================== */

/*
 * Desktop table presentation for the Company Status tab.
 *
 * Responsibilities:
 *
 * - define the Suspension table schema
 * - define the Delisting table schema
 * - render the grouped Suspension header
 * - render the compact Delisting header
 * - connect normalized rows to presentation formatters
 * - configure sorting and row behavior
 *
 * This module intentionally has no:
 *
 * - request code
 * - filter handling
 * - response normalization
 * - mobile-card rendering
 * - tab lifecycle code
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { COMPANY_STATUS_VIEWS } from "../company-status.filters.js";

import { createCompanyStatusFormatters } from "../company-status.formatters.js";

import { normalizeString } from "../../../shared/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const COLUMN_KEYS = Object.freeze({
  company: "company",
  fromDate: "fromDate",
  toDate: "toDate",
  delistingDate: "delistingDate",
  announcement: "announcement",
});

const DEFAULT_VIEW = COMPANY_STATUS_VIEWS.SUSPENSION;

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeView(value) {
  const view = normalizeString(value).toLowerCase();

  return view === String(COMPANY_STATUS_VIEWS.DELISTING).toLowerCase()
    ? COMPANY_STATUS_VIEWS.DELISTING
    : COMPANY_STATUS_VIEWS.SUSPENSION;
}

function isSuspensionView(view) {
  return normalizeView(view) === COMPANY_STATUS_VIEWS.SUSPENSION;
}

function resolveTable(input) {
  if (input instanceof HTMLTableElement) {
    return input;
  }

  if (input?.table instanceof HTMLTableElement) {
    return input.table;
  }

  return null;
}

function resolveHeaderView(input, table) {
  return normalizeView(
    input?.view ??
      input?.context?.view ??
      table?.dataset.dataView ??
      DEFAULT_VIEW,
  );
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getLabels(config = {}) {
  const table = config.labels?.companyStatus?.table || {};

  return Object.freeze({
    company: normalizeString(table.company, "Company"),

    period: normalizeString(table.period, "Period"),

    from: normalizeString(table.from, "From"),

    to: normalizeString(table.to, "To"),

    delistingDate: normalizeString(table.delistingDate, "Delisting Date"),

    suspensionReason: normalizeString(table.suspensionReason, "Reason"),

    delistingReason: normalizeString(table.delistingReason, "Reason"),
  });
}

/* ==========================================================================
   Column Schemas
   ========================================================================== */

function createSuspensionColumns(labels) {
  return Object.freeze([
    Object.freeze({
      key: COLUMN_KEYS.company,

      label: labels.company,

      className: "company-status__company-cell",

      headerClassName: "company-status__company-heading",

      width: "34%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.fromDate,

      label: labels.from,

      className: "company-status__date-cell text-center",

      headerClassName: "company-status__date-heading text-center",

      headerGroup: "period",

      width: "18%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.toDate,

      label: labels.to,

      className: "company-status__date-cell text-center",

      headerClassName: "company-status__date-heading text-center",

      headerGroup: "period",

      width: "18%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.announcement,

      label: labels.suspensionReason,

      className: "company-status__announcement-cell text-center",

      headerClassName: "company-status__announcement-heading text-center",

      width: "30%",

      orderable: false,
      searchable: false,
    }),
  ]);
}

function createDelistingColumns(labels) {
  return Object.freeze([
    Object.freeze({
      key: COLUMN_KEYS.company,

      label: labels.company,

      className: "company-status__company-cell",

      headerClassName: "company-status__company-heading",

      width: "45%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.delistingDate,

      label: labels.delistingDate,

      className: "company-status__date-cell text-center",

      headerClassName: "company-status__date-heading text-center",

      width: "25%",
    }),

    Object.freeze({
      key: COLUMN_KEYS.announcement,

      label: labels.delistingReason,

      className: "company-status__announcement-cell text-center",

      headerClassName: "company-status__announcement-heading text-center",

      width: "30%",

      orderable: false,
      searchable: false,
    }),
  ]);
}

/* ==========================================================================
   Header Helpers
   ========================================================================== */

function createHeaderCell({
  label,
  className = "",
  scope = "col",
  rowSpan = 0,
  colSpan = 0,
}) {
  const cell = document.createElement("th");

  cell.scope = scope;

  if (className) {
    cell.className = className;
  }

  if (rowSpan > 0) {
    cell.rowSpan = rowSpan;
  }

  if (colSpan > 0) {
    cell.colSpan = colSpan;
  }

  const labelElement = document.createElement("span");

  labelElement.className = "table-column-label";

  labelElement.textContent = normalizeString(label);

  cell.append(labelElement);

  return cell;
}

function replaceTableHeader(table, thead) {
  const caption = table.caption;

  const tbody = document.createElement("tbody");

  if (caption) {
    table.replaceChildren(caption, thead, tbody);

    return;
  }

  table.replaceChildren(thead, tbody);
}

/* ==========================================================================
   Suspension Header
   ========================================================================== */

/*
 * Company |          Period          | Reason
 *         |     From     |     To     |
 */

function renderSuspensionHeader(table, labels) {
  const thead = document.createElement("thead");

  const primaryRow = document.createElement("tr");

  const secondaryRow = document.createElement("tr");

  primaryRow.append(
    createHeaderCell({
      label: labels.company,

      className: "company-status__company-heading",

      rowSpan: 2,
    }),

    createHeaderCell({
      label: labels.period,

      className:
        "company-status__period-heading table-group-heading text-center",

      scope: "colgroup",

      colSpan: 2,
    }),

    createHeaderCell({
      label: labels.suspensionReason,

      className: "company-status__announcement-heading text-center",

      rowSpan: 2,
    }),
  );

  secondaryRow.append(
    createHeaderCell({
      label: labels.from,

      className: "company-status__date-heading text-center",
    }),

    createHeaderCell({
      label: labels.to,

      className: "company-status__date-heading text-center",
    }),
  );

  thead.append(primaryRow, secondaryRow);

  replaceTableHeader(table, thead);

  return thead;
}

/* ==========================================================================
   Delisting Header
   ========================================================================== */

/*
 * Company | Delisting Date | Reason
 */

function renderDelistingHeader(table, labels) {
  const thead = document.createElement("thead");

  const row = document.createElement("tr");

  row.append(
    createHeaderCell({
      label: labels.company,

      className: "company-status__company-heading",
    }),

    createHeaderCell({
      label: labels.delistingDate,

      className: "company-status__date-heading text-center",
    }),

    createHeaderCell({
      label: labels.delistingReason,

      className: "company-status__announcement-heading text-center",
    }),
  );

  thead.append(row);

  replaceTableHeader(table, thead);

  return thead;
}

/* ==========================================================================
   Dynamic Header
   ========================================================================== */

function createHeaderRenderer(labels) {
  return function renderHeader(input) {
    const table = resolveTable(input);

    if (!table) {
      throw new TypeError("Company Status header requires a table element.");
    }

    const view = resolveHeaderView(input, table);

    if (isSuspensionView(view)) {
      return renderSuspensionHeader(table, labels);
    }

    return renderDelistingHeader(table, labels);
  };
}

/* ==========================================================================
   Loading Cells
   ========================================================================== */

function renderLoadingCell(columnKey) {
  const size =
    columnKey === COLUMN_KEYS.company
      ? "lg"
      : columnKey === COLUMN_KEYS.announcement
        ? "sm"
        : "md";

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
        return formatters.company(null, type, row);

      case COLUMN_KEYS.fromDate:
        return formatters.fromDate(row?.period?.from, type);

      case COLUMN_KEYS.toDate:
        return formatters.toDate(row?.period?.to, type);

      case COLUMN_KEYS.delistingDate:
        return formatters.delistingDate(
          row?.delistingDate ?? row?.period?.from,
          type,
        );

      case COLUMN_KEYS.announcement:
        return formatters.announcement(null, type, row);

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

  const view = normalizeView(row?.view);

  rowElement.dataset.companyStatusView = view;

  rowElement.classList.add(
    "company-status__result-row",
    `company-status__result-row--${view}`,
  );
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createCompanyStatusTable(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createCompanyStatusTable requires a configuration object.",
    );
  }

  const labels = getLabels(config);

  const formatters = createCompanyStatusFormatters(config);

  const columns = Object.freeze({
    [COMPANY_STATUS_VIEWS.SUSPENSION]: createSuspensionColumns(labels),

    [COMPANY_STATUS_VIEWS.DELISTING]: createDelistingColumns(labels),
  });

  return Object.freeze({
    initialView: DEFAULT_VIEW,

    getColumns(view) {
      return columns[normalizeView(view)];
    },

    /*
     * The table uses its dedicated header renderer because the Period
     * heading sits between two row-spanning columns.
     */

    getColumnGroups() {
      return [];
    },

    renderHeader: createHeaderRenderer(labels),

    renderCell: createCellRenderer(formatters),

    tableOptions: Object.freeze({
      paging: false,
      searching: false,
      ordering: true,
      info: false,
      lengthChange: false,

      order: Object.freeze([[1, "desc"]]),

      rowGroup: false,

      createdRow,

      rowId(row) {
        return normalizeString(row?.id);
      },
    }),
  });
}
