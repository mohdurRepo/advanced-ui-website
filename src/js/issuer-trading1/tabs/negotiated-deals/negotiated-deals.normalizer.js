/* ==========================================================================
   Negotiated Deals Normalizer
   ========================================================================== */

/*
 * Response normalization for:
 *
 * - Negotiated Deals
 * - Main Market Minimum Size Requirements
 *
 * Responsibilities:
 *
 * - parse legacy response envelopes
 * - normalize Negotiated Deals rows
 * - preserve service-provided daily total rows
 * - normalize Minimum Size company cells
 * - resolve the requested view safely
 * - provide consistent result metadata
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - display formatting
 * - DataTables configuration
 * - card rendering
 * - client-side financial calculations
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  getNegotiatedDealsView,
  NEGOTIATED_DEALS_VIEWS,
} from "./negotiated-deals.filters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const RESPONSE_ROW_KEYS = Object.freeze([
  "rows",
  "data",
  "results",
  "items",
  "aaData",
]);

const TOTAL_ROW_TYPES = new Set([
  "total",
  "summary",
  "subtotal",
  "daily-total",
  "daily_total",
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
    .replaceAll("٬", "")
    .replaceAll("−", "-");

  if (!normalized) {
    return null;
  }

  const numericValue = Number(normalized);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeBoolean(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = normalizeString(value).toLowerCase();

  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function createSafeKey(value, fallback = "item") {
  const normalized = normalizeString(value)
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || fallback;
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
    throw new TypeError("Issuer Trading received an invalid JSON response.");
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

function findExplicitTotal(response, rows) {
  const parsedResponse = parseResponseValue(response);

  const candidates = [];

  if (isObject(parsedResponse)) {
    candidates.push(
      parsedResponse.total,
      parsedResponse.count,
      parsedResponse.recordsTotal,
      parsedResponse.recordsFiltered,
      parsedResponse.totalCount,
    );

    if (isObject(parsedResponse.meta)) {
      candidates.push(
        parsedResponse.meta.total,
        parsedResponse.meta.count,
        parsedResponse.meta.totalCount,
      );
    }
  }

  if (isObject(rows[0])) {
    candidates.push(rows[0].count, rows[0].totalCount, rows[0].recordsTotal);
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

function createResponseMeta({
  response,
  rawRows,
  rows,
  view,
  recordCount,
  summaryCount = 0,
  groupCount = 0,
}) {
  const explicitTotal = findExplicitTotal(response, rawRows);

  return {
    total: explicitTotal !== null ? explicitTotal : recordCount,

    recordCount,
    summaryCount,
    groupCount,

    view,

    updatedAt: findUpdatedAt(response),

    normalizedCount: rows.length,
  };
}

/* ==========================================================================
   Date Normalization
   ========================================================================== */

function getDateParts(value) {
  const normalized = normalizeDigits(value).trim();

  if (!normalized) {
    return null;
  }

  /*
   * ISO:
   *
   * YYYY-MM-DD
   * YYYY/MM/DD
   */

  let match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }

  /*
   * Legacy:
   *
   * DD-MM-YYYY
   * DD/MM/YYYY
   */

  match = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[3]),
    month: Number(match[2]),
    day: Number(match[1]),
  };
}

function isValidDateParts(parts) {
  if (!parts) {
    return false;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day
  );
}

function getFirstValidDate(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);

    if (normalized && isValidDateParts(getDateParts(normalized))) {
      return normalized;
    }
  }

  return "";
}

function getDateKey(value) {
  const parts = getDateParts(value);

  if (!isValidDateParts(parts)) {
    return createSafeKey(value, "undated");
  }

  const month = String(parts.month).padStart(2, "0");

  const day = String(parts.day).padStart(2, "0");

  return `${parts.year}-${month}-${day}`;
}

