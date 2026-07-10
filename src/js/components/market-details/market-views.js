/* ==========================================================================
   Market Tabs
   Reusable for:
   - Funds and Derivatives views
   - Market Movers tabs
   ========================================================================== */

const TAB_SYSTEMS = [
  {
    tab: "[data-market-view-tab]",
    panel: "[data-market-view-panel]",
    root: "[data-market-detail-panel]",
  },
  {
    tab: "[data-market-movers-tab]",
    panel: "[data-market-movers-panel]",
    root: "[data-market-movers]",
  },
];

let initialized = false;

/* ==========================================================================
   Helpers
   ========================================================================== */

function getSystemByTab(tab) {
  return TAB_SYSTEMS.find((system) => tab.matches(system.tab)) || null;
}

function getSystemRoot(tab, system) {
  return tab.closest(system.root);
}

function getTabs(root, system) {
  if (!root) return [];

  return Array.from(root.querySelectorAll(system.tab)).filter(
    (tab) => !tab.disabled && !tab.classList.contains("is-disabled"),
  );
}

function getPanels(root, system) {
  if (!root) return [];

  return Array.from(root.querySelectorAll(system.panel));
}

function isRTL() {
  return document.documentElement.dir === "rtl";
}

function dispatchTabChange(tab, panel, system) {
  tab.dispatchEvent(
    new CustomEvent("market:tabchange", {
      bubbles: true,
      detail: {
        tab,
        panel,
        type: system.tab === "[data-market-movers-tab]" ? "movers" : "view",
      },
    }),
  );
}

/* ==========================================================================
   Activation
   ========================================================================== */

function activateTab(tab, { focus = false, scroll = true } = {}) {
  const system = getSystemByTab(tab);

  if (!system) return;

  const root = getSystemRoot(tab, system);
  const targetId = tab.getAttribute("aria-controls");

  if (!root || !targetId) return;

  const tabs = getTabs(root, system);
  const panels = getPanels(root, system);
  const activePanel = panels.find((panel) => panel.id === targetId);

  if (!activePanel) return;

  tabs.forEach((item) => {
    const active = item === tab;

    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
    item.setAttribute("tabindex", active ? "0" : "-1");
  });

  panels.forEach((panel) => {
    const active = panel === activePanel;

    panel.classList.toggle("is-active", active);
    panel.toggleAttribute("hidden", !active);
    panel.setAttribute("aria-hidden", String(!active));
  });

  if (focus) {
    tab.focus({
      preventScroll: true,
    });
  }

  if (scroll) {
    tab.scrollIntoView({
      behavior:
        document.documentElement.dataset.motion === "reduce"
          ? "auto"
          : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }

  dispatchTabChange(tab, activePanel, system);
}

/* ==========================================================================
   Initial State
   ========================================================================== */

function initializeTabSystem(root, system) {
  const tabs = getTabs(root, system);
  const panels = getPanels(root, system);

  if (!tabs.length || !panels.length) return;

  const initialTab =
    tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ||
    tabs.find((tab) => tab.classList.contains("is-active")) ||
    tabs[0];

  activateTab(initialTab, {
    focus: false,
    scroll: false,
  });
}

function initializeAllTabSystems() {
  TAB_SYSTEMS.forEach((system) => {
    document.querySelectorAll(system.root).forEach((root) => {
      /*
       * A market detail panel can contain several movers components.
       * For movers, initialize each nested mover root individually.
       */
      if (system.root === "[data-market-movers]") {
        initializeTabSystem(root, system);
        return;
      }

      /*
       * Only initialize view tabs if this detail panel actually has them.
       */
      if (root.querySelector(system.tab)) {
        initializeTabSystem(root, system);
      }
    });
  });
}

/* ==========================================================================
   Keyboard Navigation
   ========================================================================== */

function getAdjacentTab(tabs, currentTab, direction) {
  const currentIndex = tabs.indexOf(currentTab);

  if (currentIndex < 0) return null;

  let step = direction === "next" ? 1 : -1;

  if (isRTL()) {
    step *= -1;
  }

  const nextIndex = (currentIndex + step + tabs.length) % tabs.length;

  return tabs[nextIndex];
}

function handleKeydown(event) {
  const tab = event.target.closest(
    TAB_SYSTEMS.map((system) => system.tab).join(","),
  );

  if (!tab) return;

  const system = getSystemByTab(tab);

  if (!system) return;

  const root = getSystemRoot(tab, system);
  const tabs = getTabs(root, system);

  if (!tabs.length) return;

  let nextTab = null;

  switch (event.key) {
    case "ArrowRight":
      nextTab = getAdjacentTab(tabs, tab, "next");
      break;

    case "ArrowLeft":
      nextTab = getAdjacentTab(tabs, tab, "previous");
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

      activateTab(tab, {
        focus: true,
        scroll: true,
      });

      return;

    default:
      return;
  }

  if (!nextTab) return;

  event.preventDefault();

  activateTab(nextTab, {
    focus: true,
    scroll: true,
  });
}

/* ==========================================================================
   Events
   ========================================================================== */

function handleClick(event) {
  const tab = event.target.closest(
    TAB_SYSTEMS.map((system) => system.tab).join(","),
  );

  if (!tab) return;

  activateTab(tab, {
    focus: false,
    scroll: true,
  });
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketViews() {
  if (initialized) return;

  initialized = true;

  initializeAllTabSystems();

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
}
