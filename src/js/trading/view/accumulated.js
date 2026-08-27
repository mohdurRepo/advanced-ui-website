/* ==========================================================================
   Trading — Accumulated Losses
   ========================================================================== */

/*
 * Accumulated Losses view controller.
 *
 * Final presentation contract:
 *
 * Desktop:
 *
 *   Company
 *   [logo] Company Name
 *          SYMBOL + accumulated-loss status
 *
 * Mobile:
 *
 *   [logo] Company Name
 *          SYMBOL + accumulated-loss status
 *
 * Responsibilities:
 *
 * - own Accumulated Losses local state
 * - normalize the report filter
 * - request Accumulated Losses data
 * - render desktop rows
 * - render mobile cards
 * - update result count
 * - manage loading / empty / error states
 * - bind filter / reset behavior
 * - expose refresh / adjust / destroy lifecycle
 *
 * This module intentionally does not own:
 *
 * - company-name resolution
 * - company-symbol resolution
 * - company-logo URL construction
 * - company-logo fallback
 * - accumulated-loss band mapping
 * - accumulated-loss status presentation
 * - shared HTML escaping
 * - global Trading tabs
 * - shared table behavior
 *
 * Those responsibilities belong to the common Trading formatter,
 * dependency and table layers.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  SELECTORS,
  TRADING_VALUES,
  TRADING_VIEWS,
  getCardsSelector,
  getResultCountSelector,
  getTableSelector,
  getViewSelector,
} from "../constants.js";

import {
  renderAccumulatedDesktopRow,
  renderAccumulatedMobileCard,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.accumulatedLosses;

const DEFAULT_REPORT = TRADING_VALUES?.all || "All";

const VALID_REPORTS = new Set(["All", "50-MORE", "35-50", "20-35"]);

/* ==========================================================================
   Accumulated View
   ========================================================================== */

