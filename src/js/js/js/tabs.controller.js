/* tabs.controller.js
* ==================
* Generic Tabs Controller (UI-only)
*
* Responsibilities:
* - Handle tab click + keyboard interactions
* - Manage active tab state (CSS classes, ARIA, tabindex)
* - Show/hide matching tab panels (via `hidden`)
* - Show/hide matching filter groups (via `data-filters-for`)
* - Emit `tab:change` event with { tabKey }
*
* No AJAX. No DataTables. No business logic.
*/
 
(function (window, document) {
  "use strict";
 
  function emit(el, name, detail) {
    el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }
 
  function getContentRoot(container) {
    var contentSelector = container.getAttribute("data-content-target");
    if (!contentSelector) return container; // panels could be inside container
    var root = document.querySelector(contentSelector);
    return root || container;
  }
 
  function getTabs(container) {
    return Array.prototype.slice.call(container.querySelectorAll('[role="tab"][data-tab]'));
  }
 
  function getPanels(container, contentRoot) {
    // panels can be in external root (#main-content) or inside container
    return Array.prototype.slice.call(
      contentRoot.querySelectorAll('.tab-content__panel[data-tab]')
    ).filter(function (p) {
      // If panels are global on page, we still accept them; best practice is unique IDs per instance.
      // We rely on `aria-controls`/id match when possible.
      return true;
    });
  }
 
  function getFilterGroups(container) {
    var filtersRoot = container.querySelector("[data-filters]");
    if (!filtersRoot) return [];
    return Array.prototype.slice.call(filtersRoot.querySelectorAll("[data-filters-for]"));
  }
 
  function activateTab(container, tabKey) {
    var tabs = getTabs(container);
    if (!tabs.length) return;
 
    var contentRoot = getContentRoot(container);
    var panels = getPanels(container, contentRoot);
    var filterGroups = getFilterGroups(container);
 
    // Activate tabs
    tabs.forEach(function (tab) {
      var isActive = tab.dataset.tab === tabKey;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.setAttribute("tabindex", isActive ? "0" : "-1");
    });
 
    // Show/hide panels
    panels.forEach(function (panel) {
      var isMatch = panel.dataset.tab === tabKey;
      panel.classList.toggle("is-active", isMatch);
      panel.hidden = !isMatch;
      panel.setAttribute("aria-hidden", String(!isMatch));
    });
 
    // Show/hide filters (if present)
    if (filterGroups.length) {
      filterGroups.forEach(function (group) {
        var isMatch = group.getAttribute("data-filters-for") === tabKey;
        group.classList.toggle("is-active", isMatch);
        group.hidden = !isMatch;
      });
    }
 
    emit(container, "tab:change", { tabKey: tabKey });
  }
 
  function onKeydown(container, e) {
    var key = e.key;
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;
 
    var tabs = getTabs(container);
    if (!tabs.length) return;
 
    var currentIndex = tabs.findIndex(function (t) {
      return t.classList.contains("is-active") || t.getAttribute("aria-selected") === "true";
    });
    if (currentIndex < 0) currentIndex = 0;
 
    var nextIndex = currentIndex;
 
    if (key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = tabs.length - 1;
 
    e.preventDefault();
    tabs[nextIndex].focus();
    // Activate on focus move (Bootstrap-like behavior). If you prefer "manual" activation, remove next line.
    activateTab(container, tabs[nextIndex].dataset.tab);
  }
 
  function initTabs(container) {
    if (!container || container.__tabsInitialized) return;
    container.__tabsInitialized = true;
 
    var tabs = getTabs(container);
    if (!tabs.length) return;
 
    // Click binding
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var tabKey = tab.dataset.tab;
        if (!tabKey || tab.classList.contains("is-active")) return;
        activateTab(container, tabKey);
      });
    });
 
    // Keyboard support
    container.addEventListener("keydown", function (e) {
      // only when focus is within a tab
      if (!e.target || e.target.getAttribute("role") !== "tab") return;
      onKeydown(container, e);
    });
 
    // Initial activation: keep existing .is-active or default to first
    var initiallyActive = tabs.find(function (t) {
      return t.classList.contains("is-active") || t.getAttribute("aria-selected") === "true";
    });
    var initialKey = initiallyActive ? initiallyActive.dataset.tab : tabs[0].dataset.tab;
    activateTab(container, initialKey);
  }
 
  // Auto-init
  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.slice
      .call(document.querySelectorAll("[data-tabs].tabs-container, .tabs-container[data-tabs]"))
      .forEach(initTabs);
  });
 
  // Optional public API
  window.TabsController = {
    init: initTabs,
    activate: function (container, tabKey) {
      if (!container || !tabKey) return;
      activateTab(container, tabKey);
    },
  };
})(window, document);