/* ==========================================================================
   Market Watch Mobile
   ========================================================================== */

import { getMobileColumns } from "./market-watch-schema.js";

import {
  escapeHtml,
  formatAuctionQuantity,
  formatAuctionValue,
  formatFullNumber,
  formatMarketOrder,
  getChangeClass,
  getCompanyName,
  getCompanyReference,
  getDisplayValue,
  isZeroLike,
  renderChange,
  renderMobileIdentity,
  renderRange,
} from "./market-watch-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const SELECTORS = {
  view: "[data-market-watch-mobile]",
  cards: "[data-market-watch-mobile-cards]",
  toggle: "[data-data-card-toggle]",
  favorite: "[data-market-watch-favorite]",
  logo: "[data-market-watch-logo]",
};

const STATES = {
  loading: "loading",
  empty: "empty",
  error: "error",
};

/* ==========================================================================
   Helpers
   ========================================================================== */

function cleanLabel(value, fallback = "") {
  return String(value ?? fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAuction(config = {}) {
  return Boolean(config.market?.isAuction ?? config.openCloseAuction);
}

function getCellValue(row, column) {
  return column.data ? row?.[column.data] : "";
}

function getNumericValue(row, column) {
  return column.numericData
    ? row?.[column.numericData]
    : getCellValue(row, column);
}

function renderAuctionFullNumber(value, config) {
  if (isAuction(config) && isZeroLike(value)) {
    return "-";
  }

  return formatFullNumber(value, config);
}

function renderMobileFieldValue(column, row, config) {
  const value = getCellValue(row, column);

  switch (column.type) {
    case "range":
      return renderRange(row, config);

    case "auction-value":
      return escapeHtml(formatAuctionValue(value, config));

    case "auction-quantity":
      return escapeHtml(formatAuctionQuantity(value, config));

    case "auction-full-number":
      return escapeHtml(renderAuctionFullNumber(value, config));

    case "full-number":
      return escapeHtml(formatFullNumber(value, config));

    case "market-order":
      return escapeHtml(formatMarketOrder(value, config));

    case "change":
      return renderChange(value, getNumericValue(row, column));

    case "percent-change":
      return renderChange(value, getNumericValue(row, column), {
        percent: true,
      });

    case "text":
    default:
      return escapeHtml(getDisplayValue(value));
  }
}

function getMobileFieldLabel(column, config) {
  const labels = config.labels?.table || {};
  const fieldLabel = cleanLabel(
    column.mobileLabel || column.label,
    column.label,
  );

  if (column.headerGroup === "best-bid") {
    return `${cleanLabel(labels.bestBid, "Best Bid")} ${fieldLabel}`;
  }

  if (column.headerGroup === "best-offer") {
    return `${cleanLabel(labels.bestOffer, "Best Offer")} ${fieldLabel}`;
  }

  return fieldLabel;
}

function getDetailColumns(config, view, visibleGroups) {
  /*
   * Price and percentage change are already part of every card’s summary.
   * Details intentionally avoid repeating those values.
   */

  const summaryColumns = new Set(["last-trade-price", "change-percent"]);

  return getMobileColumns(config, view, visibleGroups).filter((column) => {
    return !summaryColumns.has(column.key);
  });
}

function groupRowsBySector(rows) {
  return rows.reduce((groups, row) => {
    const sectorName = row.sectorName || "Other";

    if (!groups.has(sectorName)) {
      groups.set(sectorName, []);
    }

    groups.get(sectorName).push(row);

    return groups;
  }, new Map());
}

function createLoadingCards() {
  return Array.from({ length: 4 }, () =>
    `
      <article class="data-card data-card--loading" aria-hidden="true">
        <div class="data-card__main">
          <div class="data-card__identity">
            <span class="table-skeleton table-skeleton-sm"></span>
            <span class="table-skeleton table-skeleton-md"></span>
          </div>

          <div class="data-card__quote">
            <span class="table-skeleton table-skeleton-sm"></span>
          </div>
        </div>
      </article>
    `.trim(),
  ).join("");
}

function getToggleLabels(config, companyName) {
  const labels = config.labels?.mobile || {};

  const show = cleanLabel(labels.showDetails, "Show details");
  const hide = cleanLabel(labels.hideDetails, "Hide details");

  return {
    show: `${show} ${companyName}`,
    hide: `${hide} ${companyName}`,
  };
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketWatchMobile(config = {}, root = document) {
  const view = root.querySelector(SELECTORS.view);
  const cards = root.querySelector(SELECTORS.cards);

  if (!view || !cards) {
    throw new Error(
      "Market Watch mobile view requires [data-market-watch-mobile] and [data-market-watch-mobile-cards].",
    );
  }

  let rows = [];
  let currentView = String(config.initialState?.tableView || "1");
  let visibleGroups = [...(config.initialState?.visibleGroups || [])];
  let renderState = null;
  let destroyed = false;

  function getDetailsId(row, index) {
    const reference = getCompanyReference(row) || `company-${index}`;
    const safeReference = reference.replace(/[^a-z0-9_-]/gi, "-");

    return `market-watch-card-details-${safeReference}-${index}`;
  }

  function renderField(column, row) {
    const isRange = column.type === "range";

    return `
      <div class="data-card__field ${isRange ? "data-card__field--full" : ""}">
        <dt class="data-card__label">
          ${escapeHtml(getMobileFieldLabel(column, config))}
        </dt>

        <dd
          class="data-card__value ${isRange ? "" : "data-card__value--numeric"}"
        >
          ${renderMobileFieldValue(column, row, config)}
        </dd>
      </div>
    `.trim();
  }

  function renderCard(row, index) {
    const detailId = getDetailsId(row, index);
    const companyName = getCompanyName(row);
    const toggleLabels = getToggleLabels(config, companyName);

    const price = formatAuctionValue(row.lastTradePriceModified, config);

    const changeClass = getChangeClass(
      row.precentChange ?? row.percentChange ?? row.netChange,
    );

    const changeValue = renderChange(
      row.netChangeModified,
      row.netChange ?? row.changeValue ?? row.netChangeModified,
    );

    const percentValue = renderChange(
      row.precentChangeModified,
      row.precentChange ?? row.percentChange ?? row.precentChangeModified,
      {
        percent: true,
      },
    );

    const fields = getDetailColumns(config, currentView, visibleGroups);

    return `
      <article class="data-card" data-data-card>
        <div class="data-card__main">
          ${renderMobileIdentity(row, config)}

          <div class="data-card__quote">
            <span class="data-card__price">
              ${escapeHtml(price)}
            </span>

            <span class="data-card__change ${changeClass}">
              ${changeValue}
              ${percentValue}
            </span>
          </div>
        </div>

        <div
          class="data-card__details"
          id="${escapeHtml(detailId)}"
          data-data-card-details
          hidden
        >
          <dl class="data-card__fields">
            ${fields.map((column) => renderField(column, row)).join("")}
          </dl>
        </div>

        <button
          type="button"
          class="data-card__toggle"
          aria-expanded="false"
          aria-controls="${escapeHtml(detailId)}"
          data-data-card-toggle
        >
          <span
            class="data-card__toggle-label"
            data-data-card-toggle-label
            data-more-label="${escapeHtml(toggleLabels.show)}"
            data-less-label="${escapeHtml(toggleLabels.hide)}"
          >
            ${escapeHtml(toggleLabels.show)}
          </span>

          <span
            class="has-icon icon-chevron-down"
            aria-hidden="true"
          ></span>
        </button>
      </article>
    `.trim();
  }

  function renderRows() {
    const isLoading = renderState?.type === STATES.loading;

    cards.setAttribute("aria-busy", String(isLoading));

    if (isLoading) {
      cards.innerHTML = createLoadingCards();

      return;
    }

    if (
      renderState?.type === STATES.empty ||
      renderState?.type === STATES.error
    ) {
      cards.innerHTML = `
        <div class="data-card__empty">
          ${escapeHtml(renderState.message)}
        </div>
      `.trim();

      return;
    }

    if (!rows.length) {
      cards.innerHTML = `
        <div class="data-card__empty">
          ${escapeHtml(config.labels?.noData || "No data available")}
        </div>
      `.trim();

      return;
    }

    const sectorGroups = groupRowsBySector(rows);
    let cardIndex = 0;

    cards.innerHTML = [...sectorGroups.entries()]
      .map(([sectorName, sectorRows], groupIndex) => {
        const groupId = `market-watch-sector-${groupIndex}`;

        const items = sectorRows
          .map((row) => {
            const card = renderCard(row, cardIndex);

            cardIndex += 1;

            return card;
          })
          .join("");

        return `
          <section
            class="data-card-group"
            aria-labelledby="${groupId}"
          >
            <h3
              class="data-card-group__title"
              id="${groupId}"
            >
              ${escapeHtml(sectorName)}
            </h3>

            <div class="data-card-group__items">
              ${items}
            </div>
          </section>
        `.trim();
      })
      .join("");
  }

  function collapseOtherCards(activeCard) {
    cards.querySelectorAll("[data-data-card]").forEach((card) => {
      if (card === activeCard) {
        return;
      }

      const details = card.querySelector("[data-data-card-details]");
      const toggle = card.querySelector(SELECTORS.toggle);
      const label = card.querySelector("[data-data-card-toggle-label]");

      if (!details || !toggle || !label) {
        return;
      }

      details.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      label.textContent = label.dataset.moreLabel || "";
    });
  }

  function handleToggle(event) {
    const button = event.target.closest(SELECTORS.toggle);

    if (!button || !cards.contains(button)) {
      return;
    }

    const card = button.closest("[data-data-card]");
    const details = card?.querySelector("[data-data-card-details]");
    const label = button.querySelector("[data-data-card-toggle-label]");

    if (!card || !details || !label) {
      return;
    }

    const nextExpanded = button.getAttribute("aria-expanded") !== "true";

    collapseOtherCards(card);

    details.hidden = !nextExpanded;
    button.setAttribute("aria-expanded", String(nextExpanded));

    label.textContent = nextExpanded
      ? label.dataset.lessLabel || ""
      : label.dataset.moreLabel || "";
  }

  function handleFavorite(event) {
    const button = event.target.closest(SELECTORS.favorite);

    if (!button || !cards.contains(button)) {
      return;
    }

    event.preventDefault();

    const companyRef = button.dataset.companyRef || "";

    /*
     * Preserve the existing website watchlist and login decision flow.
     */

    if (typeof window.showAddToWatchListPopup === "function") {
      window.showAddToWatchListPopup(companyRef);
    }

    cards.dispatchEvent(
      new CustomEvent("marketwatch:favorite-request", {
        bubbles: true,
        detail: {
          companyRef,
          button,
        },
      }),
    );
  }

  function handleLogoError(event) {
    const image = event.target;

    if (
      !(image instanceof HTMLImageElement) ||
      !image.matches(SELECTORS.logo)
    ) {
      return;
    }

    const fallbackUrl = image.dataset.marketWatchLogoFallback;

    if (fallbackUrl && !image.dataset.marketWatchLogoFallbackApplied) {
      image.dataset.marketWatchLogoFallbackApplied = "true";
      image.src = fallbackUrl;

      return;
    }

    image.closest(".data-card__logo")?.classList.add("is-image-missing");
    image.remove();
  }

  function setRows(nextRows = []) {
    rows = Array.isArray(nextRows) ? nextRows : [];
    renderState = null;

    renderRows();
  }

  function showLoading() {
    renderState = {
      type: STATES.loading,
    };

    renderRows();
  }

  function showEmpty(message) {
    rows = [];

    renderState = {
      type: STATES.empty,
      message: message || config.labels?.noData || "No data available",
    };

    renderRows();
  }

  function showError(message) {
    rows = [];

    renderState = {
      type: STATES.error,
      message: message || config.labels?.noData || "No data available",
    };

    renderRows();
  }

  function setView(nextView) {
    currentView = String(nextView || "1");
    renderRows();
  }

  function setVisibleGroups(nextGroups = []) {
    visibleGroups = [...new Set(nextGroups)];
    renderRows();
  }

  function setActive(isActive) {
    view.hidden = !isActive;
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    cards.removeEventListener("click", handleToggle);
    cards.removeEventListener("click", handleFavorite);
    cards.removeEventListener("error", handleLogoError, true);
  }

  cards.addEventListener("click", handleToggle);
  cards.addEventListener("click", handleFavorite);
  cards.addEventListener("error", handleLogoError, true);

  return Object.freeze({
    destroy,

    setActive,
    setRows,
    setView,
    setVisibleGroups,

    showEmpty,
    showError,
    showLoading,
  });
}
