/* ==========================================================================
   OTC Trading Tab
   ========================================================================== */

/*
 * Tab composition for OTC Trading.
 *
 * Responsibilities:
 *
 * - select the OTC endpoint
 * - build the legacy-compatible request payload
 * - connect normalized data to the desktop table and mobile cards
 * - delegate data-view lifecycle to createTradingTab()
 *
 * This module intentionally has no:
 *
 * - page-level tab navigation
 * - AJAX implementation
 * - response field normalization
 * - table implementation
 * - card implementation
 * - shared lifecycle implementation
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createTradingTab } from "../../shared/create-trading-tab.js";

import { normalizeString } from "../../../shared/trading/trading-formatters.js";

import { normalizeOtcTradingResponse } from "./otc-trading.normalizer.js";

import { createOtcTradingCards } from "./views/otc-trading.cards.js";

import { createOtcTradingTable } from "./views/otc-trading.table.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const TAB_KEY = "otc-trading";

const ENDPOINT_KEY = "otcTrading";

const VIEW_KEY = "otc-trading";

const DEFAULT_LOCALE = "en";

const DEFAULT_LOADING_ROW_COUNT = 6;

export const OTC_TRADING_SELECTORS = Object.freeze({
  table: "[data-otc-trading-table]",

  cards: "[data-otc-trading-cards]",

  resultCount: "[data-otc-trading-result-count]",

  status: "[data-otc-trading-status]",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function normalizeLocale(value) {
  return normalizeString(value) || DEFAULT_LOCALE;
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createOtcTradingTab(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError("createOtcTradingTab requires an options object.");
  }

  const root = options.root;

  if (!root || typeof root.querySelector !== "function") {
    throw new Error("OTC Trading requires a valid root element.");
  }

  const config = options.config;

  if (!isPlainObject(config)) {
    throw new TypeError("OTC Trading requires page configuration.");
  }

  /* ========================================================================
     Presentation Definitions
     ======================================================================== */

  const tableDefinition = createOtcTradingTable(config);

  const cardsDefinition = createOtcTradingCards(config);

  /* ========================================================================
     Shared Trading Tab
     ======================================================================== */

  return createTradingTab({
    root,

    config,

    key: TAB_KEY,

    selectors: OTC_TRADING_SELECTORS,

    /*
     * OTC has no request filters.
     *
     * createTradingTab() still requires a filter-definition object because
     * every standard trading tab uses the same controller contract.
     */
    filters: Object.freeze({}),

    initialView: VIEW_KEY,

    getView() {
      return VIEW_KEY;
    },

    endpointKey: ENDPOINT_KEY,

    buildRequestData() {
      return {
        requestLocale: normalizeLocale(config.locale),
      };
    },

    normalizeResponse(response) {
      return normalizeOtcTradingResponse(response);
    },

    /* ----------------------------------------------------------------------
       Desktop Table
       ---------------------------------------------------------------------- */

    getColumns(view, context) {
      return tableDefinition.getColumns(view, context);
    },

    getColumnGroups(view, context) {
      return tableDefinition.getColumnGroups(view, context);
    },

    renderCell(cellContext) {
      return tableDefinition.renderCell(cellContext);
    },

    tableOptions: {
      ...tableDefinition.tableOptions,

      ...(isPlainObject(options.tableOptions) ? options.tableOptions : {}),
    },

    /* ----------------------------------------------------------------------
       Mobile Cards
       ---------------------------------------------------------------------- */

    renderCard(context) {
      return cardsDefinition.renderCard(context);
    },

    /* ----------------------------------------------------------------------
       Source
       ---------------------------------------------------------------------- */

    sourceOptions: {
      ...(isPlainObject(options.sourceOptions) ? options.sourceOptions : {}),

      method: options.method || "GET",
    },

    /* ----------------------------------------------------------------------
       Behavior
       ---------------------------------------------------------------------- */

    loadingRowCount: options.loadingRowCount || DEFAULT_LOADING_ROW_COUNT,

    /*
     * OTC has a single fixed presentation, so a view change can never require
     * another server request.
     */
    reloadOnViewChange: false,

    reloadOnActivate: options.reloadOnActivate !== false,

    /*
     * Keep the Issuer Trading page genuinely lazy.
     *
     * issuer-trading.js passes autoInit:false and activates the feature only
     * when its tab becomes active.
     */
    autoInit: options.autoInit === true,

    active: options.active === true,

    /* ----------------------------------------------------------------------
       Optional Lifecycle Callbacks
       ---------------------------------------------------------------------- */

    onInit(context) {
      options.onInit?.({
        key: TAB_KEY,

        config,

        context,
      });
    },

    onDataLoaded(rows, meta, context) {
      options.onDataLoaded?.({
        rows,

        meta,

        key: TAB_KEY,

        context,
      });
    },

    onError(error, context) {
      options.onError?.(error, {
        key: TAB_KEY,

        context,
      });
    },

    onActivate(context) {
      options.onActivate?.({
        key: TAB_KEY,

        context,
      });
    },

    onDeactivate(context) {
      options.onDeactivate?.({
        key: TAB_KEY,

        context,
      });
    },

    onDestroy() {
      options.onDestroy?.();
    },
  });
}
