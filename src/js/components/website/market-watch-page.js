/* ==========================================================================
   Market Watch Page
   ========================================================================== */

import { createMarketWatchSchema } from "./market-watch-schema.js";
import { createMarketWatchFormatters } from "./market-watch-formatters.js";
import { createMarketWatchService } from "./market-watch-service.js";
import { createMarketWatchFilters } from "./market-watch-filters.js";
import { createMarketWatchTable } from "./market-watch-table.js";
import { createMarketWatchMobile } from "./market-watch-mobile.js";

/*
 * This is the only Market Watch entry module.
 *
 * It coordinates:
 * - filters
 * - API requests
 * - desktop DataTable
 * - mobile cards
 *
 * It contains no legacy refresh timer, no resize rebuild, and no DataTableCore.
 */

function getElement(root, selector, required = true) {
  const element = root.querySelector(selector);

  if (required && !element) {
    throw new Error(`Market Watch element not found: ${selector}`);
  }

  return element;
}

function getJQuery() {
  const $ = window.jQuery;

  if (!$) {
    throw new Error("Market Watch requires jQuery.");
  }

  return $;
}

function formatResultSummary(count) {
  return `${count} ${count === 1 ? "security" : "securities"}`;
}

function formatUpdatedAt(value, locale) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/* ==========================================================================
   Public Page Initializer
   ========================================================================== */

