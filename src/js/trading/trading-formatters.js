/* ==========================================================================
   Trading Formatters
   ========================================================================== */

/*
 * Trading presentation and business-value formatters.
 *
 * Responsibilities:
 *
 * - safe HTML escaping
 * - safe URL rendering
 * - quantity / money formatting
 * - native/request/display date conversion
 * - stable Symbol + status rendering
 * - stable Company identity rendering
 * - price-change rendering
 * - reason/news links
 * - security references
 * - table-cell rendering
 * - Negotiated total values
 * - Trading mobile identity
 * - dedicated Minimum Size matrix/mobile rendering
 *
 * This module intentionally has no:
 *
 * - AJAX
 * - DataTables lifecycle
 * - filter state
 * - tab switching
 * - event listeners
 */

/* ==========================================================================
   Generic Values
   ========================================================================== */

export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function getDisplayValue(value, fallback = "-") {
  return hasValue(value) ? String(value).trim() : fallback;
}

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
   Safe IDs
   ========================================================================== */

export function createSafeId(value, fallback = "item") {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

/* ==========================================================================
   URLs
   ========================================================================== */

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
   Generic Link
   ========================================================================== */

export function renderLink(label, url, options = {}) {
  const text = getDisplayValue(label, "");

  if (!text) {
    return "";
  }

  const href = safeUrl(url);

  if (!href) {
    return escapeHtml(text);
  }

  const className = options.className
    ? ` class="${escapeHtml(options.className)}"`
    : "";

  return `
    <a${className}
      href="${escapeHtml(href)}"
    >
      ${escapeHtml(text)}
    </a>
  `.trim();
}

/* ==========================================================================
   Numeric Parsing
   ========================================================================== */

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

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
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

export function formatQuantity(value, config = {}) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const number = toNumber(value);

  if (number === null) {
    return String(value);
  }

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

export function formatMoney(value, config = {}) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const number = toNumber(value);

  /*
   * Preserve the existing Trading display convention.
   */
  if (number === 0) {
    return "-";
  }

  if (number === -1) {
    return "";
  }

  if (number === null) {
    return String(value);
  }

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
   Date Helpers
   ========================================================================== */

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

/* ==========================================================================
   Native Input Date
   ========================================================================== */

export function toNativeDateValue(value) {
  if (!hasValue(value)) {
    return "";
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!match) {
    return "";
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

/* ==========================================================================
   Backend Request Date
   ========================================================================== */

export function toRequestDate(value) {
  if (!hasValue(value)) {
    return "";
  }

  const text = String(value).trim();

  const nativeMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (nativeMatch) {
    return `${nativeMatch[3]}-${nativeMatch[2]}-${nativeMatch[1]}`;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    return text;
  }

  return text;
}

/* ==========================================================================
   Display Date
   ========================================================================== */

export function formatTradingDate(value) {
  if (!hasValue(value)) {
    return "-";
  }

  const text = String(value).trim();

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    return text;
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return text;
}

/* ==========================================================================
   Date Sorting
   ========================================================================== */

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
   Default Trading Date Range
   ========================================================================== */

export function getDefaultTradingDateRange() {
  const today = new Date();

  const from = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    today.getDate(),
  );

  function formatNative(date) {
    return [
      date.getFullYear(),

      padDatePart(date.getMonth() + 1),

      padDatePart(date.getDate()),
    ].join("-");
  }

  return {
    fromDate: formatNative(from),

    toDate: formatNative(today),
  };
}

/* ==========================================================================
   Company Status
   ========================================================================== */

/*
 * Legacy Trading status contract:
 *
 * 1 = yellow
 * 2 = orange
 * 3 = red
 */

export function getStatusClass(status) {
  switch (String(status ?? "")) {
    case "1":
      return "ylwSymbol";

    case "2":
      return "orgSymbol";

    case "3":
      return "redSymbol";

    default:
      return "";
  }
}

export function renderStatusMarker(status) {
  const className = getStatusClass(status);

  if (!className) {
    return "";
  }

  return `
    <span
      class="${escapeHtml(className)}"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Symbol + Status
   ========================================================================== */

/*
 * Standard identity contract for status-bearing Trading views:
 *
 * SYMBOL ●
 *
 * The status marker belongs to the Symbol, not the Company cell.
 */

export function renderSymbolWithStatus(symbol, status) {
  return `
    <span class="trading-security-status">

      <span
        class="trading-security-status__symbol"
      >
        ${escapeHtml(getDisplayValue(symbol, ""))}
      </span>

      ${renderStatusMarker(status)}

    </span>
  `.trim();
}

/* ==========================================================================
   Company Link
   ========================================================================== */

export function renderCompanyLink(label, url) {
  return renderLink(label, url, {
    className: "table-market__security-link",
  });
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

export function renderCompanyIdentity(name, url) {
  return `
    <span
      class="table-identity"
    >
      <span
        class="table-identity-content"
      >
        <span
          class="table-identity-name"
        >
          ${renderCompanyLink(name, url)}
        </span>
      </span>
    </span>
  `.trim();
}

/* ==========================================================================
   Negotiated Company Identity
   ========================================================================== */

/*
 * Negotiated uses a combined desktop identity:
 *
 * Company Name
 * Symbol
 */

export function renderNegotiatedCompany(row) {
  const name = getDisplayValue(row?.company, "");

  const symbol = getDisplayValue(row?.symbol, "");

  const url = safeUrl(row?.companyURL);

  const content = `
    <span
      class="table-identity"
    >
      <span
        class="table-identity-content"
      >

        <span
          class="table-identity-name"
        >
          ${escapeHtml(name)}
        </span>

        ${
          symbol
            ? `
              <span
                class="table-identity-meta"
              >
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

export function getPriceChangeState(numericValue) {
  const value = toNumber(numericValue);

  if (value !== null && value > 0) {
    return {
      className: "priceUp",

      direction: "up",
    };
  }

  if (value !== null && value < 0) {
    return {
      className: "priceDown",

      direction: "down",
    };
  }

  return {
    className: "priceEqual",

    direction: "equal",
  };
}

export function renderPriceChange(valueText, numericValue) {
  const state = getPriceChangeState(numericValue);

  return `
    <div
      class="priceTdBox"
    >
      <div
        class="${escapeHtml(state.className)}"
      >
        ${escapeHtml(getDisplayValue(valueText, "-"))}

        <i
          aria-hidden="true"
        ></i>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Generic News Link
   ========================================================================== */

export function renderNewsLink(url, label = "View") {
  const href = safeUrl(url);

  if (!href) {
    return "-";
  }

  return `
    <a
      href="${escapeHtml(href)}"
    >
      ${escapeHtml(label)}
    </a>
  `.trim();
}

/* ==========================================================================
   Suspended Reason
   ========================================================================== */

export function renderSuspendedNewsLink(row, config = {}) {
  const url = getFirstValue(row, ["annUrl", "newsUrl"], "");

  return renderNewsLink(url, config.labels?.suspendedLink || "View");
}

/* ==========================================================================
   Delisted Reason
   ========================================================================== */

export function renderDelistedNewsLink(row, config = {}) {
  return renderNewsLink(row?.newsUrl, config.labels?.delistedLink || "View");
}

/* ==========================================================================
   Security Reference
   ========================================================================== */

export function renderSecurityReference(value) {
  if (!value) {
    return "-";
  }

  /*
   * Some Minimum Size responses may return an object:
   *
   * {
   *   symbol,
   *   companyURL
   * }
   */

  if (typeof value === "object") {
    return renderLink(
      value.symbol ?? value.name ?? value.label ?? "",
      value.companyURL ?? value.url ?? "",
      {
        className: "table-market__security-link",
      },
    );
  }

  /*
   * Some endpoints may return a plain string.
   */
  return escapeHtml(getDisplayValue(value, "-"));
}

/* ==========================================================================
   Column Value
   ========================================================================== */

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
   Total Rows
   ========================================================================== */

export function isTotalRow(row) {
  return row?.rowType === "total" || row?.isTotal === true;
}

export function getNegotiatedTotalVolume(row) {
  return getFirstValue(row, ["tradeVolume", "totalVolume", "volume"], "");
}

export function getNegotiatedTotalValue(row) {
  return getFirstValue(row, ["turnOver", "totalValue", "value"], "");
}

/* ==========================================================================
   Table Cell Renderer
   ========================================================================== */

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

  /* ========================================================================
     Non-display Values
     ======================================================================== */

  if (type === "sort" || type === "type" || type === "filter") {
    switch (column.type) {
      case "negotiated-date":
      case "date":
        return getTradingDateSortValue(value);

      case "negotiated-company":
        return [row?.company, row?.symbol].filter(Boolean).join(" ");

      case "price-change":
        return row?.[column.numericData] ?? value;

      case "symbol-status":
        return value;

      default:
        return value;
    }
  }

  /* ========================================================================
     Negotiated Total
     ======================================================================== */

  if (isTotalRow(row)) {
    switch (column.key) {
      case "date":
        return "";

      case "company":
        return `
          <strong
            class="table-market__summary-label"
          >
            ${escapeHtml(config.labels?.total || "Total")}
          </strong>
        `.trim();

      case "trade-price":
        return "";

      case "trade-volume":
        return escapeHtml(
          formatQuantity(getNegotiatedTotalVolume(row), config),
        );

      case "turnover":
        return escapeHtml(formatMoney(getNegotiatedTotalValue(row), config));

      case "time":
        return "";

      default:
        return "";
    }
  }

  /* ========================================================================
     Normal Display
     ======================================================================== */

  switch (column.type) {
    case "text":
      return escapeHtml(getDisplayValue(value, "-"));

    case "display-value":
      return escapeHtml(getDisplayValue(value, "-"));

    case "time":
      return escapeHtml(getDisplayValue(value, "-"));

    case "negotiated-date":
      return escapeHtml(formatTradingDate(value));

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
   Trading Identity
   ========================================================================== */

export function getTradingIdentity(row = {}, view = "") {
  switch (view) {
    case "negotiatedDeals":
      return {
        code: getDisplayValue(row.symbol, ""),

        name: getDisplayValue(row.company, ""),

        url: safeUrl(row.companyURL),

        status: null,
      };

    case "accumulatedLosses":
      return {
        code: getDisplayValue(row.symbol, ""),

        name: getDisplayValue(row.company, ""),

        url: safeUrl(row.companyURL),

        status: row.companyStatus,
      };

    case "listedTradableRights":
      return {
        code: "",

        name: getDisplayValue(row.acrynomName, ""),

        url: safeUrl(row.pageUrl),

        status: null,
      };

    case "suspendedCompanies":
    case "delistedCompanies":
      return {
        code: getDisplayValue(row.symbol, ""),

        name: getDisplayValue(row.name, ""),

        url: safeUrl(row.companyURL),

        status: row.companyStatus,
      };

    case "otcTrading":
      return {
        code: getDisplayValue(row.symbol, ""),

        name: getDisplayValue(row.companyName, ""),

        url: safeUrl(row.companyURL),

        status: row.companyStatus,
      };

    default:
      return {
        code: "",

        name: "",

        url: "",

        status: null,
      };
  }
}

/* ==========================================================================
   Mobile Identity
   ========================================================================== */

/*
 * Standard Trading mobile identity:
 *
 * SYMBOL ●
 * Company / Security Name
 *
 * Status is always attached to Symbol when available.
 */

export function renderMobileIdentity(row, view) {
  const identity = getTradingIdentity(row, view);

  const codeMarkup = identity.code
    ? `
        <div
          class="data-card__identity-code"
        >
          <span
            class="data-card__symbol"
          >
            ${escapeHtml(identity.code)}
          </span>

          ${renderStatusMarker(identity.status)}
        </div>
      `.trim()
    : "";

  const nameMarkup = `
    <h4
      class="data-card__title"
    >
      ${escapeHtml(identity.name)}
    </h4>
  `.trim();

  const content = `
    <div
      class="data-card__identity-content"
    >
      ${codeMarkup}

      ${nameMarkup}
    </div>
  `.trim();

  if (!identity.url) {
    return `
      <div
        class="data-card__identity"
      >
        ${content}
      </div>
    `.trim();
  }

  return `
    <div
      class="data-card__identity"
    >
      <a
        class="data-card__security-link"
        href="${escapeHtml(identity.url)}"
      >
        ${content}
      </a>
    </div>
  `.trim();
}

/* ==========================================================================
   Negotiated Mobile Summary
   ========================================================================== */

export function renderNegotiatedMobileSummary(row, config = {}) {
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
          ${escapeHtml(config.labels?.negotiatedDeals?.price || "Price")}
        </span>

        <span
          class="data-card__price"
        >
          ${escapeHtml(formatMoney(row?.tradePrice, config))}
        </span>
      </div>

      <div
        class="data-card__quote-item"
      >
        <span
          class="data-card__quote-label"
        >
          ${escapeHtml(config.labels?.negotiatedDeals?.value || "Value")}
        </span>

        <span
          class="data-card__change"
        >
          ${escapeHtml(formatMoney(row?.turnOver, config))}
        </span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Listed Tradable Mobile Summary
   ========================================================================== */

export function renderListedTradableMobileSummary(row, config = {}) {
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
          ${escapeHtml(
            config.labels?.listedTradable?.lastTradePrice || "Price",
          )}
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
          ${escapeHtml(
            config.labels?.listedTradable?.changePercent || "Change %",
          )}
        </span>

        ${renderPriceChange(
          row?.percentChangeModified,
          row?.percentChangeDoubleModified,
        )}
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   OTC Mobile Summary
   ========================================================================== */

export function renderOtcMobileSummary(row, config = {}) {
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
          ${escapeHtml(config.labels?.otc?.tradedVolume || "Traded Volume")}
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
   Mobile Detail Fields
   ========================================================================== */

export function createMobileField(row, column, config = {}) {
  return {
    key: column.key,

    label: column.label || column.key,

    value: renderTradingCell({
      row,
      column,
      type: "display",
      config,
    }),

    numeric: Boolean(column.numeric),
  };
}

/* ==========================================================================
   Negotiated Date Group
   ========================================================================== */

export function getNegotiatedDateGroup(row) {
  return formatTradingDate(row?.strDate);
}

/* ==========================================================================
   Negotiated Daily Total Card
   ========================================================================== */

export function renderNegotiatedDailyTotalCard(row, config = {}) {
  const dailyLabel = config.labels?.mobile?.daily || "Daily";

  const totalLabel =
    config.labels?.mobile?.total || config.labels?.total || "Total";

  const volumeLabel = config.labels?.negotiatedDeals?.volume || "Volume";

  const valueLabel = config.labels?.negotiatedDeals?.value || "Value";

  return `
    <article
      class="data-card data-card--compact trading-daily-total-card"
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
              ${escapeHtml(dailyLabel)}
            </span>

            <h4
              class="data-card__title"
            >
              ${escapeHtml(totalLabel)}
            </h4>
          </div>
        </div>

        <div
          class="data-card__quote"
        >
          <div
            class="data-card__quote-item"
          >
            <span
              class="data-card__quote-label"
            >
              ${escapeHtml(volumeLabel)}
            </span>

            <span
              class="data-card__price"
            >
              ${escapeHtml(
                formatQuantity(getNegotiatedTotalVolume(row), config),
              )}
            </span>
          </div>

          <div
            class="data-card__quote-item"
          >
            <span
              class="data-card__quote-label"
            >
              ${escapeHtml(valueLabel)}
            </span>

            <span
              class="data-card__change"
            >
              ${escapeHtml(formatMoney(getNegotiatedTotalValue(row), config))}
            </span>
          </div>
        </div>
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Minimum Size Matrix Helpers
   ========================================================================== */

/*
 * Minimum Size is a matrix, not a normal five-column business table.
 *
 * Actual backend values:
 *
 * col1
 * col2
 * col3
 * col4
 */

export function getMinimumSizeValues(row = {}) {
  return [row.col1, row.col2, row.col3, row.col4];
}

export function getMinimumSizeSearchText(row = {}) {
  return getMinimumSizeValues(row)
    .map((value) => {
      if (value && typeof value === "object") {
        return [value.symbol, value.name, value.label]
          .filter(Boolean)
          .join(" ");
      }

      return getDisplayValue(value, "");
    })
    .join(" ")
    .toLowerCase();
}

/* ==========================================================================
   Minimum Size Matrix Cell
   ========================================================================== */

export function renderMinimumSizeValue(value) {
  return renderSecurityReference(value);
}

/* ==========================================================================
   Minimum Size Desktop Matrix Row
   ========================================================================== */

/*
 * This renderer intentionally returns body cells only.
 *
 * The JSP owns the complete three-row matrix header.
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
   Minimum Size Mobile Card
   ========================================================================== */

export function renderMinimumSizeMobileCard(row, context = {}, config = {}) {
  const labels = config.labels?.minimumSize || {};

  const fields = [
    {
      label: labels.col1 || "",

      value: renderMinimumSizeValue(row?.col1),
    },

    {
      label: labels.col2 || "",

      value: renderMinimumSizeValue(row?.col2),
    },

    {
      label: labels.col3 || "",

      value: renderMinimumSizeValue(row?.col3),
    },

    {
      label: labels.col4 || "",

      value: renderMinimumSizeValue(row?.col4),
    },
  ];

  return `
    <article
      class="data-card trading-minimum-size-card"
      data-trading-minimum-size-card
      data-row-index="${escapeHtml(context.index ?? "")}"
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
            <h4
              class="data-card__title"
            >
              ${escapeHtml(
                config.labels?.tabs?.negotiatedDeals || "Minimum Size",
              )}
            </h4>
          </div>
        </div>
      </div>

      <div
        class="data-card__details"
      >
        <dl
          class="data-card__fields"
        >
          ${fields
            .map((field) =>
              `
                <div
                  class="data-card__field"
                >
                  <dt
                    class="data-card__label"
                  >
                    ${escapeHtml(field.label)}
                  </dt>

                  <dd
                    class="data-card__value"
                  >
                    ${field.value}
                  </dd>
                </div>
              `.trim(),
            )
            .join("")}
        </dl>
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Minimum Size Collection
   ========================================================================== */

export function renderMinimumSizeMobileCards(rows = [], config = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
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
    .join("");
}

/* ==========================================================================
   Minimum Size Search Filter
   ========================================================================== */

export function filterMinimumSizeRows(rows = [], query = "") {
  if (!Array.isArray(rows)) {
    return [];
  }

  const normalized = String(query || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return [...rows];
  }

  return rows.filter((row) =>
    getMinimumSizeSearchText(row).includes(normalized),
  );
}

/* ==========================================================================
   Card Spacing Helper Class
   ========================================================================== */

/*
 * Trading JS can add this class to card containers:
 *
 * trading-card-list
 *
 * The actual spacing belongs in Trading-specific CSS rather than inline
 * styles or common Data Card CSS.
 */

export function getTradingCardContainerClass() {
  return "trading-card-list";
}
