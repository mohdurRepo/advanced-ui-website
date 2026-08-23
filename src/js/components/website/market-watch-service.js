/* ==========================================================================
   Market Watch Service
   ========================================================================== */

/*
 * One responsibility:
 * request Market Watch data and return a predictable result.
 *
 * This module has no:
 * - DataTables code
 * - DOM code
 * - rendering
 * - live refresh
 * - polling timer
 */

function getJQuery() {
  const $ = window.jQuery;

  if (!$ || typeof $.ajax !== "function") {
    throw new Error("Market Watch requires jQuery with $.ajax available.");
  }

  return $;
}

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

function normalizeRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  /*
   * Preserve the API contract. These aliases only make the renderer tolerant
   * of equivalent field names returned by related market endpoints.
   */

  return {
    ...row,

    companyRef: row.companyRef || row.companySymbol || row.symbol || "",

    companySymbol: row.companySymbol || row.symbol || "",

    sectorName: row.sectorName || row.sector || "",
  };
}

function normalizeResponse(response) {
  const rows = getRows(response).map(normalizeRow).filter(Boolean);

  return {
    rows,

    meta: {
      total:
        Number(response?.total ?? response?.recordsTotal ?? rows.length) || 0,

      updatedAt:
        response?.updatedAt ||
        response?.lastUpdated ||
        response?.timestamp ||
        null,
    },
  };
}

function createAbortError() {
  const error = new Error("Market Watch request was cancelled.");

  error.name = "AbortError";

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

  function buildRequestData(state = {}) {
    return {
      /*
       * These parameter names intentionally match the existing backend
       * resource endpoint.
       */

      sectorParameter: state.industry || "all",

      tableViewParameter: String(state.tableView || "1"),

      iswatchListSelected: state.watchlistOnly ? "YES" : "NO",

      requestLocale: config.locale || "en",
    };
  }

  function cancel() {
    if (!activeRequest) {
      return;
    }

    activeRequest.abort();
    activeRequest = null;
  }

  function load(state = {}) {
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

        resolve(normalizeResponse(response));
      });

      request.fail((jqXHR, textStatus, errorThrown) => {
        if (activeRequest === request) {
          activeRequest = null;
        }

        if (textStatus === "abort") {
          reject(createAbortError());

          return;
        }

        const error = new Error(
          errorThrown ||
            `Market Watch request failed with status ${jqXHR.status}.`,
        );

        error.status = jqXHR.status;
        error.response = jqXHR.responseJSON || null;

        reject(error);
      });
    });
  }

  return Object.freeze({
    buildRequestData,
    load,
    cancel,
  });
}
