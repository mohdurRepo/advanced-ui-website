import {
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
  MarketChartController,
} from "./market-chart";

/* ==========================================================================
   Public API
   ========================================================================== */

export {
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
  MarketChartController,
};

/* ==========================================================================
   API Object
   ========================================================================== */

const marketChartsAPI = Object.freeze({
  create: createMarketChart,

  get: getMarketChart,

  destroy: destroyMarketChart,

  destroyAll: destroyAllMarketCharts,
});

/* ==========================================================================
   Application Initialization
   ========================================================================== */

/**
 * Registers the browser-facing Market Chart API.
 *
 * This function is intentionally explicit.
 *
 * Importing this module alone does not mutate window.
 * The application bootstrap decides when initialization happens:
 *
 *   import { initMarketCharts } from "./components/market-chart";
 *
 *   initMarketCharts();
 */
export function initMarketCharts() {
  if (typeof window !== "undefined") {
    window.SEMarketCharts = marketChartsAPI;
  }

  return marketChartsAPI;
}

/* ==========================================================================
   Exports
   ========================================================================== */

export { marketChartsAPI };

export default marketChartsAPI;
