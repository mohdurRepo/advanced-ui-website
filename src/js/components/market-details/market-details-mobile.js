/* ==========================================================================
   Market Details Mobile Disclosure
   ========================================================================== */

const SELECTORS = {
  detailPanel: "[data-market-detail-panel]",
  viewPanel: "[data-market-view-panel]",
  toggle: "[data-market-details-toggle]",
  collapsible: "[data-market-details-collapsible]",
  toggleText: "[data-market-details-toggle-text]",
};

const MOBILE_QUERY = "(max-width: 767.98px)";

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

let initialized = false;
let mobileMediaQuery = null;

/* ==========================================================================
   Helpers
   ========================================================================== */

function isMobile() {
  return mobileMediaQuery?.matches ?? window.matchMedia(MOBILE_QUERY).matches;
}

function getLanguage() {
  return document.documentElement.lang === "ar" ? "ar" : "en";
}

function getToggleTarget(toggle) {
  const targetId = toggle?.getAttribute("aria-controls");

  if (!targetId) return null;

  return document.getElementById(targetId);
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

function getAllToggles() {
  return Array.from(document.querySelectorAll(SELECTORS.toggle));
}

function updateToggleLabel(toggle, expanded) {
  if (!toggle) return;

  const labels = LABELS[getLanguage()];
  const text = expanded ? labels.hide : labels.show;
  const textElement = getToggleText(toggle);

  if (textElement) {
    textElement.textContent = text;
  }

  toggle.setAttribute("aria-label", text);
}

/* ==========================================================================
   Disclosure State
   ========================================================================== */

function setExpanded(toggle, expanded, { emit = true } = {}) {
  const collapsible = getToggleTarget(toggle);
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

      /*
       * Allows charts and tables inside a newly visible region
       * to recalculate their dimensions.
       */
      window.dispatchEvent(new Event("resize"));
    });
  }
}

/* ==========================================================================
   Responsive Synchronization
   ========================================================================== */

function synchronizeToggle(toggle) {
  const collapsible = getToggleTarget(toggle);
  const owner = getDisclosureOwner(toggle);

  if (!collapsible) return;

  if (isMobile()) {
    const expanded = toggle.getAttribute("aria-expanded") === "true";

    setExpanded(toggle, expanded, {
      emit: false,
    });

    return;
  }

  /*
   * Tablet and desktop always expose the full content.
   * The saved mobile expanded state remains on the button and is restored
   * automatically if the viewport returns to mobile.
   */
  collapsible.hidden = false;
  collapsible.setAttribute("aria-hidden", "false");

  if ("inert" in collapsible) {
    collapsible.inert = false;
  }

  owner?.classList.remove("has-details-open");

  updateToggleLabel(toggle, toggle.getAttribute("aria-expanded") === "true");
}

function synchronizeAllToggles() {
  getAllToggles().forEach(synchronizeToggle);
}

/* ==========================================================================
   Events
   ========================================================================== */

function handleClick(event) {
  const toggle = event.target.closest(SELECTORS.toggle);

  if (!toggle || !isMobile()) return;

  const collapsible = getToggleTarget(toggle);

  if (!collapsible) return;

  const expanded = toggle.getAttribute("aria-expanded") === "true";

  setExpanded(toggle, !expanded);
}

function handleLanguageChange() {
  getAllToggles().forEach((toggle) => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";

    updateToggleLabel(toggle, expanded);
  });
}

function handleViewChange(event) {
  const activePanel = event.detail?.panel;

  if (!activePanel) return;

  activePanel.querySelectorAll(SELECTORS.toggle).forEach(synchronizeToggle);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketDetailsMobile() {
  if (initialized) return;

  mobileMediaQuery = window.matchMedia(MOBILE_QUERY);

  const toggles = getAllToggles();

  if (!toggles.length) return;

  initialized = true;

  document.addEventListener("click", handleClick);
  document.addEventListener("languagechange", handleLanguageChange);
  document.addEventListener("market:tabchange", handleViewChange);

  mobileMediaQuery.addEventListener("change", synchronizeAllToggles);

  synchronizeAllToggles();
}
