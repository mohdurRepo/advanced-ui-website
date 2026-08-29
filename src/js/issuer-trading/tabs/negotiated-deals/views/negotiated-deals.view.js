/* ==========================================================================
   Negotiated Deals View
   ========================================================================== */

/*
 * Desktop table and mobile card presentation for Negotiated Deals.
 *
 * Responsibilities:
 *
 * - define the six-column table schema
 * - render table cells
 * - identify and style daily total rows
 * - render standard mobile cards
 * - group mobile cards by trading date
 *
 * This module intentionally has no:
 *
 * - request code
 * - filter event handling
 * - response normalization
 * - DataTables initialization
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
  formatDate,
  formatInputDate,
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

const COLUMN_KEYS = Object.freeze({
  date: "tradeDate",
  company: "company",
  price: "price",
  volume: "volume",
  value: "value",
  time: "tradeTime",
});

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
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

function getTableLabels(config = {}) {
  const labels = config.labels?.negotiatedDeals?.table || {};

  return Object.freeze({
    date: normalizeString(labels.date) || "Date",

    company: normalizeString(labels.company) || "Company",

    price: normalizeString(labels.price) || "Price",

    volume: normalizeString(labels.volume) || "Volume",

    value: normalizeString(labels.value) || "Value",

    time: normalizeString(labels.time) || "Time",

    total: normalizeString(config.labels?.total) || "Total",
  });
}

function getMobileLabels(config = {}) {
  const labels = config.labels?.mobile || {};

  return Object.freeze({
    showDetails: normalizeString(labels.showDetails) || "More details",

    hideDetails: normalizeString(labels.hideDetails) || "Less details",
  });
}

function getCompanyIdentityOptions(config = {}) {
  return Object.freeze({
    logoUrlTemplate: normalizeString(config.assets?.companyLogoUrlTemplate),

    logoFallbackUrl: normalizeString(config.assets?.companyLogoFallbackUrl),
  });
}

function renderLoadingCell() {
  return `
    <span
      class="table-skeleton table-skeleton-md"
      aria-hidden="true"
    ></span>
  `.trim();
}

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
   Column Schema
   ========================================================================== */

function createColumns(labels) {
  return [
    {
      key: COLUMN_KEYS.date,

      label: labels.date,

      className: "table-market__date dt-nowrap",

      headerClassName: "table-market__date dt-nowrap",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.company,

      label: labels.company,

      className: "table-market__company",

      headerClassName: "table-market__company",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.price,

      label: labels.price,

      className: "table-market__price table-market__number",

      headerClassName: "table-market__number",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.volume,

      label: labels.volume,

      className: "table-market__number",

      headerClassName: "table-market__number",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.value,

      label: labels.value,

      className: "table-market__number",

      headerClassName: "table-market__number",

      orderable: false,
    },

    {
      key: COLUMN_KEYS.time,

      label: labels.time,

      className: "table-market__time table-market__number dt-nowrap",

      headerClassName: "table-market__number dt-nowrap",

      orderable: false,
    },
  ];
}

/* ==========================================================================
   Total Row Cell
   ========================================================================== */

function renderTotalCell({ column, row, type, formatters, labels }) {
  switch (column.key) {
    case COLUMN_KEYS.company:
      if (type === "sort" || type === "type") {
        return labels.total;
      }

      if (type === "filter") {
        return [labels.total, normalizeString(row.tradeDate)]
          .filter(Boolean)
          .join(" ");
      }

      return `
        <strong class="table-market__summary-label">
          ${escapeHtml(labels.total)}
        </strong>
      `.trim();

    case COLUMN_KEYS.volume:
      return formatters.table.volume(null, type, row);

    case COLUMN_KEYS.value:
      return formatters.table.value(null, type, row);

    case COLUMN_KEYS.date:
      if (type === "sort" || type === "type") {
        return row.dateSort || "";
      }

      return "";

    default:
      return "";
  }
}

/* ==========================================================================
   Table Cell
   ========================================================================== */

function createCellRenderer({ formatters, labels }) {
  return function renderCell({ row, column, type }) {
    if (row?.__dataViewState === "loading") {
      return renderLoadingCell();
    }

    if (isNegotiatedDealsTotalRow(row)) {
      return renderTotalCell({
        column,
        row,
        type,
        formatters,
        labels,
      });
    }

    switch (column.key) {
      case COLUMN_KEYS.date:
        return formatters.table.date(null, type, row);

      case COLUMN_KEYS.company:
        return formatters.table.company(null, type, row);

      case COLUMN_KEYS.price:
        return formatters.table.price(null, type, row);

      case COLUMN_KEYS.volume:
        return formatters.table.volume(null, type, row);

      case COLUMN_KEYS.value:
        return formatters.table.value(null, type, row);

      case COLUMN_KEYS.time:
        return formatters.table.time(null, type, row);

      default:
        return "";
    }
  };
}

/* ==========================================================================
   Table Row
   ========================================================================== */

