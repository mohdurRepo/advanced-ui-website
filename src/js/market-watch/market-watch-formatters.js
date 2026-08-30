/* ==========================================================================
   Market Watch Formatters
   ========================================================================== */

/*
 * Market Watch presentation helpers.
 *
 * Responsibilities:
 *
 * - number formatting
 * - auction formatting
 * - price-change state
 * - accumulated-loss status presentation
 * - favorite-button rendering
 * - 52-week range rendering
 * - desktop company identity composition
 * - mobile company identity composition
 * - mobile quote rendering
 *
 * Standard company identity and logo rendering are delegated to the shared
 * data-view company identity renderer.
 *
 * This module intentionally has no:
 *
 * - AJAX code
 * - DataTables lifecycle
 * - filter state
 * - watchlist filtering
 * - breakpoint logic
 * - event listeners
 * - company-logo fallback lifecycle
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  renderStandardCompanyCardIdentity,
  renderStandardCompanyCell,
} from "../../common/data-view/index.js";

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

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function getLocale(config = {}) {
  return config.locale || document.documentElement.lang || "en";
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
   HTML
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

/* ==========================================================================
   Numeric Conversion
   ========================================================================== */

export function toNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const normalized = String(value)
    .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    .replaceAll(",", "")
    .replaceAll("٬", "")
    .replaceAll("−", "-")
    .replace(/[^0-9.+-]/g, "")
    .trim();

  if (!normalized || normalized === "+" || normalized === "-") {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

export function isZeroLike(value) {
  const number = toNumber(value);

  return number !== null && number === 0;
}

/* ==========================================================================
   Display Values
   ========================================================================== */

export function getDisplayValue(value, fallback = "-") {
  if (value == null || normalizeString(value) === "") {
    return fallback;
  }

  return normalizeString(value);
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

export function formatNumber(value, config = {}, options = {}) {
  const number = toNumber(value);

  if (number === null) {
    return getDisplayValue(value);
  }

  return new Intl.NumberFormat(getLocale(config), options).format(number);
}

export function formatFullNumber(value, config = {}) {
  return formatNumber(value, config, {
    maximumFractionDigits: 0,
  });
}

export function formatQuantity(value, config = {}) {
  const displayValue = getDisplayValue(value);

  if (displayValue === "-") {
    return displayValue;
  }

  /*
   * Preserve backend-provided abbreviations such as:
   *
   * 7.84M
   * 900K
   */

  if (/[a-z]/i.test(displayValue)) {
    return displayValue;
  }

  return formatNumber(value, config, {
    maximumFractionDigits: 2,
  });
}

export function formatPrice(value) {
  return getDisplayValue(value);
}

export function formatPercent(value) {
  return getDisplayValue(value).replace(/\s*%\s*$/, "");
}

/* ==========================================================================
   Change State
   ========================================================================== */

export function getChangeClass(value) {
  const number = toNumber(value);

  if (number !== null && number > 0) {
    return "price-up";
  }

  if (number !== null && number < 0) {
    return "price-down";
  }

  return "price-neutral";
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

/*
 * Market Watch can receive company status in several forms:
 *
 * companyStatus: 1
 *
 * companyStatus: "1"
 *
 * companyStatus: {
 *   code: "1",
 *   value: 1
 * }
 *
 * Some normalizers also preserve the original service row under `raw`.
 */

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
  return {
    ...(isObject(config.labels?.status) ? config.labels.status : {}),

    ...(isObject(config.labels?.marketWatch?.status)
      ? config.labels.marketWatch.status
      : {}),
  };
}

/* ==========================================================================
   Company Status Presentation
   ========================================================================== */

export function getCompanyStatus(row = {}, config = {}) {
  const statusCode = getCompanyStatusCode(row);

  const definition = STATUS_PRESENTATIONS[statusCode];

  if (!definition) {
    return Object.freeze({
      code: statusCode,

      className: "",

      label: "",
    });
  }

  const labels = getCompanyStatusLabels(config);

  return Object.freeze({
    code: statusCode,

    className: definition.className,

    label: normalizeString(labels[definition.labelKey]),
  });
}

/* ==========================================================================
   Company Status Indicator
   ========================================================================== */

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

/*
 * These values remain exported because Market Watch integrations,
 * watchlist actions, card identifiers, filtering, and table rendering can
 * depend on them.
 *
 * Visual identity rendering is delegated to the shared company identity.
 */

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
      "",
    ),
  );
}

export function getCompanyName(row = {}) {
  return normalizeString(
    firstDefined(
      row.acrynomName,
      row.acronymName,
      row.companyName,
      row.company,
      row.name,
      "-",
    ),
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
        class="has-icon ${iconClass}"
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