export function initMarketWatchPage(
  root = document,
  pageConfig = window.MarketWatchConfig,
) {
  if (!pageConfig) {
    throw new Error("MarketWatchConfig is required.");
  }

  const $ = getJQuery();

  const elements = {
    desktopView: getElement(root, "[data-market-watch-desktop-view]"),
    mobileView: getElement(root, "[data-market-watch-mobile-view]"),
    summary: getElement(root, "[data-market-watch-summary]", false),
    updated: getElement(root, "[data-market-watch-updated]", false),
    status: getElement(root, "[data-market-watch-status]", false),
    table: getElement(root, "[data-market-watch-table]"),
  };

  const labels = {
    loading: "Loading market data…",
    loadError: "Market data could not be loaded. Please try again.",
    noData: "No data available.",
    ...pageConfig.labels,
  };

  const schema = createMarketWatchSchema(pageConfig);
  const formatters = createMarketWatchFormatters(pageConfig);
  const service = createMarketWatchService(pageConfig);

  const initialState = {
    industry: pageConfig.initialState?.industry || "all",
    tableView: String(
      pageConfig.initialState?.tableView || schema.defaultViewId,
    ),
    watchlistOnly: Boolean(pageConfig.initialState?.watchlistOnly),
    visibleGroups: pageConfig.initialState?.visibleGroups || [],
  };

  const visibleGroupsByView = new Map();
  let activeState = {
    ...initialState,
  };
  let requestVersion = 0;
  let mediaQuery = null;

  const table = createMarketWatchTable(root, {
    schema,
    formatters,
    config: {
      labels,
    },
    initialViewId: activeState.tableView,
  });

  const mobile = createMarketWatchMobile(root, {
    schema,
    formatters,
    initialViewId: activeState.tableView,
    labels: {
      noData: labels.noData,
    },
  });

  let filters;

  function setStatus(message = "", type = "") {
    if (!elements.status) {
      return;
    }

    elements.status.textContent = message;
    elements.status.hidden = !message;

    if (type) {
      elements.status.dataset.state = type;
    } else {
      delete elements.status.dataset.state;
    }
  }

  function setLoading(isLoading) {
    elements.table.setAttribute("aria-busy", String(isLoading));

    if (isLoading) {
      setStatus(labels.loading, "loading");

      if (elements.summary) {
        elements.summary.textContent = labels.loading;
      }

      return;
    }

    if (elements.status?.dataset.state === "loading") {
      setStatus();
    }
  }

  function setResultsSummary(result) {
    if (elements.summary) {
      elements.summary.textContent = formatResultSummary(result.rows.length);
    }

    if (!elements.updated) {
      return;
    }

    const updatedAt = formatUpdatedAt(result.meta.updatedAt, pageConfig.locale);

    elements.updated.textContent = updatedAt
      ? `Last updated: ${updatedAt}`
      : "";

    elements.updated.hidden = !updatedAt;
  }

  function getVisibleGroupsForView(viewId) {
    const saved = visibleGroupsByView.get(viewId);

    if (saved) {
      return saved;
    }

    return schema.getPickerGroups(viewId).map((group) => group.id);
  }

  function syncColumnGroups(viewId) {
    const pickerGroups = schema.getPickerGroups(viewId);
    const visibleGroups = getVisibleGroupsForView(viewId);

    filters.setAvailableGroups(pickerGroups);
    filters.setVisibleGroups(visibleGroups);

    table.setVisibleGroups(visibleGroups);
  }

  function setView(viewId) {
    const view = schema.getView(viewId);

    activeState.tableView = view.id;

    table.setView(view.id);
    mobile.setView(view.id);
    syncColumnGroups(view.id);
  }

  async function loadData() {
    const version = ++requestVersion;

    setLoading(true);

    try {
      const result = await service.load(activeState);

      /*
       * A cancelled or older request must never overwrite newer filter state.
       */

      if (version !== requestVersion) {
        return;
      }

      table.setRows(result.rows);
      mobile.setRows(result.rows);
      setResultsSummary(result);
      setStatus();
    } catch (error) {
      if (error.name === "AbortError" || version !== requestVersion) {
        return;
      }

      table.setRows([]);
      mobile.setRows([]);

      if (elements.summary) {
        elements.summary.textContent = labels.loadError;
      }

      setStatus(labels.loadError, "error");

      console.error("[Market Watch] Data request failed.", error);
    } finally {
      if (version === requestVersion) {
        setLoading(false);
      }
    }
  }

  function setPresentationMode(isMobile) {
    elements.desktopView.hidden = isMobile;
    elements.mobileView.hidden = !isMobile;

    if (!isMobile) {
      window.requestAnimationFrame(() => {
        table.getApi()?.columns.adjust();
        window.dispatchEvent(new Event("resize"));
      });
    }
  }

  function handleBreakpointChange(event) {
    setPresentationMode(event.matches);
  }

  function handleFilterChange(nextState, event) {
    activeState = {
      ...activeState,
      ...nextState,
    };

    if (event.type === "columns") {
      const groups = [...activeState.visibleGroups];

      visibleGroupsByView.set(activeState.tableView, groups);
      table.setVisibleGroups(groups);

      return;
    }

    if (event.type === "table-view") {
      setView(activeState.tableView);
    }

    loadData();
  }

  function handleWatchlistIntent(requested) {
    /*
     * Authentication is intentionally only a page integration point for now.
     * When the site login popup is connected, listen for this event and open
     * the popup. Returning false restores the switch without fetching data.
     */

    if (requested && pageConfig.authentication?.isAuthenticated === false) {
      root.dispatchEvent(
        new CustomEvent("market-watch:authentication-required", {
          bubbles: true,
          detail: {
            source: "watchlist-filter",
          },
        }),
      );

      return false;
    }

    return true;
  }

  function handleFavoriteClick(event) {
    const button = event.target.closest("[data-market-watch-favorite]");

    if (!button) {
      return;
    }

    const security = button.dataset.marketWatchSecurity || "";

    root.dispatchEvent(
      new CustomEvent("market-watch:favorite-request", {
        bubbles: true,
        detail: {
          security,
          button,
        },
      }),
    );
  }

  filters = createMarketWatchFilters(root, {
    initialState,
    labels: {
      showAll: labels.showAll,
      noColumns: labels.noColumns,
      selectedSuffix: labels.selectedSuffix,
    },
    onChange: handleFilterChange,
    onWatchlistIntent: handleWatchlistIntent,
  });

  /*
   * Each view keeps its own visible-column selection. The default is that all
   * groups available in that view are shown.
   */

  visibleGroupsByView.set(
    activeState.tableView,
    initialState.visibleGroups.length
      ? initialState.visibleGroups
      : schema.getPickerGroups(activeState.tableView).map((group) => group.id),
  );

  setView(activeState.tableView);

  mediaQuery = window.matchMedia(
    `(max-width: ${pageConfig.breakpoints?.mobileMaxWidth || 767.98}px)`,
  );

  mediaQuery.addEventListener("change", handleBreakpointChange);
  setPresentationMode(mediaQuery.matches);

  $(root).on(
    "click.marketWatchPage",
    "[data-market-watch-favorite]",
    handleFavoriteClick,
  );

  loadData();

  return Object.freeze({
    reload: loadData,

    getState() {
      return {
        ...activeState,
        visibleGroups: [...activeState.visibleGroups],
      };
    },

    destroy() {
      requestVersion += 1;

      service.cancel();
      filters.destroy();
      table.destroy();
      mobile.destroy();

      mediaQuery?.removeEventListener("change", handleBreakpointChange);
      $(root).off(".marketWatchPage");
    },
  });
}

/* ==========================================================================
   Automatic Startup
   ========================================================================== */

function startMarketWatchPage() {
  if (!document.querySelector("[data-market-watch-filters]")) {
    return;
  }

  window.marketWatchPage?.destroy();

  window.marketWatchPage = initMarketWatchPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMarketWatchPage, {
    once: true,
  });
} else {
  startMarketWatchPage();
}
