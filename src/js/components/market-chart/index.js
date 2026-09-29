import {
  MarketChartController,
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
} from "./market-chart.js";

import { getMarketChartStrings } from "./market-chart-i18n.js";

/* ==========================================================================
   Market Chart — Public Entry
   ==========================================================================

   Importing this module has no side effects. The application bootstrap
   decides when the browser-facing API is registered:

     import { initMarketCharts } from "./components/market-chart";

     initMarketCharts();                       // window.SEMarketCharts
     initMarketCharts({ Highcharts, language: "ar" });
   ========================================================================== */

const GLOBAL_NAME = "SEMarketCharts";

/**
 * Frozen browser-facing API.
 */
export const marketChartsAPI = Object.freeze({
  create: createMarketChart,
  get: getMarketChart,
  destroy: destroyMarketChart,
  destroyAll: destroyAllMarketCharts,
});

/**
 * Highcharts < 12 only reads `lang` globally (chart-level `lang` is
 * ignored), so the localized strings are applied once via setOptions().
 */
function applyGlobalLanguage(Highcharts, language) {
  if (typeof Highcharts?.setOptions !== "function") {
    return;
  }

  const major = Number.parseInt(String(Highcharts.version ?? ""), 10);

  if (Number.isFinite(major) && major < 12) {
    Highcharts.setOptions({
      lang: { ...getMarketChartStrings(language).highcharts },
    });
  }
}

/**
 * Registers `window.SEMarketCharts`. Safe to call more than once.
 *
 * @param {object} [options]
 * @param {object} [options.Highcharts]  Highstock instance. When it is
 *   older than v12, localized `lang` strings are applied globally.
 * @param {string} [options.language]    Defaults to <html lang>.
 * @returns {typeof marketChartsAPI}
 */
export function initMarketCharts({ Highcharts = null, language = null } = {}) {
  if (typeof window === "undefined") {
    return marketChartsAPI;
  }

  applyGlobalLanguage(
    Highcharts ?? window.Highcharts,
    language ?? window.document?.documentElement?.lang,
  );

  if (window[GLOBAL_NAME] !== marketChartsAPI) {
    window[GLOBAL_NAME] = marketChartsAPI;
  }

  return marketChartsAPI;
}

export {
  MarketChartController,
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
};

export default marketChartsAPI;
