/* ==========================================================================
   Header
   ========================================================================== */

const SELECTORS = {
  header: "[data-site-header]",

  /* Desktop navigation */
  desktopNavItem: ".site-nav__item.has-mega-menu",
  desktopNavTrigger: ".site-nav__trigger",
  megaMenu: ".mega-menu",
  megaCategory: ".mega-menu-nav__item",
  megaPanel: ".mega-menu-panel",

  /* Mobile navigation */
  mobileNav: "[data-mobile-nav]",
  mobileOverlay: "[data-mobile-nav-overlay]",
  mobileOpen: "[data-mobile-nav-open]",
  mobileClose: "[data-mobile-nav-close]",
  mobileSubmenuTrigger: "[data-mobile-submenu-trigger]",
  mobileSubmenu: "[data-mobile-submenu]",
  mobileLink: ".mobile-nav__link",

  /* Shared */
  focusable: [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(","),
};

const DESKTOP_QUERY = "(min-width: 992px)";
const OPEN_DELAY = 80;
const CLOSE_DELAY = 220;

const desktopMediaQuery = window.matchMedia(DESKTOP_QUERY);

let activeDesktopItem = null;
let openTimer = null;
let closeTimer = null;
let lastFocusedElement = null;
let initialized = false;

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isDesktop() {
  return desktopMediaQuery.matches;
}

function clearDesktopTimers() {
  window.clearTimeout(openTimer);
  window.clearTimeout(closeTimer);

  openTimer = null;
  closeTimer = null;
}

function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(SELECTORS.focusable)).filter(
    (element) =>
      !element.hidden &&
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null,
  );
}

/* ==========================================================================
   Desktop Mega Menu
   ========================================================================== */

function getDesktopTrigger(item) {
  return item?.querySelector(SELECTORS.desktopNavTrigger);
}

function getMegaMenu(item) {
  return item?.querySelector(SELECTORS.megaMenu);
}

function closeDesktopItem(item, { restoreFocus = false } = {}) {
  if (!item) return;

  const trigger = getDesktopTrigger(item);
  const megaMenu = getMegaMenu(item);

  item.classList.remove("is-open");
  trigger?.setAttribute("aria-expanded", "false");
  megaMenu?.setAttribute("aria-hidden", "true");

  if (restoreFocus) {
    trigger?.focus();
  }

  if (activeDesktopItem === item) {
    activeDesktopItem = null;
  }
}

function closeAllDesktopMenus(options = {}) {
  clearDesktopTimers();

  document
    .querySelectorAll(`${SELECTORS.desktopNavItem}.is-open`)
    .forEach((item) => closeDesktopItem(item, options));

  activeDesktopItem = null;
}

