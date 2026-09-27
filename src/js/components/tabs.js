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

  const initializedTabs = new WeakSet();

  let started = false;

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

  function prefersReducedMotion() {
    return (
      document.documentElement.dataset.motion === "reduce" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /* ==========================================================================
     Element Collection
     ========================================================================== */

  /**
   * Return only the tabs and panels directly owned by one tabs instance.
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

    return panels.find((panel) => panel.id === targetId) ?? null;
  }

  /**
   * Return the stable application key associated with a tab.
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

  function ensureRelationships(nav, tabs, panels) {
    if (!nav.hasAttribute("role")) {
      nav.setAttribute("role", "tablist");
    }

    if (!nav.hasAttribute("aria-orientation")) {
      nav.setAttribute("aria-orientation", "horizontal");
    }

    tabs.forEach((tab) => {
      const panel = getTargetPanel(tab, panels);

      if (!panel) {
        return;
      }

      /*
       * data-tab-target requires a panel ID, so the panel already has a
       * stable identifier. Generate the tab ID from it when necessary.
       */

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
       * JavaScript owns one canonical state class.
       *
       * The stylesheet continues supporting `.is-active` for backward
       * compatibility with server-rendered or legacy markup.
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
     Tab Visibility
     ========================================================================== */

  /**
   * Center a selected tab inside an overflowing horizontal tab strip.
   *
   * The browser handles logical inline direction, so the same implementation
   * works correctly in both LTR and RTL.
   *
   * No scrolling occurs when the complete navigation already fits.
   *
   * @param {HTMLElement} root
   * @param {HTMLElement} tab
   * @param {{ smooth?: boolean }} options
   */

  function centerTabInNav(root, tab, { smooth = true } = {}) {
    const elements = getTabElements(root);

    if (!elements || !elements.tabs.includes(tab)) {
      return;
    }

    const { nav } = elements;

    /*
     * Account for sub-pixel layout differences before deciding that the tab
     * strip actually overflows.
     */

    if (nav.scrollWidth <= nav.clientWidth + 1) {
      return;
    }

    tab.scrollIntoView({
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",

      block: "nearest",
      inline: "center",
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
   * State synchronization is intentionally idempotent:
   *
   * - the complete tab/panel state is always normalized;
   * - reselecting the active tab does not emit another change event;
   * - user-triggered selection may still center the active tab.
   *
   * @param {HTMLElement} root
   * @param {HTMLElement} selectedTab
   * @param {{
   *   focus?: boolean,
   *   emit?: boolean,
   *   center?: boolean,
   *   reason?: string
   * }} options
   * @returns {boolean}
   */

  function activateTab(
    root,
    selectedTab,
    {
      focus = false,
      emit = true,
      center = false,
      reason = "programmatic",
    } = {},
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
     * Always synchronize the complete state.
     *
     * This also repairs incomplete server-rendered markup without generating
     * duplicate tabs:change events.
     */

    updateTabState(tabs, selectedTab);

    updatePanelState(panels, selectedPanel);

    /*
     * Focus first.
     *
     * Browsers may automatically reveal a newly focused tab near an edge.
     * The next animation frame then performs our deliberate centered
     * positioning.
     */

    if (focus) {
      selectedTab.focus({
        preventScroll: true,
      });
    }

    if (center) {
      window.requestAnimationFrame(() => {
        centerTabInNav(root, selectedTab);
      });
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
   * `.active` or `aria-selected="true"` is respected. Otherwise the first
   * enabled tab becomes active.
   *
   * Initialization deliberately does not center the selected tab. The page
   * should not unexpectedly scroll before the user interacts.
   *
   * @param {HTMLElement} root
   * @returns {boolean}
   */

  function initializeTabs(root) {
    if (!isElement(root) || initializedTabs.has(root)) {
      return false;
    }

    const elements = getTabElements(root);

    if (!elements) {
      return false;
    }

    const { nav, tabs, panels } = elements;

    ensureRelationships(nav, tabs, panels);

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
     * Mark before synchronizing so MutationObserver-driven initialization
     * cannot process this root twice.
     */

    initializedTabs.add(root);

    root.dataset.tabsInitialized = "true";

    activateTab(root, initialTab, {
      emit: false,
      center: false,
      reason: "initialization",
    });

    return true;
  }

  function initializeAllTabs(scope = document) {
    if (!scope) {
      return;
    }

    if (isElement(scope) && scope.matches(SELECTORS.root)) {
      initializeTabs(scope);
    }

    if (typeof scope.querySelectorAll !== "function") {
      return;
    }

    scope.querySelectorAll(SELECTORS.root).forEach((root) => {
      initializeTabs(root);
    });
  }

  /* ==========================================================================
     Owning Root
     ========================================================================== */

  /**
   * Return the tabs instance directly owning one tab.
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

    if (isTabDisabled(tab)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    activateTab(root, tab, {
      center: true,
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

    if (!enabledTabs.length) {
      return;
    }

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
          center: true,
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
      center: true,
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

    initializeAllTabs(node);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(initializeAddedNode);
    });
  });

  /* ==========================================================================
     Startup
     ========================================================================== */

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
})();
