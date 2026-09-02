/* ==========================================================================
   Listed Tradable Rights Tab
   ========================================================================== */

/*
 * Tab composition for Listed Tradable Rights.
 *
 * Responsibilities:
 *
 * - compose the shared data source, state, and results utilities
 * - build the legacy request parameters
 * - coordinate the desktop table and mobile cards
 * - coordinate loading, ready, empty, and error states
 * - cancel stale requests
 * - restore the last stable presentation on deactivation
 * - support lazy activation and destruction
 *
 * This module intentionally has no:
 *
 * - table cell markup
 * - card markup
 * - response-envelope parsing
 * - filters
 * - pagination
 * - global tab-navigation behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  bindStandardCompanyLogoFallback,
  createDataResults,
  createDataSource,
  createDataState,
} from "../../../../common/data-view/index.js";

import { getIssuerTradingEndpoint } from "../../issuer-trading-config.js";

import { createListedTradableRightsFormatters } from "./listed-tradable-rights.formatters.js";

import { normalizeListedTradableRightsResponse } from "./listed-tradable-rights.normalizer.js";

import { createListedTradableRightsCards } from "./views/listed-tradable-rights.cards.js";

import { createListedTradableRightsTable } from "./views/listed-tradable-rights.table.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const TAB_KEY = "listed-tradable-rights";

const ENDPOINT_KEY = "listedTradableRights";

const DEFAULT_LOCALE = "en";

const SELECTORS = Object.freeze({
  view: "[data-listed-tradable-rights-view]",

  count: "[data-listed-tradable-rights-result-count]",

  status: "[data-listed-tradable-rights-status]",
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

export function createListedTradableRightsTab(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      "createListedTradableRightsTab requires an options object.",
    );
  }

  const root = options.root;

  if (!root || typeof root.querySelector !== "function") {
    throw new Error("Listed Tradable Rights requires a valid root element.");
  }

  const existingInstance = instances.get(root);

  if (existingInstance) {
    return existingInstance;
  }

  const config = options.config;

  if (!isPlainObject(config)) {
    throw new TypeError("Listed Tradable Rights requires page configuration.");
  }

  const viewElement = root.querySelector(SELECTORS.view);

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

  let formatters = null;

  let dataSource = null;

  let table = null;

  let cards = null;

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

  function buildRequestData() {
    return {
      requestLocale: normalizeString(config.locale, DEFAULT_LOCALE),
    };
  }

  /* ========================================================================
     Busy State
     ======================================================================== */

  function syncBusyState(snapshot) {
    const value = String(Boolean(snapshot.loading));

    root.setAttribute("aria-busy", value);

    viewElement?.setAttribute("aria-busy", value);
  }

  /* ========================================================================
     Coordinated Rendering
     ======================================================================== */

  function renderLoading() {
    table.renderLoading();

    cards.renderLoading();

    results.showLoading();
  }

  function renderReady(rows, count) {
    table.renderRows(rows);

    cards.renderRows(rows);

    results.showReady(count);

    table.adjust();
  }

  function renderEmpty(message) {
    table.renderEmpty(message);

    cards.renderEmpty(message);

    results.showEmpty(message);
  }

  function renderError(message) {
    table.renderError(message);

    cards.renderError(message);

    results.showError(message);
  }

  /* ========================================================================
     Stable Presentation Restoration
     ======================================================================== */

  function restoreLastCompletedRender() {
    if (!table || !cards || !results) {
      return;
    }

    switch (lastCompletedRender.type) {
      case "ready":
        renderReady(lastCompletedRender.rows, lastCompletedRender.count);

        break;

      case "empty":
        renderEmpty(lastCompletedRender.message);

        break;

      case "error":
        renderError(lastCompletedRender.message);

        break;

      case "idle":
      default:
        table.renderEmpty(config.labels?.noData);

        cards.renderEmpty(config.labels?.noData);

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
       Formatters
       ---------------------------------------------------------------------- */

    formatters = createListedTradableRightsFormatters(config);

    /* ----------------------------------------------------------------------
       Desktop Table
       ---------------------------------------------------------------------- */

    table = createListedTradableRightsTable({
      root,
      config,
      formatters,

      loadingRowCount: options.loadingRowCount || 6,
    });

    /* ----------------------------------------------------------------------
       Mobile Cards
       ---------------------------------------------------------------------- */

    cards = createListedTradableRightsCards({
      root,
      config,
      formatters,

      loadingCardCount: options.loadingCardCount || 3,
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
         * Only the dedicated numeric element is updated.
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

      normalizeResponse: normalizeListedTradableRightsResponse,
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

    renderLoading();

    try {
      const response = await dataSource.load({});

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

        renderEmpty(emptyMessage);
      } else {
        lastCompletedRender = {
          type: "ready",

          rows: [...rows],

          count,

          message: "",
        };

        renderReady(rows, count);
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

        key: TAB_KEY,
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

      renderError(errorMessage);

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

    /*
     * The design-system controller has just revealed the panel.
     * Allow DataTables and FixedHeader to measure the visible layout.
     */

    table.adjust();

    options.onActivate?.({
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

      table?.destroy();

      cards?.destroy();

      results?.destroy();

      unsubscribeState?.();

      unbindLogoFallback?.();
    }

    state.destroy();

    root.setAttribute("aria-busy", "false");

    viewElement?.setAttribute("aria-busy", "false");

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

    getRows() {
      return state.getState().rows;
    },

    getState() {
      return state.getState();
    },

    getTable() {
      return table?.getApi() || null;
    },

    hasLoaded() {
      return hasLoaded;
    },

    isActive() {
      return active;
    },
  });

  instances.set(root, instance);

  return instance;
}
