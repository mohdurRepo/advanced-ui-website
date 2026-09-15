/* ======================================================
Historical Table Engine
Responsible for resolving profile, toggling table modes,
applying headers, and rendering / refreshing DataTables
====================================================== */
 
(function (window, document) {
  "use strict";
 
  const TABLES = {
    performance: {
      target: "#perfSummary",
      panelId: "historical-panel-performance"
    },
    unadjusted: {
      target: "#unadjustedPrice",
      panelId: "historical-panel-unadjusted"
    },
    underlying: {
      target: "#SingleStockOptionsTable",
      panelId: "SingleStockOptionsDiv"
    }
  };
 
  const HistoricalTableEngine = {
    render(filters) {
      if (!filters) return;
 
      const resolver = window.HistoricalTableProfiles;
 
      if (!resolver || typeof resolver.resolve !== "function") {
        console.warn("Profiles resolver not available");
        return;
      }
 
      const profile = resolver.resolve(filters);
 
      if (!profile) {
        console.warn("Profile not resolved", filters);
        return;
      }
 
      if (!profile.target) {
        this.showNoneMode();
        return;
      }
 
      this.prepareView(profile);
      this.ensureTableReady(profile);
    },
 
    showNoneMode() {
      this.toggleMode({
        performance: false,
        unadjusted: false,
        underlying: false
      });
 
      this.destroy("#perfSummary");
      this.destroy("#unadjustedPrice");
      this.destroy("#SingleStockOptionsTable");
    },
 
    prepareView(profile) {
      this.toggleMode({
        performance: profile.target === TABLES.performance.target,
        unadjusted: profile.target === TABLES.unadjusted.target,
        underlying: profile.target === TABLES.underlying.target
      });
    },
 
    toggleMode(mode) {
      Object.keys(TABLES).forEach((key) => {
        const config = TABLES[key];
        const show = !!mode[key];
        const panel = document.getElementById(config.panelId);
        const table = document.querySelector(config.target);
 
        if (panel) {
          panel.hidden = !show;
          panel.classList.toggle("is-active", show);
        }
 
        if (table) {
          table.hidden = !show;
 
          if (!show) {
            this.clearDetachedLoader(table);
          }
        }
      });
    },
 
    ensureTableReady(profile) {
      let table = document.querySelector(profile.target);
 
      if (!table) {
        const panel = this.resolvePanel(profile.target);
 
        if (!panel) {
          console.error("Panel not found for table:", profile.target);
          return;
        }
 
        table = this.createTable(profile.target);
        panel.appendChild(table);
      }
 
      this.renderTable(profile, table);
      this.afterRender(table);
    },
 
    renderTable(profile, table) {
      if (!window.DataTableCore) {
        console.warn("DataTableCore not available");
        return;
      }
 
      const existing = DataTableCore.getInstance(table);
 
      if (existing) {
        DataTableCore.destroy(table);
        table = this.ensureFreshTable(profile.target);
      }
 
      if (!table) return;
 
      this.applyHeaders(profile, table);
 
      DataTableCore.render({
        target: table,
        columns: profile.columns,
        ajax: profile.ajax,
        dtOptions: profile.dtOptions || {},
        features: profile.features || {},
        lifecycle: profile.lifecycle || {}
      });
    },
 
    ensureFreshTable(target) {
      let table = document.querySelector(target);
 
      if (table) return table;
 
      const panel = this.resolvePanel(target);
 
      if (!panel) {
        console.error("Panel not found:", target);
        return null;
      }
 
      table = this.createTable(target);
      panel.appendChild(table);
 
      return table;
    },
 
    applyHeaders(profile, table) {
      if (!Array.isArray(profile.headers)) return;
 
      let thead = table.querySelector("thead");
      let theadRow = table.querySelector("thead tr");
 
      if (!thead) {
        thead = document.createElement("thead");
        table.insertBefore(thead, table.firstChild);
      }
 
      if (!theadRow) {
        theadRow = document.createElement("tr");
        thead.appendChild(theadRow);
      }
 
      theadRow.innerHTML = "";
 
      profile.headers.forEach(function (label) {
        const th = document.createElement("th");
        th.innerHTML = label;
        theadRow.appendChild(th);
      });
 
      if (!table.querySelector("tbody")) {
        table.appendChild(document.createElement("tbody"));
      }
    },
 
    resolvePanel(target) {
      const key = Object.keys(TABLES).find(function (name) {
        return TABLES[name].target === target;
      });
 
      return key ? document.getElementById(TABLES[key].panelId) : null;
    },
 
    createTable(target) {
      const table = document.createElement("table");
 
      table.id = target.replace("#", "");
      table.className = "table";
      table.setAttribute("data-dt", "");
 
      table.innerHTML = "<thead><tr></tr></thead><tbody></tbody>";
 
      return table;
    },
 
    clearDetachedLoader(table) {
      table
        .querySelectorAll(".datatable-loader-row")
        .forEach(function (row) {
          row.remove();
        });
    },
 
    afterRender(table) {
      if (!window.DataTableCore) return;
 
      requestAnimationFrame(() => {
        DataTableCore.onShow(table);
 
        setTimeout(() => {
          DataTableCore.onShow(table);
        }, 50);
      });
    },
 
    refresh(target) {
      if (!window.DataTableCore) return;
 
      const table = document.querySelector(target);
 
      if (!table || table.hidden) return;
 
      DataTableCore.refresh(table);
    },
 
    destroy(target) {
      if (!window.DataTableCore) return;
 
      const table = document.querySelector(target);
 
      if (!table) return;
 
      try {
        DataTableCore.destroy(table);
      } catch (e) {
        console.warn("Failed to destroy DataTable:", target, e);
      }
 
      const panel = this.resolvePanel(target);
 
      if (panel && !document.querySelector(target)) {
        panel.appendChild(this.createTable(target));
      }
    },
 
    destroyAll() {
      this.destroy("#perfSummary");
      this.destroy("#unadjustedPrice");
      this.destroy("#SingleStockOptionsTable");
    }
  };
 
  window.HistoricalTableEngine = HistoricalTableEngine;
})(window, document);