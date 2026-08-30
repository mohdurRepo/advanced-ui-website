/* ==========================================================================
   Sukuk Formatters
   ========================================================================== */

/*
 * Sukuk & Bonds presentation helpers.
 *
 * Responsibilities:
 *
 * - Sukuk backend field aliases
 * - instrument identity
 * - instrument links
 * - favorite-button rendering
 * - Sukuk-specific yield formatting
 * - Sukuk-specific price formatting
 * - coupon-type formatting
 * - maturity / perpetual-bond formatting
 * - coupon-frequency formatting
 * - day-count-convention formatting
 * - schema value resolution
 * - desktop instrument-cell rendering
 * - mobile identity / price rendering
 *
 * Generic formatting helpers come from:
 *
 * ../shared/market-data-formatters.js
 *
 * This module intentionally has no:
 *
 * - AJAX code
 * - DataTables lifecycle
 * - filter state
 * - column visibility state
 * - breakpoint logic
 * - event listeners
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  escapeHtml,
  formatDecimal,
  formatQuantity,
  getDisplayValue,
  getFirstValue,
  hasValue,
  normalizeString,
  toNumber,
} from "../shared/market-data-formatters.js";

/* ==========================================================================
   Internal Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeHref(value) {
  const href = normalizeString(value);

  if (!href) {
    return false;
  }

  return !/^(?:javascript|data|vbscript):/i.test(href);
}

/* ==========================================================================
   Sukuk Number Formatting
   ========================================================================== */

/*
 * Preserve the existing Sukuk presentation:
 *
 * Yield:
 *   4 decimal places
 *
 * Price:
 *   2 decimal places
 *
 * Do not use the generic shared formatPrice() here because Market Watch
 * preserves backend-provided price presentation, while Sukuk explicitly
 * requires fixed decimal precision.
 */

export function formatYield(value) {
  return formatDecimal(value, 4);
}

export function formatPrice(value) {
  return formatDecimal(value, 2);
}

/* ==========================================================================
   Instrument Identity
   ========================================================================== */

export function getInstrumentCode(row = {}) {
  return normalizeString(
    getFirstValue(
      row,
      [
        "symbol",
        "tadawulCode",
        "tadawulCodeModified",
        "tadawulcode",
        "code",
        "companyRef",
        "securityCode",
      ],
      "-",
    ),
    "-",
  );
}

export function getInstrumentName(row = {}) {
  return normalizeString(
    getFirstValue(
      row,
      [
        "issuerName",
        "issuerNameModified",
        "name",
        "instrumentName",
        "securityName",
      ],
      "-",
    ),
    "-",
  );
}

export function getInstrumentUrl(row = {}) {
  const value = getFirstValue(
    row,
    ["cUrl", "companyUrl", "detailsUrl", "url"],
    "",
  );

  if (!isSafeHref(value)) {
    return "";
  }

  return normalizeString(value);
}

export function getInstrumentReference(row = {}) {
  const reference = getInstrumentCode(row);

  return reference === "-" ? "" : reference;
}

/* ==========================================================================
   Watchlist State
   ========================================================================== */

function isFavoriteActive(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = normalizeString(value).toLowerCase();

  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y"
  );
}

function getWatchlistValue(row = {}) {
  return getFirstValue(
    row,
    ["watchlist", "watchList", "watchListId", "isWatchlisted", "watchlisted"],
    null,
  );
}

/* ==========================================================================
   Favorite Button
   ========================================================================== */

export function renderFavoriteButton(row = {}, options = {}) {
  const active = isFavoriteActive(getWatchlistValue(row));

  const instrumentRef = getInstrumentReference(row);

  const instrumentName = getInstrumentName(row);

  const className =
    normalizeString(options.className) || "table-market__favorite";

  const iconClass = active ? "icon-star-filled" : "icon-star-outline";

  const label = active
    ? `Remove ${instrumentName} from watchlist`
    : `Add ${instrumentName} to watchlist`;

  return `
    <button
      type="button"
      class="${escapeHtml(className)}"
      data-sukuk-favorite
      data-instrument-ref="${escapeHtml(instrumentRef)}"
      aria-label="${escapeHtml(label)}"
      aria-pressed="${String(active)}"
    >
      <span
        class="has-icon ${escapeHtml(iconClass)}"
        aria-hidden="true"
      ></span>
    </button>
  `.trim();
}

/* ==========================================================================
   Desktop Instrument Text
   ========================================================================== */

/*
 * Preserve the current Sukuk hierarchy:
 *
 * Name
 * Code
 *
 * The Market Watch design-system classes are intentionally reused.
 */

function renderInstrumentText(row = {}) {
  const code = getInstrumentCode(row);

  const name = getInstrumentName(row);

  const url = getInstrumentUrl(row);

  const content = `
    <span class="table-market__name">
      ${escapeHtml(name)}
    </span>

    <span class="table-market__identity-code">
      <span class="table-market__symbol">
        ${escapeHtml(code)}
      </span>
    </span>
  `.trim();

  if (!url) {
    return `
      <span class="table-market__security-link">
        ${content}
      </span>
    `.trim();
  }

  return `
    <a
      class="table-market__security-link"
      href="${escapeHtml(url)}"
    >
      ${content}
    </a>
  `.trim();
}

