/* ==========================================================================
   Generic Data View Switcher
   ========================================================================== */

/*
 * Reusable presentation switcher.
 *
 * Supported examples:
 *
 * - grid / list
 * - table / cards
 * - comfortable / compact
 *
 * Required markup:
 *
 * [data-view-root]
 *   [data-view-control="grid"]
 *   [data-view-control="list"]
 *   [data-view-panel="grid"]
 *   [data-view-panel="list"]
 *
 * Optional configuration:
 *
 * data-view-default="grid"
 * data-view-storage-key="issuer-directory-view"
 *
 * Optional live region:
 *
 * [data-view-live-status]
 */

const SELECTORS = {
  root: "[data-view-root]",
  control: "[data-view-control]",
  panel: "[data-view-panel]",
  liveStatus: "[data-view-live-status]",
  results: "[data-directory-results]",
};

const CLASSES = {
  active: "is-active",
};

const instances = new WeakMap();

/* ==========================================================================
   Data View
   ========================================================================== */

export class DataView {
  constructor(element) {
    if (!(element instanceof Element)) {
      throw new TypeError("DataView requires a valid root element.");
    }

    this.element = element;

    this.controls = this.getOwnedElements(SELECTORS.control);
    this.panels = this.getOwnedElements(SELECTORS.panel);

    this.handleControlClick = this.handleControlClick.bind(this);
    this.handleControlKeydown = this.handleControlKeydown.bind(this);

    if (!this.controls.length || !this.panels.length) {
      throw new Error(
        "DataView requires at least one control and one matching panel.",
      );
    }

    this.availableViews = this.getAvailableViews();

    if (!this.availableViews.length) {
      throw new Error("DataView controls must have matching data-view panels.");
    }

    this.init();
  }

  /* ==========================================================================
     Static API
     ========================================================================== */

  static getInstance(element) {
    return instances.get(element) || null;
  }

  static getOrCreateInstance(element) {
    const existing = DataView.getInstance(element);

    if (existing) {
      existing.refresh();

      return existing;
    }

    try {
      return new DataView(element);
    } catch (error) {
      console.error("DataView:", error);

      return null;
    }
  }

  /* ==========================================================================
     Ownership
     ========================================================================== */

  /*
   * Nested data-view components must initialize independently.
   */

  getOwnedElements(selector) {
    return Array.from(this.element.querySelectorAll(selector)).filter(
      (item) => item.closest(SELECTORS.root) === this.element,
    );
  }

  /* ==========================================================================
     Views
     ========================================================================== */

  getAvailableViews() {
    const controlViews = this.controls
      .map((control) => control.dataset.viewControl)
      .filter(Boolean);

    const panelViews = this.panels
      .map((panel) => panel.dataset.viewPanel)
      .filter(Boolean);

    return [...new Set(controlViews)].filter((view) => {
      return panelViews.includes(view);
    });
  }

  isValidView(view) {
    return Boolean(view && this.availableViews.includes(view));
  }

  getControl(view) {
    return (
      this.controls.find((control) => {
        return control.dataset.viewControl === view;
      }) || null
    );
  }

