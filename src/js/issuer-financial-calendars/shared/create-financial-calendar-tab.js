/* ==========================================================================
   Financial Calendar Tab Factory
   ========================================================================== */

/*
 * Shared composition factory for Issuer Financial Calendars tabs.
 *
 * Responsibilities:
 *
 * - create and own the tab filter instance
 * - create and own the results data source
 * - compose the shared desktop table and mobile cards
 * - coordinate result count and accessible status text
 * - perform lazy activation and optional reload-on-activation
 * - ensure one filter action produces at most one results request
 * - cancel stale work when a tab is deactivated
 * - activate only the currently visible presentation
 * - manage company-logo fallback behavior
 * - completely destroy tab-owned resources
 *
 * Individual tabs remain responsible for:
 *
 * - filter definitions
 * - dependent Market -> Sector behavior
 * - endpoint selection
 * - request parameter mapping
 * - response normalization
 * - table schemas and cell rendering
 * - mobile card rendering
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
} from "../../../common/data-view/index.js";

import { createFinancialCalendarTableOptions } from "./financial-calendar-table-options.js";
import { createFinancialCalendarFilters } from "./financial-calendar-filters.js";

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

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();

  return normalized || fallback;
}

function normalizeRows(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeOptionalCount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return count;
}

function resolveElement(root, value) {
  if (!value) {
    return null;
  }

  if (typeof Element !== "undefined" && value instanceof Element) {
    return value;
  }

  if (typeof value === "string" && typeof root?.querySelector === "function") {
    return root.querySelector(value);
  }

  return null;
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

function isAbortError(error) {
  return error?.name === "AbortError";
}

function normalizeFilterEvent(event, filters) {
  const detail = isPlainObject(event?.detail) ? event.detail : event;

  if (isPlainObject(detail)) {
    return detail;
  }

  return Object.freeze({
    type: "change",

    effect: "reload",

    changedFields: Object.freeze([]),

    state: filters.getState(),

    validation:
      filters.getValidation?.() ||
      Object.freeze({
        valid: true,
      }),
  });
}

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createFinancialCalendarTab(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      "createFinancialCalendarTab requires an options object.",
    );
  }

  const root = options.root;

  if (!root || typeof root.querySelector !== "function") {
    throw new Error("Financial Calendar tab requires a valid root element.");
  }

  const existing = instances.get(root);

  if (existing) {
    return existing;
  }

  const key = normalizeString(options.key);

  if (!key) {
    throw new Error("Financial Calendar tab requires a non-empty key.");
  }

  const config = options.config;

  if (!isPlainObject(config)) {
    throw new TypeError(
      `Financial Calendar tab "${key}" requires page configuration.`,
    );
  }

  const selectors = options.selectors;

  if (!isPlainObject(selectors)) {
    throw new TypeError(`Financial Calendar tab "${key}" requires selectors.`);
  }

  if (!selectors.form || !selectors.table || !selectors.cards) {
    throw new Error(
      `Financial Calendar tab "${key}" requires form, table, and cards selectors.`,
    );
  }

  if (!options.filters) {
    throw new TypeError(
      `Financial Calendar tab "${key}" requires filter definitions.`,
    );
  }

  if (
    !options.endpoint &&
    !options.endpointKey &&
    typeof options.getEndpoint !== "function"
  ) {
    throw new TypeError(
      `Financial Calendar tab "${key}" requires endpoint, endpointKey, or getEndpoint().`,
    );
  }

  if (typeof options.buildRequestData !== "function") {
    throw new TypeError(
      `Financial Calendar tab "${key}" requires buildRequestData().`,
    );
  }

  if (typeof options.normalizeResponse !== "function") {
    throw new TypeError(
      `Financial Calendar tab "${key}" requires normalizeResponse().`,
    );
  }

  if (typeof options.getColumns !== "function") {
    throw new TypeError(
      `Financial Calendar tab "${key}" requires getColumns().`,
    );
  }

  if (typeof options.renderCell !== "function") {
    throw new TypeError(
      `Financial Calendar tab "${key}" requires renderCell().`,
    );
  }

  if (typeof options.renderCard !== "function") {
    throw new TypeError(
      `Financial Calendar tab "${key}" requires renderCard().`,
    );
  }

  const formElement = resolveElement(root, selectors.form);

  const viewElement = resolveElement(root, selectors.view) || root;

  const tableElement = resolveElement(root, selectors.table);

  const cardsContainer = resolveElement(root, selectors.cards);

  if (!formElement) {
    throw new Error(
      `Financial Calendar tab "${key}" filter form was not found.`,
    );
  }

  if (!tableElement) {
    throw new Error(
      `Financial Calendar tab "${key}" table element was not found.`,
    );
  }

  if (!cardsContainer) {
    throw new Error(
      `Financial Calendar tab "${key}" cards container was not found.`,
    );
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

  /*
   * Keep the latest immutable snapshot outside cell renderers.
   *
   * Calling state.getState() for every table cell would repeatedly clone the
   * complete row collection.
   */

  let stateSnapshot = state.getState();

  /* ========================================================================
     Filters
     ======================================================================== */

  const filters = createFinancialCalendarFilters({
    root,

    form: formElement,

    config,

    tabKey: key,

    fields: options.filters,

    initialState: options.initialFilterState,

    autoInit: false,
  });

  /*
   * The controller needs read-only access to current filter state, but it must
   * not subscribe to filter changes.
   *
   * This factory owns the single filter subscription so dependent filters can
   * finish before exactly one results request starts.
   */

  const controllerFilters = Object.freeze({
    getState() {
      return filters.getState();
    },
  });

  /* ========================================================================
     Context
     ======================================================================== */

  function resolveView(filterState = filters.getState()) {
    if (typeof options.getView === "function") {
      return normalizeString(
        options.getView({
          config,

          filters: filterState,

          key,

          state: stateSnapshot,
        }),

        options.initialView || key,
      );
    }

    return normalizeString(options.initialView, key);
  }

  function createContext(filterState = filters.getState(), extra = {}) {
    return {
      config,

      filters: filterState,

      key,

      state: stateSnapshot,

      view: resolveView(filterState),

      ...extra,
    };
  }

  /* ========================================================================
     Endpoint Resolution
     ======================================================================== */

  function resolveEndpoint(filterState = filters.getState()) {
    if (typeof options.getEndpoint === "function") {
      const endpoint = normalizeString(
        options.getEndpoint(createContext(filterState)),
      );

      if (endpoint) {
        return endpoint;
      }
    }

    const directEndpoint = normalizeString(options.endpoint);

    if (directEndpoint) {
      return directEndpoint;
    }

    const endpointKey = normalizeString(options.endpointKey);

    const configuredEndpoint = normalizeString(
      endpointKey ? config.endpoints?.[endpointKey] : "",
    );

    if (configuredEndpoint) {
      return configuredEndpoint;
    }

    throw new Error(
      `Financial Calendar tab "${key}" could not resolve its endpoint.`,
    );
  }

  /* ========================================================================
     Data Source
     ======================================================================== */

  const sourceOptions = isPlainObject(options.sourceOptions)
    ? options.sourceOptions
    : {};

  const initialFilterState = filters.getState();

  const dataSource = createDataSource({
    ...sourceOptions,

    endpoint: resolveEndpoint(initialFilterState),

    method: normalizeString(sourceOptions.method, "GET"),

    dataType: normalizeString(sourceOptions.dataType, "json"),

    buildRequestData(filterState, requestOptions) {
      return options.buildRequestData(
        filterState,

        createContext(filterState, {
          requestOptions,
        }),
      );
    },

    normalizeResponse(response, requestContext) {
      return options.normalizeResponse(
        response,

        createContext(requestContext.state, {
          requestContext,

          requestFilters: requestContext.state,
        }),
      );
    },

    normalizeError(error, requestContext) {
      if (typeof options.normalizeError !== "function") {
        return error;
      }

      return options.normalizeError(
        error,

        createContext(requestContext.state, {
          requestContext,

          requestFilters: requestContext.state,
        }),
      );
    },
  });

  /*
   * Resolve the endpoint before every request. This supports future financial
   * calendar tabs that may switch resources without recreating the tab.
   */

  const source = Object.freeze({
    cancel() {
      return dataSource.cancel();
    },

    destroy() {
      dataSource.destroy();
    },

    isLoading() {
      return dataSource.isLoading();
    },

    load(filterState = {}, requestOptions = {}) {
      return dataSource.load(filterState, {
        ...requestOptions,

        endpoint: resolveEndpoint(filterState),
      });
    },
  });

  /* ========================================================================
     Desktop Table
     ======================================================================== */

  const initialView = resolveView(initialFilterState);

  const table = createDataTable({
    root,

    table: tableElement,

    initialView,

    active: false,

    headerMode: normalizeString(options.headerMode, "existing"),

    getColumns(view) {
      return options.getColumns(
        view,

        createContext(undefined, {
          view,
        }),
      );
    },

    getColumnGroups(view) {
      if (typeof options.getColumnGroups !== "function") {
        return [];
      }

      return options.getColumnGroups(
        view,

        createContext(undefined, {
          view,
        }),
      );
    },

    renderCell(cellContext) {
      const view = cellContext.context?.view || initialView;

      return options.renderCell({
        ...cellContext,

        ...createContext(undefined, {
          view,
        }),

        tableContext: cellContext.context,
      });
    },

    renderHeader:
      typeof options.renderHeader === "function"
        ? (headerContext) =>
            options.renderHeader({
              ...headerContext,

              ...createContext(undefined, {
                view: headerContext.view || initialView,
              }),

              tableContext: headerContext.context,
            })
        : null,

    tableOptions: createFinancialCalendarTableOptions(options.tableOptions),

    loadingRowCount: options.loadingRowCount || 6,

    createLoadingRows: options.createLoadingRows,

    getRowGroup: options.getRowGroup,

    renderRowGroupStart: options.renderRowGroupStart,

    renderRowGroupEnd: options.renderRowGroupEnd,

    onDraw(api, tableContext) {
      options.onTableDraw?.(api, tableContext, createContext());
    },

    onInit(api, tableContext) {
      options.onTableInit?.(api, tableContext, createContext());
    },
  });

  /* ========================================================================
     Mobile Cards
     ======================================================================== */

  const cardOptions = isPlainObject(options.cardOptions)
    ? options.cardOptions
    : {};

  const cards = createDataCards({
    ...cardOptions,

    root,

    container: cardsContainer,

    initialView,

    active: false,

    /*
     * Breakpoint activity is owned by this factory. The cards component must
     * not install a second breakpoint listener.
     */

    autoActivate: false,

    getGroupKey: options.getCardGroupKey,

    getGroupLabel: options.getCardGroupLabel,

    renderGroup: options.renderCardGroup,

    renderCard(row, cardContext) {
      return options.renderCard({
        row,

        ...cardContext,

        ...createContext(undefined, {
          view: cardContext.view || initialView,
        }),

        cardsContext: cardContext,
      });
    },

    renderLoading: options.renderCardsLoading,

    renderEmpty: options.renderCardsEmpty,

    renderError: options.renderCardsError,

    emptyMessage: config.labels?.noData || "No data available.",

    errorMessage: config.labels?.error || "Unable to load data.",

    afterRender(cardsContext) {
      options.onCardsRendered?.(cardsContext, createContext());
    },
  });

  /* ========================================================================
     Result Count and Accessible Status
     ======================================================================== */

  const countElement = resolveElement(root, selectors.resultCount);

  const statusElement = resolveElement(root, selectors.status);

  const resultsInstance =
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

  function resolveResultCount(fallbackCount) {
    const fallback = normalizeOptionalCount(fallbackCount) ?? 0;

    if (typeof options.getResultCount === "function") {
      const configuredCount = normalizeOptionalCount(
        options.getResultCount(
          normalizeRows(stateSnapshot.sourceRows),

          createContext(),
        ),
      );

      if (configuredCount !== null) {
        return configuredCount;
      }
    }

    const metaTotal = normalizeOptionalCount(stateSnapshot.meta?.total);

    if (metaTotal !== null) {
      return metaTotal;
    }

    const metaCount = normalizeOptionalCount(stateSnapshot.meta?.recordCount);

    if (metaCount !== null) {
      return metaCount;
    }

    return fallback;
  }

  const results = resultsInstance
    ? Object.freeze({
        destroy() {
          resultsInstance.destroy();
        },

        getState() {
          return resultsInstance.getState();
        },

        reset() {
          resultsInstance.reset();
        },

        setCount(count) {
          resultsInstance.setCount(count);
        },

        setState(nextState, message) {
          resultsInstance.setState(nextState, message);
        },

        showLoading(message) {
          resultsInstance.showLoading(message);
        },

        showReady(count) {
          resultsInstance.showReady(resolveResultCount(count));
        },

        showEmpty(message) {
          resultsInstance.showEmpty(message);
        },

        showError(message) {
          resultsInstance.showError(message);
        },
      })
    : null;

  /* ========================================================================
     Data View Controller
     ======================================================================== */

  let hasLoaded = false;

  const controller = createDataViewController({
    source,

    state,

    /*
     * Read-only adapter: the controller can read current values but cannot
     * install a second filter subscription.
     */

    filters: controllerFilters,

    table,

    cards,

    results,

    getView({ filters: filterState }) {
      return resolveView(filterState);
    },

    rowProcessors: Array.isArray(options.rowProcessors)
      ? options.rowProcessors
      : [],

    filterRows: options.filterRows,

    reloadOnViewChange: false,

    getEmptyMessage(controllerContext) {
      if (typeof options.getEmptyMessage === "function") {
        return options.getEmptyMessage(
          controllerContext,

          createContext(controllerContext.filters),
        );
      }

      return config.labels?.noData || "No data available.";
    },

    getErrorMessage(error, controllerContext) {
      if (typeof options.getErrorMessage === "function") {
        return options.getErrorMessage(
          error,

          controllerContext,

          createContext(controllerContext.filters),
        );
      }

      return (
        error?.response?.message ||
        error?.message ||
        config.labels?.error ||
        "Unable to load data."
      );
    },

    onDataLoaded(response, controllerContext) {
      hasLoaded = true;

      reloadPending = false;

      options.onDataLoaded?.(
        response,

        controllerContext,

        createContext(controllerContext.filters),
      );
    },

    onRowsRendered(rows, controllerContext) {
      options.onRowsRendered?.(
        normalizeRows(rows),

        controllerContext,

        createContext(controllerContext.filters),
      );
    },

    onViewSync(view) {
      options.onViewSync?.(
        view,

        createContext(undefined, {
          view,
        }),
      );
    },

    onEmpty(message, controllerContext) {
      options.onEmpty?.(
        message,

        controllerContext,

        createContext(controllerContext.filters),
      );
    },

    onError(error, controllerContext) {
      reloadPending = true;

      options.onError?.(
        error,

        controllerContext,

        createContext(controllerContext.filters),
      );
    },

    autoLoad: false,
  });

  /* ========================================================================
     Lifecycle State
     ======================================================================== */

  let initialized = false;

  let active = false;

  let destroyed = false;

  let reloadPending = false;

  let preparationComplete = false;

  let preparationPromise = null;

  let filterActionId = 0;

  let presentationFrame = null;

  let unsubscribeFilters = null;

  let unsubscribeState = null;

  let unbindLogoFallback = null;

  /* ========================================================================
     Presentation Activity
     ======================================================================== */

  function syncPresentationActivity() {
    if (destroyed) {
      return null;
    }

    const shouldRenderTable = active && isElementVisible(tableElement);

    const shouldRenderCards = active && isElementVisible(cardsContainer);

    /*
     * Deactivate the hidden presentation before activating the visible one.
     *
     * This prevents large result sets from being materialized twice during a
     * desktop/mobile breakpoint transition.
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
     Shared Busy State
     ======================================================================== */

  function syncBusyState(snapshot) {
    stateSnapshot = snapshot;

    /*
     * The data-view wrapper is the sole aria-busy owner.
     *
     * Table and card components remain responsible for their own visual
     * loading presentations.
     */

    viewElement.setAttribute("aria-busy", String(Boolean(snapshot.loading)));
  }

  /* ========================================================================
     Validation
     ======================================================================== */

  function getValidation() {
    const validation = filters.getValidation?.();

    return isPlainObject(validation)
      ? validation
      : Object.freeze({
          valid: true,
        });
  }

  function clearCancelledLoadingState() {
    const cancelled = source.cancel();

    /*
     * An aborted controller request intentionally does not render an error.
     * Restore the most recent completed rows so the tab cannot remain in its
     * loading state.
     */

    if (cancelled) {
      controller.render();
    }

    return cancelled;
  }

  /* ========================================================================
     Reload
     ======================================================================== */

  function reload(settings = {}) {
    if (destroyed) {
      return Promise.resolve(null);
    }

    init();

    /*
     * Hidden tabs retain the pending request intention. The request runs when
     * the user activates the tab.
     */

    if (!active && settings.allowInactive !== true) {
      reloadPending = true;

      return Promise.resolve(null);
    }

    const validation = getValidation();

    if (!validation.valid) {
      reloadPending = true;

      clearCancelledLoadingState();

      return Promise.resolve(null);
    }

    reloadPending = false;

    syncPresentationActivity();

    return controller.reload();
  }

  /* ========================================================================
     Filter Coordination
     ======================================================================== */

  function reportFilterError(error, detail) {
    if (isAbortError(error) || destroyed) {
      return;
    }

    root.dispatchEvent(
      new CustomEvent("issuer-financial-calendars:error", {
        bubbles: true,

        detail: Object.freeze({
          tabKey: key,

          phase: "filters",

          filterEvent: detail,

          error,
        }),
      }),
    );
  }

  async function processFilterChange(event) {
    if (destroyed) {
      return null;
    }

    const detail = normalizeFilterEvent(event, filters);

    const effect = normalizeString(detail.effect, "reload");

    if (effect === "none") {
      return null;
    }

    const currentActionId = ++filterActionId;

    /*
     * Stop the previous result request immediately. Old data must never win
     * after a newer filter action.
     */

    clearCancelledLoadingState();

    const validation = detail.validation || getValidation();

    if (!validation.valid) {
      reloadPending = true;

      return null;
    }

    if (!active) {
      reloadPending = true;

      return null;
    }

    const isCurrent = () => !destroyed && currentActionId === filterActionId;

    /*
     * When supplied, the tab-specific handler owns the entire filter action.
     *
     * This is the safe path for Market -> Sector coordination:
     *
     * 1. load the new Sector options
     * 2. synchronize Sector silently
     * 3. call context.reload() once
     *
     * The factory does not perform another automatic reload afterward.
     */

    if (typeof options.handleFilterChange === "function") {
      return options.handleFilterChange(
        detail,

        createContext(detail.state || filters.getState(), {
          filtersInstance: filters,

          isCurrent,

          reload() {
            if (!isCurrent()) {
              return Promise.resolve(null);
            }

            return reload();
          },

          source,

          tab: instance,
        }),
      );
    }

    if (!isCurrent()) {
      return null;
    }

    return reload();
  }

  function handleFilterChange(event) {
    processFilterChange(event).catch((error) => {
      reportFilterError(
        error,

        normalizeFilterEvent(event, filters),
      );
    });
  }

  /* ========================================================================
     Initial Preparation
     ======================================================================== */

  function prepareInitialLoad() {
    if (
      preparationComplete ||
      typeof options.prepareInitialLoad !== "function"
    ) {
      preparationComplete = true;

      return Promise.resolve(null);
    }

    if (preparationPromise) {
      return preparationPromise;
    }

    /*
     * Tabs with dependent filters use this hook to load the initial dependent
     * option collection before the first results request.
     */

    preparationPromise = Promise.resolve(
      options.prepareInitialLoad(
        createContext(filters.getState(), {
          filtersInstance: filters,

          source,

          tab: instance,
        }),
      ),
    )
      .then((result) => {
        if (!destroyed) {
          preparationComplete = true;
        }

        return result;
      })
      .finally(() => {
        preparationPromise = null;
      });

    return preparationPromise;
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

    filters.init?.();

    filters.sync?.();

    /*
     * This is the only filter subscription in the tab.
     */

    unsubscribeFilters = filters.subscribe?.(handleFilterChange) || null;

    unsubscribeState = state.subscribe((event) => {
      syncBusyState(event.state);
    });

    syncBusyState(state.getState());

    unbindLogoFallback = bindStandardCompanyLogoFallback(root);

    controller.init();

    bindPresentationActivity();

    syncPresentationActivity();

    options.onInit?.(createContext());

    return instance;
  }

  /* ========================================================================
     Activation
     ======================================================================== */

  async function activate(settings = {}) {
    if (destroyed) {
      return null;
    }

    init();

    /*
     * Ignore duplicate activation events unless an explicit reload was
     * requested.
     */

    if (active && settings.reload !== true) {
      return null;
    }

    active = true;

    state.set("active", true, {
      type: "activate",
    });

    syncPresentationActivity();

    options.onActivate?.(createContext());

    await prepareInitialLoad();

    if (destroyed || !active) {
      return null;
    }

    const shouldReload =
      settings.reload ??
      (reloadPending || !hasLoaded || options.reloadOnActivate !== false);

    return shouldReload ? reload() : null;
  }

  /* ========================================================================
     Deactivation
     ======================================================================== */

  function deactivate() {
    if (destroyed || !initialized || !active) {
      return false;
    }

    active = false;

    /*
     * Invalidate pending dependent-filter work before it can reload results.
     */

    filterActionId += 1;

    /*
     * Stop hidden presentation work before restoring the last completed rows.
     */

    syncPresentationActivity();

    clearCancelledLoadingState();

    state.set("active", false, {
      type: "deactivate",
    });

    options.onDeactivate?.(createContext());

    return true;
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    active = false;

    filterActionId += 1;

    table.setActive?.(false);

    cards.setActive?.(false);

    destroyed = true;

    source.cancel();

    destroyPresentationActivity();

    unsubscribeFilters?.();
    unsubscribeFilters = null;

    unsubscribeState?.();
    unsubscribeState = null;

    unbindLogoFallback?.();
    unbindLogoFallback = null;

    controller.destroy();

    /*
     * controllerFilters is deliberately read-only, so the controller does not
     * own or destroy the real filter instance.
     */

    filters.destroy?.();

    viewElement.setAttribute("aria-busy", "false");

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

    getContext() {
      return createContext();
    },

    getFilterController() {
      return filters;
    },

    getFilters() {
      return filters.getState();
    },

    getRows() {
      return controller.getSourceRows();
    },

    getTable() {
      return table.getApi();
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
      return source.isLoading();
    },
  });

  /* ========================================================================
     Registration and Optional Startup
     ======================================================================== */

  instances.set(root, instance);

  if (options.autoInit !== false) {
    init();
  }

  if (options.active === true) {
    activate().catch((error) => {
      reportFilterError(error, null);
    });
  }

  return instance;
}
