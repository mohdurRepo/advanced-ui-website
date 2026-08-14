/* ==========================================================================
   Language Management
   ========================================================================== */

const STORAGE_KEY = "se-lang";
const DIRECTION_STORAGE_KEY = "se-dir";
const PORTAL_RESTORE_KEY = "se-portal-language-restore";

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
 * Updates a static-page URL without reloading.
 *
 * Portal language anchors retain their server-generated href and navigate
 * normally.
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
    // Language switching can continue without URL synchronization.
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
    // Storage may be unavailable in restricted browser environments.
    return false;
  }
}

/* ==========================================================================
   Language-Control Helpers
   ========================================================================== */

function isNavigableLanguageLink(control) {
  if (!(control instanceof HTMLAnchorElement)) {
    return false;
  }

  const href = control.getAttribute("href")?.trim();

  return Boolean(
    href && href !== "#" && !href.toLowerCase().startsWith("javascript:"),
  );
}

function getControlLanguage(control) {
  return (
    normalizeLanguage(control.getAttribute("data-language")) ||
    normalizeLanguage(control.getAttribute("hreflang")) ||
    normalizeLanguage(control.getAttribute("data-target-language"))
  );
}

function getPortalLanguageLink(language) {
  return (
    Array.from(document.querySelectorAll(LANGUAGE_TOGGLE_SELECTOR)).find(
      (control) =>
        isNavigableLanguageLink(control) &&
        !control.hasAttribute("data-language-client") &&
        getControlLanguage(control) === language,
    ) || null
  );
}

function getTargetLanguage(trigger) {
  return (
    normalizeLanguage(trigger?.getAttribute("data-language")) ||
    normalizeLanguage(trigger?.getAttribute("hreflang")) ||
    normalizeLanguage(trigger?.getAttribute("data-target-language")) ||
    getNextLanguage(getLanguage())
  );
}

/* ==========================================================================
   Environment Detection
   ========================================================================== */

/**
 * A page is considered Portal-controlled when it contains at least one
 * navigable language anchor that is not marked as client-controlled.
 */
function isPortalControlledPage() {
  return Array.from(document.querySelectorAll(LANGUAGE_TOGGLE_SELECTOR)).some(
    (control) =>
      isNavigableLanguageLink(control) &&
      !control.hasAttribute("data-language-client"),
  );
}

/* ==========================================================================
   Language Resolution
   ========================================================================== */

/**
 * Portal pages use the server-rendered document language as their authority.
 *
 * Static pages use an explicit URL locale first.
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
   Portal Language Restoration
   ========================================================================== */

function getPortalRestoreState() {
  try {
    return window.sessionStorage.getItem(PORTAL_RESTORE_KEY);
  } catch {
    return null;
  }
}

function setPortalRestoreState(value) {
  try {
    if (value) {
      window.sessionStorage.setItem(PORTAL_RESTORE_KEY, value);
    } else {
      window.sessionStorage.removeItem(PORTAL_RESTORE_KEY);
    }
  } catch {
    // Session storage may be unavailable.
  }
}

/**
 * Restores the saved Portal language using the server-generated language URL.
 *
 * This is necessary when a new Portal session initially renders its default
 * language even though the user previously selected another language.
 *
 * Returns true when navigation has started.
 */
function restorePortalLanguage() {
  if (!isPortalControlledPage()) {
    return false;
  }

  const documentLanguage = getDocumentLanguage();
  const storedLanguage = getStoredLanguage();

  /*
   * An explicit URL locale represents an intentional language request.
   */
  if (getUrlLanguage()) {
    setPortalRestoreState(null);

    return false;
  }

  if (
    !documentLanguage ||
    !storedLanguage ||
    documentLanguage === storedLanguage
  ) {
    setPortalRestoreState(null);

    return false;
  }

  const languageLink = getPortalLanguageLink(storedLanguage);

  if (!languageLink) {
    return false;
  }

  const restoreState = `${documentLanguage}:${storedLanguage}`;

  /*
   * Prevent a redirect loop if Portal returns the same document language.
   */
  if (getPortalRestoreState() === restoreState) {
    return false;
  }

  setPortalRestoreState(restoreState);

  window.location.replace(languageLink.href);

  return true;
}

/* ==========================================================================
   Control Synchronization
   ========================================================================== */

function syncLanguageControl(control, language) {
  /*
   * data-language and hreflang are explicit targets provided by HTML.
   *
   * Otherwise, this is a regular static toggle and its target must be
   * recalculated after every language change.
   */
  const explicitTarget =
    normalizeLanguage(control.getAttribute("data-language")) ||
    normalizeLanguage(control.getAttribute("hreflang"));

  const targetLanguage = explicitTarget || getNextLanguage(language);

  control.setAttribute("data-current-language", language);
  control.setAttribute("data-target-language", targetLanguage);

  /*
   * Visible text and accessible labels remain controlled by the HTML.
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
   * Portal anchors already contain the correct ChangeLanguage URL.
   *
   * Save the user's selection and allow normal browser navigation.
   */
  if (
    isNavigableLanguageLink(trigger) &&
    !trigger.hasAttribute("data-language-client")
  ) {
    storeLanguage(targetLanguage);
    setPortalRestoreState(null);

    return;
  }

  /*
   * Static buttons and explicitly client-controlled anchors switch the
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
   * Portal documents and explicit static URL locales remain authoritative.
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

  if (!language || language === getDocumentLanguage()) {
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
  /*
   * Restore the saved Portal preference before the server-rendered default
   * can overwrite it in local storage.
   */
  if (restorePortalLanguage()) {
    return;
  }

  const language = getInitialLanguage();

  setLanguage(language, {
    persist: true,
    emit: false,
    updateUrl: false,
  });

  if (getDocumentLanguage() === getStoredLanguage()) {
    setPortalRestoreState(null);
  }

  if (initialized) {
    return;
  }

  initialized = true;

  document.addEventListener("click", handleLanguageClick);
  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("popstate", handleHistoryNavigation);
}
