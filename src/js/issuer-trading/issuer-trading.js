/* ==========================================================================
   Issuer Trading
   ========================================================================== */

/*
 * Page-level entry point for Issuer Trading.
 *
 * Responsibilities:
 *
 * - read validated JSP configuration
 * - listen to the design-system tabs lifecycle
 * - lazily create tab-specific data modules
 * - activate and deactivate data modules
 * - prevent duplicate feature activation
 * - cancel stale feature work through each feature lifecycle
 * - destroy page resources
 *
 * This module intentionally does not:
 *
 * - implement visual tab behavior
 * - change tab classes
 * - change ARIA tab state
 * - show or hide tab panels
 * - contain tab-specific business logic
 *
 * Visual tab behavior remains owned by the design-system tabs component.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { getIssuerTradingConfig } from "./issuer-trading-config.js";

import { createNegotiatedDealsTab } from "./tabs/negotiated-deals/negotiated-deals.tab.js";

import { createAccumulatedLossesTab } from "./tabs/accumulated-losses/accumulated-losses.tab.js";

import { createListedTradableRightsTab } from "./tabs/listed-tradable-rights/listed-tradable-rights.tab.js";

import { createCompanyStatusTab } from "./tabs/company-status/company-status.tab.js";

import { createOtcTradingTab } from "./tabs/otc-trading/otc-trading.tab.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TAB = "negotiated-deals";

const TAB_CHANGE_EVENT = "tabs:change";

const TAB_ID_PREFIXES = Object.freeze([
  "issuer-trading-panel-",
  "issuer-trading-tab-",
  "tab-",
]);

const SELECTORS = Object.freeze({
  root: "[data-issuer-trading]",

  tabs: '.tabs[data-tabs][data-tabs-id="issuer-trading"]',

  activeTab:
    ':scope > .tabs-nav > [role="tab"][data-tab-target][aria-selected="true"]',

  activePanel: ':scope > .tabs-content > [role="tabpanel"]:not([hidden])',
});

/* ==========================================================================
   Feature Definitions
   ========================================================================== */

/*
 * Every feature is created lazily on its first activation.
 *
 * All features use the same lifecycle configuration:
 *
 * - no initialization during factory creation
 * - no automatic activation during factory creation
 * - reload once when activated after being inactive
 */

const FEATURE_DEFINITIONS = Object.freeze({
  "negotiated-deals": Object.freeze({
    selector: '[data-issuer-trading-feature="negotiated-deals"]',

    statusSelector: "[data-negotiated-deals-status]",

    create({ root, config }) {
      return createNegotiatedDealsTab({
        root,
        config,

        autoInit: false,
        active: false,

        reloadOnActivate: true,
      });
    },
  }),

  "accumulated-losses": Object.freeze({
    selector: '[data-issuer-trading-feature="accumulated-losses"]',

    statusSelector: "[data-accumulated-losses-status]",

    create({ root, config }) {
      return createAccumulatedLossesTab({
        root,
        config,

        autoInit: false,
        active: false,

        reloadOnActivate: true,
      });
    },
  }),

  "listed-tradable-rights": Object.freeze({
    selector: '[data-issuer-trading-feature="listed-tradable-rights"]',

    statusSelector: "[data-listed-tradable-rights-status]",

    create({ root, config }) {
      return createListedTradableRightsTab({
        root,
        config,

        autoInit: false,
        active: false,

        reloadOnActivate: true,
      });
    },
  }),

  "company-status": Object.freeze({
    selector: '[data-issuer-trading-feature="company-status"]',

    statusSelector: "[data-company-status-status]",

    create({ root, config }) {
      return createCompanyStatusTab({
        root,
        config,

        autoInit: false,
        active: false,

        reloadOnActivate: true,
      });
    },
  }),

  "otc-trading": Object.freeze({
    selector: '[data-issuer-trading-feature="otc-trading"]',

    statusSelector: "[data-otc-trading-status]",

    create({ root, config }) {
      return createOtcTradingTab({
        root,
        config,

        autoInit: false,
        active: false,

        reloadOnActivate: true,
      });
    },
  }),
});

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isElement(value) {
  return Boolean(value && value.nodeType === 1);
}

