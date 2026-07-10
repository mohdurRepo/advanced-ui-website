/* ==========================================================================
   Market Details
   ========================================================================== */

import { initMarketBridge } from "./bridge";
import { initMarketPanels } from "./panels";
import { initMarketViews } from "./market-views";
import { initMarketDetailsMobile } from "./market-details-mobile";

let initialized = false;

export function initMarketDetails() {
  if (initialized) return;

  initialized = true;

  /*
   * Panels should initialize first so the correct market content exists
   * before tabs, mobile disclosure, and bridge geometry are calculated.
   */
  initMarketPanels();
  initMarketViews();
  initMarketDetailsMobile();
  initMarketBridge();
}