export function createAccumulatedView({
  root,
  config = {},
  dependencies = {},
}) {
  /* ========================================================================
     Guard
     ======================================================================== */

  if (!root) {
    return createNoopView();
  }

  /* ========================================================================
     Dependencies
     ======================================================================== */

  const request = dependencies.request;

  const refreshCustomSelect = dependencies.refreshCustomSelect || (() => {});

  /* ========================================================================
     DOM
     ======================================================================== */

  const viewRoot = root.querySelector(getViewSelector(VIEW));

  const accumulatedRoot = root.querySelector(SELECTORS.accumulated.root);

  const filters = root.querySelector(SELECTORS.accumulated.filters);

  const reportSelect = root.querySelector(SELECTORS.accumulated.report);

  const table = root.querySelector(getTableSelector(VIEW));

  const tbody = table?.tBodies?.[0] || table?.querySelector("tbody") || null;

  const cards = root.querySelector(getCardsSelector(VIEW));

  const resultCount = root.querySelector(getResultCountSelector(VIEW));

  /* ========================================================================
     Endpoint
     ======================================================================== */

  const endpoint = config.endpoints?.accumulatedLosses || "";

  /* ========================================================================
     State
     ======================================================================== */

  const state = {
    report: normalizeReport(config.initialState?.accumulated?.report),

    rows: [],

    loading: false,

    initialized: false,

    destroyed: false,

    requestId: 0,
  };

  /* ========================================================================
     Initial Control Synchronization
     ======================================================================== */

  syncControlsFromState();

  /* ========================================================================
     Load
     ======================================================================== */

  async function load({ preserveRows = true } = {}) {
    if (state.destroyed) {
      return;
    }

    if (typeof request !== "function") {
      renderError(
        new Error("Accumulated Losses request dependency is unavailable."),
      );

      return;
    }

    if (!endpoint) {
      renderError(new Error("Accumulated Losses endpoint is unavailable."));

      return;
    }

    /*
     * Every request receives its own identifier.
     *
     * This prevents an older/slower response from replacing a newer filter
     * result if the user changes the report quickly.
     */

    const requestId = ++state.requestId;

    clearError();

    setLoading(true);

    if (!preserveRows) {
      state.rows = [];

      render();
    }

    try {
      const response = await request({
        url: endpoint,

        method: "GET",

        data: {
          /*
           * Keep the legacy backend contract unchanged.
           *
           * Expected values:
           *
           * All
           * 50-MORE
           * 35-50
           * 20-35
           */

          percentage: state.report,

          requestLocale: config.locale || "en",
        },
      });

      /*
       * Ignore stale responses.
       */

      if (state.destroyed || requestId !== state.requestId) {
        return;
      }

      state.rows = normalizeRows(response);

      state.initialized = true;

      render();
    } catch (error) {
      if (state.destroyed || requestId !== state.requestId) {
        return;
      }

      renderError(error);
    } finally {
      if (!state.destroyed && requestId === state.requestId) {
        setLoading(false);
      }
    }
  }

  /* ========================================================================
     Render
     ======================================================================== */

  function render() {
    if (state.destroyed) {
      return;
    }

    renderResultCount();

    renderDesktop();

    renderMobile();

    setEmptyState(state.rows.length === 0);
  }

  /* ========================================================================
     Desktop Rendering
     ======================================================================== */

  function renderDesktop() {
    if (!tbody) {
      return;
    }

    if (!state.rows.length) {
      tbody.innerHTML = "";

      return;
    }

    /*
     * IMPORTANT:
     *
     * JSP now contains ONE <th>:
     *
     *   Company
     *
     * Therefore every formatter row must contain ONE <td>.
     *
     * formatters.js owns:
     *
     *   [logo] Company Name
     *          SYMBOL + status
     */

    tbody.innerHTML = state.rows
      .map((row) => renderAccumulatedDesktopRow(row, config))
      .join("");
  }

  /* ========================================================================
     Mobile Rendering
     ======================================================================== */

  function renderMobile() {
    if (!cards) {
      return;
    }

    if (!state.rows.length) {
      cards.innerHTML = "";

      return;
    }

    /*
     * Accumulated Losses contains no secondary business fields requiring
     * an expandable details area.
     *
     * Mobile therefore remains a compact identity card.
     */

    cards.innerHTML = state.rows
      .map((row, index) =>
        renderAccumulatedMobileCard(
          row,
          {
            index,
          },
          config,
        ),
      )
      .join("");
  }

  /* ========================================================================
     Result Count
     ======================================================================== */

  function renderResultCount() {
    if (!resultCount) {
      return;
    }

    /*
     * JSP owns:
     *
     *   Result:
     *
     * This module owns only:
     *
     *   152
     *
     * Never write the label here. This prevents:
     *
     *   Result: Result: 152
     */

    resultCount.textContent = String(state.rows.length);
  }

  /* ========================================================================
     Loading State
     ======================================================================== */

  function setLoading(loading) {
    state.loading = Boolean(loading);

    const busy = state.loading ? "true" : "false";

    viewRoot?.setAttribute("aria-busy", busy);

    table?.setAttribute("aria-busy", busy);

    cards?.setAttribute("aria-busy", busy);

    accumulatedRoot?.classList.toggle("is-loading", state.loading);
  }

  /* ========================================================================
     Empty State
     ======================================================================== */

  function setEmptyState(empty) {
    const isEmpty = Boolean(empty);

    viewRoot?.classList.toggle("is-empty", isEmpty);

    accumulatedRoot?.classList.toggle("is-empty", isEmpty);
  }

  /* ========================================================================
     Error State
     ======================================================================== */

  function renderError(error) {
    state.rows = [];

    renderResultCount();

    if (tbody) {
      tbody.innerHTML = "";
    }

    if (cards) {
      cards.innerHTML = "";
    }

    viewRoot?.classList.add("is-error");

    accumulatedRoot?.classList.add("is-error");

    setEmptyState(true);

    /*
     * Keep console output opt-in.
     *
     * User-facing empty/error presentation should continue to be handled
     * by the shared Trading/data-view layer.
     */

    if (error && config.debug === true) {
      console.error("[Trading] Accumulated Losses request failed.", error);
    }
  }

  /* ========================================================================
     Clear Error State
     ======================================================================== */

  function clearError() {
    viewRoot?.classList.remove("is-error");

    accumulatedRoot?.classList.remove("is-error");
  }

  /* ========================================================================
     Report Change
     ======================================================================== */

  function handleReportChange() {
    const nextReport = normalizeReport(reportSelect?.value);

    /*
     * Avoid an unnecessary request when the effective value has not changed.
     */

    if (nextReport === state.report) {
      return;
    }

    state.report = nextReport;

    clearError();

    load({
      preserveRows: true,
    });
  }

  /* ========================================================================
     Reset
     ======================================================================== */

  function handleReset(event) {
    /*
     * Own reset explicitly instead of depending on native form reset timing.
     *
     * This is especially important because the native <select> is wrapped by
     * the shared custom-select presentation.
     */

    event?.preventDefault();

    state.report = DEFAULT_REPORT;

    syncControlsFromState();

    clearError();

    load({
      preserveRows: true,
    });
  }

  /* ========================================================================
     Synchronize Controls
     ======================================================================== */

  function syncControlsFromState() {
    if (!reportSelect) {
      return;
    }

    reportSelect.value = state.report;

    /*
     * Defensive fallback:
     *
     * If JSP options and JS state ever become inconsistent, restore All
     * rather than leaving the select without a valid selected option.
     */

    if (reportSelect.value !== state.report) {
      state.report = DEFAULT_REPORT;

      reportSelect.value = DEFAULT_REPORT;
    }

    refreshSelect();
  }

  /* ========================================================================
     Refresh Custom Select
     ======================================================================== */

  function refreshSelect() {
    if (!reportSelect) {
      return;
    }

    /*
     * The shared dependency owns custom-select presentation.
     *
     * This module only tells it that the underlying native value changed.
     */

    refreshCustomSelect(reportSelect);
  }

  /* ========================================================================
     Bind Events
     ======================================================================== */

  function bindEvents() {
    reportSelect?.addEventListener("change", handleReportChange);

    filters?.addEventListener("reset", handleReset);
  }

  /* ========================================================================
     Unbind Events
     ======================================================================== */

  function unbindEvents() {
    reportSelect?.removeEventListener("change", handleReportChange);

    filters?.removeEventListener("reset", handleReset);
  }

  /* ========================================================================
     Refresh
     ======================================================================== */

  async function refresh() {
    if (state.destroyed) {
      return;
    }

    clearError();

    await load({
      preserveRows: true,
    });
  }

  /* ========================================================================
     Adjust
     ======================================================================== */

  function adjust() {
    if (state.destroyed) {
      return;
    }

    /*
     * There is deliberately no local table positioning logic here.
     *
     * Accumulated Losses:
     *
     * - has one column
     * - is not a long table
     * - does not require a fixed column
     *
     * Shared table infrastructure remains responsible for the normal
     * fixed-header lifecycle.
     */

    refreshSelect();
  }

  /* ========================================================================
     Destroy
     ======================================================================== */

  function destroy() {
    if (state.destroyed) {
      return;
    }

    state.destroyed = true;

    /*
     * Invalidate any in-flight response.
     */

    state.requestId += 1;

    unbindEvents();

    state.rows = [];

    if (tbody) {
      tbody.innerHTML = "";
    }

    if (cards) {
      cards.innerHTML = "";
    }

    if (resultCount) {
      resultCount.textContent = "0";
    }

    viewRoot?.classList.remove("is-empty", "is-error");

    accumulatedRoot?.classList.remove("is-empty", "is-error", "is-loading");

    setLoading(false);
  }

  /* ========================================================================
     Initialize
     ======================================================================== */

  bindEvents();

  /* ========================================================================
     Public API
     ======================================================================== */

  return {
    name: VIEW,

    refresh,

    adjust,

    destroy,

    getState() {
      return {
        report: state.report,

        rows: state.rows.slice(),

        loading: state.loading,

        initialized: state.initialized,
      };
    },
  };
}

