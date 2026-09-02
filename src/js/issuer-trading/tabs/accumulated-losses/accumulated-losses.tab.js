/* ==========================================================================
   Accumulated Losses Tab
   ========================================================================== */

/*
 * Tab composition for Accumulated Losses.
 *
 * This feature intentionally does not use createTradingTab().
 *
 * Accumulated Losses has one responsive content-feed presentation rather than
 * separate desktop-table and mobile-card presentations.
 *
 * Responsibilities:
 *
 * - compose common source, state, filters, and results utilities
 * - build the legacy request parameters
 * - coordinate the responsive content-feed view
 * - coordinate loading, ready, empty, and error states
 * - preserve the last stable presentation during cancellation
 * - support lazy activation and destruction
 *
 * This module intentionally has no:
 *
 * - company markup
 * - pagination
 * - response-envelope parsing
 * - page-level tab-navigation behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  bindStandardCompanyLogoFallback,
  createDataFilters,
  createDataResults,
  createDataSource,
  createDataState,
} from "../../../../common/data-view/index.js";

import { getIssuerTradingEndpoint } from "../../issuer-trading-config.js";

import {
  ACCUMULATED_LOSSES_PERCENTAGES,
  bindAccumulatedLossesFilters,
  createAccumulatedLossesFilterDefinitions,
  normalizeAccumulatedLossesPercentage,
} from "./accumulated-losses.filters.js";

import { normalizeAccumulatedLossesResponse } from "./accumulated-losses.normalizer.js";

import { createAccumulatedLossesView } from "./views/accumulated-losses.view.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const TAB_KEY = "accumulated-losses";

const ENDPOINT_KEY = "accumulatedLosses";

const DEFAULT_LOCALE = "en";

const DEFAULT_EMPTY_MESSAGE = "No data available.";

const DEFAULT_ERROR_MESSAGE = "Unable to load data.";

export const ACCUMULATED_LOSSES_SELECTORS = Object.freeze({
  count: "[data-accumulated-losses-result-count]",

  status: "[data-accumulated-losses-status]",
});

/* ==========================================================================
   General Helpers
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

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function normalizeCount(value, fallback = 0) {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return fallback;
  }

  return Math.floor(count);
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function getEmptyMessage(config) {
  return normalizeString(config.labels?.noData, DEFAULT_EMPTY_MESSAGE);
}

function getErrorMessage(error, config) {
  return (
    normalizeString(error?.response?.message) ||
    normalizeString(error?.message) ||
    normalizeString(config.labels?.error) ||
    DEFAULT_ERROR_MESSAGE
  );
}

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createAccumulatedLossesTab(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      "createAccumulatedLossesTab requires an options object.",
    );
  }

  const root = options.root;

  if (!root || typeof root.querySelector !== "function") {
    throw new Error("Accumulated Losses requires a valid root element.");
  }

  const existingInstance = instances.get(root);

  if (existingInstance) {
    return existingInstance;
  }

  const config = options.config;

  if (!isPlainObject(config)) {
    throw new TypeError("Accumulated Losses requires page configuration.");
  }

  /* ========================================================================
     State
     ======================================================================== */

  const state = createDataState({
    active: false,

    loading: false,

    rows: [],

    meta: {},

    error: null,
  });

  /* ========================================================================
     Component References
     ======================================================================== */

  let filters = null;

  let filterBinding = null;

  let dataSource = null;

  let view = null;

  let results = null;

  let unsubscribeState = null;

  let unbindLogoFallback = null;

  /* ========================================================================
     Lifecycle State
     ======================================================================== */

  let initialized = false;

  let initializing = false;

  let active = false;

  let destroyed = false;

  let hasLoaded = false;

  let loadId = 0;

  /*
   * Preserve the last completed presentation while another request is loading.
   *
   * If the user changes tabs during that request, deactivate() cancels the
   * request and restores this presentation rather than leaving loading
   * skeletons visible.
   */
  let lastCompletedRender = Object.freeze({
    type: "idle",

    rows: [],

    count: 0,

    message: "",
  });

  /* ========================================================================
     Request
     ======================================================================== */

  function buildRequestData(filterState = {}) {
    return {
      percentage: normalizeAccumulatedLossesPercentage(filterState.percentage),

      requestLocale: normalizeString(config.locale, DEFAULT_LOCALE),
    };
  }

  /* ========================================================================
     Busy State
     ======================================================================== */

  function syncBusyState(snapshot) {
    root.setAttribute("aria-busy", String(Boolean(snapshot.loading)));
  }

  /* ========================================================================
     Completed Presentation
     ======================================================================== */

  function setCompletedRender(nextRender) {
    lastCompletedRender = Object.freeze({
      type: normalizeString(nextRender?.type, "idle"),

      rows: normalizeRows(nextRender?.rows),

      count: normalizeCount(nextRender?.count),

      message: normalizeString(nextRender?.message),
    });
  }

  function restoreLastCompletedRender() {
    if (!view || !results) {
      return;
    }

    switch (lastCompletedRender.type) {
      case "ready":
        view.renderRows(lastCompletedRender.rows);

        results.showReady(lastCompletedRender.count);

        return;

      case "empty":
        view.renderEmpty(lastCompletedRender.message);

        results.showEmpty(lastCompletedRender.message);

        return;

      case "error":
        view.renderError(lastCompletedRender.message);

        results.showError(lastCompletedRender.message);

        return;

      case "idle":
      default:
        view.renderEmpty(getEmptyMessage(config));

        results.reset();
    }
  }

  /* ========================================================================
     Initialization Cleanup
     ======================================================================== */

  function cleanupComponents() {
    filterBinding?.destroy?.();

    filters?.destroy?.();

    view?.destroy?.();

    results?.destroy?.();

    dataSource?.destroy?.();

    unsubscribeState?.();

    unbindLogoFallback?.();

    filterBinding = null;

    filters = null;

    view = null;

    results = null;

    dataSource = null;

    unsubscribeState = null;

    unbindLogoFallback = null;
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

    if (initializing) {
      return instance;
    }

    initializing = true;

    try {
      /* --------------------------------------------------------------------
         Filters
         -------------------------------------------------------------------- */

      filters = createDataFilters({
        root,

        fields: createAccumulatedLossesFilterDefinitions(),

        eventTarget: root,

        eventName: `${TAB_KEY}:filters-change`,
      });

      /* --------------------------------------------------------------------
         Responsive Content Feed
         -------------------------------------------------------------------- */

      view = createAccumulatedLossesView({
        root,

        config,
      });

      /* --------------------------------------------------------------------
         Results
         -------------------------------------------------------------------- */

      results = createDataResults({
        root,

        count: ACCUMULATED_LOSSES_SELECTORS.count,

        status: ACCUMULATED_LOSSES_SELECTORS.status,

        initialCount: 0,

        labels: {
          /*
           * The visible "Results" text already exists in the JSP.
           * createDataResults() owns only its value/status updates.
           */
          results: "",

          loading: config.labels?.loading,

          empty: config.labels?.noData,

          error: config.labels?.error,
        },
      });

      /* --------------------------------------------------------------------
         Data Source
         -------------------------------------------------------------------- */

      dataSource = createDataSource({
        ...(isPlainObject(options.sourceOptions) ? options.sourceOptions : {}),

        endpoint: getIssuerTradingEndpoint(config, ENDPOINT_KEY),

        method: options.method || "GET",

        buildRequestData,

        normalizeResponse: normalizeAccumulatedLossesResponse,
      });

      /* --------------------------------------------------------------------
         Filter Coordination

         Accumulated Losses does not use createDataViewController(), so its
         filter binder remains responsible for triggering reloads.
         -------------------------------------------------------------------- */

      filterBinding = bindAccumulatedLossesFilters({
        root,

        filters,

        onReload() {
          if (active) {
            reload();
          }
        },
      });

      /* --------------------------------------------------------------------
         Company Logo Fallback
         -------------------------------------------------------------------- */

      unbindLogoFallback = bindStandardCompanyLogoFallback(root);

      /* --------------------------------------------------------------------
         State Synchronization
         -------------------------------------------------------------------- */

      unsubscribeState = state.subscribe((event) => {
        syncBusyState(event.state);
      });

      syncBusyState(state.getState());

      /*
       * Do not mark initialization complete until all required components have
       * been created successfully.
       */
      initialized = true;

      options.onInit?.({
        config,

        filters: filters.getState(),

        key: TAB_KEY,
      });

      return instance;
    } catch (error) {
      cleanupComponents();

      initialized = false;

      throw error;
    } finally {
      initializing = false;
    }
  }

  /* ========================================================================
     Load
     ======================================================================== */

  async function reload() {
    if (destroyed) {
      return null;
    }

    init();

    if (!filters || !dataSource || !view || !results) {
      return null;
    }

    const currentLoadId = ++loadId;

    const filterState = filters.getState();

    state.setState(
      {
        loading: true,

        error: null,
      },
      {
        type: "loading",

        source: TAB_KEY,
      },
    );

    view.renderLoading();

    results.showLoading();

    try {
      const response = await dataSource.load(filterState);

      if (destroyed || currentLoadId !== loadId) {
        return null;
      }

      const rows = normalizeRows(response?.rows);

      const meta = isPlainObject(response?.meta) ? response.meta : {};

      const count = normalizeCount(meta.total, rows.length);

      hasLoaded = true;

      if (!rows.length) {
        const emptyMessage = getEmptyMessage(config);

        setCompletedRender({
          type: "empty",

          rows: [],

          count: 0,

          message: emptyMessage,
        });

        view.renderEmpty(emptyMessage);

        results.showEmpty(emptyMessage);
      } else {
        setCompletedRender({
          type: "ready",

          rows,

          count,

          message: "",
        });

        /*
         * No pagination:
         * every normalized company is rendered by the content-feed.
         */
        view.renderRows(rows);

        results.showReady(count);
      }

      state.setState(
        {
          loading: false,

          rows,

          meta,

          error: null,
        },
        {
          type: "loaded",

          source: TAB_KEY,
        },
      );

      options.onDataLoaded?.({
        rows,

        meta,

        filters: filterState,

        key: TAB_KEY,
      });

      return response;
    } catch (error) {
      if (destroyed || currentLoadId !== loadId || isAbortError(error)) {
        return null;
      }

      const errorMessage = getErrorMessage(error, config);

      setCompletedRender({
        type: "error",

        rows: [],

        count: 0,

        message: errorMessage,
      });

      view.renderError(errorMessage);

      results.showError(errorMessage);

      state.setState(
        {
          loading: false,

          rows: [],

          meta: {},

          error,
        },
        {
          type: "error",

          source: TAB_KEY,
        },
      );

      options.onError?.(error, {
        filters: filterState,

        key: TAB_KEY,
      });

      return null;
    } finally {
      if (!destroyed && currentLoadId === loadId) {
        const snapshot = state.getState();

        if (snapshot.loading) {
          state.setState(
            {
              loading: false,
            },
            {
              type: "settled",

              source: TAB_KEY,
            },
          );
        }
      }
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

    state.setState(
      {
        active: true,
      },
      {
        type: "activate",

        source: TAB_KEY,
      },
    );

    options.onActivate?.({
      filters: filters.getState(),

      key: TAB_KEY,
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

    /*
     * Invalidate any pending completion handler before aborting the request.
     */
    loadId += 1;

    dataSource?.cancel();

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

    restoreLastCompletedRender();

    options.onDeactivate?.({
      filters: filters.getState(),

      key: TAB_KEY,
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

    /*
     * Prevent any request already awaiting completion from rendering.
     */
    loadId += 1;

    cleanupComponents();

    state.destroy();

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
      return filters
        ? filters.getState()
        : {
            percentage: ACCUMULATED_LOSSES_PERCENTAGES.all,
          };
    },

    getRows() {
      return state.getState().rows;
    },

    getState() {
      return state.getState();
    },

    hasLoaded() {
      return hasLoaded;
    },

    isActive() {
      return active;
    },

    isLoading() {
      return Boolean(state.getState().loading);
    },
  });

  instances.set(root, instance);

  /*
   * Keep creation lazy by default.
   *
   * issuer-trading.js creates this feature with autoInit:false and activates
   * it only when its tab becomes active.
   */
  if (options.autoInit === true) {
    init();
  }

  if (options.active === true) {
    activate();
  }

  return instance;
}
