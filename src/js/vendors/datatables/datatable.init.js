import { renderDataTable, destroyDataTable } from "./datatable.core";

export function initDataTables() {
  document.querySelectorAll("[data-datatable]").forEach((table) => {
    renderDataTable({
      target: table,
      preset: table.dataset.datatablePreset || "standard",
    });
  });
}

export function reinitDataTables() {
  document.querySelectorAll("[data-datatable]").forEach((table) => {
    destroyDataTable(table);

    renderDataTable({
      target: table,
      preset: table.dataset.datatablePreset || "standard",
    });
  });
}

document.addEventListener("languagechange", () => {
  reinitDataTables();
});
