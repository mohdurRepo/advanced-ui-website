/* ==========================================================================
   Market Watch DataTable
   ========================================================================== */

/*
 * Owns one desktop DataTable instance.
 *
 * Responsibilities:
 * - view-specific header construction
 * - DataTables setup
 * - grouped rows
 * - column visibility
 * - skeleton, empty, and error states
 * - FixedColumns / FixedHeader re-layout
 */

const SKELETON_ROW_COUNT = 5;

function getTable(root) {
  const table = root?.matches?.("[data-market-watch-table]")
    ? root
    : root?.querySelector?.("[data-market-watch-table]");

  if (!(table instanceof HTMLTableElement)) {
    throw new Error("Market Watch table was not found.");
  }

  return table;
}

function getDataTableConstructor() {
  if (typeof window.DataTable !== "function") {
    throw new Error("Market Watch requires DataTables.");
  }

  return window.DataTable;
}

function createHeaderCell({
  label,
  scope,
  rowSpan = 1,
  colSpan = 1,
  className = "",
  attributes = {},
}) {
  const cell = document.createElement("th");

  cell.scope = scope;
  cell.textContent = label;
  cell.rowSpan = rowSpan;
  cell.colSpan = colSpan;

  if (className) {
    cell.className = className;
  }

  Object.entries(attributes).forEach(([name, value]) => {
    cell.setAttribute(name, value);
  });

  return cell;
}

function createGroupRow(group, columnCount) {
  const row = document.createElement("tr");
  const label = document.createElement("th");
  const fill = document.createElement("td");

  row.className = "table-group-row table-market__group-row";

  label.className = "table-group-label table-market__group-label";
  label.scope = "rowgroup";
  label.textContent = group;

  fill.className = "table-group-fill table-market__group-fill";
  fill.colSpan = Math.max(1, columnCount - 1);
  fill.setAttribute("aria-hidden", "true");

  row.append(label, fill);

  return row;
}

function createTableHeader(table, schema, viewId) {
  const columns = schema.getColumns(viewId);
  const groupedColumns = schema.getHeaderGroups(viewId);
  const hasGroups = groupedColumns.length > 0;

  const thead = document.createElement("thead");
  const topRow = document.createElement("tr");
  const leafRow = document.createElement("tr");

  let index = 0;

  while (index < columns.length) {
    const column = columns[index];

    if (!column.headerGroup) {
      topRow.append(
        createHeaderCell({
          label: column.label,
          scope: "col",
          rowSpan: hasGroups ? 2 : 1,
          className: column.pinned
            ? "table-market__security"
            : "table-market__number",
          attributes: {
            "data-market-watch-column": column.key,
          },
        }),
      );

      index += 1;

      continue;
    }

    const group = groupedColumns.find((item) => item.id === column.headerGroup);

    topRow.append(
      createHeaderCell({
        label: group.label,
        scope: "colgroup",
        colSpan: group.columns.length,
        className: "table-market__group-heading",
        attributes: {
          "data-market-watch-header-group": group.id,
        },
      }),
    );

    group.columns.forEach((groupColumn) => {
      leafRow.append(
        createHeaderCell({
          label: groupColumn.label,
          scope: "col",
          className: "table-market__number",
          attributes: {
            "data-market-watch-column": groupColumn.key,
            "data-market-watch-column-group": groupColumn.visibilityGroup || "",
          },
        }),
      );
    });

    index += group.columns.length;
  }

  thead.append(topRow);

  if (hasGroups) {
    thead.append(leafRow);
  }

  table.tHead?.remove();
  table.prepend(thead);
}

function createSkeletonMarkup(index) {
  const size = ["table-skeleton-lg", "table-skeleton-md", "table-skeleton-sm"][
    index % 3
  ];

  return `<span class="table-skeleton ${size}" aria-hidden="true"></span>`;
}

