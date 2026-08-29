/* ==========================================================================
   Market Watch Formatters
   ========================================================================== */

/*
 * Presentation helpers for Market Watch.
 *
 * Responsibilities:
 *
 * - normalize display values
 * - convert and format numeric values
 * - format auction-state values
 * - derive price-change presentation
 * - resolve company identity values
 * - render company status
 * - resolve and render company logos
 * - render favorite controls
 * - render desktop company identity
 * - render 52-week range presentation
 * - render reusable mobile identity and quote fragments
 *
 * This module intentionally has no:
 *
 * - request logic
 * - response normalization
 * - filter state
 * - watchlist filtering
 * - DataTables lifecycle
 * - card collection rendering
 * - DOM queries
 * - event listeners
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_VALUE = "-";

const DEFAULT_MARKET_ORDER_LABEL = "MO";

const DEFAULT_LOGO_SIZE = 40;

const MOBILE_LOGO_SIZE = 44;

/* ==========================================================================
   General Helpers
   ========================================================================== */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function getLocale(config = {}) {
  return normalizeString(config.locale) || DEFAULT_LOCALE;
}

function isAuction(config = {}) {
  return Boolean(config.market?.isAuction);
}

function normalizeSize(value, fallback = DEFAULT_LOGO_SIZE) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return numericValue;
}

function getInitials(value) {
  return normalizeString(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

/* ==========================================================================
   Safe URLs
   ========================================================================== */

function isSafeHref(value) {
  const href = normalizeString(value);

  if (!href) {
    return false;
  }

  return !/^(?:javascript|data|vbscript):/i.test(href);
}

/* ==========================================================================
   HTML
   ========================================================================== */

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
   Numeric Conversion
   ========================================================================== */

export function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value)
    .replaceAll(",", "")
    .replaceAll("٬", "")
    .replaceAll("٫", ".")
    .replaceAll("−", "-")
    .replace(/[^0-9.+-]/g, "")
    .trim();

  if (!normalized || normalized === "+" || normalized === "-") {
    return null;
  }

  const numericValue = Number(normalized);

  return Number.isFinite(numericValue) ? numericValue : null;
}

export function isZeroLike(value) {
  const numericValue = toNumber(value);

  return numericValue !== null && numericValue === 0;
}

/* ==========================================================================
   Display Values
   ========================================================================== */

/*
 * Preserve the existing Market Watch empty-value presentation.
 *
 * Market Watch historically uses "-".
 *
 * Do not silently change this to another page's empty-value convention while
 * refactoring the JavaScript architecture.
 */

