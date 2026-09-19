/* ==========================================================================
   Historical Reports Columns
   ========================================================================== */

/*
 * Column and visibility definitions for Historical Reports.
 *
 * Responsibilities:
 *
 * - define column order for Performance, Unadjusted, and Underlying tables
 * - define per-market/sector visible-column sets, matching legacy exactly
 * - define market/sector-dependent header label overrides
 * - define backend-field mappings
 * - define rendering-type metadata
 * - expose column lookup helpers
 *
 * This module intentionally has no:
 *
 * - DOM queries
 * - DataTables lifecycle
 * - request logic
 * - response normalization
 * - cell rendering
 * - card markup
 *
 * Legacy reference: historical.columns.js + historical.table.profiles.js
 * (getPerformanceHeaders / getUnadjustedHeaders / resolve*VisibleIndexes).
 *
 * Legacy drove visibility with positional index arrays into a fixed column
 * array (e.g. MF -> [0, 5, 10, 12]). That is fragile: reordering or adding a
 * column silently breaks every market's array. This module instead assigns
 * each column a stable, named `visibilityGroup` key and resolves visibility
 * by name, matching the pattern already established in
 * market-watch.columns.js. The mapping below was verified column-for-column
 * against legacy's index arrays for every market/sector/entity branch before
 * being written.
 */

/* ==========================================================================
   Special Indices
   ========================================================================== */

/*
 * Exported so historical.rules.js can import this rather than redefining
 * its own copy, as legacy did (the same list was duplicated verbatim in
 * both historical.rules.js and historical.columns.js).
 */

export const HISTORICAL_SPECIAL_INDICES = Object.freeze([
  "TLCIC",
  "TMCIC",
  "TSCIC",
  "TIPOC",
  "TT50CI",
]);

const SPECIAL_INDICES_SET = new Set(HISTORICAL_SPECIAL_INDICES);

/* ==========================================================================
   Column Order
   ========================================================================== */

/*
 * Fixed base order.
 *
 * Visibility only turns columns on/off by name; it never reorders them,
 * matching legacy's behavior exactly.
 */

export const HISTORICAL_PERFORMANCE_COLUMN_ORDER = Object.freeze([
  "date",
  "open",
  "high",
  "low",
  "close",
  "change",
  "changePercent",
  "volumeTraded",
  "turnOver",
  "noOfTrades",
  "nav",
  "lastYield",
  "aum",
]);

export const HISTORICAL_UNADJUSTED_COLUMN_ORDER = Object.freeze([
  "date",
  "open",
  "high",
  "low",
  "close",
  "change",
  "changePercent",
  "volumeTraded",
  "turnOver",
  "noOfTrades",
]);

/* ==========================================================================
   Helpers
   ========================================================================== */

function getLabels(config = {}) {
  return config?.labels?.table ?? {};
}

function column(definition = {}) {
  return {
    mobile: true,

    ...definition,
  };
}

/* ==========================================================================
   Header Label Overrides
   ========================================================================== */

/*
 * Performance headers are market/sector-dependent in legacy
 * (getPerformanceHeaders(filters)).
 *
 * Unadjusted headers are always static
 * (getUnadjustedHeaders() takes no filters parameter at all).
 *
 * That asymmetry is intentional and preserved.
 */

function resolveDateLabel(labels, filters) {
  if (filters.market === "MF") {
    return labels.mfDate || labels.date || "Date";
  }

  return labels.date || "Date";
}

function resolveChangeLabel(labels, filters) {
  if (filters.market === "DERIVATIVE") {
    return labels.changePoints || "Change Points";
  }

  return labels.change || "Change";
}

function resolveVolumeTradedLabel(labels, filters) {
  if (filters.market === "SUKUK") {
    return labels.nominalValueTraded || "Nominal Value Traded";
  }

  return labels.volumeTraded || "Volume Traded";
}

function resolveNoOfTradesLabel(labels, filters) {
  if (filters.market === "DERIVATIVE") {
    /*
     * Preserved exactly from legacy.
     *
     * For Derivatives this column's label becomes "Daily Settlement Price"
     * while the backend mapping remains `noOfTrades`.
     *
     * The legacy API reuses the same backend field with different semantic
     * meaning depending on the selected market/profile.
     */
    return labels.dailySettPrice || "Daily Settlement Price";
  }

  return labels.noOfTrades || "No. of Trades";
}

function resolveNavLabel(labels, filters) {
  if (filters.market === "MF") {
    return labels.mfNav || "NAV";
  }

  if (
    filters.market === "DERIVATIVE" &&
    (filters.sector === "S" || filters.sector === "I")
  ) {
    return labels.openInterest || "Open Interest";
  }

  return labels.nav || "NAV";
}

function resolveAumLabel(labels, filters) {
  if (filters.market === "MF") {
    /*
     * Preserved from legacy.
     *
     * MF historically uses the generic NAV label fallback for the AUM
     * position rather than a dedicated AUM message fallback.
     */
    return labels.nav || "AUM";
  }

  return labels.aum || "AUM";
}

/* ==========================================================================
   Performance Columns
   ========================================================================== */

