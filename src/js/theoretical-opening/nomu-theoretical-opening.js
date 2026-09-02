/* ==========================================================================
   Nomu Theoretical Opening
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

const VARIANT = "nomu";

const SELECTORS = Object.freeze({
  resultCount: "[data-nomu-theoretical-opening-result-count]",
});

const instances = new WeakMap();

/* ==========================================================================
   Request
   ========================================================================== */

function buildRequestData(config, filterState) {
  return {
    sector: filterState.sector || config.initialState?.sector || "All",

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initNomuTheoreticalOpening(root = document) {
  const scope = root;

  const existing = instances.get(scope);

  if (existing) {
    return existing;
  }

  const config = getTheoreticalOpeningConfig({
    variant: VARIANT,
  });

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
    variant: VARIANT,
  });

  /* ========================================================================
     Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoint,

    buildRequestData(filterState) {
      return buildRequestData(config, filterState);
    },

    normalizeResponse: normalizeTheoreticalOpeningResponse,
  });

  /* ========================================================================
     Table
     ======================================================================== */

  const table = createTheoreticalOpeningTable({
    root: scope,
    config,
    variant: VARIANT,
  });

  /* ========================================================================
     Cards
     ======================================================================== */

  const cards = createTheoreticalOpeningCards({
    root: scope,
    config,
    variant: VARIANT,
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
          results: config.labels?.results || "Results",

          empty: config.labels?.noData || "No data available",

          error:
            config.labels?.loadError ||
            config.labels?.noData ||
            "Unable to load Nomu theoretical opening data.",
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

    getEmptyMessage() {
      return config.labels?.noData || "No data available";
    },

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        config.labels?.loadError ||
        config.labels?.noData ||
        "Unable to load Nomu theoretical opening data."
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
  });

  instances.set(scope, instance);

  return instance;
}

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  initNomuTheoreticalOpening(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
