/* ==========================================================================
   Market Watch Table
   ========================================================================== */

import {
  getColumnGroups,
  getColumns,
  getVisibleColumns,
} from "./market-watch-schema.js";

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
} from "./market-watch-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const SELECTORS = {
  table: "[data-market-watch-table]",
  shell: "[data-market-watch-table-shell], [data-table-shell]",
};

const STATES = {
  loading: "loading",
  empty: "empty",
  error: "error",
};

/* ==========================================================================
   Helpers
   ========================================================================== */

function getDataTableConstructor() {
  if (typeof window.DataTable !== "function") {
    throw new Error("Market Watch requires DataTables.");
  }

  return window.DataTable;
}

function getTableConfig(config = {}) {
  return {
    fixedColumns: Math.max(0, Number(config.table?.fixedColumns ?? 1)),
    fixedHeader: config.table?.fixedHeader !== false,
    scrollX: config.table?.scrollX !== false,
  };
}

function getCellValue(row, column) {
  return column.data ? row?.[column.data] : "";
}

function getNumericValue(row, column) {
  return column.numericData
    ? row?.[column.numericData]
    : getCellValue(row, column);
}

function isAuction(config = {}) {
  return Boolean(config.market?.isAuction ?? config.openCloseAuction);
}

function createSkeletonCell(column) {
  const size =
    column.key === "company" || column.type === "range"
      ? "table-skeleton-lg"
      : "table-skeleton-md";

  return `<span class="table-skeleton ${size}" aria-hidden="true"></span>`;
}

function renderAuctionFullNumber(value, config) {
  if (isAuction(config) && isZeroLike(value)) {
    return "-";
  }

  return formatFullNumber(value, config);
}

function renderColumnCell(column, row, config) {
  if (row?.__marketWatchState === STATES.loading) {
    return createSkeletonCell(column);
  }

  const value = getCellValue(row, column);

  switch (column.type) {
    case "company":
      return renderCompanyCell(row, config);

    case "range":
      return renderRange(row, config);

    case "auction-value":
      return escapeHtml(formatAuctionValue(value, config));

    case "auction-quantity":
      return escapeHtml(formatAuctionQuantity(value, config));

    case "auction-full-number":
      return escapeHtml(renderAuctionFullNumber(value, config));

    case "full-number":
      return escapeHtml(formatFullNumber(value, config));

    case "market-order":
      return escapeHtml(formatMarketOrder(value, config));

    case "change":
      return renderChange(value, getNumericValue(row, column));

    case "percent-change":
      return renderChange(value, getNumericValue(row, column), {
        percent: true,
      });

    case "text":
    default:
      return escapeHtml(getDisplayValue(value));
  }
}

/* ==========================================================================
   Header Construction
   ========================================================================== */

function createHeaderCell({
  label,
  className = "",
  scope = "col",
  rowSpan = 0,
  colSpan = 0,
  groupId = "",
  isGroupHeading = false,
  width = "",
}) {
  const cell = document.createElement("th");

  cell.className = className;
  cell.scope = scope;

  if (rowSpan) {
    cell.rowSpan = rowSpan;
  }

  if (colSpan) {
    cell.colSpan = colSpan;
  }

  if (groupId) {
    if (isGroupHeading) {
      cell.dataset.marketWatchGroupHeading = groupId;
    } else {
      cell.dataset.marketWatchColumnGroup = groupId;
    }
  }

  if (width) {
    cell.style.width = width;
  }

  if (isGroupHeading) {
    cell.classList.add("table-market__group-heading");
    cell.textContent = label;

    return cell;
  }

  const labelElement = document.createElement("span");

  labelElement.className = "table-market__column-label";
  labelElement.textContent = label;

  cell.append(labelElement);

  return cell;
}

function replaceTableStructure(table, thead) {
  const caption = table.caption;
  const tbody = document.createElement("tbody");

  if (caption) {
    table.replaceChildren(caption, thead, tbody);

    return;
  }

  table.replaceChildren(thead, tbody);
}

