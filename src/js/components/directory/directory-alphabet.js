import { ATTRIBUTES, CLASSES, EVENTS, LABELS, SELECTORS } from "./constants";

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Directory Alphabet
   ========================================================================== */

/**
 * Reusable alphabetical directory controller.
 *
 * Supported modes:
 *
 * 1. Client-side directory
 *    - derives available letters from rendered groups
 *    - disables unavailable letters
 *    - hides non-matching groups locally
 *
 * 2. Server-filtered directory
 *    - enabled with [data-directory-server-filter]
 *    - derives available letters from the latest complete server result
 *    - preserves that availability while requesting one specific letter
 *    - does not hide groups locally
 *    - dispatches directory:alphabet-change for page-specific AJAX handling
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

    /*
     * Server-filter mode.
     */
    this.serverFilter = element.hasAttribute(ATTRIBUTES.serverFilter);

    /*
     * Cached availability for server-backed directories.
     *
     * This represents the letters available in the latest
     * complete, unlettered backend response.
     */
    this.serverAvailableLetters = new Set();

    /*
     * false:
     * We have not received a complete backend result yet.
     *
     * true:
     * serverAvailableLetters is authoritative, including
     * the valid case where the set is empty.
     */
    this.serverAvailabilityKnown = false;

    /*
     * Tracks the currently applied UI letter.
     *
     * null is important during initial construction so the
     * empty server-rendered result container is not mistaken
     * for an authoritative empty backend response.
     */
    this.activeLetter = null;

    this.panels = [];
    this.groups = [];

    this.handleClick = this.handleClick.bind(this);

    this.handleKeydown = this.handleKeydown.bind(this);

    this.handleReset = this.handleReset.bind(this);

    this.init();
  }

  /* ==========================================================================
     Static Instance API
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

    /*
     * On first initialization, a server-backed directory may
     * not have received AJAX results yet.
     *
     * Therefore do not treat the initial empty DOM as proof that
     * every alphabet letter is unavailable.
     */
    this.synchronizeAvailableLetters({
      captureServerAvailability: false,
    });

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
        .forEach((id) => {
          panelIds.add(id);
        });
    });

    this.panels = Array.from(panelIds)
      .map((id) => document.getElementById(id))
      .filter((panel) => panel instanceof HTMLElement);
  }

  /* ==========================================================================
     Result Groups
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

  getAvailableLetters() {
    return new Set(
      this.groups.map((group) => this.getGroupLetter(group)).filter(Boolean),
    );
  }

  /* ==========================================================================
     Letter Availability
     ========================================================================== */

  synchronizeAvailableLetters({ captureServerAvailability = true } = {}) {
    const availableLetters = this.getAvailableLetters();

    /*
     * ================================================================
     * Server-backed directory
     * ================================================================
     */
    if (this.serverFilter) {
      const currentLetter = this.normalizeLetter(this.letterInput?.value);

      /*
       * Only capture availability when:
       *
       * - the backend request represents "All" / no letter
       * - the previous UI state was also the All state
       *
       * Why activeLetter matters:
       *
       * If B was selected and page-specific code clears #letterId
       * before the new AJAX request, the DOM may still contain only
       * B companies.
       *
       * We must not incorrectly replace the availability cache with
       * only B during that transition.
       */
      const canCaptureServerAvailability =
        captureServerAvailability &&
        currentLetter === "" &&
        this.activeLetter === "";

      if (canCaptureServerAvailability) {
        /*
         * Empty is also authoritative.
         *
         * Example:
         * a sector filter legitimately returns zero companies.
         *
         * In that case every letter except All should be disabled.
         */
        this.serverAvailableLetters = new Set(availableLetters);

        this.serverAvailabilityKnown = true;
      }

      this.controls.forEach((control) => {
        const letter = this.getControlLetter(control);

        const isAllControl = letter === "";

        /*
         * Before the first full AJAX response arrives,
         * keep letters clickable.
         *
         * Once availability is known, enable only letters
         * actually present in that complete result set.
         */
        const isAvailable =
          isAllControl ||
          !this.serverAvailabilityKnown ||
          this.serverAvailableLetters.has(letter);

        this.setControlAvailability(control, isAvailable);
      });

      return;
    }

    /*
     * ================================================================
     * Client-side directory
     * ================================================================
     */

    this.controls.forEach((control) => {
      const letter = this.getControlLetter(control);

      const isAllControl = letter === "";

      const isAvailable = isAllControl || availableLetters.has(letter);

      this.setControlAvailability(control, isAvailable);
    });
  }

  setControlAvailability(control, isAvailable) {
    control.disabled = !isAvailable;

    control.classList.toggle(CLASSES.disabled, !isAvailable);

    if (isAvailable) {
      control.removeAttribute(ATTRIBUTES.disabled);
    } else {
      control.setAttribute(ATTRIBUTES.disabled, "true");
    }
  }

  /* ==========================================================================
     Letter Helpers
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

  getControl(letter) {
    return (
      this.controls.find(
        (control) =>
          !control.disabled && this.getControlLetter(control) === letter,
      ) || null
    );
  }

  /* ==========================================================================
     Active Control
     ========================================================================== */

  setActiveControl(letter) {
    this.controls.forEach((control) => {
      const isActive =
        !control.disabled && this.getControlLetter(control) === letter;

      control.classList.toggle(CLASSES.active, isActive);

      control.setAttribute(ATTRIBUTES.pressed, String(isActive));
    });
  }

  /* ==========================================================================
     Hidden Letter Input
     ========================================================================== */

  setPreservedLetter(letter) {
    if (this.letterInput) {
      this.letterInput.value = letter;
    }
  }

  /* ==========================================================================
     Group Visibility
     ========================================================================== */

  setGroupVisibility(letter) {
    /*
     * Server-filtered directories receive only the appropriate
     * result set from the backend.
     *
     * Do not perform a second client-side alphabet filter.
     */
    if (this.serverFilter) {
      return;
    }

    this.groups.forEach((group) => {
      const groupLetter = this.getGroupLetter(group);

      const isVisible = letter === "" || groupLetter === letter;

      group.hidden = !isVisible;

      group.classList.toggle(CLASSES.hidden, !isVisible);
    });
  }

  /* ==========================================================================
     Active Results Panel
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

  /* ==========================================================================
     Result Count
     ========================================================================== */

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
     Live Status
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
     Apply Letter
     ========================================================================== */

  applyLetter(value, { announce = true, dispatch = true, focus = false } = {}) {
    const requestedLetter = this.normalizeLetter(value);

    const letter = this.hasAvailableControl(requestedLetter)
      ? requestedLetter
      : "";

    this.activeLetter = letter;

    this.setActiveControl(letter);

    this.setPreservedLetter(letter);

    this.setGroupVisibility(letter);

    if (focus) {
      this.getControl(letter)?.focus();
    }

    /*
     * Server-backed directories cannot announce the new
     * result count until their asynchronous request completes.
     *
     * The page-specific controller owns that status.
     */
    if (announce && !this.serverFilter) {
      this.announce(letter);
    }

    if (dispatch) {
      this.dispatchChange(letter);
    }

    return letter;
  }

  /* ==========================================================================
     Reset
     ========================================================================== */

  reset() {
    this.applyLetter("");
  }

  /* ==========================================================================
     Change Event
     ========================================================================== */

  dispatchChange(letter) {
    this.element.dispatchEvent(
      new CustomEvent(EVENTS.change, {
        bubbles: true,

        detail: {
          letter,

          count: this.getVisibleResultCount(),

          panels: [...this.panels],

          serverFilter: this.serverFilter,
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

    if (currentIndex === -1 || controls.length === 0) {
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
     Native Form Reset
     ========================================================================== */

  handleReset() {
    /*
     * Native form values are restored after the reset event.
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

    /*
     * Re-read mode so dynamically updated markup is supported.
     */
    this.serverFilter = this.element.hasAttribute(ATTRIBUTES.serverFilter);

    this.collectPanels();
    this.collectGroups();

    /*
     * Server availability rules:
     *
     * Initial state
     * --------------------------------------------------------------
     * activeLetter = null
     * Do not capture the empty DOM.
     *
     * Full backend response
     * --------------------------------------------------------------
     * activeLetter = ""
     * #letterId = ""
     * Capture all rendered letters.
     *
     * Selected-letter response
     * --------------------------------------------------------------
     * activeLetter = "B"
     * #letterId = "B"
     * Preserve the previous full-response availability.
     *
     * Transition from selected letter back to All
     * --------------------------------------------------------------
     * activeLetter = "B"
     * #letterId = ""
     * Do not capture the stale B-only DOM.
     *
     * The next refresh after the full AJAX response will have:
     * activeLetter = ""
     * #letterId = ""
     * and will correctly refresh availability.
     */
    this.synchronizeAvailableLetters({
      captureServerAvailability: this.activeLetter === "",
    });

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

      group.style.display = "";

      group.classList.remove(CLASSES.hidden);
    });

    this.controls.forEach((control) => {
      control.disabled = false;

      control.classList.remove(CLASSES.disabled);

      control.removeAttribute(ATTRIBUTES.disabled);
    });

    this.serverAvailableLetters.clear();

    this.serverAvailabilityKnown = false;

    this.activeLetter = null;

    instances.delete(this.element);
  }
}
