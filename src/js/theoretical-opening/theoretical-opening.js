/* ==========================================================================
   Theoretical Opening
   ========================================================================== */

/*
 * Theoretical Opening page composition.
 *
 * Responsibilities:
 *
 * - page initialization
 * - shared Data View composition
 * - state
 * - sector filter
 * - POST data source
 * - results
 * - table/cards coordination
 * - public API
 * - startup
 *
 * Page-specific presentation is delegated to:
 *
 * - shared/theoretical-opening.config.js
 * - shared/theoretical-opening.columns.js
 * - shared/theoretical-opening.filters.js
 * - shared/theoretical-opening.formatters.js
 * - shared/theoretical-opening.normalizer.js
 * - views/theoretical-opening.table.js
 * - views/theoretical-opening.cards.js
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import {
  createDataResults,
  createDataSource,
  createDataState,
  createDataViewController,
} from "../common/data-view/index.js";

/* ==========================================================================
   Theoretical Opening Modules
   ========================================================================== */

import { createTheoreticalOpeningConfig } from "./shared/theoretical-opening.config.js";

import { createTheoreticalOpeningFilters } from "./shared/theoretical-opening.filters.js";

import { normalizeTheoreticalOpeningResponse } from "./shared/theoretical-opening.normalizer.js";

import { createTheoreticalOpeningTable } from "./views/theoretical-opening.table.js";

import { createTheoreticalOpeningCards } from "./views/theoretical-opening.cards.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = "1";

const SELECTORS = Object.freeze({
  page: "[data-theoretical-opening-page]",

  resultCount: "[data-theoretical-opening-result-count]",
});

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Request
   ========================================================================== */

function buildRequestData(config, filterState = {}) {
  return {
    /*
     * IMPORTANT:
     *
     * Preserve the existing backend
     * contract exactly.
     *
     * The JSP select may still be named
     * sectorParameter, but the AJAX
     * payload uses "sector".
     */
    sector: filterState.sector || "All",

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Runtime Configuration
   ========================================================================== */

function getRuntimeConfig(configName) {
  const runtimeConfig = window[configName];

  return createTheoreticalOpeningConfig(runtimeConfig || {});
}

/* ==========================================================================
   Page Factory
   ========================================================================== */

export function initTheoreticalOpeningPage({
  root,
  configName = "TheoreticalOpeningConfig",
} = {}) {
  if (!root || typeof root.querySelector !== "function") {
    return null;
  }

  const existing = instances.get(root);

  if (existing) {
    return existing;
  }

  const config = getRuntimeConfig(configName);

  /* ========================================================================
     State
     ======================================================================== */

  const state = createDataState({
    loading: false,

    sourceRows: [],

    visibleRows: [],

    meta: {},

    error: null,
  });

  /* ========================================================================
     Controller Reference
     ======================================================================== */

  /*
   * The filter is created before the
   * controller.
   *
   * Keep a reference here so filter
   * changes can reload the controller
   * after initialization.
   */
  let controller = null;

  /* ========================================================================
     Filters
     ======================================================================== */

  const filters = createTheoreticalOpeningFilters({
    root,

    initialState: config.initialState,

    onChange() {
      /*
       * Sector is a server-side filter.
       *
       * Changing it must request
       * fresh data.
       */
      controller?.reload();
    },
  });

  /*
   * The common controller only needs
   * access to the current request
   * filter state.
   *
   * Our page-specific filter module
   * owns its DOM event handling.
   */
  const controllerFilters = Object.freeze({
    getState() {
      return filters.getState();
    },
  });

  /* ========================================================================
     Data Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoint,

    /*
     * CRITICAL:
     *
     * The legacy Theoretical Opening
     * request uses POST.
     *
     * Do not change this to GET.
     */
    method: "POST",

    dataType: "json",

    buildRequestData(filterState) {
      return buildRequestData(config, filterState);
    },

    normalizeResponse(response) {
      return normalizeTheoreticalOpeningResponse(response);
    },
  });

  /* ========================================================================
     Desktop Table
     ======================================================================== */

  const table = createTheoreticalOpeningTable({
    root,

    config,
  });

  /* ========================================================================
     Mobile Cards
     ======================================================================== */

  const cards = createTheoreticalOpeningCards({
    root,

    config,
  });

  /* ========================================================================
     Results
     ======================================================================== */

  const resultCountElement = root.querySelector(SELECTORS.resultCount);

  const results = resultCountElement
    ? createDataResults({
        root,

        count: resultCountElement,

        labels: {
          loading: config.labels?.loading || "Loading...",

          results: config.labels?.results || "Results",

          empty: config.labels?.noData || "No data available",

          error: config.labels?.loadError || "Unable to load data.",
        },
      })
    : null;

  /* ========================================================================
     Controller
     ======================================================================== */

  controller = createDataViewController({
    source,

    state,

    filters: controllerFilters,

    table,

    cards,

    results,

    getView() {
      return VIEW;
    },

    /*
     * The page has one fixed view.
     *
     * No view switching or column
     * visibility synchronization is
     * required.
     */
    reloadOnViewChange: false,

    getEmptyMessage() {
      return config.labels?.noData || "No data available";
    },

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        error?.message ||
        config.labels?.loadError ||
        config.labels?.noData ||
        "Unable to load data."
      );
    },

    /*
     * Load immediately when the
     * page initializes.
     */
    autoLoad: true,
  });

  /* ========================================================================
     Initialization
     ======================================================================== */

  controller.init();

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    reload() {
      return controller.reload();
    },

    getFilters() {
      return filters.getState();
    },

    getRows() {
      return controller.getSourceRows();
    },

    getVisibleRows() {
      return controller.getVisibleRows();
    },

    getTable() {
      return table.getApi();
    },

    destroy() {
      /*
       * The controller owns the
       * Data View lifecycle.
       */
      controller.destroy();

      /*
       * Our custom filter module owns
       * its DOM listener.
       */
      filters.destroy();

      instances.delete(root);
    },
  });

  instances.set(root, instance);

  return instance;
}

/* ==========================================================================
   Normal Theoretical Opening
   ========================================================================== */

export function initTheoreticalOpening(root = document) {
  const page = root.querySelector(SELECTORS.page);

  if (!page) {
    return null;
  }

  return initTheoreticalOpeningPage({
    root: page,

    configName: "TheoreticalOpeningConfig",
  });
}

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  initTheoreticalOpening(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
