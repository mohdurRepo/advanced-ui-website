/* ==========================================================================
   Drawer
   ==========================================================================

   Public API (unchanged): openDrawer, closeDrawer, toggleDrawer, initDrawers

   Events on document (detail: { drawer, name }):
   - drawer:open    the drawer starts opening
   - drawer:close   the drawer starts closing
   - drawer:closed  the closing transition has finished

   Listened on document:
   - drawer:request-close  detail: { name, restoreFocus = true }
     Lets other modules close a drawer without importing this file.

   Markup
   - [data-drawer="name"]           drawer root
   - [data-drawer-panel]            sliding panel (role="dialog")
   - [data-drawer-open="name"]      opens / toggles the drawer
   - [data-drawer-close]            closes the parent drawer
   - [data-drawer-initial-focus]    optional element to focus on open
   ========================================================================== */

const DRAWER_SELECTOR = "[data-drawer]";
const PANEL_SELECTOR = "[data-drawer-panel]";
const OPEN_TRIGGER_SELECTOR = "[data-drawer-open]";
const CLOSE_TRIGGER_SELECTOR = "[data-drawer-close]";
const INITIAL_FOCUS_SELECTOR = "[data-drawer-initial-focus]";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const CLASSES = {
  open: "is-open",
  closing: "is-closing",
  triggerActive: "is-active",
  bodyLocked: "has-open-drawer",
};

let activeDrawer = null;
let activeTrigger = null;
let inertElements = [];
let previousOverflow = { html: "", body: "" };
let initialized = false;

/* ==========================================================================
   Lookup
   ========================================================================== */

function getDrawer(name) {
  if (!name) return null;

  return document.querySelector(
    `${DRAWER_SELECTOR}[data-drawer="${CSS.escape(name)}"]`,
  );
}

