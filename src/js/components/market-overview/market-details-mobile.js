/* ==========================================================================
   Market Details — Mobile Disclosure
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Manage internal Market Details disclosures on mobile, ONLY when the
 *   overview itself cannot collapse (data-market-details-mode="always").
 *   A collapsible overview already has one disclosure (its handle); a
 *   second "Show market details" button inside it would confuse visitors,
 *   so its content is simply exposed.
 * - Keep Details content permanently exposed on tablet / desktop.
 * - Synchronize aria-expanded / aria-hidden / hidden / inert.
 * - Localize disclosure labels (including the Derivatives "more tables"
 *   wording).
 * - Re-synchronize when a nested view or outer panel changes.
 * - Preserve each disclosure's mobile state across breakpoint changes.
 * - Publish market:detailsexpanded for dependent components.
 *
 * This module does NOT own:
 *
 * - The outer Market Overview <details> disclosure.
 * - Summary market selection.
 * - Outer panel switching or nested tab selection.
 * - Bridge geometry.
 * - Chart implementation.
 */

import {
  createMediaQuery,
  getLanguage,
  onMediaQueryChange,
} from "./market-shared";

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = {
  overview: "[data-market-overview]",

  toggle: "[data-market-details-toggle]",

  toggleText: "[data-market-details-toggle-text]",

  collapsible: "[data-market-details-collapsible]",

  moreTables: ".derivatives-dashboard__more",

  viewPanel: "[data-market-view-panel]",

  detailPanel: "[data-market-detail-panel]",
};

/* ==========================================================================
   Classes / Events
   ========================================================================== */

const CLASSES = {
  expanded: "is-expanded",
};

const EVENTS = {
  expanded: "market:detailsexpanded",

  tabChange: "market:tabchange",

  panelShown: "market:panelshown",
};

/* ==========================================================================
   Breakpoint
   ========================================================================== */

/*
 * Must stay aligned with the SCSS md breakpoint.
 */

const MOBILE_QUERY = "(max-width: 767.98px)";

let mobileMediaQuery = null;

function getMobileMediaQuery() {
  mobileMediaQuery ??= createMediaQuery(MOBILE_QUERY);

  return mobileMediaQuery;
}

function isMobile() {
  return getMobileMediaQuery()?.matches ?? false;
}

function usesInnerDisclosure(elements) {
  return isMobile() && elements.root.dataset.marketDetailsMode === "always";
}

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

function getState(root) {
  return rootStates.get(root) || null;
}

/* ==========================================================================
   Element Collection
   ========================================================================== */

function collectElements(root) {
  if (!root) {
    return null;
  }

  const toggles = Array.from(root.querySelectorAll(SELECTORS.toggle));

  const collapsibles = Array.from(root.querySelectorAll(SELECTORS.collapsible));

  if (!toggles.length || !collapsibles.length) {
    return null;
  }

  return {
    root,

    toggles,

    collapsibles,
  };
}

/* ==========================================================================
   Toggle ↔ Region
   ========================================================================== */

function getControlledId(toggle) {
  return toggle?.getAttribute("aria-controls")?.trim() || "";
}

/*
 * Resolved only within this Market Overview, so duplicated IDs in external
 * markup can never make a toggle control an unrelated element.
 */

function getCollapsibleForToggle(elements, toggle) {
  const id = getControlledId(toggle);

  return id
    ? elements.collapsibles.find((element) => element.id === id) || null
    : null;
}

