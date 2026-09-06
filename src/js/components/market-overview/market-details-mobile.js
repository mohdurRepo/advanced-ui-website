/* ==========================================================================
   Market Details — Mobile Disclosure
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Manage internal Market Details disclosures on mobile.
 * - Keep Details content permanently exposed on tablet / desktop.
 * - Synchronize aria-expanded / aria-hidden / hidden / inert.
 * - Localize disclosure labels.
 * - Support special Derivatives "more tables" disclosure wording.
 * - Re-synchronize when a nested Market View changes.
 * - Publish market:detailsexpanded for dependent components.
 *
 * This module does NOT own:
 *
 * - The outer Market Overview <details> disclosure.
 * - Summary market selection.
 * - Outer market-panel switching.
 * - Nested view / Movers tab selection.
 * - Bridge geometry.
 * - Chart implementation.
 */

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = {
  overview: "[data-market-overview]",

  toggle: "[data-market-details-toggle]",

  toggleText: "[data-market-details-toggle-text]",

  collapsible: "[data-market-details-collapsible]",

  viewPanel: "[data-market-view-panel]",

  detailPanel: "[data-market-detail-panel]",
};

/* ==========================================================================
   Classes
   ========================================================================== */

const CLASSES = {
  expanded: "is-expanded",
};

/* ==========================================================================
   Events
   ========================================================================== */

const EVENTS = {
  expanded: "market:detailsexpanded",

  tabChange: "market:tabchange",

  panelShown: "market:panelshown",
};

/* ==========================================================================
   Breakpoint
   ========================================================================== */

/*
 * Must remain aligned with the SCSS md breakpoint.
 */

const MOBILE_QUERY = "(max-width: 767.98px)";

/* ==========================================================================
   Disclosure Types
   ========================================================================== */

const DISCLOSURE_TYPES = {
  details: "details",

  moreTables: "more-tables",
};

/* ==========================================================================
   Labels
   ========================================================================== */

const LABELS = {
  en: {
    details: {
      show: "Show market details",

      hide: "Hide market details",
    },

    moreTables: {
      show: "Show more tables",

      hide: "Hide more tables",
    },
  },

  ar: {
    details: {
      show: "عرض تفاصيل السوق",

      hide: "إخفاء تفاصيل السوق",
    },

    moreTables: {
      show: "عرض المزيد من الجداول",

      hide: "إخفاء الجداول الإضافية",
    },
  },
};

/* ==========================================================================
   State
   ========================================================================== */

const initializedRoots = new WeakSet();

const rootStates = new WeakMap();

let globalEventsInitialized = false;

let mobileMediaQuery = null;

/* ==========================================================================
   Language
   ========================================================================== */

function getLanguage() {
  const language = document.documentElement.lang?.trim().toLowerCase() || "en";

  return language.startsWith("ar") ? "ar" : "en";
}

/* ==========================================================================
   Media Query
   ========================================================================== */

function getMobileMediaQuery() {
  if (!mobileMediaQuery) {
    mobileMediaQuery = window.matchMedia(MOBILE_QUERY);
  }

  return mobileMediaQuery;
}

function isMobile() {
  return getMobileMediaQuery().matches;
}

/* ==========================================================================
   Element Collection
   ========================================================================== */

function collectElements(root) {
  if (!root) {
    return null;
  }

  const toggles = Array.from(root.querySelectorAll(SELECTORS.toggle));

  if (!toggles.length) {
    return null;
  }

  const collapsibles = Array.from(root.querySelectorAll(SELECTORS.collapsible));

  if (!collapsibles.length) {
    return null;
  }

  return {
    root,

    toggles,

    collapsibles,
  };
}

function getState(root) {
  return rootStates.get(root) || null;
}

/* ==========================================================================
   Controlled Region Resolution
   ========================================================================== */

function getControlledId(toggle) {
  return toggle?.getAttribute("aria-controls")?.trim() || "";
}

function getCollapsibleForToggle(elements, toggle) {
  if (!elements || !toggle) {
    return null;
  }

  const id = getControlledId(toggle);

  if (!id) {
    return null;
  }

  /*
   * Resolve only against collapsibles belonging to this Market Overview.
   *
   * This prevents accidental control of an unrelated element if IDs are
   * duplicated by malformed external markup.
   */

  return elements.collapsibles.find((element) => element.id === id) || null;
}

/* ==========================================================================
   Toggle Resolution
   ========================================================================== */

function getToggleForCollapsible(elements, collapsible) {
  if (!elements || !collapsible?.id) {
    return null;
  }

  return (
    elements.toggles.find(
      (toggle) => getControlledId(toggle) === collapsible.id,
    ) || null
  );
}

/* ==========================================================================
   Disclosure Type
   ========================================================================== */

