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
  favorite: "[data-market-watch-favorite]",
  logo: "[data-market-watch-logo]",
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
    fixedColumns: Number(config.table?.fixedColumns ?? 1),
    fixedHeader: config.table?.fixedHeader !== false,
    scrollX: config.table?.scrollX !== false,
  };
}

function unique(values = []) {
  return [...new Set(values)];
}

function arraysEqual(first = [], second = []) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
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

/* ==========================================================================
   Cell Rendering
   ========================================================================== */

function createSkeletonCell(column) {
  const size =
    column.key === "company" || column.type === "range"
      ? "table-skeleton-lg"
      : "table-skeleton-md";

  return `
    <span
      class="table-skeleton ${size}"
      aria-hidden="true"
    ></span>
  `.trim();
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
   Header
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

  /*
   * Keep a stable source width before DataTables measures
   * scrollX / FixedColumns geometry.
   */

  if (width) {
    cell.style.width = width;
    cell.style.minWidth = width;
    cell.style.maxWidth = width;
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

  const hasGroupedHeader = columns.some((column) =>
    Boolean(column.headerGroup),
  );

  const thead = document.createElement("thead");

  /* ------------------------------------------------------------------------
     Single-row Header
     ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
     Grouped Header
     ------------------------------------------------------------------------ */

  const groupRow = document.createElement("tr");

  const columnRow = document.createElement("tr");

  /*
   * Columns without headerGroup span both header rows.
   */

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

        className: "table-market__group-heading",

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
   DataTables Columns
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

/* ==========================================================================
   Row Group
   ========================================================================== */

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

/* ==========================================================================
   Loading Rows
   ========================================================================== */

function createLoadingRows(count = 6) {
  return Array.from(
    {
      length: count,
    },
    (_, index) => ({
      __marketWatchState: STATES.loading,

      __marketWatchRow: index,
    }),
  );
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

  let visibleGroups = unique(config.initialState?.visibleGroups || []);

  /*
   * Real API rows only.
   *
   * Skeleton rows are temporary display rows and are never
   * stored in this array.
   */

  let rows = [];

  let renderState = {
    type: STATES.loading,
    message: "",
  };

  let layoutFrame = null;
  let destroyed = false;

  /* ========================================================================
     Current Schema
     ======================================================================== */

  function getCurrentColumns() {
    return getColumns(config, currentView);
  }

  function getCurrentAvailableGroups() {
    return getColumnGroups(config, currentView).map((group) => group.id);
  }

  function getCurrentVisibleGroups() {
    const available = new Set(getCurrentAvailableGroups());

    return visibleGroups.filter((groupId) => available.has(groupId));
  }

  function getVisibleColumnCount() {
    if (!api) {
      return getVisibleColumns(config, currentView, getCurrentVisibleGroups())
        .length;
    }

    return api.columns(":visible").count();
  }

  /* ========================================================================
     Layout
     ======================================================================== */

  /*
   * Do not directly manage FixedHeader or FixedColumns here.
   *
   * Your existing global table layout system already responds to resize and
   * owns:
   *
   * - DataTables width recalculation
   * - FixedHeader refresh
   * - FixedColumns refresh
   * - horizontal scroll navigation
   *
   * This module only signals that table geometry changed.
   */

  function scheduleLayoutRefresh() {
    if (destroyed || layoutFrame !== null) {
      return;
    }

    layoutFrame = window.requestAnimationFrame(() => {
      layoutFrame = null;

      if (destroyed || !api) {
        return;
      }

      window.dispatchEvent(new Event("resize"));
    });
  }

  /* ========================================================================
     Company-only Mode
     ======================================================================== */

  function updateCompanyOnlyMode() {
    const selectedGroups = new Set(getCurrentVisibleGroups());

    const hasVisibleOptionalColumn = getCurrentColumns()
      .filter((column) => column.visibilityGroup)
      .some((column) => selectedGroups.has(column.visibilityGroup));

    table.classList.toggle(
      "table-market--company-only",
      !hasVisibleOptionalColumn,
    );
  }

  /* ========================================================================
     Group Headers
     ======================================================================== */

  function updateHeaderGroups() {
    if (!api || !table.tHead) {
      return;
    }

    const columns = getCurrentColumns();

    /*
     * Modify only the source THEAD.
     *
     * Do not directly manipulate scrollX / FixedHeader generated table
     * copies. DataTables owns those structures.
     */

    table.tHead
      .querySelectorAll("[data-market-watch-group-heading]")
      .forEach((headerCell) => {
        const groupId = headerCell.dataset.marketWatchGroupHeading;

        const visibleCount = columns.filter(
          (column, index) =>
            column.headerGroup === groupId && api.column(index).visible(),
        ).length;

        headerCell.hidden = visibleCount === 0;

        if (visibleCount > 0) {
          headerCell.colSpan = visibleCount;
        }
      });

    table.tHead
      .querySelectorAll("[data-market-watch-column-group]")
      .forEach((headerCell) => {
        const groupId = headerCell.dataset.marketWatchColumnGroup;

        if (!groupId) {
          return;
        }

        headerCell.hidden = !getCurrentVisibleGroups().includes(groupId);
      });
  }

  /* ========================================================================
     Empty State
     ======================================================================== */

  function updateEmptyState() {
    const emptyCell = table.tBodies[0]?.querySelector("td.dt-empty");

    if (!emptyCell) {
      return;
    }

    emptyCell.classList.add("table-empty");

    emptyCell.textContent =
      renderState?.message || config.labels?.noData || "No data available";
  }

  /* ========================================================================
     Visible Columns
     ======================================================================== */

  function syncVisibleColumns() {
    if (!api) {
      return;
    }

    const selected = new Set(getCurrentVisibleGroups());

    let changed = false;

    getCurrentColumns().forEach((column, index) => {
      if (!column.visibilityGroup) {
        return;
      }

      const shouldBeVisible = selected.has(column.visibilityGroup);

      const dtColumn = api.column(index);

      if (dtColumn.visible() === shouldBeVisible) {
        return;
      }

      dtColumn.visible(shouldBeVisible, false);

      changed = true;
    });

    updateCompanyOnlyMode();
    updateHeaderGroups();

    if (changed) {
      /*
       * Apply all visibility changes in one final adjustment/draw.
       */

      api.columns.adjust();
      api.draw(false);
    }

    scheduleLayoutRefresh();
  }

  /* ========================================================================
     Display Rows
     ======================================================================== */

  function getDisplayRows() {
    if (renderState?.type === STATES.loading) {
      return createLoadingRows();
    }

    if (
      renderState?.type === STATES.empty ||
      renderState?.type === STATES.error
    ) {
      return [];
    }

    return rows;
  }

  /* ========================================================================
     DataTable Creation
     ======================================================================== */

  function createInstance() {
    if (destroyed) {
      return;
    }

    table.dataset.marketWatchView = currentView;

    /*
     * Each table view has a different column/header model.
     * Build the source header before DataTables initializes.
     */

    buildHeader(table, config, currentView);

    const columns = getCurrentColumns();

    const usesRowGroup = currentView === "1" || currentView === "2";

    api = new DataTable(table, {
      /*
       * Initialize once with the current display state.
       */

      data: getDisplayRows(),

      columns: createColumns(columns, config, getCurrentVisibleGroups()),

      autoWidth: false,

      scrollX: tableConfig.scrollX,

      scrollCollapse: true,

      paging: false,
      searching: false,
      ordering: false,
      info: false,
      lengthChange: false,

      /* ------------------------------------------------------------------
           FixedHeader
           ------------------------------------------------------------------ */

      fixedHeader: tableConfig.fixedHeader
        ? {
            header: true,
            footer: false,
          }
        : false,

      /* ------------------------------------------------------------------
           FixedColumns
           ------------------------------------------------------------------ */

      fixedColumns:
        tableConfig.fixedColumns > 0
          ? {
              start: tableConfig.fixedColumns,
            }
          : false,

      /* ------------------------------------------------------------------
           RowGroup
           ------------------------------------------------------------------ */

      rowGroup: usesRowGroup
        ? {
            dataSrc: "sectorName",

            startRender(groupRows, groupName) {
              const isLoading = groupRows
                .data()
                .toArray()
                .some((row) => row?.__marketWatchState === STATES.loading);

              if (isLoading) {
                return null;
              }

              return createGroupRow(groupName, getVisibleColumnCount());
            },
          }
        : false,

      /* ------------------------------------------------------------------
           Language
           ------------------------------------------------------------------ */

      language: {
        emptyTable: config.labels?.noData || "No data available",
      },

      /* ------------------------------------------------------------------
           Layout
           ------------------------------------------------------------------ */

      layout: {
        topStart: null,
        topEnd: null,
        bottomStart: null,
        bottomEnd: null,
      },

      /* ------------------------------------------------------------------
           Draw
           ------------------------------------------------------------------ */

      drawCallback() {
        updateEmptyState();
        updateHeaderGroups();

        scheduleLayoutRefresh();
      },

      /* ------------------------------------------------------------------
           Initialization
           ------------------------------------------------------------------ */

      initComplete() {
        updateCompanyOnlyMode();
        updateHeaderGroups();

        scheduleLayoutRefresh();
      },
    });

    /*
     * Do NOT call syncVisibleColumns() here.
     *
     * Initial visibility has already been supplied through createColumns().
     */
  }

  /* ========================================================================
     DataTable Destruction
     ======================================================================== */

  function destroyInstance() {
    if (!api) {
      return;
    }

    api.destroy();

    api = null;
  }

  function recreateInstance() {
    destroyInstance();
    createInstance();
  }

  /* ========================================================================
     Rows
     ======================================================================== */

  function setRows(nextRows = []) {
    if (destroyed || !api) {
      return;
    }

    rows = Array.isArray(nextRows) ? nextRows : [];

    renderState = null;

    table.setAttribute("aria-busy", "false");

    api.clear();

    if (rows.length) {
      api.rows.add(rows);
    }

    api.draw(false);

    scheduleLayoutRefresh();
  }

  /* ========================================================================
     Loading State
     ======================================================================== */

  function showLoading() {
    if (destroyed || !api) {
      return;
    }

    renderState = {
      type: STATES.loading,
      message: "",
    };

    table.setAttribute("aria-busy", "true");

    api.clear();

    api.rows.add(createLoadingRows());

    api.draw(false);

    scheduleLayoutRefresh();
  }

  /* ========================================================================
     Empty State
     ======================================================================== */

  function showEmpty(message) {
    if (destroyed || !api) {
      return;
    }

    rows = [];

    renderState = {
      type: STATES.empty,

      message: message || config.labels?.noData || "No data available",
    };

    table.setAttribute("aria-busy", "false");

    api.clear();
    api.draw(false);

    scheduleLayoutRefresh();
  }

  /* ========================================================================
     Error State
     ======================================================================== */

  function showError(message) {
    if (destroyed || !api) {
      return;
    }

    rows = [];

    renderState = {
      type: STATES.error,

      message:
        message ||
        config.labels?.loadError ||
        config.labels?.noData ||
        "Unable to load market data.",
    };

    table.setAttribute("aria-busy", "false");

    api.clear();
    api.draw(false);

    scheduleLayoutRefresh();
  }

  /* ========================================================================
     Visible Groups
     ======================================================================== */

  function setVisibleGroups(nextGroups = []) {
    if (destroyed) {
      return;
    }

    const groups = unique(nextGroups);

    if (arraysEqual(groups, visibleGroups)) {
      return;
    }

    visibleGroups = groups;

    syncVisibleColumns();
  }

  /* ========================================================================
     Table View
     ======================================================================== */

  function setView(nextView) {
    if (destroyed) {
      return;
    }

    const view = String(nextView || "1");

    if (view === currentView) {
      return;
    }

    currentView = view;

    /*
     * A different table view means a different DataTables column model.
     *
     * Recreate exactly once.
     *
     * createInstance() already receives:
     *
     * - current real rows
     * - current loading state
     * - current empty state
     * - current error state
     *
     * Do not immediately call setRows()/showLoading() again.
     */

    recreateInstance();
  }

  /* ========================================================================
     Favorite
     ======================================================================== */

  function handleFavoriteClick(event) {
    const button = event.target.closest(SELECTORS.favorite);

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

  /* ========================================================================
     Logo Fallback
     ======================================================================== */

  function handleLogoError(event) {
    const image = event.target;

    if (
      !(image instanceof HTMLImageElement) ||
      !image.matches(SELECTORS.logo)
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

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    shell.removeEventListener("click", handleFavoriteClick);

    shell.removeEventListener("error", handleLogoError, true);

    if (layoutFrame !== null) {
      window.cancelAnimationFrame(layoutFrame);

      layoutFrame = null;
    }

    destroyInstance();
  }

  /* ========================================================================
     Event Registration
     ======================================================================== */

  shell.addEventListener("click", handleFavoriteClick);

  shell.addEventListener("error", handleLogoError, true);

  /* ========================================================================
     Initialization
     ======================================================================== */

  createInstance();

  /* ========================================================================
     Public API
     ======================================================================== */

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
