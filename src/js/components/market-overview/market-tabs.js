/* ==========================================================================
   Market Tabs
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Manage nested Market Details tab interfaces.
 * - Support Market View tabs.
 * - Support Market Movers tabs.
 * - Maintain roving tabindex.
 * - Synchronize aria-selected / aria-hidden / hidden / inert.
 * - Support keyboard navigation.
 * - Respect RTL horizontal navigation.
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
   Classes
   ========================================================================== */

const CLASSES = {
  active: "is-active",
};

/* ==========================================================================
   Events
   ========================================================================== */

const EVENTS = {
  change: "market:tabchange",
};

/* ==========================================================================
   Types
   ========================================================================== */

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

/* ==========================================================================
   Helpers
   ========================================================================== */

function isRTL(element) {
  if (!element) {
    return false;
  }

  return window.getComputedStyle(element).direction === "rtl";
}

function prefersReducedMotion() {
  if (document.documentElement.dataset.motion === "reduce") {
    return true;
  }

  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function getScrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}

function isDisabledTab(tab) {
  return Boolean(
    !tab ||
    tab.disabled ||
    tab.getAttribute("aria-disabled") === "true" ||
    tab.classList.contains("is-disabled"),
  );
}

/* ==========================================================================
   Element Collection
   ========================================================================== */

