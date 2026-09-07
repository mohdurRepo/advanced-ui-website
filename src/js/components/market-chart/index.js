import {
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
} from "./market-chart";

/* ==========================================================================
   Public API
   ========================================================================== */

export {
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
};

/* ==========================================================================
   Browser API
   ========================================================================== */

const marketChartsAPI = Object.freeze({
  create: createMarketChart,
  get: getMarketChart,
  destroy: destroyMarketChart,
  destroyAll: destroyAllMarketCharts,
});

/* ==========================================================================
   Initialization
   ========================================================================== */

/*
 * Compatibility entry point for the existing application bootstrap:
 *
 *   initMarketCharts();
 *
 * The actual chart implementation remains module-based.
 */
export function initMarketCharts() {
  if (typeof window !== "undefined") {
    window.SEMarketCharts = marketChartsAPI;
  }

  return marketChartsAPI;
}

/* ==========================================================================
   Automatic Browser Registration
   ========================================================================== */

/*
 * Keep the API immediately available for legacy pages using:
 *
 *   window.SEMarketCharts.create(...)
 *
 * Calling initMarketCharts() again from main.js is harmless.
 */
initMarketCharts();

/* ==========================================================================
   Default Export
   ========================================================================== */

export default marketChartsAPI;
