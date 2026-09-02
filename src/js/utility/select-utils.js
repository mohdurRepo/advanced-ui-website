(function (window, document) {
  "use strict";
 
  function noop() {}
 
  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }
 
  function getOptions(shell) {
    if (!shell) return [];
 
    return toArray(
      shell.querySelectorAll(".form-select-option[data-value]")
    );
  }
 
  function getOptionKey(option) {
    return option ? option.getAttribute("data-value") : null;
  }
 
  function setOptionSelected(option, selected) {
    if (!option) return;
 
    if (selected) {
      option.setAttribute("data-selected", "true");
    } else {
      option.removeAttribute("data-selected");
    }
 
    var checkbox = option.querySelector(".form-select-checkbox");
 
    if (checkbox) {
      checkbox.checked = !!selected;
    }
  }
 
  function syncOptionsFromState(shell, stateMap) {
    getOptions(shell).forEach(function (option) {
      var key = getOptionKey(option);
 
      if (!key || !(key in stateMap)) return;
 
      setOptionSelected(option, !!stateMap[key]);
    });
  }
 
  function getSelectedKeys(stateMap) {
    return Object.keys(stateMap || {}).filter(function (key) {
      return !!stateMap[key];
    });
  }
 
  function updateValueLabel(valueEl, stateMap, labels) {
    if (!valueEl) return;
 
    var safeLabels = labels || {};
    var keys = Object.keys(stateMap || {});
    var total = keys.length;
    var selected = getSelectedKeys(stateMap).length;
 
    if (total === 0 || selected === total) {
      valueEl.textContent = safeLabels.showAll || "Show All";
      valueEl.classList.add("is-placeholder");
      return;
    }
 
    if (selected === 0) {
      valueEl.textContent = safeLabels.noColumns || "No Columns";
      valueEl.classList.remove("is-placeholder");
      return;
    }
 
    valueEl.textContent =
      selected + " " + (safeLabels.selectedSuffix || "Selected");
 
    valueEl.classList.remove("is-placeholder");
  }
 
  function syncHiddenInput(input, stateMap) {
    if (!input) return;
 
    input.value = getSelectedKeys(stateMap).join(",");
  }
 
  function setAll(stateMap, selected) {
    Object.keys(stateMap || {}).forEach(function (key) {
      stateMap[key] = !!selected;
    });
  }
 
  function toggleKey(stateMap, key) {
    if (!stateMap || !(key in stateMap)) return false;
 
    stateMap[key] = !stateMap[key];
 
    return true;
  }
 
  function filterOptions(shell, searchValue) {
    if (!shell) return;
 
    var query = String(searchValue || "")
      .trim()
      .toLowerCase();
 
    getOptions(shell).forEach(function (option) {
      var text = option.textContent.toLowerCase();
      var visible = !query || text.indexOf(query) > -1;
 
      option.hidden = !visible;
    });
  }
 
  function createMultiSelectController(options) {
    var opts = options || {};
 
    var shell = opts.shell;
    var valueEl = opts.valueEl;
    var input = opts.input;
    var stateMap = opts.stateMap || {};
    var labels = opts.labels || {};
    var onChange = opts.onChange || noop;
 
    var searchInput = shell
      ? shell.querySelector(".form-select-search")
      : null;
 
    if (!shell) {
      return {
        sync: noop,
        destroy: noop
      };
    }
 
    function sync() {
      syncOptionsFromState(shell, stateMap);
      updateValueLabel(valueEl, stateMap, labels);
      syncHiddenInput(input, stateMap);
    }
 
    function handleClick(event) {
      var action = event.target.closest("[data-column-action]");
 
      if (action && shell.contains(action)) {
        event.preventDefault();
        event.stopPropagation();
 
        var actionType = action.getAttribute("data-column-action");
 
        if (actionType === "select-all") {
          setAll(stateMap, true);
        }
 
        if (actionType === "clear-all") {
          setAll(stateMap, false);
        }
 
        sync();
 
        onChange(stateMap, {
          type: actionType,
          event: event
        });
 
        return;
      }
 
      var option = event.target.closest(
        ".form-select-option[data-value]"
      );
 
      if (!option || !shell.contains(option)) return;
 
      var key = getOptionKey(option);
 
      if (!key || !(key in stateMap)) return;
 
      event.preventDefault();
      event.stopPropagation();
 
      toggleKey(stateMap, key);
 
      sync();
 
      onChange(stateMap, {
        type: "toggle",
        key: key,
        event: event
      });
    }
 
    function handleSearch(event) {
      filterOptions(shell, event.target.value);
    }
 
    shell.removeEventListener("click", handleClick);
    shell.addEventListener("click", handleClick);
 
    if (searchInput) {
      searchInput.removeEventListener("input", handleSearch);
      searchInput.addEventListener("input", handleSearch);
    }
 
    sync();
 
    return {
      sync: sync,
 
      setAll: function (selected) {
        setAll(stateMap, selected);
 
        sync();
 
        onChange(stateMap, {
          type: selected ? "select-all" : "clear-all"
        });
      },
 
      destroy: function () {
        shell.removeEventListener("click", handleClick);
 
        if (searchInput) {
          searchInput.removeEventListener("input", handleSearch);
        }
      }
    };
  }
 
  window.SelectUtils = {
    createMultiSelectController: createMultiSelectController,
    syncOptionsFromState: syncOptionsFromState,
    updateValueLabel: updateValueLabel,
    syncHiddenInput: syncHiddenInput,
    getSelectedKeys: getSelectedKeys,
    setAll: setAll,
    toggleKey: toggleKey,
    filterOptions: filterOptions
  };
})(window, document);