/* ==========================================================================
   OTC Trading Formatters
   ========================================================================== */

/*
 * Presentation formatters for OTC Trading.
 *
 * Responsibilities:
 *
 * - render the standard Market Watch company identity
 * - format traded volume
 * - preserve the service-provided last-update display
 * - provide stable DataTables sorting and filtering values
 * - provide values shared by desktop tables and mobile cards
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - event listeners
 * - request lifecycle
 * - response-envelope parsing
 * - DataTables initialization
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
  formatInputDate,
  formatQuantity,
  getDisplayValue,
  normalizeString,
} from "../../shared/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_EMPTY_VALUE = "—";

const DEFAULT_LOCALE = "en";

/* ==========================================================================
   General Helpers
   ========================================================================== */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function getCompanyName(row = {}) {
  return normalizeString(
    firstDefined(row.companyName, row.acrynomName, row.company, row.name),
  );
}

function getCompanyCode(row = {}) {
  return normalizeString(
    firstDefined(
      row.companyCode,
      row.companyRef,
      row.symbolCode,
      row.companySymbol,
      row.symbol,
    ),
  );
}

function getCompanySearchValue(row = {}) {
  return [getCompanyName(row), getCompanyCode(row)].filter(Boolean).join(" ");
}

function getTextSortValue(value) {
  return normalizeString(value).toLocaleLowerCase();
}

/* ==========================================================================
   Settings
   ========================================================================== */

function getSettings(config = {}) {
  return Object.freeze({
    locale: normalizeString(config.locale) || DEFAULT_LOCALE,

    emptyValue:
      normalizeString(config.labels?.emptyValue) ||
      normalizeString(config.labels?.noValue) ||
      DEFAULT_EMPTY_VALUE,
  });
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

export function formatOtcTradingCompany(
  row = {},
  type = "display",
  config = {},
) {
  if (type === "sort" || type === "type") {
    return getTextSortValue(getCompanyName(row) || getCompanyCode(row));
  }

  if (type === "filter") {
    return getCompanySearchValue(row);
  }

  if (type !== "display") {
    return getCompanyName(row);
  }

  return renderStandardCompanyCell(row, config);
}

export function renderOtcTradingCardIdentity(row = {}, config = {}) {
  return renderStandardCompanyCardIdentity(row, config);
}

/* ==========================================================================
   Traded Volume
   ========================================================================== */

function getVolumeRawValue(value) {
  if (value && typeof value === "object") {
    return firstDefined(value.raw, value.value, "");
  }

  return value;
}

function getVolumeNumericValue(value) {
  if (value && typeof value === "object") {
    const number = Number(value.value);

    return Number.isFinite(number) ? number : null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export function formatOtcTradingVolume(value, type = "display", settings = {}) {
  const rawValue = getVolumeRawValue(value);

  const numericValue = getVolumeNumericValue(value);

  if (type === "sort" || type === "type") {
    return numericValue ?? "";
  }

  if (type === "filter") {
    return normalizeString(rawValue);
  }

  if (type !== "display") {
    return rawValue ?? "";
  }

  if (numericValue === null) {
    return escapeHtml(getDisplayValue(rawValue, settings.emptyValue));
  }

  return escapeHtml(
    formatQuantity(numericValue, {
      locale: settings.locale,

      fallback: settings.emptyValue,
    }),
  );
}

/* ==========================================================================
   Last Update
   ========================================================================== */

function getLastUpdateRawValue(value) {
  if (value && typeof value === "object") {
    return normalizeString(firstDefined(value.raw, value.value, value.display));
  }

  return normalizeString(value);
}

function getLastUpdateSortValue(value) {
  if (value && typeof value === "object" && value.sort) {
    return normalizeString(value.sort);
  }

  return getTextSortValue(getLastUpdateRawValue(value));
}

/*
 * The visible last-update value must remain exactly as returned by the
 * service. This helper only creates a machine-readable datetime attribute
 * when the value contains a recognized date.
 */

function getLastUpdateDateTime(value) {
  const rawValue = getLastUpdateRawValue(value);

  if (!rawValue) {
    return "";
  }

  const inputDate = formatInputDate(rawValue);

  if (!inputDate) {
    return "";
  }

  const timeMatch = rawValue.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  if (!timeMatch) {
    return inputDate;
  }

  const hours = Number(timeMatch[1]);

  const minutes = Number(timeMatch[2]);

  const seconds = Number(timeMatch[3] || 0);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return inputDate;
  }

  return [
    inputDate,
    "T",
    String(hours).padStart(2, "0"),
    ":",
    String(minutes).padStart(2, "0"),
    ":",
    String(seconds).padStart(2, "0"),
  ].join("");
}

export function formatOtcTradingLastUpdate(
  value,
  type = "display",
  settings = {},
) {
  const rawValue = getLastUpdateRawValue(value);

  if (type === "sort" || type === "type") {
    return getLastUpdateSortValue(value);
  }

  if (type === "filter") {
    return rawValue;
  }

  if (type !== "display") {
    return rawValue;
  }

  const displayValue = getDisplayValue(rawValue, settings.emptyValue);

  const datetime = getLastUpdateDateTime(value);

  if (!datetime) {
    return escapeHtml(displayValue);
  }

  return `
    <time datetime="${escapeHtml(datetime)}">
      ${escapeHtml(displayValue)}
    </time>
  `.trim();
}

/* ==========================================================================
   Card Values
   ========================================================================== */

export function getOtcTradingCardValues(row = {}, config = {}) {
  const settings = getSettings(config);

  return Object.freeze({
    id: normalizeString(row.id),

    companyCode: getDisplayValue(getCompanyCode(row), settings.emptyValue),

    companyName: getDisplayValue(getCompanyName(row), settings.emptyValue),

    tradedVolume: formatOtcTradingVolume(row.tradedVolume, "display", settings),

    lastUpdate: formatOtcTradingLastUpdate(row.lastUpdate, "display", settings),
  });
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createOtcTradingFormatters(config = {}) {
  const settings = getSettings(config);

  return Object.freeze({
    settings,

    table: Object.freeze({
      company(data, type, row) {
        return formatOtcTradingCompany(row || data || {}, type, config);
      },

      tradedVolume(data, type) {
        return formatOtcTradingVolume(data, type, settings);
      },

      lastUpdate(data, type) {
        return formatOtcTradingLastUpdate(data, type, settings);
      },
    }),

    renderCardIdentity(row = {}) {
      return renderOtcTradingCardIdentity(row, config);
    },

    getCardValues(row = {}) {
      return getOtcTradingCardValues(row, config);
    },
  });
}
