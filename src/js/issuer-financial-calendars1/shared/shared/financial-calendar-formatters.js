/* ==========================================================================
   Financial Calendar Formatters
   ========================================================================== */

/*
 * Shared presentation formatters for all Issuer Financial Calendar tabs.
 *
 * This module owns presentation conversion only. It has no DOM queries,
 * events, requests, response normalization, filter state, or table lifecycle.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  renderStandardCompanyCardIdentity,
  renderStandardCompanyCell,
} from "../../../common/data-view/index.js";

import {
  escapeHtml,
  formatInputDate,
  formatMoney,
  formatNumber,
  getDateSortValue,
  getDisplayValue,
  getSafeUrl,
  normalizeString,
  renderLink,
  toNumber,
} from "../../../shared/trading/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_VALUE = "—";

export const FINANCIAL_CALENDAR_DATA_TYPES = Object.freeze({
  DISPLAY: "display",

  FILTER: "filter",

  SORT: "sort",

  TYPE: "type",
});

const STATUS_VARIANTS = Object.freeze([
  "success",

  "info",

  "warning",

  "caution",

  "danger",

  "neutral",
]);

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isSortRequest(type) {
  return (
    type === FINANCIAL_CALENDAR_DATA_TYPES.SORT ||
    type === FINANCIAL_CALENDAR_DATA_TYPES.TYPE
  );
}

function isFilterRequest(type) {
  return type === FINANCIAL_CALENDAR_DATA_TYPES.FILTER;
}

function getTextSortValue(value) {
  return normalizeString(value).toLocaleLowerCase();
}

function getNumericSortValue(value) {
  const number = toNumber(value);

  return number === null ? "" : number;
}

function normalizeStatusVariant(value) {
  const normalized = normalizeString(value).toLowerCase();

  return STATUS_VARIANTS.includes(normalized) ? normalized : "neutral";
}

/* ==========================================================================
   Settings
   ========================================================================== */

