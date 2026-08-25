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
 * - destroy owned page instances
 *
 * This file intentionally has no:
 *
 * - AJAX implementation
 * - DataTables implementation
 * - table schemas
 * - card markup
 * - cell rendering
 * - Sector -> Company request implementation
 * - date calculation logic
 * - generic tab keyboard / ARIA behavior
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

const STATIC_TAB_VIEWS = Object.freeze({
  [TRADING_TABS.accumulated]: TRADING_VIEWS.accumulatedLosses,

  [TRADING_TABS.listedTradable]: TRADING_VIEWS.listedTradableRights,

  [TRADING_TABS.otcTrading]: TRADING_VIEWS.otcTrading,
});

/* ==========================================================================
   Helpers
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
   Initial Active Tab
   ========================================================================== */

/**
 * Resolve the initially active Trading tab from the shared tabs markup.
 *
 * Runtime state is stored separately inside initTrading().
 *
 * @param {Element} root
 * @returns {string}
 */
function getInitialActiveTab(root) {
  const selected =
    query(root, `${SELECTORS.tab}[aria-selected="true"]`) ||
    query(root, `${SELECTORS.tab}.active`);

  return selected?.dataset.tradingTab || TRADING_TABS.negotiatedDeals;
}

/* ==========================================================================
   View Resolution
   ========================================================================== */

function getNegotiatedView(filters) {
  const type = filters.negotiated.getValue("type");

  return type === NEGOTIATED_TYPES.minimumSize
    ? TRADING_VIEWS.minimumSize
    : TRADING_VIEWS.negotiatedDeals;
}

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

function getCompanyStatusView(filters, config) {
  const type = filters.companyStatus.getValue("type");

  return isSuspendedType(type, config)
    ? TRADING_VIEWS.suspendedCompanies
    : TRADING_VIEWS.delistedCompanies;
}

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
   Public Initialization
   ========================================================================== */

