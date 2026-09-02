/* ==========================================================================
   Negotiated Deals View
   ========================================================================== */

/*
 * Composition adapter for the Negotiated Deals presentations.
 *
 * Responsibilities:
 *
 * - compose the desktop table view
 * - compose the mobile cards view
 * - preserve the existing view contract used by the tab module
 *
 * Rendering responsibilities remain separated between:
 *
 * - negotiated-deals.table.js
 * - negotiated-deals.cards.js
 *
 * This module intentionally has no:
 *
 * - table cell markup
 * - mobile card markup
 * - grouping logic
 * - DataTables logic
 * - breakpoint behavior
 * - request code
 * - filter handling
 * - response normalization
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createNegotiatedDealsCardsView } from "./negotiated-deals.cards.js";

import { createNegotiatedDealsTableView } from "./negotiated-deals.table.js";

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateViewKey(tableView, cardsView) {
  if (!tableView?.key || !cardsView?.key) {
    throw new Error(
      "Negotiated Deals table and cards views must expose a key.",
    );
  }

  if (tableView.key !== cardsView.key) {
    throw new Error(
      "Negotiated Deals table and cards views must use the same key.",
    );
  }

  return tableView.key;
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createNegotiatedDealsView(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createNegotiatedDealsView requires a configuration object.",
    );
  }

  const tableView = createNegotiatedDealsTableView(config);

  const cardsView = createNegotiatedDealsCardsView(config);

  const key = validateViewKey(
    tableView,

    cardsView,
  );

  return Object.freeze({
    key,

    /* ======================================================================
       Desktop Table
       ====================================================================== */

    columns: tableView.columns,

    renderCell: tableView.renderCell,

    tableOptions: tableView.tableOptions,

    /* ======================================================================
       Mobile Cards
       ====================================================================== */

    renderCard: cardsView.renderCard,

    getCardGroupKey: cardsView.getCardGroupKey,

    getCardGroupLabel: cardsView.getCardGroupLabel,

    renderCardGroup: cardsView.renderCardGroup,

    cardOptions: cardsView.cardOptions,
  });
}
