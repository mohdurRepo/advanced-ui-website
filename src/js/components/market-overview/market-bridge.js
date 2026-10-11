/* ==========================================================================
   Market Bridge
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Connect the active Summary market card to Market Details.
 * - Maintain bridge block geometry between the card and Details.
 * - Match the bridge bar exactly to the visible portion of the active card.
 * - Publish .is-bridge-connected while a bar is actually drawn.
 * - Publish logical Details-edge states when the bridge reaches a rounded
 *   Details corner.
 * - Support horizontal Summary scrolling, LTR and RTL.
 * - Refresh after market / panel / tab / disclosure changes, resize, fonts
 *   and relevant preference changes.
 *
 * Whether a bridge exists at all is decided by CSS (Details open, md+, on
 * every page variant). An unrendered bridge is treated as "no bridge" and
 * every connected state is cleared.
 *
 * Important:
 *
 * Bridge block dimensions MUST be applied before measuring bridgeInner,
 * because bridgeInner depends on the bridge's final rendered block size.
 *
 * This module does NOT own:
 *
 * - market selection;
 * - Summary scrolling behavior;
 * - Details visibility;
 * - panel or nested tab selection;
 * - mobile disclosure state;
 * - bridge visual styling;
 * - card or Details corner styling.
 */

import { isElementRendered, isRTL } from "./market-shared";

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-overview]",

  summary: "[data-market-summary]",

  content: ".market-overview__details-content",

  details: "[data-market-overview-details]",

  detailsContainer: ".market-details__container",

  scroller: "[data-market-tabs]",

  card: "[data-market-card]",

  bridge: "[data-market-bridge]",

  bridgeInner: ".market-bridge__inner",

  bridgeBar: "[data-market-bridge-bar]",
};

/* ==========================================================================
   Classes
   ========================================================================== */

const CLASSES = {
  active: "is-active",

  bridgeConnected: "is-bridge-connected",

  bridgeAtInlineStart: "is-bridge-at-inline-start",

  bridgeAtInlineEnd: "is-bridge-at-inline-end",
};

/* ==========================================================================
   Events
   ========================================================================== */

const EVENTS = {
  marketChange: "market:change",

  overviewChange: "market:overviewchange",

  detailsShown: "market:detailsshown",

  panelShown: "market:panelshown",

  tabChange: "market:tabchange",

  detailsExpanded: "market:detailsexpanded",
};

/* ==========================================================================
   Geometry
   ========================================================================== */

const INLINE_TOLERANCE = 0.5;

/* Fractional-pixel layout differences. */

const EDGE_TOLERANCE = 1.5;

/*
 * Begin the bridge one physical pixel inside the selected card, preventing
 * antialiasing seams between card and connector.
 */

const BLOCK_SEAM_OVERLAP = 1;

/* ==========================================================================
   State
   ========================================================================== */

const initializedRoots = new WeakSet();

const rootStates = new WeakMap();

let globalEventsInitialized = false;

let documentObserver = null;

/* ==========================================================================
   Roots
   ========================================================================== */

function getRoots() {
  return Array.from(document.querySelectorAll(SELECTORS.root));
}

/* ==========================================================================
   Elements
   ========================================================================== */

