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

const CLASSES = {
  open: "is-open",
  menuOpen: "is-menu-open",
  mobileMenuOpen: "is-mobile-menu-open",
  htmlMobileOpen: "has-mobile-nav-open",
  bodyMobileOpen: "is-mobile-nav-open",
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

function getHeader() {
  return document.querySelector(SELECTORS.header);
}

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
    (element) => {
      return (
        !element.hidden &&
        !element.hasAttribute("disabled") &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.offsetParent !== null
      );
    },
  );
}

function focusElement(element) {
  if (!(element instanceof HTMLElement)) return;

  element.focus({
    preventScroll: true,
  });
}

/* ==========================================================================
   Desktop Mega Menu Helpers
   ========================================================================== */

function getDesktopTrigger(item) {
  return item?.querySelector(`:scope > ${SELECTORS.desktopNavTrigger}`);
}

function getMegaMenu(item) {
  return item?.querySelector(`:scope > ${SELECTORS.megaMenu}`);
}

function getMegaCategories(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(SELECTORS.megaCategory));
}

function getMegaPanels(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(SELECTORS.megaPanel));
}

function setHeaderDesktopState(isOpen) {
  getHeader()?.classList.toggle(CLASSES.menuOpen, isOpen);
}

/* ==========================================================================
   Mega Menu Panels
   ========================================================================== */

function activateMegaPanel(category, { focus = false } = {}) {
  if (!category) return;

  const megaMenu = category.closest(SELECTORS.megaMenu);
  const targetId = category.getAttribute("aria-controls");

  if (!megaMenu || !targetId) return;

  const categories = getMegaCategories(megaMenu);
  const panels = getMegaPanels(megaMenu);

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
    focusElement(category);
  }
}

function getDefaultMegaCategory(item) {
  const categories = getMegaCategories(item);

  if (!categories.length) return null;

  /*
   * A category may explicitly declare itself as the default:
   *
   * data-mega-default
   *
   * Otherwise, the first category is always the default.
   */
  return (
    categories.find((category) => category.hasAttribute("data-mega-default")) ||
    categories[0]
  );
}

function activateInitialMegaPanel(item) {
  const defaultCategory = getDefaultMegaCategory(item);

  if (!defaultCategory) return;

  activateMegaPanel(defaultCategory);
}

function initializeMegaPanels(item) {
  const defaultCategory = getDefaultMegaCategory(item);

  if (!defaultCategory) return;

  activateMegaPanel(defaultCategory);
}

/* ==========================================================================
   Desktop Menu State
   ========================================================================== */

function openDesktopItem(item) {
  if (!item || !isDesktop()) return;

  clearDesktopTimers();

  if (activeDesktopItem && activeDesktopItem !== item) {
    closeDesktopItem(activeDesktopItem);
  }

  const trigger = getDesktopTrigger(item);
  const megaMenu = getMegaMenu(item);

  if (!trigger || !megaMenu) return;

  /*
   * Restore the default panel before displaying the menu.
   * This prevents the last hovered category from remaining active when the
   * user returns to the top-level navigation item.
   */
  activateInitialMegaPanel(item);

  activeDesktopItem = item;

  item.classList.add(CLASSES.open);
  trigger.setAttribute("aria-expanded", "true");
  megaMenu.setAttribute("aria-hidden", "false");

  setHeaderDesktopState(true);
}

function closeDesktopItem(item, { restoreFocus = false } = {}) {
  if (!item) return;

  const trigger = getDesktopTrigger(item);
  const megaMenu = getMegaMenu(item);

  item.classList.remove(CLASSES.open);
  trigger?.setAttribute("aria-expanded", "false");
  megaMenu?.setAttribute("aria-hidden", "true");

  /*
   * Reset while closed so both visual state and ARIA state are ready for the
   * next opening.
   */
  activateInitialMegaPanel(item);

  if (restoreFocus) {
    focusElement(trigger);
  }

  if (activeDesktopItem === item) {
    activeDesktopItem = null;
  }

  if (!activeDesktopItem) {
    setHeaderDesktopState(false);
  }
}

function closeAllDesktopMenus(options = {}) {
  clearDesktopTimers();

  document
    .querySelectorAll(`${SELECTORS.desktopNavItem}.${CLASSES.open}`)
    .forEach((item) => {
      closeDesktopItem(item, options);
    });

  activeDesktopItem = null;
  setHeaderDesktopState(false);
}

function toggleDesktopItem(item) {
  if (!item || !isDesktop()) return;

  if (item.classList.contains(CLASSES.open)) {
    closeDesktopItem(item);
    return;
  }

  openDesktopItem(item);
}

/* ==========================================================================
   Desktop Hover Scheduling
   ========================================================================== */

function scheduleDesktopOpen(item) {
  clearDesktopTimers();

  openTimer = window.setTimeout(() => {
    openDesktopItem(item);
  }, OPEN_DELAY);
}

