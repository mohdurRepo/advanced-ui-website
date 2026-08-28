/* ==========================================================================
   Listed Tradable Rights Normalizer
   ========================================================================== */

/*
 * Response normalization for Listed Tradable Rights.
 *
 * Responsibilities:
 *
 * - parse legacy response envelopes
 * - normalize company/right identity
 * - preserve service-provided display values
 * - provide numeric values for sorting
 * - normalize change direction
 * - provide consistent result metadata
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - display formatting
 * - DataTables configuration
 * - card rendering
 * - client-side financial calculations
 */

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

const VIEW_KEY = "listed-tradable-rights";

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
    .replaceAll("%", "")
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
    throw new TypeError(
      "Listed Tradable Rights received an invalid JSON response.",
    );
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
   Metric Normalization
   ========================================================================== */

/*
 * Each financial metric keeps two representations:
 *
 * display:
 *   The exact service-provided display value.
 *
 * value:
 *   A normalized number used for sorting and direction detection.
 */

function normalizeMetric({ displayValues = [], numericValues = [] } = {}) {
  const displaySource = getFirstValue(...displayValues, ...numericValues);

  const numericSource = getFirstValue(...numericValues, ...displayValues);

  return {
    display: normalizeString(displaySource),

    value: normalizeNumericValue(numericSource),
  };
}

/* ==========================================================================
   Change Direction
   ========================================================================== */

function getChangeDirection(...values) {
  for (const value of values) {
    const numericValue = normalizeNumericValue(value);

    if (numericValue === null) {
      continue;
    }

    if (numericValue > 0) {
      return "positive";
    }

    if (numericValue < 0) {
      return "negative";
    }

    return "neutral";
  }

  return "neutral";
}

/* ==========================================================================
   Company and Right Identity
   ========================================================================== */

function normalizeIdentity(row = {}) {
  const company = isObject(row.company) ? row.company : {};

  const security = isObject(row.security) ? row.security : {};

  const companyCode = getFirstString(
    row.symbolCode,
    row.symbol,
    row.companyCode,
    row.securityCode,
    row.instrumentCode,
    row.code,
    row.acronym,
    row.acrynom,

    company.symbolCode,
    company.symbol,
    company.companyCode,
    company.code,

    security.symbolCode,
    security.symbol,
    security.securityCode,
    security.code,
  );

  const companyName = getFirstString(
    row.acrynomName,
    row.acronymName,
    row.companyName,
    row.securityName,
    row.tradableRightsName,
    row.longName,
    row.name,

    typeof row.company === "string" ? row.company : null,

    company.acrynomName,
    company.acronymName,
    company.companyName,
    company.longName,
    company.name,

    security.securityName,
    security.longName,
    security.name,

    companyCode,
  );

  const companyUrl = getFirstString(
    row.pageUrl,
    row.pageURL,
    row.companyUrl,
    row.companyURL,
    row.securityUrl,
    row.url,

    company.pageUrl,
    company.companyUrl,
    company.companyURL,
    company.url,

    security.pageUrl,
    security.securityUrl,
    security.url,
  );

  const companyLogoUrl = getFirstString(
    row.companyLogoUrl,
    row.companyLogoURL,
    row.logoUrl,
    row.logoURL,

    company.companyLogoUrl,
    company.logoUrl,
    company.logoURL,

    security.logoUrl,
    security.logoURL,
  );

  return {
    companyCode,
    companyName,
    companyUrl,
    companyLogoUrl,
  };
}

/* ==========================================================================
   Listed Tradable Right Row
   ========================================================================== */

