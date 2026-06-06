const VIEW_TAB_SELECTOR = "[data-market-view-tab]";
const VIEW_PANEL_SELECTOR = "[data-market-view-panel]";

function activateMarketView(tab) {
  const root = tab.closest("[data-market-detail-panel]");
  const targetId = tab.getAttribute("aria-controls");

  if (!root || !targetId) return;

  root.querySelectorAll(VIEW_TAB_SELECTOR).forEach((item) => {
    const isActive = item === tab;

    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  root.querySelectorAll(VIEW_PANEL_SELECTOR).forEach((panel) => {
    const isActive = panel.id === targetId;

    panel.classList.toggle("is-active", isActive);
    panel.toggleAttribute("hidden", !isActive);
    panel.setAttribute("aria-hidden", String(!isActive));
  });
}

function getNextTab(tabs, currentTab, direction) {
  const currentIndex = tabs.indexOf(currentTab);
  const isRTL = document.documentElement.dir === "rtl";

  const step = direction === "next" ? 1 : -1;
  const resolvedStep = isRTL ? step * -1 : step;

  return tabs[(currentIndex + resolvedStep + tabs.length) % tabs.length];
}

function handleKeydown(event) {
  const tab = event.target.closest(VIEW_TAB_SELECTOR);

  if (!tab) return;

  const root = tab.closest("[data-market-detail-panel]");
  const tabs = Array.from(root?.querySelectorAll(VIEW_TAB_SELECTOR) || []);

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
  activateMarketView(nextTab);
}

export function initMarketViews() {
  document.addEventListener("click", (event) => {
    const tab = event.target.closest(VIEW_TAB_SELECTOR);

    if (!tab) return;

    activateMarketView(tab);
  });

  document.addEventListener("keydown", handleKeydown);
}
