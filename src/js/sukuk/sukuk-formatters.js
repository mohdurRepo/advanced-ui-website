/* ==========================================================================
   Sukuk Formatters
   ========================================================================== */

/*
 * Sukuk & Bonds presentation helpers.
 *
 * Responsibilities:
 *
 * - escaping
 * - backend field aliases
 * - number formatting
 * - instrument identity
 * - instrument links
 * - favorite-button rendering
 * - coupon-type formatting
 * - maturity / perpetual-bond formatting
 * - coupon-frequency formatting
 * - day-count-convention formatting
 * - desktop instrument-cell rendering
 * - mobile identity / price rendering
 *
 * This module intentionally has no:
 *
 * - AJAX code
 * - DataTables lifecycle
 * - filter state
 * - column visibility state
 * - breakpoint logic
 * - event listeners
 */

/* ==========================================================================
   Generic Helpers
   ========================================================================== */

export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
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

function isSafeHref(value) {
  const href = String(value || "").trim();

  if (!href) {
    return false;
  }

  return !/^(?:javascript|data|vbscript):/i.test(href);
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

export function getDisplayValue(value, fallback = "-") {
  return hasValue(value) ? String(value).trim() : fallback;
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

/* ==========================================================================
   Number Formatting
   ========================================================================== */

export function formatDecimal(value, decimals) {
  const number = toNumber(value);

  if (number === null) {
    return getDisplayValue(value);
  }

  return number.toFixed(decimals);
}

export function formatYield(value) {
  return formatDecimal(value, 4);
}

export function formatPrice(value) {
  return formatDecimal(value, 2);
}

export function formatQuantity(value, config = {}) {
  const displayValue = getDisplayValue(value);

  if (displayValue === "-") {
    return displayValue;
  }

  /*
   * Preserve backend-provided abbreviated values such as:
   *
   * 7.84M
   * 900K
   */
  if (/[a-z]/i.test(displayValue)) {
    return displayValue;
  }

  const number = toNumber(value);

  if (number === null) {
    return displayValue;
  }

  try {
    return new Intl.NumberFormat(
      config.locale || document.documentElement.lang || "en",
      {
        maximumFractionDigits: 20,
      },
    ).format(number);
  } catch {
    return displayValue;
  }
}

/* ==========================================================================
   Instrument Identity
   ========================================================================== */

export function getInstrumentCode(row = {}) {
  return String(
    getFirstValue(
      row,
      [
        "symbol",
        "tadawulCode",
        "tadawulCodeModified",
        "tadawulcode",
        "code",
        "companyRef",
        "securityCode",
      ],
      "-",
    ),
  ).trim();
}

export function getInstrumentName(row = {}) {
  return String(
    getFirstValue(
      row,
      [
        "issuerName",
        "issuerNameModified",
        "name",
        "instrumentName",
        "securityName",
      ],
      "-",
    ),
  ).trim();
}

export function getInstrumentUrl(row = {}) {
  const value = getFirstValue(
    row,
    ["cUrl", "companyUrl", "detailsUrl", "url"],
    "",
  );

  if (!isSafeHref(value)) {
    return "";
  }

  return String(value).trim();
}

export function getInstrumentReference(row = {}) {
  const reference = getInstrumentCode(row);

  return reference === "-" ? "" : reference;
}

/* ==========================================================================
   Watchlist State
   ========================================================================== */

function isFavoriteActive(value) {
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

function getWatchlistValue(row = {}) {
  return getFirstValue(
    row,
    ["watchlist", "watchList", "watchListId", "isWatchlisted", "watchlisted"],
    null,
  );
}

/* ==========================================================================
   Favorite Button
   ========================================================================== */

export function renderFavoriteButton(row = {}, options = {}) {
  const active = isFavoriteActive(getWatchlistValue(row));

  const instrumentRef = getInstrumentReference(row);

  const instrumentName = getInstrumentName(row);

  const className = options.className || "table-market__favorite";

  const iconClass = active ? "icon-star-filled" : "icon-star-outline";

  const label = active
    ? `Remove ${instrumentName} from watchlist`
    : `Add ${instrumentName} to watchlist`;

  return `
    <button
      type="button"
      class="${escapeHtml(className)}"
      data-sukuk-favorite
      data-instrument-ref="${escapeHtml(instrumentRef)}"
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
   Desktop Instrument Text
   ========================================================================== */

/*
 * Keep the exact visual hierarchy requested:
 *
 * CODE
 * Name
 *
 * We deliberately use the same table-market classes as Market Watch so the
 * design system can provide the same typography and spacing.
 */

function renderInstrumentText(row = {}) {
  const code = getInstrumentCode(row);

  const name = getInstrumentName(row);

  const url = getInstrumentUrl(row);

  const content = `
    <span
      class="table-market__symbol"
    >
      ${escapeHtml(code)}
    </span>

    <span
      class="table-market__name"
    >
      ${escapeHtml(name)}
    </span>
  `.trim();

  if (!url) {
    return `
      <span
        class="table-market__security-link"
      >
        ${content}
      </span>
    `.trim();
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
   Desktop Instrument Cell
   ========================================================================== */

/*
 * Match Market Watch's first-column structure:
 *
 * favorite
 * identity
 *
 * There is no separate Watchlist table column.
 */

export function renderInstrument(row = {}) {
  return `
    <div
      class="table-market__security-cell"
    >
      ${renderFavoriteButton(row)}

      ${renderInstrumentText(row)}
    </div>
  `.trim();
}

/* ==========================================================================
   Date Formatting
   ========================================================================== */

export function formatDateIso(value) {
  if (!hasValue(value)) {
    return "-";
  }

  const text = String(value).trim();

  /*
   * Preserve backend ISO dates without timezone conversion.
   */
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* ==========================================================================
   Boolean Values
   ========================================================================== */

export function isTrueLike(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "y"
  );
}

/* ==========================================================================
   Business Labels
   ========================================================================== */

function getValueLabels(config = {}) {
  return config.labels?.values || {};
}

/* ==========================================================================
   Coupon Type
   ========================================================================== */

export function formatCouponType(value, config = {}) {
  const labels = getValueLabels(config);

  switch (String(value ?? "")) {
    case "4":
      return labels.floating || "Floating";

    case "1":
      return labels.fixed || "Fixed";

    default:
      return "-";
  }
}

/* ==========================================================================
   Maturity
   ========================================================================== */

export function formatMaturity(row, config = {}) {
  const labels = getValueLabels(config);

  if (isTrueLike(row?.isPerpetualBond)) {
    return labels.perpetualBond || "Perpetual Bond";
  }

  return formatDateIso(
    getFirstValue(row, ["maturityDate", "maturityDateStr"], ""),
  );
}

/* ==========================================================================
   Coupon Frequency
   ========================================================================== */

export function formatCouponFrequency(value, config = {}) {
  const labels = getValueLabels(config);

  const map = {
    1: labels.couponFrequency1 || "Annual",

    2: labels.couponFrequency2 || "Semi-Annual",

    4: labels.couponFrequency4 || "Quarterly",

    12: labels.couponFrequency12 || "Monthly",

    0: labels.couponFrequency0 || "-",
  };

  return map[String(value ?? "")] || map["0"];
}

/* ==========================================================================
   Day Count Convention
   ========================================================================== */

export function formatDayCountConvention(value, config = {}) {
  const labels = getValueLabels(config);

  const map = {
    7: labels.dayCount7 || "Convention 7",

    2: labels.dayCount2 || "Convention 2",

    3: labels.dayCount3 || "Convention 3",

    0: labels.dayCount0 || "-",
  };

  return map[String(value ?? "")] || map["0"];
}

/* ==========================================================================
   Schema Value Resolution
   ========================================================================== */

export function getColumnValue(row, column, fallback = "") {
  if (!column || typeof column !== "object") {
    return fallback;
  }

  const keys = [];

  if (column.data) {
    keys.push(column.data);
  }

  if (Array.isArray(column.fallbackData)) {
    keys.push(...column.fallbackData);
  }

  return getFirstValue(row, keys, fallback);
}

/* ==========================================================================
   Last Price
   ========================================================================== */

export function getLastPrice(row = {}) {
  return getFirstValue(
    row,
    [
      "lastTradePrice",
      "lastTradePriceModified",
      "bidPrice",
      "bidPriceModified",
      "askPrice",
      "askPriceModified",
    ],
    null,
  );
}

/* ==========================================================================
   Mobile Identity
   ========================================================================== */

/*
 * Match Market Watch's mobile identity structure:
 *
 * ★  CODE
 *    Name
 *
 * Favorite stays at the start of the card.
 * Code begins the text block.
 * Name sits directly below it.
 */

export function renderMobileIdentity(row = {}) {
  const code = getInstrumentCode(row);

  const name = getInstrumentName(row);

  const url = getInstrumentUrl(row);

  const identityContent = `
    <div
      class="data-card__identity-content"
    >
      <span
        class="data-card__symbol"
      >
        ${escapeHtml(code)}
      </span>

      <h3
        class="data-card__title"
      >
        ${escapeHtml(name)}
      </h3>
    </div>
  `.trim();

  const linkedIdentity = url
    ? `
        <a
          class="data-card__security-link"
          href="${escapeHtml(url)}"
        >
          ${identityContent}
        </a>
      `.trim()
    : identityContent;

  return `
    <div
      class="data-card__identity"
    >
      ${renderFavoriteButton(row, {
        className: "data-card__favorite",
      })}

      ${linkedIdentity}
    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Price
   ========================================================================== */

export function renderMobilePrice(row = {}) {
  const price = formatPrice(getLastPrice(row));

  return `
    <div
      class="data-card__quote"
    >
      <span
        class="data-card__price"
      >
        ${escapeHtml(price)}
      </span>
    </div>
  `.trim();
}
