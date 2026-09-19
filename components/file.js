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
 * - surface server-side loading, data, and error lifecycle through
 *   DataTables' own ajax events, for tables where DataTables itself owns
 *   the request rather than a page-level data source
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

/*
 * Returns every visibility group declared by a schema.
 *
 * When a caller omits `visibleGroups`, the schema itself is the default
 * source of truth and all of its declared groups are visible.
 *
 * An explicitly supplied [] still means "hide all grouped columns", which is
 * important for views that genuinely use a column-visibility controller.
 */
function getSchemaVisibilityGroups(columns = []) {
  return unique(columns.map((column) => column?.visibilityGroup || ""));
}

/* ==========================================================================
   Cell Rendering
   ========================================================================== */

/*
 * Shared rendering priority used by both:
 *
 * - real DataTables column render() callbacks
 * - manually-rendered server-side loading rows
 *
 * Keeping one function means a page's renderCell() sees identical row shapes
 * (including the __dataViewState loading marker) whether the placeholder
 * rows came from the client-side loading path or the server-side one.
 */

function renderCellValue({ row, column, type, meta, context, renderCell }) {
  if (typeof column.render === "function") {
    return column.render({
      row,
      column,
      type,
      meta,
      context,
    });
  }

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
}

/* ==========================================================================
   Column Group Widths
   ========================================================================== */

/*
 * Produces one <col> per column, carrying the schema's declared width when
 * present.
 *
 * table-layout: fixed only reads widths from a table's first row (or a
 * <colgroup>). Grouped headers put most per-column widths on the second
 * header row, which fixed layout would otherwise ignore. A <colgroup> is
 * the one width source every browser applies consistently regardless of
 * header row structure, so it remains the authoritative width source even
 * as real row content replaces loading placeholders.
 */

