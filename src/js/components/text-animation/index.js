import { TextAnimation } from "./text-animation";
import {
  destroyTextAnimations,
  getTextAnimation,
  initTextAnimations,
  refreshTextAnimations,
} from "./text-animation";

/* ==========================================================================
   Public Exports
   ========================================================================== */

export {
  TextAnimation,
  destroyTextAnimations,
  getTextAnimation,
  initTextAnimations,
  refreshTextAnimations,
};

/* ==========================================================================
   Component Initialization
   ========================================================================== */

/**
 * Initializes all text-animation components within the supplied root.
 *
 * Initialization is explicit so the application controls startup order and
 * avoids duplicate DOMContentLoaded listeners.
 */

export function initTextAnimation(root = document) {
  return initTextAnimations(root);
}
