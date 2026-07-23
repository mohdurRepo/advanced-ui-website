/* ==========================================================================
   Configuration
   ========================================================================== */

const STORAGE_KEYS = {
  theme: "se-theme",
  accent: "se-accent",
  fontSize: "se-font-size",
  contrast: "se-contrast",
  motion: "se-motion",
};

const OPTIONS = {
  theme: ["light", "dark", "system"],
  accent: ["blue", "navy", "teal"],
  fontSize: ["-2", "-1", "0", "1", "2"],
  contrast: ["normal", "high"],
  motion: ["normal", "reduce"],
};

const DEFAULTS = {
  theme: "system",
  accent: "blue",
  fontSize: "0",
  contrast: "normal",
  motion: "normal",
};

const FONT_SIZE_LABELS = {
  "-2": "Smallest text size",
  "-1": "Smaller text size",
  0: "Default text size",
  1: "Larger text size",
  2: "Largest text size",
};

const root = document.documentElement;

const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

let themeSwitchFrame = null;
let isInitialized = false;

/* ==========================================================================
   Validation
   ========================================================================== */

function isValidPreference(name, value) {
  return OPTIONS[name]?.includes(value) ?? false;
}

/* ==========================================================================
   Storage
   ========================================================================== */

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Preferences still work for the current page session.
  }
}

function getStoredPreference(name) {
  const key = STORAGE_KEYS[name];
  const value = readStorage(key);

  return isValidPreference(name, value) ? value : DEFAULTS[name];
}

/* ==========================================================================
   Theme Resolution
   ========================================================================== */

function resolveTheme(theme) {
  if (theme !== "system") {
    return theme;
  }

  return systemThemeQuery.matches ? "dark" : "light";
}

/* ==========================================================================
   Apply Preferences
   ========================================================================== */

function finishPreferenceUpdate() {
  if (themeSwitchFrame !== null) {
    window.cancelAnimationFrame(themeSwitchFrame);
  }

  themeSwitchFrame = window.requestAnimationFrame(() => {
    themeSwitchFrame = window.requestAnimationFrame(() => {
      root.classList.remove("is-theme-switching");
      themeSwitchFrame = null;
    });
  });
}

function applyPreferences(preferences) {
  /*
   * Prevent all theme-aware components from animating while their CSS
   * custom properties are being replaced.
   */
  root.classList.add("is-theme-switching");

  root.setAttribute("data-theme", resolveTheme(preferences.theme));

  root.setAttribute("data-theme-choice", preferences.theme);

  root.setAttribute("data-accent", preferences.accent);

  root.setAttribute("data-font-size", preferences.fontSize);

  root.setAttribute("data-contrast", preferences.contrast);

  root.setAttribute("data-motion", preferences.motion);

  finishPreferenceUpdate();
}

/* ==========================================================================
   Events
   ========================================================================== */

function emitPreferenceChange(name, value, preferences) {
  document.dispatchEvent(
    new CustomEvent("preferencechange", {
      detail: {
        name,
        value,
        preferences,
      },
    }),
  );
}

function emitPreferencesReset(preferences) {
  document.dispatchEvent(
    new CustomEvent("preferencesreset", {
      detail: {
        preferences,
      },
    }),
  );
}

/* ==========================================================================
   Public State
   ========================================================================== */

export function getPreferences() {
  return Object.keys(DEFAULTS).reduce((preferences, name) => {
    preferences[name] = getStoredPreference(name);
    return preferences;
  }, {});
}

export function setPreference(name, value) {
  if (!isValidPreference(name, value)) {
    console.warn(`Invalid preference: ${name}="${value}"`);

    return false;
  }

  writeStorage(STORAGE_KEYS[name], value);

  const preferences = getPreferences();

  applyPreferences(preferences);
  syncPreferencesUI(preferences);

  emitPreferenceChange(name, value, preferences);

  return true;
}

/* ==========================================================================
   Font Size
   ========================================================================== */

function moveFontSize(direction) {
  const preferences = getPreferences();

  const currentIndex = OPTIONS.fontSize.indexOf(preferences.fontSize);

  const nextIndex = Math.min(
    Math.max(currentIndex + direction, 0),
    OPTIONS.fontSize.length - 1,
  );

  const nextValue = OPTIONS.fontSize[nextIndex];

  if (nextValue === preferences.fontSize) {
    return;
  }

  setPreference("fontSize", nextValue);
}

export function increaseFontSize() {
  moveFontSize(1);
}

export function decreaseFontSize() {
  moveFontSize(-1);
}

export function resetFontSize() {
  setPreference("fontSize", DEFAULTS.fontSize);
}

/* ==========================================================================
   Binary Preferences
   ========================================================================== */

