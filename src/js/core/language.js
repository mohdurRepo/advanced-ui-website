/* ==========================================================================
   Language Management
   ========================================================================== */

const CONFIG = Object.freeze({
  storageKey: "se-lang",
  directionStorageKey: "se-dir",
  portalRestoreKey: "se-portal-language-restore",
  localeParameter: "locale",
  defaultLanguage: "en",
});

const SUPPORTED_LANGUAGES = new Set(["en", "ar"]);

const LANGUAGE_CONTROL_SELECTOR = [
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
   Document and URL
   ========================================================================== */

function getDocumentLanguage() {
  return normalizeLanguage(root.getAttribute("lang"));
}

function getUrlLanguage() {
  try {
    const parameters = new URLSearchParams(window.location.search);

    return normalizeLanguage(parameters.get(CONFIG.localeParameter));
  } catch {
    return null;
  }
}

function updateStaticUrlLanguage(language) {
  if (typeof window.history?.replaceState !== "function") {
    return;
  }

  try {
    const url = new URL(window.location.href);

    url.searchParams.set(CONFIG.localeParameter, language);

    window.history.replaceState(window.history.state, "", url.href);
  } catch {
    // Static switching can continue without URL synchronization.
  }
}

/* ==========================================================================
   Persistent Storage
   ========================================================================== */

function getStoredLanguage() {
  try {
    return normalizeLanguage(window.localStorage.getItem(CONFIG.storageKey));
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
    window.localStorage.setItem(CONFIG.storageKey, normalizedLanguage);

    window.localStorage.setItem(
      CONFIG.directionStorageKey,
      getDirection(normalizedLanguage),
    );

    return true;
  } catch {
    return false;
  }
}

/* ==========================================================================
   Language Controls
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

function isClientLanguageControl(control) {
  return (
    !isNavigableLanguageLink(control) ||
    control.hasAttribute("data-language-client")
  );
}

function getControlLanguage(control) {
  return (
    normalizeLanguage(control?.getAttribute("data-language")) ||
    normalizeLanguage(control?.getAttribute("hreflang")) ||
    normalizeLanguage(control?.getAttribute("data-target-language"))
  );
}

function getLanguageControls() {
  return Array.from(document.querySelectorAll(LANGUAGE_CONTROL_SELECTOR));
}

/* ==========================================================================
   Environment Detection
   ========================================================================== */

/**
 * Portal controls are navigable server-generated links.
 *
 * Static controls are buttons or explicitly use data-language-client.
 */
function isPortalPage() {
  return getLanguageControls().some(
    (control) =>
      isNavigableLanguageLink(control) &&
      !control.hasAttribute("data-language-client"),
  );
}

/* ==========================================================================
   Language Resolution
   ========================================================================== */

function getInitialLanguage() {
  if (isPortalPage()) {
    /*
     * Portal rendered the current document language on the server.
     */
    return (
      getDocumentLanguage() ||
      getUrlLanguage() ||
      getStoredLanguage() ||
      CONFIG.defaultLanguage
    );
  }

  /*
   * Static pages allow an explicit URL language to override the document.
   */
  return (
    getUrlLanguage() ||
    getDocumentLanguage() ||
    getStoredLanguage() ||
    CONFIG.defaultLanguage
  );
}

export function getLanguage() {
  return getInitialLanguage();
}

/* ==========================================================================
   Portal Restore State
   ========================================================================== */

function getPortalRestoreState() {
  try {
    return window.sessionStorage.getItem(CONFIG.portalRestoreKey);
  } catch {
    return null;
  }
}

function setPortalRestoreState(value) {
  try {
    if (value) {
      window.sessionStorage.setItem(CONFIG.portalRestoreKey, value);
    } else {
      window.sessionStorage.removeItem(CONFIG.portalRestoreKey);
    }
  } catch {
    // Session storage may be unavailable.
  }
}

function getPortalLanguageLink(language) {
  return (
    getLanguageControls().find(
      (control) =>
        isNavigableLanguageLink(control) &&
        !control.hasAttribute("data-language-client") &&
        getControlLanguage(control) === language,
    ) || null
  );
}

/**
 * Restores a saved Portal language through Portal's generated language URL.
 *
 * Returns true when navigation has started.
 */
function restorePortalLanguage() {
  if (!isPortalPage()) {
    return false;
  }

  const documentLanguage = getDocumentLanguage();
  const storedLanguage = getStoredLanguage();

  /*
   * An explicit URL locale is an intentional language request.
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
   * Prevent repeated redirection if Portal does not apply the requested
   * language.
   */
  if (getPortalRestoreState() === restoreState) {
    return false;
  }

  setPortalRestoreState(restoreState);

  window.location.replace(languageLink.href);

  return true;
}
/* ==========================================================================
   Interface Synchronization
   ========================================================================== */

function syncLanguageControl(control, language) {
  const explicitTarget =
    normalizeLanguage(control.getAttribute("data-language")) ||
    normalizeLanguage(control.getAttribute("hreflang"));

  const targetLanguage = explicitTarget || getNextLanguage(language);

  control.setAttribute("data-current-language", language);

  control.setAttribute("data-target-language", targetLanguage);

  /*
   * Visible labels remain controlled by the HTML.
   */
}

function syncLanguageControls(language) {
  getLanguageControls().forEach((control) => {
    syncLanguageControl(control, language);
  });
}

/* ==========================================================================
   Document Visibility
   ========================================================================== */

/**
 * Reveals a document hidden by the early Portal head script.
 */
function revealDocument() {
  root.style.removeProperty("visibility");

  root.removeAttribute("data-language-restoring");
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
   Language Events
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

export function toggleLanguage() {
  const nextLanguage = getNextLanguage(getLanguage());

  return setLanguage(nextLanguage, {
    persist: true,
    emit: true,
    updateUrl: !isPortalPage(),
  });
}

/* ==========================================================================
   Click Handling
   ========================================================================== */

function getEventLanguageControl(event) {
  if (!(event.target instanceof Element)) {
    return null;
  }

  return event.target.closest(LANGUAGE_CONTROL_SELECTOR);
}

function handleLanguageClick(event) {
  const control = getEventLanguageControl(event);

  if (!control) {
    return;
  }

  const targetLanguage =
    getControlLanguage(control) || getNextLanguage(getLanguage());

  /*
   * Portal language links already contain the correct server-generated URL.
   *
   * Save the requested language and allow the browser to navigate normally.
   */
  if (!isClientLanguageControl(control)) {
    storeLanguage(targetLanguage);
    setPortalRestoreState(null);

    return;
  }

  /*
   * Static controls switch the current document without reloading.
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
  if (event.key !== CONFIG.storageKey) {
    return;
  }

  /*
   * Portal content must be changed through server navigation.
   */
  if (isPortalPage()) {
    return;
  }

  /*
   * An explicit static URL locale remains authoritative.
   */
  if (getUrlLanguage()) {
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
  if (isPortalPage()) {
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
   Initialization Helpers
   ========================================================================== */

/**
 * Determines whether initialization may safely save the current language.
 *
 * A mismatched Portal document must never overwrite the user's existing
 * saved preference if Portal restoration fails.
 */
function shouldPersistInitialLanguage() {
  if (!isPortalPage()) {
    return true;
  }

  const urlLanguage = getUrlLanguage();
  const storedLanguage = getStoredLanguage();
  const documentLanguage = getDocumentLanguage();

  if (urlLanguage) {
    return true;
  }

  if (!storedLanguage) {
    return true;
  }

  return storedLanguage === documentLanguage;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initLanguage() {
  /*
   * If navigation begins, keep the incorrect server-rendered document
   * hidden. The destination page will render using the saved language.
   */
  if (restorePortalLanguage()) {
    return;
  }

  const language = getInitialLanguage();

  setLanguage(language, {
    persist: shouldPersistInitialLanguage(),
    emit: false,
    updateUrl: false,
  });

  if (getDocumentLanguage() === getStoredLanguage()) {
    setPortalRestoreState(null);
  }

  /*
   * No language navigation is pending.
   */
  revealDocument();

  if (initialized) {
    return;
  }

  initialized = true;

  document.addEventListener("click", handleLanguageClick);

  window.addEventListener("storage", handleStorageChange);

  window.addEventListener("popstate", handleHistoryNavigation);
}
