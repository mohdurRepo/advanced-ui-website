/* ==========================================================================
   Market Watch Formatters
   ========================================================================== */

/*
 * Shared formatting and safe component markup for:
 *
 * - DataTables desktop cells
 * - mobile cards
 *
 * No API requests, event binding, or DataTables initialization belongs here.
 */

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.+-]/g, "")
    .trim();

  if (!normalized || normalized === "+" || normalized === "-") {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function displayValue(value, fallback = "-") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

function isEnabled(value) {
  return [true, 1, "1", "true", "TRUE", "yes", "YES", "y", "Y"].includes(value);
}

function safeUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value, window.location.origin);

    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function joinUrl(baseUrl, path) {
  if (!baseUrl || !path) {
    return "";
  }

  return `${String(baseUrl).replace(/\/+$/, "")}/${String(path).replace(
    /^\/+/,
    "",
  )}`;
}

function getCompanyReference(row) {
  return (
    row.companyRef || row.companyCode || row.companySymbol || row.symbol || ""
  );
}

function getCompanyName(row) {
  return row.acrynomName || row.company || row.name || "-";
}

function getCompanySymbol(row) {
  return row.companySymbol || row.symbol || "";
}

function getCompanyUrl(row) {
  return row.companyUrl || row.companyURL || "";
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createMarketWatchFormatters(config = {}) {
  const locale = config.locale || document.documentElement.lang || "en";
  const labels = config.labels || {};
  const isAuction = Boolean(config.market?.isAuction);

  /*
   * Configure in the JSP:
   *
   * assets: {
   *   companyLogoBaseUrl: "https://example.example.com"
   * }
   */

  const companyLogoBaseUrl = config.assets?.companyLogoBaseUrl || "";

  const fullNumberFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  });

  function isAuctionZero(value) {
    return isAuction && toNumber(value) === 0;
  }

  function formatText(value) {
    return escapeHtml(displayValue(value));
  }

  function formatPrice(value) {
    return escapeHtml(isAuctionZero(value) ? "-" : displayValue(value));
  }

  /*
   * Preserves API-provided compact values such as `7.84M`.
   */

  function formatQuantity(value) {
    return escapeHtml(isAuctionZero(value) ? "-" : displayValue(value));
  }

  /*
   * Used for cumulative volume, number of trades, bid/offer volume,
   * market cap, and other values that must display their full precision.
   *
   * Example: 12123209 -> 12,123,209
   */

  function formatFullNumber(value) {
    if (isAuctionZero(value)) {
      return "-";
    }

    const number = toNumber(value);

    return number === null
      ? escapeHtml(displayValue(value))
      : fullNumberFormatter.format(number);
  }

  function formatMarketOrderOrPrice(value) {
    if (isAuctionZero(value)) {
      return escapeHtml(labels.marketOrder || "MO");
    }

    return escapeHtml(displayValue(value));
  }

  function getChangeState(value) {
    const number = toNumber(value);

    if (number > 0) {
      return "positive";
    }

    if (number < 0) {
      return "negative";
    }

    return "neutral";
  }

  function formatChange(display, numericValue, suffix = "") {
    if (isAuctionZero(numericValue)) {
      return '<span class="market-neutral">-</span>';
    }

    const text = displayValue(display);
    const value = suffix && !text.endsWith(suffix) ? `${text}${suffix}` : text;

    return `
      <span class="market-change market-${getChangeState(numericValue)}">
        ${escapeHtml(value)}
      </span>
    `.trim();
  }

  /* ==========================================================================
     Company Identity
     ========================================================================== */

  function getCompanyStatus(row) {
    const status = Number(row.companyStatus);
    const statusLabels = labels.status || {};

    if (status === 1) {
      return {
        className: "market-company-status--primary ylwSymbol",
        label: statusLabels.losses20To35 || "",
      };
    }

    if (status === 2) {
      return {
        className: "market-company-status--warning orgSymbol",
        label: statusLabels.losses35To50 || "",
      };
    }

    if (status === 3) {
      return {
        className: "market-company-status--danger redSymbol",
        label: statusLabels.losses50More || "",
      };
    }

    return null;
  }

  function getCompanyLogoUrl(row) {
    /*
     * The direct API image URL has priority. Otherwise build:
     *
     * https://example.example.com/{companyCode}.png
     */

    const directUrl = row.companyLogo || row.logoUrl || row.logo;

    if (safeUrl(directUrl)) {
      return safeUrl(directUrl);
    }

    const code = row.companyCode || getCompanyReference(row);

    return safeUrl(
      joinUrl(companyLogoBaseUrl, `${encodeURIComponent(code)}.png`),
    );
  }

  function renderFavorite(row) {
    const reference = getCompanyReference(row);
    const active = isEnabled(row.watchlist);
    const label = active
      ? labels.removeFromWatchlist || "Remove from watchlist"
      : labels.addToWatchlist || "Add to watchlist";

    return `
      <button
        class="table-market__favorite has-icon icon-star"
        type="button"
        aria-pressed="${active}"
        aria-label="${escapeHtml(label)}"
        data-market-watch-favorite
        data-market-watch-security="${escapeHtml(reference)}"
      ></button>
    `.trim();
  }

  function renderCompanyStatus(row) {
    const status = getCompanyStatus(row);

    if (!status) {
      return "";
    }

    return `
      <span
        class="market-company-status ${status.className}"
        title="${escapeHtml(status.label)}"
        aria-label="${escapeHtml(status.label)}"
      ></span>
    `.trim();
  }

  function renderSecurity(row) {
    const reference = getCompanyReference(row);
    const name = getCompanyName(row);
    const symbol = getCompanySymbol(row);
    const companyUrl = safeUrl(getCompanyUrl(row)) || "#";
    const logoUrl = getCompanyLogoUrl(row);

    const logo = logoUrl
      ? `
          <span class="table-market__logo">
            <img src="${escapeHtml(logoUrl)}" alt="" />
          </span>
        `
      : `
          <span class="table-market__logo" aria-hidden="true">
            ${escapeHtml(symbol.slice(0, 2))}
          </span>
        `;

    return `
      <div class="table-market__security-cell">
        ${renderFavorite(row)}

        ${logo}

        <a
          class="table-market__security-link"
          href="${escapeHtml(companyUrl)}"
          data-market-watch-security-link="${escapeHtml(reference)}"
        >
          <span class="table-market__name">
            ${escapeHtml(name)}
            ${renderCompanyStatus(row)}
          </span>

          ${
            symbol
              ? `<span class="table-market__symbol">${escapeHtml(symbol)}</span>`
              : ""
          }
        </a>
      </div>
    `.trim();
  }

  /* ==========================================================================
     52-Week Range
     ========================================================================== */

  function getRangePosition(low, high, value) {
    const lowNumber = toNumber(low);
    const highNumber = toNumber(high);
    const valueNumber = toNumber(value);

    if (
      lowNumber === null ||
      highNumber === null ||
      valueNumber === null ||
      highNumber <= lowNumber ||
      isAuctionZero(value)
    ) {
      return null;
    }

    const position =
      ((valueNumber - lowNumber) / (highNumber - lowNumber)) * 100;

    return Math.min(100, Math.max(0, position));
  }

  function renderRange(row) {
    const low = row.low52WeekPrice;
    const high = row.high52WeekPrice;
    const value = row.lastTradePriceModified;
    const position = getRangePosition(low, high, value);

    const style =
      position === null
        ? ""
        : ` style="--range-position: ${position.toFixed(2)}%"`;

    return `
      <div
        class="table-market__range"
        data-range-has-value="${position !== null}"
        ${style}
      >
        <div
          class="table-market__range-track"
          data-range-value="${escapeHtml(displayValue(value))}"
          aria-label="${escapeHtml(
            `52 week range: ${displayValue(low)} to ${displayValue(high)}`,
          )}"
        >
          <span class="table-market__range-fill" aria-hidden="true"></span>

          ${
            position === null
              ? ""
              : `
                  <span
                    class="table-market__range-marker"
                    aria-hidden="true"
                  ></span>
                `
          }
        </div>

        <div class="table-market__range-values" aria-hidden="true">
          <span>${escapeHtml(displayValue(low))}</span>
          <span>${escapeHtml(displayValue(high))}</span>
        </div>
      </div>
    `.trim();
  }

  /* ==========================================================================
     Cell Renderer
     ========================================================================== */

  function renderCell(column, row) {
    const value = column.data ? row[column.data] : null;

    switch (column.format) {
      case "security":
        return renderSecurity(row);

      case "range":
        return renderRange(row);

      case "price":
        return formatPrice(value);

      case "quantity":
        return formatQuantity(value);

      case "full-number":
        return formatFullNumber(value);

      case "market-order-or-price":
        return formatMarketOrderOrPrice(value);

      case "change":
        return formatChange(
          value,
          row[column.changeField],
          column.suffix || "",
        );

      case "text":
      default:
        return formatText(value);
    }
  }

  return Object.freeze({
    locale,

    escapeHtml,
    toNumber,
    displayValue,
    isEnabled,

    formatText,
    formatPrice,
    formatQuantity,
    formatFullNumber,
    formatMarketOrderOrPrice,
    formatChange,

    renderFavorite,
    renderSecurity,
    renderRange,
    renderCell,
  });
}
