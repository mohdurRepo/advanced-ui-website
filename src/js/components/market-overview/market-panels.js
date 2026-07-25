/* ==========================================================================
   Market Detail Panels
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-overview]",
  card: "[data-market-card]",
  panel: "[data-market-detail-panel]",
};

const CLASSES = {
  active: "is-active",
};

const initializedRoots = new WeakSet();

/* ==========================================================================
   Helpers
   ========================================================================== */

function getPanelByCard(root, card) {
  const panelId = card?.getAttribute("aria-controls");

  if (!root || !panelId) return null;

  const panel = document.getElementById(panelId);

  return panel && root.contains(panel) ? panel : null;
}

function getInitialCard(root) {
  return (
    root.querySelector(`${SELECTORS.card}[aria-selected="true"]`) ||
    root.querySelector(`${SELECTORS.card}.${CLASSES.active}`) ||
    root.querySelector(SELECTORS.card)
  );
}

function resetPanelScroll(panel) {
  if (!panel) return;

  panel
    .querySelectorAll(
      [
        ".market-movers__panel",
        ".market-details-panel__table",
        ".table-responsive",
      ].join(","),
    )
    .forEach((element) => {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });
}

function requestPanelResize(panel) {
  if (!panel) return;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      panel.dispatchEvent(
        new CustomEvent("market:panelshown", {
          bubbles: true,
          detail: {
            panel,
          },
        }),
      );

      window.dispatchEvent(new Event("resize"));
    });
  });
}

/* ==========================================================================
   Panel State
   ========================================================================== */

export function showMarketPanel(card) {
  const root = card?.closest(SELECTORS.root);

  if (!root) return;

  const activePanel = getPanelByCard(root, card);

  if (!activePanel) return;

  root.querySelectorAll(SELECTORS.panel).forEach((panel) => {
    const active = panel === activePanel;

    panel.classList.toggle(CLASSES.active, active);
    panel.toggleAttribute("hidden", !active);
    panel.setAttribute("aria-hidden", String(!active));

    if ("inert" in panel) {
      panel.inert = !active;
    }
  });

  resetPanelScroll(activePanel);
  requestPanelResize(activePanel);
}

/* ==========================================================================
   Root Initialization
   ========================================================================== */

function initializeRoot(root) {
  if (initializedRoots.has(root)) return;

  const panels = root.querySelectorAll(SELECTORS.panel);

  if (!panels.length) return;

  initializedRoots.add(root);

  const initialCard = getInitialCard(root);

  if (initialCard) {
    showMarketPanel(initialCard);
  }

  root.addEventListener("market:change", (event) => {
    const card = event.detail?.card;

    if (card && root.contains(card)) {
      showMarketPanel(card);
    }
  });
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketPanels() {
  document.querySelectorAll(SELECTORS.root).forEach(initializeRoot);
}
