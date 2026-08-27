/* ==========================================================================
   Trading
   ========================================================================== */

/*
 * Trading page composition root.
 *
 * Responsibilities:
 *
 * - initialize Trading once per page root
 * - initialize shared Trading filters
 * - initialize Trading dependencies
 * - coordinate active tab -> active view
 * - coordinate Negotiated / Minimum Size variants
 * - coordinate Suspended / Delisted variants
 * - coordinate filter effects
 * - coordinate Reset
 * - lazily create individual Trading views
 * - coordinate table adjustment after hidden views become visible
 * - destroy owned page instances
 *
 * This file intentionally has no:
 *
 * - AJAX transport implementation
 * - backend response normalization
 * - DataTables schemas
 * - table cell markup
 * - card markup
 * - company-logo rendering / fallback logic
 * - Sector -> Company request implementation
 * - date calculation logic
 * - generic tab keyboard / ARIA behavior
 *
 * Those responsibilities remain in:
 *
 * - common/data-view
 * - filters.js
 * - dependencies.js
 * - formatters.js
 * - individual views
 */

/* ==========================================================================
   Configuration
   ========================================================================== */

import { getTradingConfig } from "./config.js";

/* ==========================================================================
   Constants
   ========================================================================== */

import {
  COMPANY_STATUS_TYPES,
  NEGOTIATED_TYPES,
  SELECTORS,
  TRADING_TABS,
  TRADING_VIEWS,
  getCompanyStatusVariantSelector,
  getNegotiatedVariantSelector,
  getResetSelector,
  getViewSelector,
} from "./constants.js";

/* ==========================================================================
   Shared Trading Modules
   ========================================================================== */

import { createTradingFilters } from "./filters.js";

import { createTradingDependencies } from "./dependencies.js";

/* ==========================================================================
   Trading Views
   ========================================================================== */

import { createNegotiatedView } from "./views/negotiated.js";

import { createMinimumSizeView } from "./views/minimum-size.js";

import { createAccumulatedView } from "./views/accumulated.js";

import { createListedTradableView } from "./views/listed-tradable.js";

import { createSuspendedView } from "./views/suspended.js";

import { createDelistedView } from "./views/delisted.js";

import { createOtcView } from "./views/otc.js";

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   View Factories
   ========================================================================== */

/*
 * Trading owns view orchestration only.
 *
 * Each factory remains responsible for composing the common data-view modules
 * for its specific dataset.
 */

const VIEW_FACTORIES = Object.freeze({
  [TRADING_VIEWS.negotiatedDeals]: createNegotiatedView,

  [TRADING_VIEWS.minimumSize]: createMinimumSizeView,

  [TRADING_VIEWS.accumulatedLosses]: createAccumulatedView,

  [TRADING_VIEWS.listedTradableRights]: createListedTradableView,

  [TRADING_VIEWS.suspendedCompanies]: createSuspendedView,

  [TRADING_VIEWS.delistedCompanies]: createDelistedView,

  [TRADING_VIEWS.otcTrading]: createOtcView,
});

/* ==========================================================================
   Static Tab -> View Mapping
   ========================================================================== */

/*
 * Negotiated and Company Status are intentionally excluded:
 *
 * Negotiated:
 *
 * selected Type determines:
 *
 * - Negotiated Deals
 * - Minimum Size
 *
 * Company Status:
 *
 * selected Type determines:
 *
 * - Suspended
 * - Delisted
 */

const STATIC_TAB_VIEWS = Object.freeze({
  [TRADING_TABS.accumulated]: TRADING_VIEWS.accumulatedLosses,

  [TRADING_TABS.listedTradable]: TRADING_VIEWS.listedTradableRights,

  [TRADING_TABS.otcTrading]: TRADING_VIEWS.otcTrading,
});

/* ==========================================================================
   DOM Helpers
   ========================================================================== */

function isElement(value) {
  return value instanceof Element;
}

function query(root, selector) {
  return root?.querySelector?.(selector) || null;
}

function queryAll(root, selector) {
  return Array.from(root?.querySelectorAll?.(selector) || []);
}

