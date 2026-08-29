/* ==========================================================================
   Derivative Negotiated
   ========================================================================== */

/*
 * Page-level composition for Derivative Negotiated Deals.
 *
 * Responsibilities:
 *
 * - read the validated page configuration
 * - create page state
 * - create the negotiated-deals data source
 * - create filters
 * - coordinate Category -> Contract dependency loading
 * - create desktop table and mobile cards
 * - create result-count and status presentation
 * - coordinate loading / ready / empty / error states
 * - perform the initial request
 * - cancel stale requests
 * - bind company-logo fallback handling
 * - completely destroy the page instance
 *
 * This module intentionally has no:
 *
 * - response field normalization
 * - cell formatting
 * - table schema definitions
 * - card markup
 * - Contract option normalization
 * - date conversion implementation
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  bindStandardCompanyLogoFallback,
  createDataCards,
  createDataResults,
  createDataSource,
  createDataState,
  createDataTable,
  createDataViewController,
} from "../../common/data-view/index.js";

import { createTradingTableOptions } from "../issuer-trading/shared/trading-table-options.js";

import { getDerivativeNegotiatedConfig } from "./derivative-negotiated.config.js";

import { createDerivativeNegotiatedContracts } from "./derivative-negotiated.contracts.js";

import {
  createDerivativeNegotiatedFilters,
  DERIVATIVE_NEGOTIATED_FILTER_FIELDS,
  formatDerivativeNegotiatedServiceDate,
  validateDerivativeNegotiatedFilters,
} from "./derivative-negotiated.filters.js";

import { normalizeDerivativeNegotiatedResponse } from "./derivative-negotiated.normalizer.js";

import { createDerivativeNegotiatedTableView } from "./views/derivative-negotiated.table.js";

import { createDerivativeNegotiatedCardsView } from "./views/derivative-negotiated.cards.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const PAGE_KEY = "derivativeNegotiated";

const SELECTORS = Object.freeze({
  root: "[data-derivative-negotiated]",

  view: "[data-derivative-negotiated-view]",

  table: "[data-derivative-negotiated-table]",

  cards: "[data-derivative-negotiated-cards]",

  resultCount: "[data-derivative-negotiated-result-count]",

  status: "[data-derivative-negotiated-status]",
});

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveRoot(root) {
  if (root && typeof root.querySelector === "function") {
    return root;
  }

  return document.querySelector(SELECTORS.root);
}

function resolveElement(root, selector) {
  if (!root || !selector) {
    return null;
  }

  if (typeof Element !== "undefined" && selector instanceof Element) {
    return selector;
  }

  return root.querySelector(selector);
}

function normalizeRows(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return count;
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

/* ==========================================================================
   Results Request Parameters
   ========================================================================== */

/*
 * Keep the public service contract here explicit.
 *
 * UI:
 *
 *   Category
 *
 * Service:
 *
 *   sector
 *
 * The legacy endpoint continues to expect sector even though the new
 * presentation calls the filter Category.
 */

