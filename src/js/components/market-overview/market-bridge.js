/* ==========================================================================
   Market Bridge
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Connect the active Summary market card to Market Details.
 * - Maintain bridge block geometry between the card and Details.
 * - Match the bridge bar exactly to the visible portion of the active card.
 * - Publish logical Details-edge states when the bridge reaches a rounded
 *   Details corner.
 * - Support horizontal Summary scrolling.
 * - Support LTR and RTL layouts.
 * - Refresh after market / panel / tab / disclosure changes.
 * - Refresh after resize, fonts and relevant preference changes.
 *
 * Important:
 *
 * Bridge block dimensions MUST be applied before measuring bridgeInner.
 * bridgeInner depends on the bridge's final rendered block dimensions.
 *
 * This module does NOT own:
 *
 * - market selection;
 * - Summary scrolling behavior;
 * - Details visibility;
 * - panel selection;
 * - nested tab selection;
 * - mobile disclosure state;
 * - bridge visual styling;
 * - Details border-radius styling.
 */

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

/*
 * Small tolerance for fractional-pixel layout differences.
 */

const EDGE_TOLERANCE = 1.5;

/*
 * Begin the bridge one physical pixel inside the selected card.
 *
 * This prevents fractional / antialiasing seams between card and connector.
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

  const content = root.querySelector(SELECTORS.content);

  const details = root.querySelector(SELECTORS.details);

  const detailsContainer = root.querySelector(SELECTORS.detailsContainer);

  const bridge = root.querySelector(SELECTORS.bridge);

  const scroller = summary?.querySelector(SELECTORS.scroller) || null;

  const inner = bridge?.querySelector(SELECTORS.bridgeInner) || null;

  const bar = bridge?.querySelector(SELECTORS.bridgeBar) || null;

  const cards = Array.from(root.querySelectorAll(SELECTORS.card));

  return {
    root,

    summary,

    content,

    details,

    detailsContainer,

    scroller,

    cards,

    bridge,

    inner,

    bar,
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

function isRTL(element) {
  if (!element) {
    return false;
  }

  return window.getComputedStyle(element).direction === "rtl";
}

function isElementRendered(element) {
  return Boolean(
    element &&
    element.isConnected &&
    element.getClientRects().length &&
    element.getBoundingClientRect().width,
  );
}

function getPixelLength(element, property) {
  if (!element) {
    return 0;
  }

  const value = window.getComputedStyle(element).getPropertyValue(property);

  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? number : 0;
}

/* ==========================================================================
   Bridge Edge State
   ========================================================================== */

/*
 * CSS owns the actual Details corner radius.
 *
 * JS publishes only state:
 *
 * - .is-bridge-at-inline-start
 * - .is-bridge-at-inline-end
 *
 * The decision is based on whether the connector has entered the physical
 * rounded-corner zone of the real Details container.
 */

function clearBridgeEdgeState(root) {
  if (!root) {
    return;
  }

  root.classList.remove(CLASSES.bridgeAtInlineStart, CLASSES.bridgeAtInlineEnd);
}

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
   * Read the actual horizontal radius used by the rendered Details surface.
   *
   * parseFloat() intentionally takes the first value if the browser reports
   * an elliptical radius such as "12px 12px".
   */

  const leftRadius = getPixelLength(detailsContainer, "border-top-left-radius");

  const rightRadius = getPixelLength(
    detailsContainer,
    "border-top-right-radius",
  );

  /*
   * Do NOT wait until the connector reaches the extreme outer edge.
   *
   * A rounded corner occupies an inline zone BEFORE that edge.
   *
   * Flatten the matching Details corner as soon as the bridge enters that
   * corner-radius zone.
   */

  const touchesPhysicalLeft =
    visibleLeft <= detailsRect.left + leftRadius + EDGE_TOLERANCE;

  const touchesPhysicalRight =
    visibleRight >= detailsRect.right - rightRadius - EDGE_TOLERANCE;

  /*
   * Convert physical geometry into logical state.
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

  const touchesInlineStart = rtl ? touchesPhysicalRight : touchesPhysicalLeft;

  const touchesInlineEnd = rtl ? touchesPhysicalLeft : touchesPhysicalRight;

  root.classList.toggle(CLASSES.bridgeAtInlineStart, touchesInlineStart);

  root.classList.toggle(CLASSES.bridgeAtInlineEnd, touchesInlineEnd);
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

  clearBridgeEdgeState(root);

  if (bridge) {
    bridge.style.removeProperty("inset-block-start");

    bridge.style.removeProperty("block-size");
  }

  if (bar) {
    bar.style.inlineSize = "0px";

    bar.style.insetInlineStart = "0px";

    bar.style.removeProperty("transform");
  }
}

/* ==========================================================================
   Block Geometry
   ========================================================================== */

