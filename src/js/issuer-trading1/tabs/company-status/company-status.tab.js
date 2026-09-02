/* ==========================================================================
   Company Status Tab
   ========================================================================== */

/*
 * Tab composition for Suspended and Delisted Companies and Funds.
 *
 * Responsibilities:
 *
 * - initialize Company Status filters
 * - build the legacy request parameters
 * - coordinate the shared data source and view controller
 * - switch between Suspension and Delisting schemas
 * - coordinate desktop tables and mobile cards
 * - manage lazy activation and request cancellation
 * - support complete destruction
 *
 * This module intentionally has no:
 *
 * - table cell markup
 * - card markup
 * - response-envelope parsing
 * - global tab-navigation behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  bindStandardCompanyLogoFallback,
  createDataCards,
  createDataFilters,
  createDataResults,
  createDataSource,
  createDataState,
  createDataTable,
  createDataViewController,
} from "../../../../common/data-view/index.js";

import { getIssuerTradingEndpoint } from "../../issuer-trading-config.js";

import { createTradingTableOptions } from "../../../shared/trading/trading-table-options.js";

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

const SELECTORS = Object.freeze({
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

function getErrorMessage(error, config) {
  return (
    normalizeString(error?.response?.message) ||
    normalizeString(error?.message) ||
    normalizeString(config.labels?.error) ||
    "Unable to load data."
  );
}

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

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

  const existingInstance = instances.get(root);

  if (existingInstance) {
    return existingInstance;
  }

  const config = options.config;

  if (!isPlainObject(config)) {
    throw new TypeError("Company Status requires page configuration.");
  }

  /* ========================================================================
     State
     ======================================================================== */

  const state = createDataState({
    active: false,

    loading: false,

    sourceRows: [],

    visibleRows: [],

    meta: {},

    error: null,
  });

  /* ========================================================================
     Component References
     ======================================================================== */

  let filters = null;

  let filterBinding = null;

  let dataSource = null;

  let table = null;

  let cards = null;

  let results = null;

  let controller = null;

  let unsubscribeState = null;

  let unbindLogoFallback = null;

  /* ========================================================================
     Lifecycle State
     ======================================================================== */

  let initialized = false;

  let active = false;

  let destroyed = false;

  let hasLoaded = false;

  /* ========================================================================
     Request Data
     ======================================================================== */

  function buildRequestData(filterState = {}) {
    return {
      renderType: "Search",

      fromDate: formatRequestDate(filterState.fromDate),

      toDate: formatRequestDate(filterState.toDate),

      formType: normalizeCompanyStatusType(filterState.type),

      requestLocale: normalizeString(config.locale, DEFAULT_LOCALE),
    };
  }

  /* ========================================================================
     View Resolution
     ======================================================================== */

  function resolveView(filterState = null) {
    const currentFilters = filterState || filters?.getState?.() || {};

    return getCompanyStatusView(currentFilters);
  }

  /* ========================================================================
     Busy State
     ======================================================================== */

  function syncBusyState(snapshot) {
    root.setAttribute("aria-busy", String(Boolean(snapshot.loading)));
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  function init() {
    if (destroyed) {
      return null;
    }

    if (initialized) {
      return instance;
    }

    initialized = true;

    /* ----------------------------------------------------------------------
       Filters
       ---------------------------------------------------------------------- */

    filters = createDataFilters({
      root,

      fields: createCompanyStatusFilterDefinitions(),

      eventTarget: root,

      eventName: "company-status:filters-change",
    });

    /* ----------------------------------------------------------------------
       Presentation Definitions
       ---------------------------------------------------------------------- */

    const tableDefinition = createCompanyStatusTable(config);

    const cardsDefinition = createCompanyStatusCards(config);

    const initialView = resolveView(filters.getState());

    /* ----------------------------------------------------------------------
       Desktop Table
       ---------------------------------------------------------------------- */

    table = createDataTable({
      root,

      table: SELECTORS.table,

      initialView,

      headerMode: "schema",

      getColumns(view) {
        return tableDefinition.getColumns(view);
      },

      getColumnGroups(view) {
        return tableDefinition.getColumnGroups(view);
      },

      renderHeader: tableDefinition.renderHeader,

      renderCell(cellContext) {
        return tableDefinition.renderCell(cellContext);
      },

      tableOptions: createTradingTableOptions({
        ...tableDefinition.tableOptions,

        ...(isPlainObject(options.tableOptions) ? options.tableOptions : {}),
      }),

      loadingRowCount: options.loadingRowCount || 6,

      emptyMessage:
        normalizeString(config.labels?.noData) || "No data available.",

      errorMessage:
        normalizeString(config.labels?.error) || "Unable to load data.",
    });

    /* ----------------------------------------------------------------------
       Mobile Cards
       ---------------------------------------------------------------------- */

    cards = createDataCards({
      root,

      container: SELECTORS.cards,

      initialView,

      renderCard(row, cardContext) {
        return cardsDefinition.renderCard({
          row,

          ...cardContext,
        });
      },

      emptyMessage:
        normalizeString(config.labels?.noData) || "No data available.",

      errorMessage:
        normalizeString(config.labels?.error) || "Unable to load data.",
    });

    /* ----------------------------------------------------------------------
       Results
       ---------------------------------------------------------------------- */

    results = createDataResults({
      root,

      count: SELECTORS.resultCount,

      status: SELECTORS.status,

      initialCount: 0,

      labels: {
        /*
         * The visible Results label already exists in the JSP.
         * Only the numeric value is updated by this component.
         */

        results: "",

        loading: normalizeString(config.labels?.loading) || "Loading…",

        empty: normalizeString(config.labels?.noData) || "No data available.",

        error: normalizeString(config.labels?.error) || "Unable to load data.",
      },
    });

    /* ----------------------------------------------------------------------
       Data Source
       ---------------------------------------------------------------------- */

    dataSource = createDataSource({
      ...(isPlainObject(options.sourceOptions) ? options.sourceOptions : {}),

      endpoint: getIssuerTradingEndpoint(config, ENDPOINT_KEY),

      method: options.method || "GET",

      buildRequestData,

      normalizeResponse(response, requestContext) {
        return normalizeCompanyStatusResponse(response, requestContext);
      },
    });

    /* ----------------------------------------------------------------------
       Filter Adapter
       ---------------------------------------------------------------------- */

    /*
     * Company Status filter coordination is handled by
     * bindCompanyStatusFilters().
     *
     * The adapter exposes current filter state to the shared controller
     * without adding a second filter subscription. This prevents duplicate
     * requests when a date or type changes.
     */

    const controllerFilters = Object.freeze({
      getState() {
        return filters.getState();
      },

      destroy() {
        /*
         * The real filter controller is destroyed explicitly after its
         * UI binding has been destroyed.
         */
      },
    });

    /* ----------------------------------------------------------------------
       View Controller
       ---------------------------------------------------------------------- */

    controller = createDataViewController({
      source: dataSource,

      state,

      filters: controllerFilters,

      table,
      cards,
      results,

      getView() {
        return resolveView();
      },

      getEmptyMessage() {
        return normalizeString(config.labels?.noData) || "No data available.";
      },

      getErrorMessage(error) {
        return getErrorMessage(error, config);
      },

      onDataLoaded(response, context) {
        hasLoaded = true;

        options.onDataLoaded?.(
          {
            rows: normalizeRows(response.rows),

            meta: isPlainObject(response.meta) ? response.meta : {},
          },
          context,
        );
      },

      onRowsRendered(rows, context) {
        options.onRowsRendered?.(normalizeRows(rows), context);
      },

      onViewSync(view, visibleGroups, context) {
        options.onViewSync?.(view, visibleGroups, context);
      },

      onError(error, context) {
        options.onError?.(error, context);
      },

      autoLoad: false,
    });

    /* ----------------------------------------------------------------------
       Filter Coordination
       ---------------------------------------------------------------------- */

    filterBinding = bindCompanyStatusFilters({
      root,
      filters,

      onReload() {
        if (!active || destroyed) {
          return;
        }

        /*
         * The Type filter can change the complete table schema.
         * Synchronize the view before beginning the next request.
         */

        controller.syncView();

        controller.reload();
      },
    });

    /* ----------------------------------------------------------------------
       Company Logo Fallback
       ---------------------------------------------------------------------- */

    unbindLogoFallback = bindStandardCompanyLogoFallback(root);

    /* ----------------------------------------------------------------------
       State Synchronization
       ---------------------------------------------------------------------- */

    unsubscribeState = state.subscribe((event) => {
      syncBusyState(event.state);
    });

    syncBusyState(state.getState());

    /* ----------------------------------------------------------------------
       Controller Initialization
       ---------------------------------------------------------------------- */

    controller.init();

    options.onInit?.({
      config,

      filters: filters.getState(),

      key: TAB_KEY,

      view: resolveView(),
    });

    return instance;
  }

  /* ========================================================================
     Reload
     ======================================================================== */

  function reload() {
    if (destroyed) {
      return Promise.resolve(null);
    }

    init();

    controller.syncView();

    return controller.reload();
  }

  /* ========================================================================
     Activation
     ======================================================================== */

  function activate(settings = {}) {
    if (destroyed) {
      return Promise.resolve(null);
    }

    init();

    active = true;

    state.setState(
      {
        active: true,
      },
      {
        type: "activate",

        source: TAB_KEY,
      },
    );

    table.adjust();

    options.onActivate?.({
      filters: filters.getState(),

      key: TAB_KEY,

      view: resolveView(),
    });

    const shouldReload =
      settings.reload ?? (!hasLoaded || options.reloadOnActivate !== false);

    return shouldReload ? reload() : Promise.resolve(null);
  }

  /* ========================================================================
     Deactivation
     ======================================================================== */

  function deactivate() {
    if (destroyed || !initialized || !active) {
      return false;
    }

    active = false;

    dataSource.cancel();

    state.setState(
      {
        active: false,

        loading: false,
      },
      {
        type: "deactivate",

        source: TAB_KEY,
      },
    );

    options.onDeactivate?.({
      filters: filters.getState(),

      key: TAB_KEY,

      view: resolveView(),
    });

    return true;
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    active = false;

    if (initialized) {
      dataSource?.cancel();

      /*
       * Destroy the DOM binding before the filter controller because the
       * binding may still hold scheduled animation-frame work.
       */

      filterBinding?.destroy();

      filterBinding = null;

      controller?.destroy();

      controller = null;

      filters?.destroy();

      filters = null;

      unsubscribeState?.();

      unsubscribeState = null;

      unbindLogoFallback?.();

      unbindLogoFallback = null;
    } else {
      state.destroy();
    }

    root.setAttribute("aria-busy", "false");

    instances.delete(root);

    options.onDestroy?.();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    activate,
    deactivate,
    destroy,
    init,
    reload,

    getFilters() {
      if (filters) {
        return filters.getState();
      }

      const defaultDates = createCompanyStatusDefaultDateRange();

      return Object.freeze({
        type: normalizeCompanyStatusType(),

        fromDate: defaultDates.fromDate,

        toDate: defaultDates.toDate,
      });
    },

    getRows() {
      return controller?.getSourceRows?.() || [];
    },

    getState() {
      return state.getState();
    },

    getTable() {
      return table?.getApi?.() || null;
    },

    getView() {
      return resolveView();
    },

    hasLoaded() {
      return hasLoaded;
    },

    isActive() {
      return active;
    },

    isLoading() {
      return Boolean(dataSource?.isLoading?.());
    },
  });

  instances.set(root, instance);

  if (options.autoInit !== false) {
    init();
  }

  if (options.active === true) {
    activate();
  }

  return instance;
}