function buildColGroup(columns) {
  const colgroup = document.createElement("colgroup");

  columns.forEach((column) => {
    const col = document.createElement("col");

    if (column.width) {
      col.style.width = column.width;
    }

    colgroup.append(col);
  });

  return colgroup;
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

function replaceTableStructure(table, thead, colgroup) {
  const caption = table.caption;

  const tbody = document.createElement("tbody");

  table.replaceChildren(...[caption, colgroup, thead, tbody].filter(Boolean));
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
  const colgroup = buildColGroup(columns);

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

    replaceTableStructure(table, thead, colgroup);

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

  replaceTableStructure(table, thead, colgroup);
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
      /*
       * Preserve the schema's DataTables data mapping.
       *
       * Besides normal client-side access, this is important in server-side
       * mode because DataTables serializes it into columns[i][data]. A schema
       * without an explicit mapping intentionally falls back to `data: null`,
       * which gives renderers the complete row object.
       */
      data: column.data ?? null,

      name: column.name ?? column.key ?? "",

      className: column.className || "",

      orderable: column.orderable !== false,

      searchable: column.searchable !== false,

      visible: isColumnVisible(column, visibleGroups),

      render(_data, type, row, meta) {
        /*
         * Render from the complete row rather than `_data`. Page renderers
         * often need sibling properties such as URLs, identifiers, flags, or
         * other supporting metadata in addition to the column's mapped value.
         */
        return renderCellValue({
          row,
          column,
          type,
          meta,
          context,
          renderCell,
        });
      },
    };

    if (column.width) {
      definition.width = column.width;
    }

    /*
     * Do not introduce a generic fallback such as "-". Empty/default display
     * belongs to the schema or formatter because text, numeric, link, loading,
     * and state cells can require different treatment.
     */
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
   Server-Side Ajax
   ========================================================================== */

/*
 * Wraps caller-supplied server-side Ajax so the generic data-view layer can:
 *
 * - enter loading state before the request begins;
 * - expose object-response rows through onServerSideData;
 * - preserve the caller's own Ajax implementation and response contract.
 *
 * Function-form Ajax is important here.
 *
 * DataTables can invoke the first Ajax request synchronously while its
 * constructor is still running. In that case an event listener attached only
 * after construction can miss the initial processing=true event.
 *
 * Wrapping the Ajax function itself gives the data-view lifecycle a reliable
 * request-start hook for:
 *
 * - initial load;
 * - pagination;
 * - reload;
 * - schema recreation.
 */

function extractRowsFromResponse(response, dataSrc) {
  if (typeof dataSrc === "function") {
    return dataSrc(response);
  }

  const key = typeof dataSrc === "string" ? dataSrc : "data";

  const rows = response?.[key];

  return Array.isArray(rows) ? rows : [];
}

function createServerSideAjax(
  userAjax,
  { onRequestStart, onServerSideData, getContext },
) {
  function notifyRequestStart() {
    onRequestStart?.(getContext());
  }

  /* ------------------------------------------------------------------------
     Function-form Ajax
     ------------------------------------------------------------------------ */

  if (typeof userAjax === "function") {
    return function dataViewServerSideAjax(request, callback, settings) {
      notifyRequestStart();

      return userAjax.call(this, request, callback, settings);
    };
  }

  /* ------------------------------------------------------------------------
     Non-object Ajax
     ------------------------------------------------------------------------ */

  /*
   * A plain URL remains untouched.
   *
   * processing.dt continues to provide the lifecycle fallback for that form.
   */
  if (!isObject(userAjax)) {
    return userAjax;
  }

  /* ------------------------------------------------------------------------
     Object-form Ajax
     ------------------------------------------------------------------------ */

  const userDataSrc = userAjax.dataSrc;

  const userBeforeSend = userAjax.beforeSend;

  return {
    ...userAjax,

    beforeSend(xhr, settings) {
      notifyRequestStart();

      return userBeforeSend?.call(this, xhr, settings);
    },

    dataSrc(response) {
      const rows = extractRowsFromResponse(response, userDataSrc);

      onServerSideData?.(rows, response, getContext());

      return rows;
    },
  };
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

  const headerMode = options.headerMode === "existing" ? "existing" : "schema";

  let api = null;

  let currentView = normalizeView(options.initialView);

  /*
   * Omitted visibleGroups:
   *   all groups declared by the current schema are visible.
   *
   * Explicit visibleGroups (including []):
   *   the caller owns visibility.
   *
   * Remember that distinction so a schema-driven table can resolve the next
   * schema's groups automatically when its view changes.
   */
  let usesSchemaVisibility = !Array.isArray(options.visibleGroups);

  let visibleGroups = usesSchemaVisibility
    ? getSchemaVisibilityGroups(getCurrentColumnsForView(currentView))
    : unique(options.visibleGroups);

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

  function getCurrentColumnsForView(view) {
    const result = getColumns(view);

    return Array.isArray(result) ? result : [];
  }

  function getCurrentColumns() {
    return getCurrentColumnsForView(currentView);
  }

  function getVisibleCurrentColumns() {
    return getCurrentColumns().filter((column) =>
      isColumnVisible(column, visibleGroups),
    );
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
       * Do not dispatch a synthetic global resize event here.
       *
       * DataTables already owns its column-sizing lifecycle.
       *
       * Repeatedly firing resize after every draw can cause scrollX /
       * FixedColumns layouts to recalculate from an already-adjusted table.
       * This can make fixed-column widths drift after repeated data reloads.
       *
       * A caller that needs page-specific post-layout work can use
       * onLayoutRefresh.
       */

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
     Server-Side Loading Rows
     ======================================================================== */

  /*
   * Server-side DataTables owns the row model — there is no local `data`
   * array to swap loading placeholders into the way the client-side path
   * does in showLoading()/setRows(). Instead, this renders skeleton markup
   * directly into the live <tbody> while a request is in flight.
   *
   * This is safe: DataTables' next draw() (triggered by the same request's
   * response) fully replaces <tbody> content regardless of what was there
   * before, so the skeleton is always cleanly overwritten by real rows.
   *
   * Cells are produced through the exact same renderCellValue() priority
   * used for real rows, so a page's renderCell()/column.render() sees an
   * identical `{ __dataViewState: "loading" }` row shape whether the
   * placeholder came from this path or the client-side one.
   */

  function renderServerSideLoadingRows() {
    const tbody = table.tBodies[0];

    if (!tbody) {
      return;
    }

    const columns = getVisibleCurrentColumns();

    const context = getContext();

    const loadingRows = createLoadingRows(
      options.loadingRowCount || 6,

      context,
    );
    tbody.innerHTML = loadingRows
      .map((row, rowIndex) => {
        const cells = columns
          .map((column) => {
            const value = renderCellValue({
              row,
              column,

              type: "display",

              meta: {
                row: rowIndex,

                col: 0,
              },

              context,

              renderCell,
            });

            const classAttribute = column.className
              ? ` class="${column.className}"`
              : "";

            return `<td${classAttribute}>${value ?? ""}</td>`;
          })
          .join("");

        return `<tr class="table-loading" aria-hidden="true">${cells}</tr>`;
      })
      .join("");
  }

  /* ==========================================================================
     Server-Side Lifecycle
     ========================================================================== */

  /*
   * Binds directly to DataTables' own ajax lifecycle events, since in
   * server-side mode DataTables issues the request itself rather than a
   * page-level data source calling load().
   *
   * This is the server-side counterpart to:
   *
   * - showLoading()
   * - setRows()
   * - showEmpty()
   * - showError()
   *
   * processing.dt works regardless of whether `ajax` is object-shaped or
   * function-shaped.
   */

  function bindServerSideLifecycle() {
    if (!api || !tableOptions.serverSide) {
      return;
    }

    api.on("processing.dt", (_event, _settings, processing) => {
      if (destroyed) {
        return;
      }

      table.setAttribute("aria-busy", String(Boolean(processing)));

      if (processing) {
        renderServerSideLoadingRows();
      }
    });

    api.on("error.dt", (_event, _settings, _techNote, message) => {
      if (destroyed) {
        return;
      }

      table.setAttribute("aria-busy", "false");

      options.onServerSideError?.(message, getContext());
    });
  }

  /* ==========================================================================
     RowGroup
     ========================================================================== */

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

  /* ==========================================================================
     Display Rows
     ========================================================================== */

  function getDisplayRows() {
    if (renderState?.type === STATES.loading) {
      return createLoadingRows(
        options.loadingRowCount || 6,

        getContext(),
      );
    }

    if (
      renderState?.type === STATES.empty ||
      renderState?.type === STATES.error
    ) {
      return [];
    }

    return rows;
  }

  /* ==========================================================================
     DataTable Options
     ========================================================================== */

  function buildDataTableOptions() {
    const columns = getCurrentColumns();

    const context = getContext();

    const generated = {
      ...tableOptions,

      columns: createDataTableColumns({
        columns,

        visibleGroups,

        renderCell,

        context,
      }),

      rowGroup: createRowGroupOptions(),
    };

    /* ------------------------------------------------------------------------
       Row Data Source
       ------------------------------------------------------------------------ */

    /*
     * Server-side mode:
     *
     * DataTables fetches rows itself through `ajax`.
     *
     * A local `data` array must not be supplied together with serverSide:true.
     *
     * Client-side mode:
     *
     * `data` is owned by this module and reflects loading / empty / error /
     * ready state.
     */

    if (tableOptions.serverSide) {
      generated.ajax = createServerSideAjax(tableOptions.ajax, {
        /*
         * Ajax itself is the earliest reliable request-start boundary.
         *
         * This is especially important for the first server-side request,
         * which DataTables may start synchronously during construction before
         * bindServerSideLifecycle() can attach processing.dt.
         */
        onRequestStart() {
          if (destroyed) {
            return;
          }

          table.setAttribute("aria-busy", "true");

          renderServerSideLoadingRows();
        },

        onServerSideData: options.onServerSideData,

        getContext,
      });
    } else {
      generated.data = getDisplayRows();
    }

    /* ------------------------------------------------------------------------
       Draw Callback
       ------------------------------------------------------------------------ */

    const userDrawCallback = tableOptions.drawCallback;

    generated.drawCallback = function drawCallback(settings) {
      /*
       * A completed server-side draw is authoritative: DataTables received
       * the current response and completed the rendering cycle.
       *
       * processing.dt remains the request-start / in-flight signal, while
       * draw guarantees the busy state is cleared even if the first
       * processing event occurred before our lifecycle listener was bound.
       */

      if (tableOptions.serverSide) {
        table.setAttribute("aria-busy", "false");
      }

      updateEmptyState();

      updateHeaderVisibility();

      /*
       * One post-draw layout hook.
       *
       * setRows(), showLoading(), showEmpty(), showError(), redraw(), and
       * visibility changes all ultimately draw the table, so they do not
       * schedule another layout refresh themselves.
       */

      scheduleLayoutRefresh();

      userDrawCallback?.call(this, settings);

      options.onDraw?.(api, getContext());
    };

    /* ------------------------------------------------------------------------
       Init Complete
       ------------------------------------------------------------------------ */

    const userInitComplete = tableOptions.initComplete;

    generated.initComplete = function initComplete(settings, json) {
      updateHeaderVisibility();

      /*
       * Initialization is not guaranteed to produce another draw after the
       * DataTables instance is fully ready, so keep the explicit init
       * refresh.
       */

      scheduleLayoutRefresh();

      userInitComplete?.call(this, settings, json);

      options.onInit?.(api, getContext());
    };

    return generated;
  }

  /* ==========================================================================
     Header
     ========================================================================== */

  function buildHeader() {
    if (headerMode === "existing") {
      return;
    }

    const columns = getCurrentColumns();

    const groups = getCurrentGroups();

    /* ------------------------------------------------------------------------
       Caller-Provided Complex Header
       ------------------------------------------------------------------------ */

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
       * This lets one table use a custom header for only selected views.
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

    /* ------------------------------------------------------------------------
       Standard Schema Header
       ------------------------------------------------------------------------ */

    buildSchemaHeader(table, columns, groups);
  }

  /* ==========================================================================
     Creation
     ========================================================================== */

  function createInstance() {
    if (destroyed) {
      return;
    }

    table.dataset.dataView = currentView;

    buildHeader();

    api = new DataTable(table, buildDataTableOptions());

    bindServerSideLifecycle();
  }

  /* ==========================================================================
     Destruction
     ========================================================================== */

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

  /* ==========================================================================
     Rows
     ========================================================================== */

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
     * Server-side tables fetch their own rows through `ajax`.
     *
     * Calling setRows() on one is usually a sign that the caller meant
     * reload(), but expose the rows through the optional callback for
     * integrations that deliberately observe them.
     */

    if (tableOptions.serverSide) {
      options.onServerSideRows?.(rows, api, getContext());

      return;
    }

    api.clear();

    if (rows.length) {
      api.rows.add(rows);
    }

    /*
     * drawCallback owns the post-draw layout hook.
     */

    api.draw(false);

    options.onRowsChange?.(rows, api, getContext());
  }

  /* ==========================================================================
     Loading
     ========================================================================== */

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

    /*
     * Server-side loading state is driven by DataTables' processing.dt
     * lifecycle because DataTables itself decides when a request begins.
     */

    if (tableOptions.serverSide) {
      return;
    }

    api.clear();

    api.rows.add(
      createLoadingRows(
        options.loadingRowCount || 6,

        getContext(),
      ),
    );

    /*
     * drawCallback owns the post-draw layout hook.
     */

    api.draw(false);
  }

  /* ==========================================================================
     Empty
     ========================================================================== */

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

    /*
     * Server-side DataTables renders its own td.dt-empty marker when the
     * response contains no rows. updateEmptyState() customizes that marker
     * from drawCallback.
     */

    if (tableOptions.serverSide) {
      return;
    }

    api.clear();

    /*
     * drawCallback owns empty-state rendering and layout refresh.
     */

    api.draw(false);
  }

  /* ==========================================================================
     Error
     ========================================================================== */

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

    /*
     * Server-side ajax failures are surfaced through error.dt and/or the
     * page's function-form ajax callback. There is no local DataTables row
     * array to replace in this mode.
     */

    if (tableOptions.serverSide) {
      return;
    }

    api.clear();

    /*
     * drawCallback owns error-state rendering and layout refresh.
     */

    api.draw(false);
  }

  /* ==========================================================================
     Column Visibility
     ========================================================================== */

  function setVisibleGroups(nextGroups = []) {
    if (destroyed) {
      return false;
    }

    const groups = unique(nextGroups);

    /*
     * Once the caller explicitly supplies visibility groups, visibility is
     * caller-owned rather than inferred automatically from the schema.
     */

    usesSchemaVisibility = false;

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

      /*
       * Defer redraw until every visibility change has been applied.
       */

      dataTableColumn.visible(shouldBeVisible, false);

      changed = true;
    });

    updateHeaderVisibility();

    if (changed) {
      /*
       * Visibility changes alter the available table width, so ask DataTables
       * to remeasure before performing one redraw.
       */

      api.columns.adjust();

      api.draw(false);
    }

    options.onVisibilityChange?.(visibleGroups, api, getContext());

    return changed;
  }

  /* ==========================================================================
     View / Schema
     ========================================================================== */

  function setView(nextView, nextVisibleGroups = null) {
    if (destroyed) {
      return false;
    }

    const view = normalizeView(nextView);

    const viewChanged = view !== currentView;

    let nextGroups = visibleGroups;

    let nextUsesSchemaVisibility = usesSchemaVisibility;

    /*
     * An explicit array always wins, including [].
     */

    if (Array.isArray(nextVisibleGroups)) {
      nextGroups = unique(nextVisibleGroups);

      nextUsesSchemaVisibility = false;
    } else if (usesSchemaVisibility) {
      /*
       * No explicit visibility controller owns this table.
       *
       * A new schema therefore begins with all groups declared by that schema
       * visible.
       */

      nextGroups = getSchemaVisibilityGroups(getCurrentColumnsForView(view));
    }

    const groupsChanged = !arraysEqual(nextGroups, visibleGroups);

    if (!viewChanged && !groupsChanged) {
      return false;
    }

    currentView = view;

    visibleGroups = nextGroups;

    usesSchemaVisibility = nextUsesSchemaVisibility;

    /*
     * Different schemas require one clean DataTables recreation.
     */

    recreate();

    options.onViewChange?.(currentView, api, getContext());

    return true;
  }

  /* ==========================================================================
     DataTables Operations
     ========================================================================== */

  function adjust() {
    if (!api) {
      return;
    }

    /*
     * adjust() does not necessarily trigger a draw, so preserve the explicit
     * post-layout callback here.
     */

    api.columns.adjust();

    scheduleLayoutRefresh();
  }

  function redraw(resetPaging = false) {
    if (!api) {
      return;
    }

    /*
     * drawCallback owns the post-draw layout hook.
     */

    api.draw(Boolean(resetPaging));
  }

  function reload() {
    if (!api || !api.ajax) {
      return;
    }

    /*
     * Primary refresh path for an already-created server-side table.
     *
     * Keep the current page here. A page that needs to reset paging because
     * filters changed can explicitly recreate the table or use the DataTables
     * API to move to page zero before reloading.
     */

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

  /* ==========================================================================
     Queries
     ========================================================================== */

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

      /*
       * For server-side integrations, request/loading state is primarily
       * represented by DataTables' own lifecycle and aria-busy. renderState
       * remains useful for the client-side table path.
       */

      renderState: renderState
        ? {
            ...renderState,
          }
        : null,

      initialized: Boolean(api),
    });
  }

  /* ==========================================================================
     Lifecycle
     ========================================================================== */

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

  /* ==========================================================================
     Initialization
     ========================================================================== */

  if (options.autoInit !== false) {
    createInstance();
  }

  /* ==========================================================================
     Public Instance
     ========================================================================== */

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

