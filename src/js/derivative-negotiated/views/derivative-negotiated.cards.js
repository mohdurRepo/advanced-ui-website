/* ==========================================================================
   Derivative Negotiated Cards
   ========================================================================== */

/*
 * Mobile card presentation for Derivative Negotiated Deals.
 *
 * Responsibilities:
 *
 * - render Contract transaction cards
 * - render one service-provided daily total card after each date group
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
} from "../../shared/trading/trading-formatters.js";

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

function normalizeIndex(value) {
  const index = Number(value);

  return Number.isFinite(index) && index >= 0 ? index : 0;
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

function renderContractIdentity(row, identityOptions) {
  /*
   * Canonical rows use companyCode/companyName/companyUrl so the shared
   * Market Watch identity renderer can be reused directly for Contracts.
   */

  return renderStandardCompanyCardIdentity(
    row,

    identityOptions,
  );
}

/* ==========================================================================
   Time
   ========================================================================== */

function getMachineTime(value) {
  const normalized = normalizeString(value);

  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return "";
  }

  const hours = Number(match[1]);

  const minutes = Number(match[2]);

  const seconds = Number(match[3] || 0);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return "";
  }

  return [
    String(hours).padStart(2, "0"),

    String(minutes).padStart(2, "0"),

    String(seconds).padStart(2, "0"),
  ].join(":");
}

function renderTimeValue(displayValue, rawValue) {
  const machineTime = getMachineTime(rawValue);

  if (!machineTime) {
    return escapeHtml(displayValue);
  }

  return `
    <time datetime="${escapeHtml(machineTime)}">
      ${escapeHtml(displayValue)}
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

function renderDealCard({ row, index, identityOptions, formatters, labels }) {
  const values = formatters.getCardValues(row);

  const summary = `
    ${renderContractIdentity(row, identityOptions)}

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
    rowId: row.id || `derivative-negotiated-${index + 1}`,

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

  /*
   * Total cards intentionally have no details or toggle.
   *
   * renderStandardDataCard() therefore creates a valid non-expandable card
   * that is ignored by DataViewCard enhancement.
   */

  return renderStandardDataCard({
    rowId: row.id || `derivative-negotiated-total-${index + 1}`,

    idPrefix: "derivative-negotiated-total",

    className: [
      "data-card--summary",

      "trading-daily-total-card",

      "data-card--derivative-negotiated-total",
    ].join(" "),

    summary,

    expandable: false,
  });
}

/* ==========================================================================
   Card Renderer
   ========================================================================== */

function createCardRenderer({ identityOptions, formatters, labels }) {
  return function renderCard(row, context = {}) {
    const index = normalizeIndex(context.index);

    if (isDerivativeNegotiatedTotalRow(row)) {
      return renderTotalCard({
        row,

        index,

        formatters,

        labels,
      });
    }

    return renderDealCard({
      row,

      index,

      identityOptions,

      formatters,

      labels,
    });
  };
}

/* ==========================================================================
   Consecutive Date Grouping
   ========================================================================== */

/*
 * Group rows by sequence instead of merging every matching date through a Map.
 *
 * A service-provided total row belongs to the immediately preceding date
 * group. If the same date appears later after a total row, it begins a new
 * group and is not merged into the completed group.
 */

function createCardGroupKeyResolver() {
  let currentDateKey = "";

  let currentGroupKey = "";

  let sequence = 0;

  let groupClosed = false;

  return function getCardGroupKey(row = {}, context = {}) {
    const index = normalizeIndex(context.index);

    /*
     * A complete collection render always begins at index zero.
     *
     * Reset closure state so refreshes and filter changes cannot reuse the
     * grouping sequence from an earlier result collection.
     */

    if (index === 0) {
      currentDateKey = "";

      currentGroupKey = "";

      sequence = 0;

      groupClosed = false;
    }

    /*
     * A total belongs to the currently open transaction group.
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
     * Derive the heading only from an ordinary transaction.
     *
     * A total row is structural summary data and must never become the group
     * date heading.
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
    const normalizedGroupIndex = normalizeIndex(groupIndex);

    const groupId = [
      "derivative-negotiated-group",

      normalizedGroupIndex + 1,

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
        data-date-group="${escapeHtml(groupKey)}"
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

  /*
   * Build these immutable settings once per view instead of once per card.
   */

  const identityOptions = getContractIdentityOptions(config);

  const renderCard = createCardRenderer({
    identityOptions,

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
      /*
       * Large responses are rendered over multiple animation frames.
       */

      progressive: true,

      batchSize: DEFAULT_BATCH_SIZE,
    }),
  });
}
