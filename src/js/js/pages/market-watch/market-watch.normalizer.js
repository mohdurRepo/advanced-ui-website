/* ==========================================================================
   Market Watch Normalizer
   ========================================================================== */

/*
 * Response normalization for Market Watch.
 *
 * Responsibilities:
 *
 * - parse supported response envelopes
 * - normalize individual Market Watch rows
 * - preserve all backend fields required by the column definitions
 * - provide stable canonical company / sector aliases
 * - normalize response metadata
 * - return a consistent { rows, meta, raw } result
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - request implementation
 * - filter behavior
 * - table rendering
 * - card rendering
 * - DataTables configuration
 * - watchlist filtering
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const RESPONSE_ROW_KEYS = Object.freeze([
  "data",
  "rows",
  "results",
  "items",
  "aaData",
]);

const MAX_RESPONSE_DEPTH = 4;

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  if (value === null || value === undefined || typeof value === "object") {
    return "";
  }

  return String(value).trim();
}

function firstDefined(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      !(typeof value === "string" && value.trim() === ""),
  );
}

function normalizeNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value)
    .trim()
    .replaceAll(",", "")
    .replaceAll("٬", "")
    .replaceAll("٫", ".")
    .replaceAll("−", "-")
    .replace(/\s+/g, "");

  if (!normalized || normalized === "-" || normalized === "+") {
    return null;
  }

  const numericValue = Number(normalized);

  return Number.isFinite(numericValue) ? numericValue : null;
}

/* ==========================================================================
   JSON Parsing
   ========================================================================== */

function parseResponseValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();

  if (!normalized) {
    return [];
  }

  try {
    return JSON.parse(normalized);
  } catch {
    throw new TypeError("Market Watch received an invalid JSON response.");
  }
}

/* ==========================================================================
   Response Row Extraction
   ========================================================================== */

function extractRows(response, depth = 0) {
  if (depth > MAX_RESPONSE_DEPTH) {
    return [];
  }

  const parsedResponse = parseResponseValue(response);

  if (Array.isArray(parsedResponse)) {
    return parsedResponse;
  }

  if (!isObject(parsedResponse)) {
    return [];
  }

  for (const key of RESPONSE_ROW_KEYS) {
    if (!(key in parsedResponse)) {
      continue;
    }

    const candidate = parseResponseValue(parsedResponse[key]);

    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (isObject(candidate)) {
      const nestedRows = extractRows(candidate, depth + 1);

      if (nestedRows.length) {
        return nestedRows;
      }
    }
  }

  return [];
}

/* ==========================================================================
   Company Normalization
   ========================================================================== */

function normalizeCompany(row = {}) {
  const companyRef = normalizeString(
    firstDefined(
      row.companyRef,
      row.companySymbol,
      row.symbol,
      row.companyCode,
    ),
  );

  const companySymbol = normalizeString(
    firstDefined(
      row.companySymbol,
      row.symbol,
      row.companyRef,
      row.companyCode,
    ),
  );

  const companyCode = normalizeString(
    firstDefined(
      row.companyCode,
      row.companyRef,
      row.companySymbol,
      row.symbol,
    ),
  );

  const companyName = normalizeString(
    firstDefined(
      row.acrynomName,
      row.companyName,
      row.company,
      row.name,
      companySymbol,
      companyCode,
    ),
  );

  const companyUrl = normalizeString(
    firstDefined(row.companyUrl, row.companyURL, row.url),
  );

  return {
    companyRef,
    companySymbol,
    companyCode,
    companyName,
    companyUrl,
  };
}

/* ==========================================================================
   Sector Normalization
   ========================================================================== */

function normalizeSector(row = {}) {
  return normalizeString(
    firstDefined(row.sectorName, row.sector, row.industryName, row.industry),
  );
}

/* ==========================================================================
   Watchlist Normalization
   ========================================================================== */

function normalizeWatchlistValue(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = normalizeString(value).toLowerCase();

  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y"
  );
}

/* ==========================================================================
   Row Normalization
   ========================================================================== */

/*
 * Keep the backend row intact.
 *
 * Market Watch has many backend-driven fields that are consumed directly by
 * the column definitions. The normalizer therefore adds canonical aliases
 * rather than rebuilding every row from scratch.
 */

export function normalizeMarketWatchRow(row = {}) {
  if (!isObject(row)) {
    return null;
  }

  const company = normalizeCompany(row);

  return {
    ...row,

    ...company,

    sectorName: normalizeSector(row),

    watchlist: normalizeWatchlistValue(
      firstDefined(
        row.watchlist,
        row.isWatchlist,
        row.isWatchList,
        row.watchList,
      ),
    ),
  };
}

/* ==========================================================================
   Metadata
   ========================================================================== */

function findExplicitTotal(response, rows) {
  const parsedResponse = parseResponseValue(response);

  const candidates = [];

  if (isObject(parsedResponse)) {
    candidates.push(
      parsedResponse.total,
      parsedResponse.count,
      parsedResponse.totalCount,
      parsedResponse.recordsTotal,
      parsedResponse.recordsFiltered,
    );

    if (isObject(parsedResponse.meta)) {
      candidates.push(
        parsedResponse.meta.total,
        parsedResponse.meta.count,
        parsedResponse.meta.totalCount,
        parsedResponse.meta.recordsTotal,
      );
    }
  }

  if (isObject(rows[0])) {
    candidates.push(rows[0].count, rows[0].totalCount, rows[0].recordsTotal);
  }

  for (const candidate of candidates) {
    const total = normalizeNumber(candidate);

    if (total !== null) {
      return total;
    }
  }

  return null;
}

function findUpdatedAt(response) {
  const parsedResponse = parseResponseValue(response);

  if (!isObject(parsedResponse)) {
    return null;
  }

  return (
    firstDefined(
      parsedResponse.updatedAt,
      parsedResponse.lastUpdated,
      parsedResponse.timestamp,
      parsedResponse.meta?.updatedAt,
      parsedResponse.meta?.lastUpdated,
      parsedResponse.meta?.timestamp,
    ) ?? null
  );
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

export function normalizeMarketWatchResponse(response) {
  const rawRows = extractRows(response);

  const rows = rawRows.map(normalizeMarketWatchRow).filter(Boolean);

  const explicitTotal = findExplicitTotal(response, rawRows);

  return {
    rows,

    meta: {
      total: explicitTotal !== null ? explicitTotal : rows.length,

      recordCount: rows.length,

      updatedAt: findUpdatedAt(response),
    },

    raw: response,
  };
}
