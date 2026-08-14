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
  active: "is-active",
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
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(SELECTORS.focusable)).filter(
    (element) =>
      !element.hidden &&
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null,
  );
}

function focusElement(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  try {
    element.focus({
      preventScroll: true,
    });
  } catch {
    element.focus();
  }
}

/* ==========================================================================
   Desktop Mega-Menu Helpers
   ========================================================================== */

function getDesktopTrigger(item) {
  return item?.querySelector(`:scope > ${SELECTORS.desktopNavTrigger}`) || null;
}

function getMegaMenu(item) {
  return item?.querySelector(`:scope > ${SELECTORS.megaMenu}`) || null;
}

function getMegaCategories(container) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(SELECTORS.megaCategory));
}

function getMegaPanels(container) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(SELECTORS.megaPanel));
}

function setHeaderDesktopState(open) {
  getHeader()?.classList.toggle(CLASSES.menuOpen, open);
}

/* ==========================================================================
   Mega-Menu Panels
   ========================================================================== */

/**
 * Displays the panel associated with a level-two link.
 *
 * Level-two items are real links. JavaScript manages only the preview panel;
 * it does not replace their normal navigation behavior.
 */
function activateMegaPanel(category, { focus = false } = {}) {
  if (!(category instanceof HTMLElement)) {
    return false;
  }

  const megaMenu = category.closest(SELECTORS.megaMenu);
  const targetId = category.getAttribute("aria-controls");

  if (!megaMenu || !targetId) {
    return false;
  }

  const categories = getMegaCategories(megaMenu);
  const panels = getMegaPanels(megaMenu);

  const targetPanel = panels.find((panel) => panel.id === targetId);

  if (!targetPanel) {
    return false;
  }

  categories.forEach((item) => {
    item.classList.toggle(CLASSES.active, item === category);
  });

  panels.forEach((panel) => {
    const active = panel === targetPanel;

    panel.classList.toggle(CLASSES.active, active);
    panel.hidden = !active;
    panel.setAttribute("aria-hidden", String(!active));
  });

  if (focus) {
    focusElement(category);
  }

  return true;
}

function getDefaultMegaCategory(item) {
  const categories = getMegaCategories(item);

  if (!categories.length) {
    return null;
  }

  return (
    categories.find((category) => category.hasAttribute("data-mega-default")) ||
    categories[0]
  );
}

function activateInitialMegaPanel(item) {
  const defaultCategory = getDefaultMegaCategory(item);

  if (!defaultCategory) {
    return;
  }

  activateMegaPanel(defaultCategory);
}

function initializeMegaPanels(item) {
  const megaMenu = getMegaMenu(item);

  if (!megaMenu) {
    return;
  }

  const categories = getMegaCategories(megaMenu);
  const panels = getMegaPanels(megaMenu);

  categories.forEach((category) => {
    /*
     * Remove obsolete tab-interface attributes.
     *
     * Level-two entries are now ordinary links, not ARIA tabs.
     */
    category.removeAttribute("role");
    category.removeAttribute("aria-selected");

    if (category.getAttribute("tabindex") === "-1") {
      category.removeAttribute("tabindex");
    }
  });

  panels.forEach((panel) => {
    if (panel.getAttribute("role") === "tabpanel") {
      panel.setAttribute("role", "region");
    }
  });

  activateInitialMegaPanel(item);
}

/* ==========================================================================
   Desktop Menu State
   ========================================================================== */

function openDesktopItem(item) {
  if (!(item instanceof HTMLElement) || !isDesktop()) {
    return;
  }

  clearDesktopTimers();

  if (activeDesktopItem && activeDesktopItem !== item) {
    closeDesktopItem(activeDesktopItem);
  }

  const trigger = getDesktopTrigger(item);
  const megaMenu = getMegaMenu(item);

  if (!trigger || !megaMenu) {
    return;
  }

  /*
   * Always restore the configured default panel when a top-level menu opens.
   */
  activateInitialMegaPanel(item);

  activeDesktopItem = item;

  item.classList.add(CLASSES.open);
  trigger.setAttribute("aria-expanded", "true");
  megaMenu.setAttribute("aria-hidden", "false");

  setHeaderDesktopState(true);
}

