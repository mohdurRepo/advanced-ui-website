const SELECTORS = {
  accordion: ".accordion",
  item: ".accordion-item",
  trigger: "[data-accordion-trigger]",
  panel: ".accordion-panel",
  expandAll: "[data-accordion-expand-all]",
  expandAllLabel: "[data-accordion-expand-label]",
  expandAllIcon: "[data-accordion-expand-icon]",
};

const initializedAccordions = new WeakSet();

let accordionId = 0;
let eventsBound = false;

/* ==========================================================================
   DOM Helpers
   ========================================================================== */

/**
 * Returns descendants owned by the supplied accordion.
 *
 * Filtering by the closest accordion prevents a parent accordion from
 * accidentally controlling items belonging to a nested accordion.
 */

function getOwnedElements(accordion, selector) {
  return [...accordion.querySelectorAll(selector)].filter(
    (element) => element.closest(SELECTORS.accordion) === accordion,
  );
}

function getItems(accordion) {
  return getOwnedElements(accordion, SELECTORS.item);
}

function getExpandAllControl(accordion) {
  return getOwnedElements(accordion, SELECTORS.expandAll)[0] ?? null;
}

function getTrigger(item) {
  return (
    [...item.querySelectorAll(SELECTORS.trigger)].find(
      (trigger) => trigger.closest(SELECTORS.item) === item,
    ) ?? null
  );
}

function getPanel(item) {
  return (
    [...item.querySelectorAll(SELECTORS.panel)].find(
      (panel) => panel.closest(SELECTORS.item) === item,
    ) ?? null
  );
}

/* ==========================================================================
   State Helpers
   ========================================================================== */

function isTriggerDisabled(trigger) {
  return (
    !trigger ||
    trigger.disabled ||
    trigger.classList.contains("is-disabled") ||
    trigger.getAttribute("aria-disabled") === "true"
  );
}

function isItemDisabled(item) {
  return isTriggerDisabled(getTrigger(item));
}

function isItemOpen(item) {
  return getTrigger(item)?.getAttribute("aria-expanded") === "true";
}

function getInteractiveItems(accordion) {
  return getItems(accordion).filter((item) => !isItemDisabled(item));
}

/* ==========================================================================
   IDs
   ========================================================================== */

function createUniqueId(prefix) {
  let id;

  do {
    accordionId += 1;
    id = `${prefix}-${accordionId}`;
  } while (document.getElementById(id));

  return id;
}

/* ==========================================================================
   Accessibility Relationships
   ========================================================================== */

function ensureItemRelationships(item) {
  const trigger = getTrigger(item);
  const panel = getPanel(item);

  if (!trigger || !panel) return;

  if (!trigger.id) {
    trigger.id = createUniqueId("accordion-trigger");
  }

  if (!panel.id) {
    panel.id = createUniqueId("accordion-panel");
  }

  trigger.setAttribute("aria-controls", panel.id);

  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", trigger.id);
}

/* ==========================================================================
   Item State
   ========================================================================== */

/**
 * State changes are allowed programmatically even for disabled items.
 *
 * Disabled means the user cannot interact with the trigger. It should not
 * prevent the accordion controller from normalizing state internally.
 */

function setItemExpanded(item, expanded) {
  const trigger = getTrigger(item);

  if (!trigger) return;

  trigger.setAttribute("aria-expanded", String(expanded));
  item.classList.toggle("is-open", expanded);
}

function openItem(item) {
  setItemExpanded(item, true);
}

function closeItem(item) {
  setItemExpanded(item, false);
}

function syncItemState(item) {
  setItemExpanded(item, isItemOpen(item));
}

/* ==========================================================================
   Expand All Control
   ========================================================================== */

function setControlDisabled(control, disabled) {
  if ("disabled" in control) {
    control.disabled = disabled;
  }

  control.setAttribute("aria-disabled", String(disabled));
}