function getDateSortValue(value) {
  const parts = getDateParts(value);

  if (!isValidDateParts(parts)) {
    return 0;
  }

  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

/* ==========================================================================
   Company Normalization
   ========================================================================== */

function normalizeCompany(row = {}) {
  const companyObject = isObject(row.company) ? row.company : {};

  const companyCode = getFirstString(
    row.companyCode,
    row.symbol,
    row.code,
    row.securityCode,

    companyObject.companyCode,
    companyObject.symbol,
    companyObject.code,
    companyObject.securityCode,
  );

  const companyName = getFirstString(
    row.companyName,

    typeof row.company === "string" ? row.company : null,

    row.longName,
    row.name,
    row.securityName,

    companyObject.companyName,
    companyObject.longName,
    companyObject.name,
    companyObject.securityName,

    companyCode,
  );

  const companyUrl = getFirstString(
    row.companyURL,
    row.companyUrl,
    row.url,
    row.securityUrl,

    companyObject.companyURL,
    companyObject.companyUrl,
    companyObject.url,
    companyObject.securityUrl,
  );

  return {
    companyCode,
    companyName,
    companyUrl,
  };
}

/* ==========================================================================
   Total Row Detection
   ========================================================================== */

function isTotalRow(row = {}) {
  const rowType = normalizeString(row.rowType ?? row.type).toLowerCase();

  return (
    TOTAL_ROW_TYPES.has(rowType) ||
    normalizeBoolean(row.isTotal) ||
    normalizeBoolean(row.totalRow)
  );
}

/* ==========================================================================
   Negotiated Deal Row
   ========================================================================== */

function normalizeDealRow(row, index) {
  const company = normalizeCompany(row);

  const tradeDate = getFirstValidDate(
    row.tradeDate,
    row.strDate,
    row.date,
    row.transactionDate,
    row.dealDate,
  );

  const tradeTime = getFirstString(
    row.tradeTime,
    row.strTime,
    row.time,
    row.transactionTime,
    row.dealTime,
  );

  const price = normalizeNumericValue(
    getFirstValue(row.price, row.tradePrice, row.dealPrice),
  );

  const volume = normalizeNumericValue(
    getFirstValue(row.volume, row.tradeVolume, row.tradedVolume, row.quantity),
  );

  const value = normalizeNumericValue(
    getFirstValue(
      row.value,
      row.turnOver,
      row.turnover,
      row.tradeValue,
      row.tradedValue,
    ),
  );

  const sourceId = getFirstString(
    row.id,
    row.tradeId,
    row.dealId,
    row.transactionId,
  );

  const dateKey = getDateKey(tradeDate);

  return {
    id:
      sourceId ||
      [
        "deal",
        dateKey,
        createSafeKey(company.companyCode, "company"),
        createSafeKey(tradeTime, "time"),
        index,
      ].join("-"),

    rowType: "deal",

    tradeDate,
    tradeTime,

    dateKey,
    dateSort: getDateSortValue(tradeDate),

    companyCode: company.companyCode,
    companyName: company.companyName,
    companyUrl: company.companyUrl,

    price,
    volume,
    value,

    raw: row,
  };
}

/* ==========================================================================
   Negotiated Deal Total Row
   ========================================================================== */

function normalizeTotalRow(row, index, previousDate = "") {
  const tradeDate =
    getFirstString(
      row.tradeDate,
      row.strDate,
      row.date,
      row.transactionDate,
      row.dealDate,
    ) || previousDate;

  const volume = normalizeNumericValue(
    getFirstValue(
      row.volume,
      row.tradeVolume,
      row.tradedVolume,
      row.totalVolume,
      row.quantity,
    ),
  );

  const value = normalizeNumericValue(
    getFirstValue(
      row.value,
      row.turnOver,
      row.turnover,
      row.tradeValue,
      row.tradedValue,
      row.totalValue,
    ),
  );

  const dateKey = getDateKey(tradeDate);

  return {
    id: `total-${dateKey}-${index}`,

    rowType: "total",

    tradeDate,
    tradeTime: "",

    dateKey,
    dateSort: getDateSortValue(tradeDate),

    companyCode: "",
    companyName: "",
    companyUrl: "",

    price: null,
    volume,
    value,

    raw: row,
  };
}

/* ==========================================================================
   Negotiated Deals Response
   ========================================================================== */

export function normalizeNegotiatedDealsRowsResponse(response) {
  const rawRows = extractResponseRows(response);

  const rows = [];

  let previousDate = "";

  rawRows.forEach((rawRow, index) => {
    if (!isObject(rawRow)) {
      return;
    }

    if (isTotalRow(rawRow)) {
      rows.push(normalizeTotalRow(rawRow, index, previousDate));

      return;
    }

    const dealRow = normalizeDealRow(rawRow, index);

    const validTradeDate = getFirstValidDate(dealRow.tradeDate);

    if (validTradeDate) {
      previousDate = validTradeDate;
    }

    rows.push(dealRow);
  });

  const dealRows = rows.filter((row) => row.rowType === "deal");

  const summaryRows = rows.filter((row) => row.rowType === "total");

  const dateGroups = new Set(
    dealRows.map((row) => row.dateKey).filter(Boolean),
  );

  return {
    rows,

    meta: createResponseMeta({
      response,
      rawRows,
      rows,

      view: NEGOTIATED_DEALS_VIEWS.negotiatedDeals,

      recordCount: dealRows.length,

      summaryCount: summaryRows.length,

      groupCount: dateGroups.size,
    }),

    raw: response,
  };
}

/* ==========================================================================
   Minimum Size Cell
   ========================================================================== */

function normalizeMinimumSizeCell(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  /*
   * Some legacy responses may return a symbol directly rather than a company
   * object. Preserve it as a usable company identity.
   */

  if (!isObject(value)) {
    const companyCode = normalizeString(value);

    return companyCode
      ? {
          companyCode,

          companyName: companyCode,

          companyUrl: "",

          raw: value,
        }
      : null;
  }
  const company = normalizeCompany(value);

  const nestedCompany = isObject(value.company) ? value.company : {};

  const companyCode = getFirstString(
    value.symbolCode,
    nestedCompany.symbolCode,
    company.companyCode,
  );

  if (!companyCode && !company.companyName) {
    return null;
  }

  return {
    ...company,

    companyCode,

    raw: value,
  };
}

/* ==========================================================================
   Minimum Size Row
   ========================================================================== */

function getMinimumSizeColumn(row, position) {
  const columnKey = `col${position}`;

  const legacyColumnKey = `column${position}`;

  if (row[columnKey] !== undefined) {
    return row[columnKey];
  }

  if (row[legacyColumnKey] !== undefined) {
    return row[legacyColumnKey];
  }

  if (Array.isArray(row.cells)) {
    return row.cells[position - 1];
  }

  return null;
}

function normalizeMinimumSizeRow(row, index) {
  const firstColumn = normalizeMinimumSizeCell(getMinimumSizeColumn(row, 1));

  const secondColumn = normalizeMinimumSizeCell(getMinimumSizeColumn(row, 2));

  const thirdColumn = normalizeMinimumSizeCell(getMinimumSizeColumn(row, 3));

  const fourthColumn = normalizeMinimumSizeCell(getMinimumSizeColumn(row, 4));

  return {
    id: getFirstString(row.id, row.rowId) || `minimum-size-${index}`,

    rowType: "minimum-size",

    col1: firstColumn,
    col2: secondColumn,
    col3: thirdColumn,
    col4: fourthColumn,

    cells: [firstColumn, secondColumn, thirdColumn, fourthColumn],

    raw: row,
  };
}

/* ==========================================================================
   Minimum Size Response
   ========================================================================== */

export function normalizeMinimumSizeResponse(response) {
  const rawRows = extractResponseRows(response);

  const rows = rawRows.filter(isObject).map(normalizeMinimumSizeRow);

  return {
    rows,

    meta: createResponseMeta({
      response,
      rawRows,
      rows,

      view: NEGOTIATED_DEALS_VIEWS.minimumSize,

      recordCount: rows.length,
    }),

    raw: response,
  };
}

/* ==========================================================================
   Requested View Resolution
   ========================================================================== */

function normalizeExplicitView(value) {
  const normalized = normalizeString(value)
    .replace(/[\s_-]+/g, "")
    .toLowerCase();

  if (normalized === "minimumsize") {
    return NEGOTIATED_DEALS_VIEWS.minimumSize;
  }

  if (normalized === "negotiateddeals") {
    return NEGOTIATED_DEALS_VIEWS.negotiatedDeals;
  }

  return "";
}

function getRequestFilterState(context = {}) {
  /*
   * Do not use context.state here.
   *
   * context.state is the internal data-view state:
   *
   * {
   *   active,
   *   loading,
   *   sourceRows,
   *   visibleRows,
   *   meta,
   *   error
   * }
   *
   * It is not the request filter state.
   */

  const candidates = [
    context.requestFilters,

    context.filters,

    context.requestContext?.state,

    context.requestOptions?.filters,
  ];

  return (
    candidates.find(
      (candidate) =>
        isObject(candidate) &&
        Object.prototype.hasOwnProperty.call(candidate, "type"),
    ) || {}
  );
}

function resolveRequestedView(context = {}) {
  /*
   * createTradingTab() already resolves the canonical view and includes it
   * in the normalization context. Prefer that value when available.
   */

  const explicitView = normalizeExplicitView(context.view);

  if (explicitView) {
    return explicitView;
  }

  return getNegotiatedDealsView(getRequestFilterState(context));
}

/* ==========================================================================
   Combined Tab Normalizer
   ========================================================================== */

export function normalizeNegotiatedDealsResponse(response, context = {}) {
  const view = resolveRequestedView(context);

  if (view === NEGOTIATED_DEALS_VIEWS.minimumSize) {
    return normalizeMinimumSizeResponse(response);
  }

  return normalizeNegotiatedDealsRowsResponse(response);
}
