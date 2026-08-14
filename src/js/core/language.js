/* ==========================================================================
   Language Management
   ========================================================================== */

const STORAGE_KEY = "se-lang";
const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = new Set(["en", "ar"]);

const LANGUAGE_TOGGLE_SELECTOR = "[data-lang-toggle]";
const CURRENT_LANGUAGE_SELECTOR = ".header-lang-switch__current";

const root = document.documentElement;

let initialized = false;

/* ==========================================================================
   Language Helpers
   ========================================================================== */

function normalizeLanguage(value) {
  if (typeof value !== "string") return null;

  const language = value.trim().toLowerCase().replace("_", "-").split("-")[0];

  return SUPPORTED_LANGUAGES.has(language) ? language : null;
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

/**
 * Returns the language explicitly assigned to the current page.
 *
 * data-page-language is checked first because an early theme script might
 * have changed the regular lang attribute using localStorage.
 *
 * Recommended markup:
 * <html lang="ar" dir="rtl" data-page-language="ar">
 */
function getPageLanguage() {
  return (
    normalizeLanguage(root.dataset.pageLanguage) ||
    normalizeLanguage(root.getAttribute("lang"))
  );
}

function getStoredLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    // Storage can be unavailable in restricted/private environments.
    return null;
  }
}

function storeLanguage(language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch (error) {
    // The page can still switch language without persistent storage.
  }
}

function getInitialLanguage() {
  return getPageLanguage() || getStoredLanguage() || DEFAULT_LANGUAGE;
}

export function getLanguage() {
  return (
    normalizeLanguage(root.getAttribute("lang")) ||
    getPageLanguage() ||
    getStoredLanguage() ||
    DEFAULT_LANGUAGE
  );
}

/* ==========================================================================
   Language URLs
   ========================================================================== */

/**
 * Finds a URL for the requested language.
 *
 * Supported markup option 1:
 *
 * <button
 *   data-lang-toggle
 *   data-lang-url-ar="/ar/page"
 *   data-lang-url-en="/en/page">
 * </button>
 *
 * Supported markup option 2:
 *
 * <link rel="alternate" hreflang="ar" href="/ar/page">
 * <link rel="alternate" hreflang="en" href="/en/page">
 */
function getLanguageUrl(language, trigger = null) {
  const triggerUrl = trigger?.getAttribute(`data-lang-url-${language}`);

  if (triggerUrl) {
    return triggerUrl;
  }

  const alternateLink = document.querySelector(
    `link[rel~="alternate"][hreflang="${language}"]`,
  );

  if (alternateLink?.href) {
    return alternateLink.href;
  }

  return null;
}

function isCurrentUrl(url) {
  if (!url) return false;

  try {
    const targetUrl = new URL(url, window.location.href);

    return targetUrl.href === window.location.href;
  } catch (error) {
    return false;
  }
}

/* ==========================================================================
   Interface Synchronization
   ========================================================================== */

function syncLanguageButton(button, language) {
  const nextLanguage = getNextLanguage(language);
  const currentLabel = button.querySelector(CURRENT_LANGUAGE_SELECTOR);

  button.setAttribute("data-current-language", language);
  button.setAttribute("data-target-language", nextLanguage);

  button.setAttribute(
    "aria-label",
    nextLanguage === "ar"
      ? "Switch language to Arabic"
      : "Switch language to English",
  );

  if (currentLabel) {
    currentLabel.textContent = getLanguageLabel(language);
  }
}

function syncLanguageButtons(language) {
  document.querySelectorAll(LANGUAGE_TOGGLE_SELECTOR).forEach((button) => {
    syncLanguageButton(button, language);
  });
}

/* ==========================================================================
   Applying Language
   ========================================================================== */

function applyLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);

  if (!normalizedLanguage) return false;

  const previousLanguage = normalizeLanguage(root.getAttribute("lang"));

  const direction = getDirection(normalizedLanguage);

  root.setAttribute("lang", normalizedLanguage);
  root.setAttribute("dir", direction);

  window.APP_LOCALE = {
    ...(window.APP_LOCALE || {}),
    lang: normalizedLanguage,
    dir: direction,
  };

  syncLanguageButtons(normalizedLanguage);

  return {
    language: normalizedLanguage,
    direction,
    previousLanguage,
  };
}

function emitLanguageChange(result) {
  if (!result) return;

  document.dispatchEvent(
    new CustomEvent("languagechange", {
      detail: {
        language: result.language,
        direction: result.direction,
        previousLanguage: result.previousLanguage,
      },
    }),
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

/**
 * Applies a language to the current document.
 *
 * This method does not navigate. It is appropriate for static pages or
 * client-rendered applications that respond to the languagechange event.
 */
export function setLanguage(language, { persist = true, emit = true } = {}) {
  const normalizedLanguage = normalizeLanguage(language);

  if (!normalizedLanguage) {
    console.warn(`Unsupported language: "${language}"`);
    return false;
  }

  if (persist) {
    storeLanguage(normalizedLanguage);
  }

  const result = applyLanguage(normalizedLanguage);

  if (emit) {
    emitLanguageChange(result);
  }

  return Boolean(result);
}

/**
 * Switches to the other language.
 *
 * If a localized URL is configured, the browser navigates to it.
 * Otherwise, the current static page changes lang and dir in place.
 */
export function toggleLanguage(trigger = null) {
  const currentLanguage = getLanguage();
  const nextLanguage = getNextLanguage(currentLanguage);
  const targetUrl = getLanguageUrl(nextLanguage, trigger);

  storeLanguage(nextLanguage);

  if (targetUrl && !isCurrentUrl(targetUrl)) {
    window.location.assign(targetUrl);
    return true;
  }

  return setLanguage(nextLanguage, {
    persist: false,
    emit: true,
  });
}

/* ==========================================================================
   Event Handlers
   ========================================================================== */

function handleLanguageClick(event) {
  if (!(event.target instanceof Element)) return;

  const trigger = event.target.closest(LANGUAGE_TOGGLE_SELECTOR);

  if (!trigger) return;

  event.preventDefault();
  toggleLanguage(trigger);
}

function handleStorageChange(event) {
  if (event.key !== STORAGE_KEY) return;

  const language = normalizeLanguage(event.newValue);

  if (!language || language === getLanguage()) return;

  setLanguage(language, {
    persist: false,
    emit: true,
  });
}

function handlePageShow() {
  const language = getPageLanguage() || getStoredLanguage();

  if (!language) return;

  setLanguage(language, {
    persist: false,
    emit: false,
  });
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initLanguage() {
  const language = getInitialLanguage();

  setLanguage(language, {
    /*
     * Do not persist automatically. Storage should represent an explicit
     * user choice, not merely the language of a page they visited.
     */
    persist: false,
    emit: false,
  });

  if (initialized) return;

  initialized = true;

  document.addEventListener("click", handleLanguageClick);
  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("pageshow", handlePageShow);
}
