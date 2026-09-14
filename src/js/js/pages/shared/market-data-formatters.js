/* ==========================================================================
   Shared Market Data Formatters
   ========================================================================== */

/*
 * Generic formatting helpers shared by:
 *
 * - Market Watch
 * - Sukuk & Bonds
 *
 * Responsibilities:
 *
 * - string normalization
 * - HTML escaping
 * - empty-value handling
 * - first-value resolution
 * - numeric conversion
 * - zero detection
 * - locale-aware number formatting
 * - decimal formatting
 * - quantity formatting
 * - price formatting
 * - percentage formatting
 * - positive / negative / neutral state
 *
 * This module intentionally has no:
 *
 * - Market Watch business rules
 * - Sukuk business rules
 * - auction behavior
 * - company / instrument identity rendering
 * - watchlist rendering
 * - status rendering
 * - coupon formatting
 * - maturity formatting
 * - DOM queries
 * - request logic
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

export function firstDefined(...values) {
  return values.find(hasValue);
}

export function getFirstValue(source, keys = [], fallback = "") {
  const row =
    source && typeof source === "object" && !Array.isArray(source)
      ? source
      : {};

  for (const key of keys) {
    if (key && hasValue(row[key])) {
      return row[key];
    }
  }

  return fallback;
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

export function formatFullNumber(value, config = {}) {
  return formatNumber(value, config, {
    maximumFractionDigits: 0,
  });
}

export function formatDecimal(value, decimals = 2) {
  const number = toNumber(value);

  if (number === null) {
    return getDisplayValue(value);
  }

  const precision = Number.isInteger(decimals) && decimals >= 0 ? decimals : 2;

  return number.toFixed(precision);
}

export function formatQuantity(value, config = {}) {
  const displayValue = getDisplayValue(value);

  if (displayValue === DEFAULT_EMPTY_VALUE) {
    return displayValue;
  }

  /*
   * Preserve service-provided abbreviated quantities:
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

export function formatPrice(value) {
  return getDisplayValue(value);
}

export function formatPercent(value) {
  return getDisplayValue(value).replace(/\s*%\s*$/, "");
}

/* ==========================================================================
   Change State
   ========================================================================== */

export function getChangeClass(value) {
  const number = toNumber(value);

  if (number !== null && number > 0) {
    return "price-up";
  }

  if (number !== null && number < 0) {
    return "price-down";
  }

  return "price-neutral";
}
