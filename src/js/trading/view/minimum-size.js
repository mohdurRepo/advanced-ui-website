/* ==========================================================================
   Minimum Size View
   ========================================================================== */

/*
 * Minimum Size Trading view.
 *
 * Responsibilities:
 *
 * - load the Minimum Size endpoint
 * - preserve the JSP-owned matrix header
 * - render only the native table <tbody>
 * - provide client-side search
 * - render mobile cards
 * - synchronize common loading / empty / error / results state
 *
 * This file intentionally has no:
 *
 * - DataTables
 * - header generation
 * - tab behavior
 * - filter orchestration
 * - AJAX implementation details
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import {
  createDataCards,
  createDataResults,
  createDataSource,
} from "../../common/data-view/index.js";

/* ==========================================================================
   Trading
   ========================================================================== */

import {
  SELECTORS,
  TRADING_VIEWS,
  getCardsSelector,
  getResultCountSelector,
  getTableSelector,
} from "../constants.js";

import {
  escapeHtml,
  filterMinimumSizeRows,
  renderMinimumSizeDesktopRow,
  renderMinimumSizeMobileCard,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.minimumSize;

const MATRIX_COLUMN_COUNT = 5;

/* ==========================================================================
   Helpers
   ========================================================================== */

function parseResponse(response) {
  if (typeof response !== "string") {
    return response;
  }

  try {
    return JSON.parse(response);
  } catch {
    return response;
  }
}

function getResponseRows(response) {
  const value = parseResponse(response);

  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.rows)) {
    return value.rows;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  if (Array.isArray(value?.aaData)) {
    return value.aaData;
  }

  return [];
}

function normalizeResponse(response) {
  const raw = parseResponse(response);

  const rows = getResponseRows(raw);

  return {
    rows,

    meta: {
      total: rows.length,
    },

    raw,
  };
}

/* ==========================================================================
   Desktop Rendering
   ========================================================================== */

function renderLoadingRow() {
  return `
    <tr
      class="table-loading"
      aria-hidden="true"
    >
      <td colspan="${MATRIX_COLUMN_COUNT}">
        <span
          class="table-skeleton table-skeleton-lg"
        ></span>
      </td>
    </tr>
  `.trim();
}

function renderMessageRow(message, className = "table-empty") {
  return `
    <tr class="${escapeHtml(className)}">
      <td colspan="${MATRIX_COLUMN_COUNT}">
        ${escapeHtml(message)}
      </td>
    </tr>
  `.trim();
}

/* ==========================================================================
   Public View
   ========================================================================== */

