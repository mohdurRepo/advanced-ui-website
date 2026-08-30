/* ==========================================================================
   Derivative Negotiated Formatters
   ========================================================================== */

/*
 * Presentation formatters for Derivative Negotiated Deals.
 *
 * Responsibilities:
 *
 * - provide DataTables-compatible orthogonal renderers
 * - preserve service-provided dates for display
 * - provide normalized values for sorting and filtering
 * - render Contract identity using the shared data-view renderer
 * - format prices, volumes, values, and times
 * - preserve legacy numeric sentinel behavior
 * - provide normalized values for mobile cards
 * - provide daily total presentation values
 *
 * This module intentionally has no:
 *
 * - endpoint configuration
 * - request transport
 * - response normalization
 * - DataTables initialization
 * - card collection rendering
 * - DOM queries
 * - event listeners
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { renderStandardCompanyCell } from "../../common/data-view/index.js";

import {
  escapeHtml,
  formatInputDate,
  formatMoney,
  formatPrice,
  formatQuantity,
  formatTime,
  getDisplayValue,
  normalizeString,
  toNumber,
} from "../shared/trading/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_VALUE = "—";

const DEFAULT_TOTAL_LABEL = "Total";

const LEGACY_EMPTY_MONEY_VALUE = -1;

const DATA_TABLE_TYPES = Object.freeze({
  display: "display",

  filter: "filter",

  sort: "sort",

  type: "type",
});

/* ==========================================================================
   General Helpers
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

function getEmptyValue(settings = {}) {
  return normalizeString(settings.emptyValue) || DEFAULT_EMPTY_VALUE;
}

function getNumericSortValue(value) {
  const number = toNumber(value);

  return number === null ? "" : number;
}

function getTextSortValue(value) {
  return normalizeString(value).toLocaleLowerCase();
}

/* ==========================================================================
   Time Metadata
   ========================================================================== */

function getTimeParts(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return null;
  }

  const match = normalized.match(
    /(?:^|[T\s])(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/,
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);

  const minutes = Number(match[2]);

  const seconds = Number(match[3] || 0);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return {
    hours,

    minutes,

    seconds,
  };
}

function getTimeSortValue(value) {
  const parts = getTimeParts(value);

  if (!parts) {
    return normalizeString(value);
  }

  return parts.hours * 3600 + parts.minutes * 60 + parts.seconds;
}

function getMachineTime(value) {
  const parts = getTimeParts(value);

  if (!parts) {
    return "";
  }

  return [
    String(parts.hours).padStart(2, "0"),

    String(parts.minutes).padStart(2, "0"),

    String(parts.seconds).padStart(2, "0"),
  ].join(":");
}

/* ==========================================================================
   Formatter Settings
   ========================================================================== */

function getFormatterSettings(config = {}) {
  const normalizedConfig = isObject(config) ? config : {};

  const locale = normalizeString(normalizedConfig.locale) || DEFAULT_LOCALE;

  const emptyValue =
    normalizeString(normalizedConfig.labels?.emptyValue) || DEFAULT_EMPTY_VALUE;

  const totalLabel =
    normalizeString(normalizedConfig.labels?.total) || DEFAULT_TOTAL_LABEL;

  return Object.freeze({
    locale,

    emptyValue,

    totalLabel,

    contractIdentity: Object.freeze({
      logoUrlTemplate: normalizeString(
        normalizedConfig.assets?.companyLogoUrlTemplate,
      ),

      logoFallbackUrl: normalizeString(
        normalizedConfig.assets?.companyLogoFallbackUrl,
      ),
    }),
  });
}

/* ==========================================================================
   Row Detection
   ========================================================================== */

export function isDerivativeNegotiatedTotalRow(row = {}) {
  return row?.rowType === "total";
}

export function isDerivativeNegotiatedDealRow(row = {}) {
  return row?.rowType === "deal";
}

/* ==========================================================================
   Contract Filter Value
   ========================================================================== */

function getContractFilterValue(row = {}) {
  return [normalizeString(row.companyName), normalizeString(row.companyCode)]
    .filter(Boolean)
    .join(" ");
}

