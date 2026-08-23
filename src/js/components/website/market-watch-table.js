/* ==========================================================================
   Market Watch DataTable
   ========================================================================== */

/*
 * Owns the single desktop DataTable instance.
 *
 * It does not:
 * - fetch API data
 * - bind filter controls
 * - render mobile cards
 * - manage authentication
 */

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
  colSpan,
  rowSpan,
  className,
  attributes = {},
}) {
  const cell = document.createElement("th");

  cell.scope = scope;
  cell.textContent = label;

  if (colSpan) {
    cell.colSpan = colSpan;
  }

  if (rowSpan) {
    cell.rowSpan = rowSpan;
  }

  if (className) {
    cell.className = className;
  }

  Object.entries(attributes).forEach(([name, value]) => {
    cell.setAttribute(name, value);
  });

  return cell;
}

function createTableHeader(table, schema, viewId) {
  const columns = schema.getColumns(viewId);
  const headerGroups = schema.getHeaderGroups(viewId);
  const hasGroupedColumns = headerGroups.length > 0;

  const thead = document.createElement("thead");
  const topRow = document.createElement("tr");
  const leafRow = document.createElement("tr");

  let columnIndex = 0;

  while (columnIndex < columns.length) {
    const column = columns[columnIndex];

    if (!column.headerGroup) {
      topRow.append(
        createHeaderCell({
          label: column.label,
          scope: "col",
          rowSpan: hasGroupedColumns ? 2 : 1,
          className: column.pinned
            ? "table-market__security"
            : "table-market__number",
          attributes: {
            "data-market-watch-column": column.key,
          },
        }),
      );

      columnIndex += 1;

      continue;
    }

    const group = headerGroups.find((item) => item.id === column.headerGroup);

    const groupColumns = group.columns;

    topRow.append(
      createHeaderCell({
        label: group.label,
        scope: "colgroup",
        colSpan: groupColumns.length,
        className: "table-market__group-heading",
        attributes: {
          "data-market-watch-header-group": group.id,
        },
      }),
    );

    groupColumns.forEach((groupColumn) => {
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

    columnIndex += groupColumns.length;
  }

  thead.append(topRow);

  if (hasGroupedColumns) {
    thead.append(leafRow);
  }

  table.tHead?.remove();
  table.prepend(thead);
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

function getSortValue(column, row, formatters) {
  if (column.format === "security") {
    return row.acrynomName || row.company || row.companySymbol || "";
  }

  if (column.format === "range") {
    return formatters.toNumber(row.lastTradePriceModified) ?? -Infinity;
  }

  if (column.format === "change") {
    return formatters.toNumber(row[column.changeField]) ?? 0;
  }

  const numericValue = formatters.toNumber(row[column.data]);

  return numericValue ?? row[column.data] ?? "";
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
    throw new Error("Market Watch table requires both schema and formatters.");
  }

  let api = null;
  let activeViewId = null;
  let activeRows = [];

  function scheduleLayoutRefresh() {
    /*
     * `datatable-layout.js` already listens to resize and refreshes:
     * - FixedHeader offset
     * - FixedColumns layout
     * - table scroll navigation
     */

    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  }

  function getColumns(viewId) {
    return schema.getColumns(viewId);
  }

  function getDataTableColumns(viewId) {
    return getColumns(viewId).map((column) => ({
      data: column.data,
      name: column.key,
      orderable: column.orderable,
      className: column.pinned
        ? "table-market__security"
        : "table-market__number",

      render(data, type, row) {
        if (type === "display" || type === "filter") {
          return formatters.renderCell(column, row);
        }

        return getSortValue(column, row, formatters);
      },
    }));
  }

  function createDataTable(viewId) {
    const columns = getColumns(viewId);

    createTableHeader(table, schema, viewId);

    api = new DataTable(table, {
      data: activeRows,
      columns: getDataTableColumns(viewId),

      autoWidth: false,
      deferRender: true,

      scrollX: true,
      scrollCollapse: true,

      paging: true,
      pageLength: 25,
      lengthChange: false,

      searching: false,
      ordering: true,
      order: [],

      info: true,
      processing: true,

      fixedHeader: {
        header: true,
      },

      fixedColumns: {
        start: 1,
      },

      rowGroup: {
        dataSrc: schema.rowGroupField,

        startRender(rows, group) {
          return createGroupRow(group, columns.length);
        },
      },

      language: {
        emptyTable: config.labels?.noData || "No data available.",
        zeroRecords: config.labels?.noData || "No matching records found.",
      },

      layout: {
        topStart: null,
        topEnd: null,
        bottomStart: "info",
        bottomEnd: "paging",
      },

      drawCallback() {
        syncGroupHeaders();
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

  function syncGroupHeaders() {
    if (!api) {
      return;
    }

    const columns = getColumns(activeViewId);

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

  function setView(viewId) {
    const nextViewId = schema.getView(viewId).id;

    if (nextViewId === activeViewId && api) {
      return;
    }

    destroyDataTable();
    createDataTable(nextViewId);
  }

  function setRows(rows = []) {
    activeRows = Array.isArray(rows) ? rows : [];

    if (!api) {
      return;
    }

    api.clear();
    api.rows.add(activeRows);
    api.draw();
  }

  function setVisibleGroups(visibleGroups = []) {
    if (!api) {
      return;
    }

    const selectedGroups = new Set(visibleGroups);

    getColumns(activeViewId).forEach((column, index) => {
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

  setView(options.initialViewId || schema.defaultViewId);

  return Object.freeze({
    setView,
    setRows,
    setVisibleGroups,
    getApi,
    getViewId,
    destroy,
  });
}