function collectTabElements(root, config) {
  if (!root || !config) {
    return null;
  }

  /*
   * Only collect tabs belonging directly to this tab component.
   *
   * This prevents a Funds market-view instance from accidentally collecting
   * Movers tabs nested inside one of its view panels.
   */

  const tabs = Array.from(root.querySelectorAll(config.tabSelector)).filter(
    (tab) => tab.closest(config.rootSelector) === root,
  );

  const panels = Array.from(root.querySelectorAll(config.panelSelector)).filter(
    (panel) => panel.closest(config.rootSelector) === root,
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
   State Access
   ========================================================================== */

function getState(root) {
  return tabStates.get(root) || null;
}

/* ==========================================================================
   Panel Resolution
   ========================================================================== */

function getPanelById(elements, panelId) {
  if (!elements || !panelId) {
    return null;
  }

  return elements.panels.find((panel) => panel.id === panelId) || null;
}

function getPanelForTab(elements, tab) {
  if (!elements || !tab) {
    return null;
  }

  const panelId = tab.getAttribute("aria-controls");

  return getPanelById(elements, panelId);
}

/* ==========================================================================
   Active Tab Resolution
   ========================================================================== */

function getActiveTab(elements) {
  if (!elements) {
    return null;
  }

  const enabledTabs = elements.tabs.filter((tab) => !isDisabledTab(tab));

  if (!enabledTabs.length) {
    return null;
  }

  return (
    enabledTabs.find((tab) => tab.getAttribute("aria-selected") === "true") ||
    enabledTabs.find((tab) => tab.classList.contains(CLASSES.active)) ||
    enabledTabs[0]
  );
}

/* ==========================================================================
   Tab State
   ========================================================================== */

function setTabState(tab, active) {
  if (!tab) {
    return;
  }

  tab.classList.toggle(CLASSES.active, active);

  tab.setAttribute("aria-selected", String(active));

  /*
   * Disabled controls remain outside the roving tab stop.
   */

  tab.setAttribute("tabindex", active && !isDisabledTab(tab) ? "0" : "-1");
}

/* ==========================================================================
   Panel State
   ========================================================================== */

function setPanelState(panel, active) {
  if (!panel) {
    return;
  }

  panel.classList.toggle(CLASSES.active, active);

  panel.hidden = !active;

  panel.setAttribute("aria-hidden", String(!active));

  if ("inert" in panel) {
    panel.inert = !active;
  }
}

/* ==========================================================================
   Scroll Reset
   ========================================================================== */

function resetPanelScroll(panel) {
  if (!panel) {
    return;
  }

  panel.scrollTop = 0;

  panel.scrollLeft = 0;

  /*
   * Movers itself is now a desktop scrolling surface.
   *
   * Reset it whenever that Movers tab becomes active so switching:
   *
   * Gainers → Losers → Gainers
   *
   * returns each list to its logical beginning.
   */

  if (panel.matches(SELECTORS.moversPanel)) {
    panel.scrollTop = 0;
  }
}

/* ==========================================================================
   Tab Visibility
   ========================================================================== */

function revealTab(tab) {
  if (!tab) {
    return;
  }

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
  if (!elements || !tab || !panel) {
    return;
  }

  const overview = elements.root.closest(SELECTORS.overview);

  tab.dispatchEvent(
    new CustomEvent(EVENTS.change, {
      bubbles: true,

      detail: {
        type: elements.type,

        tab,

        panel,

        root: elements.root,

        overview,

        tabId: tab.id || null,

        panelId: panel.id || null,
      },
    }),
  );
}

/* ==========================================================================
   Settled Layout Refresh
   ========================================================================== */

function requestSettledRefresh(elements, tab, panel) {
  const state = getState(elements?.root);

  if (!state || !panel) {
    return;
  }

  /*
   * A fast sequence of keyboard/click changes should result in only one final
   * geometry refresh.
   */

  if (state.refreshFrame !== null) {
    window.cancelAnimationFrame(state.refreshFrame);
  }

  state.refreshFrame = window.requestAnimationFrame(() => {
    state.refreshFrame = window.requestAnimationFrame(() => {
      state.refreshFrame = null;

      if (!elements.root.isConnected || panel.hidden) {
        return;
      }

      /*
       * market:tabchange is the primary explicit refresh signal.
       */

      dispatchTabChange(elements, tab, panel);

      /*
       * Temporary compatibility for Highcharts / legacy layout
       * consumers that still reflow from window resize.
       *
       * Remove in the chart cleanup phase.
       */

      window.dispatchEvent(new Event("resize"));
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
  if (!elements || !tab || isDisabledTab(tab)) {
    return false;
  }

  if (!elements.tabs.includes(tab)) {
    return false;
  }

  const panel = getPanelForTab(elements, tab);

  if (!panel) {
    return false;
  }

  const state = getState(elements.root);

  if (!state) {
    return false;
  }

  const alreadyActive =
    state.activeTab === tab &&
    state.activePanel === panel &&
    tab.getAttribute("aria-selected") === "true" &&
    !panel.hidden &&
    panel.getAttribute("aria-hidden") === "false";

  if (alreadyActive && !force) {
    if (focus) {
      tab.focus({
        preventScroll: true,
      });
    }

    if (scroll) {
      revealTab(tab);
    }

    return false;
  }

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

  if (focus) {
    tab.focus({
      preventScroll: true,
    });
  }

  if (scroll) {
    revealTab(tab);
  }

  if (dispatch) {
    requestSettledRefresh(elements, tab, panel);
  }

  return true;
}

/* ==========================================================================
   Enabled Tabs
   ========================================================================== */

function getEnabledTabs(elements) {
  if (!elements) {
    return [];
  }

  return elements.tabs.filter((tab) => !isDisabledTab(tab));
}

/* ==========================================================================
   Adjacent Tab
   ========================================================================== */

function getAdjacentTab(elements, currentTab, direction) {
  const tabs = getEnabledTabs(elements);

  if (!tabs.length) {
    return null;
  }

  const currentIndex = tabs.indexOf(currentTab);

  if (currentIndex < 0) {
    return tabs[0];
  }

  let step = direction === "next" ? 1 : -1;

  /*
   * Horizontal keyboard direction follows visual direction.
   */

  if (isRTL(elements.root)) {
    step *= -1;
  }

  const nextIndex = (currentIndex + step + tabs.length) % tabs.length;

  return tabs[nextIndex];
}

/* ==========================================================================
   Click
   ========================================================================== */

function handleClick(elements, event) {
  const tab = event.target.closest(elements.config.tabSelector);

  if (!tab || tab.closest(elements.config.rootSelector) !== elements.root) {
    return;
  }

  if (isDisabledTab(tab)) {
    event.preventDefault();

    return;
  }

  activateTab(elements, tab, {
    focus: false,

    scroll: true,
  });
}

/* ==========================================================================
   Keyboard
   ========================================================================== */

function handleKeydown(elements, event) {
  const tab = event.target.closest(elements.config.tabSelector);

  if (!tab || tab.closest(elements.config.rootSelector) !== elements.root) {
    return;
  }

  const tabs = getEnabledTabs(elements);

  if (!tabs.length) {
    return;
  }

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
   * Automatic activation follows the existing Summary interaction model:
   * moving focus with arrows also activates the corresponding tab.
   */

  activateTab(elements, nextTab, {
    focus: true,

    scroll: true,
  });
}

/* ==========================================================================
   Initialization State
   ========================================================================== */

function initializeTabState(elements) {
  const activeTab = getActiveTab(elements);

  if (!activeTab) {
    return;
  }

  /*
   * Normalize potentially inconsistent server-rendered state.
   *
   * The selected tab is the source of truth and aria-controls defines its
   * panel.
   */

  activateTab(elements, activeTab, {
    focus: false,

    scroll: false,

    resetScroll: false,

    force: true,

    /*
     * Initial normalization does not need to emit tabchange. The currently
     * visible outer panel/chart will receive its normal initialization and
     * panelshown/detailsshown events.
     */

    dispatch: false,
  });
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function initializeTabEvents(elements) {
  elements.root.addEventListener("click", (event) => {
    handleClick(elements, event);
  });

  elements.root.addEventListener("keydown", (event) => {
    handleKeydown(elements, event);
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

  initializeTabEvents(elements);

  initializeTabState(elements);
}

/* ==========================================================================
   Type Initialization
   ========================================================================== */

function initializeTabType(config) {
  document.querySelectorAll(config.rootSelector).forEach((root) => {
    initializeTabRoot(root, config);
  });
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketTabs() {
  TAB_CONFIGS.forEach((config) => {
    initializeTabType(config);
  });
}
