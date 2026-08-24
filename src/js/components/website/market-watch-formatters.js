/* ==========================================================================
   Market Watch Formatters
   ========================================================================== */

/*
 * Shared pure formatting and markup helpers for:
 * - desktop DataTables cells
 * - mobile data cards
 *
 * This module has no:
 * - AJAX requests
 * - DataTables initialization
 * - event listeners
 * - DOM queries
 */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

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

  const result = Number(normalized);

  return Number.isFinite(result) ? result : null;
}

export function isZeroLike(value) {
  const number = toNumber(value);

  return number !== null && number === 0;
}

function getLocale(config = {}) {
  return config.locale || document.documentElement.lang || "en";
}

function getMarketConfig(config = {}) {
  return config.market || {};
}

function isAuction(config = {}) {
  return Boolean(getMarketConfig(config).isAuction ?? config.openCloseAuction);
}

export function getDisplayValue(value, fallback = "-") {
  if (value == null || value === "") {
    return fallback;
  }

  return String(value);
}

export function formatNumber(value, config = {}, options = {}) {
  const number = toNumber(value);

  if (number === null) {
    return getDisplayValue(value);
  }

  return new Intl.NumberFormat(getLocale(config), options).format(number);
}

/*
 * Use for cumulative values that must never be shortened:
 * 12123209 -> 12,123,209
 */

export function formatFullNumber(value, config = {}) {
  return formatNumber(value, config, {
    maximumFractionDigits: 0,
  });
}

/*
 * Preserve backend-supplied compact values such as 7.84M.
 * A raw numeric value is formatted normally.
 */

export function formatQuantity(value, config = {}) {
  if (value == null || value === "") {
    return "-";
  }

  const text = String(value).trim();

  if (/[a-z]/i.test(text)) {
    return text;
  }

  return formatNumber(value, config, {
    maximumFractionDigits: 2,
  });
}

export function formatPrice(value) {
  return getDisplayValue(value);
}

export function formatPercent(value) {
  const displayValue = getDisplayValue(value);

  if (displayValue === "-" || displayValue.endsWith("%")) {
    return displayValue;
  }

  return `${displayValue}%`;
}

export function getChangeClass(value) {
  const number = toNumber(value);

  if (number > 0) {
    return "price-up";
  }

  if (number < 0) {
    return "price-down";
  }

  return "price-neutral";
}

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
  const status = Number(row.companyStatus);

  if (status === 1) {
    return {
      className: "table-market__status table-market__status--warning ylwSymbol",
      title: labels.losses20To35 || "",
    };
  }

  if (status === 2) {
    return {
      className: "table-market__status table-market__status--caution orgSymbol",
      title: labels.losses35To50 || "",
    };
  }

  if (status === 3) {
    return {
      className: "table-market__status table-market__status--danger redSymbol",
      title: labels.losses50More || "",
    };
  }

  return {
    className: "",
    title: "",
  };
}

/* ==========================================================================
   Watchlist
   ========================================================================== */

export function isWatchlisted(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "TRUE" ||
    value === "yes" ||
    value === "YES" ||
    value === "y" ||
    value === "Y"
  );
}

export function getCompanyReference(row = {}) {
  return String(
    firstDefined(row.companyRef, row.companySymbol, row.symbol, ""),
  );
}

export function getCompanyName(row = {}) {
  return String(
    firstDefined(row.acrynomName, row.companyName, row.company, row.name, "-"),
  );
}

export function getCompanySymbol(row = {}) {
  return String(
    firstDefined(row.companySymbol, row.symbol, row.companyRef, ""),
  );
}

