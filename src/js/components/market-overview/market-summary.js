/* ==========================================================================
   Market Summary
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Manage top-level market-card selection.
 * - Maintain tab semantics and roving tabindex.
 * - Support keyboard navigation.
 * - Center selected markets when possible.
 * - Manage horizontal overflow state.
 * - Manage previous / next browse controls.
 * - Manage the "return to selected market" control.
 * - Handle LTR / RTL direction changes safely.
 * - Publish market selection changes.
 *
 * Direction strategy:
 *
 * - DOM order is ALWAYS logical market order; JS never reverses it.
 * - CSS owns LTR / RTL visual placement.
 * - getBoundingClientRect() is used only for physical visibility checks.
 * - scrollIntoView() handles logical LTR / RTL scrolling; scrollLeft
 *   normalization is deliberately avoided.
 *
 * Selection strategy:
 *
 * - The page starts at the first logical market.
 * - User-selected markets are centered whenever scroll geometry allows.
 * - Browse controls move toward the logical start / end.
 * - Direction changes keep the active selection and recenter it.
 */

import {
  getLanguage,
  getScrollBehavior,
  isElementRendered,
  isRTL,
  prefersReducedMotion,
} from "./market-shared";

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-summary]",
  overview: "[data-market-overview]",

  tabs: "[data-market-tabs]",
  cardsWrap: ".market-summary__cards-wrap",

  card: "[data-market-card]",
  cardName: ".market-card__title",

  scrollPrevious: "[data-market-scroll-prev]",
  scrollNext: "[data-market-scroll-next]",

  selectedMarket: "[data-selected-market]",
  selectedMarketName: "[data-selected-market-name]",
};

/* ==========================================================================
   Classes
   ========================================================================== */

const CLASSES = {
  active: "is-active",
  overflowStart: "has-overflow-start",
  overflowEnd: "has-overflow-end",
};

/* ==========================================================================
   Events
   ========================================================================== */

const EVENTS = {
  marketChange: "market:change",
};

/* ==========================================================================
   Constants
   ========================================================================== */

const SCROLL_TOLERANCE = 3;

/*
 * Fallback for browsers without a reliable scrollend event.
 */

const PROGRAMMATIC_SCROLL_FALLBACK = 600;

/*
 * The selected market reads as the focal item in the rail.
 */

const SELECTION_ALIGNMENT = "center";

/*
 * Preferences that change rail geometry. A reset (name: null) may change
 * anything.
 */

const GEOMETRY_PREFERENCES = new Set([
  "lang",
  "direction",
  "fontSize",
  "contrast",
]);

/* ==========================================================================
   Labels
   ========================================================================== */

const LABELS = {
  en: {
    previous: "Show previous markets",
    next: "Show more markets",

    selected: (name) =>
      name ? `Return to selected market: ${name}` : "Return to selected market",

    selectedTooltip: "Return to selected market",
  },

  ar: {
    previous: "عرض الأسواق السابقة",
    next: "عرض المزيد من الأسواق",

    selected: (name) =>
      name ? `العودة إلى السوق المحدد: ${name}` : "العودة إلى السوق المحدد",

    selectedTooltip: "العودة إلى السوق المحدد",
  },
};

function getLabels() {
  return LABELS[getLanguage()];
}

/* ==========================================================================
   State
   ========================================================================== */

const initializedRoots = new WeakSet();

const rootStates = new WeakMap();

/*
 * Iterable set of initialized roots for global refresh operations.
 */

const roots = new Set();

let globalEventsInitialized = false;

let documentObserver = null;

/* ==========================================================================
   Elements
   ========================================================================== */

