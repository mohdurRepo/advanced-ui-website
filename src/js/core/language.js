const STORAGE_KEY = "se-lang";
const SUPPORTED_LANGUAGES = ["en", "ar"];
const DEFAULT_LANGUAGE = "en";

const root = document.documentElement;

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizeLanguage(language) {
  return String(language || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
}

function isValidLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

function getDocumentLanguage() {
  const language = normalizeLanguage(root.lang);

  return isValidLanguage(language) ? language : DEFAULT_LANGUAGE;
}

function getStoredLanguage() {
  const storedLanguage = normalizeLanguage(localStorage.getItem(STORAGE_KEY));

  /*
   * On the first visit, use the portal-rendered language instead of
   * incorrectly defaulting an Arabic page to English.
   */
  return isValidLanguage(storedLanguage)
    ? storedLanguage
    : getDocumentLanguage();
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

/* ==========================================================================
   Language switch UI
   ========================================================================== */

function syncLanguageButtons(language) {
  const nextLanguage = getNextLanguage(language);

  document.querySelectorAll("[data-lang-toggle]").forEach((element) => {
    const label = element.querySelector(".header-lang-switch__current");

    /*
     * Display the language that the link will switch to.
     */
    if (label) {
      label.textContent = getLanguageLabel(nextLanguage);
    }

    element.setAttribute(
      "aria-label",
      nextLanguage === "ar"
        ? "Switch language to Arabic"
        : "Switch language to English",
    );

    element.setAttribute("hreflang", nextLanguage);
    element.setAttribute("data-current-language", language);
    element.setAttribute("data-next-language", nextLanguage);
  });
}

/* ==========================================================================
   Apply language
   ========================================================================== */

function applyLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);

  if (!isValidLanguage(normalizedLanguage)) {
    return false;
  }

  const direction = getDirection(normalizedLanguage);

  root.lang = normalizedLanguage;
  root.dir = direction;

  window.APP_LOCALE = {
    ...(window.APP_LOCALE || {}),
    lang: normalizedLanguage,
    dir: direction,
  };

  syncLanguageButtons(normalizedLanguage);

  return true;
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

/* ==========================================================================
   Public API
   ========================================================================== */

export function getLanguage() {
  return getStoredLanguage();
}

export function setLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);

  if (!isValidLanguage(normalizedLanguage)) {
    console.warn(`Unsupported language: "${language}"`);
    return false;
  }

  localStorage.setItem(STORAGE_KEY, normalizedLanguage);

  applyLanguage(normalizedLanguage);
  emitLanguageChange(normalizedLanguage);

  return true;
}

export function toggleLanguage() {
  const currentLanguage = getStoredLanguage();
  const nextLanguage = getNextLanguage(currentLanguage);

  return setLanguage(nextLanguage);
}

/* ==========================================================================
   Events
   ========================================================================== */

function handleLanguageClick(event) {
  const trigger = event.target.closest("[data-lang-toggle]");

  if (!trigger) return;

  /*
   * Do not call preventDefault().
   * Save the selected language and allow the portal URL to navigate.
   */
  const nextLanguage = normalizeLanguage(
    trigger.getAttribute("data-next-language"),
  );

  setLanguage(
    isValidLanguage(nextLanguage)
      ? nextLanguage
      : getNextLanguage(getStoredLanguage()),
  );
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initLanguage() {
  const language = getStoredLanguage();

  /*
   * Ensure se-lang exists after the first page visit.
   */
  localStorage.setItem(STORAGE_KEY, language);

  applyLanguage(language);

  document.removeEventListener("click", handleLanguageClick);
  document.addEventListener("click", handleLanguageClick);
}
