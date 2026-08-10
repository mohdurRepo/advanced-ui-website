import { TableScrollNavigation } from "./table-scroll-navigation";
import {
  destroyDataTableLayout,
  initDataTableLayout,
  refreshDataTableLayout,
} from "./datatable-layout";
import { SELECTORS } from "./constants";

/* ==========================================================================
   Element Collection
   ========================================================================== */

/**
 * Returns table-navigation roots contained by `root`.
 *
 * `root` may be:
 *
 * - Document
 * - DocumentFragment
 * - Element
 * - ShadowRoot
 *
 * When the supplied root is itself a table shell, it is included.
 */
function getTableElements(root) {
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
 * Initializes global table behavior.
 *
 * Includes:
 *
 * - native wide-table scroll navigation
 * - DataTables layout synchronization
 *
 * Initialization is idempotent.
 */
export function initTables(root = document) {
  const instances = getTableElements(root)
    .map((element) => TableScrollNavigation.getOrCreateInstance(element))
    .filter(Boolean);

  initDataTableLayout();

  return instances;
}

/* ==========================================================================
   Refresh
   ========================================================================== */

/**
 * Refreshes native table navigation and DataTables layout calculations.
 *
 * Use after:
 *
 * - dynamically inserting tables
 * - changing table content
 * - changing visible columns
 * - changing language / direction
 * - revealing tables inside hidden panels
 * - major page-layout changes
 */
export function refreshTables(root = document) {
  const instances = getTableElements(root)
    .map((element) => {
      const instance = TableScrollNavigation.getInstance(element);

      if (!instance) {
        return TableScrollNavigation.getOrCreateInstance(element);
      }

      instance.refresh();

      return instance;
    })
    .filter(Boolean);

  refreshDataTableLayout();

  return instances;
}

/* ==========================================================================
   Destruction
   ========================================================================== */

/**
 * Destroys table-navigation instances inside `root`.
 *
 * When destroying the document-level table system, the global DataTables
 * resize observer is also removed.
 *
 * Returns the number of native table-navigation instances destroyed.
 */
export function destroyTables(root = document) {
  let destroyed = 0;

  getTableElements(root).forEach((element) => {
    const instance = TableScrollNavigation.getInstance(element);

    if (!instance) return;

    instance.destroy();
    destroyed += 1;
  });

  if (root === document) {
    destroyDataTableLayout();
  }

  return destroyed;
}

/* ==========================================================================
   Public API
   ========================================================================== */

export { TableScrollNavigation, refreshDataTableLayout };
