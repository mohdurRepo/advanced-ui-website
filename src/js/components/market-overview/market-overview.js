/* ==========================================================================
   Market Overview Disclosure
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-overview]",
  disclosure: "[data-market-details-disclosure]",
  toggle: "[data-market-overview-toggle]",
  toggleLabel: "[data-market-overview-toggle-label]",
  details: "[data-market-overview-details]",
  animationTarget: ".market-details",
};

const CLASSES = {
  opening: "is-opening",
  closing: "is-closing",
  animating: "is-animating",
};

const MODES = {
  always: "always",
};

const EVENTS = {
  change: "market:overviewchange",
  detailsShown: "market:detailsshown",
};

const ANIMATIONS = {
  opening: "market-overview-curtain-open",
  closing: "market-overview-curtain-close",
};

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

const ANIMATION_FALLBACK = 350;

const initializedDisclosures = new WeakSet();

let globalEventsInitialized = false;

/* ==========================================================================
   Preferences
   ========================================================================== */

function getLanguage() {
  return document.documentElement.lang?.startsWith("ar") ? "ar" : "en";
}

function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ==========================================================================
   Elements
   ========================================================================== */

function getElements(root) {
  const disclosure = root?.querySelector(SELECTORS.disclosure);

  if (!disclosure) return null;

  const toggle = disclosure.querySelector(SELECTORS.toggle);
  const details = disclosure.querySelector(SELECTORS.details);

  if (!toggle || !details) return null;

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

/* ==========================================================================
   Mode
   ========================================================================== */

function isAlwaysVisible(elements) {
  return elements.root.dataset.marketDetailsMode === MODES.always;
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getDisclosureLabel(open) {
  const labels = LABELS[getLanguage()];

  return open ? labels.hide : labels.show;
}

function updateDisclosureLabel(elements) {
  const { disclosure, toggle, toggleLabel } = elements;

  const label = getDisclosureLabel(disclosure.open);

  toggle.setAttribute("aria-expanded", String(disclosure.open));
  toggle.setAttribute("aria-label", label);
  toggle.setAttribute("data-tooltip", label);

  if (toggleLabel) {
    toggleLabel.textContent = label;
  }
}

/* ==========================================================================
   Accessibility State
   ========================================================================== */

function updateDetailsAccessibility(elements) {
  const { disclosure, details } = elements;
  const open = disclosure.open;

  /*
   * Native Details owns visual visibility. The hidden attribute must not
   * remain on this wrapper because it would also hide the permanent home
   * content and prevent bridge measurements.
   */
  details.hidden = false;
  details.setAttribute("aria-hidden", String(!open));

  if ("inert" in details) {
    details.inert = !open;
  }
}

function synchronizeDisclosureState(elements) {
  updateDisclosureLabel(elements);
  updateDetailsAccessibility(elements);
}

/* ==========================================================================
   Custom Events
   ========================================================================== */

function dispatchOverviewChange(elements, open) {
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

/* ==========================================================================
   Animation Completion
   ========================================================================== */

function waitForCurtainAnimation(element, animationName) {
  return new Promise((resolve) => {
    if (!element || prefersReducedMotion()) {
      resolve();
      return;
    }

    let completed = false;
    let fallbackTimer = null;

    function complete() {
      if (completed) return;

      completed = true;

      window.clearTimeout(fallbackTimer);
      element.removeEventListener("animationend", handleAnimationEnd);

      resolve();
    }

    function handleAnimationEnd(event) {
      if (event.target !== element) return;
      if (event.animationName !== animationName) return;

      complete();
    }

    element.addEventListener("animationend", handleAnimationEnd);

    fallbackTimer = window.setTimeout(complete, ANIMATION_FALLBACK);
  });
}

/* ==========================================================================
   Layout Refresh
   ========================================================================== */

function refreshVisibleContent(elements) {
  const { details } = elements;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      details.dispatchEvent(
        new CustomEvent(EVENTS.detailsShown, {
          bubbles: true,
          detail: {
            details,
          },
        }),
      );

      /*
       * Allows charts, tables, active panels, and bridge geometry to
       * recalculate after the disclosure reaches its final dimensions.
       */
      window.dispatchEvent(new Event("resize"));
    });
  });
}

/* ==========================================================================
   Permanently Visible Home Mode
   ========================================================================== */