export function getCompanyUrl(row = {}) {
  return String(firstDefined(row.companyUrl, row.companyURL, "#"));
}

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
      aria-pressed="${active}"
    >
      <span class="has-icon ${iconClass}" aria-hidden="true"></span>
    </button>
  `.trim();
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

export function getCompanyLogoUrl(row = {}, config = {}) {
  const directUrl = firstDefined(
    row.companyLogoUrl,
    row.logoUrl,
    row.imageUrl,
    row.companyImageUrl,
  );

  if (directUrl) {
    return String(directUrl);
  }

  const template = config.assets?.companyLogoUrlTemplate;

  if (!template) {
    return "";
  }

  const companyCode = String(
    firstDefined(
      row.companyCode,
      row.companyRef,
      row.companySymbol,
      row.symbol,
      "",
    ),
  );

  if (!companyCode) {
    return "";
  }

  return template.replace("{companyCode}", encodeURIComponent(companyCode));
}

export function renderCompanyLogo(row = {}, config = {}, className) {
  const logoUrl = getCompanyLogoUrl(row, config);
  const companyName = getCompanyName(row);
  const logoClass = className || "table-market__logo";

  if (!logoUrl) {
    return `
      <span class="${escapeHtml(logoClass)}" aria-hidden="true">
        <span class="${escapeHtml(`${logoClass}-fallback`)}">
          ${escapeHtml(companyName.slice(0, 2))}
        </span>
      </span>
    `.trim();
  }

  return `
    <span class="${escapeHtml(logoClass)}">
      <img
        src="${escapeHtml(logoUrl)}"
        alt=""
        width="40"
        height="40"
        loading="lazy"
        data-market-watch-logo
      />
    </span>
  `.trim();
}

export function renderCompanyCell(row = {}, config = {}) {
  const status = getCompanyStatus(row, config);
  const companyName = getCompanyName(row);
  const companySymbol = getCompanySymbol(row);
  const companyUrl = getCompanyUrl(row);

  return `
    <div class="table-market__security-cell">
      ${renderFavoriteButton(row)}

      ${renderCompanyLogo(row, config)}

      <a
        class="table-market__security-link"
        href="${escapeHtml(companyUrl)}"
        ${status.title ? `title="${escapeHtml(status.title)}"` : ""}
      >
        <span class="table-market__name">
          ${escapeHtml(companyName)}
          ${
            status.className
              ? `<span class="${escapeHtml(status.className)}" aria-hidden="true"></span>`
              : ""
          }
        </span>

        ${
          companySymbol
            ? `<span class="table-market__symbol">${escapeHtml(companySymbol)}</span>`
            : ""
        }
      </a>
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
  const low = firstDefined(row.low52WeekPrice, "");
  const high = firstDefined(row.high52WeekPrice, "");
  const value = firstDefined(row.lastTradePriceModified, "");

  const position =
    isAuction(config) && isZeroLike(value)
      ? null
      : getRangePosition(low, high, value);

  const hasMarker = position !== null;

  return `
    <div
      class="table-market__range-content"
      data-range-has-value="${hasMarker}"
    >
      <div
        class="table-market__range-track"
        ${hasMarker ? `style="--range-position: ${position}%"` : ""}
        ${hasMarker ? `data-range-value="${escapeHtml(value)}"` : ""}
      >
        ${
          hasMarker
            ? '<span class="table-market__range-marker" aria-hidden="true"></span>'
            : ""
        }
      </div>

      <div class="table-market__range-values">
        <span>${escapeHtml(getDisplayValue(low))}</span>
        <span>${escapeHtml(getDisplayValue(high))}</span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Change Values
   ========================================================================== */

export function renderChange(value, numericValue, options = {}) {
  const className = getChangeClass(firstDefined(numericValue, value));

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
   Mobile Card Content
   ========================================================================== */

export function renderMobileIdentity(row = {}, config = {}) {
  const status = getCompanyStatus(row, config);
  const companyName = getCompanyName(row);
  const companySymbol = getCompanySymbol(row);

  return `
    <div class="data-card__identity">
      ${renderFavoriteButton(row, { className: "data-card__favorite" })}

      ${renderCompanyLogo(row, config, "data-card__logo")}

      <div class="data-card__identity-content">
        ${
          companySymbol
            ? `<span class="data-card__symbol">${escapeHtml(companySymbol)}</span>`
            : ""
        }

        <h3 class="data-card__title">
          ${escapeHtml(companyName)}
          ${
            status.className
              ? `<span class="${escapeHtml(status.className)}" aria-hidden="true"></span>`
              : ""
          }
        </h3>
      </div>
    </div>
  `.trim();
}

export function renderMobileQuote(row = {}, config = {}) {
  const price = formatAuctionValue(row.lastTradePriceModified, config);
  const change = renderChange(
    row.netChangeModified,
    firstDefined(row.netChange, row.changeValue, row.netChangeModified),
  );

  const percent = renderChange(
    row.precentChangeModified,
    firstDefined(
      row.precentChange,
      row.percentChange,
      row.precentChangeModified,
    ),
    { percent: true },
  );

  return `
    <div class="data-card__quote">
      <span class="data-card__price">${escapeHtml(price)}</span>

      <span class="data-card__change ${getChangeClass(
        firstDefined(row.precentChange, row.percentChange),
      )}">
        ${change} ${percent}
      </span>
    </div>
  `.trim();
}
