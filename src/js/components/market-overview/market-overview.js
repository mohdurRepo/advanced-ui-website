/* ==========================================================================
   Market Overview
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Manage the outer Market Overview <details> disclosure.
 * - Support permanently visible home-page mode.
 * - Support collapsible inner-page mode.
 * - Synchronize disclosure accessibility state.
 * - Coordinate curtain open / close animation lifecycle.
 * - Publish overview visibility events for dependent components.
 * - Localize the disclosure control label.
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
   Modes
   ========================================================================== */

const MODES = {
  always: "always",
  disclosure: "disclosure",
};

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
 * CSS curtain motion is currently ~200ms.
 *
 * This timeout is only a defensive fallback for cases where animationend
 * never arrives.
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
   Language
   ========================================================================== */

function getLanguage() {
  const language = document.documentElement.lang?.trim().toLowerCase() || "en";

  return language.startsWith("ar") ? "ar" : "en";
}

function getLabels() {
  return LABELS[getLanguage()];
}

/* ==========================================================================
   Motion
   ========================================================================== */

function prefersReducedMotion() {
  if (document.documentElement.dataset.motion === "reduce") {
    return true;
  }

  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/* ==========================================================================
   Mode
   ========================================================================== */

function getMode(elements) {
  return elements?.root?.dataset.marketDetailsMode || MODES.disclosure;
}

function isAlwaysVisible(elements) {
  return getMode(elements) === MODES.always;
}

/* ==========================================================================
   Disclosure Label
   ========================================================================== */

function getDisclosureLabel(open) {
  const labels = getLabels();

  return open ? labels.hide : labels.show;
}

function updateDisclosureLabel(elements) {
  if (!elements) {
    return;
  }

  const { disclosure, toggle, toggleLabel } = elements;

  const open = disclosure.open;

  const label = getDisclosureLabel(open);

  toggle.setAttribute("aria-expanded", String(open));

  toggle.setAttribute("aria-label", label);

  /*
   * Preserve the existing project tooltip contract.
   */

  toggle.setAttribute("data-tooltip", label);

  if (toggleLabel) {
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
   * Keep the wrapper rendered.
   *
   * Native <details> controls visual disclosure while the rendered wrapper is
   * still needed by permanent mode and bridge/layout measurement.
   */

  details.hidden = false;

  details.setAttribute("aria-hidden", String(!open));

  /*
   * Closed inner-page Details must not expose interactive descendants.
   */

  if ("inert" in details) {
    details.inert = !open;
  }
}

/* ==========================================================================
   State Synchronization
   ========================================================================== */

function synchronizeDisclosureState(elements) {
  updateDisclosureLabel(elements);

  updateDetailsAccessibility(elements);
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
  if (!disclosure) {
    return;
  }

  disclosure.classList.remove(
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
      if (event.target !== element) {
        return;
      }

      complete();
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
   * Two frames intentionally allow:
   *
   * 1. disclosure/style state to render;
   * 2. dependent layout geometry to settle.
   */

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!root.isConnected) {
        return;
      }

      dispatchDetailsShown(elements);

      /*
       * Temporary compatibility event.
       *
       * Some chart/layout consumers still refresh themselves from a resize
       * event after becoming visible.
       *
       * Remove this when those components consume explicit market events.
       */

      window.dispatchEvent(new Event("resize"));
    });
  });
}

/* ==========================================================================
   Permanent Home Mode
   ========================================================================== */

function initializeAlwaysVisibleMode(elements) {
  const { disclosure, toggle, details } = elements;

  clearAnimationState(disclosure);

  disclosure.open = true;

  /*
   * Keep <summary> in the DOM for structural consistency but remove it from
   * interaction/accessibility in permanent mode.
   */

  toggle.hidden = true;

  toggle.setAttribute("aria-hidden", "true");

  toggle.setAttribute("tabindex", "-1");

  details.hidden = false;

  details.setAttribute("aria-hidden", "false");

  if ("inert" in details) {
    details.inert = false;
  }

  updateDisclosureLabel(elements);

  /*
   * Immediate state event.
   */

  dispatchOverviewChange(elements, true);

  /*
   * Deferred geometry event.
   *
   * Bridge/panel/chart initializers later in the same bootstrap cycle can
   * observe this after their listeners are installed.
   */

  refreshVisibleContent(elements);
}

/* ==========================================================================
   Interactive Disclosure Mode
   ========================================================================== */

function initializeInteractiveMode(elements) {
  const { root, disclosure, toggle, details } = elements;

  clearAnimationState(disclosure);

  toggle.hidden = false;

  toggle.removeAttribute("aria-hidden");

  toggle.removeAttribute("tabindex");

  details.hidden = false;

  /*
   * Inner pages default closed.
   *
   * Pages may explicitly request:
   *
   * data-market-details-default="open"
   */

  disclosure.open = root.dataset.marketDetailsDefault === "open";

  synchronizeDisclosureState(elements);

  /*
   * If the page deliberately starts open, publish its initial state exactly
   * like an interactively opened disclosure.
   */

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
   * Increment operation version.
   *
   * If some external action changes the disclosure while the animation is
   * pending, this completion becomes stale and safely exits.
   */

  const operationId = state.operationId + 1;

  state.operationId = operationId;

  disclosure.classList.remove(CLASSES.closing);

  disclosure.classList.add(CLASSES.opening, CLASSES.animating);

  /*
   * Open native <details> before running the curtain so contents can render
   * and participate in layout.
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
   Close Disclosure
   ========================================================================== */

async function closeDisclosure(elements) {
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
   * Keep native <details> open during the closing animation.
   */

  await waitForCurtainAnimation(animationTarget, ANIMATIONS.closing);

  if (!root.isConnected || state.operationId !== operationId) {
    return;
  }

  disclosure.open = false;

  clearAnimationState(disclosure);

  synchronizeDisclosureState(elements);

  dispatchOverviewChange(elements, false);
}

/* ==========================================================================
   Toggle Disclosure
   ========================================================================== */

function toggleDisclosure(elements) {
  if (!elements || isAlwaysVisible(elements)) {
    return;
  }

  if (elements.disclosure.open) {
    void closeDisclosure(elements);

    return;
  }

  void openDisclosure(elements);
}

/* ==========================================================================
   Summary Click
   ========================================================================== */

function handleSummaryClick(elements, event) {
  /*
   * Prevent native immediate toggling.
   *
   * JS controls the timing so the closing curtain completes before <details>
   * becomes closed.
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
   * completion.
   */

  if (!isAnimating(disclosure)) {
    state.operationId += 1;
  }

  /*
   * Permanent mode must always stay open.
   */

  if (isAlwaysVisible(elements)) {
    if (!disclosure.open) {
      disclosure.open = true;
    }

    synchronizeDisclosureState(elements);

    return;
  }

  /*
   * Keep ARIA/inert synchronized when another consumer directly modifies the
   * native `open` property.
   */

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
   * Native synchronization must exist before initial mode/state is applied.
   */

  initializeDisclosureEvents(elements);

  if (isAlwaysVisible(elements)) {
    initializeAlwaysVisibleMode(elements);

    return;
  }

  initializeInteractiveMode(elements);
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
    const elements = getElements(root);

    if (!elements) {
      return;
    }

    updateDisclosureLabel(elements);
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
