/* ==========================================================================
   Peer Comparison Utilities
   ========================================================================== */

/**
 * Shared utilities for peer comparison.
 *
 * Owns:
 *
 * - feature configuration access;
 * - label access;
 * - safe number / timestamp parsing;
 * - peer identity normalization;
 * - summary-row normalization;
 * - base-company detection;
 * - number / percentage / date formatting;
 * - trend helpers;
 * - chart-series normalization;
 * - percentage-change calculations.
 *
 * Does not own:
 *
 * - DOM rendering;
 * - modal behavior;
 * - table markup;
 * - chart creation;
 * - network requests.
 */

(() => {
  "use strict";

  /* ==========================================================================
     Configuration
     ========================================================================== */

  const DEFAULT_TIME_ZONE = "Asia/Riyadh";

  function getConfig() {
    return window.peerComparisonConfig ?? {};
  }

  function getLabels() {
    return getConfig().labels ?? {};
  }

  function getLabel(key, fallback = "") {
    const value = getLabels()[key];

    return String(value || fallback);
  }

  /* ==========================================================================
     General
     ========================================================================== */

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function normalizeCode(value) {
    return normalizeText(value).toUpperCase();
  }

  function freezeRecord(value) {
    return Object.freeze({
      ...value,
    });
  }

  function freezeList(items) {
    return Object.freeze(
      items.map((item) => (isPlainObject(item) ? freezeRecord(item) : item)),
    );
  }

  /* ==========================================================================
     Locale
     ========================================================================== */

  function getLocale() {
    return document.documentElement.lang || "en";
  }

  /* ==========================================================================
     Base Company
     ========================================================================== */

  function getBaseCompanySymbol() {
    return normalizeCode(getConfig().companySymbol);
  }

  function getBaseCompanyName() {
    return normalizeText(getConfig().companyName) || getBaseCompanySymbol();
  }

  /* ==========================================================================
     Numbers
     ========================================================================== */

  function toFiniteNumber(value) {
    if (value === null || value === undefined || typeof value === "boolean") {
      return null;
    }

    if (typeof value === "string" && value.trim() === "") {
      return null;
    }

    const normalized =
      typeof value === "string"
        ? value.replaceAll(",", "").replaceAll("%", "").trim()
        : value;

    const number = Number(normalized);

    return Number.isFinite(number) ? number : null;
  }

  function toPositiveNumber(value) {
    const number = toFiniteNumber(value);

    return number !== null && number > 0 ? number : null;
  }

  function toInteger(value) {
    const number = toFiniteNumber(value);

    return number === null ? null : Math.trunc(number);
  }

  /* ==========================================================================
     Timestamp
     ========================================================================== */

  function toTimestamp(value) {
    if (value === null || value === undefined || typeof value === "boolean") {
      return null;
    }

    if (value instanceof Date) {
      const timestamp = value.getTime();

      return Number.isFinite(timestamp) ? timestamp : null;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return null;
      }

      return value < 10_000_000_000 ? value * 1_000 : value;
    }

    const text = String(value).trim();

    if (!text) {
      return null;
    }

    if (/^\d+$/.test(text)) {
      const numeric = Number(text);

      if (!Number.isFinite(numeric)) {
        return null;
      }

      return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
    }

    const parsed = Date.parse(text);

    return Number.isFinite(parsed) ? parsed : null;
  }

  /* ==========================================================================
     Peer Identity
     ========================================================================== */

  /**
   * Legacy peer responses did not use one guaranteed field name everywhere.
   *
   * These aliases keep that backend boundary in one place.
   */

  function getPeerSymbol(item) {
    if (!isPlainObject(item)) {
      return "";
    }

    return normalizeCode(
      item.symbol ??
        item.code ??
        item.companySymbol ??
        item.indexSymbol ??
        item.peerID ??
        item.peerId ??
        item.ticker,
    );
  }

  function getPeerName(item) {
    if (!isPlainObject(item)) {
      return "";
    }

    const symbol = getPeerSymbol(item);

    return (
      normalizeText(
        item.name ??
          item.companyName ??
          item.indexName ??
          item.label ??
          item.description,
      ) || symbol
    );
  }

  function isBaseCompany(item) {
    const symbol = getPeerSymbol(item);

    const baseSymbol = getBaseCompanySymbol();

    if (symbol && baseSymbol) {
      return symbol === baseSymbol;
    }

    if (typeof item?.isBase === "boolean") {
      return item.isBase;
    }

    return false;
  }

  function normalizePeer(peer) {
    if (!isPlainObject(peer)) {
      return null;
    }

    const code = normalizeCode(
      peer.code ?? peer.symbol ?? peer.companySymbol ?? peer.indexSymbol,
    );

    if (!code) {
      return null;
    }

    const name =
      normalizeText(
        peer.name ?? peer.companyName ?? peer.indexName ?? peer.label,
      ) || code;

    return freezeRecord({
      code,
      name,
    });
  }

  function normalizePeers(peers) {
    if (!Array.isArray(peers)) {
      return freezeList([]);
    }

    const seen = new Set();

    const normalized = peers
      .map(normalizePeer)
      .filter(Boolean)
      .filter((peer) => {
        if (seen.has(peer.code)) {
          return false;
        }

        seen.add(peer.code);

        return true;
      });

    return freezeList(normalized);
  }

  /* ==========================================================================
     Summary Row Normalization
     ========================================================================== */

  /**
   * Normalized summary record consumed by the new table / graph coordinators.
   *
   * The known legacy fields include:
   *
   * - sharePrice
   * - return
   *
   * Additional aliases are accepted only at this API boundary.
   */

  function normalizeSummaryRow(row) {
    if (!isPlainObject(row)) {
      return null;
    }

    const symbol = getPeerSymbol(row);

    if (!symbol) {
      return null;
    }

    const name = getPeerName(row) || symbol;

    return freezeRecord({
      symbol,
      code: symbol,
      name,

      isBase: isBaseCompany(row),

      sharePrice: toFiniteNumber(
        row.sharePrice ??
          row.price ??
          row.currentPrice ??
          row.currentValue ??
          row.value,
      ),

      return: toFiniteNumber(
        row.return ??
          row.return1D ??
          row.dailyReturn ??
          row.changePercent ??
          row.percentageChange,
      ),

      marketCap: toFiniteNumber(
        row.marketCap ?? row.marketCapitalization ?? row.marketCapitalisation,
      ),

      peRatio: toFiniteNumber(row.peRatio ?? row.pe ?? row.priceEarningsRatio),

      raw: row,
    });
  }

  function normalizeSummaryRows(rows) {
    if (!Array.isArray(rows)) {
      return freezeList([]);
    }

    return freezeList(rows.map(normalizeSummaryRow).filter(Boolean));
  }

  /* ==========================================================================
     Summary Lookup
     ========================================================================== */

  function findSummaryRow(rows, symbol) {
    const normalizedSymbol = normalizeCode(symbol);

    if (!normalizedSymbol) {
      return null;
    }

    return (
      normalizeSummaryRows(rows).find(
        (row) => row.symbol === normalizedSymbol,
      ) ?? null
    );
  }

  /* ==========================================================================
     Comparison Record
     ========================================================================== */

  /**
   * Generic normalized record retained for table modules that work with
   * common comparison metrics.
   */

  function normalizeComparisonRecord(record, peer = null) {
    if (!isPlainObject(record)) {
      return null;
    }

    const normalizedPeer = normalizePeer(
      peer ?? {
        code: getPeerSymbol(record),

        name: getPeerName(record),
      },
    );

    if (!normalizedPeer) {
      return null;
    }

    return freezeRecord({
      ...normalizedPeer,

      value: toFiniteNumber(
        record.value ??
          record.currentValue ??
          record.indexValue ??
          record.sharePrice ??
          record.price,
      ),

      change: toFiniteNumber(
        record.change ??
          record.return ??
          record.return1D ??
          record.changePercent ??
          record.percentageChange,
      ),

      yearToDate: toFiniteNumber(
        record.yearToDate ?? record.ytd ?? record.ytdPercent,
      ),

      high52Week: toFiniteNumber(
        record.high52Week ?? record.week52High ?? record.high52,
      ),

      low52Week: toFiniteNumber(
        record.low52Week ?? record.week52Low ?? record.low52,
      ),
    });
  }

  /* ==========================================================================
     Trend State
     ========================================================================== */

  function getTrend(value) {
    const number = toFiniteNumber(value);

    if (number === null || number === 0) {
      return "neutral";
    }

    return number > 0 ? "positive" : "negative";
  }

  function getTrendClass(value) {
    return `is-${getTrend(value)}`;
  }

  function getPriceStateClass(value) {
    const trend = getTrend(value);

    if (trend === "positive") {
      return "price-up";
    }

    if (trend === "negative") {
      return "price-down";
    }

    return "price-neutral";
  }

  function getDirectionSymbol(value) {
    const trend = getTrend(value);

    if (trend === "positive") {
      return "▲";
    }

    if (trend === "negative") {
      return "▼";
    }

    return "";
  }

  /* ==========================================================================
     Formatting
     ========================================================================== */

  function createNumberFormatter({
    locale = getLocale(),
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    useGrouping = true,
    signDisplay = "auto",
  } = {}) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
      signDisplay,
    });
  }

  function formatNumber(value, options = {}) {
    const number = toFiniteNumber(value);

    if (number === null) {
      return "—";
    }

    return createNumberFormatter(options).format(number);
  }

  function formatPercent(
    value,
    { absolute = false, suffix = true, ...options } = {},
  ) {
    const number = toFiniteNumber(value);

    if (number === null) {
      return "—";
    }

    const output = createNumberFormatter({
      minimumFractionDigits: 2,

      maximumFractionDigits: 2,

      signDisplay: "never",

      ...options,
    }).format(absolute ? Math.abs(number) : number);

    return suffix ? `${output}%` : output;
  }

  function formatReturn(value) {
    const number = toFiniteNumber(value);

    if (number === null) {
      return "—";
    }

    const symbol = getDirectionSymbol(number);

    const formatted = formatPercent(Math.abs(number), {
      absolute: true,
    });

    return symbol ? `${symbol} ${formatted}` : formatted;
  }

  function getReturnClass(value) {
    return getPriceStateClass(value);
  }

  function createDateFormatter({
    locale = getLocale(),
    timeZone = DEFAULT_TIME_ZONE,
    year = "numeric",
    month = "short",
    day = "numeric",
  } = {}) {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year,
      month,
      day,
    });
  }

  function formatDate(value, options = {}) {
    const timestamp = toTimestamp(value);

    if (timestamp === null) {
      return "—";
    }

    return createDateFormatter(options).format(new Date(timestamp));
  }

  /* ==========================================================================
     Chart API Configuration
     ========================================================================== */

  function getChartTokenUrl() {
    const config = getConfig();

    return normalizeText(config.getTokenUrl ?? config.getToken);
  }

  function getChartPageName() {
    return normalizeText(getConfig().pageName);
  }

  function getHistoricalChartType() {
    return normalizeText(getConfig().chartTypeHistorical) || "SQL_CI_CV_COM";
  }

  function getIntradayChartType() {
    return normalizeText(getConfig().chartTypeIntraday) || "SQL_CI_DV";
  }

  /* ==========================================================================
     JWT Token
     ========================================================================== */

  function normalizeTokenResponse(response) {
    if (!response) {
      return "";
    }

    if (typeof response === "string") {
      try {
        const parsed = JSON.parse(response);

        return normalizeText(parsed?.jwtToken);
      } catch {
        return "";
      }
    }

    if (isPlainObject(response)) {
      return normalizeText(response.jwtToken);
    }

    return "";
  }

  /* ==========================================================================
     Series Points
     ========================================================================== */

  function normalizeSeriesPoint(point) {
    if (Array.isArray(point)) {
      const timestamp = toTimestamp(point[0]);

      const value = toFiniteNumber(point[1]);

      if (timestamp === null || value === null) {
        return null;
      }

      return Object.freeze([timestamp, value]);
    }

    if (!isPlainObject(point)) {
      return null;
    }

    const timestamp = toTimestamp(
      point.timestamp ??
        point.dateTime ??
        point.datetime ??
        point.time ??
        point.date ??
        point.x,
    );

    const value = toFiniteNumber(
      point.value ??
        point.close ??
        point.closePrice ??
        point.price ??
        point.indexPrice ??
        point.y,
    );

    if (timestamp === null || value === null) {
      return null;
    }

    return Object.freeze([timestamp, value]);
  }

  function normalizeSeriesPoints(points) {
    if (!Array.isArray(points)) {
      return Object.freeze([]);
    }

    const byTimestamp = new Map();

    for (const point of points) {
      const normalized = normalizeSeriesPoint(point);

      if (!normalized) {
        continue;
      }

      byTimestamp.set(normalized[0], normalized);
    }

    return Object.freeze([...byTimestamp.values()].sort((a, b) => a[0] - b[0]));
  }

  /* ==========================================================================
     Chart Payload
     ========================================================================== */

  /**
   * The legacy graph API returns an array for the chart endpoint.
   *
   * Keep envelope handling here in case the backend wraps it.
   */

  function unwrapSeriesPayload(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    return [];
  }

  function normalizeSeriesPayload(payload) {
    return normalizeSeriesPoints(unwrapSeriesPayload(payload));
  }

  /* ==========================================================================
     Percentage Change
     ========================================================================== */

  function calculatePercentageChange(value, baseline) {
    const current = toFiniteNumber(value);

    const base = toFiniteNumber(baseline);

    if (current === null || base === null || base === 0) {
      return null;
    }

    return ((current - base) / base) * 100;
  }

  function getFirstValidValue(points) {
    for (const point of points) {
      const value = toFiniteNumber(point?.[1]);

      if (value !== null && value !== 0) {
        return value;
      }
    }

    return null;
  }

  function normalizeSeriesToPercentage(points) {
    const normalized = normalizeSeriesPoints(points);

    if (!normalized.length) {
      return Object.freeze([]);
    }

    const baseline = getFirstValidValue(normalized);

    if (baseline === null || baseline === 0) {
      return Object.freeze([]);
    }

    return Object.freeze(
      normalized
        .map(([timestamp, value]) => {
          const percentage = calculatePercentageChange(value, baseline);

          if (percentage === null) {
            return null;
          }

          return Object.freeze([timestamp, percentage]);
        })
        .filter(Boolean),
    );
  }

  /* ==========================================================================
     Peer Series Record
     ========================================================================== */

  function normalizePeerSeries({ peer, points } = {}) {
    const normalizedPeer = normalizePeer(peer);

    if (!normalizedPeer) {
      return null;
    }

    const normalizedPoints = normalizeSeriesPoints(points);

    return freezeRecord({
      ...normalizedPeer,

      points: normalizedPoints,

      percentagePoints: normalizeSeriesToPercentage(normalizedPoints),
    });
  }

  /* ==========================================================================
     Public API
     ========================================================================== */

  window.PeerComparisonUtils = Object.freeze({
    /* Config ------------------------------------------------------------ */

    getConfig,
    getLabels,
    getLabel,

    getLocale,

    getBaseCompanySymbol,
    getBaseCompanyName,

    getChartTokenUrl,
    getChartPageName,
    getHistoricalChartType,
    getIntradayChartType,

    normalizeTokenResponse,

    /* General ----------------------------------------------------------- */

    isPlainObject,

    normalizeText,
    normalizeCode,

    toFiniteNumber,
    toPositiveNumber,
    toInteger,
    toTimestamp,

    /* Peer identity ----------------------------------------------------- */

    getPeerSymbol,
    getPeerName,
    isBaseCompany,

    normalizePeer,
    normalizePeers,

    /* Summary ----------------------------------------------------------- */

    normalizeSummaryRow,
    normalizeSummaryRows,
    findSummaryRow,

    normalizeComparisonRecord,

    /* Formatting -------------------------------------------------------- */

    formatNumber,
    formatPercent,
    formatReturn,
    formatDate,

    getTrend,
    getTrendClass,
    getPriceStateClass,
    getDirectionSymbol,
    getReturnClass,

    /* Series ------------------------------------------------------------ */

    normalizeSeriesPoint,
    normalizeSeriesPoints,

    unwrapSeriesPayload,
    normalizeSeriesPayload,

    calculatePercentageChange,
    normalizeSeriesToPercentage,
    normalizePeerSeries,
  });
})();
