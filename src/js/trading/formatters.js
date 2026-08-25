/* ==========================================================================
   Trading Formatters
   ========================================================================== */

/*
 * Shared Trading presentation formatters.
 *
 * Responsibilities:
 *
 * - safe display values
 * - HTML escaping
 * - safe URLs / links
 * - quantity / money formatting
 * - display-date formatting
 * - Symbol + accumulated-loss status
 * - Company / security identity
 * - positive / negative price movement
 * - announcement / news links
 * - standard Trading table-cell rendering
 * - Negotiated total-row values
 *
 * This file intentionally has no:
 *
 * - AJAX
 * - DataTables lifecycle
 * - cards / card composition
 * - Minimum Size matrix rendering
 * - tabs
 * - filters
 * - event listeners
 * - DOM queries
 */

/* ==========================================================================
   Values
   ========================================================================== */

/**
 * Determine whether a value contains meaningful display content.
 *
 * Numeric zero is intentionally considered a valid value.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/**
 * Return a normalized display string.
 *
 * @param {*} value
 * @param {string} fallback
 * @returns {string}
 */
export function getDisplayValue(value, fallback = "-") {
  return hasValue(value) ? String(value).trim() : fallback;
}

/**
 * Return the first available value from a row.
 *
 * Useful where legacy/backend payloads expose the same business value under
 * more than one property name.
 *
 * @param {object} row
 * @param {string[]} keys
 * @param {*} fallback
 * @returns {*}
 */
export function getFirstValue(row, keys = [], fallback = "") {
  const source = row && typeof row === "object" ? row : {};

  for (const key of keys) {
    if (key && hasValue(source[key])) {
      return source[key];
    }
  }

  return fallback;
}

/* ==========================================================================
   HTML
   ========================================================================== */

/**
 * Escape untrusted text before inserting it into rendered HTML.
 *
 * @param {*} value
 * @returns {string}
 */
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
   URLs
   ========================================================================== */

/**
 * Normalize a URL used by Trading renderers.
 *
 * Relative URLs are intentionally allowed because portal/company links may
 * be application-relative.
 *
 * Dangerous executable protocols are rejected.
 *
 * @param {*} value
 * @returns {string}
 */
export function safeUrl(value) {
  if (!hasValue(value)) {
    return "";
  }

  const url = String(value).trim();

  if (!url || url === "#" || url === "0") {
    return "";
  }

  if (/^(?:javascript|data|vbscript):/i.test(url)) {
    return "";
  }

  return url;
}

/* ==========================================================================
   Links
   ========================================================================== */

/**
 * Render a safe text link.
 *
 * If no valid URL exists, the label remains visible as plain text.
 *
 * @param {*} label
 * @param {*} url
 * @param {object} options
 * @returns {string}
 */
export function renderLink(label, url, options = {}) {
  const text = getDisplayValue(label, "");

  if (!text) {
    return "";
  }

  const href = safeUrl(url);

  if (!href) {
    return escapeHtml(text);
  }

  const className = hasValue(options.className)
    ? ` class="${escapeHtml(options.className)}"`
    : "";

  return `
    <a${className} href="${escapeHtml(href)}">
      ${escapeHtml(text)}
    </a>
  `.trim();
}

/* ==========================================================================
   Numeric Parsing
   ========================================================================== */

/**
 * Convert a display/backend numeric value to a finite number.
 *
 * @param {*} value
 * @returns {number|null}
 */
export function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).trim().replaceAll(",", "");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

/* ==========================================================================
   Locale
   ========================================================================== */

function getLocale(config = {}) {
  return config.locale || document.documentElement.lang || "en";
}

/* ==========================================================================
   Quantity
   ========================================================================== */

/**
 * Format a quantity while preserving the existing application extension
 * when Number.prototype.formatQuantity is available.
 *
 * @param {*} value
 * @param {object} config
 * @returns {string}
 */
export function formatQuantity(value, config = {}) {
  if (!hasValue(value)) {
    return "-";
  }

  const number = toNumber(value);

  if (number === null) {
    return String(value);
  }

  /*
   * Preserve the application's existing number extension where available.
   */
  if (typeof number.formatQuantity === "function") {
    return number.formatQuantity();
  }

  try {
    return new Intl.NumberFormat(getLocale(config), {
      maximumFractionDigits: 20,
    }).format(number);
  } catch {
    return String(value);
  }
}

