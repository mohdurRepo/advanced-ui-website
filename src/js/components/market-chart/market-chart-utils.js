/* ==========================================================================
   Market Chart Utilities
   ==========================================================================

   Shared, dependency-free helpers and constants used by every Market Chart
   module (data, theme, live, options, controller).

   Rules:

   1. Pure functions only. No Highcharts, no chart state, no side effects.
   2. One implementation per concern. Modules import from here instead of
      redefining local copies.
   3. Numeric helpers never coerce booleans, null, undefined or blank
      strings into numbers.
   ========================================================================== */

/* ==========================================================================
   Constants
   ========================================================================== */

export const DEFAULT_LANGUAGE = "en";

export const DEFAULT_TIME_ZONE = "Asia/Riyadh";

export const SECOND = 1_000;

export const MINUTE = 60 * SECOND;

export const HOUR = 60 * MINUTE;

/*
 * Highcharts ids shared by the options builder and the controller.
 */
export const NAVIGATOR_SERIES_ID = "market-chart-navigator-series";

const MAIN_SERIES_ID_PREFIX = "market-chart-";

/* ==========================================================================
   Type Checks
   ========================================================================== */

/**
 * True for object literals and Object.create(null) objects only.
 * Arrays, class instances, DOM nodes and Dates are rejected.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * Returns `value` when it is a plain object, otherwise an empty object.
 *
 * @template T
 * @param {T} value
 * @returns {T | {}}
 */
export function asPlainObject(value) {
  return isPlainObject(value) ? value : {};
}

/**
 * True for element nodes, including elements from other documents/iframes.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isElement(value) {
  return Boolean(value && value.nodeType === 1 && value.ownerDocument);
}

/* ==========================================================================
   Numbers
   ========================================================================== */

/**
 * Strict numeric conversion.
 *
 * Returns null for null, undefined, booleans, blank strings, NaN and
 * ±Infinity. Numeric strings ("12.5", " 3 ") are accepted.
 *
 * @param {*} value
 * @returns {number | null}
 */
export function toFiniteNumber(value) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/**
 * @param {*} value
 * @param {*} [fallback=null]
 * @returns {number | *}
 */
export function toPositiveNumber(value, fallback = null) {
  const number = toFiniteNumber(value);

  return number !== null && number > 0 ? number : fallback;
}

/**
 * @param {*} value
 * @param {*} [fallback=null]
 * @returns {number | *}
 */
export function toNonNegativeNumber(value, fallback = null) {
  const number = toFiniteNumber(value);

  return number !== null && number >= 0 ? number : fallback;
}

/**
 * Positive whole number. Fractional input is floored ("12.9" -> 12).
 *
 * @param {*} value
 * @param {*} [fallback=null]
 * @returns {number | *}
 */
export function toPositiveInteger(value, fallback = null) {
  const number = toFiniteNumber(value);

  return number !== null && number >= 1 ? Math.floor(number) : fallback;
}

/**
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/* ==========================================================================
   Strings
   ========================================================================== */

const HTML_ESCAPES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
});

/**
 * Escapes text for safe interpolation into HTML strings
 * (Highcharts `useHTML` tooltips / labels).
 *
 * @param {*} value
 * @returns {string}
 */
export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character],
  );
}

/**
 * Trimmed, lower-cased string for keyword comparisons.
 *
 * @param {*} value
 * @returns {string}
 */
export function toKeyword(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/* ==========================================================================
   Highcharts Identity
   ========================================================================== */

/**
 * Stable id of the primary series for one chart symbol.
 *
 * Used by both the options builder (creation) and the controller (lookup),
 * so the two can never disagree.
 *
 * @param {string} [symbol]
 * @returns {string}
 */
export function getMainSeriesId(symbol) {
  return `${MAIN_SERIES_ID_PREFIX}${toKeyword(symbol) || "series"}`;
}

/* ==========================================================================
   Intl
   ========================================================================== */

/**
 * Creates an Intl.DateTimeFormat that never throws.
 *
 * An invalid language tag or time zone falls back to
 * `fallbackLanguage` + DEFAULT_TIME_ZONE instead of raising RangeError.
 *
 * @param {string} [language]
 * @param {string} [timeZone]
 * @param {Intl.DateTimeFormatOptions} [options]
 * @param {string} [fallbackLanguage]
 * @returns {Intl.DateTimeFormat}
 */
export function createDateTimeFormat(
  language,
  timeZone,
  options = {},
  fallbackLanguage = DEFAULT_LANGUAGE,
) {
  try {
    return new Intl.DateTimeFormat(language || fallbackLanguage, {
      ...options,
      timeZone: timeZone || DEFAULT_TIME_ZONE,
    });
  } catch {
    return new Intl.DateTimeFormat(fallbackLanguage, {
      ...options,
      timeZone: DEFAULT_TIME_ZONE,
    });
  }
}

/**
 * Creates an Intl.NumberFormat that never throws.
 *
 * @param {string} [language]
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {Intl.NumberFormat}
 */
export function createNumberFormat(language, options = {}) {
  try {
    return new Intl.NumberFormat(language || DEFAULT_LANGUAGE, options);
  } catch {
    return new Intl.NumberFormat(DEFAULT_LANGUAGE, options);
  }
}
