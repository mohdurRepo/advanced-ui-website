/* ==========================================================================
   Data Table
   ========================================================================== */

/*
 * Generic DataTables lifecycle for reusable data-view modules.
 *
 * Responsibilities:
 *
 * - create / destroy DataTables instances
 * - support different column schemas / views
 * - render schema-driven headers
 * - support grouped headers
 * - manage row data
 * - manage loading / empty / error states
 * - manage column-group visibility
 * - expose configurable DataTables capabilities
 * - coordinate layout refreshes
 *
 * Supported capabilities include:
 *
 * - paging
 * - searching
 * - ordering
 * - info
 * - length selector
 * - horizontal scrolling
 * - FixedHeader
 * - FixedColumns
 * - RowGroup
 * - server-side configuration
 *
 * This module intentionally has no:
 *
 * - AJAX code
 * - filter UI code
 * - mobile card rendering
 * - page-specific business logic
 * - responsive breakpoint logic
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const STATES = Object.freeze({
  loading: "loading",
  empty: "empty",
  error: "error",
});

/* ==========================================================================
   Generic Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unique(values = []) {
  return [
    ...new Set(
      values.filter((value) => typeof value === "string" && value.trim()),
    ),
  ];
}

function arraysEqual(first = [], second = []) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function normalizeView(value) {
  return String(value ?? "default");
}

function getDataTableConstructor() {
  if (typeof window.DataTable !== "function") {
    throw new Error("Data table requires DataTables.");
  }

  return window.DataTable;
}

/* ==========================================================================
   Table Resolution
   ========================================================================== */

function resolveTable(root, table) {
  if (table instanceof HTMLTableElement) {
    return table;
  }

  if (typeof table === "string") {
    return root.querySelector(table);
  }

  return null;
}

/* ==========================================================================
   Column Helpers
   ========================================================================== */

function getColumnData(row, column) {
  if (typeof column.data === "function") {
    return column.data(row);
  }

  if (typeof column.data === "string") {
    return row?.[column.data];
  }

  return row;
}

function getColumnLabel(column) {
  return String(column.label ?? column.title ?? column.key ?? "");
}

function isColumnVisible(column, visibleGroups) {
  if (!column.visibilityGroup) {
    return true;
  }

  return visibleGroups.includes(column.visibilityGroup);
}

/* ==========================================================================
   Header Creation
   ========================================================================== */