function activateMegaPanel(category, { focus = false } = {}) {
  if (!category) return;

  const megaMenu = category.closest(SELECTORS.megaMenu);
  const targetId = category.getAttribute("aria-controls");

  if (!megaMenu || !targetId) return;

  const categories = Array.from(
    megaMenu.querySelectorAll(SELECTORS.megaCategory),
  );

  const panels = Array.from(megaMenu.querySelectorAll(SELECTORS.megaPanel));

  categories.forEach((item) => {
    const isActive = item === category;

    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  panels.forEach((panel) => {
    const isActive = panel.id === targetId;

    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  if (focus) {
    category.focus();
  }
}

function activateInitialMegaPanel(item) {
  const categories = Array.from(item.querySelectorAll(SELECTORS.megaCategory));

  if (!categories.length) return;

  const selectedCategory =
    categories.find(
      (category) => category.getAttribute("aria-selected") === "true",
    ) || categories[0];

  activateMegaPanel(selectedCategory);
}

function openDesktopItem(item) {
  if (!item || !isDesktop()) return;

  clearDesktopTimers();

  if (activeDesktopItem && activeDesktopItem !== item) {
    closeDesktopItem(activeDesktopItem);
  }

  const trigger = getDesktopTrigger(item);
  const megaMenu = getMegaMenu(item);

  activeDesktopItem = item;

  item.classList.add("is-open");
  trigger?.setAttribute("aria-expanded", "true");
  megaMenu?.setAttribute("aria-hidden", "false");

  activateInitialMegaPanel(item);
}

function toggleDesktopItem(item) {
  if (!item || !isDesktop()) return;

  if (item.classList.contains("is-open")) {
    closeDesktopItem(item);
  } else {
    openDesktopItem(item);
  }
}

function scheduleDesktopOpen(item) {
  clearDesktopTimers();

  openTimer = window.setTimeout(() => {
    openDesktopItem(item);
  }, OPEN_DELAY);
}

function scheduleDesktopClose(item) {
  window.clearTimeout(openTimer);
  window.clearTimeout(closeTimer);

  closeTimer = window.setTimeout(() => {
    closeDesktopItem(item);
  }, CLOSE_DELAY);
}

function handleMegaCategoryKeyboard(event, category) {
  const megaMenu = category.closest(SELECTORS.megaMenu);

  if (!megaMenu) return;

  const categories = Array.from(
    megaMenu.querySelectorAll(SELECTORS.megaCategory),
  );

  const currentIndex = categories.indexOf(category);

  if (currentIndex < 0) return;

  let nextIndex = currentIndex;

  switch (event.key) {
    case "ArrowDown":
      nextIndex = (currentIndex + 1) % categories.length;
      break;

    case "ArrowUp":
      nextIndex = (currentIndex - 1 + categories.length) % categories.length;
      break;

    case "Home":
      nextIndex = 0;
      break;

    case "End":
      nextIndex = categories.length - 1;
      break;

    case "Enter":
    case " ":
      event.preventDefault();
      activateMegaPanel(category);
      return;

    default:
      return;
  }

  event.preventDefault();
  activateMegaPanel(categories[nextIndex], { focus: true });
}

function initializeDesktopMenus() {
  document.querySelectorAll(SELECTORS.desktopNavItem).forEach((item) => {
    const trigger = getDesktopTrigger(item);
    const megaMenu = getMegaMenu(item);

    trigger?.setAttribute("aria-expanded", "false");
    megaMenu?.setAttribute("aria-hidden", "true");

    item.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;

      scheduleDesktopOpen(item);
    });

    item.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch") return;

      scheduleDesktopClose(item);
    });

    trigger?.addEventListener("click", (event) => {
      if (!isDesktop()) return;

      event.preventDefault();
      toggleDesktopItem(item);
    });

    trigger?.addEventListener("keydown", (event) => {
      if (!isDesktop()) return;

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          openDesktopItem(item);

          const activeCategory = item.querySelector(
            `${SELECTORS.megaCategory}.is-active`,
          );

          activeCategory?.focus();
          break;
        }

        case "Escape":
          event.preventDefault();
          closeDesktopItem(item, { restoreFocus: true });
          break;

        default:
          break;
      }
    });

    item.addEventListener("focusout", (event) => {
      if (!item.contains(event.relatedTarget)) {
        scheduleDesktopClose(item);
      }
    });
  });

  document.addEventListener("pointerover", (event) => {
    if (!isDesktop()) return;

    const category = event.target.closest(SELECTORS.megaCategory);

    if (category) {
      activateMegaPanel(category);
    }
  });

  document.addEventListener("focusin", (event) => {
    if (!isDesktop()) return;

    const category = event.target.closest(SELECTORS.megaCategory);

    if (category) {
      activateMegaPanel(category);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!isDesktop()) return;

    const category = event.target.closest(SELECTORS.megaCategory);

    if (category) {
      handleMegaCategoryKeyboard(event, category);
    }
  });
}

/* ==========================================================================
   Mobile Navigation
   ========================================================================== */

function getMobileNav() {
  return document.querySelector(SELECTORS.mobileNav);
}

function getMobileOverlay() {
  return document.querySelector(SELECTORS.mobileOverlay);
}

function getMobileOpenButton() {
  return document.querySelector(SELECTORS.mobileOpen);
}

function isMobileNavOpen() {
  return getMobileNav()?.classList.contains("is-open") ?? false;
}

function setMobileScrollLock(locked) {
  document.documentElement.classList.toggle("has-mobile-nav-open", locked);
  document.body.classList.toggle("is-mobile-nav-open", locked);
}

function setMobileSubmenu(trigger, open) {
  if (!trigger) return;

  const targetId = trigger.getAttribute("aria-controls");

  if (!targetId) return;

  const submenu = document.getElementById(targetId);

  if (!submenu) return;

  trigger.setAttribute("aria-expanded", String(open));
  trigger.classList.toggle("is-open", open);

  submenu.classList.toggle("is-open", open);
  submenu.hidden = !open;
  submenu.setAttribute("aria-hidden", String(!open));
}

function closeSiblingSubmenus(trigger) {
  const currentList = trigger.closest("ul");

  if (!currentList) return;

  Array.from(currentList.children).forEach((listItem) => {
    const siblingTrigger = listItem.querySelector(
      `:scope > ${SELECTORS.mobileSubmenuTrigger}`,
    );

    if (siblingTrigger && siblingTrigger !== trigger) {
      setMobileSubmenu(siblingTrigger, false);
    }
  });
}