function closeDesktopItem(item, { restoreFocus = false } = {}) {
  if (!(item instanceof HTMLElement)) {
    return;
  }

  const trigger = getDesktopTrigger(item);
  const megaMenu = getMegaMenu(item);

  item.classList.remove(CLASSES.open);
  trigger?.setAttribute("aria-expanded", "false");
  megaMenu?.setAttribute("aria-hidden", "true");

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
  if (!(item instanceof HTMLElement) || !isDesktop()) {
    return;
  }

  if (item.classList.contains(CLASSES.open)) {
    closeDesktopItem(item);
  } else {
    openDesktopItem(item);
  }
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
   Mega-Menu Keyboard Navigation
   ========================================================================== */

function handleMegaCategoryKeyboard(event, category) {
  const megaMenu = category.closest(SELECTORS.megaMenu);

  if (!megaMenu) {
    return;
  }

  const categories = getMegaCategories(megaMenu);
  const currentIndex = categories.indexOf(category);

  if (currentIndex < 0 || !categories.length) {
    return;
  }

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
      /*
       * Level-two entries are real links. Do not prevent Enter.
       * The browser follows the link normally.
       */
      return;

    case " ":
      /*
       * Space previews the associated panel without navigating.
       */
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

  if (!trigger || !megaMenu) {
    return;
  }

  item.classList.remove(CLASSES.open);

  trigger.setAttribute("aria-expanded", "false");
  megaMenu.setAttribute("aria-hidden", "true");

  initializeMegaPanels(item);

  item.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") {
      return;
    }

    scheduleDesktopOpen(item);
  });

  item.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") {
      return;
    }

    scheduleDesktopClose(item);
  });

  /*
   * The top-level trigger remains responsible for opening and closing its
   * mega menu.
   */
  trigger.addEventListener("click", (event) => {
    if (!isDesktop()) {
      return;
    }

    event.preventDefault();

    toggleDesktopItem(item);
  });

  trigger.addEventListener("keydown", (event) => {
    if (!isDesktop()) {
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();

        openDesktopItem(item);

        const activeCategory = item.querySelector(
          `${SELECTORS.megaCategory}.${CLASSES.active}`,
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

/* ==========================================================================
   Desktop Delegated Events
   ========================================================================== */

function getMegaCategoryFromEvent(event) {
  if (!(event.target instanceof Element)) {
    return null;
  }

  return event.target.closest(SELECTORS.megaCategory);
}

function handleMegaCategoryPointer(event) {
  if (!isDesktop()) {
    return;
  }

  const category = getMegaCategoryFromEvent(event);

  if (!category) {
    return;
  }

  activateMegaPanel(category);
}

function handleMegaCategoryFocus(event) {
  if (!isDesktop()) {
    return;
  }

  const category = getMegaCategoryFromEvent(event);

  if (!category) {
    return;
  }

  activateMegaPanel(category);
}

function handleMegaCategoryKeydown(event) {
  if (!isDesktop()) {
    return;
  }

  const category = getMegaCategoryFromEvent(event);

  if (!category) {
    return;
  }

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
  if (!(trigger instanceof HTMLElement)) {
    return null;
  }

  const targetId = trigger.getAttribute("aria-controls");

  if (!targetId) {
    return null;
  }

  const rootNode = trigger.getRootNode();

  if (typeof rootNode.getElementById === "function") {
    return rootNode.getElementById(targetId);
  }

  return trigger.ownerDocument.getElementById(targetId);
}

/**
 * Returns the submenu trigger owned directly by a mobile list item.
 *
 * This supports both structures:
 *
 * 1. A trigger placed directly inside the list item.
 * 2. A trigger placed inside .mobile-nav__submenu-row beside a real link.
 */
function getDirectMobileSubmenuTrigger(listItem) {
  if (!(listItem instanceof HTMLElement)) {
    return null;
  }

  const directTrigger = listItem.querySelector(
    `:scope > ${SELECTORS.mobileSubmenuTrigger}`,
  );

  if (directTrigger) {
    return directTrigger;
  }

  return listItem.querySelector(
    `:scope > .mobile-nav__submenu-row > ${SELECTORS.mobileSubmenuTrigger}`,
  );
}

function setMobileSubmenu(trigger, open) {
  if (!(trigger instanceof HTMLElement)) {
    return;
  }

  const submenu = getMobileSubmenu(trigger);

  if (!submenu) {
    return;
  }

  trigger.setAttribute("aria-expanded", String(open));
  trigger.classList.toggle(CLASSES.open, open);

  submenu.classList.toggle(CLASSES.open, open);
  submenu.hidden = !open;
  submenu.setAttribute("aria-hidden", String(!open));
}

function closeNestedSubmenus(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  container
    .querySelectorAll(SELECTORS.mobileSubmenuTrigger)
    .forEach((trigger) => {
      setMobileSubmenu(trigger, false);
    });
}

function closeSiblingSubmenus(trigger) {
  if (!(trigger instanceof HTMLElement)) {
    return;
  }

  const currentListItem = trigger.closest("li");
  const currentList = currentListItem?.parentElement;

  if (!currentListItem || !currentList?.matches("ul")) {
    return;
  }

  Array.from(currentList.children).forEach((listItem) => {
    if (!(listItem instanceof HTMLElement) || listItem === currentListItem) {
      return;
    }

    const siblingTrigger = getDirectMobileSubmenuTrigger(listItem);

    if (!siblingTrigger || siblingTrigger === trigger) {
      return;
    }

    const siblingSubmenu = getMobileSubmenu(siblingTrigger);

    closeNestedSubmenus(siblingSubmenu);
    setMobileSubmenu(siblingTrigger, false);
  });
}

function toggleMobileSubmenu(trigger) {
  const submenu = getMobileSubmenu(trigger);

  if (!submenu) {
    return;
  }

  const open = trigger.getAttribute("aria-expanded") === "true";

  if (open) {
    closeNestedSubmenus(submenu);
  } else {
    closeSiblingSubmenus(trigger);
  }

  setMobileSubmenu(trigger, !open);
}

function resetMobileSubmenus() {
  const nav = getMobileNav();

  if (!nav) {
    return;
  }

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

  if (!nav || !overlay || isDesktop()) {
    return;
  }

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

  if (!nav || !overlay) {
    return;
  }

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

  if (!nav) {
    return;
  }

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
  if (!(event.target instanceof Element)) {
    return;
  }

  const openButton = event.target.closest(SELECTORS.mobileOpen);

  if (openButton) {
    event.preventDefault();
    openMobileNav(openButton);

    return;
  }

  const closeButton = event.target.closest(SELECTORS.mobileClose);

  if (closeButton) {
    event.preventDefault();
    closeMobileNav();

    return;
  }

  const overlay = event.target.closest(SELECTORS.mobileOverlay);

  if (overlay) {
    event.preventDefault();
    closeMobileNav();

    return;
  }

  /*
   * Only the dedicated expansion button controls a nested mobile submenu.
   *
   * The level-two title beside it remains a normal navigable link.
   */
  const submenuTrigger = event.target.closest(SELECTORS.mobileSubmenuTrigger);

  if (submenuTrigger) {
    event.preventDefault();
    toggleMobileSubmenu(submenuTrigger);

    return;
  }

  /*
   * Following an ordinary navigation link closes the drawer without moving
   * focus back to the menu-open button.
   */
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
  if (event.key !== "Escape") {
    return;
  }

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
  if (!isDesktop() || !activeDesktopItem || !(event.target instanceof Node)) {
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
  let ticking = false;

  function updateHeaderState() {
    header.classList.toggle("is-scrolled", window.scrollY > 0);

    ticking = false;
  }

  function handleScroll() {
    if (ticking) {
      return;
    }

    ticking = true;

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
  if (initialized) {
    return;
  }

  const header = getHeader();

  if (!header) {
    return;
  }

  initialized = true;

  initializeDesktopMenus();
  initializeMobileNavigation();
  initializeHeaderScrollState(header);

  document.addEventListener("keydown", handleGlobalKeyboard);

  document.addEventListener("click", handleOutsideClick);

  desktopMediaQuery.addEventListener("change", handleViewportChange);
}
