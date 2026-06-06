const CARD_SELECTOR = "[data-market-card]";
const PANEL_SELECTOR = "[data-market-detail-panel]";

function getPanelByCard(card) {
  const panelId = card?.getAttribute("aria-controls");

  if (!panelId) return null;

  return document.getElementById(panelId);
}

export function showMarketPanel(card) {
  const activePanel = getPanelByCard(card);

  document.querySelectorAll(PANEL_SELECTOR).forEach((panel) => {
    const isActive = panel === activePanel;

    panel.toggleAttribute("hidden", !isActive);
    panel.setAttribute("aria-hidden", String(!isActive));
    panel.classList.toggle("is-active", isActive);
  });
}

export function initMarketPanels() {
  const activeCard =
    document.querySelector(`${CARD_SELECTOR}.is-active`) ||
    document.querySelector(CARD_SELECTOR);

  if (activeCard) {
    showMarketPanel(activeCard);
  }

  document.addEventListener("market:change", (event) => {
    if (event.detail?.card) {
      showMarketPanel(event.detail.card);
    }
  });
}
