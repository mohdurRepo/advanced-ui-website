/* ==========================================================================
   Market Bridge
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-overview]",
  summary: "[data-market-summary]",
  content: ".market-overview__details-content",
  details: "[data-market-overview-details]",

  scroller: "[data-market-tabs]",
  card: "[data-market-card]",

  bridge: "[data-market-bridge]",
  bridgeInner: ".market-bridge__inner",
  bridgeBar: "[data-market-bridge-bar]",
};

const CLASSES = {
  active: "is-active",
};

const INLINE_TOLERANCE = 0.5;
const BLOCK_SEAM_OVERLAP = 1;

const initializedRoots = new WeakSet();
const animationFrames = new WeakMap();
const resizeObservers = new WeakMap();
const mutationObservers = new WeakMap();

let globalEventsInitialized = false;

/* ==========================================================================
   Elements
   ========================================================================== */

function getRoots() {
  return Array.from(document.querySelectorAll(SELECTORS.root));
}

function getElements(root) {
  const summary = root?.querySelector(SELECTORS.summary);
  const content = root?.querySelector(SELECTORS.content);
  const details = root?.querySelector(SELECTORS.details);
  const bridge = root?.querySelector(SELECTORS.bridge);

  return {
    root,
    summary,
    content,
    details,

    scroller: summary?.querySelector(SELECTORS.scroller) || null,

    bridge,

    inner: bridge?.querySelector(SELECTORS.bridgeInner) || null,

    bar: bridge?.querySelector(SELECTORS.bridgeBar) || null,
  };
}

function getActiveCard(root) {
  if (!root) return null;

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
  return getComputedStyle(element).direction === "rtl";
}

function isElementRendered(element) {
  return Boolean(
    element &&
    element.getClientRects().length &&
    element.getBoundingClientRect().width,
  );
}

/* ==========================================================================
   Reset
   ========================================================================== */

