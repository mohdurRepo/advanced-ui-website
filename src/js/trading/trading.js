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

/*
 * Each view module will expose one factory.
 *
 * Standard views will reuse:
 *
 * - createDataSource()
 * - createDataState()
 * - createDataTable()
 * - createDataCards()
 * - createDataResults()
 * - createDataViewController()
 *
 * from common/data-view.
 */

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
   Tab -> View Mapping
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
   Active Tab
   ========================================================================== */

function getActiveTab(root) {
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

  const variants = queryAll(root, "[data-trading-variant]");

  const active = query(
    root,
    getNegotiatedVariantSelector(
      type === NEGOTIATED_TYPES.minimumSize
        ? NEGOTIATED_TYPES.minimumSize
        : NEGOTIATED_TYPES.negotiatedDeals,
    ),
  );

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

  const config = getTradingConfig();

  const abortController = new AbortController();

  const { signal } = abortController;

  let destroyed = false;

  let activeTab = getActiveTab(scope);

  /*
   * View instances are created lazily.
   *
   * Switching away from a tab does not destroy its table/card instance.
   */
  const views = new Map();

  /* ========================================================================
     Filters
     ======================================================================== */

  const filters = createTradingFilters({
    root: scope,
    config,
  });

  /* ========================================================================
     Dependencies
     ======================================================================== */

  const dependencies = createTradingDependencies({
    root: scope,
    config,
    filters,
  });

  /* ========================================================================
     View Creation
     ======================================================================== */

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

  /* ========================================================================
     Current View
     ======================================================================== */

  function getCurrentView() {
    return resolveViewForTab({
      tab: activeTab,
      filters,
      config,
    });
  }

  /* ========================================================================
     Loading
     ======================================================================== */

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
     * A DataTable initialized while hidden may need to recalculate widths
     * after its panel/variant becomes visible.
     */
    if (!destroyed && view === getCurrentView()) {
      requestAnimationFrame(() => {
        instance.adjust?.();
      });
    }

    return result;
  }

  /* ========================================================================
     Active View
     ======================================================================== */

  function loadCurrentView(options = {}) {
    return loadView(getCurrentView(), options);
  }

  /* ========================================================================
     Tab Changes
     ======================================================================== */

  async function handleTabChange(tab) {
    if (destroyed || !tab) {
      return;
    }

    activeTab = tab;

    /*
     * Ensure the correct nested presentation is visible before creating or
     * adjusting its view.
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
       * Stale tab loads are normal when users navigate quickly.
       */
      if (error?.name !== "AbortError") {
        console.error("Trading tab load:", error);
      }
    }
  }

  /* ========================================================================
     Shared Tab Event
     ======================================================================== */

  const tabsRoot = query(scope, SELECTORS.tabs);

  /*
   * Preferred integration:
   *
   * The shared tabs component owns:
   *
   * - aria-selected
   * - tabindex
   * - panel hidden state
   * - keyboard navigation
   *
   * Trading only reacts to its emitted tab:change event.
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
   * If the current shared tabs implementation does not yet emit tab:change,
   * observe activation through the Trading tab click without implementing
   * tab behavior here.
   *
   * queueMicrotask allows the shared tabs component to update ARIA/panels
   * first.
   */
  tabsRoot?.addEventListener(
    "click",
    (event) => {
      const tabElement = event.target.closest?.(SELECTORS.tab);

      if (!tabElement || !tabsRoot.contains(tabElement)) {
        return;
      }

      queueMicrotask(() => {
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

  /* ========================================================================
     Negotiated Filter Changes
     ======================================================================== */

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
         * Sector changes always restore Company to All Companies.
         *
         * Only Negotiated Deals uses Sector/Company. Minimum Size does
         * not need a second request after the dependency completes.
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
             Ordinary Negotiated filters
             -------------------------------------------------------------- */

      if (activeTab !== TRADING_TABS.negotiatedDeals) {
        return;
      }

      /*
       * Company/date filters belong only to actual Negotiated Deals.
       *
       * Minimum Size uses the Type selector but does not consume these
       * filters in its backend contract.
       */
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

  /* ========================================================================
     Accumulated Filter Changes
     ======================================================================== */

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

  /* ========================================================================
     Company Status Filter Changes
     ======================================================================== */

  const unsubscribeCompanyStatus = filters.companyStatus.subscribe(
    async (event) => {
      if (destroyed) {
        return;
      }

      try {
        if (event.key === "type") {
          const view = syncCompanyStatusVariant(scope, filters, config);

          if (activeTab === TRADING_TABS.companyStatus) {
            await loadView(view, {
              reason: "variant",
            });
          }

          return;
        }

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

  /* ========================================================================
     Reset Buttons
     ======================================================================== */

  async function resetNegotiated() {
    /*
     * Reset common filters without notifying subscribers individually.
     *
     * This avoids:
     *
     * Type reload
     * + Sector dependency reload
     * + Company reload
     * + From Date reload
     * + To Date reload
     *
     * becoming five AJAX requests.
     */
    filters.resetNegotiated({
      notify: false,

      source: "reset",
    });

    syncNegotiatedVariant(scope, filters);

    /*
     * Rebuild Company back to the All Companies state.
     */
    dependencies.resetCompany();

    filters.negotiated.sync();

    if (activeTab === TRADING_TABS.negotiatedDeals) {
      await loadCurrentView({
        reason: "reset",
      });
    }
  }

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

  async function resetCompanyStatus() {
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
         * The button may be type="reset".
         *
         * Prevent native form reset because createDataFilters() owns the
         * business reset values, including the calculated date range.
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

  /* ========================================================================
     Initial Variant State
     ======================================================================== */

  syncNegotiatedVariant(scope, filters);

  syncCompanyStatusVariant(scope, filters, config);

  /* ========================================================================
     Initial Load
     ======================================================================== */

  /*
   * Do not delay the loading lifecycle with arbitrary timers.
   *
   * The active view factory will immediately establish its common
   * table/card loading state and then issue the request.
   */
  loadCurrentView({
    reason: "initial",
  }).catch((error) => {
    if (error?.name !== "AbortError") {
      console.error("Trading initial load:", error);
    }
  });

  /* ========================================================================
     Public API
     ======================================================================== */

  function refresh() {
    return loadCurrentView({
      reason: "refresh",
    });
  }

  function getActiveTab() {
    return activeTab;
  }

  function getActiveView() {
    return getCurrentView();
  }

  function getViewInstance(view) {
    return views.get(view) || null;
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

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

  /* ========================================================================
     Instance
     ======================================================================== */

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
