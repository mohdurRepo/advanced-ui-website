const HEADER_SELECTOR = "[data-site-header]";

const NAV_ITEM_SELECTOR = ".site-nav__item.has-mega-menu";
const NAV_TRIGGER_SELECTOR = ".site-nav__trigger";
const MEGA_CATEGORY_SELECTOR = ".mega-menu-nav__item";
const MEGA_PANEL_SELECTOR = ".mega-menu-panel";

const MOBILE_NAV_SELECTOR = "[data-mobile-nav]";
const MOBILE_OVERLAY_SELECTOR = "[data-mobile-nav-overlay]";
const MOBILE_OPEN_SELECTOR = "[data-mobile-nav-open]";
const MOBILE_CLOSE_SELECTOR = "[data-mobile-nav-close]";
const MOBILE_TRIGGER_SELECTOR = "[data-mobile-nav-target]";
const MOBILE_BACK_SELECTOR = "[data-mobile-nav-back]";
const MOBILE_PANEL_SELECTOR = ".mobile-nav__panel";

const DESKTOP_QUERY = "(min-width: 992px)";
const OPEN_DELAY = 60;
const CLOSE_DELAY = 240;

let activeNavItem = null;
let openTimer = null;
let closeTimer = null;
let lastFocusedElement = null;

function isDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function clearMenuTimers() {
  window.clearTimeout(openTimer);
  window.clearTimeout(closeTimer);
}

function closeMegaItem(item) {
  if (!item) return;

  item.classList.remove("is-open");
  item
    .querySelector(NAV_TRIGGER_SELECTOR)
    ?.setAttribute("aria-expanded", "false");
}

function closeAllMegaItems() {
  document
    .querySelectorAll(`${NAV_ITEM_SELECTOR}.is-open`)
    .forEach(closeMegaItem);
  activeNavItem = null;
}

function activateFirstMegaPanel(item) {
  const firstCategory = item.querySelector(MEGA_CATEGORY_SELECTOR);

  if (firstCategory) {
    activateMegaPanel(firstCategory);
  }
}

function openMegaItem(item) {
  if (!isDesktop() || !item) return;

  clearMenuTimers();

  if (activeNavItem && activeNavItem !== item) {
    closeMegaItem(activeNavItem);
  }

  activeNavItem = item;
  item.classList.add("is-open");
  item
    .querySelector(NAV_TRIGGER_SELECTOR)
    ?.setAttribute("aria-expanded", "true");

  activateFirstMegaPanel(item);
}

function scheduleMegaOpen(item) {
  clearMenuTimers();

  openTimer = window.setTimeout(() => {
    openMegaItem(item);
  }, OPEN_DELAY);
}

function scheduleMegaClose(item) {
  window.clearTimeout(openTimer);
  window.clearTimeout(closeTimer);

  closeTimer = window.setTimeout(() => {
    closeMegaItem(item);

    if (activeNavItem === item) {
      activeNavItem = null;
    }
  }, CLOSE_DELAY);
}

