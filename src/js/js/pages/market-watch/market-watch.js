/* ==========================================================================
   Market Watch
   ========================================================================== */

/*
 * Market Watch page coordinator.
 *
 * Responsibilities:
 *
 * - initialize the page
 * - compose common Data View modules
 * - create shared state
 * - create data source
 * - connect filters / column visibility
 * - connect table / mobile cards
 * - connect result count
 * - coordinate Market Watch views
 * - handle favorite and logo events
 * - expose lifecycle/public API
 *
 * Page-specific logic belongs in:
 *
 * - market-watch.config.js
 * - market-watch.columns.js
 * - market-watch.filters.js
 * - market-watch.formatters.js
 * - market-watch.normalizer.js
 * - views/market-watch.table.js
 * - views/market-watch.cards.js
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
   Selectors
   ========================================================================== */

const SELECTORS = Object.freeze({
  mobileCards: "[data-market-watch-mobile-cards]",

  resultCount: "[data-market-watch-result-count]",

  favorite: "[data-market-watch-favorite]",

  logo: "[data-market-watch-logo]",
});

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Favorite
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
   * Existing website-level watchlist integration.
   */

  if (typeof window.showAddToWatchListPopup === "function") {
    window.showAddToWatchListPopup(companyRef);
  }

  /*
   * Also expose a page-level event for integrations that use events.
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
   * Try the configured fallback only once.
   */

  if (fallbackUrl && !image.dataset.marketWatchLogoFallbackApplied) {
    image.dataset.marketWatchLogoFallbackApplied = "true";

    image.src = fallbackUrl;

    return;
  }

  /*
   * Original image and fallback both failed.
   */

  image
    .closest(".table-market__logo, .data-card__logo")
    ?.classList.add("is-image-missing");

  image.remove();
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function initMarketWatch(root = document) {
  const scope = root;

  /* ========================================================================
     Existing Instance
     ======================================================================== */

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
     Filters / Visibility / Column Picker
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

    columnPicker,

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
     Mobile Cards
     ======================================================================== */

  const cards = createMarketWatchCardsView({
    root: scope,

    config,

    createDataCards,

    renderStandardDataCard,

    /*
     * IMPORTANT:
     *
     * This matches the existing JSP:
     *
     *   data-market-watch-mobile-cards
     *
     * Do not use [data-market-watch-cards] here.
     */

    container: SELECTORS.mobileCards,

    initialView,

    getVisibleGroups() {
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
           * JSP already renders the "Results" text beside this numeric node.
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
       Current Market Watch View
       ---------------------------------------------------------------------- */

    getView({ filters: filterState }) {
      /*
       * Market Watch intentionally supports multiple views:
       *
       * 1 -> Overview
       * 2 -> Price Data / Trading
       * 3 -> Performance
       */

      return normalizeMarketWatchView(filterState.tableView || initialView);
    },

    /* ----------------------------------------------------------------------
       View-Specific Column Groups
       ---------------------------------------------------------------------- */

    getAvailableGroups(view) {
      return getMarketWatchAvailableGroups(config, view);
    },

    /* ----------------------------------------------------------------------
       Column Picker Synchronization
       ---------------------------------------------------------------------- */

    onViewSync() {
      /*
       * The controller updates column visibility first.
       *
       * Refresh the DOM picker afterwards so unavailable/visible groups match
       * the newly selected Market Watch view.
       */

      filterView.refreshColumnPicker();
    },

    /* ----------------------------------------------------------------------
       Client-Side Watchlist Filter
       ---------------------------------------------------------------------- */

    rowProcessors: [
      (rows, context) =>
        applyWatchlistFilter(rows, Boolean(context.filters.watchlistOnly)),
    ],

    /* ----------------------------------------------------------------------
       Empty Message
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
       Error Message
       ---------------------------------------------------------------------- */

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        error?.message ||
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
   * Favorite buttons are dynamically rendered in:
   *
   * - desktop table
   * - mobile cards
   *
   * One delegated handler is enough.
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
   * Image error events do not bubble, therefore capture is required.
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
   * Existing integration can dispatch this after a successful watchlist
   * update.
   *
   * Reload so favorite/watchlist state comes back from the authoritative
   * source.
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
      /*
       * Remove page-level delegated listeners.
       */

      abortController.abort();

      /*
       * Column picker is owned by the Market Watch filter composition but is
       * not owned by createDataViewController.
       *
       * The controller itself destroys:
       *
       * - source
       * - filters
       * - column visibility
       * - table
       * - cards
       * - results
       * - shared state
       */

      columnPicker.destroy?.();

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

    getView() {
      return normalizeMarketWatchView(
        filters.getValue("tableView") || initialView,
      );
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
