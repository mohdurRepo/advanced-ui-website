/* ==========================================================================
   Market Shared Helpers
   ========================================================================== */

/*
 * One implementation of the small environment helpers every Market Overview
 * module needs.
 *
 * Motion follows the site setting only (data-motion-preference), the same
 * policy as preferences.js and the SCSS reduced-motion mixin. Operating-system
 * settings are not read.
 */

const root = document.documentElement;

/* ==========================================================================
   Language
   ========================================================================== */

export function getLanguage() {
  const language = root.lang?.trim().toLowerCase() || "en";

  return language.startsWith("ar") ? "ar" : "en";
}

/* ==========================================================================
   Motion
   ========================================================================== */

export function prefersReducedMotion() {
  return root.dataset.motionPreference === "reduce";
}

export function getScrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/* ==========================================================================
   Direction
   ========================================================================== */

export function isRTL(element) {
  if (!element) {
    return false;
  }

  return window.getComputedStyle(element).direction === "rtl";
}

/* ==========================================================================
   Rendering
   ========================================================================== */

export function isElementRendered(element) {
  return Boolean(
    element &&
    element.isConnected &&
    element.getClientRects().length &&
    element.getBoundingClientRect().width,
  );
}

/* ==========================================================================
   Media Queries
   ========================================================================== */

export function createMediaQuery(query) {
  if (typeof window.matchMedia !== "function") {
    return null;
  }

  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

export function onMediaQueryChange(query, listener) {
  if (!query) {
    return;
  }

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", listener);

    return;
  }

  /* Legacy Safari / WebView. */

  query.addListener?.(listener);
}

/* ==========================================================================
   Storage
   ========================================================================== */

/*
 * Same failure policy as preferences.js: blocked or full storage never
 * breaks the page, the in-memory state still applies.
 */

export function readStorage(key) {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    /* Blocked or full. */
  }
}

/* ==========================================================================
   Compatibility Resize
   ========================================================================== */

/*
 * Some chart consumers still reflow from a window resize event after a
 * panel, view or Details becomes visible. Several modules can request it
 * for the same change (e.g. initial load); this coalesces every request in
 * one frame into a single event.
 *
 * Remove once charts consume the explicit market:* events.
 */

let compatibilityResizeFrame = null;

export function dispatchCompatibilityResize() {
  if (compatibilityResizeFrame !== null) {
    return;
  }

  compatibilityResizeFrame = window.requestAnimationFrame(() => {
    compatibilityResizeFrame = null;

    window.dispatchEvent(new Event("resize"));
  });
}
