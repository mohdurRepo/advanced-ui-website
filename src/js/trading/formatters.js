/* ==========================================================================
   Trading Formatters
   ========================================================================== */

/*
 * Shared presentation helpers for all Trading views.
 *
 * Responsibilities:
 *
 * - safe display values
 * - HTML escaping
 * - safe URLs
 * - dates
 * - numeric values
 * - price / change states
 * - company-status mapping
 * - company logos
 * - Trading identity normalization
 * - desktop identity rendering
 * - standalone Symbol rendering
 * - generic table-cell rendering
 * - mobile identity rendering
 * - shared mobile summaries
 * - Negotiated daily totals
 * - Minimum Size matrix rendering
 *
 * This module intentionally has no:
 *
 * - AJAX
 * - filter state
 * - DataTables lifecycle
 * - tab behavior
 * - DOM event listeners
 *
 * Company-logo error handling remains owned by trading.js because error
 * handling is runtime behavior rather than formatting.
 */

/* ==========================================================================
   Values
   ========================================================================== */

export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function getDisplayValue(value, fallback = "-") {
  return hasValue(value) ? String(value) : fallback;
}

function firstDefined(...values) {
  return values.find(
    (value) => value !== null && value !== undefined && value !== "",
  );
}

function normalizeString(value, fallback = "") {
  if (!hasValue(value)) {
    return fallback;
  }

  return String(value).trim();
}

/* ==========================================================================
   HTML
   ========================================================================== */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   URL
   ========================================================================== */

export function safeUrl(value) {
  if (!hasValue(value)) {
    return "";
  }

  const url = String(value).trim();

  /*
   * Existing backend links are commonly application-relative.
   */

  if (
    url.startsWith("/") ||
    url.startsWith("./") ||
    url.startsWith("../") ||
    url.startsWith("#")
  ) {
    return url;
  }

  try {
    const parsed = new URL(url, window.location.href);

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
  } catch {
    return "";
  }

  return "";
}

/* ==========================================================================
   Locale
   ========================================================================== */

function getLocale(config = {}) {
  return config.locale || document.documentElement.lang || undefined;
}

/* ==========================================================================
   Numbers
   ========================================================================== */

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (!hasValue(value)) {
    return null;
  }

  const normalized = String(value).replace(/,/g, "").replace(/%/g, "").trim();

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

export function formatNumber(value, config = {}, options = {}) {
  const number = parseNumber(value);

  if (number === null) {
    return getDisplayValue(value, options.fallback || "-");
  }

  try {
    return new Intl.NumberFormat(getLocale(config), {
      maximumFractionDigits: options.maximumFractionDigits ?? 2,

      minimumFractionDigits: options.minimumFractionDigits ?? 0,

      useGrouping: options.useGrouping !== false,
    }).format(number);
  } catch {
    /*
     * Backend display value remains a safe fallback.
     */

    return String(value);
  }
}

export function formatQuantity(value, config = {}) {
  return formatNumber(value, config, {
    maximumFractionDigits: 0,
  });
}

export function formatMoney(value, config = {}) {
  return formatNumber(value, config, {
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value, config = {}) {
  if (!hasValue(value)) {
    return "-";
  }

  const text = String(value).trim();

  /*
   * Modified backend values may already contain "%".
   */

  if (text.includes("%")) {
    return text;
  }

  const formatted = formatNumber(value, config, {
    maximumFractionDigits: 2,
  });

  return formatted === "-" ? formatted : `${formatted}%`;
}

/* ==========================================================================
   Dates
   ========================================================================== */

function pad2(value) {
  return String(value).padStart(2, "0");
}

/* ==========================================================================
   Date Parsing
   ========================================================================== */

function parseDateParts(value) {
  if (!hasValue(value)) {
    return null;
  }

  const text = String(value).trim();

  /*
   * yyyy-MM-dd
   */

  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return {
      year: Number(match[1]),

      month: Number(match[2]),

      day: Number(match[3]),
    };
  }

  /*
   * dd-MM-yyyy
   * dd/MM/yyyy
   */

  match = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);

  if (match) {
    return {
      year: Number(match[3]),

      month: Number(match[2]),

      day: Number(match[1]),
    };
  }

  return null;
}

/* ==========================================================================
   Display Date
   ========================================================================== */

export function formatTradingDate(value) {
  if (!hasValue(value)) {
    return "";
  }

  const text = String(value).trim();

  /*
   * Preserve backend display strings.
   *
   * Only normalize exact native yyyy-MM-dd values.
   */

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!iso) {
    return text;
  }

  return [iso[3], iso[2], iso[1]].join("-");
}

/* ==========================================================================
   Request Date
   ========================================================================== */

export function toRequestDate(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    return hasValue(value) ? String(value) : "";
  }

  return [pad2(parts.day), pad2(parts.month), parts.year].join("-");
}