function toggleMobileSubmenu(trigger) {
  const isOpen = trigger.getAttribute("aria-expanded") === "true";

  if (!isOpen) {
    closeSiblingSubmenus(trigger);
  }

  setMobileSubmenu(trigger, !isOpen);
}

function resetMobileSubmenus() {
  const nav = getMobileNav();

  if (!nav) return;

  nav.querySelectorAll(SELECTORS.mobileSubmenuTrigger).forEach((trigger) => {
    setMobileSubmenu(trigger, false);
  });
}

function openMobileNav() {
  const nav = getMobileNav();
  const overlay = getMobileOverlay();
  const openButton = getMobileOpenButton();

  if (!nav || !overlay || isDesktop()) return;

  lastFocusedElement = document.activeElement;

  nav.classList.add("is-open");
  overlay.classList.add("is-open");

  nav.setAttribute("aria-hidden", "false");
  overlay.setAttribute("aria-hidden", "false");
  openButton?.setAttribute("aria-expanded", "true");

  setMobileScrollLock(true);

  window.requestAnimationFrame(() => {
    const closeButton = nav.querySelector(SELECTORS.mobileClose);
    closeButton?.focus();
  });
}

function closeMobileNav({ restoreFocus = true } = {}) {
  const nav = getMobileNav();
  const overlay = getMobileOverlay();
  const openButton = getMobileOpenButton();

  if (!nav || !overlay) return;

  nav.classList.remove("is-open");
  overlay.classList.remove("is-open");

  nav.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-hidden", "true");
  openButton?.setAttribute("aria-expanded", "false");

  setMobileScrollLock(false);
  resetMobileSubmenus();

  if (restoreFocus) {
    const focusTarget =
      lastFocusedElement instanceof HTMLElement
        ? lastFocusedElement
        : openButton;

    focusTarget?.focus();
  }

  lastFocusedElement = null;
}

function trapMobileFocus(event) {
  if (event.key !== "Tab" || !isMobileNavOpen()) return;

  const nav = getMobileNav();
  const focusableElements = getFocusableElements(nav);

  if (!focusableElements.length) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function initializeMobileSubmenus() {
  const nav = getMobileNav();

  if (!nav) return;

  nav.querySelectorAll(SELECTORS.mobileSubmenuTrigger).forEach((trigger) => {
    const targetId = trigger.getAttribute("aria-controls");
    const submenu = targetId ? document.getElementById(targetId) : null;

    trigger.setAttribute("aria-expanded", "false");

    if (submenu) {
      submenu.hidden = true;
      submenu.setAttribute("aria-hidden", "true");
    }
  });
}

function initializeMobileNavigation() {
  initializeMobileSubmenus();

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest(SELECTORS.mobileOpen);

    if (openButton) {
      openMobileNav();
      return;
    }

    const closeButton = event.target.closest(SELECTORS.mobileClose);

    if (closeButton) {
      closeMobileNav();
      return;
    }

    const overlay = event.target.closest(SELECTORS.mobileOverlay);

    if (overlay) {
      closeMobileNav();
      return;
    }

    const submenuTrigger = event.target.closest(SELECTORS.mobileSubmenuTrigger);

    if (submenuTrigger) {
      event.preventDefault();
      toggleMobileSubmenu(submenuTrigger);
      return;
    }

    const mobileLink = event.target.closest(SELECTORS.mobileLink);

    if (mobileLink) {
      closeMobileNav({ restoreFocus: false });
    }
  });

  document.addEventListener("keydown", trapMobileFocus);
}

/* ==========================================================================
   Global Header Events
   ========================================================================== */

function handleGlobalKeyboard(event) {
  if (event.key !== "Escape") return;

  if (isMobileNavOpen()) {
    event.preventDefault();
    closeMobileNav();
    return;
  }

  if (activeDesktopItem) {
    event.preventDefault();
    closeDesktopItem(activeDesktopItem, { restoreFocus: true });
  }
}

function handleOutsideClick(event) {
  if (!isDesktop() || !activeDesktopItem) return;

  if (!activeDesktopItem.contains(event.target)) {
    closeAllDesktopMenus();
  }
}

function handleViewportChange(event) {
  clearDesktopTimers();
  closeAllDesktopMenus();

  if (event.matches) {
    closeMobileNav({ restoreFocus: false });
  } else {
    resetMobileSubmenus();
  }
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initHeader() {
  if (initialized) return;

  const header = document.querySelector(SELECTORS.header);

  if (!header) return;

  initialized = true;

  initializeDesktopMenus();
  initializeMobileNavigation();

  document.addEventListener("keydown", handleGlobalKeyboard);
  document.addEventListener("click", handleOutsideClick);

  desktopMediaQuery.addEventListener("change", handleViewportChange);
}
