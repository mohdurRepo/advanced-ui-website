/* ==========================================================================
   Theoretical Opening Formatters
   ========================================================================== */

const EMPTY_VALUE = "-";

/* ==========================================================================
   Generic Helpers
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

export function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function toNumber(value) {
  if (!hasValue(value)) {
    return null;
  }

  const normalized = String(value).replaceAll(",", "").trim();

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

export function isZeroValue(value) {
  const number = toNumber(value);

  return number !== null && number === 0;
}

export function getDisplayValue(value, fallback = EMPTY_VALUE) {
  if (!hasValue(value)) {
    return fallback;
  }

  return String(value).trim();
}

/* ==========================================================================
   Price Formatting
   ========================================================================== */

export function formatTheoreticalPrice(value) {
  if (!hasValue(value) || isZeroValue(value)) {
    return EMPTY_VALUE;
  }

  return getDisplayValue(value);
}

/* ==========================================================================
   Quantity Formatting
   ========================================================================== */

export function formatTheoreticalQuantity(value, locale = "en") {
  if (!hasValue(value) || isZeroValue(value)) {
    return EMPTY_VALUE;
  }

  const number = toNumber(value);

  if (number === null) {
    return getDisplayValue(value);
  }

  try {
    return new Intl.NumberFormat(locale || "en", {
      maximumFractionDigits: 20,
    }).format(number);
  } catch {
    return getDisplayValue(value);
  }
}
