/* ==========================================================================
   Sukuk Formatters
   ========================================================================== */

/*
 * Sukuk & Bonds presentation and business-value formatters.
 *
 * Responsibilities:
 *
 * - safe HTML escaping
 * - backend field aliases
 * - instrument identity
 * - instrument links
 * - date formatting
 * - number / price / yield formatting
 * - coupon-type labels
 * - maturity / perpetual-bond labels
 * - coupon-frequency labels
 * - day-count-convention labels
 * - watchlist presentation
 * - mobile summary rendering
 *
 * This module intentionally has no:
 *
 * - DataTables lifecycle
 * - card collection rendering
 * - AJAX code
 * - filter state
 * - column visibility state
 */

/* ==========================================================================
   Generic Helpers
   ========================================================================== */

export function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
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
  return hasValue(value) ? String(value) : fallback;
}

/* ==========================================================================
   Number Helpers
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

export function formatDecimal(value, decimals) {
  const number = toNumber(value);

  if (number === null) {
    return "-";
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
  if (!hasValue(value)) {
    return "-";
  }

  const number = toNumber(value);

  if (number === null) {
    return String(value);
  }

  try {
    return new Intl.NumberFormat(config.locale || undefined, {
      maximumFractionDigits: 20,
    }).format(number);
  } catch {
    return String(value);
  }
}

/* ==========================================================================
   Instrument
   ========================================================================== */

export function getInstrumentCode(row) {
  return getFirstValue(
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
  );
}

export function getInstrumentName(row) {
  return getFirstValue(
    row,
    [
      "issuerName",
      "issuerNameModified",
      "name",
      "instrumentName",
      "securityName",
    ],
    "-",
  );
}

export function getInstrumentUrl(row) {
  return getFirstValue(row, ["cUrl", "companyUrl", "detailsUrl", "url"], "");
}

export function getInstrumentReference(row) {
  const reference = getInstrumentCode(row);

  return reference === "-" ? "" : String(reference);
}

/* ==========================================================================
   Instrument Rendering
   ========================================================================== */

function renderInstrumentContent(row) {
  const name = escapeHtml(getInstrumentName(row));

  const code = escapeHtml(getInstrumentCode(row));

  return `
    <span class="table-market__security-name">
      ${name}
    </span>

    <span class="table-market__security-code">
      ${code}
    </span>
  `.trim();
}

export function renderInstrument(row) {
  const url = getInstrumentUrl(row);

  const content = renderInstrumentContent(row);

  if (!url || url === "#") {
    return `
      <div class="table-market__security-identity">
        ${content}
      </div>
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
   Date
   ========================================================================== */

export function formatDateIso(value) {
  if (!hasValue(value)) {
    return "-";
  }

  const text = String(value).trim();

  /*
   * Preserve an already ISO-like date without timezone conversion.
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

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();

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

/*
 * Resolve the configured primary field and any declared fallback fields.
 *
 * This keeps backend alias handling declarative inside sukuk-schema.js.
 */

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
   Watchlist
   ========================================================================== */

export function getWatchlistValue(row) {
  return getFirstValue(
    row,
    ["watchlist", "watchList", "watchListId", "isWatchlisted", "watchlisted"],
    null,
  );
}

export function isWatchlisted(row) {
  return isTrueLike(getWatchlistValue(row));
}

export function renderWatchlist(row) {
  const instrumentRef = getInstrumentReference(row);

  const active = isWatchlisted(row);

  const label = active ? "In Your Watchlist" : "Add to Watchlist";

  const icon = active ? "icon-star-filled" : "icon-star";

  /*
   * No inline onclick.
   *
   * sukuk.js will delegate this action and call the site's existing
   * showAddToWatchListPopup() integration.
   */

  return `
    <button
      type="button"
      class="btn-icon table-market__favorite"
      aria-label="${escapeHtml(label)}"
      aria-pressed="${String(active)}"
      data-sukuk-favorite
      data-instrument-ref="${escapeHtml(instrumentRef)}"
    >
      <span
        class="has-icon ${icon}"
        aria-hidden="true"
      ></span>
    </button>
  `.trim();
}

/* ==========================================================================
   Mobile Summary Values
   ========================================================================== */

export function getLastPrice(row) {
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

export function renderMobileIdentity(row) {
  const code = getInstrumentCode(row);

  const name = getInstrumentName(row);

  const url = getInstrumentUrl(row);

  const content = `
    <div class="data-card__identity-text">
      <strong class="data-card__symbol">
        ${escapeHtml(code)}
      </strong>

      <span class="data-card__name">
        ${escapeHtml(name)}
      </span>
    </div>
  `.trim();

  if (!url || url === "#") {
    return `
      <div class="data-card__identity">
        ${content}
      </div>
    `.trim();
  }

  return `
    <div class="data-card__identity">
      <a
        class="data-card__identity-link"
        href="${escapeHtml(url)}"
      >
        ${content}
      </a>
    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Price Summary
   ========================================================================== */

export function renderMobilePrice(row) {
  const price = formatPrice(getLastPrice(row));

  return `
    <div class="data-card__quote">
      <span class="data-card__price">
        ${escapeHtml(price)}
      </span>
    </div>
  `.trim();
}
