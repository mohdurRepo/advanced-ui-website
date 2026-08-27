/* ==========================================================================
   Trading Formatters
   ========================================================================== */

/*
 * Shared presentation helpers for the Trading page.
 *
 * Responsibilities:
 *
 * - safe HTML output
 * - primitive value normalization
 * - locale-aware number formatting
 * - date formatting
 * - money / quantity / percentage formatting
 * - company identity presentation
 * - company logo + fallback handling
 * - semantic status presentation
 * - Negotiated Deals desktop rows
 * - Negotiated Deals mobile cards
 * - Negotiated daily totals
 * - Minimum Size desktop rows
 * - Minimum Size mobile cards
 * - Accumulated Losses desktop rows
 * - Accumulated Losses mobile cards
 * - Listed Tradable Rights desktop rows
 * - Listed Tradable Rights mobile cards
 * - Suspended / Delisted desktop rows
 * - Suspended / Delisted mobile cards
 * - OTC desktop rows
 * - OTC mobile cards
 *
 * This file intentionally contains no:
 *
 * - AJAX
 * - DataTables initialization
 * - DOM querying
 * - global event handling
 * - tab orchestration
 * - filter orchestration
 * - endpoint configuration
 * - application state
 *
 * Important:
 *
 * Endpoint payloads are not perfectly uniform across Trading datasets.
 * Accessors therefore support the known legacy aliases while renderers
 * consume one normalized presentation contract.
 */

/* ==========================================================================
   Primitive Helpers
   ========================================================================== */

export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function toText(value, fallback = "") {
  if (!hasValue(value)) {
    return fallback;
  }

  return String(value);
}

export function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  const normalized = String(value).trim().replace(/,/g, "").replace(/\s+/g, "");

  if (!normalized) {
    return fallback;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : fallback;
}

function firstValue(object, keys, fallback = "") {
  if (!object || typeof object !== "object") {
    return fallback;
  }

  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(object, key) &&
      hasValue(object[key])
    ) {
      return object[key];
    }
  }

  return fallback;
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

function escapeAttribute(value) {
  return escapeHtml(value);
}

/* ==========================================================================
   URL Safety
   ========================================================================== */

function isSafeImageUrl(value) {
  if (!hasValue(value)) {
    return false;
  }

  const url = String(value).trim();

  /*
   * Trading logos normally arrive as:
   *
   * - application-relative paths
   * - absolute HTTPS URLs
   * - protocol-relative URLs
   * - data:image values in limited legacy cases
   *
   * Explicitly reject executable schemes.
   */

  if (/^javascript:/i.test(url) || /^vbscript:/i.test(url)) {
    return false;
  }

  if (/^data:/i.test(url) && !/^data:image\//i.test(url)) {
    return false;
  }

  return true;
}

function normalizeImageUrl(value, fallback = "") {
  if (!isSafeImageUrl(value)) {
    return fallback;
  }

  return String(value).trim();
}

/* ==========================================================================
   Locale
   ========================================================================== */

function getLocale(config = {}) {
  return config.locale || document?.documentElement?.lang || "en";
}

function isArabicLocale(config = {}) {
  return /^ar(?:-|$)/i.test(getLocale(config));
}

/* ==========================================================================
   Number Formatter Cache
   ========================================================================== */

const numberFormatters = new Map();

function getNumberFormatter(locale, options) {
  const key = `${locale}:${JSON.stringify(options)}`;

  if (numberFormatters.has(key)) {
    return numberFormatters.get(key);
  }

  const formatter = new Intl.NumberFormat(locale, options);

  numberFormatters.set(key, formatter);

  return formatter;
}

/* ==========================================================================
   Generic Number Formatting
   ========================================================================== */

export function formatNumber(value, config = {}, options = {}) {
  const number = toNumber(value);

  if (number === null) {
    return config.labels?.notAvailable || "-";
  }

  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    useGrouping = true,
  } = options;

  try {
    return getNumberFormatter(getLocale(config), {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
    }).format(number);
  } catch {
    return String(number);
  }
}

/* ==========================================================================
   Quantity
   ========================================================================== */

export function formatQuantity(value, config = {}) {
  return formatNumber(value, config, {
    minimumFractionDigits: 0,

    maximumFractionDigits: 0,
  });
}

/* ==========================================================================
   Decimal
   ========================================================================== */

export function formatDecimal(value, config = {}, digits = 2) {
  return formatNumber(value, config, {
    minimumFractionDigits: digits,

    maximumFractionDigits: digits,
  });
}

/* ==========================================================================
   Money
   ========================================================================== */

export function formatMoney(value, config = {}) {
  const digits = Number.isInteger(config.moneyFractionDigits)
    ? config.moneyFractionDigits
    : 2;

  return formatNumber(value, config, {
    minimumFractionDigits: digits,

    maximumFractionDigits: digits,
  });
}

/* ==========================================================================
   Percentage
   ========================================================================== */

export function formatPercentage(
  value,
  config = {},
  { digits = 2, sign = false } = {},
) {
  const number = toNumber(value);

  if (number === null) {
    return config.labels?.notAvailable || "-";
  }

  const formatted = formatNumber(Math.abs(number), config, {
    minimumFractionDigits: digits,

    maximumFractionDigits: digits,
  });

  let prefix = "";

  if (sign) {
    if (number > 0) {
      prefix = "+";
    } else if (number < 0) {
      prefix = "-";
    }
  } else if (number < 0) {
    prefix = "-";
  }

  return `${prefix}${formatted}%`;
}

/* ==========================================================================
   Date Parsing
   ========================================================================== */

function parseDateValue(value) {
  if (!hasValue(value)) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();

  /*
   * yyyy-MM-dd
   *
   * Construct locally instead of feeding this directly into Date because
   * browsers interpret a bare ISO date as UTC and that can shift the calendar
   * date in some time zones.
   */

  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  /*
   * dd/MM/yyyy and dd-MM-yyyy.
   */

  match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);

  if (match) {
    const date = new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  /*
   * ISO date-time and backend-native date strings.
   */

  const date = new Date(text);

  return Number.isNaN(date.getTime()) ? null : date;
}

/* ==========================================================================
   Date Formatting
   ========================================================================== */

export function formatDate(value, config = {}, options = {}) {
  if (!hasValue(value)) {
    return config.labels?.notAvailable || "-";
  }

  const date = parseDateValue(value);

  if (!date) {
    /*
     * Preserve unknown legacy date strings instead of replacing valid
     * server-provided copy with a dash.
     */

    return String(value);
  }

  const { year = "numeric", month = "2-digit", day = "2-digit" } = options;

  try {
    return new Intl.DateTimeFormat(getLocale(config), {
      year,
      month,
      day,
    }).format(date);
  } catch {
    return String(value);
  }
}

/* ==========================================================================
   Date + Time
   ========================================================================== */

export function formatDateTime(value, config = {}) {
  if (!hasValue(value)) {
    return config.labels?.notAvailable || "-";
  }

  const date = parseDateValue(value);

  if (!date) {
    return String(value);
  }

  try {
    return new Intl.DateTimeFormat(getLocale(config), {
      year: "numeric",

      month: "2-digit",

      day: "2-digit",

      hour: "2-digit",

      minute: "2-digit",
    }).format(date);
  } catch {
    return String(value);
  }
}

/* ==========================================================================
   Company / Security Accessors
   ========================================================================== */

export function getCompanySymbol(row) {
  return firstValue(
    row,
    [
      "symbol",
      "companySymbol",
      "securitySymbol",
      "ticker",
      "code",
      "companyCode",
      "stockCode",
      "symbolEn",
      "Symbol",
    ],
    "",
  );
}

export function getCompanyName(row, config = {}) {
  const arabic = isArabicLocale(config);

  const localizedKeys = arabic
    ? [
        "companyNameAr",
        "companyNameAR",
        "arabicCompanyName",
        "companyArabicName",
        "nameAr",
        "nameAR",
      ]
    : [
        "companyNameEn",
        "companyNameEN",
        "englishCompanyName",
        "companyEnglishName",
        "nameEn",
        "nameEN",
      ];

  return firstValue(
    row,
    [
      ...localizedKeys,
      "companyName",
      "company",
      "securityName",
      "issuerName",
      "name",
      "CompanyName",
    ],
    "",
  );
}