function isObject(value) {
  return value !== null && typeof value === "object";
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function hasFeatureDefinition(tabKey) {
  return Object.prototype.hasOwnProperty.call(FEATURE_DEFINITIONS, tabKey);
}

/* ==========================================================================
   Tab Key Normalization
   ========================================================================== */

function normalizeTabKey(value) {
  const normalized = normalizeString(value).replace(/^#/, "");

  if (!normalized) {
    return "";
  }

  if (hasFeatureDefinition(normalized)) {
    return normalized;
  }

  for (const prefix of TAB_ID_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }

  return normalized;
}

function getTabElementKey(tab) {
  if (!isElement(tab)) {
    return "";
  }

  return normalizeTabKey(
    tab.dataset.tab ||
      tab.dataset.tabTarget ||
      tab.getAttribute("aria-controls") ||
      tab.id,
  );
}

function getPanelElementKey(panel) {
  if (!isElement(panel)) {
    return "";
  }

  return normalizeTabKey(panel.dataset.tab || panel.id);
}

/* ==========================================================================
   Root Resolution
   ========================================================================== */

function resolvePageRoot(root) {
  if (isElement(root) && root.matches(SELECTORS.root)) {
    return root;
  }

  if (root && typeof root.querySelector === "function") {
    return root.querySelector(SELECTORS.root);
  }

  return null;
}

function resolveTabsRoot(pageRoot) {
  return pageRoot.querySelector(SELECTORS.tabs);
}

function resolveFeatureRoot(pageRoot, definition) {
  if (!definition?.selector) {
    return null;
  }

  return pageRoot.querySelector(definition.selector);
}

/* ==========================================================================
   Initial Tab
   ========================================================================== */

function getInitialTabKey(tabs) {
  const activeTab = tabs.querySelector(SELECTORS.activeTab);

  const activeTabKey = getTabElementKey(activeTab);

  if (activeTabKey) {
    return activeTabKey;
  }

  const activePanel = tabs.querySelector(SELECTORS.activePanel);

  const activePanelKey = getPanelElementKey(activePanel);

  return activePanelKey || DEFAULT_TAB;
}

/* ==========================================================================
   Event Tab
   ========================================================================== */

function getEventTabKey(event) {
  if (!isObject(event?.detail)) {
    return "";
  }

  const { tabKey, tab, panel, targetId } = event.detail;

  if (normalizeString(tabKey)) {
    return normalizeTabKey(tabKey);
  }

  if (isElement(tab)) {
    return getTabElementKey(tab);
  }

  if (isElement(panel)) {
    return getPanelElementKey(panel);
  }

  return normalizeTabKey(targetId);
}

/* ==========================================================================
   Feature Validation
   ========================================================================== */

function validateFeature(feature, tabKey) {
  const requiredMethods = ["activate", "deactivate", "destroy", "reload"];

  const valid = requiredMethods.every(
    (method) => typeof feature?.[method] === "function",
  );

  if (!valid) {
    throw new TypeError(
      `Issuer Trading feature "${tabKey}" does not expose the required lifecycle API.`,
    );
  }

  return feature;
}

/* ==========================================================================
   Lifecycle Error Reporting
   ========================================================================== */

function reportLifecycleError({ pageRoot, tabKey, error, config }) {
  /*
   * Request cancellation is an expected lifecycle outcome during rapid tab
   * changes and destruction. It must not be presented as a user-facing error.
   */

  if (isAbortError(error)) {
    return;
  }

  const definition = FEATURE_DEFINITIONS[tabKey];

  const featureRoot = resolveFeatureRoot(pageRoot, definition);

  const status = definition?.statusSelector
    ? featureRoot?.querySelector(definition.statusSelector)
    : null;

  if (status) {
    status.textContent = config.labels?.error || "Unable to load data.";
  }

  pageRoot.dispatchEvent(
    new CustomEvent("issuer-trading:error", {
      bubbles: true,

      detail: Object.freeze({
        tabKey,
        error,
      }),
    }),
  );
}

/* ==========================================================================
   Public Initialization
   ========================================================================== */

export function initIssuerTrading(root = document) {
  const pageRoot = resolvePageRoot(root);

  if (!pageRoot) {
    return null;
  }

  const existingInstance = instances.get(pageRoot);

  if (existingInstance) {
    return existingInstance;
  }

  const tabs = resolveTabsRoot(pageRoot);

  if (!tabs) {
    throw new Error("Issuer Trading tabs container was not found.");
  }

  const config = getIssuerTradingConfig();

  const featureInstances = new Map();

  const abortController = new AbortController();

  let activeTabKey = "";

  let pendingTabKey = "";

  let pendingActivation = null;

  let activationId = 0;

  let destroyed = false;

  /* ========================================================================
     Feature Lookup
     ======================================================================== */

  function findFeature(tabKey) {
    return featureInstances.get(tabKey) || null;
  }

  /* ========================================================================
     Feature Creation
     ======================================================================== */

  function createFeature(tabKey) {
    const existingFeature = findFeature(tabKey);

    if (existingFeature) {
      return existingFeature;
    }

    const definition = FEATURE_DEFINITIONS[tabKey];

    /*
     * Unknown tabs remain valid visual tabs without a data feature.
     */

    if (!definition) {
      return null;
    }

    const featureRoot = resolveFeatureRoot(pageRoot, definition);

    if (!featureRoot) {
      throw new Error(
        `Issuer Trading feature root was not found for "${tabKey}".`,
      );
    }

    const feature = validateFeature(
      definition.create({
        root: featureRoot,
        config,
      }),
      tabKey,
    );

    featureInstances.set(tabKey, feature);

    return feature;
  }

  /* ========================================================================
     Pending Activation
     ======================================================================== */

  function clearPendingActivation(activation) {
    if (pendingActivation !== activation) {
      return;
    }

    pendingActivation = null;

    pendingTabKey = "";
  }

  /* ========================================================================
     Feature Activation
     ======================================================================== */

  function activateFeature(tabKey) {
    if (destroyed) {
      return Promise.resolve(null);
    }

    const normalizedTabKey = normalizeTabKey(tabKey);

    if (!normalizedTabKey) {
      return Promise.resolve(null);
    }

    /*
     * Return the existing promise when the same tab is already being
     * activated. This prevents parallel loads for one tab.
     */

    if (normalizedTabKey === pendingTabKey && pendingActivation) {
      return pendingActivation;
    }

    const currentFeature = findFeature(activeTabKey);

    /*
     * Selecting the already-active feature is intentionally a no-op.
     *
     * Reloads remain available through:
     *
     * - filter changes
     * - reset actions
     * - the public reload() method
     */

    if (normalizedTabKey === activeTabKey && currentFeature) {
      return Promise.resolve(currentFeature);
    }

    /*
     * An active placeholder tab also remains a no-op when selected again.
     */

    if (
      normalizedTabKey === activeTabKey &&
      !hasFeatureDefinition(normalizedTabKey)
    ) {
      return Promise.resolve(null);
    }

    /*
     * Invalidate any earlier activation before changing features.
     *
     * An older promise may still settle, but it no longer owns the current
     * activation and therefore cannot report a stale lifecycle error.
     */

    const currentActivationId = ++activationId;

    pendingActivation = null;

    pendingTabKey = "";

    if (currentFeature && activeTabKey !== normalizedTabKey) {
      currentFeature.deactivate();
    }

    activeTabKey = normalizedTabKey;

    let nextFeature;

    try {
      nextFeature = createFeature(normalizedTabKey);
    } catch (error) {
      return Promise.reject(error);
    }

    /*
     * Placeholder tab:
     *
     * Visual tab behavior remains functional, but there is no data module to
     * activate.
     */

    if (!nextFeature) {
      return Promise.resolve(null);
    }

    let activationResult;

    try {
      activationResult = nextFeature.activate();
    } catch (error) {
      activationResult = Promise.reject(error);
    }

    const activation = Promise.resolve(activationResult)
      .then(() => {
        if (
          destroyed ||
          currentActivationId !== activationId ||
          activeTabKey !== normalizedTabKey
        ) {
          return null;
        }

        return nextFeature;
      })
      .catch((error) => {
        /*
         * Ignore cancellation and stale activation failures.
         *
         * Only the currently owned activation may report a real error.
         */

        if (
          destroyed ||
          currentActivationId !== activationId ||
          isAbortError(error)
        ) {
          return null;
        }

        throw error;
      })
      .finally(() => {
        clearPendingActivation(activation);
      });

    pendingTabKey = normalizedTabKey;

    pendingActivation = activation;

    return activation;
  }

  /* ========================================================================
     Safe Activation Request
     ======================================================================== */

  function requestFeatureActivation(tabKey) {
    const normalizedTabKey = normalizeTabKey(tabKey);

    if (!normalizedTabKey || destroyed) {
      return Promise.resolve(null);
    }

    return activateFeature(normalizedTabKey).catch((error) => {
      reportLifecycleError({
        pageRoot,

        tabKey: normalizedTabKey,

        error,

        config,
      });

      return null;
    });
  }

  /* ========================================================================
     Design-System Tab Event
     ======================================================================== */

  function handleTabChange(event) {
    /*
     * Ignore events emitted by nested tabs inside an Issuer Trading panel.
     */

    if (event.target !== tabs) {
      return;
    }

    const tabKey = getEventTabKey(event);

    if (!tabKey) {
      return;
    }

    void requestFeatureActivation(tabKey);
  }

  tabs.addEventListener(TAB_CHANGE_EVENT, handleTabChange, {
    signal: abortController.signal,
  });

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      /*
       * Invalidate every unresolved activation before destroying features.
       */

      activationId += 1;

      pendingActivation = null;

      pendingTabKey = "";

      abortController.abort();

      featureInstances.forEach((feature) => {
        feature.destroy();
      });

      featureInstances.clear();

      activeTabKey = "";

      instances.delete(pageRoot);
    },

    reload() {
      if (destroyed) {
        return Promise.resolve(null);
      }

      const feature = findFeature(activeTabKey);

      return feature
        ? Promise.resolve(feature.reload())
        : Promise.resolve(null);
    },

    getActiveTab() {
      return activeTabKey;
    },

    getFeature(tabKey) {
      return findFeature(normalizeTabKey(tabKey));
    },

    getFeatures() {
      return new Map(featureInstances);
    },

    isActivating() {
      return Boolean(pendingActivation);
    },
  });

  /*
   * Register the instance before initial activation. This prevents reentrant
   * initialization if application code reacts synchronously to lifecycle
   * events.
   */

  instances.set(pageRoot, instance);

  /* ========================================================================
     Initial Feature
     ======================================================================== */

  const initialTabKey = getInitialTabKey(tabs);

  void requestFeatureActivation(initialTabKey);

  return instance;
}

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  document.querySelectorAll(SELECTORS.root).forEach((pageRoot) => {
    initIssuerTrading(pageRoot);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
