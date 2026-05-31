import "../scss/main.scss";
import "./components/tabs";

import { initTheme } from "./core/theme";
import { initLanguage } from "./core/language";
import { initModals } from "./components/modal";
import { initAccordions } from "./components/accordion";

initTheme();
initLanguage();
initModals();
initAccordions();
