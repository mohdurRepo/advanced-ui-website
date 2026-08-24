/* ==========================================================================
   Market Watch Page
   ========================================================================== */

import { createMarketWatchFilters } from "./market-watch-filters.js";
import { createMarketWatchMobile } from "./market-watch-mobile.js";
import { getColumnGroups } from "./market-watch-schema.js";
import { createMarketWatchService } from "./market-watch-service.js";
import { createMarketWatchTable } from "./market-watch-table.js";
import { isWatchlisted } from "./market-watch-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const SELECTORS = {
  filterForm: "[data-market-watch-filters]",
};

const instances = new WeakMap();

/* ==========================================================================
   Helpers
   ========================================================================== */

function getConfig() {
  if (!window.MarketWatchConfig) {
    throw new Error("MarketWatchConfig is required.");
  }

  return window.MarketWatchConfig;
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function getAvailableGroups(config, tableView) {
  return getColumnGroups(config, tableView).map((group) => group.id);
}

function getErrorMessage(config, error) {
  if (error?.response?.message) {
    return error.response.message;
  }

  return (
    config.labels?.loadError ||
    config.labels?.noData ||
    "Unable to load market data."
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initMarketWatchPage(root = document) {
  const existing = instances.get(root);

  if (existing) {
    return existing;
  }

  const config = getConfig();

  const filterForm = root.querySelector(SELECTORS.filterForm);

  const filters = createMarketWatchFilters(config, root);
  const service = createMarketWatchService(config);
  const table = createMarketWatchTable(config, root);
  const mobile = createMarketWatchMobile(config, root);

  const abortController = new AbortController();

  let destroyed = false;
  let requestId = 0;
  let unsubscribeFilters = null;

  /*
   * Always keep the complete result set returned by the API.
   *
   * Watchlist Only filters this array for presentation.
   * It must never replace or destroy the original result set.
   */
  let sourceRows = [];

  /* ========================================================================
     Busy State
     ======================================================================== */

  function setFilterBusy(isBusy) {
    filterForm?.setAttribute("aria-busy", String(isBusy));
  }

  function showLoading() {
    table.showLoading();
    mobile.showLoading();

    setFilterBusy(true);
  }

  function showRows(rows) {
    table.setRows(rows);
    mobile.setRows(rows);
  }

  function showEmpty(message) {
    table.showEmpty(message);
    mobile.showEmpty(message);
  }

  function showError(message) {
    table.showError(message);
    mobile.showError(message);
  }

  /* ========================================================================
     Result Filtering
     ======================================================================== */

  function getVisibleRows() {
    const { watchlistOnly } = filters.getState();

    /*
     * Normal mode:
     * show every row returned by the current API request.
     */

    if (!watchlistOnly) {
      return sourceRows;
    }

    /*
     * Watchlist Only:
     *
     * Accept every value recognized by the shared formatter:
     *
     * - true
     * - 1
     * - "1"
     * - "true"
     * - "YES"
     * - "yes"
     * - "Y"
     */
    return sourceRows.filter((row) => {
      return isWatchlisted(row.watchlist);
    });
  }

  function renderCurrentRows() {
    const rows = getVisibleRows();

    if (!rows.length) {
      const { watchlistOnly } = filters.getState();

      /*
       * If Watchlist Only is enabled and the user has no watched rows,
       * show an empty state but keep sourceRows untouched.
       *
       * Turning the switch off immediately restores the complete result set.
       */
      const message = watchlistOnly
        ? config.labels?.noWatchlistItems ||
          config.labels?.noData ||
          "No data available"
        : config.labels?.noData || "No data available";

      showEmpty(message);

      return;
    }

    showRows(rows);
  }

  /* ========================================================================
     View Schema
     ======================================================================== */

  function syncViewSchema() {
    const filterState = filters.getState();

    const availableGroups = getAvailableGroups(config, filterState.tableView);

    /*
     * Each view can expose a different set of column groups.
     */

    filters.setAvailableGroups(availableGroups);

    /*
     * Read the state again because setAvailableGroups() may normalize the
     * visible group selection for the selected view.
     */

    const normalizedState = filters.getState();

    table.setView(normalizedState.tableView);
    table.setVisibleGroups(normalizedState.visibleGroups);

    mobile.setView(normalizedState.tableView);
    mobile.setVisibleGroups(normalizedState.visibleGroups);
  }

  /* ========================================================================
     Data Loading
     ======================================================================== */

  async function loadData() {
    const currentRequestId = ++requestId;

    const filterState = filters.getState();

    showLoading();

    try {
      const response = await service.load(filterState);

      if (destroyed || currentRequestId !== requestId) {
        return;
      }

      /*
       * Store the complete server result.
       *
       * Do not apply Watchlist Only here by replacing response.rows.
       */

      sourceRows = response.rows;

      if (!sourceRows.length) {
        showEmpty(config.labels?.noData || "No data available");

        return;
      }

      /*
       * Apply the current presentation filter.
       *
       * If Watchlist Only is already enabled, only watched rows are rendered.
       */

      renderCurrentRows();
    } catch (error) {
      if (destroyed || currentRequestId !== requestId || isAbortError(error)) {
        return;
      }

      /*
       * A failed request invalidates the current server result.
       */

      sourceRows = [];

      showError(getErrorMessage(config, error));
    } finally {
      if (!destroyed && currentRequestId === requestId) {
        setFilterBusy(false);
      }
    }
  }

  /* ========================================================================
     Filter Events
     ======================================================================== */

  function handleFilterChange({ type }) {
    if (destroyed) {
      return;
    }

    /* ----------------------------------------------------------------------
       Show / Hide Columns
       ---------------------------------------------------------------------- */

    if (type === "columns") {
      const { visibleGroups } = filters.getState();

      /*
       * Presentation-only.
       *
       * Do not reload API data.
       */

      table.setVisibleGroups(visibleGroups);
      mobile.setVisibleGroups(visibleGroups);

      return;
    }

    /* ----------------------------------------------------------------------
       Watchlist Only
       ---------------------------------------------------------------------- */

    if (type === "watchlist") {
      /*
       * Authentication is already handled by market-watch-filters.js.
       *
       * If the user is not authenticated:
       *
       * - the filter resets the switch to OFF
       * - the existing login/watchlist popup opens
       * - this event is not emitted
       *
       * If this event reaches the page coordinator, the user is allowed to
       * change Watchlist Only.
       *
       * No API request is required. Filter the currently loaded result set.
       */

      renderCurrentRows();

      return;
    }

    /* ----------------------------------------------------------------------
       Table View
       ---------------------------------------------------------------------- */

    if (type === "table-view") {
      syncViewSchema();

      /*
       * Different table views request a different server dataset.
       */

      loadData();

      return;
    }

    /* ----------------------------------------------------------------------
       Industry
       ---------------------------------------------------------------------- */

    if (type === "industry") {
      /*
       * Industry changes the server result set.
       */

      loadData();
    }
  }

  /* ========================================================================
     Watchlist Updates
     ======================================================================== */

  /*
   * Existing favorite actions may dispatch this after an add/remove completes.
   *
   * We reload because the server is the authoritative source for the updated
   * watchlist state of each security.
   *
   * If Watchlist Only is currently enabled, renderCurrentRows() inside
   * loadData() automatically applies the filter to the refreshed response.
   */

  function handleWatchlistUpdated() {
    if (destroyed) {
      return;
    }

    loadData();
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    /*
     * Invalidate any result that might still resolve.
     */

    requestId += 1;

    sourceRows = [];

    service.destroy?.();
    service.cancel?.();

    unsubscribeFilters?.();
    unsubscribeFilters = null;

    abortController.abort();

    filters.destroy();
    table.destroy();
    mobile.destroy();

    instances.delete(root);
  }

  /* ========================================================================
     Event Registration
     ======================================================================== */

  unsubscribeFilters = filters.subscribe(handleFilterChange);

  root.addEventListener(
    "marketwatch:watchlist-updated",
    handleWatchlistUpdated,
    {
      signal: abortController.signal,
    },
  );

  /* ========================================================================
     Initial State
     ======================================================================== */

  /*
   * 1. configure selected view schema
   * 2. request complete result set
   * 3. render all rows or watchlist-only rows according to current filter
   */

  syncViewSchema();
  loadData();

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    destroy,

    reload() {
      return loadData();
    },

    getFilters() {
      return filters.getState();
    },

    getRows() {
      return [...sourceRows];
    },
  });

  instances.set(root, instance);

  return instance;
}

/* ==========================================================================
   Page Startup
   ========================================================================== */

function start() {
  initMarketWatchPage(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