/* ==========================================================================
   Historical Reports Columns
   ========================================================================== */

/*
 * Column and visibility definitions for Historical Reports.
 *
 * Responsibilities:
 *
 * - define column order for Performance, Unadjusted, and Underlying tables
 * - define per-market/sector visible-column sets, matching legacy exactly
 * - define market/sector-dependent header label overrides
 * - define backend-field mappings
 * - define rendering-type metadata
 * - expose column lookup helpers
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - DataTables lifecycle
 * - request logic
 * - response normalization
 * - cell rendering
 * - card markup
 *
 * Legacy reference: historical.columns.js + historical.table.profiles.js
 * (getPerformanceHeaders / getUnadjustedHeaders / resolve*VisibleIndexes).
 *
 * Legacy drove visibility with positional index arrays into a fixed column
 * array (e.g. MF -> [0, 5, 10, 12]). That is fragile: reordering or adding a
 * column silently breaks every market's array. This module instead assigns
 * each column a stable, named `visibilityGroup` key and resolves visibility
 * by name, matching the pattern already established in
 * market-watch.columns.js. The mapping below was verified column-for-column
 * against legacy's index arrays for every market/sector/entity branch before
 * being written.
 */

/* ==========================================================================
   Special Indices
   ========================================================================== */

/*
 * Exported so historical.rules.js can import this rather than redefining
 * its own copy, as legacy did (the same list was duplicated verbatim in
 * both historical.rules.js and historical.columns.js).
 */

