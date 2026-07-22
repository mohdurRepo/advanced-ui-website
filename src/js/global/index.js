import { initDrawers } from "./drawer";
import { initPreferences } from "./preferences";
import { initPreferencesUI } from "./preferences-ui";
import { initUtilityRails } from "./utility-rails";
import { initScrollTop } from "./scroll-top";

export function initGlobal() {
  initPreferences();
  initDrawers();
  initPreferencesUI();
  initUtilityRails();
  initScrollTop();
}
