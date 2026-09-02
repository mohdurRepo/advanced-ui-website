/* ==========================================================================
   Theoretical Opening Formatters
   ========================================================================== */

/*
 * Shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 *
 * Keep only feature-specific presentation helpers here.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const EMPTY_VALUE = "-";

/* ==========================================================================
   Value Helpers
   ========================================================================== */

export function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function getDisplayValue(value, fallback = EMPTY_VALUE) {
  return hasValue(value) ? String(value).trim() : fallback;
}

export function toNumber(value) {
  if (!hasValue(value)) {
    return null;
  }

  const number = Number(String(value).replace(/,/g, "").trim());

  return Number.isFinite(number) ? number : null;
}

/* ==========================================================================
   Numeric Formatting
   ========================================================================== */

export function formatDecimal(value, decimals = 2, fallback = EMPTY_VALUE) {
  const number = toNumber(value);

  if (number === null) {
    return fallback;
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* ==========================================================================
   Theoretical Opening Fields
   ========================================================================== */

export function formatCompanyName(value) {
  return getDisplayValue(value);
}

export function formatPreviousClose(value) {
  return formatDecimal(value, 2);
}

export function formatTop(value) {
  return formatDecimal(value, 2);
}

export function formatTov(value) {
  return getDisplayValue(value);
}

/* ==========================================================================
   HTML
   ========================================================================== */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
