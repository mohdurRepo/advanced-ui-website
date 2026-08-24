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
  desktopView: ".data-view__table",
  mobileView: "[data-market-watch-mobile]",
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
  if (instances.has(root)) {
    return instances.get(root);
  }

  const config = getConfig();
  const abortController = new AbortController();

  const desktopView = root.querySelector(SELECTORS.desktopView);
  const mobileView = root.querySelector(SELECTORS.mobileView);
  const filterForm = root.querySelector(SELECTORS.filterForm);

  const filters = createMarketWatchFilters(config, root);
  const service = createMarketWatchService(config);
  const table = createMarketWatchTable(config, root);
  const mobile = createMarketWatchMobile(config, root);

  const mediaQuery = window.matchMedia(
    `(max-width: ${config.breakpoints?.mobileMaxWidth || 767.98}px)`,
  );

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
     Responsive Presentation
     ======================================================================== */

  function syncResponsiveView() {
    const isMobile = mediaQuery.matches;

    if (desktopView) {
      desktopView.hidden = isMobile;
    }

    if (mobileView) {
      mobileView.hidden = !isMobile;
    }

    mobile.setActive(isMobile);

    /*
     * A DataTable that becomes visible after a mobile layout needs one
     * controlled recalculation. This does not rebuild the table or request
     * data again.
     */

    if (!isMobile) {
      table.setVisibleGroups(filters.getState().visibleGroups);
    }
  }

  /* ========================================================================
     View Schema
     ======================================================================== */

  function syncViewSchema() {
    const filterState = filters.getState();
    const availableGroups = getAvailableGroups(config, filterState.tableView);

    /*
     * Filters restore the stored choice for a previously visited view.
     * A newly visited view receives all groups available to that view.
     */

    filters.setAvailableGroups(availableGroups);

    const normalizedState = filters.getState();

    /*
     * Table view changes have different column models, so desktop recreates
     * its DataTable once. Mobile changes its schema without DataTables.
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
     Events
     ======================================================================== */

  function handleFilterChange({ type }) {
    if (destroyed) {
      return;
    }

    if (type === "columns") {
      const { visibleGroups } = filters.getState();

      /*
       * Show/Hide Columns is presentation-only. It must not issue a new API
       * request or reset the current result set.
       */

      table.setVisibleGroups(visibleGroups);
      mobile.setVisibleGroups(visibleGroups);

      return;
    }

    if (type === "table-view") {
      syncViewSchema();
      loadData();

      return;
    }

    if (type === "industry" || type === "watchlist") {
      loadData();
    }
  }

  function handleMediaChange() {
    if (!destroyed) {
      syncResponsiveView();
    }
  }

  /*
   * Existing watchlist code may dispatch this after add/remove actions finish.
   * Reloading then updates star states and an active Watchlist-only result.
   */

  function handleWatchlistUpdated() {
    if (!destroyed) {
      loadData();
    }
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;
    requestId += 1;

    service.cancel();
    unsubscribeFilters?.();

    abortController.abort();

    filters.destroy();
    table.destroy();
    mobile.destroy();

    instances.delete(root);
  }

  unsubscribeFilters = filters.subscribe(handleFilterChange);

  mediaQuery.addEventListener("change", handleMediaChange, {
    signal: abortController.signal,
  });

  root.addEventListener(
    "marketwatch:watchlist-updated",
    handleWatchlistUpdated,
    {
      signal: abortController.signal,
    },
  );

  /*
   * Initial order:
   *
   * 1. configure the selected table-view schema
   * 2. reveal only the active desktop or mobile presentation
   * 3. request data once
   */

  syncViewSchema();
  syncResponsiveView();
  loadData();

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
