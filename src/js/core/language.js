const STORAGE_KEY = "se-lang";
const SUPPORTED_LANGUAGES = ["en", "ar"];
const DEFAULT_LANGUAGE = "en";

const root = document.documentElement;

function isValidLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

function getStoredLanguage() {
  const storedLanguage = localStorage.getItem(STORAGE_KEY);

  return isValidLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
}

function getDirection(language) {
  return language === "ar" ? "rtl" : "ltr";
}

function getNextLanguage(language) {
  return language === "ar" ? "en" : "ar";
}

function getLanguageLabel(language) {
  return language.toUpperCase();
}

function syncLanguageButtons(language) {
  document.querySelectorAll("[data-lang-toggle]").forEach((button) => {
    const nextLanguage = getNextLanguage(language);
    const currentLabel = button.querySelector(".header-lang-switch__current");

    if (currentLabel) {
      currentLabel.textContent = getLanguageLabel(language);
    }

    button.setAttribute(
      "aria-label",
      nextLanguage === "ar"
        ? "Switch language to Arabic"
        : "Switch language to English",
    );

    button.setAttribute("data-current-language", language);
  });
}

function applyLanguage(language) {
  const direction = getDirection(language);

  root.lang = language;
  root.dir = direction;

  window.APP_LOCALE = {
    ...(window.APP_LOCALE || {}),
    lang: language,
    dir: direction,
  };

  syncLanguageButtons(language);
}

function emitLanguageChange(language) {
  document.dispatchEvent(
    new CustomEvent("languagechange", {
      detail: {
        language,
        direction: getDirection(language),
      },
    }),
  );
}

export function getLanguage() {
  return getStoredLanguage();
}

export function setLanguage(language) {
  if (!isValidLanguage(language)) {
    console.warn(`Unsupported language: "${language}"`);
    return false;
  }

  localStorage.setItem(STORAGE_KEY, language);

  applyLanguage(language);
  emitLanguageChange(language);

  return true;
}

export function toggleLanguage() {
  const currentLanguage = getStoredLanguage();
  const nextLanguage = getNextLanguage(currentLanguage);

  setLanguage(nextLanguage);
}

function handleLanguageClick(event) {
  const trigger = event.target.closest("[data-lang-toggle]");

  if (!trigger) return;

  toggleLanguage();
}

export function initLanguage() {
  applyLanguage(getStoredLanguage());

  document.addEventListener("click", handleLanguageClick);
}