export const HISTORICAL_SPECIAL_INDICES = Object.freeze([
  "TLCIC",
  "TMCIC",
  "TSCIC",
  "TIPOC",
  "TT50CI",
]);

const SPECIAL_INDICES_SET = new Set(HISTORICAL_SPECIAL_INDICES);

/* ==========================================================================
   Column Order
   ========================================================================== */

/*
 * Fixed base order. Visibility only turns columns on/off by name; it never
 * reorders them, matching legacy's behavior exactly (applyVisibility() only
 * ever toggled a `visible` flag on a fixed-order array).
 */

export const HISTORICAL_PERFORMANCE_COLUMN_ORDER = Object.freeze([
  "date",
  "open",
  "high",
  "low",
  "close",
  "change",
  "changePercent",
  "volumeTraded",
  "turnOver",
  "noOfTrades",
  "nav",
  "lastYield",
  "aum",
]);

export const HISTORICAL_UNADJUSTED_COLUMN_ORDER = Object.freeze([
  "date",
  "open",
  "high",
  "low",
  "close",
  "change",
  "changePercent",
  "volumeTraded",
  "turnOver",
  "noOfTrades",
]);

/* ==========================================================================
   Helpers
   ========================================================================== */

function getLabels(config = {}) {
  return config?.labels?.table ?? {};
}