function collectElements(root) {
  if (!root) {
    return null;
  }

  const tabs = root.querySelector(SELECTORS.tabs);

  if (!tabs) {
    return null;
  }

  const cards = Array.from(tabs.querySelectorAll(SELECTORS.card));

  if (!cards.length) {
    return null;
  }

  return {
    root,

    tabs,

    cards,

    wrap: root.querySelector(SELECTORS.cardsWrap),

    scrollPrevious: root.querySelector(SELECTORS.scrollPrevious),

    scrollNext: root.querySelector(SELECTORS.scrollNext),

    selectedMarket: root.querySelector(SELECTORS.selectedMarket),

    selectedMarketName: root.querySelector(SELECTORS.selectedMarketName),
  };
}

function getState(root) {
  return rootStates.get(root) || null;
}

function getElements(root) {
  return getState(root)?.elements ?? collectElements(root);
}

/* ==========================================================================
   Active Card
   ========================================================================== */

function getActiveCard(root) {
  const cards = getElements(root)?.cards;

  if (!cards) {
    return null;
  }

  return (
    cards.find((card) => card.getAttribute("aria-selected") === "true") ||
    cards.find((card) => card.classList.contains(CLASSES.active)) ||
    cards[0] ||
    null
  );
}

function getCardName(card) {
  if (!card) {
    return "";
  }

  return (
    card.querySelector(SELECTORS.cardName)?.textContent?.trim() ||
    card.dataset.market ||
    ""
  );
}

/* ==========================================================================
   Visibility Geometry
   ========================================================================== */

function isCardFullyVisible(card, scroller) {
  if (!isElementRendered(card) || !isElementRendered(scroller)) {
    return false;
  }

  const cardRect = card.getBoundingClientRect();

  const scrollerRect = scroller.getBoundingClientRect();

  return (
    cardRect.left >= scrollerRect.left - SCROLL_TOLERANCE &&
    cardRect.right <= scrollerRect.right + SCROLL_TOLERANCE
  );
}

/*
 * getBoundingClientRect() is physical:
 *
 * LTR: inline-start = left,  inline-end = right
 * RTL: inline-start = right, inline-end = left
 */

function isHiddenAtInlineStart(elementRect, scrollerRect, rtl) {
  if (rtl) {
    return elementRect.right > scrollerRect.right + SCROLL_TOLERANCE;
  }

  return elementRect.left < scrollerRect.left - SCROLL_TOLERANCE;
}

function isHiddenAtInlineEnd(elementRect, scrollerRect, rtl) {
  if (rtl) {
    return elementRect.left < scrollerRect.left - SCROLL_TOLERANCE;
  }

  return elementRect.right > scrollerRect.right + SCROLL_TOLERANCE;
}

function isCardHiddenAt(card, scroller, edge) {
  if (!isElementRendered(card) || !isElementRendered(scroller)) {
    return true;
  }

  const cardRect = card.getBoundingClientRect();

  const scrollerRect = scroller.getBoundingClientRect();

  const rtl = isRTL(scroller);

  return edge === "start"
    ? isHiddenAtInlineStart(cardRect, scrollerRect, rtl)
    : isHiddenAtInlineEnd(cardRect, scrollerRect, rtl);
}

/* ==========================================================================
   Overflow State
   ========================================================================== */

function getOverflowState(elements) {
  const { tabs, cards } = elements;

  const none = {
    hasOverflowStart: false,
    hasOverflowEnd: false,
  };

  if (!tabs || !cards.length || !isElementRendered(tabs)) {
    return none;
  }

  if (tabs.scrollWidth <= tabs.clientWidth + SCROLL_TOLERANCE) {
    return none;
  }

  /*
   * DOM order is logical in both directions.
   */

  return {
    hasOverflowStart: isCardHiddenAt(cards[0], tabs, "start"),

    hasOverflowEnd: isCardHiddenAt(cards[cards.length - 1], tabs, "end"),
  };
}

/* ==========================================================================
   Market Change Event
   ========================================================================== */

