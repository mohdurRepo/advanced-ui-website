/* ==========================================================================
   Market Watch Filters
   ========================================================================== */

/*
 * Owns filter UI state only.
 *
 * Native selects remain the source of truth.
 * The column picker is a checkbox disclosure, not a fake multi-select.
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

  function updateColumnSummary() {
    if (!elements.columnsSummary) {
      return;
    }

    const availableCount = availableGroups.size;
    const selectedCount = [...state.visibleGroups].filter((group) =>
      availableGroups.has(group),
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
      const isAvailable = availableGroups.has(groupId);

      input.checked = state.visibleGroups.has(groupId);
      input.disabled = !isAvailable;

      if (option) {
        option.hidden = !isAvailable;
      }
    });

    updateColumnSummary();
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

  function setAvailableGroups(groups = []) {
    availableGroups = new Map(
      groups.map((group) => [group.id || group.key, group]),
    );

    /*
     * A view can expose fewer groups than another view. Remove selections that
     * are not available in the new view and select newly available groups by
     * default, preserving the intuitive “Show All” default.
     */

    state.visibleGroups = new Set(
      [...state.visibleGroups].filter((group) => availableGroups.has(group)),
    );

    availableGroups.forEach((group, id) => {
      if (!state.visibleGroups.size || group.visible !== false) {
        state.visibleGroups.add(id);
      }
    });

    syncColumnInputs();
  }

  function setVisibleGroups(groups = []) {
    state.visibleGroups = new Set(
      unique(groups).filter((group) => availableGroups.has(group)),
    );

    syncColumnInputs();
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
      setVisibleGroups(nextState.visibleGroups);
    }
  }

  async function handleWatchlistChange(event) {
    const requested = event.currentTarget.checked;

    /*
     * The page module will later provide this guard:
     *
     * - signed-in user: return true
     * - anonymous user: open login popup, return false
     */

    const allowed = await Promise.resolve(
      options.onWatchlistIntent?.(requested) ?? true,
    );

    if (!allowed) {
      event.currentTarget.checked = state.watchlistOnly;

      return;
    }

    state.watchlistOnly = requested;
    emitChange("watchlist");
  }

  function handleDocumentPointerDown(event) {
    if (!isColumnsPanelOpen || form.contains(event.target)) {
      return;
    }

    closeColumnsPanel();
  }

  function handleDocumentKeyDown(event) {
    if (event.key === "Escape" && isColumnsPanelOpen) {
      event.preventDefault();
      closeColumnsPanel({
        restoreFocus: true,
      });
    }
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
      "change.marketWatchFilters",
      "[data-market-watch-column]",
      (event) => {
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
      },
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

  setState(state);

  return Object.freeze({
    getState,
    setState,
    setAvailableGroups,
    setVisibleGroups,
    openColumnsPanel,
    closeColumnsPanel,
    destroy,
  });
}
