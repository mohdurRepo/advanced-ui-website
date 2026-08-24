/* ==========================================================================
   Market Watch Formatters
   ========================================================================== */

/*
 * Shared pure formatting and markup helpers for:
 *
 * - desktop DataTables cells
 * - mobile Market Watch cards
 *
 * This module intentionally has no:
 *
 * - AJAX requests
 * - DataTables setup
 * - event listeners
 * - application state
 */

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

function getInitials(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function isSafeHref(value) {
  const href = String(value || "").trim();

  if (!href) {
    return false;
  }

  return !/^(?:javascript|data|vbscript):/i.test(href);
}

function normalizeSize(value, fallback = 40) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return number;
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

/*
 * Cumulative quantities must remain complete.
 *
 * Example:
 *
 * 12123209 → 12,123,209
 *
 * Do not use compact notation.
 */

export function formatFullNumber(value, config = {}) {
  return formatNumber(value, config, {
    maximumFractionDigits: 0,
  });
}

/*
 * Preserve API-provided abbreviated values:
 *
 * 7.84M
 * 900K
 *
 * Raw numeric values are formatted normally.
 */

export function formatQuantity(value, config = {}) {
  const displayValue = getDisplayValue(value);

  if (displayValue === "-") {
    return displayValue;
  }

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

/*
 * Legacy status classes are retained intentionally because existing
 * styles/business semantics depend on them:
 *
 * 1 → ylwSymbol
 * 2 → orgSymbol
 * 3 → redSymbol
 */

export function getCompanyStatus(row = {}, config = {}) {
  const labels = config.labels?.status || {};

  const status = Number(row.companyStatus);

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
   Watchlist
   ========================================================================== */

export function isWatchlisted(value) {
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
   Company Identity
   ========================================================================== */

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
    firstDefined(row.acrynomName, row.companyName, row.company, row.name, "-"),
  ).trim();
}

export function getCompanySymbol(row = {}) {
  return String(
    firstDefined(row.companySymbol, row.symbol, row.companyRef, ""),
  ).trim();
}

export function getCompanyUrl(row = {}) {
  const url = firstDefined(row.companyUrl, row.companyURL, "");

  return isSafeHref(url) ? String(url).trim() : "";
}

/* ==========================================================================
   Company Logo
   ========================================================================== */

export function getCompanyLogoFallbackUrl(config = {}) {
  return String(config.assets?.companyLogoFallbackUrl || "").trim();
}

export function getCompanyLogoUrl(row = {}, config = {}) {
  const directUrl = firstDefined(
    row.companyLogoUrl,
    row.logoUrl,
    row.imageUrl,
    row.companyImageUrl,
  );

  if (directUrl != null && String(directUrl).trim()) {
    return String(directUrl).trim();
  }

  const template = String(config.assets?.companyLogoUrlTemplate || "").trim();

  const companyCode = getCompanyCode(row);

  if (!template || !companyCode) {
    return getCompanyLogoFallbackUrl(config);
  }

  return template.replace("{companyCode}", encodeURIComponent(companyCode));
}

/*
 * data-market-watch-logo-fallback allows renderers to replace a failed
 * company image without inline JavaScript or CSP exceptions.
 */

export function renderCompanyLogo(
  row = {},
  config = {},
  className = "table-market__logo",
  options = {},
) {
  const logoUrl = getCompanyLogoUrl(row, config);

  const fallbackUrl = getCompanyLogoFallbackUrl(config);

  const companyName = getCompanyName(row);

  const size = normalizeSize(options.size, 40);

  const initials = getInitials(companyName);

  if (!logoUrl) {
    return `
      <span
        class="${escapeHtml(className)}"
        aria-hidden="true"
      >
        <span
          class="${escapeHtml(`${className}-fallback`)}"
        >
          ${escapeHtml(initials)}
        </span>
      </span>
    `.trim();
  }

  const fallbackAttribute =
    fallbackUrl && fallbackUrl !== logoUrl
      ? `
        data-market-watch-logo-fallback="${escapeHtml(fallbackUrl)}"
      `.trim()
      : "";

  return `
    <span class="${escapeHtml(className)}">
      <img
        src="${escapeHtml(logoUrl)}"
        alt=""
        width="${size}"
        height="${size}"
        loading="lazy"
        data-market-watch-logo
        ${fallbackAttribute}
      />
    </span>
  `.trim();
}

/* ==========================================================================
   Favorite Control
   ========================================================================== */

export function renderFavoriteButton(row = {}, options = {}) {
  const active = isWatchlisted(row.watchlist);

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

  return `
    <span
      class="${escapeHtml(status.className)}"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Desktop Company Identity
   ========================================================================== */

function renderCompanyText(row = {}, config = {}) {
  const status = getCompanyStatus(row, config);

  const companyName = getCompanyName(row);

  const companySymbol = getCompanySymbol(row);

  const companyUrl = getCompanyUrl(row);

  const statusMarkup = renderCompanyStatus(status);

  const symbolMarkup = companySymbol
    ? `
        <span class="table-market__symbol">
          ${escapeHtml(companySymbol)}
        </span>
      `.trim()
    : "";

  const content = `
    <span class="table-market__name">
      ${escapeHtml(companyName)}
      ${statusMarkup}
    </span>

    ${symbolMarkup}
  `.trim();

  if (!companyUrl) {
    return `
      <span class="table-market__security-link">
        ${content}
      </span>
    `.trim();
  }

  const titleAttribute = status.title
    ? `title="${escapeHtml(status.title)}"`
    : "";

  return `
    <a
      class="table-market__security-link"
      href="${escapeHtml(companyUrl)}"
      ${titleAttribute}
    >
      ${content}
    </a>
  `.trim();
}

export function renderCompanyCell(row = {}, config = {}) {
  return `
    <div class="table-market__security-cell">
      ${renderFavoriteButton(row)}

      ${renderCompanyLogo(row, config)}

      ${renderCompanyText(row, config)}
    </div>
  `.trim();
}

/* ==========================================================================
   52-Week Range
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

  const companyName = getCompanyName(row);

  const companySymbol = getCompanySymbol(row);

  const companyUrl = getCompanyUrl(row);

  const statusMarkup = renderCompanyStatus(status);

  const symbolMarkup = companySymbol
    ? `
        <span class="data-card__symbol">
          ${escapeHtml(companySymbol)}
        </span>
      `.trim()
    : "";

  const identityContent = `
    <div class="data-card__identity-content">
      ${symbolMarkup}

      <h3 class="data-card__title">
        ${escapeHtml(companyName)}
        ${statusMarkup}
      </h3>
    </div>
  `.trim();

  const titleAttribute = status.title
    ? `title="${escapeHtml(status.title)}"`
    : "";

  const linkedIdentity = companyUrl
    ? `
        <a
          class="data-card__security-link"
          href="${escapeHtml(companyUrl)}"
          ${titleAttribute}
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

      ${renderCompanyLogo(row, config, "data-card__logo", {
        size: 44,
      })}

      ${linkedIdentity}
    </div>
  `.trim();
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