export function createMinimumSizeView({ root, config } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError("Minimum Size view requires a valid root element.");
  }

  const table = root.querySelector(getTableSelector(VIEW));

  if (!(table instanceof HTMLTableElement)) {
    throw new Error("Minimum Size table was not found.");
  }

  const tbody = table.tBodies?.[0];

  if (!tbody) {
    throw new Error("Minimum Size table requires a tbody.");
  }

  const search = root.querySelector(SELECTORS.minimumSize.search);

  let destroyed = false;

  let sourceRows = [];

  let visibleRows = [];

  let searchValue = "";

  /* =========================================================================
     Source
     ========================================================================= */

  const source = createDataSource({
    endpoint: config.endpoints.minimumSize,

    /*
     * Preserve the actual backend contract.
     */
    buildRequestData() {
      return {
        requestLocale: config.locale || "en",
      };
    },

    normalizeResponse,
  });

  /* =========================================================================
     Results
     ========================================================================= */

  const results = createDataResults({
    root,

    count: getResultCountSelector(VIEW),

    labels: {
      loading: config.labels?.loading,

      empty: config.labels?.noData,

      error: config.labels?.loadError,

      results: "",
    },
  });

  /* =========================================================================
     Cards
     ========================================================================= */

  const cards = createDataCards({
    root,

    container: getCardsSelector(VIEW),

    initialView: VIEW,

    renderCard(row, context) {
      return renderMinimumSizeMobileCard(row, context, config);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load trading data.",

    afterRender(container) {
      container?.classList?.add(
        "trading-data-card-list",
        "trading-minimum-size-card-list",
      );
    },
  });

  /* =========================================================================
     Busy State
     ========================================================================= */

  function setBusy(busy) {
    const loading = Boolean(busy);

    root.setAttribute("aria-busy", String(loading));

    table.setAttribute("aria-busy", String(loading));
  }

  /*
   * JS becomes authoritative immediately.
   */
  setBusy(false);

  /* =========================================================================
     Filtering
     ========================================================================= */

  function applySearch() {
    visibleRows = filterMinimumSizeRows(sourceRows, searchValue);
  }

  /* =========================================================================
     Desktop
     ========================================================================= */

  function renderTable() {
    if (destroyed) {
      return;
    }

    if (!visibleRows.length) {
      tbody.innerHTML = renderMessageRow(
        config.labels?.noData || "No data available",
      );

      return;
    }

    tbody.innerHTML = visibleRows.map(renderMinimumSizeDesktopRow).join("");
  }

  /* =========================================================================
     Mobile
     ========================================================================= */

  function renderCards() {
    cards.setRows(visibleRows);
  }

  /* =========================================================================
     Results
     ========================================================================= */

  function renderResults() {
    results.showReady(visibleRows.length);
  }

  /* =========================================================================
     Render
     ========================================================================= */

  function render() {
    applySearch();

    if (!visibleRows.length) {
      const message = config.labels?.noData || "No data available";

      tbody.innerHTML = renderMessageRow(message);

      cards.showEmpty(message);

      results.showEmpty(message);

      return;
    }

    renderTable();

    renderCards();

    renderResults();
  }

  /* =========================================================================
     Loading
     ========================================================================= */

  function showLoading() {
    if (destroyed) {
      return;
    }

    setBusy(true);

    tbody.innerHTML = renderLoadingRow();

    cards.showLoading();

    results.showLoading();
  }

  /* =========================================================================
     Empty
     ========================================================================= */

  function showEmpty() {
    sourceRows = [];

    visibleRows = [];

    setBusy(false);

    const message = config.labels?.noData || "No data available";

    tbody.innerHTML = renderMessageRow(message);

    cards.showEmpty(message);

    results.showEmpty(message);
  }

  /* =========================================================================
     Error
     ========================================================================= */

  function showError(error) {
    sourceRows = [];

    visibleRows = [];

    setBusy(false);

    const message =
      error?.response?.message ||
      config.labels?.loadError ||
      "Unable to load trading data.";

    tbody.innerHTML = renderMessageRow(message, "table-empty table-error");

    cards.showError(message);

    results.showError(message);
  }

  /* =========================================================================
     Search
     ========================================================================= */

  function handleSearch() {
    if (destroyed) {
      return;
    }

    searchValue = search?.value || "";

    render();
  }

  search?.addEventListener("input", handleSearch);

  search?.addEventListener("search", handleSearch);

  /* =========================================================================
     Reload
     ========================================================================= */

  async function reload() {
    if (destroyed) {
      return [];
    }

    showLoading();

    try {
      const response = await source.load();

      if (destroyed) {
        return [];
      }

      sourceRows = Array.isArray(response.rows) ? response.rows : [];

      if (!sourceRows.length) {
        showEmpty();

        return [];
      }

      setBusy(false);

      render();

      return [...sourceRows];
    } catch (error) {
      if (error?.name === "AbortError") {
        throw error;
      }

      showError(error);

      throw error;
    }
  }

  /* =========================================================================
     Adjust
     ========================================================================= */

  function adjust() {
    /*
     * Native table only.
     *
     * No DataTables width recalculation is required.
     */
  }

  /* =========================================================================
     Queries
     ========================================================================= */

  function getRows() {
    return [...sourceRows];
  }

  function getVisibleRows() {
    return [...visibleRows];
  }

  function getTable() {
    return null;
  }

  /* =========================================================================
     Lifecycle
     ========================================================================= */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    search?.removeEventListener("input", handleSearch);

    search?.removeEventListener("search", handleSearch);

    source.destroy();

    cards.destroy();

    results.destroy();

    sourceRows = [];

    visibleRows = [];

    tbody.replaceChildren();

    root.removeAttribute("aria-busy");

    table.removeAttribute("aria-busy");
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    view: VIEW,

    reload,
    adjust,

    getRows,
    getVisibleRows,
    getTable,

    destroy,
  });
}