  getPanel(view) {
    return (
      this.panels.find((panel) => {
        return panel.dataset.viewPanel === view;
      }) || null
    );
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  init() {
    instances.set(this.element, this);

    this.prepareControls();
    this.preparePanels();

    this.controls.forEach((control) => {
      control.addEventListener("click", this.handleControlClick);
      control.addEventListener("keydown", this.handleControlKeydown);
    });

    const initialView = this.resolveInitialView();

    this.setView(initialView, {
      announce: false,
      focus: false,
      persist: false,
    });
  }

  /* ==========================================================================
     Relationships
     ========================================================================== */

  prepareControls() {
    this.controls.forEach((control) => {
      const view = control.dataset.viewControl;
      const panel = this.getPanel(view);

      if (control instanceof HTMLButtonElement && !control.type) {
        control.type = "button";
      }

      if (!panel || !this.isValidView(view)) {
        control.setAttribute("aria-disabled", "true");

        if (control instanceof HTMLButtonElement) {
          control.disabled = true;
        }

        return;
      }

      if (!panel.id) {
        panel.id = `data-view-panel-${DataView.createId()}`;
      }

      control.setAttribute("aria-controls", panel.id);
      control.setAttribute(
        "aria-pressed",
        control.getAttribute("aria-pressed") === "true" ? "true" : "false",
      );
    });
  }

  preparePanels() {
    this.panels.forEach((panel) => {
      const view = panel.dataset.viewPanel;
      const control = this.getControl(view);

      if (!control) {
        return;
      }

      if (!control.id) {
        control.id = `data-view-control-${DataView.createId()}`;
      }

      panel.setAttribute("aria-labelledby", control.id);
    });
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
     Initial View
     ========================================================================== */

  resolveInitialView() {
    const storedView = this.readStoredView();

    if (this.isValidView(storedView)) {
      return storedView;
    }

    const pressedControl = this.controls.find((control) => {
      return control.getAttribute("aria-pressed") === "true";
    });

    if (
      pressedControl &&
      this.isValidView(pressedControl.dataset.viewControl)
    ) {
      return pressedControl.dataset.viewControl;
    }

    const activeControl = this.controls.find((control) => {
      return control.classList.contains(CLASSES.active);
    });

    if (activeControl && this.isValidView(activeControl.dataset.viewControl)) {
      return activeControl.dataset.viewControl;
    }

    const defaultView = this.element.dataset.viewDefault;

    if (this.isValidView(defaultView)) {
      return defaultView;
    }

    return this.availableViews[0];
  }

  /* ==========================================================================
     Storage
     ========================================================================== */

  readStoredView() {
    const storageKey = this.element.dataset.viewStorageKey;

    if (!storageKey) {
      return null;
    }

    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  saveView(view) {
    const storageKey = this.element.dataset.viewStorageKey;

    if (!storageKey) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, view);
    } catch {
      /*
       * Storage may be unavailable in privacy-restricted browsers.
       * Switching views must continue without persistence.
       */
    }
  }

  /* ==========================================================================
     Current View
     ========================================================================== */

  getCurrentView() {
    return this.element.dataset.view || null;
  }

  /* ==========================================================================
     View Activation
     ========================================================================== */

  setView(view, { announce = true, focus = false, persist = true } = {}) {
    if (!this.isValidView(view)) {
      return;
    }

    this.controls.forEach((control) => {
      const isActive = control.dataset.viewControl === view;

      control.classList.toggle(CLASSES.active, isActive);
      control.setAttribute("aria-pressed", String(isActive));

      if (isActive && focus) {
        control.focus();
      }
    });

    this.panels.forEach((panel) => {
      const isActive = panel.dataset.viewPanel === view;

      panel.hidden = !isActive;
      panel.classList.toggle(CLASSES.active, isActive);

      if (isActive) {
        panel.removeAttribute("aria-hidden");
      } else {
        panel.setAttribute("aria-hidden", "true");
      }
    });

    this.element.dataset.view = view;

    /*
     * Preserve support for an inner results component that uses data-view
     * for layout-specific styling.
     */

    const results = this.getOwnedElements(SELECTORS.results)[0];

    if (results) {
      results.dataset.view = view;
    }

    if (persist) {
      this.saveView(view);
    }

    if (announce) {
      this.announce(view);
    }

    this.element.dispatchEvent(
      new CustomEvent("data-view:change", {
        bubbles: true,
        detail: {
          view,
          instance: this,
        },
      }),
    );
  }

  /* ==========================================================================
     Accessible Announcement
     ========================================================================== */

  getLiveStatus() {
    return this.getOwnedElements(SELECTORS.liveStatus)[0] || null;
  }

  formatViewName(view) {
    return view
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  announce(view) {
    const liveStatus = this.getLiveStatus();

    if (!liveStatus) {
      return;
    }

    liveStatus.textContent = `${this.formatViewName(view)} view selected.`;
  }

  /* ==========================================================================
     Refresh
     ========================================================================== */

  refresh() {
    this.controls = this.getOwnedElements(SELECTORS.control);
    this.panels = this.getOwnedElements(SELECTORS.panel);
    this.availableViews = this.getAvailableViews();

    if (!this.availableViews.length) {
      return;
    }

    this.prepareControls();
    this.preparePanels();

    const currentView = this.getCurrentView();

    this.setView(
      this.isValidView(currentView) ? currentView : this.resolveInitialView(),
      {
        announce: false,
        focus: false,
        persist: false,
      },
    );
  }

  /* ==========================================================================
     Click
     ========================================================================== */

  handleControlClick(event) {
    const control = event.currentTarget;

    if (
      !(control instanceof HTMLElement) ||
      control.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }

    event.preventDefault();

    this.setView(control.dataset.viewControl);
  }

  /* ==========================================================================
     Keyboard Navigation
     ========================================================================== */

  getEnabledControls() {
    return this.controls.filter((control) => {
      return (
        !control.disabled && control.getAttribute("aria-disabled") !== "true"
      );
    });
  }

  handleControlKeydown(event) {
    const controls = this.getEnabledControls();
    const currentControl = event.currentTarget;
    const currentIndex = controls.indexOf(currentControl);

    if (currentIndex === -1) {
      return;
    }

    const isRtl = getComputedStyle(this.element).direction === "rtl";
    let nextIndex = currentIndex;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = isRtl ? currentIndex - 1 : currentIndex + 1;
        break;

      case "ArrowLeft":
        nextIndex = isRtl ? currentIndex + 1 : currentIndex - 1;
        break;

      case "ArrowDown":
        nextIndex = currentIndex + 1;
        break;

      case "ArrowUp":
        nextIndex = currentIndex - 1;
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = controls.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();

    nextIndex = (nextIndex + controls.length) % controls.length;

    const nextControl = controls[nextIndex];

    this.setView(nextControl.dataset.viewControl, {
      focus: true,
    });
  }

  /* ==========================================================================
     Destruction
     ========================================================================== */

  destroy() {
    this.controls.forEach((control) => {
      control.removeEventListener("click", this.handleControlClick);
      control.removeEventListener("keydown", this.handleControlKeydown);
    });

    instances.delete(this.element);
  }
}
