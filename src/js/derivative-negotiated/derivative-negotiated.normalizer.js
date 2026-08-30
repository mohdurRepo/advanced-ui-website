/* ==========================================================================
   Derivative Negotiated Normalizer
   ========================================================================== */

/*
 * Response normalization for Derivative Negotiated Deals.
 *
 * Responsibilities:
 *
 * - parse legacy response envelopes
 * - normalize negotiated transaction rows
 * - preserve service-provided display dates
 * - preserve service-provided daily total rows
 * - normalize Contract identity fields
 * - normalize numeric service values
 * - provide stable row identifiers
 * - provide optional date grouping and sorting metadata
 * - provide consistent result metadata
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - display formatting
 * - filter behavior
 * - request implementation
 * - DataTables configuration
 * - card rendering
 * - client-side financial calculations
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
]);

const RESPONSE_METADATA_KEYS = Object.freeze([
  "data",

  "results",

  "meta",

  "pagination",

  "page",
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

/* ==========================================================================
   Boolean Normalization
   ========================================================================== */

function normalizeBoolean(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = normalizeString(value).toLowerCase();

  return normalized === "true" || normalized === "1" || normalized === "yes";
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
      "Derivative Negotiated received an invalid JSON response.",
    );
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
   Response Metadata Objects
   ========================================================================== */

function collectResponseObjects(
  response,
  depth = 0,
  objects = [],
  visited = new Set(),
) {
  if (depth > MAX_RESPONSE_DEPTH) {
    return objects;
  }

  const parsedResponse = parseResponseValue(response);

  if (!isObject(parsedResponse) || visited.has(parsedResponse)) {
    return objects;
  }

  visited.add(parsedResponse);

  objects.push(parsedResponse);

  RESPONSE_METADATA_KEYS.forEach((key) => {
    if (!(key in parsedResponse)) {
      return;
    }

    const candidate = parseResponseValue(parsedResponse[key]);

    if (isObject(candidate)) {
      collectResponseObjects(candidate, depth + 1, objects, visited);
    }
  });

  return objects;
}

/* ==========================================================================
   Date Metadata
   ========================================================================== */

/*
 * The exact service-provided date is always preserved for display.
 *
 * Parsing exists only to create optional metadata:
 *
 * - stable date grouping key
 * - numeric sorting value
 *
 * An unfamiliar date format must never cause the displayed date to disappear.
 */

function getDateParts(value) {
  const normalized = normalizeDigits(normalizeString(value));

  if (!normalized) {
    return null;
  }

  /*
   * YYYY-MM-DD
   * YYYY/MM/DD
   * Optional time or trailing metadata is accepted.
   */

  let match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\D.*)?$/);

  if (match) {
    return {
      year: Number(match[1]),

      month: Number(match[2]),

      day: Number(match[3]),
    };
  }

  /*
   * DD-MM-YYYY
   * DD/MM/YYYY
   * Optional time or trailing metadata is accepted.
   */

  match = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\D.*)?$/);

  if (match) {
    return {
      year: Number(match[3]),

      month: Number(match[2]),

      day: Number(match[1]),
    };
  }

  return null;
}

function isValidDateParts(parts) {
  if (!parts) {
    return false;
  }

  if (
    !Number.isInteger(parts.year) ||
    !Number.isInteger(parts.month) ||
    !Number.isInteger(parts.day)
  ) {
    return false;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day
  );
}