function scheduleDesktopClose(item) {
  window.clearTimeout(openTimer);
  window.clearTimeout(closeTimer);

  openTimer = null;

  closeTimer = window.setTimeout(() => {
    closeDesktopItem(item);
  }, CLOSE_DELAY);
}

/* ==========================================================================
   Mega Menu Keyboard Navigation
   ========================================================================== */

function handleMegaCategoryKeyboard(event, category) {
  const megaMenu = category.closest(SELECTORS.megaMenu);

  if (!megaMenu) return;

  const categories = getMegaCategories(megaMenu);
  const currentIndex = categories.indexOf(category);

  if (currentIndex < 0 || !categories.length) return;

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

    case "Escape": {
      event.preventDefault();

      const desktopItem = category.closest(SELECTORS.desktopNavItem);

      closeDesktopItem(desktopItem, {
        restoreFocus: true,
      });

      return;
    }

    default:
      return;
  }

  event.preventDefault();

  activateMegaPanel(categories[nextIndex], {
    focus: true,
  });
}

/* ==========================================================================
   Desktop Initialization
   ========================================================================== */

function initializeDesktopItem(item) {
  const trigger = getDesktopTrigger(item);
  const megaMenu = getMegaMenu(item);

  if (!trigger || !megaMenu) return;

  item.classList.remove(CLASSES.open);

  trigger.setAttribute("aria-expanded", "false");
  megaMenu.setAttribute("aria-hidden", "true");

  initializeMegaPanels(item);

  item.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;

    scheduleDesktopOpen(item);
  });

  item.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;

    scheduleDesktopClose(item);
  });

  trigger.addEventListener("click", (event) => {
    if (!isDesktop()) return;

    event.preventDefault();
    toggleDesktopItem(item);
  });

  trigger.addEventListener("keydown", (event) => {
    if (!isDesktop()) return;

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();

        openDesktopItem(item);

        const activeCategory = item.querySelector(
          `${SELECTORS.megaCategory}.is-active`,
        );

        focusElement(activeCategory);
        break;
      }

      case "Escape":
        event.preventDefault();

        closeDesktopItem(item, {
          restoreFocus: true,
        });
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
}

function handleMegaCategoryPointer(event) {
  if (!isDesktop()) return;

  const category = event.target.closest(SELECTORS.megaCategory);

  if (!category) return;

  activateMegaPanel(category);
}

function handleMegaCategoryFocus(event) {
  if (!isDesktop()) return;

  const category = event.target.closest(SELECTORS.megaCategory);

  if (!category) return;

  activateMegaPanel(category);
}

function handleMegaCategoryKeydown(event) {
  if (!isDesktop()) return;

  const category = event.target.closest(SELECTORS.megaCategory);

  if (!category) return;

  handleMegaCategoryKeyboard(event, category);
}

function initializeDesktopMenus() {
  document
    .querySelectorAll(SELECTORS.desktopNavItem)
    .forEach(initializeDesktopItem);

  document.addEventListener("pointerover", handleMegaCategoryPointer);

  document.addEventListener("focusin", handleMegaCategoryFocus);

  document.addEventListener("keydown", handleMegaCategoryKeydown);
}

/* ==========================================================================
   Mobile Navigation Helpers
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
  return getMobileNav()?.classList.contains(CLASSES.open) ?? false;
}

function setMobileScrollLock(locked) {
  document.documentElement.classList.toggle(CLASSES.htmlMobileOpen, locked);

  document.body.classList.toggle(CLASSES.bodyMobileOpen, locked);

  getHeader()?.classList.toggle(CLASSES.mobileMenuOpen, locked);
}

/* ==========================================================================
   Mobile Submenus
   ========================================================================== */

function getMobileSubmenu(trigger) {
  if (!trigger) return null;

  const targetId = trigger.getAttribute("aria-controls");

  if (!targetId) return null;

  return document.getElementById(targetId);
}

function setMobileSubmenu(trigger, open) {
  if (!trigger) return;

  const submenu = getMobileSubmenu(trigger);

  if (!submenu) return;

  trigger.setAttribute("aria-expanded", String(open));
  trigger.classList.toggle(CLASSES.open, open);

  submenu.classList.toggle(CLASSES.open, open);
  submenu.hidden = !open;
  submenu.setAttribute("aria-hidden", String(!open));
}

function closeNestedSubmenus(container) {
  if (!container) return;

  container
    .querySelectorAll(SELECTORS.mobileSubmenuTrigger)
    .forEach((trigger) => {
      setMobileSubmenu(trigger, false);
    });
}

function closeSiblingSubmenus(trigger) {
  const currentList = trigger.closest("ul");

  if (!currentList) return;

  Array.from(currentList.children).forEach((listItem) => {
    const siblingTrigger = listItem.querySelector(
      `:scope > ${SELECTORS.mobileSubmenuTrigger}`,
    );

    if (siblingTrigger && siblingTrigger !== trigger) {
      const siblingSubmenu = getMobileSubmenu(siblingTrigger);

      closeNestedSubmenus(siblingSubmenu);
      setMobileSubmenu(siblingTrigger, false);
    }
  });
}

