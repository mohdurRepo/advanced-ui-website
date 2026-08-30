/* ==========================================================================
   Company Status Formatters
   ========================================================================== */

/*
 * Presentation formatters for the Company Status tab.
 *
 * Responsibilities:
 *
 * - render the standard company identity
 * - render semantic accumulated-loss indicators
 * - preserve the legacy DD-MM-YYYY date presentation
 * - provide stable date sorting values
 * - render suspension and delisting links safely
 * - provide values shared by desktop tables and mobile cards
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - event listeners
 * - request lifecycle
 * - DataTables lifecycle
 * - filter behavior
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
  getDateSortValue,
  getDisplayValue,
  getSafeUrl,
  normalizeString,
  parseDateParts,
} from "../../../shared/trading/trading-formatters.js";

import {
  COMPANY_STATUS_VIEWS,
  getCompanyStatusView,
} from "./company-status.filters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_EMPTY_VALUE = "—";

const DEFAULT_ANNOUNCEMENT_LABEL = "View";

const STATUS_PRESENTATIONS = Object.freeze({
  1: Object.freeze({
    modifierClassName: "status-state--attention",

    labelKey: "losses20To35",
  }),

  2: Object.freeze({
    modifierClassName: "status-state--warning",

    labelKey: "losses35To50",
  }),

  3: Object.freeze({
    modifierClassName: "status-state--danger",

    labelKey: "losses50More",
  }),
});

const EMPTY_STATUS_PRESENTATION = Object.freeze({
  className: "",

  modifierClassName: "",

  label: "",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function firstString(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function firstSafeUrl(...values) {
  for (const value of values) {
    const url = getSafeUrl(value);

    if (url) {
      return url;
    }
  }

  return "";
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function getDateRawValue(value) {
  if (value && typeof value === "object") {
    return firstDefined(value.raw, value.value, value.display, "");
  }

  return value;
}

function getDateSortKey(value) {
  if (value && typeof value === "object" && value.sort) {
    return normalizeString(value.sort);
  }

  return getDateSortValue(getDateRawValue(value));
}

function getCompanyName(row = {}) {
  return firstString(row.companyName, row.acrynomName, row.name, row.company);
}

function getCompanyCode(row = {}) {
  return firstString(
    row.companyCode,
    row.companyRef,
    row.symbolCode,
    row.companySymbol,
    row.symbol,
  );
}

/* ==========================================================================
   View Resolution
   ========================================================================== */

function resolveCompanyStatusView(row = {}) {
  const directView = normalizeString(row.view).toLowerCase();

  if (directView === COMPANY_STATUS_VIEWS.delisting) {
    return COMPANY_STATUS_VIEWS.delisting;
  }

  if (directView === COMPANY_STATUS_VIEWS.suspension) {
    return COMPANY_STATUS_VIEWS.suspension;
  }

  return getCompanyStatusView({
    type: row.formType ?? row.type,
  });
}

function isSuspensionRow(row = {}) {
  return resolveCompanyStatusView(row) === COMPANY_STATUS_VIEWS.suspension;
}

/* ==========================================================================
   Accumulated-Loss Status Resolution
   ========================================================================== */

function getCompanyStatusCode(row = {}) {
  const status = row.companyStatus;

  const nestedStatus =
    status && typeof status === "object"
      ? firstString(status.code, status.value, status.raw)
      : normalizeString(status);

  const rawValue = firstString(
    nestedStatus,
    row.statusCode,
    row.companyStatusCode,
    row.status,
  );

  if (!rawValue) {
    return "";
  }

  const numericValue = Number(rawValue);

  if (Number.isFinite(numericValue)) {
    return String(numericValue);
  }

  return rawValue;
}

function getCompanyStatusLabel(row = {}, config = {}) {
  const status = row.companyStatus;

  if (status && typeof status === "object") {
    const directLabel = firstString(status.label, status.name, status.title);

    if (directLabel) {
      return directLabel;
    }
  }

  const statusCode = getCompanyStatusCode(row);

  const presentation = STATUS_PRESENTATIONS[statusCode];

  if (!presentation) {
    return "";
  }

  const statusLabels = {
    ...(config.labels?.status || {}),

    ...(config.labels?.companyStatus?.status || {}),
  };

  return normalizeString(statusLabels[presentation.labelKey]);
}

