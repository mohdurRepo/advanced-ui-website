/* ==========================================================================
   Directory
   ========================================================================== */

/*
 * Directory-specific interaction controller.
 *
 * This component owns:
 *
 * - alphabetical navigation
 * - hidden alphabetical-filter synchronization
 * - optional automatic form submission
 * - reset synchronization
 * - directory-specific accessibility announcements
 *
 * Grid/list switching is intentionally owned by data-view.js.
 */

const SELECTORS = {
  root: "[data-directory]",
  form: "[data-directory-filter-form]",
  alphabet: "[data-directory-alphabet]",
  letter: "[data-directory-letter]",
  letterInput: "[data-directory-letter-input]",
  reset: "[data-directory-reset]",
  liveStatus: "[data-directory-live-status]",
};

const CLASSES = {
  active: "is-active",
};

let initialized = false;
let observer = null;

/* ==========================================================================
   Ownership
   ========================================================================== */

/**
 * Return elements owned by one directory root.
 *
 * Nested directories are excluded.
 *
 * @param {HTMLElement} root
 * @param {string} selector
 * @returns {HTMLElement[]}
 */
function getOwnedElements(root, selector) {
  return Array.from(root.querySelectorAll(selector)).filter((element) => {
    return element.closest(SELECTORS.root) === root;
  });
}

/**
 * Return the directory filter form.
 *
 * @param {HTMLElement} root
 * @returns {HTMLFormElement | null}
 */
function getDirectoryForm(root) {
  if (root.matches("form")) {
    return root;
  }

  const form = getOwnedElements(root, SELECTORS.form)[0];

  return form instanceof HTMLFormElement ? form : null;
}

/**
 * Return alphabet controls owned by a directory.
 *
 * @param {HTMLElement} root
 * @returns {HTMLElement[]}
 */
function getLetterControls(root) {
  return getOwnedElements(root, SELECTORS.letter);
}

/**
 * Return the hidden letter input.
 *
 * @param {HTMLElement} root
 * @returns {HTMLInputElement | null}
 */
function getLetterInput(root) {
  const input = getOwnedElements(root, SELECTORS.letterInput)[0];

  return input instanceof HTMLInputElement ? input : null;
}

/**
 * Return the directory live region.
 *
 * @param {HTMLElement} root
 * @returns {HTMLElement | null}
 */
function getLiveStatus(root) {
  return getOwnedElements(root, SELECTORS.liveStatus)[0] || null;
}

/* ==========================================================================
   Letter Values
   ========================================================================== */

/**
 * Normalize an alphabetical-filter value.
 *
 * "all" and an empty value both represent the complete directory.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
function normalizeLetter(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (!normalized || normalized === "ALL") {
    return "";
  }

  return normalized;
}

/**
 * Return readable text for a selected letter.
 *
 * @param {string} value
 * @returns {string}
 */
function formatLetterStatus(value) {
  if (!value) {
    return "Showing all directory entries.";
  }

  return `Showing directory entries beginning with ${value}.`;
}

/* ==========================================================================
   Accessibility
   ========================================================================== */

/**
 * Announce the selected letter.
 *
 * @param {HTMLElement} root
 * @param {string} value
 */
function announceLetter(root, value) {
  const liveStatus = getLiveStatus(root);

  if (!liveStatus) {
    return;
  }

  liveStatus.textContent = formatLetterStatus(value);
}

/* ==========================================================================
   Alphabet Activation
   ========================================================================== */

/**
 * Synchronize all alphabetical controls.
 *
 * @param {HTMLElement} root
 * @param {string} value
 */
function updateLetterControls(root, value) {
  const normalizedValue = normalizeLetter(value);
  const controls = getLetterControls(root);

  controls.forEach((control) => {
    const controlValue = normalizeLetter(control.dataset.directoryLetter);
    const isActive = controlValue === normalizedValue;

    control.classList.toggle(CLASSES.active, isActive);
    control.setAttribute("aria-pressed", String(isActive));

    if (isActive) {
      control.setAttribute("aria-current", "true");
    } else {
      control.removeAttribute("aria-current");
    }
  });
}

/**
 * Determine whether automatic form submission is enabled.
 *
 * The attribute may be placed on:
 *
 * - the directory root
 * - the alphabet container
 * - the form
 *
 * @param {HTMLElement} root
 * @returns {boolean}
 */
function shouldAutoSubmit(root) {
  const alphabet = getOwnedElements(root, SELECTORS.alphabet)[0];
  const form = getDirectoryForm(root);

  return Boolean(
    root.hasAttribute("data-directory-auto-submit") ||
    alphabet?.hasAttribute("data-directory-auto-submit") ||
    form?.hasAttribute("data-directory-auto-submit"),
  );
}

/**
 * Submit the directory filter form.
 *
 * @param {HTMLElement} root
 */
function submitDirectoryForm(root) {
  const form = getDirectoryForm(root);

  if (!form) {
    return;
  }

  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
    return;
  }

  form.submit();
}

/**
 * Activate an alphabetical filter.
 *
 * @param {HTMLElement} root
 * @param {string} value
 * @param {{
 *   announce?: boolean,
 *   submit?: boolean,
 *   focus?: boolean
 * }} options
 */
