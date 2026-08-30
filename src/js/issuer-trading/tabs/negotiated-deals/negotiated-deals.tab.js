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
} from "../../../../shared/trading/trading-formatters.js";
import {
  bindNegotiatedDealsFilters,
  createNegotiatedDealsFilterDefinitions,
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
  return normalizeString(value) || "en";
}

function normalizeRowId(value) {
  return normalizeString(value);
}

/* ==========================================================================
   Default Date Range
   ========================================================================== */

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function subtractOneMonth(date) {
  const year = date.getFullYear();

  const month = date.getMonth() - 1;

  const targetFirstDay = new Date(year, month, 1);

  const targetYear = targetFirstDay.getFullYear();

  const targetMonth = targetFirstDay.getMonth();

  const targetDay = Math.min(
    date.getDate(),

    getDaysInMonth(targetYear, targetMonth),
  );

  return new Date(targetYear, targetMonth, targetDay);
}

function formatInputDateValue(date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const today = new Date();

  const fromDate = subtractOneMonth(today);

  return Object.freeze({
    fromDate: formatInputDateValue(fromDate),

    toDate: formatInputDateValue(today),
  });
}

/* ==========================================================================
   View Collection
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
   Endpoint Selection
   ========================================================================== */

function getEndpointKey(context = {}) {
  if (context.view === NEGOTIATED_DEALS_VIEWS.minimumSize) {
    return "minimumSize";
  }

  return "negotiatedDeals";
}

/* ==========================================================================
   Request Data
   ========================================================================== */

function createRequestDataBuilder(config) {
  const locale = normalizeLocale(config.locale);

  return function buildRequestData(filters = {}) {
    const view = getNegotiatedDealsView(filters);

    if (view === NEGOTIATED_DEALS_VIEWS.minimumSize) {
      return {
        requestLocale: locale,
      };
    }

    const defaultRange = getDefaultDateRange();

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
   Filter Error Event
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

        return response.rows;
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
     * DataTables options are created once for the shared table.
     *
     * Row callbacks therefore dispatch by normalized rowType rather than by
     * the filter value captured when the table instance was created.
     */

    createdRow(rowElement, row, dataIndex, cells) {
      const view =
        row?.rowType === "minimum-size" ? minimumSizeView : negotiatedView;

      view.tableOptions?.createdRow?.(rowElement, row, dataIndex, cells);
    },

    rowId(row) {
      return normalizeRowId(row?.id);
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
   Public Tab
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
     View Dispatchers
     ======================================================================== */

  function resolveView(view) {
    return getViewDefinition(views, view);
  }

  function getColumns(view) {
    return resolveView(view).columns;
  }

  function renderCell(cellContext) {
    return resolveView(cellContext.view).renderCell(cellContext);
  }

  function renderHeader(headerContext) {
    const view = resolveView(headerContext.view);

    if (typeof view.renderHeader !== "function") {
      /*
       * Delegate to the common schema-generated header.
       */

      return false;
    }

    return view.renderHeader(headerContext);
  }

  function renderCard(cardContext) {
    const view = resolveView(cardContext.view);

    return view.renderCard(cardContext.row, cardContext);
  }

  /* ========================================================================
     Mobile Group Dispatchers
     ======================================================================== */

  function getCardGroupKey(row, cardContext) {
    const view = resolveView(cardContext.view);

    if (typeof view.getCardGroupKey !== "function") {
      return null;
    }

    return view.getCardGroupKey(row, cardContext);
  }

  function getCardGroupLabel(groupKey, rows, groupContext) {
    const view = resolveView(groupContext.view);

    if (typeof view.getCardGroupLabel !== "function") {
      return "";
    }

    return view.getCardGroupLabel(groupKey, rows, groupContext);
  }

  function renderCardGroup(groupContext) {
    const view = resolveView(groupContext.view);

    /*
     * Minimum Size does not use business grouping. createDataCards still
     * creates one internal group because the tab supports grouping in its
     * Negotiated Deals view, so return the cards without an extra wrapper.
     */

    if (typeof view.renderCardGroup !== "function") {
      return groupContext.cards;
    }

    return view.renderCardGroup(groupContext);
  }

  /* ========================================================================
     Trading Tab
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

    loadingRowCount: 6,

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
