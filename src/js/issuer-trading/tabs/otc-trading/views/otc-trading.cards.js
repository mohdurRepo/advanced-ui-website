/* ==========================================================================
   OTC Trading Cards
   ========================================================================== */

/*
 * Compact mobile presentation for OTC Trading.
 *
 * Responsibilities:
 *
 * - render the standard Market Watch company identity
 * - render traded volume and last-update price
 * - use the shared mobile column heading from JSP
 * - avoid unnecessary expandable-card behavior
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - event listeners
 * - request code
 * - response normalization
 * - breakpoint logic
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { renderStandardDataCard } from "../../../../../common/data-view/index.js";

import { createOtcTradingFormatters } from "../otc-trading.formatters.js";

import { escapeHtml } from "../../../shared/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "otc-trading";

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/* ==========================================================================
   Card Summary
   ========================================================================== */

function renderCardSummary(row, values, formatters) {
  return `
    <div class="data-card__summary">
      ${formatters.renderCardIdentity(row)}

      <div class="data-card__quote">
        <span
          class="
            data-card__value
            data-card__value--numeric
            otc-trading-card__volume
          "
        >
          ${escapeHtml(values.tradedVolume)}
        </span>

        <span
          class="
            data-card__value
            data-card__value--numeric
            otc-trading-card__last-update
          "
        >
          ${escapeHtml(values.lastUpdate)}
        </span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createOtcTradingCards(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createOtcTradingCards requires a configuration object.",
    );
  }

  const formatters = createOtcTradingFormatters(config);

  function renderCard(input = {}) {
    const row = input.row || {};

    const parsedIndex = Number(input.index);

    const index = Number.isFinite(parsedIndex) ? parsedIndex : 0;

    const values = formatters.getCardValues(row);

    return renderStandardDataCard({
      rowId: row.id || `${VIEW_KEY}-${index + 1}`,

      idPrefix: "otc-trading-item",

      className: ["data-card--compact", "data-card--otc-trading"].join(" "),

      summary: renderCardSummary(row, values, formatters),

      fields: [],

      expandable: false,
    });
  }

  return Object.freeze({
    renderCard,
  });
}
