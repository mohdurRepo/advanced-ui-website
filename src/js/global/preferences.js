/* ==========================================================================
   Display Preferences
   ========================================================================== */

/**
 * Owns the visitor's display preferences.
 *
 * Source of truth
 *   In-memory state. localStorage only persists it, so every preference
 *   keeps working for the current page even when storage is blocked.
 *
 * Operating-system settings
 *   Only the "system" theme choice reads the OS (prefers-color-scheme),
 *   because the visitor explicitly chose it. Motion is controlled by the
 *   site setting alone.
 *
 * Root contract (<html>; also written early by the head bootstrap)
 *   data-theme              resolved theme: light | dark
 *   data-theme-choice       light | dark | system
 *   data-accent             blue | navy | teal
 *   data-font-size          -2 | -1 | 0 | 1 | 2
 *   data-contrast           normal | high
 *   data-motion-preference  normal | reduce
 *   data-ticker-visibility  visible | hidden
 *   data-ticker-speed       slow | normal | fast
 *
 * Markup contract
 *   Choice   [data-preference="theme"][data-preference-set="dark"]
 *   Toggle   [data-preference-toggle="contrast"]
 *            [data-preference-on="high"][data-preference-off="normal"]
 *   Font     [data-font-decrease] [data-font-increase] [data-font-reset]
 *   Status   [data-font-size-status]
 *   Reset    [data-preferences-reset]
 *
 *   Controls with role="radio" or role="switch" receive aria-checked;
 *   all other controls receive aria-pressed.
 *
 * Events (dispatched on document)
 *   preferencechange  { name, value, preferences }
 *                     name and value are null after a reset.
 *   preferencesreset  { preferences }
 */

/* ==========================================================================
   Configuration
   ========================================================================== */

function definePreference(definition) {
  return Object.freeze({
    ...definition,
    options: Object.freeze([...definition.options]),
  });
}

/**
 * suppressTransitions: live changes replace broad visual tokens, so
 * component transitions are paused briefly to avoid a page-wide animation.
 * Motion is excluded so the Motion runtime observes its change directly.
 */

const PREFERENCES = Object.freeze({
  theme: definePreference({
    storageKey: "se-theme",
    attribute: "data-theme-choice",
    options: ["light", "dark", "system"],
    defaultValue: "system",
    suppressTransitions: true,
  }),

  accent: definePreference({
    storageKey: "se-accent",
    attribute: "data-accent",
    options: ["blue", "navy", "teal"],
    defaultValue: "blue",
    suppressTransitions: true,
  }),

  fontSize: definePreference({
    storageKey: "se-font-size",
    attribute: "data-font-size",
    options: ["-2", "-1", "0", "1", "2"],
    defaultValue: "0",
    suppressTransitions: true,
  }),

  contrast: definePreference({
    storageKey: "se-contrast",
    attribute: "data-contrast",
    options: ["normal", "high"],
    defaultValue: "normal",
    suppressTransitions: true,
  }),

  motion: definePreference({
    storageKey: "se-motion",
    attribute: "data-motion-preference",
    options: ["normal", "reduce"],
    defaultValue: "normal",
    suppressTransitions: false,
  }),

  tickerVisibility: definePreference({
    storageKey: "se-ticker-visibility",
    attribute: "data-ticker-visibility",
    options: ["visible", "hidden"],
    defaultValue: "visible",
    suppressTransitions: false,
  }),

  tickerSpeed: definePreference({
    storageKey: "se-ticker-speed",
    attribute: "data-ticker-speed",
    options: ["slow", "normal", "fast"],
    defaultValue: "normal",
    suppressTransitions: false,
  }),
});

const PREFERENCE_NAMES = Object.freeze(Object.keys(PREFERENCES));

const STORAGE_KEYS = new Set(
  PREFERENCE_NAMES.map((name) => PREFERENCES[name].storageKey),
);

/* Short-lived marker that lets other tabs recognise a full reset. */

const RESET_SIGNAL_KEY = "se-preferences-reset";

const FONT_SIZE_STEPS = PREFERENCES.fontSize.options;

const FONT_SIZE_LABELS = Object.freeze({
  en: Object.freeze({
    "-2": "Smallest text size",
    "-1": "Smaller text size",
    0: "Default text size",
    1: "Larger text size",
    2: "Largest text size",
  }),

  ar: Object.freeze({
    "-2": "أصغر حجم للنص",
    "-1": "حجم نص أصغر",
    0: "حجم النص الافتراضي",
    1: "حجم نص أكبر",
    2: "أكبر حجم للنص",
  }),
});