export function initTrading(root = document) {
  const scope =
    root instanceof Document
      ? query(root, SELECTORS.root)
      : root.matches?.(SELECTORS.root)
        ? root
        : query(root, SELECTORS.root);

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
   * Important:
   *
   * Do not call the public runtime getActiveTab() method here.
   *
   * getInitialActiveTab() reads initial DOM state.
   * getActiveTab() later exposes current runtime state.
   */
  let activeTab = getInitialActiveTab(scope);

  /* =========================================================================
     View Instances
     ========================================================================= */

  /*
   * Views are created lazily.
   *
   * Once created, switching tabs does not destroy them.
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
     * Tables initialized while hidden may require width recalculation after
     * the shared tabs/variant system makes them visible.
     */
    if (!destroyed && view === getCurrentView()) {
      requestAnimationFrame(() => {
        if (destroyed) {
          return;
        }

        instance.adjust?.();
      });
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
     * Synchronize nested variants before loading/adjusting the active view.
     */

    if (activeTab === TRADING_TABS.negotiatedDeals) {
      syncNegotiatedVariant(scope, filters);
    }

    if (activeTab === TRADING_TABS.companyStatus) {
      syncCompanyStatusVariant(scope, filters, config);
    }

    try {
      await loadCurrentView({
        reason: "tab",
      });
    } catch (error) {
      /*
       * AbortError is expected when a newer request supersedes an older one.
       */
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
   * Shared tabs own:
   *
   * - aria-selected
   * - tabindex
   * - panel hidden state
   * - keyboard behavior
   *
   * Trading reacts only to the resulting active-tab change.
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
   * If the shared tabs implementation does not emit tab:change, use the
   * Trading tab metadata after the shared click handler has run.
   *
   * This observes tab changes only; it does not implement tab behavior.
   */

  tabsRoot?.addEventListener(
    "click",
    (event) => {
      const tabElement = event.target.closest?.(SELECTORS.tab);

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
      /* --------------------------------------------------------------
             Type
             -------------------------------------------------------------- */

      if (event.key === "type") {
        const view = syncNegotiatedVariant(scope, filters);

        if (activeTab === TRADING_TABS.negotiatedDeals) {
          await loadView(view, {
            reason: "variant",
          });
        }

        return;
      }

      /* --------------------------------------------------------------
             Sector -> Company
             -------------------------------------------------------------- */

      if (event.key === "sector") {
        await dependencies.loadCompanies(event.value);

        /*
         * Sector changes always restore Company to "All Companies".
         *
         * Only the actual Negotiated Deals dataset consumes Sector and
         * Company. Minimum Size does not.
         */
        if (
          activeTab === TRADING_TABS.negotiatedDeals &&
          getNegotiatedView(filters) === TRADING_VIEWS.negotiatedDeals
        ) {
          await loadView(TRADING_VIEWS.negotiatedDeals, {
            reason: "filter",
          });
        }

        return;
      }

      /* --------------------------------------------------------------
             Company / Date
             -------------------------------------------------------------- */

      if (activeTab !== TRADING_TABS.negotiatedDeals) {
        return;
      }

      if (getNegotiatedView(filters) !== TRADING_VIEWS.negotiatedDeals) {
        return;
      }

      await loadView(TRADING_VIEWS.negotiatedDeals, {
        reason: "filter",
      });
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
        /* --------------------------------------------------------------
             Type
             -------------------------------------------------------------- */

        if (event.key === "type") {
          const view = syncCompanyStatusVariant(scope, filters, config);

          if (activeTab === TRADING_TABS.companyStatus) {
            await loadView(view, {
              reason: "variant",
            });
          }

          return;
        }

        /* --------------------------------------------------------------
             Date Range
             -------------------------------------------------------------- */

        if (activeTab !== TRADING_TABS.companyStatus) {
          return;
        }

        await loadCurrentView({
          reason: "filter",
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
     * filters.js owns reset values.
     *
     * Its date reset contract is:
     *
     * fromDate = one calendar month before today
     * toDate   = today
     *
     * notify:false prevents one AJAX call per field.
     */

    filters.resetNegotiated({
      notify: false,

      source: "reset",
    });

    /*
     * Reset restores the default Negotiated Deals variant.
     */
    syncNegotiatedVariant(scope, filters);

    /*
     * Reset Company options to the single safe default:
     *
     * All Companies
     */
    dependencies.resetCompany();

    /*
     * Synchronize createDataFilters' cached DOM state after the programmatic
     * reset/dependency updates.
     */
    filters.negotiated.sync();

    if (activeTab === TRADING_TABS.negotiatedDeals) {
      await loadCurrentView({
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
     * filters.js owns the reset values:
     *
     * type     = Suspension
     * fromDate = one calendar month before today
     * toDate   = today
     */

    filters.resetCompanyStatus({
      notify: false,

      source: "reset",
    });

    filters.companyStatus.sync();

    syncCompanyStatusVariant(scope, filters, config);

    if (activeTab === TRADING_TABS.companyStatus) {
      await loadCurrentView({
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
         * Reset buttons are type="reset".
         *
         * Prevent the browser's native form reset because Trading reset
         * values include calculated date defaults.
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

  syncNegotiatedVariant(scope, filters);

  syncCompanyStatusVariant(scope, filters, config);

  /* =========================================================================
     Initial Load
     ========================================================================= */

  /*
   * filters.js has already initialized:
   *
   * Negotiated:
   *   fromDate = one month ago
   *   toDate   = today
   *
   * Company Status:
   *   fromDate = one month ago
   *   toDate   = today
   *
   * The active view can therefore immediately render its loading state and
   * issue the correctly dated request.
   */

  loadCurrentView({
    reason: "initial",
  }).catch((error) => {
    if (error?.name !== "AbortError") {
      console.error("Trading initial load:", error);
    }
  });

  /* =========================================================================
     Public API
     ========================================================================= */

  function refresh() {
    return loadCurrentView({
      reason: "refresh",
    });
  }

  /**
   * Return the current runtime tab.
   *
   * This intentionally differs from getInitialActiveTab(), which reads only
   * the initial shared-tabs DOM state.
   */
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

    abortController.abort();

    unsubscribeNegotiated();
    unsubscribeAccumulated();
    unsubscribeCompanyStatus();

    dependencies.destroy();

    filters.destroy();

    views.forEach((instance) => {
      instance.destroy?.();
    });

    views.clear();

    instances.delete(scope);
  }

  /* =========================================================================
     Instance
     ========================================================================= */

  const instance = Object.freeze({
    refresh,

    getActiveTab,
    getActiveView,
    getViewInstance,

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

function init() {
  initTrading(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, {
    once: true,
  });
} else {
  init();
}
