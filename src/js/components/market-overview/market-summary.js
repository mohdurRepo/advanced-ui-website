/* ==========================================================================
   Market Summary
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Manage top-level market-card selection.
 * - Maintain tab semantics and roving tabindex.
 * - Support keyboard navigation.
 * - Keep active selections visually centered when possible.
 * - Manage horizontal overflow state.
 * - Manage previous / next browse controls.
 * - Manage the "return to selected market" control.
 * - Handle LTR / RTL direction changes safely.
 * - Publish market selection changes.
 *
 * Direction strategy:
 *
 * - DOM order is ALWAYS logical market order.
 * - CSS owns LTR / RTL visual placement.
 * - JS NEVER reverses card order.
 * - getBoundingClientRect() is used only for physical visibility checks.
 * - scrollIntoView() handles logical LTR / RTL scrolling.
 * - scrollLeft normalization is deliberately avoided.
 *
 * Selection strategy:
 *
 * - Initial page rendering starts at the first logical market.
 * - User-selected markets are centered whenever browser scroll geometry allows.
 * - Rail browse controls continue to move toward logical start / end.
 * - Direction changes preserve the active selection and recenter it.
 */

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
   Constants
   ========================================================================== */

const SCROLL_TOLERANCE = 3;

/*
 * Defensive fallback for browsers without a reliable scrollend event.
 */

const PROGRAMMATIC_SCROLL_FALLBACK = 600;

/*
 * Actual market selection should read as the focal item in the rail.
 */

const SELECTION_ALIGNMENT = "center";

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

/* ==========================================================================
   State
   ========================================================================== */

const initializedRoots = new WeakSet();

const rootStates = new WeakMap();

/*
 * Keep initialized roots iterable for global refresh operations.
 */

const roots = new Set();

let globalEventsInitialized = false;

let documentObserver = null;

/* ==========================================================================
   Language
   ========================================================================== */

function getLanguage() {
  const language = document.documentElement.lang?.trim().toLowerCase() || "en";

  return language.startsWith("ar") ? "ar" : "en";
}

function getLabels() {
  return LABELS[getLanguage()];
}

/* ==========================================================================
   Motion
   ========================================================================== */