export function setDirectoryLetter(
  root,
  value,
  { announce = true, submit = false, focus = false } = {},
) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const normalizedValue = normalizeLetter(value);
  const input = getLetterInput(root);

  if (input) {
    input.value = normalizedValue;
  }

  updateLetterControls(root, normalizedValue);

  if (focus) {
    const activeControl = getLetterControls(root).find((control) => {
      return (
        normalizeLetter(control.dataset.directoryLetter) === normalizedValue
      );
    });

    activeControl?.focus();
  }

  if (announce) {
    announceLetter(root, normalizedValue);
  }

  root.dispatchEvent(
    new CustomEvent("directory:letter-change", {
      bubbles: true,
      detail: {
        root,
        letter: normalizedValue,
      },
    }),
  );

  if (submit || shouldAutoSubmit(root)) {
    submitDirectoryForm(root);
  }
}

/* ==========================================================================
   Initial Letter
   ========================================================================== */

/**
 * Resolve the initial alphabetical filter.
 *
 * @param {HTMLElement} root
 * @returns {string}
 */
function resolveInitialLetter(root) {
  const input = getLetterInput(root);

  if (input?.value) {
    return normalizeLetter(input.value);
  }

  const activeControl = getLetterControls(root).find((control) => {
    return (
      control.getAttribute("aria-pressed") === "true" ||
      control.classList.contains(CLASSES.active)
    );
  });

  return normalizeLetter(activeControl?.dataset.directoryLetter);
}

/* ==========================================================================
   Keyboard Navigation
   ========================================================================== */

/**
 * Navigate between alphabetical controls.
 *
 * @param {KeyboardEvent} event
 * @param {HTMLElement} root
 * @param {HTMLElement} currentControl
 */
function handleAlphabetKeyboard(event, root, currentControl) {
  const controls = getLetterControls(root).filter((control) => {
    return (
      !control.disabled && control.getAttribute("aria-disabled") !== "true"
    );
  });

  const currentIndex = controls.indexOf(currentControl);

  if (currentIndex === -1) {
    return;
  }

  const isRtl = getComputedStyle(root).direction === "rtl";
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

  setDirectoryLetter(root, nextControl.dataset.directoryLetter, {
    focus: true,
  });
}

/* ==========================================================================
   Reset
   ========================================================================== */

/**
 * Reset the directory alphabet after the native form reset completes.
 *
 * @param {HTMLElement} root
 */
function resetDirectory(root) {
  window.requestAnimationFrame(() => {
    setDirectoryLetter(root, "", {
      announce: true,
      submit: false,
    });
  });
}

/* ==========================================================================
   Root Initialization
   ========================================================================== */

/**
 * Initialize one directory root.
 *
 * @param {HTMLElement} root
 */
function initializeDirectory(root) {
  if (
    !(root instanceof HTMLElement) ||
    root.dataset.directoryInitialized === "true"
  ) {
    return;
  }

  const controls = getLetterControls(root);

  controls.forEach((control) => {
    if (!control.hasAttribute("type") && control instanceof HTMLButtonElement) {
      control.type = "button";
    }

    control.setAttribute(
      "aria-pressed",
      control.getAttribute("aria-pressed") === "true" ? "true" : "false",
    );
  });

  if (controls.length) {
    const initialLetter = resolveInitialLetter(root);

    setDirectoryLetter(root, initialLetter, {
      announce: false,
      submit: false,
    });
  }

  root.dataset.directoryInitialized = "true";
}

/* ==========================================================================
   Event Handling
   ========================================================================== */

function handleDocumentClick(event) {
  const letterControl = event.target.closest(SELECTORS.letter);

  if (letterControl instanceof HTMLElement) {
    const root = letterControl.closest(SELECTORS.root);

    if (
      !root ||
      letterControl.disabled ||
      letterControl.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }

    event.preventDefault();

    setDirectoryLetter(root, letterControl.dataset.directoryLetter);

    return;
  }

  const resetControl = event.target.closest(SELECTORS.reset);

  if (!(resetControl instanceof HTMLElement)) {
    return;
  }

  const root = resetControl.closest(SELECTORS.root);

  if (!root) {
    return;
  }

  resetDirectory(root);
}

function handleDocumentKeydown(event) {
  const letterControl = event.target.closest(SELECTORS.letter);

  if (!(letterControl instanceof HTMLElement)) {
    return;
  }

  const root = letterControl.closest(SELECTORS.root);

  if (!root) {
    return;
  }

  handleAlphabetKeyboard(event, root, letterControl);
}

function handleDocumentReset(event) {
  if (!(event.target instanceof HTMLFormElement)) {
    return;
  }

  const root = event.target.closest(SELECTORS.root);

  if (!root) {
    return;
  }

  resetDirectory(root);
}

/* ==========================================================================
   Dynamic Content
   ========================================================================== */

function initializeAddedContent(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  if (node.matches(SELECTORS.root)) {
    initializeDirectory(node);
  }

  node.querySelectorAll(SELECTORS.root).forEach((root) => {
    initializeDirectory(root);
  });
}

function observeDynamicDirectories() {
  if (observer || !document.body) {
    return;
  }

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(initializeAddedContent);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/* ==========================================================================
   Public Initialization
   ========================================================================== */

export function initDirectories() {
  if (initialized) {
    return;
  }

  initialized = true;

  document.querySelectorAll(SELECTORS.root).forEach((root) => {
    initializeDirectory(root);
  });

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
  document.addEventListener("reset", handleDocumentReset);

  observeDynamicDirectories();
}
