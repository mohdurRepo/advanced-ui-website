/* ==========================================================================
   Market Detail Panels
   ========================================================================== */

const SELECTORS = {
  card: "[data-market-card]",
  panel: "[data-market-detail-panel]",
  viewTab: "[data-market-view-tab]",
  moversTab: "[data-market-movers-tab]",
};

const CLASSES = {
  active: "is-active",
};

let initialized = false;

/* ==========================================================================
   Helpers
   ========================================================================== */

function getPanelByCard(card) {
  const panelId = card?.getAttribute("aria-controls");

  if (!panelId) return null;

  return document.getElementById(panelId);
}

function getInitialCard() {
  return (
    document.querySelector(`${SELECTORS.card}[aria-selected="true"]`) ||
    document.querySelector(`${SELECTORS.card}.${CLASSES.active}`) ||
    document.querySelector(SELECTORS.card)
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

function requestChartResize(panel) {
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
  const activePanel = getPanelByCard(card);

  if (!activePanel) return;

  document.querySelectorAll(SELECTORS.panel).forEach((panel) => {
    const active = panel === activePanel;

    panel.classList.toggle(CLASSES.active, active);
    panel.toggleAttribute("hidden", !active);
    panel.setAttribute("aria-hidden", String(!active));

    if ("inert" in panel) {
      panel.inert = !active;
    }
  });

  resetPanelScroll(activePanel);
  requestChartResize(activePanel);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketPanels() {
  if (initialized) return;

  const panels = document.querySelectorAll(SELECTORS.panel);

  if (!panels.length) return;

  initialized = true;

  const initialCard = getInitialCard();

  if (initialCard) {
    showMarketPanel(initialCard);
  }

  document.addEventListener("market:change", (event) => {
    const card = event.detail?.card;

    if (card) {
      showMarketPanel(card);
    }
  });
}
