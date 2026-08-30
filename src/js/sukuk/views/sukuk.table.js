/* ==========================================================================
   Sukuk Table View
   ========================================================================== */

/*
 * Sukuk & Bonds desktop table presentation.
 *
 * Responsibilities:
 *
 * - table cell rendering
 * - loading skeleton rendering
 * - row-group rendering
 * - Data View table composition
 *
 * This module intentionally has no:
 *
 * - API requests
 * - response normalization
 * - filter binding
 * - column-picker lifecycle
 * - mobile card rendering
 * - favorite event handling
 * - page startup
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataTable } from "../../../common/data-view/index.js";

import { createMarketTableOptions } from "../../shared/market-table-options.js";

import { getColumnGroups, getColumns } from "../sukuk.columns.js";

import {
  escapeHtml,
  formatCouponFrequency,
  formatCouponType,
  formatDayCountConvention,
  formatMaturity,
  formatPrice,
  formatQuantity,
  formatYield,
  getColumnValue,
  getDisplayValue,
  getInstrumentName,
  getSukukGroup,
  renderInstrument,
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
    if (column.type === "instrument") {
      return getInstrumentName(row);
    }

    return getDisplayValue(getColumnValue(row, column, ""), "");
  }

  /* ------------------------------------------------------------------------
     Loading
     ------------------------------------------------------------------------ */

  if (row?.__dataViewState === "loading") {
    const size =
      column.type === "instrument" ? "table-skeleton-lg" : "table-skeleton-md";

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

  const value = getColumnValue(row, column, "");

  switch (column.type) {
    case "instrument":
      return renderInstrument(row);

    case "coupon-type":
      return escapeHtml(formatCouponType(value, config));

    case "maturity":
      return escapeHtml(formatMaturity(row, config));

    case "yield":
      return escapeHtml(formatYield(value));

    case "price":
      return escapeHtml(formatPrice(value));

    case "quantity":
      return escapeHtml(formatQuantity(value, config));

    case "coupon-frequency":
      return escapeHtml(formatCouponFrequency(value, config));

    case "day-count-convention":
      return escapeHtml(formatDayCountConvention(value, config));

    case "display-value":
    case "text":
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

  label.className =
    "table-market__group-label table-group-label table-group-label-sticky";

  label.textContent = groupName || "";

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
  view = "1",
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

      /*
       * Sukuk-specific grouping.
       */

      rowGroup: {},
    }),

    getRowGroup(row) {
      return getSukukGroup(row, config);
    },

    renderRowGroupStart(args) {
      return renderSukukGroup(args);
    },
  });
}
