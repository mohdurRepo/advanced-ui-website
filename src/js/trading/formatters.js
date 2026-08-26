/* ==========================================================================
   Trading Formatters
   ========================================================================== */

/*
 * Shared presentation helpers for Trading views.
 *
 * Responsibilities:
 *
 * - safe display values
 * - HTML escaping
 * - URLs
 * - dates
 * - numeric values
 * - status markers
 * - Trading identities
 * - schema-driven cell rendering
 * - mobile identity / summary rendering
 * - Negotiated daily totals
 * - Minimum Size matrix rendering
 *
 * No:
 *
 * - AJAX
 * - filters
 * - DataTables lifecycle
 * - tab behavior
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
   * Backend links are normally relative application URLs.
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
   Numbers
   ========================================================================== */

function getLocale(config = {}) {
  return config.locale || document.documentElement.lang || undefined;
}

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
   * dd-MM-yyyy / dd/MM/yyyy
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

export function formatTradingDate(value) {
  if (!hasValue(value)) {
    return "";
  }

  /*
   * Preserve backend display strings.
   *
   * We only normalize ISO yyyy-MM-dd because native date values use it.
   */
  const text = String(value).trim();

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!iso) {
    return text;
  }

  return `${iso[3]}-${iso[2]}-${iso[1]}`;
}

export function toRequestDate(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    return hasValue(value) ? String(value) : "";
  }

  return [pad2(parts.day), pad2(parts.month), parts.year].join("-");
}

function toInputDate(date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-");
}

export function getDefaultTradingDateRange() {
  const to = new Date();

  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  /*
   * Business default:
   *
   * one calendar month ago -> today
   */
  from.setMonth(from.getMonth() - 1);

  return Object.freeze({
    fromDate: toInputDate(from),

    toDate: toInputDate(to),
  });
}

/* ==========================================================================
   Change
   ========================================================================== */

function getChangeClass(value) {
  const number = parseNumber(value);

  if (number === null || number === 0) {
    return "";
  }

  return number > 0 ? "is-positive" : "is-negative";
}

export function renderPriceChange(
  displayValue,
  numericValue = displayValue,
  { percent = false, config = {} } = {},
) {
  const display = percent
    ? formatPercent(displayValue, config)
    : getDisplayValue(displayValue, "-");

  const className = getChangeClass(numericValue);

  return `
    <span
      class="data-change${className ? ` ${className}` : ""}"
    >
      ${escapeHtml(display)}
    </span>
  `.trim();
}

/* ==========================================================================
   Status
   ========================================================================== */

export function renderStatusMarker(status) {
  if (!hasValue(status)) {
    return "";
  }

  const value = String(status).trim();

  return `
    <span
      class="data-card__status"
      title="${escapeHtml(value)}"
      aria-label="${escapeHtml(value)}"
    ></span>
  `.trim();
}

/* ==========================================================================
   Security Link
   ========================================================================== */

