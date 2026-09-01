/* ==========================================================================
   Financial Calendar Utilities
   ========================================================================== */

/*
 * Project-local utilities for Issuer Financial Calendars.
 *
 * Responsibilities:
 *
 * - normalize strings and numeric service values
 * - escape plain text for safe HTML output
 * - parse supported calendar date formats
 * - format native-input and service-request dates
 * - create stable date sorting values
 * - format numbers and monetary values
 * - validate links and render safe anchor markup
 *
 * This module intentionally has no dependency on:
 *
 * - Issuer Trading
 * - another page module
 * - DOM state
 * - API requests
 * - table or card lifecycle code
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_VALUE = "—";

const SAFE_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeString(value, fallback = "") {
  if (value === null || value === undefined || typeof value === "object") {
    return fallback;
  }

  const normalized = String(value).trim();

  return normalized || fallback;
}

export function getDisplayValue(value, fallback = DEFAULT_EMPTY_VALUE) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();

  return normalized || fallback;
}

/* ==========================================================================
   HTML Escaping
   ========================================================================== */

export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ==========================================================================
   Digit Normalization
   ========================================================================== */

export function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

/* ==========================================================================
   Numeric Parsing
   ========================================================================== */

function normalizeNumericSeparators(value) {
  let normalized = normalizeDigits(value)
    .trim()
    .replaceAll("٬", ",")
    .replaceAll("٫", ".")
    .replaceAll("−", "-")
    .replace(/[\s\u00a0\u202f]/g, "");

  if (!normalized) {
    return "";
  }

  let negative = false;

  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    negative = true;

    normalized = normalized.slice(1, -1);
  }

  const lastComma = normalized.lastIndexOf(",");

  const lastDot = normalized.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = normalized.replaceAll(".", "").replace(",", ".");
    } else {
      normalized = normalized.replaceAll(",", "");
    }
  } else if (lastComma !== -1) {
    const commaParts = normalized.split(",");

    const finalPart = commaParts.at(-1) || "";

    const looksLikeGroupedInteger =
      commaParts.length > 1 &&
      commaParts.slice(1).every((part) => /^\d{3}$/.test(part));

    normalized = looksLikeGroupedInteger
      ? commaParts.join("")
      : `${commaParts.slice(0, -1).join("")}.${finalPart}`;
  }

  if (negative && !normalized.startsWith("-")) {
    normalized = `-${normalized}`;
  }

  return normalized;
}

export function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = normalizeNumericSeparators(value);

  if (!normalized || normalized === "-" || normalized === ".") {
    return null;
  }

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return null;
  }

  const numericValue = Number(normalized);

  return Number.isFinite(numericValue) ? numericValue : null;
}

/* ==========================================================================
   Date Parsing
   ========================================================================== */

function createDateParts(year, month, day) {
  const parts = {
    year: Number(year),

    month: Number(month),

    day: Number(day),
  };

  if (!isValidDateParts(parts)) {
    return null;
  }

  return Object.freeze(parts);
}

export function isValidDateParts(parts) {
  if (!isObject(parts)) {
    return false;
  }

  const year = Number(parts.year);

  const month = Number(parts.month);

  const day = Number(parts.day);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseDateParts(value) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      return null;
    }

    return createDateParts(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  if (
    isObject(value) &&
    "year" in value &&
    "month" in value &&
    "day" in value
  ) {
    return createDateParts(value.year, value.month, value.day);
  }

  const normalized = normalizeDigits(value).trim();

  if (!normalized) {
    return null;
  }

  /*
   * Native input and ISO service formats:
   *
   * YYYY-MM-DD
   * YYYY/MM/DD
   * YYYY-MM-DDTHH:mm:ss
   */

  let match = normalized.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/,
  );

  if (match) {
    return createDateParts(match[1], match[2], match[3]);
  }

  /*
   * Existing Financial Calendars service format:
   *
   * DD-MM-YYYY
   * DD/MM/YYYY
   */

  match = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s].*)?$/);

  if (match) {
    return createDateParts(match[3], match[2], match[1]);
  }

  return null;
}

