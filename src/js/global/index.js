import { initDrawers } from "./drawer";
import { initPreferences } from "./preferences";
import { initUtilityRails } from "./utility-rails";
import { initScrollTop } from "./scroll-top";

export function initGlobal() {
  initPreferences();
  initDrawers();
  initUtilityRails();
  initScrollTop();
}
