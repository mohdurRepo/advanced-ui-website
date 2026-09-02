/* ==========================================================================
   Listed Tradable Rights Cards
   ========================================================================== */

/*
 * Mobile card presentation for Listed Tradable Rights.
 *
 * Responsibilities:
 *
 * - render the standard Market Watch company identity
 * - render last-trade price and percentage change
 * - render expandable trading details
 * - provide Listed Tradable Rights loading markup
 * - provide Listed Tradable Rights empty/error markup
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - createDataCards() initialization
 * - request lifecycle
 * - response normalization
 * - busy-state management
 * - destruction logic
 * - breakpoint behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { renderStandardDataCard } from "../../../../../common/data-view/index.js";

import {
  escapeHtml,
  normalizeString,
} from "../../../../shared/trading/trading-formatters.js";

import { createListedTradableRightsFormatters } from "../listed-tradable-rights.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "listed-tradable-rights";

const DEFAULT_LOADING_CARD_COUNT = 3;

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

function getFirstLabel(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getLabels(config = {}) {
  const feature = config.labels?.listedTradableRights || {};

  const mobile = feature.mobile || {};

  return Object.freeze({
    showDetails:
      getFirstLabel(mobile.showDetails, config.labels?.mobile?.showDetails) ||
      DEFAULT_LABELS.showDetails,

    hideDetails:
      getFirstLabel(mobile.hideDetails, config.labels?.mobile?.hideDetails) ||
      DEFAULT_LABELS.hideDetails,

    noData: getFirstLabel(config.labels?.noData) || DEFAULT_LABELS.noData,

    error: getFirstLabel(config.labels?.error) || DEFAULT_LABELS.error,
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
          <div class="data-card__summary-identity">
            <span class="data-card__quote-label">
              <span
                class="table-skeleton table-skeleton-sm"
              ></span>
            </span>

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
          </div>

          <div class="data-card__quote">
            <div class="data-card__quote-item">
              <span class="data-card__quote-label">
                <span
                  class="table-skeleton table-skeleton-sm"
                ></span>
              </span>

              <span
                class="table-skeleton table-skeleton-md"
              ></span>
            </div>

            <div class="data-card__quote-item">
              <span class="data-card__quote-label">
                <span
                  class="table-skeleton table-skeleton-sm"
                ></span>
              </span>

              <span
                class="table-skeleton table-skeleton-sm"
              ></span>
            </div>
          </div>
        </div>
      </div>
    </article>
  `.trim();
}

function renderLoadingCards(count = DEFAULT_LOADING_CARD_COUNT) {
  const parsedCount = Number(count);

  const loadingCount =
    Number.isFinite(parsedCount) && parsedCount > 0
      ? Math.floor(parsedCount)
      : DEFAULT_LOADING_CARD_COUNT;

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
   Empty / Error
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
  return `
    <div class="data-card__summary">
      ${formatters.renderCardIdentity(row)}

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
   Public Factory
   ========================================================================== */

export function createListedTradableRightsCards(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createListedTradableRightsCards requires a configuration object.",
    );
  }

  const formatters = createListedTradableRightsFormatters(config);

  const labels = getLabels(config);

  const noDataImageUrl = normalizeString(config.assets?.noDataImageUrl);

  /* ========================================================================
     Card
     ======================================================================== */

  function renderCard(input = {}) {
    const row = input.row || {};

    const parsedIndex = Number(input.index);

    const index = Number.isFinite(parsedIndex) ? parsedIndex : 0;

    const values = formatters.getCardValues(row);

    return renderStandardDataCard({
      idPrefix: "listed-tradable-rights-details",

      rowId: values.id || `${VIEW_KEY}-${index + 1}`,

      className: "data-card--listed-tradable-rights",

      summary: renderCardSummary(row, values, formatters),

      fields: createCardFields(values, formatters.labels),

      moreLabel: labels.showDetails,

      lessLabel: labels.hideDetails,
    });
  }

  /* ========================================================================
     Collection States
     ======================================================================== */

  function renderLoading(context = {}) {
    return renderLoadingCards(context.count ?? DEFAULT_LOADING_CARD_COUNT);
  }

  function renderEmpty(message = labels.noData) {
    return renderMessage({
      message: normalizeString(message) || labels.noData,

      imageUrl: noDataImageUrl,
    });
  }

  function renderError(message = labels.error) {
    return renderMessage({
      message: normalizeString(message) || labels.error,

      isError: true,
    });
  }

  /* ========================================================================
     Definition
     ======================================================================== */

  return Object.freeze({
    key: VIEW_KEY,

    renderCard,

    renderLoading,

    renderEmpty,

    renderError,
  });
}