/* ==========================================================================
   Company Logo Fallback
   ========================================================================== */

/*
 * One canonical configured fallback resolver.
 *
 * All Trading company-logo code must use this helper so:
 *
 * - direct logo resolution
 * - generated logo resolution
 * - rendered-image fallback
 *
 * cannot drift into different configuration contracts.
 */

function getCompanyLogoFallback(config = {}) {
  return normalizeImageUrl(
    config.assets?.companyLogoFallbackUrl ||
      config.assets?.defaultCompanyLogo ||
      config.assets?.companyLogoFallback ||
      config.defaultCompanyLogo ||
      config.companyLogoFallback ||
      "",
    "",
  );
}

/* ==========================================================================
   Company Logo
   ========================================================================== */

export function getCompanyLogo(row, config = {}) {
  const directLogo = firstValue(
    row,
    [
      "logo",
      "logoUrl",
      "logoURL",
      "logoPath",
      "image",
      "imageUrl",
      "imageURL",
      "imagePath",
      "companyLogo",
      "companyLogoUrl",
      "companyLogoURL",
      "companyImage",
      "companyImageUrl",
    ],
    "",
  );

  if (isSafeImageUrl(directLogo)) {
    return String(directLogo).trim();
  }

  const companyCode = firstValue(
    row,
    [
      "companyCode",
      "code",
      "symbol",
      "companySymbol",
      "securitySymbol",
      "ticker",
    ],
    "",
  );

  const template = config.assets?.companyLogoUrlTemplate || "";

  if (hasValue(companyCode) && hasValue(template)) {
    const generatedLogo = String(template).replace(
      "{companyCode}",
      encodeURIComponent(String(companyCode).trim()),
    );

    if (isSafeImageUrl(generatedLogo)) {
      return generatedLogo;
    }
  }

  return getCompanyLogoFallback(config);
}

/* ==========================================================================
   Company Logo Markup
   ========================================================================== */

