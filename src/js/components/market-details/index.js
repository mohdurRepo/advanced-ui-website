import { initMarketBridge } from "./bridge";
import { initMarketPanels } from "./panels";
import { initMarketMovers } from "./market-movers";
import { initMarketViews } from "./market-views";

export function initMarketDetails() {
  initMarketPanels();
  initMarketBridge();
  initMarketMovers();
  initMarketViews();
}
