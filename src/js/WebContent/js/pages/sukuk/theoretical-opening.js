/* ==========================================================================
   Theoretical Opening
   ========================================================================== */

/*
 * Shared page composition for:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataResults,
  createDataSource,
  createDataState,
  createDataViewController,
} from "../../common/data-view/index.js";

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
 * IMPORTANT:
 *
 * HTML:
 *
 *   name="sectorParameter"
 *
 * Backend request:
 *
 *   sector
 *
 * These intentionally remain different.
 */

export function buildTheoreticalOpeningRequestData(
  config = {},
  filterState = {},
) {
  const sector = String(
    filterState.sector ?? config.initialState?.sector ?? "All",
  ).trim();

  return {
    sector: sector || "All",

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Public Factory
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
   * The common filter component reads the selected
   * value directly from the JSP <select>.
   *
   * Do not create a second local sector state here.
   */

  /* ========================================================================
     Data Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoint,

    /*
     * Exact legacy backend behavior.
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
     * This module only has one presentation schema.
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
 * theoretical-opening.js is loaded directly by the
 * normal Theoretical Opening JSP.
 *
 * It is also imported by the Nomu entry file.
 *
 * Therefore only automatically initialize when
 * window.TheoreticalOpeningConfig exists.
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
