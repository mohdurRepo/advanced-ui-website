/* ==========================================================================
   Data Column Visibility
   ========================================================================== */

/*
 * Shared column-group visibility state for reusable data-view modules.
 *
 * Responsibilities:
 *
 * - track available column groups
 * - track selected / visible column groups
 * - remember selections per view
 * - normalize invalid selections
 * - provide select-all / clear-all helpers
 * - avoid duplicate change notifications
 *
 * This module intentionally has no:
 *
 * - DOM code
 * - DataTables code
 * - filter UI code
 * - page-specific group names
 */

/* ==========================================================================
   Helpers
   ========================================================================== */

function unique(values = []) {
  return [
    ...new Set(
      values.filter((value) => typeof value === "string" && value.trim()),
    ),
  ];
}

function arraysEqual(first = [], second = []) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function normalizeView(value) {
  return String(value ?? "default");
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createDataColumnVisibility(options = {}) {
  let currentView = normalizeView(options.initialView);

  let availableGroups = unique(options.availableGroups || []);

  let visibleGroups = unique(options.visibleGroups || availableGroups).filter(
    (groupId) => availableGroups.includes(groupId),
  );

  let destroyed = false;

  const listeners = new Set();

  const selectionsByView = new Map();

  selectionsByView.set(currentView, [...visibleGroups]);

  /* ========================================================================
     Snapshot
     ======================================================================== */

  function getState() {
    return Object.freeze({
      view: currentView,

      availableGroups: [...availableGroups],

      visibleGroups: [...visibleGroups],

      selectedCount: visibleGroups.length,

      availableCount: availableGroups.length,

      allSelected:
        availableGroups.length > 0 &&
        visibleGroups.length === availableGroups.length,

      noneSelected: visibleGroups.length === 0,
    });
  }

  /* ========================================================================
     Notification
     ======================================================================== */

  function notify(type, source = null) {
    if (destroyed) {
      return;
    }

    const event = Object.freeze({
      type,
      source,
      state: getState(),
    });

    listeners.forEach((listener) => {
      listener(event);
    });
  }

  /* ========================================================================
     Normalization
     ======================================================================== */

  function normalizeSelection(groups = []) {
    const available = new Set(availableGroups);

    return unique(groups).filter((groupId) => available.has(groupId));
  }

  function storeCurrentSelection() {
    selectionsByView.set(currentView, [...visibleGroups]);
  }

  /* ========================================================================
     Visible Groups
     ======================================================================== */

  function setVisibleGroups(groups = [], options = {}) {
    if (destroyed) {
      return false;
    }

    const nextVisibleGroups = normalizeSelection(groups);

    if (arraysEqual(nextVisibleGroups, visibleGroups)) {
      return false;
    }

    visibleGroups = nextVisibleGroups;

    storeCurrentSelection();

    if (options.notify !== false) {
      notify(
        options.type || "visibility-change",

        options.source || null,
      );
    }

    return true;
  }

  function showGroup(groupId, options = {}) {
    if (destroyed || !availableGroups.includes(groupId)) {
      return false;
    }

    return setVisibleGroups([...visibleGroups, groupId], options);
  }

  function hideGroup(groupId, options = {}) {
    if (destroyed) {
      return false;
    }

    return setVisibleGroups(
      visibleGroups.filter((value) => value !== groupId),
      options,
    );
  }

  function toggleGroup(groupId, options = {}) {
    if (visibleGroups.includes(groupId)) {
      return hideGroup(groupId, options);
    }

    return showGroup(groupId, options);
  }

  function selectAll(options = {}) {
    return setVisibleGroups(availableGroups, {
      ...options,

      type: options.type || "select-all",
    });
  }

  function clearAll(options = {}) {
    return setVisibleGroups([], {
      ...options,

      type: options.type || "clear-all",
    });
  }

  /* ========================================================================
     Available Groups
     ======================================================================== */

  function setAvailableGroups(groups = [], options = {}) {
    if (destroyed) {
      return false;
    }

    const nextAvailableGroups = unique(groups);

    const availableChanged = !arraysEqual(nextAvailableGroups, availableGroups);

    availableGroups = nextAvailableGroups;

    /*
     * Restore this view's previous selection if available.
     *
     * For a first-time view, default to all groups.
     */

    const storedSelection = selectionsByView.get(currentView);

    const nextVisibleGroups = storedSelection
      ? normalizeSelection(storedSelection)
      : [...availableGroups];

    const visibilityChanged = !arraysEqual(nextVisibleGroups, visibleGroups);

    visibleGroups = nextVisibleGroups;

    storeCurrentSelection();

    if ((availableChanged || visibilityChanged) && options.notify !== false) {
      notify(
        options.type || "available-groups-change",

        options.source || null,
      );
    }

    return availableChanged || visibilityChanged;
  }

  /* ========================================================================
     View
     ======================================================================== */

  function setView(nextView, options = {}) {
    if (destroyed) {
      return false;
    }

    const normalizedView = normalizeView(nextView);

    if (normalizedView === currentView) {
      return false;
    }

    /*
     * Preserve the selection for the view being left.
     */

    storeCurrentSelection();

    currentView = normalizedView;

    /*
     * Do not guess the available groups of the new view.
     *
     * The page/schema layer should call setAvailableGroups()
     * immediately after setView().
     */

    availableGroups = [];

    visibleGroups = [];

    if (options.notify !== false) {
      notify(
        options.type || "view-change",

        options.source || null,
      );
    }

    return true;
  }

  /* ========================================================================
     Queries
     ======================================================================== */

  function isVisible(groupId) {
    return visibleGroups.includes(groupId);
  }

  function isAvailable(groupId) {
    return availableGroups.includes(groupId);
  }

  function getVisibleGroups() {
    return [...visibleGroups];
  }

  function getAvailableGroups() {
    return [...availableGroups];
  }

  function getStoredGroups(view = currentView) {
    const stored = selectionsByView.get(normalizeView(view));

    return stored ? [...stored] : null;
  }

  /* ========================================================================
     Subscription
     ======================================================================== */

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Column visibility listener must be a function.");
    }

    if (destroyed) {
      return () => {};
    }

    listeners.add(listener);

    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  /* ========================================================================
     Reset
     ======================================================================== */

  function resetView(view = currentView, options = {}) {
    const normalizedView = normalizeView(view);

    selectionsByView.delete(normalizedView);

    if (normalizedView !== currentView) {
      return false;
    }

    return setVisibleGroups(availableGroups, {
      ...options,

      type: options.type || "reset-view",
    });
  }

  function resetAll(options = {}) {
    selectionsByView.clear();

    selectionsByView.set(currentView, [...availableGroups]);

    const changed = setVisibleGroups(availableGroups, {
      ...options,
      notify: false,
    });

    if (options.notify !== false) {
      notify(
        options.type || "reset-all",

        options.source || null,
      );
    }

    return changed;
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    listeners.clear();
    selectionsByView.clear();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    clearAll,
    destroy,

    getAvailableGroups,
    getState,
    getStoredGroups,
    getVisibleGroups,

    hideGroup,
    isAvailable,
    isVisible,

    resetAll,
    resetView,

    selectAll,

    setAvailableGroups,
    setView,
    setVisibleGroups,

    showGroup,
    subscribe,
    toggleGroup,
  });
}
