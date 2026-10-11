/* ==========================================================================
   Market Tabs
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Manage nested Market Details tab interfaces (Market Views and Movers).
 * - Maintain roving tabindex.
 * - Synchronize aria-selected / aria-hidden / hidden / inert.
 * - Support keyboard navigation, following visual direction in RTL.
 * - Publish market:tabchange for dependent components.
 * - Reset newly activated panel scroll position.
 *
 * This module does NOT own:
 *
 * - Summary market-card selection.
 * - Outer market panel switching.
 * - Mobile Details expansion.
 * - Bridge geometry.
 * - Market chart implementation.
 */

import {
  dispatchCompatibilityResize,
  getScrollBehavior,
  isRTL,
} from "./market-shared";

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = {
  overview: "[data-market-overview]",

  viewRoot: ".market-views",
  viewTab: "[data-market-view-tab]",
  viewPanel: "[data-market-view-panel]",

  moversRoot: "[data-market-movers]",
  moversTab: "[data-market-movers-tab]",
  moversPanel: "[data-market-movers-panel]",
};

/* ==========================================================================
   Classes / Events / Types
   ========================================================================== */

const CLASSES = {
  active: "is-active",
};

const EVENTS = {
  change: "market:tabchange",
};

const TYPES = {
  view: "view",
  movers: "movers",
};

/* ==========================================================================
   Configuration
   ========================================================================== */

const TAB_CONFIGS = [
  {
    type: TYPES.view,

    rootSelector: SELECTORS.viewRoot,
    tabSelector: SELECTORS.viewTab,
    panelSelector: SELECTORS.viewPanel,
  },

  {
    type: TYPES.movers,

    rootSelector: SELECTORS.moversRoot,
    tabSelector: SELECTORS.moversTab,
    panelSelector: SELECTORS.moversPanel,
  },
];

/* ==========================================================================
   State
   ========================================================================== */

const initializedTabRoots = new WeakSet();

const tabStates = new WeakMap();

