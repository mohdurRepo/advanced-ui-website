/* ==========================================================================
   Trading Formatters
   ========================================================================== */

/*
 * Shared presentation helpers for Issuer Trading tabs.
 *
 * Responsibilities:
 *
 * - escape rendered values
 * - normalize display values
 * - parse and format financial numbers
 * - normalize input and request dates
 * - format dates and times
 * - validate links
 * - provide price-change state classes
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - event listeners
 * - request lifecycle
 * - DataTables lifecycle
 * - tab-specific markup
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_FALLBACK = "-";

const UNSAFE_URL_PATTERN = /^(?:javascript|data|vbscript):/i;

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/* ==========================================================================
   Strings
   ========================================================================== */

export function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

export function getDisplayValue(value, fallback = DEFAULT_FALLBACK) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();

  return normalized || fallback;
}

/* ==========================================================================
   HTML
   ========================================================================== */

export function escapeHtml(value) {
  if (value == null) {
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
   Numeric Normalization
   ========================================================================== */

function normalizeDigits(value) {
  return String(value)
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replaceAll("٬", "")
    .replaceAll("٫", ".");
}

export function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = normalizeDigits(value)
    .replaceAll(",", "")
    .replace(/\s+/g, "")
    .trim();

  if (!normalized || normalized === "-") {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

export function isZeroLike(value) {
  return toNumber(value) === 0;
}

/* ==========================================================================
   Locale
   ========================================================================== */

function normalizeLocale(locale) {
  return normalizeString(locale, "en");
}

function createNumberFormatter(locale, options) {
  try {
    return new Intl.NumberFormat(normalizeLocale(locale), options);
  } catch {
    return new Intl.NumberFormat("en", options);
  }
}

function createDateFormatter(locale, options) {
  try {
    return new Intl.DateTimeFormat(normalizeLocale(locale), options);
  } catch {
    return new Intl.DateTimeFormat("en", options);
  }
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

export function formatNumber(value, options = {}) {
  const number = toNumber(value);

  if (number === null) {
    return options.fallback ?? DEFAULT_FALLBACK;
  }

  if (options.zeroAsFallback === true && number === 0) {
    return options.fallback ?? DEFAULT_FALLBACK;
  }

  const formatter = createNumberFormatter(options.locale, {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,

    maximumFractionDigits: options.maximumFractionDigits ?? 2,

    useGrouping: options.useGrouping !== false,
  });

  return formatter.format(number);
}

export function formatQuantity(value, options = {}) {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...options,
  });
}

export function formatMoney(value, options = {}) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
}

export function formatPrice(value, options = {}) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
}

/* ==========================================================================
   Change State
   ========================================================================== */

export function getChangeClass(value) {
  const number = toNumber(value);

  if (number === null || number === 0) {
    return "price-equal";
  }

  return number > 0 ? "price-up" : "price-down";
}

/* ==========================================================================
   Date Parsing
   ========================================================================== */

function isValidDateParts(year, month, day) {
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
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const normalized = normalizeString(value);

  if (!normalized) {
    return null;
  }

  /*
   * ISO:
   *
   * YYYY-MM-DD
   * YYYY/MM/DD
   * YYYY-MM-DDTHH:mm:ss
   */

  const isoMatch = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    return isValidDateParts(year, month, day) ? { year, month, day } : null;
  }

  /*
   * Legacy backend:
   *
   * DD-MM-YYYY
   * DD/MM/YYYY
   */

  const legacyMatch = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);

  if (!legacyMatch) {
    return null;
  }

  const day = Number(legacyMatch[1]);
  const month = Number(legacyMatch[2]);
  const year = Number(legacyMatch[3]);

  return isValidDateParts(year, month, day) ? { year, month, day } : null;
}

/* ==========================================================================
   Date Output
   ========================================================================== */

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

export function formatInputDate(value, fallback = "") {
  const parts = parseDateParts(value);

  if (!parts) {
    return fallback;
  }

  return [parts.year, padDatePart(parts.month), padDatePart(parts.day)].join(
    "-",
  );
}

export function formatRequestDate(value, fallback = "") {
  const parts = parseDateParts(value);

  if (!parts) {
    return fallback;
  }

  return [padDatePart(parts.day), padDatePart(parts.month), parts.year].join(
    "-",
  );
}

export function getDateSortValue(value, fallback = "") {
  const parts = parseDateParts(value);

  if (!parts) {
    return fallback;
  }

  return [parts.year, padDatePart(parts.month), padDatePart(parts.day)].join(
    "",
  );
}

export function formatDate(value, options = {}) {
  const parts = parseDateParts(value);

  if (!parts) {
    return options.fallback ?? DEFAULT_FALLBACK;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  const formatter = createDateFormatter(options.locale, {
    day: options.day || "2-digit",
    month: options.month || "short",
    year: options.year || "numeric",
    timeZone: "UTC",
  });

  return formatter.format(date);
}

/* ==========================================================================
   Time
   ========================================================================== */

export function formatTime(value, options = {}) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return options.fallback ?? DEFAULT_FALLBACK;
  }

  const match = normalized.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  if (!match) {
    return normalized;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? null : Number(match[3]);

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    (second !== null && (second < 0 || second > 59))
  ) {
    return options.fallback ?? DEFAULT_FALLBACK;
  }

  const parts = [padDatePart(hour), padDatePart(minute)];

  if (second !== null) {
    parts.push(padDatePart(second));
  }

  return parts.join(":");
}

/* ==========================================================================
   Links
   ========================================================================== */

export function getSafeUrl(value) {
  const url = normalizeString(value);

  if (!url || UNSAFE_URL_PATTERN.test(url)) {
    return "";
  }

  return url;
}

export function renderLink(label, url, options = {}) {
  const text = getDisplayValue(label, options.fallback ?? DEFAULT_FALLBACK);

  const href = getSafeUrl(url);

  if (!href) {
    return escapeHtml(text);
  }

  const classAttribute = options.className
    ? ` class="${escapeHtml(options.className)}"`
    : "";

  return `
    <a${classAttribute} href="${escapeHtml(href)}">
      ${escapeHtml(text)}
    </a>
  `.trim();
}
