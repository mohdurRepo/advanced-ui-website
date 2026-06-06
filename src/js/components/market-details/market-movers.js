const MOVERS_SELECTOR = "[data-market-movers]";
const TAB_SELECTOR = "[data-market-movers-tab]";
const PANEL_SELECTOR = "[data-market-movers-panel]";

function activateMoverTab(tab) {
  const movers = tab.closest(MOVERS_SELECTOR);
  const targetId = tab.getAttribute("aria-controls");

  if (!movers || !targetId) return;

  movers.querySelectorAll(TAB_SELECTOR).forEach((item) => {
    const isActive = item === tab;

    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  movers.querySelectorAll(PANEL_SELECTOR).forEach((panel) => {
    const isActive = panel.id === targetId;

    panel.classList.toggle("is-active", isActive);
    panel.toggleAttribute("hidden", !isActive);
  });
}

function getNextTab(tabs, currentTab, direction) {
  const currentIndex = tabs.indexOf(currentTab);
  const isRTL = document.documentElement.dir === "rtl";

  const step = direction === "next" ? 1 : -1;
  const resolvedStep = isRTL ? step * -1 : step;

  return tabs[(currentIndex + resolvedStep + tabs.length) % tabs.length];
}

function handleMoverKeydown(event) {
  const tab = event.target.closest(TAB_SELECTOR);

  if (!tab) return;

  const movers = tab.closest(MOVERS_SELECTOR);
  const tabs = Array.from(movers?.querySelectorAll(TAB_SELECTOR) || []);

  if (!tabs.length) return;

  let nextTab = null;

  if (event.key === "ArrowRight") {
    nextTab = getNextTab(tabs, tab, "next");
  }

  if (event.key === "ArrowLeft") {
    nextTab = getNextTab(tabs, tab, "prev");
  }

  if (event.key === "Home") {
    nextTab = tabs[0];
  }

  if (event.key === "End") {
    nextTab = tabs[tabs.length - 1];
  }

  if (!nextTab) return;

  event.preventDefault();
  nextTab.focus();
  activateMoverTab(nextTab);
}

export function initMarketMovers() {
  document.addEventListener("click", (event) => {
    const tab = event.target.closest(TAB_SELECTOR);

    if (!tab) return;

    activateMoverTab(tab);
  });

  document.addEventListener("keydown", handleMoverKeydown);
}