/* ==========================================================================
   Date Formatting
   ========================================================================== */

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

export function formatInputDate(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    return "";
  }

  return [parts.year, padDatePart(parts.month), padDatePart(parts.day)].join(
    "-",
  );
}

export function formatRequestDate(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    return "";
  }

  return [padDatePart(parts.day), padDatePart(parts.month), parts.year].join(
    "-",
  );
}

export function getDateSortValue(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    return 0;
  }

  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

function getNumberFormatter(locale, options) {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, options);
  }
}

export function formatNumber(value, options = {}) {
  const numericValue = toNumber(value);

  const fallback = options.fallback ?? DEFAULT_EMPTY_VALUE;

  if (numericValue === null) {
    return fallback;
  }

  if (options.zeroAsFallback === true && numericValue === 0) {
    return fallback;
  }

  const minimumFractionDigits = Math.max(
    0,
    Number(options.minimumFractionDigits) || 0,
  );

  const configuredMaximum = Number(options.maximumFractionDigits);

  const maximumFractionDigits = Number.isFinite(configuredMaximum)
    ? Math.max(minimumFractionDigits, configuredMaximum)
    : Math.max(minimumFractionDigits, 2);

  const formatter = getNumberFormatter(
    normalizeString(options.locale, DEFAULT_LOCALE),
    {
      minimumFractionDigits,

      maximumFractionDigits,

      useGrouping: options.useGrouping !== false,
    },
  );

  return formatter.format(numericValue);
}

export function formatMoney(value, options = {}) {
  return formatNumber(value, {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

    ...options,
  });
}

/* ==========================================================================
   Safe URLs
   ========================================================================== */

export function getSafeUrl(value) {
  const normalized = normalizeString(value).replace(
    /[\u0000-\u001f\u007f]/g,
    "",
  );

  if (!normalized) {
    return "";
  }

  const compact = normalized.replace(/\s+/g, "").toLowerCase();

  if (
    compact.startsWith("javascript:") ||
    compact.startsWith("data:") ||
    compact.startsWith("vbscript:") ||
    compact.startsWith("file:")
  ) {
    return "";
  }

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    normalized.startsWith("#") ||
    normalized.startsWith("?")
  ) {
    return normalized;
  }

  const protocolMatch = normalized.match(/^([a-z][a-z0-9+.-]*:)/i);

  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase();

    return SAFE_URL_PROTOCOLS.has(protocol) ? normalized : "";
  }

  /*
   * Plain relative URLs such as:
   *
   * company/details?id=123
   */

  return normalized;
}

/* ==========================================================================
   Link Rendering
   ========================================================================== */

export function renderLink(label, url, options = {}) {
  const fallback = options.fallback ?? DEFAULT_EMPTY_VALUE;

  const displayLabel = getDisplayValue(label, fallback);

  const safeUrl = getSafeUrl(url);

  if (!safeUrl) {
    return escapeHtml(displayLabel);
  }

  const className = normalizeString(options.className);

  const target = options.target === "_blank" ? "_blank" : "";

  const relationship = target ? "noopener noreferrer" : "";

  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";

  const targetAttribute = target ? ` target="${target}"` : "";

  const relationshipAttribute = relationship ? ` rel="${relationship}"` : "";

  const ariaLabel = normalizeString(options.ariaLabel);

  const ariaLabelAttribute = ariaLabel
    ? ` aria-label="${escapeHtml(ariaLabel)}"`
    : "";

  return `
    <a
      href="${escapeHtml(safeUrl)}"${classAttribute}${targetAttribute}${relationshipAttribute}${ariaLabelAttribute}
    >
      ${escapeHtml(displayLabel)}
    </a>
  `.trim();
}
