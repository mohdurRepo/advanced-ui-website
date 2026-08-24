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
  getCompanyName,
  getCompanyReference,
  getDisplayValue,
  isZeroLike,
  renderChange,
  renderMobileIdentity,
  renderMobileQuote,
  renderRange,
} from "./market-watch-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const SELECTORS = {
  view: "[data-market-watch-mobile]",
  cards: "[data-market-watch-mobile-cards]",

  card: "[data-data-card]",
  details: "[data-data-card-details]",
  toggle: "[data-data-card-toggle]",
  toggleLabel: "[data-data-card-toggle-label]",

  favorite: "[data-market-watch-favorite]",
  logo: "[data-market-watch-logo]",
};

const CLASSES = {
  expanded: "is-expanded",
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

function unique(values = []) {
  return [...new Set(values)];
}

function arraysEqual(first = [], second = []) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
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

/* ==========================================================================
   Field Rendering
   ========================================================================== */

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
   * These values already appear in the card summary.
   *
   * Do not repeat them in the details region.
   */

  const summaryColumns = new Set(["last-trade-price", "change-percent"]);

  return getMobileColumns(config, view, visibleGroups).filter(
    (column) => !summaryColumns.has(column.key),
  );
}

/* ==========================================================================
   Grouping
   ========================================================================== */

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

/* ==========================================================================
   Loading
   ========================================================================== */

function createLoadingCards(count = 4) {
  return Array.from(
    {
      length: count,
    },
    () =>
      `
      <article
        class="data-card data-card--loading"
        aria-hidden="true"
      >
        <div class="data-card__main">
          <div class="data-card__identity">
            <span
              class="table-skeleton table-skeleton-sm"
            ></span>

            <span
              class="table-skeleton table-skeleton-md"
            ></span>
          </div>

          <div class="data-card__quote">
            <span
              class="table-skeleton table-skeleton-sm"
            ></span>
          </div>
        </div>
      </article>
    `.trim(),
  ).join("");
}

