/* ==========================================================================
   Tabs
   ========================================================================== */

(() => {
  "use strict";

  /* ==========================================================================
     Constants
     ========================================================================== */

  const EVENT_NAME = "tabs:change";

  const SELECTORS = Object.freeze({
    root: ".tabs[data-tabs]",

    nav: ":scope > .tabs-nav",

    content: ":scope > .tabs-content",

    tab: ':scope > [role="tab"][data-tab-target]',

    panel: ':scope > [role="tabpanel"]',
  });

  const CLASSES = Object.freeze({
    active: "active",

    disabled: "is-disabled",
  });

  /* ==========================================================================
     General Helpers
     ========================================================================== */

  function isElement(value) {
    return value instanceof HTMLElement;
  }

  function isTabDisabled(tab) {
    return Boolean(
      tab.disabled ||
      tab.classList.contains(CLASSES.disabled) ||
      tab.getAttribute("aria-disabled") === "true",
    );
  }

  /**
   * Escape an element ID before using it in a selector.
   *
   * Kept as a shared helper for programmatic selectors and older browsers.
   *
   * @param {string} value
   * @returns {string}
   */
  function escapeSelector(value) {
    const normalized = String(value ?? "");

    if (window.CSS?.escape) {
      return window.CSS.escape(normalized);
    }

    return normalized.replace(/([^\w-])/g, "\\$1");
  }

  /* ==========================================================================
     Element Collection
     ========================================================================== */

  /**
   * Return only the tabs and panels owned directly by one tabs instance.
   *
   * Nested tabs are initialized independently.
   *
   * @param {HTMLElement} root
   * @returns {{
   *   nav: HTMLElement,
   *   content: HTMLElement,
   *   tabs: HTMLElement[],
   *   panels: HTMLElement[]
   * } | null}
   */
  function getTabElements(root) {
    if (!isElement(root)) {
      return null;
    }

    const nav = root.querySelector(SELECTORS.nav);

    const content = root.querySelector(SELECTORS.content);

    if (!isElement(nav) || !isElement(content)) {
      return null;
    }

    const tabs = Array.from(nav.querySelectorAll(SELECTORS.tab)).filter(
      isElement,
    );

    const panels = Array.from(content.querySelectorAll(SELECTORS.panel)).filter(
      isElement,
    );

    if (!tabs.length || !panels.length) {
      return null;
    }

    return {
      nav,
      content,
      tabs,
      panels,
    };
  }

  /* ==========================================================================
     Target Resolution
     ========================================================================== */

  /**
   * Find the panel targeted by a tab.
   *
   * @param {HTMLElement} tab
   * @param {HTMLElement[]} panels
   * @returns {HTMLElement | null}
   */
  function getTargetPanel(tab, panels) {
    const targetId = String(tab?.dataset?.tabTarget ?? "")
      .replace(/^#/, "")
      .trim();

    if (!targetId) {
      return null;
    }

    return panels.find((panel) => panel.id === targetId) || null;
  }

  /**
   * Return the stable application key associated with a tab.
   *
   * `data-tab` is preferred because `data-tab-target` usually contains a
   * longer DOM panel ID.
   *
   * @param {HTMLElement} tab
   * @param {HTMLElement} panel
   * @returns {string}
   */
  function getTabKey(tab, panel) {
    return String(
      tab?.dataset?.tab ||
        tab?.dataset?.tabTarget ||
        panel?.dataset?.tab ||
        panel?.id ||
        "",
    )
      .replace(/^#/, "")
      .trim();
  }

  /* ==========================================================================
     Current Selection
     ========================================================================== */

  function getSelectedTab(tabs) {
    return (
      tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ||
      tabs.find((tab) => tab.classList.contains(CLASSES.active)) ||
      null
    );
  }

  function getSelectedPanel(panels) {
    return (
      panels.find((panel) => !panel.hidden) ||
      panels.find((panel) => panel.classList.contains(CLASSES.active)) ||
      null
    );
  }

  /* ==========================================================================
     Relationship Setup
     ========================================================================== */

  function ensureRelationships(tabs, panels) {
    tabs.forEach((tab) => {
      const panel = getTargetPanel(tab, panels);

      if (!panel) {
        return;
      }

      if (!tab.id) {
        tab.id = `${panel.id}-tab`;
      }

      tab.setAttribute("aria-controls", panel.id);

      panel.setAttribute("aria-labelledby", tab.id);
    });
  }

  /* ==========================================================================
     State Synchronization
     ========================================================================== */

  function updateTabState(tabs, selectedTab) {
    tabs.forEach((tab) => {
      const isActive = tab === selectedTab;

      tab.classList.toggle(CLASSES.active, isActive);

      /*
       * Remove legacy duplicate state classes when present.
       *
       * The stylesheet may continue supporting them for backward
       * compatibility, but JavaScript owns one canonical class.
       */

      tab.classList.remove("is-active");

      tab.setAttribute("aria-selected", String(isActive));

      tab.setAttribute("tabindex", isActive ? "0" : "-1");
    });
  }

  function updatePanelState(panels, selectedPanel) {
    panels.forEach((panel) => {
      const isActive = panel === selectedPanel;

      panel.classList.toggle(CLASSES.active, isActive);

      panel.classList.remove("is-active");

      panel.hidden = !isActive;

      panel.setAttribute("aria-hidden", String(!isActive));
    });
  }

  /* ==========================================================================
     Change Event
     ========================================================================== */

  function dispatchTabChange({
    root,
    tab,
    panel,
    previousTab,
    previousPanel,
    reason,
  }) {
    root.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        bubbles: true,

        detail: Object.freeze({
          tab,

          panel,

          previousTab,

          previousPanel,

          tabKey: getTabKey(tab, panel),

          targetId: panel.id,

          reason,
        }),
      }),
    );
  }

  /* ==========================================================================
     Tab Activation
     ========================================================================== */

  /**
   * Activate one tab.
   *
   * The method is intentionally idempotent:
   *
   * - state is always normalized;
   * - selecting the active tab does not emit another tabs:change event;
   * - consumers therefore receive one event for one actual selection change.
   *
   * @param {HTMLElement} root
   * @param {HTMLElement} selectedTab
   * @param {{
   *   focus?: boolean,
   *   emit?: boolean,
   *   reason?: string
   * }} options
   * @returns {boolean}
   */
  function activateTab(
    root,
    selectedTab,
    { focus = false, emit = true, reason = "programmatic" } = {},
  ) {
    const elements = getTabElements(root);

    if (!elements || !elements.tabs.includes(selectedTab)) {
      return false;
    }

    const { tabs, panels } = elements;

    const selectedPanel = getTargetPanel(selectedTab, panels);

    if (!selectedPanel || isTabDisabled(selectedTab)) {
      return false;
    }

    const previousTab = getSelectedTab(tabs);

    const previousPanel = getSelectedPanel(panels);

    const selectionChanged =
      previousTab !== selectedTab || previousPanel !== selectedPanel;

    /*
     * Always synchronize the complete state. This also repairs incomplete
     * server-rendered markup without producing a duplicate activation event.
     */

    updateTabState(tabs, selectedTab);

    updatePanelState(panels, selectedPanel);

    if (focus) {
      selectedTab.focus();
    }

    if (emit && selectionChanged) {
      dispatchTabChange({
        root,

        tab: selectedTab,

        panel: selectedPanel,

        previousTab,

        previousPanel,

        reason,
      });
    }

    return selectionChanged;
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  /**
   * Initialize one tabs instance from its server-rendered state.
   *
   * The tab marked with either:
   *
   * - .active
   * - aria-selected="true"
   *
   * is respected. Otherwise, the first enabled tab is selected.
   *
   * Initialization does not emit tabs:change. Page modules must initialize
   * their active feature from the current ARIA/markup state once.
   *
   * @param {HTMLElement} root
   * @returns {boolean}
   */
  function initializeTabs(root) {
    if (!isElement(root) || root.dataset.tabsInitialized === "true") {
      return false;
    }

    const elements = getTabElements(root);

    if (!elements) {
      return false;
    }

    const { tabs, panels } = elements;

    ensureRelationships(tabs, panels);

    const initialTab =
      tabs.find(
        (tab) =>
          !isTabDisabled(tab) &&
          (tab.classList.contains(CLASSES.active) ||
            tab.getAttribute("aria-selected") === "true"),
      ) || tabs.find((tab) => !isTabDisabled(tab));

    if (!initialTab) {
      return false;
    }

    /*
     * Mark the instance before synchronizing it so dynamic DOM observers
     * cannot initialize the same root twice.
     */

    root.dataset.tabsInitialized = "true";

    activateTab(root, initialTab, {
      emit: false,

      reason: "initialization",
    });

    return true;
  }

  function initializeAllTabs(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    root
      .querySelectorAll(SELECTORS.root)
      .forEach((tabsRoot) => initializeTabs(tabsRoot));
  }

  /* ==========================================================================
     Owning Root
     ========================================================================== */

  /**
   * Return the tabs instance directly owning a tab.
   *
   * @param {HTMLElement} tab
   * @returns {HTMLElement | null}
   */
  function getOwningRoot(tab) {
    if (!isElement(tab)) {
      return null;
    }

    const root = tab.closest(SELECTORS.root);

    if (!isElement(root)) {
      return null;
    }

    const elements = getTabElements(root);

    if (!elements || !elements.tabs.includes(tab)) {
      return null;
    }

    return root;
  }

  /* ==========================================================================
     Click
     ========================================================================== */

  function handleDocumentClick(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const tab = event.target.closest('[role="tab"][data-tab-target]');

    if (!isElement(tab)) {
      return;
    }

    const root = getOwningRoot(tab);

    if (!root) {
      return;
    }

    event.preventDefault();

    activateTab(root, tab, {
      reason: "click",
    });
  }

  /* ==========================================================================
     Keyboard Navigation
     ========================================================================== */

  function handleDocumentKeydown(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const currentTab = event.target.closest('[role="tab"][data-tab-target]');

    if (!isElement(currentTab)) {
      return;
    }

    const root = getOwningRoot(currentTab);

    if (!root) {
      return;
    }

    const elements = getTabElements(root);

    if (!elements) {
      return;
    }

    const enabledTabs = elements.tabs.filter((tab) => !isTabDisabled(tab));

    const currentIndex = enabledTabs.indexOf(currentTab);

    if (currentIndex === -1) {
      return;
    }

    const isRtl = getComputedStyle(root).direction === "rtl";

    let nextIndex = currentIndex;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = isRtl ? currentIndex - 1 : currentIndex + 1;
        break;

      case "ArrowLeft":
        nextIndex = isRtl ? currentIndex + 1 : currentIndex - 1;
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = enabledTabs.length - 1;
        break;

      case "Enter":
      case " ":
        event.preventDefault();

        activateTab(root, currentTab, {
          reason: "keyboard",
        });

        return;

      default:
        return;
    }

    event.preventDefault();

    nextIndex = (nextIndex + enabledTabs.length) % enabledTabs.length;

    activateTab(root, enabledTabs[nextIndex], {
      focus: true,

      reason: "keyboard",
    });
  }

  /* ==========================================================================
     Dynamic Content
     ========================================================================== */

  function initializeAddedNode(node) {
    if (!isElement(node)) {
      return;
    }

    if (node.matches(SELECTORS.root)) {
      initializeTabs(node);
    }

    node
      .querySelectorAll?.(SELECTORS.root)
      .forEach((root) => initializeTabs(root));
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(initializeAddedNode);
    });
  });

  /* ==========================================================================
     Startup
     ========================================================================== */

  let started = false;

  function startTabs() {
    if (started) {
      return;
    }

    started = true;

    initializeAllTabs();

    if (document.body) {
      observer.observe(document.body, {
        childList: true,

        subtree: true,
      });
    }

    document.addEventListener("click", handleDocumentClick);

    document.addEventListener("keydown", handleDocumentKeydown);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTabs, {
      once: true,
    });
  } else {
    startTabs();
  }

  /*
   * Keep the selector helper referenced so builds configured with aggressive
   * dead-code checks do not report it as an accidental unused utility.
   */

  void escapeSelector;
})();