/*
 * Legacy Performance values are largely server-rendered/pass-through values.
 *
 * Only Change and Change % use directional presentation.
 *
 * `type: "text"` therefore means:
 *
 * - use the backend value as supplied;
 * - escape it for display;
 * - use Historical's normal empty-value fallback.
 */

export function getHistoricalPerformanceColumns(config = {}, filters = {}) {
  const labels = getLabels(config);

  return [
    column({
      key: "date",

      visibilityGroup: "date",

      label: resolveDateLabel(labels, filters),

      data: "transactionDateStr",

      type: "text",

      className: "",
    }),

    column({
      key: "open",

      visibilityGroup: "open",

      label: labels.open || "Open",

      data: "todaysOpen",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "high",

      visibilityGroup: "high",

      label: labels.high || "High",

      data: "highPrice",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "low",

      visibilityGroup: "low",

      label: labels.low || "Low",

      data: "lowPrice",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "close",

      visibilityGroup: "close",

      label: labels.close || "Close",

      data: "previousClosePrice",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "change",

      visibilityGroup: "change",

      label: resolveChangeLabel(labels, filters),

      data: "change",

      type: "directional-number",

      className: "text-center",
    }),

    column({
      key: "change-percent",

      visibilityGroup: "changePercent",

      label: labels.changePercent || "% Change",

      data: "changePercent",

      type: "directional-number",

      className: "text-center",
    }),

    column({
      key: "volume-traded",

      visibilityGroup: "volumeTraded",

      label: resolveVolumeTradedLabel(labels, filters),

      data: "volumeTraded",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "turn-over",

      visibilityGroup: "turnOver",

      label: labels.turnOver || "Turnover",

      data: "turnOver",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "number-of-trades",

      visibilityGroup: "noOfTrades",

      label: resolveNoOfTradesLabel(labels, filters),

      data: "noOfTrades",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "nav",

      visibilityGroup: "nav",

      label: resolveNavLabel(labels, filters),

      data: "nav",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "last-yield",

      visibilityGroup: "lastYield",

      label: labels.closeYield || "Last Yield",

      data: "lastYield",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "aum",

      visibilityGroup: "aum",

      label: resolveAumLabel(labels, filters),

      data: "aum",

      type: "text",

      className: "text-center",
    }),
  ];
}

/* ==========================================================================
   Performance Visible Groups
   ========================================================================== */

/*
 * Verified against legacy's resolvePerformanceVisibleIndexes(filters) for:
 *
 * - Mutual Funds
 * - ETFs
 * - Sukuk
 * - normal Indices
 * - special Indices
 * - index entity type I
 * - Derivatives base
 * - Derivatives S / I
 * - Derivatives OS
 * - Main / NomuC / REITs / CEFs / TR / default
 */

export function getHistoricalPerformanceAvailableGroups(filters = {}) {
  const market = filters.market;

  const sector = filters.sector;

  const entity = filters.entity || "";

  switch (market) {
    case "MF":
      return ["date", "change", "nav", "aum"];

    case "ETFS":
      return [
        "date",
        "open",
        "high",
        "low",
        "close",
        "change",
        "changePercent",
        "volumeTraded",
        "turnOver",
        "noOfTrades",
        "nav",
      ];

    case "SUKUK":
      return [
        "date",
        "open",
        "high",
        "low",
        "close",
        "change",
        "changePercent",
        "volumeTraded",
        "turnOver",
        "noOfTrades",
        "lastYield",
      ];

    case "INDICES": {
      const entityParts = entity.split(":");

      const indexCode = entityParts[1] || "";

      const indexType = entityParts[2] || "";

      if (indexType === "I") {
        return [];
      }

      if (SPECIAL_INDICES_SET.has(indexCode)) {
        return [
          "date",
          "open",
          "high",
          "low",
          "close",
          "turnOver",
          "noOfTrades",
        ];
      }

      return [
        "date",
        "open",
        "high",
        "low",
        "close",
        "volumeTraded",
        "turnOver",
        "noOfTrades",
      ];
    }

    case "DERIVATIVE": {
      const groups = [
        "date",
        "open",
        "high",
        "low",
        "close",
        "change",
        "changePercent",
        "volumeTraded",
        "noOfTrades",
      ];

      if (sector === "S" || sector === "I") {
        groups.push("turnOver", "nav");
      }

      return groups;
    }

    case "MAIN":
    case "NOMUC":
    case "REITS":
    case "CEFS":
    case "TR":
    default:
      return [
        "date",
        "open",
        "high",
        "low",
        "close",
        "change",
        "changePercent",
        "volumeTraded",
        "turnOver",
        "noOfTrades",
      ];
  }
}
/* ==========================================================================
   Unadjusted Columns
   ========================================================================== */

/*
 * No market/sector-dependent label overrides.
 *
 * This mirrors legacy's getUnadjustedHeaders(), which takes no filters
 * parameter at all.
 */