/* ==========================================================================
   Root Resolution
   ========================================================================== */

function resolveTradingRoot(root) {
  if (root instanceof Document) {
    return query(root, SELECTORS.root);
  }

  if (isElement(root) && root.matches(SELECTORS.root)) {
    return root;
  }

  return query(root, SELECTORS.root);
}

/* ==========================================================================
   Initial Active Tab
   ========================================================================== */

/**
 * Resolve the initial Trading tab from the shared tabs markup.
 *
 * Important:
 *
 * This function reads INITIAL DOM state only.
 *
 * After initialization, activeTab inside initTrading() becomes the runtime
 * source of truth.
 *
 * @param {Element} root
 * @returns {string}
 */

function getInitialActiveTab(root) {
  const selected =
    query(root, `${SELECTORS.tab}[aria-selected="true"]`) ||
    query(root, `${SELECTORS.tab}.active`);

  const tab = selected?.dataset?.tradingTab;

  return tab || TRADING_TABS.negotiatedDeals;
}

/* ==========================================================================
   Negotiated View Resolution
   ========================================================================== */

function getNegotiatedView(filters) {
  const type = filters.negotiated.getValue("type");

  return type === NEGOTIATED_TYPES.minimumSize
    ? TRADING_VIEWS.minimumSize
    : TRADING_VIEWS.negotiatedDeals;
}

/* ==========================================================================
   Company Status Type
   ========================================================================== */

function isSuspendedType(type, config) {
  const configured = config.filters?.deListedCompanies?.suspendedTypes;

  if (Array.isArray(configured)) {
    return configured.includes(type);
  }

  return (
    type === COMPANY_STATUS_TYPES.suspension ||
    type === COMPANY_STATUS_TYPES.suspensionFunds
  );
}

/* ==========================================================================
   Company Status View Resolution
   ========================================================================== */

function getCompanyStatusView(filters, config) {
  const type = filters.companyStatus.getValue("type");

  return isSuspendedType(type, config)
    ? TRADING_VIEWS.suspendedCompanies
    : TRADING_VIEWS.delistedCompanies;
}

/* ==========================================================================
   Tab -> View Resolution
   ========================================================================== */

function resolveViewForTab({ tab, filters, config }) {
  if (tab === TRADING_TABS.negotiatedDeals) {
    return getNegotiatedView(filters);
  }

  if (tab === TRADING_TABS.companyStatus) {
    return getCompanyStatusView(filters, config);
  }

  return STATIC_TAB_VIEWS[tab] || null;
}

/* ==========================================================================
   Variant Visibility
   ========================================================================== */

function setVisibleVariant(elements, activeElement) {
  elements.forEach((element) => {
    element.hidden = element !== activeElement;
  });
}

/* ==========================================================================
   Negotiated Variant
   ========================================================================== */

function syncNegotiatedVariant(root, filters) {
  const type = filters.negotiated.getValue("type");

  const normalizedType =
    type === NEGOTIATED_TYPES.minimumSize
      ? NEGOTIATED_TYPES.minimumSize
      : NEGOTIATED_TYPES.negotiatedDeals;

  const variants = queryAll(root, "[data-trading-variant]");

  const active = query(root, getNegotiatedVariantSelector(normalizedType));

  setVisibleVariant(variants, active);

  return getNegotiatedView(filters);
}

/* ==========================================================================
   Company Status Variant
   ========================================================================== */

function syncCompanyStatusVariant(root, filters, config) {
  const view = getCompanyStatusView(filters, config);

  const variants = queryAll(root, "[data-trading-company-status-variant]");

  const variant =
    view === TRADING_VIEWS.suspendedCompanies ? "suspended" : "delisted";

  const active = query(root, getCompanyStatusVariantSelector(variant));

  setVisibleVariant(variants, active);

  return view;
}

/* ==========================================================================
   View Adjustment
   ========================================================================== */

