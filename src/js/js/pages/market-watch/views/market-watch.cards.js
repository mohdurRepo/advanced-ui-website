/* ==========================================================================
   Market Watch Cards View
   ========================================================================== */

/*
 * Mobile/card presentation adapter for Market Watch.
 *
 * Responsibilities:
 *
 * - expose mobile-visible Market Watch columns
 * - build mobile field labels
 * - render mobile field values
 * - exclude summary fields from expandable details
 * - render Market Watch cards
 * - group cards by sector
 *
 * This module intentionally has no:
 *
 * - request logic
 * - response normalization
 * - filter state
 * - column-picker DOM behavior
 * - desktop table rendering
 * - favorite click handling
 * - logo error handling
 * - page lifecycle
 */

import { getMarketWatchMobileColumns } from "../market-watch.columns.js";

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
} from "../market-watch.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_CARDS_SELECTOR = "[data-market-watch-cards]";

const DEFAULT_GROUP_NAME = "Other";

const SUMMARY_COLUMN_KEYS = Object.freeze(
  new Set(["last-trade-price", "change-percent"]),
);

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizeString(value) {
  return String(value ?? "").trim();
}

function cleanLabel(value, fallback = "") {
  return normalizeString(value || fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCellValue(row, column) {
  if (!column?.data) {
    return "";
  }

  return row?.[column.data];
}

function getNumericValue(row, column) {
  if (column?.numericData) {
    return row?.[column.numericData];
  }

  return getCellValue(row, column);
}

function isAuction(config = {}) {
  return Boolean(config.market?.isAuction);
}

function renderAuctionFullNumber(value, config = {}) {
  if (isAuction(config) && isZeroLike(value)) {
    return "-";
  }

  return formatFullNumber(value, config);
}

/* ==========================================================================
   Mobile Field Labels
   ========================================================================== */

export function getMarketWatchMobileFieldLabel(column, config = {}) {
  const labels = config.labels?.table ?? {};

  const fieldLabel = cleanLabel(
    column?.mobileLabel || column?.label,
    column?.label,
  );

  switch (column?.headerGroup) {
    case "best-bid":
      return `${cleanLabel(labels.bestBid, "Best Bid")} ${fieldLabel}`.trim();

    case "best-offer":
      return `${cleanLabel(
        labels.bestOffer,
        "Best Offer",
      )} ${fieldLabel}`.trim();

    default:
      return fieldLabel;
  }
}

/* ==========================================================================
   Mobile Field Values
   ========================================================================== */

export function renderMarketWatchMobileFieldValue(column, row, config = {}) {
  const value = getCellValue(row, column);

  switch (column?.type) {
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

/* ==========================================================================
   Mobile Detail Columns
   ========================================================================== */

/*
 * Last Trade Price and Change % already appear in the compact card summary.
 *
 * They therefore should not be duplicated in the expandable field list.
 */

export function getMarketWatchMobileDetailColumns(
  config = {},
  view = "1",
  visibleGroups = [],
) {
  return getMarketWatchMobileColumns(config, view, visibleGroups).filter(
    (column) => !SUMMARY_COLUMN_KEYS.has(column.key),
  );
}

/* ==========================================================================
   Card Fields
   ========================================================================== */

function createCardFields({ row, config, view, visibleGroups }) {
  return getMarketWatchMobileDetailColumns(config, view, visibleGroups).map(
    (column) => ({
      label: getMarketWatchMobileFieldLabel(column, config),

      value: renderMarketWatchMobileFieldValue(column, row, config),

      /*
       * The 52-week range requires the full card width because it renders a
       * track rather than a single scalar value.
       */

      fullWidth: column.type === "range",

      numeric: column.type !== "range",
    }),
  );
}

/* ==========================================================================
   Card Rendering
   ========================================================================== */

export function renderMarketWatchCard({
  row,
  context = {},
  config = {},
  visibleGroups = [],
  renderStandardDataCard,
}) {
  if (typeof renderStandardDataCard !== "function") {
    throw new TypeError(
      "renderMarketWatchCard requires renderStandardDataCard.",
    );
  }

  const companyName = getCompanyName(row);

  const fields = createCardFields({
    row,
    config,
    view: context.view,
    visibleGroups,
  });

  const summary = `
    ${renderMobileIdentity(row, config)}

    ${renderMobileQuote(row, config)}
  `.trim();

  const showDetailsLabel = cleanLabel(
    config.labels?.mobile?.showDetails,
    "Show details",
  );

  const hideDetailsLabel = cleanLabel(
    config.labels?.mobile?.hideDetails,
    "Hide details",
  );

  const companyReference = getCompanyReference(row);

  const rowId = [companyReference || "company", context.index ?? 0].join("-");

  return renderStandardDataCard({
    idPrefix: "market-watch-card-details",

    rowId,

    summary,

    fields,

    moreLabel: `${showDetailsLabel} ${companyName}`.trim(),

    lessLabel: `${hideDetailsLabel} ${companyName}`.trim(),
  });
}

/* ==========================================================================
   Card Group
   ========================================================================== */

export function getMarketWatchCardGroup(row = {}) {
  return normalizeString(row.sectorName) || DEFAULT_GROUP_NAME;
}

/* ==========================================================================
   Cards Factory
   ========================================================================== */

export function createMarketWatchCardsView({
  root,
  config,
  createDataCards,
  renderStandardDataCard,
  getVisibleGroups,
  container = DEFAULT_CARDS_SELECTOR,
  initialView = "1",
} = {}) {
  if (typeof createDataCards !== "function") {
    throw new TypeError("createMarketWatchCardsView requires createDataCards.");
  }

  if (typeof renderStandardDataCard !== "function") {
    throw new TypeError(
      "createMarketWatchCardsView requires renderStandardDataCard.",
    );
  }

  if (!root) {
    throw new TypeError("createMarketWatchCardsView requires a root.");
  }

  if (!config) {
    throw new TypeError("createMarketWatchCardsView requires config.");
  }

  return createDataCards({
    root,

    container,

    initialView,

    getGroupKey(row) {
      return getMarketWatchCardGroup(row);
    },

    renderCard(row, context) {
      const visibleGroups =
        typeof getVisibleGroups === "function" ? getVisibleGroups() : [];

      return renderMarketWatchCard({
        row,

        context,

        config,

        visibleGroups,

        renderStandardDataCard,
      });
    },

    /*
     * No enhance() callback is needed.
     *
     * The common Data View observer initializes dynamically inserted
     * [data-data-card] elements.
     */

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load market data.",
  });
}
