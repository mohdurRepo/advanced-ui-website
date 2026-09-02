/* ==========================================================================
   Data Watchlist
   ========================================================================== */

/*
 * Shared watchlist helpers for reusable data-view modules.
 *
 * Responsibilities:
 *
 * - normalize watchlist values
 * - determine whether a row is watchlisted
 * - filter rows to watchlisted items
 * - support configurable field names / resolver callbacks
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - authentication UI
 * - popup logic
 * - AJAX code
 * - DataTables code
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const TRUE_VALUES = new Set(["1", "true", "yes", "y"]);

const FALSE_VALUES = new Set([
  "",
  "0",
  "false",
  "no",
  "n",
  "null",
  "undefined",
]);

const DEFAULT_FIELDS = [
  "watchlist",
  "watchList",
  "watchlistStatus",
  "watchListStatus",
  "watchListId",
];

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizeString(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeFields(fields) {
  if (!fields) {
    return [...DEFAULT_FIELDS];
  }

  if (typeof fields === "string") {
    return [fields];
  }

  if (!Array.isArray(fields)) {
    throw new TypeError(
      "Watchlist fields must be a string or array of strings.",
    );
  }

  return [
    ...new Set(
      fields.filter((field) => typeof field === "string" && field.trim()),
    ),
  ];
}

/* ==========================================================================
   Value Detection
   ========================================================================== */

export function isWatchlistedValue(value) {
  if (value === true || value === 1) {
    return true;
  }

  if (value === false || value === 0 || value == null) {
    return false;
  }

  const normalized = normalizeString(value);

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return false;
}

/* ==========================================================================
   Row Value Resolution
   ========================================================================== */

export function getWatchlistValue(row = {}, options = {}) {
  if (typeof options.resolve === "function") {
    return options.resolve(row);
  }

  const fields = normalizeFields(options.fields);

  for (const field of fields) {
    if (row?.[field] !== undefined && row?.[field] !== null) {
      return row[field];
    }
  }

  return null;
}

/* ==========================================================================
   Row Detection
   ========================================================================== */

export function isWatchlisted(rowOrValue, options = {}) {
  /*
   * Primitive values can be checked directly:
   *
   * isWatchlisted("YES")
   * isWatchlisted(1)
   */

  if (rowOrValue == null || typeof rowOrValue !== "object") {
    return isWatchlistedValue(rowOrValue);
  }

  /*
   * Objects are treated as data rows.
   */

  return isWatchlistedValue(getWatchlistValue(rowOrValue, options));
}

/* ==========================================================================
   Filtering
   ========================================================================== */

export function filterWatchlisted(rows = [], options = {}) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.filter((row) => isWatchlisted(row, options));
}

/* ==========================================================================
   Conditional Filtering
   ========================================================================== */

export function applyWatchlistFilter(rows = [], enabled = false, options = {}) {
  if (!Array.isArray(rows)) {
    return [];
  }

  if (!enabled) {
    return rows;
  }

  return filterWatchlisted(rows, options);
}
