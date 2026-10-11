/* ==========================================================================
   Market Overview
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Manage the outer Market Overview <details> disclosure.
 * - Resolve the initial state from data-market-details-default:
 *
 *     auto    small screens: always closed on load, whatever is stored;
 *             large screens: the visitor's stored choice, open by default
 *     open    open on load
 *     closed  closed on load
 *
 * - Support data-market-details-mode="always" (never collapses).
 * - Publish data-market-details-state="open" | "closed" on the root.
 * - Remember explicit toggles for "auto" overviews.
 * - Coordinate the curtain open / close animation lifecycle.
 * - Keep the handle in view after the visitor closes Details (when open,
 *   the handle sits at the bottom of Details; closing moves it back up to
 *   the Summary, which can be above the visible screen).
 * - Publish overview visibility events for dependent components.
 * - Localize the handle label.
 *
 * "auto" also follows the viewport: shrinking below AUTO_OPEN_QUERY closes
 * Details; growing past it reopens them unless the visitor's stored choice
 * is "closed".
 *
 * This module does NOT own:
 *
 * - Summary market-card selection.
 * - Market detail-panel switching.
 * - Nested tabs inside detail panels.
 * - Mobile internal detail toggles.
 * - Bridge geometry.
 * - Market clock behavior.
 */

import {
  createMediaQuery,
  dispatchCompatibilityResize,
  getLanguage,
  getScrollBehavior,
  onMediaQueryChange,
  prefersReducedMotion,
  readStorage,
  writeStorage,
} from "./market-shared";

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-overview]",

  disclosure: "[data-market-details-disclosure]",

  toggle: "[data-market-overview-toggle]",
  toggleLabel: "[data-market-overview-toggle-label]",

  details: "[data-market-overview-details]",

  animationTarget: ".market-details",
};

/* ==========================================================================
   Classes
   ========================================================================== */

const CLASSES = {
  opening: "is-opening",
  closing: "is-closing",
  animating: "is-animating",
};

/* ==========================================================================
   Modes / Defaults / States
   ========================================================================== */

const MODES = {
  always: "always",
  disclosure: "disclosure",
};

const DEFAULTS = {
  auto: "auto",
  open: "open",
  closed: "closed",
};

const STATES = {
  open: "open",
  closed: "closed",
};

/* ==========================================================================
   Automatic Default
   ========================================================================== */

/*
 * "auto" opens Details only when the viewport has room for Summary and the
 * Details canvas together: lg width and a laptop-plus height.
 *
 * Height matters as much as width: a wide but short laptop (1366 × 768)
 * would otherwise open Details and push the page below the first screen.
 */

const AUTO_OPEN_QUERY = "(min-width: 992px) and (min-height: 820px)";

/* ==========================================================================
   Storage
   ========================================================================== */

/*
 * The visitor's last explicit choice for "auto" overviews.
 * Same "se-" naming convention as preferences.js.
 */

const STORAGE_KEY = "se-market-details";

/* ==========================================================================
   Events
   ========================================================================== */

const EVENTS = {
  change: "market:overviewchange",
  detailsShown: "market:detailsshown",
};

/* ==========================================================================
   Animation
   ========================================================================== */

const ANIMATIONS = {
  opening: "market-overview-curtain-open",
  closing: "market-overview-curtain-close",
};

/*
 * CSS curtain motion is ~200ms. This timeout is only a defensive fallback
 * for cases where animationend never arrives.
 */

const ANIMATION_FALLBACK = 350;

/* ==========================================================================
   Labels
   ========================================================================== */

const LABELS = {
  en: {
    show: "Show market details",
    hide: "Hide market details",
  },

  ar: {
    show: "عرض تفاصيل السوق",
    hide: "إخفاء تفاصيل السوق",
  },
};

/* ==========================================================================
   State
   ========================================================================== */

const initializedRoots = new WeakSet();

const rootStates = new WeakMap();

let globalEventsInitialized = false;

