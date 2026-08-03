import {
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
} from "./market-chart";

/* ==========================================================================
   Events
   ========================================================================== */

export const MARKET_CHARTS_READY_EVENT = "semarketchartsready";

/* ==========================================================================
   Public API
   ========================================================================== */

/**
 * Stable browser API used by page-level scripts.
 *
 * Chart datasets remain inside each page and are passed to create().
 */
const marketChartAPI = Object.freeze({
  create: createMarketChart,
  get: getMarketChart,
  destroy: destroyMarketChart,
  destroyAll: destroyAllMarketCharts,
});

/* ==========================================================================
   API Getter
   ========================================================================== */

export function getMarketChartAPI() {
  return marketChartAPI;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Installs the Market Chart browser API.
 *
 * The function is idempotent. Repeated calls return the existing API without
 * dispatching duplicate readiness events.
 */
export function initMarketCharts() {
  if (window.SEMarketCharts === marketChartAPI) {
    return marketChartAPI;
  }

  window.SEMarketCharts = marketChartAPI;

  window.dispatchEvent(
    new CustomEvent(MARKET_CHARTS_READY_EVENT, {
      detail: {
        api: marketChartAPI,
      },
    }),
  );

  return marketChartAPI;
}

/* ==========================================================================
   Module Exports
   ========================================================================== */

export {
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
};
