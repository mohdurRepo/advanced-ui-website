/* ==========================================================================
   Market Watch
   ========================================================================== */

/*
 * Standalone Market Watch page composition.
 *
 * Responsibilities:
 *
 * - read validated Market Watch configuration
 * - compose common Data View primitives
 * - create Market Watch filters and column visibility
 * - create the Market Watch data source
 * - create desktop table and mobile cards
 * - create result-count presentation
 * - create the Data View controller
 * - connect page-level favorite integration
 * - connect logo fallback behavior
 * - expose lifecycle / public page API
 *
 * Business-specific formatting, column definitions, filters, normalization,
 * table rendering, and card rendering live in their dedicated modules.
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
   Market Watch
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
  table: "[data-market-watch-table]",

  cards: "[data-market-watch-mobile-cards]",

  resultCount: "[data-market-watch-result-count]",

  favorite: "[data-market-watch-favorite]",

  logo: "[data-market-watch-logo]",
});

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Favorite Integration
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
   *
   * Authentication / watchlist mutation itself remains outside Market Watch.
   */

  if (typeof window.showAddToWatchListPopup === "function") {
    window.showAddToWatchListPopup(companyRef);
  }

  /*
   * Also expose an application event for integrations that do not depend on
   * the legacy global function.
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

  if (!(image instanceof HTMLImageElement) || !image.matches(SELECTORS.logo)) {
    return;
  }

  if (scope instanceof Element && !scope.contains(image)) {
    return;
  }

  const fallbackUrl = image.dataset.marketWatchLogoFallback;

  /*
   * Attempt the configured fallback only once.
   */

  if (fallbackUrl && !image.dataset.marketWatchLogoFallbackApplied) {
    image.dataset.marketWatchLogoFallbackApplied = "true";

    image.src = fallbackUrl;

    return;
  }

  /*
   * Either there was no configured fallback or the fallback itself failed.
   */

  image
    .closest(".table-market__logo, .data-card__logo")
    ?.classList.add("is-image-missing");

  image.remove();
}

/* ==========================================================================
   State
   ========================================================================== */

function createMarketWatchState() {
  return createDataState({
    loading: false,

    sourceRows: [],

    visibleRows: [],

    meta: {},

    error: null,
  });
}

/* ==========================================================================
   Data Source
   ========================================================================== */

function createMarketWatchSource({ config }) {
  return createDataSource({
    endpoint: config.endpoint,

    buildRequestData(filterState) {
      return buildMarketWatchRequestData(config, filterState);
    },

    normalizeResponse: normalizeMarketWatchResponse,
  });
}

/* ==========================================================================
   Results
   ========================================================================== */

function createMarketWatchResults({ root, config }) {
  const countElement = root.querySelector(SELECTORS.resultCount);

  if (!countElement) {
    return null;
  }

  return createDataResults({
    root,

    count: countElement,

    labels: {
      results: config.labels?.results || "Results",

      loading: config.labels?.loading || "Loading...",

      empty: config.labels?.noData || "No data available",

      error: config.labels?.loadError || "Unable to load market data.",
    },
  });
}

/* ==========================================================================
   Empty State
   ========================================================================== */

function getMarketWatchEmptyMessage(config, context) {
  if (context.filters?.watchlistOnly) {
    return (
      config.labels?.noWatchlistItems ||
      config.labels?.noData ||
      "No data available"
    );
  }

  return config.labels?.noData || "No data available";
}

/* ==========================================================================
   Error State
   ========================================================================== */

function getMarketWatchErrorMessage(config, error) {
  return (
    error?.response?.message ||
    config.labels?.loadError ||
    config.labels?.noData ||
    "Unable to load market data."
  );
}

/* ==========================================================================
   Page Events
   ========================================================================== */

function bindPageEvents({ scope, controller }) {
  const abortController = new AbortController();

  const eventOptions = {
    signal: abortController.signal,
  };

  /*
   * Favorite buttons are rendered dynamically in both table rows and cards,
   * so use delegated handling at page scope.
   */

  scope.addEventListener(
    "click",
    (event) => {
      handleFavorite(event, scope);
    },
    eventOptions,
  );

  /*
   * Native image error events do not bubble.
   *
   * Capture is therefore required for dynamically rendered company logos.
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

  /*
   * Existing site watchlist integration may dispatch this event after an
   * add/remove operation.
   *
   * Reload so source rows receive the latest watchlist state from the service.
   */

  scope.addEventListener(
    "marketwatch:watchlist-updated",
    () => {
      controller.reload();
    },
    eventOptions,
  );

  return abortController;
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

  const state = createMarketWatchState();

  /* ========================================================================
     Filters / Columns
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

  const source = createMarketWatchSource({
    config,
  });

  /* ========================================================================
     Desktop Table
     ======================================================================== */

  const table = createMarketWatchTableView({
    root: scope,

    config,

    createDataTable,

    table: SELECTORS.table,

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

    container: SELECTORS.cards,

    initialView,

    getVisibleGroups() {
      return filterView.getVisibleGroups();
    },
  });

  /* ========================================================================
     Results
     ======================================================================== */

  const results = createMarketWatchResults({
    root: scope,

    config,
  });

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

    /* --------------------------------------------------------------------
         View
         -------------------------------------------------------------------- */

    getView({ filters: filterState }) {
      return normalizeMarketWatchView(filterState.tableView);
    },

    getAvailableGroups(view) {
      return getMarketWatchAvailableGroups(config, view);
    },

    /*
     * The controller synchronizes view-specific column visibility before
     * rendering the new table/card view.
     *
     * Refresh the DOM picker only after that synchronization is complete.
     */

    onViewSync() {
      filterView.refreshColumnPicker();
    },

    /* --------------------------------------------------------------------
         Row Processing
         -------------------------------------------------------------------- */

    rowProcessors: [
      (rows, context) =>
        applyWatchlistFilter(
          rows,

          Boolean(context.filters.watchlistOnly),
        ),
    ],

    /* --------------------------------------------------------------------
         Empty
         -------------------------------------------------------------------- */

    getEmptyMessage(context) {
      return getMarketWatchEmptyMessage(config, context);
    },

    /* --------------------------------------------------------------------
         Error
         -------------------------------------------------------------------- */

    getErrorMessage(error) {
      return getMarketWatchErrorMessage(config, error);
    },

    autoLoad: true,
  });

  /* ========================================================================
     Page Events
     ======================================================================== */

  const pageEvents = bindPageEvents({
    scope,

    controller,
  });

  /* ========================================================================
     Initialization
     ======================================================================== */

  controller.init();

  /* ========================================================================
     Public Instance
     ======================================================================== */

  let destroyed = false;

  const instance = Object.freeze({
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      /*
       * Page-owned listeners.
       */

      pageEvents.abort();

      /*
       * The column picker is page-owned. Filters, column visibility, table,
       * cards, results, source/state subscriptions, and request cancellation
       * are owned by the Data View controller lifecycle.
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
  });

  instances.set(scope, instance);

  return instance;
}

/* ==========================================================================
   Startup
   ========================================================================== */

function startMarketWatch() {
  initMarketWatch(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMarketWatch, {
    once: true,
  });
} else {
  startMarketWatch();
}
