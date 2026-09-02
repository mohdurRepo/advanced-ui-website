/* ==========================================================================
   Theoretical Opening Cards
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - create the mobile card collection
 * - render one Theoretical Opening card per row
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
  renderStandardDataCard,
} from "../../../common/data-view/index.js";

import {
  escapeHtml,
  formatCompanyName,
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

function renderSummary(row) {
  const companyName = formatCompanyName(row?.companyName);

  return `
    <div class="data-card__identity">
      <div class="data-card__identity-main">
        <span class="data-card__title">
          ${escapeHtml(companyName)}
        </span>
      </div>
    </div>
  `.trim();
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
  const companyName = formatCompanyName(row?.companyName);

  const showDetails = config.labels?.mobile?.showDetails || "Show details";

  const hideDetails = config.labels?.mobile?.hideDetails || "Hide details";

  return renderStandardDataCard({
    idPrefix: "theoretical-opening-card-details",

    rowId: createRowId(row, context.index),

    summary: renderSummary(row),

    fields: createFields(row, config),

    moreLabel: `${showDetails} ${companyName}`,

    lessLabel: `${hideDetails} ${companyName}`,
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
