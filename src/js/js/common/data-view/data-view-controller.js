/* ==========================================================================
   Data View Controller
   ========================================================================== */

/*
 * Shared coordinator for reusable data-driven views.
 *
 * Responsibilities:
 *
 * - coordinate data loading
 * - keep complete source rows
 * - derive visible rows
 * - synchronize table / cards / result count
 * - react to filters
 * - react to column visibility
 * - coordinate schema/view changes
 * - support client-side filters such as Watchlist Only
 * - support request-based filters
 * - handle loading / empty / error states
 * - support destruction
 *
 * This module intentionally has no:
 *
 * - page-specific columns
 * - page-specific request parameters
 * - page-specific card markup
 * - authentication implementation
 * - breakpoint logic
 */

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createDataViewController(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("createDataViewController requires an options object.");
  }

  /* ========================================================================
     Dependencies
     ======================================================================== */

  const source = options.source || null;

  const table = options.table || null;

  const cards = options.cards || null;

  const filters = options.filters || null;

  const columnVisibility = options.columnVisibility || null;

  const results = options.results || null;

  const state = options.state || null;

  if (source && typeof source.load !== "function") {
    throw new TypeError("Data view source must expose load().");
  }

  /* ========================================================================
     Internal State
     ======================================================================== */

  let sourceRows = [];

  let destroyed = false;

  let requestId = 0;

  let unsubscribeFilters = null;

  let unsubscribeColumns = null;

  /* ========================================================================
     Shared State
     ======================================================================== */

  function getFilterState() {
    return filters?.getState?.() || {};
  }

  function getColumnState() {
    return columnVisibility?.getState?.() || {};
  }

  function getCurrentView() {
    if (typeof options.getView === "function") {
      return String(
        options.getView({
          filters: getFilterState(),

          state: state?.getState?.() || {},
        }) ?? "default",
      );
    }

    return String(
      getFilterState().tableView ?? state?.get?.("view") ?? "default",
    );
  }

  /* ========================================================================
     State Synchronization
     ======================================================================== */

  function syncSharedState(partial, type) {
    if (!state?.setState) {
      return;
    }

    state.setState(partial, {
      type,
    });
  }

  /* ========================================================================
     Presentation
     ======================================================================== */

  function showLoading() {
    table?.showLoading?.();
    cards?.showLoading?.();
    results?.showLoading?.();

    syncSharedState(
      {
        loading: true,
        error: null,
      },
      "loading",
    );
  }

  function showRows(rows) {
    const normalizedRows = normalizeRows(rows);

    table?.setRows?.(normalizedRows);

    cards?.setRows?.(normalizedRows);

    results?.showReady?.(normalizedRows.length);

    syncSharedState(
      {
        loading: false,
        error: null,
        visibleRows: normalizedRows,
      },
      "ready",
    );

    options.onRowsRendered?.(normalizedRows, getContext());
  }

  function showEmpty(message) {
    table?.showEmpty?.(message);

    cards?.showEmpty?.(message);

    results?.showEmpty?.(message);

    syncSharedState(
      {
        loading: false,
        error: null,
        visibleRows: [],
      },
      "empty",
    );

    options.onEmpty?.(message, getContext());
  }

  function showError(message, error) {
    table?.showError?.(message);

    cards?.showError?.(message);

    results?.showError?.(message);

    syncSharedState(
      {
        loading: false,
        error: message || true,

        visibleRows: [],
      },
      "error",
    );

    options.onError?.(error, getContext());
  }

  /* ========================================================================
     Context
     ======================================================================== */

  function getContext() {
    return {
      sourceRows: [...sourceRows],

      filters: getFilterState(),

      columns: getColumnState(),

      view: getCurrentView(),

      state: state?.getState?.() || {},
    };
  }

  /* ========================================================================
     Client-side Row Processing
     ======================================================================== */

  function getVisibleRows() {
    let rows = [...sourceRows];

    /*
     * Page modules can provide one or more client-side processors.
     *
     * Example:
     *
     * - Watchlist Only
     * - temporary local search
     * - local status filter
     * - custom row transformations
     */

    if (Array.isArray(options.rowProcessors)) {
      options.rowProcessors.forEach((processor) => {
        if (typeof processor !== "function") {
          return;
        }

        const processed = processor(rows, getContext());

        rows = normalizeRows(processed);
      });
    }

    if (typeof options.filterRows === "function") {
      rows = normalizeRows(options.filterRows(rows, getContext()));
    }

    return rows;
  }

  function renderCurrentRows() {
    if (destroyed) {
      return;
    }

    const rows = getVisibleRows();

    if (!rows.length) {
      const message =
        typeof options.getEmptyMessage === "function"
          ? options.getEmptyMessage(getContext())
          : options.emptyMessage || "No data available";

      showEmpty(message);

      return;
    }

    showRows(rows);
  }

  /* ========================================================================
     Schema / View Synchronization
     ======================================================================== */

  function syncView() {
    const view = getCurrentView();

    /*
     * Update column-visibility state first because each view may expose
     * a different set of groups.
     */

    if (columnVisibility && typeof options.getAvailableGroups === "function") {
      columnVisibility.setView?.(view, {
        notify: false,
      });

      const availableGroups =
        options.getAvailableGroups(view, getContext()) || [];

      columnVisibility.setAvailableGroups?.(availableGroups, {
        notify: false,
      });
    }

    const visibleGroups = columnVisibility?.getVisibleGroups?.() || [];

    /*
     * Pass view + groups together to avoid duplicate table recreation.
     */

    table?.setView?.(view, visibleGroups);

    cards?.setView?.(view);

    options.onViewSync?.(view, visibleGroups, getContext());
  }

  /* ========================================================================
     Column Visibility Synchronization
     ======================================================================== */

  function syncColumns() {
    if (!columnVisibility) {
      return;
    }

    const visibleGroups = columnVisibility.getVisibleGroups?.() || [];

    table?.setVisibleGroups?.(visibleGroups);

    /*
     * Cards do not necessarily expose column-group state directly.
     * Page modules can refresh or pass groups through context.
     */

    cards?.refresh?.();

    options.onColumnVisibilityChange?.(visibleGroups, getContext());
  }

  /* ========================================================================
     Request
     ======================================================================== */

  async function load() {
    if (destroyed || !source) {
      return null;
    }

    const currentRequestId = ++requestId;

    showLoading();

    const filterState = getFilterState();

    try {
      const response = await source.load(filterState);

      if (destroyed || currentRequestId !== requestId) {
        return null;
      }

      sourceRows = normalizeRows(response.rows);

      syncSharedState(
        {
          sourceRows: sourceRows,

          meta: response.meta || {},
        },
        "data-loaded",
      );

      options.onDataLoaded?.(response, getContext());

      renderCurrentRows();

      return response;
    } catch (error) {
      if (destroyed || currentRequestId !== requestId || isAbortError(error)) {
        return null;
      }

      sourceRows = [];

      const message =
        typeof options.getErrorMessage === "function"
          ? options.getErrorMessage(error, getContext())
          : error?.response?.message ||
            error?.message ||
            options.errorMessage ||
            "Unable to load data.";

      showError(message, error);

      return null;
    }
  }

  /* ========================================================================
     Filter Effects
     ======================================================================== */

  function handleReloadEffect(event) {
    load();

    options.onFilterEffect?.("reload", event, getContext());
  }

  function handleClientFilterEffect(event) {
    renderCurrentRows();

    options.onFilterEffect?.("client-filter", event, getContext());
  }

  function handleViewEffect(event) {
    syncView();

    if (options.reloadOnViewChange !== false) {
      load();
    } else {
      renderCurrentRows();
    }

    options.onFilterEffect?.("view", event, getContext());
  }

  function handlePresentationEffect(event) {
    options.onFilterEffect?.("presentation", event, getContext());
  }

  function handleFilterChange(event) {
    if (destroyed) {
      return;
    }

    const effect = event?.effect || options.defaultFilterEffect || "reload";

    switch (effect) {
      case "client-filter":
        handleClientFilterEffect(event);

        break;

      case "view":
        handleViewEffect(event);

        break;

      case "presentation":
        handlePresentationEffect(event);

        break;

      case "none":
        break;

      case "reload":
      default:
        handleReloadEffect(event);
    }
  }

  /* ========================================================================
     Column Visibility Events
     ======================================================================== */

  function handleColumnChange(event) {
    if (destroyed) {
      return;
    }

    syncColumns();

    options.onColumnsChange?.(event, getContext());
  }

  /* ========================================================================
     Source Rows
     ======================================================================== */

  function setSourceRows(nextRows = [], settings = {}) {
    if (destroyed) {
      return;
    }

    sourceRows = normalizeRows(nextRows);

    syncSharedState(
      {
        sourceRows,
      },
      "source-rows",
    );

    if (settings.render !== false) {
      renderCurrentRows();
    }
  }

  function getSourceRows() {
    return [...sourceRows];
  }

  /* ========================================================================
     Refresh
     ======================================================================== */

  function refresh() {
    if (destroyed) {
      return;
    }

    syncColumns();

    cards?.refresh?.();

    table?.adjust?.();

    renderCurrentRows();
  }

  /* ========================================================================
     Reload
     ======================================================================== */

  function reload() {
    return load();
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    requestId += 1;

    unsubscribeFilters?.();
    unsubscribeFilters = null;

    unsubscribeColumns?.();
    unsubscribeColumns = null;

    source?.destroy?.();

    filters?.destroy?.();
    columnVisibility?.destroy?.();

    table?.destroy?.();
    cards?.destroy?.();
    results?.destroy?.();

    state?.destroy?.();

    sourceRows = [];

    options.onDestroy?.();
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  function init() {
    if (destroyed) {
      return null;
    }

    if (filters?.subscribe) {
      unsubscribeFilters = filters.subscribe(handleFilterChange);
    }

    if (columnVisibility?.subscribe) {
      unsubscribeColumns = columnVisibility.subscribe(handleColumnChange);
    }

    /*
     * Configure schema before loading data.
     */

    syncView();

    options.onInit?.(getContext());

    if (options.autoLoad !== false) {
      load();
    }

    return instance;
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    destroy,

    getContext,

    getSourceRows,

    getVisibleRows,

    init,

    refresh,
    reload,

    render: renderCurrentRows,

    setSourceRows,

    syncColumns,
    syncView,
  });

  if (options.autoInit === true) {
    init();
  }

  return instance;
}