function buildHeader(table, config, view) {
  const columns = getColumns(config, view);
  const groups = getColumnGroups(config, view);
  const hasGroupedHeader = columns.some((column) => column.headerGroup);
  const thead = document.createElement("thead");

  if (!hasGroupedHeader) {
    const row = document.createElement("tr");

    columns.forEach((column) => {
      row.append(
        createHeaderCell({
          label: column.label,
          className: column.className,
          groupId: column.visibilityGroup,
          width: column.width,
        }),
      );
    });

    thead.append(row);
    replaceTableStructure(table, thead);

    return;
  }

  const groupRow = document.createElement("tr");
  const columnRow = document.createElement("tr");

  columns
    .filter((column) => !column.headerGroup)
    .forEach((column) => {
      groupRow.append(
        createHeaderCell({
          label: column.label,
          className: column.className,
          groupId: column.visibilityGroup,
          rowSpan: 2,
          width: column.width,
        }),
      );
    });

  groups.forEach((group) => {
    const groupColumns = columns.filter(
      (column) => column.headerGroup === group.id,
    );

    if (!groupColumns.length) {
      return;
    }

    groupRow.append(
      createHeaderCell({
        label: group.label,
        scope: "colgroup",
        colSpan: groupColumns.length,
        groupId: group.id,
        isGroupHeading: true,
      }),
    );

    groupColumns.forEach((column) => {
      columnRow.append(
        createHeaderCell({
          label: column.label,
          className: column.className,
          groupId: column.visibilityGroup,
          width: column.width,
        }),
      );
    });
  });

  thead.append(groupRow, columnRow);
  replaceTableStructure(table, thead);
}

/* ==========================================================================
   DataTables Definitions
   ========================================================================== */

function createColumns(columns, config, visibleGroups) {
  const selectedGroups = new Set(visibleGroups);

  return columns.map((column) => ({
    data: null,
    name: column.key,
    width: column.width,
    className: column.className || "",

    orderable: false,
    searchable: false,

    visible:
      !column.visibilityGroup || selectedGroups.has(column.visibilityGroup),

    render(_data, type, row) {
      if (type === "sort" || type === "type" || type === "filter") {
        return getDisplayValue(getCellValue(row, column), "");
      }

      return renderColumnCell(column, row, config);
    },
  }));
}

function createGroupRow(groupName, visibleColumnCount) {
  const row = document.createElement("tr");
  const label = document.createElement("th");
  const fill = document.createElement("td");

  row.className = "table-market__group-row table-group-row";

  label.className =
    "table-market__group-label table-group-label table-group-label-sticky";

  label.scope = "rowgroup";
  label.textContent = groupName || "";

  fill.className = "table-market__group-fill table-group-fill";
  fill.colSpan = Math.max(1, visibleColumnCount - 1);
  fill.setAttribute("aria-hidden", "true");

  row.append(label, fill);

  return row;
}

