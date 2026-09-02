/* ==========================================================================
   Accumulated Losses Normalizer
   ========================================================================== */

/*
 * Response normalization for the Accumulated Losses tab.
 *
 * Responsibilities:
 *
 * - parse legacy response envelopes
 * - normalize company name, code, URL, logo, and status
 * - preserve the original response row
 * - provide consistent result metadata
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - filtering behavior
 * - request construction
 * - content-feed rendering
 * - pagination behavior
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "accumulatedLosses";

const RESPONSE_ROW_KEYS = Object.freeze([
  "rows",
  "data",
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
  if (value == null || typeof value === "object") {
    return "";
  }

  return String(value).trim();
}

function getFirstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined && value !== null && normalizeString(value) !== "",
  );
}

function getFirstString(...values) {
  return normalizeString(getFirstValue(...values));
}

function createSafeKey(value, fallback = "company") {
  const normalized = normalizeString(value)
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit));
}

function normalizeNumericValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = normalizeDigits(value)
    .trim()
    .replaceAll(",", "")
    .replaceAll("٬", "");

  if (!normalized) {
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
    throw new TypeError(
      "Accumulated Losses received an invalid JSON response.",
    );
  }
}

/* ==========================================================================
   Row Extraction
   ========================================================================== */

function extractResponseRows(response, depth = 0) {
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

    const value = parseResponseValue(parsedResponse[key]);

    if (Array.isArray(value)) {
      return value;
    }

    if (isObject(value)) {
      const nestedRows = extractResponseRows(value, depth + 1);

      if (nestedRows.length) {
        return nestedRows;
      }
    }
  }

  return [];
}

/* ==========================================================================
   Metadata
   ========================================================================== */

function findExplicitTotal(response, rawRows) {
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
      );
    }
  }

  if (isObject(rawRows[0])) {
    candidates.push(
      rawRows[0].count,
      rawRows[0].totalCount,
      rawRows[0].recordsTotal,
    );
  }

  for (const candidate of candidates) {
    const total = normalizeNumericValue(candidate);

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
    getFirstValue(
      parsedResponse.updatedAt,
      parsedResponse.lastUpdated,
      parsedResponse.timestamp,
      parsedResponse.meta?.updatedAt,
      parsedResponse.meta?.lastUpdated,
    ) ?? null
  );
}

/* ==========================================================================
   Company Normalization
   ========================================================================== */

function normalizeCompanyRow(row, index) {
  const companyObject = isObject(row.company) ? row.company : {};

  const companyCode = getFirstString(
    row.symbolCode,
    row.symbol,
    row.companyCode,
    row.companyRef,
    row.securityCode,
    row.code,

    companyObject.symbolCode,
    companyObject.symbol,
    companyObject.companyCode,
    companyObject.companyRef,
    companyObject.securityCode,
    companyObject.code,
  );

  const companyName = getFirstString(
    row.companyName,

    typeof row.company === "string" ? row.company : null,

    row.longName,
    row.shortName,
    row.name,
    row.acrynomName,
    row.acronymName,
    row.securityName,

    companyObject.companyName,
    companyObject.longName,
    companyObject.shortName,
    companyObject.name,
    companyObject.acrynomName,
    companyObject.acronymName,
    companyObject.securityName,

    companyCode,
  );

  const companyUrl = getFirstString(
    row.companyURL,
    row.companyUrl,
    row.pageUrl,
    row.securityUrl,
    row.url,

    companyObject.companyURL,
    companyObject.companyUrl,
    companyObject.pageUrl,
    companyObject.securityUrl,
    companyObject.url,
  );

  const companyLogoUrl = getFirstString(
    row.companyLogoUrl,
    row.logoUrl,
    row.companyImageUrl,
    row.imageUrl,

    companyObject.companyLogoUrl,
    companyObject.logoUrl,
    companyObject.companyImageUrl,
    companyObject.imageUrl,
  );

  const companyStatus = getFirstString(
    row.companyStatus,
    row.status,
    row.lossStatus,
    row.lossCategory,
    row.percentage,

    companyObject.companyStatus,
    companyObject.status,
    companyObject.lossStatus,
    companyObject.lossCategory,
    companyObject.percentage,
  );

  const sourceId = getFirstString(
    row.id,
    row.rowId,
    row.companyId,
    row.securityId,
  );

  return {
    id:
      sourceId ||
      [
        VIEW_KEY,
        createSafeKey(companyCode || companyName, "company"),
        index,
      ].join("-"),

    rowType: "company",

    companyCode,
    companyName,
    companyUrl,
    companyLogoUrl,
    companyStatus,

    raw: row,
  };
}

/* ==========================================================================
   Public Normalizer
   ========================================================================== */

export function normalizeAccumulatedLossesResponse(response) {
  const rawRows = extractResponseRows(response);

  const rows = rawRows
    .filter(isObject)
    .map(normalizeCompanyRow)
    .filter((row) => row.companyCode || row.companyName);

  const explicitTotal = findExplicitTotal(response, rawRows);

  return {
    rows,

    meta: {
      total: explicitTotal !== null ? explicitTotal : rows.length,

      recordCount: rows.length,

      normalizedCount: rows.length,

      view: VIEW_KEY,

      updatedAt: findUpdatedAt(response),
    },

    raw: response,
  };
}