function createFormatterSettings(config = {}) {
  const normalizedConfig = isPlainObject(config) ? config : {};

  return Object.freeze({
    locale: normalizeString(normalizedConfig.locale) || DEFAULT_LOCALE,

    emptyValue:
      normalizeString(normalizedConfig.labels?.emptyValue) ||
      DEFAULT_EMPTY_VALUE,

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
   Company Identity
   ========================================================================== */

function getCompanyFilterValue(row = {}) {
  return [normalizeString(row.companyName), normalizeString(row.companyCode)]
    .filter(Boolean)
    .join(" ");
}

export function formatFinancialCalendarCompany(
  row = {},
  type = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY,
  settings = {},
) {
  if (isSortRequest(type)) {
    return getTextSortValue(row.companyName || row.companyCode);
  }

  if (isFilterRequest(type)) {
    return getCompanyFilterValue(row);
  }

  return renderStandardCompanyCell(row, settings.companyIdentity || {});
}

export function renderFinancialCalendarCardIdentity(row = {}, settings = {}) {
  return renderStandardCompanyCardIdentity(row, settings.companyIdentity || {});
}

/* ==========================================================================
   Text
   ========================================================================== */

export function formatFinancialCalendarText(
  value,
  type = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY,
  settings = {},
) {
  const normalized = normalizeString(value);

  if (isSortRequest(type)) {
    return getTextSortValue(normalized);
  }

  if (isFilterRequest(type)) {
    return normalized;
  }

  return escapeHtml(
    getDisplayValue(normalized, settings.emptyValue || DEFAULT_EMPTY_VALUE),
  );
}

/* ==========================================================================
   Date
   ========================================================================== */

function getFlexibleDateSortValue(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return "";
  }

  const strictSortValue = getDateSortValue(normalized);

  if (strictSortValue) {
    return strictSortValue;
  }

  /*
   * Support service display dates such as "Aug 09, 2026" for sorting only.
   * The visible date is always preserved exactly as returned by the service.
   */

  const timestamp = Date.parse(normalized);

  if (!Number.isFinite(timestamp)) {
    return normalized.toLocaleLowerCase();
  }

  const date = new Date(timestamp);

  return [
    date.getUTCFullYear(),

    String(date.getUTCMonth() + 1).padStart(2, "0"),

    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
}

export function formatFinancialCalendarDate(
  value,
  type = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY,
  settings = {},
) {
  const rawDate = normalizeString(value);

  if (isSortRequest(type)) {
    return getFlexibleDateSortValue(rawDate);
  }

  if (isFilterRequest(type)) {
    return rawDate;
  }

  if (!rawDate) {
    return escapeHtml(settings.emptyValue || DEFAULT_EMPTY_VALUE);
  }

  const machineDate = formatInputDate(rawDate);

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
   Time
   ========================================================================== */

function parseTime(value) {
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
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return Object.freeze({
    hours,

    minutes,

    seconds,

    hasSeconds: match[3] !== undefined,
  });
}

function getTimeSortValue(value) {
  const parsed = parseTime(value);

  if (!parsed) {
    return getTextSortValue(value);
  }

  return parsed.hours * 3600 + parsed.minutes * 60 + parsed.seconds;
}

export function formatFinancialCalendarTime(
  value,
  type = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY,
  settings = {},
) {
  const rawTime = normalizeString(value);

  if (isSortRequest(type)) {
    return getTimeSortValue(rawTime);
  }

  if (isFilterRequest(type)) {
    return rawTime;
  }

  if (!rawTime) {
    return escapeHtml(settings.emptyValue || DEFAULT_EMPTY_VALUE);
  }

  const parsed = parseTime(rawTime);

  if (!parsed) {
    return escapeHtml(rawTime);
  }

  const machineTime = [
    String(parsed.hours).padStart(2, "0"),

    String(parsed.minutes).padStart(2, "0"),

    parsed.hasSeconds ? String(parsed.seconds).padStart(2, "0") : null,
  ]
    .filter((part) => part !== null)
    .join(":");

  return `
    <time datetime="${escapeHtml(machineTime)}">
      ${escapeHtml(rawTime)}
    </time>
  `.trim();
}

/* ==========================================================================
   Numbers
   ========================================================================== */

export function formatFinancialCalendarNumber(
  value,
  type = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY,
  settings = {},
  options = {},
) {
  if (isSortRequest(type)) {
    return getNumericSortValue(value);
  }

  if (isFilterRequest(type)) {
    return normalizeString(value);
  }

  return escapeHtml(
    formatNumber(value, {
      locale: options.locale || settings.locale || DEFAULT_LOCALE,

      fallback: options.fallback ?? settings.emptyValue ?? DEFAULT_EMPTY_VALUE,

      minimumFractionDigits: options.minimumFractionDigits ?? 0,

      maximumFractionDigits: options.maximumFractionDigits ?? 2,

      useGrouping: options.useGrouping !== false,

      zeroAsFallback: options.zeroAsFallback === true,
    }),
  );
}

/* ==========================================================================
   Money
   ========================================================================== */

export function formatFinancialCalendarMoney(
  value,
  type = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY,
  settings = {},
  options = {},
) {
  if (isSortRequest(type)) {
    return getNumericSortValue(value);
  }

  if (isFilterRequest(type)) {
    return normalizeString(value);
  }

  return escapeHtml(
    formatMoney(value, {
      locale: options.locale || settings.locale || DEFAULT_LOCALE,

      fallback: options.fallback ?? settings.emptyValue ?? DEFAULT_EMPTY_VALUE,

      minimumFractionDigits: options.minimumFractionDigits ?? 2,

      maximumFractionDigits: options.maximumFractionDigits ?? 2,

      useGrouping: options.useGrouping !== false,

      zeroAsFallback: options.zeroAsFallback === true,
    }),
  );
}

/* ==========================================================================
   Currency / Capital
   ========================================================================== */

export function parseFinancialCalendarCurrency(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return Object.freeze({
      currency: "",

      value: "",

      number: null,

      raw: "",
    });
  }

  const separatorIndex = normalized.indexOf(":");

  if (separatorIndex === -1) {
    return Object.freeze({
      currency: "",

      value: normalized,

      number: toNumber(normalized),

      raw: normalized,
    });
  }

  const currency = normalizeString(
    normalized.slice(0, separatorIndex),
  ).toUpperCase();

  const monetaryValue = normalizeString(normalized.slice(separatorIndex + 1));

  return Object.freeze({
    currency,

    value: monetaryValue,

    number: toNumber(monetaryValue),

    raw: normalized,
  });
}

export function formatFinancialCalendarCapital(
  value,
  type = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY,
  settings = {},
) {
  const parsed = parseFinancialCalendarCurrency(value);

  if (isSortRequest(type)) {
    return parsed.number ?? "";
  }

  if (isFilterRequest(type)) {
    return [parsed.currency, parsed.value].filter(Boolean).join(" ");
  }

  if (!parsed.value) {
    return escapeHtml(settings.emptyValue || DEFAULT_EMPTY_VALUE);
  }

  const formattedValue = formatMoney(parsed.value, {
    locale: settings.locale || DEFAULT_LOCALE,

    fallback: settings.emptyValue || DEFAULT_EMPTY_VALUE,

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

    useGrouping: true,
  });

  if (parsed.currency === "SAR") {
    return `
      <span class="riyal-symbol">
        ${escapeHtml(formattedValue)}
      </span>
    `.trim();
  }

  if (!parsed.currency) {
    return escapeHtml(formattedValue);
  }

  return `
    <span class="financial-calendar-currency">
      <span class="financial-calendar-currency__code">
        ${escapeHtml(parsed.currency)}
      </span>

      <span class="financial-calendar-currency__value">
        ${escapeHtml(formattedValue)}
      </span>
    </span>
  `.trim();
}

/* ==========================================================================
   Links
   ========================================================================== */

export function formatFinancialCalendarLink(
  label,
  url,
  type = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY,
  settings = {},
  options = {},
) {
  const displayLabel = getDisplayValue(
    label,
    settings.emptyValue || DEFAULT_EMPTY_VALUE,
  );

  if (isSortRequest(type)) {
    return getTextSortValue(displayLabel);
  }

  if (isFilterRequest(type)) {
    return normalizeString(displayLabel);
  }

  return renderLink(displayLabel, getSafeUrl(url), {
    fallback: settings.emptyValue || DEFAULT_EMPTY_VALUE,

    className: options.className || "financial-calendar-link",
  });
}

/* ==========================================================================
   Semantic Status
   ========================================================================== */

export function formatFinancialCalendarStatus(
  label,
  variant = "neutral",
  type = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY,
  settings = {},
) {
  const displayLabel = getDisplayValue(
    label,
    settings.emptyValue || DEFAULT_EMPTY_VALUE,
  );

  if (isSortRequest(type)) {
    return getTextSortValue(displayLabel);
  }

  if (isFilterRequest(type)) {
    return normalizeString(displayLabel);
  }

  const normalizedVariant = normalizeStatusVariant(variant);

  return `
    <span
      class="status-state status-state--${escapeHtml(normalizedVariant)}"
    >
      <span
        class="status-state__indicator"
        aria-hidden="true"
      ></span>

      <span class="status-state__label">
        ${escapeHtml(displayLabel)}
      </span>
    </span>
  `.trim();
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createFinancialCalendarFormatters(config = {}) {
  const settings = createFormatterSettings(config);

  const displayType = FINANCIAL_CALENDAR_DATA_TYPES.DISPLAY;

  return Object.freeze({
    settings,

    /* ----------------------------------------------------------------------
       Company
       ---------------------------------------------------------------------- */

    renderCompanyCell(row, type = displayType) {
      return formatFinancialCalendarCompany(row, type, settings);
    },

    renderCompanyCardIdentity(row) {
      return renderFinancialCalendarCardIdentity(row, settings);
    },

    /* ----------------------------------------------------------------------
       Text
       ---------------------------------------------------------------------- */

    formatText(value, type = displayType) {
      return formatFinancialCalendarText(value, type, settings);
    },

    /* ----------------------------------------------------------------------
       Date and Time
       ---------------------------------------------------------------------- */

    formatDate(value, type = displayType) {
      return formatFinancialCalendarDate(value, type, settings);
    },

    formatTime(value, type = displayType) {
      return formatFinancialCalendarTime(value, type, settings);
    },

    /* ----------------------------------------------------------------------
       Number and Money
       ---------------------------------------------------------------------- */

    formatNumber(value, type = displayType, options = {}) {
      return formatFinancialCalendarNumber(value, type, settings, options);
    },

    formatMoney(value, type = displayType, options = {}) {
      return formatFinancialCalendarMoney(value, type, settings, options);
    },

    formatCapital(value, type = displayType) {
      return formatFinancialCalendarCapital(value, type, settings);
    },

    /* ----------------------------------------------------------------------
       Links and Status
       ---------------------------------------------------------------------- */

    formatLink(label, url, type = displayType, options = {}) {
      return formatFinancialCalendarLink(label, url, type, settings, options);
    },

    formatStatus(label, variant = "neutral", type = displayType) {
      return formatFinancialCalendarStatus(label, variant, type, settings);
    },

    /* ----------------------------------------------------------------------
       Card Display Values
       ---------------------------------------------------------------------- */

    card: Object.freeze({
      text(value) {
        return formatFinancialCalendarText(value, displayType, settings);
      },

      date(value) {
        return formatFinancialCalendarDate(value, displayType, settings);
      },

      time(value) {
        return formatFinancialCalendarTime(value, displayType, settings);
      },

      number(value, options = {}) {
        return formatFinancialCalendarNumber(
          value,
          displayType,
          settings,
          options,
        );
      },

      money(value, options = {}) {
        return formatFinancialCalendarMoney(
          value,
          displayType,
          settings,
          options,
        );
      },

      capital(value) {
        return formatFinancialCalendarCapital(value, displayType, settings);
      },

      link(label, url, options = {}) {
        return formatFinancialCalendarLink(
          label,
          url,
          displayType,
          settings,
          options,
        );
      },

      status(label, variant = "neutral") {
        return formatFinancialCalendarStatus(
          label,
          variant,
          displayType,
          settings,
        );
      },
    }),
  });
}
