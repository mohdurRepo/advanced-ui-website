import { initLanguage } from "./core/language";

import "./components/tabs";

import { initGlobal } from "./global";

import { initAccordions } from "./components/accordion";
import { initCalendar } from "./components/calendar";
import { initDropdowns } from "./components/dropdown";
import { initForms } from "./components/form";
import { initHeader } from "./components/header";
import { initIconSprite } from "./components/icons";
import { initModals } from "./components/modal";
import { initToasts } from "./components/toast";
import { initHomeSpotlight } from "./components/home-spotlight";
import { initExchangePerformance } from "./components/exchange-performance";

import { initMarketOverview } from "./components/market-overview";

import { renderDataTable } from "./vendors/datatables/datatable.core";
import { initDataTables } from "./vendors/datatables/datatable.init";

/* ==========================================================================
   Public API
   ========================================================================== */

window.renderDataTable = renderDataTable;

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
  initForms();
  /*
   * Vendor integrations
   */
  initDataTables();

  /*
   * Market components
   */
  initMarketOverview();

  /*
   * Homepage introduction components
   */
  initHomeSpotlight();

  /*
   * Page sections
   */
  initCalendar();
  initExchangePerformance();
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
