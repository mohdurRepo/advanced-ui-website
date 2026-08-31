/* ==========================================================================
   Issuer Financial Calendars
   ========================================================================== */

/*
 * Page-level entry point for Issuer Financial Calendars.
 *
 * Responsibilities:
 *
 * - read validated JSP configuration
 * - listen to the shared design-system tabs controller
 * - lazily create completed calendar-tab modules
 * - activate and deactivate data modules
 * - prevent duplicate activation requests
 * - destroy all page-owned resources
 *
 * This module intentionally does not:
 *
 * - implement visual tab behavior
 * - change tab ARIA state
 * - show or hide tab panels
 * - contain tab-specific request or presentation logic
 *
 * Visual tab behavior remains owned by the shared tabs controller.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { getIssuerFinancialCalendarsConfig } from "./issuer-financial-calendars.config.js";

import { createDividendsTab } from "./tabs/dividends/dividends.tab.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_TAB = "dividends";

const TAB_CHANGE_EVENT = "tabs:change";

const SELECTORS = Object.freeze({
  root: "[data-issuer-financial-calendars]",

  tabs: '[data-tabs][data-tabs-id="issuer-financial-calendars"]',

  activeTab: '[role="tab"][data-financial-calendar-tab][aria-selected="true"]',

  activePanel: ':scope > .tabs-content > [role="tabpanel"]:not([hidden])',
});

/* ==========================================================================
   Feature Definitions
   ========================================================================== */

/*
 * Add each remaining calendar module only after that tab is complete.
 *
 * Tabs without a definition remain valid visual placeholders and do not make
 * API requests.
 */

const FEATURE_DEFINITIONS = Object.freeze({
  dividends: Object.freeze({
    selector: '[data-issuer-financial-calendars-feature="dividends"]',

    statusSelector: "[data-dividends-status]",

    create({ root, config }) {
      return createDividendsTab({
        root,

        config,

        autoInit: false,

        active: false,

        reloadOnActivate: true,
      });
    },
  }),

  /*
   * Added after the Dividends tab is confirmed:
   *
   * "general-meetings"
   * "board-sessions"
   * "corporate-actions"
   */
});

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizeString(value) {
  return String(value ?? "").trim();
}

function resolvePageRoot(root) {
  if (
    typeof Element !== "undefined" &&
    root instanceof Element &&
    root.matches(SELECTORS.root)
  ) {
    return root;
  }

  if (root && typeof root.querySelector === "function") {
    return root.querySelector(SELECTORS.root);
  }

  return null;
}

function resolveFeatureRoot(pageRoot, definition) {
  if (!definition?.selector) {
    return null;
  }

  return pageRoot.querySelector(definition.selector);
}

function getTabKeyFromElement(element) {
  if (!(element instanceof Element)) {
    return "";
  }

  return normalizeString(element.dataset.financialCalendarTab);
}

function getPanelTabKey(panel) {
  if (!(panel instanceof Element)) {
    return "";
  }

  const featureRoot = panel.querySelector(
    "[data-issuer-financial-calendars-feature]",
  );

  return normalizeString(featureRoot?.dataset.issuerFinancialCalendarsFeature);
}

function getInitialTabKey(pageRoot, tabs, config) {
  const activeTab = tabs.querySelector(SELECTORS.activeTab);

  const activeTabKey = getTabKeyFromElement(activeTab);

  if (activeTabKey) {
    return activeTabKey;
  }

  const configuredTabKey = normalizeString(
    pageRoot.dataset.initialCalendarTab || config.initialTab,
  );

  if (configuredTabKey) {
    return configuredTabKey;
  }

  const activePanel = tabs.querySelector(SELECTORS.activePanel);

  const activePanelKey = getPanelTabKey(activePanel);

  return activePanelKey || DEFAULT_TAB;
}

