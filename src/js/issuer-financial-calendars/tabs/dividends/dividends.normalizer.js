/* ==========================================================================
   Dividends Normalizer
   ========================================================================== */

/*
 * Response normalization for the Dividends calendar.
 *
 * Responsibilities:
 *
 * - parse legacy JSON-string and object response envelopes
 * - normalize company identity fields
 * - preserve service-provided dates for display
 * - create independent numeric date-sort values
 * - normalize the dividend amount
 * - provide stable row identifiers
 * - return consistent result metadata
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - display formatting
 * - filter behavior
 * - request implementation
 * - DataTables configuration
 * - card rendering
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const RESPONSE_ROW_KEYS = Object.freeze([
  "rows",

  "data",

  "results",

  "items",

  "aaData",

  "dividends",

  "dividendList",
]);

const RESPONSE_TOTAL_KEYS = Object.freeze([
  "total",

  "totalCount",

  "recordsTotal",

  "recordsFiltered",

  "recordCount",

  "count",
]);

const MAX_RESPONSE_DEPTH = 5;

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

function getFirstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined && value !== null && normalizeString(value) !== "",
  );
}

function getFirstString(...values) {
  return normalizeString(getFirstValue(...values));
}

function createSafeKey(value, fallback = "item") {
  const normalized = normalizeString(value)
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

/* ==========================================================================
   Numeric Normalization
   ========================================================================== */

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function normalizeNumericValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = normalizeDigits(value)
    .trim()
    .replaceAll(",", "")
    .replaceAll("٬", "")
    .replaceAll("٫", ".")
    .replaceAll("−", "-")
    .replace(/\s+/g, "");

  if (!normalized || normalized === "-") {
    return null;
  }

  const numericValue = Number(normalized);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeCount(value) {
  const count = normalizeNumericValue(value);

  if (count === null || count < 0) {
    return null;
  }

  return Math.trunc(count);
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
    throw new TypeError("Dividends received an invalid JSON response.");
  }
}

/* ==========================================================================
   Response Row Extraction
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

    const candidate = parseResponseValue(parsedResponse[key]);

    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (isObject(candidate)) {
      const nestedRows = extractResponseRows(candidate, depth + 1);

      if (nestedRows.length) {
        return nestedRows;
      }
    }
  }

  return [];
}

/* ==========================================================================
   Response Total Extraction
   ========================================================================== */

function extractResponseTotal(response, depth = 0) {
  if (depth > MAX_RESPONSE_DEPTH) {
    return null;
  }

  const parsedResponse = parseResponseValue(response);

  if (!isObject(parsedResponse)) {
    return null;
  }

  for (const key of RESPONSE_TOTAL_KEYS) {
    if (!(key in parsedResponse)) {
      continue;
    }

    const count = normalizeCount(parsedResponse[key]);

    if (count !== null) {
      return count;
    }
  }

  for (const key of RESPONSE_ROW_KEYS) {
    if (!(key in parsedResponse)) {
      continue;
    }

    const candidate = parseResponseValue(parsedResponse[key]);

    if (!isObject(candidate)) {
      continue;
    }

    const nestedTotal = extractResponseTotal(candidate, depth + 1);

    if (nestedTotal !== null) {
      return nestedTotal;
    }
  }

  return null;
}

/* ==========================================================================
   Date Sort Value
   ========================================================================== */

/*
 * Do not alter the date text returned by the service.
 *
 * Parsing exists only to generate a numeric sorting value for DataTables.
 */

function getDateSortValue(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return 0;
  }

  let match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\D.*)?$/);

  let year;
  let month;
  let day;

  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\D.*)?$/);

    if (!match) {
      return 0;
    }

    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return 0;
  }

  return date.getTime();
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

function normalizeCompany(row = {}) {
  const companyObject = isObject(row.company) ? row.company : {};

  const companyCode = getFirstString(
    row.symbol,
    row.companyCode,
    row.symbolCode,
    row.companySymbol,
    row.compSymbolCode,
    row.code,

    companyObject.symbol,
    companyObject.companyCode,
    companyObject.symbolCode,
    companyObject.companySymbol,
    companyObject.compSymbolCode,
    companyObject.code,
  );

  const companyName = getFirstString(
    typeof row.company === "string" ? row.company : null,

    row.companyName,
    row.longName,
    row.name,

    companyObject.companyName,
    companyObject.longName,
    companyObject.name,

    companyCode,
  );

  const companyUrl = getFirstString(
    row.companyUrl,
    row.companyURL,
    row.url,

    companyObject.companyUrl,
    companyObject.companyURL,
    companyObject.url,
  );

  return Object.freeze({
    companyCode,

    companyName,

    companyUrl,
  });
}

/* ==========================================================================
   Dividend Row
   ========================================================================== */

function normalizeDividendRow(row, index) {
  if (!isObject(row)) {
    return null;
  }

  const company = normalizeCompany(row);

  const announcementDate = getFirstString(
    row.announcedDate,
    row.announcementDate,
    row.announceDate,
  );

  const dueDate = getFirstString(
    row.dueDate,
    row.entitlementDate,
    row.eligibilityDate,
  );

  const distributionMethod = getFirstString(
    row.distributionWay,
    row.distributionMethod,
    row.paymentMethod,
  );

  const distributionDate = getFirstString(
    row.distributionDate,
    row.paymentDate,
  );

  const amountValue = normalizeNumericValue(
    getFirstValue(
      row.amountValue,
      row.amount,
      row.dividendAmount,
      row.distributedAmount,
    ),
  );

  const sourceId = getFirstString(
    row.id,
    row.dividendId,
    row.eventId,
    row.referenceId,
  );

  const id = [
    "dividend",

    createSafeKey(sourceId, "record"),

    createSafeKey(company.companyCode, "company"),

    createSafeKey(dueDate || announcementDate, "date"),

    index,
  ].join("-");

  return Object.freeze({
    id,

    rowType: "dividend",

    companyCode: company.companyCode,

    companyName: company.companyName,

    companyUrl: company.companyUrl,

    announcementDate,

    announcementDateSort: getDateSortValue(announcementDate),

    dueDate,

    dueDateSort: getDateSortValue(dueDate),

    distributionMethod,

    distributionDate,

    distributionDateSort: getDateSortValue(distributionDate),

    amountValue,

    /*
     * Keep the original service names as read-only compatibility aliases.
     */

    announcedDate: announcementDate,

    distributionWay: distributionMethod,

    raw: row,
  });
}

/* ==========================================================================
   Public Normalizer
   ========================================================================== */

export function normalizeDividendsResponse(response) {
  const sourceRows = extractResponseRows(response);

  const rows = sourceRows.map(normalizeDividendRow).filter(Boolean);

  const explicitTotal = extractResponseTotal(response);

  const total = explicitTotal ?? rows.length;

  return Object.freeze({
    rows: Object.freeze(rows),

    meta: Object.freeze({
      total,

      recordCount: rows.length,
    }),
  });
}
