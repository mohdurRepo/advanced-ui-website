/* ==========================================================================
   Theoretical Opening Table
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - create the desktop table
 * - connect Theoretical Opening columns to createDataTable()
 * - render page-specific values
 * - reuse the common standard company identity
 *
 * Shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataTable,
  renderStandardCompanyCell,
} from "../../../common/data-view/index.js";

import {
  getColumns,
  THEORETICAL_OPENING_VIEW,
} from "../theoretical-opening.columns.js";

import {
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

function renderCell({ row, column, type, config }) {
  /*
   * Company identity is rendered from the complete row because common
   * identity needs:
   *
   * - company name
   * - company code
   * - company URL
   * - company logo configuration
   */
  if (column.id === "companyName") {
    if (type !== "display") {
      return row?.companyName ?? "";
    }

    return renderStandardCompanyCell(row, config);
  }

  const value = column.data ? row?.[column.data] : "";

  if (type !== "display") {
    return value ?? "";
  }

  switch (column.id) {
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

    renderCell(args) {
      return renderCell({
        ...args,
        config,
      });
    },

    tableOptions: config.table,
  });
}
