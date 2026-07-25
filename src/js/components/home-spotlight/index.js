/* ==========================================================================
   Home Spotlight
   ========================================================================== */

import { initHomeEventSlider } from "./home-event-slider";
import { initHomeVideoPlayer } from "./home-video-player";
import { initHomeUpcomingActivities } from "./home-upcoming-activities";

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initHomeSpotlight() {
  initHomeEventSlider();
  initHomeVideoPlayer();
  initHomeUpcomingActivities();
}
