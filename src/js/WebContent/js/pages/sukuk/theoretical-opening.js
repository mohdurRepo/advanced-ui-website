/* ==========================================================================
   Theoretical Opening
   ========================================================================== */

/*
 * Theoretical Opening page composition.
 *
 * Responsibilities:
 *
 * - configuration
 * - request data construction
 * - shared state
 * - filters
 * - data source
 * - desktop table composition
 * - mobile cards composition
 * - result count
 * - Data View controller
 * - lifecycle
 * - public page API
 * - normal-page startup
 *
 * This module is shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 *
 * This module intentionally has no:
 *
 * - column picker
 * - column visibility
 * - favorite handling
 * - watchlist handling
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataResults,
  createDataSource,
  createDataState,
  createDataViewController,
} from "../common/data-view/index.js";

import { getTheoreticalOpeningConfig } from "./theoretical-opening.config.js";

import { createTheoreticalOpeningFilters } from "./theoretical-opening.filters.js";

import { normalizeTheoreticalOpeningResponse } from "./theoretical-opening.normalizer.js";

import { createTheoreticalOpeningTable } from "./views/theoretical-opening.table.js";

import { createTheoreticalOpeningCards } from "./views/theoretical-opening.cards.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const THEORETICAL_OPENING_VIEW = "1";

const SELECTORS = Object.freeze({
  resultCount: "[data-theoretical-opening-result-count]",
});

const instances = new WeakMap();

/* ==========================================================================
   Request Data
   ========================================================================== */

/*
 * Important:
 *
 * The HTML select is allowed to keep:
 *
 *   name="sectorParameter"
 *
 * for JSP / legacy markup compatibility.
 *
 * The backend request contract remains:
 *
 *   sector
 *   requestLocale
 *
 * Do not rename `sector` to `sectorParameter`.
 */

export function buildTheoreticalOpeningRequestData(
  config = {},
  filterState = {},
) {
  return {
    sector: filterState.sector || config.initialState?.sector || "All",

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Public Page Factory
   ========================================================================== */

export function initTheoreticalOpeningPage({
  root = document,
  configName = "TheoreticalOpeningConfig",
} = {}) {
  const scope = root;

  /* ------------------------------------------------------------------------
     Existing Instance
     ------------------------------------------------------------------------ */

  const existing = instances.get(scope);

  if (existing) {
    return existing;
  }

  /* ========================================================================
     Configuration
     ======================================================================== */

  const config = getTheoreticalOpeningConfig(configName);

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
     Filters
     ======================================================================== */

  const filters = createTheoreticalOpeningFilters({
    root: scope,
  });

  /*
   * Ensure the common filter state starts with the configuration value
   * supplied by the JSP.
   *
   * Normally the DOM select already contains this value, but keeping the
   * initial state here makes the page contract explicit.
   */

  const initialFilterState = filters.getState();

  if (!initialFilterState?.sector && typeof filters.setState === "function") {
    filters.setState({
      sector: config.initialState?.sector || "All",
    });
  }

  /* ========================================================================
     Data Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoint,

    /*
     * The legacy Theoretical Opening endpoint uses POST.
     *
     * This must remain explicit because the common source can otherwise
     * default to another HTTP method.
     */

    method: "POST",

    dataType: "json",

    buildRequestData(filterState = {}) {
      return buildTheoreticalOpeningRequestData(config, filterState);
    },

    normalizeResponse(response) {
      return normalizeTheoreticalOpeningResponse(response);
    },
  });

  /* ========================================================================
     Desktop Table
     ======================================================================== */

  const table = createTheoreticalOpeningTable({
    root: scope,

    config,

    view: THEORETICAL_OPENING_VIEW,
  });

  /* ========================================================================
     Mobile Cards
     ======================================================================== */

  const cards = createTheoreticalOpeningCards({
    root: scope,

    config,

    view: THEORETICAL_OPENING_VIEW,
  });

  /* ========================================================================
     Results
     ======================================================================== */

  const resultCountElement = scope.querySelector(SELECTORS.resultCount);

  const results = resultCountElement
    ? createDataResults({
        root: scope,

        count: resultCountElement,

        labels: {
          loading: config.labels?.loading || "Loading...",

          results: config.labels?.results || "Results",

          empty: config.labels?.noData || "No data available",

          error:
            config.labels?.loadError ||
            config.labels?.noData ||
            "Unable to load Theoretical Opening data.",
        },
      })
    : null;

  /* ========================================================================
     Controller
     ======================================================================== */

  const controller = createDataViewController({
    source,

    state,

    filters,

    table,

    cards,

    results,

    getView() {
      return THEORETICAL_OPENING_VIEW;
    },

    /*
     * There is only one fixed view.
     *
     * No view change should cause another request.
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
        "Unable to load Theoretical Opening data."
      );
    },

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
    destroy() {
      controller.destroy();

      instances.delete(scope);
    },

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

    getState() {
      return state.getState();
    },

    getConfig() {
      return config;
    },
  });

  instances.set(scope, instance);

  return instance;
}

/* ==========================================================================
   Normal Theoretical Opening Startup
   ========================================================================== */

/*
 * The normal Theoretical Opening page loads this file directly.
 *
 * Nomu imports this module from:
 *
 *   nomu-theoretical-opening.js
 *
 * Therefore this startup must only execute when the normal page's runtime
 * configuration exists.
 */

function start() {
  if (typeof window === "undefined" || !window.TheoreticalOpeningConfig) {
    return;
  }

  initTheoreticalOpeningPage({
    root: document,

    configName: "TheoreticalOpeningConfig",
  });
}

/* ==========================================================================
   DOM Ready
   ========================================================================== */

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true,
    });
  } else {
    start();
  }
}
