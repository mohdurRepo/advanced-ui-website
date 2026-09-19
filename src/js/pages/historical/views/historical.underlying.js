/* ==========================================================================
   Historical Reports Underlying Table View
   ========================================================================== */

/*
 * Client-side Derivatives Underlying table adapter.
 *
 * Responsibilities:
 *
 * - expose the fixed Underlying column schema to common/data-view/data-table
 * - build the Historical Underlying request
 * - load the complete Underlying dataset
 * - cancel superseded requests
 * - ignore stale responses
 * - normalize the backend response into a plain row array
 * - drive the shared table loading / ready / empty / error states
 * - optionally notify the page coordinator so the matching mobile cards can
 *   share the same request lifecycle
 *
 * This module intentionally has no:
 *
 * - report pagination
 * - server-side DataTables processing
 * - filter DOM behavior
 * - tab/profile behavior
 * - card rendering
 * - note behavior
 * - page-level placeholder behavior
 *
 * Underlying is deliberately NON-PAGED.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { getHistoricalUnderlyingColumns } from "../historical.columns.js";

import { renderHistoricalCell } from "../historical.formatters.js";

import { buildHistoricalUnderlyingRequestData } from "../historical.filters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TABLE_SELECTOR = '[data-historical-table="underlying"]';

const DEFAULT_LOADING_ROW_COUNT = 8;

/* ==========================================================================
   Helpers
   ========================================================================== */

