/* ==========================================================================
   Historical Reports Underlying Table View
   ========================================================================== */

/*
 * Desktop/table presentation adapter for the Derivatives Underlying
 * (Single Stock Options) table.
 *
 * Responsibilities:
 *
 * - expose the Underlying column schema to createDataTable
 * - render table cells through historical.formatters.js
 * - issue the client-side, single-shot request for the complete row set
 * - forward loading/data/empty/error lifecycle to the page coordinator
 *
 * This module intentionally has no:
 *
 * - server-side pagination (Underlying has none in legacy either --
 *   dtOptions.paging is false)
 * - column-visibility picker (Underlying has none; all eleven columns are
 *   always shown, matching historical.columns.js's
 *   getHistoricalUnderlyingColumns())
 * - filter state
 * - card rendering
 * - page lifecycle
 *
 * Legacy reference: historical.table.profiles.js's underlyingProfile() /
 * buildUnderlyingAjax() / normalizeResponse().
 *
 * Unlike views/historical.table.js, this table is genuinely client-side
 * (tableOptions.serverSide: false), so it uses createDataTable's ordinary
 * setRows()/showLoading()/showEmpty()/showError() lifecycle directly --
 * the same lifecycle Market Watch's table view uses -- rather than the
 * function-form `ajax` + manual envelope normalization the server-side
 * report table needs. This file owns fetching the row array itself and
 * calling those methods; createDataTable never issues a network request
 * for this table.
 */

import { getHistoricalUnderlyingColumns } from "../historical.columns.js";

import { renderHistoricalCell } from "../historical.formatters.js";

import { buildHistoricalUnderlyingRequestData } from "../historical.filters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TABLE_SELECTOR = '[data-historical-table="underlying"]';

const DEFAULT_LOADING_ROW_COUNT = 6;

/* ==========================================================================
   Response Normalization
   ========================================================================== */

/*
 * Equivalent to legacy's normalizeResponse() for the array-shaped case,
 * which is the only shape underlyingProfile() actually needs -- Underlying
 * has no draw/recordsTotal/recordsFiltered envelope to preserve, since it
 * never runs server-side. If the backend wraps rows in an object instead
 * of returning a bare array, the common {data|rows|results} keys are
 * checked as a reasonable fallback rather than failing outright.
 */

export function normalizeHistoricalUnderlyingResponse(rawResponse) {
  if (Array.isArray(rawResponse)) {
    return rawResponse;
  }

  if (rawResponse && typeof rawResponse === "object") {
    const candidate =
      rawResponse.data ?? rawResponse.rows ?? rawResponse.results ?? null;

    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

/* ==========================================================================
   Table Options
   ========================================================================== */

export function createHistoricalUnderlyingTableOptions(config = {}) {
  const table = config.table?.underlying ?? {};

  return {
    serverSide: false,

    paging: table.paging ?? false,
    searching: table.searching ?? false,
    ordering: table.ordering ?? false,
    info: table.info ?? false,

    scrollX: table.scrollX ?? true,
    scrollCollapse: table.scrollCollapse ?? true,
    autoWidth: table.autoWidth ?? true,

    fixedHeader: table.fixedHeader ?? true,

    deferRender: true,

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

export function createHistoricalUnderlyingTableView({
  root,
  config,
  createDataTable,
  table = DEFAULT_TABLE_SELECTOR,
  getFilters,
  loadingRowCount = DEFAULT_LOADING_ROW_COUNT,
} = {}) {
  if (typeof createDataTable !== "function") {
    throw new TypeError(
      "createHistoricalUnderlyingTableView requires createDataTable.",
    );
  }

  if (!root) {
    throw new TypeError("createHistoricalUnderlyingTableView requires a root.");
  }

  if (!config) {
    throw new TypeError("createHistoricalUnderlyingTableView requires config.");
  }

  if (typeof getFilters !== "function") {
    throw new TypeError(
      "createHistoricalUnderlyingTableView requires getFilters().",
    );
  }

  const instance = createDataTable({
    root,
    table,
    loadingRowCount,

    autoInit: false,

    getColumns() {
      return getHistoricalUnderlyingColumns(config);
    },

    renderCell(args) {
      return renderHistoricalCell({ ...args, config });
    },

    tableOptions: createHistoricalUnderlyingTableOptions(config),
  });

  /* ------------------------------------------------------------------------
     Load
     ------------------------------------------------------------------------ */

  /*
   * The page coordinator calls this on every filter change routed to the
   * Underlying profile -- there is no reload()/ajax.reload() path here
   * the way the server-side report table has, since this table's request
   * is entirely owned by this function rather than by DataTables itself.
   */

  async function load() {
    instance.showLoading();

    const filters = getFilters();

    const requestData = buildHistoricalUnderlyingRequestData(config, filters);

    const url = new URL(config.endpoints.underlying, window.location.origin);

    Object.entries(requestData).forEach(([key, value]) => {
      url.searchParams.set(key, value ?? "");
    });

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}.`);
      }

      const rawResponse = await response.json();

      const rows = normalizeHistoricalUnderlyingResponse(rawResponse);

      if (!rows.length) {
        instance.showEmpty(config.labels.noData);

        return;
      }

      instance.setRows(rows);
    } catch (error) {
      instance.showError(
        error?.message || config.labels.noData || "Unable to load data.",
      );
    }
  }

  /* ------------------------------------------------------------------------
     Public Instance
     ------------------------------------------------------------------------ */

  return {
    ...instance,

    load,
  };
}
