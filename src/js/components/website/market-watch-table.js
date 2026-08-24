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

function getTableShell(table) {
  return table.closest(SELECTORS.shell);
}

function getAvailableGroupIds(config, view) {
  return getColumnGroups(config, view).map((group) => group.id);
}

function getTableConfig(config = {}) {
  return {
    fixedColumns: config.table?.fixedColumns ?? 1,
    fixedHeader: config.table?.fixedHeader ?? true,
    scrollX: config.table?.scrollX ?? true,
  };
}

function isAuction(config = {}) {
  return Boolean(config.market?.isAuction ?? config.openCloseAuction);
}

function getCellValue(row, column) {
  if (!column.data) {
    return "";
  }

  return row?.[column.data];
}

function getNumericValue(row, column) {
  if (!column.numericData) {
    return getCellValue(row, column);
  }

  return row?.[column.numericData];
}

function createSkeletonCell(column) {
  const sizeClass =
    column.key === "company"
      ? "table-skeleton-lg"
      : column.type === "range"
        ? "table-skeleton-lg"
        : "table-skeleton-md";

  return `<span class="table-skeleton ${sizeClass}" aria-hidden="true"></span>`;
}

function renderTextCell(value) {
  return escapeHtml(getDisplayValue(value));
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

  switch (column.type) {
    case "company":
      return renderCompanyCell(row, config);

    case "range":
      return renderRange(row, config);

    case "auction-value":
      return escapeHtml(formatAuctionValue(getCellValue(row, column), config));

    case "auction-quantity":
      return escapeHtml(
        formatAuctionQuantity(getCellValue(row, column), config),
      );

    case "auction-full-number":
      return escapeHtml(
        renderAuctionFullNumber(getCellValue(row, column), config),
      );

    case "full-number":
      return escapeHtml(formatFullNumber(getCellValue(row, column), config));

    case "market-order":
      return escapeHtml(formatMarketOrder(getCellValue(row, column), config));

    case "change":
      return renderChange(
        getCellValue(row, column),
        getNumericValue(row, column),
      );

    case "percent-change":
      return renderChange(
        getCellValue(row, column),
        getNumericValue(row, column),
        { percent: true },
      );

    case "text":
    default:
      return renderTextCell(getCellValue(row, column));
  }
}

function createHeaderCell({
  label,
  className,
  scope,
  rowSpan,
  colSpan,
  groupId,
  isGroupHeading = false,
  width,
  minWidth,
  maxWidth,
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

  if (minWidth) {
    cell.style.minWidth = minWidth;
  }

  if (maxWidth) {
    cell.style.maxWidth = maxWidth;
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

function buildTableHeader(table, config, view) {
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
          scope: "col",
          groupId: column.visibilityGroup,
          width: column.width,
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
        }),
      );
    });

    thead.append(row);
    table.replaceChildren(thead, document.createElement("tbody"));

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
          scope: "col",
          rowSpan: 2,
          groupId: column.visibilityGroup,
          width: column.width,
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
        }),
      );
    });

  groups.forEach((group) => {
    const groupedColumns = columns.filter(
      (column) => column.headerGroup === group.id,
    );

    if (!groupedColumns.length) {
      return;
    }

    groupRow.append(
      createHeaderCell({
        label: group.label,
        className: "table-market__group-heading",
        scope: "colgroup",
        colSpan: groupedColumns.length,
        groupId: group.id,
        isGroupHeading: true,
      }),
    );

    groupedColumns.forEach((column) => {
      columnRow.append(
        createHeaderCell({
          label: column.label,
          className: column.className,
          scope: "col",
          groupId: column.visibilityGroup,
          width: column.width,
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
        }),
      );
    });
  });

  thead.append(groupRow, columnRow);
  table.replaceChildren(thead, document.createElement("tbody"));
}

function createGroupRow(groupName, visibleColumnCount) {
  const row = document.createElement("tr");
  const label = document.createElement("th");
  const fill = document.createElement("td");

  row.className = "table-market__group-row table-group-row";

  label.className =
    "table-market__group-label table-group-label table-group-label-sticky";

  label.scope = "rowgroup";
  label.textContent = groupName;

  fill.className = "table-market__group-fill table-group-fill";
  fill.colSpan = Math.max(1, visibleColumnCount - 1);
  fill.setAttribute("aria-hidden", "true");

  row.append(label, fill);

  return row;
}

