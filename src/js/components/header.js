/* ==========================================================================
   Header
   ==========================================================================

   Desktop
   - Mega menus open on mouse hover (with intent delay) or on click.
   - A click on a menu opened by hover keeps it open; a second click closes.
   - Menus opened by click stay open until: second click, outside click,
     Escape, focus leaving the menu, or another menu opening.
   - Category rail (Level 2). Two supported forms:
       * links (<a data-mega-tab>): the dynamic header. Each item is a real
         page. Hover, focus and arrow keys preview its panel; click or Enter
         navigates. On touch, the first tap previews and the second navigates.
       * tabs (<button role="tab">): the static prototype; click selects.
     Only the selected item is in the Tab order (roving tabindex), so Tab
     moves from the rail straight into the visible panel. Hovering selects
     only after a short delay, so a diagonal mouse path to the links does
     not switch panels.

   Mobile
   - The drawer component (drawer.js) opens, closes, traps focus and locks
     scroll. This module talks to it through document events only, so it
     does not depend on where drawer.js lives:
       listens:   drawer:open, drawer:close, drawer:closed
       dispatches drawer:request-close

   Markup hooks (see header.html)
   - [data-site-header], [data-mega-item], [data-mega-trigger],
     [data-mega-menu], [data-mega-tab], [data-mega-panel]
   ========================================================================== */

import { collapseAccordions } from "./accordion";

/* ==========================================================================
   Configuration
   ========================================================================== */

/* Must match $nav-breakpoint ("lg" = 992px) in header/_header-config.scss. */
const DESKTOP_QUERY = "(min-width: 992px)";

const MOBILE_DRAWER = "mobile-nav";

const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 250;
const TAB_HOVER_DELAY = 150;

const SELECTORS = {
  header: "[data-site-header]",
  item: "[data-mega-item]",
  trigger: "[data-mega-trigger]",
  menu: "[data-mega-menu]",
  tablist: '[data-mega-tabs], [role="tablist"]',
  tab: "[data-mega-tab]",
  focusable: 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
};

const CLASSES = {
  open: "is-open",
  selected: "is-selected",
  menuOpen: "is-menu-open",
  mobileMenuOpen: "is-mobile-menu-open",
  scrolled: "is-scrolled",
};

/* ==========================================================================
   State
   ========================================================================== */

const desktopQuery = window.matchMedia(DESKTOP_QUERY);

const state = {
  header: null,
  openItem: null,
  openedBy: null, // "hover" | "click"
  openTimer: 0,
  closeTimer: 0,
  tabTimer: 0,
  lastPointerType: "mouse",
};

let initialized = false;

/* ==========================================================================
   Helpers
   ========================================================================== */

function isDesktop() {
  return desktopQuery.matches;
}

/* Asks drawer.js to close a drawer. Does nothing if it is already closed. */
function requestDrawerClose(name, { restoreFocus = false } = {}) {
  document.dispatchEvent(
    new CustomEvent("drawer:request-close", {
      detail: { name, restoreFocus },
    }),
  );
}

function clearTimer(name) {
  window.clearTimeout(state[name]);
  state[name] = 0;
}

function clearHoverTimers() {
  clearTimer("openTimer");
  clearTimer("closeTimer");
}

function focusElement(element) {
  if (!(element instanceof HTMLElement)) return;

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function getParts(item) {
  return {
    trigger: item.querySelector(SELECTORS.trigger),
    menu: item.querySelector(SELECTORS.menu),
  };
}

/* ==========================================================================
   Category Tabs
   ========================================================================== */

function getTabs(tablist) {
  return Array.from(tablist.querySelectorAll(SELECTORS.tab));
}

function getPanel(tab) {
  const panelId = tab.getAttribute("aria-controls");

  return panelId ? document.getElementById(panelId) : null;
}

function isSelected(tab) {
  return tab.classList.contains(CLASSES.selected);
}

/**
 * Moves the roving tabindex to a tab and, if the tab has a panel, shows it.
 * A rail link without a panel (no visible children) only takes the
 * tabindex; the current panel stays visible.
 */

function selectTab(tab, { focus = false } = {}) {
  const tablist = tab.closest(SELECTORS.tablist);

  if (!tablist) return;

  const tabs = getTabs(tablist);

  tabs.forEach((candidate) => {
    candidate.tabIndex = candidate === tab ? 0 : -1;
  });

  if (getPanel(tab)) {
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      const panel = getPanel(candidate);

      candidate.classList.toggle(CLASSES.selected, selected);

      if (candidate.getAttribute("role") === "tab") {
        candidate.setAttribute("aria-selected", String(selected));
      }

      if (panel) {
        panel.hidden = !selected;
      }
    });
  }

  if (focus) {
    focusElement(tab);
  }
}

