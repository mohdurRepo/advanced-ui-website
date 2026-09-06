/* ==========================================================================
   Market Panels
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Synchronize the selected Summary market with its Details panel.
 * - Resolve panels primarily through the card's aria-controls relationship.
 * - Maintain panel hidden / aria-hidden / inert state.
 * - Maintain the panel's visual active class.
 * - Reset newly activated panel scroll position.
 * - Publish market:panelshown for bridge/chart/layout consumers.
 * - Provide a temporary resize compatibility signal after layout settles.
 *
 * This module does NOT own:
 *
 * - Summary card selection.
 * - Summary keyboard navigation.
 * - Nested market-view tabs.
 * - Movers tabs.
 * - Mobile Details expansion.
 * - Bridge geometry.
 * - Chart initialization.
 */

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-overview]",

  card: "[data-market-card]",

  panel: "[data-market-detail-panel]",
};

/* ==========================================================================
   Classes
   ========================================================================== */

const CLASSES = {
  active: "is-active",
};

/* ==========================================================================
   Events
   ========================================================================== */

const EVENTS = {
  marketChange: "market:change",

  panelShown: "market:panelshown",
};

/* ==========================================================================
   State
   ========================================================================== */

const initializedRoots = new WeakSet();

const rootStates = new WeakMap();

/* ==========================================================================
   Elements
   ========================================================================== */

function collectElements(root) {
  if (!root) {
    return null;
  }

  const cards = Array.from(root.querySelectorAll(SELECTORS.card));

  const panels = Array.from(root.querySelectorAll(SELECTORS.panel));

  if (!cards.length || !panels.length) {
    return null;
  }

  return {
    root,
    cards,
    panels,
  };
}

function getState(root) {
  return rootStates.get(root) || null;
}

