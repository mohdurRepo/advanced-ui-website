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

  const desktopView = root.querySelector(SELECTORS.desktopView);
  const mobileView = root.querySelector(SELECTORS.mobileView);

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

  function setFilterBusy(isBusy) {
    const form = root.querySelector("[data-market-watch-filters]");

    if (form) {
      form.setAttribute("aria-busy", String(isBusy));
    }
  }

  function syncResponsiveView() {
    const isMobile = mediaQuery.matches;

    if (desktopView) {
      desktopView.hidden = isMobile;
    }

    mobile.setActive(isMobile);

    /*
     * A table shown after being hidden needs one controlled recalculation.
     * Re-applying the current visible groups performs that without rebuilding.
     */

    if (!isMobile) {
      table.setVisibleGroups(filters.getState().visibleGroups);
    }
  }

  function syncViewSchema() {
    const filterState = filters.getState();
    const availableGroups = getAvailableGroups(config, filterState.tableView);

    filters.setAvailableGroups(availableGroups);

    const normalizedState = filters.getState();

    table.setView(normalizedState.tableView);
    table.setVisibleGroups(normalizedState.visibleGroups);

    mobile.setView(normalizedState.tableView);
    mobile.setVisibleGroups(normalizedState.visibleGroups);
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

  function handleFilterChange({ type }) {
    if (destroyed) {
      return;
    }

    if (type === "columns") {
      const { visibleGroups } = filters.getState();

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
    if (destroyed) {
      return;
    }

    syncResponsiveView();
  }

  function handleWatchlistUpdated() {
    /*
     * Optional integration point:
     * existing watchlist code can dispatch `marketwatch:watchlist-updated`
     * after a user adds/removes a company in its dialog.
     */

    if (!destroyed) {
      loadData();
    }
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    requestId += 1;

    service.cancel();
    unsubscribeFilters?.();

    mediaQuery.removeEventListener("change", handleMediaChange);

    root.removeEventListener(
      "marketwatch:watchlist-updated",
      handleWatchlistUpdated,
    );

    filters.destroy();
    table.destroy();
    mobile.destroy();

    instances.delete(root);
  }

  unsubscribeFilters = filters.subscribe(handleFilterChange);

  mediaQuery.addEventListener("change", handleMediaChange);

  root.addEventListener(
    "marketwatch:watchlist-updated",
    handleWatchlistUpdated,
  );

  syncViewSchema();
  syncResponsiveView();
  loadData();

  const instance = Object.freeze({
    destroy,
    reload: loadData,

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
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