function initializeAlwaysVisibleMode(elements) {
  const { disclosure, toggle, details } = elements;

  disclosure.classList.remove(
    CLASSES.opening,
    CLASSES.closing,
    CLASSES.animating,
  );

  disclosure.open = true;

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
   * The bridge initializer runs later. The double-frame refresh ensures
   * its listeners and observers exist before final geometry is requested.
   */
  dispatchOverviewChange(elements, true);
  refreshVisibleContent(elements);
}

/* ==========================================================================
   Interactive Inner-page Mode
   ========================================================================== */

function initializeInteractiveMode(elements) {
  const { root, disclosure, toggle, details } = elements;

  toggle.hidden = false;
  toggle.removeAttribute("aria-hidden");
  toggle.removeAttribute("tabindex");

  details.hidden = false;

  /*
   * Inner pages start closed unless a future page explicitly requests:
   * data-market-details-default="open"
   */
  disclosure.open = root.dataset.marketDetailsDefault === "open";

  synchronizeDisclosureState(elements);
}

/* ==========================================================================
   Open
   ========================================================================== */

async function openDisclosure(elements) {
  const { disclosure, animationTarget } = elements;

  if (isAlwaysVisible(elements)) return;
  if (disclosure.classList.contains(CLASSES.animating)) return;
  if (disclosure.open) return;

  disclosure.classList.remove(CLASSES.closing);
  disclosure.classList.add(CLASSES.opening, CLASSES.animating);

  disclosure.open = true;

  synchronizeDisclosureState(elements);
  dispatchOverviewChange(elements, true);

  await waitForCurtainAnimation(animationTarget, ANIMATIONS.opening);

  disclosure.classList.remove(CLASSES.opening, CLASSES.animating);

  refreshVisibleContent(elements);
}

/* ==========================================================================
   Close
   ========================================================================== */

async function closeDisclosure(elements) {
  const { disclosure, animationTarget } = elements;

  if (isAlwaysVisible(elements)) return;
  if (disclosure.classList.contains(CLASSES.animating)) return;
  if (!disclosure.open) return;

  disclosure.classList.remove(CLASSES.opening);
  disclosure.classList.add(CLASSES.closing, CLASSES.animating);

  await waitForCurtainAnimation(animationTarget, ANIMATIONS.closing);

  disclosure.open = false;

  disclosure.classList.remove(CLASSES.closing, CLASSES.animating);

  synchronizeDisclosureState(elements);
  dispatchOverviewChange(elements, false);
}

/* ==========================================================================
   Toggle
   ========================================================================== */

function toggleDisclosure(elements) {
  if (elements.disclosure.open) {
    closeDisclosure(elements);
    return;
  }

  openDisclosure(elements);
}

/* ==========================================================================
   Disclosure Events
   ========================================================================== */

function initializeDisclosureEvents(elements) {
  const { disclosure, toggle } = elements;

  toggle.addEventListener("click", (event) => {
    /*
     * Prevent the browser from closing Details immediately. JavaScript keeps
     * it open until the closing curtain animation has completed.
     */
    event.preventDefault();

    toggleDisclosure(elements);
  });

  disclosure.addEventListener("toggle", () => {
    if (isAlwaysVisible(elements)) {
      if (!disclosure.open) {
        disclosure.open = true;
      }

      return;
    }

    synchronizeDisclosureState(elements);
  });
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeDisclosure(root) {
  const elements = getElements(root);

  if (!elements) return;
  if (initializedDisclosures.has(elements.disclosure)) return;

  initializedDisclosures.add(elements.disclosure);

  if (isAlwaysVisible(elements)) {
    initializeAlwaysVisibleMode(elements);
    return;
  }

  initializeInteractiveMode(elements);
  initializeDisclosureEvents(elements);
}

/* ==========================================================================
   Language Changes
   ========================================================================== */

function updateAllDisclosureLabels() {
  document.querySelectorAll(SELECTORS.root).forEach((root) => {
    const elements = getElements(root);

    if (!elements) return;

    updateDisclosureLabel(elements);
  });
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function initializeGlobalEvents() {
  if (globalEventsInitialized) return;

  globalEventsInitialized = true;

  document.addEventListener("languagechange", updateAllDisclosureLabels);

  document.addEventListener("preferencechange", (event) => {
    if (event.detail?.name === "lang") {
      updateAllDisclosureLabels();
    }
  });
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketOverviewDisclosure() {
  document.querySelectorAll(SELECTORS.root).forEach(initializeDisclosure);

  initializeGlobalEvents();
}