function getState(root) {
  return tabStates.get(root) || null;
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function isDisabledTab(tab) {
  return Boolean(
    !tab ||
    tab.disabled ||
    tab.getAttribute("aria-disabled") === "true" ||
    tab.classList.contains("is-disabled"),
  );
}

/*
 * True when `element` belongs directly to this tab component, not to a
 * nested one (a Funds view panel contains its own Movers tabs).
 */

function belongsTo(element, elements) {
  return element.closest(elements.config.rootSelector) === elements.root;
}

/* ==========================================================================
   Element Collection
   ========================================================================== */

function collectTabElements(root, config) {
  if (!root || !config) {
    return null;
  }

  const scope = { root, config };

  const tabs = Array.from(root.querySelectorAll(config.tabSelector)).filter(
    (tab) => belongsTo(tab, scope),
  );

  const panels = Array.from(root.querySelectorAll(config.panelSelector)).filter(
    (panel) => belongsTo(panel, scope),
  );

  if (!tabs.length || !panels.length) {
    return null;
  }

  return {
    root,

    type: config.type,

    config,

    tabs,

    panels,
  };
}

/* ==========================================================================
   Resolution
   ========================================================================== */

function getPanelForTab(elements, tab) {
  const panelId = tab?.getAttribute("aria-controls");

  if (!panelId) {
    return null;
  }

  return elements.panels.find((panel) => panel.id === panelId) || null;
}

function getEnabledTabs(elements) {
  return elements ? elements.tabs.filter((tab) => !isDisabledTab(tab)) : [];
}

function getActiveTab(elements) {
  const enabledTabs = getEnabledTabs(elements);

  return (
    enabledTabs.find((tab) => tab.getAttribute("aria-selected") === "true") ||
    enabledTabs.find((tab) => tab.classList.contains(CLASSES.active)) ||
    enabledTabs[0] ||
    null
  );
}

/* ==========================================================================
   Tab / Panel State
   ========================================================================== */

function setTabState(tab, active) {
  tab.classList.toggle(CLASSES.active, active);

  tab.setAttribute("aria-selected", String(active));

  /*
   * Disabled controls stay outside the roving tab stop.
   */

  tab.setAttribute("tabindex", active && !isDisabledTab(tab) ? "0" : "-1");
}

function setPanelState(panel, active) {
  panel.classList.toggle(CLASSES.active, active);

  panel.hidden = !active;

  panel.setAttribute("aria-hidden", String(!active));

  if ("inert" in panel) {
    panel.inert = !active;
  }
}

/*
 * Switching Gainers → Losers → Gainers returns each list to its start.
 */

function resetPanelScroll(panel) {
  panel.scrollTop = 0;

  panel.scrollLeft = 0;
}

function revealTab(tab) {
  tab.scrollIntoView({
    behavior: getScrollBehavior(),

    block: "nearest",

    inline: "nearest",
  });
}

/* ==========================================================================
   Change Event
   ========================================================================== */

function dispatchTabChange(elements, tab, panel) {
  tab.dispatchEvent(
    new CustomEvent(EVENTS.change, {
      bubbles: true,

      detail: {
        type: elements.type,

        tab,

        panel,

        root: elements.root,

        overview: elements.root.closest(SELECTORS.overview),

        tabId: tab.id || null,

        panelId: panel.id || null,
      },
    }),
  );
}

/* ==========================================================================
   Settled Layout Refresh
   ========================================================================== */

/*
 * A fast sequence of keyboard / click changes results in one final refresh,
 * two frames after the last change so geometry has settled.
 */

function requestSettledRefresh(elements, tab, panel) {
  const state = getState(elements.root);

  if (!state) {
    return;
  }

  if (state.refreshFrame !== null) {
    window.cancelAnimationFrame(state.refreshFrame);
  }

  state.refreshFrame = window.requestAnimationFrame(() => {
    state.refreshFrame = window.requestAnimationFrame(() => {
      state.refreshFrame = null;

      if (!elements.root.isConnected || panel.hidden) {
        return;
      }

      dispatchTabChange(elements, tab, panel);

      dispatchCompatibilityResize();
    });
  });
}

/* ==========================================================================
   Activate Tab
   ========================================================================== */

function activateTab(
  elements,
  tab,
  {
    focus = false,
    scroll = false,
    resetScroll = true,
    force = false,
    dispatch = true,
  } = {},
) {
  if (!elements?.tabs.includes(tab) || isDisabledTab(tab)) {
    return false;
  }

  const panel = getPanelForTab(elements, tab);

  const state = getState(elements.root);

  if (!panel || !state) {
    return false;
  }

  const alreadyActive =
    state.activeTab === tab &&
    state.activePanel === panel &&
    tab.getAttribute("aria-selected") === "true" &&
    !panel.hidden;

  if (!alreadyActive || force) {
    elements.tabs.forEach((candidate) => {
      setTabState(candidate, candidate === tab);
    });

    elements.panels.forEach((candidate) => {
      setPanelState(candidate, candidate === panel);
    });

    state.activeTab = tab;

    state.activePanel = panel;

    if (resetScroll) {
      resetPanelScroll(panel);
    }
  }

  if (focus) {
    tab.focus({
      preventScroll: true,
    });
  }

  if (scroll) {
    revealTab(tab);
  }

  if (dispatch && (!alreadyActive || force)) {
    requestSettledRefresh(elements, tab, panel);
  }

  return !alreadyActive || force;
}

/* ==========================================================================
   Keyboard
   ========================================================================== */

function getAdjacentTab(elements, currentTab, direction) {
  const tabs = getEnabledTabs(elements);

  const currentIndex = tabs.indexOf(currentTab);

  if (currentIndex < 0) {
    return tabs[0] || null;
  }

  /*
   * Horizontal keys follow visual direction.
   */

  const step =
    (direction === "next" ? 1 : -1) * (isRTL(elements.root) ? -1 : 1);

  return tabs[(currentIndex + step + tabs.length) % tabs.length];
}

function handleKeydown(elements, event) {
  const tab = event.target.closest(elements.config.tabSelector);

  if (!tab || !belongsTo(tab, elements)) {
    return;
  }

  const tabs = getEnabledTabs(elements);

  let nextTab = null;

  switch (event.key) {
    case "ArrowRight":
      nextTab = getAdjacentTab(elements, tab, "next");
      break;

    case "ArrowLeft":
      nextTab = getAdjacentTab(elements, tab, "previous");
      break;

    case "Home":
      nextTab = tabs[0];
      break;

    case "End":
      nextTab = tabs[tabs.length - 1];
      break;

    case "Enter":
    case " ":
      event.preventDefault();

      activateTab(elements, tab, {
        focus: true,
        scroll: true,
      });

      return;

    default:
      return;
  }

  if (!nextTab) {
    return;
  }

  event.preventDefault();

  /*
   * Automatic activation, matching the Summary: moving focus with the
   * arrows also activates the tab.
   */

  activateTab(elements, nextTab, {
    focus: true,
    scroll: true,
  });
}

/* ==========================================================================
   Click
   ========================================================================== */

function handleClick(elements, event) {
  const tab = event.target.closest(elements.config.tabSelector);

  if (!tab || !belongsTo(tab, elements)) {
    return;
  }

  if (isDisabledTab(tab)) {
    event.preventDefault();

    return;
  }

  activateTab(elements, tab, {
    scroll: true,
  });
}

/* ==========================================================================
   Root Initialization
   ========================================================================== */

function initializeTabRoot(root, config) {
  if (!root || initializedTabRoots.has(root)) {
    return;
  }

  const elements = collectTabElements(root, config);

  if (!elements) {
    return;
  }

  tabStates.set(root, {
    elements,

    activeTab: null,

    activePanel: null,

    refreshFrame: null,
  });

  initializedTabRoots.add(root);

  root.addEventListener("click", (event) => {
    handleClick(elements, event);
  });

  root.addEventListener("keydown", (event) => {
    handleKeydown(elements, event);
  });

  /*
   * Normalize server-rendered state. The selected tab is the source of
   * truth, aria-controls defines its panel. No tabchange event: the
   * visible outer panel already receives its own initialization events.
   */

  const activeTab = getActiveTab(elements);

  if (activeTab) {
    activateTab(elements, activeTab, {
      resetScroll: false,

      force: true,

      dispatch: false,
    });
  }
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketTabs() {
  TAB_CONFIGS.forEach((config) => {
    document.querySelectorAll(config.rootSelector).forEach((root) => {
      initializeTabRoot(root, config);
    });
  });
}
