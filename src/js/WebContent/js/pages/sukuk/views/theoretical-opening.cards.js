/* ==========================================================================
   Theoretical Opening Cards View
   ========================================================================== */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataCards,
  renderStandardCompanyCardIdentity,
  renderStandardDataCard,
} from "../../../common/data-view/index.js";

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
   Identity
   ========================================================================== */

function renderMobileIdentity(row, config) {
  return renderStandardCompanyCardIdentity(row, config);
}

/* ==========================================================================
   TOP / TOV Summary
   ========================================================================== */

function renderMobileQuote(row, config = {}) {
  const top = formatTOP(row.top);

  const tov = formatTOV(row.tov, config);

  return `
    <div class="data-card__quote">

      <span class="data-card__price">
        ${escapeHtml(top)}
      </span>

      <span class="data-card__change">
        ${escapeHtml(tov)}
      </span>

    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Values
   ========================================================================== */

export function renderTheoreticalOpeningMobileFieldValue(
  column,
  row,
  config = {},
) {
  const value = row[column.data];

  switch (column?.key || column?.type) {
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
   Detail Columns
   ========================================================================== */

export function getTheoreticalOpeningMobileDetailColumns(
  config = {},
  view = "1",
  visibleGroups = [],
) {
  const visibleSet = new Set(visibleGroups);

  return getMobileColumns(config, view).filter((column) => {
    if (!column.group) {
      return true;
    }

    return visibleSet.has(column.group);
  });
}

/* ==========================================================================
   Card
   ========================================================================== */

export function renderTheoreticalOpeningCard(
  row,
  context,
  config = {},
  view = "1",
  visibleGroups = [],
) {
  const companyName = getCompanyName(row);

  const companyCode = getCompanyCode(row);

  const fields = getTheoreticalOpeningMobileDetailColumns(
    config,
    view,
    visibleGroups,
  ).map((column) => ({
    label: cleanLabel(column.label, column.key),

    value: renderTheoreticalOpeningMobileFieldValue(column, row, config),

    numeric: NUMERIC_COLUMN_TYPES.includes(column.type),
  }));

  const summary = `
    ${renderMobileIdentity(row, config)}

    ${renderMobileQuote(row, config)}
  `.trim();

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
   Factory
   ========================================================================== */

export function createTheoreticalOpeningCards({
  root = document,
  config = {},
  view = "1",
  getVisibleGroups = () => [],
} = {}) {
  return createDataCards({
    root,

    container: THEORETICAL_OPENING_CARDS_SELECTOR,

    initialView: view,

    getGroupKey(row) {
      return getSectorName(row);
    },

    renderCard(row, context) {
      return renderTheoreticalOpeningCard(
        row,
        context,
        config,
        view,
        getVisibleGroups(),
      );
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage:
      config.labels?.loadError || "Unable to load Theoretical Opening data.",
  });
}
