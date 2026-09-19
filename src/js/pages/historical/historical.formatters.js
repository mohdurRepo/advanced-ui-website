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
 * - safe link rendering for the Underlying table/cards
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
 * legacy's own historical.columns.js was already fully self-contained.
 *
 * This file therefore owns its own:
 *
 * - value-presence rules
 * - number conversion / formatting
 * - HTML escaping
 * - URL-safety check
 * - Historical cell dispatcher
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_EMPTY_VALUE = "-";

const UNSAFE_URL_PROTOCOL_PATTERN = /^(?:javascript|data|vbscript):/i;

/* ==========================================================================
   HTML Escaping
   ========================================================================== */

/*
 * Legacy built rendered cells through raw string concatenation without
 * escaping.
 *
 * Escaping values before interpolating them into HTML does not change normal
 * visible values; it prevents backend/user-controlled data from becoming
 * executable markup.
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
 * Historical applies its missing-value fallback explicitly here instead of
 * depending on DataTables defaultContent.
 *
 * The same formatter is consumed by:
 *
 * - desktop DataTables
 * - mobile cards
 *
 * Keeping the fallback here guarantees both presentations treat missing
 * values identically.
 *
 * To match legacy precisely:
 *
 * - null / undefined become "-"
 * - an existing empty string remains an empty string
 *
 * DataTables defaultContent historically substituted only genuinely missing
 * values, not present-but-empty string values.
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
 * Preserved from legacy, including two behaviors that are intentionally not
 * changed in this refactor:
 *
 * 1. A genuine numeric zero renders as "-".
 *
 *    That behavior may be questionable for values such as Open Interest,
 *    Strike Price, etc., but changing it would alter Historical's established
 *    presentation semantics.
 *
 * 2. Numeric formatting uses "en-US".
 *
 *    This means formatted decimal/integer values continue using Latin digits
 *    and US-style grouping even if the page itself is Arabic.
 *
 * These can be revisited independently after the migration is stable.
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
 * Legacy renderDirectionalNumber() used inline SVG sprite references for
 * positive/negative arrows.
 *
 * The migrated implementation uses the design-system mask/icon classes:
 *
 * - icon-triangle-up
 * - icon-triangle-down
 *
 * Legacy also used parseFloat() specifically for these values rather than
 * the comma-stripping toNumber() helper. That behavior remains preserved.
 *
 * Zero is represented with the design-system .price-neutral class.
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
    return `
      <span class="price-neutral">
        ${escapeHtml(value)}
      </span>
    `.trim();
  }

  const isPositive = numericValue > 0;

  const colorClass = isPositive ? "price-up" : "price-down";

  const iconClass = isPositive ? "icon-triangle-up" : "icon-triangle-down";

  return `
    <span
      class="${colorClass} has-icon ${iconClass} icon-sm"
    >
      ${escapeHtml(value)}
    </span>
  `.trim();
}

/* ==========================================================================
   Exercise Type
   ========================================================================== */

/*
 * Preserved from legacy:
 *
 * - CALL -> localized Calls label
 * - PUT  -> localized Puts label
 * - empty value -> "-"
 * - any other populated value -> render the value as supplied
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
 * Legacy's instrumentType column ignores the row's instrumentType value and
 * always displays the localized SSO label.
 *
 * Keep that contract rather than turning the column into a backend-driven
 * value during the migration.
 */

export function renderStaticLabel(config = {}) {
  const labels = config?.labels?.table ?? {};

  return escapeHtml(labels.sso || "SSO");
}

/* ==========================================================================
   Link Safety
   ========================================================================== */

/*
 * HTML escaping protects the href attribute's markup context, but it does not
 * make an unsafe URL scheme safe.
 *
 * Example:
 *
 *   javascript:...
 *
 * is still a valid attribute value after HTML escaping.
 *
 * Underlying URLs come from backend row data, so reject explicitly unsafe
 * executable/content schemes before producing an anchor.
 *
 * Relative portal URLs, normal http(s) URLs, and other non-blocked values are
 * preserved.
 */

export function isSafeLinkUrl(value) {
  const url = String(value ?? "").trim();

  if (!url) {
    return false;
  }

  return !UNSAFE_URL_PROTOCOL_PATTERN.test(url);
}

/* ==========================================================================
   Link
   ========================================================================== */

/*
 * Legacy used class="ellipsis", which is not part of the current design
 * system.
 *
 * .table-cell-truncate is the design-system equivalent used here.
 *
 * If the supplied backend URL is missing or unsafe, preserve the visible
 * value but render it as plain text rather than as a link.
 */

export function renderLink(value, url) {
  if (!value) {
    return DEFAULT_EMPTY_VALUE;
  }

  const safeValue = escapeHtml(value);

  if (!isSafeLinkUrl(url)) {
    return safeValue;
  }

  const safeUrl = escapeHtml(String(url).trim());

  return `
    <a
      class="table-cell-truncate"
      href="${safeUrl}"
    >
      ${safeValue}
    </a>
  `.trim();
}

/* ==========================================================================
   Loading Cell
   ========================================================================== */

function renderLoadingCell() {
  return `
    <span
      class="table-skeleton table-skeleton-md"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Cell Value Resolution
   ========================================================================== */

/*
 * Historical columns currently use string field mappings such as:
 *
 *   data: "transactionDateStr"
 *   data: "previousClosePrice"
 *   data: "strikePrice"
 *
 * Keep the value resolver small and page-specific.
 *
 * common/data-view/data-table.js now also preserves these mappings in its
 * actual DataTables column definitions.
 */

function getCellValue(row, column) {
  if (!column?.data) {
    return undefined;
  }

  /*
   * Supporting a function accessor here costs almost nothing and keeps this
   * renderer aligned with the generic data-table schema contract.
   */
  if (typeof column.data === "function") {
    return column.data(row);
  }

  return row?.[column.data];
}

/* ==========================================================================
   Cell Rendering
   ========================================================================== */

/*
 * Shared dispatcher consumed by:
 *
 * - views/historical.table.js
 * - views/historical.underlying.js
 * - views/historical.cards.js
 *
 * One dispatcher means the same Historical column has the same presentation
 * semantics in desktop and mobile views.
 */

export function renderHistoricalCell({ row, column, type, config = {} }) {
  /*
   * DataTables requests non-display values for:
   *
   * - sorting
   * - filtering
   * - type detection
   *
   * Legacy render callbacks returned the raw underlying value for those
   * requests, so preserve that behavior.
   */

  if (type !== "display") {
    return getCellValue(row, column);
  }

  /*
   * Shared data-table loading rows carry this marker.
   *
   * Resolve it before normal column access so every Historical column gets
   * the same skeleton treatment.
   */
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
