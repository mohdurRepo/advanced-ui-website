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
 * - render standard mobile cards
 * - synchronize common loading / empty / error / results state
 * - expose a view API compatible with trading.js
 *
 * This file intentionally has no:
 *
 * - DataTables
 * - table header generation
 * - tab behavior
 * - Negotiated filter orchestration
 * - Sector -> Company behavior
 * - AJAX transport implementation
 *
 * Why no DataTables?
 *
 * The JSP owns a three-row matrix header with five visual positions, while
 * the backend owns only four data values:
 *
 * col1
 * col2
 * col3
 * col4
 *
 * Treating this matrix as an ordinary DataTable would couple body geometry
 * to a header schema that does not represent normal data columns.
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

/*
 * JSP matrix:
 *
 * first visual position = row/group label area
 * remaining positions   = col1 / col2 / col3 / col4
 */

const MATRIX_COLUMN_COUNT = 5;

/* ==========================================================================
   Helpers
   ========================================================================== */

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function query(root, selector) {
  return root?.querySelector?.(selector) || null;
}

/* ==========================================================================
   Response Parsing
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

/* ==========================================================================
   Response Rows
   ========================================================================== */

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

  /*
   * Compatibility with older DataTables-shaped responses.
   */

  if (Array.isArray(value?.aaData)) {
    return value.aaData;
  }

  return [];
}

/* ==========================================================================
   Response Count
   ========================================================================== */

