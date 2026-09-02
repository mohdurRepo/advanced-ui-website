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
/**
 * Formats "prev_close" values to a standardized financial string with 2 decimal places.
 * Example: "1.96" -> "1.96"
 */
export function formatFullNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "—";
  }
  const num = Number(value);
  return isNaN(num) ? "—" : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats "top" (Theoretical Opening Price) values with 2 decimal precision.
 * Automatically falls back to a dash "—" if the raw numeric value is exactly 0.
 * Example: "0.00" -> "—"
 */
export function formatAuctionValue(value) {
  if (value === null || value === undefined || String(value).trim() === "" || Number(value) === 0) {
    return "—";
  }
  const num = Number(value);
  return isNaN(num) ? "—" : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats "tov" (Theoretical Opening Volume) values as whole integers.
 * Strips decimals and adds comma separators for group readability, returning "—" if 0.
 * Example: "0" -> "—", "5000000" -> "5,000,000"
 */
export function formatAuctionQuantity(value) {
  if (value === null || value === undefined || String(value).trim() === "" || Number(value) === 0) {
    return "—";
  }
  const num = Number(value);
  return isNaN(num) ? "—" : num.toLocaleString(undefined, { maximumFractionDigits: 0 });
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
