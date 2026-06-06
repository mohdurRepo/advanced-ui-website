import "./components/tabs";

import { initTheme } from "./core/theme";
import { initLanguage } from "./core/language";
import { initModals } from "./components/modal";
import { initAccordions } from "./components/accordion";
import { initToasts } from "./components/toast";
import { renderDataTable } from "./vendors/datatables/datatable.core";
import { initDataTables } from "./vendors/datatables/datatable.init";
import { initIconSprite } from "./components/icons";
import { initDropdowns } from "./components/dropdown";
import { initForms } from "./components/form";
import { initHeader } from "./components/header";
import { initMarketSummary } from "./components/market-summary";
import { initMarketDetails } from "./components/market-details";

initHeader();
window.renderDataTable = renderDataTable;
initTheme();
initLanguage();
initModals();
initAccordions();
initToasts();
initDataTables();
initIconSprite();
initDropdowns();
initForms();
initMarketSummary();
initMarketDetails();
