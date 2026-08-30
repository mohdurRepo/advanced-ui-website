/* ==========================================================================
   Listed Tradable Rights Formatters
   ========================================================================== */

/*
 * Presentation formatters for:
 *
 * - Listed Tradable Rights desktop table
 * - Listed Tradable Rights mobile cards
 *
 * Responsibilities:
 *
 * - provide DataTables-compatible renderers
 * - preserve service-provided display values
 * - provide numeric values for sorting
 * - render positive, negative, and neutral change states
 * - render the shared Market Watch company identity
 * - provide localized mobile-card values and labels
 *
 * This module intentionally has no:
 *
 * - endpoint code
 * - response normalization
 * - DataTables initialization
 * - card-container rendering
 * - event listeners
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  renderStandardCompanyCardIdentity,
  renderStandardCompanyCell,
} from "../../../../common/data-view/index.js";

import {
  escapeHtml,
  formatNumber,
  formatPrice,
  formatQuantity,
  getChangeClass,
  normalizeString,
} from "../../../shared/trading/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_VALUE = "—";

const DATA_TABLE_TYPES = Object.freeze({
  display: "display",

  filter: "filter",

  sort: "sort",

  type: "type",
});

const METRIC_TYPES = Object.freeze({
  price: "price",

  quantity: "quantity",

  percent: "percent",
});

const DEFAULT_LABELS = Object.freeze({
  tradableRights: "Tradable Rights",

  lastTrade: "Last Trade",

  today: "Today",

  cumulative: "Cumulative",

  bestBid: "Best Bid",

  bestOffer: "Best Offer",

  price: "Price",

  volume: "Volume",

  changeValue: "Change",

  changePercent: "Change %",

  open: "Open",

  high: "High",

  low: "Low",

  numberOfTrades: "Number of Trades",

  volumeTraded: "Volume Traded",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSortRequest(type) {
  return type === DATA_TABLE_TYPES.sort || type === DATA_TABLE_TYPES.type;
}

function isFilterRequest(type) {
  return type === DATA_TABLE_TYPES.filter;
}

function getNumericSortValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function getTextSortValue(value) {
  return normalizeString(value).toLocaleLowerCase();
}

function getCompanyFilterValue(row = {}) {
  return [normalizeString(row.companyName), normalizeString(row.companyCode)]
    .filter(Boolean)
    .join(" ");
}

function getLabel(value, fallback) {
  return normalizeString(value) || fallback;
}

/* ==========================================================================
   Settings
   ========================================================================== */

function getFormatterSettings(config = {}) {
  const configuredLabels = config.labels?.listedTradableRights?.table || {};

  const labels = Object.freeze({
    tradableRights: getLabel(
      configuredLabels.tradableRights,
      DEFAULT_LABELS.tradableRights,
    ),

    lastTrade: getLabel(configuredLabels.lastTrade, DEFAULT_LABELS.lastTrade),

    today: getLabel(configuredLabels.today, DEFAULT_LABELS.today),

    cumulative: getLabel(
      configuredLabels.cumulative,
      DEFAULT_LABELS.cumulative,
    ),

    bestBid: getLabel(configuredLabels.bestBid, DEFAULT_LABELS.bestBid),

    bestOffer: getLabel(configuredLabels.bestOffer, DEFAULT_LABELS.bestOffer),

    price: getLabel(configuredLabels.price, DEFAULT_LABELS.price),

    volume: getLabel(configuredLabels.volume, DEFAULT_LABELS.volume),

    changeValue: getLabel(
      configuredLabels.changeValue,
      DEFAULT_LABELS.changeValue,
    ),

    changePercent: getLabel(
      configuredLabels.changePercent,
      DEFAULT_LABELS.changePercent,
    ),

    open: getLabel(configuredLabels.open, DEFAULT_LABELS.open),

    high: getLabel(configuredLabels.high, DEFAULT_LABELS.high),

    low: getLabel(configuredLabels.low, DEFAULT_LABELS.low),

    numberOfTrades: getLabel(
      configuredLabels.numberOfTrades,
      DEFAULT_LABELS.numberOfTrades,
    ),

    volumeTraded: getLabel(
      configuredLabels.volumeTraded,
      DEFAULT_LABELS.volumeTraded,
    ),
  });

  return Object.freeze({
    locale: normalizeString(config.locale) || DEFAULT_LOCALE,

    emptyValue:
      normalizeString(config.labels?.emptyValue) || DEFAULT_EMPTY_VALUE,

    labels,

    /*
     * The complete configuration is passed to the shared identity renderer.
     * It owns logo-template replacement and fallback handling.
     */

    identityConfig: config,
  });
}