function getDateKey(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return "undated";
  }

  const parts = getDateParts(normalized);

  if (!isValidDateParts(parts)) {
    /*
     * Preserve consistent grouping for an unfamiliar service format without
     * changing its displayed value.
     */

    return createSafeKey(normalized, "undated");
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
   Contract Identity
   ========================================================================== */

/*
 * The legacy service uses company-oriented property names for the Contract.
 *
 * Keep the standard company-property names in the canonical row so the shared
 * Market Watch identity renderers can be reused directly:
 *
 * - companyCode
 * - companyName
 * - companyUrl
 */

function normalizeContractIdentity(row = {}) {
  const companyObject = isObject(row.company) ? row.company : {};

  const contractObject = isObject(row.contract) ? row.contract : {};

  const companyCode = getFirstString(
    row.companyCode,

    row.contractCode,

    row.symbol,

    row.symbolCode,

    row.code,

    row.securityCode,

    companyObject.companyCode,

    companyObject.contractCode,

    companyObject.symbol,

    companyObject.symbolCode,

    companyObject.code,

    companyObject.securityCode,

    contractObject.companyCode,

    contractObject.contractCode,

    contractObject.symbol,

    contractObject.symbolCode,

    contractObject.code,

    contractObject.securityCode,
  );

  const companyName = getFirstString(
    row.companyName,

    typeof row.company === "string" ? row.company : null,

    row.contractName,

    row.longName,

    row.name,

    row.securityName,

    companyObject.companyName,

    companyObject.contractName,

    companyObject.longName,

    companyObject.name,

    companyObject.securityName,

    contractObject.companyName,

    contractObject.contractName,

    contractObject.longName,

    contractObject.name,

    contractObject.securityName,

    companyCode,
  );

  const companyUrl = getFirstString(
    row.companyURL,

    row.companyUrl,

    row.contractURL,

    row.contractUrl,

    row.url,

    row.securityUrl,

    companyObject.companyURL,

    companyObject.companyUrl,

    companyObject.contractURL,

    companyObject.contractUrl,

    companyObject.url,

    companyObject.securityUrl,

    contractObject.companyURL,

    contractObject.companyUrl,

    contractObject.contractURL,

    contractObject.contractUrl,

    contractObject.url,

    contractObject.securityUrl,
  );

  return Object.freeze({
    companyCode,

    companyName,

    companyUrl,
  });
}

/* ==========================================================================
   Total Row Detection
   ========================================================================== */

function isTotalRow(row = {}) {
  if (!isObject(row)) {
    return false;
  }

  const rowType = normalizeString(row.rowType ?? row.type).toLowerCase();

  return (
    TOTAL_ROW_TYPES.has(rowType) ||
    normalizeBoolean(row.isTotal) ||
    normalizeBoolean(row.totalRow)
  );
}

/* ==========================================================================
   Service Date Extraction
   ========================================================================== */

function getServiceDate(row = {}) {
  /*
   * Do not validate or reformat this value.
   *
   * The service controls the visible legacy-compatible date presentation.
   */

  return getFirstString(
    row.tradeDate,

    row.strDate,

    row.date,

    row.transactionDate,

    row.dealDate,
  );
}

/* ==========================================================================
   Transaction Row
   ========================================================================== */

function normalizeDealRow(row, index) {
  const company = normalizeContractIdentity(row);

  const tradeDate = getServiceDate(row);

  const tradeTime = getFirstString(
    row.tradeTime,

    row.strTime,

    row.time,

    row.transactionTime,

    row.dealTime,
  );

  const price = normalizeNumericValue(
    getFirstValue(
      row.price,

      row.tradePrice,

      row.dealPrice,
    ),
  );

  const volume = normalizeNumericValue(
    getFirstValue(
      row.volume,

      row.tradeVolume,

      row.tradedVolume,

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
    ),
  );

  const sourceId = getFirstString(
    row.id,

    row.tradeId,

    row.dealId,

    row.transactionId,
  );

  const dateKey = getDateKey(tradeDate);

  const id =
    sourceId ||
    [
      "derivative-deal",

      dateKey,

      createSafeKey(company.companyCode, "contract"),

      createSafeKey(tradeTime, "time"),

      index,
    ].join("-");

  return Object.freeze({
    id,

    rowType: "deal",

    /*
     * Exact service-provided display values.
     */

    tradeDate,

    tradeTime,

    /*
     * Optional machine metadata.
     */

    dateKey,

    dateSort: getDateSortValue(tradeDate),

    companyCode: company.companyCode,

    companyName: company.companyName,

    companyUrl: company.companyUrl,

    price,

    volume,

    value,

    raw: row,
  });
}

/* ==========================================================================
   Daily Total Row
   ========================================================================== */

function normalizeTotalRow(row, index, previousDate = "") {
  /*
   * Some legacy total rows omit their date.
   *
   * Associate those rows with the immediately preceding transaction date
   * without calculating financial totals on the client.
   */

  const tradeDate = getServiceDate(row) || previousDate;

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

  return Object.freeze({
    id: ["derivative-total", dateKey, index].join("-"),

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
  });
}

/* ==========================================================================
   Row Collection Normalization
   ========================================================================== */

function normalizeRawRows(rawRows = []) {
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

    const row = normalizeDealRow(rawRow, index);

    if (row.tradeDate) {
      previousDate = row.tradeDate;
    }

    rows.push(row);
  });

  return Object.freeze(rows);
}

/* ==========================================================================
   Response Metadata
   ========================================================================== */

function findExplicitTotal(response, rawRows) {
  const candidates = [];

  collectResponseObjects(response).forEach((responseObject) => {
    candidates.push(
      responseObject.total,

      responseObject.count,

      responseObject.recordsTotal,

      responseObject.recordsFiltered,

      responseObject.totalCount,
    );
  });

  /*
   * The legacy Derivative Negotiated implementation also reads count from the
   * first service row.
   */

  if (isObject(rawRows[0])) {
    candidates.push(
      rawRows[0].count,

      rawRows[0].totalCount,

      rawRows[0].recordsTotal,
    );
  }

  for (const candidate of candidates) {
    const total = normalizeNumericValue(candidate);

    if (total !== null && total >= 0) {
      return total;
    }
  }

  return null;
}

function findUpdatedAt(response) {
  const candidates = [];

  collectResponseObjects(response).forEach((responseObject) => {
    candidates.push(
      responseObject.updatedAt,

      responseObject.lastUpdated,

      responseObject.timestamp,
    );
  });

  return getFirstValue(...candidates) ?? null;
}

function createResponseMeta({ response, rawRows, rows }) {
  const dealRows = rows.filter((row) => row.rowType === "deal");

  const summaryRows = rows.filter((row) => row.rowType === "total");

  const dateGroups = new Set(
    dealRows.map((row) => row.dateKey).filter(Boolean),
  );

  const explicitTotal = findExplicitTotal(response, rawRows);

  return Object.freeze({
    /*
     * Prefer a total explicitly supplied by the service.
     *
     * Daily total rows are presentation summaries and do not increase the
     * user-visible result count.
     */

    total: explicitTotal !== null ? explicitTotal : dealRows.length,

    recordCount: dealRows.length,

    summaryCount: summaryRows.length,

    groupCount: dateGroups.size,

    rowCount: rows.length,

    updatedAt: findUpdatedAt(response),
  });
}

/* ==========================================================================
   Public Row Normalization
   ========================================================================== */

export function normalizeDerivativeNegotiatedRows(response) {
  const rawRows = extractResponseRows(response);

  return normalizeRawRows(rawRows);
}

/* ==========================================================================
   Public Response Normalization
   ========================================================================== */

export function normalizeDerivativeNegotiatedResponse(response) {
  const rawRows = extractResponseRows(response);

  const rows = normalizeRawRows(rawRows);

  return Object.freeze({
    rows,

    meta: createResponseMeta({
      response,

      rawRows,

      rows,
    }),

    raw: response,
  });
}