function resolveDrawer(drawerOrName) {
  return typeof drawerOrName === "string"
    ? getDrawer(drawerOrName)
    : drawerOrName;
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

function isOpen(drawer) {
  return drawer?.classList.contains(CLASSES.open) ?? false;
}

/* ==========================================================================
   Focus
   ========================================================================== */

/**
 * True when an element can actually receive focus right now.
 *
 * checkVisibility() also catches visibility: hidden (collapsed accordion
 * panels during their animation), which offsetParent does not.
 */

function isFocusable(element) {
  if (element.closest("[hidden], [inert]")) return false;

  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({
      visibilityProperty: true,
      checkVisibilityCSS: true,
    });
  }

  return (
    window.getComputedStyle(element).visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function getFocusableElements(drawer) {
  return Array.from(drawer.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    isFocusable,
  );
}

function focusElement(element) {
  if (!(element instanceof HTMLElement)) return;

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function focusInitial(drawer) {
  const panel = getDrawerPanel(drawer);
  const preferred = drawer.querySelector(INITIAL_FOCUS_SELECTOR);

  focusElement(
    (preferred && isFocusable(preferred) && preferred) ||
      getFocusableElements(drawer)[0] ||
      panel,
  );
}

/* ==========================================================================
   Page Isolation
   ========================================================================== */

/**
 * Makes everything outside the drawer inert, so screen readers (including
 * iOS VoiceOver swipe navigation) cannot reach the page behind it.
 * Walks up to <body>, so the drawer need not be a direct child of it.
 */

function isolateDrawer(drawer) {
  inertElements = [];

  let node = drawer;

  while (node && node.parentElement && node !== document.body) {
    Array.from(node.parentElement.children).forEach((sibling) => {
      if (
        sibling === node ||
        sibling.hasAttribute("inert") ||
        sibling.matches("script, style, template, link, meta")
      ) {
        return;
      }

      sibling.setAttribute("inert", "");
      inertElements.push(sibling);
    });

    node = node.parentElement;
  }
}

function releaseIsolation() {
  inertElements.forEach((element) => element.removeAttribute("inert"));
  inertElements = [];
}

/* ==========================================================================
   Scroll Lock
   ========================================================================== */

function lockPageScroll() {
  if (document.body.classList.contains(CLASSES.bodyLocked)) return;

  previousOverflow = {
    html: document.documentElement.style.overflow,
    body: document.body.style.overflow,
  };

  document.body.classList.add(CLASSES.bodyLocked);

  /* Both elements: older iOS Safari ignores overflow on body alone. */
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

function unlockPageScroll() {
  document.body.classList.remove(CLASSES.bodyLocked);

  document.documentElement.style.overflow = previousOverflow.html;
  document.body.style.overflow = previousOverflow.body;
}

/* ==========================================================================
   Triggers and Events
   ========================================================================== */

function setTriggerState(name, expanded) {
  getDrawerTriggers(name).forEach((trigger) => {
    trigger.setAttribute("aria-expanded", String(expanded));
    trigger.classList.toggle(CLASSES.triggerActive, expanded);
  });
}

function emitDrawerEvent(type, drawer) {
  document.dispatchEvent(
    new CustomEvent(`drawer:${type}`, {
      detail: { drawer, name: getDrawerName(drawer) },
    }),
  );
}

/* ==========================================================================
   Closing Transition
   ========================================================================== */

/* Longest transition (duration + delay) on an element, in milliseconds. */
function getTransitionTime(element) {
  const style = window.getComputedStyle(element);

  const toMs = (value) =>
    value.split(",").map((part) => {
      const number = parseFloat(part) || 0;
      return part.trim().endsWith("ms") ? number : number * 1000;
    });

  const durations = toMs(style.transitionDuration);
  const delays = toMs(style.transitionDelay);

  return Math.max(0, ...durations) + Math.max(0, ...delays);
}

/**
 * Keeps the drawer visible (.is-closing) while the panel slides out, then
 * emits drawer:closed. Reduced motion (0ms tokens) finishes immediately.
 */

function runClosingTransition(drawer) {
  const panel = getDrawerPanel(drawer);
  const time = panel ? getTransitionTime(panel) : 0;

  const finish = () => {
    /* Re-opened during the transition: nothing to finish. */
    if (!drawer.classList.contains(CLASSES.closing)) return;

    drawer.classList.remove(CLASSES.closing);
    emitDrawerEvent("closed", drawer);
  };

  drawer.classList.add(CLASSES.closing);

  if (time <= 0) {
    finish();
    return;
  }

  let timer = 0;

  const onTransitionEnd = (event) => {
    if (event.target !== panel) return;

    panel.removeEventListener("transitionend", onTransitionEnd);
    window.clearTimeout(timer);
    finish();
  };

  panel.addEventListener("transitionend", onTransitionEnd);

  /* Fallback when transitionend never fires (tab hidden, interrupted). */
  timer = window.setTimeout(() => {
    panel.removeEventListener("transitionend", onTransitionEnd);
    finish();
  }, time + 50);
}

/* ==========================================================================
   Open / Close
   ========================================================================== */

export function openDrawer(name, trigger = null) {
  const drawer = getDrawer(name);
  const panel = getDrawerPanel(drawer);

  if (!drawer || !panel) return false;
  if (isOpen(drawer)) return true;

  if (activeDrawer && activeDrawer !== drawer) {
    closeDrawer(activeDrawer, { restoreFocus: false });
  }

  activeDrawer = drawer;
  activeTrigger = trigger || document.activeElement;

  drawer.classList.remove(CLASSES.closing);
  drawer.classList.add(CLASSES.open);
  drawer.setAttribute("aria-hidden", "false");

  setTriggerState(name, true);
  lockPageScroll();
  isolateDrawer(drawer);

  window.requestAnimationFrame(() => focusInitial(drawer));

  emitDrawerEvent("open", drawer);

  return true;
}

export function closeDrawer(
  drawerOrName = activeDrawer,
  { restoreFocus = true } = {},
) {
  const drawer = resolveDrawer(drawerOrName);

  if (!drawer || !isOpen(drawer)) return false;

  const triggerToRestore = activeTrigger;

  drawer.classList.remove(CLASSES.open);
  drawer.setAttribute("aria-hidden", "true");

  setTriggerState(getDrawerName(drawer), false);

  if (drawer === activeDrawer) {
    activeDrawer = null;
    activeTrigger = null;

    /* Release before restoring focus: the trigger sits in the inert page. */
    releaseIsolation();
    unlockPageScroll();
  }

  if (
    restoreFocus &&
    triggerToRestore instanceof HTMLElement &&
    triggerToRestore.isConnected
  ) {
    focusElement(triggerToRestore);
  }

  emitDrawerEvent("close", drawer);
  runClosingTransition(drawer);

  return true;
}

export function toggleDrawer(name, trigger = null) {
  const drawer = getDrawer(name);

  if (!drawer) return false;

  return isOpen(drawer) ? closeDrawer(drawer) : openDrawer(name, trigger);
}

/* ==========================================================================
   Document Events
   ========================================================================== */

function handleDocumentClick(event) {
  if (!(event.target instanceof Element)) return;

  const openTrigger = event.target.closest(OPEN_TRIGGER_SELECTOR);

  if (openTrigger) {
    toggleDrawer(openTrigger.getAttribute("data-drawer-open"), openTrigger);
    return;
  }

  const closeTrigger = event.target.closest(CLOSE_TRIGGER_SELECTOR);

  if (closeTrigger) {
    const explicitName = closeTrigger.getAttribute("data-drawer-close");

    closeDrawer(explicitName || closeTrigger.closest(DRAWER_SELECTOR));
  }
}

function handleFocusTrap(event) {
  const focusable = getFocusableElements(activeDrawer);

  if (!focusable.length) {
    event.preventDefault();
    focusElement(getDrawerPanel(activeDrawer));
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const current = document.activeElement;

  /* Focus outside the drawer (browsers without inert): pull it back in. */
  if (!activeDrawer.contains(current)) {
    event.preventDefault();
    focusElement(event.shiftKey ? last : first);
    return;
  }

  if (
    event.shiftKey &&
    (current === first || current === getDrawerPanel(activeDrawer))
  ) {
    event.preventDefault();
    focusElement(last);
    return;
  }

  if (!event.shiftKey && current === last) {
    event.preventDefault();
    focusElement(first);
  }
}

function handleCloseRequest(event) {
  const { name, restoreFocus = true } = event.detail || {};

  closeDrawer(name || activeDrawer, { restoreFocus });
}

function handleDocumentKeydown(event) {
  if (!activeDrawer) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeDrawer(activeDrawer);
    return;
  }

  if (event.key === "Tab") {
    handleFocusTrap(event);
  }
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeDrawer(drawer) {
  const name = getDrawerName(drawer);

  if (!name) return;

  drawer.classList.remove(CLASSES.open, CLASSES.closing);
  drawer.setAttribute("aria-hidden", "true");

  setTriggerState(name, false);
}

export function initDrawers() {
  if (initialized) return;

  const drawers = document.querySelectorAll(DRAWER_SELECTOR);

  if (!drawers.length) return;

  initialized = true;

  drawers.forEach(initializeDrawer);

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
  document.addEventListener("drawer:request-close", handleCloseRequest);
}
