/* ==========================================================================
   Theoretical Opening Table View
   ========================================================================== */

/*
 * Theoretical Opening desktop table presentation.
 *
 * Responsibilities:
 *
 * - create the desktop DataTable view
 * - render table cells
 * - apply Theoretical Opening formatting rules
 * - group rows by sector
 *
 * This module intentionally has no:
 *
 * - request execution
 * - filter state
 * - response normalization
 * - mobile card rendering
 * - page startup
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataTable } from "../../common/data-view/index.js";

import { createTheoreticalOpeningTableOptions } from "../shared/theoretical-opening.options.js";

import { getColumns } from "../theoretical-opening.columns.js";

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
   Company Rendering
   ========================================================================== */

function renderCompany(row = {}) {
  const companyName = getDisplayValue(row.companyName, "-");

  const companyCode = getDisplayValue(row.companyCode, "-");

  const companyUrl = String(row.companyUrl ?? "").trim();

  const companyContent =
    companyUrl && companyUrl !== "#"
      ? `
          <a
            href="${escapeHtml(companyUrl)}"
            class="stock-name"
          >
            ${escapeHtml(companyName)}
          </a>
        `.trim()
      : `
          <span class="stock-name">
            ${escapeHtml(companyName)}
          </span>
        `.trim();

  return `
    <div class="company-name-value">

      <div class="stock-name">
        ${companyContent}
      </div>

      <div class="stock-number">
        ${escapeHtml(companyCode)}
      </div>

    </div>
  `.trim();
}

/* ==========================================================================
   Table Cell Rendering
   ========================================================================== */

export function renderTheoreticalOpeningTableCell({
  row,
  column,
  type,
  config = {},
}) {
  /*
   * Keep plain normalized values available to DataTables
   * for sort / type / filter operations.
   */

  if (type === "sort" || type === "type" || type === "filter") {
    if (column.type === "company" || column.key === "companyName") {
      return getDisplayValue(row.companyName, "");
    }

    return getDisplayValue(row[column.data], "");
  }

  /* ------------------------------------------------------------------------
     Loading State
     ------------------------------------------------------------------------ */

  if (row?.__dataViewState === "loading") {
    const size =
      column.type === "company" || column.key === "companyName"
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
     Display State
     ------------------------------------------------------------------------ */

  const value = row[column.data];

  switch (column?.key || column?.type) {
    case "company":
    case "companyName":
      return renderCompany(row);

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
   Row Group Renderer
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
   Table Factory
   ========================================================================== */

export function createTheoreticalOpeningTable({
  root = document,
  config = {},
  view = "1",
} = {}) {
  return createDataTable({
    root,

    table: THEORETICAL_OPENING_TABLE_SELECTOR,

    initialView: view,

    getColumns() {
      return getColumns(config, view);
    },

    renderCell(args) {
      return renderTheoreticalOpeningTableCell({
        ...args,
        config,
      });
    },

    tableOptions: createTheoreticalOpeningTableOptions({
      ...config.table,

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