function getEventTabKey(event) {
  const detail = event?.detail || {};

  const tabElementKey = getTabKeyFromElement(detail.tab);

  if (tabElementKey) {
    return tabElementKey;
  }

  const directKey = normalizeString(
    detail.tabKey ?? detail.key ?? detail.calendarTab,
  );

  if (directKey) {
    return directKey;
  }

  const panelKey = getPanelTabKey(detail.panel);

  if (panelKey) {
    return panelKey;
  }

  const targetId = normalizeString(detail.targetId);

  if (!targetId) {
    return "";
  }

  const prefix = "issuer-financial-calendars-panel-";

  return targetId.startsWith(prefix) ? targetId.slice(prefix.length) : "";
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
    new CustomEvent("issuer-financial-calendars:error", {
      bubbles: true,

      detail: Object.freeze({
        tabKey,

        phase: "lifecycle",

        error,
      }),
    }),
  );
}

/* ==========================================================================
   Public Initialization
   ========================================================================== */

export function initIssuerFinancialCalendars(root = document) {
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
    throw new Error("Issuer Financial Calendars tabs container was not found.");
  }

  const config = getIssuerFinancialCalendarsConfig();

  const featureInstances = new Map();

  const abortController = new AbortController();

  let activeTabKey = "";

  let activationId = 0;

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
     * Tabs without a completed data module remain functional placeholders.
     */

    if (!definition) {
      return null;
    }

    const featureRoot = resolveFeatureRoot(pageRoot, definition);

    if (!featureRoot) {
      throw new Error(
        `Issuer Financial Calendars feature root was not found for "${tabKey}".`,
      );
    }

    const feature = definition.create({
      root: featureRoot,

      config,
    });

    if (!feature || typeof feature.activate !== "function") {
      throw new TypeError(
        `Issuer Financial Calendars feature "${tabKey}" did not return a valid lifecycle instance.`,
      );
    }

    featureInstances.set(tabKey, feature);

    return feature;
  }

  /* ========================================================================
     Feature Activation
     ======================================================================== */

  async function activateFeature(tabKey, settings = {}) {
    if (destroyed) {
      return null;
    }

    const normalizedTabKey = normalizeString(tabKey);

    if (!normalizedTabKey) {
      return null;
    }

    const currentFeature = getFeature(activeTabKey);

    /*
     * Ignore duplicate initialization or activation events.
     *
     * This is important because a duplicate activation would otherwise make
     * the same API request twice.
     */

    if (
      normalizedTabKey === activeTabKey &&
      currentFeature?.isActive?.() &&
      settings.reload !== true
    ) {
      return currentFeature;
    }

    const currentActivationId = ++activationId;

    if (currentFeature && activeTabKey !== normalizedTabKey) {
      currentFeature.deactivate();
    }

    activeTabKey = normalizedTabKey;

    const nextFeature = createFeature(normalizedTabKey);

    /*
     * Placeholder tab: visual tab behavior still works, but no API module is
     * created until that tab is implemented.
     */

    if (!nextFeature) {
      return null;
    }

    await nextFeature.activate(settings);

    if (destroyed || currentActivationId !== activationId) {
      return null;
    }

    return nextFeature;
  }

  /* ========================================================================
     Tab Events
     ======================================================================== */

  function handleTabChange(event) {
    /*
     * Ignore events bubbling from a nested tabs component.
     */

    if (event.target !== tabs) {
      return;
    }

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

      activationId += 1;

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

  /* ========================================================================
     Initial Feature
     ======================================================================== */

  const initialTabKey = getInitialTabKey(pageRoot, tabs, config);

  activateFeature(initialTabKey).catch((error) => {
    reportLifecycleError({
      pageRoot,

      tabKey: initialTabKey,

      error,

      config,
    });
  });

  return instance;
}

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  document.querySelectorAll(SELECTORS.root).forEach((pageRoot) => {
    try {
      initIssuerFinancialCalendars(pageRoot);
    } catch (error) {
      pageRoot.dispatchEvent(
        new CustomEvent("issuer-financial-calendars:error", {
          bubbles: true,

          detail: Object.freeze({
            tabKey: "",

            phase: "startup",

            error,
          }),
        }),
      );
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
