/* ==========================================================================
   Theoretical Opening Table
   ========================================================================== */

import { createDataTable } from "../../common/data-view/index.js";

import { createTheoreticalOpeningColumns } from "../shared/theoretical-opening.columns.js";

import {
  escapeHtml,
  formatTheoreticalPrice,
  formatTheoreticalQuantity,
} from "../shared/theoretical-opening.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const TABLE_SELECTOR = "[data-theoretical-opening-table]";

const VIEW = "1";

/* ==========================================================================
   Company Cell
   ========================================================================== */

function renderCompanyCell(row) {
  const companyName = row?.companyName || "-";

  const companyCode = row?.companyCode || "-";

  const companyUrl = row?.companyUrl || "";

  const companyNameHtml =
    companyUrl && companyUrl !== "#"
      ? `<a href="${escapeHtml(companyUrl)}">` +
        `${escapeHtml(companyName)}` +
        `</a>`
      : escapeHtml(companyName);

  return (
    '<div class="company-name-value">' +
    '<div class="stock-name">' +
    companyNameHtml +
    "</div>" +
    '<div class="stock-number">' +
    escapeHtml(companyCode) +
    "</div>" +
    "</div>"
  );
}

/* ==========================================================================
   Cell Rendering
   ========================================================================== */

function getRawValue(row, column) {
  if (!column?.data) {
    return "";
  }

  return row?.[column.data];
}

function renderTableCell({ row, column, type, config }) {
  const value = getRawValue(row, column);

  /*
   * DataTables may request values for
   * sorting, filtering, or type detection.
   *
   * Only generate HTML for display.
   */
  if (type && type !== "display") {
    return value ?? "";
  }

  switch (column.type) {
    case "company":
      return renderCompanyCell(row);

    case "price":
      return escapeHtml(formatTheoreticalPrice(value));

    case "quantity":
      return escapeHtml(formatTheoreticalQuantity(value, config.locale));

    default:
      return escapeHtml(value ?? "-");
  }
}

/* ==========================================================================
   Table Options
   ========================================================================== */

function createTableOptions(config = {}) {
  return {
    autoWidth: config.table?.autoWidth ?? false,

    paging: config.table?.paging ?? false,

    pageLength: config.table?.pageLength ?? 25,

    lengthChange: config.table?.lengthChange ?? false,

    searching: config.table?.searching ?? false,

    ordering: config.table?.ordering ?? false,

    info: config.table?.info ?? false,

    serverSide: config.table?.serverSide ?? false,

    processing: config.table?.processing ?? false,

    scrollX: config.table?.scrollX ?? true,

    scrollCollapse: config.table?.scrollCollapse ?? true,

    fixedHeader: config.table?.fixedHeader ?? true,

    fixedColumns: config.table?.fixedColumns ?? 1,

    /*
     * Preserve Theoretical Opening
     * sector grouping.
     */
    rowGroup: {
      dataSrc: "sectorName",
    },

    /*
     * Preserve legacy table behavior.
     */
    responsive: false,

    deferRender: true,

    /*
     * Data View owns the toolbar,
     * result count, etc.
     */
    layout: {
      topStart: null,
      topEnd: null,
      bottomStart: null,
      bottomEnd: null,
    },
  };
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createTheoreticalOpeningTable({
  root = document,
  config = {},
} = {}) {
  const columns = createTheoreticalOpeningColumns(config);

  return createDataTable({
    root,

    table: TABLE_SELECTOR,

    initialView: VIEW,

    getColumns() {
      return columns;
    },

    /*
     * No column picker / visibility groups
     * exist on Theoretical Opening.
     */
    getColumnGroups() {
      return [];
    },

    renderCell(args) {
      return renderTableCell({
        ...args,
        config,
      });
    },

    tableOptions: createTableOptions(config),
  });
}
