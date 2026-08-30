/* ==========================================================================
   Sukuk Normalizer
   ========================================================================== */

/*
 * Sukuk & Bonds API response normalization.
 *
 * Responsibilities:
 *
 * - accept supported backend response shapes
 * - normalize row identity fields
 * - normalize total count metadata
 * - normalize last-updated metadata
 * - preserve the original backend response
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - DataTables lifecycle
 * - request execution
 * - filter state
 * - rendering
 */

import {
  getInstrumentName,
  getInstrumentReference,
} from "./sukuk.formatters.js";

/* ==========================================================================
   Response Rows
   ========================================================================== */

export function getSukukResponseRows(response) {
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

/* ==========================================================================
   Row Normalization
   ========================================================================== */

export function normalizeSukukRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  return {
    ...row,

    instrumentRef: getInstrumentReference(row),

    instrumentName: getInstrumentName(row),
  };
}

/* ==========================================================================
   Total
   ========================================================================== */

function getResponseTotal(response, rows) {
  const total = Number(
    response?.total ??
      response?.recordsTotal ??
      response?.recordsFiltered ??
      rows.length,
  );

  return Number.isFinite(total) ? total : rows.length;
}

/* ==========================================================================
   Updated At
   ========================================================================== */

function getResponseUpdatedAt(response) {
  return (
    response?.updatedAt ?? response?.lastUpdated ?? response?.timestamp ?? null
  );
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

export function normalizeSukukResponse(response) {
  const rows = getSukukResponseRows(response)
    .map(normalizeSukukRow)
    .filter(Boolean);

  return {
    rows,

    meta: {
      total: getResponseTotal(response, rows),

      updatedAt: getResponseUpdatedAt(response),
    },

    raw: response,
  };
}
