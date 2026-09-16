/* ==========================================================================
   Historical Reports Table View
   ========================================================================== */

/*
 * Desktop/table presentation adapter for the Performance and Unadjusted
 * Price tabs.
 *
 * Responsibilities:
 *
 * - expose Historical Reports column definitions to createDataTable
 * - render table cells through historical.formatters.js
 * - issue the server-side ajax request, including the response-envelope
 *   normalization the backend requires
 * - forward server-side loading/data/error lifecycle to the page
 *   coordinator (for mobile-card and result-count synchronization)
 *
 * This module intentionally has no:
 *
 * - filter state
 * - column-picker DOM behavior (Historical has no column-visibility picker)
 * - card rendering
 * - page lifecycle
 * - pagination UI wiring (see the note on data-pagination.js below)
 *
 * Legacy reference: historical.table.profiles.js (performanceProfile /
 * unadjustedProfile / buildHistoricalAjax / getDtOptions) +
 * historical.table.engine.js.
 *
 * IMPORTANT -- why `ajax` is a function here, not an object:
 *
 * Legacy's normalizeResponse() rewrote the RAW response text (via jQuery's
 * dataFilter option) before DataTables ever parsed it, wrapping loosely-
 * shaped backend responses into the {draw, recordsTotal, recordsFiltered,
 * data} envelope server-side DataTables requires. common/data-view's
 * dataSrc-based hook only controls which property becomes the `data`
 * array -- draw/recordsTotal/recordsFiltered are read directly off the raw
 * parsed JSON by DataTables internals, before dataSrc ever runs, so it
 * cannot fix an inconsistent envelope. Function-form `ajax` is the correct
 * interception point: DataTables hands us the request and expects us to
 * call `callback()` with an already-conforming envelope ourselves.
 *
 * One consequence: data-table.js's automatic onServerSideData / error.dt
 * wiring only applies to object-shaped `ajax`, so this file forwards both
 * manually. processing.dt (and therefore the skeleton loader in
 * data-table.js) still fires correctly regardless of ajax's shape, since
 * DataTables' processing-state lifecycle wraps any ajax mechanism.
 */

import {
  getHistoricalPerformanceColumns,
  getHistoricalUnadjustedColumns,
} from "../historical.columns.js";

import { renderHistoricalCell } from "../historical.formatters.js";

import { buildHistoricalReportRequestData } from "../historical.filters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TABLE_SELECTOR = "[data-historical-table]";

const DEFAULT_LOADING_ROW_COUNT = 8;

/*
 * Preserved exactly from legacy's buildHistoricalAjax(tabId) call sites:
 * "0" for Performance, "1" for Unadjusted.
 */
const VIEW_TAB_IDS = Object.freeze({
  performance: "0",
  unadjusted: "1",
});

/* ==========================================================================
   Form Body Serialization
   ========================================================================== */

/*
 * DataTables' server-side request includes nested structures
 * (columns[i][data], order[i][column], etc). jQuery's $.ajax serializes
 * these into bracket-notation form fields automatically when POSTing a
 * plain object; native URLSearchParams does not -- passing a nested
 * object/array directly into `new URLSearchParams(obj)` stringifies it as
 * the literal text "[object Object]", silently corrupting the request.
 * This reproduces jQuery's actual wire format so the backend receives the
 * same shape it always has.
 */

function appendFormParam(searchParams, key, value) {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      appendFormParam(searchParams, `${key}[${index}]`, item),
    );

    return;
  }

  if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([subKey, subValue]) =>
      appendFormParam(searchParams, `${key}[${subKey}]`, subValue),
    );

    return;
  }

  searchParams.append(key, String(value));
}

function toFormBody(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) =>
    appendFormParam(searchParams, key, value),
  );

  return searchParams;
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

/*
 * Equivalent to legacy's normalizeResponse()/emptyDT(), reworked to operate
 * on already-parsed JSON (via fetch()) rather than raw response text (via
 * jQuery's dataFilter). Behavior is preserved exactly for every branch,
 * including the array-shaped case's hardcoded draw:0 -- see the flag on
 * that below.
 */

export function normalizeHistoricalReportResponse(rawResponse, requestedDraw) {
  const draw = Number(requestedDraw || 0);

  if (!rawResponse) {
    return {
      draw,
      recordsTotal: 0,
      recordsFiltered: 0,
      data: [],
    };
  }

  if (Array.isArray(rawResponse)) {
    /*
     * Preserved exactly from legacy: draw is hardcoded to 0 here rather
     * than echoing the actual requested draw counter. DataTables uses
     * draw-counter matching to discard stale/out-of-order responses -- a
     * response that always claims draw 0 risks being treated as
     * permanently stale after the first page loads, which could silently
     * break pagination past page one. This is preserved as legacy's exact
     * behavior, but is worth confirming against the real backend: does it
     * ever actually return a bare array in production, or is this
     * fallback branch never hit?
     */
    return {
      draw: 0,
      recordsTotal: rawResponse.length,
      recordsFiltered: rawResponse.length,
      data: rawResponse,
    };
  }

  if (typeof rawResponse === "object") {
    return rawResponse;
  }

  return {
    draw,
    recordsTotal: 0,
    recordsFiltered: 0,
    data: [],
  };
}