function renderCompanyLogo(row, config = {}) {
  const src = getCompanyLogo(row, config);

  const fallback = getCompanyLogoFallback(config);

  if (!src) {
    return `
      <span
        class="
          table-market__logo
          table-market__logo--placeholder
        "
        aria-hidden="true"
      ></span>
    `.trim();
  }

  /*
   * Logo failure is owned here by the formatter.
   *
   * First failure:
   *
   * requested/generated logo
   *        ↓
   * configured generic fallback
   *
   * If no distinct fallback exists, or the fallback itself cannot load,
   * hide the broken image. The surrounding identity layout remains intact.
   *
   * No page-level delegated logo error handler is required.
   */

  const fallbackHandler =
    fallback && fallback !== src
      ? `
        this.onerror=function(){
          this.onerror=null;
          this.hidden=true;
        };
        this.src='${escapeAttribute(fallback)}';
      `
      : `
        this.onerror=null;
        this.hidden=true;
      `;

  return `
    <img
      class="table-market__logo"
      src="${escapeAttribute(src)}"
      alt=""
      loading="lazy"
      decoding="async"
      onerror="${escapeAttribute(fallbackHandler.replace(/\s+/g, " ").trim())}"
    />
  `.trim();
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

/*
 * Shared Market Watch-style identity:
 *
 *   [logo]  COMPANY NAME
 *           SYMBOL
 */

export function renderCompanyIdentity(
  row,
  config = {},
  { compact = false } = {},
) {
  const symbol = getCompanySymbol(row);

  const company = getCompanyName(row, config);

  const modifier = compact ? " table-market__identity--compact" : "";

  return `
    <div
      class="table-market__identity${modifier}"
    >
      ${renderCompanyLogo(row, config)}

      <div
        class="table-market__identity-content"
      >
        <span
          class="table-market__company-name"
        >
          ${escapeHtml(company || symbol || config.labels?.notAvailable || "-")}
        </span>

        ${
          symbol
            ? `
              <span
                class="table-market__symbol-text"
              >
                ${escapeHtml(symbol)}
              </span>
            `
            : ""
        }
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Symbol Identity
   ========================================================================== */

/*
 * Some legacy Trading tables deliberately keep Symbol and Company in
 * different columns.
 *
 * For those tables this formatter preserves the Market Watch visual language
 * without forcing a column merge.
 */

function renderSymbolIdentity(row, config = {}, { status = "" } = {}) {
  const symbol = getCompanySymbol(row);

  return `
    <div
      class="
        table-market__identity
        table-market__identity--symbol
      "
    >
      ${renderCompanyLogo(row, config)}

      <div
        class="table-market__identity-content"
      >
        <span
          class="table-market__symbol-line"
        >
          ${status || ""}

          <span
            class="table-market__symbol-text"
          >
            ${escapeHtml(symbol || config.labels?.notAvailable || "-")}
          </span>
        </span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Semantic Status
   ========================================================================== */

function renderStatusIndicator(tone, label = "") {
  const normalizedTone = [
    "danger",
    "warning",
    "primary",
    "success",
    "muted",
  ].includes(tone)
    ? tone
    : "muted";

  const accessibleLabel = hasValue(label) ? String(label) : "";

  return `
    <span
      class="
        table-market__status
        table-market__status--${normalizedTone}
      "
      ${accessibleLabel ? `title="${escapeAttribute(accessibleLabel)}"` : ""}
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Negotiated Accessors
   ========================================================================== */

export function getNegotiatedDate(row) {
  return firstValue(
    row,
    [
      "date",
      "tradeDate",
      "transactionDate",
      "dealDate",
      "tradingDate",
      "createdDate",
    ],
    "",
  );
}

export function getNegotiatedPrice(row) {
  return firstValue(
    row,
    ["price", "tradePrice", "dealPrice", "transactionPrice"],
    "",
  );
}

export function getNegotiatedVolume(row) {
  return firstValue(
    row,
    [
      "volume",
      "quantity",
      "tradeVolume",
      "dealVolume",
      "transactionVolume",
      "shares",
    ],
    "",
  );
}

export function getNegotiatedValue(row) {
  return firstValue(
    row,
    ["value", "tradeValue", "dealValue", "transactionValue", "amount"],
    "",
  );
}

export function getNegotiatedTotalVolume(row) {
  return firstValue(
    row,
    ["totalVolume", "volumeTotal", "totalQuantity", "totalShares", "volume"],
    "",
  );
}

export function getNegotiatedTotalValue(row) {
  return firstValue(
    row,
    ["totalValue", "valueTotal", "totalAmount", "value"],
    "",
  );
}

/* ==========================================================================
   Negotiated Row Classification
   ========================================================================== */

export function isNegotiatedTotalRow(row) {
  if (!row) {
    return false;
  }

  if (
    row.isTotal === true ||
    row.total === true ||
    row.isSummary === true ||
    row.summary === true
  ) {
    return true;
  }

  const type = String(firstValue(row, ["rowType", "type", "recordType"], ""))
    .trim()
    .toLowerCase();

  return type === "total" || type === "summary";
}

/* ==========================================================================
   Negotiated Desktop Row
   ========================================================================== */

export function renderNegotiatedDesktopRow(row, config = {}) {
  if (isNegotiatedTotalRow(row)) {
    return renderNegotiatedDailyTotalRow(row, config);
  }

  return `
    <tr>
      <td
        class="table-market__date"
      >
        ${escapeHtml(formatDate(getNegotiatedDate(row), config))}
      </td>

      <td
        class="table-market__company"
      >
        ${renderCompanyIdentity(row, config)}
      </td>

      <td
        class="
          table-market__number
          table-market__price
        "
      >
        ${escapeHtml(formatMoney(getNegotiatedPrice(row), config))}
      </td>

      <td
        class="
          table-market__number
          table-market__volume
        "
      >
        ${escapeHtml(formatQuantity(getNegotiatedVolume(row), config))}
      </td>

      <td
        class="
          table-market__number
          table-market__value
        "
      >
        ${escapeHtml(formatMoney(getNegotiatedValue(row), config))}
      </td>
    </tr>
  `.trim();
}

/* ==========================================================================
   Negotiated Daily Total Row
   ========================================================================== */

export function renderNegotiatedDailyTotalRow(row, config = {}) {
  const totalLabel =
    config.labels?.negotiatedDeals?.total || config.labels?.total || "Total";

  return `
    <tr
      class="
        table-market__summary-row
        table-total-row
      "
    >
      <th
        scope="row"
        colspan="3"
      >
        ${escapeHtml(totalLabel)}
      </th>

      <td
        class="
          table-market__number
          table-market__volume
        "
      >
        ${escapeHtml(formatQuantity(getNegotiatedTotalVolume(row), config))}
      </td>

      <td
        class="
          table-market__number
          table-market__value
        "
      >
        ${escapeHtml(formatMoney(getNegotiatedTotalValue(row), config))}
      </td>
    </tr>
  `.trim();
}

/* ==========================================================================
   Negotiated Mobile Card
   ========================================================================== */

export function renderNegotiatedMobileCard(row, context = {}, config = {}) {
  if (isNegotiatedTotalRow(row)) {
    return renderNegotiatedDailyTotalCard(row, config);
  }

  const priceLabel = config.labels?.negotiatedDeals?.price || "Price";

  const volumeLabel = config.labels?.negotiatedDeals?.volume || "Volume";

  const valueLabel = config.labels?.negotiatedDeals?.value || "Value";

  return `
    <article
      class="
        data-card
        trading-data-card
        trading-negotiated-card
      "
      data-row-index="${escapeAttribute(context.index ?? "")}"
    >
      <div class="data-card__main">

        <div class="data-card__identity">
          ${renderCompanyLogo(row, config)}

          <div
            class="data-card__identity-content"
          >
            <span
              class="data-card__title"
            >
              ${escapeHtml(
                getCompanyName(row, config) ||
                  getCompanySymbol(row) ||
                  config.labels?.notAvailable ||
                  "-",
              )}
            </span>

            <span
              class="data-card__symbol"
            >
              ${escapeHtml(getCompanySymbol(row))}
            </span>
          </div>
        </div>

        <div class="data-card__quote">
          <span class="data-card__symbol">
            ${escapeHtml(priceLabel)}
          </span>

          <span class="data-card__price">
            ${escapeHtml(formatMoney(getNegotiatedPrice(row), config))}
          </span>
        </div>

      </div>

      <div class="data-card__details">

        <dl class="data-card__metrics">

          <div class="data-card__metric">
            <dt>
              ${escapeHtml(volumeLabel)}
            </dt>

            <dd>
              ${escapeHtml(formatQuantity(getNegotiatedVolume(row), config))}
            </dd>
          </div>

          <div class="data-card__metric">
            <dt>
              ${escapeHtml(valueLabel)}
            </dt>

            <dd>
              ${escapeHtml(formatMoney(getNegotiatedValue(row), config))}
            </dd>
          </div>

        </dl>

        ${
          hasValue(getNegotiatedDate(row))
            ? `
              <time
                class="data-card__meta"
                datetime="${escapeAttribute(getNegotiatedDate(row))}"
              >
                ${escapeHtml(formatDate(getNegotiatedDate(row), config))}
              </time>
            `
            : ""
        }

      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Negotiated Daily Total Card
   ========================================================================== */

export function renderNegotiatedDailyTotalCard(row, config = {}) {
  const volumeLabel = config.labels?.negotiatedDeals?.volume || "Volume";

  const valueLabel = config.labels?.negotiatedDeals?.value || "Value";

  /*
   * No duplicate "Total" text here.
   *
   * The Negotiated mobile grouping already communicates the daily-total
   * context. The card therefore presents only the two useful values.
   */

  return `
    <article
      class="
        data-card
        data-card--compact
        trading-daily-total-card
      "
    >
      <div class="data-card__main">

        <div class="data-card__identity">
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

        <div class="data-card__quote">
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
   Minimum Size
   ========================================================================== */

/* ==========================================================================
   Minimum Size Accessors
   ========================================================================== */

function getMinimumSizeLabel(row, config = {}) {
  const arabic = isArabicLocale(config);

  return firstValue(
    row,
    arabic
      ? [
          "nameAr",
          "nameAR",
          "labelAr",
          "labelAR",
          "descriptionAr",
          "descriptionAR",
          "name",
          "label",
          "description",
        ]
      : [
          "nameEn",
          "nameEN",
          "labelEn",
          "labelEN",
          "descriptionEn",
          "descriptionEN",
          "name",
          "label",
          "description",
        ],
    "",
  );
}

function getMinimumSizeValue(row, index) {
  return firstValue(
    row,
    [`col${index}`, `column${index}`, `value${index}`],
    "",
  );
}

/* ==========================================================================
   Minimum Size Search
   ========================================================================== */

export function filterMinimumSizeRows(rows, searchValue) {
  if (!Array.isArray(rows)) {
    return [];
  }

  const search = String(searchValue || "")
    .trim()
    .toLowerCase();

  if (!search) {
    return rows.slice();
  }

  return rows.filter((row) => {
    const values = [
      getMinimumSizeLabel(row),

      getMinimumSizeValue(row, 1),

      getMinimumSizeValue(row, 2),

      getMinimumSizeValue(row, 3),

      getMinimumSizeValue(row, 4),
    ];

    return values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(search),
    );
  });
}

/* ==========================================================================
   Minimum Size Desktop Row
   ========================================================================== */

export function renderMinimumSizeDesktopRow(row, config = {}) {
  const label = getMinimumSizeLabel(row, config);

  return `
    <tr>
      <th
        class="table-market__company"
        scope="row"
      >
        ${escapeHtml(label || config.labels?.notAvailable || "-")}
      </th>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatNumber(getMinimumSizeValue(row, 1), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatNumber(getMinimumSizeValue(row, 2), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatNumber(getMinimumSizeValue(row, 3), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatNumber(getMinimumSizeValue(row, 4), config))}
      </td>
    </tr>
  `.trim();
}

/* ==========================================================================
   Minimum Size Mobile Card
   ========================================================================== */

export function renderMinimumSizeMobileCard(row, context = {}, config = {}) {
  const label = getMinimumSizeLabel(row, config);

  const labels = config.labels?.minimumSize || {};

  return `
    <article
      class="
        data-card
        trading-data-card
        trading-minimum-size-card
      "
      data-row-index="${escapeAttribute(context.index ?? "")}"
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
              class="data-card__title"
            >
              ${escapeHtml(label || config.labels?.notAvailable || "-")}
            </span>
          </div>
        </div>
      </div>

      <div
        class="data-card__details"
      >
        <dl
          class="data-card__metrics"
        >
          <div
            class="data-card__metric"
          >
            <dt>
              ${escapeHtml(labels.col1 || "1")}
            </dt>

            <dd>
              ${escapeHtml(formatNumber(getMinimumSizeValue(row, 1), config))}
            </dd>
          </div>

          <div
            class="data-card__metric"
          >
            <dt>
              ${escapeHtml(labels.col2 || "2")}
            </dt>

            <dd>
              ${escapeHtml(formatNumber(getMinimumSizeValue(row, 2), config))}
            </dd>
          </div>

          <div
            class="data-card__metric"
          >
            <dt>
              ${escapeHtml(labels.col3 || "3")}
            </dt>

            <dd>
              ${escapeHtml(formatNumber(getMinimumSizeValue(row, 3), config))}
            </dd>
          </div>

          <div
            class="data-card__metric"
          >
            <dt>
              ${escapeHtml(labels.col4 || "4")}
            </dt>

            <dd>
              ${escapeHtml(formatNumber(getMinimumSizeValue(row, 4), config))}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Accumulated Losses
   ========================================================================== */

/*
 * Backend/filter contract:
 *
 * All
 * 50-MORE
 * 35-50
 * 20-35
 *
 * Presentation contract:
 *
 * 50-MORE -> danger
 * 35-50   -> warning
 * 20-35   -> primary
 *
 * Final identity contract:
 *
 * [logo] Company Name
 *        SYMBOL + status
 *
 * Symbol is supporting identity metadata.
 * It is not a standalone desktop column.
 */

/* ==========================================================================
   Accumulated Loss Band
   ========================================================================== */

export function getAccumulatedLossBand(row) {
  const raw = firstValue(
    row,
    [
      "report",
      "lossRange",
      "lossBand",
      "lossCategory",
      "category",
      "range",
      "companyStatus",
      "status",
    ],
    "",
  );

  const normalized = String(raw ?? "")
    .trim()
    .toUpperCase();

  /*
   * Exact business/filter values.
   */

  if (
    normalized === "50-MORE" ||
    normalized === "50+" ||
    normalized === "3" ||
    normalized === "DANGER"
  ) {
    return "50-MORE";
  }

  if (
    normalized === "35-50" ||
    normalized === "2" ||
    normalized === "WARNING"
  ) {
    return "35-50";
  }

  if (
    normalized === "20-35" ||
    normalized === "1" ||
    normalized === "PRIMARY"
  ) {
    return "20-35";
  }

  /*
   * Some legacy responses expose only a percentage value.
   *
   * Use it only as a compatibility fallback.
   */

  const percentage = toNumber(
    firstValue(
      row,
      [
        "lossPercentage",
        "lossPercent",
        "percentage",
        "percent",
        "accumulatedLossPercentage",
      ],
      null,
    ),
  );

  if (percentage !== null) {
    const absolute = Math.abs(percentage);

    if (absolute >= 50) {
      return "50-MORE";
    }

    if (absolute >= 35) {
      return "35-50";
    }

    if (absolute >= 20) {
      return "20-35";
    }
  }

  return "";
}

/* ==========================================================================
   Accumulated Status Tone
   ========================================================================== */

export function getAccumulatedLossTone(row) {
  switch (getAccumulatedLossBand(row)) {
    case "50-MORE":
      return "danger";

    case "35-50":
      return "warning";

    case "20-35":
      return "primary";

    default:
      return "";
  }
}

/* ==========================================================================
   Accumulated Status Label
   ========================================================================== */

function getAccumulatedLossLabel(row, config = {}) {
  const labels = config.labels?.accumulated || {};

  switch (getAccumulatedLossBand(row)) {
    case "50-MORE":
      return labels.loss50More || labels.moreThan50 || "50% or more";

    case "35-50":
      return labels.loss35To50 || labels.from35To50 || "35% - 50%";

    case "20-35":
      return labels.loss20To35 || labels.from20To35 || "20% - 35%";

    default:
      return "";
  }
}

/* ==========================================================================
   Accumulated Status Indicator
   ========================================================================== */

export function renderAccumulatedStatus(row, config = {}) {
  const tone = getAccumulatedLossTone(row);

  if (!tone) {
    return "";
  }

  return renderStatusIndicator(tone, getAccumulatedLossLabel(row, config));
}

/* ==========================================================================
   Trading Company Cell
   ========================================================================== */

/*
 * Canonical one-column company identity renderer.
 *
 * Used by views where Company owns:
 *
 * - logo
 * - company name
 * - symbol
 * - optional semantic status
 *
 * options:
 *
 * {
 *   status: HTML string
 * }
 */

export function renderTradingCompanyCell(row, config = {}, options = {}) {
  const company = getCompanyName(row, config);

  const symbol = getCompanySymbol(row);

  const status = options.status || "";

  return `
    <div
      class="table-market__security-cell"
    >
      ${renderCompanyLogo(row, config)}

      <div
        class="table-market__identity-content"
      >
        <span
          class="table-market__company-name"
        >
          ${escapeHtml(company || symbol || config.labels?.notAvailable || "-")}
        </span>

        ${
          symbol || status
            ? `
              <span
                class="table-market__symbol-line"
              >
                ${
                  symbol
                    ? `
                      <span
                        class="table-market__symbol-text"
                      >
                        ${escapeHtml(symbol)}
                      </span>
                    `
                    : ""
                }

                ${status}
              </span>
            `
            : ""
        }
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Accumulated Compatibility Cell
   ========================================================================== */

/*
 * Keep this public formatter as a compatibility alias for any code that still
 * imports renderAccumulatedCompanyCell().
 *
 * It now follows the finalized ONE-column Company contract.
 */

export function renderAccumulatedCompanyCell(row, config = {}) {
  return renderTradingCompanyCell(row, config, {
    status: renderAccumulatedStatus(row, config),
  });
}

/* ==========================================================================
   Accumulated Symbol Compatibility
   ========================================================================== */

/*
 * Legacy compatibility only.
 *
 * New accumulated.js must not create a standalone Symbol column.
 */

export function renderAccumulatedSymbolCell(row, config = {}) {
  const symbol = getCompanySymbol(row);

  const status = renderAccumulatedStatus(row, config);

  return `
    <span
      class="table-market__symbol-status"
    >
      ${status}

      <span
        class="table-market__symbol"
      >
        ${escapeHtml(symbol || config.labels?.notAvailable || "-")}
      </span>
    </span>
  `.trim();
}

/* ==========================================================================
   Accumulated Desktop Row
   ========================================================================== */

export function renderAccumulatedDesktopRow(row, config = {}) {
  return `
    <tr>
      <td
        class="
          table-market__security
          table-market__identity-column
        "
      >
        ${renderAccumulatedCompanyCell(row, config)}
      </td>
    </tr>
  `.trim();
}

/* ==========================================================================
   Accumulated Mobile Card
   ========================================================================== */

export function renderAccumulatedMobileCard(row, context = {}, config = {}) {
  const symbol = getCompanySymbol(row);

  const company = getCompanyName(row, config);

  const status = renderAccumulatedStatus(row, config);

  return `
    <article
      class="
        data-card
        data-card--compact
        trading-data-card
        trading-accumulated-card
      "
      data-row-index="${escapeAttribute(context.index ?? "")}"
    >
      <div
        class="data-card__main"
      >
        <div
          class="data-card__identity"
        >
          ${renderCompanyLogo(row, config)}

          <div
            class="data-card__identity-content"
          >
            <span
              class="data-card__title"
            >
              ${escapeHtml(
                company || symbol || config.labels?.notAvailable || "-",
              )}
            </span>

            ${
              symbol || status
                ? `
                  <span
                    class="data-card__identity-code"
                  >
                    ${
                      symbol
                        ? `
                          <span
                            class="data-card__symbol"
                          >
                            ${escapeHtml(symbol)}
                          </span>
                        `
                        : ""
                    }

                    ${status}
                  </span>
                `
                : ""
            }
          </div>
        </div>
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Listed Tradable Rights
   ========================================================================== */

/* ==========================================================================
   Listed Tradable Accessors
   ========================================================================== */

export function getListedTradableCompanyName(row, config = {}) {
  const arabic = isArabicLocale(config);

  const localized = arabic
    ? ["acrynomNameAr", "companyNameAr", "nameAr"]
    : ["acrynomNameEn", "companyNameEn", "nameEn"];

  return firstValue(
    row,
    [...localized, "acrynomName", "companyName", "company", "name"],
    "",
  );
}

export function getListedTradableSymbol(row) {
  return firstValue(
    row,
    ["symbol", "companySymbol", "securitySymbol", "ticker", "code"],
    "",
  );
}

export function getListedLastTradePrice(row) {
  return firstValue(
    row,
    ["lastTradePriceModified", "lastTradePrice", "lastPrice", "price"],
    "",
  );
}

export function getListedChange(row) {
  return firstValue(row, ["changeModified", "change", "netChange"], "");
}

export function getListedChangePercent(row) {
  return firstValue(
    row,
    [
      "percentChangeModified",
      "percentChange",
      "changePercent",
      "changePercentage",
    ],
    "",
  );
}

export function getListedChangeNumeric(row) {
  return firstValue(
    row,
    [
      "percentChangeDoubleModified",
      "percentChangeDouble",
      "changePercentValue",
      "changePercentageValue",
      "percentChange",
    ],
    getListedChangePercent(row),
  );
}

export function getListedCumulativeVolume(row) {
  return firstValue(row, ["cumulativeVolume", "cumVolume", "volume"], "");
}

export function getListedCumulativeValue(row) {
  return firstValue(row, ["cumulativeValue", "cumValue", "value"], "");
}

export function getListedCumulativeTrades(row) {
  return firstValue(
    row,
    ["cumulativeTrades", "cumTrades", "trades", "numberOfTrades"],
    "",
  );
}

export function getListedTodayVolume(row) {
  return firstValue(
    row,
    ["todayVolume", "todayTradeVolume", "tradedVolume"],
    "",
  );
}

export function getListedTodayValue(row) {
  return firstValue(row, ["todayValue", "todayTradeValue", "tradedValue"], "");
}

export function getListedTodayTrades(row) {
  return firstValue(row, ["todayTrades", "todayTradeCount", "tradeCount"], "");
}

export function getListedBidPrice(row) {
  return firstValue(row, ["bestBidPrice", "bidPrice", "bestBid"], "");
}

export function getListedBidVolume(row) {
  return firstValue(row, ["bestBidVolume", "bidVolume"], "");
}

export function getListedOfferPrice(row) {
  return firstValue(
    row,
    ["bestOfferPrice", "offerPrice", "bestAskPrice", "askPrice"],
    "",
  );
}

export function getListedOfferVolume(row) {
  return firstValue(
    row,
    ["bestOfferVolume", "offerVolume", "bestAskVolume", "askVolume"],
    "",
  );
}

/* ==========================================================================
   Price Tone
   ========================================================================== */

function getPriceTone(value) {
  const number = toNumber(value);

  if (number === null) {
    return "price-neutral";
  }

  if (number > 0) {
    return "price-up";
  }

  if (number < 0) {
    return "price-down";
  }

  return "price-neutral";
}

/* ==========================================================================
   Listed Tradable Identity
   ========================================================================== */

function renderListedIdentity(row, config = {}) {
  const symbol = getListedTradableSymbol(row);

  const company = getListedTradableCompanyName(row, config);

  return `
    <div
      class="table-market__security-cell"
    >
      ${renderCompanyLogo(row, config)}

      <span
        class="table-market__security-link"
      >
        <span
          class="table-market__name"
        >
          ${escapeHtml(company || symbol || config.labels?.notAvailable || "-")}
        </span>

        ${
          symbol
            ? `
              <span
                class="table-market__symbol"
              >
                ${escapeHtml(symbol)}
              </span>
            `
            : ""
        }
      </span>
    </div>
  `.trim();
}

/* ==========================================================================
   Listed Tradable Desktop Row
   ========================================================================== */

/*
 * JSP owns the grouped multi-row table header.
 *
 * This renderer owns only tbody row presentation.
 */

export function renderListedTradableDesktopRow(row, config = {}) {
  const changeTone = getPriceTone(getListedChangeNumeric(row));

  return `
    <tr>
      <td
        class="table-market__security"
      >
        ${renderListedIdentity(row, config)}
      </td>

      <td
        class="
          table-market__number
          table-market__price
        "
      >
        ${escapeHtml(formatMoney(getListedLastTradePrice(row), config))}
      </td>

      <td
        class="
          table-market__number
          table-market__change
          ${changeTone}
        "
      >
        ${escapeHtml(
          formatPercentage(getListedChangePercent(row), config, {
            sign: true,
          }),
        )}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatQuantity(getListedCumulativeVolume(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatMoney(getListedCumulativeValue(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatQuantity(getListedCumulativeTrades(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatQuantity(getListedTodayVolume(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatMoney(getListedTodayValue(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatQuantity(getListedTodayTrades(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatMoney(getListedBidPrice(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatQuantity(getListedBidVolume(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatMoney(getListedOfferPrice(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatQuantity(getListedOfferVolume(row), config))}
      </td>
    </tr>
  `.trim();
}

/* ==========================================================================
   Listed Tradable Mobile Summary
   ========================================================================== */

export function renderListedTradableMobileSummary(row, config = {}) {
  const labels = config.labels?.listedTradableRights || {};

  const changeTone = getPriceTone(getListedChangeNumeric(row));

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
          ${escapeHtml(labels.lastTradePrice || labels.price || "Price")}
        </span>

        <span
          class="data-card__price"
        >
          ${escapeHtml(formatMoney(getListedLastTradePrice(row), config))}
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

        <span
          class="
            data-card__change
            ${changeTone}
          "
        >
          ${escapeHtml(
            formatPercentage(getListedChangePercent(row), config, {
              sign: true,
            }),
          )}
        </span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Listed Tradable Mobile Card
   ========================================================================== */

export function renderListedTradableMobileCard(row, context = {}, config = {}) {
  const labels = config.labels?.listedTradableRights || {};

  const symbol = getListedTradableSymbol(row);

  const company = getListedTradableCompanyName(row, config);

  const detailFields = [
    {
      label: labels.cumulativeVolume || "Cumulative Volume",

      value: formatQuantity(getListedCumulativeVolume(row), config),
    },

    {
      label: labels.cumulativeValue || "Cumulative Value",

      value: formatMoney(getListedCumulativeValue(row), config),
    },

    {
      label: labels.cumulativeTrades || "Cumulative Trades",

      value: formatQuantity(getListedCumulativeTrades(row), config),
    },

    {
      label: labels.todayVolume || "Today's Volume",

      value: formatQuantity(getListedTodayVolume(row), config),
    },

    {
      label: labels.todayValue || "Today's Value",

      value: formatMoney(getListedTodayValue(row), config),
    },

    {
      label: labels.todayTrades || "Today's Trades",

      value: formatQuantity(getListedTodayTrades(row), config),
    },

    {
      label: labels.bidPrice || "Bid Price",

      value: formatMoney(getListedBidPrice(row), config),
    },

    {
      label: labels.bidVolume || "Bid Volume",

      value: formatQuantity(getListedBidVolume(row), config),
    },

    {
      label: labels.offerPrice || labels.askPrice || "Offer Price",

      value: formatMoney(getListedOfferPrice(row), config),
    },

    {
      label: labels.offerVolume || labels.askVolume || "Offer Volume",

      value: formatQuantity(getListedOfferVolume(row), config),
    },
  ];

  const details = detailFields
    .map(
      (field) => `
          <div
            class="data-card__field"
          >
            <dt
              class="data-card__label"
            >
              ${escapeHtml(field.label)}
            </dt>

            <dd
              class="
                data-card__value
                data-card__value--numeric
              "
            >
              ${escapeHtml(field.value)}
            </dd>
          </div>
        `,
    )
    .join("");

  const detailsId = `listed-tradable-details-${context.index ?? 0}`;

  return `
    <article
      class="
        data-card
        trading-data-card
        trading-listed-tradable-card
      "
      data-row-index="${escapeAttribute(context.index ?? "")}"
    >
      <div
        class="data-card__main"
      >
        <div
          class="data-card__identity"
        >
          ${renderCompanyLogo(row, config)}

          <div
            class="data-card__identity-content"
          >
            <span
              class="data-card__title"
            >
              ${escapeHtml(
                company || symbol || config.labels?.notAvailable || "-",
              )}
            </span>

            ${
              symbol
                ? `
                  <span
                    class="data-card__symbol"
                  >
                    ${escapeHtml(symbol)}
                  </span>
                `
                : ""
            }
          </div>
        </div>

        ${renderListedTradableMobileSummary(row, config)}
      </div>

      <button
        class="data-card__toggle"
        type="button"
        aria-expanded="false"
        aria-controls="${escapeAttribute(detailsId)}"
        data-data-card-toggle
      >
        <span
          class="
            has-icon
            icon-chevron-down
          "
          aria-hidden="true"
        ></span>

        <span
          class="data-card__toggle-label"
        >
          ${escapeHtml(config.labels?.mobile?.showDetails || "Show details")}
        </span>
      </button>

      <div
        class="data-card__details"
        id="${escapeAttribute(detailsId)}"
        hidden
      >
        <dl
          class="data-card__fields"
        >
          ${details}
        </dl>
      </div>
    </article>
  `.trim();
}
/* ==========================================================================
   Company Status — Suspended / Delisted
   ========================================================================== */

export function getCompanyStatusType(row) {
  return String(
    firstValue(
      row,
      [
        "type",
        "statusType",
        "companyStatusType",
        "suspensionType",
        "delistingType",
      ],
      "",
    ),
  ).trim();
}

/* ==========================================================================
   Company Status Dates
   ========================================================================== */

export function getCompanyStatusFromDate(row) {
  return firstValue(
    row,
    ["fromDate", "startDate", "suspensionFrom", "suspendFrom", "dateFrom"],
    "",
  );
}

export function getCompanyStatusToDate(row) {
  return firstValue(
    row,
    ["toDate", "endDate", "suspensionTo", "suspendTo", "dateTo"],
    "",
  );
}

/* ==========================================================================
   Company Status Reason
   ========================================================================== */

export function getCompanyStatusReason(row, config = {}) {
  const arabic = isArabicLocale(config);

  return firstValue(
    row,
    arabic
      ? ["reasonAr", "reasonAR", "arabicReason", "reason"]
      : ["reasonEn", "reasonEN", "englishReason", "reason"],
    "",
  );
}

/* ==========================================================================
   Announcement URL
   ========================================================================== */

export function getAnnouncementUrl(row) {
  const value = firstValue(
    row,
    ["annUrl", "announcementUrl", "newsUrl", "newsURL", "url"],
    "",
  );

  if (!hasValue(value)) {
    return "";
  }

  const url = String(value).trim();

  /*
   * Announcement links may be:
   *
   * - application-relative
   * - absolute
   * - protocol-relative
   *
   * Reject executable schemes.
   */

  if (/^javascript:/i.test(url) || /^vbscript:/i.test(url)) {
    return "";
  }

  return url;
}

/* ==========================================================================
   Announcement Link
   ========================================================================== */

export function renderAnnouncementLink(row, config = {}, label = "") {
  const url = getAnnouncementUrl(row);

  if (!url) {
    return config.labels?.notAvailable || "-";
  }

  const text =
    label ||
    config.labels?.companyStatus?.announcement ||
    config.labels?.announcement ||
    "View";

  return `
    <a
      class="table-market__action-link"
      href="${escapeAttribute(url)}"
    >
      ${escapeHtml(text)}
    </a>
  `.trim();
}

/* ==========================================================================
   Company Status Presentation
   ========================================================================== */

function normalizeCompanyStatusVariant(variant) {
  const normalized = String(variant || "")
    .trim()
    .toLowerCase();

  if (normalized === "delisted" || normalized === "delisting") {
    return "delisted";
  }

  return "suspended";
}

/* ==========================================================================
   Company Status Labels
   ========================================================================== */

function getCompanyStatusLabels(config = {}, variant = "suspended") {
  const normalizedVariant = normalizeCompanyStatusVariant(variant);

  const common = config.labels?.companyStatus || {};

  const specific =
    normalizedVariant === "delisted"
      ? config.labels?.delistedCompanies || {}
      : config.labels?.suspendedCompanies || {};

  return {
    company:
      specific.company || common.company || config.labels?.company || "Company",

    symbol:
      specific.symbol || common.symbol || config.labels?.symbol || "Symbol",

    type: specific.type || common.type || config.labels?.type || "Type",

    fromDate:
      specific.fromDate || common.fromDate || config.labels?.fromDate || "From",

    toDate: specific.toDate || common.toDate || config.labels?.toDate || "To",

    date: specific.date || common.date || config.labels?.date || "Date",

    reason:
      specific.reason || common.reason || config.labels?.reason || "Reason",

    announcement:
      specific.announcement ||
      common.announcement ||
      config.labels?.announcement ||
      "Announcement",
  };
}

/* ==========================================================================
   Company Status Type Label
   ========================================================================== */

export function formatCompanyStatusType(row, config = {}) {
  const type = getCompanyStatusType(row);

  if (!type) {
    return config.labels?.notAvailable || "-";
  }

  const labels = config.labels?.companyStatusTypes || {};

  switch (type) {
    case "Suspension":
      return labels.suspension || type;

    case "Suspension_Funds":
      return labels.suspensionFunds || type;

    case "Delisting":
      return labels.delisting || type;

    case "Delisting_Funds":
      return labels.delistingFunds || type;

    default:
      return type;
  }
}

/* ==========================================================================
   Company Status Desktop Row
   ========================================================================== */

/*
 * Suspended and Delisted share the presentation renderer.
 *
 * The individual view supplies the active variant.
 *
 * Desktop contract:
 *
 * Company
 * Type
 * From
 * To
 * Reason
 * Announcement
 *
 * Individual cell formatters below remain available for DataTables views
 * that define their columns independently.
 */

export function renderCompanyStatusDesktopRow(
  row,
  config = {},
  { variant = "suspended" } = {},
) {
  const labels = getCompanyStatusLabels(config, variant);

  const reason = getCompanyStatusReason(row, config);

  return `
    <tr>
      <td
        class="
          table-market__company
          table-market__identity-column
        "
      >
        ${renderCompanyIdentity(row, config)}
      </td>

      <td
        class="table-market__status-type"
      >
        ${escapeHtml(formatCompanyStatusType(row, config))}
      </td>

      <td
        class="table-market__date"
      >
        ${escapeHtml(formatDate(getCompanyStatusFromDate(row), config))}
      </td>

      <td
        class="table-market__date"
      >
        ${escapeHtml(formatDate(getCompanyStatusToDate(row), config))}
      </td>

      <td
        class="table-market__reason"
      >
        ${escapeHtml(reason || config.labels?.notAvailable || "-")}
      </td>

      <td
        class="table-market__action"
      >
        ${renderAnnouncementLink(row, config, labels.announcement)}
      </td>
    </tr>
  `.trim();
}

/* ==========================================================================
   Suspended Desktop Row
   ========================================================================== */

export function renderSuspendedDesktopRow(row, config = {}) {
  return renderCompanyStatusDesktopRow(row, config, {
    variant: "suspended",
  });
}

/* ==========================================================================
   Delisted Desktop Row
   ========================================================================== */

export function renderDelistedDesktopRow(row, config = {}) {
  return renderCompanyStatusDesktopRow(row, config, {
    variant: "delisted",
  });
}

/* ==========================================================================
   Company Status Individual Cells
   ========================================================================== */

/*
 * DataTables column.render helpers.
 *
 * These preserve the same presentation when a view renders individual
 * columns rather than using the complete row renderer.
 */

export function renderCompanyStatusCompanyCell(row, config = {}) {
  return renderCompanyIdentity(row, config);
}

export function renderCompanyStatusTypeCell(row, config = {}) {
  return escapeHtml(formatCompanyStatusType(row, config));
}

export function renderCompanyStatusFromDateCell(row, config = {}) {
  return escapeHtml(formatDate(getCompanyStatusFromDate(row), config));
}

export function renderCompanyStatusToDateCell(row, config = {}) {
  return escapeHtml(formatDate(getCompanyStatusToDate(row), config));
}

export function renderCompanyStatusReasonCell(row, config = {}) {
  return escapeHtml(
    getCompanyStatusReason(row, config) || config.labels?.notAvailable || "-",
  );
}

export function renderCompanyStatusAnnouncementCell(row, config = {}) {
  return renderAnnouncementLink(row, config);
}

/* ==========================================================================
   Company Status Mobile Card
   ========================================================================== */

export function renderCompanyStatusMobileCard(
  row,
  context = {},
  config = {},
  { variant = "suspended" } = {},
) {
  const normalizedVariant = normalizeCompanyStatusVariant(variant);

  const labels = getCompanyStatusLabels(config, normalizedVariant);

  const symbol = getCompanySymbol(row);

  const company = getCompanyName(row, config);

  const type = formatCompanyStatusType(row, config);

  const fromDate = getCompanyStatusFromDate(row);

  const toDate = getCompanyStatusToDate(row);

  const reason = getCompanyStatusReason(row, config);

  const announcement = getAnnouncementUrl(row);

  const detailsId = `company-status-${normalizedVariant}-details-${
    context.index ?? 0
  }`;

  const details = [
    {
      label: labels.fromDate,

      value: formatDate(fromDate, config),
    },

    {
      label: labels.toDate,

      value: formatDate(toDate, config),
    },

    {
      label: labels.reason,

      value: reason || config.labels?.notAvailable || "-",
    },
  ];

  return `
    <article
      class="
        data-card
        trading-data-card
        trading-company-status-card
        trading-company-status-card--${escapeAttribute(normalizedVariant)}
      "
      data-row-index="${escapeAttribute(context.index ?? "")}"
    >
      <div
        class="data-card__main"
      >
        <div
          class="data-card__identity"
        >
          ${renderCompanyLogo(row, config)}

          <div
            class="data-card__identity-content"
          >
            <span
              class="data-card__title"
            >
              ${escapeHtml(
                company || symbol || config.labels?.notAvailable || "-",
              )}
            </span>

            ${
              symbol
                ? `
                  <span
                    class="data-card__symbol"
                  >
                    ${escapeHtml(symbol)}
                  </span>
                `
                : ""
            }
          </div>
        </div>

        ${
          hasValue(type)
            ? `
              <div
                class="data-card__quote"
              >
                <span
                  class="data-card__symbol"
                >
                  ${escapeHtml(labels.type)}
                </span>

                <span
                  class="data-card__price"
                >
                  ${escapeHtml(type)}
                </span>
              </div>
            `
            : ""
        }
      </div>

      <button
        class="data-card__toggle"
        type="button"
        aria-expanded="false"
        aria-controls="${escapeAttribute(detailsId)}"
        data-data-card-toggle
      >
        <span
          class="
            has-icon
            icon-chevron-down
          "
          aria-hidden="true"
        ></span>

        <span
          class="data-card__toggle-label"
        >
          ${escapeHtml(config.labels?.mobile?.showDetails || "Show details")}
        </span>
      </button>

      <div
        class="data-card__details"
        id="${escapeAttribute(detailsId)}"
        hidden
      >
        <dl
          class="data-card__fields"
        >
          ${details
            .map(
              (field) => `
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
                    ${escapeHtml(field.value)}
                  </dd>
                </div>
              `,
            )
            .join("")}
        </dl>

        ${
          announcement
            ? `
              <div
                class="data-card__actions"
              >
                ${renderAnnouncementLink(row, config, labels.announcement)}
              </div>
            `
            : ""
        }
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Suspended Mobile Card
   ========================================================================== */

export function renderSuspendedMobileCard(row, context = {}, config = {}) {
  return renderCompanyStatusMobileCard(row, context, config, {
    variant: "suspended",
  });
}

/* ==========================================================================
   Delisted Mobile Card
   ========================================================================== */

export function renderDelistedMobileCard(row, context = {}, config = {}) {
  return renderCompanyStatusMobileCard(row, context, config, {
    variant: "delisted",
  });
}

/* ==========================================================================
   OTC Trading
   ========================================================================== */

/* ==========================================================================
   OTC Accessors
   ========================================================================== */

export function getOtcSymbol(row) {
  return firstValue(
    row,
    ["symbol", "companySymbol", "securitySymbol", "ticker", "code"],
    "",
  );
}

export function getOtcCompanyName(row, config = {}) {
  return getCompanyName(row, config);
}

export function getOtcLastPrice(row) {
  return firstValue(
    row,
    ["lastPrice", "lastTradePrice", "price", "closePrice"],
    "",
  );
}

export function getOtcChange(row) {
  return firstValue(row, ["change", "netChange", "priceChange"], "");
}

export function getOtcChangePercent(row) {
  return firstValue(
    row,
    ["changePercent", "changePercentage", "percentChange", "percentageChange"],
    "",
  );
}

export function getOtcVolume(row) {
  return firstValue(
    row,
    ["volume", "tradeVolume", "tradedVolume", "quantity"],
    "",
  );
}

export function getOtcValue(row) {
  return firstValue(row, ["value", "tradeValue", "tradedValue", "amount"], "");
}

export function getOtcTrades(row) {
  return firstValue(
    row,
    ["trades", "tradeCount", "numberOfTrades", "transactions"],
    "",
  );
}

/* ==========================================================================
   OTC Identity
   ========================================================================== */

function renderOtcIdentity(row, config = {}) {
  return renderCompanyIdentity(row, config);
}

/* ==========================================================================
   OTC Desktop Row
   ========================================================================== */

export function renderOtcDesktopRow(row, config = {}) {
  const changeTone = getPriceTone(getOtcChangePercent(row));

  return `
    <tr>
      <td
        class="
          table-market__company
          table-market__identity-column
        "
      >
        ${renderOtcIdentity(row, config)}
      </td>

      <td
        class="
          table-market__number
          table-market__price
        "
      >
        ${escapeHtml(formatMoney(getOtcLastPrice(row), config))}
      </td>

      <td
        class="
          table-market__number
          table-market__change
          ${changeTone}
        "
      >
        ${escapeHtml(formatMoney(getOtcChange(row), config))}
      </td>

      <td
        class="
          table-market__number
          table-market__change
          ${changeTone}
        "
      >
        ${escapeHtml(
          formatPercentage(getOtcChangePercent(row), config, {
            sign: true,
          }),
        )}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatQuantity(getOtcVolume(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatMoney(getOtcValue(row), config))}
      </td>

      <td
        class="table-market__number"
      >
        ${escapeHtml(formatQuantity(getOtcTrades(row), config))}
      </td>
    </tr>
  `.trim();
}

/* ==========================================================================
   OTC Mobile Card
   ========================================================================== */

export function renderOtcMobileCard(row, context = {}, config = {}) {
  const labels = config.labels?.otcTrading || {};

  const symbol = getOtcSymbol(row);

  const company = getOtcCompanyName(row, config);

  const changeTone = getPriceTone(getOtcChangePercent(row));

  const detailsId = `otc-trading-details-${context.index ?? 0}`;

  const fields = [
    {
      label: labels.change || "Change",

      value: formatMoney(getOtcChange(row), config),

      className: changeTone,
    },

    {
      label: labels.volume || "Volume",

      value: formatQuantity(getOtcVolume(row), config),
    },

    {
      label: labels.value || "Value",

      value: formatMoney(getOtcValue(row), config),
    },

    {
      label: labels.trades || "Trades",

      value: formatQuantity(getOtcTrades(row), config),
    },
  ];

  return `
    <article
      class="
        data-card
        trading-data-card
        trading-otc-card
      "
      data-row-index="${escapeAttribute(context.index ?? "")}"
    >
      <div
        class="data-card__main"
      >
        <div
          class="data-card__identity"
        >
          ${renderCompanyLogo(row, config)}

          <div
            class="data-card__identity-content"
          >
            <span
              class="data-card__title"
            >
              ${escapeHtml(
                company || symbol || config.labels?.notAvailable || "-",
              )}
            </span>

            ${
              symbol
                ? `
                  <span
                    class="data-card__symbol"
                  >
                    ${escapeHtml(symbol)}
                  </span>
                `
                : ""
            }
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
              ${escapeHtml(labels.lastPrice || labels.price || "Price")}
            </span>

            <span
              class="data-card__price"
            >
              ${escapeHtml(formatMoney(getOtcLastPrice(row), config))}
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

            <span
              class="
                data-card__change
                ${changeTone}
              "
            >
              ${escapeHtml(
                formatPercentage(getOtcChangePercent(row), config, {
                  sign: true,
                }),
              )}
            </span>
          </div>
        </div>
      </div>

      <button
        class="data-card__toggle"
        type="button"
        aria-expanded="false"
        aria-controls="${escapeAttribute(detailsId)}"
        data-data-card-toggle
      >
        <span
          class="
            has-icon
            icon-chevron-down
          "
          aria-hidden="true"
        ></span>

        <span
          class="data-card__toggle-label"
        >
          ${escapeHtml(config.labels?.mobile?.showDetails || "Show details")}
        </span>
      </button>

      <div
        class="data-card__details"
        id="${escapeAttribute(detailsId)}"
        hidden
      >
        <dl
          class="data-card__fields"
        >
          ${fields
            .map(
              (field) => `
                <div
                  class="data-card__field"
                >
                  <dt
                    class="data-card__label"
                  >
                    ${escapeHtml(field.label)}
                  </dt>

                  <dd
                    class="
                      data-card__value
                      data-card__value--numeric
                      ${escapeAttribute(field.className || "")}
                    "
                  >
                    ${escapeHtml(field.value)}
                  </dd>
                </div>
              `,
            )
            .join("")}
        </dl>
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Generic Trading Symbol Cell
   ========================================================================== */

export function renderTradingSymbolCell(row, config = {}, options = {}) {
  return renderSymbolIdentity(row, config, options);
}

/* ==========================================================================
   Generic Numeric Cell
   ========================================================================== */

export function renderTradingNumberCell(value, config = {}, options = {}) {
  return escapeHtml(formatNumber(value, config, options));
}

/* ==========================================================================
   Generic Quantity Cell
   ========================================================================== */

export function renderTradingQuantityCell(value, config = {}) {
  return escapeHtml(formatQuantity(value, config));
}

/* ==========================================================================
   Generic Money Cell
   ========================================================================== */

export function renderTradingMoneyCell(value, config = {}) {
  return escapeHtml(formatMoney(value, config));
}

/* ==========================================================================
   Generic Percentage Cell
   ========================================================================== */

export function renderTradingPercentageCell(value, config = {}, options = {}) {
  return escapeHtml(formatPercentage(value, config, options));
}

/* ==========================================================================
   Generic Date Cell
   ========================================================================== */

export function renderTradingDateCell(value, config = {}) {
  return escapeHtml(formatDate(value, config));
}

/* ==========================================================================
   Generic Change Cell
   ========================================================================== */

export function renderTradingChangeCell(
  value,
  config = {},
  { percentage = false, sign = true } = {},
) {
  const tone = getPriceTone(value);

  const formatted = percentage
    ? formatPercentage(value, config, {
        sign,
      })
    : formatMoney(value, config);

  return `
    <span
      class="
        table-market__change
        ${tone}
      "
    >
      ${escapeHtml(formatted)}
    </span>
  `.trim();
}

/* ==========================================================================
   Generic Card Identity
   ========================================================================== */

export function renderTradingCardIdentity(
  row,
  config = {},
  { status = "" } = {},
) {
  const symbol = getCompanySymbol(row);

  const company = getCompanyName(row, config);

  return `
    <div
      class="data-card__identity"
    >
      ${renderCompanyLogo(row, config)}

      <div
        class="data-card__identity-content"
      >
        <span
          class="data-card__title"
        >
          ${escapeHtml(company || symbol || config.labels?.notAvailable || "-")}
        </span>

        ${
          symbol || status
            ? `
              <span
                class="data-card__identity-code"
              >
                ${
                  symbol
                    ? `
                      <span
                        class="data-card__symbol"
                      >
                        ${escapeHtml(symbol)}
                      </span>
                    `
                    : ""
                }

                ${status}
              </span>
            `
            : ""
        }
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Generic Card Field
   ========================================================================== */

export function renderTradingCardField(
  label,
  value,
  { numeric = false, className = "" } = {},
) {
  const valueClasses = [
    "data-card__value",

    numeric ? "data-card__value--numeric" : "",

    className,
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div
      class="data-card__field"
    >
      <dt
        class="data-card__label"
      >
        ${escapeHtml(label || "")}
      </dt>

      <dd
        class="${escapeAttribute(valueClasses)}"
      >
        ${escapeHtml(value ?? "")}
      </dd>
    </div>
  `.trim();
}

/* ==========================================================================
   Generic Card Fields
   ========================================================================== */

export function renderTradingCardFields(fields = []) {
  if (!Array.isArray(fields)) {
    return "";
  }

  return fields
    .filter(Boolean)
    .map((field) =>
      renderTradingCardField(field.label, field.value, {
        numeric: Boolean(field.numeric),

        className: field.className || "",
      }),
    )
    .join("");
}

/* ==========================================================================
   Search Text
   ========================================================================== */

/*
 * Produces normalized searchable text without coupling individual Trading
 * views to every legacy company-field alias.
 */

export function getTradingSearchText(row, config = {}, additionalValues = []) {
  const values = [
    getCompanySymbol(row),

    getCompanyName(row, config),

    ...(Array.isArray(additionalValues)
      ? additionalValues
      : [additionalValues]),
  ];

  return values
    .filter(hasValue)
    .map((value) => String(value).trim().toLowerCase())
    .join(" ");
}

/* ==========================================================================
   Generic Row Search
   ========================================================================== */

export function matchesTradingSearch(
  row,
  searchValue,
  config = {},
  additionalValues = [],
) {
  const search = String(searchValue || "")
    .trim()
    .toLowerCase();

  if (!search) {
    return true;
  }

  return getTradingSearchText(row, config, additionalValues).includes(search);
}

/* ==========================================================================
   Safe Display Value
   ========================================================================== */

export function getDisplayValue(value, config = {}) {
  return hasValue(value) ? String(value) : config.labels?.notAvailable || "-";
}

/* ==========================================================================
   DataTables Display Guard
   ========================================================================== */

/*
 * DataTables calls render functions for:
 *
 * - display
 * - sort
 * - filter
 * - type
 *
 * HTML is returned only for display mode.
 */

export function isDisplayRender(type) {
  return type === undefined || type === null || type === "display";
}

/* ==========================================================================
   DataTables Text Renderer
   ========================================================================== */

export function renderDataTableText(value, type, config = {}) {
  if (!isDisplayRender(type)) {
    return hasValue(value) ? value : "";
  }

  return escapeHtml(getDisplayValue(value, config));
}

/* ==========================================================================
   DataTables Number Renderer
   ========================================================================== */

export function renderDataTableNumber(value, type, config = {}, options = {}) {
  if (!isDisplayRender(type)) {
    return toNumber(value, 0) ?? 0;
  }

  return renderTradingNumberCell(value, config, options);
}

/* ==========================================================================
   DataTables Money Renderer
   ========================================================================== */

export function renderDataTableMoney(value, type, config = {}) {
  if (!isDisplayRender(type)) {
    return toNumber(value, 0) ?? 0;
  }

  return renderTradingMoneyCell(value, config);
}

/* ==========================================================================
   DataTables Quantity Renderer
   ========================================================================== */

export function renderDataTableQuantity(value, type, config = {}) {
  if (!isDisplayRender(type)) {
    return toNumber(value, 0) ?? 0;
  }

  return renderTradingQuantityCell(value, config);
}

/* ==========================================================================
   DataTables Percentage Renderer
   ========================================================================== */

export function renderDataTablePercentage(
  value,
  type,
  config = {},
  options = {},
) {
  if (!isDisplayRender(type)) {
    return toNumber(value, 0) ?? 0;
  }

  return renderTradingPercentageCell(value, config, options);
}

/* ==========================================================================
   DataTables Date Renderer
   ========================================================================== */

export function renderDataTableDate(value, type, config = {}) {
  if (!isDisplayRender(type)) {
    const date = parseDateValue(value);

    return date ? date.getTime() : hasValue(value) ? String(value) : "";
  }

  return renderTradingDateCell(value, config);
}

/* ==========================================================================
   Compatibility Aliases
   ========================================================================== */

/*
 * Keep these aliases while the Trading tabs are migrated one at a time.
 *
 * Remove them only after every individual tab imports the canonical
 * formatter names.
 */

export const renderNegotiatedRow = renderNegotiatedDesktopRow;

export const renderMinimumSizeRow = renderMinimumSizeDesktopRow;

export const renderAccumulatedRow = renderAccumulatedDesktopRow;

export const renderListedTradableRow = renderListedTradableDesktopRow;

export const renderSuspendedRow = renderSuspendedDesktopRow;

export const renderDelistedRow = renderDelistedDesktopRow;

export const renderOtcRow = renderOtcDesktopRow;
