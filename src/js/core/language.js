/* ==========================================================================
   Language Management
   ========================================================================== */

const STORAGE_KEY = "se-lang";
const DIRECTION_STORAGE_KEY = "se-dir";

const SUPPORTED_LANGUAGES = new Set(["en", "ar"]);

const DEFAULT_LANGUAGE = "en";
const LOCALE_PARAMETER = "locale";

const LANGUAGE_TOGGLE_SELECTOR = [
  "[data-lang-toggle]",
  "[data-language-switch]",
].join(",");

const root = document.documentElement;

let initialized = false;

/* ==========================================================================
   Language Helpers
   ========================================================================== */

function normalizeLanguage(value) {
  if (typeof value !== "string") {
    return null;
  }

  const language = value.trim().toLowerCase().replace("_", "-").split("-")[0];

  return SUPPORTED_LANGUAGES.has(language) ? language : null;
}

function getDirection(language) {
  return language === "ar" ? "rtl" : "ltr";
}

function getNextLanguage(language) {
  return language === "ar" ? "en" : "ar";
}

/* ==========================================================================
   URL Language
   ========================================================================== */

function getUrlLanguage() {
  try {
    const parameters = new URLSearchParams(window.location.search);

    return normalizeLanguage(parameters.get(LOCALE_PARAMETER));
  } catch {
    return null;
  }
}

/**
 * Updates the current static-page URL without reloading.
 *
 * This is used only for client-side language controls.
 * Portal language anchors retain their existing href and navigate normally.
 */
function updateStaticUrlLanguage(language) {
  if (!window.history?.replaceState) {
    return;
  }

  try {
    const url = new URL(window.location.href);

    url.searchParams.set(LOCALE_PARAMETER, language);

    window.history.replaceState(window.history.state, "", url.href);
  } catch {
    /*
     * Language switching can continue even when the History API
     * or URL constructor is unavailable.
     */
  }
}

/* ==========================================================================
   Document Language
   ========================================================================== */

function getDocumentLanguage() {
  return normalizeLanguage(root.getAttribute("lang"));
}

/* ==========================================================================
   Storage
   ========================================================================== */

function getStoredLanguage() {
  try {
    return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function storeLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);

  if (!normalizedLanguage) {
    return false;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, normalizedLanguage);

    window.localStorage.setItem(
      DIRECTION_STORAGE_KEY,
      getDirection(normalizedLanguage),
    );

    return true;
  } catch {
    /*
     * Storage can be unavailable in some private or restricted
     * browser environments.
     */
    return false;
  }
}

/* ==========================================================================
   Language Resolution
   ========================================================================== */

function isPortalControlledPage() {
  return Array.from(document.querySelectorAll(LANGUAGE_TOGGLE_SELECTOR)).some(
    (control) => {
      return (
        isNavigableLanguageLink(control) &&
        !control.hasAttribute("data-language-client")
      );
    },
  );
}

/**
 * Portal pages use the server-rendered document language as the authority.
 * Static client-controlled pages use the URL locale first.
 */
function getInitialLanguage() {
  if (isPortalControlledPage()) {
    return (
      getDocumentLanguage() ||
      getUrlLanguage() ||
      getStoredLanguage() ||
      DEFAULT_LANGUAGE
    );
  }

  return (
    getUrlLanguage() ||
    getDocumentLanguage() ||
    getStoredLanguage() ||
    DEFAULT_LANGUAGE
  );
}

export function getLanguage() {
  if (isPortalControlledPage()) {
    return (
      getDocumentLanguage() ||
      getUrlLanguage() ||
      getStoredLanguage() ||
      DEFAULT_LANGUAGE
    );
  }

  return (
    getUrlLanguage() ||
    getDocumentLanguage() ||
    getStoredLanguage() ||
    DEFAULT_LANGUAGE
  );
}

/* ==========================================================================
   Language-Control Helpers
   ========================================================================== */

/**
 * An explicit data-language value is used for Portal links.
 *
 * For ordinary static toggle buttons, data-target-language is synchronized
 * after every language change.
 */
function getTargetLanguage(trigger) {
  const currentLanguage = getLanguage();

  return (
    normalizeLanguage(trigger?.getAttribute("data-language")) ||
    normalizeLanguage(trigger?.getAttribute("data-target-language")) ||
    getNextLanguage(currentLanguage)
  );
}

function isNavigableLanguageLink(trigger) {
  if (!(trigger instanceof HTMLAnchorElement)) {
    return false;
  }

  const href = trigger.getAttribute("href")?.trim();

  return Boolean(
    href && href !== "#" && !href.toLowerCase().startsWith("javascript:"),
  );
}

