/* ==========================================================================
   Theoretical Opening Normalizer
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - normalize supported response containers
 * - normalize rows into the feature's canonical field names
 * - expose total / updatedAt metadata
 *
 * Shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 */

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

/* ==========================================================================
   Rows
   ========================================================================== */

function getResponseRows(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (!isObject(response)) {
    return [];
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.rows)) {
    return response.rows;
  }

  if (Array.isArray(response.results)) {
    return response.results;
  }

  return [];
}

function normalizeRow(row) {
  if (!isObject(row)) {
    return null;
  }

  return {
    ...row,

    companyName: firstDefined(row.companyName, ""),

    previousClose: firstDefined(row.previousClose, ""),

    top: firstDefined(row.top, ""),

    tov: firstDefined(row.tov, ""),
  };
}

/* ==========================================================================
   Metadata
   ========================================================================== */

function getTotal(response, rows) {
  if (!isObject(response)) {
    return rows.length;
  }

  const total = firstDefined(
    response.total,
    response.recordsTotal,
    response.recordsFiltered,
  );

  const number = Number(total);

  return Number.isFinite(number) ? number : rows.length;
}

function getUpdatedAt(response) {
  if (!isObject(response)) {
    return null;
  }

  return firstDefined(
    response.updatedAt,
    response.lastUpdated,
    response.timestamp,
    null,
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function normalizeTheoreticalOpeningResponse(response) {
  const rows = getResponseRows(response).map(normalizeRow).filter(Boolean);

  return {
    rows,

    meta: {
      total: getTotal(response, rows),

      updatedAt: getUpdatedAt(response),
    },

    raw: response,
  };
}
