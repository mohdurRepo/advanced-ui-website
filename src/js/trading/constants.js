/* ==========================================================================
   Trading Constants
   ========================================================================== */

/*
 * Stable Trading page identifiers shared across modules.
 *
 * This file intentionally contains no:
 *
 * - DOM behavior
 * - AJAX logic
 * - DataTables logic
 * - rendering
 * - configuration parsing
 * - business transformations
 */

/* ==========================================================================
   Tabs
   ========================================================================== */

export const TRADING_TABS = Object.freeze({
  negotiatedDeals: "negotiatedDeals",
  accumulated: "accumulated",
  listedTradable: "listedTradable",
  companyStatus: "deListedCompanies",
  otcTrading: "otcTrading",
});

/* ==========================================================================
   Views
   ========================================================================== */

export const TRADING_VIEWS = Object.freeze({
  negotiatedDeals: "negotiatedDeals",
  minimumSize: "minimumSize",

  accumulatedLosses: "accumulatedLosses",

  listedTradableRights: "listedTradableRights",

  suspendedCompanies: "suspendedCompanies",
  delistedCompanies: "delistedCompanies",

  otcTrading: "otcTrading",
});

/* ==========================================================================
   Negotiated Variants
   ========================================================================== */

export const NEGOTIATED_TYPES = Object.freeze({
  negotiatedDeals: "Negotiated-Deals",
  minimumSize: "Minimum-Size",
});

/* ==========================================================================
   Company Status Types
   ========================================================================== */

export const COMPANY_STATUS_TYPES = Object.freeze({
  suspension: "Suspension",
  suspensionFunds: "Suspension_Funds",

  delisting: "Delisting",
  delistingFunds: "Delisting_Funds",
});

/* ==========================================================================
   Shared Values
   ========================================================================== */

export const TRADING_VALUES = Object.freeze({
  all: "All",
});

/* ==========================================================================
   Root Selectors
   ========================================================================== */

export const SELECTORS = Object.freeze({
  root: "[data-trading]",

  tabs: "[data-trading-tabs]",
  tab: "[data-trading-tab]",
  panel: "[data-trading-panel]",

  /* ------------------------------------------------------------------------
     Negotiated Deals
     ------------------------------------------------------------------------ */

  negotiated: {
    root: "[data-trading-negotiated]",

    filters: "[data-trading-negotiated-filters]",

    type: "[data-trading-negotiated-type]",
    sector: "[data-trading-negotiated-sector]",
    company: "[data-trading-negotiated-company]",

    fromDate: "[data-trading-negotiated-from-date]",
    toDate: "[data-trading-negotiated-to-date]",
  },

  /* ------------------------------------------------------------------------
     Accumulated Losses
     ------------------------------------------------------------------------ */

  accumulated: {
    root: "[data-trading-accumulated]",

    filters: "[data-trading-accumulated-filters]",

    report: "[data-trading-accumulated-report]",
  },

  /* ------------------------------------------------------------------------
     Suspended / Delisted
     ------------------------------------------------------------------------ */

  companyStatus: {
    root: "[data-trading-company-status]",

    filters: "[data-trading-company-status-filters]",

    type: "[data-trading-company-status-type]",

    fromDate: "[data-trading-company-status-from-date]",
    toDate: "[data-trading-company-status-to-date]",
  },

  /* ------------------------------------------------------------------------
     Minimum Size
     ------------------------------------------------------------------------ */

  minimumSize: {
    search: '[data-trading-table-search="minimumSize"]',
  },
});

/* ==========================================================================
   Selector Builders
   ========================================================================== */

/**
 * Return a selector for a Trading tab.
 *
 * @param {string} tab
 * @returns {string}
 */
export function getTabSelector(tab) {
  return `[data-trading-tab="${tab}"]`;
}

/**
 * Return a selector for a Trading tab panel.
 *
 * @param {string} tab
 * @returns {string}
 */
export function getPanelSelector(tab) {
  return `[data-trading-panel="${tab}"]`;
}

/**
 * Return a selector for a Trading data-view root.
 *
 * @param {string} view
 * @returns {string}
 */
export function getViewSelector(view) {
  return `[data-trading-view="${view}"]`;
}

/**
 * Return a selector for a Trading table.
 *
 * @param {string} view
 * @returns {string}
 */
export function getTableSelector(view) {
  return `[data-trading-table="${view}"]`;
}

/**
 * Return a selector for a Trading mobile-card container.
 *
 * @param {string} view
 * @returns {string}
 */
export function getCardsSelector(view) {
  return `[data-trading-cards="${view}"]`;
}

/**
 * Return a selector for a Trading result count.
 *
 * @param {string} view
 * @returns {string}
 */
export function getResultCountSelector(view) {
  return `[data-trading-result-count="${view}"]`;
}

/**
 * Return a selector for a Trading reset control.
 *
 * @param {string} key
 * @returns {string}
 */
export function getResetSelector(key) {
  return `[data-trading-reset="${key}"]`;
}

/* ==========================================================================
   Variant Selectors
   ========================================================================== */

/**
 * Return a selector for a Negotiated Deals presentation variant.
 *
 * @param {string} type
 * @returns {string}
 */
export function getNegotiatedVariantSelector(type) {
  return `[data-trading-variant="${type}"]`;
}

/**
 * Return a selector for the Suspended / Delisted presentation variant.
 *
 * @param {"suspended" | "delisted"} variant
 * @returns {string}
 */
export function getCompanyStatusVariantSelector(variant) {
  return `[data-trading-company-status-variant="${variant}"]`;
}
