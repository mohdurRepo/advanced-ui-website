/* ==========================================================================
   Derivative Negotiated
   ========================================================================== */

/*
 * Page-level composition for Derivative Negotiated Deals.
 *
 * Responsibilities:
 *
 * - read validated page configuration
 * - create page state
 * - coordinate Category -> Contract dependency loading
 * - create the results data source
 * - create desktop table and mobile cards
 * - activate only the visible presentation
 * - coordinate loading, ready, empty, and error states
 * - perform the initial request
 * - cancel stale requests
 * - bind company-logo fallback handling
 * - completely destroy page resources
 *
 * This module intentionally has no:
 *
 * - response field normalization
 * - cell formatting
 * - table schema definitions
 * - card markup
 * - Contract option rendering
 * - Contract disabled-state management
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

import { createTradingTableOptions } from "../shared/trading/trading-table-options.js";

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

const PAGE_KEY = "derivative-negotiated";

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
  if (
    typeof Element !== "undefined" &&
    root instanceof Element &&
    root.matches(SELECTORS.root)
  ) {
    return root;
  }

  if (root && typeof root.querySelector === "function") {
    return root.querySelector(SELECTORS.root);
  }

  return document.querySelector(SELECTORS.root);
}

function resolveElement(root, value) {
  if (!root || !value) {
    return null;
  }

  if (typeof Element !== "undefined" && value instanceof Element) {
    return value;
  }

  if (typeof value === "string") {
    return root.querySelector(value);
  }

  return null;
}

function requireElement(root, selector, description) {
  const element = resolveElement(root, selector);

  if (!element) {
    throw new Error(`Derivative Negotiated ${description} was not found.`);
  }

  return element;
}

function isElementVisible(element) {
  if (
    typeof Element === "undefined" ||
    !(element instanceof Element) ||
    !element.isConnected
  ) {
    return false;
  }

  return element.getClientRects().length > 0;
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
 * Public filter:
 *
 *   category
 *
 * Legacy service parameter:
 *
 *   sector
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
     Required Elements
     ======================================================================== */

  const viewElement = requireElement(root, SELECTORS.view, "data-view region");

  const tableElement = requireElement(root, SELECTORS.table, "table");

  const cardsElement = requireElement(root, SELECTORS.cards, "cards container");

  /* ========================================================================
     View Definitions
     ======================================================================== */

  const tableView = createDerivativeNegotiatedTableView(config);

  const cardsView = createDerivativeNegotiatedCardsView(config);

  if (tableView.key !== cardsView.key) {
    throw new Error(
      "Derivative Negotiated table and cards must expose the same view key.",
    );
  }

  /* ========================================================================
     Shared State
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

  /*
   * The page owns filter notifications because Category changes must first
   * refresh the dependent Contract options.
   *
   * The controller receives only getState(). It therefore cannot subscribe
   * independently and accidentally perform a duplicate API request.
   */

  const controllerFilters = Object.freeze({
    getState() {
      return filters.getState();
    },
  });

  /* ========================================================================
     Contract Dependency
     ======================================================================== */

  /*
   * derivative-negotiated.contracts.js exclusively owns:
   *
   * - Contract loading
   * - Contract disabled state
   * - Contract option replacement
   * - Contract custom-select refresh
   *
   * Do not pass an onLoadingChange callback that disables the Contract again.
   */

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

    /*
     * Avoid constructing or redrawing the desktop DataTable while the
     * mobile presentation is visible.
     */

    active: isElementVisible(tableElement),

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

  const cardOptions = isObject(cardsView.cardOptions)
    ? cardsView.cardOptions
    : {};

  const cards = createDataCards({
    /*
     * Apply performance options such as progressive card rendering before
     * the required page dependencies.
     */

    ...cardOptions,

    root,

    container: cardsElement,

    initialView: PAGE_KEY,

    /*
     * Avoid generating the complete mobile card tree while the desktop
     * presentation is visible.
     */

    active: isElementVisible(cardsElement),

    /*
     * Breakpoint activity is coordinated by this page module.
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
   * Daily total rows are rendered but must not increase the visible result
   * count.
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

    /*
     * Read-only adapter prevents duplicate filter subscriptions.
     */

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

  let presentationFrame = null;

  let unsubscribeFilters = null;

  let unsubscribeState = null;

  let unbindLogoFallback = null;

  /* ========================================================================
     Busy State
     ======================================================================== */

  /*
   * Only the overall result region is controlled here.
   *
   * The shared Data Table and Data Cards components own their individual
   * aria-busy values.
   *
   * The Contract dependency module owns the Contract select disabled state.
   */

  function syncBusyState(snapshot = state.getState()) {
    stateSnapshot = snapshot;

    viewElement.setAttribute("aria-busy", String(Boolean(snapshot.loading)));
  }

  /* ========================================================================
     Responsive Presentation Activity
     ======================================================================== */

  function syncPresentationActivity() {
    if (destroyed) {
      return null;
    }

    const shouldRenderTable = isElementVisible(tableElement);

    const shouldRenderCards = isElementVisible(cardsElement);

    /*
     * Deactivate the hidden presentation before activating the visible one.
     *
     * This prevents thousands of desktop rows and mobile cards from being
     * materialized during the same breakpoint transition.
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
       * An aborted request does not render an error. Restore the last
       * completed rows so the result region cannot remain in loading state.
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
     * Results from the previous Category must not win while the new Contract
     * options are loading.
     */

    const cancelled = source.cancel();

    if (cancelled) {
      controller.render();
    }

    try {
      const contractResult = await contracts.load(filterState.category, {
        /*
         * Category changes normally reset Contract to All. The requested
         * value is still passed so the dependency module can preserve it
         * when appropriate.
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
       * Synchronize filter state with the value that actually exists in the
       * newly loaded Contract options.
       *
       * This must not emit another filter notification because the current
       * Category action already owns the reload.
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
       * Contract-option failure must not prevent Category-level results.
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
      void refreshContractsAndReload(detail.state);

      return;
    }

    /*
     * An incomplete or invalid date must never create a malformed request.
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

    try {
      const contractResult = await contracts.load(initialState.category, {
        /*
         * Preserve a server-rendered Contract when it is still returned by
         * the Category endpoint.
         */

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
       * Contract-option failure must not prevent the initial results request.
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

    /*
     * Initialize and synchronize controls before subscribing so setup does
     * not produce an unintended duplicate request.
     */

    filters.init();

    filters.sync();

    unsubscribeState = state.subscribe((event) => {
      syncBusyState(event.state);
    });

    syncBusyState(state.getState());

    controller.init();

    unsubscribeFilters = filters.subscribe(handleFilterChange);

    unbindLogoFallback = bindStandardCompanyLogoFallback(root);

    bindPresentationActivity();

    syncPresentationActivity();

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

    destroyPresentationActivity();

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

    /*
     * The controller destroys the results source, table, cards, results
     * presenter, and shared data state.
     */

    controller.destroy();

    viewElement.setAttribute("aria-busy", "false");

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
      return table.getApi?.() || null;
    },

    getState() {
      return stateSnapshot;
    },

    isLoading() {
      return Boolean(source.isLoading?.() || contracts.isLoading?.());
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
  document.querySelectorAll(SELECTORS.root).forEach((root) => {
    try {
      createDerivativeNegotiated({
        root,
      });
    } catch (error) {
      console.error("[DerivativeNegotiated]", error);

      root.querySelector(SELECTORS.view)?.setAttribute("aria-busy", "false");

      const status = root.querySelector(SELECTORS.status);

      if (status) {
        status.textContent =
          "Unable to initialize Derivative Negotiated Deals.";
      }
    }
  });
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
