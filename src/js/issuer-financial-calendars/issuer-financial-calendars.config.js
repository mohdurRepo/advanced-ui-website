/* ==========================================================================
   Issuer Financial Calendars Configuration
   ========================================================================== */

/*
 * Validated configuration boundary for Issuer Financial Calendars.
 *
 * Responsibilities:
 *
 * - read the JSP-provided configuration
 * - validate required endpoints
 * - validate calendar-type values
 * - validate company-logo assets
 * - normalize page defaults
 * - normalize labels
 * - expose an immutable configuration object
 *
 * This module intentionally has no:
 *
 * - DOM feature queries
 * - tab behavior
 * - request execution
 * - response normalization
 * - filter state
 * - table or card rendering
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const CONFIGURATION_GLOBAL = "IssuerFinancialCalendarsConfig";

export const FINANCIAL_CALENDAR_TABS = Object.freeze({
  DIVIDENDS: "dividends",

  GENERAL_MEETINGS: "general-meetings",

  BOARD_SESSIONS: "board-sessions",

  CORPORATE_ACTIONS: "corporate-actions",
});

const VALID_TAB_KEYS = Object.freeze(Object.values(FINANCIAL_CALENDAR_TABS));

const REQUIRED_ENDPOINTS = Object.freeze([
  "sectors",

  "dividends",

  "generalMeetings",

  "boardSessions",

  "corporateActions",
]);

const REQUIRED_CALENDAR_TYPES = Object.freeze([
  "dividends",

  "generalMeetings",

  "boardSessions",

  "corporateActions",
]);

const DEFAULTS = Object.freeze({
  locale: "en",

  initialTab: FINANCIAL_CALENDAR_TABS.DIVIDENDS,

  market: "M",

  sector: "",

  dateRangeYears: 5,

  searchDebounceMs: 300,

  pageLength: 25,

  lengthMenu: Object.freeze([25, 50, 100]),

  dividendsPeriod: "CUSTOM",
});

/* ==========================================================================
   Cache
   ========================================================================== */

let cachedConfiguration = null;

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

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function isMissingMessage(value) {
  const normalized = normalizeString(value);

  return !normalized || /^\?{3}.+\?{3}$/.test(normalized);
}

function normalizeLabel(value, fallback) {
  return isMissingMessage(value) ? fallback : normalizeString(value, fallback);
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeNonNegativeInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.getOwnPropertyNames(value).forEach((property) => {
    deepFreeze(value[property]);
  });

  return Object.freeze(value);
}

/* ==========================================================================
   Required Values
   ========================================================================== */

function requireObject(value, description) {
  if (!isPlainObject(value)) {
    throw new TypeError(`${description} must be an object.`);
  }

  return value;
}

function requireString(value, description) {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw new Error(`${description} is required.`);
  }

  return normalized;
}

/* ==========================================================================
   Raw Configuration
   ========================================================================== */

function getRawConfiguration() {
  if (typeof window === "undefined") {
    throw new Error(
      "Issuer Financial Calendars configuration requires a browser environment.",
    );
  }

  const configuration = window[CONFIGURATION_GLOBAL];

  return requireObject(configuration, `window.${CONFIGURATION_GLOBAL}`);
}

/* ==========================================================================
   Locale
   ========================================================================== */

function normalizeLocale(value) {
  const documentLocale =
    typeof document !== "undefined"
      ? normalizeString(document.documentElement.lang)
      : "";

  return normalizeString(value, documentLocale || DEFAULTS.locale);
}

/* ==========================================================================
   Initial Tab
   ========================================================================== */

function normalizeInitialTab(value) {
  const tabKey = normalizeString(value);

  return VALID_TAB_KEYS.includes(tabKey) ? tabKey : DEFAULTS.initialTab;
}

/* ==========================================================================
   Endpoints
   ========================================================================== */

function normalizeEndpoints(value) {
  const endpoints = requireObject(
    value,
    "Issuer Financial Calendars endpoints",
  );

  const normalized = {};

  REQUIRED_ENDPOINTS.forEach((key) => {
    normalized[key] = requireString(
      endpoints[key],
      `Issuer Financial Calendars endpoint "${key}"`,
    );
  });

  return normalized;
}

/* ==========================================================================
   Calendar Types
   ========================================================================== */

function normalizeCalendarTypes(value) {
  const calendarTypes = requireObject(
    value,
    "Issuer Financial Calendars calendar types",
  );

  const normalized = {};

  REQUIRED_CALENDAR_TYPES.forEach((key) => {
    normalized[key] = requireString(
      calendarTypes[key],
      `Issuer Financial Calendars calendar type "${key}"`,
    );
  });

  return normalized;
}

/* ==========================================================================
   Assets
   ========================================================================== */

