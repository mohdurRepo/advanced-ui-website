/* ==========================================================================
   Tabs
   ========================================================================== */

(() => {
  "use strict";

  const SELECTORS = {
    root: ".tabs[data-tabs]",
    nav: ":scope > .tabs-nav",
    content: ":scope > .tabs-content",
    tab: ':scope > [role="tab"][data-tab-target]',
    panel: ':scope > [role="tabpanel"]',
  };

  const CLASSES = {
    active: "active",
  };

  /**
   * Escape an element ID before using it in a selector.
   *
   * @param {string} value
   * @returns {string}
   */
  const escapeSelector = (value) => {
    if (window.CSS?.escape) {
      return CSS.escape(value);
    }

    return value.replace(/([^\w-])/g, "\\$1");
  };

  /**
   * Return only the tabs and panels owned directly by one tabs instance.
   *
   * Nested tabs are intentionally excluded.
   *
   * @param {HTMLElement} root
   * @returns {{
   *   nav: HTMLElement,
   *   content: HTMLElement,
   *   tabs: HTMLElement[],
   *   panels: HTMLElement[]
   * } | null}
   */
  const getTabElements = (root) => {
    const nav = root.querySelector(SELECTORS.nav);
    const content = root.querySelector(SELECTORS.content);

    if (!nav || !content) {
      return null;
    }

    const tabs = Array.from(nav.querySelectorAll(SELECTORS.tab));
    const panels = Array.from(content.querySelectorAll(SELECTORS.panel));

    if (!tabs.length || !panels.length) {
      return null;
    }

    return {
      nav,
      content,
      tabs,
      panels,
    };
  };

  /**
   * Find the panel targeted by a tab.
   *
   * @param {HTMLElement} tab
   * @param {HTMLElement[]} panels
   * @returns {HTMLElement | null}
   */
  const getTargetPanel = (tab, panels) => {
    const targetId = tab.dataset.tabTarget;

    if (!targetId) {
      return null;
    }

    return panels.find((panel) => panel.id === targetId) || null;
  };

  /**
   * Set one tab as active.
   *
   * @param {HTMLElement} root
   * @param {HTMLElement} selectedTab
   * @param {{ focus?: boolean }} options
   */
  const activateTab = (root, selectedTab, { focus = false } = {}) => {
    const elements = getTabElements(root);

    if (!elements) {
      return;
    }

    const { tabs, panels } = elements;
    const selectedPanel = getTargetPanel(selectedTab, panels);

    if (!selectedPanel || selectedTab.disabled) {
      return;
    }

    tabs.forEach((tab) => {
      const isActive = tab === selectedTab;

      tab.classList.toggle(CLASSES.active, isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    panels.forEach((panel) => {
      const isActive = panel === selectedPanel;

      panel.classList.toggle(CLASSES.active, isActive);
      panel.hidden = !isActive;
    });

    if (focus) {
      selectedTab.focus();
    }

    root.dispatchEvent(
      new CustomEvent("tabs:change", {
        bubbles: true,
        detail: {
          tab: selectedTab,
          panel: selectedPanel,
          targetId: selectedPanel.id,
        },
      }),
    );
  };

  /**
   * Initialize one tabs instance from its HTML state.
   *
   * The tab marked with either:
   * - .active
   * - aria-selected="true"
   *
   * is respected. Otherwise, the first enabled tab is selected.
   *
   * @param {HTMLElement} root
   */
  const initializeTabs = (root) => {
    if (root.dataset.tabsInitialized === "true") {
      return;
    }

    const elements = getTabElements(root);

    if (!elements) {
      return;
    }

    const { tabs, panels } = elements;

    /*
     * Make sure every tab has the required relationships.
     */
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

    const initialTab =
      tabs.find(
        (tab) =>
          !tab.disabled &&
          (tab.classList.contains(CLASSES.active) ||
            tab.getAttribute("aria-selected") === "true"),
      ) || tabs.find((tab) => !tab.disabled);

    if (!initialTab) {
      return;
    }

    activateTab(root, initialTab);

    root.dataset.tabsInitialized = "true";
  };

  /**
   * Initialize all tabs currently on the page.
   *
   * Nested components are initialized independently.
   */
  const initializeAllTabs = () => {
    document
      .querySelectorAll(SELECTORS.root)
      .forEach((root) => initializeTabs(root));
  };

  /**
   * Return the tabs instance directly owning a clicked tab.
   *
   * @param {HTMLElement} tab
   * @returns {HTMLElement | null}
   */
  const getOwningRoot = (tab) => {
    const root = tab.closest(SELECTORS.root);

    if (!root) {
      return null;
    }

    const elements = getTabElements(root);

    if (!elements || !elements.tabs.includes(tab)) {
      return null;
    }

    return root;
  };

  /* ==========================================================================
     Click
     ========================================================================== */

  document.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"][data-tab-target]');

    if (!(tab instanceof HTMLElement)) {
      return;
    }

    const root = getOwningRoot(tab);

    if (!root) {
      return;
    }

    event.preventDefault();

    activateTab(root, tab);
  });

  /* ==========================================================================
     Keyboard Navigation
     ========================================================================== */

  document.addEventListener("keydown", (event) => {
    const currentTab = event.target.closest('[role="tab"][data-tab-target]');

    if (!(currentTab instanceof HTMLElement)) {
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

    const enabledTabs = elements.tabs.filter((tab) => !tab.disabled);

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
        activateTab(root, currentTab);
        return;

      default:
        return;
    }

    event.preventDefault();

    nextIndex = (nextIndex + enabledTabs.length) % enabledTabs.length;

    activateTab(root, enabledTabs[nextIndex], {
      focus: true,
    });
  });

  /* ==========================================================================
     Dynamic Content
     ========================================================================== */

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }

        if (node.matches(SELECTORS.root)) {
          initializeTabs(node);
        }

        node
          .querySelectorAll?.(SELECTORS.root)
          .forEach((root) => initializeTabs(root));
      });
    });
  });

  /* ==========================================================================
     Initialization
     ========================================================================== */

  const startTabs = () => {
    initializeAllTabs();

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTabs, { once: true });
  } else {
    startTabs();
  }
})();
