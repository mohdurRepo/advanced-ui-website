/* ==========================================================================
   Issuer Trading
   ========================================================================== */

/*
 * Page-level entry point for Issuer Trading.
 *
 * Responsibilities:
 *
 * - read validated JSP configuration
 * - observe the existing design-system tabs
 * - lazily create tab-specific data modules
 * - activate and deactivate data modules
 * - preserve placeholder tabs
 * - destroy page resources
 *
 * This module intentionally does not:
 *
 * - implement tab UI behavior
 * - change active tab classes
 * - change ARIA tab state
 * - show or hide tab panels
 * - contain tab-specific business logic
 *
 * Visual tab behavior remains owned by the design-system tabs controller.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { getIssuerTradingConfig } from "./issuer-trading-config.js";

import { createNegotiatedDealsTab } from "./tabs/negotiated-deals/negotiated-deals.tab.js";

import { createAccumulatedLossesTab } from "./tabs/accumulated-losses/accumulated-losses.tab.js";

import { createListedTradableRightsTab } from "./tabs/listed-tradable-rights/listed-tradable-rights.tab.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TAB = "negotiated-deals";

const TAB_CHANGE_EVENTS = Object.freeze(["tab:change", "tabs:change"]);

const TAB_ID_PREFIXES = Object.freeze([
  "issuer-trading-panel-",
  "issuer-trading-tab-",
  "tab-",
]);

const SELECTORS = Object.freeze({
  root: "[data-issuer-trading]",

  tabs: "[data-tabs]",

  tab: ['[role="tab"][data-tab]', '[role="tab"][data-tab-target]'].join(", "),

  activeTab: '[role="tab"][aria-selected="true"]',

  activePanel: ".tab-pane:not([hidden])",
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

  "listed-tradable-rights": Object.freeze({
    selector: '[data-issuer-trading-feature="listed-tradable-rights"]',

    statusSelector: "[data-listed-tradable-rights-status]",

    create({ root, config }) {
      return createListedTradableRightsTab({
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
  const normalized = normalizeString(value).replace(/^#/, "");

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

  const activeTabKey = getTabElementKey(activeTab);

  if (activeTabKey) {
    return activeTabKey;
  }

  const activePanel = pageRoot.querySelector(SELECTORS.activePanel);

  const activePanelKey = normalizeTabKey(
    activePanel?.dataset.tab || activePanel?.id,
  );

  return activePanelKey || DEFAULT_TAB;
}

function getEventTabKey(event) {
  const detailTarget = event?.detail?.target;

  if (isElement(detailTarget)) {
    return getTabElementKey(detailTarget);
  }

  return normalizeTabKey(
    event?.detail?.tabKey ??
      event?.detail?.tab ??
      event?.detail?.key ??
      detailTarget,
  );
}

function getClickedTab(event, tabs) {
  const target = event?.target;

  if (!isElement(target)) {
    return null;
  }

  const tab = target.closest(SELECTORS.tab);

  return tab && tabs.contains(tab) ? tab : null;
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

  let tabStateObserver = null;

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

  /* ========================================================================
     Feature Activation
     ======================================================================== */

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
     * A click, an accessibility-state mutation, and an optional custom
     * tab-change event may all report the same activation.
     *
     * Ignore duplicates to prevent duplicate service requests.
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

  /* ========================================================================
     Safe Feature Activation
     ======================================================================== */

  function requestFeatureActivation(tabKey) {
    const normalizedTabKey = normalizeTabKey(tabKey);

    if (!normalizedTabKey) {
      return;
    }

    activateFeature(normalizedTabKey).catch((error) => {
      reportLifecycleError({
        pageRoot,

        tabKey: normalizedTabKey,

        error,

        config,
      });
    });
  }

  /* ========================================================================
     Design-System Tab Clicks
     ======================================================================== */

  function handleTabClick(event) {
    const tab = getClickedTab(event, tabs);

    if (!tab) {
      return;
    }

    /*
     * This does not alter the visual tab state.
     *
     * The design-system controller processes data-tab-target and owns the
     * corresponding active classes, ARIA state, and panel visibility.
     */

    requestFeatureActivation(getTabElementKey(tab));
  }

  tabs.addEventListener("click", handleTabClick, {
    signal: abortController.signal,
  });

  /* ========================================================================
     Optional Tab Change Events
     ======================================================================== */

  function handleTabChange(event) {
    requestFeatureActivation(getEventTabKey(event));
  }

  TAB_CHANGE_EVENTS.forEach((eventName) => {
    tabs.addEventListener(eventName, handleTabChange, {
      signal: abortController.signal,
    });
  });

  /* ========================================================================
     Accessibility-State Observation
     ======================================================================== */

  /*
   * Some design-system controllers activate tabs through keyboard navigation
   * without dispatching a public custom event.
   *
   * Observing aria-selected keeps the data lifecycle synchronized without
   * duplicating or replacing the visual controller.
   */

  tabStateObserver = new MutationObserver((mutations) => {
    const selectionChanged = mutations.some(
      (mutation) =>
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected",
    );

    if (!selectionChanged) {
      return;
    }

    const selectedTab = tabs.querySelector(SELECTORS.activeTab);

    requestFeatureActivation(getTabElementKey(selectedTab));
  });

  tabStateObserver.observe(tabs, {
    subtree: true,

    attributes: true,

    attributeFilter: ["aria-selected"],
  });

  /* ========================================================================
     Initial Feature
     ======================================================================== */

  const initialTabKey = getInitialTabKey(pageRoot, tabs);

  requestFeatureActivation(initialTabKey);

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

      tabStateObserver?.disconnect();

      tabStateObserver = null;

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
