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

import { initDataViews, refreshDataViews } from "./components/data-view";

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
import { initMarketTicker } from "./components/market-ticker";
import { initMarketOverview } from "./components/market-overview";
import { initMarketCharts } from "./components/market-chart";
import { initIndicesHeatmap } from "./components/market-summary";

/* ==========================================================================
   Watchlist Components
   ========================================================================== */

import { initWatchlists } from "./components/watchlist";

/* ==========================================================================
   Public Design-system API
   ========================================================================== */

/*
 * Public enhancement bridge for application modules that render
 * design-system components dynamically after the initial page load.
 *
 * Example:
 *
 * - Market Watch loads data asynchronously
 * - common/data-view/data-cards.js injects new [data-data-card] elements
 * - Theme.dataView.refresh(container) initializes those new cards
 *
 * Keep this API intentionally small.
 */

window.Theme = window.Theme || {};

window.Theme.dataView = {
  ...(window.Theme.dataView || {}),

  refresh: refreshDataViews,
};

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
   *
   * Initialize all Data View markup already present at page load.
   * Dynamically rendered Data View content is refreshed through the
   * Theme.dataView.refresh() bridge above.
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
  initMarketTicker();
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

  /*
   * Watchlist behavior.
   */
  initWatchlists();
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
