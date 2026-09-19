/* ==========================================================================
   Historical Reports Table View
   ========================================================================== */

/*
 * Desktop/table presentation adapter for Historical Reports:
 *
 * - Performance
 * - Unadjusted Price
 *
 * Responsibilities:
 *
 * - expose Historical column schemas to common/data-view/data-table
 * - resolve Historical's business-owned visible column groups
 * - render cells through historical.formatters.js
 * - build the legacy-compatible POST request payload
 * - serialize DataTables request metadata using jQuery-compatible
 *   bracket notation
 * - normalize Historical report responses into the server-side DataTables
 *   envelope
 * - cancel superseded requests
 * - ignore stale responses
 * - forward page rows to the mobile-card coordinator
 * - expose normalized pagination metadata
 * - forward request failures to the page coordinator
 *
 * This module intentionally has no:
 *
 * - filter DOM behavior
 * - tab DOM behavior
 * - mobile card rendering
 * - pagination DOM rendering
 * - note behavior
 * - page/profile coordination
 *
 * Historical report pagination remains DataTables-backed. The future shared
 * data-pagination module will only render and control the external design-
 * system pagination UI using getPaginationState() + getApi().
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  getHistoricalPerformanceAvailableGroups,
  getHistoricalPerformanceColumns,
  getHistoricalUnadjustedAvailableGroups,
  getHistoricalUnadjustedColumns,
} from "../historical.columns.js";

import { renderHistoricalCell } from "../historical.formatters.js";

import { buildHistoricalReportRequestData } from "../historical.filters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TABLE_SELECTOR = "[data-historical-table]";

const DEFAULT_LOADING_ROW_COUNT = 8;

const DEFAULT_PAGE_LENGTH = 100;

/*
 * Preserved from legacy's buildHistoricalAjax(tabId) call sites:
 *
 * Performance  -> 0
 * Unadjusted   -> 1
 */
const VIEW_TAB_IDS = Object.freeze({
  performance: "0",

  unadjusted: "1",
});

const VIEW_KEYS = Object.freeze(new Set(["performance", "unadjusted"]));

/* ==========================================================================
   General Helpers
   ========================================================================== */

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeView(value) {
  const view = normalizeString(value);

  return VIEW_KEYS.has(view) ? view : "performance";
}

function toNonNegativeInteger(value, fallback = 0) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.floor(numeric);
}

function toPositiveInteger(value, fallback = DEFAULT_PAGE_LENGTH) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.floor(numeric);
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

/* ==========================================================================
   Form Body Serialization
   ========================================================================== */

/*
 * DataTables' server-side request contains nested structures such as:
 *
 *   columns[0][data]
 *   columns[0][search][value]
 *   order[0][column]
 *
 * Legacy used jQuery $.ajax, which serializes nested arrays/objects into
 * bracket notation.
 *
 * Native URLSearchParams does not perform this transformation automatically,
 * so the serializer below reproduces jQuery's request shape.
 *
 * null / undefined are deliberately omitted.
 *
 * Sending String(null) produced the literal value "null", which is not a
 * meaningful Historical request value and can corrupt backend interpretation.
 */

function appendFormParam(searchParams, key, value) {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendFormParam(searchParams, `${key}[${index}]`, item);
    });

    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([subKey, subValue]) => {
      appendFormParam(searchParams, `${key}[${subKey}]`, subValue);
    });

    return;
  }

  searchParams.append(key, String(value));
}

function toFormBody(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    appendFormParam(searchParams, key, value);
  });

  return searchParams;
}

/* ==========================================================================
   Empty Response Envelope
   ========================================================================== */

function createEmptyHistoricalReportEnvelope(draw = 0) {
  return {
    draw: toNonNegativeInteger(draw, 0),

    recordsTotal: 0,

    recordsFiltered: 0,

    data: [],
  };
}

/* ==========================================================================
   Response Parsing
   ========================================================================== */

/*
 * Legacy's jQuery dataFilter worked against raw response text and accepted:
 *
 * - empty responses
 * - JSON objects
 * - bare JSON arrays
 *
 * fetch() normally encourages response.json(), but reading text first lets us
 * preserve the same tolerant contract without throwing on an empty response.
 */

