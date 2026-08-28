/* ==========================================================================
   Company Status Cards
   ========================================================================== */

/*
 * Mobile card presentation for the Company Status tab.
 *
 * Responsibilities:
 *
 * - render company identity using the shared Market Watch pattern
 * - render the selected company-status type
 * - expose the primary date in the card summary
 * - render suspension period details
 * - render delisting date details
 * - render the announcement or reason link
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - event listeners
 * - request code
 * - filter handling
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

import { COMPANY_STATUS_VIEWS } from "../company-status.filters.js";

import { createCompanyStatusFormatters } from "../company-status.formatters.js";

import {
  escapeHtml,
  normalizeString,
} from "../../../shared/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_EMPTY_VALUE = "—";

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSuspensionView(view) {
  return (
    normalizeString(view).toLowerCase() ===
    String(COMPANY_STATUS_VIEWS.SUSPENSION).toLowerCase()
  );
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getLabels(config = {}) {
  const companyStatus = config.labels?.companyStatus || {};

  const table = companyStatus.table || {};

  const types = companyStatus.types || {};

  const mobile = config.labels?.mobile || {};

  return Object.freeze({
    emptyValue:
      normalizeString(config.labels?.emptyValue) || DEFAULT_EMPTY_VALUE,

    from: normalizeString(table.from, "From"),

    to: normalizeString(table.to, "To"),

    delistingDate: normalizeString(table.delistingDate, "Delisting Date"),

    suspensionReason: normalizeString(table.suspensionReason, "Reason"),

    delistingReason: normalizeString(table.delistingReason, "Reason"),

    suspension: normalizeString(types.suspension, "Suspension"),

    delisting: normalizeString(types.delisting, "Delisting"),

    suspensionFunds: normalizeString(types.suspensionFunds, "Suspended Funds"),

    delistedFunds: normalizeString(types.delistedFunds, "Delisted Funds"),

    showDetails: normalizeString(mobile.showDetails) || "More details",

    hideDetails: normalizeString(mobile.hideDetails) || "Less details",
  });
}

/* ==========================================================================
   Type Label
   ========================================================================== */

function getTypeLabel(row = {}, labels) {
  switch (normalizeString(row.formType)) {
    case "Suspension":
      return labels.suspension;

    case "Delisting":
      return labels.delisting;

    case "Suspension_Funds":
      return labels.suspensionFunds;

    case "Delisted_Funds":
      return labels.delistedFunds;

    default:
      return isSuspensionView(row.view) ? labels.suspension : labels.delisting;
  }
}

/* ==========================================================================
   Summary Date
   ========================================================================== */

function getSummaryDate(row, formatters, labels) {
  if (!isSuspensionView(formatters.getView(row))) {
    return formatters.formatCardDate(row?.delistingDate ?? row?.period?.from);
  }

  const fromDate = formatters.formatCardDate(row?.period?.from);

  const toDate = formatters.formatCardDate(row?.period?.to);

  if (fromDate === labels.emptyValue && toDate === labels.emptyValue) {
    return labels.emptyValue;
  }

  if (fromDate === labels.emptyValue) {
    return toDate;
  }

  if (toDate === labels.emptyValue) {
    return fromDate;
  }

  return `${fromDate} – ${toDate}`;
}

/* ==========================================================================
   Card Summary
   ========================================================================== */

function renderCardSummary(row, formatters, labels) {
  const typeLabel = getTypeLabel(row, labels);

  const summaryDate = getSummaryDate(row, formatters, labels);

  return `
    <div class="company-status-card__summary">
      ${formatters.renderCardIdentity(row)}

      <div class="company-status-card__meta">
        <span class="company-status-card__type">
          ${escapeHtml(typeLabel)}
        </span>

        <span class="company-status-card__date">
          ${escapeHtml(summaryDate)}
        </span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Suspension Fields
   ========================================================================== */

function createSuspensionFields(row, formatters, labels) {
  return [
    {
      label: labels.from,

      value: formatters.renderCardDate(row?.period?.from),

      valueClassName: "company-status-card__date-value",
    },

    {
      label: labels.to,

      value: formatters.renderCardDate(row?.period?.to),

      valueClassName: "company-status-card__date-value",
    },

    {
      label: labels.suspensionReason,

      value: formatters.renderCardAnnouncement(row),

      className: "company-status-card__announcement-field",

      valueClassName: "company-status-card__announcement-value",

      fullWidth: true,
    },
  ];
}

/* ==========================================================================
   Delisting Fields
   ========================================================================== */

function createDelistingFields(row, formatters, labels) {
  return [
    {
      label: labels.delistingDate,

      value: formatters.renderCardDate(row?.delistingDate ?? row?.period?.from),

      valueClassName: "company-status-card__date-value",

      fullWidth: true,
    },

    {
      label: labels.delistingReason,

      value: formatters.renderCardAnnouncement(row),

      className: "company-status-card__announcement-field",

      valueClassName: "company-status-card__announcement-value",

      fullWidth: true,
    },
  ];
}

/* ==========================================================================
   Card Fields
   ========================================================================== */

function createCardFields(row, formatters, labels) {
  return isSuspensionView(formatters.getView(row))
    ? createSuspensionFields(row, formatters, labels)
    : createDelistingFields(row, formatters, labels);
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createCompanyStatusCards(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createCompanyStatusCards requires a configuration object.",
    );
  }

  const labels = getLabels(config);

  const formatters = createCompanyStatusFormatters(config);

  function renderCard(input = {}) {
    const row = input.row || {};

    const index = Number(input.index || 0);

    const view = formatters.getView(row);

    return renderStandardDataCard({
      rowId: row.id || `company-status-${view}-${index + 1}`,

      idPrefix: "company-status-details",

      className: [
        "data-card--company-status",

        isSuspensionView(view)
          ? "data-card--company-status-suspension"
          : "data-card--company-status-delisting",
      ].join(" "),

      summary: renderCardSummary(row, formatters, labels),

      fields: createCardFields(row, formatters, labels),

      moreLabel: labels.showDetails,

      lessLabel: labels.hideDetails,
    });
  }

  return Object.freeze({
    renderCard,
  });
}
