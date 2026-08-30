/* ==========================================================================
   Sukuk & Bonds
   ========================================================================== */

/*
 * Sukuk & Bonds page composition.
 *
 * Responsibilities:
 *
 * - page initialization
 * - common Data View composition
 * - state
 * - column visibility
 * - column picker
 * - data source
 * - results
 * - controller
 * - favorite/watchlist events
 * - public API
 * - startup
 *
 * Page-specific presentation is delegated to:
 *
 * - sukuk.config.js
 * - sukuk.columns.js
 * - sukuk.filters.js
 * - sukuk.formatters.js
 * - sukuk.normalizer.js
 * - views/sukuk.table.js
 * - views/sukuk.cards.js
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import {
  createDataColumnPicker,
  createDataColumnVisibility,
  createDataResults,
  createDataSource,
  createDataState,
  createDataViewController,
} from "../../common/data-view/index.js";

/* ==========================================================================
   Sukuk Modules
   ========================================================================== */

import {
  getConfiguredVisibleGroups,
  getSukukConfig,
  SUKUK_VIEW,
} from "./sukuk.config.js";

import { getColumnGroups, getDefaultVisibleGroups } from "./sukuk.columns.js";

import { createSukukFilters } from "./sukuk.filters.js";

import { normalizeSukukResponse } from "./sukuk.normalizer.js";

import { createSukukTable } from "./views/sukuk.table.js";

import { createSukukCards } from "./views/sukuk.cards.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const SELECTORS = {
  columnsTrigger: "[data-sukuk-columns]",

  columnsMenu: "[data-sukuk-columns-menu]",

  columnsLabel: "[data-sukuk-columns-label]",

  columnInput: "[data-sukuk-column]",

  columnAction: "[data-sukuk-columns-action]",

  resultCount: "[data-sukuk-result-count]",

  favorite: "[data-sukuk-favorite]",
};

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Column Groups
   ========================================================================== */

function getAvailableGroups(config) {
  return getColumnGroups(config, SUKUK_VIEW).map((group) => group.id);
}

/* ==========================================================================
   Request
   ========================================================================== */

function buildRequestData(config, state) {
  return {
    /*
     * Preserve the existing
     * backend contract.
     */

    sectorParameter: state.bondType || "all",

    requestLocale: config.locale || "en",
  };
}

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

  const instrumentRef = button.dataset.instrumentRef || "";

  /*
   * Preserve the existing
   * website-level watchlist
   * integration.
   */

  if (typeof window.showAddToWatchListPopup === "function") {
    window.showAddToWatchListPopup(instrumentRef);
  }

  /*
   * Also expose the existing
   * page-level event.
   */

  button.dispatchEvent(
    new CustomEvent("sukuk:favorite-request", {
      bubbles: true,

      detail: {
        instrumentRef,

        button,
      },
    }),
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initSukuk(root = document) {
  const scope = root;

  const existing = instances.get(scope);

  if (existing) {
    return existing;
  }

  const config = getSukukConfig();

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

  const filters = createSukukFilters({
    root: scope,
  });

  /* ========================================================================
     Column Visibility
     ======================================================================== */

  const availableGroups = getAvailableGroups(config);

  const configuredGroups = getConfiguredVisibleGroups(config);

  const initialVisibleGroups = configuredGroups ?? getDefaultVisibleGroups();

  const columnVisibility = createDataColumnVisibility({
    initialView: SUKUK_VIEW,

    availableGroups,

    visibleGroups: initialVisibleGroups,
  });

  /* ========================================================================
     Column Picker
     ======================================================================== */

  const columnPicker = createDataColumnPicker({
    root: scope,

    visibility: columnVisibility,

    trigger: SELECTORS.columnsTrigger,

    menu: SELECTORS.columnsMenu,

    label: SELECTORS.columnsLabel,

    inputs: SELECTORS.columnInput,

    inputSelector: SELECTORS.columnInput,

    actionSelector: SELECTORS.columnAction,

    optionSelector: ".filter-bar__columns-option",

    getGroupId(input) {
      return input.dataset.sukukColumn || "";
    },

    getActionType(action) {
      return action.dataset.sukukColumnsAction || "";
    },

    labels: {
      all: config.labels?.showAll || "Show All",

      none: config.labels?.noColumns || "No Columns",

      selectedSuffix: config.labels?.selectedSuffix || "Selected",
    },
  });

  /* ========================================================================
     Data Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoint,

    buildRequestData(filterState) {
      return buildRequestData(config, filterState);
    },

    normalizeResponse: normalizeSukukResponse,
  });

  /* ========================================================================
     Table
     ======================================================================== */

  const table = createSukukTable({
    root: scope,

    config,

    view: SUKUK_VIEW,

    visibleGroups: columnVisibility.getVisibleGroups(),
  });

  /* ========================================================================
     Cards
     ======================================================================== */

  const cards = createSukukCards({
    root: scope,

    config,

    view: SUKUK_VIEW,

    visibleGroups: columnVisibility.getVisibleGroups(),
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

          error: config.labels?.loadError || "Unable to load Sukuk data.",
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

    getView() {
      return SUKUK_VIEW;
    },

    getAvailableGroups() {
      return getAvailableGroups(config);
    },

    /*
     * Keep the DOM picker
     * synchronized with common
     * column-visibility state.
     */

    onViewSync() {
      columnPicker.refresh();
    },

    getEmptyMessage() {
      return config.labels?.noData || "No data available";
    },

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        config.labels?.loadError ||
        config.labels?.noData ||
        "Unable to load Sukuk data."
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

  /*
   * Favorite controls exist
   * in both desktop and mobile
   * views, so keep one delegated
   * page-level handler.
   */

  scope.addEventListener(
    "click",

    (event) => {
      handleFavorite(event, scope);
    },

    eventOptions,
  );

  /*
   * Reload after an external
   * watchlist update so the
   * server-returned favorite state
   * remains authoritative.
   */

  scope.addEventListener(
    "sukuk:watchlist-updated",

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

      columnPicker.destroy();

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
  initSukuk(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
