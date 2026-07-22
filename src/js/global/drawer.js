const DRAWER_SELECTOR = "[data-drawer]";
const PANEL_SELECTOR = "[data-drawer-panel]";
const OPEN_TRIGGER_SELECTOR = "[data-drawer-open]";
const CLOSE_TRIGGER_SELECTOR = "[data-drawer-close]";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let activeDrawer = null;
let activeTrigger = null;
let previousBodyOverflow = "";

function getDrawer(name) {
  if (!name) return null;

  return document.querySelector(
    `${DRAWER_SELECTOR}[data-drawer="${CSS.escape(name)}"]`,
  );
}

function getDrawerName(drawer) {
  return drawer?.getAttribute("data-drawer") || null;
}

function getDrawerPanel(drawer) {
  return drawer?.querySelector(PANEL_SELECTOR) || null;
}

function getDrawerTriggers(name) {
  if (!name) return [];

  return document.querySelectorAll(
    `${OPEN_TRIGGER_SELECTOR}[data-drawer-open="${CSS.escape(name)}"]`,
  );
}

function getFocusableElements(drawer) {
  return [...drawer.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    return !element.hasAttribute("hidden") && element.offsetParent !== null;
  });
}

function setTriggerState(name, isExpanded) {
  getDrawerTriggers(name).forEach((trigger) => {
    trigger.setAttribute("aria-expanded", String(isExpanded));
    trigger.classList.toggle("is-active", isExpanded);
  });
}

function lockPageScroll() {
  if (document.body.classList.contains("has-open-drawer")) return;

  previousBodyOverflow = document.body.style.overflow;

  document.body.classList.add("has-open-drawer");
  document.body.style.overflow = "hidden";
}

function unlockPageScroll() {
  document.body.classList.remove("has-open-drawer");
  document.body.style.overflow = previousBodyOverflow;

  previousBodyOverflow = "";
}

function emitDrawerEvent(type, drawer) {
  document.dispatchEvent(
    new CustomEvent(`drawer:${type}`, {
      detail: {
        drawer,
        name: getDrawerName(drawer),
      },
    }),
  );
}

export function openDrawer(name, trigger = null) {
  const drawer = getDrawer(name);
  const panel = getDrawerPanel(drawer);

  if (!drawer || !panel) return false;

  if (activeDrawer && activeDrawer !== drawer) {
    closeDrawer(activeDrawer, {
      restoreFocus: false,
    });
  }

  activeDrawer = drawer;
  activeTrigger = trigger || document.activeElement;

  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");

  setTriggerState(name, true);
  lockPageScroll();

  requestAnimationFrame(() => {
    const focusableElements = getFocusableElements(drawer);
    const firstFocusable = focusableElements[0];

    (firstFocusable || panel).focus({
      preventScroll: true,
    });
  });

  emitDrawerEvent("open", drawer);

  return true;
}

export function closeDrawer(
  drawerOrName = activeDrawer,
  { restoreFocus = true } = {},
) {
  const drawer =
    typeof drawerOrName === "string" ? getDrawer(drawerOrName) : drawerOrName;

  if (!drawer) return false;

  const name = getDrawerName(drawer);
  const triggerToRestore = activeTrigger;

  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");

  setTriggerState(name, false);

  if (drawer === activeDrawer) {
    activeDrawer = null;
    activeTrigger = null;

    unlockPageScroll();
  }

  if (restoreFocus && triggerToRestore instanceof HTMLElement) {
    triggerToRestore.focus({
      preventScroll: true,
    });
  }

  emitDrawerEvent("close", drawer);

  return true;
}

export function toggleDrawer(name, trigger = null) {
  const drawer = getDrawer(name);

  if (!drawer) return false;

  if (drawer.classList.contains("is-open")) {
    return closeDrawer(drawer);
  }

  return openDrawer(name, trigger);
}

function handleDocumentClick(event) {
  const openTrigger = event.target.closest(OPEN_TRIGGER_SELECTOR);

  if (openTrigger) {
    const name = openTrigger.getAttribute("data-drawer-open");

    toggleDrawer(name, openTrigger);
    return;
  }

  const closeTrigger = event.target.closest(CLOSE_TRIGGER_SELECTOR);

  if (closeTrigger) {
    const explicitName = closeTrigger.getAttribute("data-drawer-close");
    const parentDrawer = closeTrigger.closest(DRAWER_SELECTOR);

    closeDrawer(explicitName || parentDrawer);
  }
}

function handleFocusTrap(event) {
  if (event.key !== "Tab" || !activeDrawer) return;

  const focusableElements = getFocusableElements(activeDrawer);
  const panel = getDrawerPanel(activeDrawer);

  if (!focusableElements.length) {
    event.preventDefault();
    panel?.focus();
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

function handleDocumentKeydown(event) {
  if (!activeDrawer) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeDrawer(activeDrawer);
    return;
  }

  handleFocusTrap(event);
}

function initializeDrawer(drawer) {
  const name = getDrawerName(drawer);

  if (!name) return;

  drawer.setAttribute("aria-hidden", "true");
  drawer.classList.remove("is-open");

  setTriggerState(name, false);
}

export function initDrawers() {
  const drawers = document.querySelectorAll(DRAWER_SELECTOR);

  if (!drawers.length) return;

  drawers.forEach(initializeDrawer);

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
}
