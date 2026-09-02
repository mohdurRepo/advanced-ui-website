/* ==========================================================================
   Sukuk Table View
   ========================================================================== */

/*
* Sukuk & Bonds desktop table presentation.
* Refactored to seamlessly support the new 4-column static schema structure.
*/

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataTable } from "../../../common/data-view/index.js";
import { createMarketTableOptions } from "../../shared/market-table-options.js";
import { getColumnGroups, getColumns } from "../sukuk.columns.js";
import {
	  escapeHtml,
	  getDisplayValue,
	  getInstrumentName,
	  renderInstrument,
	  formatFullNumber,
	  formatAuctionValue,
	  formatAuctionQuantity,
	} from "../sukuk.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

export const SUKUK_TABLE_SELECTOR = "[data-sukuk-table]";

/* ==========================================================================
   Table Cell Rendering
   ========================================================================== */

export function renderSukukTableCell({ row, column, type, config = {} }) {
  /*
   * Keep raw/backend-oriented values available
   * for DataTables sorting/type/filter operations.
   */
  if (type === "sort" || type === "type" || type === "filter") {
    if (column.type === "instrument" || column.key === "companyName") {
      return getInstrumentName(row);
    }
    // Pull the literal mapping straight out of the row data mapping route
    return getDisplayValue(row[column.data] ?? "", "");
  }

  /* ------------------------------------------------------------------------
     Loading State
     ------------------------------------------------------------------------ */
  if (row?.__dataViewState === "loading") {
    const size =
      (column.type === "instrument" || column.key === "companyName") 
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
  // FIXED: Removed duplicate declaration. Safely extract value from dynamic JSON column target key
  const value = row[column.data];

  switch (column?.key || column?.type) {
    case "instrument":
    case "companyName":
      return renderInstrument(row);

    case "previousClose":
    case "prev_close":
      return escapeHtml(formatFullNumber(value));

    case "top":
      return escapeHtml(formatAuctionValue(value));

    case "tov":
      return escapeHtml(formatAuctionQuantity(value));

    default:
      return escapeHtml(getDisplayValue(value));
  }
}


/* ==========================================================================
   Row Group Renderer
   ========================================================================== */

export function renderSukukGroup({ groupName, groupRows, visibleColumnCount }) {
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
  label.className = "table-market__group-label table-group-label table-group-label-sticky";
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

export function createSukukTable({
  root = document,
  config = {},
  view = "overview",
  visibleGroups = [],
} = {}) {
  return createDataTable({
    root,
    table: SUKUK_TABLE_SELECTOR,
    initialView: view,
    visibleGroups,

    getColumns() {
      return getColumns(config, view);
    },

    getColumnGroups() {
      return getColumnGroups(config, view);
    },

    renderCell(args) {
      return renderSukukTableCell({
        ...args,
        config,
      });
    },

    tableOptions: createMarketTableOptions({
      ...config.table,
      rowGroup: {
        dataSrc: "sectorName",
      },
    }),

    getRowGroup(row) {
      return row.sectorName || "Other Sectors";
    },

    renderRowGroupStart(args) {
      return renderSukukGroup(args);
    },
  });
}