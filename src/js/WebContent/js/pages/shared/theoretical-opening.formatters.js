/* ==========================================================================
   Theoretical Opening Formatters
   ========================================================================== */

/*
 * Formatting helpers for:
 *
 * - Previous Close
 * - TOP
 * - TOV
 * - company display values
 *
 * Responsibilities:
 *
 * - string normalization
 * - HTML escaping
 * - empty-value handling
 * - numeric conversion
 * - zero detection
 * - locale-aware number formatting
 * - Previous Close formatting
 * - TOP formatting
 * - TOV formatting
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - request logic
 * - API response normalization
 * - DataTables lifecycle
 * - filter state
 * - card rendering
 * - table rendering
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_VALUE = "-";

/* ==========================================================================
   String Helpers
   ========================================================================== */

export function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

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
   Value Helpers
   ========================================================================== */

export function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function getDisplayValue(value, fallback = DEFAULT_EMPTY_VALUE) {
  return hasValue(value) ? String(value).trim() : fallback;
}

/* ==========================================================================
   Numeric Conversion
   ========================================================================== */

export function toNumber(value) {
  if (!hasValue(value)) {
    return null;
  }

  const normalized = String(value)
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replaceAll(",", "")
    .replaceAll("٬", "")
    .replaceAll("٫", ".")
    .replaceAll("−", "-")
    .replace(/[^0-9.+-]/g, "")
    .trim();

  if (
    !normalized ||
    normalized === "+" ||
    normalized === "-" ||
    normalized === "."
  ) {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

export function isZeroLike(value) {
  const number = toNumber(value);

  return number !== null && number === 0;
}

/* ==========================================================================
   Locale
   ========================================================================== */

export function getFormattingLocale(config = {}) {
  const documentLocale =
    typeof document !== "undefined" ? document.documentElement?.lang : "";

  return normalizeString(
    config.locale,
    normalizeString(documentLocale, DEFAULT_LOCALE),
  );
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

export function formatNumber(value, config = {}, options = {}) {
  const number = toNumber(value);

  if (number === null) {
    return getDisplayValue(value);
  }

  try {
    return new Intl.NumberFormat(getFormattingLocale(config), options).format(
      number,
    );
  } catch {
    return getDisplayValue(value);
  }
}

/* ==========================================================================
   Previous Close
   ========================================================================== */

export function formatPreviousClose(value) {
  if (!hasValue(value) || isZeroLike(value)) {
    return DEFAULT_EMPTY_VALUE;
  }

  return getDisplayValue(value);
}

/* ==========================================================================
   Theoretical Opening Price - TOP
   ========================================================================== */

export function formatTOP(value) {
  if (!hasValue(value) || isZeroLike(value)) {
    return DEFAULT_EMPTY_VALUE;
  }

  return getDisplayValue(value);
}

/* ==========================================================================
   Theoretical Opening Volume - TOV
   ========================================================================== */

export function formatTOV(value, config = {}) {
  if (!hasValue(value) || isZeroLike(value)) {
    return DEFAULT_EMPTY_VALUE;
  }

  const displayValue = getDisplayValue(value);

  /*
   * Preserve service-provided abbreviated values
   * if the backend ever returns them:
   *
   * 7.84M
   * 900K
   */

  if (/[a-z]/i.test(displayValue)) {
    return displayValue;
  }

  return formatNumber(value, config, {
    maximumFractionDigits: 20,
  });
}