function clearBridge(root) {
  const { bridge, bar } = getElements(root);

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

function updateBridgeBlockGeometry(elements, cardRect) {
  const { content, details, bridge } = elements;

  if (!content || !details || !bridge) return false;

  const contentRect = content.getBoundingClientRect();
  const detailsRect = details.getBoundingClientRect();

  /*
   * Begin one pixel inside the active card to eliminate antialiasing or
   * fractional-pixel seams.
   */
  const bridgeStart = cardRect.bottom - BLOCK_SEAM_OVERLAP;

  const bridgeEnd = detailsRect.top;

  const bridgeHeight = Math.max(0, bridgeEnd - bridgeStart);

  if (bridgeHeight <= 0) return false;

  /*
   * Both properties are logical block-axis properties and therefore remain
   * valid regardless of document direction.
   */
  bridge.style.insetBlockStart = `${bridgeStart - contentRect.top}px`;

  bridge.style.blockSize = `${bridgeHeight}px`;

  return true;
}

/* ==========================================================================
   Inline Geometry
   ========================================================================== */

function updateBridgeInlineGeometry(elements, cardRect) {
  const { scroller, inner, bar } = elements;

  if (!scroller || !inner || !bar) return;

  const scrollerRect = scroller.getBoundingClientRect();
  const innerRect = inner.getBoundingClientRect();

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

  if (visibleWidth <= INLINE_TOLERANCE) {
    bar.style.inlineSize = "0px";
    return;
  }

  const logicalOffset = isRTL(scroller)
    ? innerRect.right - visibleRight
    : visibleLeft - innerRect.left;

  const maximumOffset = Math.max(0, innerRect.width - visibleWidth);

  const resolvedOffset = Math.min(maximumOffset, Math.max(0, logicalOffset));

  bar.style.inlineSize = `${visibleWidth}px`;
  bar.style.insetInlineStart = `${resolvedOffset}px`;
  bar.style.removeProperty("transform");
}

/* ==========================================================================
   Bridge Update
   ========================================================================== */

export function updateMarketBridge(root, card = getActiveCard(root)) {
  const elements = getElements(root);

  const { scroller, content, details, bridge, inner, bar } = elements;

  if (
    !root ||
    !card ||
    !scroller ||
    !content ||
    !details ||
    !bridge ||
    !inner ||
    !bar
  ) {
    return;
  }

  if (
    !isElementRendered(scroller) ||
    !isElementRendered(content) ||
    !isElementRendered(details)
  ) {
    clearBridge(root);
    return;
  }

  const cardRect = card.getBoundingClientRect();

  const hasBlockGeometry = updateBridgeBlockGeometry(elements, cardRect);

  if (!hasBlockGeometry) {
    clearBridge(root);
    return;
  }

  /*
   * Reading the inner rectangle after applying the bridge block dimensions
   * ensures the measurement represents its final rendered geometry.
   */
  updateBridgeInlineGeometry(elements, cardRect);
}

/* ==========================================================================
   Scheduled Updates
   ========================================================================== */

function requestBridgeUpdate(root, card = getActiveCard(root)) {
  if (!root) return;

  const currentFrame = animationFrames.get(root);

  if (currentFrame !== undefined) {
    window.cancelAnimationFrame(currentFrame);
  }

  const frame = window.requestAnimationFrame(() => {
    updateMarketBridge(root, card);
    animationFrames.delete(root);
  });

  animationFrames.set(root, frame);
}

function requestAllBridgeUpdates() {
  getRoots().forEach((root) => {
    requestBridgeUpdate(root);
  });
}

/* ==========================================================================
   Observers
   ========================================================================== */

function initializeResizeObserver(root) {
  if (!("ResizeObserver" in window)) return;

  const { scroller, content, details, inner } = getElements(root);

  const observer = new ResizeObserver(() => {
    requestBridgeUpdate(root);
  });

  [scroller, content, details, inner].filter(Boolean).forEach((element) => {
    observer.observe(element);
  });

  root.querySelectorAll(SELECTORS.card).forEach((card) => {
    observer.observe(card);
  });

  resizeObservers.set(root, observer);
}

function initializeMutationObserver(root) {
  if (!("MutationObserver" in window)) return;

  const observer = new MutationObserver(() => {
    requestBridgeUpdate(root);
  });

  root.querySelectorAll(SELECTORS.card).forEach((card) => {
    observer.observe(card, {
      attributes: true,
      attributeFilter: ["class", "aria-selected"],
    });
  });

  mutationObservers.set(root, observer);
}

/* ==========================================================================
   Root Events
   ========================================================================== */

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

  root.addEventListener("market:change", (event) => {
    requestBridgeUpdate(root, event.detail?.card || getActiveCard(root));
  });

  root.addEventListener("market:overviewchange", (event) => {
    if (!event.detail?.open) {
      clearBridge(root);
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        requestBridgeUpdate(root);
      });
    });
  });

  root.addEventListener("market:detailsshown", () => {
    requestBridgeUpdate(root);
  });

  root.addEventListener("market:panelshown", () => {
    requestBridgeUpdate(root);
  });
}

/* ==========================================================================
   Root Initialization
   ========================================================================== */

function initializeRoot(root) {
  if (initializedRoots.has(root)) return;

  const { scroller, bridge, inner, bar } = getElements(root);

  if (!scroller || !bridge || !inner || !bar) return;

  initializedRoots.add(root);

  initializeResizeObserver(root);
  initializeMutationObserver(root);
  initializeRootEvents(root);

  requestBridgeUpdate(root);
}

/* ==========================================================================
   Preferences
   ========================================================================== */

function handlePreferenceChange(event) {
  const relevantPreferences = ["lang", "fontSize", "contrast", "motion"];

  if (event.detail?.name && !relevantPreferences.includes(event.detail.name)) {
    return;
  }

  requestAllBridgeUpdates();
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function initializeGlobalEvents() {
  if (globalEventsInitialized) return;

  globalEventsInitialized = true;

  window.addEventListener("load", requestAllBridgeUpdates);

  window.addEventListener("resize", requestAllBridgeUpdates);

  document.addEventListener("languagechange", requestAllBridgeUpdates);

  document.addEventListener("preferencechange", handlePreferenceChange);

  document.fonts?.ready?.then(() => {
    requestAllBridgeUpdates();
  });
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketBridge() {
  getRoots().forEach(initializeRoot);

  initializeGlobalEvents();
}