/* ==========================================================================
   Metric Values
   ========================================================================== */

function getMetric(metric) {
  if (!isObject(metric)) {
    return {
      display: "",

      value: null,
    };
  }

  return {
    display: normalizeString(metric.display),

    value:
      typeof metric.value === "number" && Number.isFinite(metric.value)
        ? metric.value
        : null,
  };
}

function formatMetricFallback(metric, metricType, settings) {
  if (metric.value === null) {
    return settings.emptyValue;
  }

  switch (metricType) {
    case METRIC_TYPES.quantity:
      return formatQuantity(metric.value, {
        locale: settings.locale,

        fallback: settings.emptyValue,
      });

    case METRIC_TYPES.percent:
      return `${formatNumber(metric.value, {
        locale: settings.locale,

        minimumFractionDigits: 2,
        maximumFractionDigits: 2,

        fallback: settings.emptyValue,
      })}%`;

    case METRIC_TYPES.price:
    default:
      return formatPrice(metric.value, {
        locale: settings.locale,

        fallback: settings.emptyValue,
      });
  }
}

function getMetricDisplayValue(metric, metricType, settings) {
  const normalizedMetric = getMetric(metric);

  /*
   * Modified service fields remain authoritative.
   *
   * Local formatting is used only when the service did not provide a
   * display value.
   */

  return (
    normalizedMetric.display ||
    formatMetricFallback(normalizedMetric, metricType, settings)
  );
}

function getMetricFilterValue(metric) {
  const normalizedMetric = getMetric(metric);

  if (normalizedMetric.display) {
    return normalizedMetric.display;
  }

  return normalizedMetric.value === null ? "" : String(normalizedMetric.value);
}

/* ==========================================================================
   Generic Metric Renderer
   ========================================================================== */

function formatMetric(metric, type, settings, metricType = METRIC_TYPES.price) {
  const normalizedMetric = getMetric(metric);

  if (isSortRequest(type)) {
    return normalizedMetric.value !== null
      ? getNumericSortValue(normalizedMetric.value)
      : getTextSortValue(normalizedMetric.display);
  }

  if (isFilterRequest(type)) {
    return getMetricFilterValue(normalizedMetric);
  }

  return escapeHtml(
    getMetricDisplayValue(normalizedMetric, metricType, settings),
  );
}

/* ==========================================================================
   Change Renderer
   ========================================================================== */

