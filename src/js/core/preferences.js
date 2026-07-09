const STORAGE_KEYS = {
  lang: "se-lang",
  theme: "se-theme",
  accent: "se-accent",
  fontSize: "se-font-size",
  contrast: "se-contrast",
  motion: "se-motion",
};

const OPTIONS = {
  lang: ["en", "ar"],
  theme: ["light", "dark", "system"],
  accent: ["blue", "navy", "teal", "green", "grey"],
  fontSize: ["-2", "-1", "0", "1", "2"],
  contrast: ["normal", "high"],
  motion: ["normal", "reduce"],
};

const DEFAULTS = {
  lang: "en",
  theme: "system",
  accent: "blue",
  fontSize: "0",
  contrast: "normal",
  motion: "normal",
};

const FONT_SIZE_LEVELS = ["-2", "-1", "0", "1", "2"];

const root = document.documentElement;

function isValid(name, value) {
  return OPTIONS[name]?.includes(value);
}

function getStored(name) {
  const value = localStorage.getItem(STORAGE_KEYS[name]);

  return isValid(name, value) ? value : DEFAULTS[name];
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme) {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyPreferences(preferences) {
  const lang = preferences.lang;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const resolvedTheme = resolveTheme(preferences.theme);

  root.lang = lang;
  root.dir = dir;

  root.setAttribute("data-theme", resolvedTheme);
  root.setAttribute("data-theme-choice", preferences.theme);
  root.setAttribute("data-accent", preferences.accent);
  root.setAttribute("data-font-size", preferences.fontSize);
  root.setAttribute("data-contrast", preferences.contrast);
  root.setAttribute("data-motion", preferences.motion);

  window.APP_LOCALE = {
    ...(window.APP_LOCALE || {}),
    lang,
    dir,
  };
}

export function getPreferences() {
  return {
    lang: getStored("lang"),
    theme: getStored("theme"),
    accent: getStored("accent"),
    fontSize: getStored("fontSize"),
    contrast: getStored("contrast"),
    motion: getStored("motion"),
  };
}

export function setPreference(name, value) {
  if (!isValid(name, value)) return;

  localStorage.setItem(STORAGE_KEYS[name], value);

  const preferences = getPreferences();

  applyPreferences(preferences);

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

export function toggleLanguage() {
  const current = getStored("lang");

  setPreference("lang", current === "ar" ? "en" : "ar");
}

export function increaseFontSize() {
  const current = getStored("fontSize");
  const index = FONT_SIZE_LEVELS.indexOf(current);
  const next =
    FONT_SIZE_LEVELS[Math.min(index + 1, FONT_SIZE_LEVELS.length - 1)];

  setPreference("fontSize", next);
}

export function decreaseFontSize() {
  const current = getStored("fontSize");
  const index = FONT_SIZE_LEVELS.indexOf(current);
  const next = FONT_SIZE_LEVELS[Math.max(index - 1, 0)];

  setPreference("fontSize", next);
}

export function resetFontSize() {
  setPreference("fontSize", "0");
}

export function initPreferences() {
  applyPreferences(getPreferences());

  document.addEventListener("click", (event) => {
    const setButton = event.target.closest("[data-preference-set]");
    const langToggle = event.target.closest("[data-lang-toggle]");
    const themeToggle = event.target.closest("[data-theme-toggle]");
    const fontIncrease = event.target.closest("[data-font-increase]");
    const fontDecrease = event.target.closest("[data-font-decrease]");
    const fontReset = event.target.closest("[data-font-reset]");

    if (setButton) {
      setPreference(
        setButton.getAttribute("data-preference"),
        setButton.getAttribute("data-preference-set"),
      );
      return;
    }

    if (langToggle) {
      toggleLanguage();
      return;
    }

    if (themeToggle) {
      const current = getStored("theme");
      const next = current === "dark" ? "light" : "dark";

      setPreference("theme", next);
      return;
    }

    if (fontIncrease) {
      increaseFontSize();
      return;
    }

    if (fontDecrease) {
      decreaseFontSize();
      return;
    }

    if (fontReset) {
      resetFontSize();
    }
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getStored("theme") === "system") {
        applyPreferences(getPreferences());
      }
    });
}
