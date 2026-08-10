import { ATTRIBUTES, CLASSES, SELECTORS } from "./constants";

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Data View Card
   ========================================================================== */

/**
 * Progressive enhancement for expandable mobile data cards.
 *
 * Responsibilities:
 *
 * - expand / collapse card details
 * - synchronize aria-expanded
 * - synchronize the hidden state
 * - update accessible toggle text
 * - support independent cards
 *
 * The component does not know anything about the data itself.
 */
export class DataViewCard {
  constructor(element) {
    if (!(element instanceof Element)) {
      throw new TypeError("DataViewCard requires a valid card element.");
    }

    this.element = element;

    this.toggle = element.querySelector(SELECTORS.toggle);

    this.details = element.querySelector(SELECTORS.details);

    if (!this.toggle || !this.details) {
      throw new Error("DataViewCard requires a toggle and details region.");
    }

    this.handleToggle = this.handleToggle.bind(this);

    this.init();
  }

  /* ==========================================================================
     Static API
     ========================================================================== */

  static getInstance(element) {
    return instances.get(element) || null;
  }

  static getOrCreateInstance(element) {
    const existing = DataViewCard.getInstance(element);

    if (existing) {
      existing.refresh();

      return existing;
    }

    try {
      return new DataViewCard(element);
    } catch (error) {
      console.error("DataViewCard:", error);

      return null;
    }
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  init() {
    instances.set(this.element, this);

    this.ensureRelationship();

    this.toggle.addEventListener("click", this.handleToggle);

    this.refresh();
  }

  /* ==========================================================================
     Relationship
     ========================================================================== */

  ensureRelationship() {
    /*
     * If the details region does not already have an ID,
     * generate one so aria-controls remains valid.
     */

    if (!this.details.id) {
      this.details.id = `data-card-details-${DataViewCard.createId()}`;
    }

    this.toggle.setAttribute(ATTRIBUTES.controls, this.details.id);
  }

  static createId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2, 10);
  }

  /* ==========================================================================
     State
     ========================================================================== */

  isExpanded() {
    return this.toggle.getAttribute(ATTRIBUTES.expanded) === "true";
  }

  setExpanded(expanded) {
    this.toggle.setAttribute(ATTRIBUTES.expanded, String(expanded));

    this.details.hidden = !expanded;

    this.element.classList.toggle(CLASSES.expanded, expanded);

    this.updateLabel(expanded);
  }

  /* ==========================================================================
     Label
     ========================================================================== */

  getLabelElement() {
    return this.toggle.querySelector("[data-data-card-toggle-label]");
  }

  updateLabel(expanded) {
    const label = this.getLabelElement();

    if (!label) {
      return;
    }

    const more = label.dataset.moreLabel || "More details";

    const less = label.dataset.lessLabel || "Less details";

    label.textContent = expanded ? less : more;
  }

  /* ==========================================================================
     Refresh
     ========================================================================== */

  refresh() {
    const expanded = this.isExpanded();

    this.details.hidden = !expanded;

    this.element.classList.toggle(CLASSES.expanded, expanded);

    this.updateLabel(expanded);
  }

  /* ==========================================================================
     Toggle
     ========================================================================== */

  toggleCard() {
    this.setExpanded(!this.isExpanded());
  }

  /* ==========================================================================
     Events
     ========================================================================== */

  handleToggle() {
    this.toggleCard();
  }

  /* ==========================================================================
     Destruction
     ========================================================================== */

  destroy() {
    this.toggle.removeEventListener("click", this.handleToggle);

    this.element.classList.remove(CLASSES.expanded);

    instances.delete(this.element);
  }
}