function normalizeListedTradableRightsRow(row, index) {
  const identity = normalizeIdentity(row);

  /* ------------------------------------------------------------------------
     Last Trade
     ------------------------------------------------------------------------ */

  const lastTradePrice = normalizeMetric({
    displayValues: [row.lastTradePriceModified, row.lastTradePriceDisplay],

    numericValues: [row.lastTradePrice, row.lastTradePriceDouble],
  });

  const lastTradeVolume = normalizeMetric({
    displayValues: [
      row.lastTradeQuantityModified,
      row.lastTradeQuantityDisplay,
    ],

    numericValues: [row.lastTradeQuantity, row.lastTradeVolume],
  });

  const changeValue = normalizeMetric({
    displayValues: [row.netChangeModified, row.netChangeDisplay],

    numericValues: [
      row.netChangeDoubleModified,
      row.netChangeDouble,
      row.netChange,
    ],
  });

  const changePercent = normalizeMetric({
    displayValues: [row.percentChangeModified, row.percentChangeDisplay],

    numericValues: [
      row.percentChangeDoubleModified,
      row.percentChangeDouble,
      row.percentChange,
    ],
  });

  /* ------------------------------------------------------------------------
     Today
     ------------------------------------------------------------------------ */

  const openPrice = normalizeMetric({
    displayValues: [
      row.todayOpenModified,
      row.openPriceModified,
      row.todayOpenDisplay,
    ],

    numericValues: [row.todayOpen, row.openPrice],
  });

  const highPrice = normalizeMetric({
    displayValues: [
      row.highPriceModified,
      row.todayHighModified,
      row.highPriceDisplay,
    ],

    numericValues: [row.highPrice, row.todayHigh],
  });

  const lowPrice = normalizeMetric({
    displayValues: [
      row.lowPriceModified,
      row.todayLowModified,
      row.lowPriceDisplay,
    ],

    numericValues: [row.lowPrice, row.todayLow],
  });

  /* ------------------------------------------------------------------------
     Cumulative
     ------------------------------------------------------------------------ */

  const numberOfTrades = normalizeMetric({
    displayValues: [
      row.nuOfTradesModified,
      row.numberOfTradesModified,
      row.numberOfTradesDisplay,
    ],

    numericValues: [row.nuOfTrades, row.numberOfTrades, row.noOfTrades],
  });

  const volumeTraded = normalizeMetric({
    displayValues: [
      row.volumeTradedModified,
      row.tradedVolumeModified,
      row.volumeTradedDisplay,
    ],

    numericValues: [row.volumeTraded, row.tradedVolume, row.totalVolume],
  });

  /* ------------------------------------------------------------------------
     Best Bid
     ------------------------------------------------------------------------ */

  const bidPrice = normalizeMetric({
    displayValues: [
      row.bidPriceModified,
      row.bestBidPriceModified,
      row.bidPriceDisplay,
    ],

    numericValues: [row.bidPrice, row.bestBidPrice],
  });

  const bidVolume = normalizeMetric({
    displayValues: [
      row.bidQuantityModified,
      row.bestBidQuantityModified,
      row.bidQuantityDisplay,
    ],

    numericValues: [row.bidQuantity, row.bestBidQuantity, row.bidVolume],
  });

  /* ------------------------------------------------------------------------
     Best Offer
     ------------------------------------------------------------------------ */

  const offerPrice = normalizeMetric({
    displayValues: [
      row.askPriceModified,
      row.offerPriceModified,
      row.bestOfferPriceModified,
      row.askPriceDisplay,
    ],

    numericValues: [row.askPrice, row.offerPrice, row.bestOfferPrice],
  });

  const offerVolume = normalizeMetric({
    displayValues: [
      row.askQuantityModified,
      row.offerQuantityModified,
      row.bestOfferQuantityModified,
      row.askQuantityDisplay,
    ],

    numericValues: [
      row.askQuantity,
      row.offerQuantity,
      row.bestOfferQuantity,
      row.askVolume,
    ],
  });

  /* ------------------------------------------------------------------------
     Identity
     ------------------------------------------------------------------------ */

  const sourceId = getFirstString(
    row.id,
    row.securityId,
    row.instrumentId,
    row.symbolCode,
    row.symbol,
  );

  const identityKey = createSafeKey(
    identity.companyCode || identity.companyName,
    "right",
  );

  return {
    id: sourceId || `listed-right-${identityKey}-${index}`,

    rowType: "listed-tradable-right",

    companyCode: identity.companyCode,
    companyName: identity.companyName,
    companyUrl: identity.companyUrl,
    companyLogoUrl: identity.companyLogoUrl,

    lastTrade: {
      price: lastTradePrice,
      volume: lastTradeVolume,
      changeValue,
      changePercent,
    },

    today: {
      open: openPrice,
      high: highPrice,
      low: lowPrice,
    },

    cumulative: {
      numberOfTrades,
      volumeTraded,
    },

    bestBid: {
      price: bidPrice,
      volume: bidVolume,
    },

    bestOffer: {
      price: offerPrice,
      volume: offerVolume,
    },

    changeDirection: getChangeDirection(changeValue.value, changePercent.value),

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

export function normalizeListedTradableRightsResponse(response) {
  const rawRows = extractResponseRows(response);

  const rows = rawRows.filter(isObject).map(normalizeListedTradableRightsRow);

  const explicitTotal = findExplicitTotal(response, rawRows);

  return {
    rows,

    meta: {
      total: explicitTotal !== null ? explicitTotal : rows.length,

      recordCount: rows.length,

      normalizedCount: rows.length,

      view: VIEW_KEY,

      updatedAt: findUpdatedAt(response),
    },

    raw: response,
  };
}
