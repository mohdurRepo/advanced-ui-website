/* ==========================================================================
   Market Watch
   ========================================================================== */

/*
 * Market Watch page composition.
 *
 * Responsibilities:
 *
 * - page initialization
 * - common Data View composition
 * - state
 * - data source
 * - results
 * - controller
 * - favorite/watchlist events
 * - logo fallback events
 * - public API
 * - startup
 *
 * Page-specific behavior is delegated to:
 *
 * - market-watch.config.js
 * - market-watch.columns.js
 * - market-watch.filters.js
 * - market-watch.formatters.js
 * - market-watch.normalizer.js
 * - views/market-watch.table.js
 * - views/market-watch.cards.js
 *
 * This module intentionally does not own:
 *
 * - column definitions
 * - filter definitions
 * - column-picker configuration
 * - request parameter mapping
 * - response normalization
 * - table-cell rendering
 * - mobile-card rendering
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import {
  applyWatchlistFilter,
  createDataCards,
  createDataColumnPicker,
  createDataColumnVisibility,
  createDataFilters,
  createDataResults,
  createDataSource,
  createDataState,
  createDataTable,
  createDataViewController,
  renderStandardDataCard,
} from "../../common/data-view/index.js";

/* ==========================================================================
   Market Watch Modules
   ========================================================================== */

import { getMarketWatchConfig } from "./market-watch.config.js";

import {
  getMarketWatchAvailableGroups,
  normalizeMarketWatchView,
} from "./market-watch.columns.js";

import {
  buildMarketWatchRequestData,
  createMarketWatchFilters,
} from "./market-watch.filters.js";

import { normalizeMarketWatchResponse } from "./market-watch.normalizer.js";

import { createMarketWatchTableView } from "./views/market-watch.table.js";

import { createMarketWatchCardsView } from "./views/market-watch.cards.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const SELECTORS = Object.freeze({
  resultCount: "[data-market-watch-result-count]",

  favorite: "[data-market-watch-favorite]",

  logo: "[data-market-watch-logo]",
});

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Favorite Action
   ========================================================================== */

function handleFavorite(event, scope) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest(SELECTORS.favorite);

  if (!button) {
    return;
  }

  if (scope instanceof Element && !scope.contains(button)) {
    return;
  }

  event.preventDefault();

  const companyRef = button.dataset.companyRef || "";

  /*
   * Preserve the existing website-level watchlist integration.
   */

  if (typeof window.showAddToWatchListPopup === "function") {
    window.showAddToWatchListPopup(companyRef);
  }

  /*
   * Preserve the existing page-level integration event.
   */

  button.dispatchEvent(
    new CustomEvent("marketwatch:favorite-request", {
      bubbles: true,

      detail: {
        companyRef,

        button,
      },
    }),
  );
}

/* ==========================================================================
   Logo Fallback
   ========================================================================== */