let autoOpenQuery = null;

function getAutoOpenQuery() {
  autoOpenQuery ??= createMediaQuery(AUTO_OPEN_QUERY);

  return autoOpenQuery;
}

/* ==========================================================================
   Element Collection
   ========================================================================== */

function collectElements(root) {
  if (!root) {
    return null;
  }

  const disclosure = root.querySelector(SELECTORS.disclosure);

  if (!disclosure) {
    return null;
  }

  const toggle = disclosure.querySelector(SELECTORS.toggle);

  const details = disclosure.querySelector(SELECTORS.details);

  if (!toggle || !details) {
    return null;
  }

  return {
    root,

    disclosure,

    toggle,

    toggleLabel: toggle.querySelector(SELECTORS.toggleLabel),

    details,

    animationTarget:
      details.querySelector(SELECTORS.animationTarget) || details,
  };
}

function getState(root) {
  return rootStates.get(root) || null;
}

function getElements(root) {
  return getState(root)?.elements ?? null;
}

/* ==========================================================================
   Mode / Default
   ========================================================================== */

function isAlwaysVisible(elements) {
  return elements?.root?.dataset.marketDetailsMode === MODES.always;
}

function getDefault(elements) {
  const value = elements?.root?.dataset.marketDetailsDefault;

  return Object.values(DEFAULTS).includes(value) ? value : DEFAULTS.closed;
}

function isRemembered(elements) {
  return getDefault(elements) === DEFAULTS.auto;
}

/* ==========================================================================
   Initial State Resolution
   ========================================================================== */

function readStoredState() {
  const value = readStorage(STORAGE_KEY);

  return value === STATES.open || value === STATES.closed ? value : null;
}

function resolveInitialOpen(elements) {
  switch (getDefault(elements)) {
    case DEFAULTS.open:
      return true;

    case DEFAULTS.auto:
      /*
       * Small screens always start closed; the stored choice applies only
       * where there is room for Details.
       */

      if (!(getAutoOpenQuery()?.matches ?? true)) {
        return false;
      }

      return readStoredState() !== STATES.closed;

    default:
      return false;
  }
}

function rememberState(elements, open) {
  if (!isRemembered(elements)) {
    return;
  }

  writeStorage(STORAGE_KEY, open ? STATES.open : STATES.closed);
}

/* ==========================================================================
   Automatic Viewport Following
   ========================================================================== */

/*
 * Fires only when the viewport crosses the threshold, never on ordinary
 * resizing within one side of it.
 *
 * - Becoming small: Details close, whatever the stored choice (the choice
 *   itself is kept, nothing is written).
 * - Becoming large: Details reopen, unless the stored choice is "closed".
 */

function handleAutoOpenChange() {
  const large = getAutoOpenQuery()?.matches ?? true;

  const open = large && readStoredState() !== STATES.closed;

  getInitializedRoots().forEach((root) => {
    const elements = getElements(root);

    if (
      !elements ||
      isAlwaysVisible(elements) ||
      getDefault(elements) !== DEFAULTS.auto ||
      elements.disclosure.open === open
    ) {
      return;
    }

    void (open ? openDisclosure(elements) : closeDisclosure(elements));
  });
}

/* ==========================================================================
   Handle Label
   ========================================================================== */

function getDisclosureLabel(open) {
  const labels = LABELS[getLanguage()];

  return open ? labels.hide : labels.show;
}

/*
 * The label element is the accessible name. <summary> exposes its own
 * expanded state, so no aria-expanded or aria-label is written.
 */

function updateDisclosureLabel(elements) {
  if (!elements) {
    return;
  }

  const { disclosure, toggle, toggleLabel } = elements;

  const label = getDisclosureLabel(disclosure.open);

  toggle.removeAttribute("aria-expanded");

  toggle.removeAttribute("aria-label");

  /*
   * Project tooltip convention (useful where the label is visually hidden).
   */

  toggle.setAttribute("data-tooltip", label);

  if (toggleLabel && toggleLabel.textContent !== label) {
    toggleLabel.textContent = label;
  }
}

