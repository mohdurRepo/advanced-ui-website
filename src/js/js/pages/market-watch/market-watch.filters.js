/* ==========================================================================
   Market Watch Filters
   ========================================================================== */

/*
 * Filter and column-visibility coordination for Market Watch.
 *
 * Responsibilities:
 *
 * - define Market Watch filter selectors
 * - normalize Industry Group
 * - normalize Table View
 * - normalize Watchlist Only
 * - create the common data-view filter adapter
 * - create column visibility state
 * - create the visible-columns picker
 * - map filter state to backend request parameters
 *
 * This module intentionally has no:
 *
 * - request execution
 * - response normalization
 * - table rendering
 * - card rendering
 * - results rendering
 * - watchlist row filtering
 * - page-level event listeners
 * - page lifecycle
 */

import {
  MARKET_WATCH_VIEWS,
  getMarketWatchAvailableGroups,
  normalizeMarketWatchView,
} from "./market-watch.columns.js";

/* ==========================================================================
   Selectors
   ========================================================================== */

export const MARKET_WATCH_FILTER_SELECTORS = Object.freeze({
  industry: "[data-market-watch-industry]",

  tableView: "[data-market-watch-table-view]",

  watchlistOnly: "[data-market-watch-watchlist]",

  columnsTrigger: "[data-market-watch-columns]",

  columnsMenu: "[data-market-watch-columns-menu]",

  columnsLabel: "[data-market-watch-columns-label]",

  columnInput: "[data-market-watch-column]",

  columnAction: "[data-market-watch-columns-action]",

  columnOption: ".filter-bar__columns-option",
});

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_INDUSTRY = "all";

const DEFAULT_LOCALE = "en";

/* ==========================================================================
   General Helpers
   ========================================================================== */

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1") {
    return true;
  }

  const normalized = normalizeString(value).toLowerCase();

  return (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "on"
  );
}

/* ==========================================================================
   Filter Value Normalizers
   ========================================================================== */

export function normalizeMarketWatchIndustry(value) {
  return normalizeString(value) || DEFAULT_INDUSTRY;
}

export function normalizeMarketWatchTableView(value) {
  return normalizeMarketWatchView(value);
}

export function normalizeMarketWatchWatchlistOnly(value) {
  return normalizeBoolean(value);
}

/* ==========================================================================
   Filter Definitions
   ========================================================================== */

export function createMarketWatchFilterFields() {
  return {
    /*
     * Industry Group changes the backend data set.
     */

    industry: {
      selector: MARKET_WATCH_FILTER_SELECTORS.industry,

      effect: "reload",

      normalize: normalizeMarketWatchIndustry,
    },

    /*
     * Table View changes the column/view definition.
     *
     * The controller can update the table/cards using the existing source rows
     * according to the common data-view "view" behavior.
     */

    tableView: {
      selector: MARKET_WATCH_FILTER_SELECTORS.tableView,

      effect: "view",

      normalize: normalizeMarketWatchTableView,
    },

    /*
     * Watchlist Only intentionally does not change the service request.
     *
     * The full source data remains loaded so the user can turn the switch off
     * and immediately restore all rows without another network request.
     */

    watchlistOnly: {
      selector: MARKET_WATCH_FILTER_SELECTORS.watchlistOnly,

      effect: "client-filter",

      normalize: normalizeMarketWatchWatchlistOnly,
    },
  };
}

/* ==========================================================================
   Request Parameters
   ========================================================================== */

/*
 * Preserve the existing Market Watch service contract exactly.
 *
 * Watchlist filtering is deliberately client-side, therefore the backend
 * always receives:
 *
 *     iswatchListSelected: "NO"
 */

export function buildMarketWatchRequestData(config = {}, filterState = {}) {
  return {
    sectorParameter: normalizeMarketWatchIndustry(filterState.industry),

    tableViewParameter: normalizeMarketWatchTableView(filterState.tableView),

    iswatchListSelected: "NO",

    requestLocale: normalizeString(config.locale) || DEFAULT_LOCALE,
  };
}

/* ==========================================================================
   Filters
   ========================================================================== */

function createFilters({ root, createDataFilters }) {
  if (typeof createDataFilters !== "function") {
    throw new TypeError("Market Watch filters require createDataFilters.");
  }

  return createDataFilters({
    root,

    fields: createMarketWatchFilterFields(),
  });
}