function createHeaderCell({
  label,
  className = "",
  scope = "col",
  rowSpan = 0,
  colSpan = 0,
  width = "",
  visibilityGroup = "",
  headerGroup = "",
}) {
  const cell = document.createElement("th");

  cell.scope = scope;

  if (className) {
    cell.className = className;
  }

  if (rowSpan) {
    cell.rowSpan = rowSpan;
  }

  if (colSpan) {
    cell.colSpan = colSpan;
  }

  if (visibilityGroup) {
    cell.dataset.dataColumnGroup = visibilityGroup;
  }

  if (headerGroup) {
    cell.dataset.dataHeaderGroup = headerGroup;
  }

  if (width) {
    cell.style.width = width;

    cell.style.minWidth = width;

    cell.style.maxWidth = width;
  }

  const labelElement = document.createElement("span");

  labelElement.className = "table-column-label";

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

function normalizeGroups(groups = []) {
  return groups
    .map((group) => {
      if (typeof group === "string") {
        return {
          id: group,
          label: group,
        };
      }

      if (isObject(group) && group.id) {
        return {
          ...group,
          id: String(group.id),
        };
      }

      return null;
    })
    .filter(Boolean);
}

function buildSchemaHeader(table, columns, groups) {
  const thead = document.createElement("thead");

  const hasGroupedHeaders = columns.some((column) =>
    Boolean(column.headerGroup),
  );

  /* ------------------------------------------------------------------------
     Single Header Row
     ------------------------------------------------------------------------ */

  if (!hasGroupedHeaders) {
    const row = document.createElement("tr");

    columns.forEach((column) => {
      row.append(
        createHeaderCell({
          label: getColumnLabel(column),

          className: column.headerClassName || column.className || "",

          width: column.width || "",

          visibilityGroup: column.visibilityGroup || "",
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

  const topRow = document.createElement("tr");

  const bottomRow = document.createElement("tr");

  /*
   * Ungrouped columns span both rows.
   */

  columns
    .filter((column) => !column.headerGroup)
    .forEach((column) => {
      topRow.append(
        createHeaderCell({
          label: getColumnLabel(column),

          className: column.headerClassName || column.className || "",

          width: column.width || "",

          visibilityGroup: column.visibilityGroup || "",

          rowSpan: 2,
        }),
      );
    });

  /*
   * Header groups.
   */

  groups.forEach((group) => {
    const groupColumns = columns.filter(
      (column) => column.headerGroup === group.id,
    );

    if (!groupColumns.length) {
      return;
    }

    topRow.append(
      createHeaderCell({
        label: group.label || group.id,

        className: group.className || "table-group-heading",

        scope: "colgroup",

        colSpan: groupColumns.length,

        headerGroup: group.id,
      }),
    );

    groupColumns.forEach((column) => {
      bottomRow.append(
        createHeaderCell({
          label: getColumnLabel(column),

          className: column.headerClassName || column.className || "",

          width: column.width || "",

          visibilityGroup: column.visibilityGroup || "",
        }),
      );
    });
  });

  thead.append(topRow, bottomRow);

  replaceTableStructure(table, thead);
}

/* ==========================================================================
   DataTables Column Builder
   ========================================================================== */

function createDataTableColumns({
  columns,
  visibleGroups,
  renderCell,
  context,
}) {
  return columns.map((column) => {
    const definition = {
      data: null,

      name: column.key || "",

      className: column.className || "",

      orderable: column.orderable !== false,

      searchable: column.searchable !== false,

      visible: isColumnVisible(column, visibleGroups),

      render(_data, type, row, meta) {
        /*
         * Column-level render function has highest priority.
         */

        if (typeof column.render === "function") {
          return column.render({
            row,
            column,
            type,
            meta,
            context,
          });
        }

        /*
         * Page-level common renderer.
         */

        if (typeof renderCell === "function") {
          return renderCell({
            row,
            column,
            type,
            meta,
            context,
          });
        }

        const value = getColumnData(row, column);

        return value ?? "";
      },
    };

    if (column.width) {
      definition.width = column.width;
    }

    if (column.defaultContent !== undefined) {
      definition.defaultContent = column.defaultContent;
    }

    return definition;
  });
}

/* ==========================================================================
   Default Loading Rows
   ========================================================================== */

function createDefaultLoadingRows(count = 6) {
  return Array.from(
    {
      length: count,
    },
    (_, index) => ({
      __dataViewState: STATES.loading,

      __dataViewRow: index,
    }),
  );
}

/* ==========================================================================
   Options
   ========================================================================== */

function createDefaultTableOptions() {
  return {
    autoWidth: false,

    paging: false,
    searching: false,
    ordering: false,
    info: false,
    lengthChange: false,

    serverSide: false,
    processing: false,

    scrollX: true,
    scrollCollapse: true,

    fixedHeader: false,
    fixedColumns: false,

    rowGroup: false,

    deferRender: true,

    layout: {
      topStart: null,
      topEnd: null,
      bottomStart: null,
      bottomEnd: null,
    },
  };
}

function normalizeFixedColumns(value) {
  if (value === false || value === 0 || value == null) {
    return false;
  }

  if (typeof value === "number") {
    return {
      start: value,
    };
  }

  if (isObject(value)) {
    return {
      ...value,
    };
  }

  return false;
}

function normalizeFixedHeader(value) {
  if (value === false || value == null) {
    return false;
  }

  if (value === true) {
    return {
      header: true,
      footer: false,
    };
  }

  if (isObject(value)) {
    return {
      ...value,
    };
  }

  return false;
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createDataTable(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("createDataTable requires an options object.");
  }

  const root = options.root || document;

  const table = resolveTable(root, options.table);

  if (!table) {
    throw new Error("Data table requires a valid table element or selector.");
  }

  const DataTable = getDataTableConstructor();

  if (typeof options.getColumns !== "function") {
    throw new TypeError("Data table requires getColumns().");
  }

  const getColumns = options.getColumns;

  const getGroups =
    typeof options.getColumnGroups === "function"
      ? options.getColumnGroups
      : () => [];

  const renderCell =
    typeof options.renderCell === "function" ? options.renderCell : null;

  const renderHeader =
    typeof options.renderHeader === "function" ? options.renderHeader : null;

  const createLoadingRows =
    typeof options.createLoadingRows === "function"
      ? options.createLoadingRows
      : createDefaultLoadingRows;

  const tableOptions = {
    ...createDefaultTableOptions(),
    ...(options.tableOptions || {}),
  };

  tableOptions.fixedHeader = normalizeFixedHeader(tableOptions.fixedHeader);

  tableOptions.fixedColumns = normalizeFixedColumns(tableOptions.fixedColumns);

  const headerMode =
    options.headerMode === "existing"
      ? "existing"
      : renderHeader
        ? "custom"
        : "schema";

  let api = null;

  let currentView = normalizeView(options.initialView);

  let visibleGroups = unique(options.visibleGroups || []);

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
    const result = getColumns(currentView);

    return Array.isArray(result) ? result : [];
  }

  function getCurrentGroups() {
    return normalizeGroups(getGroups(currentView));
  }

  function getContext() {
    return {
      view: currentView,

      visibleGroups: [...visibleGroups],

      table,
      api,
    };
  }

  /* ========================================================================
     Layout Refresh
     ======================================================================== */

  function scheduleLayoutRefresh() {
    if (destroyed || layoutFrame !== null) {
      return;
    }

    layoutFrame = window.requestAnimationFrame(() => {
      layoutFrame = null;

      if (destroyed || !api) {
        return;
      }

      /*
       * Existing global table-layout behavior remains responsible for
       * FixedHeader, FixedColumns, scroll controls, etc.
       */

      window.dispatchEvent(new Event("resize"));

      options.onLayoutRefresh?.(api, getContext());
    });
  }

  /* ========================================================================
     Header Visibility
     ======================================================================== */

  function updateHeaderVisibility() {
    if (!api || !table.tHead || headerMode !== "schema") {
      return;
    }

    const columns = getCurrentColumns();

    /* ----------------------------------------------------------------------
       Group headings
       ---------------------------------------------------------------------- */

    table.tHead
      .querySelectorAll("[data-data-header-group]")
      .forEach((heading) => {
        const groupId = heading.dataset.dataHeaderGroup;

        const visibleCount = columns.filter(
          (column, index) =>
            column.headerGroup === groupId && api.column(index).visible(),
        ).length;

        heading.hidden = visibleCount === 0;

        if (visibleCount > 0) {
          heading.colSpan = visibleCount;
        }
      });

    /* ----------------------------------------------------------------------
       Ungrouped visibility-group cells
       ---------------------------------------------------------------------- */

    table.tHead.querySelectorAll("[data-data-column-group]").forEach((cell) => {
      const groupId = cell.dataset.dataColumnGroup;

      if (!groupId) {
        return;
      }

      cell.hidden = !visibleGroups.includes(groupId);
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

    emptyCell.classList.add(options.emptyClass || "table-empty");

    emptyCell.textContent =
      renderState?.message ||
      tableOptions.language?.emptyTable ||
      options.emptyMessage ||
      "No data available";
  }

  /* ========================================================================
     RowGroup
     ======================================================================== */

  function createRowGroupOptions() {
    const rowGroup = tableOptions.rowGroup;

    if (!rowGroup) {
      return false;
    }

    if (rowGroup === true) {
      return {};
    }

    if (!isObject(rowGroup)) {
      return false;
    }

    const result = {
      ...rowGroup,
    };

    /*
     * Optional common callbacks.
     */

    if (typeof options.getRowGroup === "function") {
      result.dataSrc = (row) => options.getRowGroup(row, getContext());
    }

    if (typeof options.renderRowGroupStart === "function") {
      result.startRender = (groupRows, groupName, level) =>
        options.renderRowGroupStart({
          groupRows,
          groupName,
          level,

          visibleColumnCount: api?.columns(":visible").count() || 0,

          context: getContext(),
        });
    }

    if (typeof options.renderRowGroupEnd === "function") {
      result.endRender = (groupRows, groupName, level) =>
        options.renderRowGroupEnd({
          groupRows,
          groupName,
          level,

          visibleColumnCount: api?.columns(":visible").count() || 0,

          context: getContext(),
        });
    }

    return result;
  }

  /* ========================================================================
     Display Rows
     ======================================================================== */

  function getDisplayRows() {
    if (renderState?.type === STATES.loading) {
      return createLoadingRows(options.loadingRowCount || 6, getContext());
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
     DataTable Options
     ======================================================================== */

  function buildDataTableOptions() {
    const columns = getCurrentColumns();

    const context = getContext();

    const generated = {
      ...tableOptions,

      data: getDisplayRows(),

      columns: createDataTableColumns({
        columns,
        visibleGroups,
        renderCell,
        context,
      }),

      rowGroup: createRowGroupOptions(),
    };

    /* ----------------------------------------------------------------------
       Draw Callback
       ---------------------------------------------------------------------- */

    const userDrawCallback = tableOptions.drawCallback;

    generated.drawCallback = function drawCallback(settings) {
      updateEmptyState();
      updateHeaderVisibility();

      scheduleLayoutRefresh();

      userDrawCallback?.call(this, settings);

      options.onDraw?.(api, getContext());
    };

    /* ----------------------------------------------------------------------
       Init Complete
       ---------------------------------------------------------------------- */

    const userInitComplete = tableOptions.initComplete;

    generated.initComplete = function initComplete(settings, json) {
      updateHeaderVisibility();

      scheduleLayoutRefresh();

      userInitComplete?.call(this, settings, json);

      options.onInit?.(api, getContext());
    };

    return generated;
  }

  /* ========================================================================
     Header
     ======================================================================== */

  function buildHeader() {
    if (headerMode === "existing") {
      return;
    }

    const columns = getCurrentColumns();

    const groups = getCurrentGroups();

    /* ----------------------------------------------------------------------
       Caller-Provided Complex Header
       ---------------------------------------------------------------------- */

    if (renderHeader) {
      const result = renderHeader({
        table,

        view: currentView,

        columns: [...columns],

        groups: [...groups],

        context: getContext(),
      });

      if (result && typeof result.then === "function") {
        throw new TypeError("Data table renderHeader() must be synchronous.");
      }

      /*
       * Returning false requests the standard schema-generated header.
       *
       * This lets one table use:
       *
       * - the standard header for Negotiated Deals
       * - a custom three-row header for Minimum Size
       */

      if (result !== false) {
        if (!table.tHead || !table.tHead.rows.length) {
          throw new Error(
            "Data table renderHeader() must attach a non-empty thead.",
          );
        }

        return;
      }
    }

    /* ----------------------------------------------------------------------
       Standard Schema Header
       ---------------------------------------------------------------------- */

    buildSchemaHeader(table, columns, groups);
  }

  /* ========================================================================
     Creation
     ======================================================================== */

  function createInstance() {
    if (destroyed) {
      return;
    }

    table.dataset.dataView = currentView;

    buildHeader();

    api = new DataTable(table, buildDataTableOptions());
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  function destroyInstance() {
    if (!api) {
      return;
    }

    options.beforeDestroy?.(api, getContext());

    api.destroy();

    api = null;
  }

  function recreate() {
    if (destroyed) {
      return;
    }

    destroyInstance();
    createInstance();
  }

  /* ========================================================================
     Rows
     ======================================================================== */

  function setRows(nextRows = []) {
    if (destroyed) {
      return;
    }

    rows = Array.isArray(nextRows) ? nextRows : [];

    renderState = null;

    table.setAttribute("aria-busy", "false");

    if (!api) {
      createInstance();

      return;
    }

    /*
     * For externally managed server-side DataTables, callers should use the
     * DataTables ajax API rather than setRows().
     */

    if (tableOptions.serverSide) {
      options.onServerSideRows?.(rows, api, getContext());

      return;
    }

    api.clear();

    if (rows.length) {
      api.rows.add(rows);
    }

    api.draw(false);

    scheduleLayoutRefresh();

    options.onRowsChange?.(rows, api, getContext());
  }

  /* ========================================================================
     Loading
     ======================================================================== */

  function showLoading() {
    if (destroyed) {
      return;
    }

    renderState = {
      type: STATES.loading,

      message: "",
    };

    table.setAttribute("aria-busy", "true");

    if (!api) {
      createInstance();

      return;
    }

    if (tableOptions.serverSide) {
      return;
    }

    api.clear();

    api.rows.add(createLoadingRows(options.loadingRowCount || 6, getContext()));

    api.draw(false);

    scheduleLayoutRefresh();
  }

  /* ========================================================================
     Empty
     ======================================================================== */

  function showEmpty(message) {
    if (destroyed) {
      return;
    }

    rows = [];

    renderState = {
      type: STATES.empty,

      message: message || options.emptyMessage || "No data available",
    };

    table.setAttribute("aria-busy", "false");

    if (!api) {
      createInstance();

      return;
    }

    if (tableOptions.serverSide) {
      return;
    }

    api.clear();
    api.draw(false);

    scheduleLayoutRefresh();
  }

  /* ========================================================================
     Error
     ======================================================================== */

  function showError(message) {
    if (destroyed) {
      return;
    }

    rows = [];

    renderState = {
      type: STATES.error,

      message:
        message ||
        options.errorMessage ||
        options.emptyMessage ||
        "Unable to load data.",
    };

    table.setAttribute("aria-busy", "false");

    if (!api) {
      createInstance();

      return;
    }

    if (tableOptions.serverSide) {
      return;
    }

    api.clear();
    api.draw(false);

    scheduleLayoutRefresh();
  }

  /* ========================================================================
     Column Visibility
     ======================================================================== */

  function setVisibleGroups(nextGroups = []) {
    if (destroyed) {
      return false;
    }

    const groups = unique(nextGroups);

    if (arraysEqual(groups, visibleGroups)) {
      return false;
    }

    visibleGroups = groups;

    if (!api) {
      return true;
    }

    let changed = false;

    getCurrentColumns().forEach((column, index) => {
      if (!column.visibilityGroup) {
        return;
      }

      const shouldBeVisible = isColumnVisible(column, visibleGroups);

      const dataTableColumn = api.column(index);

      if (dataTableColumn.visible() === shouldBeVisible) {
        return;
      }

      dataTableColumn.visible(shouldBeVisible, false);

      changed = true;
    });

    updateHeaderVisibility();

    if (changed) {
      api.columns.adjust();
      api.draw(false);
    }

    scheduleLayoutRefresh();

    options.onVisibilityChange?.(visibleGroups, api, getContext());

    return changed;
  }

  /* ========================================================================
     View / Schema
     ======================================================================== */

  function setView(nextView, nextVisibleGroups = null) {
    if (destroyed) {
      return false;
    }

    const view = normalizeView(nextView);

    const viewChanged = view !== currentView;

    const groupsChanged = Array.isArray(nextVisibleGroups)
      ? !arraysEqual(unique(nextVisibleGroups), visibleGroups)
      : false;

    if (!viewChanged && !groupsChanged) {
      return false;
    }

    currentView = view;

    if (Array.isArray(nextVisibleGroups)) {
      visibleGroups = unique(nextVisibleGroups);
    }

    /*
     * Different schemas require one clean DataTables recreation.
     */

    recreate();

    options.onViewChange?.(currentView, api, getContext());

    return true;
  }

  /* ========================================================================
     DataTables Operations
     ======================================================================== */

  function adjust() {
    if (!api) {
      return;
    }

    api.columns.adjust();

    scheduleLayoutRefresh();
  }

  function redraw(resetPaging = false) {
    if (!api) {
      return;
    }

    api.draw(resetPaging ? true : false);

    scheduleLayoutRefresh();
  }

  function reload() {
    if (!api || !api.ajax) {
      return;
    }

    api.ajax.reload(null, false);
  }

  function search(value) {
    if (!api || typeof api.search !== "function") {
      return;
    }

    api.search(value ?? "").draw();
  }

  function setPageLength(length) {
    if (!api) {
      return;
    }

    const normalized = Number(length);

    if (!Number.isFinite(normalized) || normalized <= 0) {
      return;
    }

    api.page.len(normalized).draw(false);
  }

  /* ========================================================================
     Queries
     ======================================================================== */

  function getRows() {
    return [...rows];
  }

  function getView() {
    return currentView;
  }

  function getVisibleGroups() {
    return [...visibleGroups];
  }

  function getApi() {
    return api;
  }

  function getState() {
    return Object.freeze({
      view: currentView,

      visibleGroups: [...visibleGroups],

      rowCount: rows.length,

      renderState: renderState
        ? {
            ...renderState,
          }
        : null,

      initialized: Boolean(api),
    });
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    if (layoutFrame !== null) {
      window.cancelAnimationFrame(layoutFrame);

      layoutFrame = null;
    }

    destroyInstance();
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  if (options.autoInit !== false) {
    createInstance();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    adjust,
    destroy,

    getApi,
    getRows,
    getState,
    getView,
    getVisibleGroups,

    recreate,
    redraw,
    reload,

    search,
    setPageLength,

    setRows,
    setView,
    setVisibleGroups,

    showEmpty,
    showError,
    showLoading,
  });
}