/* ==========================================================================
   Details Accessibility
   ========================================================================== */

function updateDetailsAccessibility(elements) {
  if (!elements) {
    return;
  }

  const { disclosure, details } = elements;

  const open = disclosure.open;

  /*
   * Keep the wrapper rendered: native <details> controls visual disclosure,
   * and the wrapper is still needed for bridge/layout measurement.
   */

  details.hidden = false;

  details.setAttribute("aria-hidden", String(!open));

  if ("inert" in details) {
    details.inert = !open;
  }
}

/* ==========================================================================
   Root State
   ========================================================================== */

function updateRootState(elements) {
  if (!elements) {
    return;
  }

  const value = elements.disclosure.open ? STATES.open : STATES.closed;

  if (elements.root.dataset.marketDetailsState !== value) {
    elements.root.dataset.marketDetailsState = value;
  }
}

/* ==========================================================================
   State Synchronization
   ========================================================================== */

function synchronizeDisclosureState(elements) {
  updateDisclosureLabel(elements);

  updateDetailsAccessibility(elements);

  updateRootState(elements);
}

/* ==========================================================================
   Event Dispatch
   ========================================================================== */

function dispatchOverviewChange(elements, open) {
  if (!elements) {
    return;
  }

  const { root, disclosure, details } = elements;

  root.dispatchEvent(
    new CustomEvent(EVENTS.change, {
      bubbles: true,

      detail: {
        root,
        disclosure,
        details,
        open,
      },
    }),
  );
}

function dispatchDetailsShown(elements) {
  if (!elements) {
    return;
  }

  const { root, disclosure, details } = elements;

  details.dispatchEvent(
    new CustomEvent(EVENTS.detailsShown, {
      bubbles: true,

      detail: {
        root,
        disclosure,
        details,
      },
    }),
  );
}

/* ==========================================================================
   Animation State
   ========================================================================== */

function clearAnimationState(disclosure) {
  disclosure?.classList.remove(
    CLASSES.opening,
    CLASSES.closing,
    CLASSES.animating,
  );
}

function isAnimating(disclosure) {
  return Boolean(disclosure?.classList.contains(CLASSES.animating));
}

/* ==========================================================================
   Animation Waiter
   ========================================================================== */

function waitForCurtainAnimation(element, animationName) {
  if (!element || prefersReducedMotion()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let completed = false;

    let fallbackTimer = null;

    function cleanup() {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }

      element.removeEventListener("animationend", handleAnimationEnd);

      element.removeEventListener("animationcancel", handleAnimationCancel);
    }

    function complete() {
      if (completed) {
        return;
      }

      completed = true;

      cleanup();

      resolve();
    }

    function handleAnimationEnd(event) {
      if (event.target !== element || event.animationName !== animationName) {
        return;
      }

      complete();
    }

    function handleAnimationCancel(event) {
      if (event.target === element) {
        complete();
      }
    }

    element.addEventListener("animationend", handleAnimationEnd);

    element.addEventListener("animationcancel", handleAnimationCancel);

    fallbackTimer = window.setTimeout(complete, ANIMATION_FALLBACK);
  });
}

/* ==========================================================================
   Visible Layout Refresh
   ========================================================================== */

function refreshVisibleContent(elements) {
  if (!elements) {
    return;
  }

  const { root } = elements;

  /*
   * Two frames: 1. disclosure/style state renders; 2. dependent geometry
   * settles.
   */

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!root.isConnected) {
        return;
      }

      dispatchDetailsShown(elements);

      dispatchCompatibilityResize();
    });
  });
}

/* ==========================================================================
   Always-visible Mode
   ========================================================================== */

