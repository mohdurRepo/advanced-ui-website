/* ==========================================================================
   Market Watch Filters
   ========================================================================== */

/*
 * Owns Market Watch filter state and interaction only.
 *
 * This module has no:
 *
 * - AJAX requests
 * - DataTables setup
 * - card rendering
 * - breakpoint logic
 * - login implementation
 *
 * Authentication is read from the watchlist control itself.
 * The existing site-level showAddToWatchListPopup() flow remains the
 * authority for login and watchlist dialogs.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_GROUPS = [
  "range",
  "last-trade",
  "cumulative",
  "trading",
  "best-bid",
  "best-offer",
];

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

/* ==========================================================================
   Helpers
   ========================================================================== */

function toArray(value) {
  return Array.from(value || []);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function arraysEqual(first = [], second = []) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function isElement(value) {
  return value instanceof Element;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "1";
}

function createInitialState(config = {}) {
  const initialState = config.initialState || {};

  return {
    industry: initialState.industry || "all",

    tableView: String(initialState.tableView || "1"),

    watchlistOnly: Boolean(initialState.watchlistOnly),

    visibleGroups: unique(initialState.visibleGroups || DEFAULT_GROUPS),
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

  const documentRef = form.ownerDocument;

  const abortController = new AbortController();

  const listeners = new Set();

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

  /*
   * Each table view owns its own visible-group selection.
   *
   * Example:
   *
   * Overview
   *   → range + last-trade
   *
   * Price Data
   *   → range + trading
   *
   * Returning to Overview restores its previous selection.
   */

  const selectionsByView = new Map([
    [state.tableView, [...state.visibleGroups]],
  ]);

  let availableGroups = new Set();

  let isColumnsMenuOpen = false;
  let isDestroyed = false;

  /* ========================================================================
     Column Helpers
     ======================================================================== */

  function getColumnInputs() {
    if (!elements.columnsMenu) {
      return [];
    }

    return toArray(
      elements.columnsMenu.querySelectorAll(SELECTORS.columnInput),
    );
  }

  function getColumnId(input) {
    return input?.dataset.marketWatchColumn || input?.value || "";
  }

  function getAvailableColumnInputs() {
    return getColumnInputs().filter((input) => !input.disabled);
  }

  function getAvailableGroupIds() {
    return getAvailableColumnInputs().map(getColumnId).filter(Boolean);
  }

  function normalizeSelection(groups = []) {
    const allowed = availableGroups;

    return unique(groups).filter((groupId) => allowed.has(groupId));
  }

  /* ========================================================================
     Per-view Selection
     ======================================================================== */

  function getStoredSelection(view = state.tableView) {
    const key = String(view);

    return selectionsByView.has(key) ? [...selectionsByView.get(key)] : null;
  }

  function storeSelection(groups, view = state.tableView) {
    const key = String(view);

    const selection = normalizeSelection(groups);

    selectionsByView.set(key, selection);

    if (key === state.tableView) {
      state.visibleGroups = [...selection];
    }

    return selection;
  }

  /* ========================================================================
     Column Label
     ======================================================================== */

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

    elements.columnsLabel.textContent = `${selected} ${
      labels.selectedSuffix || "Selected"
    }`;
  }

  /* ========================================================================
     UI Synchronization
     ======================================================================== */

  function syncColumnInputs() {
    const selectedGroups = new Set(state.visibleGroups);

    getColumnInputs().forEach((input) => {
      input.checked = selectedGroups.has(getColumnId(input));
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

  /* ========================================================================
     Snapshot
     ======================================================================== */

  function getSnapshot() {
    return Object.freeze({
      industry: state.industry,

      tableView: state.tableView,

      watchlistOnly: state.watchlistOnly,

      visibleGroups: [...state.visibleGroups],
    });
  }

  /* ========================================================================
     Events
     ======================================================================== */

  function emit(type, sourceEvent = null) {
    if (isDestroyed) {
      return;
    }

    const detail = Object.freeze({
      type,
      state: getSnapshot(),
      sourceEvent,
    });

    listeners.forEach((listener) => listener(detail));

    form.dispatchEvent(
      new CustomEvent("marketwatch:filters-change", {
        bubbles: true,
        detail,
      }),
    );
  }

  /* ========================================================================
     Visible Groups
     ======================================================================== */

  function setVisibleGroups(
    groups,
    { emitChange = false, sourceEvent = null } = {},
  ) {
    if (isDestroyed) {
      return false;
    }

    const nextSelection = normalizeSelection(groups);

    if (arraysEqual(nextSelection, state.visibleGroups)) {
      syncColumnInputs();

      return false;
    }

    selectionsByView.set(state.tableView, [...nextSelection]);

    state.visibleGroups = [...nextSelection];

    syncColumnInputs();

    if (emitChange) {
      emit("columns", sourceEvent);
    }

    return true;
  }

  /* ========================================================================
     Available Groups
     ======================================================================== */

  /*
   * Called by the page coordinator whenever the selected table view changes.
   *
   * Previously visited views restore their stored selection.
   *
   * A view visited for the first time receives every group available in that
   * view.
   */

  function setAvailableGroups(groups) {
    if (isDestroyed) {
      return;
    }

    availableGroups = new Set(unique(groups));

    getColumnInputs().forEach((input) => {
      const groupId = getColumnId(input);

      const option = input.closest(".filter-bar__columns-option");

      const isAvailable = availableGroups.has(groupId);

      input.disabled = !isAvailable;

      if (option) {
        option.hidden = !isAvailable;
      }
    });

    const storedSelection = getStoredSelection(state.tableView);

    if (storedSelection === null) {
      const initialSelection = getAvailableGroupIds();

      selectionsByView.set(state.tableView, [...initialSelection]);

      state.visibleGroups = [...initialSelection];
    } else {
      const normalizedSelection = normalizeSelection(storedSelection);

      selectionsByView.set(state.tableView, [...normalizedSelection]);

      state.visibleGroups = [...normalizedSelection];
    }

    syncColumnInputs();
  }

  /* ========================================================================
     State
     ======================================================================== */

  function setState(nextState = {}, { emitChange = false } = {}) {
    if (isDestroyed) {
      return;
    }

    let changed = false;

    if ("industry" in nextState) {
      const industry = nextState.industry || "all";

      if (industry !== state.industry) {
        state.industry = industry;

        changed = true;
      }
    }

    if ("tableView" in nextState) {
      const tableView = String(nextState.tableView || "1");

      if (tableView !== state.tableView) {
        /*
         * Preserve the current view's selection before switching.
         */

        selectionsByView.set(state.tableView, [...state.visibleGroups]);

        state.tableView = tableView;

        /*
         * Do not attempt to restore groups here.
         *
         * The page coordinator will call setAvailableGroups() using the schema
         * for the new view.
         */

        changed = true;
      }
    }

    if ("watchlistOnly" in nextState) {
      const watchlistOnly = Boolean(nextState.watchlistOnly);

      if (watchlistOnly !== state.watchlistOnly) {
        state.watchlistOnly = watchlistOnly;

        changed = true;
      }
    }

    if (Array.isArray(nextState.visibleGroups)) {
      const nextSelection = normalizeSelection(nextState.visibleGroups);

      if (!arraysEqual(nextSelection, state.visibleGroups)) {
        selectionsByView.set(state.tableView, [...nextSelection]);

        state.visibleGroups = [...nextSelection];

        changed = true;
      }
    }

    sync();

    if (changed && emitChange) {
      emit("state");
    }
  }

  /* ========================================================================
     Column Picker
     ======================================================================== */

  function openColumns() {
    if (
      !elements.columnsTrigger ||
      !elements.columnsMenu ||
      isColumnsMenuOpen
    ) {
      return;
    }

    isColumnsMenuOpen = true;

    elements.columnsMenu.hidden = false;

    elements.columnsTrigger.setAttribute("aria-expanded", "true");

    window.requestAnimationFrame(() => {
      if (isDestroyed || !isColumnsMenuOpen) {
        return;
      }

      getAvailableColumnInputs()[0]?.focus();
    });
  }

  function closeColumns({ restoreFocus = false } = {}) {
    if (
      !elements.columnsTrigger ||
      !elements.columnsMenu ||
      !isColumnsMenuOpen
    ) {
      return;
    }

    isColumnsMenuOpen = false;

    elements.columnsMenu.hidden = true;

    elements.columnsTrigger.setAttribute("aria-expanded", "false");

    if (restoreFocus) {
      elements.columnsTrigger.focus();
    }
  }

  function toggleColumns() {
    if (isColumnsMenuOpen) {
      closeColumns();

      return;
    }

    openColumns();
  }

  /* ========================================================================
     Column Input
     ======================================================================== */

  function handleColumnsMenuChange(event) {
    const input = event.target.closest(SELECTORS.columnInput);

    if (!input || input.disabled) {
      return;
    }

    const groupId = getColumnId(input);

    if (!groupId) {
      return;
    }

    const nextSelection = input.checked
      ? unique([...state.visibleGroups, groupId])
      : state.visibleGroups.filter((value) => value !== groupId);

    setVisibleGroups(nextSelection, {
      emitChange: true,
      sourceEvent: event,
    });
  }

  /* ========================================================================
     Column Actions
     ======================================================================== */

  function handleColumnsMenuClick(event) {
    const action = event.target.closest(SELECTORS.columnAction);

    if (!action || !elements.columnsMenu?.contains(action)) {
      return;
    }

    event.preventDefault();

    const actionType = action.dataset.marketWatchColumnsAction;

    if (actionType === "select-all") {
      setVisibleGroups(getAvailableGroupIds(), {
        emitChange: true,
        sourceEvent: event,
      });

      return;
    }

    if (actionType === "clear-all") {
      /*
       * An empty group selection is valid.
       *
       * Non-group columns such as Company remain visible.
       */

      setVisibleGroups([], {
        emitChange: true,
        sourceEvent: event,
      });
    }
  }

  /* ========================================================================
     Watchlist Access
     ======================================================================== */

  function isWatchlistAuthenticated() {
    return parseBoolean(elements.watchlist?.dataset.marketWatchAuthenticated);
  }

  function requestLegacyWatchlistDialog() {
    if (typeof window.showAddToWatchListPopup === "function") {
      window.showAddToWatchListPopup("");

      return;
    }

    form.dispatchEvent(
      new CustomEvent("marketwatch:authentication-required", {
        bubbles: true,

        detail: {
          source: "watchlist-filter",
        },
      }),
    );
  }

  function handleWatchlistChange(event) {
    const requested = Boolean(event.target.checked);

    if (requested && !isWatchlistAuthenticated()) {
      state.watchlistOnly = false;

      syncNativeControls();

      requestLegacyWatchlistDialog();

      return;
    }

    if (requested === state.watchlistOnly) {
      return;
    }

    state.watchlistOnly = requested;

    emit("watchlist", event);
  }

  /* ========================================================================
     Industry
     ======================================================================== */

  function handleIndustryChange(event) {
    const industry = event.target.value || "all";

    if (industry === state.industry) {
      return;
    }

    state.industry = industry;

    emit("industry", event);
  }

  /* ========================================================================
     Table View
     ======================================================================== */

  function handleTableViewChange(event) {
    const nextView = String(event.target.value || "1");

    if (nextView === state.tableView) {
      return;
    }

    /*
     * Preserve the selection of the view we are leaving.
     */

    selectionsByView.set(state.tableView, [...state.visibleGroups]);

    state.tableView = nextView;

    /*
     * The page coordinator receives this event, resolves the new schema, then
     * calls setAvailableGroups() to restore or initialize that view's groups.
     */

    emit("table-view", event);
  }

  /* ========================================================================
     Outside Interaction
     ======================================================================== */

  function handleDocumentPointerDown(event) {
    if (!isColumnsMenuOpen || !isElement(event.target)) {
      return;
    }

    const clickedTrigger = elements.columnsTrigger?.contains(event.target);

    const clickedMenu = elements.columnsMenu?.contains(event.target);

    if (!clickedTrigger && !clickedMenu) {
      closeColumns();
    }
  }

  function handleDocumentKeyDown(event) {
    if (event.key !== "Escape" || !isColumnsMenuOpen) {
      return;
    }

    event.preventDefault();

    closeColumns({
      restoreFocus: true,
    });
  }

  /* ========================================================================
     Form
     ======================================================================== */

  function handleSubmit(event) {
    event.preventDefault();
  }

  /* ========================================================================
     Subscription
     ======================================================================== */

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Market Watch filter listener must be a function.");
    }

    if (isDestroyed) {
      return () => {};
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function init() {
    const options = {
      signal: abortController.signal,
    };

    elements.industry?.addEventListener(
      "change",
      handleIndustryChange,
      options,
    );

    elements.tableView?.addEventListener(
      "change",
      handleTableViewChange,
      options,
    );

    elements.watchlist?.addEventListener(
      "change",
      handleWatchlistChange,
      options,
    );

    elements.columnsTrigger?.addEventListener("click", toggleColumns, options);

    elements.columnsMenu?.addEventListener(
      "change",
      handleColumnsMenuChange,
      options,
    );

    elements.columnsMenu?.addEventListener(
      "click",
      handleColumnsMenuClick,
      options,
    );

    form.addEventListener("submit", handleSubmit, options);

    documentRef.addEventListener(
      "pointerdown",
      handleDocumentPointerDown,
      options,
    );

    documentRef.addEventListener("keydown", handleDocumentKeyDown, options);

    sync();
  }

  function destroy() {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;

    abortController.abort();

    listeners.clear();

    isColumnsMenuOpen = false;
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  init();

  /* ========================================================================
     Public API
     ======================================================================== */

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
