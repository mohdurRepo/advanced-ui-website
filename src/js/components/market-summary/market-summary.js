/* ==========================================================================
   Market Summary
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-summary]",
  tabs: "[data-market-tabs]",
  card: "[data-market-card]",
  cardsWrap: ".market-summary__cards-wrap",

  selectedMarket: "[data-selected-market]",
  selectedMarketName: "[data-selected-market-name]",
  cardName: ".market-card__title",
};

const CLASSES = {
  active: "is-active",
  visible: "is-visible",
  overflowStart: "has-overflow-start",
  overflowEnd: "has-overflow-end",
};

const SCROLL_TOLERANCE = 2;

let animationFrame = null;
let resizeObserver = null;
let initialized = false;

/* ==========================================================================
   Elements
   ========================================================================== */

function getRoot() {
  return document.querySelector(SELECTORS.root);
}

function getElements(root = getRoot()) {
  if (!root) {
    return {
      root: null,
      tabs: null,
      cards: [],
      wrap: null,
      selectedMarket: null,
      selectedMarketName: null,
    };
  }

  return {
    root,
    tabs: root.querySelector(SELECTORS.tabs),
    cards: Array.from(root.querySelectorAll(SELECTORS.card)),
    wrap: root.querySelector(SELECTORS.cardsWrap),
    selectedMarket: root.querySelector(SELECTORS.selectedMarket),
    selectedMarketName: root.querySelector(SELECTORS.selectedMarketName),
  };
}

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isRTL(element) {
  return getComputedStyle(element).direction === "rtl";
}

function prefersReducedMotion() {
  return document.documentElement.dataset.motion === "reduce";
}

function getScrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}

function getActiveCard(root = getRoot()) {
  if (!root) return null;

  return (
    root.querySelector(`${SELECTORS.card}[aria-selected="true"]`) ||
    root.querySelector(`${SELECTORS.card}.${CLASSES.active}`) ||
    root.querySelector(SELECTORS.card)
  );
}

function getCardName(card) {
  return (
    card?.querySelector(SELECTORS.cardName)?.textContent?.trim() ||
    card?.dataset.market ||
    ""
  );
}

function dispatchMarketChange(card) {
  document.dispatchEvent(
    new CustomEvent("market:change", {
      detail: {
        card,
        market: card.dataset.market || null,
        panelId: card.getAttribute("aria-controls"),
      },
    }),
  );
}

/* ==========================================================================
   Visibility
   ========================================================================== */

function isCardFullyVisible(card, scroller) {
  if (!card || !scroller) return false;

  const cardRect = card.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();

  return (
    cardRect.left >= scrollerRect.left - SCROLL_TOLERANCE &&
    cardRect.right <= scrollerRect.right + SCROLL_TOLERANCE
  );
}

function getPhysicalOverflowState(scroller) {
  const cards = Array.from(scroller.querySelectorAll(SELECTORS.card));

  if (!cards.length) {
    return {
      canScroll: false,
      hasOverflowStart: false,
      hasOverflowEnd: false,
    };
  }

  const firstCard = cards[0];
  const lastCard = cards[cards.length - 1];

  const scrollerRect = scroller.getBoundingClientRect();
  const firstRect = firstCard.getBoundingClientRect();
  const lastRect = lastCard.getBoundingClientRect();

  const rtl = isRTL(scroller);

  const hasOverflowStart = rtl
    ? lastRect.right > scrollerRect.right + SCROLL_TOLERANCE
    : firstRect.left < scrollerRect.left - SCROLL_TOLERANCE;

  const hasOverflowEnd = rtl
    ? firstRect.left < scrollerRect.left - SCROLL_TOLERANCE
    : lastRect.right > scrollerRect.right + SCROLL_TOLERANCE;

  return {
    canScroll: scroller.scrollWidth > scroller.clientWidth + SCROLL_TOLERANCE,
    hasOverflowStart,
    hasOverflowEnd,
  };
}

/* ==========================================================================
   Active Market
   ========================================================================== */

function setActiveCard(
  card,
  { focus = false, scroll = true, dispatch = true } = {},
) {
  const root = card?.closest(SELECTORS.root);

  if (!root) return;

  const { tabs, cards } = getElements(root);

  cards.forEach((item) => {
    const active = item === card;

    item.classList.toggle(CLASSES.active, active);
    item.setAttribute("aria-selected", String(active));
    item.setAttribute("tabindex", active ? "0" : "-1");
  });

  if (focus) {
    card.focus({
      preventScroll: true,
    });
  }

  if (scroll && tabs && !isCardFullyVisible(card, tabs)) {
    card.scrollIntoView({
      behavior: getScrollBehavior(),
      block: "nearest",
      inline: "nearest",
    });
  }

  if (dispatch) {
    dispatchMarketChange(card);
  }

  requestVisualUpdate(root);
}

function initializeActiveCard(root) {
  const activeCard = getActiveCard(root);

  if (!activeCard) return;

  setActiveCard(activeCard, {
    focus: false,
    scroll: false,
    dispatch: true,
  });
}

/* ==========================================================================
   Keyboard Navigation
   ========================================================================== */

function getAdjacentCard(cards, currentCard, direction, rtl) {
  const currentIndex = cards.indexOf(currentCard);

  if (currentIndex < 0) return null;

  let step = direction === "next" ? 1 : -1;

  if (rtl) {
    step *= -1;
  }

  const nextIndex = (currentIndex + step + cards.length) % cards.length;

  return cards[nextIndex];
}