function getElements(root) {
  return getState(root)?.elements ?? null;
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function escapeId(value) {
  if (!value) {
    return "";
  }

  if (window.CSS?.escape) {
    return CSS.escape(value);
  }

  /*
   * IDs in this component are controlled application IDs such as:
   *
   * market-panel-tasi
   *
   * This fallback simply protects the common CSS-selector special
   * characters should CSS.escape be unavailable.
   */

  return String(value).replace(
    /([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,
    "\\$1",
  );
}

function isPanelActive(panel) {
  return Boolean(
    panel &&
    (panel.classList.contains(CLASSES.active) ||
      panel.getAttribute("aria-hidden") === "false"),
  );
}

/* ==========================================================================
   Active Card
   ========================================================================== */

function getActiveCard(elements) {
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

/* ==========================================================================
   Panel Resolution
   ========================================================================== */

function getPanelById(elements, panelId) {
  if (!elements || !panelId) {
    return null;
  }

  /*
   * Prefer the already-collected panels rather than a document-global query.
   */

  return elements.panels.find((panel) => panel.id === panelId) || null;
}

function getPanelByMarket(elements, market) {
  if (!elements || !market) {
    return null;
  }

  return (
    elements.panels.find((panel) => panel.dataset.market === market) || null
  );
}

function getPanelForCard(elements, card) {
  if (!elements || !card) {
    return null;
  }

  /*
   * Primary relationship:
   *
   * aria-controls="market-panel-tasi"
   */

  const panelId = card.getAttribute("aria-controls");

  const controlledPanel = getPanelById(elements, panelId);

  if (controlledPanel) {
    return controlledPanel;
  }

  /*
   * Defensive fallback:
   *
   * both card and panel currently expose the same data-market code.
   */

  return getPanelByMarket(elements, card.dataset.market);
}

/* ==========================================================================
   Existing Active Panel
   ========================================================================== */

function getActivePanel(elements) {
  if (!elements) {
    return null;
  }

  return elements.panels.find(isPanelActive) || null;
}

/* ==========================================================================
   Panel Accessibility
   ========================================================================== */

function setPanelState(panel, active) {
  if (!panel) {
    return;
  }

  panel.classList.toggle(CLASSES.active, active);

  panel.hidden = !active;

  panel.setAttribute("aria-hidden", String(!active));

  /*
   * Prevent hidden panels from exposing interactive descendants.
   */

  if ("inert" in panel) {
    panel.inert = !active;
  }
}

/* ==========================================================================
   Scroll Reset
   ========================================================================== */

function resetPanelScroll(panel) {
  if (!panel) {
    return;
  }

  /*
   * A newly selected market should begin at its logical start rather than
   * inheriting a previous scroll position.
   */

  panel.scrollTop = 0;

  panel.scrollLeft = 0;

  /*
   * Nested scroll areas that are already active should also begin at their
   * start. This is especially relevant to desktop Movers when it contains
   * more rows than the fixed Details canvas.
   */

  panel
    .querySelectorAll(
      [
        ".market-movers__panel.is-active",
        '.market-movers__panel[aria-hidden="false"]',
      ].join(","),
    )
    .forEach((scroller) => {
      scroller.scrollTop = 0;

      scroller.scrollLeft = 0;
    });
}

/* ==========================================================================
   Panel Event
   ========================================================================== */

function dispatchPanelShown(elements, card, panel) {
  if (!elements || !panel) {
    return;
  }

  const { root } = elements;

  panel.dispatchEvent(
    new CustomEvent(EVENTS.panelShown, {
      bubbles: true,

      detail: {
        root,

        card,

        panel,

        market: panel.dataset.market || card?.dataset.market || null,

        panelId: panel.id || null,
      },
    }),
  );
}

/* ==========================================================================
   Settled Layout Refresh
   ========================================================================== */

function requestSettledRefresh(elements, card, panel) {
  if (!elements || !panel) {
    return;
  }

  const { root } = elements;

  const state = getState(root);

  if (!state) {
    return;
  }

  /*
   * Cancel any pending refresh from a very fast market change.
   */

  if (state.refreshFrame !== null) {
    window.cancelAnimationFrame(state.refreshFrame);
  }

  state.refreshFrame = window.requestAnimationFrame(() => {
    state.refreshFrame = window.requestAnimationFrame(() => {
      state.refreshFrame = null;

      if (!root.isConnected || panel.hidden) {
        return;
      }

      /*
       * Notify layout-dependent consumers only after the newly
       * activated panel has received final dimensions.
       */

      dispatchPanelShown(elements, card, panel);

      /*
       * Temporary compatibility signal.
       *
       * Existing chart code may still use resize as its reflow
       * trigger. Remove this once chart refresh is event-driven.
       */

      window.dispatchEvent(new Event("resize"));
    });
  });
}

/* ==========================================================================
   Activate Panel
   ========================================================================== */

function activatePanel(
  elements,
  card,
  { force = false, resetScroll = true, refresh = true } = {},
) {
  if (!elements || !card) {
    return false;
  }

  const panel = getPanelForCard(elements, card);

  if (!panel) {
    return false;
  }

  const currentPanel = getActivePanel(elements);

  /*
   * Avoid unnecessary DOM writes for repeated market:change events.
   *
   * `force` is used during initialization to normalize potentially stale
   * server-rendered state.
   */

  if (
    !force &&
    currentPanel === panel &&
    !panel.hidden &&
    panel.getAttribute("aria-hidden") === "false"
  ) {
    return false;
  }

  elements.panels.forEach((candidate) => {
    setPanelState(candidate, candidate === panel);
  });

  if (resetScroll) {
    resetPanelScroll(panel);
  }

  const state = getState(elements.root);

  if (state) {
    state.activePanel = panel;

    state.activeCard = card;
  }

  if (refresh) {
    requestSettledRefresh(elements, card, panel);
  }

  return true;
}

/* ==========================================================================
   Market Change
   ========================================================================== */

function handleMarketChange(elements, event) {
  if (!elements) {
    return;
  }

  /*
   * market-summary.js dispatches this event from the selected card.
   *
   * Prefer event.detail.card, then the bubbling event target, then the
   * currently selected card as defensive fallbacks.
   */

  const detailCard = event.detail?.card;

  const targetCard = event.target?.closest?.(SELECTORS.card);

  const card =
    detailCard instanceof Element && elements.root.contains(detailCard)
      ? detailCard
      : targetCard instanceof Element && elements.root.contains(targetCard)
        ? targetCard
        : getActiveCard(elements);

  if (!card) {
    return;
  }

  activatePanel(elements, card);
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function initializeRootEvents(elements) {
  const { root } = elements;

  root.addEventListener(EVENTS.marketChange, (event) => {
    handleMarketChange(elements, event);
  });
}

/* ==========================================================================
   Initial State
   ========================================================================== */

function initializePanelState(elements) {
  const card = getActiveCard(elements);

  if (!card) {
    return;
  }

  /*
   * Normalize initial HTML state without relying on whichever panel happens
   * to have an initial `.is-active` class.
   *
   * The selected card remains the source of truth.
   */

  activatePanel(elements, card, {
    force: true,

    resetScroll: false,

    /*
     * Defer one settled event so modules initialized later in the same
     * application bootstrap — especially the bridge — can observe it.
     */

    refresh: true,
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

  if (!elements) {
    return;
  }

  rootStates.set(root, {
    elements,

    activeCard: null,

    activePanel: null,

    refreshFrame: null,
  });

  initializedRoots.add(root);

  /*
   * Register the listener before normalizing initial state.
   */

  initializeRootEvents(elements);

  initializePanelState(elements);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketPanels() {
  const roots = document.querySelectorAll(SELECTORS.root);

  if (!roots.length) {
    return;
  }

  roots.forEach((root) => {
    initializeRoot(root);
  });
}
