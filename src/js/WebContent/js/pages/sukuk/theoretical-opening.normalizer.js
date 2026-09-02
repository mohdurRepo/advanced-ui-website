/* ==========================================================================
   Theoretical Opening Normalizer
   ========================================================================== */

/*
 * Normalizes all supported legacy Theoretical Opening response shapes
 * into one canonical structure.
 */

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

/* ==========================================================================
   Aliases
   ========================================================================== */

const FIELD_ALIASES = Object.freeze({
  companyName: ["companyName", "acrynomName", "company", "name", "issuerName"],

  companyCode: [
    "symbol",
    "companyCode",
    "companySymbol",
    "companyRef",
    "issuerCode",
  ],

  companyUrl: ["companyURL", "companyUrl", "url"],

  sectorName: ["sectorName", "sector", "sectorDescription"],

  previousClose: [
    "prev_close",
    "previousClose",
    "previousClosePrice",
    "prevClose",
    "previousClosingPrice",
    "closePrice",
  ],

  top: [
    "top",
    "TOP",
    "theoreticalOpeningPrice",
    "theoreticalPrice",
    "indicativeOpeningPrice",
    "openingPrice",
  ],

  tov: [
    "tov",
    "TOV",
    "theoreticalOpeningVolume",
    "theoreticalVolume",
    "indicativeOpeningVolume",
    "openingVolume",
  ],
});

/* ==========================================================================
   Response Rows
   ========================================================================== */

export function getTheoreticalOpeningResponseRows(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.content)) {
    return response.data.content;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  if (Array.isArray(response?.result)) {
    return response.result;
  }

  /*
   * Defensive support for APIs that return the plural form.
   * Legacy Theoretical Opening uses `result`, but accepting
   * `results` does not alter that contract.
   */

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  if (Array.isArray(response?.content)) {
    return response.content;
  }

  return [];
}

/* ==========================================================================
   Row Normalization
   ========================================================================== */

export function normalizeTheoreticalOpeningRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  return {
    ...row,

    companyName: getFirstValue(row, FIELD_ALIASES.companyName, "-"),

    companyCode: getFirstValue(row, FIELD_ALIASES.companyCode, "-"),

    companyUrl: getFirstValue(row, FIELD_ALIASES.companyUrl, ""),

    sectorName: getFirstValue(row, FIELD_ALIASES.sectorName, ""),

    previousClose: getFirstValue(row, FIELD_ALIASES.previousClose, null),

    top: getFirstValue(row, FIELD_ALIASES.top, null),

    tov: getFirstValue(row, FIELD_ALIASES.tov, null),
  };
}

/* ==========================================================================
   Metadata
   ========================================================================== */

function getResponseTotal(response, rows) {
  const total = Number(
    response?.total ??
      response?.recordsTotal ??
      response?.recordsFiltered ??
      response?.data?.total ??
      response?.data?.totalElements ??
      rows.length,
  );

  return Number.isFinite(total) ? total : rows.length;
}

function getResponseUpdatedAt(response) {
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
   Response Normalization
   ========================================================================== */

export function normalizeTheoreticalOpeningResponse(response) {
  const rows = getTheoreticalOpeningResponseRows(response)
    .map(normalizeTheoreticalOpeningRow)
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
