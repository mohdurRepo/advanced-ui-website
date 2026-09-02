/* ==========================================================================
   Theoretical Opening Formatters
   ========================================================================== */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_VALUE = "-";

/* ==========================================================================
   String
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
   Values
   ========================================================================== */

export function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function getDisplayValue(value, fallback = DEFAULT_EMPTY_VALUE) {
  return hasValue(value) ? String(value).trim() : fallback;
}

/* ==========================================================================
   Numeric
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
   Generic Number
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

  /*
   * Legacy behavior:
   * preserve the supplied display value.
   */

  return getDisplayValue(value);
}

/* ==========================================================================
   TOP
   ========================================================================== */

export function formatTOP(value) {
  if (!hasValue(value) || isZeroLike(value)) {
    return DEFAULT_EMPTY_VALUE;
  }

  /*
   * Legacy behavior:
   * preserve the supplied display value.
   */

  return getDisplayValue(value);
}

/* ==========================================================================
   TOV
   ========================================================================== */

export function formatTOV(value, config = {}) {
  if (!hasValue(value) || isZeroLike(value)) {
    return DEFAULT_EMPTY_VALUE;
  }

  const displayValue = getDisplayValue(value);

  /*
   * Preserve already-formatted backend values,
   * for example:
   *
   * 900K
   * 7.84M
   */

  if (/[a-z]/i.test(displayValue)) {
    return displayValue;
  }

  return formatNumber(value, config, {
    maximumFractionDigits: 20,
  });
}
