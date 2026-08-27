/* ==========================================================================
   Negotiated Deals Formatters
   ========================================================================== */

/*
 * Presentation formatters for:
 *
 * - Negotiated Deals table
 * - Negotiated Deals cards
 * - daily total rows/cards
 * - Minimum Size company cells
 *
 * Responsibilities:
 *
 * - provide DataTables-compatible renderers
 * - format dates, times, prices, quantities, and money
 * - render the shared Market Watch company identity
 * - return plain values for sorting and filtering
 *
 * This module intentionally has no:
 *
 * - endpoint code
 * - response normalization
 * - table initialization
 * - card container rendering
 * - event listeners
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  escapeHtml,
  formatDate,
  formatInputDate,
  formatMoney,
  formatPrice,
  formatQuantity,
  formatTime,
  getDateSortValue,
  getDisplayValue,
  normalizeString,
} from "../../shared/trading-formatters.js";

import { renderStandardCompanyCell } from "../../../../common/data-view/index.js";

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

function getTimeSortValue(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return "";
  }

  const match = normalized.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);

  if (!match) {
    return normalized;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function getCompanyFilterValue(company = {}) {
  return [
    normalizeString(company.companyName),
    normalizeString(company.companyCode),
  ]
    .filter(Boolean)
    .join(" ");
}

function getFormatterSettings(config = {}) {
  const locale = normalizeString(config.locale) || DEFAULT_LOCALE;

  const emptyValue =
    normalizeString(config.labels?.emptyValue) || DEFAULT_EMPTY_VALUE;

  return Object.freeze({
    locale,
    emptyValue,

    totalLabel: normalizeString(config.labels?.total) || "Total",

    companyIdentity: Object.freeze({
      logoUrlTemplate: normalizeString(config.assets?.companyLogoUrlTemplate),

      logoFallbackUrl: normalizeString(config.assets?.companyLogoFallbackUrl),
    }),
  });
}

/* ==========================================================================
   Row Detection
   ========================================================================== */

export function isNegotiatedDealsTotalRow(row = {}) {
  return row?.rowType === "total";
}

export function isNegotiatedDealRow(row = {}) {
  return row?.rowType === "deal";
}

/* ==========================================================================
   Date
   ========================================================================== */

export function formatNegotiatedDealDate(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  if (isSortRequest(type)) {
    return row.dateSort || getDateSortValue(row.tradeDate) || "";
  }

  if (isFilterRequest(type)) {
    return normalizeString(row.tradeDate);
  }

  if (isNegotiatedDealsTotalRow(row)) {
    return "";
  }

  const rawDate = normalizeString(row.tradeDate);

  if (!rawDate) {
    return escapeHtml(settings.emptyValue);
  }

  const displayDate = formatDate(rawDate, {
    locale: settings.locale,
    fallback: settings.emptyValue,
  });

  const machineDate = formatInputDate(rawDate);

  if (!machineDate) {
    return escapeHtml(displayDate);
  }

  return `
    <time datetime="${escapeHtml(machineDate)}">
      ${escapeHtml(displayDate)}
    </time>
  `.trim();
}

/* ==========================================================================
   Company
   ========================================================================== */

export function formatNegotiatedDealCompany(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  const filterValue = getCompanyFilterValue(row);

  if (isSortRequest(type)) {
    return getTextSortValue(row.companyName || row.companyCode);
  }

  if (isFilterRequest(type)) {
    return filterValue;
  }

  if (isNegotiatedDealsTotalRow(row)) {
    return "";
  }

  return renderStandardCompanyCell(row, {
    logoUrlTemplate: settings.companyIdentity?.logoUrlTemplate,

    logoFallbackUrl: settings.companyIdentity?.logoFallbackUrl,
  });
}

/* ==========================================================================
   Price
   ========================================================================== */

export function formatNegotiatedDealPrice(
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

  if (isNegotiatedDealsTotalRow(row)) {
    return "";
  }

  return escapeHtml(
    formatPrice(row.price, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),
  );
}

/* ==========================================================================
   Volume
   ========================================================================== */

export function formatNegotiatedDealVolume(
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

  return escapeHtml(
    formatQuantity(row.volume, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),
  );
}

/* ==========================================================================
   Value
   ========================================================================== */

export function formatNegotiatedDealValue(
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

  return escapeHtml(
    formatMoney(row.value, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),
  );
}

