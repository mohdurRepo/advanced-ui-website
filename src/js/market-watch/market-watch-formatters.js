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
 * - company status
 * - favorite-button rendering
 * - 52-week range rendering
 * - desktop company identity composition
 * - mobile company identity composition
 * - mobile quote rendering
 *
 * Standard company identity is delegated to the shared data-view identity
 * renderer.
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
   Internal Helpers
   ========================================================================== */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function getLocale(config = {}) {
  return config.locale || document.documentElement.lang || "en";
}

function isAuction(config = {}) {
  return Boolean(config.market?.isAuction ?? config.openCloseAuction);
}

function isSafeHref(value) {
  const href = String(value || "").trim();

  if (!href) {
    return false;
  }

  return !/^(?:javascript|data|vbscript):/i.test(href);
}

function isFavoriteActive(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

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
  if (value == null || String(value).trim() === "") {
    return fallback;
  }

  return String(value).trim();
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
    return config.labels?.marketOrder || "MO";
  }

  return getDisplayValue(value);
}

/* ==========================================================================
   Company Status
   ========================================================================== */

export function getCompanyStatus(row = {}, config = {}) {
  const labels = config.labels?.status || {};

  const status = Number(
    row.companyStatus?.code ??
      row.companyStatus?.value ??
      row.companyStatus ??
      row.statusCode ??
      row.companyStatusCode,
  );

  switch (status) {
    case 1:
      return {
        className:
          "table-market__status table-market__status--warning ylwSymbol",

        title: labels.losses20To35 || "",
      };

    case 2:
      return {
        className:
          "table-market__status table-market__status--caution orgSymbol",

        title: labels.losses35To50 || "",
      };

    case 3:
      return {
        className:
          "table-market__status table-market__status--danger redSymbol",

        title: labels.losses50More || "",
      };

    default:
      return {
        className: "",
        title: "",
      };
  }
}

/* ==========================================================================
   Company Identity Values
   ========================================================================== */

/*
 * These helpers remain exported because Market Watch business behavior such as
 * watchlist actions, card identifiers, filtering, and integrations can depend
 * on the canonical company values.
 *
 * Visual identity rendering itself is owned by the shared company renderer.
 */

export function getCompanyReference(row = {}) {
  return String(
    firstDefined(row.companyRef, row.companySymbol, row.symbol, ""),
  ).trim();
}

export function getCompanyCode(row = {}) {
  return String(
    firstDefined(
      row.companyCode,
      row.companyRef,
      row.companySymbol,
      row.symbol,
      "",
    ),
  ).trim();
}

export function getCompanyName(row = {}) {
  return String(
    firstDefined(
      row.acrynomName,
      row.acronymName,
      row.companyName,
      row.company,
      row.name,
      "-",
    ),
  ).trim();
}

export function getCompanySymbol(row = {}) {
  return String(
    firstDefined(row.companySymbol, row.symbol, row.companyRef, ""),
  ).trim();
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

  return String(value).trim();
}

/* ==========================================================================
   Favorite
   ========================================================================== */

export function renderFavoriteButton(row = {}, options = {}) {
  const active = isFavoriteActive(row.watchlist);

  const companyRef = getCompanyReference(row);

  const companyName = getCompanyName(row);

  const className = options.className || "table-market__favorite";

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
   Status Markup
   ========================================================================== */

function renderCompanyStatus(status) {
  if (!status.className) {
    return "";
  }

  const accessibilityAttributes = status.title
    ? `
        role="img"
        aria-label="${escapeHtml(status.title)}"
        title="${escapeHtml(status.title)}"
      `.trim()
    : 'aria-hidden="true"';

  return `
    <span
      class="${escapeHtml(status.className)}"
      ${accessibilityAttributes}
    ></span>
  `.trim();
}

/* ==========================================================================
   Desktop Company Identity
   ========================================================================== */

export function renderCompanyCell(row = {}, config = {}) {
  const status = getCompanyStatus(row, config);

  return renderStandardCompanyCell(row, config, {
    leading: renderFavoriteButton(row),

    nameMetadata: renderCompanyStatus(status),
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
    <span class="${className}">
      ${escapeHtml(displayValue)}
    </span>
  `.trim();
}

/* ==========================================================================
   Mobile Identity
   ========================================================================== */

export function renderMobileIdentity(row = {}, config = {}) {
  const status = getCompanyStatus(row, config);

  return renderStandardCompanyCardIdentity(row, config, {
    leading: renderFavoriteButton(row, {
      className: "data-card__favorite",
    }),

    nameMetadata: renderCompanyStatus(status),
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