/* ==========================================================================
   Legacy Numeric Display Rules
   ========================================================================== */

/*
 * The legacy service uses numeric sentinel values:
 *
 * - 0  -> configured empty value
 * - -1 -> intentionally empty monetary cell
 *
 * These rules affect display only. Raw numeric values remain available for
 * DataTables orthogonal sorting and filtering.
 */

function isLegacyEmptyMoneyValue(value) {
  return toNumber(value) === LEGACY_EMPTY_MONEY_VALUE;
}

function formatDisplayPrice(value, settings = {}) {
  if (isLegacyEmptyMoneyValue(value)) {
    return "";
  }

  return formatPrice(value, {
    locale: settings.locale,

    fallback: getEmptyValue(settings),

    zeroAsFallback: true,
  });
}

function formatDisplayQuantity(value, settings = {}) {
  return formatQuantity(value, {
    locale: settings.locale,

    fallback: getEmptyValue(settings),

    zeroAsFallback: true,
  });
}

function formatDisplayMoney(value, settings = {}) {
  if (isLegacyEmptyMoneyValue(value)) {
    return "";
  }

  return formatMoney(value, {
    locale: settings.locale,

    fallback: getEmptyValue(settings),

    zeroAsFallback: true,
  });
}

/* ==========================================================================
   Date
   ========================================================================== */

/*
 * The visible value is always the exact service-provided date.
 *
 * formatInputDate() is used only to create optional machine-readable metadata.
 * Failure to parse the date never changes or removes the displayed value.
 */

export function formatDerivativeNegotiatedDate(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  const rawDate = normalizeString(row.tradeDate);

  if (isSortRequest(type)) {
    return row.dateSort ?? "";
  }

  if (isFilterRequest(type)) {
    return rawDate;
  }

  if (isDerivativeNegotiatedTotalRow(row)) {
    return "";
  }

  if (!rawDate) {
    return escapeHtml(getEmptyValue(settings));
  }

  const machineDate = formatInputDate(rawDate, "");

  if (!machineDate) {
    return escapeHtml(rawDate);
  }

  return `
    <time datetime="${escapeHtml(machineDate)}">
      ${escapeHtml(rawDate)}
    </time>
  `.trim();
}

/* ==========================================================================
   Contract
   ========================================================================== */

export function formatDerivativeNegotiatedContract(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  if (isSortRequest(type)) {
    return getTextSortValue(row.companyName || row.companyCode);
  }

  if (isFilterRequest(type)) {
    return getContractFilterValue(row);
  }

  if (isDerivativeNegotiatedTotalRow(row)) {
    return "";
  }

  return renderStandardCompanyCell(row, {
    logoUrlTemplate: settings.contractIdentity?.logoUrlTemplate,

    logoFallbackUrl: settings.contractIdentity?.logoFallbackUrl,
  });
}

/* ==========================================================================
   Price
   ========================================================================== */

export function formatDerivativeNegotiatedPrice(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  if (isSortRequest(type)) {
    return getNumericSortValue(row.price);
  }

  if (isFilterRequest(type)) {
    return row.price == null ? "" : String(row.price);
  }

  if (isDerivativeNegotiatedTotalRow(row)) {
    return "";
  }

  return escapeHtml(formatDisplayPrice(row.price, settings));
}

/* ==========================================================================
   Volume
   ========================================================================== */

export function formatDerivativeNegotiatedVolume(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  if (isSortRequest(type)) {
    return getNumericSortValue(row.volume);
  }

  if (isFilterRequest(type)) {
    return row.volume == null ? "" : String(row.volume);
  }

  /*
   * Volume is available for both transaction rows and service total rows.
   */

  return escapeHtml(formatDisplayQuantity(row.volume, settings));
}

/* ==========================================================================
   Value
   ========================================================================== */

export function formatDerivativeNegotiatedValue(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  if (isSortRequest(type)) {
    return getNumericSortValue(row.value);
  }

  if (isFilterRequest(type)) {
    return row.value == null ? "" : String(row.value);
  }

  /*
   * Value is available for both transaction rows and service total rows.
   */

  return escapeHtml(formatDisplayMoney(row.value, settings));
}

