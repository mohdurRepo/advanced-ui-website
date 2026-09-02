/* ==========================================================================
   Trading Tab Factory
   ========================================================================== */

/*
 * Shared composition factory for Issuer Trading tabs.
 *
 * Responsibilities:
 *
 * - compose common data-view modules
 * - resolve tab views and endpoints
 * - coordinate filters, requests, tables, cards, and results
 * - support lazy tab activation
 * - cancel requests when a tab is deactivated
 * - manage company-logo fallback behavior
 * - support tab-specific filter bindings
 * - support complete destruction
 *
 * Individual tabs remain responsible for:
 *
 * - filter definitions
 * - dependent filter behavior
 * - endpoint selection
 * - request parameters
 * - response normalization
 * - table schemas
 * - complex table headers
 * - cell and card rendering
 * - row-group presentation
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
} from "../../../common/data-view/index.js";

import { getIssuerTradingEndpoint } from "../issuer-trading-config.js";

import { createTradingTableOptions } from "../../shared/trading/trading-table-options.js";

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

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
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

function resolveCleanup(binding, description) {
  if (binding == null) {
    return null;
  }

  if (typeof binding === "function") {
    return binding;
  }

  if (binding && typeof binding.destroy === "function") {
    return () => {
      binding.destroy();
    };
  }

  throw new TypeError(
    `${description} must return a cleanup function, a destroyable instance, or nothing.`,
  );
}

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createTradingTab(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError("createTradingTab requires an options object.");
  }

  const root = options.root;

  if (!root || typeof root.querySelector !== "function") {
    throw new Error("Trading tab requires a valid root element.");
  }

  const existing = instances.get(root);

  if (existing) {
    return existing;
  }

  const key = normalizeString(options.key);

  if (!key) {
    throw new Error("Trading tab requires a non-empty key.");
  }

  const config = options.config;

  if (!isPlainObject(config)) {
    throw new TypeError(`Trading tab "${key}" requires page configuration.`);
  }

  const selectors = options.selectors;

  if (!isPlainObject(selectors)) {
    throw new TypeError(`Trading tab "${key}" requires selectors.`);
  }

  if (!selectors.table || !selectors.cards) {
    throw new Error(`Trading tab "${key}" requires table and cards selectors.`);
  }

  if (!isPlainObject(options.filters)) {
    throw new TypeError(`Trading tab "${key}" requires filter definitions.`);
  }

  if (typeof options.getColumns !== "function") {
    throw new TypeError(`Trading tab "${key}" requires getColumns().`);
  }

  if (typeof options.renderCell !== "function") {
    throw new TypeError(`Trading tab "${key}" requires renderCell().`);
  }

  if (typeof options.renderCard !== "function") {
    throw new TypeError(`Trading tab "${key}" requires renderCard().`);
  }

  if (!options.endpointKey && typeof options.getEndpointKey !== "function") {
    throw new TypeError(
      `Trading tab "${key}" requires endpointKey or getEndpointKey().`,
    );
  }

  if (typeof options.buildRequestData !== "function") {
    throw new TypeError(`Trading tab "${key}" requires buildRequestData().`);
  }

  if (typeof options.normalizeResponse !== "function") {
    throw new TypeError(`Trading tab "${key}" requires normalizeResponse().`);
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
   * Keep the most recent immutable state snapshot.
   *
   * Table renderers execute once per cell. Calling state.getState() for every
   * cell would repeatedly clone the complete row collection.
   */

  let stateSnapshot = state.getState();

  /* ========================================================================
     Filters
     ======================================================================== */

  const filters = createDataFilters({
    root,

    fields: options.filters,

    eventTarget: root,

    eventName: `${key}:filters-change`,
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

  function resolveEndpointKey(filterState) {
    if (typeof options.getEndpointKey === "function") {
      return normalizeString(
        options.getEndpointKey(createContext(filterState)),
      );
    }

    return normalizeString(options.endpointKey);
  }

  function resolveEndpoint(filterState) {
    const endpointKey = resolveEndpointKey(filterState);

    if (!endpointKey) {
      throw new Error(
        `Trading tab "${key}" could not resolve an endpoint key.`,
      );
    }

    return getIssuerTradingEndpoint(config, endpointKey);
  }

  /* ========================================================================
     Data Source
     ======================================================================== */

  const initialFilterState = filters.getState();

  const initialEndpoint = resolveEndpoint(initialFilterState);

  const sourceOptions = isPlainObject(options.sourceOptions)
    ? options.sourceOptions
    : {};

  const dataSource = createDataSource({
    ...sourceOptions,

    endpoint: initialEndpoint,

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

          /*
           * Explicit name for normalizers that need the exact filters used
           * for this request.
           */

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
   * The common controller calls source.load(filters).
   *
   * Resolve the endpoint before every request so one tab can switch between
   * multiple server resources.
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
     Table
     ======================================================================== */

  const initialView = resolveView(initialFilterState);

  const table = createDataTable({
    root,

    table: selectors.table,

    initialView,

    headerMode: options.headerMode || "schema",

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
      /*
       * createDataTable exposes the active view through its nested context,
       * not through cellContext.view.
       */

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

    tableOptions: createTradingTableOptions(options.tableOptions),

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
     Cards
     ======================================================================== */

  const cards = createDataCards({
    root,

    container: selectors.cards,

    initialView,

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

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.error || "Unable to load data.",

    afterRender(cardsContext) {
      options.onCardsRendered?.(cardsContext, createContext());
    },
  });

  /* ========================================================================
     Results
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

            empty: config.labels?.noData || "No data available",

            error: config.labels?.error || "Unable to load data.",

            results: config.labels?.results || "Results",
          },
        })
      : null;

  /*
   * The common controller normally uses visibleRows.length.
   *
   * Negotiated Deals includes daily total rows in the visible collection, so
   * prefer the normalized response total when available.
   */

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

    const metaCount = normalizeOptionalCount(stateSnapshot.meta?.total);

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
     Controller
     ======================================================================== */

  let hasLoaded = false;

  const controller = createDataViewController({
    source,
    state,
    filters,
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

    reloadOnViewChange: options.reloadOnViewChange !== false,

    getEmptyMessage(controllerContext) {
      if (typeof options.getEmptyMessage === "function") {
        return options.getEmptyMessage(
          controllerContext,

          createContext(controllerContext.filters),
        );
      }

      return config.labels?.noData || "No data available";
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

  let unsubscribeState = null;

  let unbindLogoFallback = null;

  let unbindFeatureFilters = null;

  /* ========================================================================
     Shared State
     ======================================================================== */

  function syncBusyState(snapshot) {
    stateSnapshot = snapshot;

    root.setAttribute("aria-busy", String(Boolean(snapshot.loading)));
  }

  /* ========================================================================
     Tab-Specific Filters
     ======================================================================== */

  function bindFeatureFilters() {
    if (typeof options.bindFilters !== "function") {
      return;
    }

    const binding = options.bindFilters({
      root,

      filters,

      config,

      source,

      tab: instance,

      reload,

      getContext: createContext,
    });

    unbindFeatureFilters = resolveCleanup(
      binding,
      `Trading tab "${key}" bindFilters()`,
    );
  }

  function destroyFeatureFilters() {
    unbindFeatureFilters?.();

    unbindFeatureFilters = null;
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

    let nextUnsubscribeState = null;
    let nextUnbindLogoFallback = null;

    try {
      nextUnsubscribeState = state.subscribe((event) => {
        syncBusyState(event.state);
      });

      syncBusyState(state.getState());

      nextUnbindLogoFallback = bindStandardCompanyLogoFallback(root);

      controller.init();

      bindFeatureFilters();

      /*
       * Commit shared cleanup references only after initialization succeeds.
       */
      unsubscribeState = nextUnsubscribeState;
      unbindLogoFallback = nextUnbindLogoFallback;

      initialized = true;

      options.onInit?.(createContext());

      return instance;
    } catch (error) {
      /*
       * bindFeatureFilters() may have completed before a later initialization
       * step failed.
       */
      destroyFeatureFilters();

      nextUnsubscribeState?.();
      nextUnbindLogoFallback?.();

      /*
       * controller.init() can partially initialize before throwing.
       * Returning it to a clean state is safer than caching a broken instance.
       */
      controller.destroy();

      root.setAttribute("aria-busy", "false");

      initialized = false;

      throw error;
    }
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

    state.set("active", true, {
      type: "activate",
    });

    table.adjust();

    options.onActivate?.(createContext());

    const shouldReload =
      settings.reload ?? (!hasLoaded || options.reloadOnActivate !== false);

    return shouldReload ? controller.reload() : Promise.resolve(null);
  }

  /* ========================================================================
     Deactivation
     ======================================================================== */

  function deactivate() {
    if (destroyed || !initialized || !active) {
      return false;
    }

    active = false;

    const cancelled = source.cancel();

    /*
     * An aborted controller request intentionally does not render an error.
     * Restore the most recent completed rows so the tab does not retain its
     * loading state while inactive.
     */

    if (cancelled) {
      controller.render();
    }

    state.set("active", false, {
      type: "deactivate",
    });

    options.onDeactivate?.(createContext());

    return true;
  }

  /* ========================================================================
     Reload
     ======================================================================== */

  function reload() {
    if (destroyed) {
      return Promise.resolve(null);
    }

    init();

    return controller.reload();
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

    source.cancel();

    destroyFeatureFilters();

    unsubscribeState?.();
    unsubscribeState = null;

    unbindLogoFallback?.();
    unbindLogoFallback = null;

    controller.destroy();

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

    getContext() {
      return createContext();
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
     Registration
     ======================================================================== */
  instances.set(root, instance);

  try {
    if (options.autoInit !== false) {
      init();
    }

    if (options.active === true) {
      activate();
    }

    return instance;
  } catch (error) {
    /*
     * Never retain an instance whose initial setup failed.
     */
    instances.delete(root);

    throw error;
  }
}