function getCompanySearchValue(row = {}, config = {}) {
  return [
    getCompanyName(row),
    getCompanyCode(row),
    getCompanyStatusLabel(row, config),
  ]
    .filter(Boolean)
    .join(" ");
}

/* ==========================================================================
   Date Presentation
   ========================================================================== */

/*
 * Company Status dates follow the legacy presentation:
 *
 * DD-MM-YYYY
 *
 * Both backend formats are supported:
 *
 * - YYYY-MM-DD
 * - DD-MM-YYYY
 */

export function formatCompanyStatusDate(value, fallback = DEFAULT_EMPTY_VALUE) {
  const rawValue = getDateRawValue(value);

  const parts = parseDateParts(rawValue);

  if (!parts) {
    return getDisplayValue(rawValue, fallback);
  }

  return [padDatePart(parts.day), padDatePart(parts.month), parts.year].join(
    "-",
  );
}

export function renderCompanyStatusDate(value, fallback = DEFAULT_EMPTY_VALUE) {
  const displayValue = formatCompanyStatusDate(value, fallback);

  const datetime = formatInputDate(getDateRawValue(value));

  if (!datetime) {
    return escapeHtml(displayValue);
  }

  return `
    <time datetime="${escapeHtml(datetime)}">
      ${escapeHtml(displayValue)}
    </time>
  `.trim();
}

function formatDateCell(value, type, fallback) {
  if (type === "sort" || type === "type") {
    return getDateSortKey(value);
  }

  const displayValue = formatCompanyStatusDate(value, fallback);

  if (type === "filter") {
    return displayValue;
  }

  if (type !== "display") {
    return getDateRawValue(value);
  }

  return renderCompanyStatusDate(value, fallback);
}

/* ==========================================================================
   Status Presentation
   ========================================================================== */

export function getCompanyStatusPresentation(row = {}, config = {}) {
  const statusCode = getCompanyStatusCode(row);

  const definition = STATUS_PRESENTATIONS[statusCode];

  if (!definition) {
    return EMPTY_STATUS_PRESENTATION;
  }

  const modifierClassName = definition.modifierClassName;

  return Object.freeze({
    className: ["status-state", modifierClassName].join(" "),

    modifierClassName,

    label: getCompanyStatusLabel(row, config),
  });
}

/* ==========================================================================
   Status Indicator
   ========================================================================== */

