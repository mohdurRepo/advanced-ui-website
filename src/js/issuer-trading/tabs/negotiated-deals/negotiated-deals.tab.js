/* ==========================================================================
   Negotiated Deals Tab
   ========================================================================== */

/*
 * Tab composition for:
 *
 * - Negotiated Deals
 * - Main Market Minimum Size Requirements
 *
 * Responsibilities:
 *
 * - compose both tab views
 * - select the correct endpoint
 * - build legacy-compatible request parameters
 * - load dependent Company options by Sector
 * - dispatch table/card rendering to the active view
 * - coordinate tab lifecycle through createTradingTab()
 *
 * This module intentionally has no:
 *
 * - page-level tab navigation
 * - JSP configuration creation
 * - response field formatting
 * - shared component implementation
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataSource } from "../../../../common/data-view/index.js";

import { getIssuerTradingEndpoint } from "../../issuer-trading-config.js";

import { createTradingTab } from "../../shared/create-trading-tab.js";

import {
  formatRequestDate,
  normalizeString,
} from "../../../shared/trading/trading-formatters.js";

import {
  bindNegotiatedDealsFilters,
  createNegotiatedDealsFilterDefinitions,
  getDefaultNegotiatedDealsDateRange,
  getNegotiatedDealsView,
  NEGOTIATED_DEALS_TYPES,
  NEGOTIATED_DEALS_VIEWS,
} from "./negotiated-deals.filters.js";

import { normalizeNegotiatedDealsResponse } from "./negotiated-deals.normalizer.js";

import { createMinimumSizeView } from "./views/minimum-size.view.js";

import { createNegotiatedDealsView } from "./views/negotiated-deals.view.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const TAB_KEY = "negotiated-deals";

const ALL_VALUE = "All";

const DEFAULT_LOCALE = "en";

export const NEGOTIATED_DEALS_SELECTORS = Object.freeze({
  table: "[data-negotiated-deals-table]",

  cards: "[data-negotiated-deals-cards]",

  resultCount: "[data-negotiated-deals-result-count]",

  status: "[data-negotiated-deals-status]",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeFilterValue(value, fallback = ALL_VALUE) {
  return normalizeString(value) || fallback;
}

function normalizeLocale(value) {
  return normalizeString(value) || DEFAULT_LOCALE;
}

/* ==========================================================================
   Views
   ========================================================================== */

function createViews(config) {
  return Object.freeze({
    [NEGOTIATED_DEALS_VIEWS.negotiatedDeals]: createNegotiatedDealsView(config),

    [NEGOTIATED_DEALS_VIEWS.minimumSize]: createMinimumSizeView(config),
  });
}

function getViewDefinition(views, view) {
  return views[view] || views[NEGOTIATED_DEALS_VIEWS.negotiatedDeals];
}

/* ==========================================================================
   Endpoint
   ========================================================================== */

function getEndpointKey(context = {}) {
  return context.view === NEGOTIATED_DEALS_VIEWS.minimumSize
    ? "minimumSize"
    : "negotiatedDeals";
}

/* ==========================================================================
   Request Data
   ========================================================================== */

function createRequestDataBuilder(config) {
  const locale = normalizeLocale(config.locale);

  return function buildRequestData(filters = {}) {
    const view = getNegotiatedDealsView(filters);

    /*
     * Minimum Size uses its own endpoint and requires only locale.
     */
    if (view === NEGOTIATED_DEALS_VIEWS.minimumSize) {
      return {
        requestLocale: locale,
      };
    }

    /*
     * Date ownership belongs to negotiated-deals.filters.js.
     *
     * The filter binding normally initializes these values before the first
     * request. The fallback protects direct/programmatic loads without
     * maintaining a second date-range implementation here.
     */
    const defaultRange = getDefaultNegotiatedDealsDateRange();

    const fromDate = normalizeString(filters.fromDate) || defaultRange.fromDate;

    const toDate = normalizeString(filters.toDate) || defaultRange.toDate;

    return {
      type: NEGOTIATED_DEALS_TYPES.negotiatedDeals,

      sector: normalizeFilterValue(filters.sector),

      company: normalizeFilterValue(filters.company),

      fromDate: formatRequestDate(fromDate),

      toDate: formatRequestDate(toDate),

      requestLocale: locale,
    };
  };
}

/* ==========================================================================
   Company Source
   ========================================================================== */

function createCompanySource(config) {
  return createDataSource({
    endpoint: getIssuerTradingEndpoint(config, "companiesBySector"),

    method: "GET",

    dataType: "json",

    buildRequestData(state = {}) {
      return {
        format: "json",

        sector: normalizeFilterValue(state.sector),
      };
    },
  });
}

/* ==========================================================================
   Filter Errors
   ========================================================================== */

function dispatchFilterError(root, error) {
  root.dispatchEvent(
    new CustomEvent("issuer-trading:filter-error", {
      bubbles: true,

      detail: Object.freeze({
        tab: TAB_KEY,

        filter: "company",

        error,
      }),
    }),
  );
}

/* ==========================================================================
   Filter Binding
   ========================================================================== */

