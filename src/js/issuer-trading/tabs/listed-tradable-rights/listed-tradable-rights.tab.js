/* ==========================================================================
   Listed Tradable Rights Tab
   ========================================================================== */

/*
 * Tab composition for Listed Tradable Rights.
 *
 * Responsibilities:
 *
 * - build the legacy request parameters
 * - connect response normalization
 * - connect the desktop table definition
 * - connect the mobile card definition
 * - coordinate lifecycle through createTradingTab()
 *
 * This module intentionally has no:
 *
 * - shared state implementation
 * - request lifecycle implementation
 * - table cell markup
 * - card markup
 * - response-envelope parsing
 * - global tab-navigation behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createTradingTab } from "../../shared/create-trading-tab.js";

import { normalizeString } from "../../../shared/trading/trading-formatters.js";

import { normalizeListedTradableRightsResponse } from "./listed-tradable-rights.normalizer.js";

import { createListedTradableRightsCards } from "./views/listed-tradable-rights.cards.js";

import { createListedTradableRightsTable } from "./views/listed-tradable-rights.table.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const TAB_KEY = "listed-tradable-rights";

const ENDPOINT_KEY = "listedTradableRights";

const VIEW_KEY = "listed-tradable-rights";

const DEFAULT_LOCALE = "en";

const DEFAULT_LOADING_ROW_COUNT = 6;

const DEFAULT_LOADING_CARD_COUNT = 3;

export const LISTED_TRADABLE_RIGHTS_SELECTORS = Object.freeze({
  table: "[data-listed-tradable-rights-table]",

  cards: "[data-listed-tradable-rights-cards]",

  resultCount: "[data-listed-tradable-rights-result-count]",

  status: "[data-listed-tradable-rights-status]",
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

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function normalizeLocale(value) {
  return normalizeString(value) || DEFAULT_LOCALE;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.floor(number);
}

/* ==========================================================================
   Request Data
   ========================================================================== */

function createRequestBuilder(config) {
  const locale = normalizeLocale(config.locale);

  return function buildRequestData() {
    return {
      requestLocale: locale,
    };
  };
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createListedTradableRightsTab(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      "createListedTradableRightsTab requires an options object.",
    );
  }

  const root = options.root;

  if (!root || typeof root.querySelector !== "function") {
    throw new Error("Listed Tradable Rights requires a valid root element.");
  }

  const config = options.config;

  if (!isPlainObject(config)) {
    throw new TypeError("Listed Tradable Rights requires page configuration.");
  }

  const tableDefinition = createListedTradableRightsTable(config);

  const cardsDefinition = createListedTradableRightsCards(config);

  const buildRequestData = createRequestBuilder(config);

  const loadingCardCount = normalizePositiveInteger(
    options.loadingCardCount,
    DEFAULT_LOADING_CARD_COUNT,
  );

  /* ========================================================================
     Shared Trading Tab
     ======================================================================== */

  return createTradingTab({
    root,

    key: TAB_KEY,

    config,

    selectors: LISTED_TRADABLE_RIGHTS_SELECTORS,

    /* ======================================================================
       Filters / View
       ====================================================================== */

    /*
     * Listed Tradable Rights has no user filters.
     *
     * createTradingTab() still requires a filter definition object, and the
     * common filter controller safely supports an empty definition.
     */
    filters: Object.freeze({}),

    initialView: VIEW_KEY,

    getView() {
      return VIEW_KEY;
    },

    /* ======================================================================
       Endpoint / Request
       ====================================================================== */

    endpointKey: ENDPOINT_KEY,

    buildRequestData,

    normalizeResponse: normalizeListedTradableRightsResponse,

    sourceOptions: {
      ...(isPlainObject(options.sourceOptions) ? options.sourceOptions : {}),

      method: options.method || "GET",
    },

    /* ======================================================================
       Desktop Table
       ====================================================================== */

    /*
     * The JSP already owns the semantic multi-row header.
     */
    headerMode: tableDefinition.headerMode || "existing",

    getColumns() {
      return tableDefinition.getColumns();
    },

    getColumnGroups() {
      return tableDefinition.getColumnGroups();
    },

    renderCell(context) {
      return tableDefinition.renderCell(context);
    },

    tableOptions: {
      ...tableDefinition.tableOptions,

      ...(isPlainObject(options.tableOptions) ? options.tableOptions : {}),
    },

    /* ======================================================================
       Mobile Cards
       ====================================================================== */

    renderCard(context) {
      return cardsDefinition.renderCard(context);
    },

    renderCardsLoading() {
      return cardsDefinition.renderLoading({
        count: loadingCardCount,
      });
    },

    renderCardsEmpty(message) {
      return cardsDefinition.renderEmpty(message);
    },

    renderCardsError(message) {
      return cardsDefinition.renderError(message);
    },

    /* ======================================================================
       Result Count
       ====================================================================== */

    /*
     * The normalizer exposes meta.total when supplied by the service.
     *
     * createTradingTab() already prefers that value over rows.length.
     */
    getResultCount(rows = [], context = {}) {
      const total = Number(context.state?.meta?.total);

      if (Number.isFinite(total) && total >= 0) {
        return total;
      }

      return rows.length;
    },

    /* ======================================================================
       Lifecycle
       ====================================================================== */

    loadingRowCount: normalizePositiveInteger(
      options.loadingRowCount,
      DEFAULT_LOADING_ROW_COUNT,
    ),

    /*
     * There is only one presentation view.
     */
    reloadOnViewChange: false,

    reloadOnActivate: options.reloadOnActivate !== false,

    /*
     * Preserve the previous lazy initialization behavior.
     *
     * issuer-trading.js activates this module when its tab becomes active.
     */
    autoInit: options.autoInit === true,

    active: options.active === true,

    /* ======================================================================
       Hooks
       ====================================================================== */

    onInit(context) {
      options.onInit?.({
        config,

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

    onDataLoaded(response, controllerContext, context) {
      /*
       * Preserve the former primary callback payload.
       */
      options.onDataLoaded?.(
        {
          rows: normalizeRows(response?.rows),

          meta: isPlainObject(response?.meta) ? response.meta : {},

          key: TAB_KEY,
        },

        controllerContext,

        context,
      );
    },

    onRowsRendered(rows, controllerContext, context) {
      options.onRowsRendered?.(
        normalizeRows(rows),

        controllerContext,

        context,
      );
    },

    onTableDraw: options.onTableDraw,

    onCardsRendered: options.onCardsRendered,

    onError(error, controllerContext, context) {
      /*
       * Keep the former key available to existing callers while still
       * exposing the shared controller context as additional arguments.
       */
      options.onError?.(
        error,

        {
          key: TAB_KEY,

          controllerContext,

          context,
        },
      );
    },

    onDestroy() {
      options.onDestroy?.();
    },
  });
}
