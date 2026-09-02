/* ==========================================================================
   Theoretical Opening Cards View
   ========================================================================== */

/*
 * Theoretical Opening mobile card presentation.
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
 * - desktop table rendering
 * - page startup
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataCards,
  renderStandardDataCard,
} from "../../common/data-view/index.js";

import { getMobileColumns } from "../theoretical-opening.columns.js";

import {
  escapeHtml,
  formatPreviousClose,
  formatTOP,
  formatTOV,
  getDisplayValue,
} from "../shared/theoretical-opening.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

export const THEORETICAL_OPENING_CARDS_SELECTOR =
  "[data-theoretical-opening-mobile-cards]";

const NUMERIC_COLUMN_TYPES = Object.freeze(["price", "quantity"]);

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

function getSectorName(row = {}) {
  return getDisplayValue(row.sectorName, "") || "Other";
}

function getCompanyName(row = {}) {
  return getDisplayValue(row.companyName, "-");
}

function getCompanyCode(row = {}) {
  return getDisplayValue(row.companyCode, "-");
}

/* ==========================================================================
   Mobile Identity
   ========================================================================== */

function renderMobileIdentity(row = {}) {
  const companyName = getCompanyName(row);

  const companyCode = getCompanyCode(row);

  const companyUrl = String(row.companyUrl ?? "").trim();

  const name =
    companyUrl && companyUrl !== "#"
      ? `
          <a
            href="${escapeHtml(companyUrl)}"
            class="data-card__security-name"
          >
            ${escapeHtml(companyName)}
          </a>
        `.trim()
      : `
          <span class="data-card__security-name">
            ${escapeHtml(companyName)}
          </span>
        `.trim();

  return `
    <div class="data-card__security">

      <div class="data-card__security-name-wrap">
        ${name}
      </div>

      <div class="data-card__security-symbol">
        ${escapeHtml(companyCode)}
      </div>

    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Summary
   ========================================================================== */

function renderMobileSummary(row, config = {}) {
  const top = formatTOP(row.top);

  const tov = formatTOV(row.tov, config);

  return `
    <div class="data-card__summary">

      ${renderMobileIdentity(row)}

      <div class="data-card__quote">

        <div class="data-card__quote-primary">
          ${escapeHtml(top)}
        </div>

        <div class="data-card__quote-secondary">
          ${escapeHtml(tov)}
        </div>

      </div>

    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Field Rendering
   ========================================================================== */

export function renderTheoreticalOpeningMobileFieldValue(
  column,
  row,
  config = {},
) {
  const value = row[column.data];

  switch (column?.key || column?.type) {
    case "company":
    case "companyName":
      return renderMobileIdentity(row);

    case "previousClose":
      return escapeHtml(formatPreviousClose(value));

    case "top":
      return escapeHtml(formatTOP(value));

    case "tov":
      return escapeHtml(formatTOV(value, config));

    default:
      return escapeHtml(getDisplayValue(value));
  }
}

/* ==========================================================================
   Mobile Detail Columns
   ========================================================================== */

export function getTheoreticalOpeningMobileDetailColumns(
  config = {},
  view = "1",
) {
  return getMobileColumns(config, view);
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

export function renderTheoreticalOpeningCard(
  row,
  context,
  config = {},
  view = "1",
) {
  const companyName = getCompanyName(row);

  const companyCode = getCompanyCode(row);

  const fields = getTheoreticalOpeningMobileDetailColumns(config, view).map(
    (column) => ({
      label: cleanLabel(column.label, column.key),

      value: renderTheoreticalOpeningMobileFieldValue(column, row, config),

      numeric: NUMERIC_COLUMN_TYPES.includes(column.type),
    }),
  );

  const summary = renderMobileSummary(row, config);

  return renderStandardDataCard({
    idPrefix: "theoretical-opening-card-details",

    rowId: `${companyCode || "company"}-${context.index}`,

    summary,

    fields,

    moreLabel: `${cleanLabel(
      config.labels?.mobile?.showDetails,
      "Show details",
    )} ${companyName}`,

    lessLabel: `${cleanLabel(
      config.labels?.mobile?.hideDetails,
      "Hide details",
    )} ${companyName}`,
  });
}

/* ==========================================================================
   Cards Factory
   ========================================================================== */

export function createTheoreticalOpeningCards({
  root = document,
  config = {},
  view = "1",
} = {}) {
  return createDataCards({
    root,

    container: THEORETICAL_OPENING_CARDS_SELECTOR,

    initialView: view,

    getGroupKey(row) {
      return getSectorName(row);
    },

    renderCard(row, context) {
      return renderTheoreticalOpeningCard(row, context, config, view);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage:
      config.labels?.loadError || "Unable to load Theoretical Opening data.",
  });
}
