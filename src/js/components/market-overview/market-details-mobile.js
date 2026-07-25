/* ==========================================================================
   Market Details Mobile Disclosure
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-overview]",
  detailPanel: "[data-market-detail-panel]",
  viewPanel: "[data-market-view-panel]",

  toggle: "[data-market-details-toggle]",
  collapsible: "[data-market-details-collapsible]",
  toggleText: "[data-market-details-toggle-text]",

  derivativesToggle: ".derivatives-dashboard__toggle",
};

const MOBILE_QUERY = "(max-width: 767.98px)";

const LABELS = {
  en: {
    show: "Show market details",
    hide: "Hide market details",
    showMore: "Show more tables",
    hideMore: "Hide additional tables",
  },

  ar: {
    show: "عرض تفاصيل السوق",
    hide: "إخفاء تفاصيل السوق",
    showMore: "عرض المزيد من الجداول",
    hideMore: "إخفاء الجداول الإضافية",
  },
};

const initializedRoots = new WeakSet();

let mobileMediaQuery = null;
let globalEventsInitialized = false;

/* ==========================================================================
   Preferences
   ========================================================================== */

function isMobile() {
  return mobileMediaQuery?.matches ?? window.matchMedia(MOBILE_QUERY).matches;
}

function getLanguage() {
  return document.documentElement.lang === "ar" ? "ar" : "en";
}

/* ==========================================================================
   Elements
   ========================================================================== */

function getToggleTarget(root, toggle) {
  const targetId = toggle?.getAttribute("aria-controls");

  if (!root || !targetId) return null;

  const target = document.getElementById(targetId);

  return target && root.contains(target) ? target : null;
}

function getToggleText(toggle) {
  return toggle?.querySelector(SELECTORS.toggleText) || null;
}

function getDisclosureOwner(toggle) {
  return (
    toggle?.closest(SELECTORS.viewPanel) ||
    toggle?.closest(SELECTORS.detailPanel) ||
    null
  );
}

function isDerivativesToggle(toggle) {
  return Boolean(toggle?.closest(SELECTORS.derivativesToggle));
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getToggleLabel(toggle, expanded) {
  const labels = LABELS[getLanguage()];

  if (isDerivativesToggle(toggle)) {
    return expanded ? labels.hideMore : labels.showMore;
  }

  return expanded ? labels.hide : labels.show;
}

function updateToggleLabel(toggle, expanded) {
  if (!toggle) return;

  const text = getToggleLabel(toggle, expanded);
  const textElement = getToggleText(toggle);

  if (textElement) {
    textElement.textContent = text;
  }

  toggle.setAttribute("aria-label", text);
}

/* ==========================================================================
   Disclosure State
   ========================================================================== */

function setExpanded(root, toggle, expanded, { emit = true } = {}) {
  const collapsible = getToggleTarget(root, toggle);
  const owner = getDisclosureOwner(toggle);

  if (!toggle || !collapsible) return;

  toggle.setAttribute("aria-expanded", String(expanded));

  collapsible.toggleAttribute("hidden", !expanded);
  collapsible.setAttribute("aria-hidden", String(!expanded));

  if ("inert" in collapsible) {
    collapsible.inert = !expanded;
  }

  updateToggleLabel(toggle, expanded);

  owner?.classList.toggle("has-details-open", expanded);

  if (expanded && emit) {
    window.requestAnimationFrame(() => {
      collapsible.dispatchEvent(
        new CustomEvent("market:detailsexpanded", {
          bubbles: true,
          detail: {
            owner,
            toggle,
            collapsible,
          },
        }),
      );

      window.dispatchEvent(new Event("resize"));
    });
  }
}

/* ==========================================================================
   Responsive Synchronization
   ========================================================================== */

function synchronizeToggle(root, toggle) {
  const collapsible = getToggleTarget(root, toggle);
  const owner = getDisclosureOwner(toggle);

  if (!collapsible) return;

  if (isMobile()) {
    const expanded = toggle.getAttribute("aria-expanded") === "true";

    setExpanded(root, toggle, expanded, {
      emit: false,
    });

    return;
  }

  /*
   * Tablet and desktop always expose the complete content.
   */
  collapsible.hidden = false;
  collapsible.setAttribute("aria-hidden", "false");

  if ("inert" in collapsible) {
    collapsible.inert = false;
  }

  owner?.classList.remove("has-details-open");

  updateToggleLabel(toggle, toggle.getAttribute("aria-expanded") === "true");
}

function synchronizeRoot(root) {
  root.querySelectorAll(SELECTORS.toggle).forEach((toggle) => {
    synchronizeToggle(root, toggle);
  });
}

function synchronizeAllRoots() {
  document.querySelectorAll(SELECTORS.root).forEach(synchronizeRoot);
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function initializeRootEvents(root) {
  root.addEventListener("click", (event) => {
    const toggle = event.target.closest(SELECTORS.toggle);

    if (!toggle || !root.contains(toggle) || !isMobile()) {
      return;
    }

    const collapsible = getToggleTarget(root, toggle);

    if (!collapsible) return;

    const expanded = toggle.getAttribute("aria-expanded") === "true";

    setExpanded(root, toggle, !expanded);
  });

  root.addEventListener("market:tabchange", (event) => {
    const activePanel = event.detail?.panel;

    if (!activePanel) return;

    activePanel.querySelectorAll(SELECTORS.toggle).forEach((toggle) => {
      synchronizeToggle(root, toggle);
    });
  });
}

/* ==========================================================================
   Root Initialization
   ========================================================================== */

function initializeRoot(root) {
  if (initializedRoots.has(root)) return;

  const toggles = root.querySelectorAll(SELECTORS.toggle);

  if (!toggles.length) return;

  initializedRoots.add(root);

  initializeRootEvents(root);
  synchronizeRoot(root);
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function initializeGlobalEvents() {
  if (globalEventsInitialized) return;

  globalEventsInitialized = true;

  mobileMediaQuery = window.matchMedia(MOBILE_QUERY);

  const synchronize = () => {
    synchronizeAllRoots();
  };

  if ("addEventListener" in mobileMediaQuery) {
    mobileMediaQuery.addEventListener("change", synchronize);
  } else {
    mobileMediaQuery.addListener(synchronize);
  }

  document.addEventListener("languagechange", synchronizeAllRoots);

  document.addEventListener("preferencechange", (event) => {
    if (event.detail?.name === "lang") {
      synchronizeAllRoots();
    }
  });
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketDetailsMobile() {
  initializeGlobalEvents();

  document.querySelectorAll(SELECTORS.root).forEach(initializeRoot);
}
