/* ==========================================================================
   Trading Formatters
   ========================================================================== */

/*
 * Trading presentation and business-value formatters.
 *
 * Responsibilities:
 *
 * - safe HTML escaping
 * - safe links
 * - quantity / money formatting
 * - date conversion
 * - negotiated-deal identity rendering
 * - company/status rendering
 * - price-change rendering
 * - reason/news links
 * - minimum-size security references
 * - mobile identity
 * - mobile summary
 * - negotiated daily-total cards
 *
 * This module intentionally has no:
 *
 * - AJAX
 * - DataTables lifecycle
 * - filter state
 * - tab switching
 * - view lifecycle
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
   Quantity
   ========================================================================== */

export function formatQuantity(value, config = {}) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const number = toNumber(value);

  if (number === null) {
    return String(value);
  }

  /*
   * Preserve an existing project formatter when available.
   */
  if (typeof number.formatQuantity === "function") {
    return number.formatQuantity();
  }

  try {
    return new Intl.NumberFormat(
      config.locale || document.documentElement.lang || "en",
      {
        maximumFractionDigits: 20,
      },
    ).format(number);
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
   * Preserve legacy Trading display rules.
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
    return new Intl.NumberFormat(
      config.locale || document.documentElement.lang || "en",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(number);
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

/*
 * Convert backend/display DD-MM-YYYY into the value required by:
 *
 * <input type="date">
 *
 * YYYY-MM-DD
 */

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

/*
 * Convert native date:
 *
 * YYYY-MM-DD
 *
 * to backend request format:
 *
 * DD-MM-YYYY
 */

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
    return "";
  }

  const text = String(value).trim();

  /*
   * Backend display value already in DD-MM-YYYY.
   */
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    return text;
  }

  /*
   * Convert ISO/native date to DD-MM-YYYY.
   */
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return text;
}

/* ==========================================================================
   Sortable Date
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
   Default Date Range
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
   Company Link
   ========================================================================== */

export function renderCompanyLink(label, url) {
  return renderLink(label, url, {
    className: "table-market__security-link",
  });
}

/* ==========================================================================
   Negotiated Company Identity
   ========================================================================== */

/*
 * Final Trading desktop presentation:
 *
 * Company Name
 * Symbol
 */

