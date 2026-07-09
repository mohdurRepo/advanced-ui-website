import { getPreferences } from "./preferences";

const drawer = document.querySelector("[data-preferences]");
const toggle = document.querySelector("[data-preferences-toggle]");
const panel = document.querySelector("[data-preferences-panel]");

function closePreferences() {
  drawer?.classList.remove("is-open");
  drawer?.setAttribute("aria-hidden", "true");
  toggle?.setAttribute("aria-expanded", "false");
}

function openPreferences() {
  drawer?.classList.add("is-open");
  drawer?.setAttribute("aria-hidden", "false");
  toggle?.setAttribute("aria-expanded", "true");
}

function togglePreferences() {
  drawer?.classList.contains("is-open")
    ? closePreferences()
    : openPreferences();
}

function syncActivePreferenceButtons() {
  const preferences = getPreferences();

  document.querySelectorAll("[data-preference]").forEach((button) => {
    const name = button.getAttribute("data-preference");
    const value = button.getAttribute("data-preference-set");

    button.classList.toggle("is-active", preferences[name] === value);
  });

  document.querySelectorAll("[data-font-reset]").forEach((button) => {
    button.classList.toggle("is-active", preferences.fontSize === "0");
  });
}

export function initPreferencesUI() {
  if (!drawer || !toggle || !panel) return;

  syncActivePreferenceButtons();

  document.addEventListener("preferencechange", syncActivePreferenceButtons);

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-preferences-toggle]")) {
      togglePreferences();
      return;
    }

    if (event.target.closest("[data-preferences-close]")) {
      closePreferences();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePreferences();
  });
}
