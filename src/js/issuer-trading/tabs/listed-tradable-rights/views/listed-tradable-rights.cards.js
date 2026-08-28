/* ==========================================================================
   Listed Tradable Rights Cards
   ========================================================================== */

/*
 * Mobile card view for Listed Tradable Rights.
 *
 * Responsibilities:
 *
 * - render the standard Market Watch company identity
 * - render last-trade price and change summary
 * - render expandable trading details
 * - render loading, empty, and error states
 * - initialize the existing design-system Data Card behavior
 *
 * This module intentionally has no:
 *
 * - endpoint code
 * - request lifecycle
 * - response normalization
 * - desktop table logic
 * - breakpoint detection
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataCards,
  renderStandardDataCard,
} from "../../../../../common/data-view/index.js";

import {
  escapeHtml,
  normalizeString,
} from "../../../shared/trading-formatters.js";

import { createListedTradableRightsFormatters } from "../listed-tradable-rights.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const SELECTORS = Object.freeze({
  region: "[data-listed-tradable-rights-mobile]",

  cards: "[data-listed-tradable-rights-cards]",
});

const DEFAULT_LABELS = Object.freeze({
  showDetails: "More details",

  hideDetails: "Less details",

  noData: "No data available.",

  error: "Unable to load data.",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1);
}

function getRootElement(root) {
  if (root && typeof root.querySelector === "function") {
    return root;
  }

  throw new TypeError(
    "Listed Tradable Rights cards require a valid root element.",
  );
}

function resolveRequiredElement(root, selector, name) {
  const element = root.querySelector(selector);

  if (!isElement(element)) {
    throw new Error(`Listed Tradable Rights ${name} was not found.`);
  }

  return element;
}

function getLabels(config = {}) {
  return Object.freeze({
    showDetails:
      normalizeString(config.labels?.mobile?.showDetails) ||
      DEFAULT_LABELS.showDetails,

    hideDetails:
      normalizeString(config.labels?.mobile?.hideDetails) ||
      DEFAULT_LABELS.hideDetails,

    noData: normalizeString(config.labels?.noData) || DEFAULT_LABELS.noData,

    error: normalizeString(config.labels?.error) || DEFAULT_LABELS.error,
  });
}

/* ==========================================================================
   Loading
   ========================================================================== */

function renderLoadingCard() {
  return `
    <article
      class="data-card data-card--loading"
      aria-hidden="true"
    >
      <div class="data-card__main">
        <div class="data-card__summary">
          <div class="data-card__identity">
            <span class="data-card__logo">
              <span
                class="table-skeleton table-skeleton-md"
              ></span>
            </span>

            <div class="data-card__identity-content">
              <span
                class="table-skeleton table-skeleton-lg"
              ></span>

              <span
                class="table-skeleton table-skeleton-sm"
              ></span>
            </div>
          </div>

          <div class="data-card__quote">
            <span
              class="table-skeleton table-skeleton-md"
            ></span>

            <span
              class="table-skeleton table-skeleton-sm"
            ></span>
          </div>
        </div>
      </div>
    </article>
  `.trim();
}

function renderLoadingCards(count = 3) {
  const loadingCount = Math.max(1, Number(count) || 3);

  return `
    <div
      class="data-view__cards-loading"
      aria-hidden="true"
    >
      ${Array.from(
        {
          length: loadingCount,
        },
        renderLoadingCard,
      ).join("")}
    </div>
  `.trim();
}

/* ==========================================================================
   Empty and Error States
   ========================================================================== */

function renderMessage({ message, imageUrl = "", isError = false }) {
  const imageMarkup = imageUrl
    ? `
        <img
          class="data-view__empty-image"
          src="${escapeHtml(imageUrl)}"
          alt=""
          loading="lazy"
          aria-hidden="true"
        />
      `.trim()
    : "";

  return `
    <div
      class="data-view__empty${isError ? " is-error" : ""}"
      ${isError ? 'role="alert"' : ""}
    >
      ${imageMarkup}

      <p class="data-view__empty-message">
        ${escapeHtml(message)}
      </p>
    </div>
  `.trim();
}

/* ==========================================================================
   Card Summary
   ========================================================================== */

