import { ATTRIBUTES, CLASSES, EVENTS, LABELS, SELECTORS } from "./constants";

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Directory Alphabet
   ========================================================================== */

/**
 * Controls alphabetical directory groups.
 *
 * Responsibilities:
 *
 * - discover result panels through aria-controls
 * - show complete matching letter groups
 * - synchronize active controls and aria-pressed
 * - disable letters without corresponding groups
 * - update the form's preserved letter value
 * - announce result changes
 * - support keyboard navigation
 * - reset independently of the grid/list switcher
 *
 * This component does not require a shared wrapper or an attribute on <main>.
 */
export class DirectoryAlphabet {
  constructor(element) {
    if (!(element instanceof Element)) {
      throw new TypeError(
        "DirectoryAlphabet requires a valid alphabet element.",
      );
    }

    this.element = element;
    this.form = element.closest(SELECTORS.filterForm);

    this.controls = Array.from(
      element.querySelectorAll(SELECTORS.alphabetControl),
    );

    this.letterInput = this.form?.querySelector(SELECTORS.letterInput) || null;

    this.panels = [];
    this.groups = [];

    this.handleClick = this.handleClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleReset = this.handleReset.bind(this);

    this.init();
  }

  /* ==========================================================================
     Static API
     ========================================================================== */

  static getInstance(element) {
    return instances.get(element) || null;
  }

