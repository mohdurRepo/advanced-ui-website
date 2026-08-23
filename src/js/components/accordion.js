const SELECTORS = {
  accordion: ".accordion",
  item: ".accordion-item",
  trigger: "[data-accordion-trigger]",
  panel: ".accordion-panel",
  expandAll: "[data-accordion-expand-all]",
  expandAllLabel: "[data-accordion-expand-label]",
  expandAllIcon: "[data-accordion-expand-icon]",
};

let accordionId = 0;

/* ==========================================================================
   Helpers
   ========================================================================== */

function getTrigger(item) {
  return item.querySelector(SELECTORS.trigger);
}

function getPanel(item) {
  return item.querySelector(SELECTORS.panel);
}

function getItems(accordion) {
  return [...accordion.querySelectorAll(SELECTORS.item)];
}

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
   Accessibility
   ========================================================================== */

function ensureItemRelationships(item) {
  const trigger = getTrigger(item);
  const panel = getPanel(item);

  if (!trigger || !panel) return;

  accordionId += 1;

  if (!trigger.id) {
    trigger.id = `accordion-trigger-${accordionId}`;
  }

  if (!panel.id) {
    panel.id = `accordion-panel-${accordionId}`;
  }

  trigger.setAttribute("aria-controls", panel.id);

  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", trigger.id);
}

/* ==========================================================================
   Item State
   ========================================================================== */

function openItem(item) {
  const trigger = getTrigger(item);

  if (!trigger || isTriggerDisabled(trigger)) return;

  item.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
}

function closeItem(item) {
  const trigger = getTrigger(item);

  if (!trigger || isTriggerDisabled(trigger)) return;

  item.classList.remove("is-open");
  trigger.setAttribute("aria-expanded", "false");
}

function syncItemState(item) {
  const trigger = getTrigger(item);

  if (!trigger) return;

  const expanded = trigger.getAttribute("aria-expanded") === "true";

  item.classList.toggle("is-open", expanded);
}

/* ==========================================================================
   Expand All State
   ========================================================================== */

function updateExpandAllControl(accordion) {
  const control = accordion.querySelector(SELECTORS.expandAll);

  if (!control) return;

  const items = getInteractiveItems(accordion);

  if (items.length === 0) {
    control.disabled = true;
    control.setAttribute("aria-expanded", "false");
    return;
  }

  control.disabled = false;

  const allExpanded = items.every(isItemOpen);

  control.setAttribute("aria-expanded", String(allExpanded));

  const label = control.querySelector(SELECTORS.expandAllLabel);

  if (label) {
    label.textContent = allExpanded ? "Collapse all" : "Expand all";
  }

  const icon = control.querySelector(SELECTORS.expandAllIcon);

  if (icon) {
    icon.classList.toggle("icon-add-plus", !allExpanded);
    icon.classList.toggle("icon-minus-line", allExpanded);
  }
}

/* ==========================================================================
   Interaction
   ========================================================================== */

function toggleItem(trigger) {
  if (isTriggerDisabled(trigger)) return;

  const item = trigger.closest(SELECTORS.item);
  const accordion = trigger.closest(SELECTORS.accordion);

  if (!item || !accordion) return;

  const wasOpen = isItemOpen(item);
  const allowMultiple = accordion.hasAttribute("data-accordion-multiple");

  if (!allowMultiple && !wasOpen) {
    getItems(accordion).forEach((otherItem) => {
      if (otherItem !== item) {
        closeItem(otherItem);
      }
    });
  }

  if (wasOpen) {
    closeItem(item);
  } else {
    openItem(item);
  }

  updateExpandAllControl(accordion);
}

function toggleAll(accordion) {
  if (!accordion.hasAttribute("data-accordion-multiple")) return;

  const items = getInteractiveItems(accordion);

  if (items.length === 0) return;

  const allExpanded = items.every(isItemOpen);

  items.forEach((item) => {
    if (allExpanded) {
      closeItem(item);
    } else {
      openItem(item);
    }
  });

  updateExpandAllControl(accordion);
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeAccordion(accordion) {
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
     * Single-open accordions are normalized during initialization so invalid
     * markup cannot leave multiple items expanded.
     */
    if (!allowMultiple && isItemOpen(item)) {
      if (foundOpenItem) {
        trigger.setAttribute("aria-expanded", "false");
      } else {
        foundOpenItem = true;
      }
    }

    syncItemState(item);
  });

  const expandAllControl = accordion.querySelector(SELECTORS.expandAll);

  /*
   * Expand-all behavior only makes sense when multiple items may be open.
   */
  if (expandAllControl && !allowMultiple) {
    expandAllControl.hidden = true;
  }

  updateExpandAllControl(accordion);
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initAccordions() {
  document.querySelectorAll(SELECTORS.accordion).forEach(initializeAccordion);

  document.addEventListener("click", (event) => {
    const expandAllControl = event.target.closest(SELECTORS.expandAll);

    if (expandAllControl) {
      const accordion = expandAllControl.closest(SELECTORS.accordion);

      if (accordion) {
        toggleAll(accordion);
      }

      return;
    }

    const trigger = event.target.closest(SELECTORS.trigger);

    if (!trigger) return;

    toggleItem(trigger);
  });
}
