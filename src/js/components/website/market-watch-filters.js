/* ==========================================================================
   Market Watch Filters
   ========================================================================== */

/*
 * Owns the filter controls and their state.
 *
 * Native <select> elements remain the source of truth.
 * The shared custom-select component may enhance them later, including
 * searchable Industry Group selection, without changing this module.
 */

function getForm(root) {
  const form = root?.matches?.("[data-market-watch-filters]")
    ? root
    : root?.querySelector?.("[data-market-watch-filters]");

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Market Watch filters form was not found.");
  }

  return form;
}

function getJQuery() {
  const $ = window.jQuery;

  if (!$) {
    throw new Error("Market Watch filters require jQuery.");
  }

  return $;
}

function unique(values) {
  return [...new Set(values)];
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketWatchFilters(root = document, options = {}) {
  const form = getForm(root);
  const $ = getJQuery();
  const $form = $(form);

  const labels = {
    showAll: "Show All",
    noColumns: "No columns selected",
    selectedSuffix: "selected",
    ...options.labels,
  };

  const elements = {
    industry: form.querySelector('[data-market-watch-filter="industry"]'),

    tableView: form.querySelector('[data-market-watch-filter="table-view"]'),

    watchlistOnly: form.querySelector(
      '[data-market-watch-filter="watchlist-only"]',
    ),

    columnsTrigger: form.querySelector("[data-market-watch-columns-trigger]"),

    columnsPanel: form.querySelector("[data-market-watch-columns-panel]"),

    columnsSummary: form.querySelector("[data-market-watch-columns-summary]"),
  };

  const state = {
    industry:
      options.initialState?.industry || elements.industry?.value || "all",

    tableView: String(
      options.initialState?.tableView || elements.tableView?.value || "1",
    ),

    watchlistOnly: Boolean(options.initialState?.watchlistOnly),

    visibleGroups: new Set(options.initialState?.visibleGroups || []),
  };

  let availableGroups = new Map();
  let isColumnsPanelOpen = false;

  function getState() {
    return {
      industry: state.industry,
      tableView: state.tableView,
      watchlistOnly: state.watchlistOnly,
      visibleGroups: [...state.visibleGroups],
    };
  }

  function emitChange(type) {
    options.onChange?.(getState(), {
      type,
    });
  }

  function getColumnInputs() {
    return [...form.querySelectorAll("[data-market-watch-column]")];
  }

  function getAvailableGroupIds() {
    return [...availableGroups.keys()];
  }

  function updateColumnsSummary() {
    if (!elements.columnsSummary) {
      return;
    }

    const availableCount = availableGroups.size;
    const selectedCount = getAvailableGroupIds().filter((id) =>
      state.visibleGroups.has(id),
    ).length;

    if (availableCount === 0 || selectedCount === availableCount) {
      elements.columnsSummary.textContent = labels.showAll;

      return;
    }

    if (selectedCount === 0) {
      elements.columnsSummary.textContent = labels.noColumns;

      return;
    }

    elements.columnsSummary.textContent = `${selectedCount} ${labels.selectedSuffix}`;
  }

  function syncColumnInputs() {
    getColumnInputs().forEach((input) => {
      const groupId = input.dataset.marketWatchColumn;
      const option = input.closest(".filter-bar__column-option");
      const available = availableGroups.has(groupId);

      input.checked = available && state.visibleGroups.has(groupId);
      input.disabled = !available;

      if (option) {
        option.hidden = !available;
      }
    });

    updateColumnsSummary();
  }

  function openColumnsPanel() {
    if (!elements.columnsPanel || !elements.columnsTrigger) {
      return;
    }

    isColumnsPanelOpen = true;

    elements.columnsPanel.hidden = false;
    elements.columnsTrigger.setAttribute("aria-expanded", "true");
  }

  function closeColumnsPanel({ restoreFocus = false } = {}) {
    if (!elements.columnsPanel || !elements.columnsTrigger) {
      return;
    }

    isColumnsPanelOpen = false;

    elements.columnsPanel.hidden = true;
    elements.columnsTrigger.setAttribute("aria-expanded", "false");

    if (restoreFocus) {
      elements.columnsTrigger.focus();
    }
  }

  function toggleColumnsPanel() {
    if (isColumnsPanelOpen) {
      closeColumnsPanel();

      return;
    }

    openColumnsPanel();
  }

  /*
   * Called after a Table View changes.
   * It only updates which groups are available; the page coordinator chooses
   * the visible groups for that view immediately afterward.
   */

  function setAvailableGroups(groups = []) {
    availableGroups = new Map(
      groups.map((group) => [group.id || group.key, group]),
    );

    state.visibleGroups = new Set(
      [...state.visibleGroups].filter((groupId) =>
        availableGroups.has(groupId),
      ),
    );

    syncColumnInputs();
  }

  function setVisibleGroups(groups = []) {
    state.visibleGroups = new Set(
      unique(groups).filter((groupId) => availableGroups.has(groupId)),
    );

    syncColumnInputs();
  }

  function selectAllGroups() {
    state.visibleGroups = new Set(getAvailableGroupIds());

    syncColumnInputs();
    emitChange("columns");
  }

  function clearAllGroups() {
    state.visibleGroups.clear();

    syncColumnInputs();
    emitChange("columns");
  }

  function setState(nextState = {}) {
    if (nextState.industry !== undefined) {
      state.industry = nextState.industry || "all";

      if (elements.industry) {
        elements.industry.value = state.industry;
      }
    }

    if (nextState.tableView !== undefined) {
      state.tableView = String(nextState.tableView);

      if (elements.tableView) {
        elements.tableView.value = state.tableView;
      }
    }

    if (nextState.watchlistOnly !== undefined) {
      state.watchlistOnly = Boolean(nextState.watchlistOnly);

      if (elements.watchlistOnly) {
        elements.watchlistOnly.checked = state.watchlistOnly;
      }
    }

    if (nextState.visibleGroups !== undefined) {
      state.visibleGroups = new Set(nextState.visibleGroups);
    }

    syncColumnInputs();
  }

  async function handleWatchlistChange(event) {
    const input = event.currentTarget;
    const requested = input.checked;

    try {
      const allowed = await Promise.resolve(
        options.onWatchlistIntent?.(requested) ?? true,
      );

      if (!allowed) {
        input.checked = state.watchlistOnly;

        return;
      }

      state.watchlistOnly = requested;
      emitChange("watchlist");
    } catch (error) {
      input.checked = state.watchlistOnly;

      console.error("[Market Watch] Watchlist intent failed.", error);
    }
  }

  function handleColumnsPanelAction(event) {
    const action = event.currentTarget.dataset.marketWatchColumnsAction;

    if (action === "select-all") {
      selectAllGroups();

      return;
    }

    if (action === "clear-all") {
      clearAllGroups();
    }
  }

  function handleColumnChange(event) {
    const groupId = event.currentTarget.dataset.marketWatchColumn;

    if (!availableGroups.has(groupId)) {
      return;
    }

    if (event.currentTarget.checked) {
      state.visibleGroups.add(groupId);
    } else {
      state.visibleGroups.delete(groupId);
    }

    syncColumnInputs();
    emitChange("columns");
  }

  function handleDocumentPointerDown(event) {
    if (!isColumnsPanelOpen) {
      return;
    }

    const clickedPanel = elements.columnsPanel?.contains(event.target);
    const clickedTrigger = elements.columnsTrigger?.contains(event.target);

    if (!clickedPanel && !clickedTrigger) {
      closeColumnsPanel();
    }
  }

  function handleDocumentKeyDown(event) {
    if (event.key !== "Escape" || !isColumnsPanelOpen) {
      return;
    }

    event.preventDefault();

    closeColumnsPanel({
      restoreFocus: true,
    });
  }

  function bindEvents() {
    $form.on("submit.marketWatchFilters", (event) => {
      event.preventDefault();
    });

    $form.on(
      "change.marketWatchFilters",
      '[data-market-watch-filter="industry"]',
      (event) => {
        state.industry = event.currentTarget.value || "all";
        emitChange("industry");
      },
    );

    $form.on(
      "change.marketWatchFilters",
      '[data-market-watch-filter="table-view"]',
      (event) => {
        state.tableView = String(event.currentTarget.value || "1");
        emitChange("table-view");
      },
    );

    $form.on(
      "change.marketWatchFilters",
      '[data-market-watch-filter="watchlist-only"]',
      handleWatchlistChange,
    );

    $form.on(
      "click.marketWatchFilters",
      "[data-market-watch-columns-trigger]",
      toggleColumnsPanel,
    );

    $form.on(
      "click.marketWatchFilters",
      "[data-market-watch-columns-action]",
      handleColumnsPanelAction,
    );

    $form.on(
      "change.marketWatchFilters",
      "[data-market-watch-column]",
      handleColumnChange,
    );

    $(document).on("pointerdown.marketWatchFilters", handleDocumentPointerDown);

    $(document).on("keydown.marketWatchFilters", handleDocumentKeyDown);
  }

  function destroy() {
    closeColumnsPanel();

    $form.off(".marketWatchFilters");
    $(document).off(".marketWatchFilters");
  }

  bindEvents();

  return Object.freeze({
    getState,
    setState,

    setAvailableGroups,
    setVisibleGroups,

    selectAllGroups,
    clearAllGroups,

    openColumnsPanel,
    closeColumnsPanel,

    destroy,
  });
}
