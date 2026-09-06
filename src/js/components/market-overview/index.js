/* ==========================================================================
   Market Overview
   ========================================================================== */

/*
 * Component bootstrap only.
 *
 * Responsibilities:
 *
 * - Initialize Market Overview modules in dependency-safe order.
 * - Prevent duplicate application-level initialization.
 *
 * This file does NOT own component behavior.
 */

import { initMarketOverviewDisclosure } from "./market-overview";
import { initMarketPanels } from "./market-panels";
import { initMarketTabs } from "./market-tabs";
import { initMarketDetailsMobile } from "./market-details-mobile";
import { initMarketSummary } from "./market-summary";
import { initMarketClock } from "./market-clock";
import { initMarketBridge } from "./market-bridge";

/* ==========================================================================
   State
   ========================================================================== */

let initialized = false;

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeStructure() {
  /*
   * Outer visibility first.
   *
   * Other modules may depend on the Details shell being synchronized before
   * they inspect or measure its contents.
   */

  initMarketOverviewDisclosure();

  /*
   * Details navigation.
   *
   * Outer market panels are initialized before their nested tab systems.
   */

  initMarketPanels();

  initMarketTabs();

  /*
   * Mobile progressive disclosure belongs inside the already-normalized
   * Details / nested-tab structure.
   */

  initMarketDetailsMobile();
}

function initializeSummary() {
  /*
   * Summary selection publishes market:change.
   *
   * Panel listeners have already been registered above, so any initial market
   * synchronization can safely propagate into Details.
   */

  initMarketSummary();

  /*
   * Clock is independent of selection but belongs to the Summary surface.
   */

  initMarketClock();
}

function initializeGeometry() {
  /*
   * Bridge comes last because it measures geometry produced by the Summary
   * and Details modules.
   */

  initMarketBridge();
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketOverview() {
  if (initialized) {
    return;
  }

  initialized = true;

  initializeStructure();

  initializeSummary();

  initializeGeometry();
}