/* ==========================================================================
   Toggle Labels
   ========================================================================== */

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

  let visibleGroups = unique(config.initialState?.visibleGroups || []);

  let renderState = null;
  let destroyed = false;

  /* ========================================================================
     IDs
     ======================================================================== */

  function getDetailsId(row, index) {
    const reference = getCompanyReference(row) || `company-${index}`;

    const safeReference = String(reference).replace(/[^a-z0-9_-]/gi, "-");

    return `market-watch-card-details-` + `${safeReference}-${index}`;
  }

  /* ========================================================================
     Fields
     ======================================================================== */

  function renderField(column, row) {
    const isRange = column.type === "range";

    return `
      <div
        class="data-card__field ${isRange ? "data-card__field--full" : ""}"
      >
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

  /* ========================================================================
     Card
     ======================================================================== */

  function renderCard(row, index) {
    const detailsId = getDetailsId(row, index);

    const companyName = getCompanyName(row);

    const toggleLabels = getToggleLabels(config, companyName);

    const fields = getDetailColumns(config, currentView, visibleGroups);

    return `
      <article
        class="data-card"
        data-data-card
      >
        <div class="data-card__main">
          ${renderMobileIdentity(row, config)}

          ${renderMobileQuote(row, config)}
        </div>

        <div
          class="data-card__details"
          id="${escapeHtml(detailsId)}"
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
          aria-controls="${escapeHtml(detailsId)}"
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

  /* ========================================================================
     Rendering
     ======================================================================== */

  function renderRows() {
    if (destroyed) {
      return;
    }

    const isLoading = renderState?.type === STATES.loading;

    cards.setAttribute("aria-busy", String(isLoading));

    /* ----------------------------------------------------------------------
       Loading
       ---------------------------------------------------------------------- */

    if (isLoading) {
      cards.innerHTML = createLoadingCards();

      return;
    }

    /* ----------------------------------------------------------------------
       Empty / Error
       ---------------------------------------------------------------------- */

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

    /* ----------------------------------------------------------------------
       No Rows
       ---------------------------------------------------------------------- */

    if (!rows.length) {
      cards.innerHTML = `
        <div class="data-card__empty">
          ${escapeHtml(config.labels?.noData || "No data available")}
        </div>
      `.trim();

      return;
    }

    /* ----------------------------------------------------------------------
       Result Groups
       ---------------------------------------------------------------------- */

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

  /* ========================================================================
     Expansion
     ======================================================================== */

  function setCardExpanded(card, expanded) {
    const toggle = card.querySelector(SELECTORS.toggle);

    const details = card.querySelector(SELECTORS.details);

    if (!toggle || !details) {
      return;
    }

    const label = toggle.querySelector(SELECTORS.toggleLabel);

    toggle.setAttribute("aria-expanded", String(expanded));

    details.hidden = !expanded;

    card.classList.toggle(CLASSES.expanded, expanded);

    if (label) {
      label.textContent = expanded
        ? label.dataset.lessLabel || "Less details"
        : label.dataset.moreLabel || "More details";
    }
  }

  function handleToggle(event) {
    const toggle = event.target.closest(SELECTORS.toggle);

    if (!toggle || !cards.contains(toggle)) {
      return;
    }

    const card = toggle.closest(SELECTORS.card);

    if (!card) {
      return;
    }

    const expanded = toggle.getAttribute("aria-expanded") === "true";

    /*
     * Cards are independent.
     *
     * Opening one card must not automatically close another card.
     * This matches the reusable DataViewCard contract.
     */

    setCardExpanded(card, !expanded);
  }

  /* ========================================================================
     Favorite
     ======================================================================== */

  function handleFavorite(event) {
    const button = event.target.closest(SELECTORS.favorite);

    if (!button || !cards.contains(button)) {
      return;
    }

    event.preventDefault();

    const companyRef = button.dataset.companyRef || "";

    /*
     * Existing website authentication/watchlist logic remains authoritative.
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

  /* ========================================================================
     Logo Fallback
     ======================================================================== */

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

  /* ========================================================================
     Rows
     ======================================================================== */

  function setRows(nextRows = []) {
    if (destroyed) {
      return;
    }

    rows = Array.isArray(nextRows) ? nextRows : [];

    renderState = null;

    renderRows();
  }

  /* ========================================================================
     Loading
     ======================================================================== */

  function showLoading() {
    if (destroyed) {
      return;
    }

    renderState = {
      type: STATES.loading,
      message: "",
    };

    renderRows();
  }

  /* ========================================================================
     Empty
     ======================================================================== */

  function showEmpty(message) {
    if (destroyed) {
      return;
    }

    rows = [];

    renderState = {
      type: STATES.empty,

      message: message || config.labels?.noData || "No data available",
    };

    renderRows();
  }

  /* ========================================================================
     Error
     ======================================================================== */

  function showError(message) {
    if (destroyed) {
      return;
    }

    rows = [];

    renderState = {
      type: STATES.error,

      message:
        message ||
        config.labels?.loadError ||
        config.labels?.noData ||
        "Unable to load market data.",
    };

    renderRows();
  }

  /* ========================================================================
     Table View
     ======================================================================== */

  function setView(nextView) {
    if (destroyed) {
      return;
    }

    const viewName = String(nextView || "1");

    if (viewName === currentView) {
      return;
    }

    currentView = viewName;

    renderRows();
  }

  /* ========================================================================
     Visible Groups
     ======================================================================== */

  function setVisibleGroups(nextGroups = []) {
    if (destroyed) {
      return;
    }

    const groups = unique(nextGroups);

    if (arraysEqual(groups, visibleGroups)) {
      return;
    }

    visibleGroups = groups;

    renderRows();
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    cards.removeEventListener("click", handleToggle);

    cards.removeEventListener("click", handleFavorite);

    cards.removeEventListener("error", handleLogoError, true);
  }

  /* ========================================================================
     Event Registration
     ======================================================================== */

  cards.addEventListener("click", handleToggle);

  cards.addEventListener("click", handleFavorite);

  cards.addEventListener("error", handleLogoError, true);

  /* ========================================================================
     Public API
     ======================================================================== */

  return Object.freeze({
    destroy,

    setRows,
    setView,
    setVisibleGroups,

    showEmpty,
    showError,
    showLoading,
  });
}
