/* ==========================================================================
   Market Watch Formatters
   ========================================================================== */

/*
 * Shared display formatting for desktop and mobile.
 *
 * This module:
 * - safely escapes API content
 * - renders company, favourite, range, and market values
 * - preserves auction handling
 *
 * It does not:
 * - fetch data
 * - bind events
 * - call login popups
 * - initialize DataTables
 */

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(String(value).replace(/,/g, "").trim());

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

function safeUrl(value) {
  if (!value) {
    return "#";
  }

  try {
    const url = new URL(value, window.location.origin);

    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function displayValue(value, fallback = "-") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

function isEnabled(value) {
  return [true, 1, "1", "true", "TRUE", "yes", "YES", "y", "Y"].includes(value);
}

function getCompanyReference(row) {
  return row.companyRef || row.companySymbol || row.symbol || "";
}

function getCompanyName(row) {
  return row.acrynomName || row.company || row.name || "-";
}

function getCompanyUrl(row) {
  return row.companyUrl || row.companyURL || "#";
}

function getCompanyStatus(row, labels) {
  const status = Number(row.companyStatus);

  if (status === 1) {
    return {
      className: "market-company-status--primary",
      label: labels.losses20To35 || "",
    };
  }

  if (status === 2) {
    return {
      className: "market-company-status--warning",
      label: labels.losses35To50 || "",
    };
  }

  if (status === 3) {
    return {
      className: "market-company-status--danger",
      label: labels.losses50More || "",
    };
  }

  return null;
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createMarketWatchFormatters(config = {}) {
  const locale = config.locale || document.documentElement.lang || "en";
  const labels = config.labels || {};
  const isAuction = Boolean(config.market?.isAuction);
  const marketOrderLabel = labels.marketOrder || "MO";

  function isAuctionZero(value) {
    return isAuction && toNumber(value) === 0;
  }

  function formatText(value) {
    return escapeHtml(displayValue(value));
  }

  function formatPrice(value) {
    return escapeHtml(isAuctionZero(value) ? "-" : displayValue(value));
  }

  function formatQuantity(value) {
    return escapeHtml(isAuctionZero(value) ? "-" : displayValue(value));
  }

  function formatMarketOrderOrPrice(value) {
    if (isAuctionZero(value)) {
      return escapeHtml(marketOrderLabel);
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

    const state = getChangeState(numericValue);
    const value = `${displayValue(display)}${suffix}`;

    return `
      <span class="market-change market-${state}">
        ${escapeHtml(value)}
      </span>
    `.trim();
  }

  function renderFavorite(row) {
    const reference = getCompanyReference(row);
    const active = isEnabled(row.watchlist);
    const label = active ? "Remove from watchlist" : "Add to watchlist";

    return `
      <button
        class="table-market__favorite has-icon icon-star"
        type="button"
        aria-pressed="${active}"
        aria-label="${label}"
        data-market-watch-favorite
        data-market-watch-security="${escapeHtml(reference)}"
      ></button>
    `.trim();
  }

  function renderCompanyStatus(row) {
    const status = getCompanyStatus(row, labels.status || {});

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
    const symbol = row.companySymbol || row.symbol || "";
    const logo = row.companyLogo || row.logoUrl || row.logo || "";
    const url = safeUrl(getCompanyUrl(row));

    const logoMarkup = logo
      ? `
          <span class="table-market__logo">
            <img src="${escapeHtml(logo)}" alt="" />
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

        ${logoMarkup}

        <a
          class="table-market__security-link"
          href="${escapeHtml(url)}"
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

  function getRangePosition(low, high, value) {
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

    const percentage =
      ((valueNumber - lowNumber) / (highNumber - lowNumber)) * 100;

    return Math.min(100, Math.max(0, percentage));
  }

  function renderRange(row) {
    const low = row.low52WeekPrice;
    const high = row.high52WeekPrice;
    const value = row.lastTradePriceModified;
    const position = getRangePosition(low, high, value);

    const marker =
      position === null
        ? ""
        : `
          <span
            class="table-market__range-marker"
            aria-hidden="true"
          ></span>
        `;

    return `
      <div
        class="table-market__range"
        ${
          position === null
            ? ""
            : `style="--range-position: ${position.toFixed(2)}%"`
        }
      >
        <div
          class="table-market__range-track"
          data-range-value="${escapeHtml(displayValue(value))}"
          aria-label="${escapeHtml(
            `52 week range: ${displayValue(low)} to ${displayValue(high)}`,
          )}"
        >
          ${marker}
        </div>

        <div class="table-market__range-values" aria-hidden="true">
          <span>${escapeHtml(displayValue(low))}</span>
          <span>${escapeHtml(displayValue(high))}</span>
        </div>
      </div>
    `.trim();
  }

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
      case "plain-number":
        return formatQuantity(value);

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
    formatMarketOrderOrPrice,
    formatChange,
    renderFavorite,
    renderSecurity,
    renderRange,
    renderCell,
  });
}
