/* ==========================================================================
   Theoretical Opening Table View
   ========================================================================== */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataTable,
  renderStandardCompanyCell,
} from "../../../common/data-view/index.js";

import { createTheoreticalOpeningTableOptions } from "../shared/theoretical-opening.options.js";

import { getColumnGroups, getColumns } from "../theoretical-opening.columns.js";

import {
  escapeHtml,
  formatPreviousClose,
  formatTOP,
  formatTOV,
  getDisplayValue,
} from "../shared/theoretical-opening.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

export const THEORETICAL_OPENING_TABLE_SELECTOR =
  "[data-theoretical-opening-table]";

/* ==========================================================================
   Cell Rendering
   ========================================================================== */

export function renderTheoreticalOpeningTableCell({
  row,
  column,
  type,
  config = {},
}) {
  /* ------------------------------------------------------------------------
     DataTables non-display values
     ------------------------------------------------------------------------ */

  if (type === "sort" || type === "type" || type === "filter") {
    if (column.type === "company" || column.key === "companyName") {
      return getDisplayValue(row.companyName, "");
    }

    return getDisplayValue(row[column.data], "");
  }

  /* ------------------------------------------------------------------------
     Loading
     ------------------------------------------------------------------------ */

  if (row?.__dataViewState === "loading") {
    const size =
      column.type === "company" ? "table-skeleton-lg" : "table-skeleton-md";

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

  const value = row[column.data];

  switch (column?.key || column?.type) {
    case "company":
    case "companyName":
      /*
       * Standard site identity:
       *
       * [logo] Company Name
       *        Company Code
       */

      return renderStandardCompanyCell(row, config);

    case "previousClose":
      return escapeHtml(formatPreviousClose(value));

    case "top":
      return escapeHtml(formatTOP(value));

    case "tov":
      return escapeHtml(formatTOV(value, config));

    default:
      return escapeHtml(getDisplayValue(value));
  }
}

/* ==========================================================================
   Sector Group
   ========================================================================== */

export function renderTheoreticalOpeningGroup({
  groupName,
  groupRows,
  visibleColumnCount,
}) {
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

  label.textContent = groupName || "Other Sectors";

  const fill = document.createElement("td");

  fill.className = "table-market__group-fill table-group-fill";

  fill.colSpan = Math.max(1, visibleColumnCount - 1);

  fill.setAttribute("aria-hidden", "true");

  row.append(label, fill);

  return row;
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createTheoreticalOpeningTable({
  root = document,
  config = {},
  view = "1",
  visibleGroups = [],
} = {}) {
  return createDataTable({
    root,

    table: THEORETICAL_OPENING_TABLE_SELECTOR,

    initialView: view,

    visibleGroups,

    getColumns() {
      return getColumns(config, view);
    },

    getColumnGroups() {
      return getColumnGroups(config, view);
    },

    renderCell(args) {
      return renderTheoreticalOpeningTableCell({
        ...args,
        config,
      });
    },

    tableOptions: createTheoreticalOpeningTableOptions({
      ...config.table,

      ordering: false,

      searching: false,

      paging: false,

      info: false,

      autoWidth: false,

      responsive: false,

      deferRender: true,

      rowGroup: {
        dataSrc: "sectorName",
      },
    }),

    getRowGroup(row) {
      return row.sectorName || "Other Sectors";
    },

    renderRowGroupStart(args) {
      return renderTheoreticalOpeningGroup(args);
    },
  });
}
