/* ==========================================================================
   Theoretical Opening Cards
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - create the mobile card collection
 * - render one Theoretical Opening card per row
 * - group cards by sector
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

function getCardIdPrefix(variant) {
  return variant === "nomu"
    ? "nomu-theoretical-opening-card-details"
    : "theoretical-opening-card-details";
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
    "row";

  return `${String(identifier).trim() || "row"}-${index}`;
}

function getSectorName(row) {
  return String(row?.sectorName ?? "").trim() || "Other";
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
   Card Rendering
   ========================================================================== */

function renderCard(row, context, config, variant) {
  const showDetails = config.labels?.mobile?.showDetails || "Show details";

  const hideDetails = config.labels?.mobile?.hideDetails || "Hide details";

  return renderStandardDataCard({
    idPrefix: getCardIdPrefix(variant),

    rowId: createRowId(row, context.index),

    summary: renderStandardCompanyCardIdentity(row, config),

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

    /*
     * The common cards renderer preserves group order based on the incoming
     * rows, so we do not need to manually split or rebuild the response.
     */
    getGroupKey(row) {
      return getSectorName(row);
    },

    renderCard(row, context) {
      return renderCard(row, context, config, variant);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load data.",
  });
}
