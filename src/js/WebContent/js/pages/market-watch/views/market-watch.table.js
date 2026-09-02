/* ==========================================================================
   Market Watch Table View
   ========================================================================== */

/*
 * Desktop/table presentation adapter for Market Watch.
 *
 * Responsibilities:
 *
 * - expose Market Watch column definitions to createDataTable
 * - render table cells
 * - render loading skeleton cells
 * - render sector group rows
 * - provide Market Watch DataTable options
 *
 * This module intentionally has no:
 *
 * - request logic
 * - response normalization
 * - filter state
 * - column-picker DOM behavior
 * - card rendering
 * - favorite click handling
 * - logo error handling
 * - page lifecycle
 */

import {
  getMarketWatchColumnGroups,
  getMarketWatchColumns,
} from "../market-watch.columns.js";

import {
  escapeHtml,
  formatAuctionQuantity,
  formatAuctionValue,
  formatFullNumber,
  formatMarketOrder,
  getDisplayValue,
  isZeroLike,
  renderChange,
  renderCompanyCell,
  renderRange,
} from "../market-watch.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TABLE_SELECTOR = "[data-market-watch-table]";

const DEFAULT_LOADING_ROW_COUNT = 8;

const DEFAULT_TABLE_OPTIONS = Object.freeze({
  autoWidth: false,

  paging: false,
  pageLength: 25,
  lengthChange: false,

  searching: false,
  ordering: false,
  info: false,

  serverSide: false,
  processing: false,

  scrollX: true,
  scrollCollapse: true,

  fixedHeader: true,
  fixedColumns: 1,
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function getCellValue(row, column) {
  if (!column?.data) {
    return "";
  }

  return row?.[column.data];
}

function getNumericValue(row, column) {
  if (column?.numericData) {
    return row?.[column.numericData];
  }

  return getCellValue(row, column);
}

function isAuction(config = {}) {
  return Boolean(config.market?.isAuction);
}

function renderAuctionFullNumber(value, config = {}) {
  if (isAuction(config) && isZeroLike(value)) {
    return "-";
  }

  return formatFullNumber(value, config);
}

/* ==========================================================================
   Loading Cell
   ========================================================================== */

function renderLoadingCell(column = {}) {
  const size =
    column.key === "company" || column.type === "range"
      ? "table-skeleton-lg"
      : "table-skeleton-md";

  return `
    <span
      class="table-skeleton ${escapeHtml(size)}"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Cell Rendering
   ========================================================================== */

export function renderMarketWatchTableCell({ row, column, type, config = {} }) {
  /*
   * DataTables should receive raw/display-safe scalar values for operations
   * that are not visual rendering.
   */

  if (type === "sort" || type === "type" || type === "filter") {
    return getDisplayValue(getCellValue(row, column), "");
  }

  if (row?.__dataViewState === "loading") {
    return renderLoadingCell(column);
  }

  const value = getCellValue(row, column);

	//Route based on column key or type to ensure exact 1:1 data matching
	switch (column?.key || column?.type) {
	 case "companyName":
	   return renderCompanyCell(row, config);
	
	 case "prev_close":
	 case "previousClose":
	   return escapeHtml(formatFullNumber(value, config));
	
	 case "top":
	   return escapeHtml(formatAuctionValue(value, config));
	
	 case "tov":
	   return escapeHtml(formatAuctionQuantity(value, config));
	
	 default:
	   return escapeHtml(getDisplayValue(value));
	}

}

/* ==========================================================================
   Sector Group
   ========================================================================== */

export function renderMarketWatchSectorGroup({
  groupName,
  groupRows,
  visibleColumnCount,
}) {
  /*
   * Loading placeholder rows must not create artificial sector headings.
   */

  const loading = groupRows
    ?.data?.()
    ?.toArray?.()
    ?.some((row) => row?.__dataViewState === "loading");

  if (loading) {
    return null;
  }

  const row = document.createElement("tr");

  row.className = "table-market__group-row table-group-row";

  const label = document.createElement("th");

  label.scope = "rowgroup";

  label.className =
    "table-market__group-label table-group-label table-group-label-sticky";

  label.textContent = String(groupName ?? "").trim();

  const fill = document.createElement("td");

  fill.className = "table-market__group-fill table-group-fill";

  fill.colSpan = Math.max(1, Number(visibleColumnCount || 1) - 1);

  fill.setAttribute("aria-hidden", "true");

  row.append(label, fill);

  return row;
}

/* ==========================================================================
   Table Options
   ========================================================================== */

export function createMarketWatchTableOptions(config = {}) {
  const table = config.table ?? {};

  return {
    autoWidth: table.autoWidth ?? DEFAULT_TABLE_OPTIONS.autoWidth,

    paging: table.paging ?? DEFAULT_TABLE_OPTIONS.paging,

    pageLength: table.pageLength ?? DEFAULT_TABLE_OPTIONS.pageLength,

    lengthChange: table.lengthChange ?? DEFAULT_TABLE_OPTIONS.lengthChange,

    searching: table.searching ?? DEFAULT_TABLE_OPTIONS.searching,

    ordering: table.ordering ?? DEFAULT_TABLE_OPTIONS.ordering,

    info: table.info ?? DEFAULT_TABLE_OPTIONS.info,

    serverSide: table.serverSide ?? DEFAULT_TABLE_OPTIONS.serverSide,

    processing: table.processing ?? DEFAULT_TABLE_OPTIONS.processing,

    scrollX: table.scrollX ?? DEFAULT_TABLE_OPTIONS.scrollX,

    scrollCollapse:
      table.scrollCollapse ?? DEFAULT_TABLE_OPTIONS.scrollCollapse,

    fixedHeader: table.fixedHeader ?? DEFAULT_TABLE_OPTIONS.fixedHeader,

    fixedColumns: table.fixedColumns ?? DEFAULT_TABLE_OPTIONS.fixedColumns,

    /*
     * createDataTable owns the RowGroup integration. An empty RowGroup object
     * enables that adapter while the actual grouping callbacks are supplied
     * below.
     */

    rowGroup: {},

    /*
     * Market Watch owns no DataTables toolbar controls. Filters and result
     * information are rendered by the page's design-system UI.
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
   Table Factory
   ========================================================================== */

export function createMarketWatchTableView({
  root,
  config,
  createDataTable,
  table = DEFAULT_TABLE_SELECTOR,
  initialView = "1",
  visibleGroups = [],
  loadingRowCount = DEFAULT_LOADING_ROW_COUNT,
} = {}) {
  if (typeof createDataTable !== "function") {
    throw new TypeError("createMarketWatchTableView requires createDataTable.");
  }

  if (!root) {
    throw new TypeError("createMarketWatchTableView requires a root.");
  }

  if (!config) {
    throw new TypeError("createMarketWatchTableView requires config.");
  }

  return createDataTable({
    root,

    table,

    initialView,

    visibleGroups,

    loadingRowCount,

    getColumns(view) {
      return getMarketWatchColumns(config, view);
    },

    getColumnGroups(view) {
      return getMarketWatchColumnGroups(config, view);
    },

    renderCell(args) {
      return renderMarketWatchTableCell({
        ...args,

        config,
      });
    },

    tableOptions: createMarketWatchTableOptions(config),

    getRowGroup(row) {
      return String(row?.sectorName ?? "").trim();
    },

    renderRowGroupStart(args) {
      return renderMarketWatchSectorGroup(args);
    },
  });
}
