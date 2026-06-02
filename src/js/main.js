import "./components/tabs";

import { initTheme } from "./core/theme";
import { initLanguage } from "./core/language";
import { initModals } from "./components/modal";
import { initAccordions } from "./components/accordion";
import { initToasts } from "./components/toast";
import { renderDataTable } from "./vendors/datatables/datatable.core";
import { initDataTables } from "./vendors/datatables/datatable.init";
import { initIconSprite } from "./components/icons";

window.renderDataTable = renderDataTable;
initTheme();
initLanguage();
initModals();
initAccordions();
initToasts();
initDataTables();
initIconSprite();

document.documentElement.classList.add("app-ready");