/* ==========================================================================
   Money
   ========================================================================== */

/**
 * Format Trading money/price values.
 *
 * Existing backend conventions are preserved:
 *
 *   0  -> "-"
 *  -1  -> ""
 *
 * @param {*} value
 * @param {object} config
 * @returns {string}
 */
export function formatMoney(value, config = {}) {
  if (!hasValue(value)) {
    return "-";
  }

  const number = toNumber(value);

  if (number === null) {
    return String(value);
  }

  if (number === 0) {
    return "-";
  }

  if (number === -1) {
    return "";
  }

  /*
   * Preserve the application's existing formatter where available.
   */
  if (typeof number.formatMoney === "function") {
    return number.formatMoney();
  }

  try {
    return new Intl.NumberFormat(getLocale(config), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return number.toFixed(2);
  }
}

/* ==========================================================================
   Display Dates
   ========================================================================== */

/**
 * Convert known Trading date formats to DD-MM-YYYY for display.
 *
 * Accepted:
 *
 * - YYYY-MM-DD
 * - YYYY-MM-DD...
 * - DD-MM-YYYY
 *
 * Unknown formats are preserved rather than guessed.
 *
 * @param {*} value
 * @returns {string}
 */
export function formatTradingDate(value) {
  if (!hasValue(value)) {
    return "-";
  }

  const text = String(value).trim();

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    return text;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return [isoMatch[3], isoMatch[2], isoMatch[1]].join("-");
  }

  return text;
}

/**
 * Normalize known Trading dates to a sortable YYYYMMDD value.
 *
 * @param {*} value
 * @returns {string}
 */
export function getTradingDateSortValue(value) {
  if (!hasValue(value)) {
    return "";
  }

  const text = String(value).trim();

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[1]}${isoMatch[2]}${isoMatch[3]}`;
  }

  const displayMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (displayMatch) {
    return `${displayMatch[3]}${displayMatch[2]}${displayMatch[1]}`;
  }

  return text;
}

/* ==========================================================================
   Company Status
   ========================================================================== */

/*
 * Existing backend contract:
 *
 * 1 = 20%–35%
 * 2 = 35%–50%
 * 3 = 50%+
 *
 * Semantic classes are the new page contract.
 *
 * Legacy classes remain temporarily for compatibility with existing Trading
 * styles while the SCSS is migrated.
 */

const STATUS_MAP = Object.freeze({
  1: {
    modifier: "primary",
    legacyClass: "ylwSymbol",
  },

  2: {
    modifier: "warning",
    legacyClass: "orgSymbol",
  },

  3: {
    modifier: "danger",
    legacyClass: "redSymbol",
  },
});

/**
 * Return normalized status presentation metadata.
 *
 * @param {*} status
 * @returns {{modifier:string, legacyClass:string}|null}
 */
export function getStatusPresentation(status) {
  return STATUS_MAP[String(status ?? "")] || null;
}

/**
 * Render the accumulated-loss/status marker.
 *
 * @param {*} status
 * @returns {string}
 */
export function renderStatusMarker(status) {
  const presentation = getStatusPresentation(status);

  if (!presentation) {
    return "";
  }

  return `
    <span
      class="
        trading-status-indicator
        trading-status-indicator--${escapeHtml(presentation.modifier)}
        ${escapeHtml(presentation.legacyClass)}
      "
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Symbol + Status
   ========================================================================== */

/**
 * Render a security symbol with its status indicator.
 *
 * Status belongs beside Symbol consistently across Trading views.
 *
 * @param {*} symbol
 * @param {*} status
 * @returns {string}
 */
