const STORAGE_KEYS = {
  theme: "se-theme",
  accent: "se-accent",
  fontSize: "se-font-size",
  contrast: "se-contrast",
  motion: "se-motion",
};

const OPTIONS = {
  theme: ["light", "dark", "system"],
  accent: ["blue", "navy", "teal", "green", "grey"],
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

const FONT_SIZE_LEVELS = OPTIONS.fontSize;

const root = document.documentElement;
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

function isValidPreference(name, value) {
  return OPTIONS[name]?.includes(value) ?? false;
}

function getStoredPreference(name) {
  const storageKey = STORAGE_KEYS[name];
  const storedValue = localStorage.getItem(storageKey);

  return isValidPreference(name, storedValue) ? storedValue : DEFAULTS[name];
}

function resolveTheme(theme) {
  if (theme !== "system") return theme;

  return systemThemeQuery.matches ? "dark" : "light";
}

function applyPreferences(preferences) {
  root.setAttribute("data-theme", resolveTheme(preferences.theme));

  root.setAttribute("data-theme-choice", preferences.theme);

  root.setAttribute("data-accent", preferences.accent);

  root.setAttribute("data-font-size", preferences.fontSize);

  root.setAttribute("data-contrast", preferences.contrast);

  root.setAttribute("data-motion", preferences.motion);
}

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

function moveFontSize(direction) {
  const currentValue = getStoredPreference("fontSize");
  const currentIndex = FONT_SIZE_LEVELS.indexOf(currentValue);

  const nextIndex = Math.min(
    Math.max(currentIndex + direction, 0),
    FONT_SIZE_LEVELS.length - 1,
  );

  setPreference("fontSize", FONT_SIZE_LEVELS[nextIndex]);
}

function handlePreferenceClick(event) {
  const preferenceButton = event.target.closest(
    "[data-preference][data-preference-set]",
  );

  if (preferenceButton) {
    setPreference(
      preferenceButton.getAttribute("data-preference"),
      preferenceButton.getAttribute("data-preference-set"),
    );

    return;
  }

  if (event.target.closest("[data-font-increase]")) {
    increaseFontSize();
    return;
  }

  if (event.target.closest("[data-font-decrease]")) {
    decreaseFontSize();
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

function handleSystemThemeChange() {
  if (getStoredPreference("theme") !== "system") return;

  applyPreferences(getPreferences());
}

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

  localStorage.setItem(STORAGE_KEYS[name], value);

  const preferences = getPreferences();

  applyPreferences(preferences);
  emitPreferenceChange(name, value, preferences);

  return true;
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

export function resetPreferences() {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });

  const preferences = getPreferences();

  applyPreferences(preferences);

  document.dispatchEvent(
    new CustomEvent("preferencesreset", {
      detail: {
        preferences,
      },
    }),
  );

  document.dispatchEvent(
    new CustomEvent("preferencechange", {
      detail: {
        name: null,
        value: null,
        preferences,
      },
    }),
  );
}

export function initPreferences() {
  applyPreferences(getPreferences());

  document.addEventListener("click", handlePreferenceClick);
  systemThemeQuery.addEventListener("change", handleSystemThemeChange);
}