function toggleBinaryPreference(button) {
  const name = button.getAttribute("data-preference-toggle");

  const onValue = button.getAttribute("data-preference-on");

  const offValue = button.getAttribute("data-preference-off");

  if (
    !name ||
    !isValidPreference(name, onValue) ||
    !isValidPreference(name, offValue)
  ) {
    return;
  }

  const preferences = getPreferences();

  const nextValue = preferences[name] === onValue ? offValue : onValue;

  setPreference(name, nextValue);
}

/* ==========================================================================
   Reset
   ========================================================================== */

export function resetPreferences() {
  Object.values(STORAGE_KEYS).forEach(removeStorage);

  const preferences = getPreferences();

  applyPreferences(preferences);
  syncPreferencesUI(preferences);

  emitPreferencesReset(preferences);

  emitPreferenceChange(null, null, preferences);
}

/* ==========================================================================
   UI Synchronization
   ========================================================================== */

function setPressedState(button, isPressed) {
  button.classList.toggle("is-active", isPressed);

  button.setAttribute("aria-pressed", String(isPressed));
}

function syncChoiceButtons(preferences) {
  document
    .querySelectorAll("[data-preference][data-preference-set]")
    .forEach((button) => {
      const name = button.getAttribute("data-preference");

      const value = button.getAttribute("data-preference-set");

      setPressedState(button, preferences[name] === value);
    });
}

function syncToggleButtons(preferences) {
  document.querySelectorAll("[data-preference-toggle]").forEach((button) => {
    const name = button.getAttribute("data-preference-toggle");

    const onValue = button.getAttribute("data-preference-on");

    setPressedState(button, preferences[name] === onValue);
  });
}

function syncFontControls(preferences) {
  const currentIndex = OPTIONS.fontSize.indexOf(preferences.fontSize);

  const minimumIndex = 0;
  const maximumIndex = OPTIONS.fontSize.length - 1;

  document.querySelectorAll("[data-font-decrease]").forEach((button) => {
    button.disabled = currentIndex <= minimumIndex;
  });

  document.querySelectorAll("[data-font-increase]").forEach((button) => {
    button.disabled = currentIndex >= maximumIndex;
  });

  document.querySelectorAll("[data-font-reset]").forEach((button) => {
    setPressedState(button, preferences.fontSize === DEFAULTS.fontSize);
  });

  document.querySelectorAll("[data-font-size-status]").forEach((status) => {
    status.textContent =
      FONT_SIZE_LABELS[preferences.fontSize] ?? FONT_SIZE_LABELS["0"];
  });
}

function syncPreferencesUI(preferences = getPreferences()) {
  syncChoiceButtons(preferences);
  syncToggleButtons(preferences);
  syncFontControls(preferences);
}

/* ==========================================================================
   Interaction
   ========================================================================== */

function handlePreferenceClick(event) {
  const choiceButton = event.target.closest(
    "[data-preference][data-preference-set]",
  );

  if (choiceButton) {
    const name = choiceButton.getAttribute("data-preference");

    const value = choiceButton.getAttribute("data-preference-set");

    setPreference(name, value);
    return;
  }

  const toggleButton = event.target.closest("[data-preference-toggle]");

  if (toggleButton) {
    toggleBinaryPreference(toggleButton);
    return;
  }

  if (event.target.closest("[data-font-decrease]")) {
    decreaseFontSize();
    return;
  }

  if (event.target.closest("[data-font-increase]")) {
    increaseFontSize();
    return;
  }

  if (event.target.closest("[data-font-reset]")) {
    resetFontSize();
    return;
  }

  if (event.target.closest("[data-preferences-reset]")) {
    resetPreferences();
  }
}

/* ==========================================================================
   System Preference Changes
   ========================================================================== */

function handleSystemThemeChange() {
  const preferences = getPreferences();

  if (preferences.theme !== "system") {
    return;
  }

  applyPreferences(preferences);
  syncPreferencesUI(preferences);
}

function handleStorageChange(event) {
  if (event.storageArea !== window.localStorage) {
    return;
  }

  if (event.key !== null && !Object.values(STORAGE_KEYS).includes(event.key)) {
    return;
  }

  const preferences = getPreferences();

  applyPreferences(preferences);
  syncPreferencesUI(preferences);
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initPreferences() {
  if (isInitialized) {
    return;
  }

  isInitialized = true;

  const preferences = getPreferences();

  applyPreferences(preferences);
  syncPreferencesUI(preferences);

  document.addEventListener("click", handlePreferenceClick);

  systemThemeQuery.addEventListener("change", handleSystemThemeChange);

  window.addEventListener("storage", handleStorageChange);
}
