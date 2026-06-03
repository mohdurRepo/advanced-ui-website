const LANGUAGE_STORAGE_KEY = "se-lang";
const LANGUAGES = ["en", "ar"];

function isValidLanguage(lang) {
  return LANGUAGES.includes(lang);
}

function getCurrentLanguage() {
  const bootLang = window.APP_LOCALE?.lang;
  const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);

  if (isValidLanguage(bootLang)) return bootLang;
  if (isValidLanguage(savedLang)) return savedLang;

  return "en";
}

function applyLanguage(lang) {
  const safeLang = isValidLanguage(lang) ? lang : "en";
  const dir = safeLang === "ar" ? "rtl" : "ltr";

  document.documentElement.lang = safeLang;
  document.documentElement.dir = dir;

  localStorage.setItem(LANGUAGE_STORAGE_KEY, safeLang);

  window.APP_LOCALE = {
    ...(window.APP_LOCALE || {}),
    lang: safeLang,
    dir,
  };

  document.dispatchEvent(
    new CustomEvent("languagechange", {
      detail: { lang: safeLang, dir },
    }),
  );
}

export function initLanguage() {
  const currentLang = getCurrentLanguage();

  // Important: apply same value only, no default reset.
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

  document.addEventListener("click", (event) => {
    const setButton = event.target.closest("[data-lang-set]");
    const toggleButton = event.target.closest("[data-lang-toggle]");

    if (setButton) {
      applyLanguage(setButton.getAttribute("data-lang-set"));
      return;
    }

    if (toggleButton) {
      const nextLang = getCurrentLanguage() === "ar" ? "en" : "ar";
      applyLanguage(nextLang);
    }
  });
}
