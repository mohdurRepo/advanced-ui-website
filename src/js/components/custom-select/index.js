import { CustomSelect } from "./custom-select";
import { SELECTORS } from "./constants";

/* ==========================================================================
   Observer Registry
   ========================================================================== */

/**
 * One MutationObserver per document.
 *
 * WeakMap allows documents/iframes to be garbage-collected normally.
 */
const observers = new WeakMap();

/* ==========================================================================
   Document Resolution
   ========================================================================== */

function getDocumentReference(root) {
  if (!root) return null;

  /*
   * Document
   */
  if (root.nodeType === 9) {
    return root;
  }

  /*
   * Element, DocumentFragment, or ShadowRoot.
   */
  return root.ownerDocument || null;
}

/* ==========================================================================
   Element Collection
   ========================================================================== */

/**
 * Returns all custom-select roots contained by `root`.
 *
 * `root` may be:
 *
 * - Document
 * - DocumentFragment
 * - Element
 * - ShadowRoot
 *
 * If the supplied root is itself a custom select, it is included.
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
   Element Initialization
   ========================================================================== */

/**
 * Initializes every custom select contained by `root`.
 *
 * CustomSelect.getOrCreateInstance() is idempotent, so this is safe even when
 * an element has already been enhanced.
 */
function initializeElements(root) {
  return getCustomSelectElements(root)
    .map((element) => CustomSelect.getOrCreateInstance(element))
    .filter(Boolean);
}

/* ==========================================================================
   Added Node Handling
   ========================================================================== */

/**
 * Initializes custom-select components introduced through DOM insertion.
 *
 * Element nodes may themselves be custom selects or contain custom selects.
 *
 * DocumentFragment support is included for application code that passes a
 * fragment directly through this initialization path.
 */
function handleAddedNode(node) {
  if (!node) return;

  switch (node.nodeType) {
    /*
     * Element
     */
    case 1:
      initializeElements(node);
      break;

    /*
     * DocumentFragment / ShadowRoot
     */
    case 11:
      initializeElements(node);
      break;

    default:
  }
}

/* ==========================================================================
   Document Observer
   ========================================================================== */

/**
 * Starts automatic custom-select initialization for a document.
 *
 * The observer only reacts to newly added nodes. Existing component attribute
 * and option changes remain owned by each CustomSelect instance's internal
 * MutationObserver.
 */
function observeCustomSelects(documentReference) {
  if (!documentReference) {
    return null;
  }

  const existingObserver = observers.get(documentReference);

  if (existingObserver) {
    return existingObserver;
  }

  const view = documentReference.defaultView;

  const MutationObserverConstructor = view?.MutationObserver;

  const observationRoot = documentReference.documentElement;

  if (typeof MutationObserverConstructor !== "function" || !observationRoot) {
    return null;
  }

  const observer = new MutationObserverConstructor((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        handleAddedNode(node);
      });
    });
  });

  observer.observe(observationRoot, {
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
 * Progressively enhances every custom select inside `root`.
 *
 * Initialization is idempotent. Existing instances are returned rather than
 * constructing duplicate interfaces or duplicate listeners.
 *
 * Calling this once during application startup also enables automatic
 * initialization for custom selects inserted later through AJAX or other DOM
 * updates.
 *
 * If one component fails, CustomSelect applies `.is-enhancement-failed` to
 * that component and its native fallback remains usable.
 */
export function initCustomSelects(
  root = typeof document !== "undefined" ? document : null,
) {
  if (!root) {
    return [];
  }

  const instances = initializeElements(root);

  const documentReference = getDocumentReference(root);

  observeCustomSelects(documentReference);

  return instances;
}

/* ==========================================================================
   Refresh
   ========================================================================== */

/**
 * Refreshes existing custom selects from their native controls and initializes
 * matching elements that have not yet been enhanced.
 *
 * Use this when application code deliberately changes:
 *
 * - options
 * - labels
 * - selected values
 * - disabled/hidden states
 * - component configuration
 *
 * AJAX-inserted custom-select components do not normally require a manual
 * refresh because the document observer initializes them automatically.
 */
export function refreshCustomSelects(
  root = typeof document !== "undefined" ? document : null,
) {
  if (!root) {
    return [];
  }

  const instances = getCustomSelectElements(root)
    .map((element) => {
      const instance = CustomSelect.getInstance(element);

      if (!instance) {
        return CustomSelect.getOrCreateInstance(element);
      }

      instance.refresh();

      return instance;
    })
    .filter(Boolean);

  /*
   * Keep automatic AJAX initialization enabled even if refreshCustomSelects()
   * happens to be the application's first custom-select call.
   */
  observeCustomSelects(getDocumentReference(root));

  return instances;
}

/* ==========================================================================
   Destruction
   ========================================================================== */

/**
 * Destroys enhanced instances inside `root` and restores their native
 * fallbacks.
 *
 * Destroying individual components intentionally does not stop the document
 * observer. If matching markup is later inserted again, it should be enhanced
 * normally.
 *
 * Returns the number of instances destroyed.
 */
export function destroyCustomSelects(
  root = typeof document !== "undefined" ? document : null,
) {
  if (!root) {
    return 0;
  }

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
   Observer State
   ========================================================================== */

/**
 * Returns whether automatic custom-select initialization is active for the
 * document associated with `root`.
 */
export function isObservingCustomSelects(
  root = typeof document !== "undefined" ? document : null,
) {
  const documentReference = getDocumentReference(root);

  return Boolean(documentReference && observers.has(documentReference));
}

/* ==========================================================================
   Stop Observing
   ========================================================================== */

/**
 * Stops automatic initialization for the document associated with `root`.
 *
 * Existing CustomSelect instances remain active.
 */
export function stopObservingCustomSelects(
  root = typeof document !== "undefined" ? document : null,
) {
  const documentReference = getDocumentReference(root);

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
   Public Class
   ========================================================================== */

export { CustomSelect };
