/* ==========================================================================
   OTC Trading Normalizer
   ========================================================================== */

/*
 * Response normalization for OTC Trading.
 *
 * Responsibilities:
 *
 * - parse legacy JSON response strings safely
 * - extract rows from supported response envelopes
 * - normalize company identity values
 * - normalize traded volume
 * - preserve the service-provided last-update value
 * - provide stable sorting values
 * - normalize response metadata
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - table rendering
 * - card rendering
 * - request lifecycle
 * - DataTables configuration
 *
 * JSON parsing is deliberately bounded. Malformed or unexpectedly nested
 * responses cannot cause recursive or infinite processing.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  getDateSortValue,
  normalizeString,
  toNumber,
} from "../../../../shared/trading/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const MAX_JSON_PARSE_DEPTH = 3;

const ROW_COLLECTION_KEYS = Object.freeze([
  "data",
  "rows",
  "results",
  "items",
  "aaData",
  "records",
  "response",
]);

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function getFirstString(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function normalizeNumericValue(value) {
  const number = toNumber(value);

  return number === null ? null : number;
}

function normalizeCount(value, fallback = null) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return Math.floor(number);
}

/* ==========================================================================
   Safe Keys
   ========================================================================== */

function createSafeKey(value, fallback = "item") {
  const normalized = normalizeString(value)
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

/* ==========================================================================
   Bounded JSON Parsing
   ========================================================================== */

/*
 * Some legacy endpoints return:
 *
 * - an array
 * - an object
 * - a JSON string
 * - a JSON string containing another JSON string
 *
 * Parsing is capped at three levels. This avoids unbounded processing when
 * an invalid service response repeatedly contains encoded values.
 */

function parseResponseValue(value) {
  let currentValue = value;

  for (let depth = 0; depth < MAX_JSON_PARSE_DEPTH; depth += 1) {
    if (typeof currentValue !== "string") {
      break;
    }

    const normalized = currentValue.trim();

    if (!normalized) {
      return null;
    }

    try {
      currentValue = JSON.parse(normalized);
    } catch {
      return currentValue;
    }
  }

  return currentValue;
}

/* ==========================================================================
   Row Extraction
   ========================================================================== */

function extractArray(value) {
  const parsedValue = parseResponseValue(value);

  return Array.isArray(parsedValue) ? parsedValue : null;
}

function extractRowsFromObject(response) {
  for (const key of ROW_COLLECTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(response, key)) {
      continue;
    }

    const directRows = extractArray(response[key]);

    if (directRows) {
      return directRows;
    }
  }

  /*
   * Support one additional envelope level without recursive traversal.
   *
   * Examples:
   *
   * {
   *   data: {
   *     rows: [...]
   *   }
   * }
   *
   * {
   *   response: {
   *     results: [...]
   *   }
   * }
   */

  for (const outerKey of ROW_COLLECTION_KEYS) {
    const nestedResponse = parseResponseValue(response[outerKey]);

    if (!isObject(nestedResponse)) {
      continue;
    }

    for (const innerKey of ROW_COLLECTION_KEYS) {
      const nestedRows = extractArray(nestedResponse[innerKey]);

      if (nestedRows) {
        return nestedRows;
      }
    }
  }

  return [];
}

function extractResponseRows(response) {
  const parsedResponse = parseResponseValue(response);

  if (Array.isArray(parsedResponse)) {
    return parsedResponse;
  }

  if (!isObject(parsedResponse)) {
    return [];
  }

  return extractRowsFromObject(parsedResponse);
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

function normalizeCompanyIdentity(row = {}) {
  /*
   * OTC historically exposes `symbol`.
   *
   * companyRef and symbolCode are accepted first when supplied because they
   * are normally the stable codes used by the production logo service.
   */

  const companyCode = getFirstString(
    row.companyRef,
    row.symbolCode,
    row.symbol,
    row.companyCode,
    row.code,
  );

  const companyName = getFirstString(
    row.companyName,
    row.company,
    row.name,
    row.longName,
    row.acrynomName,
    companyCode,
  );

  const companyUrl = getFirstString(
    row.companyURL,
    row.companyUrl,
    row.pageUrl,
    row.url,
  );

  const companyLogoUrl = getFirstString(
    row.companyLogoUrl,
    row.logoUrl,
    row.imageUrl,
    row.companyImageUrl,
  );

  return {
    companyCode,
    companyName,
    companyUrl,
    companyLogoUrl,
  };
}

/* ==========================================================================
   Traded Volume
   ========================================================================== */

function normalizeTradedVolume(row = {}) {
  const raw = firstDefined(
    row.lastTradeVolume,
    row.tradedVolume,
    row.tradeVolume,
    row.volume,
  );

  return {
    raw: raw ?? "",

    value: normalizeNumericValue(raw),
  };
}

/* ==========================================================================
   Last Update
   ========================================================================== */

function getTimeSortValue(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return "";
  }

  const match = normalized.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  if (!match) {
    return "";
  }

  const hours = Number(match[1]);

  const minutes = Number(match[2]);

  const seconds = Number(match[3] || 0);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return "";
  }

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join("");
}

function getLastUpdateSortValue(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return "";
  }

  const dateSortValue = getDateSortValue(normalized);

  const timeSortValue = getTimeSortValue(normalized);

  if (dateSortValue || timeSortValue) {
    return `${dateSortValue}${timeSortValue}`;
  }

  return normalized.toLocaleLowerCase();
}

function normalizeLastUpdate(row = {}) {
  const raw = getFirstString(
    row.lastTradeDate,
    row.lastUpdateDate,
    row.lastUpdated,
    row.lastUpdate,
    row.updatedAt,
  );

  return {
    raw,

    sort: getLastUpdateSortValue(raw),
  };
}

/* ==========================================================================
   OTC Trading Row
   ========================================================================== */

function normalizeOtcTradingRow(row, index) {
  const identity = normalizeCompanyIdentity(row);

  const tradedVolume = normalizeTradedVolume(row);

  const lastUpdate = normalizeLastUpdate(row);

  const sourceId = getFirstString(
    row.id,
    row.companyId,
    row.securityId,
    row.companyRef,
    row.symbolCode,
    row.symbol,
  );

  const identityKey = createSafeKey(
    identity.companyCode || identity.companyName,
    "company",
  );

  return {
    id: sourceId || `otc-trading-${identityKey}-${index}`,

    rowType: "otc-trading",

    companyCode: identity.companyCode,

    companyName: identity.companyName,

    companyUrl: identity.companyUrl,

    companyLogoUrl: identity.companyLogoUrl,

    tradedVolume,

    /*
     * Preserve the exact last-update value returned by the service.
     * Presentation formatting is handled separately.
     */

    lastUpdate,

    raw: row,
  };
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
    const total = normalizeCount(candidate);

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
    ) ?? null
  );
}

/* ==========================================================================
   Public Response Normalizer
   ========================================================================== */

export function normalizeOtcTradingResponse(response) {
  const rawRows = extractResponseRows(response);

  const rows = rawRows.filter(isObject).map(normalizeOtcTradingRow);

  const explicitTotal = findExplicitTotal(response, rawRows);

  return {
    rows,

    meta: {
      total: explicitTotal === null ? rows.length : explicitTotal,

      updatedAt: findUpdatedAt(response),
    },

    raw: response,
  };
}