function createLoadingRows(count = 6) {
  return Array.from({ length: count }, (_, index) => ({
    __marketWatchState: STATES.loading,
    __marketWatchRow: index,
  }));
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketWatchTable(config = {}, root = document) {
  const table = root.querySelector(SELECTORS.table);

  if (!table) {
    throw new Error("Market Watch requires [data-market-watch-table].");
  }

  const shell = table.closest(SELECTORS.shell);

  if (!shell) {
    throw new Error("Market Watch table requires [data-table-shell].");
  }

  const DataTable = getDataTableConstructor();
  const tableConfig = getTableConfig(config);

  let api = null;
  let currentView = String(config.initialState?.tableView || "1");
  let visibleGroups = [...(config.initialState?.visibleGroups || [])];
  let rows = [];
  let emptyState = null;
  let layoutFrame = null;
  let destroyed = false;

  function getCurrentColumns() {
    return getColumns(config, currentView);
  }

  function getCurrentAvailableGroups() {
    return getColumnGroups(config, currentView).map((group) => group.id);
  }

  function getCurrentVisibleGroups() {
    const availableGroups = new Set(getCurrentAvailableGroups());

    return visibleGroups.filter((groupId) => availableGroups.has(groupId));
  }

  function getVisibleColumnCount() {
    if (!api) {
      return getVisibleColumns(config, currentView, getCurrentVisibleGroups())
        .length;
    }

    return api.columns(":visible").count();
  }

  /*
   * DataTables owns the `dtfc-fixed-start` class and sticky positioning.
   * This only asks its extensions to recalculate after a draw or rebuild.
   */

  function refreshLayout() {
    if (!api) {
      return;
    }

    api.columns.adjust();

    const fixedColumns =
      typeof api.fixedColumns === "function" ? api.fixedColumns() : null;

    fixedColumns?.relayout?.();
    api.fixedHeader?.adjust?.();
  }

  function scheduleLayoutRefresh() {
    if (layoutFrame !== null) {
      return;
    }

    layoutFrame = window.requestAnimationFrame(() => {
      layoutFrame = null;
      refreshLayout();
    });
  }

  function updateCompanyOnlyMode() {
    const hasVisibleOptionalColumn = getCurrentColumns().some((column) => {
      return (
        column.visibilityGroup &&
        getCurrentVisibleGroups().includes(column.visibilityGroup)
      );
    });

    table.classList.toggle(
      "table-market--company-only",
      !hasVisibleOptionalColumn,
    );
  }

  function getHeaderTables() {
    if (!api) {
      return [table];
    }

    const container = api.table().container();

    return [table, ...container.querySelectorAll("table.dataTable")];
  }

  function updateHeaderGroups() {
    if (!api) {
      return;
    }

    const columns = getCurrentColumns();
    const visibleGroups = new Set(getCurrentVisibleGroups());

    [...new Set(getHeaderTables())].forEach((headerTable) => {
      headerTable
        .querySelectorAll("[data-market-watch-group-heading]")
        .forEach((headerCell) => {
          const groupId = headerCell.dataset.marketWatchGroupHeading;

          const visibleCount = columns.filter((column, index) => {
            return (
              column.headerGroup === groupId && api.column(index).visible()
            );
          }).length;

          headerCell.hidden = visibleCount === 0;

          if (visibleCount) {
            headerCell.colSpan = visibleCount;
          }
        });

      headerTable
        .querySelectorAll("[data-market-watch-column-group]")
        .forEach((headerCell) => {
          const groupId = headerCell.dataset.marketWatchColumnGroup;

          if (!groupId) {
            return;
          }

          headerCell.hidden = !visibleGroups.has(groupId);
        });
    });
  }

  function updateEmptyState() {
    const emptyCell = table.tBodies[0]?.querySelector("td.dt-empty");

    if (!emptyCell) {
      return;
    }

    emptyCell.classList.add("table-empty");
    emptyCell.textContent =
      emptyState?.message || config.labels?.noData || "No data available";
  }

  function syncVisibleColumns() {
    if (!api) {
      return;
    }

    const selectedGroups = new Set(getCurrentVisibleGroups());

    getCurrentColumns().forEach((column, index) => {
      if (!column.visibilityGroup) {
        return;
      }

      api
        .column(index)
        .visible(selectedGroups.has(column.visibilityGroup), false);
    });

    updateCompanyOnlyMode();
    updateHeaderGroups();

    api.columns.adjust().draw(false);
    scheduleLayoutRefresh();
  }

  function createInstance() {
    table.dataset.marketWatchView = currentView;

    buildHeader(table, config, currentView);

    const columns = getCurrentColumns();
    const usesRowGroup = currentView === "1" || currentView === "2";

    api = new DataTable(table, {
      data: rows,
      columns: createColumns(columns, config, getCurrentVisibleGroups()),

      autoWidth: false,
      scrollX: tableConfig.scrollX,
      scrollCollapse: true,

      paging: false,
      searching: false,
      ordering: false,
      info: false,
      lengthChange: false,

      fixedHeader: tableConfig.fixedHeader
        ? {
            header: true,
            footer: false,
          }
        : false,

      fixedColumns:
        tableConfig.fixedColumns > 0
          ? {
              start: tableConfig.fixedColumns,
            }
          : false,

      rowGroup: usesRowGroup
        ? {
            dataSrc: "sectorName",

            startRender(groupRows, groupName) {
              const isLoading = groupRows
                .data()
                .toArray()
                .some((row) => row?.__marketWatchState === STATES.loading);

              return isLoading
                ? null
                : createGroupRow(groupName, getVisibleColumnCount());
            },
          }
        : false,

      language: {
        emptyTable: config.labels?.noData || "No data available",
      },

      layout: {
        topStart: null,
        topEnd: null,
        bottomStart: null,
        bottomEnd: null,
      },

      drawCallback() {
        updateEmptyState();
        updateHeaderGroups();
      },

      initComplete() {
        updateCompanyOnlyMode();
        updateHeaderGroups();
        scheduleLayoutRefresh();
      },
    });

    syncVisibleColumns();
  }

  function destroyInstance() {
    if (!api) {
      return;
    }

    api.destroy();
    api = null;
  }

  function setRows(nextRows = []) {
    rows = Array.isArray(nextRows) ? nextRows : [];
    emptyState = null;

    table.setAttribute("aria-busy", "false");

    api.clear();
    api.rows.add(rows);
    api.draw(false);

    scheduleLayoutRefresh();
  }

  function showLoading() {
    emptyState = null;

    table.setAttribute("aria-busy", "true");

    api.clear();
    api.rows.add(createLoadingRows());
    api.draw(false);

    scheduleLayoutRefresh();
  }

  function showEmpty(message) {
    rows = [];

    emptyState = {
      type: STATES.empty,
      message: message || config.labels?.noData || "No data available",
    };

    table.setAttribute("aria-busy", "false");

    api.clear().draw(false);
    scheduleLayoutRefresh();
  }

  function showError(message) {
    rows = [];

    emptyState = {
      type: STATES.error,
      message: message || config.labels?.noData || "No data available",
    };

    table.setAttribute("aria-busy", "false");

    api.clear().draw(false);
    scheduleLayoutRefresh();
  }

  function setVisibleGroups(nextGroups = []) {
    visibleGroups = [...new Set(nextGroups)];
    syncVisibleColumns();
  }

  function setView(nextView) {
    const view = String(nextView || "1");

    if (view === currentView) {
      return;
    }

    currentView = view;

    /*
     * Views can have a different header structure and column model.
     * Rebuilding once is the supported DataTables lifecycle.
     */

    destroyInstance();
    createInstance();

    if (rows.length) {
      setRows(rows);
    } else if (emptyState?.type === STATES.error) {
      showError(emptyState.message);
    } else if (emptyState) {
      showEmpty(emptyState.message);
    } else {
      showLoading();
    }
  }

  function handleFavoriteClick(event) {
    const button = event.target.closest("[data-market-watch-favorite]");

    if (!button || !shell.contains(button)) {
      return;
    }

    event.preventDefault();

    const companyRef = button.dataset.companyRef || "";

    if (typeof window.showAddToWatchListPopup === "function") {
      window.showAddToWatchListPopup(companyRef);
    }

    shell.dispatchEvent(
      new CustomEvent("marketwatch:favorite-request", {
        bubbles: true,
        detail: {
          companyRef,
          button,
        },
      }),
    );
  }

  function handleLogoError(event) {
    const image = event.target;

    if (
      !(image instanceof HTMLImageElement) ||
      !image.matches("[data-market-watch-logo]")
    ) {
      return;
    }

    const fallbackUrl = image.dataset.marketWatchLogoFallback;

    if (fallbackUrl && !image.dataset.marketWatchLogoFallbackApplied) {
      image.dataset.marketWatchLogoFallbackApplied = "true";
      image.src = fallbackUrl;

      return;
    }

    image.closest(".table-market__logo")?.classList.add("is-image-missing");
    image.remove();
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    shell.removeEventListener("click", handleFavoriteClick);
    shell.removeEventListener("error", handleLogoError, true);

    if (layoutFrame !== null) {
      window.cancelAnimationFrame(layoutFrame);
    }

    destroyInstance();
  }

  shell.addEventListener("click", handleFavoriteClick);
  shell.addEventListener("error", handleLogoError, true);

  createInstance();

  return Object.freeze({
    destroy,

    getApi() {
      return api;
    },

    getRows() {
      return [...rows];
    },

    getView() {
      return currentView;
    },

    setRows,
    setView,
    setVisibleGroups,

    showEmpty,
    showError,
    showLoading,
  });
}
