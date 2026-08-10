import { initLanguage } from "./core/language";

import "./components/tabs";

import { initGlobal } from "./global";

import { initAccordions } from "./components/accordion";
import { initCalendar } from "./components/calendar";
import { initDropdowns } from "./components/dropdown";
import { initHeader } from "./components/header";
import { initIconSprite } from "./components/icons";
import { initModals } from "./components/modal";
import { initToasts } from "./components/toast";
import { initHomeSpotlight } from "./components/home-spotlight";
import { initExchangePerformance } from "./components/exchange-performance";
import { initIndicesHeatmap } from "./components/market-summary";
import { initForms } from "./components/form";
import { initCustomSelects } from "./components/custom-select";
import { initCustomDates } from "./components/custom-date";
import { initTables } from "./components/table";
import { initTextAnimation } from "./components/text-animation";
import { initMarketOverview } from "./components/market-overview";
import { initMarketCharts } from "./components/market-chart";
import { initDataViews } from "./components/data-view";
//import { renderDataTable } from "./vendors/datatables/datatable.core";
//import { initDataTables } from "./vendors/datatables/datatable.init";

/* ==========================================================================
   Public API
   ========================================================================== */

//window.renderDataTable = renderDataTable;

/* ==========================================================================
   Application Initialization
   ========================================================================== */

function initApp() {
  /*
   * Global infrastructure
   *
   * Includes drawers, preferences UI, utility rails,
   * and other site-wide behavior.
   */
  initGlobal();
  initLanguage();
  /*
   * Core interface components
   */
  initIconSprite();
  initHeader();
  initDropdowns();
  initModals();
  initAccordions();
  initToasts();
  /*
   * Vendor integrations
   */
  //initDataTables();
  initTables();

  /*
   * Market components
   */
  initMarketOverview();
  initMarketCharts();

  initIndicesHeatmap();
  /*
   * Homepage introduction components
   */
  initHomeSpotlight();
  initDataViews();
  /*
   * Page sections
   */
  initCalendar();
  initExchangePerformance();

  initForms();
  initCustomSelects();
  initCustomDates();

  initTextAnimation();
}

/* ==========================================================================
   DOM Ready
   ========================================================================== */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, {
    once: true,
  });
} else {
  initApp();
}