export function renderCompanyStatusIndicator(row = {}, config = {}) {
  const presentation = getCompanyStatusPresentation(row, config);

  if (!presentation.className) {
    return "";
  }

  const accessibilityAttributes = presentation.label
    ? `
        role="img"
        aria-label="${escapeHtml(presentation.label)}"
        title="${escapeHtml(presentation.label)}"
      `.trim()
    : 'aria-hidden="true"';

  return `
    <span
      class="${escapeHtml(presentation.className)}"
      ${accessibilityAttributes}
    >
      <span
        class="status-state__indicator"
        aria-hidden="true"
      ></span>
    </span>
  `.trim();
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

export function renderCompanyStatusCompanyCell(row = {}, config = {}) {
  return renderStandardCompanyCell(row, config, {
    nameMetadata: renderCompanyStatusIndicator(row, config),
  });
}

export function renderCompanyStatusCardIdentity(row = {}, config = {}) {
  return renderStandardCompanyCardIdentity(row, config, {
    nameMetadata: renderCompanyStatusIndicator(row, config),
  });
}
function formatCompanyCell(row, type, config) {
  if (type === "sort" || type === "type") {
    return getCompanyName(row) || getCompanyCode(row);
  }

  if (type === "filter") {
    return getCompanySearchValue(row, config);
  }

  if (type !== "display") {
    return getCompanyName(row);
  }

  return renderCompanyStatusCompanyCell(row, config);
}

/* ==========================================================================
   Announcement Resolution
   ========================================================================== */

export function getCompanyStatusAnnouncementLabel(row = {}, config = {}) {
  const labels = config.labels?.companyStatus?.links || {};

  if (isSuspensionRow(row)) {
    return normalizeString(labels.suspension) || DEFAULT_ANNOUNCEMENT_LABEL;
  }

  return normalizeString(labels.delisting) || DEFAULT_ANNOUNCEMENT_LABEL;
}

export function getCompanyStatusAnnouncementUrl(row = {}) {
  return firstSafeUrl(
    row.announcementUrl,
    row.newsUrl,
    row.announcementSourceUrl,
  );
}

function getAnnouncementSearchValue(row = {}, config = {}) {
  return [
    normalizeString(row.reason),

    getCompanyStatusAnnouncementLabel(row, config),

    getCompanyStatusAnnouncementUrl(row),
  ]
    .filter(Boolean)
    .join(" ");
}

/* ==========================================================================
   Announcement Rendering
   ========================================================================== */

export function renderCompanyStatusAnnouncement(
  row = {},
  config = {},
  options = {},
) {
  const fallback =
    options.fallback ?? config.labels?.emptyValue ?? DEFAULT_EMPTY_VALUE;

  const url = getCompanyStatusAnnouncementUrl(row);

  /*
   * Preserve a service-provided reason when there is no URL.
   */

  if (!url) {
    return escapeHtml(getDisplayValue(row.reason, fallback));
  }

  const label = getCompanyStatusAnnouncementLabel(row, config);

  const companyName = getCompanyName(row);

  const accessibleLabel = companyName ? `${label}: ${companyName}` : label;

  const className = [
    "company-status__announcement-link",

    "has-icon",

    "icon-arrow-up-right",

    options.className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <a
      class="${escapeHtml(className)}"
      href="${escapeHtml(url)}"
      aria-label="${escapeHtml(accessibleLabel)}"
    >
      ${escapeHtml(label)}
    </a>
  `.trim();
}

function formatAnnouncementCell(row, type, config, fallback) {
  if (type === "sort" || type === "type" || type === "filter") {
    return getAnnouncementSearchValue(row, config);
  }

  if (type !== "display") {
    return getCompanyStatusAnnouncementUrl(row);
  }

  return renderCompanyStatusAnnouncement(row, config, {
    fallback,
  });
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createCompanyStatusFormatters(config = {}) {
  const fallback =
    normalizeString(config.labels?.emptyValue) ||
    normalizeString(config.labels?.noValue) ||
    DEFAULT_EMPTY_VALUE;

  return Object.freeze({
    emptyValue: fallback,

    /* ----------------------------------------------------------------------
       Desktop Table
       ---------------------------------------------------------------------- */

    company(data, type, row) {
      return formatCompanyCell(row || data || {}, type, config);
    },

    fromDate(data, type) {
      return formatDateCell(data, type, fallback);
    },

    toDate(data, type) {
      return formatDateCell(data, type, fallback);
    },

    delistingDate(data, type) {
      return formatDateCell(data, type, fallback);
    },

    announcement(data, type, row) {
      return formatAnnouncementCell(row || data || {}, type, config, fallback);
    },

    /* ----------------------------------------------------------------------
       Mobile Cards
       ---------------------------------------------------------------------- */

    renderCardIdentity(row = {}) {
      return renderCompanyStatusCardIdentity(row, config);
    },

    formatCardDate(value) {
      return formatCompanyStatusDate(value, fallback);
    },

    renderCardDate(value) {
      return renderCompanyStatusDate(value, fallback);
    },

    renderCardAnnouncement(row = {}) {
      return renderCompanyStatusAnnouncement(row, config, {
        className: "company-status__announcement-link--card",

        fallback,
      });
    },

    /* ----------------------------------------------------------------------
       Shared Values
       ---------------------------------------------------------------------- */

    getAnnouncementLabel(row = {}) {
      return getCompanyStatusAnnouncementLabel(row, config);
    },

    getAnnouncementUrl(row = {}) {
      return getCompanyStatusAnnouncementUrl(row);
    },

    getStatusPresentation(row = {}) {
      return getCompanyStatusPresentation(row, config);
    },

    getView(row = {}) {
      return resolveCompanyStatusView(row);
    },
  });
}
