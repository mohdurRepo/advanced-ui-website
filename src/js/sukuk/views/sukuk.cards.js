/* ==========================================================================
   Sukuk Cards View
   ========================================================================== */

/*
 * Sukuk & Bonds mobile card presentation.
 *
 * Responsibilities:
 *
 * - mobile field formatting
 * - mobile detail-column selection
 * - mobile card composition
 * - Data View cards composition
 *
 * This module intentionally has no:
 *
 * - API requests
 * - response normalization
 * - filter binding
 * - column-picker lifecycle
 * - desktop table rendering
 * - favorite event handling
 * - page startup
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataCards,
  renderStandardDataCard,
} from "../../../common/data-view/index.js";

import { getMobileColumns } from "../sukuk.columns.js";

import {
  escapeHtml,
  formatCouponFrequency,
  formatCouponType,
  formatDayCountConvention,
  formatMaturity,
  formatPrice,
  formatQuantity,
  formatYield,
  getColumnValue,
  getDisplayValue,
  getInstrumentName,
  getInstrumentReference,
  getSukukGroup,
  renderMobileIdentity,
  renderMobilePrice,
} from "../sukuk.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

export const SUKUK_CARDS_SELECTOR = "[data-sukuk-mobile-cards]";

const SUMMARY_COLUMN_KEYS = Object.freeze(["last-trade-price"]);

const NUMERIC_COLUMN_TYPES = Object.freeze(["yield", "price", "quantity"]);

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

/* ==========================================================================
   Mobile Field Rendering
   ========================================================================== */

export function renderSukukMobileFieldValue(column, row, config = {}) {
  const value = getColumnValue(row, column, "");

  switch (column.type) {
    case "coupon-type":
      return escapeHtml(formatCouponType(value, config));

    case "maturity":
      return escapeHtml(formatMaturity(row, config));

    case "yield":
      return escapeHtml(formatYield(value));

    case "price":
      return escapeHtml(formatPrice(value));

    case "quantity":
      return escapeHtml(formatQuantity(value, config));

    case "coupon-frequency":
      return escapeHtml(formatCouponFrequency(value, config));

    case "day-count-convention":
      return escapeHtml(formatDayCountConvention(value, config));

    case "display-value":
    case "text":
    default:
      return escapeHtml(getDisplayValue(value));
  }
}

/* ==========================================================================
   Mobile Detail Columns
   ========================================================================== */

export function getSukukMobileDetailColumns(
  config = {},
  view = "1",
  visibleGroups = [],
) {
  const summaryColumns = new Set(SUMMARY_COLUMN_KEYS);

  return getMobileColumns(config, view, visibleGroups).filter(
    (column) => !summaryColumns.has(column.key),
  );
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

export function renderSukukCard(
  row,
  context,
  config = {},
  visibleGroups = [],
  view = "1",
) {
  const instrumentName = getInstrumentName(row);

  const instrumentRef = getInstrumentReference(row);

  const fields = getSukukMobileDetailColumns(config, view, visibleGroups).map(
    (column) => ({
      label: cleanLabel(column.label, column.key),

      value: renderSukukMobileFieldValue(column, row, config),

      numeric: NUMERIC_COLUMN_TYPES.includes(column.type),
    }),
  );

  /*
   * Current Sukuk mobile summary:
   *
   * identity
   * quote
   */

  const summary = `
    ${renderMobileIdentity(row)}

    ${renderMobilePrice(row)}
  `;

  return renderStandardDataCard({
    idPrefix: "sukuk-card-details",

    rowId: `${instrumentRef || "instrument"}-${context.index}`,

    summary,

    fields,

    moreLabel: `${cleanLabel(
      config.labels?.mobile?.showDetails,
      "Show details",
    )} ${instrumentName}`,

    lessLabel: `${cleanLabel(
      config.labels?.mobile?.hideDetails,
      "Hide details",
    )} ${instrumentName}`,
  });
}

/* ==========================================================================
   Cards Factory
   ========================================================================== */

export function createSukukCards({
  root = document,
  config = {},
  view = "1",
  getVisibleGroups = () => [],
} = {}) {
  return createDataCards({
    root,

    container: SUKUK_CARDS_SELECTOR,

    initialView: view,

    getGroupKey(row) {
      return getSukukGroup(row, config);
    },

    renderCard(row, context) {
      return renderSukukCard(row, context, config, getVisibleGroups(), view);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load Sukuk data.",
  });
}