function renderCardSummary(row, values, formatters) {
  const identity = formatters.renderCardIdentity(row);

  return `
    <div class="data-card__summary">
      ${identity}

      <div class="data-card__quote">
        <span class="data-card__price">
          ${escapeHtml(values.lastTrade.price)}
        </span>

        <span
          class="data-card__change ${escapeHtml(
            values.lastTrade.changePercentClass,
          )}"
        >
          ${escapeHtml(values.lastTrade.changePercent)}
        </span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Card Fields
   ========================================================================== */

function createCardFields(values, labels) {
  return [
    /* ----------------------------------------------------------------------
       Last Trade
       ---------------------------------------------------------------------- */

    {
      label: labels.lastTradeVolume,

      value: escapeHtml(values.lastTrade.volume),

      numeric: true,
    },

    {
      label: labels.changeValue,

      value: escapeHtml(values.lastTrade.changeValue),

      valueClassName: values.lastTrade.changeValueClass,

      numeric: true,
    },

    {
      label: labels.changePercent,

      value: escapeHtml(values.lastTrade.changePercent),

      valueClassName: values.lastTrade.changePercentClass,

      numeric: true,
    },

    /* ----------------------------------------------------------------------
       Today
       ---------------------------------------------------------------------- */

    {
      label: labels.todayOpen,

      value: escapeHtml(values.today.open),

      numeric: true,
    },

    {
      label: labels.todayHigh,

      value: escapeHtml(values.today.high),

      numeric: true,
    },

    {
      label: labels.todayLow,

      value: escapeHtml(values.today.low),

      numeric: true,
    },

    /* ----------------------------------------------------------------------
       Cumulative
       ---------------------------------------------------------------------- */

    {
      label: labels.numberOfTrades,

      value: escapeHtml(values.cumulative.numberOfTrades),

      numeric: true,
    },

    {
      label: labels.volumeTraded,

      value: escapeHtml(values.cumulative.volumeTraded),

      numeric: true,
    },

    /* ----------------------------------------------------------------------
       Best Bid
       ---------------------------------------------------------------------- */

    {
      label: labels.bidPrice,

      value: escapeHtml(values.bestBid.price),

      numeric: true,
    },

    {
      label: labels.bidVolume,

      value: escapeHtml(values.bestBid.volume),

      numeric: true,
    },

    /* ----------------------------------------------------------------------
       Best Offer
       ---------------------------------------------------------------------- */

    {
      label: labels.offerPrice,

      value: escapeHtml(values.bestOffer.price),

      numeric: true,
    },

    {
      label: labels.offerVolume,

      value: escapeHtml(values.bestOffer.volume),

      numeric: true,
    },
  ];
}

/* ==========================================================================
   Public Cards View
   ========================================================================== */

export function createListedTradableRightsCards(options = {}) {
  if (!isObject(options)) {
    throw new TypeError(
      "createListedTradableRightsCards requires an options object.",
    );
  }

  const root = getRootElement(options.root);

  const config = isObject(options.config) ? options.config : {};

  const formatters =
    options.formatters || createListedTradableRightsFormatters(config);

  const labels = getLabels(config);

  const regionElement = resolveRequiredElement(
    root,
    SELECTORS.region,
    "mobile region",
  );

  const cardsElement = resolveRequiredElement(
    root,
    SELECTORS.cards,
    "card container",
  );

  const noDataImageUrl = normalizeString(config.assets?.noDataImageUrl);

  let destroyed = false;

  /* ========================================================================
     Card Renderer
     ======================================================================== */

  function renderCard(row, context = {}) {
    const values = formatters.getCardValues(row);

    const fields = createCardFields(values, formatters.labels);

    return renderStandardDataCard({
      idPrefix: "listed-tradable-rights-details",

      rowId: values.id || context.index,

      className: "data-card--listed-tradable-rights",

      summary: renderCardSummary(row, values, formatters),

      fields,

      moreLabel: labels.showDetails,

      lessLabel: labels.hideDetails,
    });
  }

  /* ========================================================================
     Shared Cards Collection
     ======================================================================== */

  const cards = createDataCards({
    root,

    container: cardsElement,

    autoRender: false,

    renderCard,

    renderLoading() {
      return renderLoadingCards(options.loadingCardCount || 3);
    },

    renderEmpty(message) {
      return renderMessage({
        message: normalizeString(message) || labels.noData,

        imageUrl: noDataImageUrl,
      });
    },

    renderError(message) {
      return renderMessage({
        message: normalizeString(message) || labels.error,

        isError: true,
      });
    },

    emptyMessage: labels.noData,

    errorMessage: labels.error,

    afterRender(context) {
      options.afterRender?.(context);
    },
  });

  /* ========================================================================
     Busy State
     ======================================================================== */

  function setBusy(busy) {
    const value = String(Boolean(busy));

    regionElement.setAttribute("aria-busy", value);

    cardsElement.setAttribute("aria-busy", value);
  }

  /* ========================================================================
     Loading
     ======================================================================== */

  function renderLoading() {
    if (destroyed) {
      return;
    }

    setBusy(true);

    cards.showLoading();
  }

  /* ========================================================================
     Rows
     ======================================================================== */

  function renderRows(rows = []) {
    if (destroyed) {
      return;
    }

    const normalizedRows = Array.isArray(rows) ? rows : [];

    setBusy(false);

    if (!normalizedRows.length) {
      renderEmpty();

      return;
    }

    cards.setRows(normalizedRows);
  }

  /* ========================================================================
     Empty
     ======================================================================== */

  function renderEmpty(message = labels.noData) {
    if (destroyed) {
      return;
    }

    setBusy(false);

    cards.showEmpty(normalizeString(message) || labels.noData);
  }

  /* ========================================================================
     Error
     ======================================================================== */

  function renderError(message = labels.error) {
    if (destroyed) {
      return;
    }

    setBusy(false);

    cards.showError(normalizeString(message) || labels.error);
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    setBusy(false);

    cards.destroy();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    destroy,

    renderEmpty,
    renderError,
    renderLoading,
    renderRows,

    getRows() {
      return cards.getRows();
    },

    getState() {
      return cards.getState();
    },
  });
}
