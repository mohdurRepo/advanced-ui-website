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
 * - activate only the currently visible presentation
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

const ALL_VALUE = "All";

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

function isElement(value) {
  return Boolean(
    value && value.nodeType === 1 && typeof value.matches === "function",
  );
}

function resolveRoot(root) {
  if (isElement(root) && root.matches(SELECTORS.root)) {
    return root;
  }

  if (root && typeof root.querySelector === "function") {
    return root.querySelector(SELECTORS.root);
  }

  return document.querySelector(SELECTORS.root);
}

function resolveElement(root, selector) {
  if (!root || !selector) {
    return null;
  }

  if (isElement(selector)) {
    return selector;
  }

  return root.querySelector(selector);
}

function requireElement(root, selector, description) {
  const element = resolveElement(root, selector);

  if (!element) {
    throw new Error(`Derivative Negotiated ${description} was not found.`);
  }

  return element;
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
   Presentation Visibility
   ========================================================================== */

function isElementVisible(element) {
  if (!isElement(element) || element.hidden) {
    return false;
  }

  const style = window.getComputedStyle(element);

  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  return element.getClientRects().length > 0;
}

/* ==========================================================================
   Results Request Parameters
   ========================================================================== */

/*
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

    contract: filterState.contract || ALL_VALUE,

    sector: filterState.category || ALL_VALUE,

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
     Required Markup
     ======================================================================== */

  const viewElement = requireElement(
    root,
    SELECTORS.view,
    "data-view container",
  );

  const tableElement = requireElement(root, SELECTORS.table, "desktop table");

  const cardsElement = requireElement(
    root,
    SELECTORS.cards,
    "mobile cards container",
  );

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

  let contractsLoading = false;

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

    onLoadingChange(loading) {
      contractsLoading = Boolean(loading);

      filters.setContractLoading(contractsLoading);

      syncBusyAttributes();
    },
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
       * Invalid dates must never produce a malformed service request.
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

    table: tableElement,

    initialView: PAGE_KEY,

    headerMode: "schema",

    /*
     * Do not construct a hidden DataTable.
     */

    active: isElementVisible(tableElement),

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

  const cardOptions = isObject(cardsView.cardOptions)
    ? cardsView.cardOptions
    : {};

  const cards = createDataCards({
    /*
     * Apply progressive rendering and the configured batch size.
     */

    ...cardOptions,

    root,

    container: cardsElement,

    initialView: PAGE_KEY,

    /*
     * Do not construct the hidden mobile card tree on desktop.
     */

    active: isElementVisible(cardsElement),

    /*
     * Presentation activity is coordinated once by this page.
     */

    autoActivate: false,

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
   * Daily total rows are part of the rendered collection but must not increase
   * the user-visible transaction count.
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
     Controller Filter Adapter
     ======================================================================== */

  /*
   * The page coordinator below is the only filter subscriber.
   *
   * The shared controller needs the current filter state when loading but
   * must not subscribe directly. Otherwise every user action would create:
   *
   * 1. a controller-driven request
   * 2. a page-coordinator-driven request
   */

  const controllerFilters = Object.freeze({
    getState() {
      return filters.getState();
    },
  });

  /* ========================================================================
     Data View Controller
     ======================================================================== */

  const controller = createDataViewController({
    source,

    state,

    filters: controllerFilters,

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

  let presentationFrame = null;

  /* ========================================================================
     Busy State
     ======================================================================== */

  function syncBusyAttributes() {
    const loading =
      !destroyed && (Boolean(stateSnapshot.loading) || contractsLoading);

    const busyValue = String(loading);

    root.setAttribute("aria-busy", busyValue);

    viewElement.setAttribute("aria-busy", busyValue);

    tableElement.setAttribute("aria-busy", busyValue);

    cardsElement.setAttribute("aria-busy", busyValue);
  }

  function syncBusyState(snapshot) {
    stateSnapshot = snapshot;

    syncBusyAttributes();
  }

  /* ========================================================================
     Presentation Activity
     ======================================================================== */

  function syncPresentationActivity() {
    if (destroyed) {
      return null;
    }

    const shouldRenderTable = isElementVisible(tableElement);

    const shouldRenderCards = isElementVisible(cardsElement);

    /*
     * Deactivate the hidden presentation first.
     *
     * This prevents both the desktop DataTable and the complete mobile card
     * tree from being constructed during the same breakpoint transition.
     */

    if (shouldRenderTable) {
      cards.setActive?.(false);

      table.setActive?.(true);
    } else if (shouldRenderCards) {
      table.setActive?.(false);

      cards.setActive?.(true);
    } else {
      table.setActive?.(false);

      cards.setActive?.(false);
    }

    return Object.freeze({
      table: shouldRenderTable,

      cards: shouldRenderCards,
    });
  }

  function schedulePresentationSync() {
    if (destroyed || !initialized || presentationFrame !== null) {
      return;
    }

    presentationFrame = window.requestAnimationFrame(() => {
      presentationFrame = null;

      syncPresentationActivity();
    });
  }

  function bindPresentationActivity() {
    window.addEventListener("resize", schedulePresentationSync, {
      passive: true,
    });
  }

  function destroyPresentationActivity() {
    window.removeEventListener("resize", schedulePresentationSync);

    if (presentationFrame !== null) {
      window.cancelAnimationFrame(presentationFrame);

      presentationFrame = null;
    }
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
       * Restore the last completed rows if an in-progress request was
       * cancelled while the date range became incomplete or invalid.
       *
       * This also clears a stale loading state.
       */

      controller.render();

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
     * Results belonging to the previous Category must never win while the
     * Contract options for the new Category are being resolved.
     */

    source.cancel();

    try {
      const contractResult = await contracts.load(filterState.category, {
        /*
         * Category changes already reset Contract to All.
         */

        selectedValue: filterState.contract,
      });

      if (
        destroyed ||
        currentRequestId !== dependencyRequestId ||
        contractResult?.stale ||
        contractResult?.cancelled
      ) {
        return null;
      }

      filters.setContractValue(contractResult?.selectedValue || ALL_VALUE, {
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
       * contracts.js clears options belonging to the previous Category.
       *
       * Continue with Contract=All so Category-level results remain usable.
       */

      filters.setContractValue(ALL_VALUE, {
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
      void refreshContractsAndReload(detail.state);

      return;
    }

    /*
     * Invalid or incomplete date input intentionally does not request data.
     */

    if (detail.validation && !detail.validation.valid) {
      source.cancel();

      controller.render();

      return;
    }

    void reload();
  }

  /* ========================================================================
     Initial Load
     ======================================================================== */

  async function loadInitialData() {
    const initialState = filters.getState();

    const currentRequestId = ++dependencyRequestId;

    /*
     * Refresh Contract options so the client-side dependency becomes
     * authoritative after initialization.
     *
     * Preserve a server-rendered Contract selection when the selected value
     * is still returned for the initial Category.
     */

    try {
      const contractResult = await contracts.load(initialState.category, {
        selectedValue: initialState.contract,
      });

      if (
        destroyed ||
        currentRequestId !== dependencyRequestId ||
        contractResult?.stale ||
        contractResult?.cancelled
      ) {
        return null;
      }

      filters.setContractValue(contractResult?.selectedValue || ALL_VALUE, {
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
       * Contract-option failure must not prevent the results endpoint from
       * loading with the remaining valid filters.
       */

      filters.setContractValue(ALL_VALUE, {
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

    unsubscribeState = state.subscribe((event) => {
      syncBusyState(event.state);
    });

    unsubscribeFilters = filters.subscribe(handleFilterChange);

    unbindLogoFallback = bindStandardCompanyLogoFallback(root);

    bindPresentationActivity();

    controller.init();

    syncPresentationActivity();

    syncBusyState(state.getState());

    void loadInitialData();

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

    destroyPresentationActivity();

    table.setActive?.(false);

    cards.setActive?.(false);

    unsubscribeFilters?.();
    unsubscribeFilters = null;

    unsubscribeState?.();
    unsubscribeState = null;

    unbindLogoFallback?.();
    unbindLogoFallback = null;

    /*
     * The page owns these two feature-specific modules.
     */

    contracts.destroy();

    filters.destroy();

    /*
     * The shared controller owns:
     *
     * - results source
     * - state
     * - table
     * - cards
     * - results presentation
     */

    controller.destroy();

    root.setAttribute("aria-busy", "false");

    viewElement.setAttribute("aria-busy", "false");

    tableElement.setAttribute("aria-busy", "false");

    cardsElement.setAttribute("aria-busy", "false");

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

    refreshPresentation() {
      return syncPresentationActivity();
    },

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
      return contracts.isLoading() || source.isLoading();
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
      status.textContent =
        window.DerivativeNegotiatedConfig?.labels?.error ||
        "Unable to initialize Derivative Negotiated Deals.";
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