  static getOrCreateInstance(element) {
    const existing = DirectoryAlphabet.getInstance(element);

    if (existing) {
      existing.refresh();

      return existing;
    }

    try {
      return new DirectoryAlphabet(element);
    } catch (error) {
      console.error("DirectoryAlphabet:", error);

      return null;
    }
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  init() {
    if (!this.controls.length) {
      throw new Error(
        "DirectoryAlphabet requires at least one letter control.",
      );
    }

    instances.set(this.element, this);

    this.collectPanels();
    this.collectGroups();
    this.synchronizeAvailableLetters();

    this.element.addEventListener("click", this.handleClick);
    this.element.addEventListener("keydown", this.handleKeydown);

    this.form?.addEventListener("reset", this.handleReset);

    this.applyLetter(this.getInitialLetter(), {
      announce: false,
      dispatch: false,
    });
  }

  /* ==========================================================================
     Controlled Panels
     ========================================================================== */

  collectPanels() {
    const panelIds = new Set();

    this.controls.forEach((control) => {
      const controlsValue = control.getAttribute(ATTRIBUTES.controls);

      if (!controlsValue) {
        return;
      }

      controlsValue
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((id) => panelIds.add(id));
    });

    this.panels = Array.from(panelIds)
      .map((id) => document.getElementById(id))
      .filter((panel) => panel instanceof HTMLElement);
  }

  /* ==========================================================================
     Directory Groups
     ========================================================================== */

  collectGroups() {
    const groups = [];

    this.panels.forEach((panel) => {
      panel.querySelectorAll(SELECTORS.group).forEach((group) => {
        if (!groups.includes(group)) {
          groups.push(group);
        }
      });
    });

    this.groups = groups;
  }

  getGroupLetter(group) {
    return (
      group.getAttribute(ATTRIBUTES.group)?.trim().toLocaleUpperCase() || ""
    );
  }

  /* ==========================================================================
     Available Letters
     ========================================================================== */

  getAvailableLetters() {
    return new Set(
      this.groups.map((group) => this.getGroupLetter(group)).filter(Boolean),
    );
  }

  synchronizeAvailableLetters() {
    const availableLetters = this.getAvailableLetters();

    this.controls.forEach((control) => {
      const letter = this.getControlLetter(control);
      const isAllControl = letter === "";
      const isAvailable = isAllControl || availableLetters.has(letter);

      control.disabled = !isAvailable;
      control.classList.toggle(CLASSES.disabled, !isAvailable);

      if (isAvailable) {
        control.removeAttribute(ATTRIBUTES.disabled);
      } else {
        control.setAttribute(ATTRIBUTES.disabled, "true");
      }
    });
  }

  /* ==========================================================================
     Letter Values
     ========================================================================== */

  normalizeLetter(value) {
    return String(value || "")
      .trim()
      .toLocaleUpperCase();
  }

  getControlLetter(control) {
    return this.normalizeLetter(control.getAttribute(ATTRIBUTES.letter));
  }

  getInitialLetter() {
    const preservedLetter = this.normalizeLetter(this.letterInput?.value);

    if (this.hasAvailableControl(preservedLetter)) {
      return preservedLetter;
    }

    const selectedControl = this.controls.find(
      (control) =>
        control.getAttribute(ATTRIBUTES.pressed) === "true" ||
        control.classList.contains(CLASSES.active),
    );

    const selectedLetter = selectedControl
      ? this.getControlLetter(selectedControl)
      : "";

    return this.hasAvailableControl(selectedLetter) ? selectedLetter : "";
  }

  hasAvailableControl(letter) {
    return this.controls.some(
      (control) =>
        !control.disabled && this.getControlLetter(control) === letter,
    );
  }

  /* ==========================================================================
     Active State
     ========================================================================== */

  setActiveControl(letter) {
    this.controls.forEach((control) => {
      const isActive =
        !control.disabled && this.getControlLetter(control) === letter;

      control.classList.toggle(CLASSES.active, isActive);
      control.setAttribute(ATTRIBUTES.pressed, String(isActive));
    });
  }

  setPreservedLetter(letter) {
    if (this.letterInput) {
      this.letterInput.value = letter;
    }
  }

  /* ==========================================================================
     Group Visibility
     ========================================================================== */

  setGroupVisibility(letter) {
    this.groups.forEach((group) => {
      const groupLetter = this.getGroupLetter(group);
      const isVisible = letter === "" || groupLetter === letter;

      group.hidden = !isVisible;
      group.classList.toggle(CLASSES.hidden, !isVisible);
    });
  }

  /* ==========================================================================
     Result Counting
     ========================================================================== */

  getActivePanel() {
    return (
      this.panels.find(
        (panel) =>
          !panel.hidden && panel.getAttribute("aria-hidden") !== "true",
      ) ||
      this.panels[0] ||
      null
    );
  }

  getVisibleResultCount() {
    const activePanel = this.getActivePanel();

    if (!activePanel) {
      return 0;
    }

    return Array.from(
      activePanel.querySelectorAll(SELECTORS.resultItem),
    ).filter((item) => {
      const group = item.closest(SELECTORS.group);

      return !group || !group.hidden;
    }).length;
  }

  /* ==========================================================================
     Live Announcement
     ========================================================================== */

  getLiveStatusElements() {
    return Array.from(document.querySelectorAll(SELECTORS.liveStatus)).filter(
      (status) => {
        if (!this.panels.length) {
          return false;
        }

        const nearestResults = status
          .closest("[data-view-root]")
          ?.querySelector("[data-directory-results]");

        return (
          nearestResults &&
          this.panels.some((panel) => nearestResults.contains(panel))
        );
      },
    );
  }

  announce(letter) {
    const count = this.getVisibleResultCount();

    let message = LABELS.allResults;

    if (letter && count > 0) {
      message = LABELS.results(count, letter);
    }

    if (letter && count === 0) {
      message = LABELS.noResults;
    }

    this.getLiveStatusElements().forEach((status) => {
      status.textContent = message;
    });
  }

  /* ==========================================================================
     Public State
     ========================================================================== */

  applyLetter(value, { announce = true, dispatch = true, focus = false } = {}) {
    const requestedLetter = this.normalizeLetter(value);

    const letter = this.hasAvailableControl(requestedLetter)
      ? requestedLetter
      : "";

    this.setActiveControl(letter);
    this.setPreservedLetter(letter);
    this.setGroupVisibility(letter);

    if (focus) {
      this.getControl(letter)?.focus();
    }

    if (announce) {
      this.announce(letter);
    }

    if (dispatch) {
      this.dispatchChange(letter);
    }

    return letter;
  }

  getControl(letter) {
    return (
      this.controls.find(
        (control) =>
          !control.disabled && this.getControlLetter(control) === letter,
      ) || null
    );
  }

  reset() {
    this.applyLetter("");
  }

  /* ==========================================================================
     Custom Event
     ========================================================================== */

  dispatchChange(letter) {
    this.element.dispatchEvent(
      new CustomEvent(EVENTS.change, {
        bubbles: true,
        detail: {
          letter,
          count: this.getVisibleResultCount(),
          panels: [...this.panels],
        },
      }),
    );
  }

  /* ==========================================================================
     Click
     ========================================================================== */

  handleClick(event) {
    const control = event.target.closest(SELECTORS.alphabetControl);

    if (
      !control ||
      !this.element.contains(control) ||
      control.disabled ||
      control.getAttribute(ATTRIBUTES.disabled) === "true"
    ) {
      return;
    }

    event.preventDefault();

    this.applyLetter(this.getControlLetter(control));
  }

  /* ==========================================================================
     Keyboard Navigation
     ========================================================================== */

  getEnabledControls() {
    return this.controls.filter(
      (control) =>
        !control.disabled &&
        control.getAttribute(ATTRIBUTES.disabled) !== "true",
    );
  }

  handleKeydown(event) {
    const currentControl = event.target.closest(SELECTORS.alphabetControl);

    if (!currentControl || !this.element.contains(currentControl)) {
      return;
    }

    const controls = this.getEnabledControls();
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

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = controls.length - 1;
        break;

      case "Enter":
      case " ":
        event.preventDefault();

        this.applyLetter(this.getControlLetter(currentControl));
        return;

      default:
        return;
    }

    event.preventDefault();

    nextIndex = (nextIndex + controls.length) % controls.length;

    controls[nextIndex].focus();
  }

  /* ==========================================================================
     Form Reset
     ========================================================================== */

  handleReset() {
    /*
     * Wait until native form controls have returned to their defaults.
     */

    requestAnimationFrame(() => {
      this.reset();

      this.element.dispatchEvent(
        new CustomEvent(EVENTS.reset, {
          bubbles: true,
        }),
      );
    });
  }

  /* ==========================================================================
     Refresh
     ========================================================================== */

  refresh() {
    const currentLetter = this.normalizeLetter(this.letterInput?.value);

    this.collectPanels();
    this.collectGroups();
    this.synchronizeAvailableLetters();

    this.applyLetter(currentLetter, {
      announce: false,
      dispatch: false,
    });
  }

  /* ==========================================================================
     Destruction
     ========================================================================== */

  destroy() {
    this.element.removeEventListener("click", this.handleClick);

    this.element.removeEventListener("keydown", this.handleKeydown);

    this.form?.removeEventListener("reset", this.handleReset);

    this.groups.forEach((group) => {
      group.hidden = false;
      group.classList.remove(CLASSES.hidden);
    });

    instances.delete(this.element);
  }
}