function activateMegaPanel(category) {
  const menu = category.closest(".mega-menu");
  const targetId = category.getAttribute("aria-controls");

  if (!menu || !targetId) return;

  menu.querySelectorAll(MEGA_CATEGORY_SELECTOR).forEach((item) => {
    const isActive = item === category;

    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  menu.querySelectorAll(MEGA_PANEL_SELECTOR).forEach((panel) => {
    const isActive = panel.id === targetId;

    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function initMegaMenus() {
  document.querySelectorAll(NAV_ITEM_SELECTOR).forEach((item) => {
    const trigger = item.querySelector(NAV_TRIGGER_SELECTOR);
    const megaMenu = item.querySelector(".mega-menu");

    trigger?.setAttribute("aria-expanded", "false");

    item.addEventListener("pointerenter", () => scheduleMegaOpen(item));
    item.addEventListener("pointerleave", () => scheduleMegaClose(item));

    megaMenu?.addEventListener("pointerenter", () => {
      window.clearTimeout(closeTimer);
    });

    megaMenu?.addEventListener("pointerleave", () => {
      scheduleMegaClose(item);
    });

    trigger?.addEventListener("click", (event) => {
      event.preventDefault();

      if (!isDesktop()) return;

      if (item.classList.contains("is-open")) {
        closeMegaItem(item);
        activeNavItem = null;
      } else {
        openMegaItem(item);
      }
    });

    trigger?.addEventListener("focus", () => {
      openMegaItem(item);
    });

    item.addEventListener("focusout", (event) => {
      if (!item.contains(event.relatedTarget)) {
        scheduleMegaClose(item);
      }
    });
  });

  document.addEventListener(
    "pointerenter",
    (event) => {
      const category = event.target.closest?.(MEGA_CATEGORY_SELECTOR);
      if (category) activateMegaPanel(category);
    },
    true,
  );

  document.addEventListener("focusin", (event) => {
    const category = event.target.closest?.(MEGA_CATEGORY_SELECTOR);
    if (category) activateMegaPanel(category);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllMegaItems();
    }
  });

  window
    .matchMedia(DESKTOP_QUERY)
    .addEventListener("change", closeAllMegaItems);
}

function getMobileNav() {
  return document.querySelector(MOBILE_NAV_SELECTOR);
}

function getMobileOverlay() {
  return document.querySelector(MOBILE_OVERLAY_SELECTOR);
}

function setMobilePanel(panel, active) {
  if (!panel) return;

  panel.classList.toggle("is-active", active);
  panel.setAttribute("aria-hidden", active ? "false" : "true");
  panel.inert = !active;
}

function resetMobilePanels(nav) {
  const panels = nav.querySelectorAll(MOBILE_PANEL_SELECTOR);

  panels.forEach((panel) => setMobilePanel(panel, false));

  const firstPanel = nav.querySelector('[data-mobile-nav-panel="main"]');
  setMobilePanel(firstPanel, true);
}

function openMobileNav() {
  const nav = getMobileNav();
  const overlay = getMobileOverlay();
  const openButton = document.querySelector(MOBILE_OPEN_SELECTOR);

  if (!nav || !overlay) return;

  lastFocusedElement = document.activeElement;

  nav.classList.add("is-open");
  overlay.classList.add("is-open");

  nav.setAttribute("aria-hidden", "false");
  overlay.setAttribute("aria-hidden", "false");
  openButton?.setAttribute("aria-expanded", "true");

  document.body.classList.add("is-mobile-nav-open");

  resetMobilePanels(nav);

  nav.querySelector(MOBILE_CLOSE_SELECTOR)?.focus();
}

function closeMobileNav() {
  const nav = getMobileNav();
  const overlay = getMobileOverlay();
  const openButton = document.querySelector(MOBILE_OPEN_SELECTOR);

  if (!nav || !overlay) return;

  nav.classList.remove("is-open");
  overlay.classList.remove("is-open");

  nav.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-hidden", "true");
  openButton?.setAttribute("aria-expanded", "false");

  document.body.classList.remove("is-mobile-nav-open");

  resetMobilePanels(nav);

  lastFocusedElement?.focus();
  lastFocusedElement = null;
}

function showMobilePanel(targetId) {
  const nav = getMobileNav();
  if (!nav || !targetId) return;

  const currentPanel = nav.querySelector(`${MOBILE_PANEL_SELECTOR}.is-active`);
  const nextPanel = document.getElementById(targetId);

  if (!nextPanel) return;

  setMobilePanel(currentPanel, false);
  setMobilePanel(nextPanel, true);

  nextPanel.querySelector(MOBILE_BACK_SELECTOR)?.focus();
}

function initMobileNav() {
  document.addEventListener("click", (event) => {
    if (event.target.closest(MOBILE_OPEN_SELECTOR)) {
      openMobileNav();
      return;
    }

    if (
      event.target.closest(MOBILE_CLOSE_SELECTOR) ||
      event.target.closest(MOBILE_OVERLAY_SELECTOR)
    ) {
      closeMobileNav();
      return;
    }

    const panelTrigger = event.target.closest(MOBILE_TRIGGER_SELECTOR);

    if (panelTrigger) {
      showMobilePanel(panelTrigger.dataset.mobileNavTarget);
      return;
    }

    const backButton = event.target.closest(MOBILE_BACK_SELECTOR);

    if (backButton) {
      showMobilePanel(backButton.dataset.mobileNavBack);
      return;
    }

    const mobileLink = event.target.closest(".mobile-nav__link");

    if (mobileLink) {
      closeMobileNav();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileNav();
    }
  });

  window.matchMedia(DESKTOP_QUERY).addEventListener("change", () => {
    if (isDesktop()) closeMobileNav();
  });
}

export function initHeader() {
  if (!document.querySelector(HEADER_SELECTOR)) return;

  initMegaMenus();
  initMobileNav();
}
