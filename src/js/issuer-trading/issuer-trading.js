/* ==========================================================================
   Issuer Trading
   ========================================================================== */

/*
 * Page-level entry point for Issuer Trading.
 *
 * Responsibilities:
 *
 * - read validated JSP configuration
 * - listen to the existing design-system tab controller
 * - lazily create tab-specific data modules
 * - activate and deactivate data modules
 * - destroy page resources
 *
 * This module intentionally does not:
 *
 * - implement tab UI behavior
 * - change ARIA tab state
 * - show or hide tab panels
 * - contain tab-specific business logic
 *
 * Visual tab behavior remains owned by the existing tabs controller.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { getIssuerTradingConfig } from "./issuer-trading-config.js";

import { createNegotiatedDealsTab } from "./tabs/negotiated-deals/negotiated-deals.tab.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TAB = "negotiated-deals";

const SELECTORS = Object.freeze({
  root: "[data-issuer-trading]",

  tabs: '[data-tabs][data-tabs-id="issuer-trading"]',

  activeTab: '[role="tab"][data-tab][aria-selected="true"]',

  activePanel: ".tab-content__panel[data-tab]:not([hidden])",
});

/* ==========================================================================
   Feature Definitions
   ========================================================================== */

/*
 * Add future tab modules here only after each tab has been completed.
 *
 * Placeholder tabs intentionally have no definition yet.
 */

const FEATURE_DEFINITIONS = Object.freeze({
  "negotiated-deals": Object.freeze({
    selector: '[data-issuer-trading-feature="negotiated-deals"]',

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
});

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizeString(value) {
  return String(value ?? "").trim();
}

function resolvePageRoot(root) {
  if (root instanceof Element && root.matches(SELECTORS.root)) {
    return root;
  }

  if (root && typeof root.querySelector === "function") {
    return root.querySelector(SELECTORS.root);
  }

  return null;
}

function getInitialTabKey(pageRoot, tabs) {
  const activeTab = tabs.querySelector(SELECTORS.activeTab);

  const activeTabKey = normalizeString(activeTab?.dataset.tab);

  if (activeTabKey) {
    return activeTabKey;
  }

  const activePanel = pageRoot.querySelector(SELECTORS.activePanel);

  const activePanelKey = normalizeString(activePanel?.dataset.tab);

  return activePanelKey || DEFAULT_TAB;
}

function getEventTabKey(event) {
  return normalizeString(
    event?.detail?.tabKey ?? event?.detail?.tab ?? event?.detail?.key,
  );
}

function resolveFeatureRoot(pageRoot, definition) {
  if (!definition?.selector) {
    return null;
  }

  return pageRoot.querySelector(definition.selector);
}

/* ==========================================================================
   Lifecycle Error
   ========================================================================== */

function reportLifecycleError({ pageRoot, tabKey, error, config }) {
  const definition = FEATURE_DEFINITIONS[tabKey];

  const featureRoot = resolveFeatureRoot(pageRoot, definition);

  const status = featureRoot?.querySelector("[data-negotiated-deals-status]");

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

  const existing = instances.get(pageRoot);

  if (existing) {
    return existing;
  }

  const tabs = pageRoot.querySelector(SELECTORS.tabs);

  if (!tabs) {
    throw new Error("Issuer Trading tabs container was not found.");
  }

  const config = getIssuerTradingConfig();

  const featureInstances = new Map();

  const abortController = new AbortController();

  let activeTabKey = "";

  let destroyed = false;

  /* ========================================================================
     Feature Creation
     ======================================================================== */

  function getFeature(tabKey) {
    return featureInstances.get(tabKey) || null;
  }

  function createFeature(tabKey) {
    const existingFeature = getFeature(tabKey);

    if (existingFeature) {
      return existingFeature;
    }

    const definition = FEATURE_DEFINITIONS[tabKey];

    /*
     * Tabs without a completed module remain valid placeholders.
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

    const feature = definition.create({
      root: featureRoot,
      config,
    });

    featureInstances.set(tabKey, feature);

    return feature;
  }

  /* ========================================================================
     Feature Activation
     ======================================================================== */

  async function activateFeature(tabKey) {
    if (destroyed) {
      return null;
    }

    const normalizedTabKey = normalizeString(tabKey);

    if (!normalizedTabKey) {
      return null;
    }

    const currentFeature = getFeature(activeTabKey);

    /*
     * Ignore duplicate initial tab events emitted by the tabs controller.
     */

    if (normalizedTabKey === activeTabKey && currentFeature?.isActive?.()) {
      return currentFeature;
    }

    if (currentFeature && activeTabKey !== normalizedTabKey) {
      currentFeature.deactivate();
    }

    activeTabKey = normalizedTabKey;

    const nextFeature = createFeature(normalizedTabKey);

    /*
     * Placeholder tab: visual tab behavior still works, but there is no data
     * module to activate yet.
     */

    if (!nextFeature) {
      return null;
    }

    await nextFeature.activate();

    return nextFeature;
  }

  /* ========================================================================
     Tab Events
     ======================================================================== */

  function handleTabChange(event) {
    const tabKey = getEventTabKey(event);

    if (!tabKey) {
      return;
    }

    activateFeature(tabKey).catch((error) => {
      reportLifecycleError({
        pageRoot,

        tabKey,

        error,

        config,
      });
    });
  }

  tabs.addEventListener("tab:change", handleTabChange, {
    signal: abortController.signal,
  });

  /* ========================================================================
     Initial Feature
     ======================================================================== */

  const initialTabKey = getInitialTabKey(pageRoot, tabs);

  activateFeature(initialTabKey).catch((error) => {
    reportLifecycleError({
      pageRoot,

      tabKey: initialTabKey,

      error,

      config,
    });
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

      abortController.abort();

      featureInstances.forEach((feature) => {
        feature.destroy();
      });

      featureInstances.clear();

      activeTabKey = "";

      instances.delete(pageRoot);
    },

    reload() {
      const feature = getFeature(activeTabKey);

      return feature ? feature.reload() : Promise.resolve(null);
    },

    getActiveTab() {
      return activeTabKey;
    },

    getFeature(tabKey) {
      return getFeature(normalizeString(tabKey));
    },

    getFeatures() {
      return new Map(featureInstances);
    },
  });

  instances.set(pageRoot, instance);

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