function handleCardKeydown(event) {
  const card = event.target.closest(SELECTORS.card);

  if (!card) return;

  const root = card.closest(SELECTORS.root);
  const { tabs, cards } = getElements(root);

  if (!tabs || !cards.length) return;

  let nextCard = null;

  switch (event.key) {
    case "ArrowRight":
      nextCard = getAdjacentCard(cards, card, "next", isRTL(tabs));
      break;

    case "ArrowLeft":
      nextCard = getAdjacentCard(cards, card, "previous", isRTL(tabs));
      break;

    case "Home":
      nextCard = cards[0];
      break;

    case "End":
      nextCard = cards[cards.length - 1];
      break;

    case "Enter":
    case " ":
      event.preventDefault();

      setActiveCard(card, {
        focus: true,
        scroll: true,
      });

      return;

    default:
      return;
  }

  if (!nextCard) return;

  event.preventDefault();

  setActiveCard(nextCard, {
    focus: true,
    scroll: true,
  });
}

/* ==========================================================================
   Edge Fades
   ========================================================================== */

function updateOverflowState(root) {
  const { tabs, wrap } = getElements(root);

  if (!tabs || !wrap) return;

  const { canScroll, hasOverflowStart, hasOverflowEnd } =
    getPhysicalOverflowState(tabs);

  wrap.classList.toggle(CLASSES.overflowStart, canScroll && hasOverflowStart);

  wrap.classList.toggle(CLASSES.overflowEnd, canScroll && hasOverflowEnd);
}

/* ==========================================================================
   Selected Market Chip
   ========================================================================== */

function updateSelectedMarketChip(root) {
  const { tabs, selectedMarket, selectedMarketName } = getElements(root);

  const activeCard = getActiveCard(root);

  if (!tabs || !selectedMarket || !activeCard) return;

  const activeCardVisible = isCardFullyVisible(activeCard, tabs);
  const shouldShow = !activeCardVisible;

  selectedMarket.hidden = !shouldShow;
  selectedMarket.classList.toggle(CLASSES.visible, shouldShow);

  if (selectedMarketName) {
    selectedMarketName.textContent = getCardName(activeCard);
  }

  selectedMarket.setAttribute(
    "aria-label",
    `Return to selected market: ${getCardName(activeCard)}`,
  );
}

function scrollToSelectedMarket(root) {
  const activeCard = getActiveCard(root);

  if (!activeCard) return;

  activeCard.scrollIntoView({
    behavior: getScrollBehavior(),
    block: "nearest",
    inline: "center",
  });

  window.requestAnimationFrame(() => {
    requestVisualUpdate(root);
  });
}

/* ==========================================================================
   Visual Updates
   ========================================================================== */

function updateVisualState(root) {
  updateOverflowState(root);
  updateSelectedMarketChip(root);
}

function requestVisualUpdate(root = getRoot()) {
  if (!root) return;

  if (animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame);
  }

  animationFrame = window.requestAnimationFrame(() => {
    updateVisualState(root);
    animationFrame = null;
  });
}

/* ==========================================================================
   Events
   ========================================================================== */

function handleClick(event) {
  const card = event.target.closest(SELECTORS.card);

  if (card) {
    setActiveCard(card, {
      focus: false,
      scroll: true,
    });

    return;
  }

  const selectedMarket = event.target.closest(SELECTORS.selectedMarket);

  if (selectedMarket) {
    const root = selectedMarket.closest(SELECTORS.root);

    scrollToSelectedMarket(root);
  }
}

function handlePreferenceChange(event) {
  const relevantPreferences = ["lang", "fontSize", "motion", "contrast"];

  if (event.detail?.name && !relevantPreferences.includes(event.detail.name)) {
    return;
  }

  requestVisualUpdate();
}

function handleLanguageChange() {
  requestVisualUpdate();
}

/* ==========================================================================
   Resize Observer
   ========================================================================== */

function initializeResizeObserver(root) {
  if (!("ResizeObserver" in window)) return;

  const { tabs, wrap, cards } = getElements(root);

  resizeObserver = new ResizeObserver(() => {
    requestVisualUpdate(root);
  });

  if (tabs) {
    resizeObserver.observe(tabs);
  }

  if (wrap) {
    resizeObserver.observe(wrap);
  }

  cards.forEach((card) => {
    resizeObserver.observe(card);
  });
}

/* ==========================================================================
   Initializer
   ========================================================================== */

export function initMarketSummary() {
  if (initialized) return;

  const root = getRoot();

  if (!root) return;

  initialized = true;

  const { tabs } = getElements(root);

  initializeActiveCard(root);
  initializeResizeObserver(root);

  root.addEventListener("click", handleClick);
  root.addEventListener("keydown", handleCardKeydown);

  tabs?.addEventListener(
    "scroll",
    () => {
      requestVisualUpdate(root);
    },
    {
      passive: true,
    },
  );

  window.addEventListener("load", () => {
    requestVisualUpdate(root);
  });

  window.addEventListener("resize", () => {
    requestVisualUpdate(root);
  });

  document.addEventListener("preferencechange", handlePreferenceChange);

  document.addEventListener("languagechange", handleLanguageChange);

  requestVisualUpdate(root);
}
