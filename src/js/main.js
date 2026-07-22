import { initLanguage } from "./core/language";

import "./components/tabs";

import { initGlobal } from "./global";

import { initAccordions } from "./components/accordion";
import { initCalendar } from "./components/calendar";
import { initDropdowns } from "./components/dropdown";
import { initFeatureOverview } from "./components/feature-overview";
import { initForms } from "./components/form";
import { initHeader } from "./components/header";
import { initIconSprite } from "./components/icons";
import { initMarketDetails } from "./components/market-details";
import { initMarketSummarySection } from "./components/market-summary";
import { initModals } from "./components/modal";
import { initToasts } from "./components/toast";

import { initHomeCountdownSlider } from "./components/intro-section/home-countdown-slider";
import { initHomeEventSlider } from "./components/intro-section/home-event-slider";
import { initHomeVideoPlayer } from "./components/intro-section/home-video-player";

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
  initMarketSummarySection();
  initMarketDetails();

  /*
   * Homepage introduction components
   */
  initHomeEventSlider();
  initHomeCountdownSlider();
  initHomeVideoPlayer();

  /*
   * Page sections
   */
  initCalendar();
  initFeatureOverview();
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