/* ==========================================================================
   Time
   ========================================================================== */

export function formatDerivativeNegotiatedTime(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  const rawTime = normalizeString(row.tradeTime);

  if (isSortRequest(type)) {
    return getTimeSortValue(rawTime);
  }

  if (isFilterRequest(type)) {
    return rawTime;
  }

  if (isDerivativeNegotiatedTotalRow(row)) {
    return "";
  }

  if (!rawTime) {
    return escapeHtml(getEmptyValue(settings));
  }

  const displayTime = formatTime(rawTime, {
    locale: settings.locale,

    fallback: getEmptyValue(settings),
  });

  const machineTime = getMachineTime(rawTime);

  if (!machineTime) {
    return escapeHtml(displayTime);
  }

  return `
    <time datetime="${escapeHtml(machineTime)}">
      ${escapeHtml(displayTime)}
    </time>
  `.trim();
}

/* ==========================================================================
   Daily Total Values
   ========================================================================== */

export function getDerivativeNegotiatedSummaryValues(row = {}, settings = {}) {
  const rawDate = normalizeString(row.tradeDate);

  return Object.freeze({
    label: normalizeString(settings.totalLabel) || DEFAULT_TOTAL_LABEL,

    date: rawDate || getEmptyValue(settings),

    dateValue: rawDate,

    dateIso: formatInputDate(rawDate, ""),

    volume: formatDisplayQuantity(row.volume, settings),

    value: formatDisplayMoney(row.value, settings),
  });
}

/* ==========================================================================
   Mobile Card Values
   ========================================================================== */

export function getDerivativeNegotiatedCardValues(row = {}, settings = {}) {
  const rawDate = normalizeString(row.tradeDate);

  const rawTime = normalizeString(row.tradeTime);

  return Object.freeze({
    id: normalizeString(row.id),

    /*
     * Preserve the service-provided display date.
     */

    date: rawDate || getEmptyValue(settings),

    dateValue: rawDate,

    dateIso: formatInputDate(rawDate, ""),

    time: formatTime(rawTime, {
      locale: settings.locale,

      fallback: getEmptyValue(settings),
    }),

    timeValue: rawTime,

    companyCode: getDisplayValue(row.companyCode, getEmptyValue(settings)),

    companyName: getDisplayValue(row.companyName, getEmptyValue(settings)),

    companyUrl: normalizeString(row.companyUrl),

    price: formatDisplayPrice(row.price, settings),

    volume: formatDisplayQuantity(row.volume, settings),

    value: formatDisplayMoney(row.value, settings),
  });
}

/* ==========================================================================
   Bound Formatter Collection
   ========================================================================== */

export function createDerivativeNegotiatedFormatters(config = {}) {
  const settings = getFormatterSettings(config);

  function renderDate(_data, type, row) {
    return formatDerivativeNegotiatedDate(row, type, settings);
  }

  function renderContract(_data, type, row) {
    return formatDerivativeNegotiatedContract(row, type, settings);
  }

  function renderPrice(_data, type, row) {
    return formatDerivativeNegotiatedPrice(row, type, settings);
  }

  function renderVolume(_data, type, row) {
    return formatDerivativeNegotiatedVolume(row, type, settings);
  }

  function renderValue(_data, type, row) {
    return formatDerivativeNegotiatedValue(row, type, settings);
  }

  function renderTime(_data, type, row) {
    return formatDerivativeNegotiatedTime(row, type, settings);
  }

  return Object.freeze({
    settings,

    table: Object.freeze({
      date: renderDate,

      contract: renderContract,

      price: renderPrice,

      volume: renderVolume,

      value: renderValue,

      time: renderTime,
    }),

    getCardValues(row) {
      return getDerivativeNegotiatedCardValues(row, settings);
    },

    getSummaryValues(row) {
      return getDerivativeNegotiatedSummaryValues(row, settings);
    },
  });
}