function createDataTablesColumns(columns, config, visibleGroups) {
  const selectedGroups = new Set(visibleGroups);

  return columns.map((column) => ({
    data: null,
    name: column.key,

    width: column.width,

    className: column.className,

    orderable: false,
    searchable: false,

    visible:
      !column.visibilityGroup || selectedGroups.has(column.visibilityGroup),

    render(_data, type, row) {
      /*
       * Ordering is disabled, but returning plain values keeps DataTables
       * search/type extensions safe if enabled on another page later.
       */

      if (type === "sort" || type === "type" || type === "filter") {
        return getDisplayValue(getCellValue(row, column), "");
      }

      return renderColumnCell(column, row, config);
    },
  }));
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

  const shell = getTableShell(table);

  if (!shell) {
    throw new Error("Market Watch table requires [data-table-shell].");
  }

  const DataTable = getDataTableConstructor();
  const tableConfig = getTableConfig(config);

  let api = null;
  let currentView = String(config.initialState?.tableView || "1");
  let rows = [];
  let visibleGroups = [...(config.initialState?.visibleGroups || [])];
  let emptyState = null;
  let layoutFrame = null;
  let destroyed = false;

  function getCurrentColumns() {
    return getColumns(config, currentView);
  }

  function getCurrentAvailableGroups() {
    return getAvailableGroupIds(config, currentView);
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

  function updateCompanyOnlyMode() {
    const optionalColumns = getCurrentColumns().filter(
      (column) => column.visibilityGroup,
    );

    const hasVisibleOptionalColumn = optionalColumns.some((column) => {
      return getCurrentVisibleGroups().includes(column.visibilityGroup);
    });

    table.classList.toggle(
      "table-market--company-only",
      !hasVisibleOptionalColumn,
    );
  }

  function updateHeaderGroups() {
    if (!api) {
      return;
    }

    const columns = getCurrentColumns();
    const roots = [table, api.table().container()];

    const uniqueRoots = [...new Set(roots.filter(Boolean))];

    uniqueRoots.forEach((rootElement) => {
      rootElement
        .querySelectorAll("[data-market-watch-group-heading]")
        .forEach((headerCell) => {
          const groupId = headerCell.dataset.marketWatchGroupHeading;

          const visibleColumnCount = columns.filter((column, index) => {
            return (
              column.headerGroup === groupId && api.column(index).visible()
            );
          }).length;

          headerCell.hidden = visibleColumnCount === 0;

          if (visibleColumnCount > 0) {
            headerCell.colSpan = visibleColumnCount;
          }
        });

      rootElement
        .querySelectorAll("[data-market-watch-column-group]")
        .forEach((headerCell) => {
          const groupId = headerCell.dataset.marketWatchColumnGroup;

          if (!groupId) {
            return;
          }

          const isVisible = getCurrentVisibleGroups().includes(groupId);

          headerCell.hidden = !isVisible;
        });
    });
  }

  function updateEmptyRow() {
    const body = table.tBodies[0];

    if (!body) {
      return;
    }

    const emptyCell = body.querySelector("td.dt-empty");

    if (!emptyCell) {
      return;
    }

    const message =
      emptyState?.message || config.labels?.noData || "No data available";

    emptyCell.classList.add(
      emptyState?.type === STATES.error ? "table-empty" : "table-empty",
    );

    emptyCell.textContent = message;
  }

  function refreshExtensions() {
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

      refreshExtensions();

      window.requestAnimationFrame(() => {
        refreshExtensions();
      });
    });
  }

  function syncColumnVisibility() {
    if (!api) {
      return;
    }

    const selectedGroups = new Set(getCurrentVisibleGroups());

    getCurrentColumns().forEach((column, index) => {
      if (!column.visibilityGroup) {
        return;
      }

      const shouldBeVisible = selectedGroups.has(column.visibilityGroup);

      if (api.column(index).visible() !== shouldBeVisible) {
        api.column(index).visible(shouldBeVisible, false);
      }
    });

    updateCompanyOnlyMode();
    updateHeaderGroups();

    api.columns.adjust().draw(false);

    scheduleLayoutRefresh();
  }

  function createInstance() {
    buildTableHeader(table, config, currentView);

    const columns = getCurrentColumns();
    const usesRowGroups = currentView === "1" || currentView === "2";

    api = new DataTable(table, {
      data: rows,

      columns: createDataTablesColumns(
        columns,
        config,
        getCurrentVisibleGroups(),
      ),

      autoWidth: false,

      scrollX: tableConfig.scrollX,
      scrollCollapse: true,

      paging: false,
      searching: false,
      ordering: false,
      order: [],
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

      rowGroup: usesRowGroups
        ? {
            dataSrc: "sectorName",

            startRender(groupRows, groupName) {
              /*
               * Skeleton rows intentionally have no sector heading.
               */

              if (
                groupRows
                  .data()
                  .toArray()
                  .some((row) => row?.__marketWatchState === STATES.loading)
              ) {
                return null;
              }

              return createGroupRow(groupName, getVisibleColumnCount());
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
        updateEmptyRow();
        updateHeaderGroups();
      },

      initComplete() {
        updateCompanyOnlyMode();
        updateHeaderGroups();
        scheduleLayoutRefresh();
      },
    });

    syncColumnVisibility();
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

    syncColumnVisibility();
  }

  function setView(nextView) {
    const normalizedView = String(nextView || "1");

    if (normalizedView === currentView) {
      return;
    }

    currentView = normalizedView;

    /*
     * A view has a different column model. Recreate once for that meaningful
     * schema change; normal Show/Hide Column changes never rebuild the table.
     */

    destroyInstance();
    createInstance();

    if (rows.length) {
      setRows(rows);
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

    if (typeof config.watchlist?.openDialog === "function") {
      config.watchlist.openDialog(companyRef);
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

    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    if (!image.matches("[data-market-watch-logo]")) {
      return;
    }

    image
      .closest(".table-market__logo, .data-card__logo")
      ?.classList.add("is-image-missing");

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
