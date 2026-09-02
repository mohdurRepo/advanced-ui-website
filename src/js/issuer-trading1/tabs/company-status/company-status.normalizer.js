/* ==========================================================================
   Company Status Normalizer
   ========================================================================== */

/*
 * Response normalization for:
 *
 * - suspended companies
 * - delisted companies
 * - suspended funds
 * - delisted funds
 *
 * Responsibilities:
 *
 * - parse legacy response envelopes
 * - normalize company identity
 * - normalize suspension and delisting dates
 * - provide sortable date values
 * - resolve announcement and news URLs
 * - preserve company status information
 * - provide consistent response metadata
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - display formatting
 * - DataTables configuration
 * - card rendering
 * - filter event handling
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  COMPANY_STATUS_VIEWS,
  getCompanyStatusView,
  normalizeCompanyStatusType,
} from "./company-status.filters.js";

import { getDateSortValue } from "../../../shared/trading/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const RESPONSE_ROW_KEYS = Object.freeze([
  "rows",
  "data",
  "results",
  "items",
  "aaData",
  "response",
  "payload",
]);

const MAX_RESPONSE_DEPTH = 4;

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  if (value == null || typeof value === "object") {
    return "";
  }

  return String(value).trim();
}

function getFirstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined && value !== null && normalizeString(value) !== "",
  );
}

function getFirstString(...values) {
  return normalizeString(getFirstValue(...values));
}

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit));
}

function normalizeNumericValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = normalizeDigits(value)
    .trim()
    .replaceAll(",", "")
    .replaceAll("٬", "")
    .replaceAll("−", "-");

  if (!normalized || normalized === "-") {
    return null;
  }

  const numericValue = Number(normalized);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function createSafeKey(value, fallback = "item") {
  const normalized = normalizeString(value)
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

/* ==========================================================================
   JSON Parsing
   ========================================================================== */

function parseResponseValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();

  if (!normalized) {
    return [];
  }

  try {
    return JSON.parse(normalized);
  } catch {
    throw new TypeError("Company Status received an invalid JSON response.");
  }
}

/* ==========================================================================
   Row Extraction
   ========================================================================== */

function extractResponseRows(response, depth = 0) {
  if (depth > MAX_RESPONSE_DEPTH) {
    return [];
  }

  const parsedResponse = parseResponseValue(response);

  if (Array.isArray(parsedResponse)) {
    return parsedResponse;
  }

  if (!isObject(parsedResponse)) {
    return [];
  }

  for (const key of RESPONSE_ROW_KEYS) {
    if (!(key in parsedResponse)) {
      continue;
    }

    const value = parseResponseValue(parsedResponse[key]);

    if (Array.isArray(value)) {
      return value;
    }

    if (isObject(value)) {
      const nestedRows = extractResponseRows(value, depth + 1);

      if (nestedRows.length) {
        return nestedRows;
      }
    }
  }

  return [];
}

/* ==========================================================================
   Company Identity
   ========================================================================== */

function normalizeCompanyIdentity(row = {}) {
  const company = isObject(row.company) ? row.company : {};

  const companyCode = getFirstString(
    row.companyRef,
    row.symbolCode,
    row.symbol,
    row.companyCode,
    row.securityCode,
    row.code,

    company.companyRef,
    company.symbolCode,
    company.symbol,
    company.companyCode,
    company.code,
  );

  const companyName = getFirstString(
    row.companyName,
    row.name,
    row.longName,
    row.securityName,

    typeof row.company === "string" ? row.company : null,

    company.companyName,
    company.name,
    company.longName,

    companyCode,
  );

  const companyUrl = getFirstString(
    row.companyURL,
    row.companyUrl,
    row.pageUrl,
    row.url,

    company.companyURL,
    company.companyUrl,
    company.pageUrl,
    company.url,
  );

  const companyLogoUrl = getFirstString(
    row.companyLogoUrl,
    row.companyLogoURL,
    row.logoUrl,
    row.logoURL,

    company.companyLogoUrl,
    company.logoUrl,
    company.logoURL,
  );

  return {
    companyCode,
    companyName,
    companyUrl,
    companyLogoUrl,
  };
}

/* ==========================================================================
   Company Status
   ========================================================================== */

function normalizeCompanyStatus(row = {}) {
  const rawStatus = getFirstValue(
    row.companyStatus,
    row.status,
    row.statusCode,
    row.companyStatusCode,
  );

  return {
    code: normalizeString(rawStatus),

    value: normalizeNumericValue(rawStatus),

    label: getFirstString(
      row.companyStatusLabel,
      row.statusLabel,
      row.statusName,
    ),
  };
}

/* ==========================================================================
   Date Normalization
   ========================================================================== */

function normalizeDate(value) {
  const raw = normalizeString(value);

  return {
    raw,

    sort: getDateSortValue(raw, ""),
  };
}