function buildRequestData(filterState = {}, config = {}) {
  const validation = validateDerivativeNegotiatedFilters(filterState);

  if (!validation.valid) {
    return null;
  }

  return {
    fromDate: formatDerivativeNegotiatedServiceDate(filterState.fromDate),

    toDate: formatDerivativeNegotiatedServiceDate(filterState.toDate),

    contract: filterState.contract || "All",

    sector: filterState.category || "All",

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createDerivativeNegotiated(options = {}) {
  if (!isObject(options)) {
    throw new TypeError(
      "createDerivativeNegotiated requires an options object.",
    );
  }

  const root = resolveRoot(options.root);

  if (!root) {
    return null;
  }

  const existing = instances.get(root);

  if (existing) {
    return existing;
  }

  /* ========================================================================
     Configuration
     ======================================================================== */

  const config = options.config || getDerivativeNegotiatedConfig();

  if (!isObject(config)) {
    throw new TypeError(
      "Derivative Negotiated requires a validated configuration object.",
    );
  }

  /* ========================================================================
     Views
     ======================================================================== */

  const tableView = createDerivativeNegotiatedTableView(config);

  const cardsView = createDerivativeNegotiatedCardsView(config);

  if (tableView.key !== cardsView.key) {
    throw new Error(
      "Derivative Negotiated table and cards must expose the same view key.",
    );
  }

  /* ========================================================================
     State
     ======================================================================== */

  const state = createDataState({
    active: true,

    loading: false,

    sourceRows: [],

    visibleRows: [],

    meta: {},

    error: null,
  });

  let stateSnapshot = state.getState();

  /* ========================================================================
     Filters
     ======================================================================== */

  const filters = createDerivativeNegotiatedFilters({
    root,

    config,

    autoInit: false,
  });

  /* ========================================================================
     Contract Dependency
     ======================================================================== */

  const contracts = createDerivativeNegotiatedContracts({
    root,

    config,
  });

  /* ========================================================================
     Results Data Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoints.negotiatedDeals,

    method: "GET",

    dataType: "json",

    buildRequestData(filterState = {}) {
      const requestData = buildRequestData(filterState, config);

      /*
       * Invalid dates must not produce a malformed service request.
       *
       * The page-level reload guard below normally prevents this path.
       * Throwing here gives us a final protection boundary if source.load()
       * is called independently.
       */

      if (!requestData) {
        throw new TypeError(
          "Derivative Negotiated cannot request results with an invalid date range.",
        );
      }

      return requestData;
    },

    normalizeResponse(response) {
      return normalizeDerivativeNegotiatedResponse(response);
    },
  });

  /* ========================================================================
     Desktop Table
     ======================================================================== */

  const table = createDataTable({
    root,

    table: SELECTORS.table,

    initialView: PAGE_KEY,

    headerMode: "schema",

    getColumns() {
      return tableView.columns;
    },

    renderCell(cellContext) {
      return tableView.renderCell({
        row: cellContext.row,

        column: cellContext.column,

        type: cellContext.type,

        context: cellContext.context,
      });
    },

    tableOptions: createTradingTableOptions(tableView.tableOptions),

    loadingRowCount: 6,
  });

  /* ========================================================================
     Mobile Cards
     ======================================================================== */

  const cards = createDataCards({
    root,

    container: SELECTORS.cards,

    initialView: PAGE_KEY,

    getGroupKey: cardsView.getCardGroupKey,

    getGroupLabel: cardsView.getCardGroupLabel,

    renderGroup: cardsView.renderCardGroup,

    renderCard(row, cardContext) {
      return cardsView.renderCard(row, cardContext);
    },

    emptyMessage: config.labels?.noData || "No data available.",

    errorMessage: config.labels?.error || "Unable to load data.",
  });

  /* ========================================================================
     Result Count and Accessible Status
     ======================================================================== */

  const countElement = resolveElement(root, SELECTORS.resultCount);

  const statusElement = resolveElement(root, SELECTORS.status);

  const results =
    countElement || statusElement
      ? createDataResults({
          root,

          count: countElement,

          status: statusElement,

          labels: {
            loading: config.labels?.loading || "Loading…",

            empty: config.labels?.noData || "No data available.",

            error: config.labels?.error || "Unable to load data.",

            results: config.labels?.results || "Results",
          },
        })
      : null;

  /*
   * Daily total rows are part of the rendered row collection but must not
   * inflate the user-visible result count.
   */

  function resolveResultCount(fallbackCount) {
    const explicitTotal = normalizeCount(stateSnapshot.meta?.total);

    if (explicitTotal !== null) {
      return explicitTotal;
    }

    const recordCount = normalizeCount(stateSnapshot.meta?.recordCount);

    if (recordCount !== null) {
      return recordCount;
    }

    return normalizeCount(fallbackCount) || 0;
  }

  const controlledResults = results
    ? Object.freeze({
        destroy() {
          results.destroy();
        },

        getState() {
          return results.getState();
        },

        reset() {
          results.reset();
        },

        setCount(count) {
          results.setCount(count);
        },

        setState(nextState, message) {
          results.setState(nextState, message);
        },

        showLoading(message) {
          results.showLoading(message);
        },

        showReady(count) {
          results.showReady(resolveResultCount(count));
        },

        showEmpty(message) {
          results.showEmpty(message);
        },

        showError(message) {
          results.showError(message);
        },
      })
    : null;

  /* ========================================================================
     Data View Controller
     ======================================================================== */

  const controller = createDataViewController({
    source,

    state,

    filters,

    table,

    cards,

    results: controlledResults,

    getView() {
      return PAGE_KEY;
    },

    reloadOnViewChange: false,

    getEmptyMessage() {
      return config.labels?.noData || "No data available.";
    },

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        error?.message ||
        config.labels?.error ||
        "Unable to load data."
      );
    },

    autoLoad: false,
  });

  /* ========================================================================
     Lifecycle State
     ======================================================================== */

  let initialized = false;

  let destroyed = false;

  let dependencyRequestId = 0;

  let unsubscribeFilters = null;

  let unsubscribeState = null;

  let unbindLogoFallback = null;

  /* ========================================================================
     Busy State
     ======================================================================== */

  function syncBusyState(snapshot) {
    stateSnapshot = snapshot;

    const loading = Boolean(snapshot.loading);

    root.setAttribute("aria-busy", String(loading));

    const viewElement = resolveElement(root, SELECTORS.view);

    const tableElement = resolveElement(root, SELECTORS.table);

    const cardsElement = resolveElement(root, SELECTORS.cards);

    viewElement?.setAttribute("aria-busy", String(loading));

    tableElement?.setAttribute("aria-busy", String(loading));

    cardsElement?.setAttribute("aria-busy", String(loading));
  }

  /* ========================================================================
     Results Reload
     ======================================================================== */

  function reload() {
    if (destroyed) {
      return Promise.resolve(null);
    }

    const validation = filters.getValidation();

    if (!validation.valid) {
      source.cancel();

      /*
       * Do not replace the current completed results with an API error merely
       * because the user temporarily entered an incomplete/invalid date range.
       */

      return Promise.resolve(null);
    }

    return controller.reload();
  }

  /* ========================================================================
     Category -> Contract Coordination
     ======================================================================== */

  async function refreshContractsAndReload(filterState) {
    const currentRequestId = ++dependencyRequestId;

    /*
     * Cancel the current result request immediately.
     *
     * Results belonging to the previous Category must never win while the
     * Contract list for the new Category is still being resolved.
     */

    source.cancel();

    try {
      const contractResult = await contracts.load(filterState.category, {
        /*
         * Category changes reset Contract to All.
         *
         * Initial page loading may instead explicitly preserve the
         * server-rendered selected Contract.
         */

        selectedValue: filterState.contract,
      });

      if (
        destroyed ||
        currentRequestId !== dependencyRequestId ||
        contractResult?.stale
      ) {
        return null;
      }

      /*
       * Synchronize the filter state with the value that actually exists in
       * the newly loaded Contract options.
       *
       * Do not emit another filter notification; this operation is already
       * part of the current Category action.
       */

      filters.setContractValue(contractResult?.selectedValue || "All", {
        notifyChange: false,
      });
    } catch (error) {
      if (
        destroyed ||
        currentRequestId !== dependencyRequestId ||
        isAbortError(error)
      ) {
        return null;
      }

      /*
       * contracts.js clears stale Contract options when its request fails.
       *
       * Continue with Contract=All so Category-level results remain usable
       * even if the dependent option request failed.
       */

      filters.setContractValue("All", {
        notifyChange: false,
      });
    }

    if (destroyed || currentRequestId !== dependencyRequestId) {
      return null;
    }

    return reload();
  }

  /* ========================================================================
     Filter Notifications
     ======================================================================== */

  function handleFilterChange(detail) {
    if (destroyed || !detail) {
      return;
    }

    const changedFields = Array.isArray(detail.changedFields)
      ? detail.changedFields
      : [];

    const categoryChanged = changedFields.includes(
      DERIVATIVE_NEGOTIATED_FILTER_FIELDS.category,
    );

    if (categoryChanged) {
      refreshContractsAndReload(detail.state);

      return;
    }

    /*
     * Invalid/incomplete date input intentionally does not request data.
     */

    if (detail.validation && !detail.validation.valid) {
      source.cancel();

      return;
    }

    reload();
  }

  /* ========================================================================
     Initial Load
     ======================================================================== */

  async function loadInitialData() {
    const initialState = filters.getState();

    const currentRequestId = ++dependencyRequestId;

    /*
     * The JSP may already contain Contract options, but refreshing them here
     * makes the client-side dependency authoritative after initialization.
     *
     * Preserve a server-rendered selected Contract when it is still returned
     * by the Category endpoint.
     */

    try {
      const contractResult = await contracts.load(initialState.category, {
        selectedValue: initialState.contract,
      });

      if (
        destroyed ||
        currentRequestId !== dependencyRequestId ||
        contractResult?.stale
      ) {
        return null;
      }

      filters.setContractValue(contractResult?.selectedValue || "All", {
        notifyChange: false,
      });

      filters.sync();
    } catch (error) {
      if (
        destroyed ||
        currentRequestId !== dependencyRequestId ||
        isAbortError(error)
      ) {
        return null;
      }

      /*
       * A Contract-option failure should not prevent the negotiated results
       * endpoint from being requested with the remaining valid filters.
       */

      filters.setContractValue("All", {
        notifyChange: false,
      });

      filters.sync();
    }

    if (destroyed || currentRequestId !== dependencyRequestId) {
      return null;
    }

    return reload();
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

    filters.init();

    filters.sync();

    controller.init();

    unsubscribeState = state.subscribe((event) => {
      syncBusyState(event.state);
    });

    syncBusyState(state.getState());

    unsubscribeFilters = filters.subscribe(handleFilterChange);

    unbindLogoFallback = bindStandardCompanyLogoFallback(root);

    loadInitialData();

    return instance;
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    dependencyRequestId += 1;

    source.cancel();

    contracts.cancel();

    unsubscribeFilters?.();
    unsubscribeFilters = null;

    unsubscribeState?.();
    unsubscribeState = null;

    unbindLogoFallback?.();
    unbindLogoFallback = null;

    contracts.destroy();

    filters.destroy();

    controller.destroy();

    root.setAttribute("aria-busy", "false");

    resolveElement(root, SELECTORS.view)?.setAttribute("aria-busy", "false");

    resolveElement(root, SELECTORS.table)?.setAttribute("aria-busy", "false");

    resolveElement(root, SELECTORS.cards)?.setAttribute("aria-busy", "false");

    instances.delete(root);

    initialized = false;
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    init,

    reload,

    destroy,

    getFilters() {
      return filters.getState();
    },

    getRows() {
      return normalizeRows(stateSnapshot.sourceRows);
    },

    getTable() {
      return table.getApi();
    },

    getState() {
      return stateSnapshot;
    },

    isLoading() {
      return source.isLoading();
    },

    isInitialized() {
      return initialized;
    },

    isDestroyed() {
      return destroyed;
    },
  });

  /* ========================================================================
     Registration
     ======================================================================== */

  instances.set(root, instance);

  if (options.autoInit !== false) {
    init();
  }

  return instance;
}

/* ==========================================================================
   Automatic Page Initialization
   ========================================================================== */

function initializeDerivativeNegotiatedPage() {
  const root = document.querySelector(SELECTORS.root);

  if (!root) {
    return;
  }

  try {
    createDerivativeNegotiated({
      root,
    });
  } catch (error) {
    console.error("[DerivativeNegotiated]", error);

    root.setAttribute("aria-busy", "false");

    const status = root.querySelector(SELECTORS.status);

    if (status) {
      status.textContent = "Unable to initialize Derivative Negotiated Deals.";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeDerivativeNegotiatedPage,
    {
      once: true,
    },
  );
} else {
  initializeDerivativeNegotiatedPage();
}
