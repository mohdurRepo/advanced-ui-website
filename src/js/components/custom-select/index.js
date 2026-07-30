import { CustomSelect } from "./custom-select";
import { SELECTORS } from "./constants";

/* ==========================================================================
   Element Collection
   ========================================================================== */

/**
 * Returns custom-select roots contained by `root`.
 *
 * `root` may be:
 *
 * - Document
 * - DocumentFragment
 * - Element
 * - ShadowRoot
 *
 * When the supplied root is itself a custom select, it is included.
 */

function getCustomSelectElements(root) {
  if (!root) return [];

  const elements = [];

  if (typeof root.matches === "function" && root.matches(SELECTORS.component)) {
    elements.push(root);
  }

  if (typeof root.querySelectorAll === "function") {
    elements.push(...root.querySelectorAll(SELECTORS.component));
  }

  return elements;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Progressively enhances every custom select inside `root`.
 *
 * Initialization is idempotent. Existing instances are returned instead of
 * constructing duplicate interfaces or event listeners.
 *
 * If one component fails, CustomSelect applies `.is-enhancement-failed` to
 * that component and its native fallback remains usable.
 */

export function initCustomSelects(root = document) {
  return getCustomSelectElements(root)
    .map((element) => CustomSelect.getOrCreateInstance(element))
    .filter(Boolean);
}

/* ==========================================================================
   Refresh
   ========================================================================== */

/**
 * Refreshes existing custom selects from their native controls and initializes
 * any matching elements that have not yet been enhanced.
 *
 * Use this after application code:
 *
 * - Adds or removes options
 * - Changes option labels
 * - Changes selected options
 * - Enables or disables options
 * - Adds dynamically rendered custom-select components
 */

export function refreshCustomSelects(root = document) {
  return getCustomSelectElements(root)
    .map((element) => {
      const instance = CustomSelect.getInstance(element);

      if (!instance) {
        return CustomSelect.getOrCreateInstance(element);
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
 * Destroys enhanced instances inside `root` and restores their native selects.
 *
 * Returns the number of instances destroyed.
 */

export function destroyCustomSelects(root = document) {
  let destroyed = 0;

  getCustomSelectElements(root).forEach((element) => {
    const instance = CustomSelect.getInstance(element);

    if (!instance) return;

    instance.destroy();
    destroyed += 1;
  });

  return destroyed;
}

/* ==========================================================================
   Public Class
   ========================================================================== */

export { CustomSelect };