function column(definition = {}) {
  return {
    /*
     * Historical report payloads are profile-dependent.
     *
     * The complete DataTables schema intentionally contains columns that may
     * be hidden for the active market/profile, and the backend does not always
     * include those properties in every row. DataTables can still resolve a
     * mapped field for a hidden column, so provide an empty defaultContent to
     * prevent legitimate sparse payloads from producing unknown-parameter
     * warnings.
     *
     * This is not the user-facing empty-value presentation.
     * historical.formatters.js continues to own the visible "-" fallback.
     */
    defaultContent: "",

    mobile: true,

    ...definition,
  };
}

/* ==========================================================================
   Header Label Overrides
   ========================================================================== */

/*
 * Performance headers are market/sector-dependent in legacy
 * (getPerformanceHeaders(filters)). Unadjusted headers are always static
 * (getUnadjustedHeaders() takes no filters at all) -- that asymmetry is
 * intentional and preserved below.
 */

function resolveDateLabel(labels, filters) {
  if (filters.market === "MF") {
    return labels.mfDate || labels.date || "Date";
  }

  return labels.date || "Date";
}

function resolveChangeLabel(labels, filters) {
  if (filters.market === "DERIVATIVE") {
    return labels.changePoints || "Change Points";
  }

  return labels.change || "Change";
}

