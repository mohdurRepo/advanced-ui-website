/* ==========================================================================
   Historical Reports Formatters
   ========================================================================== */

/*
 * Presentation helpers for Historical Reports.
 *
 * Responsibilities:
 *
 * - HTML escaping
 * - numeric conversion and formatting (matching legacy exactly, including
 *   its zero-as-missing behavior -- see the note below)
 * - directional change rendering (icon + semantic color)
 * - exercise-type (Call/Put) label rendering
 * - link rendering for the Underlying table
 * - static-label rendering (Instrument Type)
 * - the shared cell-rendering dispatcher consumed by both the desktop table
 *   and mobile card views
 *
 * This module intentionally has no:
 *
 * - request logic
 * - response normalization
 * - filter state
 * - DataTables lifecycle
 * - column-picker DOM behavior
 * - page lifecycle
 *
 * Legacy reference: historical.columns.js (col/dateCol/num helpers,
 * renderNumber/renderInteger/renderDirectionalNumber/renderExerciseType/
 * renderLink).
 *
 * This is a standalone project -- unlike Market Watch, there is no
 * pages/shared/ folder to draw generic formatting primitives from, and
 * legacy's own historical.columns.js was already fully self-contained
 * (it did not share code with Market Watch's formatters either). This file
 * follows the same shape: it owns its own toNumber/formatNumber/escapeHtml
 * rather than importing them from elsewhere.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_EMPTY_VALUE = "-";

/* ==========================================================================
   HTML Escaping
   ========================================================================== */

/*
 * Legacy built every rendered cell through raw string concatenation with no
 * escaping at all. Escaping untrusted values before interpolating them into
 * markup does not change what a normal value displays as -- it only
 * prevents a malicious value from being interpreted as markup. Added here
 * as a genuine improvement, not a behavior change for real data.
 */

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
   Value Presence
   ========================================================================== */

function hasValue(value) {
  return value !== null && value !== undefined;
}

/*
 * common/data-view's createDataTableColumns() always sets `data: null` and
 * performs its own row lookup inside render(), which means DataTables' own
 * `defaultContent` mechanism never actually fires in this architecture (it
 * only substitutes for a column's own `data` accessor returning undefined,
 * which never happens here since `data` is always null). The "-" fallback
 * legacy got for free from `defaultContent: "-"` therefore has to be
 * applied explicitly here instead.
 *
 * To match legacy precisely: only a genuinely missing (null/undefined)
 * value becomes "-". A present-but-empty string is left as an empty cell,
 * exactly as legacy's DataTables defaultContent would have left it (that
 * option only ever substitutes for missing data, not for empty strings).
 */

export function getDisplayValue(value, fallback = DEFAULT_EMPTY_VALUE) {
  return hasValue(value) ? value : fallback;
}

/* ==========================================================================
   Numeric Conversion
   ========================================================================== */

export function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(String(value).replace(/,/g, "").trim());

  return Number.isFinite(number) ? number : null;
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

/*
 * Preserved exactly from legacy, including two behaviors worth being
 * deliberate about rather than silently "improving":
 *
 * - a genuine zero renders identically to a missing value ("-"). This
 *   looks like an unintended bug rather than a business rule -- a zero
 *   strike price or zero open interest is real, distinguishable data --
 *   but it is legacy's actual behavior today, so it is preserved here.
 *
 * - the locale is hardcoded to "en-US" regardless of the page's actual
 *   locale/direction. Numbers always render with Latin digits and US-style
 *   grouping even on an Arabic page. Also preserved as-is.
 */