function collectElements(root) {
  if (!root) {
    return null;
  }

  const summary = root.querySelector(SELECTORS.summary);

  const bridge = root.querySelector(SELECTORS.bridge);

  return {
    root,

    summary,

    content: root.querySelector(SELECTORS.content),

    details: root.querySelector(SELECTORS.details),

    detailsContainer: root.querySelector(SELECTORS.detailsContainer),

    scroller: summary?.querySelector(SELECTORS.scroller) || null,

    cards: Array.from(root.querySelectorAll(SELECTORS.card)),

    bridge,

    inner: bridge?.querySelector(SELECTORS.bridgeInner) || null,

    bar: bridge?.querySelector(SELECTORS.bridgeBar) || null,
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
  if (!root) {
    return null;
  }

  return (
    root.querySelector(`${SELECTORS.card}[aria-selected="true"]`) ||
    root.querySelector(`${SELECTORS.card}.${CLASSES.active}`) ||
    root.querySelector(SELECTORS.card)
  );
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function getPixelLength(element, property) {
  if (!element) {
    return 0;
  }

  const value = window.getComputedStyle(element).getPropertyValue(property);

  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? number : 0;
}

/* ==========================================================================
   Connected State
   ========================================================================== */

function setConnected(root, connected) {
  root?.classList.toggle(CLASSES.bridgeConnected, connected);
}

function clearBridgeEdgeState(root) {
  root?.classList.remove(
    CLASSES.bridgeAtInlineStart,
    CLASSES.bridgeAtInlineEnd,
  );
}

/* ==========================================================================
   Bridge Edge State
   ========================================================================== */

/*
 * CSS owns the Details corner radius; JS publishes only:
 *
 * - .is-bridge-at-inline-start
 * - .is-bridge-at-inline-end
 *
 * A corner is flattened as soon as the connector enters its radius zone,
 * not only when it reaches the extreme outer edge.
 */

function updateBridgeEdgeState(
  root,
  { visibleLeft, visibleRight, detailsContainer, rtl },
) {
  if (!root || !detailsContainer || !isElementRendered(detailsContainer)) {
    clearBridgeEdgeState(root);

    return;
  }

  const detailsRect = detailsContainer.getBoundingClientRect();

  /*
   * parseFloat() takes the first value of an elliptical radius.
   */

  const leftRadius = getPixelLength(detailsContainer, "border-top-left-radius");

  const rightRadius = getPixelLength(
    detailsContainer,
    "border-top-right-radius",
  );

  const touchesPhysicalLeft =
    visibleLeft <= detailsRect.left + leftRadius + EDGE_TOLERANCE;

  const touchesPhysicalRight =
    visibleRight >= detailsRect.right - rightRadius - EDGE_TOLERANCE;

  /*
   * Physical → logical:
   *
   * LTR: inline-start = left,  inline-end = right
   * RTL: inline-start = right, inline-end = left
   */

  const touchesInlineStart = rtl ? touchesPhysicalRight : touchesPhysicalLeft;

  const touchesInlineEnd = rtl ? touchesPhysicalLeft : touchesPhysicalRight;

  root.classList.toggle(CLASSES.bridgeAtInlineStart, touchesInlineStart);

  root.classList.toggle(CLASSES.bridgeAtInlineEnd, touchesInlineEnd);
}

/* ==========================================================================
   Bar Reset
   ========================================================================== */

function resetBar(bar) {
  if (!bar) {
    return;
  }

  bar.style.inlineSize = "0px";

  bar.style.insetInlineStart = "0px";

  bar.style.removeProperty("transform");
}

/* ==========================================================================
   Reset
   ========================================================================== */

function clearBridge(root) {
  const elements = getElements(root);

  if (!elements) {
    return;
  }

  const { bridge, bar } = elements;

  setConnected(root, false);

  clearBridgeEdgeState(root);

  if (bridge) {
    bridge.style.removeProperty("inset-block-start");

    bridge.style.removeProperty("block-size");
  }

  resetBar(bar);
}

/* ==========================================================================
   Block Geometry
   ========================================================================== */

/*
 * Phase 1 writes the bridge block geometry. bridgeInner is measured only
 * after this phase.
 */

function updateBridgeBlockGeometry(elements, cardRect) {
  const { content, details, bridge } = elements;

  if (!content || !details || !bridge) {
    return false;
  }

  const contentRect = content.getBoundingClientRect();

  const detailsRect = details.getBoundingClientRect();

  const bridgeStart = cardRect.bottom - BLOCK_SEAM_OVERLAP;

  const bridgeEnd = detailsRect.top;

  const bridgeHeight = Math.max(0, bridgeEnd - bridgeStart);

  if (bridgeHeight <= 0) {
    return false;
  }

  bridge.style.insetBlockStart = `${bridgeStart - contentRect.top}px`;

  bridge.style.blockSize = `${bridgeHeight}px`;

  return true;
}

/* ==========================================================================
   Inline Geometry
   ========================================================================== */

/*
 * The bar is EXACTLY the visible selected-card width: no inset, shoulder,
 * radius compensation or Details clipping. When it enters an outer Details
 * corner, Details changes only that corner through the edge-state classes.
 */

function updateBridgeInlineGeometry(elements, cardRect) {
  const { root, scroller, inner, bar, detailsContainer } = elements;

  if (!root || !scroller || !inner || !bar) {
    return;
  }

  const scrollerRect = scroller.getBoundingClientRect();

  const innerRect = inner.getBoundingClientRect();

  /*
   * The card can be clipped by the Summary scroller and by the shared
   * Overview bounded container.
   */

  const visibleLeft = Math.max(
    cardRect.left,
    scrollerRect.left,
    innerRect.left,
  );

  const visibleRight = Math.min(
    cardRect.right,
    scrollerRect.right,
    innerRect.right,
  );

  const visibleWidth = Math.max(0, visibleRight - visibleLeft);

  /*
   * The active card may sit outside the visible Summary viewport.
   */

  if (visibleWidth <= INLINE_TOLERANCE) {
    setConnected(root, false);

    clearBridgeEdgeState(root);

    resetBar(bar);

    return;
  }

  const rtl = isRTL(scroller);

  updateBridgeEdgeState(root, {
    visibleLeft,

    visibleRight,

    detailsContainer,

    rtl,
  });

  /*
   * Physical visible edge → logical inline offset.
   */

  const logicalOffset = rtl
    ? innerRect.right - visibleRight
    : visibleLeft - innerRect.left;

  const maximumOffset = Math.max(0, innerRect.width - visibleWidth);

  const resolvedOffset = Math.min(maximumOffset, Math.max(0, logicalOffset));

  bar.style.inlineSize = `${visibleWidth}px`;

  bar.style.insetInlineStart = `${resolvedOffset}px`;

  bar.style.removeProperty("transform");

  setConnected(root, true);
}

/* ==========================================================================
   Bridge Update
   ========================================================================== */

export function updateMarketBridge(root, card = getActiveCard(root)) {
  if (!root || !card) {
    return;
  }

  const elements = getElements(root);

  if (!elements) {
    return;
  }

  const { scroller, content, details, bridge, inner, bar } = elements;

  if (!scroller || !content || !details || !bridge || !inner || !bar) {
    return;
  }

  /*
   * CSS decides whether a bridge exists (variant, open state, breakpoint).
   * Details may also be unrendered during transitions or initialization.
   * Never leave stale geometry or connected state behind.
   */

  if (
    !isElementRendered(bridge) ||
    !isElementRendered(scroller) ||
    !isElementRendered(content) ||
    !isElementRendered(details)
  ) {
    clearBridge(root);

    return;
  }

  const cardRect = card.getBoundingClientRect();

  /* Phase 1: block geometry. */

  if (!updateBridgeBlockGeometry(elements, cardRect)) {
    clearBridge(root);

    return;
  }

  /* Phase 2: inline geometry, only after block geometry is final. */

  updateBridgeInlineGeometry(elements, cardRect);
}

/* ==========================================================================
   Scheduled Updates
   ========================================================================== */

function requestBridgeUpdate(root, card = null) {
  const state = getState(root);

  if (!state) {
    return;
  }

  /*
   * Keep the newest explicit card reference supplied by market:change.
   */

  if (card instanceof Element && root.contains(card)) {
    state.pendingCard = card;
  }

  /*
   * One geometry calculation per animation frame.
   */

  if (state.animationFrame !== null) {
    window.cancelAnimationFrame(state.animationFrame);
  }

  state.animationFrame = window.requestAnimationFrame(() => {
    state.animationFrame = null;

    if (!root.isConnected) {
      return;
    }

    let targetCard = state.pendingCard;

    state.pendingCard = null;

    /*
     * Never use a stale previously selected card.
     */

    if (
      !targetCard ||
      !root.contains(targetCard) ||
      (targetCard.getAttribute("aria-selected") !== "true" &&
        !targetCard.classList.contains(CLASSES.active))
    ) {
      targetCard = getActiveCard(root);
    }

    updateMarketBridge(root, targetCard);
  });
}

function requestAllBridgeUpdates() {
  getRoots().forEach((root) => {
    if (initializedRoots.has(root)) {
      requestBridgeUpdate(root);
    }
  });
}

/*
 * Some disclosure / tab transitions need two layout frames before their
 * final geometry is measurable.
 */

function requestSettledBridgeUpdate(root) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      requestBridgeUpdate(root);
    });
  });
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

  const { scroller, content, details, detailsContainer, inner, cards } =
    state.elements;

  const observer = new ResizeObserver(() => {
    requestBridgeUpdate(root);
  });

  [scroller, content, details, detailsContainer, inner, ...cards]
    .filter(Boolean)
    .forEach((element) => {
      observer.observe(element);
    });

  state.resizeObserver = observer;
}

