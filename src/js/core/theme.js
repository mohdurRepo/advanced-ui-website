const THEME_STORAGE_KEY = "se-theme";
const DEFAULT_THEME = "light";
const THEMES = ["light", "dark"];

const root = document.documentElement;

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getSavedTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY);
}

function isValidTheme(theme) {
  return THEMES.includes(theme);
}

export function setTheme(theme) {
  const nextTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;

  root.setAttribute("data-theme", nextTheme);
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

  document.dispatchEvent(
    new CustomEvent("themechange", {
      detail: { theme: nextTheme },
    }),
  );
}

export function getTheme() {
  return root.getAttribute("data-theme") || DEFAULT_THEME;
}

export function toggleTheme() {
  const currentTheme = getTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  setTheme(nextTheme);
}

export function initTheme() {
  const savedTheme = getSavedTheme();
  const initialTheme = isValidTheme(savedTheme) ? savedTheme : getSystemTheme();

  setTheme(initialTheme);

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-theme-set]");

    if (!trigger) return;

    const theme = trigger.getAttribute("data-theme-set");

    setTheme(theme);
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-theme-toggle]");

    if (!trigger) return;

    toggleTheme();
  });
}