function dispatchMarketChange(card) {
  const overview = card?.closest(SELECTORS.overview);

  if (!overview) {
    return;
  }

  card.dispatchEvent(
    new CustomEvent(EVENTS.marketChange, {
      bubbles: true,

      detail: {
        card,

        root: overview,

        market: card.dataset.market || null,

        panelId: card.getAttribute("aria-controls"),
      },
    }),
  );
}

/* ==========================================================================
   Programmatic Scroll State
   ========================================================================== */

function clearProgrammaticScrollState(root) {
  const state = getState(root);

  if (!state) {
    return;
  }

  if (state.programmaticScrollTimer !== null) {
    window.clearTimeout(state.programmaticScrollTimer);

    state.programmaticScrollTimer = null;
  }

  state.suppressSelectedMarket = false;
}

/*
 * Do not flash the recovery control while the selected card is being
 * intentionally repositioned.
 */

function beginProgrammaticCardReveal(root) {
  const state = getState(root);

  if (!state) {
    return;
  }

  if (state.programmaticScrollTimer !== null) {
    window.clearTimeout(state.programmaticScrollTimer);
  }

  state.suppressSelectedMarket = true;

  state.programmaticScrollTimer = window.setTimeout(
    () => {
      state.programmaticScrollTimer = null;

      state.suppressSelectedMarket = false;

      requestVisualUpdate(root);
    },

    prefersReducedMotion() ? 0 : PROGRAMMATIC_SCROLL_FALLBACK,
  );
}

/* ==========================================================================
   Card Reveal
   ========================================================================== */

/*
 * Alignment-agnostic primitive. Ordinary reveals skip fully visible cards;
 * `force` is used where a visible card still needs repositioning.
 */

function revealCard(
  card,
  scroller,
  { behavior = getScrollBehavior(), inline = "nearest", force = false } = {},
) {
  if (!isElementRendered(card) || !isElementRendered(scroller)) {
    return false;
  }

  if (!force && isCardFullyVisible(card, scroller)) {
    return false;
  }

  card.scrollIntoView({
    behavior,

    block: "nearest",

    inline,
  });

  return true;
}

/*
 * The selected market is centered (browser scroll limits still apply at
 * the ends of the rail).
 */

function revealSelectedCard(card, scroller, options = {}) {
  return revealCard(card, scroller, {
    ...options,

    inline: SELECTION_ALIGNMENT,

    force: true,
  });
}

/* ==========================================================================
   Selection
   ========================================================================== */

function setActiveCard(
  card,
  { focus = false, scroll = true, dispatch = true } = {},
) {
  const root = card?.closest(SELECTORS.root);

  const elements = getElements(root);

  if (!elements || !elements.cards.includes(card)) {
    return;
  }

  const { cards, tabs } = elements;

  /*
   * Normalize the complete tab set: exactly one selected / focusable card.
   */

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

  if (scroll && tabs) {
    beginProgrammaticCardReveal(root);

    if (!revealSelectedCard(card, tabs)) {
      clearProgrammaticScrollState(root);
    }
  } else {
    clearProgrammaticScrollState(root);
  }

  if (dispatch) {
    dispatchMarketChange(card);
  }

  requestVisualUpdate(root);
}

/* ==========================================================================
   Initial Card
   ========================================================================== */

function initializeActiveCard(root) {
  const activeCard = getActiveCard(root);

  if (!activeCard) {
    return;
  }

  /*
   * Normalize selection without moving the rail.
   */

  setActiveCard(activeCard, {
    focus: false,
    scroll: false,
    dispatch: true,
  });

  const { tabs, cards } = getState(root).elements;

  /*
   * The page starts at the first logical market:
   *
   * LTR: Main | Nomu | Sukuk | Funds ->
   * RTL: <- Funds | Sukuk | Nomu | Main
   *
   * Frame 1 lets direction, fonts and grid sizes settle; frame 2 lets
   * scroll geometry settle before the controls are resolved.
   */

  window.requestAnimationFrame(() => {
    if (!root.isConnected) {
      return;
    }

    if (isElementRendered(cards[0]) && isElementRendered(tabs)) {
      cards[0].scrollIntoView({
        behavior: "auto",

        block: "nearest",

        inline: "start",
      });
    }

    window.requestAnimationFrame(() => {
      if (root.isConnected) {
        requestVisualUpdate(root);
      }
    });
  });
}