function createLoadingRows() {
  return Array.from(
    {
      length: SKELETON_ROW_COUNT,
    },
    (_, index) => ({
      __marketWatchState: "loading",
      __marketWatchLoadingIndex: index,
    }),
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketWatchTable(root, options = {}) {
  const table = getTable(root);
  const DataTable = getDataTableConstructor();

  const schema = options.schema;
  const formatters = options.formatters;
  const config = options.config || {};

  if (!schema || !formatters) {
    throw new Error("Market Watch table requires schema and formatters.");
  }

  let api = null;
  let activeViewId = null;
  let activeRows = [];
  let emptyMessage = config.labels?.noData || "No data available.";
  let tableState = "empty";

  function getColumns() {
    return schema.getColumns(activeViewId);
  }

  function isLoadingRow(row) {
    return row?.__marketWatchState === "loading";
  }

  function getSortValue(column, row) {
    if (column.format === "security") {
      return row.acrynomName || row.company || row.companySymbol || "";
    }

    if (column.format === "range") {
      return formatters.toNumber(row.lastTradePriceModified) ?? -Infinity;
    }

    if (column.format === "change") {
      return formatters.toNumber(row[column.changeField]) ?? 0;
    }

    return formatters.toNumber(row[column.data]) ?? row[column.data] ?? "";
  }

  function getDataTableColumns() {
    return getColumns().map((column, index) => ({
      data: column.data,
      name: column.key,
      orderable: false,

      /*
       * DataTables uses this width while calculating scroll and FixedColumns.
       * Market SCSS supplies the accompanying min/max width contract.
       */
      width: column.width || undefined,

      className: column.pinned
        ? "table-market__security"
        : "table-market__number",

      render(data, type, row) {
        if (isLoadingRow(row)) {
          return type === "display"
            ? createSkeletonMarkup(row.__marketWatchLoadingIndex + index)
            : "";
        }

        if (type === "display" || type === "filter") {
          return formatters.renderCell(column, row);
        }

        return getSortValue(column, row);
      },
    }));
  }

  function applyEmptyState() {
    if (tableState === "loading" || api?.rows().count()) {
      return;
    }

    const emptyCell = table.tBodies[0]?.querySelector("td.dt-empty");

    if (!emptyCell) {
      return;
    }

    const row = emptyCell.closest("tr");

    row?.classList.add("table-empty");
    emptyCell.textContent = emptyMessage;
  }

  function syncGroupHeaders() {
    if (!api) {
      return;
    }

    const columns = getColumns();

    table
      .querySelectorAll("[data-market-watch-header-group]")
      .forEach((header) => {
        const groupId = header.dataset.marketWatchHeaderGroup;

        const visibleCount = columns.filter((column, index) => {
          return column.headerGroup === groupId && api.column(index).visible();
        }).length;

        header.hidden = visibleCount === 0;
        header.colSpan = Math.max(1, visibleCount);
      });
  }

  function refreshDataTableExtensions() {
    if (!api) {
      return;
    }

    api.columns.adjust();

    const fixedColumns = api.fixedColumns?.();

    fixedColumns?.relayout?.();

    api.fixedHeader?.adjust?.();

    /*
     * The generic DataTables layout module responds to resize by refreshing
     * its site-header offset and the reusable table scroll navigation.
     */

    window.dispatchEvent(new Event("resize"));
  }

  function scheduleLayoutRefresh() {
    window.requestAnimationFrame(() => {
      refreshDataTableExtensions();

      /*
       * FixedColumns measures after the browser has applied newly visible
       * cells. A second frame avoids stale Company-column measurements after
       * Select All / Clear All transitions.
       */

      window.requestAnimationFrame(refreshDataTableExtensions);
    });
  }

  function createDataTable(viewId) {
    const columns = schema.getColumns(viewId);

    createTableHeader(table, schema, viewId);

    api = new DataTable(table, {
      data: activeRows,
      columns: getDataTableColumns(),

      autoWidth: false,
      deferRender: true,

      scrollX: true,
      scrollCollapse: true,

      /*
       * Market Watch is a continuous market board. It has no client sorting,
       * paging, information counter, search field, or length selector.
       */

      paging: false,
      searching: false,
      ordering: false,
      info: false,
      lengthChange: false,

      processing: false,

      fixedHeader: {
        header: true,
      },

      fixedColumns: {
        start: 1,
      },

      rowGroup: {
        dataSrc: schema.rowGroupField,

        startRender(rows, group) {
          const rowData = rows.data().toArray();

          if (rowData.some(isLoadingRow)) {
            return null;
          }

          return createGroupRow(group, columns.length);
        },
      },

      language: {
        emptyTable: emptyMessage,
        zeroRecords: emptyMessage,
      },

      layout: {
        topStart: null,
        topEnd: null,
        bottomStart: null,
        bottomEnd: null,
      },

      createdRow(rowElement, rowData) {
        if (isLoadingRow(rowData)) {
          rowElement.classList.add("table-loading");

          return;
        }

        const security =
          rowData.companyRef ||
          rowData.companyCode ||
          rowData.companySymbol ||
          rowData.symbol;

        if (security) {
          rowElement.dataset.marketWatchSecurity = security;
        }
      },

      drawCallback() {
        syncGroupHeaders();
        applyEmptyState();
        scheduleLayoutRefresh();
      },
    });

    activeViewId = String(viewId);
    syncGroupHeaders();
    scheduleLayoutRefresh();
  }

  function destroyDataTable() {
    if (!api) {
      return;
    }

    api.destroy();
    api = null;

    table.tBodies[0]?.replaceChildren();
  }

  function setView(viewId) {
    const nextViewId = schema.getView(viewId).id;

    if (api && nextViewId === activeViewId) {
      return;
    }

    destroyDataTable();

    activeViewId = nextViewId;
    createDataTable(nextViewId);
  }

  function setRows(rows = []) {
    activeRows = Array.isArray(rows) ? rows : [];
    tableState = activeRows.length ? "ready" : "empty";
    emptyMessage = config.labels?.noData || "No data available.";

    if (!api) {
      return;
    }

    api.clear();
    api.rows.add(activeRows);
    api.draw();

    scheduleLayoutRefresh();
  }

  function showLoading() {
    tableState = "loading";
    activeRows = createLoadingRows();

    if (!api) {
      return;
    }

    api.clear();
    api.rows.add(activeRows);
    api.draw();

    scheduleLayoutRefresh();
  }

  function showEmpty(message) {
    tableState = "empty";
    activeRows = [];
    emptyMessage = message || config.labels?.noData || "No data available.";

    if (!api) {
      return;
    }

    api.clear();
    api.draw();

    scheduleLayoutRefresh();
  }

  function setVisibleGroups(visibleGroups = []) {
    if (!api) {
      return;
    }

    const selectedGroups = new Set(visibleGroups);

    getColumns().forEach((column, index) => {
      if (!column.visibilityGroup) {
        return;
      }

      api
        .column(index)
        .visible(selectedGroups.has(column.visibilityGroup), false);
    });

    syncGroupHeaders();
    api.columns.adjust().draw(false);

    scheduleLayoutRefresh();
  }

  function getApi() {
    return api;
  }

  function getViewId() {
    return activeViewId;
  }

  function destroy() {
    destroyDataTable();
  }

  activeViewId = schema.getView(
    options.initialViewId || schema.defaultViewId,
  ).id;

  createDataTable(activeViewId);

  return Object.freeze({
    setView,
    setRows,
    setVisibleGroups,

    showLoading,
    showEmpty,

    getApi,
    getViewId,

    destroy,
  });
}
