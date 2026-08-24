import { DataViewCard } from "./data-view-card";
import { DataView } from "./data-view";
import { SELECTORS } from "./constants";

/* ==========================================================================
   Generic View Selectors
   ========================================================================== */

const VIEW_SELECTORS = {
  root: "[data-view-root]",
};

/* ==========================================================================
   Instance State
   ========================================================================== */

let observer = null;

/* ==========================================================================
   Element Collection
   ========================================================================== */

/**
 * Return elements matched inside root, including root itself.
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @param {string} selector
 * @returns {Element[]}
 */
function getElements(root, selector) {
  if (!root) {
    return [];
  }

  const elements = [];

  if (typeof root.matches === "function" && root.matches(selector)) {
    elements.push(root);
  }

  if (typeof root.querySelectorAll === "function") {
    elements.push(...root.querySelectorAll(selector));
  }

  return elements;
}

/**
 * Return expandable mobile data cards.
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @returns {Element[]}
 */
function getDataViewCards(root) {
  return getElements(root, SELECTORS.card);
}

/**
 * Return generic view-switching roots.
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @returns {Element[]}
 */
function getDataViewRoots(root) {
  return getElements(root, VIEW_SELECTORS.root);
}

/* ==========================================================================
   Expandable Card Initialization
   ========================================================================== */

export function initDataViewCards(root = document) {
  return getDataViewCards(root)
    .map((element) => DataViewCard.getOrCreateInstance(element))
    .filter(Boolean);
}

/* ==========================================================================
   View Switcher Initialization
   ========================================================================== */

export function initDataViewSwitchers(root = document) {
  return getDataViewRoots(root)
    .map((element) => DataView.getOrCreateInstance(element))
    .filter(Boolean);
}

/* ==========================================================================
   Combined Initialization
   ========================================================================== */

/**
 * Initialize all reusable data-view behavior.
 */
export function initDataViews(root = document) {
  const cards = initDataViewCards(root);

  const views = initDataViewSwitchers(root);

  return {
    cards,
    views,
  };
}

/* ==========================================================================
   Dynamic Enhancement
   ========================================================================== */

/**
 * Enhance newly inserted Data View content.
 *
 * This allows dynamically rendered cards/views to use the same design-system
 * behavior as markup that existed during initial page load.
 */
function enhanceAddedNode(node) {
  if (!(node instanceof Element)) {
    return;
  }

  initDataViewCards(node);
  initDataViewSwitchers(node);
}

/**
 * Start observing dynamically inserted Data View content.
 *
 * Safe to call multiple times.
 */
export function observeDataViews(root = document.body) {
  if (observer || !root || typeof MutationObserver === "undefined") {
    return observer;
  }

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        enhanceAddedNode(node);
      });
    });
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });

  return observer;
}

/* ==========================================================================
   Observer Destruction
   ========================================================================== */

export function disconnectDataViewObserver() {
  if (!observer) {
    return;
  }

  observer.disconnect();

  observer = null;
}

/* ==========================================================================
   Refresh
   ========================================================================== */

export function refreshDataViews(root = document) {
  const cards = getDataViewCards(root)
    .map((element) => {
      const instance = DataViewCard.getInstance(element);

      if (!instance) {
        return DataViewCard.getOrCreateInstance(element);
      }

      instance.refresh();

      return instance;
    })
    .filter(Boolean);

  const views = getDataViewRoots(root)
    .map((element) => {
      const instance = DataView.getInstance(element);

      if (!instance) {
        return DataView.getOrCreateInstance(element);
      }

      instance.refresh();

      return instance;
    })
    .filter(Boolean);

  return {
    cards,
    views,
  };
}

/* ==========================================================================
   Destruction
   ========================================================================== */

export function destroyDataViews(root = document) {
  let destroyedCards = 0;
  let destroyedViews = 0;

  getDataViewCards(root).forEach((element) => {
    const instance = DataViewCard.getInstance(element);

    if (!instance) {
      return;
    }

    instance.destroy();

    destroyedCards += 1;
  });

  getDataViewRoots(root).forEach((element) => {
    const instance = DataView.getInstance(element);

    if (!instance) {
      return;
    }

    instance.destroy();

    destroyedViews += 1;
  });

  return {
    cards: destroyedCards,

    views: destroyedViews,

    total: destroyedCards + destroyedViews,
  };
}

/* ==========================================================================
   Public Classes
   ========================================================================== */

export { DataView, DataViewCard };