/* ==========================================================================
   Keyboard Navigation
   ========================================================================== */

function getAdjacentCard(cards, currentCard, direction) {
  const currentIndex = cards.indexOf(currentCard);

  if (currentIndex < 0) {
    return null;
  }

  const step = direction === "next" ? 1 : -1;

  return cards[(currentIndex + step + cards.length) % cards.length];
}

function handleCardKeydown(root, event) {
  const card = event.target.closest(SELECTORS.card);

  if (!card || !root.contains(card)) {
    return;
  }

  const { tabs, cards } = getElements(root);

  const rtl = isRTL(tabs);

  let nextCard = null;

  switch (event.key) {
    /*
     * Physical arrows follow visual direction:
     * LTR right = next, RTL right = previous.
     */

    case "ArrowRight":
      nextCard = getAdjacentCard(cards, card, rtl ? "previous" : "next");
      break;

    case "ArrowLeft":
      nextCard = getAdjacentCard(cards, card, rtl ? "next" : "previous");
      break;

    case "Home":
      nextCard = cards[0] || null;
      break;

    case "End":
      nextCard = cards[cards.length - 1] || null;
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

  if (!nextCard) {
    return;
  }

  event.preventDefault();

  setActiveCard(nextCard, {
    focus: true,
    scroll: true,
  });
}

/* ==========================================================================
   Rail Browsing
   ========================================================================== */

/*
 * Browse controls do NOT change selection; they expose hidden parts of the
 * rail. Previous → first logical market, Next → last logical market.
 */

function scrollRail(root, direction) {
  const { tabs, cards } = getElements(root);

  const target = direction === "previous" ? cards[0] : cards[cards.length - 1];

  if (!tabs || !target) {
    return;
  }

  beginProgrammaticCardReveal(root);

  const moved = revealCard(target, tabs, {
    inline: direction === "previous" ? "start" : "end",

    force: true,
  });

  if (!moved) {
    clearProgrammaticScrollState(root);

    requestVisualUpdate(root);
  }
}

/* ==========================================================================
   Return to Selected Market
   ========================================================================== */

/*
 * Restores the selected market to the same centered position used during
 * ordinary selection.
 */

function scrollToSelectedMarket(root) {
  const elements = getElements(root);

  const activeCard = getActiveCard(root);

  if (!elements || !activeCard) {
    return;
  }

  beginProgrammaticCardReveal(root);

  if (!revealSelectedCard(activeCard, elements.tabs)) {
    clearProgrammaticScrollState(root);
  }

  requestVisualUpdate(root);
}

/* ==========================================================================
   Controls
   ========================================================================== */

function updateScrollControls(elements, overflow) {
  const { scrollPrevious, scrollNext } = elements;

  if (scrollPrevious) {
    scrollPrevious.hidden = !overflow.hasOverflowStart;

    scrollPrevious.disabled = !overflow.hasOverflowStart;
  }

  if (scrollNext) {
    scrollNext.hidden = !overflow.hasOverflowEnd;

    scrollNext.disabled = !overflow.hasOverflowEnd;
  }
}

function updateOverflowClasses(elements, overflow) {
  const { wrap } = elements;

  if (!wrap) {
    return;
  }

  wrap.classList.toggle(CLASSES.overflowStart, overflow.hasOverflowStart);

  wrap.classList.toggle(CLASSES.overflowEnd, overflow.hasOverflowEnd);
}

/*
 * The recovery control represents genuine recovery only: it never appears
 * while JS is intentionally centering the active card.
 */

function updateSelectedMarketControl(elements) {
  const { root, tabs, selectedMarket, selectedMarketName } = elements;

  if (!tabs || !selectedMarket) {
    return;
  }

  const activeCard = getActiveCard(root);

  if (!activeCard) {
    selectedMarket.hidden = true;

    return;
  }

  const activeCardVisible = isCardFullyVisible(activeCard, tabs);

  /*
   * A programmatic reveal can finish before scrollend arrives.
   */

  if (activeCardVisible && getState(root)?.suppressSelectedMarket) {
    clearProgrammaticScrollState(root);
  }

  const suppress = getState(root)?.suppressSelectedMarket ?? false;

  selectedMarket.hidden = activeCardVisible || suppress;

  const name = getCardName(activeCard);

  if (selectedMarketName && selectedMarketName.textContent !== name) {
    selectedMarketName.textContent = name;
  }

  const labels = getLabels();

  selectedMarket.setAttribute("aria-label", labels.selected(name));

  if (selectedMarket.hasAttribute("data-tooltip")) {
    selectedMarket.setAttribute("data-tooltip", labels.selectedTooltip);
  }
}

function updateControlLabels(elements) {
  const labels = getLabels();

  elements.scrollPrevious?.setAttribute("aria-label", labels.previous);

  elements.scrollNext?.setAttribute("aria-label", labels.next);
}

/* ==========================================================================
   Visual State
   ========================================================================== */

function updateVisualState(root) {
  const elements = getElements(root);

  if (!elements) {
    return;
  }

  const overflow = getOverflowState(elements);

  updateOverflowClasses(elements, overflow);

  updateScrollControls(elements, overflow);

  updateSelectedMarketControl(elements);

  updateControlLabels(elements);
}

/*
 * Collapses scroll / resize bursts into one rendering pass per frame.
 */

function requestVisualUpdate(root) {
  const state = getState(root);

  if (!state) {
    return;
  }

  if (state.animationFrame !== null) {
    window.cancelAnimationFrame(state.animationFrame);
  }

  state.animationFrame = window.requestAnimationFrame(() => {
    state.animationFrame = null;

    if (root.isConnected) {
      updateVisualState(root);
    }
  });
}

function requestAllVisualUpdates() {
  roots.forEach((root) => {
    if (root.isConnected) {
      requestVisualUpdate(root);
    }
  });
}

/* ==========================================================================
   Direction Realignment
   ========================================================================== */

/*
 * A direction change invalidates the previous physical scroll position.
 * Recenter the active market so it stays the focal point.
 */

function realignRootAfterDirectionChange(root) {
  const state = getState(root);

  const activeCard = getActiveCard(root);

  if (!state?.elements.tabs || !activeCard) {
    return;
  }

  clearProgrammaticScrollState(root);

  window.requestAnimationFrame(() => {
    if (!root.isConnected) {
      return;
    }

    beginProgrammaticCardReveal(root);

    revealSelectedCard(activeCard, state.elements.tabs, {
      behavior: "auto",
    });

    window.requestAnimationFrame(() => {
      if (!root.isConnected) {
        return;
      }

      clearProgrammaticScrollState(root);

      requestVisualUpdate(root);
    });
  });
}

function realignAllRootsAfterDirectionChange() {
  roots.forEach((root) => {
    if (root.isConnected) {
      realignRootAfterDirectionChange(root);
    }
  });
}

/* ==========================================================================
   Click Handling
   ========================================================================== */

function handleRootClick(root, event) {
  const target = event.target;

  if (target.closest(SELECTORS.scrollPrevious)) {
    event.preventDefault();

    scrollRail(root, "previous");

    return;
  }

  if (target.closest(SELECTORS.scrollNext)) {
    event.preventDefault();

    scrollRail(root, "next");

    return;
  }

  if (target.closest(SELECTORS.selectedMarket)) {
    event.preventDefault();

    scrollToSelectedMarket(root);

    return;
  }

  const card = target.closest(SELECTORS.card);

  if (card && root.contains(card)) {
    setActiveCard(card, {
      focus: false,
      scroll: true,
    });
  }
}

/* ==========================================================================
   Scroll Events
   ========================================================================== */

function handleScrollerScrollEnd(root) {
  const state = getState(root);

  if (!state) {
    return;
  }

  if (state.suppressSelectedMarket) {
    const activeCard = getActiveCard(root);

    if (activeCard && isCardFullyVisible(activeCard, state.elements.tabs)) {
      clearProgrammaticScrollState(root);
    }
  }

  requestVisualUpdate(root);
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function initializeRootEvents(root) {
  const { tabs, wrap } = getState(root).elements;

  root.addEventListener("click", (event) => {
    handleRootClick(root, event);
  });

  root.addEventListener("keydown", (event) => {
    handleCardKeydown(root, event);
  });

  tabs.addEventListener(
    "scroll",
    () => {
      requestVisualUpdate(root);
    },
    {
      passive: true,
    },
  );

  /*
   * scrollend where available; the timeout fallback covers the rest.
   */

  if ("onscrollend" in tabs) {
    tabs.addEventListener(
      "scrollend",
      () => {
        handleScrollerScrollEnd(root);
      },
      {
        passive: true,
      },
    );
  }

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => {
      requestVisualUpdate(root);
    });

    observer.observe(tabs);

    if (wrap) {
      observer.observe(wrap);
    }

    getState(root).resizeObserver = observer;
  }
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

    animationFrame: null,

    resizeObserver: null,

    suppressSelectedMarket: false,

    programmaticScrollTimer: null,
  });

  initializedRoots.add(root);

  roots.add(root);

  initializeRootEvents(root);

  initializeActiveCard(root);

  requestVisualUpdate(root);
}

