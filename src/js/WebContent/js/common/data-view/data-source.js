/* ==========================================================================
   Data Source
   ========================================================================== */

/*
 * Generic request lifecycle for reusable data-view modules.
 *
 * Responsibilities:
 *
 * - build request data through caller-provided configuration
 * - issue requests
 * - keep one active request at a time
 * - cancel stale requests
 * - normalize responses
 * - normalize request errors
 * - support destruction
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - DataTables code
 * - filter UI code
 * - card rendering
 * - page-specific request parameter names
 */

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createAbortError(message = "Data request was cancelled.") {
  const error = new Error(message);

  error.name = "AbortError";

  return error;
}

function createRequestError({
  status = 0,
  response = null,
  message = "",
} = {}) {
  const error = new Error(
    message ||
      response?.message ||
      `Data request failed with status ${status}.`,
  );

  error.status = status;
  error.response = response;

  return error;
}

function getDefaultRows(response) {
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

function normalizeDefaultResponse(response) {
  const rows = getDefaultRows(response);

  return {
    rows,

    meta: {
      total:
        Number(
          response?.total ??
            response?.recordsTotal ??
            response?.recordsFiltered ??
            rows.length,
        ) || rows.length,

      updatedAt:
        response?.updatedAt ??
        response?.lastUpdated ??
        response?.timestamp ??
        null,
    },

    raw: response,
  };
}

/* ==========================================================================
   Transport
   ========================================================================== */

function createJQueryTransport() {
  const $ = window.jQuery;

  if (!$ || typeof $.ajax !== "function") {
    throw new Error("Data source requires jQuery with $.ajax available.");
  }

  function request(options = {}) {
    const jqXHR = $.ajax({
      url: options.url,
      type: options.method || "GET",
      dataType: options.dataType || "json",
      data: options.data,
      headers: options.headers,
      contentType: options.contentType,
      processData: options.processData,
    });

    const promise = new Promise((resolve, reject) => {
      jqXHR.done((response) => {
        resolve(response);
      });

      jqXHR.fail((xhr, textStatus, errorThrown) => {
        if (textStatus === "abort") {
          reject(createAbortError());

          return;
        }

        reject(
          createRequestError({
            status: Number(xhr?.status) || 0,

            response: xhr?.responseJSON || null,

            message: errorThrown || "",
          }),
        );
      });
    });

    return {
      abort() {
        jqXHR.abort();
      },

      promise,
      raw: jqXHR,
    };
  }

  return Object.freeze({
    request,
  });
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createDataSource(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("createDataSource requires an options object.");
  }

  const endpoint = options.endpoint || "";

  if (!endpoint) {
    throw new Error("Data source endpoint is required.");
  }

  const transport = options.transport || createJQueryTransport();

  if (!transport || typeof transport.request !== "function") {
    throw new TypeError("Data source transport must expose request().");
  }

  const buildRequestData =
    typeof options.buildRequestData === "function"
      ? options.buildRequestData
      : (state) => state;

  const normalizeResponse =
    typeof options.normalizeResponse === "function"
      ? options.normalizeResponse
      : normalizeDefaultResponse;

  const normalizeError =
    typeof options.normalizeError === "function"
      ? options.normalizeError
      : (error) => error;

  let activeRequest = null;
  let requestId = 0;
  let destroyed = false;

  /* ========================================================================
     Cancellation
     ======================================================================== */

  function cancel() {
    const request = activeRequest;

    if (!request) {
      return false;
    }

    /*
     * Invalidate ownership before aborting because some transports may invoke
     * their rejection callback synchronously during abort().
     */

    activeRequest = null;
    requestId += 1;

    request.abort?.();

    return true;
  }

  /* ========================================================================
     Request Options
     ======================================================================== */

  function buildTransportOptions(state = {}, requestOptions = {}) {
    const requestData = buildRequestData(state, requestOptions);

    return {
      url: requestOptions.endpoint || endpoint,

      method: requestOptions.method || options.method || "GET",

      dataType: requestOptions.dataType || options.dataType || "json",

      data: requestData,

      headers: requestOptions.headers || options.headers,

      contentType: requestOptions.contentType ?? options.contentType,

      processData: requestOptions.processData ?? options.processData,
    };
  }

  /* ========================================================================
     Load
     ======================================================================== */

  async function load(state = {}, requestOptions = {}) {
    if (destroyed) {
      throw createAbortError("Data source has been destroyed.");
    }

    /*
     * Latest request wins.
     */

    cancel();

    const currentRequestId = ++requestId;

    const transportOptions = buildTransportOptions(state, requestOptions);

    const request = transport.request(transportOptions);

    if (
      !request ||
      !request.promise ||
      typeof request.promise.then !== "function"
    ) {
      throw new TypeError(
        "Data source transport request() must return { promise, abort? }.",
      );
    }

    activeRequest = request;

    try {
      const rawResponse = await request.promise;

      if (destroyed || currentRequestId !== requestId) {
        throw createAbortError();
      }

      if (activeRequest === request) {
        activeRequest = null;
      }

      const normalized = await normalizeResponse(rawResponse, {
        state,
        requestOptions,
      });

      if (!isObject(normalized)) {
        throw new TypeError("normalizeResponse() must return an object.");
      }

      return {
        rows: Array.isArray(normalized.rows) ? normalized.rows : [],

        meta: isObject(normalized.meta) ? normalized.meta : {},

        raw: "raw" in normalized ? normalized.raw : rawResponse,
      };
    } catch (error) {
      if (activeRequest === request) {
        activeRequest = null;
      }

      if (
        destroyed ||
        currentRequestId !== requestId ||
        error?.name === "AbortError"
      ) {
        throw createAbortError();
      }

      throw normalizeError(error, {
        state,
        requestOptions,
      });
    }
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
    cancel,
    destroy,
    load,

    isLoading() {
      return Boolean(activeRequest);
    },
  });
}