/* ==========================================================================
   Control Synchronization
   ========================================================================== */

function syncLanguageControl(control, language) {
  /*
   * data-language is an explicit target supplied by HTML.
   *
   * If it is absent, this is a regular toggle control and its target
   * must be recalculated after every language change.
   */
  const explicitTarget = normalizeLanguage(
    control.getAttribute("data-language"),
  );

  const targetLanguage = explicitTarget || getNextLanguage(language);

  control.setAttribute("data-current-language", language);

  control.setAttribute("data-target-language", targetLanguage);

  /*
   * Visible text and accessible labels are intentionally not modified.
   * They remain controlled by the HTML.
   */
}

function syncLanguageControls(language) {
  document.querySelectorAll(LANGUAGE_TOGGLE_SELECTOR).forEach((control) => {
    syncLanguageControl(control, language);
  });
}

/* ==========================================================================
   Applying Language
   ========================================================================== */

function applyLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);

  if (!normalizedLanguage) {
    return null;
  }

  const previousLanguage = getDocumentLanguage();

  const direction = getDirection(normalizedLanguage);

  root.setAttribute("lang", normalizedLanguage);

  root.setAttribute("dir", direction);

  window.APP_LOCALE = {
    ...(window.APP_LOCALE || {}),
    lang: normalizedLanguage,
    dir: direction,
  };

  syncLanguageControls(normalizedLanguage);

  return {
    language: normalizedLanguage,
    direction,
    previousLanguage,
  };
}

/* ==========================================================================
   Language Event
   ========================================================================== */

function emitLanguageChange(result) {
  if (!result) {
    return;
  }

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

export function setLanguage(
  language,
  { persist = true, emit = true, updateUrl = false } = {},
) {
  const normalizedLanguage = normalizeLanguage(language);

  if (!normalizedLanguage) {
    console.warn(`Unsupported language: "${language}"`);

    return false;
  }

  if (persist) {
    storeLanguage(normalizedLanguage);
  }

  if (updateUrl) {
    updateStaticUrlLanguage(normalizedLanguage);
  }

  const result = applyLanguage(normalizedLanguage);

  if (emit) {
    emitLanguageChange(result);
  }

  return Boolean(result);
}

export function toggleLanguage({ updateUrl = true } = {}) {
  const currentLanguage = getLanguage();

  const nextLanguage = getNextLanguage(currentLanguage);

  return setLanguage(nextLanguage, {
    persist: true,
    emit: true,
    updateUrl,
  });
}

/* ==========================================================================
   Click Handling
   ========================================================================== */

function handleLanguageClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const trigger = event.target.closest(LANGUAGE_TOGGLE_SELECTOR);

  if (!trigger) {
    return;
  }

  const targetLanguage = getTargetLanguage(trigger);

  /*
   * Portal language anchors already contain the correct URL.
   *
   * Store the selection, then allow the link to navigate normally.
   * JavaScript does not modify the Portal-generated href.
   */
  if (
    isNavigableLanguageLink(trigger) &&
    !trigger.hasAttribute("data-language-client")
  ) {
    storeLanguage(targetLanguage);

    return;
  }

  /*
   * A static button or client-side anchor switches the current
   * document without reloading.
   */
  event.preventDefault();

  setLanguage(targetLanguage, {
    persist: true,
    emit: true,
    updateUrl: true,
  });
}

/* ==========================================================================
   Browser Events
   ========================================================================== */

function handleStorageChange(event) {
  if (event.key !== STORAGE_KEY) {
    return;
  }

  /*
   * Portal's rendered document and a static URL locale remain authoritative.
   */
  if (isPortalControlledPage() || getUrlLanguage()) {
    return;
  }

  const language = normalizeLanguage(event.newValue);

  if (!language || language === getDocumentLanguage()) {
    return;
  }

  setLanguage(language, {
    persist: false,
    emit: true,
    updateUrl: false,
  });
}

function handleHistoryNavigation() {
  if (isPortalControlledPage()) {
    return;
  }

  const language = getUrlLanguage();

  if (!language) {
    return;
  }

  if (language === getDocumentLanguage()) {
    return;
  }

  setLanguage(language, {
    persist: true,
    emit: true,
    updateUrl: false,
  });
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initLanguage() {
  const language = getInitialLanguage();

  setLanguage(language, {
    persist: true,
    emit: false,
    updateUrl: false,
  });

  if (initialized) {
    return;
  }

  initialized = true;

  document.addEventListener("click", handleLanguageClick);

  window.addEventListener("storage", handleStorageChange);

  window.addEventListener("popstate", handleHistoryNavigation);
}