export function getDisplayValue(value, fallback = DEFAULT_EMPTY_VALUE) {
  if (value === null || value === undefined || normalizeString(value) === "") {
    return fallback;
  }

  return normalizeString(value);
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

export function formatNumber(value, config = {}, options = {}) {
  const numericValue = toNumber(value);

  if (numericValue === null) {
    return getDisplayValue(value);
  }

  return new Intl.NumberFormat(getLocale(config), options).format(numericValue);
}

export function formatFullNumber(value, config = {}) {
  return formatNumber(value, config, {
    maximumFractionDigits: 0,
  });
}

export function formatQuantity(value, config = {}) {
  const displayValue = getDisplayValue(value);

  if (displayValue === DEFAULT_EMPTY_VALUE) {
    return displayValue;
  }

  /*
   * Preserve service-provided abbreviations:
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
   Auction Formatting
   ========================================================================== */

export function formatAuctionValue(value, config = {}) {
  if (isAuction(config) && isZeroLike(value)) {
    return DEFAULT_EMPTY_VALUE;
  }

  return getDisplayValue(value);
}

export function formatAuctionQuantity(value, config = {}) {
  if (isAuction(config) && isZeroLike(value)) {
    return DEFAULT_EMPTY_VALUE;
  }

  return formatQuantity(value, config);
}

export function formatMarketOrder(value, config = {}) {
  if (isAuction(config) && isZeroLike(value)) {
    return (
      normalizeString(config.labels?.marketOrder) || DEFAULT_MARKET_ORDER_LABEL
    );
  }

  return getDisplayValue(value);
}

/* ==========================================================================
   Price Change
   ========================================================================== */

export function getChangeClass(value) {
  const numericValue = toNumber(value);

  if (numericValue !== null && numericValue > 0) {
    return "price-up";
  }

  if (numericValue !== null && numericValue < 0) {
    return "price-down";
  }

  return "price-neutral";
}

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
   Company Status
   ========================================================================== */

export function getCompanyStatus(row = {}, config = {}) {
  const labels = config.labels?.status ?? {};

  const status = Number(row.companyStatus);

  switch (status) {
    case 1:
      return {
        className:
          "table-market__status table-market__status--warning ylwSymbol",

        title: normalizeString(labels.losses20To35),
      };

    case 2:
      return {
        className:
          "table-market__status table-market__status--caution orgSymbol",

        title: normalizeString(labels.losses35To50),
      };

    case 3:
      return {
        className:
          "table-market__status table-market__status--danger redSymbol",

        title: normalizeString(labels.losses50More),
      };

    default:
      return {
        className: "",
        title: "",
      };
  }
}

function renderCompanyStatus(status = {}) {
  if (!normalizeString(status.className)) {
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
   Company Identity Values
   ========================================================================== */

/*
 * market-watch.normalizer.js supplies these canonical values.
 *
 * Fallbacks remain here so presentation is resilient when a formatter is used
 * independently or with an unnormalized row.
 */

export function getCompanyReference(row = {}) {
  return normalizeString(
    firstDefined(row.companyRef, row.companySymbol, row.symbol, ""),
  );
}

export function getCompanyCode(row = {}) {
  return normalizeString(
    firstDefined(
      row.companyCode,
      row.companyRef,
      row.companySymbol,
      row.symbol,
      "",
    ),
  );
}

export function getCompanyName(row = {}) {
  return normalizeString(
    firstDefined(
      row.companyName,
      row.acrynomName,
      row.company,
      row.name,
      DEFAULT_EMPTY_VALUE,
    ),
  );
}

export function getCompanySymbol(row = {}) {
  return normalizeString(
    firstDefined(row.companySymbol, row.symbol, row.companyRef, ""),
  );
}

export function getCompanyUrl(row = {}) {
  const value = firstDefined(row.companyUrl, row.companyURL, "");

  if (!isSafeHref(value)) {
    return "";
  }

  return normalizeString(value);
}

/* ==========================================================================
   Company Logo
   ========================================================================== */

export function getCompanyLogoFallbackUrl(config = {}) {
  const fallbackUrl = normalizeString(config.assets?.companyLogoFallbackUrl);

  return isSafeHref(fallbackUrl) ? fallbackUrl : "";
}

export function getCompanyLogoUrl(row = {}, config = {}) {
  const directUrl = firstDefined(
    row.companyLogoUrl,
    row.logoUrl,
    row.imageUrl,
    row.companyImageUrl,
  );

  if (
    directUrl !== null &&
    directUrl !== undefined &&
    normalizeString(directUrl)
  ) {
    const normalizedDirectUrl = normalizeString(directUrl);

    return isSafeHref(normalizedDirectUrl) ? normalizedDirectUrl : "";
  }

  const template = normalizeString(config.assets?.companyLogoUrlTemplate);

  const companyCode = getCompanyCode(row);

  if (!template || !companyCode) {
    return getCompanyLogoFallbackUrl(config);
  }

  const logoUrl = template.replace(
    "{companyCode}",
    encodeURIComponent(companyCode),
  );

  return isSafeHref(logoUrl) ? logoUrl : "";
}

export function renderCompanyLogo(
  row = {},
  config = {},
  className = "table-market__logo",
  options = {},
) {
  const logoUrl = getCompanyLogoUrl(row, config);

  const fallbackUrl = getCompanyLogoFallbackUrl(config);

  const companyName = getCompanyName(row);

  const size = normalizeSize(options.size, DEFAULT_LOGO_SIZE);

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
      ? `data-market-watch-logo-fallback="${escapeHtml(fallbackUrl)}"`
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
   Favorite
   ========================================================================== */

export function isFavoriteActive(value) {
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
   Company Text
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

/* ==========================================================================
   Desktop Company Cell
   ========================================================================== */

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

  /*
   * During auction, zero does not represent a meaningful range position.
   */

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
        size: MOBILE_LOGO_SIZE,
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
