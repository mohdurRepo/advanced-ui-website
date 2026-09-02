/* ==========================================================================
   Theoretical Opening Cards
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - create the mobile card collection
 * - render one Theoretical Opening card per row
 * - reuse the common standard company identity
 * - reuse the standard data-card renderer
 *
 * Shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataCards,
  renderStandardCompanyCardIdentity,
  renderStandardDataCard,
} from "../../../common/data-view/index.js";

import {
  escapeHtml,
  formatPreviousClose,
  formatTop,
  formatTov,
} from "../theoretical-opening.formatters.js";

/* ==========================================================================
   Helpers
   ========================================================================== */

function getCardsSelector(variant) {
  return variant === "nomu"
    ? "[data-nomu-theoretical-opening-cards]"
    : "[data-theoretical-opening-cards]";
}

function cleanLabel(value, fallback = "") {
  return String(value ?? fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createRowId(row, index) {
  const identifier =
    row?.companyCode ??
    row?.companyRef ??
    row?.symbol ??
    row?.companyName ??
    index;

  return `${String(identifier).trim() || "row"}-${index}`;
}

/* ==========================================================================
   Summary
   ========================================================================== */

function renderSummary(row, config) {
  return renderStandardCompanyCardIdentity(row, config);
}

/* ==========================================================================
   Fields
   ========================================================================== */

function createFields(row, config) {
  const labels = config.labels?.table || {};

  return [
    {
      label: cleanLabel(labels.previousClose, "Previous Close"),

      value: escapeHtml(formatPreviousClose(row?.previousClose)),

      numeric: true,
    },

    {
      label: cleanLabel(labels.top, "TOP"),

      value: escapeHtml(formatTop(row?.top)),

      numeric: true,
    },

    {
      label: cleanLabel(labels.tov, "TOV"),

      value: escapeHtml(formatTov(row?.tov)),

      numeric: true,
    },
  ];
}

/* ==========================================================================
   Card
   ========================================================================== */

function renderCard(row, context, config) {
  const showDetails = config.labels?.mobile?.showDetails || "Show details";

  const hideDetails = config.labels?.mobile?.hideDetails || "Hide details";

  return renderStandardDataCard({
    idPrefix: "theoretical-opening-card-details",

    rowId: createRowId(row, context.index),

    summary: renderSummary(row, config),

    fields: createFields(row, config),

    moreLabel: showDetails,

    lessLabel: hideDetails,
  });
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createTheoreticalOpeningCards({
  root = document,
  config,
  variant = "main",
} = {}) {
  if (!config) {
    throw new TypeError("createTheoreticalOpeningCards requires config.");
  }

  return createDataCards({
    root,

    container: getCardsSelector(variant),

    renderCard(row, context) {
      return renderCard(row, context, config);
    },
  });
}
