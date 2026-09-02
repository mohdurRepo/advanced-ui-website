/* ==========================================================================
   Accumulated Losses Tab
   ========================================================================== */

/*
 * Tab composition for Accumulated Losses.
 *
 * Responsibilities:
 *
 * - compose the shared data source, filters, and results utilities
 * - build the legacy request parameters
 * - coordinate loading, ready, empty, and error states
 * - coordinate the responsive content-feed view
 * - cancel stale requests
 * - support lazy activation and destruction
 *
 * This module intentionally has no:
 *
 * - company markup
 * - pagination
 * - response-envelope parsing
 * - global tab-navigation behavior
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

const SELECTORS = Object.freeze({
  count: "[data-accumulated-losses-result-count]",

  status: "[data-accumulated-losses-status]",
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

  let active = false;

  let destroyed = false;

  let hasLoaded = false;

  let loadId = 0;

  /*
   * Preserve the last completed presentation while a new request loads.
   *
   * If the tab is deactivated during loading, the loading presentation is
   * replaced with the last stable result.
   */

  let lastCompletedRender = {
    type: "idle",

    rows: [],

    count: 0,

    message: "",
  };

  /* ========================================================================
     Request Data
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
     Stable Presentation Restoration
     ======================================================================== */

  function restoreLastCompletedRender() {
    if (!view || !results) {
      return;
    }

    switch (lastCompletedRender.type) {
      case "ready":
        view.renderRows(lastCompletedRender.rows);

        results.showReady(lastCompletedRender.count);

        break;

      case "empty":
        view.renderEmpty(lastCompletedRender.message);

        results.showEmpty(lastCompletedRender.message);

        break;

      case "error":
        view.renderError(lastCompletedRender.message);

        results.showError(lastCompletedRender.message);

        break;

      case "idle":
      default:
        view.renderEmpty(config.labels?.noData);

        results.reset();
    }
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

      fields: createAccumulatedLossesFilterDefinitions(),

      eventTarget: root,

      eventName: "accumulated-losses:filters-change",
    });

    /* ----------------------------------------------------------------------
       Content Feed
       ---------------------------------------------------------------------- */

    view = createAccumulatedLossesView({
      root,
      config,
    });

    /* ----------------------------------------------------------------------
       Results
       ---------------------------------------------------------------------- */

    results = createDataResults({
      root,

      count: SELECTORS.count,

      status: SELECTORS.status,

      initialCount: 0,

      labels: {
        /*
         * The JSP owns the visible Results label.
         * Only the numeric count should be written into the strong element.
         */

        results: "",

        loading: config.labels?.loading,

        empty: config.labels?.noData,

        error: config.labels?.error,
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

      normalizeResponse: normalizeAccumulatedLossesResponse,
    });

    /* ----------------------------------------------------------------------
       Filter Coordination
       ---------------------------------------------------------------------- */

    filterBinding = bindAccumulatedLossesFilters({
      root,
      filters,

      onReload() {
        if (active) {
          reload();
        }
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

    options.onInit?.({
      config,
      filters: filters.getState(),
      key: TAB_KEY,
    });

    return instance;
  }

  /* ========================================================================
     Load
     ======================================================================== */

  async function reload() {
    if (destroyed) {
      return null;
    }

    init();

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

      const rows = normalizeRows(response.rows);

      const meta = isPlainObject(response.meta) ? response.meta : {};

      const count = normalizeCount(meta.total, rows.length);

      hasLoaded = true;

      if (!rows.length) {
        const emptyMessage =
          normalizeString(config.labels?.noData) || "No data available.";

        lastCompletedRender = {
          type: "empty",

          rows: [],

          count: 0,

          message: emptyMessage,
        };

        view.renderEmpty(emptyMessage);

        results.showEmpty(emptyMessage);
      } else {
        lastCompletedRender = {
          type: "ready",

          rows,

          count,

          message: "",
        };

        /*
         * The view renders every returned company.
         * Accumulated Losses intentionally has no paging.
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
      });

      return response;
    } catch (error) {
      if (destroyed || currentLoadId !== loadId || isAbortError(error)) {
        return null;
      }

      const errorMessage = getErrorMessage(error, config);

      lastCompletedRender = {
        type: "error",

        rows: [],

        count: 0,

        message: errorMessage,
      };

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

    loadId += 1;

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

    loadId += 1;

    if (initialized) {
      dataSource?.destroy();

      filterBinding?.destroy();

      filters?.destroy();

      view?.destroy();

      results?.destroy();

      unsubscribeState?.();

      unbindLogoFallback?.();
    }

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
  });

  instances.set(root, instance);

  return instance;
}