function resolveVolumeTradedLabel(labels, filters) {
  if (filters.market === "SUKUK") {
    return labels.nominalValueTraded || "Nominal Value Traded";
  }

  return labels.volumeTraded || "Volume Traded";
}

function resolveNoOfTradesLabel(labels, filters) {
  if (filters.market === "DERIVATIVE") {
    /*
     * Preserved exactly from legacy (historical.table.profiles.js,
     * getPerformanceHeaders): for Derivatives this column's header reads
     * "Daily Settlement Price" while the data binding underneath remains
     * `noOfTrades`. The same backend field carries a different real-world
     * meaning depending on market context in the legacy API. This looks
     * unusual on its face -- confirm it's intentional rather than a
     * historical mislabeling before relying on it further.
     */
    return labels.dailySettPrice || "Daily Settlement Price";
  }

  return labels.noOfTrades || "No. of Trades";
}

function resolveNavLabel(labels, filters) {
  if (filters.market === "MF") {
    return labels.mfNav || "NAV";
  }

  if (
    filters.market === "DERIVATIVE" &&
    (filters.sector === "S" || filters.sector === "I")
  ) {
    return labels.openInterest || "Open Interest";
  }

  return labels.nav || "NAV";
}

function resolveAumLabel(labels, filters) {
  if (filters.market === "MF") {
    /*
     * Preserved exactly from legacy: for MF, the AUM column's header
     * fallback reuses the generic "nav" message key/text
     * (getMessage("table.header.nav", "AUM")), not a dedicated AUM key.
     * This reads as a legacy content bug rather than an intentional
     * business rule -- flagging rather than silently changing it, since
     * the instruction is to match legacy 100%.
     */
    return labels.nav || "AUM";
  }

  return labels.aum || "AUM";
}

