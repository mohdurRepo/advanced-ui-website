import { CustomDate } from "./custom-date";
import { SELECTORS } from "./constants";

/* ==========================================================================
   Observer Registry
   ========================================================================== */

/**
 * Stores one MutationObserver per document.
 *
 * WeakMap prevents duplicate observers and allows documents to be garbage
 * collected naturally when no longer in use.
 */
const observers = new WeakMap();

/* ==========================================================================
   Document Resolution
   ========================================================================== */

/**
 * Returns the Document associated with `root`.
 *
 * Supported roots include:
 *
 * - Document
 * - DocumentFragment
 * - Element
 * - ShadowRoot
 */
function getDocumentReference(root) {
  if (!root) {
    return typeof document !== "undefined" ? document : null;
  }

  /*
   * Document.nodeType === 9
   */
  if (root.nodeType === 9) {
    return root;
  }

  return root.ownerDocument || null;
}

/* ==========================================================================
   Element Collection
   ========================================================================== */

/**
 * Returns custom-date roots contained by `root`.
 *
 * `root` may be Document, DocumentFragment, Element, or ShadowRoot.
 *
 * When the supplied root is itself a custom-date component, it is included.
 */
function getCustomDateElements(root) {
  if (!root) {
    return [];
  }

  const elements = [];

  /*
   * Include root itself when it is a custom-date component.
   */
  if (typeof root.matches === "function" && root.matches(SELECTORS.component)) {
    elements.push(root);
  }

  /*
   * Include custom-date components contained inside root.
   */
  if (typeof root.querySelectorAll === "function") {
    elements.push(...root.querySelectorAll(SELECTORS.component));
  }

  /*
   * Avoid duplicates.
   */
  return [...new Set(elements)];
}

/* ==========================================================================
   Component Initialization
   ========================================================================== */

/**
 * Initializes matching components contained by `root`.
 *
 * Existing live CustomDate instances are returned unchanged.
 *
 * CustomDate.getOrCreateInstance() also performs stale-enhancement cleanup,
 * which is important when AJAX HTML contains previously generated interface
 * markup.
 */
function initializeElements(root) {
  return getCustomDateElements(root)
    .map((element) => CustomDate.getOrCreateInstance(element))
    .filter(Boolean);
}

/* ==========================================================================
   Added Node Handling
   ========================================================================== */

/**
 * Handles a node added dynamically to the DOM.
 *
 * MutationObserver may report Elements or DocumentFragments depending on how
 * application code inserts content.
 */
function handleAddedNode(node) {
  if (!node) {
    return;
  }

  /*
   * Element = 1
   * DocumentFragment = 11
   *
   * Ignore text nodes, comments, etc.
   */
  if (node.nodeType !== 1 && node.nodeType !== 11) {
    return;
  }

  initializeElements(node);
}

/* ==========================================================================
   Dynamic DOM Observation
   ========================================================================== */

/**
 * Starts observing a document for custom-date components inserted after the
 * initial page load.
 *
 * Supported insertion approaches include:
 *
 * - fetch()
 * - XMLHttpRequest / AJAX
 * - jQuery .html()
 * - jQuery .append()
 * - jQuery .prepend()
 * - innerHTML
 * - insertAdjacentHTML()
 * - append()
 * - prepend()
 * - appendChild()
 * - client-side templates
 *
 * Only added nodes are observed.
 *
 * Removed nodes are intentionally not destroyed automatically. Libraries and
 * frameworks may temporarily detach and reinsert nodes during rendering.
 * Explicit destroyCustomDates() remains available when teardown is required.
 */
function observeCustomDates(documentReference) {
  if (!documentReference) {
    return null;
  }

  /*
   * Do not create more than one observer for the same document.
   */
  const existingObserver = observers.get(documentReference);

  if (existingObserver) {
    return existingObserver;
  }

  const view = documentReference.defaultView;

  if (
    !view ||
    typeof view.MutationObserver !== "function" ||
    !documentReference.documentElement
  ) {
    return null;
  }

  const observer = new view.MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type !== "childList") {
        return;
      }

      mutation.addedNodes.forEach((node) => {
        handleAddedNode(node);
      });
    });
  });

  observer.observe(documentReference.documentElement, {
    childList: true,
    subtree: true,
  });

  observers.set(documentReference, observer);

  return observer;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Progressively enhances every custom-date component inside `root`.
 *
 * Initialization is idempotent. Existing instances are returned rather than
 * initialized again.
 *
 * The first initialization for a document also starts automatic observation
 * so components inserted later through AJAX or other DOM updates are
 * initialized automatically.
 */
export function initCustomDates(
  root = typeof document !== "undefined" ? document : null,
) {
  if (!root) {
    return [];
  }

  const instances = initializeElements(root);

  const documentReference = getDocumentReference(root);

  if (documentReference) {
    observeCustomDates(documentReference);
  }

  return instances;
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
export function refreshCustomDates(
  root = typeof document !== "undefined" ? document : null,
) {
  if (!root) {
    return [];
  }

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
 * Destroys enhanced instances inside `root` and restores their native/fallback
 * date inputs.
 *
 * Returns the number of instances destroyed.
 */
export function destroyCustomDates(
  root = typeof document !== "undefined" ? document : null,
) {
  if (!root) {
    return 0;
  }

  let destroyed = 0;

  getCustomDateElements(root).forEach((element) => {
    const instance = CustomDate.getInstance(element);

    if (!instance) {
      return;
    }

    instance.destroy();

    destroyed += 1;
  });

  return destroyed;
}

/* ==========================================================================
   Observation State
   ========================================================================== */

/**
 * Returns true when automatic custom-date discovery is active for a document.
 */
export function isObservingCustomDates(
  documentReference = typeof document !== "undefined" ? document : null,
) {
  if (!documentReference) {
    return false;
  }

  return observers.has(documentReference);
}

/* ==========================================================================
   Stop Observation
   ========================================================================== */

/**
 * Stops automatic detection of dynamically inserted custom-date components.
 *
 * Existing CustomDate instances are intentionally left untouched.
 *
 * This is primarily useful for:
 *
 * - application teardown;
 * - test cleanup;
 * - iframe teardown;
 * - SPA lifecycle cleanup.
 *
 * Returns true when an active observer was stopped.
 */
export function stopObservingCustomDates(
  documentReference = typeof document !== "undefined" ? document : null,
) {
  if (!documentReference) {
    return false;
  }

  const observer = observers.get(documentReference);

  if (!observer) {
    return false;
  }

  observer.disconnect();

  observers.delete(documentReference);

  return true;
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
