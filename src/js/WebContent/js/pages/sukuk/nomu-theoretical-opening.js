/* ==========================================================================
   Nomu Theoretical Opening
   ========================================================================== */

/*
 * Nomu-specific entry point.
 *
 * All shared behavior lives in:
 *
 *   theoretical-opening.js
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { initTheoreticalOpeningPage } from "./theoretical-opening.js";

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  if (typeof window === "undefined" || !window.NomuTheoreticalOpeningConfig) {
    return;
  }

  initTheoreticalOpeningPage({
    root: document,

    configName: "NomuTheoreticalOpeningConfig",
  });
}

/* ==========================================================================
   DOM Ready
   ========================================================================== */

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true,
    });
  } else {
    start();
  }
}
