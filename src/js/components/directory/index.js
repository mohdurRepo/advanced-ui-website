import { DirectoryAlphabet } from "./directory-alphabet";
import { SELECTORS } from "./constants";

/* ==========================================================================
   Element Collection
   ========================================================================== */

/**
 * Return all directory alphabet components contained by `root`.
 *
 * The supplied root may be:
 *
 * - Document
 * - DocumentFragment
 * - Element
 * - ShadowRoot
 *
 * When `root` is itself a directory alphabet, it is included.
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @returns {Element[]}
 */
function getDirectoryAlphabets(root) {
  if (!root) {
    return [];
  }

  const elements = [];

  if (typeof root.matches === "function" && root.matches(SELECTORS.alphabet)) {
    elements.push(root);
  }

  if (typeof root.querySelectorAll === "function") {
    elements.push(...root.querySelectorAll(SELECTORS.alphabet));
  }

  return [...new Set(elements)];
}

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Initialize every directory alphabet contained by `root`.
 *
 * Initialization is idempotent. Existing instances are refreshed instead of
 * being created again.
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @returns {DirectoryAlphabet[]}
 */
export function initDirectories(root = document) {
  return getDirectoryAlphabets(root)
    .map((element) => DirectoryAlphabet.getOrCreateInstance(element))
    .filter(Boolean);
}

/* ==========================================================================
   Refresh
   ========================================================================== */

/**
 * Refresh existing directory alphabets and initialize newly added instances.
 *
 * Use this after:
 *
 * - replacing directory results
 * - loading another result page with AJAX
 * - adding or removing alphabetical groups
 * - updating result counts dynamically
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @returns {DirectoryAlphabet[]}
 */
export function refreshDirectories(root = document) {
  return getDirectoryAlphabets(root)
    .map((element) => {
      const instance = DirectoryAlphabet.getInstance(element);

      if (!instance) {
        return DirectoryAlphabet.getOrCreateInstance(element);
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
 * Destroy every initialized directory alphabet contained by `root`.
 *
 * @param {Document | DocumentFragment | Element | ShadowRoot} root
 * @returns {number}
 */
export function destroyDirectories(root = document) {
  let destroyed = 0;

  getDirectoryAlphabets(root).forEach((element) => {
    const instance = DirectoryAlphabet.getInstance(element);

    if (!instance) {
      return;
    }

    instance.destroy();

    destroyed += 1;
  });

  return destroyed;
}

/* ==========================================================================
   Public API
   ========================================================================== */

export { DirectoryAlphabet };