/* ==========================================================================
   Mutation Observer
   ========================================================================== */

/*
 * market:change is the primary signal. This observer is a fallback for
 * integrations that change aria-selected / .is-active directly, and it
 * follows data-market-details-state on the root, which changes the bridge's
 * CSS visibility.
 */

function initializeMutationObserver(root) {
  if (!("MutationObserver" in window)) {
    return;
  }

  const state = getState(root);

  if (!state) {
    return;
  }

  const observer = new MutationObserver(() => {
    requestBridgeUpdate(root);
  });

  state.elements.cards.forEach((card) => {
    observer.observe(card, {
      attributes: true,

      attributeFilter: ["class", "aria-selected"],
    });
  });

  observer.observe(root, {
    attributes: true,

    attributeFilter: ["data-market-details-state"],
  });

  state.mutationObserver = observer;
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function handleMarketChange(root, event) {
  const card = event.detail?.card;

  requestBridgeUpdate(root, card instanceof Element ? card : null);
}

function handleOverviewChange(root, event) {
  if (!event.detail?.open) {
    clearBridge(root);

    return;
  }

  requestSettledBridgeUpdate(root);
}

function initializeRootEvents(root) {
  const { scroller } = getElements(root);

  scroller?.addEventListener(
    "scroll",
    () => {
      requestBridgeUpdate(root);
    },
    {
      passive: true,
    },
  );

  root.addEventListener(EVENTS.marketChange, (event) => {
    handleMarketChange(root, event);
  });

  root.addEventListener(EVENTS.overviewChange, (event) => {
    handleOverviewChange(root, event);
  });

  /*
   * Visibility, panel, nested tab and mobile disclosure changes can all
   * alter Details geometry.
   */

  [
    EVENTS.detailsShown,
    EVENTS.panelShown,
    EVENTS.tabChange,
    EVENTS.detailsExpanded,
  ].forEach((type) => {
    root.addEventListener(type, () => {
      requestBridgeUpdate(root);
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

  if (
    !elements.scroller ||
    !elements.content ||
    !elements.details ||
    !elements.bridge ||
    !elements.inner ||
    !elements.bar
  ) {
    return;
  }

  rootStates.set(root, {
    elements,

    animationFrame: null,

    pendingCard: null,

    resizeObserver: null,

    mutationObserver: null,
  });

  initializedRoots.add(root);

  initializeResizeObserver(root);

  initializeMutationObserver(root);

  initializeRootEvents(root);

  requestSettledBridgeUpdate(root);
}

/* ==========================================================================
   Preferences
   ========================================================================== */

/*
 * Theme, accent and ticker changes do not affect geometry. A reset
 * (name: null) may change anything.
 */

const GEOMETRY_PREFERENCES = new Set([
  "lang",
  "direction",
  "fontSize",
  "contrast",
]);

function handlePreferenceChange(event) {
  const name = event.detail?.name;

  if (name && !GEOMETRY_PREFERENCES.has(name)) {
    return;
  }

  requestAllBridgeUpdates();
}

/* ==========================================================================
   Document Direction / Language Observer
   ========================================================================== */

/*
 * Protects against integrations that update <html dir> or <html lang>
 * directly instead of dispatching preferencechange.
 */

function initializeDocumentObserver() {
  if (documentObserver || !("MutationObserver" in window)) {
    return;
  }

  documentObserver = new MutationObserver(requestAllBridgeUpdates);

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

  window.addEventListener("load", requestAllBridgeUpdates);

  window.addEventListener("resize", requestAllBridgeUpdates, {
    passive: true,
  });

  document.addEventListener("languagechange", requestAllBridgeUpdates);

  document.addEventListener("preferencechange", handlePreferenceChange);

  initializeDocumentObserver();

  document.fonts?.ready?.then(requestAllBridgeUpdates);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketBridge() {
  const roots = getRoots();

  if (!roots.length) {
    return;
  }

  roots.forEach(initializeRoot);

  initializeGlobalEvents();
}
