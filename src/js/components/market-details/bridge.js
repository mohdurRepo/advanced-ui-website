const CARD_SELECTOR = "[data-market-card]";
const CARDS_SCROLLER_SELECTOR = ".market-summary__cards";

const BRIDGE_SELECTOR = "[data-market-bridge]";
const BRIDGE_INNER_SELECTOR = ".market-bridge__inner";
const BRIDGE_BAR_SELECTOR = "[data-market-bridge-bar]";

let animationFrame = null;

function getActiveCard() {
  return document.querySelector(`${CARD_SELECTOR}.is-active`);
}

function getBridgeElements(card = getActiveCard()) {
  const scroller = document.querySelector(CARDS_SCROLLER_SELECTOR);
  const bridge = document.querySelector(BRIDGE_SELECTOR);
  const inner = bridge?.querySelector(BRIDGE_INNER_SELECTOR);
  const bar = bridge?.querySelector(BRIDGE_BAR_SELECTOR);

  return { card, scroller, inner, bar };
}

export function updateMarketBridge(card = getActiveCard()) {
  const { scroller, inner, bar } = getBridgeElements(card);

  if (!card || !scroller || !inner || !bar) return;

  const cardRect = card.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const innerRect = inner.getBoundingClientRect();

  const visibleStart = Math.max(cardRect.left, scrollerRect.left);
  const visibleEnd = Math.min(cardRect.right, scrollerRect.right);
  const visibleWidth = Math.max(0, visibleEnd - visibleStart);

  if (visibleWidth <= 0) {
    bar.style.inlineSize = "0px";
    return;
  }

  const isRTL = getComputedStyle(scroller).direction === "rtl";

  const offset = isRTL
    ? visibleEnd - innerRect.right
    : visibleStart - innerRect.left;

  bar.style.inlineSize = `${visibleWidth}px`;
  bar.style.transform = `translate3d(${offset}px, 0, 0)`;
}

function requestBridgeUpdate(card = getActiveCard()) {
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
  }

  animationFrame = window.requestAnimationFrame(() => {
    updateMarketBridge(card);
    animationFrame = null;
  });
}

export function initMarketBridge() {
  const scroller = document.querySelector(CARDS_SCROLLER_SELECTOR);

  requestBridgeUpdate();

  window.addEventListener("load", () => requestBridgeUpdate());
  window.addEventListener("resize", () => requestBridgeUpdate());

  scroller?.addEventListener("scroll", () => requestBridgeUpdate(), {
    passive: true,
  });

  document.addEventListener("market:change", (event) => {
    requestBridgeUpdate(event.detail?.card);
  });
}