function normalizeAssets(value) {
  const assets = requireObject(value, "Issuer Financial Calendars assets");

  const companyLogoUrlTemplate = requireString(
    assets.companyLogoUrlTemplate,
    "Issuer Financial Calendars company logo URL template",
  );

  if (!companyLogoUrlTemplate.includes("{companyCode}")) {
    throw new Error(
      'Issuer Financial Calendars companyLogoUrlTemplate must contain "{companyCode}".',
    );
  }

  return {
    companyLogoUrlTemplate,

    companyLogoFallbackUrl: requireString(
      assets.companyLogoFallbackUrl,
      "Issuer Financial Calendars company logo fallback URL",
    ),

    noDataImageUrl: requireString(
      assets.noDataImageUrl,
      "Issuer Financial Calendars no-data image URL",
    ),
  };
}

/* ==========================================================================
   Table Defaults
   ========================================================================== */

function normalizeLengthMenu(value, pageLength) {
  const source = Array.isArray(value) ? value : DEFAULTS.lengthMenu;

  const normalized = [
    ...new Set(
      source
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  ].sort((left, right) => left - right);

  if (!normalized.includes(pageLength)) {
    normalized.push(pageLength);

    normalized.sort((left, right) => left - right);
  }

  return normalized.length ? normalized : [...DEFAULTS.lengthMenu];
}

/* ==========================================================================
   Defaults
   ========================================================================== */

function normalizeDefaults(value) {
  const defaults = isPlainObject(value) ? value : {};

  const table = isPlainObject(defaults.table) ? defaults.table : {};

  const dividends = isPlainObject(defaults.dividends) ? defaults.dividends : {};

  const market =
    normalizeString(defaults.market, DEFAULTS.market).toUpperCase() === "S"
      ? "S"
      : "M";

  const pageLength = normalizePositiveInteger(
    table.pageLength,
    DEFAULTS.pageLength,
  );

  return {
    market,

    sector: normalizeString(defaults.sector, DEFAULTS.sector),

    dateRangeYears: normalizePositiveInteger(
      defaults.dateRangeYears,
      DEFAULTS.dateRangeYears,
    ),

    searchDebounceMs: normalizeNonNegativeInteger(
      defaults.searchDebounceMs,
      DEFAULTS.searchDebounceMs,
    ),

    table: {
      pageLength,

      lengthMenu: normalizeLengthMenu(table.lengthMenu, pageLength),
    },

    dividends: {
      period: normalizeString(dividends.period, DEFAULTS.dividendsPeriod),
    },
  };
}

/* ==========================================================================
   Shared Labels
   ========================================================================== */

function normalizeSharedLabels(value) {
  const labels = isPlainObject(value) ? value : {};

  const filters = isPlainObject(labels.filters) ? labels.filters : {};

  const mobile = isPlainObject(labels.mobile) ? labels.mobile : {};

  return {
    loading: normalizeLabel(labels.loading, "Loading…"),

    noData: normalizeLabel(labels.noData, "No data available."),

    error: normalizeLabel(labels.error, "Unable to load data."),

    results: normalizeLabel(labels.results, "Results"),

    reset: normalizeLabel(labels.reset, "Reset"),

    emptyValue: normalizeLabel(labels.emptyValue, "—"),

    filters: {
      mainMarket: normalizeLabel(filters.mainMarket, "Main Market"),

      nomuMarket: normalizeLabel(filters.nomuMarket, "Nomu"),

      allMainMarketSectors: normalizeLabel(
        filters.allMainMarketSectors,
        "All Sectors",
      ),

      allNomuMarketSectors: normalizeLabel(
        filters.allNomuMarketSectors,
        "All Sectors",
      ),
    },

    mobile: {
      showDetails: normalizeLabel(mobile.showDetails, "More details"),

      hideDetails: normalizeLabel(mobile.hideDetails, "Less details"),
    },
  };
}

/* ==========================================================================
   Dividends Labels
   ========================================================================== */

function normalizeDividendsLabels(value) {
  const dividends = isPlainObject(value) ? value : {};

  const table = isPlainObject(dividends.table) ? dividends.table : {};

  return {
    title: normalizeLabel(dividends.title, "Dividends"),

    table: {
      company: normalizeLabel(table.company, "Company"),

      announcementDate: normalizeLabel(
        table.announcementDate,
        "Announcement Date",
      ),

      dueDate: normalizeLabel(table.dueDate, "Due Date"),

      distributionMethod: normalizeLabel(
        table.distributionMethod,
        "Distribution Method",
      ),

      distributionDate: normalizeLabel(
        table.distributionDate,
        "Distribution Date",
      ),

      amount: normalizeLabel(table.amount, "Amount"),
    },
  };
}

/* ==========================================================================
   General Meetings Labels
   ========================================================================== */

function normalizeGeneralMeetingsLabels(value) {
  const generalMeetings = isPlainObject(value) ? value : {};

  const table = isPlainObject(generalMeetings.table)
    ? generalMeetings.table
    : {};

  const types = isPlainObject(generalMeetings.types)
    ? generalMeetings.types
    : {};

  const statuses = isPlainObject(generalMeetings.statuses)
    ? generalMeetings.statuses
    : {};

  return {
    title: normalizeLabel(generalMeetings.title, "General Meetings"),

    table: {
      company: normalizeLabel(table.company, "Company"),

      type: normalizeLabel(table.type, "Meeting Type"),

      date: normalizeLabel(table.date, "Date"),

      time: normalizeLabel(table.time, "Time"),

      site: normalizeLabel(table.site, "Site"),

      status: normalizeLabel(table.status, "Status"),
    },

    types: {
      ordinary: normalizeLabel(types.ordinary, "Ordinary"),

      extraordinary: normalizeLabel(types.extraordinary, "Extraordinary"),

      corporateActions: normalizeLabel(
        types.corporateActions,
        "Extraordinary - Corporate Actions",
      ),
    },

    statuses: {
      convening: normalizeLabel(statuses.convening, "Convening"),

      nonConvening: normalizeLabel(statuses.nonConvening, "Non-Convening"),
    },
  };
}

/* ==========================================================================
   Board Sessions Labels
   ========================================================================== */

function normalizeBoardSessionsLabels(value) {
  const boardSessions = isPlainObject(value) ? value : {};

  const table = isPlainObject(boardSessions.table) ? boardSessions.table : {};

  return {
    title: normalizeLabel(boardSessions.title, "Board Sessions"),

    table: {
      company: normalizeLabel(table.company, "Company"),

      sessionStartDate: normalizeLabel(
        table.sessionStartDate,
        "Session Start Date",
      ),

      sessionEndDate: normalizeLabel(table.sessionEndDate, "Session End Date"),

      sessionType: normalizeLabel(table.sessionType, "Session Type"),

      numberOfMembers: normalizeLabel(
        table.numberOfMembers,
        "Number of Members",
      ),

      applicationStartDate: normalizeLabel(
        table.applicationStartDate,
        "Application Start Date",
      ),

      applicationEndDate: normalizeLabel(
        table.applicationEndDate,
        "Application End Date",
      ),
    },
  };
}

/* ==========================================================================
   Corporate Actions Labels
   ========================================================================== */

function normalizeCorporateActionsLabels(value) {
  const corporateActions = isPlainObject(value) ? value : {};

  const table = isPlainObject(corporateActions.table)
    ? corporateActions.table
    : {};

  return {
    title: normalizeLabel(corporateActions.title, "Corporate Actions"),

    table: {
      company: normalizeLabel(table.company, "Company"),

      announcementDate: normalizeLabel(
        table.announcementDate,
        "Announcement Date",
      ),

      issueType: normalizeLabel(table.issueType, "Issue Type"),

      dueDate: normalizeLabel(table.dueDate, "Due Date"),

      newCapital: normalizeLabel(table.newCapital, "New Capital"),

      previousCapital: normalizeLabel(
        table.previousCapital,
        "Previous Capital",
      ),
    },
  };
}

/* ==========================================================================
   Labels
   ========================================================================== */

function normalizeLabels(value) {
  const labels = isPlainObject(value) ? value : {};

  return {
    ...normalizeSharedLabels(labels),

    dividends: normalizeDividendsLabels(labels.dividends),

    generalMeetings: normalizeGeneralMeetingsLabels(labels.generalMeetings),

    boardSessions: normalizeBoardSessionsLabels(labels.boardSessions),

    corporateActions: normalizeCorporateActionsLabels(labels.corporateActions),
  };
}

/* ==========================================================================
   Public Validation
   ========================================================================== */

export function validateIssuerFinancialCalendarsConfig(value) {
  const configuration = requireObject(
    value,
    "Issuer Financial Calendars configuration",
  );

  return deepFreeze({
    locale: normalizeLocale(configuration.locale),

    initialTab: normalizeInitialTab(configuration.initialTab),

    calendarTypes: normalizeCalendarTypes(configuration.calendarTypes),

    endpoints: normalizeEndpoints(configuration.endpoints),

    assets: normalizeAssets(configuration.assets),

    defaults: normalizeDefaults(configuration.defaults),

    labels: normalizeLabels(configuration.labels),
  });
}

/* ==========================================================================
   Public Configuration
   ========================================================================== */

export function getIssuerFinancialCalendarsConfig() {
  if (cachedConfiguration) {
    return cachedConfiguration;
  }

  cachedConfiguration = validateIssuerFinancialCalendarsConfig(
    getRawConfiguration(),
  );

  return cachedConfiguration;
}
