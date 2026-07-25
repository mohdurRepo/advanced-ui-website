/* ==========================================================================
   Market Overview
   ========================================================================== */

import { initMarketOverviewDisclosure } from "./market-overview";
import { initMarketPanels } from "./market-panels";
import { initMarketTabs } from "./market-tabs";
import { initMarketDetailsMobile } from "./market-details-mobile";
import { initMarketSummary } from "./market-summary";
import { initMarketClock } from "./market-clock";
import { initMarketBridge } from "./market-bridge";

let initialized = false;

export function initMarketOverview() {
  if (initialized) return;

  initialized = true;

  /*
   * Establish the disclosure state before measuring any panels.
   */
  initMarketOverviewDisclosure();

  /*
   * Establish active panels and nested tab states.
   */
  initMarketPanels();
  initMarketTabs();
  initMarketDetailsMobile();

  /*
   * Initialize live Summary features.
   */
  initMarketSummary();
  initMarketClock();

  /*
   * Bridge geometry must be calculated last.
   */
  initMarketBridge();
}