/* ==========================================================================
   Performance Columns
   ========================================================================== */

/*
 * Legacy base columns (basePerformanceColumns()) render every field as a
 * plain, unformatted pass-through with a "-" fallback for empty values --
 * no client-side number formatting is applied anywhere in the base
 * Performance/Unadjusted columns. Only Change and Change % receive special
 * treatment (renderDirectionalNumber: an up/down icon plus a semantic
 * class). "type: 'text'" below reflects that pass-through behavior
 * precisely; it does not mean "format as text", it means "render exactly
 * what the backend sent, with an empty-value fallback".
 */

export function getHistoricalPerformanceColumns(config = {}, filters = {}) {
  const labels = getLabels(config);

  return [
    column({
      key: "date",
      visibilityGroup: "date",
      label: resolveDateLabel(labels, filters),
      data: "transactionDateStr",
      type: "text",
      className: "",
    }),

    column({
      key: "open",
      visibilityGroup: "open",
      label: labels.open || "Open",
      data: "todaysOpen",
      type: "text",
      className: "text-center",
    }),

    column({
      key: "high",
      visibilityGroup: "high",
      label: labels.high || "High",
      data: "highPrice",
      type: "text",
      className: "text-center",
    }),

    column({
      key: "low",
      visibilityGroup: "low",
      label: labels.low || "Low",
      data: "lowPrice",
      type: "text",
      className: "text-center",
    }),

    column({
      key: "close",
      visibilityGroup: "close",
      label: labels.close || "Close",
      data: "previousClosePrice",
      type: "text",
      className: "text-center",
    }),

    column({
      key: "change",
      visibilityGroup: "change",
      label: resolveChangeLabel(labels, filters),
      data: "change",
      type: "directional-number",
      className: "text-center",
    }),

    column({
      key: "change-percent",
      visibilityGroup: "changePercent",
      label: labels.changePercent || "% Change",
      data: "changePercent",
      type: "directional-number",
      className: "text-center",
    }),

    column({
      key: "volume-traded",
      visibilityGroup: "volumeTraded",
      label: resolveVolumeTradedLabel(labels, filters),
      data: "volumeTraded",
      type: "text",
      className: "text-center",
    }),

    column({
      key: "turn-over",
      visibilityGroup: "turnOver",
      label: labels.turnOver || "Turnover",
      data: "turnOver",
      type: "text",
      className: "text-center",
    }),

    column({
      key: "number-of-trades",
      visibilityGroup: "noOfTrades",
      label: resolveNoOfTradesLabel(labels, filters),
      data: "noOfTrades",
      type: "text",
      className: "text-center",
    }),

    column({
      key: "nav",
      visibilityGroup: "nav",
      label: resolveNavLabel(labels, filters),
      data: "nav",
      type: "text",
      className: "text-center",
    }),

    column({
      key: "last-yield",
      visibilityGroup: "lastYield",
      label: labels.closeYield || "Last Yield",
      data: "lastYield",
      type: "text",
      className: "text-center",
    }),

    column({
      key: "aum",
      visibilityGroup: "aum",
      label: resolveAumLabel(labels, filters),
      data: "aum",
      type: "text",
      className: "text-center",
    }),
  ];
}

