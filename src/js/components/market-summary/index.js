import { initMarketClock } from "./clock";
import { initMarketCards } from "./market-summary";

export function initMarketSummary() {
  initMarketClock();
  initMarketCards();
}