function createFilterBinder({ config, onFilterError }) {
  return function bindFilters({ root, filters, reload }) {
    const companySource = createCompanySource(config);

    const filterBinding = bindNegotiatedDealsFilters({
      root,

      filters,

      async loadCompanies(sector) {
        const response = await companySource.load({
          sector,
        });

        return Array.isArray(response?.rows) ? response.rows : [];
      },

      onReload() {
        return reload();
      },

      onError(error) {
        dispatchFilterError(root, error);

        onFilterError?.(error, {
          tab: TAB_KEY,

          filter: "company",

          filters: filters.getState(),
        });
      },
    });

    return Object.freeze({
      destroy() {
        filterBinding.destroy();

        companySource.destroy();
      },
    });
  };
}

/* ==========================================================================
   Table Options
   ========================================================================== */

function createTableOptions(views) {
  const negotiatedView = getViewDefinition(
    views,
    NEGOTIATED_DEALS_VIEWS.negotiatedDeals,
  );

  const minimumSizeView = getViewDefinition(
    views,
    NEGOTIATED_DEALS_VIEWS.minimumSize,
  );

  return {
    ...negotiatedView.tableOptions,

    /*
     * One DataTable instance serves both presentations.
     *
     * createdRow therefore dispatches using the normalized row type rather
     * than capturing whichever view happened to be active during table
     * initialization.
     */
    createdRow(rowElement, row, dataIndex, cells) {
      const view =
        row?.rowType === "minimum-size" ? minimumSizeView : negotiatedView;

      view.tableOptions?.createdRow?.(rowElement, row, dataIndex, cells);
    },

    rowId(row) {
      return normalizeString(row?.id);
    },
  };
}

/* ==========================================================================
   Result Count
   ========================================================================== */

function getResultCount(rows = [], context = {}) {
  const normalizedTotal = Number(context.state?.meta?.total);

  if (Number.isFinite(normalizedTotal) && normalizedTotal >= 0) {
    return normalizedTotal;
  }

  if (context.view === NEGOTIATED_DEALS_VIEWS.minimumSize) {
    return rows.length;
  }

  return rows.filter((row) => row?.rowType === "deal").length;
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createNegotiatedDealsTab(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("createNegotiatedDealsTab requires an options object.");
  }

  const root = options.root;

  if (!root || typeof root.querySelector !== "function") {
    throw new Error("Negotiated Deals requires a valid root element.");
  }

  const config = options.config;

  if (!isObject(config)) {
    throw new TypeError(
      "Negotiated Deals requires Issuer Trading configuration.",
    );
  }

  const views = createViews(config);

  const buildRequestData = createRequestDataBuilder(config);

  const bindFilters = createFilterBinder({
    config,

    onFilterError: options.onFilterError,
  });

  /* ========================================================================
     View Dispatch
     ======================================================================== */

  function resolveView(view) {
    return getViewDefinition(views, view);
  }

  function getColumns(view) {
    return resolveView(view).columns;
  }

  function renderCell(context) {
    return resolveView(context.view).renderCell(context);
  }

  function renderHeader(context) {
    const view = resolveView(context.view);

    if (typeof view.renderHeader !== "function") {
      /*
       * Returning false delegates header generation to createDataTable().
       */
      return false;
    }

    return view.renderHeader(context);
  }

  function renderCard(context) {
    const view = resolveView(context.view);

    return view.renderCard(context.row, context);
  }

  /* ========================================================================
     Card Group Dispatch
     ======================================================================== */

  function getCardGroupKey(row, context) {
    const view = resolveView(context.view);

    if (typeof view.getCardGroupKey !== "function") {
      return null;
    }

    return view.getCardGroupKey(row, context);
  }

  function getCardGroupLabel(groupKey, rows, context) {
    const view = resolveView(context.view);

    if (typeof view.getCardGroupLabel !== "function") {
      return "";
    }

    return view.getCardGroupLabel(groupKey, rows, context);
  }

  function renderCardGroup(context) {
    const view = resolveView(context.view);

    /*
     * Minimum Size has no business grouping.
     *
     * Because Negotiated Deals enables card grouping on the shared cards
     * instance, Minimum Size still passes through one internal group.
     * Returning its generated cards directly avoids adding an unnecessary
     * group wrapper.
     */
    if (typeof view.renderCardGroup !== "function") {
      return context.cards;
    }

    return view.renderCardGroup(context);
  }

  /* ========================================================================
     Shared Trading Tab
     ======================================================================== */

  return createTradingTab({
    root,

    key: TAB_KEY,

    config,

    selectors: NEGOTIATED_DEALS_SELECTORS,

    filters: createNegotiatedDealsFilterDefinitions(),

    initialView: NEGOTIATED_DEALS_VIEWS.negotiatedDeals,

    getView({ filters }) {
      return getNegotiatedDealsView(filters);
    },

    getEndpointKey,

    buildRequestData,

    normalizeResponse: normalizeNegotiatedDealsResponse,

    bindFilters,

    getColumns,

    renderCell,

    renderHeader,

    renderCard,

    getCardGroupKey,

    getCardGroupLabel,

    renderCardGroup,

    tableOptions: createTableOptions(views),

    getResultCount,

    sourceOptions: {
      method: "GET",

      dataType: "json",
    },

    loadingRowCount: options.loadingRowCount || 6,

    reloadOnViewChange: true,

    reloadOnActivate: options.reloadOnActivate !== false,

    autoInit: options.autoInit === true,

    active: options.active === true,

    onInit: options.onInit,

    onActivate: options.onActivate,

    onDeactivate: options.onDeactivate,

    onDataLoaded: options.onDataLoaded,

    onRowsRendered: options.onRowsRendered,

    onError: options.onError,

    onDestroy: options.onDestroy,
  });
}
