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
 * - preserve service-provided daily total rows
 * - normalize Contract identity fields
 * - normalize numeric service values
 * - provide stable row identifiers
 * - provide date grouping and sorting metadata
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
   Date Parsing
   ========================================================================== */

/*
 * The normalizer does not change the service-provided date used for display.
 *
 * Date parsing here exists only to create:
 *
 * - a stable YYYY-MM-DD grouping key
 * - a numeric sorting value
 */

function getDateParts(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return null;
  }

  /*
   * YYYY-MM-DD
   * YYYY/MM/DD
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

function getFirstValidDate(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);

    if (!normalized) {
      continue;
    }

    const parts = getDateParts(normalized);

    if (isValidDateParts(parts)) {
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
   Contract Identity
   ========================================================================== */

/*
 * The legacy service uses company-oriented names for the Contract displayed
 * in the Derivative Negotiated table.
 *
 * Normalize those fields once here so the presentation layer only deals with
 * the Contract model:
 *
 * - companyCode
 * - companyName
 * - companyUrl
 *
 * Keeping the standard company-property names also allows the shared
 * data-view identity renderers to be reused directly.
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
   Transaction Row
   ========================================================================== */

function normalizeDealRow(row, index) {
  const company = normalizeContractIdentity(row);

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
  });
}

/* ==========================================================================
   Daily Total Row
   ========================================================================== */

function normalizeTotalRow(row, index, previousDate = "") {
  /*
   * Some legacy total rows omit their date.
   *
   * When that happens, associate the total with the immediately preceding
   * transaction date without calculating any financial totals client-side.
   */

  const tradeDate =
    getFirstValidDate(
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
   Response Metadata
   ========================================================================== */

function findExplicitTotal(response, rawRows) {
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

  /*
   * The legacy Derivative Negotiated implementation reads count from the
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
      parsedResponse.meta?.timestamp,
    ) ?? null
  );
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
     * Fall back to the number of transaction rows. Daily total rows are
     * presentation summaries and therefore do not increase the result count.
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
   Public Response Normalization
   ========================================================================== */

export function normalizeDerivativeNegotiatedResponse(response) {
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

    const row = normalizeDealRow(rawRow, index);

    if (row.tradeDate) {
      previousDate = row.tradeDate;
    }

    rows.push(row);
  });

  return Object.freeze({
    rows: Object.freeze(rows),

    meta: createResponseMeta({
      response,

      rawRows,

      rows,
    }),

    raw: response,
  });
}