function handleLogoError(event, scope) {
  const image = event.target;

  if (!(image instanceof HTMLImageElement)) {
    return;
  }

  if (!image.matches(SELECTORS.logo)) {
    return;
  }

  if (scope instanceof Element && !scope.contains(image)) {
    return;
  }

  const fallbackUrl = image.dataset.marketWatchLogoFallback;

  /*
   * Try the configured fallback once.
   */

  if (fallbackUrl && !image.dataset.marketWatchLogoFallbackApplied) {
    image.dataset.marketWatchLogoFallbackApplied = "true";

    image.src = fallbackUrl;

    return;
  }

  /*
   * The original image and fallback both failed.
   */

  image
    .closest(".table-market__logo, .data-card__logo")
    ?.classList.add("is-image-missing");

  image.remove();
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initMarketWatch(root = document) {
  const scope = root;

  const existing = instances.get(scope);

  if (existing) {
    return existing;
  }

  /* ========================================================================
     Configuration
     ======================================================================== */

  const config = getMarketWatchConfig();

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
     Filters / Column Visibility / Column Picker
     ======================================================================== */

  const filterView = createMarketWatchFilters({
    root: scope,

    config,

    createDataFilters,

    createDataColumnVisibility,

    createDataColumnPicker,
  });

  const {
    filters,

    columnVisibility,

    initialView,
  } = filterView;

  /* ========================================================================
     Data Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoint,

    buildRequestData(filterState) {
      return buildMarketWatchRequestData(config, filterState);
    },

    normalizeResponse: normalizeMarketWatchResponse,
  });

  /* ========================================================================
     Table
     ======================================================================== */

  const table = createMarketWatchTableView({
    root: scope,

    config,

    createDataTable,

    initialView,

    visibleGroups: filterView.getVisibleGroups(),
  });

  /* ========================================================================
     Cards
     ======================================================================== */

  const cards = createMarketWatchCardsView({
    root: scope,

    config,

    createDataCards,

    renderStandardDataCard,

    initialView,

    getVisibleGroups() {
      /*
       * Resolve visibility at render time.
       *
       * Market Watch can change table view and column groups without
       * recreating the page coordinator.
       */

      return filterView.getVisibleGroups();
    },
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
          /*
           * The JSP already renders the surrounding "Results" label.
           *
           * Keep the data-results helper responsible only for the numeric
           * value when the supplied element is the numeric node itself.
           */

          results: "",

          empty: config.labels?.noData || "No data available",

          error: config.labels?.loadError || "Unable to load market data.",
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

    columnVisibility,

    table,

    cards,

    results,

    /* ----------------------------------------------------------------------
       View
       ---------------------------------------------------------------------- */

    getView({ filters: filterState }) {
      /*
       * Unlike Sukuk, Market Watch intentionally has multiple schemas:
       *
       * 1 -> Overview
       * 2 -> Price Data / Trading
       * 3 -> Performance
       */

      return normalizeMarketWatchView(filterState.tableView || initialView);
    },

    /* ----------------------------------------------------------------------
       Available Column Groups
       ---------------------------------------------------------------------- */

    getAvailableGroups(view) {
      /*
       * Each Market Watch view exposes its own set of optional groups.
       */

      return getMarketWatchAvailableGroups(config, view);
    },

    /* ----------------------------------------------------------------------
       DOM Column Picker Synchronization
       ---------------------------------------------------------------------- */

    onViewSync() {
      /*
       * createDataViewController owns view/visibility synchronization.
       *
       * The Market Watch filter module only needs to refresh its DOM adapter
       * after that synchronization is complete.
       */

      filterView.refreshColumnPicker();
    },

    /* ----------------------------------------------------------------------
       Client-Side Watchlist
       ---------------------------------------------------------------------- */

    rowProcessors: [
      (rows, context) =>
        applyWatchlistFilter(rows, Boolean(context.filters.watchlistOnly)),
    ],

    /* ----------------------------------------------------------------------
       Empty State
       ---------------------------------------------------------------------- */

    getEmptyMessage(context) {
      if (context.filters.watchlistOnly) {
        return (
          config.labels?.noWatchlistItems ||
          config.labels?.noData ||
          "No data available"
        );
      }

      return config.labels?.noData || "No data available";
    },

    /* ----------------------------------------------------------------------
       Error State
       ---------------------------------------------------------------------- */

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        config.labels?.loadError ||
        config.labels?.noData ||
        "Unable to load market data."
      );
    },

    autoLoad: true,
  });

  /* ========================================================================
     Page Events
     ======================================================================== */

  const abortController = new AbortController();

  const eventOptions = {
    signal: abortController.signal,
  };

  /* ------------------------------------------------------------------------
     Favorite
     ------------------------------------------------------------------------ */

  /*
   * Favorite buttons are rendered in both:
   *
   * - desktop company cells
   * - mobile card identities
   *
   * Keep one delegated handler.
   */

  scope.addEventListener(
    "click",

    (event) => {
      handleFavorite(event, scope);
    },

    eventOptions,
  );

  /* ------------------------------------------------------------------------
     Logo Error
     ------------------------------------------------------------------------ */

  /*
   * Image error events do not bubble.
   *
   * Capture them once at the page root rather than adding one listener for
   * every dynamically rendered company logo.
   */

  scope.addEventListener(
    "error",

    (event) => {
      handleLogoError(event, scope);
    },

    {
      ...eventOptions,

      capture: true,
    },
  );

  /* ------------------------------------------------------------------------
     Watchlist Updated
     ------------------------------------------------------------------------ */

  /*
   * Reload after the website-level watchlist integration reports a successful
   * add/remove operation so the server-returned favorite state remains
   * authoritative.
   */

  scope.addEventListener(
    "marketwatch:watchlist-updated",

    () => {
      controller.reload();
    },

    eventOptions,
  );

  /* ========================================================================
     Initialization
     ======================================================================== */

  controller.init();

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    destroy() {
      abortController.abort();

      /*
       * The Market Watch filter composition owns:
       *
       * - filters
       * - column visibility
       * - column picker
       */

      filterView.destroy();

      /*
       * The controller owns the composed Data View lifecycle:
       *
       * - source
       * - state
       * - table
       * - cards
       * - results
       */

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

    getColumnVisibility() {
      return columnVisibility;
    },
  });

  instances.set(scope, instance);

  return instance;
}

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  initMarketWatch(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