/**
 * Restores each rail to its default: the item marked data-mega-default
 * (the current section), else the first item with a panel, else the first.
 */

function resetTabs(menu) {
  menu.querySelectorAll(SELECTORS.tablist).forEach((tablist) => {
    const tabs = getTabs(tablist);
    const defaultTab =
      tabs.find(
        (tab) => tab.hasAttribute("data-mega-default") && getPanel(tab),
      ) ||
      tabs.find((tab) => getPanel(tab)) ||
      tabs[0];

    if (defaultTab) {
      selectTab(defaultTab);
    }
  });
}

function handleTabKeydown(event, tab) {
  const tablist = tab.closest(SELECTORS.tablist);

  if (!tablist) return;

  const tabs = getTabs(tablist);
  const index = tabs.indexOf(tab);
  let next = null;

  switch (event.key) {
    case "ArrowDown":
      next = tabs[(index + 1) % tabs.length];
      break;
    case "ArrowUp":
      next = tabs[(index - 1 + tabs.length) % tabs.length];
      break;
    case "Home":
      next = tabs[0];
      break;
    case "End":
      next = tabs[tabs.length - 1];
      break;
    default:
      return;
  }

  event.preventDefault();
  selectTab(next, { focus: true });
}

function initTabs(menu) {
  menu.addEventListener("pointerdown", (event) => {
    state.lastPointerType = event.pointerType || "mouse";
  });

  menu.addEventListener("click", (event) => {
    const tab =
      event.target instanceof Element && event.target.closest(SELECTORS.tab);

    if (!tab) return;

    clearTimer("tabTimer");

    /* Tabs (buttons) select on click. */
    if (tab.tagName !== "A") {
      selectTab(tab);
      return;
    }

    /* Links navigate, except a first tap on touch, which previews. */
    if (
      state.lastPointerType === "touch" &&
      getPanel(tab) &&
      !isSelected(tab)
    ) {
      event.preventDefault();
      selectTab(tab);
    }
  });

  menu.addEventListener("keydown", (event) => {
    const tab =
      event.target instanceof Element && event.target.closest(SELECTORS.tab);

    if (tab) {
      handleTabKeydown(event, tab);
    }
  });

  menu.querySelectorAll(SELECTORS.tab).forEach((tab) => {
    tab.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;

      clearTimer("tabTimer");
      state.tabTimer = window.setTimeout(() => selectTab(tab), TAB_HOVER_DELAY);
    });

    tab.addEventListener("pointerleave", () => {
      clearTimer("tabTimer");
    });
  });
}

/* ==========================================================================
   Menu State
   ========================================================================== */

function openItem(item, openedBy) {
  if (!isDesktop()) return;

  clearHoverTimers();

  if (state.openItem === item) {
    state.openedBy = openedBy;
    return;
  }

  if (state.openItem) {
    closeItem(state.openItem);
  }

  const { trigger, menu } = getParts(item);

  if (!trigger || !menu) return;

  /* Reset before showing, so the closing fade never shows a panel swap. */
  resetTabs(menu);

  state.openItem = item;
  state.openedBy = openedBy;

  menu.classList.add(CLASSES.open);
  trigger.setAttribute("aria-expanded", "true");

  state.header.classList.add(CLASSES.menuOpen);
}

function closeItem(item, { restoreFocus = false } = {}) {
  const { trigger, menu } = getParts(item);

  clearTimer("tabTimer");

  menu?.classList.remove(CLASSES.open);
  trigger?.setAttribute("aria-expanded", "false");

  if (state.openItem === item) {
    state.openItem = null;
    state.openedBy = null;

    state.header.classList.remove(CLASSES.menuOpen);
  }

  if (restoreFocus) {
    focusElement(trigger);
  }
}

function closeOpenItem(options) {
  clearHoverTimers();

  if (state.openItem) {
    closeItem(state.openItem, options);
  }
}

/* Moves focus into an open menu: the selected tab, else the first link. */
function focusMenu(menu) {
  window.requestAnimationFrame(() => {
    const target =
      menu.querySelector(`${SELECTORS.tab}.${CLASSES.selected}`) ||
      menu.querySelector(`${SELECTORS.tab}[tabindex="0"]`) ||
      menu.querySelector(SELECTORS.focusable);

    focusElement(target);
  });
}

/* ==========================================================================
   Menu Item
   ========================================================================== */