export function renderNegotiatedCompany(row) {
  const name = getDisplayValue(row?.company, "");

  const symbol = getDisplayValue(row?.symbol, "");

  const url = safeUrl(row?.companyURL);

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
   Symbol + Status
   ========================================================================== */

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
   Company + Status
   ========================================================================== */

export function renderCompanyWithStatus(label, url, status) {
  return `
    <span class="trading-security-status">

      ${renderCompanyLink(label, url)}

      ${renderStatusMarker(status)}

    </span>
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
    <div class="priceTdBox">

      <div
        class="${escapeHtml(state.className)}"
      >
        ${escapeHtml(getDisplayValue(valueText, "-"))}

        <i aria-hidden="true"></i>
      </div>

    </div>
  `.trim();
}

/* ==========================================================================
   News Links
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

export function renderSuspendedNewsLink(row, config = {}) {
  const url = getFirstValue(row, ["annUrl", "newsUrl"], "");

  return renderNewsLink(url, config.labels?.suspendedLink || "View");
}

export function renderDelistedNewsLink(row, config = {}) {
  return renderNewsLink(row?.newsUrl, config.labels?.delistedLink || "View");
}

/* ==========================================================================
   Minimum Size Security Reference
   ========================================================================== */

export function renderSecurityReference(value) {
  if (!value || typeof value !== "object") {
    return "";
  }

  return renderLink(value.symbol, value.companyURL, {
    className: "table-market__security-link",
  });
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

export function renderTotalLabel(config = {}) {
  return `
    <strong
      class="table-market__summary-label"
    >
      ${escapeHtml(config.labels?.total || "Total")}
    </strong>
  `.trim();
}

/* ==========================================================================
   Negotiated Total Values
   ========================================================================== */

export function getNegotiatedTotalVolume(row) {
  return getFirstValue(row, ["tradeVolume", "totalVolume", "volume"], "");
}

export function getNegotiatedTotalValue(row) {
  return getFirstValue(row, ["turnOver", "totalValue", "value"], "");
}

/* ==========================================================================
   Main Table Cell Renderer
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

      default:
        return value;
    }
  }

  /* ========================================================================
     Negotiated Daily Total Row
     ======================================================================== */

  if (isTotalRow(row)) {
    switch (column.key) {
      case "date":
      case "company":
      case "trade-price":
      case "time":
        return "";

      case "trade-volume":
        return escapeHtml(
          formatQuantity(getNegotiatedTotalVolume(row), config),
        );

      case "turnover":
        return escapeHtml(formatMoney(getNegotiatedTotalValue(row), config));

      default:
        return "";
    }
  }

  /* ========================================================================
     Normal Display
     ======================================================================== */

  switch (column.type) {
    case "empty":
      return "";

    case "text":
    case "display-value":
      return escapeHtml(getDisplayValue(value));

    case "time":
      return escapeHtml(getDisplayValue(value, ""));

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
      return renderCompanyLink(value, row?.[column.urlData]);

    case "security-link":
      return renderLink(value, row?.[column.urlData], {
        className: "table-market__security-link",
      });

    case "security-reference":
      return renderSecurityReference(value);

    case "symbol-status":
      return renderSymbolWithStatus(value, row?.[column.statusData]);

    case "company-status-link":
      return renderCompanyWithStatus(
        value,
        row?.[column.urlData],
        row?.[column.statusData],
      );

    case "price-change":
      return renderPriceChange(value, row?.[column.numericData]);

    case "suspended-news-link":
      return renderSuspendedNewsLink(row, config);

    case "delisted-news-link":
      return renderDelistedNewsLink(row, config);

    default:
      return escapeHtml(getDisplayValue(value));
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
 * SYMBOL
 * Company / Security Name
 */

export function renderMobileIdentity(row, view) {
  const identity = getTradingIdentity(row, view);

  const content = `
    <div
      class="data-card__identity-content"
    >

      ${
        identity.code
          ? `
            <span
              class="data-card__symbol"
            >
              ${escapeHtml(identity.code)}
            </span>
          `
          : ""
      }

      <h4
        class="data-card__title"
      >
        ${escapeHtml(identity.name)}
      </h4>

      ${renderStatusMarker(identity.status)}

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

/*
 * Static target:
 *
 * Price
 * Value
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

export function renderListedTradableMobileSummary(row) {
  return `
    <div
      class="data-card__quote"
    >

      <span
        class="data-card__price"
      >
        ${escapeHtml(getDisplayValue(row?.lastTradePriceModified))}
      </span>

      ${renderPriceChange(
        row?.percentChangeModified,
        row?.percentChangeDoubleModified,
      )}

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
      <span
        class="data-card__price"
      >
        ${escapeHtml(formatQuantity(row?.lastTradeVolume, config))}
      </span>
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
      return renderListedTradableMobileSummary(row);

    case "otcTrading":
      return renderOtcMobileSummary(row, config);

    default:
      return "";
  }
}

/* ==========================================================================
   Negotiated Group Key
   ========================================================================== */

export function getNegotiatedDateGroup(row) {
  return formatTradingDate(row?.strDate);
}

/* ==========================================================================
   Negotiated Daily Total Card
   ========================================================================== */

/*
 * This intentionally mirrors the compact static card:
 *
 * Daily
 * Total
 *
 * Total Volume
 * Total Value
 */

export function renderNegotiatedDailyTotalCard(row, config = {}) {
  const dailyLabel = config.labels?.mobile?.daily || "Daily";

  const totalLabel =
    config.labels?.mobile?.total || config.labels?.total || "Total";

  return `
    <article
      class="data-card data-card--compact"
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

          <span
            class="data-card__price"
          >
            ${escapeHtml(formatQuantity(getNegotiatedTotalVolume(row), config))}
          </span>

          <span
            class="data-card__change"
          >
            ${escapeHtml(formatMoney(getNegotiatedTotalValue(row), config))}
          </span>

        </div>

      </div>

    </article>
  `.trim();
}

/* ==========================================================================
   Negotiated Desktop Summary Row
   ========================================================================== */

/*
 * Optional helper for any custom row rendering we need in trading.js.
 *
 * Final six-column layout:
 *
 * Date | Company | Price | Volume | Value | Time
 *
 * Total visually spans the first three columns:
 *
 * Total | Volume | Value | blank
 */

export function renderNegotiatedDesktopTotalRow(row, config = {}) {
  return `
    <tr
      class="table-market__summary-row"
    >

      <th
        class="table-market__summary-label"
        colspan="3"
        scope="row"
      >
        ${escapeHtml(config.labels?.total || "Total")}
      </th>

      <td
        class="table-market__summary-value"
      >
        ${escapeHtml(formatQuantity(getNegotiatedTotalVolume(row), config))}
      </td>

      <td
        class="table-market__summary-value"
      >
        ${escapeHtml(formatMoney(getNegotiatedTotalValue(row), config))}
      </td>

      <td></td>

    </tr>
  `.trim();
}