function getToggleForCollapsible(elements, collapsible) {
  if (!collapsible?.id) {
    return null;
  }

  return (
    elements.toggles.find(
      (toggle) => getControlledId(toggle) === collapsible.id,
    ) || null
  );
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getDisclosureLabels(collapsible) {
  const labels = LABELS[getLanguage()];

  return collapsible?.matches(SELECTORS.moreTables)
    ? labels.moreTables
    : labels.details;
}

/*
 * The visible text is the accessible name; no aria-label or tooltip
 * duplicates it.
 */

function updateToggleLabel(toggle, collapsible, expanded) {
  const labels = getDisclosureLabels(collapsible);

  const label = expanded ? labels.hide : labels.show;

  const text = toggle.querySelector(SELECTORS.toggleText);

  if (text) {
    if (text.textContent !== label) {
      text.textContent = label;
    }

    toggle.removeAttribute("aria-label");

    toggle.removeAttribute("data-tooltip");

    return;
  }

  /*
   * Icon-only toggles keep an explicit name.
   */

  toggle.setAttribute("aria-label", label);
}

/* ==========================================================================
   Region Exposure
   ========================================================================== */

function setCollapsibleExposed(collapsible, exposed) {
  collapsible.hidden = !exposed;

  collapsible.setAttribute("aria-hidden", String(!exposed));

  collapsible.classList.toggle(CLASSES.expanded, exposed);

  if ("inert" in collapsible) {
    collapsible.inert = !exposed;
  }
}

/* ==========================================================================
   Expansion Event
   ========================================================================== */

function dispatchExpanded(elements, toggle, collapsible, expanded) {
  collapsible.dispatchEvent(
    new CustomEvent(EVENTS.expanded, {
      bubbles: true,

      detail: {
        root: elements.root,

        toggle,

        collapsible,

        expanded,

        detailPanel: collapsible.closest(SELECTORS.detailPanel),

        viewPanel: collapsible.closest(SELECTORS.viewPanel),

        controls: collapsible.id || null,
      },
    }),
  );
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
  const collapsible = getCollapsibleForToggle(elements, toggle);

  if (!collapsible) {
    return;
  }

  toggle.hidden = false;

  toggle.setAttribute("aria-expanded", String(expanded));

  updateToggleLabel(toggle, collapsible, expanded);

  setCollapsibleExposed(collapsible, expanded);

  getState(elements.root)?.expandedStates.set(collapsible, expanded);

  if (dispatch) {
    dispatchExpanded(elements, toggle, collapsible, expanded);
  }
}

/*
 * First mobile entry follows the toggle's authored aria-expanded (collapsed
 * in the current markup); afterwards the visitor's last state is kept.
 */

function getSavedMobileState(elements, collapsible) {
  const saved = getState(elements.root)?.expandedStates;

  if (saved?.has(collapsible)) {
    return saved.get(collapsible);
  }

  const toggle = getToggleForCollapsible(elements, collapsible);

  return toggle?.getAttribute("aria-expanded") === "true";
}

/* ==========================================================================
   Desktop / Tablet State
   ========================================================================== */

/*
 * Outside the inner-disclosure case everything is exposed and the control
 * leaves the page (hidden also removes it from the tab order and the
 * accessibility tree).
 */

function exposeDesktopDisclosure(elements, toggle) {
  const collapsible = getCollapsibleForToggle(elements, toggle);

  if (!collapsible) {
    return;
  }

  toggle.hidden = true;

  setCollapsibleExposed(collapsible, true);
}

/* ==========================================================================
   Synchronization
   ========================================================================== */

function synchronizeToggle(elements, toggle, { dispatch = false } = {}) {
  const collapsible = getCollapsibleForToggle(elements, toggle);

  if (!collapsible) {
    return;
  }

  if (!usesInnerDisclosure(elements)) {
    exposeDesktopDisclosure(elements, toggle);

    return;
  }

  setMobileDisclosureState(
    elements,
    toggle,
    getSavedMobileState(elements, collapsible),
    { dispatch },
  );
}

function synchronizeToggles(elements, toggles) {
  toggles.forEach((toggle) => {
    synchronizeToggle(elements, toggle);
  });
}

/* ==========================================================================
   Events
   ========================================================================== */

function handleClick(elements, event) {
  const toggle = event.target.closest(SELECTORS.toggle);

  if (
    !toggle ||
    !elements.toggles.includes(toggle) ||
    !usesInnerDisclosure(elements)
  ) {
    return;
  }

  event.preventDefault();

  setMobileDisclosureState(
    elements,
    toggle,
    toggle.getAttribute("aria-expanded") !== "true",
  );
}

/*
 * A nested view or an outer panel just became visible: normalize the
 * disclosures inside it for the current breakpoint.
 */

function handlePanelChange(elements, event) {
  const panel = event.detail?.panel;

  if (!(panel instanceof Element) || !elements.root.contains(panel)) {
    return;
  }

  synchronizeToggles(
    elements,
    elements.toggles.filter((toggle) => panel.contains(toggle)),
  );
}

function initializeRootEvents(elements) {
  const { root } = elements;

  root.addEventListener("click", (event) => {
    handleClick(elements, event);
  });

  [EVENTS.tabChange, EVENTS.panelShown].forEach((type) => {
    root.addEventListener(type, (event) => {
      handlePanelChange(elements, event);
    });
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
     * Each disclosure's mobile state, kept while desktop / tablet force
     * everything open.
     */

    expandedStates: new WeakMap(),
  });

  initializedRoots.add(root);

  initializeRootEvents(elements);

  synchronizeToggles(elements, elements.toggles);
}

function getInitializedStates() {
  return Array.from(document.querySelectorAll(SELECTORS.overview))
    .map(getState)
    .filter(Boolean);
}

/* ==========================================================================
   Global Changes
   ========================================================================== */

function handleBreakpointChange() {
  getInitializedStates().forEach(({ elements }) => {
    synchronizeToggles(elements, elements.toggles);
  });
}

function updateAllLabels() {
  getInitializedStates().forEach(({ elements }) => {
    elements.toggles.forEach((toggle) => {
      const collapsible = getCollapsibleForToggle(elements, toggle);

      if (!collapsible) {
        return;
      }

      const expanded =
        !usesInnerDisclosure(elements) ||
        toggle.getAttribute("aria-expanded") === "true";

      updateToggleLabel(toggle, collapsible, expanded);
    });
  });
}

function handlePreferenceChange(event) {
  if (event.detail?.name === "lang") {
    updateAllLabels();
  }
}

function initializeGlobalEvents() {
  if (globalEventsInitialized) {
    return;
  }

  globalEventsInitialized = true;

  onMediaQueryChange(getMobileMediaQuery(), handleBreakpointChange);

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

  roots.forEach(initializeRoot);
}
