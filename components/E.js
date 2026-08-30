/* dropdown-update.js
 * ==================
 * Dependent dropdown manager
 */

(function (window, document) {
  "use strict";

  /* =========================================================
AJAX
========================================================= */

  function requestJSON(url, params, method) {
    method = (method || "GET").toUpperCase();

    if (method === "POST") {
      return fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(params || {}),
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);

        return res.json();
      });
    }

    const qs = new URLSearchParams(params || {}).toString();

    const fullUrl = qs ? url + (url.includes("?") ? "&" : "?") + qs : url;

    return fetch(fullUrl, {
      method: "GET",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);

      return res.json();
    });
  }

  /* =========================================================
Helpers
========================================================= */

  function rebuildDropdown(shell, items, mapFn, placeholder) {
    const list = shell.querySelector(".form-select-list");
    const valueEl = shell.querySelector(".form-select-value");
    const hidden = shell.querySelector("input[type='hidden']");

    if (!list) return;

    list.innerHTML = "";

    if (hidden) hidden.value = "";

    if (valueEl) {
      valueEl.textContent = placeholder || "All";
      valueEl.classList.add("is-placeholder");
    }

    const defaultOpt = document.createElement("div");
    defaultOpt.className = "form-select-option";
    defaultOpt.dataset.value = "";
    defaultOpt.textContent = placeholder || "All";

    list.appendChild(defaultOpt);

    (items || []).forEach(function (item) {
      const mapped = mapFn ? mapFn(item) : item;

      if (!mapped || mapped.value == null) return;

      const opt = document.createElement("div");

      opt.className = "form-select-option";
      opt.dataset.value = mapped.value;
      opt.textContent = mapped.label;

      list.appendChild(opt);
    });
  }

  function getActiveFilterGroups() {
    return [].slice.call(
      document.querySelectorAll("[data-filters-for].is-active:not([hidden])"),
    );
  }

  function resolveScope(shell) {
    return (
      shell.closest("[data-filters-for]") ||
      shell.closest(".tabs-container") ||
      document
    );
  }

  /* =========================================================
Dependency handler
========================================================= */

  function processDependency(sourceShell, value) {
    const field = sourceShell.dataset.field;

    if (!window.DROPDOWN_CONFIG || !window.DROPDOWN_CONFIG[field]) return;

    const config = window.DROPDOWN_CONFIG[field];
    const scope = resolveScope(sourceShell);

    (config.targets || []).forEach(function (targetCfg) {
      const targetShell = scope.querySelector(
        '[data-field="' + targetCfg.field + '"]',
      );

      if (!targetShell) return;

      const params =
        typeof targetCfg.params === "function"
          ? targetCfg.params(value, sourceShell)
          : targetCfg.params || {};

      requestJSON(targetCfg.url, params, targetCfg.method)
        .then(function (response) {
          const items = Array.isArray(response)
            ? response
            : response.data || [];

          const placeholder =
            typeof targetCfg.placeholder === "function"
              ? targetCfg.placeholder(value)
              : "All";

          rebuildDropdown(targetShell, items, targetCfg.map, placeholder);
        })

        .catch(function (err) {
          console.error("[DropdownManager]", err);
        });
    });
  }

  /* =========================================================
Initialize dropdowns when tab opens
========================================================= */

  function initializeGroup(group) {
    if (!window.DROPDOWN_CONFIG || !group) return;

    Object.keys(window.DROPDOWN_CONFIG).forEach(function (field) {
      const rule = window.DROPDOWN_CONFIG[field];

      if (!rule.init) return;

      const shell = group.querySelector('[data-field="' + field + '"]');

      if (!shell) return;

      if (shell.dataset.ddInitialized) return;

      shell.dataset.ddInitialized = "1";

      const hidden = shell.querySelector("input[type='hidden']");
      const value = hidden?.value || "";

      processDependency(shell, value);
    });
  }

  /* =========================================================
Events
========================================================= */

  document.addEventListener("form:select-change", function (e) {
    const shell = e.target.closest("[data-select]");
    if (!shell) return;

    const value = e.detail?.value || "";

    processDependency(shell, value);
  });

  document.addEventListener("DOMContentLoaded", function () {
    getActiveFilterGroups().forEach(initializeGroup);
  });

  document.addEventListener("tab:prepare", function () {
    getActiveFilterGroups().forEach(initializeGroup);
  });
})(window, document);



/* tabs-feature-engine.js
 * ======================
 * Lightweight Tab Data Engine
 * - Handles tab data loading
 * - Handles filter changes
 * - Uses native fetch (no http-client)
 */