function getResponseCount(response, rows) {
  const value = parseResponse(response);

  const candidates = [
    value?.total,
    value?.count,
    value?.recordsTotal,
    value?.recordsFiltered,
  ];

  for (const candidate of candidates) {
    const count = Number(candidate);

    if (Number.isFinite(count) && count >= 0) {
      return Math.floor(count);
    }
  }

  return rows.length;
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

function normalizeResponse(response) {
  const raw = parseResponse(response);

  const rows = getResponseRows(raw);

  return {
    rows,

    meta: {
      total: getResponseCount(raw, rows),
    },

    raw,
  };
}

/* ==========================================================================
   Table Rows
   ========================================================================== */

function renderLoadingRow() {
  return `
    <tr
      class="table-loading"
      aria-hidden="true"
    >
      <td
        colspan="${MATRIX_COLUMN_COUNT}"
      >
        <span
          class="table-skeleton table-skeleton-lg"
        ></span>
      </td>
    </tr>
  `.trim();
}

function renderMessageRow(message, className = "table-empty") {
  return `
    <tr
      class="${escapeHtml(className)}"
    >
      <td
        colspan="${MATRIX_COLUMN_COUNT}"
      >
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

  /* =========================================================================
     Elements
     ========================================================================= */

  const table = query(root, getTableSelector(VIEW));

  if (!(table instanceof HTMLTableElement)) {
    throw new Error("Minimum Size table was not found.");
  }

  const tbody = table.tBodies?.[0];

  if (!tbody) {
    throw new Error("Minimum Size table requires a tbody.");
  }

  const search = query(root, SELECTORS.minimumSize.search);

  if (search && !(search instanceof HTMLInputElement)) {
    throw new TypeError(
      "Minimum Size search control must be an input element.",
    );
  }

  /* =========================================================================
     Lifecycle
     ========================================================================= */

  const abortController = new AbortController();

  const { signal } = abortController;

  let destroyed = false;

  /* =========================================================================
     Runtime State
     ========================================================================= */

  let sourceRows = [];

  let visibleRows = [];

  let searchValue = normalizeSearchValue(search?.value);

  let totalCount = 0;

  let status = "idle";

  /* =========================================================================
     Source
     ========================================================================= */

  const source = createDataSource({
    endpoint: config.endpoints.minimumSize,

    /*
     * Exact existing backend contract.
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

      /*
       * JSP owns the visible "Results:" label.
       *
       * Common JS updates only the value node.
       */

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
    if (destroyed) {
      return;
    }

    const loading = Boolean(busy);

    root.setAttribute("aria-busy", String(loading));

    table.setAttribute("aria-busy", String(loading));
  }

  /*
   * JS becomes authoritative immediately.
   *
   * This prevents a server-rendered aria-busy="true" from leaving the page in
   * a permanent wait cursor/state before the first request begins.
   */

  setBusy(false);

  /* =========================================================================
     Search
     ========================================================================= */

  function normalizeSearchValue(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function applySearch() {
    visibleRows = filterMinimumSizeRows(sourceRows, searchValue);

    return visibleRows;
  }

  /* =========================================================================
     Result Count
     ========================================================================= */

  function getVisibleCount() {
    return visibleRows.length;
  }

  function renderResults() {
    if (status === "loading") {
      results.showLoading();

      return;
    }

    if (status === "error") {
      return;
    }

    if (!visibleRows.length) {
      results.showEmpty(config.labels?.noData || "No data available");

      return;
    }

    /*
     * Search count should reflect the currently visible matrix rows.
     *
     * totalCount remains available through getTotalCount() for diagnostics.
     */

    results.showReady(getVisibleCount());
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

    /*
     * Critical:
     *
     * Never touch:
     *
     * table.tHead
     * table.innerHTML
     *
     * The JSP matrix header is authoritative.
     */

    tbody.innerHTML = visibleRows
      .map((row) => renderMinimumSizeDesktopRow(row))
      .join("");
  }

  /* =========================================================================
     Mobile
     ========================================================================= */

  function renderCards() {
    if (destroyed) {
      return;
    }

    if (!visibleRows.length) {
      cards.showEmpty(config.labels?.noData || "No data available");

      return;
    }

    cards.setRows(visibleRows);
  }

  /* =========================================================================
     Ready Render
     ========================================================================= */

  function renderReady() {
    if (destroyed) {
      return;
    }

    status = "ready";

    setBusy(false);

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

    status = "loading";

    setBusy(true);

    /*
     * Minimum Size is a native matrix, so use the same design-system table
     * skeleton primitive manually rather than introducing DataTables.
     */

    tbody.innerHTML = renderLoadingRow();

    cards.showLoading();

    results.showLoading();
  }

  /* =========================================================================
     Empty
     ========================================================================= */

  function showEmpty() {
    if (destroyed) {
      return;
    }

    status = "empty";

    sourceRows = [];

    visibleRows = [];

    totalCount = 0;

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
    if (destroyed) {
      return;
    }

    status = "error";

    sourceRows = [];

    visibleRows = [];

    totalCount = 0;

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
     Search Render
     ========================================================================= */

  function renderSearchResults() {
    if (destroyed || status !== "ready") {
      return;
    }

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
     Search Events
     ========================================================================= */

  function handleSearch() {
    if (destroyed) {
      return;
    }

    searchValue = normalizeSearchValue(search?.value);

    renderSearchResults();
  }

  search?.addEventListener("input", handleSearch, {
    signal,
  });

  /*
   * Native type="search" dispatches "search" when its browser clear control is
   * used.
   */

  search?.addEventListener("search", handleSearch, {
    signal,
  });

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

      sourceRows = Array.isArray(response.rows) ? [...response.rows] : [];

      totalCount = Number(response.meta?.total) || sourceRows.length;

      if (!sourceRows.length) {
        showEmpty();

        return [];
      }

      renderReady();

      return [...sourceRows];
    } catch (error) {
      /*
       * Request cancellation is expected when:
       *
       * - the user switches variant quickly
       * - a newer request replaces an older request
       * - the page is destroyed
       */

      if (error?.name === "AbortError") {
        throw error;
      }

      showError(error);

      throw error;
    }
  }

  /* =========================================================================
     Adjustment
     ========================================================================= */

  function adjust() {
    /*
     * Native matrix only.
     *
     * There is no DataTables width calculation or FixedHeader instance here.
     *
     * The design-system .table-responsive wrapper owns any native overflow.
     */

    if (destroyed) {
      return;
    }

    /*
     * Force no layout mutation.
     *
     * Keeping this method allows trading.js to treat every Trading view through
     * one stable interface.
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
    /*
     * No DataTables API.
     *
     * Returning null keeps the same public contract as the other view modules.
     */

    return null;
  }

  function getNativeTable() {
    return table;
  }

  function getSearchValue() {
    return searchValue;
  }

  function getTotalCount() {
    return totalCount;
  }

  function isLoading() {
    return status === "loading";
  }

  /* =========================================================================
     Search API
     ========================================================================= */

  function setSearchValue(value) {
    if (destroyed) {
      return;
    }

    const normalized = String(value || "");

    if (search) {
      search.value = normalized;
    }

    searchValue = normalizeSearchValue(normalized);

    renderSearchResults();
  }

  function clearSearch() {
    setSearchValue("");
  }

  /* =========================================================================
     Lifecycle
     ========================================================================= */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    abortController.abort();

    source.destroy();

    cards.destroy();

    results.destroy();

    sourceRows = [];

    visibleRows = [];

    totalCount = 0;

    tbody.replaceChildren();

    root.removeAttribute("aria-busy");

    table.removeAttribute("aria-busy");
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    view: VIEW,

    /* -----------------------------------------------------------------------
       Data
       ----------------------------------------------------------------------- */

    reload,

    /* -----------------------------------------------------------------------
       Layout
       ----------------------------------------------------------------------- */

    adjust,

    /* -----------------------------------------------------------------------
       Search
       ----------------------------------------------------------------------- */

    setSearchValue,
    clearSearch,

    /* -----------------------------------------------------------------------
       Queries
       ----------------------------------------------------------------------- */

    getRows,
    getVisibleRows,

    getTable,
    getNativeTable,

    getSearchValue,
    getTotalCount,

    isLoading,

    /* -----------------------------------------------------------------------
       Lifecycle
       ----------------------------------------------------------------------- */

    destroy,
  });
}