/* ==========================================================================
   Initial View
   ========================================================================== */

function getInitialView(filters) {
  return normalizeMarketWatchTableView(filters.getValue("tableView"));
}

/* ==========================================================================
   Initial Visible Groups
   ========================================================================== */

function getInitialVisibleGroups(config, initialView, availableGroups) {
  const configuredGroups = config.initialState?.visibleGroups;

  if (!Array.isArray(configuredGroups)) {
    return [...availableGroups];
  }

  /*
   * Remove configured groups that are not available for the initial view.
   *
   * createDataColumnVisibility will continue to own view-specific visibility
   * state after initialization.
   */

  const available = new Set(availableGroups);

  const visibleGroups = configuredGroups.filter((groupId) =>
    available.has(groupId),
  );

  /*
   * An explicitly empty array is meaningful: the user/JSP may intentionally
   * start with all optional column groups hidden.
   */

  return visibleGroups;
}

/* ==========================================================================
   Column Visibility
   ========================================================================== */

function createColumnVisibility({
  config,
  initialView,
  createDataColumnVisibility,
}) {
  if (typeof createDataColumnVisibility !== "function") {
    throw new TypeError(
      "Market Watch filters require createDataColumnVisibility.",
    );
  }

  const availableGroups = getMarketWatchAvailableGroups(config, initialView);

  const visibleGroups = getInitialVisibleGroups(
    config,
    initialView,
    availableGroups,
  );

  return createDataColumnVisibility({
    initialView,

    availableGroups,

    visibleGroups,
  });
}

/* ==========================================================================
   Column Picker
   ========================================================================== */

function createColumnPicker({
  root,
  config,
  columnVisibility,
  createDataColumnPicker,
}) {
  if (typeof createDataColumnPicker !== "function") {
    throw new TypeError("Market Watch filters require createDataColumnPicker.");
  }

  return createDataColumnPicker({
    root,

    visibility: columnVisibility,

    trigger: MARKET_WATCH_FILTER_SELECTORS.columnsTrigger,

    menu: MARKET_WATCH_FILTER_SELECTORS.columnsMenu,

    label: MARKET_WATCH_FILTER_SELECTORS.columnsLabel,

    inputs: MARKET_WATCH_FILTER_SELECTORS.columnInput,

    inputSelector: MARKET_WATCH_FILTER_SELECTORS.columnInput,

    actionSelector: MARKET_WATCH_FILTER_SELECTORS.columnAction,

    optionSelector: MARKET_WATCH_FILTER_SELECTORS.columnOption,

    /*
     * Market Watch owns these data attributes.
     *
     * The shared column-picker helper should remain unaware of
     * Market Watch-specific markup.
     */

    getGroupId(input) {
      return input.dataset.marketWatchColumn || "";
    },

    getActionType(action) {
      return action.dataset.marketWatchColumnsAction || "";
    },

    labels: {
      all: config.labels?.showAll || "Show All",

      none: config.labels?.noColumns || "No Columns",

      selectedSuffix: config.labels?.selectedSuffix || "Selected",
    },
  });
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createMarketWatchFilters({
  root,
  config,

  createDataFilters,
  createDataColumnVisibility,
  createDataColumnPicker,
} = {}) {
  if (!root) {
    throw new TypeError("createMarketWatchFilters requires a root.");
  }

  if (!config) {
    throw new TypeError("createMarketWatchFilters requires config.");
  }

  const filters = createFilters({
    root,

    createDataFilters,
  });

  const initialView = getInitialView(filters);

  const columnVisibility = createColumnVisibility({
    config,

    initialView,

    createDataColumnVisibility,
  });

  const columnPicker = createColumnPicker({
    root,

    config,

    columnVisibility,

    createDataColumnPicker,
  });

  return {
    filters,

    columnVisibility,

    columnPicker,

    initialView,

    /*
     * These helpers give the final page coordinator a small, explicit API
     * instead of making it understand filter/column-picker implementation
     * details.
     */

    getVisibleGroups() {
      return columnVisibility.getVisibleGroups();
    },

    refreshColumnPicker() {
      columnPicker.refresh?.();
    },

    destroy() {
      columnPicker.destroy?.();

      columnVisibility.destroy?.();

      filters.destroy?.();
    },
  };
}
