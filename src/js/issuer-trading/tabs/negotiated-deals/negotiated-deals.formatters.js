/* ==========================================================================
   Negotiated Deals Formatters
   ========================================================================== */

/*
 * Presentation formatters for:
 *
 * - Negotiated Deals tables
 * - Negotiated Deals cards
 * - daily total rows and cards
 * - Minimum Size company cells
 *
 * Responsibilities:
 *
 * - provide DataTables-compatible orthogonal renderers
 * - preserve service-provided dates for display
 * - provide normalized values for sorting and filtering
 * - format prices, quantities, values, and times
 * - render the shared Market Watch company identity
 *
 * This module intentionally has no:
 *
 * - endpoint configuration
 * - request transport
 * - response normalization
 * - DataTables initialization
 * - card collection rendering
 * - event listeners
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  escapeHtml,
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

const DEFAULT_TOTAL_LABEL = "Total";

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

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return normalized;
  }

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

function getServiceDateValue(row = {}) {
  return normalizeString(row.tradeDate);
}

function getDateIsoValue(row = {}) {
  return formatInputDate(getServiceDateValue(row));
}

function getDateSortingValue(row = {}) {
  if (
    row.dateSort !== undefined &&
    row.dateSort !== null &&
    row.dateSort !== ""
  ) {
    return row.dateSort;
  }

  return getDateSortValue(getServiceDateValue(row), "");
}

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

    companyIdentity: Object.freeze({
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

export function isNegotiatedDealsTotalRow(row = {}) {
  return row?.rowType === "total";
}

export function isNegotiatedDealRow(row = {}) {
  return row?.rowType === "deal";
}

/* ==========================================================================
   Date
   ========================================================================== */

/*
 * The displayed value remains exactly as supplied by the service.
 *
 * DataTables receives a separate normalized value for sorting.
 */

export function formatNegotiatedDealDate(
  row = {},
  type = DATA_TABLE_TYPES.display,
  settings = {},
) {
  const rawDate = getServiceDateValue(row);

  if (isSortRequest(type)) {
    return getDateSortingValue(row);
  }

  if (isFilterRequest(type)) {
    return rawDate;
  }

  if (isNegotiatedDealsTotalRow(row)) {
    return "";
  }

  if (!rawDate) {
    return escapeHtml(getEmptyValue(settings));
  }

  const machineDate = getDateIsoValue(row);

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
   Company
   ========================================================================== */

export function formatNegotiatedDealCompany(
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

      fallback: getEmptyValue(settings),
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

  /*
   * Volume is intentionally rendered for both:
   *
   * - ordinary deal rows
   * - service-provided total rows
   */

  return escapeHtml(
    formatQuantity(row.volume, {
      locale: settings.locale,

      fallback: getEmptyValue(settings),
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

  /*
   * Value is intentionally rendered for both:
   *
   * - ordinary deal rows
   * - service-provided total rows
   */

  return escapeHtml(
    formatMoney(row.value, {
      locale: settings.locale,

      fallback: getEmptyValue(settings),
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
  const rawTime = normalizeString(row.tradeTime);

  if (isSortRequest(type)) {
    return getTimeSortValue(rawTime);
  }

  if (isFilterRequest(type)) {
    return rawTime;
  }

  if (isNegotiatedDealsTotalRow(row)) {
    return "";
  }

  if (!rawTime) {
    return escapeHtml(getEmptyValue(settings));
  }

  const displayTime = formatTime(rawTime, {
    locale: settings.locale,

    fallback: getEmptyValue(settings),
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
  const rawDate = getServiceDateValue(row);

  return Object.freeze({
    label: normalizeString(settings.totalLabel) || DEFAULT_TOTAL_LABEL,

    /*
     * Preserve the service value for display.
     */

    date: rawDate,

    dateValue: rawDate,

    /*
     * ISO is metadata only, used by the semantic <time> element.
     */

    dateIso: getDateIsoValue(row),

    volume: formatQuantity(row.volume, {
      locale: settings.locale,

      fallback: getEmptyValue(settings),
    }),

    value: formatMoney(row.value, {
      locale: settings.locale,

      fallback: getEmptyValue(settings),
    }),
  });
}

/* ==========================================================================
   Deal Card Values
   ========================================================================== */

export function getNegotiatedDealCardValues(row = {}, settings = {}) {
  const rawDate = getServiceDateValue(row);

  return Object.freeze({
    id: normalizeString(row.id),

    /*
     * Preserve the service value in the mobile card.
     */

    date: rawDate || getEmptyValue(settings),

    dateValue: rawDate,

    dateIso: getDateIsoValue(row),

    time: formatTime(row.tradeTime, {
      locale: settings.locale,

      fallback: getEmptyValue(settings),
    }),

    timeValue: normalizeString(row.tradeTime),

    companyCode: getDisplayValue(row.companyCode, getEmptyValue(settings)),

    companyName: getDisplayValue(row.companyName, getEmptyValue(settings)),

    companyUrl: normalizeString(row.companyUrl),

    price: formatPrice(row.price, {
      locale: settings.locale,

      fallback: getEmptyValue(settings),
    }),

    volume: formatQuantity(row.volume, {
      locale: settings.locale,

      fallback: getEmptyValue(settings),
    }),

    value: formatMoney(row.value, {
      locale: settings.locale,

      fallback: getEmptyValue(settings),
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

    return escapeHtml(getEmptyValue(settings));
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