export function renderSymbolWithStatus(symbol, status) {
  return `
    <span class="trading-security-status">
      <span class="trading-security-status__symbol">
        ${escapeHtml(getDisplayValue(symbol, ""))}
      </span>

      ${renderStatusMarker(status)}
    </span>
  `.trim();
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

/**
 * Render a standard linked Company value.
 *
 * @param {*} label
 * @param {*} url
 * @returns {string}
 */
export function renderCompanyLink(label, url) {
  return renderLink(label, url, {
    className: "table-market__security-link",
  });
}

/**
 * Render a standard table identity composition.
 *
 * @param {*} name
 * @param {*} url
 * @returns {string}
 */
export function renderCompanyIdentity(name, url) {
  return `
    <span class="table-identity">
      <span class="table-identity-content">
        <span class="table-identity-name">
          ${renderCompanyLink(name, url)}
        </span>
      </span>
    </span>
  `.trim();
}

/* ==========================================================================
   Negotiated Company Identity
   ========================================================================== */

/**
 * Negotiated desktop identity:
 *
 * Company Name
 * Symbol
 *
 * @param {object} row
 * @returns {string}
 */
export function renderNegotiatedCompany(row = {}) {
  const name = getDisplayValue(row.company, "");

  const symbol = getDisplayValue(row.symbol, "");

  const url = safeUrl(row.companyURL);

  const content = `
    <span class="table-identity">
      <span class="table-identity-content">

        <span class="table-identity-name">
          ${escapeHtml(name)}
        </span>

        ${
          symbol
            ? `
              <span class="table-identity-meta">
                ${escapeHtml(symbol)}
              </span>
            `
            : ""
        }

      </span>
    </span>
  `.trim();

  if (!url) {
    return content;
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

/* ==========================================================================
   Price Change
   ========================================================================== */

/**
 * Determine semantic and compatibility styling for a price movement.
 *
 * @param {*} numericValue
 * @returns {{modifier:string, legacyClass:string}}
 */
export function getPriceChangePresentation(numericValue) {
  const value = toNumber(numericValue);

  if (value !== null && value > 0) {
    return {
      modifier: "positive",
      legacyClass: "priceUp",
    };
  }

  if (value !== null && value < 0) {
    return {
      modifier: "negative",
      legacyClass: "priceDown",
    };
  }

  return {
    modifier: "neutral",
    legacyClass: "priceEqual",
  };
}

/**
 * Render positive, negative, or neutral price movement.
 *
 * @param {*} displayValue
 * @param {*} numericValue
 * @returns {string}
 */
export function renderPriceChange(displayValue, numericValue) {
  const presentation = getPriceChangePresentation(numericValue);

  return `
    <span
      class="
        trading-price-change
        trading-price-change--${escapeHtml(presentation.modifier)}
        ${escapeHtml(presentation.legacyClass)}
      "
    >
      <span class="trading-price-change__value">
        ${escapeHtml(getDisplayValue(displayValue, "-"))}
      </span>

      <span
        class="trading-price-change__indicator"
        aria-hidden="true"
      ></span>
    </span>
  `.trim();
}

/* ==========================================================================
   News / Announcement Links
   ========================================================================== */

/**
 * Render a generic Trading announcement/news link.
 *
 * @param {*} url
 * @param {*} label
 * @returns {string}
 */
export function renderNewsLink(url, label = "View") {
  const href = safeUrl(url);

  if (!href) {
    return "-";
  }

  return renderLink(label, href, {
    className: "table-market__action-link",
  });
}

/**
 * Suspended rows prefer announcement URL and fall back to news URL.
 *
 * @param {object} row
 * @param {object} config
 * @returns {string}
 */
export function renderSuspendedNewsLink(row = {}, config = {}) {
  const url = getFirstValue(row, ["annUrl", "newsUrl"], "");

  return renderNewsLink(url, config.labels?.suspendedLink || "View");
}

/**
 * Render a Delisted news link.
 *
 * @param {object} row
 * @param {object} config
 * @returns {string}
 */
export function renderDelistedNewsLink(row = {}, config = {}) {
  return renderNewsLink(row.newsUrl, config.labels?.delistedLink || "View");
}

/* ==========================================================================
   Security Reference
   ========================================================================== */

/**
 * Render a Minimum Size security reference.
 *
 * Minimum Size may return either:
 *
 * - an object containing symbol/name + URL
 * - a primitive display value
 *
 * The actual matrix/card composition remains inside the Minimum Size view.
 *
 * @param {*} value
 * @returns {string}
 */
export function renderSecurityReference(value) {
  if (!hasValue(value)) {
    return "-";
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const label = value.symbol ?? value.name ?? value.label ?? "";

    const url = value.companyURL ?? value.pageUrl ?? value.url ?? "";

    return renderLink(label, url, {
      className: "table-market__security-link",
    });
  }

  return escapeHtml(getDisplayValue(value, "-"));
}

/* ==========================================================================
   Column Values
   ========================================================================== */

/**
 * Resolve one schema column's value from a response row.
 *
 * @param {object} row
 * @param {object} column
 * @param {*} fallback
 * @returns {*}
 */
export function getColumnValue(row, column, fallback = "") {
  if (!column || typeof column !== "object") {
    return fallback;
  }

  if (!column.data) {
    return fallback;
  }

  const keys = [column.data];

  if (Array.isArray(column.fallbackData)) {
    keys.push(...column.fallbackData);
  }

  return getFirstValue(row, keys, fallback);
}

/* ==========================================================================
   Negotiated Total Rows
   ========================================================================== */

/**
 * Detect a Negotiated total row.
 *
 * @param {object} row
 * @returns {boolean}
 */
export function isTotalRow(row) {
  return row?.rowType === "total" || row?.isTotal === true;
}

export function getNegotiatedTotalVolume(row = {}) {
  return getFirstValue(row, ["tradeVolume", "totalVolume", "volume"], "");
}

export function getNegotiatedTotalValue(row = {}) {
  return getFirstValue(row, ["turnOver", "totalValue", "value"], "");
}

/* ==========================================================================
   DataTables Orthogonal Values
   ========================================================================== */

function renderNonDisplayValue({ row, column, value }) {
  switch (column.type) {
    case "negotiated-date":
    case "date":
      return getTradingDateSortValue(value);

    case "negotiated-company":
      return [row.company, row.symbol].filter(hasValue).join(" ");

    case "price-change":
      return row?.[column.numericData] ?? value;

    case "symbol-status":
      return value;

    default:
      return value;
  }
}

/* ==========================================================================
   Negotiated Total Cell
   ========================================================================== */

function renderNegotiatedTotalCell({ row, column, config }) {
  switch (column.key) {
    case "date":
    case "trade-price":
    case "time":
      return "";

    case "company":
      return `
        <strong class="table-market__summary-label">
          ${escapeHtml(config.labels?.total || "Total")}
        </strong>
      `.trim();

    case "trade-volume":
      return escapeHtml(formatQuantity(getNegotiatedTotalVolume(row), config));

    case "turnover":
      return escapeHtml(formatMoney(getNegotiatedTotalValue(row), config));

    default:
      return "";
  }
}

/* ==========================================================================
   Standard Display Cell
   ========================================================================== */

function renderDisplayCell({ row, column, value, config }) {
  switch (column.type) {
    case "text":
    case "display-value":
    case "time":
      return escapeHtml(getDisplayValue(value, "-"));

    case "negotiated-date":
    case "date":
      return escapeHtml(formatTradingDate(value));

    case "negotiated-company":
      return renderNegotiatedCompany(row);

    case "money":
      return escapeHtml(formatMoney(value, config));

    case "quantity":
      return escapeHtml(formatQuantity(value, config));

    case "company-link":
      return renderCompanyIdentity(value, row?.[column.urlData]);

    case "security-link":
      return renderLink(value, row?.[column.urlData], {
        className: "table-market__security-link",
      });

    case "security-reference":
      return renderSecurityReference(value);

    case "symbol-status":
      return renderSymbolWithStatus(value, row?.[column.statusData]);

    case "price-change":
      return renderPriceChange(value, row?.[column.numericData]);

    case "suspended-news-link":
      return renderSuspendedNewsLink(row, config);

    case "delisted-news-link":
      return renderDelistedNewsLink(row, config);

    default:
      return escapeHtml(getDisplayValue(value, "-"));
  }
}

/* ==========================================================================
   Public Cell Renderer
   ========================================================================== */

/**
 * Shared renderer used by Trading schemas with createDataTable().
 *
 * The schema determines what a value means through `column.type`.
 * This formatter determines how that type is safely presented.
 *
 * @param {object} args
 * @param {object} args.row
 * @param {object} args.column
 * @param {string} args.type
 * @param {object} args.config
 * @returns {*}
 */
export function renderTradingCell({
  row,
  column,
  type = "display",
  config = {},
}) {
  if (!row || !column) {
    return "";
  }

  const value = getColumnValue(row, column, "");

  /*
   * DataTables requests different representations for display, searching,
   * sorting, and type detection.
   */
  if (type === "sort" || type === "type" || type === "filter") {
    return renderNonDisplayValue({
      row,
      column,
      value,
    });
  }

  /*
   * Negotiated total rows use a deliberately different visual contract.
   */
  if (isTotalRow(row)) {
    return renderNegotiatedTotalCell({
      row,
      column,
      config,
    });
  }

  return renderDisplayCell({
    row,
    column,
    value,
    config,
  });
}
