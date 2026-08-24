/* ==========================================================================
   Market Watch Service
   ========================================================================== */

/*
 * One responsibility:
 *
 * Request Market Watch data and return a predictable normalized result.
 *
 * This module has no:
 *
 * - DataTables code
 * - DOM code
 * - rendering
 * - responsive logic
 * - polling timer
 * - filter UI state
 */

/* ==========================================================================
   jQuery
   ========================================================================== */

function getJQuery() {
  const $ = window.jQuery;

  if (!$ || typeof $.ajax !== "function") {
    throw new Error("Market Watch requires jQuery with $.ajax available.");
  }

  return $;
}

/* ==========================================================================
   Response Helpers
   ========================================================================== */

function getRows(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
}

/*
 * Keep the backend payload intact.
 *
 * Aliases exist only so renderers can consume equivalent legacy field names
 * consistently without turning the service into a presentation formatter.
 */

function normalizeRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    ...row,

    companyRef: row.companyRef ?? row.companySymbol ?? row.symbol ?? "",

    companySymbol: row.companySymbol ?? row.symbol ?? row.companyRef ?? "",

    sectorName: row.sectorName ?? row.sector ?? "",
  };
}

function normalizeTotal(response, rowCount) {
  const value =
    response?.total ??
    response?.recordsTotal ??
    response?.recordsFiltered ??
    rowCount;

  const total = Number(value);

  return Number.isFinite(total) ? total : rowCount;
}

function normalizeResponse(response) {
  const rows = getRows(response).map(normalizeRow).filter(Boolean);

  return {
    rows,

    meta: {
      total: normalizeTotal(response, rows.length),

      updatedAt:
        response?.updatedAt ??
        response?.lastUpdated ??
        response?.timestamp ??
        null,
    },
  };
}

/* ==========================================================================
   Errors
   ========================================================================== */

function createAbortError() {
  const error = new Error("Market Watch request was cancelled.");

  error.name = "AbortError";

  return error;
}

function createRequestError(jqXHR, errorThrown) {
  const status = Number(jqXHR?.status) || 0;

  const response = jqXHR?.responseJSON || null;

  const message =
    response?.message ||
    errorThrown ||
    `Market Watch request failed with status ${status}.`;

  const error = new Error(message);

  error.status = status;
  error.response = response;

  return error;
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketWatchService(config = {}) {
  const $ = getJQuery();

  const endpoint = config.endpoint;

  if (!endpoint) {
    throw new Error("Market Watch endpoint is required.");
  }

  let activeRequest = null;
  let destroyed = false;

  /* ========================================================================
     Request Data
     ======================================================================== */

  function buildRequestData(state = {}) {
    /*
     * Parameter names intentionally match the existing backend resource
     * endpoint.
     */

    return {
      sectorParameter: state.industry || "all",

      tableViewParameter: String(state.tableView || "1"),

      iswatchListSelected: state.watchlistOnly ? "YES" : "NO",

      requestLocale: config.locale || "en",
    };
  }

  /* ========================================================================
     Cancellation
     ======================================================================== */

  function cancel() {
    const request = activeRequest;

    if (!request) {
      return;
    }

    /*
     * Clear ownership before aborting.
     *
     * jQuery may invoke the fail callback synchronously while abort() runs.
     * Clearing first prevents the cancelled request from remaining registered
     * as the active request.
     */

    activeRequest = null;

    request.abort();
  }

  /* ========================================================================
     Load
     ======================================================================== */

  function load(state = {}) {
    if (destroyed) {
      return Promise.reject(createAbortError());
    }

    /*
     * Only one Market Watch request is relevant at a time.
     *
     * Changing Industry / Table View / Watchlist cancels the previous request
     * before starting the next one.
     */

    cancel();

    const request = $.ajax({
      url: endpoint,
      type: "GET",
      dataType: "json",

      data: buildRequestData(state),
    });

    activeRequest = request;

    return new Promise((resolve, reject) => {
      request.done((response) => {
        if (activeRequest === request) {
          activeRequest = null;
        }

        /*
         * If this service was destroyed while the request was resolving,
         * treat the result as cancelled rather than exposing stale data.
         */

        if (destroyed) {
          reject(createAbortError());

          return;
        }

        resolve(normalizeResponse(response));
      });

      request.fail((jqXHR, textStatus, errorThrown) => {
        if (activeRequest === request) {
          activeRequest = null;
        }

        if (textStatus === "abort" || destroyed) {
          reject(createAbortError());

          return;
        }

        reject(createRequestError(jqXHR, errorThrown));
      });
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

    cancel();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    buildRequestData,
    cancel,
    destroy,
    load,
  });
}