/* ==========================================================================
   Time
   ========================================================================== */

export function formatNegotiatedDealTime(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  if (isSortRequest(type)) {
    return getTimeSortValue(row.tradeTime);
  }

  if (isFilterRequest(type)) {
    return normalizeString(row.tradeTime);
  }

  if (isNegotiatedDealsTotalRow(row)) {
    return "";
  }

  const rawTime = normalizeString(row.tradeTime);

  if (!rawTime) {
    return escapeHtml(settings.emptyValue);
  }

  const displayTime = formatTime(rawTime, {
    locale: settings.locale,
    fallback: settings.emptyValue,
  });

  return `
    <time datetime="${escapeHtml(rawTime)}">
      ${escapeHtml(displayTime)}
    </time>
  `.trim();
}

/* ==========================================================================
   Summary Values
   ========================================================================== */

export function getNegotiatedDealsSummaryValues(row = {}, settings = {}) {
  return Object.freeze({
    label: normalizeString(settings.totalLabel) || "Total",

    date: formatDate(row.tradeDate, {
      locale: settings.locale,
      fallback: "",
    }),

    dateValue: normalizeString(row.tradeDate),

    dateIso: formatInputDate(row.tradeDate),

    volume: formatQuantity(row.volume, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),

    value: formatMoney(row.value, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),
  });
}

/* ==========================================================================
   Deal Card Values
   ========================================================================== */

export function getNegotiatedDealCardValues(row = {}, settings = {}) {
  return Object.freeze({
    id: normalizeString(row.id),

    date: formatDate(row.tradeDate, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),

    dateValue: normalizeString(row.tradeDate),

    dateIso: formatInputDate(row.tradeDate),

    time: formatTime(row.tradeTime, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),

    timeValue: normalizeString(row.tradeTime),

    companyCode: getDisplayValue(row.companyCode, settings.emptyValue),

    companyName: getDisplayValue(row.companyName, settings.emptyValue),

    companyUrl: normalizeString(row.companyUrl),

    price: formatPrice(row.price, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),

    volume: formatQuantity(row.volume, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),

    value: formatMoney(row.value, {
      locale: settings.locale,
      fallback: settings.emptyValue,
    }),
  });
}

/* ==========================================================================
   Minimum Size Company Cell
   ========================================================================== */

export function formatMinimumSizeCompany(
  company,
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  if (!isObject(company)) {
    if (isSortRequest(type) || isFilterRequest(type)) {
      return "";
    }

    return escapeHtml(settings.emptyValue);
  }

  if (isSortRequest(type)) {
    return getTextSortValue(company.companyName || company.companyCode);
  }

  if (isFilterRequest(type)) {
    return getCompanyFilterValue(company);
  }

  return renderStandardCompanyCell(company, {
    logoUrlTemplate: settings.companyIdentity?.logoUrlTemplate,

    logoFallbackUrl: settings.companyIdentity?.logoFallbackUrl,
  });
}

/* ==========================================================================
   Bound Formatter Collection
   ========================================================================== */

export function createNegotiatedDealsFormatters(config = {}) {
  const settings = getFormatterSettings(config);

  function renderDate(_data, type, row) {
    return formatNegotiatedDealDate(row, type, settings);
  }

  function renderCompany(_data, type, row) {
    return formatNegotiatedDealCompany(row, type, settings);
  }

  function renderPrice(_data, type, row) {
    return formatNegotiatedDealPrice(row, type, settings);
  }

  function renderVolume(_data, type, row) {
    return formatNegotiatedDealVolume(row, type, settings);
  }

  function renderValue(_data, type, row) {
    return formatNegotiatedDealValue(row, type, settings);
  }

  function renderTime(_data, type, row) {
    return formatNegotiatedDealTime(row, type, settings);
  }

  function renderMinimumSizeCompany(data, type) {
    return formatMinimumSizeCompany(data, type, settings);
  }

  return Object.freeze({
    settings,

    table: Object.freeze({
      date: renderDate,
      company: renderCompany,
      price: renderPrice,
      volume: renderVolume,
      value: renderValue,
      time: renderTime,
    }),

    minimumSize: Object.freeze({
      company: renderMinimumSizeCompany,
    }),

    getCardValues(row) {
      return getNegotiatedDealCardValues(row, settings);
    },

    getSummaryValues(row) {
      return getNegotiatedDealsSummaryValues(row, settings);
    },
  });
}
