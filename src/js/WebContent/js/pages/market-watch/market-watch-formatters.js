/* ==========================================================================
   Market Watch Formatters
   ========================================================================== */

/*
 * Market Watch-specific presentation helpers.
 *
 * Responsibilities:
 *
 * - auction-specific display rules
 * - accumulated-loss status presentation
 * - company identity values
 * - favorite-button rendering
 * - desktop company identity composition
 * - mobile company identity composition
 * - 52-week range rendering
 * - change rendering
 * - mobile quote rendering
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
 * - logo fallback lifecycle
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  renderStandardCompanyCardIdentity,
  renderStandardCompanyCell,
} from "../../common/data-view/index.js";

import {
  escapeHtml,
  firstDefined,
  formatFullNumber,
  formatNumber,
  formatPercent,
  formatPrice,
  formatQuantity,
  getChangeClass,
  getDisplayValue,
  isZeroLike,
  normalizeString,
  toNumber,
} from "../shared/market-data-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const STATUS_PRESENTATIONS = Object.freeze({
  1: Object.freeze({
    className: "status-state--attention",
    labelKey: "losses20To35",
  }),

  2: Object.freeze({
    className: "status-state--warning",
    labelKey: "losses35To50",
  }),

  3: Object.freeze({
    className: "status-state--danger",
    labelKey: "losses50More",
  }),
});

/* ==========================================================================
   Internal Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAuction(config = {}) {
  return Boolean(config.market?.isAuction ?? config.openCloseAuction);
}

function isSafeHref(value) {
  const href = normalizeString(value);

  if (!href) {
    return false;
  }

  return !/^(?:javascript|data|vbscript):/i.test(href);
}

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

/* ==========================================================================
   Auction Formatting
   ========================================================================== */

export function formatAuctionValue(value, config = {}) {
  if (isAuction(config) && isZeroLike(value)) {
    return "-";
  }

  return getDisplayValue(value);
}

export function formatAuctionQuantity(value, config = {}) {
  if (isAuction(config) && isZeroLike(value)) {
    return "-";
  }

  return formatQuantity(value, config);
}

export function formatMarketOrder(value, config = {}) {
  if (isAuction(config) && isZeroLike(value)) {
    return normalizeString(config.labels?.marketOrder) || "MO";
  }

  return getDisplayValue(value);
}

/* ==========================================================================
   Company Status Resolution
   ========================================================================== */

function getCompanyStatusValue(row = {}) {
  const value =
    row.companyStatus ??
    row.statusCode ??
    row.companyStatusCode ??
    row.lossStatus ??
    row.status ??
    row.raw?.companyStatus ??
    row.raw?.statusCode ??
    row.raw?.companyStatusCode ??
    row.raw?.lossStatus ??
    row.raw?.status;

  if (isObject(value)) {
    return value.code ?? value.value ?? value.id ?? value.raw ?? "";
  }

  return value;
}

function getCompanyStatusCode(row = {}) {
  const value = getCompanyStatusValue(row);

  const number = Number(value);

  if (Number.isFinite(number)) {
    return String(number);
  }

  return normalizeString(value);
}

function getCompanyStatusLabels(config = {}) {
  const generalStatusLabels = isObject(config.labels?.status)
    ? config.labels.status
    : {};

  const marketWatchStatusLabels = isObject(config.labels?.marketWatch?.status)
    ? config.labels.marketWatch.status
    : {};

  return {
    ...generalStatusLabels,
    ...marketWatchStatusLabels,
  };
}

/* ==========================================================================
   Company Status Presentation
   ========================================================================== */

export function getCompanyStatus(row = {}, config = {}) {
  const statusCode = getCompanyStatusCode(row);

  const definition = STATUS_PRESENTATIONS[statusCode];

  if (!definition) {
    return {
      code: statusCode,
      className: "",
      label: "",
    };
  }

  const labels = getCompanyStatusLabels(config);

  return {
    code: statusCode,

    className: definition.className,

    label: normalizeString(labels[definition.labelKey]),
  };
}

/* ==========================================================================
   Company Status Indicator
   ========================================================================== */

/*
 * Required working markup:
 *
 * <span
 *   class="status-state status-state--attention"
 *   role="img"
 *   aria-label="..."
 *   title="..."
 * >
 *   <span
 *     class="status-state__indicator"
 *     aria-hidden="true"
 *   ></span>
 * </span>
 */

export function renderCompanyStatusIndicator(row = {}, config = {}) {
  const presentation = getCompanyStatus(row, config);

  if (!presentation.className) {
    return "";
  }

  const accessibilityAttributes = presentation.label
    ? `
          role="img"
          aria-label="${escapeHtml(presentation.label)}"
          title="${escapeHtml(presentation.label)}"
        `.trim()
    : 'aria-hidden="true"';

  return `
    <span
      class="status-state ${escapeHtml(presentation.className)}"
      ${accessibilityAttributes}
    >
      <span
        class="status-state__indicator"
        aria-hidden="true"
      ></span>
    </span>
  `.trim();
}

/* ==========================================================================
   Company Identity Values
   ========================================================================== */

export function getCompanyReference(row = {}) {
  return normalizeString(
    firstDefined(
      row.companyRef,
      row.companySymbol,
      row.symbol,
      row.companyCode,
      "",
    ),
  );
}

export function getCompanyCode(row = {}) {
  return normalizeString(
    firstDefined(
      row.companyCode,
      row.companyRef,
      row.companySymbol,
      row.symbol,
      row.securityCode,
      row.code,
      "",
    ),
  );
}