/* ==========================================================================
   Announcement and Reason
   ========================================================================== */

function normalizeAnnouncement(row, view) {
  const announcementUrl = getFirstString(
    row.annUrl,
    row.announcementUrl,
    row.announcementURL,
  );

  const newsUrl = getFirstString(row.newsUrl, row.newsURL);

  const validAnnouncementUrl =
    announcementUrl && announcementUrl !== "0" ? announcementUrl : "";

  const resolvedUrl =
    view === COMPANY_STATUS_VIEWS.suspension
      ? validAnnouncementUrl || newsUrl
      : newsUrl || validAnnouncementUrl;

  const reason = getFirstString(
    row.reason,
    row.suspensionReason,
    row.delistingReason,
    row.description,
  );

  return {
    announcementUrl: validAnnouncementUrl,

    newsUrl,

    resolvedUrl,

    reason,
  };
}

/* ==========================================================================
   Company Status Row
   ========================================================================== */

function normalizeCompanyStatusRow(row, index, context) {
  const identity = normalizeCompanyIdentity(row);

  const companyStatus = normalizeCompanyStatus(row);

  const fromDate = normalizeDate(
    getFirstValue(
      row.fromDate,
      row.startDate,
      row.suspensionDate,
      row.delistingDate,
      row.date,
    ),
  );

  const toDate = normalizeDate(
    getFirstValue(
      row.toDate,
      row.endDate,
      row.resumeDate,
      row.reinstatementDate,
    ),
  );

  const announcement = normalizeAnnouncement(row, context.view);

  const sourceId = getFirstString(
    row.id,
    row.companyId,
    row.securityId,
    row.symbolCode,
    row.symbol,
  );

  const identityKey = createSafeKey(
    identity.companyCode || identity.companyName,
    "company",
  );

  return {
    id: sourceId || `company-status-${context.view}-${identityKey}-${index}`,

    rowType: context.view,

    formType: context.formType,

    view: context.view,

    companyCode: identity.companyCode,
    companyName: identity.companyName,
    companyUrl: identity.companyUrl,
    companyLogoUrl: identity.companyLogoUrl,

    companyStatus,

    period: {
      from: fromDate,

      to: toDate,
    },

    /*
     * The legacy delisting response uses fromDate as the effective
     * delisting date.
     */

    delistingDate: fromDate,

    announcementUrl: announcement.resolvedUrl,

    announcementSourceUrl: announcement.announcementUrl,

    newsUrl: announcement.newsUrl,

    reason: announcement.reason,

    raw: row,
  };
}

/* ==========================================================================
   Metadata
   ========================================================================== */

function findExplicitTotal(response, rawRows) {
  const parsedResponse = parseResponseValue(response);

  const candidates = [];

  if (isObject(parsedResponse)) {
    candidates.push(
      parsedResponse.total,
      parsedResponse.count,
      parsedResponse.totalCount,
      parsedResponse.recordsTotal,
      parsedResponse.recordsFiltered,
    );

    if (isObject(parsedResponse.meta)) {
      candidates.push(
        parsedResponse.meta.total,
        parsedResponse.meta.count,
        parsedResponse.meta.totalCount,
      );
    }
  }

  if (isObject(rawRows[0])) {
    candidates.push(
      rawRows[0].count,
      rawRows[0].totalCount,
      rawRows[0].recordsTotal,
    );
  }

  for (const candidate of candidates) {
    const total = normalizeNumericValue(candidate);

    if (total !== null) {
      return total;
    }
  }

  return null;
}

function findUpdatedAt(response) {
  const parsedResponse = parseResponseValue(response);

  if (!isObject(parsedResponse)) {
    return null;
  }

  return (
    getFirstValue(
      parsedResponse.updatedAt,
      parsedResponse.lastUpdated,
      parsedResponse.timestamp,
      parsedResponse.meta?.updatedAt,
      parsedResponse.meta?.lastUpdated,
    ) ?? null
  );
}

/* ==========================================================================
   Public Response Normalizer
   ========================================================================== */

export function normalizeCompanyStatusResponse(response, context = {}) {
  const filterState =
    context.state ?? context.filters ?? context.requestOptions?.filters ?? {};

  const formType = normalizeCompanyStatusType(
    filterState.type ?? filterState.formType,
  );

  const view = getCompanyStatusView({
    type: formType,
  });

  const rawRows = extractResponseRows(response);

  const rows = rawRows.filter(isObject).map((row, index) =>
    normalizeCompanyStatusRow(row, index, {
      formType,

      view,
    }),
  );

  const explicitTotal = findExplicitTotal(response, rawRows);

  return {
    rows,

    meta: {
      total: explicitTotal !== null ? explicitTotal : rows.length,

      recordCount: rows.length,

      normalizedCount: rows.length,

      formType,

      view,

      updatedAt: findUpdatedAt(response),
    },

    raw: response,
  };
}