export function formatNumber(value, decimals) {
  const number = toNumber(value);

  if (number === null || number === 0) {
    return DEFAULT_EMPTY_VALUE;
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDecimal(value) {
  return formatNumber(value, 2);
}

export function formatInteger(value) {
  return formatNumber(value, 0);
}

/* ==========================================================================
   Directional Change
   ========================================================================== */

/*
 * Legacy (renderDirectionalNumber) used raw inline <svg><use> sprite
 * references for the up/down arrows. Converted here to the mask-based
 * has-icon system already used everywhere else in the design system, using
 * icon-triangle-up / icon-triangle-down -- both already registered in the
 * icon set, no new asset needed.
 *
 * Legacy uses parseFloat() here specifically (not the comma-stripping
 * toNumber() used elsewhere in this file) -- preserved exactly, since that
 * is legacy's own actual per-function behavior, not an oversight on my
 * part. In practice change/change% values are small decimals unlikely to
 * carry thousands separators, so this rarely matters, but it means a
 * comma-containing value would behave differently here than it would
 * through toNumber().
 *
 * Zero: legacy shows the plain value with no icon and no color class at
 * all. Here it's wrapped in .price-neutral instead of being left
 * unstyled -- functionally identical (still no icon, same value shown),
 * but now consistently uses one of the three semantic price-state classes
 * (price-up / price-down / price-neutral) for every outcome, matching how
 * that convention is used elsewhere in this design system. This is a
 * small, deliberate visual delta from pixel-exact legacy (zero previously
 * had no distinct color at all) -- confirm this is wanted, or say so and
 * it reverts to plain unstyled text for zero.
 */

export function renderDirectionalNumber(value) {
  if (value === null || value === undefined || value === "" || value === "-") {
    return DEFAULT_EMPTY_VALUE;
  }

  const numericValue = parseFloat(value);

  if (Number.isNaN(numericValue)) {
    return escapeHtml(value);
  }

  if (numericValue === 0) {
    return `<span class="price-neutral">${escapeHtml(value)}</span>`;
  }

  const isPositive = numericValue > 0;

  const colorClass = isPositive ? "price-up" : "price-down";

  const iconClass = isPositive ? "icon-triangle-up" : "icon-triangle-down";

  return `
    <span class="${colorClass} has-icon ${iconClass} icon-sm">
      ${escapeHtml(value)}
    </span>
  `.trim();
}

/* ==========================================================================
   Exercise Type
   ========================================================================== */

/*
 * Preserved exactly, including the specific fallback behavior: an empty
 * value becomes "-", but a value that is neither "CALL" nor "PUT" is shown
 * as-is rather than falling back to "-". That asymmetry is legacy's own
 * literal behavior.
 */

export function renderExerciseType(value, config = {}) {
  const labels = config?.labels?.table ?? {};

  if (value === "CALL") {
    return escapeHtml(labels.calls || "Calls");
  }

  if (value === "PUT") {
    return escapeHtml(labels.puts || "Puts");
  }

  return value ? escapeHtml(value) : DEFAULT_EMPTY_VALUE;
}

/* ==========================================================================
   Static Label
   ========================================================================== */

/*
 * Legacy's instrumentType column ignores the row's actual data entirely
 * and always renders a fixed "SSO" label. Preserved exactly -- the column
 * is not currently a real per-row field despite looking like one.
 */

export function renderStaticLabel(config = {}) {
  const labels = config?.labels?.table ?? {};

  return escapeHtml(labels.sso || "SSO");
}

/* ==========================================================================
   Link
   ========================================================================== */

/*
 * Legacy used class="ellipsis", a class not present anywhere in this
 * design system. Swapped for .table-cell-truncate, the design system's
 * equivalent truncation utility -- same functional truncation behavior,
 * new class name.
 */

export function renderLink(value, url) {
  if (!value) {
    return DEFAULT_EMPTY_VALUE;
  }

  const safeValue = escapeHtml(value);

  if (!url) {
    return safeValue;
  }

  return `<a class="table-cell-truncate" href="${escapeHtml(url)}">${safeValue}</a>`;
}

/* ==========================================================================
   Loading Cell
   ========================================================================== */

function renderLoadingCell() {
  return `<span class="table-skeleton table-skeleton-md" aria-hidden="true"></span>`;
}

/* ==========================================================================
   Cell Value Resolution
   ========================================================================== */

function getCellValue(row, column) {
  if (!column?.data) {
    return undefined;
  }

  return row?.[column.data];
}

/* ==========================================================================
   Cell Rendering
   ========================================================================== */

/*
 * Shared dispatcher consumed by both the desktop table (views/
 * historical.table.js, views/historical.underlying.js) and the mobile card
 * view (views/historical.cards.js), so both presentations render a given
 * column identically.
 */

export function renderHistoricalCell({ row, column, type, config = {} }) {
  /*
   * Non-display types (sort/type/filter): legacy's own render functions
   * each individually short-circuit with `if (type !== "display") return
   * data;`, returning the raw underlying value untouched. Preserved
   * exactly rather than substituting a computed display-safe value.
   */

  if (type !== "display") {
    return getCellValue(row, column);
  }

  if (row?.__dataViewState === "loading") {
    return renderLoadingCell();
  }

  const value = getCellValue(row, column);

  switch (column?.type) {
    case "directional-number":
      return renderDirectionalNumber(value);

    case "exercise-type":
      return renderExerciseType(value, config);

    case "static-label":
      return renderStaticLabel(config);

    case "link":
      return renderLink(value, row?.[column.urlData]);

    case "decimal":
      return formatDecimal(value);

    case "integer":
      return formatInteger(value);

    case "text":
    default:
      return escapeHtml(getDisplayValue(value));
  }
}
