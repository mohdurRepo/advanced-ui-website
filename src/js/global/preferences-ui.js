import { getPreferences } from "./preferences";

function setActiveState(button, isActive) {
  button.classList.toggle("is-active", isActive);
  button.setAttribute("aria-pressed", String(isActive));
}

function syncPreferenceButtons() {
  const preferences = getPreferences();

  document
    .querySelectorAll("[data-preference][data-preference-set]")
    .forEach((button) => {
      const name = button.getAttribute("data-preference");
      const value = button.getAttribute("data-preference-set");

      setActiveState(button, preferences[name] === value);
    });

  document.querySelectorAll("[data-font-reset]").forEach((button) => {
    setActiveState(button, preferences.fontSize === "0");
  });
}

function syncFontControls() {
  const { fontSize } = getPreferences();
  const numericSize = Number(fontSize);

  document.querySelectorAll("[data-font-decrease]").forEach((button) => {
    button.disabled = numericSize <= -2;
  });

  document.querySelectorAll("[data-font-increase]").forEach((button) => {
    button.disabled = numericSize >= 2;
  });
}

function syncPreferencesUI() {
  syncPreferenceButtons();
  syncFontControls();
}

export function initPreferencesUI() {
  const preferenceControls = document.querySelector(
    [
      "[data-preference]",
      "[data-font-increase]",
      "[data-font-decrease]",
      "[data-font-reset]",
    ].join(","),
  );

  if (!preferenceControls) return;

  syncPreferencesUI();

  document.addEventListener("preferencechange", syncPreferencesUI);

  document.addEventListener("preferencesreset", syncPreferencesUI);
}