(function (window, document) {
  "use strict";

  /* =========================================================
Helpers
========================================================= */

  function buildUrl(url, params) {
    if (!params || !Object.keys(params).length) return url;

    const qs = new URLSearchParams(params).toString();

    return url + (url.includes("?") ? "&" : "?") + qs;
  }

  function normalizeResponse(response) {
    if (!response) return [];

    if (Array.isArray(response)) return response;

    if (Array.isArray(response.data)) return response.data;

    return [];
  }

  function getActiveTab(container) {
    return (
      container.querySelector('[role="tab"].is-active[data-tab]') ||
      container.querySelector('[role="tab"][aria-selected="true"][data-tab]')
    );
  }

  function getPanel(container, tabKey) {
    const tab = container.querySelector(
      '[role="tab"][data-tab="' + tabKey + '"]',
    );

    const panelId = tab?.getAttribute("aria-controls");

    if (panelId) {
      const panel = document.getElementById(panelId);

      if (panel) return panel;
    }

    return container.querySelector(
      '.tab-content__panel[data-tab="' + tabKey + '"]',
    );
  }

  function getFilters(container, tabKey) {
    const filtersRoot = container.querySelector("[data-filters]");
    if (!filtersRoot) return {};

    const group = filtersRoot.querySelector(
      '[data-filters-for="' + tabKey + '"]',
    );
    if (!group) return {};

    const inputs = group.querySelectorAll("[data-filter]");
    const out = {};

    inputs.forEach(function (el) {
      const key = el.dataset.filter;
      if (!key) return;

      if (el.type === "checkbox") {
        out[key] = el.checked ? el.value : "";
      } else if (el.type === "radio") {
        if (el.checked) out[key] = el.value;
      } else {
        out[key] = el.value;
      }
    });

    return out;
  }

  function showLoader(panel) {
    if (panel) panel.classList.add("is-loading");
  }

  function hideLoader(panel) {
    if (panel) panel.classList.remove("is-loading");
  }

  /* =========================================================
Engine
========================================================= */

  function mount(container, config) {
    if (!container || container.__tabsFeatureMounted) return;

    container.__tabsFeatureMounted = true;

    const state = {
      config: config || {},
      loading: false,
      debounceTimer: null,
    };

    /* =========================================================
Fetch Data
========================================================= */

    function requestData(tabKey) {
      if (state.loading) return;

      const tabCfg = state.config.tabs?.[tabKey];
      if (!tabCfg) return;

      const panel = getPanel(container, tabKey);
      const filters = getFilters(container, tabKey);

      const ctx = {
        container: container,
        tabKey: tabKey,
        panel: panel,
        filters: filters,
      };

      const params =
        typeof tabCfg.getParams === "function"
          ? tabCfg.getParams(ctx)
          : tabCfg.params || {};

      const url =
        typeof tabCfg.getUrl === "function" ? tabCfg.getUrl(ctx) : tabCfg.url;

      state.loading = true;

      showLoader(panel);

      fetch(buildUrl(url, params), {
        method: tabCfg.method || "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);

          return res.json();
        })
        .then(function (response) {
          const active = getActiveTab(container);

          if (!active || active.dataset.tab !== tabKey) {
            return;
          }

          ctx.rows = (tabCfg.normalize || normalizeResponse)(response, ctx);

          (tabCfg.render || function () {})(ctx);
        })
        .catch(function (err) {
          console.error("[TabsFeatureEngine]", err);
        })
        .finally(function () {
          state.loading = false;

          hideLoader(panel);
        });
    }

    /* =========================================================
Refresh Helpers
========================================================= */

    function refreshActive() {
      const active = getActiveTab(container);

      if (!active) return;

      requestData(active.dataset.tab);
    }

    function scheduleRefresh() {
      clearTimeout(state.debounceTimer);

      state.debounceTimer = setTimeout(
        refreshActive,
        state.config.debounceMs || 250,
      );
    }

    /* =========================================================
Events
========================================================= */

    container.addEventListener("tab:change", function (e) {
      const tabKey = e.detail?.tabKey;
      if (!tabKey) return;

      /* prepare dropdown dependencies */

      document.dispatchEvent(new Event("tab:prepare"));

      /* slight delay to allow dropdowns */

      setTimeout(function () {
        requestData(tabKey);
      }, 50);
    });

    /* dropdown change */

    container.addEventListener("form:select-change", scheduleRefresh);

    /* filter inputs */

    container.addEventListener("change", function (e) {
      if (e.target && e.target.matches("[data-filter]")) {
        scheduleRefresh();
      }
    });

    /* optional load on mount */

    if (state.config.loadOnMount) {
      refreshActive();
    }
  }

  window.TabsFeatureEngine = {
    mount: mount,
  };
})(window, document);



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