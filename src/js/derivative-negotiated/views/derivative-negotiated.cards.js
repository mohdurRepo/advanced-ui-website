/* ==========================================================================
   Derivative Negotiated Cards
   ========================================================================== */

/*
 * Mobile card presentation for Derivative Negotiated Deals.
 *
 * Responsibilities:
 *
 * - render Contract transaction cards
 * - render one daily total card after each date group
 * - group rows consecutively by transaction date
 * - render Contract identity using the shared data-view component
 * - expose progressive-rendering preferences
 *
 * This module intentionally has no:
 *
 * - desktop table schema
 * - DataTables code
 * - breakpoint detection
 * - request code
 * - filter handling
 * - response normalization
 * - page initialization
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  renderStandardCompanyCardIdentity,
  renderStandardDataCard,
} from "../../../common/data-view/index.js";

import {
  escapeHtml,
  normalizeString,
} from "../../issuer-trading/shared/trading-formatters.js";

import {
  createDerivativeNegotiatedFormatters,
  isDerivativeNegotiatedTotalRow,
} from "../derivative-negotiated.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "derivativeNegotiated";

const DEFAULT_BATCH_SIZE = 40;

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createSafeId(value, fallback = "group") {
  const normalized = normalizeString(value)
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getCardLabels(config = {}) {
  const table = isObject(config.labels?.table) ? config.labels.table : {};

  const mobile = isObject(config.labels?.mobile) ? config.labels.mobile : {};

  return Object.freeze({
    contract: normalizeString(table.contract) || "Contract",

    price: normalizeString(table.price) || "Price",

    volume: normalizeString(table.volume) || "Volume Traded",

    value: normalizeString(table.value) || "Value Traded",

    time: normalizeString(table.time) || "Time",

    total: normalizeString(config.labels?.total) || "Total",

    showDetails: normalizeString(mobile.showDetails) || "More details",

    hideDetails: normalizeString(mobile.hideDetails) || "Less details",
  });
}

/* ==========================================================================
   Contract Identity
   ========================================================================== */

function getContractIdentityOptions(config = {}) {
  return Object.freeze({
    logoUrlTemplate: normalizeString(config.assets?.companyLogoUrlTemplate),

    logoFallbackUrl: normalizeString(config.assets?.companyLogoFallbackUrl),
  });
}

function renderContractIdentity(row, config) {
  /*
   * The canonical row deliberately uses companyCode/companyName/companyUrl
   * so the shared Market Watch identity renderer can be reused directly.
   */

  return renderStandardCompanyCardIdentity(
    row,

    getContractIdentityOptions(config),
  );
}

/* ==========================================================================
   Time
   ========================================================================== */

function renderTimeValue(value, rawValue) {
  const normalizedRawValue = normalizeString(rawValue);

  if (!normalizedRawValue) {
    return escapeHtml(value);
  }

  return `
    <time datetime="${escapeHtml(normalizedRawValue)}">
      ${escapeHtml(value)}
    </time>
  `.trim();
}

/* ==========================================================================
   Accessible Summary Value
   ========================================================================== */

function renderSummaryValue({ label, value, valueClassName }) {
  return `
    <span class="data-card__quote-item">
      <span class="visually-hidden">
        ${escapeHtml(label)}:
      </span>

      <span class="${escapeHtml(valueClassName)}">
        ${escapeHtml(value)}
      </span>
    </span>
  `.trim();
}

/* ==========================================================================
   Deal Card
   ========================================================================== */

function renderDealCard({ row, index, config, formatters, labels }) {
  const values = formatters.getCardValues(row);

  const summary = `
    ${renderContractIdentity(row, config)}

    <div class="data-card__quote">
      ${renderSummaryValue({
        label: labels.price,

        value: values.price,

        valueClassName: "data-card__price",
      })}

      ${renderSummaryValue({
        label: labels.value,

        value: values.value,

        valueClassName: "data-card__change",
      })}
    </div>
  `.trim();

  return renderStandardDataCard({
    rowId: row.id || index,

    idPrefix: "derivative-negotiated-details",

    className: "data-card--derivative-negotiated",

    summary,

    fields: [
      {
        label: labels.volume,

        value: escapeHtml(values.volume),

        numeric: true,
      },

      {
        label: labels.time,

        value: renderTimeValue(
          values.time,

          values.timeValue,
        ),

        numeric: true,
      },
    ],

    moreLabel: labels.showDetails,

    lessLabel: labels.hideDetails,
  });
}

/* ==========================================================================
   Daily Total Card
   ========================================================================== */

