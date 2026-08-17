/* ==========================================================================
   Core
   ========================================================================== */

import { initLanguage } from "./core/language";
import { initGlobal } from "./global";

/* ==========================================================================
   Shared Interface Components
   ========================================================================== */

import "./components/tabs";

import { initPageLoader } from "./components/page-loader";
import { initAccordions } from "./components/accordion";
import { initHeader } from "./components/header";
import { initIconSprite } from "./components/icons";
import { initModals } from "./components/modal";
import { initToasts } from "./components/toast";
import { initDropdowns } from "./components/dropdown";
import { initCustomSelects } from "./components/custom-select";
import { initCustomDates } from "./components/custom-date";
import { initForms } from "./components/form";
import { initTextAnimation } from "./components/text-animation";
import { initDataViews } from "./components/data-view";
import { initDirectories } from "./components/directory";

/* ==========================================================================
   Page Components
   ========================================================================== */

import { initCalendar } from "./components/calendar";
import { initHomeSpotlight } from "./components/home-spotlight";
import { initExchangePerformance } from "./components/exchange-performance";

/* ==========================================================================
   Market Components
   ========================================================================== */

import { initTables } from "./components/table";
import { initMarketOverview } from "./components/market-overview";
import { initMarketCharts } from "./components/market-chart";
import { initIndicesHeatmap } from "./components/market-summary";

/* ==========================================================================
   Application State
   ========================================================================== */

let applicationInitialized = false;

/* ==========================================================================
   Application Initialization
   ========================================================================== */

function initApp() {
  if (applicationInitialized) {
    return;
  }

  applicationInitialized = true;

  /*
   * Start the loader before initializing the remaining interface.
   */
  initPageLoader();

  /*
   * Apply document-level language, direction, theme, preferences,
   * drawers, utility rails, and other global behavior.
   */
  initLanguage();
  initGlobal();

  /*
   * Shared interface infrastructure.
   */
  initIconSprite();
  initHeader();
  initDropdowns();
  initModals();
  initAccordions();
  initToasts();

  /*
   * Form and input components.
   */
  initForms();
  initCustomSelects();
  initCustomDates();

  /*
   * Shared content components.
   */
  initDataViews();
  initDirectories();
  initTextAnimation();

  /*
   * Tables and market components.
   *
   * Each initializer should safely return when its required markup
   * is not present on the current page.
   */
  initTables();
  initMarketOverview();
  initMarketCharts();
  initIndicesHeatmap();

  /*
   * Page-specific sections.
   *
   * These initializers should also return immediately when their
   * target markup is not present.
   */
  initCalendar();
  initHomeSpotlight();
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