export function getCompanyName(row = {}) {
  return (
    normalizeString(
      firstDefined(
        row.acrynomName,
        row.acronymName,
        row.companyName,
        row.longName,
        row.shortName,

        typeof row.company === "string" ? row.company : null,

        row.name,
        row.securityName,
        "",
      ),
    ) || "-"
  );
}

export function getCompanySymbol(row = {}) {
  return normalizeString(
    firstDefined(
      row.companySymbol,
      row.symbol,
      row.companyRef,
      row.companyCode,
      "",
    ),
  );
}

export function getCompanyUrl(row = {}) {
  const value = firstDefined(
    row.companyUrl,
    row.companyURL,
    row.pageUrl,
    row.securityUrl,
    row.url,
    "",
  );

  if (!isSafeHref(value)) {
    return "";
  }

  return normalizeString(value);
}

/* ==========================================================================
   Favorite
   ========================================================================== */

export function renderFavoriteButton(row = {}, options = {}) {
  const active = isFavoriteActive(row.watchlist);

  const companyRef = getCompanyReference(row);

  const companyName = getCompanyName(row);

  const className =
    normalizeString(options.className) || "table-market__favorite";

  const iconClass = active ? "icon-star-filled" : "icon-star-outline";

  const label = active
    ? `Remove ${companyName} from watchlist`
    : `Add ${companyName} to watchlist`;

  return `
    <button
      type="button"
      class="${escapeHtml(className)}"
      data-market-watch-favorite
      data-company-ref="${escapeHtml(companyRef)}"
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
   Desktop Company Identity
   ========================================================================== */

export function renderCompanyCell(row = {}, config = {}) {
  return renderStandardCompanyCell(row, config, {
    leading: renderFavoriteButton(row),

    nameMetadata: renderCompanyStatusIndicator(row, config),
  });
}

/* ==========================================================================
   52 Week Range
   ========================================================================== */

export function getRangePosition(low, high, value) {
  const lowNumber = toNumber(low);

  const highNumber = toNumber(high);

  const valueNumber = toNumber(value);

  if (
    lowNumber === null ||
    highNumber === null ||
    valueNumber === null ||
    highNumber <= lowNumber
  ) {
    return null;
  }

  const position = ((valueNumber - lowNumber) / (highNumber - lowNumber)) * 100;

  return Math.min(100, Math.max(0, position));
}

export function renderRange(row = {}, config = {}) {
  const low = firstDefined(row.low52WeekPrice, row.week52Low, "");

  const high = firstDefined(row.high52WeekPrice, row.week52High, "");

  const value = firstDefined(
    row.lastTradePriceModified,
    row.lastTradePrice,
    row.price,
    "",
  );

  const position =
    isAuction(config) && isZeroLike(value)
      ? null
      : getRangePosition(low, high, value);

  const hasMarker = position !== null;

  const markerStyle = hasMarker ? `style="--range-position: ${position}%"` : "";

  const markerValue = hasMarker
    ? `data-range-value="${escapeHtml(value)}"`
    : "";

  const marker = hasMarker
    ? `
          <span
            class="table-market__range-marker"
            aria-hidden="true"
          ></span>
        `.trim()
    : "";

  return `
    <div
      class="table-market__range-content"
      data-range-has-value="${String(hasMarker)}"
    >
      <div
        class="table-market__range-track"
        ${markerStyle}
        ${markerValue}
      >
        ${marker}
      </div>

      <div class="table-market__range-values">
        <span>
          ${escapeHtml(getDisplayValue(low))}
        </span>

        <span>
          ${escapeHtml(getDisplayValue(high))}
        </span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Change Values
   ========================================================================== */

export function renderChange(value, numericValue, options = {}) {
  const sourceValue = firstDefined(numericValue, value);

  const className = getChangeClass(sourceValue);

  const displayValue = options.percent
    ? formatPercent(value)
    : getDisplayValue(value);

  return `
    <span class="${escapeHtml(className)}">
      ${escapeHtml(displayValue)}
    </span>
  `.trim();
}

/* ==========================================================================
   Mobile Identity
   ========================================================================== */

export function renderMobileIdentity(row = {}, config = {}) {
  return renderStandardCompanyCardIdentity(row, config, {
    leading: renderFavoriteButton(row, {
      className: "data-card__favorite",
    }),

    nameMetadata: renderCompanyStatusIndicator(row, config),
  });
}

/* ==========================================================================
   Mobile Quote
   ========================================================================== */

export function renderMobileQuote(row = {}, config = {}) {
  const price = formatAuctionValue(row.lastTradePriceModified, config);

  const changeNumericValue = firstDefined(
    row.netChange,
    row.changeValue,
    row.netChangeModified,
  );

  const percentNumericValue = firstDefined(
    row.precentChange,
    row.percentChange,
    row.precentChangeModified,
  );

  const change = renderChange(row.netChangeModified, changeNumericValue);

  const percent = renderChange(row.precentChangeModified, percentNumericValue, {
    percent: true,
  });

  return `
    <div class="data-card__quote">
      <span class="data-card__price">
        ${escapeHtml(price)}
      </span>

      <span class="data-card__change">
        ${change}

        ${percent}
      </span>
    </div>
  `.trim();
}

/* ==========================================================================
   Shared Re-exports
   ========================================================================== */

/*
 * Keep these exports available to existing Market Watch modules while
 * migration to the project-level shared formatter is completed.
 */

export {
  escapeHtml,
  formatFullNumber,
  formatNumber,
  formatPercent,
  formatPrice,
  formatQuantity,
  getChangeClass,
  getDisplayValue,
  isZeroLike,
  normalizeString,
  toNumber,
};