/* ==========================================================================
   Native Input Date
   ========================================================================== */

function toInputDate(date) {
  return [
    date.getFullYear(),

    pad2(date.getMonth() + 1),

    pad2(date.getDate()),
  ].join("-");
}

/* ==========================================================================
   Calendar Month
   ========================================================================== */

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function subtractCalendarMonth(date) {
  /*
   * Native:
   *
   * new Date(2026, 2, 31).setMonth(1)
   *
   * can roll into March because February has fewer days.
   *
   * Trading requires one CALENDAR month, so clamp the day explicitly:
   *
   * 31 March -> 28/29 February
   */

  const target = new Date(date.getFullYear(), date.getMonth() - 1, 1);

  const targetDay = Math.min(
    date.getDate(),

    getDaysInMonth(target.getFullYear(), target.getMonth()),
  );

  target.setDate(targetDay);

  return target;
}

/* ==========================================================================
   Default Trading Date Range
   ========================================================================== */

export function getDefaultTradingDateRange(today = new Date()) {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const from = subtractCalendarMonth(to);

  return Object.freeze({
    fromDate: toInputDate(from),

    toDate: toInputDate(to),
  });
}

/* ==========================================================================
   Change State
   ========================================================================== */

function getChangeClass(value) {
  const number = parseNumber(value);

  if (number === null || number === 0) {
    return "price-neutral";
  }

  return number > 0 ? "price-up" : "price-down";
}

/* ==========================================================================
   Price Change
   ========================================================================== */

export function renderPriceChange(
  displayValue,
  numericValue = displayValue,
  {
    percent = false,

    config = {},

    className = "table-market__change",
  } = {},
) {
  const display = percent
    ? formatPercent(displayValue, config)
    : getDisplayValue(displayValue, "-");

  const stateClass = getChangeClass(numericValue);

  return `
    <span
      class="${escapeHtml([className, stateClass].filter(Boolean).join(" "))}"
    >
      ${escapeHtml(display)}
    </span>
  `.trim();
}

/* ==========================================================================
   Company Status
   ========================================================================== */

/*
 * Exact legacy Trading contract:
 *
 * 1 -> accumulated loss warning
 *      ylwSymbol
 *
 * 2 -> accumulated loss caution
 *      orgSymbol
 *
 * 3 -> accumulated loss danger
 *      redSymbol
 *
 * Do not infer these states from text such as "20", "35", "50".
 * The backend status value is authoritative.
 */

export function getCompanyStatus(value, config = {}) {
  const normalized = String(value ?? "").trim();

  const labels = config.labels?.status || {};

  switch (normalized) {
    case "1":
      return Object.freeze({
        value: 1,

        key: "warning",

        className: "table-market__status--warning",

        legacyClassName: "ylwSymbol",

        title: labels.losses20To35 || "",
      });

    case "2":
      return Object.freeze({
        value: 2,

        key: "caution",

        className: "table-market__status--caution",

        legacyClassName: "orgSymbol",

        title: labels.losses35To50 || "",
      });

    case "3":
      return Object.freeze({
        value: 3,

        key: "danger",

        className: "table-market__status--danger",

        legacyClassName: "redSymbol",

        title: labels.losses50More || "",
      });

    default:
      return Object.freeze({
        value: null,

        key: "",

        className: "",

        legacyClassName: "",

        title: "",
      });
  }
}

/* ==========================================================================
   Company Status Markup
   ========================================================================== */

