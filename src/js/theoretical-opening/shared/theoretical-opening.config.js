/* ==========================================================================
   Theoretical Opening Configuration
   ========================================================================== */

const DEFAULT_CONFIG = Object.freeze({
  endpoint: "",
  locale: "en",

  initialState: {
    sector: "All",
  },

  table: {
    autoWidth: false,

    paging: false,
    searching: false,
    ordering: false,
    info: false,
    lengthChange: false,

    serverSide: false,
    processing: false,

    scrollX: true,
    scrollCollapse: true,

    fixedHeader: true,
    fixedColumns: 1,
  },

  labels: {
    loading: "Loading...",
    noData: "No data available",

    mobile: {
      symbolCompany: "Symbol & Company",
      priceVolume: "TOP / TOV",
      showDetails: "Show details",
      hideDetails: "Hide details",
    },

    table: {
      company: "Company",
      previousClose: "Previous Close",
      top: "TOP",
      tov: "TOV",
    },
  },
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

/* ==========================================================================
   Configuration
   ========================================================================== */

export function createTheoreticalOpeningConfig(runtimeConfig = {}) {
  const config = normalizeObject(runtimeConfig);

  const initialState = normalizeObject(config.initialState);

  const table = normalizeObject(config.table);

  const labels = normalizeObject(config.labels);

  const mobileLabels = normalizeObject(labels.mobile);

  const tableLabels = normalizeObject(labels.table);

  return {
    endpoint: normalizeString(config.endpoint, DEFAULT_CONFIG.endpoint),

    locale: normalizeString(config.locale, DEFAULT_CONFIG.locale),

    initialState: {
      sector: normalizeString(
        initialState.sector,
        DEFAULT_CONFIG.initialState.sector,
      ),
    },

    table: {
      ...DEFAULT_CONFIG.table,
      ...table,
    },

    labels: {
      loading: normalizeString(labels.loading, DEFAULT_CONFIG.labels.loading),

      noData: normalizeString(labels.noData, DEFAULT_CONFIG.labels.noData),

      mobile: {
        symbolCompany: normalizeString(
          mobileLabels.symbolCompany,
          DEFAULT_CONFIG.labels.mobile.symbolCompany,
        ),

        priceVolume: normalizeString(
          mobileLabels.priceVolume,
          DEFAULT_CONFIG.labels.mobile.priceVolume,
        ),

        showDetails: normalizeString(
          mobileLabels.showDetails,
          DEFAULT_CONFIG.labels.mobile.showDetails,
        ),

        hideDetails: normalizeString(
          mobileLabels.hideDetails,
          DEFAULT_CONFIG.labels.mobile.hideDetails,
        ),
      },

      table: {
        company: normalizeString(
          tableLabels.company,
          DEFAULT_CONFIG.labels.table.company,
        ),

        previousClose: normalizeString(
          tableLabels.previousClose,
          DEFAULT_CONFIG.labels.table.previousClose,
        ),

        top: normalizeString(tableLabels.top, DEFAULT_CONFIG.labels.table.top),

        tov: normalizeString(tableLabels.tov, DEFAULT_CONFIG.labels.table.tov),
      },
    },
  };
}
