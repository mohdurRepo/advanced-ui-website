/* ==========================================================================
   Market Watch Filters
   ========================================================================== */

/*
 * One responsibility:
 * Manage Market Watch filter controls and emit state changes.
 *
 * This module has no:
 * - AJAX requests
 * - DataTables code
 * - mobile-card rendering
 * - login implementation
 *
 * Watchlist login/dialog behavior is delegated through MarketWatchConfig.
 */

const SELECTORS = {
  form: "[data-market-watch-filters]",
  industry: "[data-market-watch-industry]",
  tableView: "[data-market-watch-table-view]",
  watchlist: "[data-market-watch-watchlist]",

  columnsTrigger: "[data-market-watch-columns]",
  columnsMenu: "[data-market-watch-columns-menu]",
  columnsLabel: "[data-market-watch-columns-label]",
  columnInput: "[data-market-watch-column]",
  columnAction: "[data-market-watch-columns-action]",
};

function isElement(value) {
  return value instanceof Element;
}

function toArray(value) {
  return Array.from(value || []);
}

function unique(values) {
  return [...new Set(values)];
}

function createInitialState(config = {}) {
  const initialState = config.initialState || {};

  return {
    industry: initialState.industry || "all",
    tableView: String(initialState.tableView || "1"),
    watchlistOnly: Boolean(initialState.watchlistOnly),

    visibleGroups: unique(
      initialState.visibleGroups || [
        "range",
        "last-trade",
        "cumulative",
        "trading",
        "best-bid",
        "best-offer",
      ],
    ),
  };
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketWatchFilters(config = {}, root = document) {
  const form = root.querySelector(SELECTORS.form);

  if (!form) {
    throw new Error(
      "Market Watch filters require [data-market-watch-filters].",
    );
  }

  const elements = {
    form,
    industry: form.querySelector(SELECTORS.industry),
    tableView: form.querySelector(SELECTORS.tableView),
    watchlist: form.querySelector(SELECTORS.watchlist),

    columnsTrigger: form.querySelector(SELECTORS.columnsTrigger),
    columnsMenu: form.querySelector(SELECTORS.columnsMenu),
    columnsLabel: form.querySelector(SELECTORS.columnsLabel),
  };

  const state = createInitialState(config);
  const availableGroups = new Set(state.visibleGroups);
  const listeners = new Set();

  let isOpen = false;
  let isDestroyed = false;

  function getColumnInputs() {
    if (!elements.columnsMenu) {
      return [];
    }

    return toArray(
      elements.columnsMenu.querySelectorAll(SELECTORS.columnInput),
    );
  }

  function getAvailableColumnInputs() {
    return getColumnInputs().filter((input) => !input.disabled);
  }

  function getVisibleGroups() {
    const available = new Set(
      getAvailableColumnInputs().map(
        (input) => input.value || input.dataset.marketWatchColumn,
      ),
    );

    return state.visibleGroups.filter((groupId) => available.has(groupId));
  }

  function getSnapshot() {
    return Object.freeze({
      industry: state.industry,
      tableView: state.tableView,
      watchlistOnly: state.watchlistOnly,
      visibleGroups: [...state.visibleGroups],
    });
  }

  function emit(type, sourceEvent) {
    const detail = Object.freeze({
      type,
      state: getSnapshot(),
      sourceEvent: sourceEvent || null,
    });

    listeners.forEach((listener) => listener(detail));

    form.dispatchEvent(
      new CustomEvent("marketwatch:filters-change", {
        bubbles: true,
        detail,
      }),
    );
  }

  function getColumnId(input) {
    return input.dataset.marketWatchColumn || input.value || "";
  }

  function getSelectedGroupCount() {
    return getAvailableColumnInputs().filter((input) => input.checked).length;
  }

  function updateColumnLabel() {
    if (!elements.columnsLabel) {
      return;
    }

    const labels = config.labels || {};
    const total = getAvailableColumnInputs().length;
    const selected = getSelectedGroupCount();

    if (total === 0 || selected === total) {
      elements.columnsLabel.textContent = labels.showAll || "Show All";

      return;
    }

    if (selected === 0) {
      elements.columnsLabel.textContent = labels.noColumns || "No Columns";

      return;
    }

    elements.columnsLabel.textContent = `${selected} ${labels.selectedSuffix || "Selected"}`;
  }

  function syncColumnInputs() {
    const selectedGroups = new Set(state.visibleGroups);

    getColumnInputs().forEach((input) => {
      const groupId = getColumnId(input);

      input.checked = selectedGroups.has(groupId);
    });

    updateColumnLabel();
  }

  function syncNativeControls() {
    if (elements.industry) {
      elements.industry.value = state.industry;
    }

    if (elements.tableView) {
      elements.tableView.value = state.tableView;
    }

    if (elements.watchlist) {
      elements.watchlist.checked = state.watchlistOnly;
    }
  }

  function sync() {
    syncNativeControls();
    syncColumnInputs();
  }

  function openColumns() {
    if (!elements.columnsTrigger || !elements.columnsMenu || isOpen) {
      return;
    }

    isOpen = true;

    elements.columnsMenu.hidden = false;
    elements.columnsTrigger.setAttribute("aria-expanded", "true");
  }

  function closeColumns({ restoreFocus = false } = {}) {
    if (!elements.columnsTrigger || !elements.columnsMenu || !isOpen) {
      return;
    }

    isOpen = false;

    elements.columnsMenu.hidden = true;
    elements.columnsTrigger.setAttribute("aria-expanded", "false");

    if (restoreFocus) {
      elements.columnsTrigger.focus();
    }
  }

  function toggleColumns() {
    if (isOpen) {
      closeColumns();

      return;
    }

    openColumns();
  }

  function setVisibleGroups(groups, { emitChange = false } = {}) {
    const allowedGroups = new Set(getAvailableColumnInputs().map(getColumnId));

    state.visibleGroups = unique(groups).filter((groupId) => {
      return allowedGroups.has(groupId);
    });

    syncColumnInputs();

    if (emitChange) {
      emit("columns");
    }
  }

  function setAvailableGroups(groups) {
    const nextAvailableGroups = new Set(groups);

    availableGroups.clear();

    nextAvailableGroups.forEach((groupId) => {
      availableGroups.add(groupId);
    });

    getColumnInputs().forEach((input) => {
      const groupId = getColumnId(input);
      const option = input.closest(".filter-bar__columns-option");
      const isAvailable = availableGroups.has(groupId);

      input.disabled = !isAvailable;

      if (option) {
        option.hidden = !isAvailable;
      }
    });

    /*
     * A view can have fewer groups than Overview. Remove unavailable groups
     * from the active state, but retain the user choice only for groups that
     * exist in the current view.
     */

    state.visibleGroups = state.visibleGroups.filter((groupId) => {
      return availableGroups.has(groupId);
    });

    syncColumnInputs();
  }

  function setState(nextState = {}, { emitChange = false } = {}) {
    if ("industry" in nextState) {
      state.industry = nextState.industry || "all";
    }

    if ("tableView" in nextState) {
      state.tableView = String(nextState.tableView || "1");
    }

    if ("watchlistOnly" in nextState) {
      state.watchlistOnly = Boolean(nextState.watchlistOnly);
    }

    if (Array.isArray(nextState.visibleGroups)) {
      setVisibleGroups(nextState.visibleGroups);
    }

    sync();

    if (emitChange) {
      emit("state");
    }
  }

  function requestWatchlistDialog() {
    const openDialog = config.watchlist?.openDialog;

    if (typeof openDialog === "function") {
      openDialog("");

      return;
    }

    form.dispatchEvent(
      new CustomEvent("marketwatch:watchlist-login-request", {
        bubbles: true,
      }),
    );
  }

  function handleIndustryChange(event) {
    state.industry = event.target.value || "all";

    emit("industry", event);
  }

  function handleTableViewChange(event) {
    state.tableView = String(event.target.value || "1");

    emit("table-view", event);
  }

  function handleWatchlistChange(event) {
    const requestedValue = event.target.checked;

    if (requestedValue && !config.watchlist?.isAuthenticated) {
      event.target.checked = false;
      state.watchlistOnly = false;

      requestWatchlistDialog();
      sync();

      return;
    }

    state.watchlistOnly = requestedValue;

    emit("watchlist", event);
  }

  function handleColumnsMenuChange(event) {
    const input = event.target.closest(SELECTORS.columnInput);

    if (!input || input.disabled) {
      return;
    }

    const groupId = getColumnId(input);

    if (!groupId) {
      return;
    }

    if (input.checked) {
      state.visibleGroups = unique([...state.visibleGroups, groupId]);
    } else {
      state.visibleGroups = state.visibleGroups.filter(
        (value) => value !== groupId,
      );
    }

    updateColumnLabel();

    emit("columns", event);
  }

  function handleColumnsMenuClick(event) {
    const action = event.target.closest(SELECTORS.columnAction);

    if (!action || !elements.columnsMenu?.contains(action)) {
      return;
    }

    event.preventDefault();

    const actionType = action.dataset.marketWatchColumnsAction;
    const inputs = getAvailableColumnInputs();

    if (actionType === "select-all") {
      state.visibleGroups = inputs.map(getColumnId);
    }

    if (actionType === "clear-all") {
      state.visibleGroups = [];
    }

    syncColumnInputs();

    emit("columns", event);
  }

  function handleDocumentPointerDown(event) {
    if (!isOpen || !isElement(event.target)) {
      return;
    }

    const clickedInsideTrigger = elements.columnsTrigger?.contains(
      event.target,
    );
    const clickedInsideMenu = elements.columnsMenu?.contains(event.target);

    if (!clickedInsideTrigger && !clickedInsideMenu) {
      closeColumns();
    }
  }

  function handleDocumentKeyDown(event) {
    if (event.key !== "Escape" || !isOpen) {
      return;
    }

    event.preventDefault();
    closeColumns({ restoreFocus: true });
  }

  function handleSubmit(event) {
    event.preventDefault();
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Market Watch filter listener must be a function.");
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function init() {
    if (elements.industry) {
      elements.industry.addEventListener("change", handleIndustryChange);
    }

    if (elements.tableView) {
      elements.tableView.addEventListener("change", handleTableViewChange);
    }

    if (elements.watchlist) {
      elements.watchlist.addEventListener("change", handleWatchlistChange);
    }

    elements.columnsTrigger?.addEventListener("click", toggleColumns);
    elements.columnsMenu?.addEventListener("change", handleColumnsMenuChange);
    elements.columnsMenu?.addEventListener("click", handleColumnsMenuClick);

    form.addEventListener("submit", handleSubmit);

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    sync();
  }

  function destroy() {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;

    elements.industry?.removeEventListener("change", handleIndustryChange);
    elements.tableView?.removeEventListener("change", handleTableViewChange);
    elements.watchlist?.removeEventListener("change", handleWatchlistChange);

    elements.columnsTrigger?.removeEventListener("click", toggleColumns);
    elements.columnsMenu?.removeEventListener(
      "change",
      handleColumnsMenuChange,
    );
    elements.columnsMenu?.removeEventListener("click", handleColumnsMenuClick);

    form.removeEventListener("submit", handleSubmit);

    document.removeEventListener("pointerdown", handleDocumentPointerDown);
    document.removeEventListener("keydown", handleDocumentKeyDown);

    listeners.clear();
  }

  init();

  return Object.freeze({
    closeColumns,
    destroy,
    getState: getSnapshot,
    openColumns,
    setAvailableGroups,
    setState,
    setVisibleGroups,
    subscribe,
  });
}