export function renderCompanyStatus(
  value,
  config = {},
  { className = "" } = {},
) {
  const status =
    typeof value === "object" && value !== null && "key" in value
      ? value
      : getCompanyStatus(value, config);

  if (!status.key) {
    return "";
  }

  const classes = [
    "table-market__status",

    status.className,

    /*
     * Compatibility with the exact legacy class contract.
     *
     * This can be removed later only after all legacy page-level styling has
     * been fully migrated.
     */

    status.legacyClassName,

    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (status.title) {
    return `
      <span
        class="${escapeHtml(classes)}"
        role="img"
        aria-label="${escapeHtml(status.title)}"
        title="${escapeHtml(status.title)}"
      ></span>
    `.trim();
  }

  return `
    <span
      class="${escapeHtml(classes)}"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Security Link
   ========================================================================== */

export function renderSecurityLink(label, url, className = "") {
  const text = getDisplayValue(label, "-");

  const safe = safeUrl(url);

  if (!safe) {
    return escapeHtml(text);
  }

  return `
    <a
      ${className ? `class="${escapeHtml(className)}"` : ""}
      href="${escapeHtml(safe)}"
    >
      ${escapeHtml(text)}
    </a>
  `.trim();
}

/* ==========================================================================
   Trading Identity
   ========================================================================== */

/*
 * Endpoint-specific identity mappings.
 *
 * IMPORTANT:
 *
 * These property names come from the existing Trading backend contracts.
 * They must not be normalized into invented generic response fields.
 */

export function getTradingIdentity(row = {}, view = "") {
  switch (view) {
    /* ----------------------------------------------------------------------
       Negotiated Deals
       ---------------------------------------------------------------------- */

    case "negotiatedDeals":
      return Object.freeze({
        code: getDisplayValue(row.symbol, ""),

        name: getDisplayValue(row.company, ""),

        url: safeUrl(row.companyURL),

        status: null,
      });

    /* ----------------------------------------------------------------------
       Accumulated Losses
       ---------------------------------------------------------------------- */

    case "accumulatedLosses":
      return Object.freeze({
        code: getDisplayValue(row.symbol, ""),

        name: getDisplayValue(row.company, ""),

        url: safeUrl(row.companyURL),

        status: row.companyStatus,
      });

    /* ----------------------------------------------------------------------
       Listed Tradable Rights
       ---------------------------------------------------------------------- */

    case "listedTradableRights":
      return Object.freeze({
        /*
         * Some response versions may expose a symbol in addition to
         * acrynomName. Use it when available but never require it.
         */

        code: getDisplayValue(
          firstDefined(row.symbol, row.companySymbol, ""),
          "",
        ),

        name: getDisplayValue(row.acrynomName, ""),

        url: safeUrl(row.pageUrl),

        status: row.companyStatus ?? null,
      });

    /* ----------------------------------------------------------------------
       Suspended
       ---------------------------------------------------------------------- */

    case "suspendedCompanies":
      return Object.freeze({
        code: getDisplayValue(row.symbol, ""),

        name: getDisplayValue(row.name, ""),

        url: safeUrl(row.companyURL),

        status: row.companyStatus,
      });

    /* ----------------------------------------------------------------------
       Delisted
       ---------------------------------------------------------------------- */

    case "delistedCompanies":
      return Object.freeze({
        code: getDisplayValue(row.symbol, ""),

        name: getDisplayValue(row.name, ""),

        url: safeUrl(row.companyURL),

        status: row.companyStatus,
      });

    /* ----------------------------------------------------------------------
       OTC
       ---------------------------------------------------------------------- */

    case "otcTrading":
      return Object.freeze({
        code: getDisplayValue(row.symbol, ""),

        name: getDisplayValue(row.companyName, ""),

        url: safeUrl(row.companyURL),

        status: row.companyStatus,
      });

    default:
      return Object.freeze({
        code: "",

        name: "",

        url: "",

        status: null,
      });
  }
}

/* ==========================================================================
   Company Name
   ========================================================================== */

/*
 * Used by logo fallback generation without requiring a view name.
 */

function getAnyCompanyName(row = {}) {
  return normalizeString(
    firstDefined(
      row.company,
      row.companyName,
      row.name,
      row.acrynomName,
      row.longName,
      "",
    ),
  );
}

/* ==========================================================================
   Company Code
   ========================================================================== */

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

/* ==========================================================================
   Company Initials
   ========================================================================== */

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

/* ==========================================================================
   Company Logo URL
   ========================================================================== */

export function getCompanyLogoFallbackUrl(config = {}) {
  return normalizeString(config.assets?.companyLogoFallbackUrl);
}

export function getCompanyLogoUrl(row = {}, config = {}) {
  /*
   * Prefer an explicit URL from the API when available.
   */

  const directUrl = firstDefined(
    row.companyLogoUrl,
    row.logoUrl,
    row.imageUrl,
    row.companyImageUrl,
    row.logo,
    row.image,
  );

  if (hasValue(directUrl)) {
    const safe = safeUrl(directUrl);

    if (safe) {
      return safe;
    }
  }

  /*
   * Otherwise build the URL using the same company-code contract as
   * Market Watch.
   */

  const template = normalizeString(config.assets?.companyLogoUrlTemplate);

  const companyCode = getCompanyCode(row);

  if (template && companyCode) {
    return template.replace("{companyCode}", encodeURIComponent(companyCode));
  }

  /*
   * Stable generic fallback.
   */

  return getCompanyLogoFallbackUrl(config);
}
/* ==========================================================================
   Company Logo
   ========================================================================== */

function normalizeLogoSize(value, fallback = 40) {
  const size = Number(value);

  return Number.isFinite(size) && size > 0 ? size : fallback;
}

export function renderCompanyLogo(
  row = {},
  config = {},
  {
    className = "table-market__logo",

    size = 40,
  } = {},
) {
  const logoUrl = getCompanyLogoUrl(row, config);

  const fallbackUrl = getCompanyLogoFallbackUrl(config);

  const companyName = getAnyCompanyName(row);

  const initials = getInitials(companyName);

  const normalizedSize = normalizeLogoSize(size, 40);

  /*
   * If no image contract exists at all, keep a proper identity surface rather
   * than rendering a broken <img>.
   */

  if (!logoUrl) {
    return `
      <span
        class="${escapeHtml(className)}"
        aria-hidden="true"
      >
        <span
          class="${escapeHtml(`${className}-fallback`)}"
        >
          ${escapeHtml(initials || "—")}
        </span>
      </span>
    `.trim();
  }

  const fallbackAttribute =
    fallbackUrl && fallbackUrl !== logoUrl
      ? `
          data-trading-logo-fallback="${escapeHtml(fallbackUrl)}"
        `.trim()
      : "";

  return `
    <span
      class="${escapeHtml(className)}"
      aria-hidden="true"
    >
      <img
        src="${escapeHtml(logoUrl)}"
        alt=""
        width="${normalizedSize}"
        height="${normalizedSize}"
        loading="lazy"
        data-trading-logo
        ${fallbackAttribute}
      />
    </span>
  `.trim();
}

/* ==========================================================================
   Desktop Identity Content
   ========================================================================== */

function renderDesktopIdentityContent(identity, config = {}) {
  const status = getCompanyStatus(identity.status, config);

  const nameMarkup = `
    <span
      class="table-market__name"
    >
      ${escapeHtml(identity.name || "-")}
    </span>
  `.trim();

  const symbolMarkup = identity.code
    ? `
          <span
            class="table-market__symbol"
          >
            ${escapeHtml(identity.code)}
          </span>
        `.trim()
    : "";

  const statusMarkup = renderCompanyStatus(status, config);

  const secondaryMarkup =
    symbolMarkup || statusMarkup
      ? `
          <span
            class="table-market__identity-status"
          >
            ${symbolMarkup}
            ${statusMarkup}
          </span>
        `.trim()
      : "";

  return `
    ${nameMarkup}
    ${secondaryMarkup}
  `.trim();
}

/* ==========================================================================
   Desktop Company / Security Cell
   ========================================================================== */

/*
 * Canonical Trading identity:
 *
 * [ logo ]  Company Name
 *           Symbol   •status
 *
 * This intentionally follows the Market Watch visual system.
 */

export function renderTradingCompanyCell(row, view, config = {}) {
  const identity = getTradingIdentity(row, view);

  const identityContent = renderDesktopIdentityContent(identity, config);

  const linkedContent = identity.url
    ? `
          <a
            class="table-market__security-link"
            href="${escapeHtml(identity.url)}"
          >
            ${identityContent}
          </a>
        `.trim()
    : `
          <span
            class="table-market__security-link"
          >
            ${identityContent}
          </span>
        `.trim();

  return `
    <div
      class="table-market__security-cell"
    >
      ${renderCompanyLogo(row, config, {
        className: "table-market__logo",

        size: 40,
      })}

      ${linkedContent}
    </div>
  `.trim();
}

/* ==========================================================================
   Compatibility Identity API
   ========================================================================== */

/*
 * Keep the previous public function while existing view modules are migrated.
 *
 * New code should prefer renderTradingCompanyCell().
 */

export function renderIdentityCell(row, view, config = {}) {
  return renderTradingCompanyCell(row, view, config);
}

/* ==========================================================================
   Standalone Symbol Cell
   ========================================================================== */

/*
 * Some Trading tables still contain a separate Symbol column.
 *
 * Until those tabs are migrated to one combined Market Watch-style identity
 * column, use this formatter so status dots remain correct and consistent.
 */

export function renderTradingSymbolCell(row, view, config = {}) {
  const identity = getTradingIdentity(row, view);

  const statusMarkup = renderCompanyStatus(identity.status, config);

  return `
    <span
      class="table-market__symbol-status"
    >
      <span
        class="table-market__symbol"
      >
        ${escapeHtml(identity.code || "-")}
      </span>

      ${statusMarkup}
    </span>
  `.trim();
}

/* ==========================================================================
   Announcement URL
   ========================================================================== */

export function getSuspendedAnnouncementUrl(row = {}) {
  return safeUrl(firstDefined(row.annUrl, row.newsUrl, row.newsURL, row.url));
}

export function getDelistedAnnouncementUrl(row = {}) {
  return safeUrl(firstDefined(row.newsUrl, row.newsURL, row.url));
}

/* ==========================================================================
   Announcement Link
   ========================================================================== */

export function renderAnnouncementLink(url, label) {
  const safe = safeUrl(url);

  if (!safe) {
    return "-";
  }

  return `
    <a
      class="table-market__action-link"
      href="${escapeHtml(safe)}"
    >
      ${escapeHtml(getDisplayValue(label, "View"))}
    </a>
  `.trim();
}

/* ==========================================================================
   Generic Column Value
   ========================================================================== */

function getColumnValue(row, column) {
  if (typeof column?.value === "function") {
    return column.value(row);
  }

  if (column?.data) {
    return row?.[column.data];
  }

  return "";
}

/* ==========================================================================
   Trading Cell
   ========================================================================== */

export function renderTradingCell({
  row = {},
  column = {},
  type = "display",
  config = {},
  view = "",
} = {}) {
  const value = getColumnValue(row, column);

  /*
   * DataTables sorting/searching should receive raw values rather than
   * rendered markup.
   */

  if (type !== "display") {
    return value ?? "";
  }

  switch (column.format) {
    /* ----------------------------------------------------------------------
       Identity
       ---------------------------------------------------------------------- */

    case "identity":
      return renderTradingCompanyCell(row, view || column.view, config);

    /* ----------------------------------------------------------------------
       Separate Symbol + Status
       ---------------------------------------------------------------------- */

    case "symbol-status":
      return renderTradingSymbolCell(row, view || column.view, config);

    /* ----------------------------------------------------------------------
       Number
       ---------------------------------------------------------------------- */

    case "number":
      return escapeHtml(formatNumber(value, config));

    /* ----------------------------------------------------------------------
       Quantity
       ---------------------------------------------------------------------- */

    case "quantity":
      return escapeHtml(formatQuantity(value, config));

    /* ----------------------------------------------------------------------
       Money
       ---------------------------------------------------------------------- */

    case "money":
      return escapeHtml(formatMoney(value, config));

    /* ----------------------------------------------------------------------
       Percent
       ---------------------------------------------------------------------- */

    case "percent":
      return escapeHtml(formatPercent(value, config));

    /* ----------------------------------------------------------------------
       Date
       ---------------------------------------------------------------------- */

    case "date":
      return escapeHtml(getDisplayValue(formatTradingDate(value), "-"));

    /* ----------------------------------------------------------------------
       Change
       ---------------------------------------------------------------------- */

    case "change":
      return renderPriceChange(
        value,

        column.numericData ? row?.[column.numericData] : value,

        {
          config,
        },
      );

    /* ----------------------------------------------------------------------
       Percent Change
       ---------------------------------------------------------------------- */

    case "percent-change":
      return renderPriceChange(
        value,

        column.numericData ? row?.[column.numericData] : value,

        {
          percent: true,

          config,
        },
      );

    /* ----------------------------------------------------------------------
       Link
       ---------------------------------------------------------------------- */

    case "link":
      return renderSecurityLink(
        value,

        column.urlData ? row?.[column.urlData] : "",

        column.linkClassName || "",
      );

    /* ----------------------------------------------------------------------
       Suspended Announcement
       ---------------------------------------------------------------------- */

    case "suspended-announcement":
    case "suspended-news-link":
      return renderAnnouncementLink(
        getSuspendedAnnouncementUrl(row),

        config.labels?.suspendedLink || getDisplayValue(value, "View"),
      );

    /* ----------------------------------------------------------------------
       Delisted Announcement
       ---------------------------------------------------------------------- */

    case "delisted-news":
    case "delisted-news-link":
      return renderAnnouncementLink(
        getDelistedAnnouncementUrl(row),

        config.labels?.delistedLink || getDisplayValue(value, "View"),
      );

    /* ----------------------------------------------------------------------
       Plain
       ---------------------------------------------------------------------- */

    default:
      return escapeHtml(getDisplayValue(value, "-"));
  }
}

/* ==========================================================================
   Mobile Identity
   ========================================================================== */

/*
 * Compact market-card identity:
 *
 * [logo] Company Name
 *        Symbol
 *
 * The right-side market value is rendered separately by the view summary.
 */

export function renderMobileIdentity(row, view, config = {}) {
  const identity = getTradingIdentity(row, view);

  const statusMarkup = renderCompanyStatus(identity.status, config);

  const secondary = [
    identity.code
      ? `
          <span
            class="data-card__symbol"
          >
            ${escapeHtml(identity.code)}
          </span>
        `.trim()
      : "",

    statusMarkup,
  ]
    .filter(Boolean)
    .join("");

  const content = `
    <div
      class="data-card__identity-content"
    >
      <h4
        class="data-card__title"
      >
        ${escapeHtml(identity.name || "-")}
      </h4>

      ${
        secondary
          ? `
              <span
                class="data-card__identity-code"
              >
                ${secondary}
              </span>
            `.trim()
          : ""
      }
    </div>
  `.trim();

  const identityContent = identity.url
    ? `
          <a
            class="data-card__security-link"
            href="${escapeHtml(identity.url)}"
          >
            ${content}
          </a>
        `.trim()
    : content;

  return `
    <div
      class="data-card__identity"
    >
      ${renderCompanyLogo(row, config, {
        className: "data-card__logo",

        size: 44,
      })}

      ${identityContent}
    </div>
  `.trim();
}

/* ==========================================================================
   Negotiated Mobile Summary
   ========================================================================== */

/*
 * Approved compact Negotiated mobile composition:
 *
 * LEFT
 *   logo + Company Name
 *          Symbol
 *
 * RIGHT
 *   Price
 *   Value
 *
 * Collapsed card intentionally has NO visible table-style labels.
 *
 * Volume and Time belong in expandable details.
 */

export function renderNegotiatedMobileSummary(row, config = {}) {
  return `
    <div
      class="data-card__quote"
    >
      <span
        class="data-card__price"
      >
        ${escapeHtml(formatMoney(row?.tradePrice, config))}
      </span>

      <span
        class="data-card__change"
      >
        ${escapeHtml(formatMoney(row?.turnOver, config))}
      </span>
    </div>
  `.trim();
}

/* ==========================================================================
   Listed Tradable Mobile Summary
   ========================================================================== */

/*
 * Listed Tradable follows the Market Watch card hierarchy:
 *
 * LEFT
 *   security identity
 *
 * RIGHT
 *   Price
 *   Change %
 *
 * Price / Change % should not be repeated inside expandable details.
 */

export function renderListedTradableMobileSummary(row, config = {}) {
  const labels = config.labels?.listedTradable || {};

  return `
    <div
      class="data-card__quote"
    >
      <div
        class="data-card__quote-item"
      >
        <span
          class="data-card__quote-label"
        >
          ${escapeHtml(labels.lastTradePrice || "Price")}
        </span>

        <span
          class="data-card__price"
        >
          ${escapeHtml(getDisplayValue(row?.lastTradePriceModified, "-"))}
        </span>
      </div>

      <div
        class="data-card__quote-item"
      >
        <span
          class="data-card__quote-label"
        >
          ${escapeHtml(labels.changePercent || "Change %")}
        </span>

        ${renderPriceChange(
          row?.percentChangeModified,

          row?.percentChangeDoubleModified,

          {
            percent: true,

            config,
          },
        )}
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   OTC Mobile Summary
   ========================================================================== */

export function renderOtcMobileSummary(row, config = {}) {
  const labels = config.labels?.otc || {};

  return `
    <div
      class="data-card__quote"
    >
      <div
        class="data-card__quote-item"
      >
        <span
          class="data-card__quote-label"
        >
          ${escapeHtml(labels.tradedVolume || "Traded Volume")}
        </span>

        <span
          class="data-card__price"
        >
          ${escapeHtml(formatQuantity(row?.lastTradeVolume, config))}
        </span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Generic Mobile Summary
   ========================================================================== */

export function renderMobileSummaryValue(row, view, config = {}) {
  switch (view) {
    case "negotiatedDeals":
      return renderNegotiatedMobileSummary(row, config);

    case "listedTradableRights":
      return renderListedTradableMobileSummary(row, config);

    case "otcTrading":
      return renderOtcMobileSummary(row, config);

    default:
      return "";
  }
}

/* ==========================================================================
   Mobile Field
   ========================================================================== */

/*
 * Generic bridge between table schemas and standard data-card fields.
 *
 * Individual views may still define explicit mobile fields when their
 * hierarchy differs from the desktop column order.
 */

export function createMobileField(row, column, config = {}, view = "") {
  return {
    key: column.key,

    label: column.label || column.key,

    value: renderTradingCell({
      row,
      column,

      type: "display",

      config,
      view,
    }),

    numeric: Boolean(column.numeric),
  };
}

/* ==========================================================================
   Negotiated Helpers
   ========================================================================== */

export function getNegotiatedDateGroup(row) {
  return formatTradingDate(row?.strDate);
}

/* ==========================================================================
   Total Row Detection
   ========================================================================== */

export function isTotalRow(row = {}) {
  /*
   * Historical Negotiated responses have represented daily totals in several
   * compatible ways.
   */

  if (row.isTotal === true || row.total === true) {
    return true;
  }

  const type = firstDefined(row.rowType, row.type, row.recordType);

  if (hasValue(type) && String(type).trim().toLowerCase() === "total") {
    return true;
  }

  const symbol = String(row.symbol ?? "")
    .trim()
    .toLowerCase();

  return symbol === "total";
}

/* ==========================================================================
   Negotiated Total Values
   ========================================================================== */

function getNegotiatedTotalVolume(row = {}) {
  return firstDefined(
    row.totalVolume,
    row.volume,
    row.tradeVolume,
    row.tradedVolume,
  );
}

function getNegotiatedTotalValue(row = {}) {
  return firstDefined(row.totalValue, row.turnOver, row.turnover, row.value);
}

/* ==========================================================================
   Negotiated Daily Total Card
   ========================================================================== */

/*
 * Date grouping already owns the contextual heading.
 *
 * Therefore the summary card does NOT repeat:
 *
 * Daily
 * Total
 *
 * It presents only the two aggregate values.
 */

export function renderNegotiatedDailyTotalCard(row, config = {}) {
  const volumeLabel = config.labels?.negotiatedDeals?.volume || "Volume";

  const valueLabel = config.labels?.negotiatedDeals?.value || "Value";

  return `
    <article
      class="
        data-card
        data-card--compact
        trading-daily-total-card
      "
    >
      <div
        class="data-card__main"
      >
        <div
          class="data-card__identity"
        >
          <div
            class="data-card__identity-content"
          >
            <span
              class="data-card__symbol"
            >
              ${escapeHtml(volumeLabel)}
            </span>

            <span
              class="data-card__title"
            >
              ${escapeHtml(
                formatQuantity(getNegotiatedTotalVolume(row), config),
              )}
            </span>
          </div>
        </div>

        <div
          class="data-card__quote"
        >
          <span
            class="data-card__symbol"
          >
            ${escapeHtml(valueLabel)}
          </span>

          <span
            class="data-card__price"
          >
            ${escapeHtml(formatMoney(getNegotiatedTotalValue(row), config))}
          </span>
        </div>
      </div>
    </article>
  `.trim();
}
/* ==========================================================================
   Minimum Size Matrix
   ========================================================================== */

/*
 * Minimum Size is not an ordinary table.
 *
 * Desktop:
 *
 * Header level 1 ┐
 * Header level 2 ├── col1
 * Header level 3 ┘
 *
 * Header level 1 ┐
 * Header level 2 ├── col2
 * Header level 3 ┘
 *
 * ...etc.
 *
 * Mobile must preserve that semantic hierarchy rather than flattening the
 * matrix into four unrelated label/value fields.
 */

/* ==========================================================================
   Minimum Size Values
   ========================================================================== */

export function getMinimumSizeValues(row = {}) {
  return [row.col1, row.col2, row.col3, row.col4];
}

/* ==========================================================================
   Minimum Size Matrix Configuration
   ========================================================================== */

/*
 * Preferred configuration:
 *
 * minimumSize: {
 *   columns: [
 *     {
 *       key: "col1",
 *       levels: [
 *         "...",
 *         "...",
 *         "..."
 *       ]
 *     },
 *     ...
 *   ],
 *
 *   rows: [
 *     "...",
 *     "...",
 *     "..."
 *   ]
 * }
 *
 * rows are retained in configuration for semantic completeness and future
 * accessibility/presentation needs.
 *
 * Mobile rendering currently consumes columns[].levels because every backend
 * value sits beneath one vertical three-level heading path.
 */

function getMinimumSizeColumns(config = {}) {
  const configured = config.labels?.minimumSize?.columns;

  if (Array.isArray(configured) && configured.length) {
    return configured
      .filter(
        (column) =>
          column &&
          typeof column === "object" &&
          typeof column.key === "string" &&
          column.key.trim() !== "",
      )
      .map((column) => ({
        key: column.key.trim(),

        levels: Array.isArray(column.levels)
          ? column.levels.filter(hasValue).map((label) => String(label))
          : [],
      }));
  }

  /*
   * Compatibility fallback while an older JSP configuration is still active.
   *
   * Importantly, we use only labels actually supplied by the page.
   * We do not invent the missing matrix levels.
   */

  const labels = config.labels?.minimumSize || {};

  return [
    {
      key: "col1",

      levels: [labels.col1].filter(hasValue),
    },

    {
      key: "col2",

      levels: [labels.col2].filter(hasValue),
    },

    {
      key: "col3",

      levels: [labels.col3].filter(hasValue),
    },

    {
      key: "col4",

      levels: [labels.col4].filter(hasValue),
    },
  ];
}

/* ==========================================================================
   Minimum Size Display Value
   ========================================================================== */

function getMinimumSizeDisplayValue(value) {
  if (value && typeof value === "object") {
    return firstDefined(value.symbol, value.name, value.label, value.value);
  }

  return value;
}

/* ==========================================================================
   Minimum Size Search Text
   ========================================================================== */

export function getMinimumSizeSearchText(row = {}) {
  return getMinimumSizeValues(row)
    .map((value) => {
      if (value && typeof value === "object") {
        return [value.symbol, value.name, value.label, value.value]
          .filter(hasValue)
          .join(" ");
      }

      return getDisplayValue(value, "");
    })
    .join(" ")
    .toLowerCase();
}

/* ==========================================================================
   Minimum Size Security Reference
   ========================================================================== */

function renderMinimumSizeSecurityReference(value) {
  if (value && typeof value === "object") {
    const label = firstDefined(
      value.symbol,
      value.name,
      value.label,
      value.value,
    );

    const url = firstDefined(value.url, value.pageUrl, value.companyURL);

    return renderSecurityLink(label, url);
  }

  return escapeHtml(getDisplayValue(value, "-"));
}

/* ==========================================================================
   Minimum Size Value
   ========================================================================== */

export function renderMinimumSizeValue(value) {
  return renderMinimumSizeSecurityReference(value);
}

/* ==========================================================================
   Minimum Size Desktop Matrix Row
   ========================================================================== */

/*
 * JSP owns:
 *
 * - all three header rows
 * - all heading relationships
 * - all localization
 *
 * JS owns tbody only.
 *
 * The first body position remains intentionally empty because the first visual
 * matrix position belongs to the JSP's row-axis/header structure.
 */

export function renderMinimumSizeDesktopRow(row) {
  return `
    <tr
      class="trading-minimum-size-row"
    >
      <td
        class="trading-minimum-size-row__label"
        aria-hidden="true"
      ></td>

      <td>
        ${renderMinimumSizeValue(row?.col1)}
      </td>

      <td>
        ${renderMinimumSizeValue(row?.col2)}
      </td>

      <td>
        ${renderMinimumSizeValue(row?.col3)}
      </td>

      <td>
        ${renderMinimumSizeValue(row?.col4)}
      </td>
    </tr>
  `.trim();
}

/* ==========================================================================
   Minimum Size Mobile Matrix Item
   ========================================================================== */

/*
 * Each item carries the complete vertical heading path for one backend value.
 *
 * Example:
 *
 * Level 1
 * Level 2
 * Level 3
 *
 * VALUE
 */

function renderMinimumSizeMobileItem({ value, levels = [], index }) {
  if (!hasValue(getMinimumSizeDisplayValue(value))) {
    return "";
  }

  const headingId = `minimum-size-card-item-${index}`;

  const hierarchy = levels
    .filter(hasValue)
    .map((label, levelIndex) =>
      `
          <span
            class="
              trading-minimum-size-card__level
              trading-minimum-size-card__level--${levelIndex + 1}
            "
          >
            ${escapeHtml(label)}
          </span>
        `.trim(),
    )
    .join("");

  return `
    <section
      class="trading-minimum-size-card__item"
      aria-labelledby="${escapeHtml(headingId)}"
    >
      <h4
        class="trading-minimum-size-card__heading"
        id="${escapeHtml(headingId)}"
      >
        ${hierarchy}
      </h4>

      <div
        class="trading-minimum-size-card__value"
      >
        ${renderMinimumSizeValue(value)}
      </div>
    </section>
  `.trim();
}

/* ==========================================================================
   Minimum Size Mobile Card
   ========================================================================== */

/*
 * One API row becomes one semantic matrix card.
 *
 * Important:
 *
 * We deliberately do NOT render:
 *
 * <label>col1</label>
 * <value>...</value>
 *
 * because col1-col4 are transport properties, not user-facing business
 * labels.
 *
 * Instead every value receives its actual localized matrix hierarchy.
 */

export function renderMinimumSizeMobileCard(row, context = {}, config = {}) {
  const columns = getMinimumSizeColumns(config);

  const items = columns
    .map((column, columnIndex) =>
      renderMinimumSizeMobileItem({
        value: row?.[column.key],

        levels: column.levels,

        index: `${context.index ?? 0}-${columnIndex}`,
      }),
    )
    .filter(Boolean)
    .join("");

  /*
   * Do not create an empty visual card when the row contains no useful
   * Minimum Size values.
   */

  if (!items) {
    return "";
  }

  return `
    <article
      class="
        data-card
        trading-minimum-size-card
      "
      data-trading-minimum-size-card
      data-row-index="${escapeHtml(context.index ?? "")}"
    >
      <div
        class="trading-minimum-size-card__grid"
      >
        ${items}
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Minimum Size Mobile Collection
   ========================================================================== */

export function renderMinimumSizeMobileCards(rows = [], config = {}) {
  if (!Array.isArray(rows) || !rows.length) {
    return "";
  }

  return rows
    .map((row, index) =>
      renderMinimumSizeMobileCard(
        row,
        {
          index,
        },
        config,
      ),
    )
    .filter(Boolean)
    .join("");
}

/* ==========================================================================
   Minimum Size Filtering
   ========================================================================== */

export function filterMinimumSizeRows(rows = [], search = "") {
  if (!Array.isArray(rows)) {
    return [];
  }

  const query = String(search || "")
    .trim()
    .toLowerCase();

  if (!query) {
    return [...rows];
  }

  return rows.filter((row) => getMinimumSizeSearchText(row).includes(query));
}

/* ==========================================================================
   Card Container
   ========================================================================== */

/*
 * Trading view modules can apply this class to a cards container.
 *
 * The class itself is intentionally only a presentation hook.
 */

export function getTradingCardContainerClass() {
  return "trading-data-card-list";
}