function isAbortError(error) {
  return error?.name === "AbortError";
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

/* ==========================================================================
   URL Construction
   ========================================================================== */

function buildRequestUrl(endpoint, params = {}, root = document) {
  const documentReference =
    root?.nodeType === 9 ? root : root?.ownerDocument || document;

  const view = documentReference.defaultView || window;

  const URLCtor = view.URL || globalThis.URL;

  const url = new URLCtor(endpoint, documentReference.baseURI);

  Object.entries(params).forEach(([key, value]) => {
    /*
     * Do not serialize null / undefined into literal "null" / "undefined"
     * request values.
     */
    if (value === null || value === undefined) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

/* ==========================================================================
   Response Parsing
   ========================================================================== */

/*
 * Legacy accepted either:
 *
 * - a bare array
 * - a DataTables-style object containing `data`
 *
 * Read raw text first so an empty body becomes a valid empty result instead
 * of throwing from response.json().
 */

function parseHistoricalUnderlyingResponse(response) {
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

export function normalizeHistoricalUnderlyingResponse(rawResponse) {
  const parsed = parseHistoricalUnderlyingResponse(rawResponse);

  if (!parsed) {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === "object" && Array.isArray(parsed.data)) {
    return parsed.data;
  }

  return [];
}

/* ==========================================================================
   Table Options
   ========================================================================== */

export function createHistoricalUnderlyingTableOptions(config = {}) {
  const table = config.table?.underlying ?? {};

  return {
    /*
     * Underlying is a complete client-side dataset.
     */
    serverSide: false,

    paging: false,

    searching: table.searching ?? false,

    ordering: table.ordering ?? false,

    info: table.info ?? false,

    scrollX: table.scrollX ?? true,

    scrollCollapse: table.scrollCollapse ?? true,

    autoWidth: table.autoWidth ?? true,

    fixedHeader: table.fixedHeader ?? true,

    deferRender: true,

    /*
     * No DataTables chrome is required.
     *
     * There is intentionally no paging UI for Underlying.
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
   Factory
   ========================================================================== */

export function createHistoricalUnderlyingTableView({
  root,

  config,

  createDataTable,

  table = DEFAULT_TABLE_SELECTOR,

  getFilters,

  onLoading,

  onData,

  onEmpty,

  onError,

  loadingRowCount = DEFAULT_LOADING_ROW_COUNT,
} = {}) {
  /* ------------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
     Environment
     ------------------------------------------------------------------------ */

  const documentReference =
    root?.nodeType === 9 ? root : root.ownerDocument || document;

  const view = documentReference.defaultView || window;

  const fetchRequest =
    typeof view.fetch === "function"
      ? view.fetch.bind(view)
      : globalThis.fetch?.bind(globalThis);

  const AbortControllerCtor =
    view.AbortController || globalThis.AbortController;

  if (typeof fetchRequest !== "function") {
    throw new Error("Historical Underlying requires the Fetch API.");
  }

  if (typeof AbortControllerCtor !== "function") {
    throw new Error("Historical Underlying requires AbortController.");
  }

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */

  let destroyed = false;

  let requestSequence = 0;

  let requestController = null;

  let rows = [];

  let state = {
    status: "idle",

    error: null,
  };

  /* ========================================================================
     Shared Table
     ======================================================================== */

  /*
   * autoInit:false keeps the table lifecycle request-driven.
   *
   * load() calls showLoading(), which creates the DataTables instance using
   * loading rows on the first request.
   */
  const instance = createDataTable({
    root,

    table,

    initialView: "underlying",

    loadingRowCount,

    autoInit: false,

    emptyMessage: config.labels?.noData || "No data available.",

    getColumns() {
      return getHistoricalUnderlyingColumns(config);
    },

    renderCell(args) {
      return renderHistoricalCell({
        ...args,

        config,
      });
    },

    tableOptions: createHistoricalUnderlyingTableOptions(config),
  });

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

  function beginRequest() {
    /*
     * Invalidate anything that was previously active before creating the next
     * request token.
     */
    abortActiveRequest();

    requestSequence += 1;

    const requestId = requestSequence;

    const controller = new AbortControllerCtor();

    requestController = controller;

    return {
      requestId,
      controller,
    };
  }

  function isCurrentRequest(requestId) {
    return !destroyed && requestId === requestSequence;
  }

  /* ========================================================================
     State
     ======================================================================== */

  function setState(status, error = null) {
    state = {
      status,

      error,
    };
  }

  function getState() {
    return Object.freeze({
      status: state.status,

      loading: state.status === "loading",

      error: state.error,

      rowCount: rows.length,

      rows: [...rows],

      table: instance.getState(),
    });
  }

  function getRows() {
    return [...rows];
  }

  /* ========================================================================
     Presentation
     ======================================================================== */

  function showLoading(context) {
    setState("loading");

    instance.showLoading();

    onLoading?.(context);
  }

  function showRows(nextRows, context) {
    rows = Array.isArray(nextRows) ? nextRows : [];

    setState("ready");

    instance.setRows(rows);

    onData?.([...rows], context);
  }

  function showEmpty(context) {
    rows = [];

    setState("empty");

    instance.showEmpty(config.labels?.noData || "No data available.");

    onEmpty?.(context);

    /*
     * Empty is still a successful data result, so consumers that synchronize
     * a card view should receive [] as the current row set.
     */
    onData?.([], context);
  }

  function showError(error, context) {
    rows = [];

    const message =
      normalizeString(error?.message) || "Unable to load historical data.";

    setState("error", message);

    instance.showError(message);

    onError?.(message, error, context);
  }

  /* ========================================================================
     Load
     ======================================================================== */

  async function load() {
    if (destroyed) {
      return null;
    }

    const { requestId, controller } = beginRequest();

    /*
     * Snapshot filters at request start.
     *
     * Do not re-read mutable filter state after the response arrives.
     */
    const filters = getFilters();

    const requestData = buildHistoricalUnderlyingRequestData(config, filters);

    const context = {
      view: "underlying",

      filters,

      request: requestData,
    };

    showLoading(context);

    try {
      const url = buildRequestUrl(
        config.endpoints.underlying,

        requestData,

        root,
      );

      const response = await fetchRequest(url, {
        method: "GET",

        signal: controller.signal,

        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}.`);
      }

      const rawResponse = await response.text();

      if (!isCurrentRequest(requestId)) {
        return null;
      }

      const nextRows = normalizeHistoricalUnderlyingResponse(rawResponse);

      const responseContext = {
        ...context,

        rowCount: nextRows.length,
      };

      if (nextRows.length) {
        showRows(nextRows, responseContext);
      } else {
        showEmpty(responseContext);
      }

      return Object.freeze({
        rows: [...nextRows],

        context: responseContext,
      });
    } catch (error) {
      /*
       * A destroyed or superseded request has no UI ownership anymore.
       */
      if (isAbortError(error) || !isCurrentRequest(requestId)) {
        return null;
      }

      const errorContext = {
        ...context,

        error,
      };

      showError(error, errorContext);

      return null;
    } finally {
      if (requestController === controller) {
        requestController = null;
      }
    }
  }

  /* ========================================================================
     Reload
     ======================================================================== */

  function reload() {
    return load();
  }

  /* ========================================================================
     Layout
     ======================================================================== */

  function adjust() {
    instance.adjust();
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    /*
     * Invalidate any awaiting continuation before aborting network work.
     */
    requestSequence += 1;

    abortActiveRequest();

    rows = [];

    state = {
      status: "destroyed",

      error: null,
    };

    instance.destroy();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    adjust,

    destroy,

    getApi: instance.getApi,

    getRows,

    getState,

    load,

    reload,
  });
}