/*
 * IMPORTANT:
 *
 * Phase 1 writes the bridge block geometry.
 *
 * bridgeInner must be measured only AFTER this phase because its rendered
 * geometry depends on the bridge's final dimensions.
 */

function updateBridgeBlockGeometry(elements, cardRect) {
  const { content, details, bridge } = elements;

  if (!content || !details || !bridge) {
    return false;
  }

  const contentRect = content.getBoundingClientRect();

  const detailsRect = details.getBoundingClientRect();

  /*
   * Begin one physical pixel inside the active card.
   */

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
 * Bridge width must remain EXACTLY equal to the visible selected-card width.
 *
 * Deliberately no:
 *
 * - inset;
 * - shoulder;
 * - radius compensation;
 * - Details clipping.
 *
 * If the bridge enters an outer Details corner, the Details component changes
 * only that corner through the logical edge-state classes published here.
 */

function updateBridgeInlineGeometry(elements, cardRect) {
  const { root, scroller, inner, bar, detailsContainer } = elements;

  if (!root || !scroller || !inner || !bar) {
    return;
  }

  /*
   * Measure bridgeInner only after block geometry has been applied.
   */

  const scrollerRect = scroller.getBoundingClientRect();

  const innerRect = inner.getBoundingClientRect();

  /*
   * Resolve the physically visible portion of the selected card.
   *
   * The card can be clipped by:
   *
   * - the Summary horizontal scroller;
   * - the shared Overview bounded container.
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
   * Active card may temporarily sit outside the visible Summary viewport.
   *
   * Hide only the connector bar and clear edge state.
   */

  if (visibleWidth <= INLINE_TOLERANCE) {
    clearBridgeEdgeState(root);

    bar.style.inlineSize = "0px";

    bar.style.insetInlineStart = "0px";

    bar.style.removeProperty("transform");

    return;
  }

  const rtl = isRTL(scroller);

  /* -----------------------------------------------------------------------
     Details Corner State
     -------------------------------------------------------------------- */

  updateBridgeEdgeState(root, {
    visibleLeft,

    visibleRight,

    detailsContainer,

    rtl,
  });

  /* -----------------------------------------------------------------------
     Logical Position
     -------------------------------------------------------------------- */

  /*
   * getBoundingClientRect() uses physical coordinates.
   *
   * Convert the selected-card visible edge into logical inline positioning.
   */

  const logicalOffset = rtl
    ? innerRect.right - visibleRight
    : visibleLeft - innerRect.left;

  const maximumOffset = Math.max(0, innerRect.width - visibleWidth);

  const resolvedOffset = Math.min(
    maximumOffset,

    Math.max(0, logicalOffset),
  );

  /*
   * Exact selected-card alignment.
   */

  bar.style.inlineSize = `${visibleWidth}px`;

  bar.style.insetInlineStart = `${resolvedOffset}px`;

  /*
   * Remove stale geometry from earlier bridge implementations.
   */

  bar.style.removeProperty("transform");
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
   * Details may temporarily be unrendered during:
   *
   * - disclosure transitions;
   * - responsive layout changes;
   * - initialization.
   *
   * Never leave stale bridge geometry or Details edge state behind.
   */

  if (
    !isElementRendered(scroller) ||
    !isElementRendered(content) ||
    !isElementRendered(details)
  ) {
    clearBridge(root);

    return;
  }

  const cardRect = card.getBoundingClientRect();

  /*
   * Phase 1:
   *
   * Establish bridge block geometry.
   */

  const hasBlockGeometry = updateBridgeBlockGeometry(elements, cardRect);

  if (!hasBlockGeometry) {
    clearBridge(root);

    return;
  }

  /*
   * Phase 2:
   *
   * Resolve inline geometry only after bridge block geometry is final.
   */

  updateBridgeInlineGeometry(elements, cardRect);
}

/* ==========================================================================
   Scheduled Updates
   ========================================================================== */

function requestBridgeUpdate(root, card = null) {
  if (!root) {
    return;
  }

  const state = getState(root);

  if (!state) {
    return;
  }

  /*
   * Preserve the newest explicit card reference supplied by market:change.
   */

  if (card instanceof Element && root.contains(card)) {
    state.pendingCard = card;
  }

  /*
   * Collapse rapid updates into one geometry calculation per animation frame.
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

/* ==========================================================================
   All Roots
   ========================================================================== */

function requestAllBridgeUpdates() {
  getRoots().forEach((root) => {
    if (initializedRoots.has(root)) {
      requestBridgeUpdate(root);
    }
  });
}

/* ==========================================================================
   Settled Update
   ========================================================================== */

/*
 * Some disclosure / tab transitions require two layout frames before their
 * final geometry is measurable.
 */

function requestSettledBridgeUpdate(root) {
  if (!root) {
    return;
  }

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

  [scroller, content, details, detailsContainer, inner]
    .filter(Boolean)
    .forEach((element) => {
      observer.observe(element);
    });

  cards.forEach((card) => {
    observer.observe(card);
  });

  state.resizeObserver = observer;
}

/* ==========================================================================
   Mutation Observer
   ========================================================================== */

/*
 * market:change is the primary synchronization signal.
 *
 * This observer remains as a defensive compatibility fallback for another
 * integration directly changing:
 *
 * - aria-selected;
 * - .is-active.
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

  state.mutationObserver = observer;
}

/* ==========================================================================
   Summary Scroll
   ========================================================================== */

function initializeScrollerEvent(root) {
  const elements = getElements(root);

  if (!elements?.scroller) {
    return;
  }

  elements.scroller.addEventListener(
    "scroll",
    () => {
      requestBridgeUpdate(root);
    },
    {
      passive: true,
    },
  );
}

/* ==========================================================================
   Market Selection
   ========================================================================== */

function handleMarketChange(root, event) {
  const card = event.detail?.card;

  requestBridgeUpdate(
    root,

    card instanceof Element ? card : getActiveCard(root),
  );
}

/* ==========================================================================
   Overview Visibility
   ========================================================================== */

function handleOverviewChange(root, event) {
  const open = Boolean(event.detail?.open);

  if (!open) {
    clearBridge(root);

    return;
  }

  requestSettledBridgeUpdate(root);
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function initializeRootEvents(root) {
  initializeScrollerEvent(root);

  root.addEventListener(EVENTS.marketChange, (event) => {
    handleMarketChange(root, event);
  });

  root.addEventListener(EVENTS.overviewChange, (event) => {
    handleOverviewChange(root, event);
  });

  root.addEventListener(EVENTS.detailsShown, () => {
    requestBridgeUpdate(root);
  });

  root.addEventListener(EVENTS.panelShown, () => {
    requestBridgeUpdate(root);
  });

  /*
   * Nested view changes may alter Details dimensions.
   */

  root.addEventListener(EVENTS.tabChange, () => {
    requestBridgeUpdate(root);
  });

  /*
   * Mobile disclosure can alter Details dimensions.
   */

  root.addEventListener(EVENTS.detailsExpanded, () => {
    requestBridgeUpdate(root);
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
    !elements ||
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

function handlePreferenceChange(event) {
  const relevantPreferences = [
    "lang",
    "direction",
    "fontSize",
    "contrast",
    "motion",
  ];

  if (event.detail?.name && !relevantPreferences.includes(event.detail.name)) {
    return;
  }

  requestAllBridgeUpdates();
}

/* ==========================================================================
   Document Direction / Language Observer
   ========================================================================== */

/*
 * preferencechange remains the preferred application integration.
 *
 * This observer protects against integrations that update <html dir> or
 * <html lang> directly.
 */

function initializeDocumentObserver() {
  if (documentObserver || !("MutationObserver" in window)) {
    return;
  }

  documentObserver = new MutationObserver((mutations) => {
    const relevantChange = mutations.some(
      (mutation) =>
        mutation.type === "attributes" &&
        (mutation.attributeName === "dir" || mutation.attributeName === "lang"),
    );

    if (!relevantChange) {
      return;
    }

    requestAllBridgeUpdates();
  });

  documentObserver.observe(document.documentElement, {
    attributes: true,

    attributeFilter: ["dir", "lang"],
  });
}

/* ==========================================================================
   Fonts
   ========================================================================== */

function initializeFontRefresh() {
  const ready = document.fonts?.ready;

  if (!ready) {
    return;
  }

  ready.then(() => {
    requestAllBridgeUpdates();
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

  initializeFontRefresh();
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
