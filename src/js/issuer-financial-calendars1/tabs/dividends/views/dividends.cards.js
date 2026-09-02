/* ==========================================================================
   Dividends Cards
   ========================================================================== */

/*
 * Mobile card presentation for the Dividends calendar.
 *
 * Responsibilities:
 *
 * - render the standard company identity
 * - expose the dividend amount in the card summary
 * - render announcement and due dates
 * - render distribution method and date
 * - provide progressive rendering for large result sets
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - event listeners
 * - request code
 * - response normalization
 * - filter handling
 * - breakpoint logic
 *
 * Expand and collapse behavior remains owned by the shared DataViewCard
 * component.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { renderStandardDataCard } from "../../../../../common/data-view/index.js";

import { createFinancialCalendarFormatters } from "../../../shared/financial-calendar-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "dividends";

const DEFAULT_BATCH_SIZE = 40;

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getLabels(config = {}) {
  const table = config.labels?.dividends?.table || {};

  const mobile = config.labels?.mobile || {};

  return Object.freeze({
    amount: normalizeString(table.amount, "Amount"),

    announcementDate: normalizeString(
      table.announcementDate,
      "Announcement Date",
    ),

    dueDate: normalizeString(table.dueDate, "Due Date"),

    distributionMethod: normalizeString(
      table.distributionMethod,
      "Distribution Method",
    ),

    distributionDate: normalizeString(
      table.distributionDate,
      "Distribution Date",
    ),

    showDetails: normalizeString(mobile.showDetails, "More details"),

    hideDetails: normalizeString(mobile.hideDetails, "Less details"),
  });
}

/* ==========================================================================
   Amount
   ========================================================================== */

function renderAmount(row, formatters) {
  const value = row?.amountValue;

  const capitalValue =
    value === null || value === undefined ? "" : `SAR:${value}`;

  return formatters.formatCapital(capitalValue);
}

/* ==========================================================================
   Accessible Summary Value
   ========================================================================== */

function renderSummaryValue({ label, value }) {
  return `
    <span class="data-card__quote-item">
      <span class="visually-hidden">
        ${escapeHtml(label)}:
      </span>

      <span class="data-card__price">
        ${value}
      </span>
    </span>
  `.trim();
}

/* ==========================================================================
   Card Summary
   ========================================================================== */

function renderCardSummary(row, formatters, labels) {
  return `
    ${formatters.renderCompanyCardIdentity(row)}

    <div class="data-card__quote">
      ${renderSummaryValue({
        label: labels.amount,

        value: renderAmount(row, formatters),
      })}
    </div>
  `.trim();
}

/* ==========================================================================
   Card Fields
   ========================================================================== */

function createCardFields(row, formatters, labels) {
  return [
    {
      label: labels.announcementDate,

      value: formatters.card.date(row?.announcementDate),

      valueClassName: "dividends-card__date-value",
    },

    {
      label: labels.dueDate,

      value: formatters.card.date(row?.dueDate),

      valueClassName: "dividends-card__date-value",
    },

    {
      label: labels.distributionMethod,

      value: formatters.card.text(row?.distributionMethod),

      valueClassName: "dividends-card__method-value",
    },

    {
      label: labels.distributionDate,

      value: formatters.card.date(row?.distributionDate),

      valueClassName: "dividends-card__date-value",
    },
  ];
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createDividendsCards(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createDividendsCards requires a configuration object.",
    );
  }

  const labels = getLabels(config);

  const formatters = createFinancialCalendarFormatters(config);

  function renderCard(input = {}) {
    const row = input.row || {};

    const parsedIndex = Number(input.index);

    const index = Number.isFinite(parsedIndex) ? parsedIndex : 0;

    return renderStandardDataCard({
      rowId: row.id || `${VIEW_KEY}-${index + 1}`,

      idPrefix: "dividends-details",

      className: "data-card--dividends",

      summary: renderCardSummary(row, formatters, labels),

      fields: createCardFields(row, formatters, labels),

      moreLabel: labels.showDetails,

      lessLabel: labels.hideDetails,
    });
  }

  return Object.freeze({
    key: VIEW_KEY,

    renderCard,

    cardOptions: Object.freeze({
      progressive: true,

      batchSize: DEFAULT_BATCH_SIZE,
    }),
  });
}
