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
 * - login implementation
 *
 * Authentication is read from the watchlist control itself, rather than from
 * MarketWatchConfig. The existing site-level showAddToWatchListPopup() flow
 * remains the authority for login and watchlist dialogs.
 */

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

function toArray(value) {
  return Array.from(value || []);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
   * Each view owns its own selection. This prevents a user’s Overview choice
   * from being destroyed simply because Price Data has fewer groups.
   *
   * A view that has never been opened defaults to all of its available groups.
   */

  const selectionsByView = new Map([
    [state.tableView, [...state.visibleGroups]],
  ]);

  let availableGroups = new Set(state.visibleGroups);
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

  function getStoredSelection(view = state.tableView) {
    return selectionsByView.get(String(view)) || null;
  }

  function setStoredSelection(groups, view = state.tableView) {
    const allowed = new Set(availableGroups);
    const selection = unique(groups).filter((groupId) => {
      return allowed.has(groupId);
    });

    selectionsByView.set(String(view), selection);

    if (String(view) === state.tableView) {
      state.visibleGroups = selection;
    }
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

    elements.columnsLabel.textContent = `${selected} ${
      labels.selectedSuffix || "Selected"
    }`;
  }

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
     State and Events
     ======================================================================== */

  function getSnapshot() {
    return Object.freeze({
      industry: state.industry,
      tableView: state.tableView,
      watchlistOnly: state.watchlistOnly,
      visibleGroups: [...state.visibleGroups],
    });
  }

  function emit(type, sourceEvent = null) {
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

  function setVisibleGroups(groups, { emitChange = false } = {}) {
    setStoredSelection(groups);
    syncColumnInputs();

    if (emitChange) {
      emit("columns");
    }
  }

  /*
   * The page coordinator calls this after it resolves the selected table view.
   *
   * Existing selections are restored for a previously visited view. A newly
   * visited view receives all groups that exist in that view.
   */

  function setAvailableGroups(groups) {
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

    const storedSelection = getStoredSelection();

    if (storedSelection === null) {
      setStoredSelection(getAvailableGroupIds());
    } else {
      setStoredSelection(storedSelection);
    }

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
      setStoredSelection(nextState.visibleGroups);
    }

    sync();

    if (emitChange) {
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
      const firstInput = getAvailableColumnInputs()[0];

      firstInput?.focus();
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

    setVisibleGroups(nextSelection);
    emit("columns", event);
  }

  function handleColumnsMenuClick(event) {
    const action = event.target.closest(SELECTORS.columnAction);

    if (!action || !elements.columnsMenu?.contains(action)) {
      return;
    }

    event.preventDefault();

    const actionType = action.dataset.marketWatchColumnsAction;

    if (actionType === "select-all") {
      setVisibleGroups(getAvailableGroupIds());
      emit("columns", event);

      return;
    }

    if (actionType === "clear-all") {
      /*
       * An empty list is intentional: table rendering keeps the Company
       * column visible and applies its dedicated company-only layout.
       */
      setVisibleGroups([]);
      emit("columns", event);
    }
  }

  /* ========================================================================
     Watchlist Access
     ======================================================================== */

  /*
   * Add this server-rendered attribute to the watchlist input:
   *
   * data-market-watch-authenticated="<%= themeDisplay.isSignedIn() %>"
   *
   * It avoids duplicating login state in MarketWatchConfig.
   */

  function isWatchlistAuthenticated() {
    return parseBoolean(elements.watchlist?.dataset.marketWatchAuthenticated);
  }

  function requestLegacyWatchlistDialog() {
    if (typeof window.showAddToWatchListPopup === "function") {
      window.showAddToWatchListPopup("");

      return;
    }

    /*
     * Safe fallback for pages where the legacy helper is loaded later.
     * The site shell can listen for this event and open its login dialog.
     */

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
    const requested = event.target.checked;

    if (requested && !isWatchlistAuthenticated()) {
      state.watchlistOnly = false;
      syncNativeControls();

      requestLegacyWatchlistDialog();

      return;
    }

    state.watchlistOnly = requested;
    emit("watchlist", event);
  }

  /* ========================================================================
     Native Filter Controls
     ======================================================================== */

  function handleIndustryChange(event) {
    state.industry = event.target.value || "all";

    emit("industry", event);
  }

  function handleTableViewChange(event) {
    /*
     * Save the old view selection before the page coordinator changes the
     * available groups for the newly selected view.
     */

    selectionsByView.set(state.tableView, [...state.visibleGroups]);

    state.tableView = String(event.target.value || "1");

    emit("table-view", event);
  }

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
    closeColumns({ restoreFocus: true });
  }

  function handleSubmit(event) {
    event.preventDefault();
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Market Watch filter listener must be a function.");
    }

    listeners.add(listener);

    return () => listeners.delete(listener);
  }

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
