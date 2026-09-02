/* ==========================================================================
   Theoretical Opening Normalizer
   ========================================================================== */

import { THEORETICAL_OPENING_FIELDS } from "./theoretical-opening.columns.js";

/* ==========================================================================
   Helpers
   ========================================================================== */

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function getFirstValue(source, aliases = [], fallback = "") {
  const row =
    source && typeof source === "object" && !Array.isArray(source)
      ? source
      : {};

  for (const key of aliases) {
    if (hasValue(row[key])) {
      return row[key];
    }
  }

  return fallback;
}

function getFieldValue(row, field) {
  return getFirstValue(row, field.aliases, field.fallback);
}

/* ==========================================================================
   Response Rows
   ========================================================================== */

export function getTheoreticalOpeningRows(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (!response) {
    return [];
  }

  /*
   * Preserve all response shapes
   * supported by the legacy page.
   */

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (response.data && Array.isArray(response.data.content)) {
    return response.data.content;
  }

  if (Array.isArray(response.rows)) {
    return response.rows;
  }

  if (Array.isArray(response.result)) {
    return response.result;
  }

  if (Array.isArray(response.content)) {
    return response.content;
  }

  return [];
}

/* ==========================================================================
   Row Normalization
   ========================================================================== */

export function normalizeTheoreticalOpeningRow(row = {}) {
  return {
    companyName: getFieldValue(row, THEORETICAL_OPENING_FIELDS.companyName),

    companyCode: getFieldValue(row, THEORETICAL_OPENING_FIELDS.companyCode),

    companyUrl: getFieldValue(row, THEORETICAL_OPENING_FIELDS.companyUrl),

    sectorName: getFieldValue(row, THEORETICAL_OPENING_FIELDS.sectorName),

    previousClose: getFieldValue(row, THEORETICAL_OPENING_FIELDS.previousClose),

    theoreticalOpeningPrice: getFieldValue(
      row,
      THEORETICAL_OPENING_FIELDS.theoreticalOpeningPrice,
    ),

    theoreticalOpeningVolume: getFieldValue(
      row,
      THEORETICAL_OPENING_FIELDS.theoreticalOpeningVolume,
    ),
  };
}

/* ==========================================================================
   Collection Normalization
   ========================================================================== */

export function normalizeTheoreticalOpeningRows(response) {
  return getTheoreticalOpeningRows(response)
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map(normalizeTheoreticalOpeningRow);
}

/* ==========================================================================
   Response Metadata
   ========================================================================== */

function getResponseTotal(response, rows) {
  const candidates = [
    response?.total,
    response?.recordsTotal,
    response?.recordsFiltered,
    response?.data?.total,
    response?.data?.totalElements,
  ];

  for (const value of candidates) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const number = Number(value);

    if (Number.isFinite(number) && number >= 0) {
      return number;
    }
  }

  return rows.length;
}

function getUpdatedAt(response) {
  return (
    response?.updatedAt ??
    response?.lastUpdated ??
    response?.timestamp ??
    response?.data?.updatedAt ??
    response?.data?.lastUpdated ??
    response?.data?.timestamp ??
    null
  );
}

/* ==========================================================================
   Complete Response Normalization
   ========================================================================== */

export function normalizeTheoreticalOpeningResponse(response) {
  const rows = normalizeTheoreticalOpeningRows(response);

  return {
    rows,

    meta: {
      total: getResponseTotal(response, rows),

      updatedAt: getUpdatedAt(response),
    },

    raw: response,
  };
}