function initializeAlwaysVisibleMode(elements) {
  const { disclosure, toggle } = elements;

  clearAnimationState(disclosure);

  disclosure.open = true;

  /*
   * <summary> stays in the DOM for structural consistency but leaves
   * interaction and the accessibility tree.
   */

  toggle.hidden = true;

  toggle.setAttribute("aria-hidden", "true");

  toggle.setAttribute("tabindex", "-1");

  synchronizeDisclosureState(elements);

  dispatchOverviewChange(elements, true);

  refreshVisibleContent(elements);
}

/* ==========================================================================
   Disclosure Mode
   ========================================================================== */

function initializeDisclosureMode(elements) {
  const { disclosure, toggle } = elements;

  clearAnimationState(disclosure);

  toggle.hidden = false;

  toggle.removeAttribute("aria-hidden");

  toggle.removeAttribute("tabindex");

  /*
   * Normally already applied before first paint by the inline bootstrap;
   * setting the same value again is a no-op.
   */

  disclosure.open = resolveInitialOpen(elements);

  synchronizeDisclosureState(elements);

  if (disclosure.open) {
    dispatchOverviewChange(elements, true);

    refreshVisibleContent(elements);
  }
}

/* ==========================================================================
   Open Disclosure
   ========================================================================== */

async function openDisclosure(elements) {
  if (!elements || isAlwaysVisible(elements)) {
    return;
  }

  const { root, disclosure, animationTarget } = elements;

  const state = getState(root);

  if (!state || isAnimating(disclosure) || disclosure.open) {
    return;
  }

  /*
   * Operation version: if anything changes the disclosure while the
   * animation is pending, this completion becomes stale and exits.
   */

  const operationId = state.operationId + 1;

  state.operationId = operationId;

  disclosure.classList.remove(CLASSES.closing);

  disclosure.classList.add(CLASSES.opening, CLASSES.animating);

  /*
   * Open before the curtain runs so contents render and take part in layout.
   */

  disclosure.open = true;

  synchronizeDisclosureState(elements);

  dispatchOverviewChange(elements, true);

  await waitForCurtainAnimation(animationTarget, ANIMATIONS.opening);

  if (
    !root.isConnected ||
    state.operationId !== operationId ||
    !disclosure.open
  ) {
    return;
  }

  disclosure.classList.remove(CLASSES.opening, CLASSES.animating);

  refreshVisibleContent(elements);
}

/* ==========================================================================
   Keep Handle In View
   ========================================================================== */

/*
 * The sticky header covers the top of the viewport; the document's
 * scroll-padding-block-start (set from --app-header-height) tells us how
 * much. scrollIntoView() respects the same padding.
 *
 * Focus stays on the <summary> throughout, so keyboard users keep their
 * place; only the scroll position is corrected.
 */

function getTopObstruction() {
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("scroll-padding-block-start");

  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? number : 0;
}

function keepHandleInView(elements) {
  const { toggle } = elements;

  const rect = toggle.getBoundingClientRect();

  const outOfView =
    rect.top < getTopObstruction() || rect.bottom > window.innerHeight;

  if (!outOfView) {
    return;
  }

  toggle.scrollIntoView({
    behavior: getScrollBehavior(),

    block: "nearest",
  });
}

/* ==========================================================================
   Close Disclosure
   ========================================================================== */

/*
 * keepInView: true for visitor-initiated closes only. A close caused by the
 * viewport crossing the threshold must not move the page.
 */

async function closeDisclosure(elements, { keepInView = false } = {}) {
  if (!elements || isAlwaysVisible(elements)) {
    return;
  }

  const { root, disclosure, animationTarget } = elements;

  const state = getState(root);

  if (!state || isAnimating(disclosure) || !disclosure.open) {
    return;
  }

  const operationId = state.operationId + 1;

  state.operationId = operationId;

  disclosure.classList.remove(CLASSES.opening);

  disclosure.classList.add(CLASSES.closing, CLASSES.animating);

  /*
   * Native <details> stays open (and the root state stays "open") until the
   * closing curtain has finished.
   */

  await waitForCurtainAnimation(animationTarget, ANIMATIONS.closing);

  if (!root.isConnected || state.operationId !== operationId) {
    return;
  }

  disclosure.open = false;

  clearAnimationState(disclosure);

  synchronizeDisclosureState(elements);

  dispatchOverviewChange(elements, false);

  if (keepInView) {
    keepHandleInView(elements);
  }
}