function renderSecurityLink(label, url, className = "") {
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
 * These mappings intentionally follow the real endpoint shapes from the
 * previous working Trading implementation.
 */

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
   Identity Cell
   ========================================================================== */

export function renderIdentityCell(row, view) {
  const identity = getTradingIdentity(row, view);

  const name = renderSecurityLink(
    identity.name,
    identity.url,
    "trading-security-link",
  );

  const code = identity.code
    ? `
          <span class="trading-security__symbol">
            ${escapeHtml(identity.code)}
          </span>
        `.trim()
    : "";

  return `
    <div class="trading-security">
      ${code}

      <span class="trading-security__name">
        ${name}
      </span>

      ${renderStatusMarker(identity.status)}
    </div>
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
   * DataTables sorting/filtering must receive raw data rather than HTML.
   */
  if (type !== "display") {
    return value ?? "";
  }

  switch (column.format) {
    case "identity":
      return renderIdentityCell(row, view || column.view);

    case "number":
      return escapeHtml(formatNumber(value, config));

    case "quantity":
      return escapeHtml(formatQuantity(value, config));

    case "money":
      return escapeHtml(formatMoney(value, config));

    case "percent":
      return escapeHtml(formatPercent(value, config));

    case "date":
      return escapeHtml(getDisplayValue(formatTradingDate(value), "-"));

    case "change":
      return renderPriceChange(
        value,
        column.numericData ? row?.[column.numericData] : value,
        {
          config,
        },
      );

    case "percent-change":
      return renderPriceChange(
        value,
        column.numericData ? row?.[column.numericData] : value,
        {
          percent: true,
          config,
        },
      );

    case "link":
      return renderSecurityLink(
        value,
        column.urlData ? row?.[column.urlData] : "",
      );

    case "suspended-news-link":
      return renderSecurityLink(
        config.labels?.suspendedLink || getDisplayValue(value, "-"),
        firstDefined(row.newsURL, row.newsUrl, row.url),
      );

    case "delisted-news-link":
      return renderSecurityLink(
        config.labels?.delistedLink || getDisplayValue(value, "-"),
        firstDefined(row.newsURL, row.newsUrl, row.url),
      );

    default:
      return escapeHtml(getDisplayValue(value, "-"));
  }
}

/* ==========================================================================
   Mobile Identity
   ========================================================================== */

export function renderMobileIdentity(row, view) {
  const identity = getTradingIdentity(row, view);

  const codeMarkup = identity.code
    ? `
          <div class="data-card__identity-code">
            <span class="data-card__symbol">
              ${escapeHtml(identity.code)}
            </span>

            ${renderStatusMarker(identity.status)}
          </div>
        `.trim()
    : "";

  const nameMarkup = `
    <h4 class="data-card__title">
      ${escapeHtml(identity.name)}
    </h4>
  `.trim();

  const content = `
    <div class="data-card__identity-content">
      ${codeMarkup}
      ${nameMarkup}
    </div>
  `.trim();

  if (!identity.url) {
    return `
      <div class="data-card__identity">
        ${content}
      </div>
    `.trim();
  }

  return `
    <div class="data-card__identity">
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
  const labels = config.labels?.negotiatedDeals || {};

  return `
    <div class="data-card__quote">
      <div class="data-card__quote-item">
        <span class="data-card__quote-label">
          ${escapeHtml(labels.price || "Price")}
        </span>

        <span class="data-card__price">
          ${escapeHtml(formatMoney(row?.tradePrice, config))}
        </span>
      </div>

      <div class="data-card__quote-item">
        <span class="data-card__quote-label">
          ${escapeHtml(labels.value || "Value")}
        </span>

        <span class="data-card__change">
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
  const labels = config.labels?.listedTradable || {};

  return `
    <div class="data-card__quote">
      <div class="data-card__quote-item">
        <span class="data-card__quote-label">
          ${escapeHtml(labels.lastTradePrice || "Price")}
        </span>

        <span class="data-card__price">
          ${escapeHtml(getDisplayValue(row?.lastTradePriceModified, "-"))}
        </span>
      </div>

      <div class="data-card__quote-item">
        <span class="data-card__quote-label">
          ${escapeHtml(labels.changePercent || "Change %")}
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
    <div class="data-card__quote">
      <div class="data-card__quote-item">
        <span class="data-card__quote-label">
          ${escapeHtml(config.labels?.otc?.tradedVolume || "Traded Volume")}
        </span>

        <span class="data-card__price">
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

export function isTotalRow(row = {}) {
  /*
   * Keep this tolerant because historical Negotiated responses have represented
   * total rows through more than one field/value shape.
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
   Negotiated Daily Total
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
      <div class="data-card__main">
        <div class="data-card__identity">
          <div class="data-card__identity-content">
            <span class="data-card__symbol">
              ${escapeHtml(dailyLabel)}
            </span>

            <h4 class="data-card__title">
              ${escapeHtml(totalLabel)}
            </h4>
          </div>
        </div>

        <div class="data-card__quote">
          <div class="data-card__quote-item">
            <span class="data-card__quote-label">
              ${escapeHtml(volumeLabel)}
            </span>

            <span class="data-card__price">
              ${escapeHtml(
                formatQuantity(getNegotiatedTotalVolume(row), config),
              )}
            </span>
          </div>

          <div class="data-card__quote-item">
            <span class="data-card__quote-label">
              ${escapeHtml(valueLabel)}
            </span>

            <span class="data-card__change">
              ${escapeHtml(formatMoney(getNegotiatedTotalValue(row), config))}
            </span>
          </div>
        </div>
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Minimum Size
   ========================================================================== */

export function getMinimumSizeValues(row = {}) {
  /*
   * Actual Minimum Size backend matrix.
   */
  return [row.col1, row.col2, row.col3, row.col4];
}

function getMinimumSizeDisplayValue(value) {
  if (value && typeof value === "object") {
    return firstDefined(value.symbol, value.name, value.label, value.value);
  }

  return value;
}

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

function renderSecurityReference(value) {
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

export function renderMinimumSizeValue(value) {
  return renderSecurityReference(value);
}

export function renderMinimumSizeDesktopRow(row) {
  return `
    <tr class="trading-minimum-size-row">
      <td
        class="trading-minimum-size-row__label"
        aria-hidden="true"
      ></td>

      <td>${renderMinimumSizeValue(row?.col1)}</td>
      <td>${renderMinimumSizeValue(row?.col2)}</td>
      <td>${renderMinimumSizeValue(row?.col3)}</td>
      <td>${renderMinimumSizeValue(row?.col4)}</td>
    </tr>
  `.trim();
}

export function renderMinimumSizeMobileCard(row, context = {}, config = {}) {
  const values = getMinimumSizeValues(row);

  const labels = config.labels?.minimumSize || {};

  const columnLabels = [
    labels.col1 || "",
    labels.col2 || "",
    labels.col3 || "",
    labels.col4 || "",
  ];

  const fields = values
    .map((value, index) => ({
      value,
      label: columnLabels[index],
    }))
    .filter(({ value }) => hasValue(getMinimumSizeDisplayValue(value)))
    .map(({ value, label }) =>
      `
          <div class="data-card__field">
            ${
              label
                ? `
                  <span class="data-card__field-label">
                    ${escapeHtml(label)}
                  </span>
                `.trim()
                : ""
            }

            <span class="data-card__field-value">
              ${renderMinimumSizeValue(value)}
            </span>
          </div>
        `.trim(),
    )
    .join("");

  return `
    <article
      class="data-card trading-minimum-size-card"
      data-index="${escapeHtml(context.index ?? "")}"
    >
      <div class="data-card__main">
        ${fields}
      </div>
    </article>
  `.trim();
}

export function renderMinimumSizeMobileCards(rows = [], config = {}) {
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

export function filterMinimumSizeRows(rows = [], search = "") {
  const query = String(search || "")
    .trim()
    .toLowerCase();

  if (!query) {
    return [...rows];
  }

  return rows.filter((row) => getMinimumSizeSearchText(row).includes(query));
}

/* ==========================================================================
   Cards
   ========================================================================== */

export function getTradingCardContainerClass() {
  return "trading-data-card-list";
}