const SELECTORS = Object.freeze({
  choice: "[data-preference][data-preference-set]",
  toggle: "[data-preference-toggle]",
  fontDecrease: "[data-font-decrease]",
  fontIncrease: "[data-font-increase]",
  fontReset: "[data-font-reset]",
  fontStatus: "[data-font-size-status]",
  reset: "[data-preferences-reset]",
});

const FONT_CONTROL_SELECTOR = [
  SELECTORS.fontDecrease,
  SELECTORS.fontIncrease,
  SELECTORS.fontReset,
].join(", ");

const CHECKED_ROLES = new Set([
  "radio",
  "switch",
  "menuitemradio",
  "menuitemcheckbox",
]);

const root = document.documentElement;

const systemThemeQuery = createMediaQuery("(prefers-color-scheme: dark)");

/* ==========================================================================
   State
   ========================================================================== */

let state = null;

let transitionFrame = null;

let storageSyncFrame = null;
let storageResetPending = false;

let isInitialized = false;

/* ==========================================================================
   General Helpers
   ========================================================================== */

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createMediaQuery(query) {
  if (typeof window.matchMedia !== "function") {
    return null;
  }

  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

function onMediaQueryChange(query, listener) {
  if (!query) {
    return;
  }

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", listener);

    return;
  }

  /* Legacy Safari / WebView. */

  query.addListener?.(listener);
}

function getDocumentLanguage() {
  return String(root.lang).toLowerCase().startsWith("ar") ? "ar" : "en";
}

/* ==========================================================================
   Validation
   ========================================================================== */

function isKnownPreference(name) {
  return Object.prototype.hasOwnProperty.call(PREFERENCES, name);
}

function isValidPreference(name, value) {
  return isKnownPreference(name) && PREFERENCES[name].options.includes(value);
}

/* ==========================================================================
   Storage
   ========================================================================== */

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStorage(key) {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    getStorage()?.setItem(key, value);
  } catch {
    /* Blocked or full: the in-memory state still applies to this page. */
  }
}

function removeStorage(key) {
  try {
    getStorage()?.removeItem(key);
  } catch {
    /* Blocked: nothing persisted, nothing to remove. */
  }
}

/* ==========================================================================
   Preference State
   ========================================================================== */

function readStoredPreferences() {
  return PREFERENCE_NAMES.reduce((preferences, name) => {
    const value = readStorage(PREFERENCES[name].storageKey);

    preferences[name] = isValidPreference(name, value)
      ? value
      : PREFERENCES[name].defaultValue;

    return preferences;
  }, {});
}

function getDefaultPreferences() {
  return PREFERENCE_NAMES.reduce((preferences, name) => {
    preferences[name] = PREFERENCES[name].defaultValue;

    return preferences;
  }, {});
}

function getState() {
  state ??= readStoredPreferences();

  return state;
}

/* ==========================================================================
   Theme Resolution
   ========================================================================== */

function resolveTheme(choice) {
  if (choice !== "system") {
    return choice;
  }

  return systemThemeQuery?.matches ? "dark" : "light";
}

/* ==========================================================================
   Root Attributes
   ========================================================================== */

/**
 * Skips unchanged values, so attribute observers (Motion, the ticker)
 * never receive meaningless mutations.
 */

function setRootAttribute(name, value) {
  const normalizedValue = String(value);

  if (root.getAttribute(name) === normalizedValue) {
    return;
  }

  root.setAttribute(name, normalizedValue);
}

/* ==========================================================================
   Transition Suppression
   ========================================================================== */

function beginTransitionSuppression() {
  if (transitionFrame !== null) {
    window.cancelAnimationFrame(transitionFrame);

    transitionFrame = null;
  }

  root.classList.add("is-theme-switching");
}

/**
 * Held across two frames: the first lets the new tokens reach style
 * calculation, the second releases suppression once they have settled.
 */

function finishTransitionSuppression() {
  transitionFrame = window.requestAnimationFrame(() => {
    transitionFrame = window.requestAnimationFrame(() => {
      root.classList.remove("is-theme-switching");

      transitionFrame = null;
    });
  });
}

/* ==========================================================================
   Apply Preferences
   ========================================================================== */

function applyPreferences(preferences, { suppressTransitions = false } = {}) {
  if (suppressTransitions) {
    beginTransitionSuppression();
  }

  setRootAttribute("data-theme", resolveTheme(preferences.theme));

  PREFERENCE_NAMES.forEach((name) => {
    setRootAttribute(PREFERENCES[name].attribute, preferences[name]);
  });

  if (suppressTransitions) {
    finishTransitionSuppression();
  }
}

/* ==========================================================================
   UI State
   ========================================================================== */

