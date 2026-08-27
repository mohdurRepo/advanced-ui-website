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
 * - preserve placeholder tabs
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

import { createAccumulatedLossesTab } from "./tabs/accumulated-losses/accumulated-losses.tab.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TAB = "negotiated-deals";

const TAB_ID_PREFIXES = Object.freeze([
  "issuer-trading-panel-",
  "issuer-trading-tab-",
  "tab-",
]);

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
 * Tabs without a definition remain valid visual placeholders.
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
   General Helpers
   ========================================================================== */

function isElement(value) {
  return Boolean(value && value.nodeType === 1);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeTabKey(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return "";
  }

  if (Object.prototype.hasOwnProperty.call(FEATURE_DEFINITIONS, normalized)) {
    return normalized;
  }

  for (const prefix of TAB_ID_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }

  return normalized;
}

function resolvePageRoot(root) {
  if (isElement(root) && root.matches(SELECTORS.root)) {
    return root;
  }

  if (root && typeof root.querySelector === "function") {
    return root.querySelector(SELECTORS.root);
  }

  return null;
}

function getInitialTabKey(pageRoot, tabs) {
  const activeTab = tabs.querySelector(SELECTORS.activeTab);

  const activeTabKey = normalizeTabKey(activeTab?.dataset.tab);

  if (activeTabKey) {
    return activeTabKey;
  }

  const activePanel = pageRoot.querySelector(SELECTORS.activePanel);

  const activePanelKey = normalizeTabKey(activePanel?.dataset.tab);

  return activePanelKey || DEFAULT_TAB;
}

function getEventTabKey(event) {
  return normalizeTabKey(
    event?.detail?.tabKey ??
      event?.detail?.tab ??
      event?.detail?.key ??
      event?.detail?.target,
  );
}

function resolveFeatureRoot(pageRoot, definition) {
  if (!definition?.selector) {
    return null;
  }

  return pageRoot.querySelector(definition.selector);
}

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
   Lifecycle Error
   ========================================================================== */

function reportLifecycleError({ pageRoot, tabKey, error, config }) {
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

  /* =========================================================================
     Feature Activation
     ========================================================================== */

  async function activateFeature(tabKey) {
    if (destroyed) {
      return null;
    }

    const normalizedTabKey = normalizeTabKey(tabKey);

    if (!normalizedTabKey) {
      return null;
    }

    const currentFeature = findFeature(activeTabKey);

    /*
     * The tabs controller may emit its initial tab event after this module
     * has already activated that same tab.
     *
     * Returning the existing feature avoids a duplicate request.
     */

    if (normalizedTabKey === activeTabKey && currentFeature) {
      return currentFeature;
    }

    if (currentFeature && activeTabKey !== normalizedTabKey) {
      currentFeature.deactivate();
    }

    activeTabKey = normalizedTabKey;

    const nextFeature = createFeature(normalizedTabKey);

    /*
     * Placeholder tab:
     *
     * Visual tab behavior remains functional, but no data module is created.
     */

    if (!nextFeature) {
      return null;
    }

    await nextFeature.activate();

    return nextFeature;
  }

  /* =========================================================================
     Tab Events
     ========================================================================== */

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

  /* =========================================================================
     Initial Feature
     ========================================================================== */

  const initialTabKey = getInitialTabKey(pageRoot, tabs);

  activateFeature(initialTabKey).catch((error) => {
    reportLifecycleError({
      pageRoot,

      tabKey: initialTabKey,

      error,

      config,
    });
  });

  /* =========================================================================
     Public Instance
     ========================================================================== */

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
      const feature = findFeature(activeTabKey);

      return feature ? feature.reload() : Promise.resolve(null);
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
