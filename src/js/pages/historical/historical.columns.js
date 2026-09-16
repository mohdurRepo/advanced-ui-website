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
 * Fixed base order. Visibility only turns columns on/off by name; it never
 * reorders them, matching legacy's behavior exactly (applyVisibility() only
 * ever toggled a `visible` flag on a fixed-order array).
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
 * (getPerformanceHeaders(filters)). Unadjusted headers are always static
 * (getUnadjustedHeaders() takes no filters at all) -- that asymmetry is
 * intentional and preserved below.
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
     * Preserved exactly from legacy (historical.table.profiles.js,
     * getPerformanceHeaders): for Derivatives this column's header reads
     * "Daily Settlement Price" while the data binding underneath remains
     * `noOfTrades`. The same backend field carries a different real-world
     * meaning depending on market context in the legacy API. This looks
     * unusual on its face -- confirm it's intentional rather than a
     * historical mislabeling before relying on it further.
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
     * Preserved exactly from legacy: for MF, the AUM column's header
     * fallback reuses the generic "nav" message key/text
     * (getMessage("table.header.nav", "AUM")), not a dedicated AUM key.
     * This reads as a legacy content bug rather than an intentional
     * business rule -- flagging rather than silently changing it, since
     * the instruction is to match legacy 100%.
     */
    return labels.nav || "AUM";
  }

  return labels.aum || "AUM";
}

/* ==========================================================================
   Performance Columns
   ========================================================================== */

/*
 * Legacy base columns (basePerformanceColumns()) render every field as a
 * plain, unformatted pass-through with a "-" fallback for empty values --
 * no client-side number formatting is applied anywhere in the base
 * Performance/Unadjusted columns. Only Change and Change % receive special
 * treatment (renderDirectionalNumber: an up/down icon plus a semantic
 * class). "type: 'text'" below reflects that pass-through behavior
 * precisely; it does not mean "format as text", it means "render exactly
 * what the backend sent, with an empty-value fallback".
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
 * Verified against legacy's resolvePerformanceVisibleIndexes(filters) for
 * every branch (MF, ETFS, SUKUK, INDICES non-special, INDICES special,
 * INDICES index-type "I", DERIVATIVE base, DERIVATIVE sector S/I,
 * DERIVATIVE sector OS, and the MAIN/NOMUC/REITS/CEFS/TR/default branch)
 * before being written here. Set membership matches exactly in every case;
 * only the representation changed, from position to name.
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
 * No market/sector-dependent label overrides. This mirrors legacy's
 * getUnadjustedHeaders(), which takes no filters parameter at all.
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
 * INDICES excludes Volume Traded ([0,1,2,3,4,5,6,8,9]); every other market
 * shows all ten columns.
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
 * Legacy applies no visibility resolver to this table at all -- all eleven
 * columns are always shown (derivativesUnderlyingColumns() is passed
 * straight through with no applyVisibility() call). No visibilityGroup is
 * set on any of these columns; the shared isColumnVisible() helper in
 * data-table.js treats a column with no visibilityGroup as always visible,
 * which reproduces that behavior without special-casing it here.
 *
 * strikePrice / referencePrice / lastTraddedPrice / openInterest /
 * underlyingPrice use legacy's num() helper (2-decimal formatting); volume
 * uses renderInteger (0 decimals). "lastTraddedPrice" (missing the second
 * "e") is preserved exactly -- it is the live backend field name in legacy,
 * not a typo safe to silently correct.
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
