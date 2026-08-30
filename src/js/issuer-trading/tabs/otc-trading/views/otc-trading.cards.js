/* ==========================================================================
   OTC Trading Cards
   ========================================================================== */

/*
 * Mobile card presentation for OTC Trading.
 *
 * Responsibilities:
 *
 * - render the standard Market Watch company identity
 * - expose traded volume in the card summary
 * - render the service-provided last-update value
 * - provide a valid expandable DataViewCard structure
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - event listeners
 * - request code
 * - response normalization
 * - breakpoint logic
 *
 * Expand and collapse behavior remains owned by the shared DataViewCard
 * component.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { renderStandardDataCard } from "../../../../../common/data-view/index.js";

import { createOtcTradingFormatters } from "../otc-trading.formatters.js";

import {
  escapeHtml,
  normalizeString,
} from "../../../shared/trading/trading-formatters.js";

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
   Labels
   ========================================================================== */

function getLabels(config = {}) {
  const table = config.labels?.otcTrading?.table || {};

  const mobile = config.labels?.mobile || {};

  return Object.freeze({
    tradedVolume: normalizeString(table.tradedVolume, "Traded Volume"),

    lastUpdate: normalizeString(table.lastUpdate, "Last Update"),

    showDetails: normalizeString(mobile.showDetails) || "More details",

    hideDetails: normalizeString(mobile.hideDetails) || "Less details",
  });
}

/* ==========================================================================
   Card Summary
   ========================================================================== */

function renderCardSummary(row, values, formatters, labels) {
  return `
    <div class="otc-trading-card__summary">
      ${formatters.renderCardIdentity(row)}

      <div class="otc-trading-card__primary-value">
        <span class="otc-trading-card__primary-label">
          ${escapeHtml(labels.tradedVolume)}
        </span>

        <strong class="otc-trading-card__volume">
          ${values.tradedVolume}
        </strong>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Card Fields
   ========================================================================== */

function createCardFields(values, labels) {
  return [
    {
      label: labels.lastUpdate,

      value: values.lastUpdate,

      className: "otc-trading-card__last-update-field",

      valueClassName: "otc-trading-card__last-update-value",

      fullWidth: true,
    },
  ];
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

  const labels = getLabels(config);

  const formatters = createOtcTradingFormatters(config);

  function renderCard(input = {}) {
    const row = input.row || {};

    const parsedIndex = Number(input.index);

    const index = Number.isFinite(parsedIndex) ? parsedIndex : 0;

    const values = formatters.getCardValues(row);

    return renderStandardDataCard({
      rowId: row.id || `${VIEW_KEY}-${index + 1}`,

      idPrefix: "otc-trading-details",

      className: "data-card--otc-trading",

      summary: renderCardSummary(row, values, formatters, labels),

      fields: createCardFields(values, labels),

      moreLabel: labels.showDetails,

      lessLabel: labels.hideDetails,
    });
  }

  return Object.freeze({
    renderCard,
  });
}
