import {
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
  MarketChartController,
} from "./market-chart.js";

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
 * Importing this module alone does not touch `window` — the app bootstrap
 * decides when initialization happens:
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

export { marketChartsAPI };

export default marketChartsAPI;
