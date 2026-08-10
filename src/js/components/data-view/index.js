import { DataViewCard } from "./data-view-card";
import { SELECTORS } from "./constants";

/* ==========================================================================
   Element Collection
   ========================================================================== */

/**
 * Returns expandable data cards contained by `root`.
 *
 * `root` may be:
 *
 * - Document
 * - DocumentFragment
 * - Element
 * - ShadowRoot
 *
 * When the supplied root is itself a data card, it is included.
 */
function getDataViewCards(root) {
  if (!root) return [];

  const elements = [];

  if (typeof root.matches === "function" && root.matches(SELECTORS.card)) {
    elements.push(root);
  }

  if (typeof root.querySelectorAll === "function") {
    elements.push(...root.querySelectorAll(SELECTORS.card));
  }

  return elements;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Progressively enhances expandable data cards inside `root`.
 *
 * Initialization is idempotent.
 */
export function initDataViews(root = document) {
  return getDataViewCards(root)
    .map((element) => DataViewCard.getOrCreateInstance(element))
    .filter(Boolean);
}

/* ==========================================================================
   Refresh
   ========================================================================== */

/**
 * Refreshes existing cards and initializes dynamically added cards.
 */
export function refreshDataViews(root = document) {
  return getDataViewCards(root)
    .map((element) => {
      const instance = DataViewCard.getInstance(element);

      if (!instance) {
        return DataViewCard.getOrCreateInstance(element);
      }

      instance.refresh();

      return instance;
    })
    .filter(Boolean);
}

/* ==========================================================================
   Destruction
   ========================================================================== */

/**
 * Destroys enhanced data cards inside `root`.
 *
 * Returns the number of destroyed instances.
 */
export function destroyDataViews(root = document) {
  let destroyed = 0;

  getDataViewCards(root).forEach((element) => {
    const instance = DataViewCard.getInstance(element);

    if (!instance) return;

    instance.destroy();
    destroyed += 1;
  });

  return destroyed;
}

/* ==========================================================================
   Public Class
   ========================================================================== */

export { DataViewCard };
