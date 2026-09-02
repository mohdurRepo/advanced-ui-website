/* ==========================================================================
   Nomu Theoretical Opening
   ========================================================================== */

/*
 * Nomu Theoretical Opening entry module.
 *
 * Responsibilities:
 *
 * - verify Nomu runtime configuration exists
 * - initialize the shared Theoretical Opening page
 * - pass the Nomu-specific runtime config name
 *
 * All actual page behavior is implemented in:
 *
 *   theoretical-opening.js
 *
 * This module intentionally has no:
 *
 * - request logic
 * - filters
 * - state
 * - table rendering
 * - card rendering
 * - response normalization
 * - Data View controller composition
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