function setSelectedState(control, isSelected) {
  control.classList.toggle("is-active", isSelected);

  const attribute = CHECKED_ROLES.has(control.getAttribute("role"))
    ? "aria-checked"
    : "aria-pressed";

  control.setAttribute(attribute, String(isSelected));
}

/**
 * aria-disabled rather than the disabled property: a disabled button drops
 * keyboard focus, stranding users who press "larger" up to the limit.
 */

function setUnavailableState(control, isUnavailable) {
  control.setAttribute("aria-disabled", String(isUnavailable));
}

function isUnavailable(control) {
  return control.getAttribute("aria-disabled") === "true";
}

function syncChoiceControls(preferences) {
  document.querySelectorAll(SELECTORS.choice).forEach((control) => {
    const name = control.getAttribute("data-preference");

    const value = control.getAttribute("data-preference-set");

    setSelectedState(control, preferences[name] === value);
  });
}

function syncToggleControls(preferences) {
  document.querySelectorAll(SELECTORS.toggle).forEach((control) => {
    const name = control.getAttribute("data-preference-toggle");

    const onValue = control.getAttribute("data-preference-on");

    setSelectedState(control, preferences[name] === onValue);
  });
}

function syncFontControls(preferences) {
  const index = FONT_SIZE_STEPS.indexOf(preferences.fontSize);

  const lastIndex = FONT_SIZE_STEPS.length - 1;

  const labels = FONT_SIZE_LABELS[getDocumentLanguage()];

  const label =
    labels[preferences.fontSize] ?? labels[PREFERENCES.fontSize.defaultValue];

  document.querySelectorAll(SELECTORS.fontDecrease).forEach((control) => {
    setUnavailableState(control, index <= 0);
  });

  document.querySelectorAll(SELECTORS.fontIncrease).forEach((control) => {
    setUnavailableState(control, index >= lastIndex);
  });

  document.querySelectorAll(SELECTORS.fontReset).forEach((control) => {
    control.classList.toggle(
      "is-active",
      preferences.fontSize === PREFERENCES.fontSize.defaultValue,
    );
  });

  /* Only write real changes, so the live region never repeats itself. */

  document.querySelectorAll(SELECTORS.fontStatus).forEach((status) => {
    if (status.textContent !== label) {
      status.textContent = label;
    }
  });
}

function syncPreferencesUI(preferences) {
  syncChoiceControls(preferences);
  syncToggleControls(preferences);
  syncFontControls(preferences);
}

/**
 * Font-size changes are announced politely unless the markup already
 * defines its own live-region semantics.
 */

function prepareStatusRegions() {
  document.querySelectorAll(SELECTORS.fontStatus).forEach((status) => {
    if (!status.hasAttribute("role") && !status.hasAttribute("aria-live")) {
      status.setAttribute("role", "status");
    }
  });
}

function commit({ suppressTransitions = false } = {}) {
  const preferences = getState();

  applyPreferences(preferences, { suppressTransitions });

  syncPreferencesUI(preferences);
}

/* ==========================================================================
   Events
   ========================================================================== */

function dispatch(type, detail) {
  document.dispatchEvent(new CustomEvent(type, { detail }));
}

function emitPreferenceChange(name) {
  dispatch("preferencechange", {
    name,
    value: name === null ? null : getState()[name],
    preferences: getPreferences(),
  });
}

/**
 * A reset also emits preferencechange (name: null) so consumers that only
 * listen for changes still react.
 */