/* ==========================================================================
   Report Normalization
   ========================================================================== */

function normalizeReport(value) {
  const raw = String(value || DEFAULT_REPORT).trim();

  if (!raw) {
    return DEFAULT_REPORT;
  }

  const normalized = raw.toUpperCase();

  /*
   * Preserve the backend's exact "All" spelling.
   */

  if (normalized === "ALL") {
    return "All";
  }

  if (VALID_REPORTS.has(normalized)) {
    return normalized;
  }

  return DEFAULT_REPORT;
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

function normalizeRows(response) {
  /*
   * Direct array response.
   */

  if (Array.isArray(response)) {
    return response;
  }

  if (!response || typeof response !== "object") {
    return [];
  }

  /*
   * Common Trading response shapes.
   */

  const candidates = [
    response.data,
    response.rows,
    response.items,
    response.results,
    response.result,
    response.list,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  /*
   * Some portal endpoints wrap the actual collection one level below data.
   */

  if (response.data && typeof response.data === "object") {
    const nestedCandidates = [
      response.data.rows,
      response.data.items,
      response.data.results,
      response.data.result,
      response.data.list,
      response.data.data,
    ];

    for (const candidate of nestedCandidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  return [];
}

/* ==========================================================================
   No-op View
   ========================================================================== */

function createNoopView() {
  return {
    name: TRADING_VIEWS.accumulatedLosses,

    async refresh() {},

    adjust() {},

    destroy() {},

    getState() {
      return {
        report: DEFAULT_REPORT,

        rows: [],

        loading: false,

        initialized: false,
      };
    },
  };
}
