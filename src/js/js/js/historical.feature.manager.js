/* ======================================================
 Historical Feature Manager
 Page-level controller for filters, tabs, notes and table reloads
 ====================================================== */
 
(function (window, document) {
  "use strict";
 
  const DEFAULT_ACTIVE_TAB = "performance";
 
  const HistoricalManager = {
    init() {
      this.isResetting = false;
 
      this.cacheDom();
      this.setDefaultDatesIfEmpty();
      this.bindEvents();
 
      this.syncSelectUI();
      this.applyRules();
      this.reloadTables();
    },
 
    cacheDom() {
      this.dom = {
        market: document.querySelector('[data-filter="market"]'),
        sector: document.querySelector('[data-filter="sector"]'),
        entity: document.querySelector('[data-filter="entity"]'),
        tradeType: document.querySelector('[data-filter="tradeType"]'),
 
        startDate: document.querySelector('[data-filter="startDate"]'),
        endDate: document.querySelector('[data-filter="endDate"]'),
 
        message: document.getElementById("historicalFilterMessage"),
        placeholder: document.getElementById("historical-empty-state"),
        placeholderMessage: document.getElementById(
          "historical-placeholder-message"
        ),
        emptyImage: document.getElementById("historical-empty-image"),
 
        content: document.getElementById("historical-content"),
        tabs: document.querySelector("[data-tabs]"),
        pagination: document.querySelector(".feed__pagination"),
 
        tradeTypeFilter: document.getElementById("tradeTypeFilter"),
 
        defaultNote: document.getElementById("note"),
        defaultNoteText: document.getElementById("noteTxt"),
        derivativesNote: document.getElementById("note_derivatives"),
        derivativesNoteText: document.getElementById("noteTxt_derivatives")
      };
    },
 
    setDefaultDatesIfEmpty() {
      const { startDate, endDate } = this.dom;
 
      if (!startDate || !endDate) return;
      if (startDate.value && endDate.value) return;
 
      const today = new Date();
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
 
      if (!endDate.value) endDate.value = this.formatDate(today);
      if (!startDate.value) startDate.value = this.formatDate(oneMonthAgo);
    },
 
    formatDate(date) {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
 
      return day + "-" + month + "-" + year;
    },
 
    getActiveTab() {
      const tab = document.querySelector(
        '.tabs [data-tab].is-active, .tabs [data-tab][aria-selected="true"]'
      );
 
      return tab?.dataset.tab || DEFAULT_ACTIVE_TAB;
    },
 
    getFilters() {
      const d = this.dom;
 
      return {
        market: d.market?.value || "-1",
        sector: d.sector?.value || "0",
        entity: d.entity?.value || "0",
        tradeType: d.tradeType?.value || "OB",
        startDate: d.startDate?.value || "",
        endDate: d.endDate?.value || "",
        activeTab: this.getActiveTab()
      };
    },
 
    bindEvents() {
      document.addEventListener("form:select-change", (e) => {
        if (this.isResetting) return;
 
        const field = e.target?.dataset?.field || "";
        this.onFilterChange(field);
      });
 
      document.addEventListener("change", (e) => {
        if (this.isResetting) return;
 
        if (
          e.target.matches('[data-filter="startDate"]') ||
          e.target.matches('[data-filter="endDate"]')
        ) {
          this.onFilterChange("date");
        }
      });
 
      document.addEventListener("tab:change", () => {
        if (this.isResetting) return;
 
        this.applyRules();
        this.rebuildTables();
      });
 
      document
        .getElementById("historicalResetBtn")
        ?.addEventListener("click", () => {
          this.resetFilters();
        });
    },
 
    onFilterChange(field) {
        if (field === "market") {
            if (this.dom.sector) this.dom.sector.value = "0";
            if (this.dom.entity) this.dom.entity.value = "0";
        }
     
        if (field === "sector") {
            if (this.dom.entity) this.dom.entity.value = "0";
        }
     
        this.syncSelectUI();
        this.rebuildTables();
    },
 
    isHeavyChange(field) {
      return [
        "market",
        "sector",
        "entity",
        "tradeType",
        "date",
        "tab",
        "reset"
      ].includes(field);
    },
 
resetFilters() {
      const d = this.dom;
      const defaults = window.HistoricalConfig?.defaults || {};
 
      this.isResetting = true;
 
      const market = defaults.market || "INDICES";
      const sector = defaults.sector || "M";
      const entity = defaults.entity || "M:TASI";
      const tradeType = defaults.tradeType || "OB";
 
      const today = new Date();
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
 
      if (d.endDate) d.endDate.value = this.formatDate(today);
      if (d.startDate) d.startDate.value = this.formatDate(oneMonthAgo);
      if (d.tradeType) d.tradeType.value = tradeType;
 
      this.activateTab("performance");
 
      const finishReset = () => {
        if (window.DropdownManager?.setSelectedValue) {
          window.DropdownManager.setSelectedValue(
            document.querySelector('[data-field="tradeType"]'),
            tradeType
          );
        }
 
        this.isResetting = false;
        this.syncSelectUI();
        this.applyRules();
        this.rebuildTables();
      };
 
      if (window.DropdownManager?.resetChain) {
        window.DropdownManager
          .resetChain({
            market: market,
            sector: sector,
            entity: entity
          })
          .then(finishReset)
          .catch(() => {
            if (d.market) d.market.value = market;
            if (d.sector) d.sector.value = sector;
            if (d.entity) d.entity.value = entity;
 
            this.syncSelectUI();
            finishReset();
          });
 
        return;
      }
 
      if (d.market) d.market.value = market;
      if (d.sector) d.sector.value = sector;
      if (d.entity) d.entity.value = entity;
 
      this.syncSelectUI();
      finishReset();
    },
 
    activateTab(tabName) {
      document.querySelectorAll(".tabs [data-tab]").forEach((tab) => {
        const active = tab.dataset.tab === tabName;
 
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
        tab.tabIndex = active ? 0 : -1;
      });
    },
 
    syncSelectUI() {
      if (window.DropdownManager?.setSelectedValue) {
        window.DropdownManager.setSelectedValue(
          document.querySelector('[data-field="market"]'),
          this.dom.market?.value || "-1"
        );
 
        window.DropdownManager.setSelectedValue(
          document.querySelector('[data-field="sector"]'),
          this.dom.sector?.value || "0"
        );
 
        window.DropdownManager.setSelectedValue(
          document.querySelector('[data-field="entity"]'),
          this.dom.entity?.value || "0"
        );
 
        window.DropdownManager.setSelectedValue(
          document.querySelector('[data-field="tradeType"]'),
          this.dom.tradeType?.value || "OB"
        );
 
        return;
      }
 
      document.querySelectorAll("[data-select]").forEach((shell) => {
        const hidden = shell.querySelector("input[type='hidden']");
        const valueEl = shell.querySelector(".form-select-value");
 
        if (!hidden || !valueEl) return;
 
        const selectedOption = shell.querySelector(
          '.form-select-option[data-value="' + hidden.value + '"]'
        );
 
        if (selectedOption) {
          valueEl.textContent = selectedOption.textContent.trim();
          valueEl.classList.remove("is-placeholder");
        } else {
          valueEl.textContent = "";
          valueEl.classList.add("is-placeholder");
        }
      });
    },
 
    applyRules() {
      if (!window.HistoricalRules) return;
 
      const rules = window.HistoricalRules.resolve();
      const d = this.dom;
 
      if (d.tradeTypeFilter) {
        d.tradeTypeFilter.hidden = !rules.showTradeType;
      }
 
      if (d.tradeType) {
        d.tradeType.value = rules.showTradeType
          ? d.tradeType.value || "OB"
          : "OB";
      }
 
      const unadjustedTab = document.querySelector('[data-tab="unadjusted"]');
      const unadjustedPanel = document.getElementById(
        "historical-panel-unadjusted"
      );
 
      if (unadjustedTab) {
        unadjustedTab.style.display = rules.showUnadjustedTab ? "" : "none";
      }
 
      if (unadjustedPanel) {
        unadjustedPanel.style.display = rules.showUnadjustedTab ? "" : "none";
      }
 
      if (!rules.showUnadjustedTab && rules.filters.activeTab === "unadjusted") {
        this.activateTab("performance");
      }
 
      this.applyNote(rules.note);
    },
 
    applyNote(note) {
      this.hideNotes();
 
      if (!note || !note.visible || !note.message) return;
 
      if (note.target === "derivatives") {
        if (this.dom.derivativesNote) this.dom.derivativesNote.hidden = false;
        if (this.dom.derivativesNoteText) {
          this.dom.derivativesNoteText.innerHTML = note.message;
        }
        return;
      }
 
      if (this.dom.defaultNote) this.dom.defaultNote.hidden = false;
      if (this.dom.defaultNoteText) {
        this.dom.defaultNoteText.innerHTML = note.message;
      }
    },
 
    hideNotes() {
      if (this.dom.defaultNote) this.dom.defaultNote.hidden = true;
      if (this.dom.defaultNoteText) this.dom.defaultNoteText.innerHTML = "";
 
      if (this.dom.derivativesNote) this.dom.derivativesNote.hidden = true;
      if (this.dom.derivativesNoteText) {
        this.dom.derivativesNoteText.innerHTML = "";
      }
    },
 
    showPlaceholder(message, options) {
      const d = this.dom;
      const showImage = !!options?.showImage;
 
      if (d.message) d.message.hidden = true;
 
      if (d.placeholderMessage) {
        d.placeholderMessage.innerText = message || "";
      }
 
      if (d.emptyImage) {
        d.emptyImage.hidden = !showImage;
      }
 
      if (d.placeholder) d.placeholder.hidden = false;
      if (d.content) d.content.style.display = "none";
      if (d.tabs) d.tabs.hidden = true;
      if (d.pagination) d.pagination.hidden = true;
 
      this.hideNotes();
    },
 
showInvalidState(message) {
      this.showPlaceholder(
        message ||
          window.HistoricalI18n?.placeholderSelectFilters ||
          "Please select filters to view historical data.",
        { showImage: false }
      );
 
      this.destroyAllTables();
      this.resetPaginationUI();
    },
 
    showNoDataState() {
      this.showPlaceholder(
        window.HistoricalI18n?.noDataMessage || "No data available.",
        { showImage: true }
      );
 
      this.destroyAllTables();
      this.resetPaginationUI();
    },
 
    showNoteOnlyState(message) {
      this.showPlaceholder(message || "", { showImage: false });
 
      this.destroyAllTables();
      this.resetPaginationUI();
    },
 
    showValidState() {
      const d = this.dom;
 
      if (d.message) d.message.hidden = true;
      if (d.placeholder) d.placeholder.hidden = true;
      if (d.content) d.content.style.display = "";
      if (d.tabs) d.tabs.hidden = false;
      if (d.pagination) d.pagination.hidden = false;
    },
 
    reloadTables() {
      if (!window.HistoricalTableEngine || !window.HistoricalRules) return;
 
      const rules = window.HistoricalRules.resolve();
 
      if (!rules.ready) {
        this.showInvalidState(rules.message);
        return;
      }
 
      if (rules.profileType === "none") {
        this.showNoteOnlyState(rules.note?.message || rules.message);
        return;
      }
 
      this.showValidState();
      this.applyNote(rules.note);
      window.HistoricalTableEngine.render(rules.filters);
    },
 
    refreshTables() {
      if (!window.HistoricalTableEngine || !window.HistoricalTableProfiles) {
        return;
      }
 
      const rules = window.HistoricalRules.resolve();
 
      if (!rules.ready) {
        this.showInvalidState(rules.message);
        return;
      }
 
      if (rules.profileType === "none") {
        this.showNoteOnlyState(rules.note?.message || rules.message);
        return;
      }
 
      this.showValidState();
      this.applyNote(rules.note);
 
      const profile = window.HistoricalTableProfiles.resolve();
 
      if (!profile?.target || !document.querySelector(profile.target)) {
        this.reloadTables();
        return;
      }
 
      window.HistoricalTableEngine.refresh(profile.target);
    },
 
    rebuildTables() {
      this.destroyAllTables();
      this.resetPaginationUI();
      this.reloadTables();
    },
 
    destroyAllTables() {
      if (!window.HistoricalTableEngine) return;
 
      if (typeof window.HistoricalTableEngine.destroyAll === "function") {
        window.HistoricalTableEngine.destroyAll();
        return;
      }
 
      window.HistoricalTableEngine.destroy("#perfSummary");
      window.HistoricalTableEngine.destroy("#unadjustedPrice");
      window.HistoricalTableEngine.destroy("#SingleStockOptionsTable");
    },
 
    resetPaginationUI() {
      const range = document.querySelector("[data-feed-range]");
      const page = document.querySelector("[data-feed-page]");
      const totalPages = document.querySelector("[data-feed-total-pages]");
      const prevBtn = document.querySelector("[data-feed-prev]");
      const nextBtn = document.querySelector("[data-feed-next]");
 
      if (range) range.textContent = "0–0 of 0";
      if (page) page.innerHTML = "";
      if (totalPages) totalPages.textContent = "0";
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
    }
  };
 
  document.addEventListener("DOMContentLoaded", function () {
    HistoricalManager.init();
  });
 
  window.HistoricalManager = HistoricalManager;
})(window, document);
 