function renderTotalCard({ row, index, formatters, labels }) {
  const values = formatters.getSummaryValues(row);

  const summary = `
    <div class="data-card__identity">
      <div class="data-card__identity-content">
        <h4 class="data-card__title">
          ${escapeHtml(labels.total)}
        </h4>
      </div>
    </div>

    <div class="data-card__quote">
      ${renderSummaryValue({
        label: labels.volume,

        value: values.volume,

        valueClassName: "data-card__price",
      })}

      ${renderSummaryValue({
        label: labels.value,

        value: values.value,

        valueClassName: "data-card__change",
      })}
    </div>
  `.trim();

  return renderStandardDataCard({
    rowId: row.id || index,

    idPrefix: "derivative-negotiated-total",

    className: "data-card--summary trading-daily-total-card",

    summary,

    expandable: false,
  });
}

/* ==========================================================================
   Card Renderer
   ========================================================================== */

function createCardRenderer({ config, formatters, labels }) {
  return function renderCard(row, context = {}) {
    if (isDerivativeNegotiatedTotalRow(row)) {
      return renderTotalCard({
        row,

        index: context.index,

        formatters,

        labels,
      });
    }

    return renderDealCard({
      row,

      index: context.index,

      config,

      formatters,

      labels,
    });
  };
}

/* ==========================================================================
   Consecutive Date Grouping
   ========================================================================== */

/*
 * Group rows by sequence rather than using a simple Map.
 *
 * A service-provided total row belongs to the immediately preceding
 * transaction group. If the same date appears again after a total row, it
 * starts a new group instead of being merged back into the previous one.
 */

function createCardGroupKeyResolver() {
  let currentDateKey = "";

  let currentGroupKey = "";

  let sequence = 0;

  let groupClosed = false;

  return function getCardGroupKey(row = {}, context = {}) {
    const index = Number(context.index || 0);

    /*
     * Reset grouping state whenever a new complete collection render starts.
     */

    if (index === 0) {
      currentDateKey = "";

      currentGroupKey = "";

      sequence = 0;

      groupClosed = false;
    }

    /*
     * A total always belongs to the currently open transaction-date group.
     */

    if (isDerivativeNegotiatedTotalRow(row)) {
      groupClosed = true;

      return currentGroupKey || `undated-${sequence || 1}`;
    }

    const dateKey =
      normalizeString(row.dateKey) || createSafeId(row.tradeDate, "undated");

    if (!currentGroupKey || groupClosed || dateKey !== currentDateKey) {
      sequence += 1;

      currentDateKey = dateKey;

      currentGroupKey = `${dateKey}-${sequence}`;

      groupClosed = false;
    }

    return currentGroupKey;
  };
}

/* ==========================================================================
   Date Group Label
   ========================================================================== */

function createCardGroupLabel(formatters) {
  return function getCardGroupLabel(_groupKey, rows = []) {
    /*
     * Derive the heading only from a transaction row.
     *
     * A total row is structural summary data and must never become the date
     * heading for the group.
     */

    const firstDealRow = rows.find(
      (row) =>
        !isDerivativeNegotiatedTotalRow(row) && normalizeString(row.tradeDate),
    );

    if (!firstDealRow) {
      return "";
    }

    return formatters.getCardValues(firstDealRow).date;
  };
}

/* ==========================================================================
   Group Renderer
   ========================================================================== */

function createCardGroupRenderer() {
  return function renderCardGroup({ groupKey, groupLabel, cards, groupIndex }) {
    const groupId = [
      "derivative-negotiated-group",

      Number(groupIndex || 0) + 1,

      createSafeId(groupKey),
    ].join("-");

    const heading = groupLabel
      ? `
        <h3
          class="data-card-group__title"
          id="${escapeHtml(groupId)}"
        >
          ${escapeHtml(groupLabel)}
        </h3>
      `.trim()
      : "";

    const relationship = groupLabel
      ? `aria-labelledby="${escapeHtml(groupId)}"`
      : "";

    return `
      <section
        class="data-card-group"
        ${relationship}
        data-data-card-group
      >
        ${heading}

        <div class="data-card-group__items">
          ${cards}
        </div>
      </section>
    `.trim();
  };
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createDerivativeNegotiatedCardsView(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createDerivativeNegotiatedCardsView requires a configuration object.",
    );
  }

  const labels = getCardLabels(config);

  const formatters = createDerivativeNegotiatedFormatters(config);

  const renderCard = createCardRenderer({
    config,

    formatters,

    labels,
  });

  const getCardGroupKey = createCardGroupKeyResolver();

  const getCardGroupLabel = createCardGroupLabel(formatters);

  const renderCardGroup = createCardGroupRenderer();

  return Object.freeze({
    key: VIEW_KEY,

    renderCard,

    getCardGroupKey,

    getCardGroupLabel,

    renderCardGroup,

    cardOptions: Object.freeze({
      progressive: true,

      batchSize: DEFAULT_BATCH_SIZE,
    }),
  });
}