function formatChangeMetric(
  metric,
  type,
  settings,
  metricType = METRIC_TYPES.price,
) {
  const normalizedMetric = getMetric(metric);

  if (isSortRequest(type)) {
    return normalizedMetric.value !== null
      ? getNumericSortValue(normalizedMetric.value)
      : getTextSortValue(normalizedMetric.display);
  }

  if (isFilterRequest(type)) {
    return getMetricFilterValue(normalizedMetric);
  }

  const displayValue = getMetricDisplayValue(
    normalizedMetric,
    metricType,
    settings,
  );

  const changeClass = getChangeClass(normalizedMetric.value);

  return `
    <span class="${escapeHtml(changeClass)}">
      ${escapeHtml(displayValue)}
    </span>
  `.trim();
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

function formatIdentity(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  if (isSortRequest(type)) {
    return getTextSortValue(row.companyName || row.companyCode);
  }

  if (isFilterRequest(type)) {
    return getCompanyFilterValue(row);
  }

  return renderStandardCompanyCell(row, settings.identityConfig);
}

/* ==========================================================================
   Mobile Label Composition
   ========================================================================== */

function createGroupedLabel(groupLabel, fieldLabel) {
  const group = normalizeString(groupLabel);

  const field = normalizeString(fieldLabel);

  if (!group) {
    return field;
  }

  if (!field) {
    return group;
  }

  return `${group} — ${field}`;
}

function getCardLabels(settings) {
  const { labels } = settings;

  return Object.freeze({
    lastTradePrice: createGroupedLabel(labels.lastTrade, labels.price),

    lastTradeVolume: createGroupedLabel(labels.lastTrade, labels.volume),

    changeValue: createGroupedLabel(labels.lastTrade, labels.changeValue),

    changePercent: createGroupedLabel(labels.lastTrade, labels.changePercent),

    todayOpen: createGroupedLabel(labels.today, labels.open),

    todayHigh: createGroupedLabel(labels.today, labels.high),

    todayLow: createGroupedLabel(labels.today, labels.low),

    numberOfTrades: createGroupedLabel(
      labels.cumulative,
      labels.numberOfTrades,
    ),

    volumeTraded: createGroupedLabel(labels.cumulative, labels.volumeTraded),

    bidPrice: createGroupedLabel(labels.bestBid, labels.price),

    bidVolume: createGroupedLabel(labels.bestBid, labels.volume),

    offerPrice: createGroupedLabel(labels.bestOffer, labels.price),

    offerVolume: createGroupedLabel(labels.bestOffer, labels.volume),
  });
}

/* ==========================================================================
   Mobile Card Values
   ========================================================================== */

function getCardValues(row = {}, settings = {}) {
  const changeValueMetric = getMetric(row.lastTrade?.changeValue);

  const changePercentMetric = getMetric(row.lastTrade?.changePercent);

  return Object.freeze({
    id: normalizeString(row.id),

    companyCode: normalizeString(row.companyCode, settings.emptyValue),

    companyName: normalizeString(row.companyName, settings.emptyValue),

    companyUrl: normalizeString(row.companyUrl),

    lastTrade: Object.freeze({
      price: getMetricDisplayValue(
        row.lastTrade?.price,
        METRIC_TYPES.price,
        settings,
      ),

      volume: getMetricDisplayValue(
        row.lastTrade?.volume,
        METRIC_TYPES.quantity,
        settings,
      ),

      changeValue: getMetricDisplayValue(
        changeValueMetric,
        METRIC_TYPES.price,
        settings,
      ),

      changePercent: getMetricDisplayValue(
        changePercentMetric,
        METRIC_TYPES.percent,
        settings,
      ),

      changeValueClass: getChangeClass(changeValueMetric.value),

      changePercentClass: getChangeClass(changePercentMetric.value),
    }),

    today: Object.freeze({
      open: getMetricDisplayValue(
        row.today?.open,
        METRIC_TYPES.price,
        settings,
      ),

      high: getMetricDisplayValue(
        row.today?.high,
        METRIC_TYPES.price,
        settings,
      ),

      low: getMetricDisplayValue(row.today?.low, METRIC_TYPES.price, settings),
    }),

    cumulative: Object.freeze({
      numberOfTrades: getMetricDisplayValue(
        row.cumulative?.numberOfTrades,
        METRIC_TYPES.quantity,
        settings,
      ),

      volumeTraded: getMetricDisplayValue(
        row.cumulative?.volumeTraded,
        METRIC_TYPES.quantity,
        settings,
      ),
    }),

    bestBid: Object.freeze({
      price: getMetricDisplayValue(
        row.bestBid?.price,
        METRIC_TYPES.price,
        settings,
      ),

      volume: getMetricDisplayValue(
        row.bestBid?.volume,
        METRIC_TYPES.quantity,
        settings,
      ),
    }),

    bestOffer: Object.freeze({
      price: getMetricDisplayValue(
        row.bestOffer?.price,
        METRIC_TYPES.price,
        settings,
      ),

      volume: getMetricDisplayValue(
        row.bestOffer?.volume,
        METRIC_TYPES.quantity,
        settings,
      ),
    }),
  });
}

/* ==========================================================================
   Bound Formatter Collection
   ========================================================================== */

export function createListedTradableRightsFormatters(config = {}) {
  const settings = getFormatterSettings(config);

  const cardLabels = getCardLabels(settings);

  function renderIdentity(_data, type, row) {
    return formatIdentity(row, type, settings);
  }

  function renderLastTradePrice(_data, type, row) {
    return formatMetric(
      row.lastTrade?.price,
      type,
      settings,
      METRIC_TYPES.price,
    );
  }

  function renderLastTradeVolume(_data, type, row) {
    return formatMetric(
      row.lastTrade?.volume,
      type,
      settings,
      METRIC_TYPES.quantity,
    );
  }

  function renderChangeValue(_data, type, row) {
    return formatChangeMetric(
      row.lastTrade?.changeValue,
      type,
      settings,
      METRIC_TYPES.price,
    );
  }

  function renderChangePercent(_data, type, row) {
    return formatChangeMetric(
      row.lastTrade?.changePercent,
      type,
      settings,
      METRIC_TYPES.percent,
    );
  }

  function renderTodayOpen(_data, type, row) {
    return formatMetric(row.today?.open, type, settings, METRIC_TYPES.price);
  }

  function renderTodayHigh(_data, type, row) {
    return formatMetric(row.today?.high, type, settings, METRIC_TYPES.price);
  }

  function renderTodayLow(_data, type, row) {
    return formatMetric(row.today?.low, type, settings, METRIC_TYPES.price);
  }

  function renderNumberOfTrades(_data, type, row) {
    return formatMetric(
      row.cumulative?.numberOfTrades,
      type,
      settings,
      METRIC_TYPES.quantity,
    );
  }

  function renderVolumeTraded(_data, type, row) {
    return formatMetric(
      row.cumulative?.volumeTraded,
      type,
      settings,
      METRIC_TYPES.quantity,
    );
  }

  function renderBidPrice(_data, type, row) {
    return formatMetric(row.bestBid?.price, type, settings, METRIC_TYPES.price);
  }

  function renderBidVolume(_data, type, row) {
    return formatMetric(
      row.bestBid?.volume,
      type,
      settings,
      METRIC_TYPES.quantity,
    );
  }

  function renderOfferPrice(_data, type, row) {
    return formatMetric(
      row.bestOffer?.price,
      type,
      settings,
      METRIC_TYPES.price,
    );
  }

  function renderOfferVolume(_data, type, row) {
    return formatMetric(
      row.bestOffer?.volume,
      type,
      settings,
      METRIC_TYPES.quantity,
    );
  }

  return Object.freeze({
    settings,

    labels: cardLabels,

    table: Object.freeze({
      identity: renderIdentity,

      lastTradePrice: renderLastTradePrice,
      lastTradeVolume: renderLastTradeVolume,
      changeValue: renderChangeValue,
      changePercent: renderChangePercent,

      todayOpen: renderTodayOpen,
      todayHigh: renderTodayHigh,
      todayLow: renderTodayLow,

      numberOfTrades: renderNumberOfTrades,
      volumeTraded: renderVolumeTraded,

      bidPrice: renderBidPrice,
      bidVolume: renderBidVolume,

      offerPrice: renderOfferPrice,
      offerVolume: renderOfferVolume,
    }),

    renderCardIdentity(row) {
      return renderStandardCompanyCardIdentity(row, settings.identityConfig);
    },

    getCardValues(row) {
      return getCardValues(row, settings);
    },
  });
}
