/* ==========================================================================
   Theoretical Opening Table
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - create the desktop table
 * - connect Theoretical Opening columns to createDataTable()
 * - render page-specific cell values
 *
 * Shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataTable } from "../../../common/data-view/index.js";

import {
  getColumns,
  THEORETICAL_OPENING_VIEW,
} from "../theoretical-opening.columns.js";

import {
  formatCompanyName,
  formatPreviousClose,
  formatTop,
  formatTov,
} from "../theoretical-opening.formatters.js";

/* ==========================================================================
   Helpers
   ========================================================================== */

function getTableSelector(variant) {
  return variant === "nomu"
    ? "[data-nomu-theoretical-opening-table]"
    : "[data-theoretical-opening-table]";
}

/* ==========================================================================
   Rendering
   ========================================================================== */

function renderCell({ row, column, type }) {
  const value = column.data ? row?.[column.data] : "";

  /*
   * Keep raw values available for non-display DataTables operations.
   */
  if (type !== "display") {
    return value ?? "";
  }

  switch (column.id) {
    case "companyName":
      return formatCompanyName(value);

    case "previousClose":
      return formatPreviousClose(value);

    case "top":
      return formatTop(value);

    case "tov":
      return formatTov(value);

    default:
      return value ?? "";
  }
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createTheoreticalOpeningTable({
  root = document,
  config,
  variant = "main",
} = {}) {
  if (!config) {
    throw new TypeError("createTheoreticalOpeningTable requires config.");
  }

  return createDataTable({
    root,

    table: getTableSelector(variant),

    initialView: THEORETICAL_OPENING_VIEW,

    getColumns() {
      return getColumns(config, THEORETICAL_OPENING_VIEW);
    },

    renderCell,

    tableOptions: config.table,
  });
}
