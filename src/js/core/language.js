const LANGUAGE_STORAGE_KEY = "se-language";

const LANGUAGES = {
  en: {
    lang: "en",
    dir: "ltr",
  },
  ar: {
    lang: "ar",
    dir: "rtl",
  },
};

const DEFAULT_LANGUAGE = "en";
const root = document.documentElement;

function isValidLanguage(language) {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, language);
}

function getSavedLanguage() {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY);
}

export function setLanguage(language) {
  const nextLanguage = isValidLanguage(language) ? language : DEFAULT_LANGUAGE;

  const config = LANGUAGES[nextLanguage];

  root.setAttribute("lang", config.lang);
  root.setAttribute("dir", config.dir);

  localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);

  document.dispatchEvent(
    new CustomEvent("languagechange", {
      detail: {
        language: nextLanguage,
        direction: config.dir,
      },
    }),
  );
}

export function getLanguage() {
  return root.getAttribute("lang") || DEFAULT_LANGUAGE;
}

export function toggleLanguage() {
  const currentLanguage = getLanguage();
  const nextLanguage = currentLanguage === "ar" ? "en" : "ar";

  setLanguage(nextLanguage);
}

export function initLanguage() {
  const savedLanguage = getSavedLanguage();
  const initialLanguage = isValidLanguage(savedLanguage)
    ? savedLanguage
    : DEFAULT_LANGUAGE;

  setLanguage(initialLanguage);

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lang-set]");

    if (!trigger) return;

    setLanguage(trigger.getAttribute("data-lang-set"));
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lang-toggle]");

    if (!trigger) return;

    toggleLanguage();
  });
}