/* ==========================================================================
   Toggle Disclosure
   ========================================================================== */

/*
 * The only entry point for visitor-initiated changes, therefore the only
 * place a choice is remembered.
 */

function toggleDisclosure(elements) {
  if (
    !elements ||
    isAlwaysVisible(elements) ||
    isAnimating(elements.disclosure)
  ) {
    return;
  }

  const nextOpen = !elements.disclosure.open;

  rememberState(elements, nextOpen);

  if (nextOpen) {
    void openDisclosure(elements);

    return;
  }

  void closeDisclosure(elements, { keepInView: true });
}

/* ==========================================================================
   Summary Click
   ========================================================================== */

function handleSummaryClick(elements, event) {
  /*
   * Prevent native immediate toggling: JS controls the timing so the
   * closing curtain completes before <details> becomes closed.
   */

  event.preventDefault();

  toggleDisclosure(elements);
}

/* ==========================================================================
   Native Toggle Synchronization
   ========================================================================== */

function handleNativeToggle(elements) {
  const { root, disclosure } = elements;

  const state = getState(root);

  if (!state) {
    return;
  }

  /*
   * Any externally triggered native change invalidates a pending animation
   * completion (find-in-page, another script, etc.).
   */

  if (!isAnimating(disclosure)) {
    state.operationId += 1;
  }

  if (isAlwaysVisible(elements) && !disclosure.open) {
    disclosure.open = true;
  }

  synchronizeDisclosureState(elements);
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function initializeDisclosureEvents(elements) {
  const { disclosure, toggle } = elements;

  toggle.addEventListener("click", (event) => {
    handleSummaryClick(elements, event);
  });

  disclosure.addEventListener("toggle", () => {
    handleNativeToggle(elements);
  });
}

/* ==========================================================================
   Root Initialization
   ========================================================================== */

function initializeRoot(root) {
  if (!root || initializedRoots.has(root)) {
    return;
  }

  const elements = collectElements(root);

  if (!elements) {
    return;
  }

  rootStates.set(root, {
    elements,

    operationId: 0,
  });

  initializedRoots.add(root);

  /*
   * Native synchronization must exist before the initial state is applied.
   */

  initializeDisclosureEvents(elements);

  if (isAlwaysVisible(elements)) {
    initializeAlwaysVisibleMode(elements);

    return;
  }

  initializeDisclosureMode(elements);
}

/* ==========================================================================
   Initialized Roots
   ========================================================================== */

function getInitializedRoots() {
  return Array.from(document.querySelectorAll(SELECTORS.root)).filter((root) =>
    initializedRoots.has(root),
  );
}

/* ==========================================================================
   Language Updates
   ========================================================================== */

function updateAllDisclosureLabels() {
  getInitializedRoots().forEach((root) => {
    updateDisclosureLabel(getElements(root));
  });
}

function handlePreferenceChange(event) {
  if (event.detail?.name !== "lang") {
    return;
  }

  updateAllDisclosureLabels();
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function initializeGlobalEvents() {
  if (globalEventsInitialized) {
    return;
  }

  globalEventsInitialized = true;

  document.addEventListener("languagechange", updateAllDisclosureLabels);

  document.addEventListener("preferencechange", handlePreferenceChange);

  onMediaQueryChange(getAutoOpenQuery(), handleAutoOpenChange);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketOverviewDisclosure() {
  const roots = document.querySelectorAll(SELECTORS.root);

  if (!roots.length) {
    return;
  }

  initializeGlobalEvents();

  roots.forEach((root) => {
    initializeRoot(root);
  });
}
