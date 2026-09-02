/* ==========================================================================
   Sukuk Formatters
   ========================================================================== */

/*
* Sukuk / Market Watch presentation helpers.
*
* Backend fields used by this page:
*
* - companyName
* - symbol
* - companyURL
* - prev_close
* - top
* - tov
*
* This module intentionally contains:
*
* - API field access
* - instrument identity
* - instrument links
* - favorite-button rendering
* - number formatting
* - desktop instrument-cell rendering
* - mobile identity / price rendering
*
* This module does NOT contain:
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


/*
 * ==========================================================================
 * Internal Helpers
 * ==========================================================================
 */

function isSafeHref(value) {
  const href = normalizeString(value);

  if (!href) {
    return false;
  }

  return !/^(?:javascript|data|vbscript):/i.test(href);
}


/*
 * ==========================================================================
 * Sukuk Number Formatting
 * ==========================================================================
 */
/**
 * Formats "prev_close" values to a standardized financial string with 2 decimal
 * places. Example: "1.96" -> "1.96"
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
 * Formats "tov" (Theoretical Opening Volume) values as whole integers. Strips
 * decimals and adds comma separators for group readability, returning "—" if 0.
 * Example: "0" -> "—", "5000000" -> "5,000,000"
 */
export function formatAuctionQuantity(value) {
  if (value === null || value === undefined || String(value).trim() === "" || Number(value) === 0) {
    return "—";
  }
  const num = Number(value);
  return isNaN(num) ? "—" : num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
/*
 * ==========================================================================
 * Instrument Identity
 * ==========================================================================
 */

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
/*
 * ==========================================================================
 * Desktop Instrument Text
 * ==========================================================================
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

/*
 * ==========================================================================
 * Desktop Instrument Cell
 * ==========================================================================
 */

export function renderInstrument(row = {}) {
  return `
    <div class="table-market__security-cell">
      ${renderFavoriteButton(row)}

      ${renderInstrumentText(row)}
    </div>
  `.trim();
}
/*
 * ==========================================================================
 * Favorite Button
 * ==========================================================================
 */

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

/*
 * ==========================================================================
 * API Values
 * ==========================================================================
 */

/*
 * Previous Close
 * 
 * API: prev_close: "1.96"
 */

export function getPreviousClose(row = {}) {
  return row.prev_close ?? "-";
}


/*
 * TOP
 * 
 * API: top: "0.00"
 */

export function getTOP(row = {}) {
  return row.top ?? "-";
}


/*
 * TOV
 * 
 * API: tov: "0"
 */

export function getTOV(row = {}) {
  return row.tov ?? "-";
}


/*
 * ==========================================================================
 * Formatted API Values
 * ==========================================================================
 */

export function formatPreviousClose(row = {}) {
  return formatPrice(getPreviousClose(row));
}


export function formatTopValue(row = {}) {
  return formatTOP(getTOP(row));
}


export function formatTovValue(row = {}) {
  return formatTOV(getTOV(row));
}


/*
 * ==========================================================================
 * Schema Value Resolution
 * ==========================================================================
 */

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


/*
 * ==========================================================================
 * Mobile Identity
 * ==========================================================================
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


/*
 * ==========================================================================
 * Mobile Previous Close
 * ==========================================================================
 */

export function renderMobilePrice(row = {}) {
  const price = formatPreviousClose(row);

  return `
    <div class="data-card__quote">
      <span class="data-card__price">
        ${escapeHtml(price)}
      </span>
    </div>
  `.trim();
}


/*
 * ==========================================================================
 * Shared Re-exports
 * ==========================================================================
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