function updateExpandAllControl(accordion) {
  const control = getExpandAllControl(accordion);

  if (!control) return;

  const items = getInteractiveItems(accordion);

  if (items.length === 0) {
    setControlDisabled(control, true);

    control.setAttribute("aria-expanded", "false");
    control.dataset.accordionState = "collapsed";

    return;
  }

  setControlDisabled(control, false);

  const allExpanded = items.every(isItemOpen);

  control.setAttribute("aria-expanded", String(allExpanded));
  control.dataset.accordionState = allExpanded ? "expanded" : "collapsed";

  const label = control.querySelector(SELECTORS.expandAllLabel);

  if (label) {
    const expandLabel = control.dataset.accordionExpandLabel ?? "Expand all";

    const collapseLabel =
      control.dataset.accordionCollapseLabel ?? "Collapse all";

    label.textContent = allExpanded ? collapseLabel : expandLabel;
  }

  /*
   * Existing icon classes are retained for backwards compatibility.
   *
   * The control also exposes data-accordion-state so the icon implementation
   * can later move completely to CSS without changing accordion behavior.
   */

  const icon = control.querySelector(SELECTORS.expandAllIcon);

  if (icon) {
    icon.classList.toggle("icon-add-plus", !allExpanded);
    icon.classList.toggle("icon-minus-line", allExpanded);

    icon.dataset.accordionState = allExpanded ? "expanded" : "collapsed";
  }
}

/* ==========================================================================
   Item Interaction
   ========================================================================== */

function toggleItem(trigger) {
  if (isTriggerDisabled(trigger)) return;

  const item = trigger.closest(SELECTORS.item);
  const accordion = trigger.closest(SELECTORS.accordion);

  if (!item || !accordion) return;

  /*
   * Protect nested accordions from accidentally operating on a parent item.
   */
  if (item.closest(SELECTORS.accordion) !== accordion) return;

  const wasOpen = isItemOpen(item);

  const allowMultiple = accordion.hasAttribute("data-accordion-multiple");

  if (!allowMultiple && !wasOpen) {
    getItems(accordion).forEach((otherItem) => {
      if (otherItem !== item) {
        closeItem(otherItem);
      }
    });
  }

  setItemExpanded(item, !wasOpen);

  updateExpandAllControl(accordion);
}

/* ==========================================================================
   Expand / Collapse All
   ========================================================================== */

function toggleAll(accordion) {
  if (!accordion.hasAttribute("data-accordion-multiple")) return;

  const items = getInteractiveItems(accordion);

  if (items.length === 0) return;

  const allExpanded = items.every(isItemOpen);

  items.forEach((item) => {
    setItemExpanded(item, !allExpanded);
  });

  updateExpandAllControl(accordion);
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeAccordion(accordion) {
  if (initializedAccordions.has(accordion)) return;

  initializedAccordions.add(accordion);

  const allowMultiple = accordion.hasAttribute("data-accordion-multiple");

  const items = getItems(accordion);

  let foundOpenItem = false;

  items.forEach((item) => {
    ensureItemRelationships(item);

    const trigger = getTrigger(item);

    if (!trigger) return;

    if (!trigger.hasAttribute("aria-expanded")) {
      trigger.setAttribute(
        "aria-expanded",
        item.classList.contains("is-open") ? "true" : "false",
      );
    }

    /*
     * A single-open accordion may contain only one expanded item.
     * Invalid initial markup is normalized deterministically by keeping
     * the first expanded item open.
     */

    if (!allowMultiple && isItemOpen(item)) {
      if (foundOpenItem) {
        closeItem(item);
      } else {
        foundOpenItem = true;
      }
    }

    syncItemState(item);
  });

  const expandAllControl = getExpandAllControl(accordion);

  /*
   * Expand-all behavior only makes sense for multiple-open accordions.
   */

  if (expandAllControl) {
    expandAllControl.hidden = !allowMultiple;
  }

  updateExpandAllControl(accordion);
}

/* ==========================================================================
   Events
   ========================================================================== */

function handleDocumentClick(event) {
  if (!(event.target instanceof Element)) return;

  const expandAllControl = event.target.closest(SELECTORS.expandAll);

  if (expandAllControl) {
    if (isTriggerDisabled(expandAllControl)) return;

    const accordion = expandAllControl.closest(SELECTORS.accordion);

    if (accordion) {
      toggleAll(accordion);
    }

    return;
  }

  const trigger = event.target.closest(SELECTORS.trigger);

  if (!trigger) return;

  toggleItem(trigger);
}

function bindEvents() {
  if (eventsBound) return;

  document.addEventListener("click", handleDocumentClick);

  eventsBound = true;
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initAccordions() {
  document.querySelectorAll(SELECTORS.accordion).forEach(initializeAccordion);

  bindEvents();
}