/*
 * A DataTable may be initialized while its parent tab or nested variant is
 * hidden.
 *
 * After it becomes visible:
 *
 * - recalculate columns
 * - refresh FixedHeader
 * - refresh Responsive when available
 *
 * Individual views expose adjust() so table-specific details remain outside
 * this composition root.
 */

function scheduleViewAdjustment(instance) {
  if (!instance) {
    return;
  }

  requestAnimationFrame(() => {
    instance.adjust?.();
  });
}

/* ==========================================================================
   Public Initialization
   ========================================================================== */

export function initTrading(root = document) {
  const scope = resolveTradingRoot(root);

  if (!isElement(scope)) {
    return null;
  }

  const existing = instances.get(scope);

  if (existing) {
    return existing;
  }

  /* =========================================================================
     Configuration
     ========================================================================= */

  const config = getTradingConfig();

  /* =========================================================================
     Lifecycle
     ========================================================================= */

  const abortController = new AbortController();

  const { signal } = abortController;

  let destroyed = false;

  /* =========================================================================
     Runtime Tab State
     ========================================================================= */

  /*
   * Initial DOM reading and runtime state are deliberately separate.
   *
   * This prevents temporal-dead-zone problems such as:
   *
   * Cannot access 'activeTab' before initialization
   */

  let activeTab = getInitialActiveTab(scope);

  /* =========================================================================
     View Instances
     ========================================================================= */

  /*
   * Views are created lazily.
   *
   * Reasons:
   *
   * - avoid initializing several hidden DataTables at page load
   * - avoid unnecessary API requests
   * - reduce work on the initial render
   * - preserve each view once the user has visited it
   */

  const views = new Map();

  /* =========================================================================
     Filters
     ========================================================================= */

  const filters = createTradingFilters({
    root: scope,

    config,
  });

  /* =========================================================================
     Dependencies
     ========================================================================= */

  const dependencies = createTradingDependencies({
    root: scope,

    config,

    filters,
  });

  /*
   * There is intentionally NO page-level image error listener here.
   *
   * formatters.js owns:
   *
   * - company-logo URL resolution
   * - configured fallback resolution
   * - image fallback behavior
   *
   * Trading remains orchestration-only.
   */

  /* =========================================================================
     View Creation
     ========================================================================= */

  function getOrCreateView(view) {
    if (destroyed || !view) {
      return null;
    }

    const existingView = views.get(view);

    if (existingView) {
      return existingView;
    }

    const factory = VIEW_FACTORIES[view];

    if (typeof factory !== "function") {
      console.error(`Trading view "${view}" has no factory.`);

      return null;
    }

    const viewRoot = query(scope, getViewSelector(view));

    if (!viewRoot) {
      console.error(`Trading view root "${view}" was not found.`);

      return null;
    }

    const instance = factory({
      root: viewRoot,

      pageRoot: scope,

      config,

      filters,
    });

    if (!instance) {
      console.error(`Trading view "${view}" could not be created.`);

      return null;
    }

    views.set(view, instance);

    return instance;
  }

  /* =========================================================================
     Current View
     ========================================================================= */

  function getCurrentView() {
    return resolveViewForTab({
      tab: activeTab,

      filters,

      config,
    });
  }

  /* =========================================================================
     Load View
     ========================================================================= */

  async function loadView(view, options = {}) {
    if (destroyed || !view) {
      return null;
    }

    const instance = getOrCreateView(view);

    if (!instance) {
      return null;
    }

    const result = await instance.reload?.({
      reason: options.reason || "reload",
    });

    /*
     * Width / FixedHeader recalculation is meaningful only if this is still
     * the active view by the time the asynchronous request completes.
     */

    if (!destroyed && view === getCurrentView()) {
      scheduleViewAdjustment(instance);
    }

    return result;
  }

  /* =========================================================================
     Load Current View
     ========================================================================= */

  function loadCurrentView(options = {}) {
    return loadView(getCurrentView(), options);
  }

  /* =========================================================================
     Tab Changes
     ========================================================================= */

  async function handleTabChange(tab) {
    if (destroyed || !tab || tab === activeTab) {
      return;
    }

    activeTab = tab;

    /*
     * Nested variants must be synchronized before loading the newly active
     * dataset.
     */

    if (activeTab === TRADING_TABS.negotiatedDeals) {
      syncNegotiatedVariant(scope, filters);
    }

    if (activeTab === TRADING_TABS.companyStatus) {
      syncCompanyStatusVariant(scope, filters, config);
    }

    /*
     * Allow the shared Tabs implementation to complete its DOM update first.
     *
     * This matters for:
     *
     * - hidden panels
     * - FixedHeader geometry
     * - table width calculation
     */

    await Promise.resolve();

    try {
      await loadCurrentView({
        reason: "tab",
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Trading tab load:", error);
      }
    }
  }

  /* =========================================================================
     Shared Tabs Integration
     ========================================================================= */

  const tabsRoot = query(scope, SELECTORS.tabs);

  /*
   * The shared Tabs component owns:
   *
   * - aria-selected
   * - tabindex
   * - panel hidden state
   * - keyboard behavior
   *
   * Trading only reacts to the resulting active tab.
   */

  tabsRoot?.addEventListener(
    "tab:change",
    (event) => {
      const tab =
        event.detail?.tabKey || event.detail?.tab || event.detail?.value;

      if (!tab) {
        return;
      }

      handleTabChange(tab);
    },
    {
      signal,
    },
  );

  /*
   * Compatibility fallback.
   *
   * Some shared Tabs versions may not emit tab:change.
   *
   * This observes the tab after the shared click behavior completes; it does
   * not reimplement tabs.
   */

  tabsRoot?.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      const tabElement = target.closest(SELECTORS.tab);

      if (!tabElement || !tabsRoot.contains(tabElement)) {
        return;
      }

      queueMicrotask(() => {
        if (destroyed) {
          return;
        }

        const nextTab = tabElement.dataset.tradingTab;

        if (nextTab && nextTab !== activeTab) {
          handleTabChange(nextTab);
        }
      });
    },
    {
      signal,
    },
  );

  /* =========================================================================
     Negotiated Filters
     ========================================================================= */

  const unsubscribeNegotiated = filters.negotiated.subscribe(async (event) => {
    if (destroyed) {
      return;
    }

    try {
      /* ==============================================================
             Type
             ============================================================== */

      if (event.key === "type") {
        const view = syncNegotiatedVariant(scope, filters);

        /*
         * If this tab is not visible, update state only.
         *
         * The correct variant will load when the user activates the tab.
         */

        if (activeTab !== TRADING_TABS.negotiatedDeals) {
          return;
        }

        await loadView(view, {
          reason: "variant",
        });

        return;
      }

      /* ==============================================================
             Sector
             ============================================================== */

      if (event.key === "sector") {
        /*
         * Correct dependency order:
         *
         * 1. Sector changes.
         * 2. Company options reload.
         * 3. Company becomes All Companies.
         * 4. Negotiated dataset reloads exactly once.
         */

        await dependencies.loadCompanies(event.value);

        if (activeTab !== TRADING_TABS.negotiatedDeals) {
          return;
        }

        if (getNegotiatedView(filters) !== TRADING_VIEWS.negotiatedDeals) {
          return;
        }

        await loadView(TRADING_VIEWS.negotiatedDeals, {
          reason: "sector",
        });

        return;
      }

      /* ==============================================================
             Company
             ============================================================== */

      if (event.key === "company") {
        /*
         * Clearing the enhanced Company control means All Companies.
         *
         * dependencies.js owns normalization of the native select.
         */

        dependencies.normalizeCompanyValue?.();

        if (activeTab !== TRADING_TABS.negotiatedDeals) {
          return;
        }

        if (getNegotiatedView(filters) !== TRADING_VIEWS.negotiatedDeals) {
          return;
        }

        await loadView(TRADING_VIEWS.negotiatedDeals, {
          reason: "company",
        });

        return;
      }

      /* ==============================================================
             Date Range
             ============================================================== */

      if (event.key === "fromDate" || event.key === "toDate") {
        if (activeTab !== TRADING_TABS.negotiatedDeals) {
          return;
        }

        if (getNegotiatedView(filters) !== TRADING_VIEWS.negotiatedDeals) {
          return;
        }

        await loadView(TRADING_VIEWS.negotiatedDeals, {
          reason: "date",
        });

        return;
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Trading Negotiated filter:", error);
      }
    }
  });

  /* =========================================================================
     Accumulated Filters
     ========================================================================= */

  const unsubscribeAccumulated = filters.accumulated.subscribe(async () => {
    if (destroyed || activeTab !== TRADING_TABS.accumulated) {
      return;
    }

    try {
      await loadView(TRADING_VIEWS.accumulatedLosses, {
        reason: "filter",
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Trading Accumulated filter:", error);
      }
    }
  });

  /* =========================================================================
     Company Status Filters
     ========================================================================= */

  const unsubscribeCompanyStatus = filters.companyStatus.subscribe(
    async (event) => {
      if (destroyed) {
        return;
      }

      try {
        /* ==============================================================
             Type
             ============================================================== */

        if (event.key === "type") {
          const view = syncCompanyStatusVariant(scope, filters, config);

          if (activeTab !== TRADING_TABS.companyStatus) {
            return;
          }

          await loadView(view, {
            reason: "variant",
          });

          return;
        }

        /* ==============================================================
             Date Range
             ============================================================== */

        if (event.key !== "fromDate" && event.key !== "toDate") {
          return;
        }

        if (activeTab !== TRADING_TABS.companyStatus) {
          return;
        }

        await loadCurrentView({
          reason: "date",
        });
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Trading Company Status filter:", error);
        }
      }
    },
  );
  /* =========================================================================
     Reset: Negotiated
     ========================================================================= */

  async function resetNegotiated() {
    /*
     * filters.js owns the actual business defaults:
     *
     * Type     = Negotiated Deals
     * Sector   = All
     * Company  = All Companies
     * From     = one calendar month ago
     * To       = today
     *
     * notify:false prevents one AJAX request for every field that changes.
     */

    filters.resetNegotiated({
      notify: false,

      source: "reset",
    });

    /*
     * Restore the full original JSP Company option collection.
     *
     * dependencies.js then selects All Companies.
     *
     * No AJAX request is made here.
     */

    dependencies.resetCompany();

    /*
     * Company options changed after filters.resetNegotiated(), therefore sync
     * the common filter snapshot once more with the final native DOM state.
     */

    filters.negotiated.sync();

    /*
     * Keep the custom date-range presentation synchronized with the restored
     * native date inputs.
     */

    filters.refreshNegotiatedDateRange?.();

    /*
     * Reset always returns the nested presentation to Negotiated Deals.
     */

    const view = syncNegotiatedVariant(scope, filters);

    /*
     * Exactly one final dataset request when this tab is active.
     */

    if (activeTab === TRADING_TABS.negotiatedDeals) {
      await loadView(view, {
        reason: "reset",
      });
    }
  }

  /* =========================================================================
     Reset: Accumulated
     ========================================================================= */

  async function resetAccumulated() {
    filters.resetAccumulated({
      notify: false,

      source: "reset",
    });

    /*
     * Synchronize the filter snapshot once after all reset values have been
     * applied.
     */

    filters.accumulated.sync();

    if (activeTab === TRADING_TABS.accumulated) {
      await loadView(TRADING_VIEWS.accumulatedLosses, {
        reason: "reset",
      });
    }
  }

  /* =========================================================================
     Reset: Company Status
     ========================================================================= */

  async function resetCompanyStatus() {
    /*
     * filters.js owns Company Status defaults.
     *
     * The reset operation is intentionally silent while values are restored,
     * followed by one explicit synchronization and, when active, one request.
     */

    filters.resetCompanyStatus({
      notify: false,

      source: "reset",
    });

    filters.companyStatus.sync();

    /*
     * Type may have changed during Reset, therefore restore the matching
     * Suspended / Delisted presentation before loading.
     */

    const view = syncCompanyStatusVariant(scope, filters, config);

    if (activeTab === TRADING_TABS.companyStatus) {
      await loadView(view, {
        reason: "reset",
      });
    }
  }

  /* =========================================================================
     Reset Dispatcher
     ========================================================================= */

  function runReset(key) {
    switch (key) {
      case TRADING_TABS.negotiatedDeals:
        return resetNegotiated();

      case TRADING_TABS.accumulated:
        return resetAccumulated();

      case TRADING_TABS.companyStatus:
        return resetCompanyStatus();

      default:
        return Promise.resolve();
    }
  }

  /* =========================================================================
     Reset Events
     ========================================================================= */

  [
    TRADING_TABS.negotiatedDeals,

    TRADING_TABS.accumulated,

    TRADING_TABS.companyStatus,
  ].forEach((key) => {
    const reset = query(scope, getResetSelector(key));

    reset?.addEventListener(
      "click",
      (event) => {
        /*
         * Reset controls are type="reset".
         *
         * Prevent native form reset because browser reset would restore the
         * JSP's original values rather than the Trading business defaults
         * managed by filters.js.
         */

        event.preventDefault();

        runReset(key).catch((error) => {
          if (error?.name !== "AbortError") {
            console.error(`Trading ${key} reset:`, error);
          }
        });
      },
      {
        signal,
      },
    );
  });

  /* =========================================================================
     Initial Variant State
     ========================================================================= */

  /*
   * Filters are already initialized at this point.
   *
   * Synchronize both nested presentations before the first view is created.
   *
   * This does not load either hidden dataset.
   */

  syncNegotiatedVariant(scope, filters);

  syncCompanyStatusVariant(scope, filters, config);

  /* =========================================================================
     Initial Load
     ========================================================================= */

  /*
   * Initial view behavior:
   *
   * 1. getOrCreateView() lazily creates the active view.
   * 2. common data-view immediately renders its loading/skeleton state.
   * 3. the active view sends its request.
   * 4. skeletons are replaced by ready / empty / error state.
   *
   * No artificial loading timeout is used.
   */

  loadCurrentView({
    reason: "initial",
  }).catch((error) => {
    if (error?.name !== "AbortError") {
      console.error("Trading initial load:", error);
    }
  });

  /* =========================================================================
     Public Refresh
     ========================================================================= */

  function refresh() {
    return loadCurrentView({
      reason: "refresh",
    });
  }

  /* =========================================================================
     Public Queries
     ========================================================================= */

  function getActiveTab() {
    return activeTab;
  }

  function getActiveView() {
    return getCurrentView();
  }

  function getViewInstance(view) {
    return views.get(view) || null;
  }

  /* =========================================================================
     Destruction
     ========================================================================= */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    /*
     * Removes every DOM event listener registered with this page lifecycle.
     *
     * At this level that means Trading's tab and reset integrations.
     *
     * Company-logo error handling is deliberately not owned here.
     */

    abortController.abort();

    /* -----------------------------------------------------------------------
       Filter Subscriptions
       ----------------------------------------------------------------------- */

    unsubscribeNegotiated();

    unsubscribeAccumulated();

    unsubscribeCompanyStatus();

    /* -----------------------------------------------------------------------
       Shared Trading Modules
       ----------------------------------------------------------------------- */

    dependencies.destroy();

    filters.destroy();

    /* -----------------------------------------------------------------------
       Views
       ----------------------------------------------------------------------- */

    views.forEach((instance) => {
      instance.destroy?.();
    });

    views.clear();

    /* -----------------------------------------------------------------------
       Registry
       ----------------------------------------------------------------------- */

    instances.delete(scope);
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  const instance = Object.freeze({
    refresh,

    getActiveTab,

    getActiveView,

    getViewInstance,

    /*
     * Exposed intentionally for page-level integrations and diagnostics.
     */

    filters,

    dependencies,

    destroy,
  });

  instances.set(scope, instance);

  return instance;
}

/* ==========================================================================
   Auto Initialization
   ========================================================================== */

function initialize() {
  initTrading(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, {
    once: true,
  });
} else {
  initialize();
}
