/* ==========================================================================
   OTC Trading Tab
   ========================================================================== */

/*
 * Tab composition for OTC Trading.
 *
 * Responsibilities:
 *
 * - compose the shared trading-tab lifecycle
 * - build the legacy request parameters
 * - connect response normalization
 * - connect the desktop table
 * - connect the mobile cards
 * - support lazy activation and request cancellation
 *
 * This module intentionally has no:
 *
 * - company markup
 * - table cell markup
 * - card markup
 * - response-envelope parsing
 * - global tab-navigation behavior
 *
 * OTC Trading has no user filters. The endpoint is called with the current
 * request locale when the tab is activated.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createTradingTab } from "../../shared/create-trading-tab.js";

import { normalizeString } from "../../shared/trading-formatters.js";

import { normalizeOtcTradingResponse } from "./otc-trading.normalizer.js";

import { createOtcTradingTable } from "./views/otc-trading.table.js";

import { createOtcTradingCards } from "./views/otc-trading.cards.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const TAB_KEY = "otc-trading";

const ENDPOINT_KEY = "otcTrading";

const VIEW_KEY = "otc-trading";

const DEFAULT_LOCALE = "en";

const SELECTORS = Object.freeze({
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

/* ==========================================================================
   Request Data
   ========================================================================== */

function createRequestBuilder(config) {
  return function buildRequestData() {
    return {
      requestLocale: normalizeString(config.locale, DEFAULT_LOCALE),
    };
  };
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

  const tableDefinition = createOtcTradingTable(config);

  const cardsDefinition = createOtcTradingCards(config);

  const sourceOptions = {
    ...(isPlainObject(options.sourceOptions) ? options.sourceOptions : {}),

    method: options.method || "GET",
  };

  const tableOptions = {
    ...tableDefinition.tableOptions,

    ...(isPlainObject(options.tableOptions) ? options.tableOptions : {}),
  };

  return createTradingTab({
    key: TAB_KEY,

    root,
    config,

    selectors: SELECTORS,

    /*
     * OTC Trading has no filters.
     *
     * The shared filter controller supports an empty field definition and
     * therefore remains part of the standard tab lifecycle without adding
     * DOM listeners or reload effects.
     */

    filters: Object.freeze({}),

    endpointKey: ENDPOINT_KEY,

    initialView: VIEW_KEY,

    getView() {
      return VIEW_KEY;
    },

    getColumns() {
      return tableDefinition.getColumns();
    },

    getColumnGroups() {
      return tableDefinition.getColumnGroups();
    },

    renderCell(cellContext) {
      return tableDefinition.renderCell(cellContext);
    },

    renderCard(cardContext) {
      return cardsDefinition.renderCard(cardContext);
    },

    buildRequestData: createRequestBuilder(config),

    normalizeResponse(response, context) {
      return normalizeOtcTradingResponse(response, context);
    },

    headerMode: "schema",

    tableOptions,

    sourceOptions,

    loadingRowCount: options.loadingRowCount || 6,

    reloadOnViewChange: false,

    reloadOnActivate: options.reloadOnActivate !== false,

    autoInit: options.autoInit,

    active: options.active === true,

    onInit: options.onInit,

    onActivate: options.onActivate,

    onDeactivate: options.onDeactivate,

    onDataLoaded: options.onDataLoaded,

    onRowsRendered: options.onRowsRendered,

    onTableDraw: options.onTableDraw,

    onCardsRendered: options.onCardsRendered,

    onError: options.onError,

    onDestroy: options.onDestroy,
  });
}
