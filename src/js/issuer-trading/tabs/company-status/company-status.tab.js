/* ==========================================================================
   Company Status Tab
   ========================================================================== */

/*
 * Tab composition for:
 *
 * - Suspended Companies
 * - Delisted Companies
 * - Suspended Funds
 * - Delisted Funds
 *
 * Responsibilities:
 *
 * - define the Company Status request contract
 * - resolve Suspension / Delisting views
 * - connect Company Status filters
 * - connect the desktop table definition
 * - connect the mobile cards definition
 * - normalize the legacy response
 * - coordinate lifecycle through createTradingTab()
 *
 * This module intentionally has no:
 *
 * - shared data-view lifecycle implementation
 * - table cell markup
 * - card markup
 * - response-envelope parsing
 * - page-level tab navigation
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createTradingTab } from "../../shared/create-trading-tab.js";

import {
  formatRequestDate,
  normalizeString,
} from "../../../shared/trading/trading-formatters.js";

import {
  bindCompanyStatusFilters,
  createCompanyStatusDefaultDateRange,
  createCompanyStatusFilterDefinitions,
  getCompanyStatusView,
  normalizeCompanyStatusType,
} from "./company-status.filters.js";

import { normalizeCompanyStatusResponse } from "./company-status.normalizer.js";

import { createCompanyStatusTable } from "./views/company-status.table.js";

import { createCompanyStatusCards } from "./views/company-status.cards.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const TAB_KEY = "company-status";

const ENDPOINT_KEY = "companyStatus";

const DEFAULT_LOCALE = "en";

const DEFAULT_LOADING_ROW_COUNT = 6;

export const COMPANY_STATUS_SELECTORS = Object.freeze({
  table: "[data-company-status-table]",

  cards: "[data-company-status-cards]",

  resultCount: "[data-company-status-result-count]",

  status: "[data-company-status-status]",
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

/* ==========================================================================
   Request Data
   ========================================================================== */

function createRequestBuilder(config) {
  const locale = normalizeLocale(config.locale);

  return function buildRequestData(filters = {}) {
    return {
      renderType: "Search",

      fromDate: formatRequestDate(filters.fromDate),

      toDate: formatRequestDate(filters.toDate),

      formType: normalizeCompanyStatusType(filters.type),

      requestLocale: locale,
    };
  };
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

function normalizeResponse(response, context = {}) {
  /*
   * normalizeCompanyStatusResponse() historically receives the exact request
   * filters as context.state.
   *
   * createTradingTab() exposes those filters explicitly as requestFilters.
   * Preserve the normalizer contract here so the normalizer does not need to
   * know anything about the shared trading-tab context structure.
   */
  const requestFilters = context.requestFilters || context.filters || {};

  return normalizeCompanyStatusResponse(response, {
    ...context,

    state: requestFilters,

    filters: requestFilters,
  });
}

/* ==========================================================================
   Filter Binding
   ========================================================================== */

function createFilterBinder(defaultRange) {
  return function bindFilters({ root, filters, reload }) {
    return bindCompanyStatusFilters({
      root,

      filters,

      defaultRange,

      /*
       * Normal input/select changes are already handled by the shared
       * Data View controller through their configured effects.
       *
       * onReload() is reserved for explicit form submit and the special case
       * where Reset is pressed while the form is already at its defaults.
       */
      onReload() {
        return reload();
      },
    });
  };
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createCompanyStatusTab(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError("createCompanyStatusTab requires an options object.");
  }

  const root = options.root;

  if (!root || typeof root.querySelector !== "function") {
    throw new Error("Company Status requires a valid root element.");
  }

  const config = options.config;

  if (!isPlainObject(config)) {
    throw new TypeError("Company Status requires page configuration.");
  }

  /*
   * Calculate the default range once so:
   *
   * - DataFilters reset values
   * - filter initialization
   *
   * use exactly the same dates.
   */
  const defaultRange = createCompanyStatusDefaultDateRange();

  const tableDefinition = createCompanyStatusTable(config);

  const cardsDefinition = createCompanyStatusCards(config);

  const buildRequestData = createRequestBuilder(config);

  const bindFilters = createFilterBinder(defaultRange);

  /* ========================================================================
     Shared Trading Tab
     ======================================================================== */

  return createTradingTab({
    root,

    key: TAB_KEY,

    config,

    selectors: COMPANY_STATUS_SELECTORS,

    /* ======================================================================
       Filters
       ====================================================================== */

    filters: createCompanyStatusFilterDefinitions({
      defaultRange,
    }),

    bindFilters,

    /* ======================================================================
       View
       ====================================================================== */

    initialView: tableDefinition.initialView,

    getView({ filters }) {
      return getCompanyStatusView(filters);
    },

    /* ======================================================================
       Endpoint / Request
       ====================================================================== */

    endpointKey: ENDPOINT_KEY,

    buildRequestData,

    sourceOptions: {
      ...(isPlainObject(options.sourceOptions) ? options.sourceOptions : {}),

      method: options.method || "GET",

      dataType: "json",
    },

    /* ======================================================================
       Response
       ====================================================================== */

    normalizeResponse,

    /* ======================================================================
       Desktop Table
       ====================================================================== */

    headerMode: "schema",

    getColumns(view) {
      return tableDefinition.getColumns(view);
    },

    getColumnGroups(view) {
      return tableDefinition.getColumnGroups(view);
    },

    renderHeader(context) {
      return tableDefinition.renderHeader(context);
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
      return cardsDefinition.renderCard({
        row: context.row,

        ...context,
      });
    },

    /* ======================================================================
       Lifecycle
       ====================================================================== */

    loadingRowCount: Number.isFinite(Number(options.loadingRowCount))
      ? Number(options.loadingRowCount)
      : DEFAULT_LOADING_ROW_COUNT,

    /*
     * Changing Company Status type changes the complete table schema.
     *
     * The shared controller synchronizes the new view and then reloads using
     * the newly selected formType.
     */
    reloadOnViewChange: true,

    reloadOnActivate: options.reloadOnActivate !== false,

    autoInit: options.autoInit !== false,

    active: options.active === true,

    /* ======================================================================
       Hooks
       ====================================================================== */

    onInit: options.onInit,

    onActivate: options.onActivate,

    onDeactivate: options.onDeactivate,

    onDataLoaded(response, controllerContext, context) {
      /*
       * Preserve the previous public callback shape:
       *
       * {
       *   rows,
       *   meta
       * }
       */
      options.onDataLoaded?.(
        {
          rows: normalizeRows(response?.rows),

          meta: isPlainObject(response?.meta) ? response.meta : {},
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

    onViewSync(view, context) {
      /*
       * Company Status does not use column visibility groups.
       *
       * Keep the former callback's second argument available as an empty
       * collection for callers that still consume the old signature.
       */
      options.onViewSync?.(
        view,

        [],

        context,
      );
    },

    onError: options.onError,

    onDestroy: options.onDestroy,
  });
}
