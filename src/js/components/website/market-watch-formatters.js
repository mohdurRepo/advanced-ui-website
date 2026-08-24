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
 * - DOM queries
 * - event listeners
 */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
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

/* ==========================================================================
   Primitive Formatting
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

export function getDisplayValue(value, fallback = "-") {
  if (value == null || String(value).trim() === "") {
    return fallback;
  }

  return String(value).trim();
}

export function formatNumber(value, config = {}, options = {}) {
  const number = toNumber(value);

  if (number === null) {
    return getDisplayValue(value);
  }

  return new Intl.NumberFormat(getLocale(config), options).format(number);
}

/*
 * Cumulative quantities must remain complete:
 *
 * 12123209 → 12,123,209
 *
 * Do not use compact notation for this value.
 */

export function formatFullNumber(value, config = {}) {
  return formatNumber(value, config, {
    maximumFractionDigits: 0,
  });
}

/*
 * Preserve API-provided abbreviated values such as 7.84M.
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
   Market State
   ========================================================================== */

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

/*
 * These classes deliberately retain the legacy names because the existing
 * market-status styles and business meaning already depend on them:
 *
 * 1 → ylwSymbol
 * 2 → orgSymbol
 * 3 → redSymbol
 */

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
   Company Identity
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

export function getCompanyCode(row = {}) {
  return String(
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

  if (directUrl) {
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
 * `data-market-watch-logo-fallback` allows the table and mobile renderers to
 * replace a failed company image without inline JavaScript or CSP exceptions.
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
  const size = Number(options.size) || 40;
  const initials = getInitials(companyName);

  if (!logoUrl) {
    return `
      <span class="${escapeHtml(className)}" aria-hidden="true">
        <span class="${escapeHtml(`${className}-fallback`)}">
          ${escapeHtml(initials)}
        </span>
      </span>
    `.trim();
  }

  return `
    <span class="${escapeHtml(className)}">
      <img
        src="${escapeHtml(logoUrl)}"
        alt=""
        width="${size}"
        height="${size}"
        loading="lazy"
        data-market-watch-logo
        ${
          fallbackUrl && fallbackUrl !== logoUrl
            ? `data-market-watch-logo-fallback="${escapeHtml(fallbackUrl)}"`
            : ""
        }
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
      aria-pressed="${active}"
    >
      <span class="has-icon ${iconClass}" aria-hidden="true"></span>
    </button>
  `.trim();
}

/* ==========================================================================
   Desktop Company Cell
   ========================================================================== */

function renderCompanyText(row = {}, config = {}) {
  const status = getCompanyStatus(row, config);
  const companyName = getCompanyName(row);
  const companySymbol = getCompanySymbol(row);
  const companyUrl = getCompanyUrl(row);

  const content = `
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
  `.trim();

  if (!companyUrl) {
    return `<span class="table-market__security-link">${content}</span>`;
  }

  return `
    <a
      class="table-market__security-link"
      href="${escapeHtml(companyUrl)}"
      ${status.title ? `title="${escapeHtml(status.title)}"` : ""}
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
  const companyUrl = getCompanyUrl(row);

  const identityContent = `
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
  `.trim();

  const linkedIdentity = companyUrl
    ? `
      <a
        class="data-card__security-link"
        href="${escapeHtml(companyUrl)}"
        ${status.title ? `title="${escapeHtml(status.title)}"` : ""}
      >
        ${identityContent}
      </a>
    `.trim()
    : identityContent;

  return `
    <div class="data-card__identity">
      ${renderFavoriteButton(row, { className: "data-card__favorite" })}

      ${renderCompanyLogo(row, config, "data-card__logo", { size: 44 })}

      ${linkedIdentity}
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

      <span class="data-card__change">
        ${change}
        ${percent}
      </span>
    </div>
  `.trim();
}