function prefersReducedMotion() {
  if (document.documentElement.dataset.motion === "reduce") {
    return true;
  }

  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function getScrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/* ==========================================================================
   Direction
   ========================================================================== */

function isRTL(element) {
  if (!element) {
    return false;
  }

  return window.getComputedStyle(element).direction === "rtl";
}

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
   Rendering
   ========================================================================== */

function isElementRendered(element) {
  return Boolean(
    element &&
    element.isConnected &&
    element.getClientRects().length &&
    element.getBoundingClientRect().width,
  );
}

/* ==========================================================================
   Active Card
   ========================================================================== */

function getActiveCard(root) {
  const elements = getElements(root);

  if (!elements) {
    return null;
  }

  const { cards } = elements;

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
   Physical Geometry
   ========================================================================== */

function getScrollerRect(scroller) {
  return scroller.getBoundingClientRect();
}

function getCardRect(card) {
  return card.getBoundingClientRect();
}

/* ==========================================================================
   Card Visibility
   ========================================================================== */

function isCardFullyVisible(card, scroller) {
  if (!card || !scroller) {
    return false;
  }

  if (!isElementRendered(card) || !isElementRendered(scroller)) {
    return false;
  }

  const cardRect = getCardRect(card);

  const scrollerRect = getScrollerRect(scroller);

  return (
    cardRect.left >= scrollerRect.left - SCROLL_TOLERANCE &&
    cardRect.right <= scrollerRect.right + SCROLL_TOLERANCE
  );
}

/* ==========================================================================
   Logical Edge Geometry
   ========================================================================== */

/*
 * getBoundingClientRect() returns physical coordinates.
 *
 * LTR:
 *
 * inline-start = left
 * inline-end   = right
 *
 * RTL:
 *
 * inline-start = right
 * inline-end   = left
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

/* ==========================================================================
   First / Last Logical Card Visibility
   ========================================================================== */

function isLogicalStartCardVisible(card, scroller) {
  if (!card || !scroller) {
    return false;
  }

  if (!isElementRendered(card) || !isElementRendered(scroller)) {
    return false;
  }

  const cardRect = getCardRect(card);

  const scrollerRect = getScrollerRect(scroller);

  const rtl = isRTL(scroller);

  return !isHiddenAtInlineStart(cardRect, scrollerRect, rtl);
}

function isLogicalEndCardVisible(card, scroller) {
  if (!card || !scroller) {
    return false;
  }

  if (!isElementRendered(card) || !isElementRendered(scroller)) {
    return false;
  }

  const cardRect = getCardRect(card);

  const scrollerRect = getScrollerRect(scroller);

  const rtl = isRTL(scroller);

  return !isHiddenAtInlineEnd(cardRect, scrollerRect, rtl);
}

/* ==========================================================================
   Overflow State
   ========================================================================== */

function getOverflowState(elements) {
  const { tabs, cards } = elements;

  if (!tabs || !cards.length || !isElementRendered(tabs)) {
    return {
      canScroll: false,
      hasOverflowStart: false,
      hasOverflowEnd: false,
    };
  }

  const canScroll = tabs.scrollWidth > tabs.clientWidth + SCROLL_TOLERANCE;

  if (!canScroll) {
    return {
      canScroll: false,
      hasOverflowStart: false,
      hasOverflowEnd: false,
    };
  }

  /*
   * DOM order remains logical in both directions.
   */

  const firstCard = cards[0];

  const lastCard = cards[cards.length - 1];

  const hasOverflowStart = !isLogicalStartCardVisible(firstCard, tabs);

  const hasOverflowEnd = !isLogicalEndCardVisible(lastCard, tabs);

  return {
    canScroll,
    hasOverflowStart,
    hasOverflowEnd,
  };
}

/* ==========================================================================
   Market Change Event
   ========================================================================== */

function dispatchMarketChange(card) {
  if (!card) {
    return;
  }

  const overview = card.closest(SELECTORS.overview);

  if (!overview) {
    return;
  }

  card.dispatchEvent(
    new CustomEvent("market:change", {
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

function beginProgrammaticCardReveal(root) {
  const state = getState(root);

  if (!state) {
    return;
  }

  if (state.programmaticScrollTimer !== null) {
    window.clearTimeout(state.programmaticScrollTimer);
  }

  /*
   * Do not flash the recovery control while the selected card is being
   * intentionally repositioned.
   */

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
   Generic Card Reveal
   ========================================================================== */

/*
 * Keep the generic primitive alignment-agnostic.
 *
 * Callers decide whether they require:
 *
 * - nearest
 * - center
 * - start
 * - end
 */

function revealCard(
  card,
  scroller,
  { behavior = getScrollBehavior(), inline = "nearest", force = false } = {},
) {
  if (!card || !scroller) {
    return false;
  }

  if (!isElementRendered(card) || !isElementRendered(scroller)) {
    return false;
  }

  /*
   * Ordinary reveals may avoid unnecessary movement.
   *
   * Selection centering passes force: true because a fully visible card can
   * still be visually off-center.
   */

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

/* ==========================================================================
   Selected Card Reveal
   ========================================================================== */

/*
 * A selected market is the focal item in the Summary rail.
 *
 * Centering produces a materially cleaner relationship with Details and the
 * Summary → Details connector than merely ensuring the card is visible.
 *
 * Browser scroll limits still apply naturally to cards at the absolute ends
 * of the scrollable content.
 */

function revealSelectedCard(
  card,
  scroller,
  { behavior = getScrollBehavior() } = {},
) {
  return revealCard(card, scroller, {
    behavior,

    inline: SELECTION_ALIGNMENT,

    force: true,
  });
}

/* ==========================================================================
   Logical Start Alignment
   ========================================================================== */

/*
 * Initial rendering is intentionally different from active selection.
 *
 * The rail must start at its first logical market rather than opening with
 * the initial card artificially centered.
 */

function alignCardToLogicalStart(card, scroller) {
  if (!card || !scroller) {
    return false;
  }

  if (!isElementRendered(card) || !isElementRendered(scroller)) {
    return false;
  }

  card.scrollIntoView({
    behavior: "auto",

    block: "nearest",

    inline: "start",
  });

  return true;
}

/* ==========================================================================
   Selection
   ========================================================================== */

function setActiveCard(
  card,
  { focus = false, scroll = true, dispatch = true } = {},
) {
  const root = card?.closest(SELECTORS.root);

  if (!root) {
    return;
  }

  const elements = getElements(root);

  if (!elements || !elements.cards.includes(card)) {
    return;
  }

  const { cards, tabs } = elements;

  /*
   * Normalize the complete tab set on every selection.
   *
   * This guarantees there can be only one selected / keyboard-active card.
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

    /*
     * Important:
     *
     * Do NOT use inline: nearest here.
     *
     * A selected card may already be fully visible while still sitting at
     * the far edge of the rail. We intentionally recenter it.
     */

    const moved = revealSelectedCard(card, tabs);

    if (!moved) {
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
   * Normalize initial selection state without allowing selection itself to
   * move the rail.
   */

  setActiveCard(activeCard, {
    focus: false,
    scroll: false,
    dispatch: true,
  });

  const state = getState(root);

  if (!state) {
    return;
  }

  const { tabs, cards } = state.elements;

  /*
   * Initial page presentation starts from the first logical market.
   *
   * LTR:
   *
   * Main | Nomu | Sukuk | Funds ->
   *
   * RTL:
   *
   * <- Funds | Sukuk | Nomu | Main
   *
   * DOM order remains unchanged.
   */

  const firstCard = cards[0];

  if (!firstCard) {
    return;
  }

  /*
   * Frame 1:
   *
   * Allow CSS direction, fonts and grid sizes to establish geometry.
   */

  window.requestAnimationFrame(() => {
    if (!root.isConnected) {
      return;
    }

    alignCardToLogicalStart(firstCard, tabs);

    /*
     * Frame 2:
     *
     * Allow browser scroll geometry to settle before resolving rail controls.
     */

    window.requestAnimationFrame(() => {
      if (!root.isConnected) {
        return;
      }

      requestVisualUpdate(root);
    });
  });
}

/* ==========================================================================
   Logical Card Navigation
   ========================================================================== */

function getAdjacentCard(cards, currentCard, direction) {
  const currentIndex = cards.indexOf(currentCard);

  if (currentIndex < 0) {
    return null;
  }

  /*
   * DOM order is logical.
   *
   * Never reverse the array for RTL.
   */

  const step = direction === "next" ? 1 : -1;

  const nextIndex = (currentIndex + step + cards.length) % cards.length;

  return cards[nextIndex];
}

/* ==========================================================================
   Keyboard Navigation
   ========================================================================== */

function handleCardKeydown(root, event) {
  const card = event.target.closest(SELECTORS.card);

  if (!card || !root.contains(card)) {
    return;
  }

  const elements = getElements(root);

  if (!elements) {
    return;
  }

  const { tabs, cards } = elements;

  const rtl = isRTL(tabs);

  let nextCard = null;

  switch (event.key) {
    case "ArrowRight":
      /*
       * Physical keyboard movement:
       *
       * LTR right = logical next.
       * RTL right = logical previous.
       */

      nextCard = getAdjacentCard(cards, card, rtl ? "previous" : "next");

      break;

    case "ArrowLeft":
      /*
       * LTR left = logical previous.
       * RTL left = logical next.
       */

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
 * Browse controls do NOT change market selection.
 *
 * They expose hidden portions of the rail so users can inspect additional
 * markets before choosing one.
 */

function scrollRail(root, direction) {
  const elements = getElements(root);

  if (!elements) {
    return;
  }

  const { tabs, cards } = elements;

  if (!tabs || !cards.length) {
    return;
  }

  /*
   * Previous -> logical first market.
   * Next     -> logical last market.
   *
   * Their physical location remains CSS-owned.
   */

  const target = direction === "previous" ? cards[0] : cards[cards.length - 1];

  if (!target) {
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

function scrollToSelectedMarket(root) {
  const elements = getElements(root);

  const activeCard = getActiveCard(root);

  if (!elements || !activeCard) {
    return;
  }

  beginProgrammaticCardReveal(root);

  /*
   * Recovery should restore the selected market to the same visual position
   * used during ordinary market selection.
   */

  const moved = revealSelectedCard(activeCard, elements.tabs);

  if (!moved) {
    clearProgrammaticScrollState(root);
  }

  requestVisualUpdate(root);
}

/* ==========================================================================
   Scroll Controls
   ========================================================================== */

function updateScrollControls(elements, overflow) {
  const { scrollPrevious, scrollNext } = elements;

  const showPrevious = overflow.canScroll && overflow.hasOverflowStart;

  const showNext = overflow.canScroll && overflow.hasOverflowEnd;

  if (scrollPrevious) {
    scrollPrevious.hidden = !showPrevious;

    scrollPrevious.disabled = !showPrevious;
  }

  if (scrollNext) {
    scrollNext.hidden = !showNext;

    scrollNext.disabled = !showNext;
  }
}

/* ==========================================================================
   Edge Fades
   ========================================================================== */

function updateOverflowClasses(elements, overflow) {
  const { wrap } = elements;

  if (!wrap) {
    return;
  }

  wrap.classList.toggle(
    CLASSES.overflowStart,

    overflow.canScroll && overflow.hasOverflowStart,
  );

  wrap.classList.toggle(
    CLASSES.overflowEnd,

    overflow.canScroll && overflow.hasOverflowEnd,
  );
}

/* ==========================================================================
   Selected Market Recovery Control
   ========================================================================== */

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

  const state = getState(root);

  const activeCardVisible = isCardFullyVisible(activeCard, tabs);

  /*
   * A programmatic reveal can finish before scrollend is dispatched.
   */

  if (activeCardVisible && state?.suppressSelectedMarket) {
    clearProgrammaticScrollState(root);
  }

  const suppress = getState(root)?.suppressSelectedMarket ?? false;

  /*
   * The control represents genuine recovery only.
   *
   * It must not appear while JS is intentionally centering the active card.
   */

  const shouldShow = !activeCardVisible && !suppress;

  selectedMarket.hidden = !shouldShow;

  const name = getCardName(activeCard);

  if (selectedMarketName) {
    selectedMarketName.textContent = name;
  }

  const labels = getLabels();

  selectedMarket.setAttribute("aria-label", labels.selected(name));

  if (selectedMarket.hasAttribute("data-tooltip")) {
    selectedMarket.setAttribute("data-tooltip", labels.selectedTooltip);
  }
}

/* ==========================================================================
   Localized Controls
   ========================================================================== */

function updateControlLabels(elements) {
  const labels = getLabels();

  if (elements.scrollPrevious) {
    elements.scrollPrevious.setAttribute("aria-label", labels.previous);
  }

  if (elements.scrollNext) {
    elements.scrollNext.setAttribute("aria-label", labels.next);
  }
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

function requestVisualUpdate(root) {
  if (!root) {
    return;
  }

  const state = getState(root);

  if (!state) {
    return;
  }

  /*
   * Collapse multiple scroll / resize events into one rendering pass.
   */

  if (state.animationFrame !== null) {
    window.cancelAnimationFrame(state.animationFrame);
  }

  state.animationFrame = window.requestAnimationFrame(() => {
    state.animationFrame = null;

    if (!root.isConnected) {
      return;
    }

    updateVisualState(root);
  });
}

function requestAllVisualUpdates() {
  roots.forEach((root) => {
    if (root.isConnected && initializedRoots.has(root)) {
      requestVisualUpdate(root);
    }
  });
}

/* ==========================================================================
   Direction Realignment
   ========================================================================== */

function realignRootAfterDirectionChange(root) {
  if (!root || !initializedRoots.has(root)) {
    return;
  }

  const state = getState(root);

  if (!state) {
    return;
  }

  const { tabs } = state.elements;

  const activeCard = getActiveCard(root);

  if (!tabs || !activeCard) {
    return;
  }

  clearProgrammaticScrollState(root);

  /*
   * Direction changes invalidate the browser's previous physical scroll
   * position.
   *
   * Recenter the active market after the direction has changed so selection
   * remains the visual focal point in either writing direction.
   */

  window.requestAnimationFrame(() => {
    if (!root.isConnected) {
      return;
    }

    beginProgrammaticCardReveal(root);

    revealSelectedCard(activeCard, tabs, {
      behavior: "auto",
    });

    /*
     * Allow new RTL/LTR scroll geometry to settle before updating controls.
     */

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
    if (root.isConnected && initializedRoots.has(root)) {
      realignRootAfterDirectionChange(root);
    }
  });
}

/* ==========================================================================
   Click Handling
   ========================================================================== */

function handleRootClick(root, event) {
  const previous = event.target.closest(SELECTORS.scrollPrevious);

  if (previous && root.contains(previous)) {
    event.preventDefault();

    scrollRail(root, "previous");

    return;
  }

  const next = event.target.closest(SELECTORS.scrollNext);

  if (next && root.contains(next)) {
    event.preventDefault();

    scrollRail(root, "next");

    return;
  }

  const selectedMarket = event.target.closest(SELECTORS.selectedMarket);

  if (selectedMarket && root.contains(selectedMarket)) {
    event.preventDefault();

    scrollToSelectedMarket(root);

    return;
  }

  const card = event.target.closest(SELECTORS.card);

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

function handleScrollerScroll(root) {
  requestVisualUpdate(root);
}

function handleScrollerScrollEnd(root) {
  const state = getState(root);

  if (!state) {
    return;
  }

  if (!state.suppressSelectedMarket) {
    requestVisualUpdate(root);

    return;
  }

  const activeCard = getActiveCard(root);

  const tabs = state.elements.tabs;

  if (activeCard && isCardFullyVisible(activeCard, tabs)) {
    clearProgrammaticScrollState(root);
  }

  requestVisualUpdate(root);
}

/* ==========================================================================
   Resize Observer
   ========================================================================== */

function initializeResizeObserver(root) {
  if (!("ResizeObserver" in window)) {
    return;
  }

  const state = getState(root);

  if (!state) {
    return;
  }

  const { tabs, wrap } = state.elements;

  const observer = new ResizeObserver(() => {
    requestVisualUpdate(root);
  });

  observer.observe(tabs);

  if (wrap) {
    observer.observe(wrap);
  }

  state.resizeObserver = observer;
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function initializeRootEvents(root) {
  const state = getState(root);

  if (!state) {
    return;
  }

  const { tabs } = state.elements;

  root.addEventListener("click", (event) => {
    handleRootClick(root, event);
  });

  root.addEventListener("keydown", (event) => {
    handleCardKeydown(root, event);
  });

  tabs.addEventListener(
    "scroll",
    () => {
      handleScrollerScroll(root);
    },
    {
      passive: true,
    },
  );

  /*
   * Modern browsers expose scrollend.
   *
   * The timeout fallback still protects environments where it is absent or
   * not dispatched reliably.
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

  initializeResizeObserver(root);

  initializeActiveCard(root);

  requestVisualUpdate(root);
}

/* ==========================================================================
   Preference Changes
   ========================================================================== */

function handlePreferenceChange(event) {
  const preferenceName = event.detail?.name;

  const relevantPreferences = [
    "lang",
    "direction",
    "fontSize",
    "motion",
    "contrast",
  ];

  if (preferenceName && !relevantPreferences.includes(preferenceName)) {
    return;
  }

  /*
   * Direction changes modify physical scroll geometry.
   */

  if (preferenceName === "direction") {
    window.requestAnimationFrame(() => {
      realignAllRootsAfterDirectionChange();
    });

    return;
  }

  window.requestAnimationFrame(requestAllVisualUpdates);
}

/* ==========================================================================
   Document Direction / Language Observer
   ========================================================================== */

function initializeDocumentObserver() {
  if (documentObserver || !("MutationObserver" in window)) {
    return;
  }

  documentObserver = new MutationObserver((mutations) => {
    let directionChanged = false;

    let languageChanged = false;

    mutations.forEach((mutation) => {
      if (mutation.type !== "attributes") {
        return;
      }

      if (mutation.attributeName === "dir") {
        directionChanged = true;
      }

      if (mutation.attributeName === "lang") {
        languageChanged = true;
      }
    });

    /*
     * Direction has priority because it changes physical geometry.
     */

    if (directionChanged) {
      window.requestAnimationFrame(() => {
        realignAllRootsAfterDirectionChange();
      });

      return;
    }

    if (languageChanged) {
      window.requestAnimationFrame(requestAllVisualUpdates);
    }
  });

  documentObserver.observe(document.documentElement, {
    attributes: true,

    attributeFilter: ["dir", "lang"],
  });
}

/* ==========================================================================
   Global Resize
   ========================================================================== */

function handleWindowResize() {
  requestAllVisualUpdates();
}

/* ==========================================================================
   Window Load
   ========================================================================== */

function handleWindowLoad() {
  /*
   * Recalculate after initial resources settle.
   */

  requestAllVisualUpdates();
}

/* ==========================================================================
   Language Change
   ========================================================================== */

function handleLanguageChange() {
  requestAllVisualUpdates();
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function initializeGlobalEvents() {
  if (globalEventsInitialized) {
    return;
  }

  globalEventsInitialized = true;

  window.addEventListener("load", handleWindowLoad);

  window.addEventListener("resize", handleWindowResize, {
    passive: true,
  });

  window.addEventListener("languagechange", handleLanguageChange);

  document.addEventListener("preferencechange", handlePreferenceChange);

  initializeDocumentObserver();

  /*
   * Font loading can modify card dimensions after initial layout.
   */

  document.fonts?.ready?.then(() => {
    requestAllVisualUpdates();
  });
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
