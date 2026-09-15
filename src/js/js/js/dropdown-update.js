/* =========================================================
Dependent Dropdown Manager
Shared across platform
========================================================= */
 
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
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify(params || {})
      }).then(handleResponse);
    }
 
    const qs = new URLSearchParams(params || {}).toString();
    const fullUrl = qs ? url + (url.indexOf("?") > -1 ? "&" : "?") + qs : url;
 
    return fetch(fullUrl, {
      method: "GET",
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }).then(handleResponse);
  }
 
  function handleResponse(res) {
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
 
    return res.json();
  }
 
  /* =========================================================
   Helpers
   ========================================================= */
 
  function setShellDisabled(shell, disabled) {
    if (!shell) return;
 
    shell.classList.toggle("is-disabled", !!disabled);
    shell.setAttribute("aria-disabled", disabled ? "true" : "false");
 
    if (disabled) {
      shell.classList.remove("is-open", "is-open-up", "is-closing");
    }
  }
 
  function setSelectedValue(shell, value, fallbackLabel) {
    if (!shell) return;
 
    const valueEl = shell.querySelector(".form-select-value");
    const hidden = shell.querySelector("input[type='hidden']");
    const options = Array.from(shell.querySelectorAll(".form-select-option"));
 
    const normalizedValue = value !== undefined && value !== null
      ? String(value)
      : "0";
 
    if (hidden) hidden.value = normalizedValue;
 
    options.forEach(function (opt) {
      opt.classList.remove("is-selected");
      opt.removeAttribute("data-selected");
    });
 
    const selected = options.find(function (opt) {
      return String(opt.dataset.value) === normalizedValue;
    });
 
    if (selected) {
      selected.classList.add("is-selected");
      selected.dataset.selected = "true";
 
      if (valueEl) {
        valueEl.textContent = selected.textContent.trim();
        valueEl.classList.remove("is-placeholder");
      }
 
      return;
    }
 
    if (valueEl) {
      valueEl.textContent = fallbackLabel || "";
      valueEl.classList.add("is-placeholder");
    }
  }
 
  function rebuildDropdown(shell, items, mapFn, placeholder, selectedValue) {
    if (!shell) return;
 
    const list = shell.querySelector(".form-select-list");
    if (!list) return;
 
    const normalizedSelectedValue =
      selectedValue !== undefined && selectedValue !== null
        ? String(selectedValue)
        : "0";
 
    list.innerHTML = "";
 
    const defaultOpt = document.createElement("div");
    defaultOpt.className = "form-select-option";
    defaultOpt.dataset.value = "0";
    defaultOpt.textContent = placeholder || "All";
    list.appendChild(defaultOpt);
 
    (items || []).forEach(function (item) {
      const mapped = mapFn ? mapFn(item) : item;
 
      if (!mapped || mapped.value == null) return;
 
      const opt = document.createElement("div");
      opt.className = "form-select-option";
      opt.dataset.value = String(mapped.value);
      opt.textContent = mapped.label || "-";
 
      list.appendChild(opt);
    });
 
    setSelectedValue(shell, normalizedSelectedValue, placeholder || "All");
  }
 
  function getActiveFilterGroups() {
    return Array.from(
      document.querySelectorAll(
        "[data-filters].is-active:not([hidden]), [data-filters-for].is-active:not([hidden])"
      )
    );
  }
 
  function resolveScope(shell) {
    return (
      shell.closest("[data-filters]") ||
      shell.closest("[data-filters-for]") ||
      shell.closest(".tabs-container") ||
      document
    );
  }
 
  function normalizeResponseItems(response) {
    if (Array.isArray(response)) return response;
    return response && Array.isArray(response.data) ? response.data : [];
  }
 
  /* =========================================================
   Dependency Processing
   ========================================================= */
 
  function processDependency(sourceShell, value, options) {
    if (!sourceShell) return Promise.resolve([]);
 
    options = options || {};
 
    const field = sourceShell.dataset.field;
 
    if (!window.DROPDOWN_CONFIG || !window.DROPDOWN_CONFIG[field]) {
      return Promise.resolve([]);
    }
 
    const config = window.DROPDOWN_CONFIG[field];
    const scope = resolveScope(sourceShell);
 
    const jobs = (config.targets || []).map(function (targetCfg) {
      const targetShell = scope.querySelector(
        '[data-field="' + targetCfg.field + '"]'
      );
 
      if (!targetShell) return Promise.resolve(null);
 
      const params =
        typeof targetCfg.params === "function"
          ? targetCfg.params(value, sourceShell)
          : targetCfg.params || {};
 
      if (params === false) {
        setShellDisabled(targetShell, true);
        rebuildDropdown(targetShell, [], null, targetCfg.placeholder ? targetCfg.placeholder(value) : "All", "0");
        return Promise.resolve(null);
      }
 
      setShellDisabled(targetShell, false);
 
      return requestJSON(targetCfg.url, params, targetCfg.method)
        .then(function (response) {
          const items = normalizeResponseItems(response);
 
          const placeholder =
            typeof targetCfg.placeholder === "function"
              ? targetCfg.placeholder(value)
              : "All";
 
          const selectedValue =
            options.selectedValues &&
            Object.prototype.hasOwnProperty.call(
              options.selectedValues,
              targetCfg.field
            )
              ? options.selectedValues[targetCfg.field]
              : "0";
 
          rebuildDropdown(
            targetShell,
            items,
            targetCfg.map,
            placeholder,
            selectedValue
          );
 
          return {
            field: targetCfg.field,
            shell: targetShell,
            items: items
          };
        })
        .catch(function (err) {
          console.error("[DropdownManager]", err);
          return null;
        });
    });
 
    return Promise.all(jobs);
  }
 
  /* =========================================================
   Reset Chain
   ========================================================= */
 
  function resetChain(options) {
    options = options || {};
 
    const market = options.market || "INDICES";
    const sector = options.sector || "M";
    const entity = options.entity || "M:TASI";
 
    const marketShell = document.querySelector('[data-field="market"]');
 
    setSelectedValue(marketShell, market);
 
    return processDependency(marketShell, market, {
      selectedValues: {
        sector: sector
      }
    })
      .then(function () {
        const sectorShell = document.querySelector('[data-field="sector"]');
 
        setSelectedValue(sectorShell, sector);
 
        return processDependency(sectorShell, sector, {
          selectedValues: {
            entity: entity
          }
        });
      })
      .then(function () {
        const entityShell = document.querySelector('[data-field="entity"]');
 
        setSelectedValue(entityShell, entity);
 
        return {
          market: market,
          sector: sector,
          entity: entity
        };
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
	    const value = hidden ? hidden.value : "";
	 
	    const selectedValues = {};
	 
	    if (field === "market") {
	      selectedValues.sector =
	        group.querySelector('[data-field="sector"] input[type="hidden"]')
	          ?.value || "0";
	 
	      selectedValues.entity =
	        group.querySelector('[data-field="entity"] input[type="hidden"]')
	          ?.value || "0";
	    }
	 
	    processDependency(shell, value, {
	      selectedValues: selectedValues
	    });
	  });
	}
 
  /* =========================================================
   Events
   ========================================================= */
 
  document.addEventListener("form:select-change", function (e) {
    const shell = e.target.closest("[data-select]");
    if (!shell) return;
 
    const value = e.detail && e.detail.value ? e.detail.value : "";
 
    processDependency(shell, value);
  });
 
  document.addEventListener("DOMContentLoaded", function () {
    getActiveFilterGroups().forEach(initializeGroup);
  });
 
  document.addEventListener("tab:prepare", function () {
    getActiveFilterGroups().forEach(initializeGroup);
  });
 
  window.DropdownManager = {
    process: processDependency,
    rebuild: rebuildDropdown,
    resetChain: resetChain,
    setSelectedValue: setSelectedValue,
    setDisabled: setShellDisabled
  };
})(window, document);