function parseHistoricalReportResponse(response) {
  if (response === null || response === undefined) {
    return null;
  }

  if (typeof response !== "string") {
    return response;
  }

  const trimmed = response.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

/*
 * DataTables server-side processing requires:
 *
 * {
 *   draw,
 *   recordsTotal,
 *   recordsFiltered,
 *   data
 * }
 *
 * Historical's backend has historically been tolerant/loosely-shaped, so this
 * function guarantees a valid envelope before DataTables receives it.
 *
 * Important correction from legacy:
 *
 * bare-array responses now echo the requested draw instead of hardcoding 0.
 *
 * DataTables uses draw to protect against out-of-order responses. Returning 0
 * after later requests can cause otherwise valid responses to be discarded.
 */

export function normalizeHistoricalReportResponse(rawResponse, requestedDraw) {
  const draw = toNonNegativeInteger(requestedDraw, 0);

  const parsed = parseHistoricalReportResponse(rawResponse);

  if (!parsed) {
    return createEmptyHistoricalReportEnvelope(draw);
  }

  /* ------------------------------------------------------------------------
     Bare Array
     ------------------------------------------------------------------------ */

  if (Array.isArray(parsed)) {
    return {
      draw,

      recordsTotal: parsed.length,

      recordsFiltered: parsed.length,

      data: parsed,
    };
  }

  /* ------------------------------------------------------------------------
     Invalid Shape
     ------------------------------------------------------------------------ */

  if (typeof parsed !== "object") {
    return createEmptyHistoricalReportEnvelope(draw);
  }

  /* ------------------------------------------------------------------------
     Object Envelope
     ------------------------------------------------------------------------ */

  const data = Array.isArray(parsed.data) ? parsed.data : [];

  const recordsTotal = toNonNegativeInteger(
    parsed.recordsTotal,

    toNonNegativeInteger(parsed.recordsFiltered, data.length),
  );

  const recordsFiltered = toNonNegativeInteger(
    parsed.recordsFiltered,
    recordsTotal,
  );

  /*
   * Preserve any additional backend metadata while making the DataTables
   * contract authoritative.
   */
  return {
    ...parsed,

    draw,

    recordsTotal,

    recordsFiltered,

    data,
  };
}

/* ==========================================================================
   Pagination State
   ========================================================================== */

function createEmptyPaginationState(pageSize = DEFAULT_PAGE_LENGTH) {
  return Object.freeze({
    page: 1,

    pageSize: toPositiveInteger(pageSize, DEFAULT_PAGE_LENGTH),

    totalPages: 0,

    total: 0,

    recordsTotal: 0,

    recordsFiltered: 0,

    start: 0,

    end: 0,

    rowCount: 0,

    hasPrevious: false,

    hasNext: false,
  });
}

/*
 * Converts the DataTables request + normalized response into the page-neutral
 * metadata the external pagination component needs.
 *
 * `total` represents recordsFiltered because that is the result set DataTables
 * is currently paging through.
 *
 * Historical does not use DataTables search, so recordsTotal and
 * recordsFiltered are normally equal, but both remain available.
 */

export function createHistoricalPaginationState(
  envelope,
  requestParams,
  fallbackPageLength = DEFAULT_PAGE_LENGTH,
) {
  const pageSize = toPositiveInteger(requestParams?.length, fallbackPageLength);

  const start = toNonNegativeInteger(requestParams?.start, 0);

  const recordsTotal = toNonNegativeInteger(envelope?.recordsTotal, 0);

  const recordsFiltered = toNonNegativeInteger(
    envelope?.recordsFiltered,
    recordsTotal,
  );

  const data = Array.isArray(envelope?.data) ? envelope.data : [];

  const total = recordsFiltered;

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  const page =
    totalPages > 0
      ? Math.min(
          Math.floor(start / pageSize) + 1,

          totalPages,
        )
      : 1;

  const rangeStart = total > 0 ? Math.min(start + 1, total) : 0;

  const rangeEnd =
    total > 0
      ? Math.min(
          start + data.length,

          total,
        )
      : 0;

  return Object.freeze({
    page,

    pageSize,

    totalPages,

    total,

    recordsTotal,

    recordsFiltered,

    start: rangeStart,

    end: rangeEnd,

    rowCount: data.length,

    hasPrevious: totalPages > 0 && page > 1,

    hasNext: totalPages > 0 && page < totalPages,
  });
}

/* ==========================================================================
   Visible Column Groups
   ========================================================================== */

function getHistoricalReportVisibleGroups(view, filters) {
  if (view === "unadjusted") {
    return getHistoricalUnadjustedAvailableGroups(filters);
  }

  return getHistoricalPerformanceAvailableGroups(filters);
}

/* ==========================================================================
   Columns
   ========================================================================== */

function getHistoricalReportColumns(view, filters, config) {
  if (view === "unadjusted") {
    return getHistoricalUnadjustedColumns(config);
  }

  return getHistoricalPerformanceColumns(config, filters);
}

/* ==========================================================================
   Table Options
   ========================================================================== */

/*
 * Legacy's `dom: "rt"` suppressed DataTables' built-in:
 *
 * - page controls
 * - search
 * - info
 * - page-length controls
 *
 * DataTables still owns the paging engine internally.
 *
 * The new page renders external design-system pagination, so all built-in
 * DataTables chrome remains disabled through the DataTables 2 layout API.
 */

export function createHistoricalReportTableOptions(config = {}) {
  const table = config.table?.report ?? {};

  return {
    serverSide: true,

    paging: table.paging ?? true,

    pagingType: table.pagingType ?? "simple",

    pageLength: table.pageLength ?? DEFAULT_PAGE_LENGTH,

    searching: table.searching ?? false,

    ordering: table.ordering ?? false,

    info: table.info ?? false,

    scrollX: table.scrollX ?? true,

    scrollCollapse: table.scrollCollapse ?? true,

    autoWidth: table.autoWidth ?? true,

    fixedHeader: table.fixedHeader ?? true,

    deferRender: true,

    /*
     * DataTables remains the paging engine but owns no visible page chrome.
     */
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

  onPaginationChange,

  loadingRowCount = DEFAULT_LOADING_ROW_COUNT,
} = {}) {
  /* ------------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */

  let currentView = normalizeView(initialView);

  let requestController = null;

  let requestSequence = 0;

  let destroyed = false;

  let paginationState = createEmptyPaginationState(
    config.table?.report?.pageLength ?? DEFAULT_PAGE_LENGTH,
  );

  /* ========================================================================
     Request Lifecycle
     ======================================================================== */

  function abortActiveRequest() {
    if (!requestController) {
      return;
    }

    requestController.abort();

    requestController = null;
  }

  function invalidateActiveRequest() {
    requestSequence += 1;

    abortActiveRequest();
  }

  function isCurrentRequest(requestId) {
    return !destroyed && requestId === requestSequence;
  }

  /* ========================================================================
     Pagination State
     ======================================================================== */

  function updatePaginationState(nextState, context) {
    paginationState = nextState;

    onPaginationChange?.(paginationState, context);
  }

  function resetPaginationState(context = {}) {
    updatePaginationState(
      createEmptyPaginationState(
        config.table?.report?.pageLength ?? DEFAULT_PAGE_LENGTH,
      ),

      context,
    );
  }

  function getPaginationState() {
    return {
      ...paginationState,
    };
  }

  /* ========================================================================
     Ajax
     ======================================================================== */

  /*
   * Function-form ajax is intentional.
   *
   * Historical's backend response needs normalization BEFORE DataTables reads:
   *
   * - draw
   * - recordsTotal
   * - recordsFiltered
   * - data
   *
   * dataSrc cannot repair those top-level server-side properties after the
   * fact, so the function-form callback is the correct interception point.
   */

  function ajax(requestParams, callback) {
    if (destroyed) {
      return;
    }

    /*
     * One active report request per table instance.
     *
     * DataTables itself uses draw counters to protect against stale responses,
     * but aborting superseded network work also prevents unnecessary server
     * and browser work.
     */
    abortActiveRequest();

    const requestId = ++requestSequence;

    const controller = new AbortController();

    requestController = controller;

    /*
     * Snapshot view + filters for this request.
     *
     * Never use mutable currentView inside the eventual response callback:
     * the selected tab/profile may have changed while the request was in
     * flight.
     */
    const requestView = currentView;

    const filters = getFilters();

    const tabId = VIEW_TAB_IDS[requestView] ?? VIEW_TAB_IDS.performance;

    const requestData = buildHistoricalReportRequestData(
      config,

      filters,

      requestParams,

      tabId,
    );

    const context = {
      view: requestView,

      filters,

      request: requestData,
    };

    fetch(
      config.endpoints.report,

      {
        method: "POST",

        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },

        body: toFormBody(requestData),

        signal: controller.signal,
      },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}.`);
        }

        /*
         * Read raw text so empty responses retain legacy's valid-empty
         * behavior rather than failing response.json().
         */
        return response.text();
      })
      .then((rawResponse) => {
        if (!isCurrentRequest(requestId)) {
          return;
        }

        const envelope = normalizeHistoricalReportResponse(
          rawResponse,

          requestParams.draw,
        );

        const nextPaginationState = createHistoricalPaginationState(
          envelope,

          requestParams,

          config.table?.report?.pageLength ?? DEFAULT_PAGE_LENGTH,
        );

        const responseContext = {
          ...context,

          pagination: nextPaginationState,
        };

        updatePaginationState(nextPaginationState, responseContext);

        /*
         * The same server page feeds the matching mobile cards.
         */
        onServerSideData?.(
          envelope.data,

          envelope,

          responseContext,
        );

        /*
         * DataTables must receive exactly one callback for the active
         * successful request.
         */
        callback(envelope);
      })
      .catch((error) => {
        /*
         * Aborted/superseded work is not an application error.
         *
         * A newer DataTables request will own the eventual draw.
         */
        if (isAbortError(error) || !isCurrentRequest(requestId)) {
          return;
        }

        const envelope = createEmptyHistoricalReportEnvelope(
          requestParams.draw,
        );

        const nextPaginationState = createHistoricalPaginationState(
          envelope,

          requestParams,

          config.table?.report?.pageLength ?? DEFAULT_PAGE_LENGTH,
        );

        const errorContext = {
          ...context,

          pagination: nextPaginationState,

          error,
        };

        updatePaginationState(nextPaginationState, errorContext);

        onServerSideError?.(
          error?.message || "Unable to load historical data.",

          errorContext,
        );

        /*
         * Even on failure DataTables needs a structurally valid response
         * for the active draw; otherwise the processing lifecycle can remain
         * unresolved.
         */
        callback(envelope);
      })
      .finally(() => {
        if (requestController === controller) {
          requestController = null;
        }
      });
  }

  /* ========================================================================
     Initial Schema State
     ======================================================================== */

  const initialFilters = getFilters();

  const initialVisibleGroups = getHistoricalReportVisibleGroups(
    currentView,
    initialFilters,
  );

  /* ========================================================================
     Shared Data Table Instance
     ======================================================================== */

  const instance = createDataTable({
    root,

    table,

    initialView: currentView,

    /*
     * Explicit Historical visibility.
     *
     * This is business logic and therefore belongs here rather than inside
     * common/data-view/data-table.js.
     */
    visibleGroups: initialVisibleGroups,

    loadingRowCount,

    emptyMessage: config.labels?.noData || "No data available.",

    getColumns(view) {
      const filters = getFilters();

      return getHistoricalReportColumns(
        normalizeView(view),

        filters,

        config,
      );
    },

    renderCell(args) {
      return renderHistoricalCell({
        ...args,

        config,
      });
    },

    tableOptions: {
      ...createHistoricalReportTableOptions(config),

      ajax,
    },

    /*
     * Function-form ajax handles request failures itself.
     *
     * This still captures a DataTables-internal server-side error should one
     * occur outside our fetch path.
     */
    onServerSideError(message, tableContext) {
      if (destroyed) {
        return;
      }

      onServerSideError?.(
        message,

        {
          ...tableContext,

          pagination: paginationState,
        },
      );
    },

    /*
     * createDataTable calls beforeDestroy both for permanent destruction and
     * schema recreation. In either case the old request belongs to the old
     * DataTables instance and must not survive.
     */
    beforeDestroy() {
      invalidateActiveRequest();
    },
  });

  /* ==========================================================================
     View / Schema
     ========================================================================== */

  function setView(nextView, nextVisibleGroups = null) {
    if (destroyed) {
      return false;
    }

    const view = normalizeView(nextView);

    currentView = view;

    const filters = getFilters();

    const visibleGroups = Array.isArray(nextVisibleGroups)
      ? nextVisibleGroups
      : getHistoricalReportVisibleGroups(view, filters);

    /*
     * A new report schema always starts with fresh page metadata.
     *
     * The DataTables instance created by setView() will populate the real
     * pagination state when its first response arrives.
     */
    resetPaginationState({
      view,
    });

    return instance.setView(view, visibleGroups);
  }

  /* ==========================================================================
     Recreation
     ========================================================================== */

  /*
   * Historical currently recreates the active report table on every settled
   * filter effect. That preserves legacy's page-reset behavior.
   *
   * Keep a wrapper so external pagination state is cleared immediately rather
   * than temporarily showing metadata from the previous request.
   */

  function recreate() {
    if (destroyed) {
      return;
    }

    resetPaginationState({
      view: currentView,
    });

    instance.recreate();
  }

  /* ==========================================================================
     Reload
     ========================================================================== */

  /*
   * Reload intentionally keeps the current DataTables page because that is the
   * generic createDataTable reload contract.
   *
   * Historical's normal filter-change path should continue to use recreate()
   * when it needs legacy's "return to page one" behavior.
   */

  function reload() {
    if (destroyed) {
      return;
    }

    instance.reload();
  }

  /* ==========================================================================
     Lifecycle
     ========================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    invalidateActiveRequest();

    instance.destroy();

    paginationState = createEmptyPaginationState(
      config.table?.report?.pageLength ?? DEFAULT_PAGE_LENGTH,
    );
  }

  /* ==========================================================================
     Public Instance
     ========================================================================== */

  return Object.freeze({
    /*
     * Shared data-table operations.
     */
    adjust: instance.adjust,

    getApi: instance.getApi,

    getRows: instance.getRows,

    getState: instance.getState,

    getView: instance.getView,

    getVisibleGroups: instance.getVisibleGroups,

    redraw: instance.redraw,

    search: instance.search,

    setPageLength: instance.setPageLength,

    setVisibleGroups: instance.setVisibleGroups,

    showEmpty: instance.showEmpty,

    showError: instance.showError,

    showLoading: instance.showLoading,

    /*
     * Historical wrappers.
     */
    destroy,

    getPaginationState,

    recreate,

    reload,

    setView,
  });
}