/* ==========================================================================
   Desktop Instrument Cell
   ========================================================================== */

/*
 * Match Market Watch's first-column structure:
 *
 * favorite
 * identity
 *
 * There is no separate Watchlist table column.
 */

export function renderInstrument(row = {}) {
  return `
    <div class="table-market__security-cell">
      ${renderFavoriteButton(row)}

      ${renderInstrumentText(row)}
    </div>
  `.trim();
}

/* ==========================================================================
   Date Formatting
   ========================================================================== */

export function formatDateIso(value) {
  if (!hasValue(value)) {
    return "-";
  }

  const text = normalizeString(value);

  /*
   * Preserve backend ISO dates without timezone conversion.
   */

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* ==========================================================================
   Boolean Values
   ========================================================================== */

export function isTrueLike(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = normalizeString(value).toLowerCase();

  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "y"
  );
}

/* ==========================================================================
   Business Labels
   ========================================================================== */

function getValueLabels(config = {}) {
  return isObject(config.labels?.values) ? config.labels.values : {};
}

/* ==========================================================================
   Coupon Type
   ========================================================================== */

export function formatCouponType(value, config = {}) {
  const labels = getValueLabels(config);

  switch (normalizeString(value)) {
    case "4":
      return normalizeString(labels.floating) || "Floating";

    case "1":
      return normalizeString(labels.fixed) || "Fixed";

    default:
      return "-";
  }
}

/* ==========================================================================
   Maturity
   ========================================================================== */

export function formatMaturity(row = {}, config = {}) {
  const labels = getValueLabels(config);

  if (isTrueLike(row.isPerpetualBond)) {
    return normalizeString(labels.perpetualBond) || "Perpetual Bond";
  }

  return formatDateIso(
    getFirstValue(row, ["maturityDate", "maturityDateStr"], ""),
  );
}

/* ==========================================================================
   Coupon Frequency
   ========================================================================== */

export function formatCouponFrequency(value, config = {}) {
  const labels = getValueLabels(config);

  const map = {
    1: normalizeString(labels.couponFrequency1) || "Annual",

    2: normalizeString(labels.couponFrequency2) || "Semi-Annual",

    4: normalizeString(labels.couponFrequency4) || "Quarterly",

    12: normalizeString(labels.couponFrequency12) || "Monthly",

    0: normalizeString(labels.couponFrequency0) || "-",
  };

  return map[normalizeString(value)] || map["0"];
}

/* ==========================================================================
   Day Count Convention
   ========================================================================== */

export function formatDayCountConvention(value, config = {}) {
  const labels = getValueLabels(config);

  const map = {
    7: normalizeString(labels.dayCount7) || "Convention 7",

    2: normalizeString(labels.dayCount2) || "Convention 2",

    3: normalizeString(labels.dayCount3) || "Convention 3",

    0: normalizeString(labels.dayCount0) || "-",
  };

  return map[normalizeString(value)] || map["0"];
}

/* ==========================================================================
   Schema Value Resolution
   ========================================================================== */

export function getColumnValue(row, column, fallback = "") {
  if (!column || typeof column !== "object") {
    return fallback;
  }

  const keys = [];

  if (column.data) {
    keys.push(column.data);
  }

  if (Array.isArray(column.fallbackData)) {
    keys.push(...column.fallbackData);
  }

  return getFirstValue(row, keys, fallback);
}

/* ==========================================================================
   Last Price
   ========================================================================== */

export function getLastPrice(row = {}) {
  return getFirstValue(
    row,
    [
      "lastTradePrice",
      "lastTradePriceModified",
      "bidPrice",
      "bidPriceModified",
      "askPrice",
      "askPriceModified",
    ],
    null,
  );
}

/* ==========================================================================
   Mobile Identity
   ========================================================================== */

/*
 * Preserve Sukuk's current mobile hierarchy:
 *
 * favorite
 *
 * CODE
 * Name
 */

export function renderMobileIdentity(row = {}) {
  const code = getInstrumentCode(row);

  const name = getInstrumentName(row);

  const url = getInstrumentUrl(row);

  const identityContent = `
    <div class="data-card__identity-content">
      <span class="data-card__symbol">
        ${escapeHtml(code)}
      </span>

      <h3 class="data-card__title">
        ${escapeHtml(name)}
      </h3>
    </div>
  `.trim();

  const linkedIdentity = url
    ? `
          <a
            class="data-card__security-link"
            href="${escapeHtml(url)}"
          >
            ${identityContent}
          </a>
        `.trim()
    : identityContent;

  return `
    <div class="data-card__identity">
      ${renderFavoriteButton(row, {
        className: "data-card__favorite",
      })}

      ${linkedIdentity}
    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Price
   ========================================================================== */

export function renderMobilePrice(row = {}) {
  const price = formatPrice(getLastPrice(row));

  return `
    <div class="data-card__quote">
      <span class="data-card__price">
        ${escapeHtml(price)}
      </span>
    </div>
  `.trim();
}

/* ==========================================================================
   Shared Re-exports
   ========================================================================== */

/*
 * Preserve the existing Sukuk formatter public API while the rest of the
 * module is migrated to the project-level shared formatter.
 */

export {
  escapeHtml,
  formatQuantity,
  getDisplayValue,
  getFirstValue,
  hasValue,
  normalizeString,
  toNumber,
};
