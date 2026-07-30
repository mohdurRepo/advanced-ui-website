import { CustomDate } from "./custom-date";
import { SELECTORS } from "./constants";

/* ==========================================================================
   Element Collection
   ========================================================================== */

/**
 * Returns custom-date roots contained by `root`.
 *
 * `root` may be Document, DocumentFragment, Element, or ShadowRoot. When the
 * supplied root is itself a custom-date component, it is included.
 */

function getCustomDateElements(root) {
  if (!root) return [];

  const elements = [];

  if (typeof root.matches === "function" && root.matches(SELECTORS.component)) {
    elements.push(root);
  }

  if (typeof root.querySelectorAll === "function") {
    elements.push(...root.querySelectorAll(SELECTORS.component));
  }

  return [...new Set(elements)];
}

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Progressively enhances every custom-date component inside `root`.
 *
 * Initialization is idempotent. Existing instances are returned rather than
 * initialized again.
 */

export function initCustomDates(root = document) {
  return getCustomDateElements(root)
    .map((element) => CustomDate.getOrCreateInstance(element))
    .filter(Boolean);
}

/* ==========================================================================
   Refresh
   ========================================================================== */

/**
 * Synchronizes existing instances with their native inputs and initializes
 * matching elements that have not yet been enhanced.
 *
 * Use this after application code changes:
 *
 * - native input values;
 * - minimum or maximum dates;
 * - disabled or read-only states;
 * - component constraints;
 * - presets;
 * - language or direction.
 */

export function refreshCustomDates(root = document) {
  return getCustomDateElements(root)
    .map((element) => {
      const instance = CustomDate.getInstance(element);

      if (!instance) {
        return CustomDate.getOrCreateInstance(element);
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
 * Destroys enhanced instances inside `root` and restores their native date
 * inputs.
 *
 * Returns the number of instances destroyed.
 */

export function destroyCustomDates(root = document) {
  let destroyed = 0;

  getCustomDateElements(root).forEach((element) => {
    const instance = CustomDate.getInstance(element);

    if (!instance) return;

    instance.destroy();
    destroyed += 1;
  });

  return destroyed;
}

/* ==========================================================================
   Close Active Date
   ========================================================================== */

/**
 * Closes the currently open custom-date component, if one exists.
 */

export function closeCustomDate() {
  return CustomDate.closeActive();
}

/* ==========================================================================
   Public Class
   ========================================================================== */

export { CustomDate };
