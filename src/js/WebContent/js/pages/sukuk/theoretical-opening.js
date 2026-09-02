/* ==========================================================================
   Theoretical Opening
   ========================================================================== */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  createDataColumnPicker,
  createDataColumnVisibility,
  createDataResults,
  createDataSource,
  createDataState,
  createDataViewController,
} from "../../common/data-view/index.js";

import { getTheoreticalOpeningConfig } from "./theoretical-opening.config.js";

import { createTheoreticalOpeningFilters } from "./theoretical-opening.filters.js";

import { normalizeTheoreticalOpeningResponse } from "./theoretical-opening.normalizer.js";

import {
  getColumnGroups,
  getDefaultVisibleGroups,
} from "./theoretical-opening.columns.js";

import { createTheoreticalOpeningTable } from "./views/theoretical-opening.table.js";

import { createTheoreticalOpeningCards } from "./views/theoretical-opening.cards.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const THEORETICAL_OPENING_VIEW = "1";

const SELECTORS = Object.freeze({
  columnsTrigger: "[data-theoretical-opening-columns]",

  columnsMenu: "[data-theoretical-opening-columns-menu]",

  columnsLabel: "[data-theoretical-opening-columns-label]",

  columnInput: "[data-theoretical-opening-column]",

  columnAction: "[data-theoretical-opening-columns-action]",

  resultCount: "[data-theoretical-opening-result-count]",
});

const instances = new WeakMap();

/* ==========================================================================
   Column Groups
   ========================================================================== */

function getAvailableGroups(config) {
  return getColumnGroups(config, THEORETICAL_OPENING_VIEW).map(
    (group) => group.id,
  );
}

/* ==========================================================================
   Request
   ========================================================================== */

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
   Page Initialization
   ========================================================================== */

export function initTheoreticalOpeningPage({
  root = document,
  configName = "TheoreticalOpeningConfig",
} = {}) {
  const scope = root;

  const existing = instances.get(scope);

  if (existing) {
    return existing;
  }

  /* ========================================================================
     Config
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

  /* ========================================================================
     Column Visibility
     ======================================================================== */

  const availableGroups = getAvailableGroups(config);

  const configuredGroups = config.initialState?.visibleGroups;

  const initialVisibleGroups = Array.isArray(configuredGroups)
    ? configuredGroups
    : getDefaultVisibleGroups();

  const columnVisibility = createDataColumnVisibility({
    initialView: THEORETICAL_OPENING_VIEW,

    availableGroups,

    visibleGroups: initialVisibleGroups,
  });

  /* ========================================================================
     Column Picker
     ======================================================================== */

  const hasColumnPicker = Boolean(
    scope.querySelector(SELECTORS.columnsTrigger),
  );

  const columnPicker = hasColumnPicker
    ? createDataColumnPicker({
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
          return input.dataset.theoreticalOpeningColumn || "";
        },

        getActionType(action) {
          return action.dataset.theoreticalOpeningColumnsAction || "";
        },

        labels: {
          all: config.labels?.showAll || "Show All",

          none: config.labels?.noColumns || "No Columns",

          selectedSuffix: config.labels?.selectedSuffix || "Selected",
        },
      })
    : null;

  /* ========================================================================
     Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoint,

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
     Table
     ======================================================================== */

  const table = createTheoreticalOpeningTable({
    root: scope,

    config,

    view: THEORETICAL_OPENING_VIEW,

    visibleGroups: columnVisibility.getVisibleGroups(),
  });

  /* ========================================================================
     Cards
     ======================================================================== */

  const cards = createTheoreticalOpeningCards({
    root: scope,

    config,

    view: THEORETICAL_OPENING_VIEW,

    getVisibleGroups() {
      return columnVisibility.getVisibleGroups();
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

    columnVisibility,

    table,

    cards,

    results,

    getView() {
      return THEORETICAL_OPENING_VIEW;
    },

    getAvailableGroups() {
      return getAvailableGroups(config);
    },

    onViewSync() {
      columnPicker?.refresh();
    },

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
     Init
     ======================================================================== */

  controller.init();

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    destroy() {
      columnPicker?.destroy();

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
   Normal Page Startup
   ========================================================================== */

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