function initItem(item) {
  const { trigger, menu } = getParts(item);

  if (!trigger || !menu) return;

  trigger.setAttribute("aria-expanded", "false");
  menu.classList.remove(CLASSES.open);
  resetTabs(menu);

  /* Hover intent. Touch is ignored: taps arrive as clicks. */

  item.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch" || !isDesktop()) return;

    clearTimer("closeTimer");

    if (state.openItem === item) return;

    clearTimer("openTimer");

    /* Moving between triggers while a menu is open switches immediately. */
    const delay = state.openItem ? 0 : HOVER_OPEN_DELAY;

    state.openTimer = window.setTimeout(() => openItem(item, "hover"), delay);
  });

  item.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;

    clearTimer("openTimer");

    if (state.openItem !== item || state.openedBy !== "hover") return;

    state.closeTimer = window.setTimeout(
      () => closeItem(item),
      HOVER_CLOSE_DELAY,
    );
  });

  /* Click, tap, Enter and Space. */

  trigger.addEventListener("click", () => {
    if (!isDesktop()) return;

    clearHoverTimers();

    if (state.openItem !== item) {
      openItem(item, "click");
    } else if (state.openedBy === "hover") {
      state.openedBy = "click";
    } else {
      closeItem(item);
    }
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" || !isDesktop()) return;

    event.preventDefault();

    openItem(item, "click");
    focusMenu(menu);
  });

  /*
   * Close when keyboard focus leaves the item. A null relatedTarget (Safari
   * clicks, window blur) is ignored; outside clicks are handled separately.
   */

  item.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;

    if (!(next instanceof Node) || item.contains(next)) return;

    if (state.openItem === item) {
      closeItem(item);
    }
  });

  /* Following a link closes the menu (matters for same-page links). */

  menu.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a[href]")) {
      closeItem(item);
    }
  });

  initTabs(menu);
}

/* ==========================================================================
   Document Events
   ========================================================================== */

function handleDocumentClick(event) {
  if (!state.openItem || !(event.target instanceof Node)) return;

  if (!state.openItem.contains(event.target)) {
    closeOpenItem();
  }
}

function handleDocumentKeydown(event) {
  if (event.key !== "Escape" || !state.openItem) return;

  event.preventDefault();

  closeOpenItem({
    restoreFocus: state.openItem.contains(document.activeElement),
  });
}

function handleBreakpointChange() {
  closeOpenItem();

  if (isDesktop()) {
    requestDrawerClose(MOBILE_DRAWER);
  }
}

/* Pages restored from the back/forward cache start with menus closed. */
function handlePageShow(event) {
  if (!event.persisted) return;

  closeOpenItem();
  requestDrawerClose(MOBILE_DRAWER);
}

/* ==========================================================================
   Mobile Drawer
   ========================================================================== */

function isMobileDrawerEvent(event) {
  return event.detail?.name === MOBILE_DRAWER;
}

function initMobileNavigation() {
  document.addEventListener("drawer:open", (event) => {
    if (!isMobileDrawerEvent(event)) return;

    closeOpenItem();
    state.header.classList.add(CLASSES.mobileMenuOpen);
  });

  document.addEventListener("drawer:close", (event) => {
    if (!isMobileDrawerEvent(event)) return;

    state.header.classList.remove(CLASSES.mobileMenuOpen);
  });

  /* Collapse sections after the slide-out ends, not during it. */
  document.addEventListener("drawer:closed", (event) => {
    if (!isMobileDrawerEvent(event)) return;

    collapseAccordions(event.detail.drawer);
  });

  /* Following a link closes the drawer without moving focus to the burger. */
  document.addEventListener("click", (event) => {
    const link =
      event.target instanceof Element &&
      event.target.closest(`[data-drawer="${MOBILE_DRAWER}"] a[href]`);

    if (link) {
      requestDrawerClose(MOBILE_DRAWER);
    }
  });
}

/* ==========================================================================
   Scroll State
   ========================================================================== */

function initScrollState(header) {
  let ticking = false;

  function update() {
    header.classList.toggle(CLASSES.scrolled, window.scrollY > 0);
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(update);
    },
    { passive: true },
  );

  update();
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initHeader() {
  if (initialized) return;

  const header = document.querySelector(SELECTORS.header);

  if (!header) return;

  initialized = true;
  state.header = header;

  header.querySelectorAll(SELECTORS.item).forEach(initItem);

  initMobileNavigation();
  initScrollState(header);

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
  window.addEventListener("pageshow", handlePageShow);

  /* addListener: Safari before 14. */
  if (typeof desktopQuery.addEventListener === "function") {
    desktopQuery.addEventListener("change", handleBreakpointChange);
  } else {
    desktopQuery.addListener(handleBreakpointChange);
  }
}