/* ==========================================================================
   Performance Visible Groups
   ========================================================================== */

/*
 * Verified against legacy's resolvePerformanceVisibleIndexes(filters) for
 * every branch (MF, ETFS, SUKUK, INDICES non-special, INDICES special,
 * INDICES index-type "I", DERIVATIVE base, DERIVATIVE sector S/I,
 * DERIVATIVE sector OS, and the MAIN/NOMUC/REITS/CEFS/TR/default branch)
 * before being written here. Set membership matches exactly in every case;
 * only the representation changed, from position to name.
 */

export function getHistoricalPerformanceAvailableGroups(filters = {}) {
  const market = filters.market;
  const sector = filters.sector;
  const entity = filters.entity || "";

  switch (market) {
    case "MF":
      return ["date", "change", "nav", "aum"];

    case "ETFS":
      return [
        "date",
        "open",
        "high",
        "low",
        "close",
        "change",
        "changePercent",
        "volumeTraded",
        "turnOver",
        "noOfTrades",
        "nav",
      ];

    case "SUKUK":
      return [
        "date",
        "open",
        "high",
        "low",
        "close",
        "change",
        "changePercent",
        "volumeTraded",
        "turnOver",
        "noOfTrades",
        "lastYield",
      ];

    case "INDICES": {
      const entityParts = entity.split(":");
      const indexCode = entityParts[1] || "";
      const indexType = entityParts[2] || "";

      if (indexType === "I") {
        return [];
      }

      if (SPECIAL_INDICES_SET.has(indexCode)) {
        return [
          "date",
          "open",
          "high",
          "low",
          "close",
          "turnOver",
          "noOfTrades",
        ];
      }

      return [
        "date",
        "open",
        "high",
        "low",
        "close",
        "volumeTraded",
        "turnOver",
        "noOfTrades",
      ];
    }

    case "DERIVATIVE": {
      const groups = [
        "date",
        "open",
        "high",
        "low",
        "close",
        "change",
        "changePercent",
        "volumeTraded",
        "noOfTrades",
      ];

      if (sector === "S" || sector === "I") {
        groups.push("turnOver", "nav");
      }

      return groups;
    }

    case "MAIN":
    case "NOMUC":
    case "REITS":
    case "CEFS":
    case "TR":
    default:
      return [
        "date",
        "open",
        "high",
        "low",
        "close",
        "change",
        "changePercent",
        "volumeTraded",
        "turnOver",
        "noOfTrades",
      ];
  }
}
