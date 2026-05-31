import "../scss/main.scss";
import "./components/tabs";

import { initTheme } from "./core/theme";
import { initLanguage } from "./core/language";
import { initModals } from "./components/modal";
import { initAccordions } from "./components/accordion";
import { initToasts } from "./components/toast";

initTheme();
initLanguage();
initModals();
initAccordions();
initToasts();
