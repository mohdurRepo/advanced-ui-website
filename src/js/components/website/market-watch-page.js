/* ==========================================================================
   Market Watch Page
   ========================================================================== */

import { createMarketWatchFilters } from "./market-watch-filters.js";
import { createMarketWatchMobile } from "./market-watch-mobile.js";
import { getColumnGroups } from "./market-watch-schema.js";
import { createMarketWatchService } from "./market-watch-service.js";
import { createMarketWatchTable } from "./market-watch-table.js";

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
     View Schema
     ======================================================================== */

  function syncViewSchema() {
    const filterState = filters.getState();

    const availableGroups = getAvailableGroups(config, filterState.tableView);

    /*
     * Each table view can expose a different set of column groups.
     *
     * The filter module owns the user's selection for each view and restores
     * it when that view becomes active again.
     */

    filters.setAvailableGroups(availableGroups);

    /*
     * Read the state again because setAvailableGroups() may normalize the
     * visible group selection for the newly selected table view.
     */

    const normalizedState = filters.getState();

    /*
     * Desktop and mobile share the same schema state but render it through
     * different presentation components.
     *
     * Responsive visibility itself belongs entirely to the design-system CSS.
     */

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

      /*
       * Ignore results belonging to:
       *
       * - a destroyed page
       * - an older request superseded by a newer request
       */

      if (destroyed || currentRequestId !== requestId) {
        return;
      }

      if (!response.rows.length) {
        showEmpty(config.labels?.noData || "No data available");

        return;
      }

      showRows(response.rows);
    } catch (error) {
      if (destroyed || currentRequestId !== requestId || isAbortError(error)) {
        return;
      }

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

    /*
     * Column visibility is presentation-only.
     *
     * It must not:
     *
     * - request new data
     * - reset the current rows
     * - change the selected table view
     */

    if (type === "columns") {
      const { visibleGroups } = filters.getState();

      table.setVisibleGroups(visibleGroups);
      mobile.setVisibleGroups(visibleGroups);

      return;
    }

    /*
     * A table-view change can change both the desktop column model and the
     * mobile detail schema.
     *
     * Synchronize the schema before requesting data for the selected view.
     */

    if (type === "table-view") {
      syncViewSchema();
      loadData();

      return;
    }

    /*
     * Industry and Watchlist filters affect the result set but not the
     * presentation schema.
     */

    if (type === "industry" || type === "watchlist") {
      loadData();
    }
  }

  /* ========================================================================
     Watchlist Events
     ======================================================================== */

  /*
   * Existing watchlist behavior may dispatch this event after an add/remove
   * operation completes.
   *
   * Reloading refreshes:
   *
   * - favorite state
   * - Watchlist-only results
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
     * Invalidate any currently resolving request before cancelling the
     * underlying transport.
     */

    requestId += 1;

    service.cancel();

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
   * Initial order:
   *
   * 1. configure the selected table-view schema
   * 2. request the current result set once
   *
   * Desktop/mobile presentation is controlled exclusively by the
   * design-system responsive CSS.
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
