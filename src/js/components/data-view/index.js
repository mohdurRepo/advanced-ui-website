/* ==========================================================================
   Data View
   ========================================================================== */

/* ==========================================================================
   Imports
   ========================================================================== */

import { DataViewCard } from "./data-view-card";

import { DataView } from "./data-view";

import { SELECTORS } from "./constants";

/* ==========================================================================
   Generic View Selectors
   ========================================================================== */

const VIEW_SELECTORS = Object.freeze({
  root: "[data-view-root]",
});

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
  if (!root || !selector) {
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

/* ==========================================================================
   Data Card Validation
   ========================================================================== */

/**
 * Return the first matching element owned directly by a card.
 *
 * This prevents a parent card from accidentally using the toggle or details
 * region belonging to a nested card.
 *
 * @param {Element} card
 * @param {string} selector
 * @returns {Element | null}
 */
function getOwnedCardElement(card, selector) {
  if (!(card instanceof Element)) {
    return null;
  }

  const element = card.querySelector(selector);

  if (!(element instanceof Element)) {
    return null;
  }

  return element.closest(SELECTORS.card) === card ? element : null;
}

/**
 * Determine whether a card satisfies the expandable DataViewCard contract.
 *
 * Every enhanced card must contain:
 *
 * - one owned toggle
 * - one owned details region
 *
 * Static cards intentionally do not participate in this lifecycle.
 *
 * @param {Element} card
 * @returns {boolean}
 */
function isExpandableDataCard(card) {
  return Boolean(
    getOwnedCardElement(card, SELECTORS.toggle) &&
    getOwnedCardElement(card, SELECTORS.details),
  );
}

/* ==========================================================================
   Data Card Collection
   ========================================================================== */

/**
 * Return all elements carrying the DataViewCard behavior hook.
 *
 * This unfiltered collection is used during destruction so an existing
 * instance can still be destroyed if its markup later becomes incomplete.
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @returns {Element[]}
 */
function getDataViewCardElements(root) {
  return getElements(root, SELECTORS.card);
}

/**
 * Return only cards that satisfy the complete expandable-card contract.
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @returns {Element[]}
 */
function getExpandableDataViewCards(root) {
  return getDataViewCardElements(root).filter(isExpandableDataCard);
}

/* ==========================================================================
   Generic View Collection
   ========================================================================== */

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
   Invalid Instance Cleanup
   ========================================================================== */

/**
 * Destroy an existing DataViewCard instance when its required markup has
 * subsequently been removed.
 *
 * New invalid markup is simply ignored. Existing enhanced markup is cleaned
 * up safely to prevent stale event listeners.
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @returns {number}
 */
function destroyInvalidDataViewCardInstances(root) {
  let destroyed = 0;

  getDataViewCardElements(root).forEach((element) => {
    if (isExpandableDataCard(element)) {
      return;
    }

    const instance = DataViewCard.getInstance(element);

    if (!instance) {
      return;
    }

    instance.destroy();

    destroyed += 1;
  });

  return destroyed;
}

/* ==========================================================================
   Expandable Card Initialization
   ========================================================================== */

export function initDataViewCards(root = document) {
  destroyInvalidDataViewCardInstances(root);

  return getExpandableDataViewCards(root)
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
 *
 * This preserves the public initializer used by main.js.
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
   Refresh
   ========================================================================== */

/**
 * Enhance dynamically rendered data-view content.
 *
 * Only complete expandable cards are initialized. Static cards and incomplete
 * behavior markup are ignored.
 */
export function refreshDataViews(root = document) {
  destroyInvalidDataViewCardInstances(root);

  const cards = getExpandableDataViewCards(root)
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

  /*
   * Use the unfiltered card collection so instances remain destroyable even
   * when their required child markup was removed before destruction.
   */

  getDataViewCardElements(root).forEach((element) => {
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