function toggleMobileSubmenu(trigger) {
  const submenu = getMobileSubmenu(trigger);

  if (!submenu) return;

  const isOpen = trigger.getAttribute("aria-expanded") === "true";

  if (isOpen) {
    closeNestedSubmenus(submenu);
  } else {
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

/* ==========================================================================
   Mobile Drawer State
   ========================================================================== */

function openMobileNav(trigger = null) {
  const nav = getMobileNav();
  const overlay = getMobileOverlay();
  const openButton = trigger || getMobileOpenButton();

  if (!nav || !overlay || isDesktop()) return;

  lastFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : openButton;

  nav.classList.add(CLASSES.open);
  overlay.classList.add(CLASSES.open);

  nav.setAttribute("aria-hidden", "false");
  overlay.setAttribute("aria-hidden", "false");
  openButton?.setAttribute("aria-expanded", "true");

  setMobileScrollLock(true);

  window.requestAnimationFrame(() => {
    const closeButton = nav.querySelector(SELECTORS.mobileClose);

    focusElement(closeButton || nav);
  });
}

function closeMobileNav({ restoreFocus = true } = {}) {
  const nav = getMobileNav();
  const overlay = getMobileOverlay();
  const openButton = getMobileOpenButton();

  if (!nav || !overlay) return;

  nav.classList.remove(CLASSES.open);
  overlay.classList.remove(CLASSES.open);

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

    focusElement(focusTarget);
  }

  lastFocusedElement = null;
}

/* ==========================================================================
   Mobile Focus Trap
   ========================================================================== */

function trapMobileFocus(event) {
  if (event.key !== "Tab" || !isMobileNavOpen()) {
    return;
  }

  const nav = getMobileNav();
  const focusableElements = getFocusableElements(nav);

  if (!focusableElements.length) {
    event.preventDefault();
    focusElement(nav);
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    focusElement(lastElement);
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    focusElement(firstElement);
  }
}

/* ==========================================================================
   Mobile Initialization
   ========================================================================== */

function initializeMobileSubmenus() {
  const nav = getMobileNav();

  if (!nav) return;

  nav.querySelectorAll(SELECTORS.mobileSubmenuTrigger).forEach((trigger) => {
    setMobileSubmenu(trigger, false);
  });
}

function initializeMobileNavigationState() {
  const nav = getMobileNav();
  const overlay = getMobileOverlay();
  const openButton = getMobileOpenButton();

  nav?.classList.remove(CLASSES.open);
  overlay?.classList.remove(CLASSES.open);

  nav?.setAttribute("aria-hidden", "true");
  overlay?.setAttribute("aria-hidden", "true");
  openButton?.setAttribute("aria-expanded", "false");

  setMobileScrollLock(false);
  initializeMobileSubmenus();
}

function handleMobileNavigationClick(event) {
  const openButton = event.target.closest(SELECTORS.mobileOpen);

  if (openButton) {
    openMobileNav(openButton);
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
    closeMobileNav({
      restoreFocus: false,
    });
  }
}

function initializeMobileNavigation() {
  initializeMobileNavigationState();

  document.addEventListener("click", handleMobileNavigationClick);

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

    closeDesktopItem(activeDesktopItem, {
      restoreFocus: true,
    });
  }
}

function handleOutsideClick(event) {
  if (!isDesktop() || !activeDesktopItem) {
    return;
  }

  if (!activeDesktopItem.contains(event.target)) {
    closeAllDesktopMenus();
  }
}

function handleViewportChange(event) {
  clearDesktopTimers();
  closeAllDesktopMenus();

  if (event.matches) {
    closeMobileNav({
      restoreFocus: false,
    });
  } else {
    resetMobileSubmenus();
  }
}

/* ==========================================================================
   Sticky Header State
   ========================================================================== */

function initializeHeaderScrollState(header) {
  let isTicking = false;

  function updateHeaderState() {
    header.classList.toggle("is-scrolled", window.scrollY > 0);

    isTicking = false;
  }

  function handleScroll() {
    if (isTicking) return;

    isTicking = true;

    window.requestAnimationFrame(updateHeaderState);
  }

  updateHeaderState();

  window.addEventListener("scroll", handleScroll, {
    passive: true,
  });
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initHeader() {
  if (initialized) return;

  const header = getHeader();

  if (!header) return;

  initialized = true;

  initializeDesktopMenus();
  initializeMobileNavigation();
  initializeHeaderScrollState(header);

  document.addEventListener("keydown", handleGlobalKeyboard);

  document.addEventListener("click", handleOutsideClick);

  desktopMediaQuery.addEventListener("change", handleViewportChange);
}
