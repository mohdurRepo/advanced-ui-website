/* ==========================================================================
   Page Loader
   ========================================================================== */

const LEAVE_FALLBACK_DELAY = 300;
const MAXIMUM_LOADING_TIME = 8000;

/**
 * Initializes the full-page loading screen.
 *
 * The loader leaves when the window load event fires. A maximum loading
 * timeout prevents failed external resources from trapping the interface.
 */
export function initPageLoader() {
  const loader = document.querySelector("[data-page-loader]");

  if (!loader || loader.dataset.pageLoaderInitialized === "true") {
    return;
  }

  loader.dataset.pageLoaderInitialized = "true";

  const root = document.documentElement;
  const body = document.body;

  let isLeaving = false;
  let isComplete = false;

  /**
   * Removes the loader and restores document scrolling.
   */
  function complete() {
    if (isComplete) {
      return;
    }

    isComplete = true;

    loader.hidden = true;

    root.classList.remove("is-page-loading");
    body.classList.remove("is-page-loading");
    body.removeAttribute("aria-busy");
  }

  /**
   * Starts the loader exit transition.
   */
  function leave() {
    if (isLeaving) {
      return;
    }

    isLeaving = true;

    loader.classList.add("is-leaving");

    loader.addEventListener("transitionend", complete, {
      once: true,
    });

    /*
     * Ensures completion when reduced motion disables transitions or when a
     * browser interrupts the transition.
     */
    window.setTimeout(complete, LEAVE_FALLBACK_DELAY);
  }

  /*
   * Lock document scrolling while the loader is visible.
   */
  root.classList.add("is-page-loading");
  body.classList.add("is-page-loading");
  body.setAttribute("aria-busy", "true");

  /*
   * The main application may initialize before or after the load event.
   */
  if (document.readyState === "complete") {
    window.requestAnimationFrame(leave);
  } else {
    window.addEventListener("load", leave, {
      once: true,
    });
  }

  /*
   * Never allow a failed image, font, or external resource to leave the
   * interface permanently blocked.
   */
  window.setTimeout(leave, MAXIMUM_LOADING_TIME);
}