export function getHistoricalUnadjustedColumns(config = {}) {
  const labels = getLabels(config);

  return [
    column({
      key: "date",

      visibilityGroup: "date",

      label: labels.date || "Date",

      data: "transactionDateStr",

      type: "text",

      className: "",
    }),

    column({
      key: "open",

      visibilityGroup: "open",

      label: labels.open || "Open",

      data: "todaysOpen",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "high",

      visibilityGroup: "high",

      label: labels.high || "High",

      data: "highPrice",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "low",

      visibilityGroup: "low",

      label: labels.low || "Low",

      data: "lowPrice",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "close",

      visibilityGroup: "close",

      label: labels.close || "Close",

      data: "previousClosePrice",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "change",

      visibilityGroup: "change",

      label: labels.change || "Change",

      data: "change",

      type: "directional-number",

      className: "text-center",
    }),

    column({
      key: "change-percent",

      visibilityGroup: "changePercent",

      label: labels.changePercent || "% Change",

      data: "changePercent",

      type: "directional-number",

      className: "text-center",
    }),

    column({
      key: "volume-traded",

      visibilityGroup: "volumeTraded",

      label: labels.volumeTraded || "Volume Traded",

      data: "volumeTraded",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "turn-over",

      visibilityGroup: "turnOver",

      label: labels.turnOver || "Turnover",

      data: "turnOver",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "number-of-trades",

      visibilityGroup: "noOfTrades",

      label: labels.noOfTrades || "No. of Trades",

      data: "noOfTrades",

      type: "text",

      className: "text-center",
    }),
  ];
}

/* ==========================================================================
   Unadjusted Visible Groups
   ========================================================================== */

/*
 * Verified against legacy's resolveUnadjustedVisibleIndexes(filters):
 *
 * - INDICES excludes Volume Traded
 * - every other market shows all ten columns
 */

export function getHistoricalUnadjustedAvailableGroups(filters = {}) {
  if (filters.market === "INDICES") {
    return [
      "date",
      "open",
      "high",
      "low",
      "close",
      "change",
      "changePercent",
      "turnOver",
      "noOfTrades",
    ];
  }

  return [...HISTORICAL_UNADJUSTED_COLUMN_ORDER];
}

/* ==========================================================================
   Underlying (Single Stock Options) Columns
   ========================================================================== */

/*
 * Legacy applies no visibility resolver to this table.
 *
 * All eleven columns are always shown.
 *
 * No visibilityGroup is therefore assigned to these columns. The shared
 * data-table layer treats a column without a visibilityGroup as permanently
 * visible.
 *
 * Numeric behavior also follows legacy:
 *
 * - strikePrice:        2 decimals
 * - referencePrice:     2 decimals
 * - lastTraddedPrice:   2 decimals
 * - volume:             integer
 * - openInterest:       2 decimals
 * - underlyingPrice:    2 decimals
 *
 * `lastTraddedPrice` is intentionally preserved exactly as supplied by the
 * legacy backend contract.
 */

export function getHistoricalUnderlyingColumns(config = {}) {
  const labels = getLabels(config)?.underlying ?? {};

  return [
    column({
      key: "instrument-type",

      label: labels.instrumentType || "Instrument Type",

      data: "instrumentType",

      type: "static-label",

      className: "text-center",

      mobile: false,
    }),

    column({
      key: "symbol",

      label: labels.symbol || "Symbol",

      data: "contractSymbol",

      urlData: "contractUrl",

      type: "link",

      className: "text-center",
    }),

    column({
      key: "underlying",

      label: labels.underlying || "Underlying",

      data: "underlying",

      urlData: "companyUrl",

      type: "link",

      className: "text-center",
    }),

    column({
      key: "expiry-date",

      label: labels.expiryDate || "Expiry Date",

      data: "expiryDate",

      type: "text",

      className: "text-center",
    }),

    column({
      key: "type",

      label: labels.type || "Type",

      data: "exerciseType",

      type: "exercise-type",

      className: "text-center",
    }),

    column({
      key: "strike-price",

      label: labels.strikePrice || "Strike Price",

      data: "strikePrice",

      type: "decimal",

      className: "table-cell-numeric",
    }),

    column({
      key: "reference-price",

      label: labels.referencePrice || "Reference Price",

      data: "referencePrice",

      type: "decimal",

      className: "table-cell-numeric",
    }),

    column({
      key: "last-traded-price",

      label: labels.lastTradedPrice || "Last Traded Price",

      data: "lastTraddedPrice",

      type: "decimal",

      className: "table-cell-numeric",
    }),

    column({
      key: "volume",

      label: labels.volume || "Volume",

      data: "volume",

      type: "integer",

      className: "table-cell-numeric",
    }),

    column({
      key: "open-interest",

      label: labels.openInterest || "Open Interest",

      data: "openInterest",

      type: "decimal",

      className: "table-cell-numeric",
    }),

    column({
      key: "underlying-price",

      label: labels.underlyingPrice || "Underlying Price",

      data: "underlyingPrice",

      type: "decimal",

      className: "table-cell-numeric",
    }),
  ];
}

/* ==========================================================================
   Column Lookup
   ========================================================================== */

export function getHistoricalColumnByKey(columns = [], key) {
  return columns.find((column) => column.key === key) || null;
}
