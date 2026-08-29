/* ==========================================================================
   Negotiated Deals Cards
   ========================================================================== */

/*
 * Mobile card presentation for Negotiated Deals.
 *
 * Responsibilities:
 *
 * - render the mobile column guide
 * - render company transaction cards
 * - render one total summary after each date group
 * - group rows consecutively by trading date
 * - ignore legacy total-row date markup
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
 * - tab lifecycle code
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  renderStandardCompanyCardIdentity,
  renderStandardDataCard,
} from "../../../../../common/data-view/index.js";

import {
  escapeHtml,
  normalizeString,
} from "../../../shared/trading-formatters.js";

import {
  createNegotiatedDealsFormatters,
  isNegotiatedDealsTotalRow,
} from "../negotiated-deals.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "negotiatedDeals";

const DEFAULT_BATCH_SIZE = 40;

/* ==========================================================================
   Helpers
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
  const table = config.labels?.negotiatedDeals?.table || {};

  const mobile = config.labels?.mobile || {};

  return Object.freeze({
    company: normalizeString(table.company) || "Company",

    price: normalizeString(table.price) || "Price",

    volume: normalizeString(table.volume) || "Volume",

    value: normalizeString(table.value) || "Value",

    time: normalizeString(table.time) || "Time",

    total: normalizeString(config.labels?.total) || "Total",

    showDetails: normalizeString(mobile.showDetails) || "More details",

    hideDetails: normalizeString(mobile.hideDetails) || "Less details",
  });
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

function getCompanyIdentityOptions(config = {}) {
  return Object.freeze({
    logoUrlTemplate: normalizeString(config.assets?.companyLogoUrlTemplate),

    logoFallbackUrl: normalizeString(config.assets?.companyLogoFallbackUrl),
  });
}

function renderCompanyIdentity(row, config) {
  return renderStandardCompanyCardIdentity(
    row,

    getCompanyIdentityOptions(config),
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
   Mobile Column Guide
   ========================================================================== */

function renderColumnGuide(labels) {
  return `
    <div class="data-card-list__header">
      <span class="data-card-list__header-start">
        ${escapeHtml(labels.company)}
      </span>

      <span class="data-card-list__header-end">
        ${escapeHtml(labels.price)}
        /
        ${escapeHtml(labels.value)}
      </span>
    </div>
  `.trim();
}

/* ==========================================================================
   Deal Card
   ========================================================================== */

function renderDealCard({ row, index, config, formatters, labels }) {
  const values = formatters.getCardValues(row);

  const summary = `
    ${renderCompanyIdentity(row, config)}

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

    idPrefix: "negotiated-deal-details",

    className: "data-card--negotiated-deal",

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
   Total Card
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

    idPrefix: "negotiated-deal-total",

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
    if (isNegotiatedDealsTotalRow(row)) {
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
 * Generic Map grouping is insufficient for this response because legacy total
 * rows may contain values such as:
 *
 * <strong>Total</strong>
 *
 * A total belongs structurally to the date group immediately before it.
 *
 * The generated key includes a sequence number so non-contiguous occurrences
 * of the same date remain separate groups.
 */

function createCardGroupKeyResolver() {
  let currentDateKey = "";

  let currentGroupKey = "";

  let sequence = 0;

  let groupClosed = false;

  return function getCardGroupKey(row = {}, context = {}) {
    const index = Number(context.index || 0);

    /*
     * Reset closure state at the start of every complete collection render.
     */

    if (index === 0) {
      currentDateKey = "";

      currentGroupKey = "";

      sequence = 0;

      groupClosed = false;
    }

    /*
     * Never use a total row's raw date or dateKey.
     *
     * It always belongs to the currently open date group.
     */

    if (isNegotiatedDealsTotalRow(row)) {
      groupClosed = true;

      return currentGroupKey || `undated-${sequence || 1}`;
    }

    const dateKey =
      normalizeString(row.dateKey) || createSafeId(row.tradeDate, "undated");

    /*
     * Start a new group when:
     *
     * - the trading date changes;
     * - the previous group was closed by a total row;
     * - this is the first transaction.
     */

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
     * Only a transaction row may provide the date heading.
     *
     * Total rows are intentionally excluded because their legacy values may
     * contain HTML presentation markup instead of a date.
     */

    const firstDealRow = rows.find(
      (row) =>
        !isNegotiatedDealsTotalRow(row) && normalizeString(row.tradeDate),
    );

    if (!firstDealRow) {
      return "";
    }

    return formatters.getCardValues(firstDealRow).date;
  };
}

/* ==========================================================================
   Date Group
   ========================================================================== */

function createCardGroupRenderer(labels) {
  return function renderCardGroup({ groupKey, groupLabel, cards, groupIndex }) {
    const groupId = [
      "negotiated-deals-group",

      Number(groupIndex || 0) + 1,

      createSafeId(groupKey),
    ].join("-");

    const columnGuide =
      Number(groupIndex || 0) === 0 ? renderColumnGuide(labels) : "";

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
      ${columnGuide}

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

export function createNegotiatedDealsCardsView(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createNegotiatedDealsCardsView requires a configuration object.",
    );
  }

  const labels = getCardLabels(config);

  const formatters = createNegotiatedDealsFormatters(config);

  const renderCard = createCardRenderer({
    config,

    formatters,

    labels,
  });

  const getCardGroupKey = createCardGroupKeyResolver();

  const getCardGroupLabel = createCardGroupLabel(formatters);

  const renderCardGroup = createCardGroupRenderer(labels);

  return Object.freeze({
    key: VIEW_KEY,

    renderCard,

    getCardGroupKey,

    getCardGroupLabel,

    renderCardGroup,

    /*
     * These preferences will be consumed by the responsive/progressive card
     * coordinator added in the next step.
     */

    cardOptions: Object.freeze({
      progressive: true,

      batchSize: DEFAULT_BATCH_SIZE,
    }),
  });
}