function createRowCallback({ formatters, labels }) {
  return function createdRow(rowElement, row) {
    if (!(rowElement instanceof HTMLTableRowElement)) {
      return;
    }

    if (row?.__dataViewState === "loading") {
      rowElement.classList.add("table-market__loading-row");

      return;
    }

    rowElement.dataset.rowType = normalizeString(row?.rowType) || "deal";

    if (row?.dateKey) {
      rowElement.dataset.dateGroup = row.dateKey;
    }

    if (!isNegotiatedDealsTotalRow(row)) {
      return;
    }

    rowElement.classList.add("table-market__summary-row");

    const cells = rowElement.cells;

    cells[0]?.classList.add("table-market__summary-empty");

    cells[1]?.classList.add("table-market__summary-label-cell");

    cells[2]?.classList.add("table-market__summary-empty");

    cells[3]?.classList.add("table-market__summary-value");

    cells[4]?.classList.add("table-market__summary-value");

    cells[5]?.classList.add("table-market__summary-empty");

    const summary = formatters.getSummaryValues(row);

    const ariaLabel = [
      labels.total,
      summary.date,
      labels.volume,
      summary.volume,
      labels.value,
      summary.value,
    ]
      .filter(Boolean)
      .join(" ");

    rowElement.setAttribute("aria-label", ariaLabel);
  };
}

/* ==========================================================================
   Standard Company Card Identity
   ========================================================================== */

function renderCompanyIdentity(row, config) {
  return renderStandardCompanyCardIdentity(
    row,
    getCompanyIdentityOptions(config),
  );
}

/* ==========================================================================
   Deal Card
   ========================================================================== */

function renderDealCard({
  row,
  index,
  config,
  formatters,
  labels,
  mobileLabels,
}) {
  const values = formatters.getCardValues(row);

  const identity = renderCompanyIdentity(row, config);

  const summary = `
    ${identity}

    <div class="data-card__quote">
      <span class="data-card__price">
        ${escapeHtml(values.price)}
      </span>

      <span class="data-card__change">
        ${escapeHtml(values.value)}
      </span>
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

        value: renderTimeValue(values.time, values.timeValue),

        numeric: true,
      },
    ],

    moreLabel: mobileLabels.showDetails,

    lessLabel: mobileLabels.hideDetails,
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
      <span class="data-card__price">
        ${escapeHtml(values.volume)}
      </span>

      <span class="data-card__change">
        ${escapeHtml(values.value)}
      </span>
    </div>
  `.trim();

  return renderStandardDataCard({
    rowId: row.id || index,

    idPrefix: "negotiated-deal-total",

    className: "data-card--summary",

    summary,

    expandable: false,
  });
}

/* ==========================================================================
   Card Renderer
   ========================================================================== */

function createCardRenderer({ config, formatters, labels, mobileLabels }) {
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
      mobileLabels,
    });
  };
}

/* ==========================================================================
   Card Grouping
   ========================================================================== */

function getCardGroupKey(row = {}) {
  return normalizeString(row.dateKey) || "undated";
}

function createCardGroupLabel(formatters) {
  return function getCardGroupLabel(_groupKey, rows = []) {
    const firstRow = rows.find((row) => normalizeString(row.tradeDate));

    if (!firstRow) {
      return "";
    }

    return formatters.getCardValues(firstRow).date;
  };
}

function renderCardGroup({ groupKey, groupLabel, cards }) {
  const groupId = ["negotiated-deals-group", createSafeId(groupKey)].join("-");

  return `
    <section
      class="data-card-group"
      aria-labelledby="${escapeHtml(groupId)}"
      data-data-card-group
    >
      <h3
        class="data-card-group__title"
        id="${escapeHtml(groupId)}"
      >
        ${escapeHtml(groupLabel)}
      </h3>

      <div class="data-card-group__items">
        ${cards}
      </div>
    </section>
  `.trim();
}

/* ==========================================================================
   Public View
   ========================================================================== */

export function createNegotiatedDealsView(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createNegotiatedDealsView requires a configuration object.",
    );
  }

  const labels = getTableLabels(config);

  const mobileLabels = getMobileLabels(config);

  const formatters = createNegotiatedDealsFormatters(config);

  const columns = createColumns(labels);

  const renderCell = createCellRenderer({
    formatters,
    labels,
  });

  const createdRow = createRowCallback({
    formatters,
    labels,
  });

  const renderCard = createCardRenderer({
    config,
    formatters,
    labels,
    mobileLabels,
  });

  const getGroupLabel = createCardGroupLabel(formatters);

  return Object.freeze({
    key: VIEW_KEY,

    columns,

    renderCell,
    renderCard,

    getCardGroupKey,
    getCardGroupLabel: getGroupLabel,
    renderCardGroup,

    tableOptions: Object.freeze({
      paging: false,
      searching: false,
      ordering: false,
      info: false,

      rowGroup: false,

      createdRow,

      rowId(row) {
        return normalizeString(row?.id);
      },
    }),
  });
}