/* ==========================================================================
   Preference Changes
   ========================================================================== */

function handlePreferenceChange(event) {
  const name = event.detail?.name;

  if (name && !GEOMETRY_PREFERENCES.has(name)) {
    return;
  }

  /*
   * Direction changes alter physical scroll geometry.
   */

  window.requestAnimationFrame(
    name === "direction"
      ? realignAllRootsAfterDirectionChange
      : requestAllVisualUpdates,
  );
}

/* ==========================================================================
   Document Direction / Language Observer
   ========================================================================== */

/*
 * Protects against integrations that update <html dir> or <html lang>
 * directly. Direction has priority because it changes physical geometry.
 */

function initializeDocumentObserver() {
  if (documentObserver || !("MutationObserver" in window)) {
    return;
  }

  documentObserver = new MutationObserver((mutations) => {
    const directionChanged = mutations.some(
      (mutation) => mutation.attributeName === "dir",
    );

    window.requestAnimationFrame(
      directionChanged
        ? realignAllRootsAfterDirectionChange
        : requestAllVisualUpdates,
    );
  });

  documentObserver.observe(document.documentElement, {
    attributes: true,

    attributeFilter: ["dir", "lang"],
  });
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function initializeGlobalEvents() {
  if (globalEventsInitialized) {
    return;
  }

  globalEventsInitialized = true;

  window.addEventListener("load", requestAllVisualUpdates);

  window.addEventListener("resize", requestAllVisualUpdates, {
    passive: true,
  });

  document.addEventListener("languagechange", requestAllVisualUpdates);

  document.addEventListener("preferencechange", handlePreferenceChange);

  initializeDocumentObserver();

  /*
   * Font loading can change card dimensions after initial layout.
   */

  document.fonts?.ready?.then(requestAllVisualUpdates);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketSummary() {
  const summaryRoots = document.querySelectorAll(SELECTORS.root);

  if (!summaryRoots.length) {
    return;
  }

  initializeGlobalEvents();

  summaryRoots.forEach(initializeRoot);
}