function emitPreferencesReset() {
  dispatch("preferencesreset", {
    preferences: getPreferences(),
  });

  emitPreferenceChange(null);
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function getPreferences() {
  return { ...getState() };
}

export function setPreference(name, value) {
  if (!isValidPreference(name, value)) {
    console.warn(`Invalid preference: ${name}="${value}"`);

    return false;
  }

  const current = getState();

  if (current[name] === value) {
    return true;
  }

  state = { ...current, [name]: value };

  writeStorage(PREFERENCES[name].storageKey, value);

  commit({ suppressTransitions: PREFERENCES[name].suppressTransitions });

  emitPreferenceChange(name);

  return true;
}

export function resetPreferences() {
  state = getDefaultPreferences();

  signalResetToOtherTabs();

  PREFERENCE_NAMES.forEach((name) => {
    removeStorage(PREFERENCES[name].storageKey);
  });

  /* Theme, accent, contrast and size may all change: one visual boundary. */

  commit({ suppressTransitions: true });

  emitPreferencesReset();
}

/**
 * Re-sync controls rendered after initialization (e.g. a settings panel
 * injected on demand).
 */

export function refreshPreferencesUI() {
  prepareStatusRegions();

  syncPreferencesUI(getState());
}

/* ==========================================================================
   Font Size
   ========================================================================== */

function stepFontSize(direction) {
  const index = FONT_SIZE_STEPS.indexOf(getState().fontSize);

  const nextIndex = clamp(index + direction, 0, FONT_SIZE_STEPS.length - 1);

  setPreference("fontSize", FONT_SIZE_STEPS[nextIndex]);
}

export function increaseFontSize() {
  stepFontSize(1);
}

export function decreaseFontSize() {
  stepFontSize(-1);
}

export function resetFontSize() {
  setPreference("fontSize", PREFERENCES.fontSize.defaultValue);
}

/* ==========================================================================
   Toggle Controls
   ========================================================================== */

function togglePreference(control) {
  const name = control.getAttribute("data-preference-toggle");

  const onValue = control.getAttribute("data-preference-on");

  const offValue = control.getAttribute("data-preference-off");

  if (!isValidPreference(name, onValue) || !isValidPreference(name, offValue)) {
    return;
  }

  setPreference(name, getState()[name] === onValue ? offValue : onValue);
}

/* ==========================================================================
   Interaction
   ========================================================================== */

function handlePreferenceClick(event) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const choice = target.closest(SELECTORS.choice);

  if (choice) {
    setPreference(
      choice.getAttribute("data-preference"),
      choice.getAttribute("data-preference-set"),
    );

    return;
  }

  const toggle = target.closest(SELECTORS.toggle);

  if (toggle) {
    togglePreference(toggle);

    return;
  }

  const fontControl = target.closest(FONT_CONTROL_SELECTOR);

  if (fontControl) {
    if (isUnavailable(fontControl)) {
      return;
    }

    if (fontControl.matches(SELECTORS.fontDecrease)) {
      decreaseFontSize();
    } else if (fontControl.matches(SELECTORS.fontIncrease)) {
      increaseFontSize();
    } else {
      resetFontSize();
    }

    return;
  }

  if (target.closest(SELECTORS.reset)) {
    resetPreferences();
  }
}

/* ==========================================================================
   System Theme
   ========================================================================== */

/**
 * The stored choice stays "system"; only its resolved light/dark value
 * changes. Many colour tokens swap at once, so transitions are suppressed.
 */

function handleSystemThemeChange() {
  const preferences = getState();

  if (preferences.theme !== "system") {
    return;
  }

  applyPreferences(preferences, { suppressTransitions: true });
}

/* ==========================================================================
   Cross-tab Synchronization
   ========================================================================== */

/**
 * A reset in another tab removes every key, which arrives here as several
 * separate storage events. The marker is written before those removals so
 * the batch is recognised as one reset.
 */

function signalResetToOtherTabs() {
  writeStorage(RESET_SIGNAL_KEY, String(Date.now()));

  removeStorage(RESET_SIGNAL_KEY);
}

function handleStorageChange(event) {
  const storage = getStorage();

  if (!storage || (event.storageArea && event.storageArea !== storage)) {
    return;
  }

  /* key === null means another tab cleared localStorage entirely. */

  const isReset = event.key === null || event.key === RESET_SIGNAL_KEY;

  if (!isReset && !STORAGE_KEYS.has(event.key)) {
    return;
  }

  if (isReset) {
    storageResetPending = true;
  }

  scheduleStorageSync();
}

/**
 * Batches every storage event that arrives before the next frame into a
 * single apply, so a multi-key change repaints once.
 */

function scheduleStorageSync() {
  if (storageSyncFrame !== null) {
    return;
  }

  storageSyncFrame = window.requestAnimationFrame(syncFromStorage);
}

function syncFromStorage() {
  storageSyncFrame = null;

  const isReset = storageResetPending;

  storageResetPending = false;

  const previous = getState();

  state = readStoredPreferences();

  const changed = PREFERENCE_NAMES.filter(
    (name) => previous[name] !== state[name],
  );

  if (!isReset && changed.length === 0) {
    return;
  }

  commit({
    suppressTransitions:
      isReset || changed.some((name) => PREFERENCES[name].suppressTransitions),
  });

  if (isReset) {
    emitPreferencesReset();

    return;
  }

  changed.forEach((name) => {
    emitPreferenceChange(name);
  });
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initPreferences() {
  if (isInitialized) {
    return;
  }

  isInitialized = true;

  state = readStoredPreferences();

  /*
   * Startup establishes state; it is not a live switch, so transitions are
   * not suppressed. The head bootstrap has usually applied the same values
   * already, and unchanged attributes are skipped.
   */

  applyPreferences(state);

  prepareStatusRegions();

  syncPreferencesUI(state);

  document.addEventListener("click", handlePreferenceClick);

  onMediaQueryChange(systemThemeQuery, handleSystemThemeChange);

  window.addEventListener("storage", handleStorageChange);
}