/* ==========================================================================
   Table Options
   ========================================================================== */

/*
 * legacy's dom: "rt" suppressed DataTables' built-in pagination/search/info
 * chrome while keeping its processing indicator. This uses `layout` (the
 * DataTables 2.x replacement for the `dom` string) to suppress ALL built-in
 * chrome, processing indicator included -- since createDataTable's own
 * skeleton-row loading state (bound to processing.dt in data-table.js)
 * already provides a single, consistently-styled loading treatment.
 * Running both would show two different loading indicators at once; this
 * is a deliberate, reasoned substitution, not an oversight.
 */

export function createHistoricalReportTableOptions(config = {}) {
  const table = config.table?.report ?? {};

  return {
    serverSide: true,

    paging: table.paging ?? true,
    pagingType: table.pagingType ?? "simple",
    pageLength: table.pageLength ?? 100,

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

export function createHistoricalTableView({
  root,
  config,
  createDataTable,
  table = DEFAULT_TABLE_SELECTOR,
  initialView = "performance",
  getFilters,
  onServerSideData,
  onServerSideError,
  loadingRowCount = DEFAULT_LOADING_ROW_COUNT,
} = {}) {
  if (typeof createDataTable !== "function") {
    throw new TypeError("createHistoricalTableView requires createDataTable.");
  }

  if (!root) {
    throw new TypeError("createHistoricalTableView requires a root.");
  }

  if (!config) {
    throw new TypeError("createHistoricalTableView requires config.");
  }

  if (typeof getFilters !== "function") {
    throw new TypeError("createHistoricalTableView requires getFilters().");
  }

  /*
   * Tracked here rather than read from createDataTable's own internal
   * `currentView`, since the ajax function below is created once at
   * construction time and has no direct access to that closure. Kept in
   * sync through the wrapped setView() at the bottom of this factory.
   */
  let currentView = initialView;

  /* ------------------------------------------------------------------------
     Ajax
     ------------------------------------------------------------------------ */

  function ajax(requestParams, callback) {
    const filters = getFilters();

    const tabId = VIEW_TAB_IDS[currentView] ?? VIEW_TAB_IDS.performance;

    const requestData = buildHistoricalReportRequestData(
      config,
      filters,
      requestParams,
      tabId,
    );

    fetch(config.endpoints.report, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: toFormBody(requestData),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}.`);
        }

        return response.json();
      })
      .then((rawResponse) => {
        const envelope = normalizeHistoricalReportResponse(
          rawResponse,
          requestParams.draw,
        );

        onServerSideData?.(envelope.data, envelope, { view: currentView });

        callback(envelope);
      })
      .catch((error) => {
        onServerSideError?.(
          error?.message || "Unable to load historical data.",
          { view: currentView },
        );

        /*
         * DataTables still needs a structurally valid envelope even on
         * failure, or the table can be left permanently in a processing
         * state. Empty data with the requested draw echoed back is the
         * safe minimum.
         */
        callback({
          draw: Number(requestParams.draw || 0),
          recordsTotal: 0,
          recordsFiltered: 0,
          data: [],
        });
      });
  }

  /* ------------------------------------------------------------------------
     Instance
     ------------------------------------------------------------------------ */

  const instance = createDataTable({
    root,
    table,
    initialView,
    loadingRowCount,

    getColumns(view) {
      const filters = getFilters();

      return view === "unadjusted"
        ? getHistoricalUnadjustedColumns(config)
        : getHistoricalPerformanceColumns(config, filters);
    },

    renderCell(args) {
      return renderHistoricalCell({ ...args, config });
    },

    tableOptions: {
      ...createHistoricalReportTableOptions(config),
      ajax,
    },
  });

  /* ------------------------------------------------------------------------
     Public Instance
     ------------------------------------------------------------------------ */

  /*
   * setView is wrapped only to keep the `currentView` closure above in sync
   * for the ajax function's tabId lookup -- every other method passes
   * through to the underlying instance unchanged.
   *
   * IMPORTANT for the page coordinator (historical.js): legacy always
   * destroys and fully recreates its DataTables instance on every filter
   * change -- including a plain date-range change that alters neither the
   * active tab nor the visible-column set -- which resets pagination to
   * page one every time. setView() below only recreates when the view or
   * visibleGroups actually differ, matching createDataTable's general
   * contract. To match legacy's "always reset to page one" behavior
   * exactly, historical.js should call recreate() directly on every filter
   * effect rather than relying on setView() alone.
   */

  return {
    ...instance,

    setView(nextView, nextVisibleGroups) {
      currentView = nextView;

      return instance.setView(nextView, nextVisibleGroups);
    },
  };
}