function getDisclosureType(toggle, collapsible) {
  if (
    collapsible?.classList.contains("derivatives-dashboard__more") ||
    collapsible?.id === "derivatives-more-tables" ||
    getControlledId(toggle) === "derivatives-more-tables"
  ) {
    return DISCLOSURE_TYPES.moreTables;
  }

  return DISCLOSURE_TYPES.details;
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getDisclosureLabels(toggle, collapsible) {
  const language = getLanguage();

  const type = getDisclosureType(toggle, collapsible);

  return LABELS[language][type] || LABELS.en.details;
}

function updateToggleLabel(toggle, collapsible, expanded) {
  if (!toggle) {
    return;
  }

  const labels = getDisclosureLabels(toggle, collapsible);

  const label = expanded ? labels.hide : labels.show;

  toggle.setAttribute("aria-label", label);

  /*
   * Preserve the existing project tooltip convention.
   */

  toggle.setAttribute("data-tooltip", label);

  const text = toggle.querySelector(SELECTORS.toggleText);

  if (text) {
    text.textContent = label;
  }
}

/* ==========================================================================
   Accessibility
   ========================================================================== */

function setCollapsibleAccessibility(collapsible, exposed) {
  if (!collapsible) {
    return;
  }

  collapsible.hidden = !exposed;

  collapsible.setAttribute("aria-hidden", String(!exposed));

  collapsible.classList.toggle(CLASSES.expanded, exposed);

  if ("inert" in collapsible) {
    collapsible.inert = !exposed;
  }
}

/* ==========================================================================
   Mobile State
   ========================================================================== */

function setMobileDisclosureState(
  elements,
  toggle,
  expanded,
  { dispatch = true } = {},
) {
  if (!elements || !toggle) {
    return false;
  }

  const collapsible = getCollapsibleForToggle(elements, toggle);

  if (!collapsible) {
    return false;
  }

  const resolvedExpanded = Boolean(expanded);

  toggle.hidden = false;

  toggle.removeAttribute("aria-hidden");

  toggle.removeAttribute("tabindex");

  toggle.setAttribute("aria-expanded", String(resolvedExpanded));

  updateToggleLabel(toggle, collapsible, resolvedExpanded);

  setCollapsibleAccessibility(collapsible, resolvedExpanded);

  const state = getState(elements.root);

  if (state) {
    state.expandedStates.set(collapsible, resolvedExpanded);
  }

  if (dispatch) {
    dispatchExpanded(elements, toggle, collapsible, resolvedExpanded);
  }

  return true;
}

/* ==========================================================================
   Desktop / Tablet State
   ========================================================================== */

/*
 * Internal disclosure exists only as a mobile progressive-disclosure
 * mechanism.
 *
 * At md+ all content is exposed regardless of the previous mobile state.
 */

function exposeDesktopDisclosure(elements, toggle) {
  if (!elements || !toggle) {
    return;
  }

  const collapsible = getCollapsibleForToggle(elements, toggle);

  if (!collapsible) {
    return;
  }

  /*
   * CSS normally hides the control above mobile, but setting hidden here also
   * keeps its accessibility state unambiguous.
   */

  toggle.hidden = true;

  toggle.setAttribute("aria-hidden", "true");

  toggle.setAttribute("tabindex", "-1");

  toggle.setAttribute("aria-expanded", "true");

  setCollapsibleAccessibility(collapsible, true);
}

/* ==========================================================================
   Expansion Event
   ========================================================================== */

function dispatchExpanded(elements, toggle, collapsible, expanded) {
  if (!elements || !collapsible) {
    return;
  }

  const detailPanel = collapsible.closest(SELECTORS.detailPanel);

  const viewPanel = collapsible.closest(SELECTORS.viewPanel);

  collapsible.dispatchEvent(
    new CustomEvent(EVENTS.expanded, {
      bubbles: true,

      detail: {
        root: elements.root,

        toggle,

        collapsible,

        expanded,

        detailPanel,

        viewPanel,

        controls: collapsible.id || null,
      },
    }),
  );
}

/* ==========================================================================
   Saved Mobile State
   ========================================================================== */

function getSavedMobileState(elements, collapsible) {
  const state = getState(elements.root);

  if (!state) {
    return false;
  }

  if (state.expandedStates.has(collapsible)) {
    return Boolean(state.expandedStates.get(collapsible));
  }

  /*
   * First mobile entry follows the toggle's authored state.
   *
   * Current HTML uses aria-expanded="false", therefore disclosures naturally
   * begin collapsed.
   */

  const toggle = getToggleForCollapsible(elements, collapsible);

  return toggle?.getAttribute("aria-expanded") === "true";
}

/* ==========================================================================
   Synchronize One Toggle
   ========================================================================== */

function synchronizeToggle(elements, toggle, { dispatch = false } = {}) {
  if (!elements || !toggle) {
    return;
  }

  const collapsible = getCollapsibleForToggle(elements, toggle);

  if (!collapsible) {
    return;
  }

  if (!isMobile()) {
    exposeDesktopDisclosure(elements, toggle);

    return;
  }

  const expanded = getSavedMobileState(elements, collapsible);

  setMobileDisclosureState(elements, toggle, expanded, {
    dispatch,
  });
}

/* ==========================================================================
   Synchronize Root
   ========================================================================== */

function synchronizeRoot(elements, { dispatch = false } = {}) {
  if (!elements) {
    return;
  }

  elements.toggles.forEach((toggle) => {
    synchronizeToggle(elements, toggle, {
      dispatch,
    });
  });
}

/* ==========================================================================
   Toggle
   ========================================================================== */

function toggleMobileDisclosure(elements, toggle) {
  if (!elements || !toggle || !isMobile()) {
    return;
  }

  const collapsible = getCollapsibleForToggle(elements, toggle);

  if (!collapsible) {
    return;
  }

  const expanded = toggle.getAttribute("aria-expanded") === "true";

  setMobileDisclosureState(elements, toggle, !expanded, {
    dispatch: true,
  });
}

/* ==========================================================================
   Click
   ========================================================================== */

function handleClick(elements, event) {
  const toggle = event.target.closest(SELECTORS.toggle);

  if (!toggle || !elements.root.contains(toggle)) {
    return;
  }

  /*
   * Buttons above md are hidden and non-interactive, but guard the behavior
   * here as well.
   */

  if (!isMobile()) {
    return;
  }

  event.preventDefault();

  toggleMobileDisclosure(elements, toggle);
}

/* ==========================================================================
   Nested Tab Changes
   ========================================================================== */

/*
 * Funds / Derivatives may switch between independently collapsible views.
 *
 * Whenever a nested view becomes active, normalize its disclosure state for
 * the current breakpoint.
 */

function handleTabChange(elements, event) {
  if (!elements) {
    return;
  }

  const panel = event.detail?.panel;

  if (!(panel instanceof Element) || !elements.root.contains(panel)) {
    return;
  }

  const toggles = Array.from(panel.querySelectorAll(SELECTORS.toggle));

  toggles.forEach((toggle) => {
    synchronizeToggle(elements, toggle);
  });
}

/* ==========================================================================
   Outer Panel Changes
   ========================================================================== */

function handlePanelShown(elements, event) {
  const panel = event.detail?.panel;

  if (!(panel instanceof Element) || !elements.root.contains(panel)) {
    return;
  }

  panel.querySelectorAll(SELECTORS.toggle).forEach((toggle) => {
    synchronizeToggle(elements, toggle);
  });
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function initializeRootEvents(elements) {
  const { root } = elements;

  root.addEventListener("click", (event) => {
    handleClick(elements, event);
  });

  root.addEventListener(EVENTS.tabChange, (event) => {
    handleTabChange(elements, event);
  });

  root.addEventListener(EVENTS.panelShown, (event) => {
    handlePanelShown(elements, event);
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

    /*
     * Preserve each disclosure's mobile state while temporarily moving to
     * desktop/tablet where all content is forcibly exposed.
     */

    expandedStates: new WeakMap(),
  });

  initializedRoots.add(root);

  initializeRootEvents(elements);

  synchronizeRoot(elements);
}

/* ==========================================================================
   Initialized Roots
   ========================================================================== */

function getInitializedRoots() {
  return Array.from(document.querySelectorAll(SELECTORS.overview)).filter(
    (root) => initializedRoots.has(root),
  );
}

/* ==========================================================================
   Breakpoint Change
   ========================================================================== */

function handleBreakpointChange() {
  getInitializedRoots().forEach((root) => {
    const state = getState(root);

    if (!state) {
      return;
    }

    synchronizeRoot(state.elements);
  });
}

/* ==========================================================================
   Language Change
   ========================================================================== */

function updateAllLabels() {
  getInitializedRoots().forEach((root) => {
    const state = getState(root);

    if (!state) {
      return;
    }

    const { elements } = state;

    elements.toggles.forEach((toggle) => {
      const collapsible = getCollapsibleForToggle(elements, toggle);

      if (!collapsible) {
        return;
      }

      const expanded = isMobile()
        ? toggle.getAttribute("aria-expanded") === "true"
        : true;

      updateToggleLabel(toggle, collapsible, expanded);
    });
  });
}

function handlePreferenceChange(event) {
  if (event.detail?.name !== "lang") {
    return;
  }

  updateAllLabels();
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function initializeGlobalEvents() {
  if (globalEventsInitialized) {
    return;
  }

  globalEventsInitialized = true;

  const mediaQuery = getMobileMediaQuery();

  /*
   * Modern browsers.
   */

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handleBreakpointChange);
  } else {
    /*
     * Legacy Safari compatibility.
     */

    mediaQuery.addListener?.(handleBreakpointChange);
  }

  document.addEventListener("languagechange", updateAllLabels);

  document.addEventListener("preferencechange", handlePreferenceChange);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketDetailsMobile() {
  const roots = document.querySelectorAll(SELECTORS.overview);

  if (!roots.length) {
    return;
  }

  initializeGlobalEvents();

  roots.forEach((root) => {
    initializeRoot(root);
  });
}
