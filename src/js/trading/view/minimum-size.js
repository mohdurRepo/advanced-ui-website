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
 * - measure the native multi-row sticky header
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

/*
 * CSS custom properties consumed by table-market.scss.
 *
 * Keeping these names here avoids repeating string literals throughout the
 * lifecycle code.
 */

const STICKY_ROW_2_PROPERTY = "--table-market-sticky-row-2-offset";

const STICKY_ROW_3_PROPERTY = "--table-market-sticky-row-3-offset";

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

  /*
   * Used to collapse multiple layout requests occurring in the same frame.
   *
   * Examples:
   *
   * - render
   * - tab activation
   * - resize
   * - font completion
   */

  let adjustmentFrame = null;

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
     * Search count reflects the currently visible matrix rows.
     *
     * totalCount remains available through getTotalCount() for diagnostics.
     */

    results.showReady(getVisibleCount());
  }

  /* =========================================================================
     Sticky Header
     ========================================================================= */

  /*
   * The JSP owns the Minimum Size <thead>.
   *
   * We therefore measure the real rendered rows rather than reproducing
   * assumptions about:
   *
   * - header text
   * - localization
   * - line wrapping
   * - font metrics
   * - responsive padding
   *
   * table-market.scss consumes these measured offsets.
   */

  function getHeaderRows() {
    const head = table.tHead;

    if (!head) {
      return [];
    }

    return Array.from(head.rows || []);
  }

  function clearStickyHeaderOffsets() {
    table.style.removeProperty(STICKY_ROW_2_PROPERTY);

    table.style.removeProperty(STICKY_ROW_3_PROPERTY);
  }

  function updateStickyHeaderOffsets() {
    if (destroyed) {
      return;
    }

    const rows = getHeaderRows();

    /*
     * Minimum Size expects three JSP-owned header rows.
     *
     * If markup is incomplete, remove stale measurements and allow the SCSS
     * fallback values to take over.
     */

    if (rows.length < 3) {
      clearStickyHeaderOffsets();

      return;
    }

    const row1Rect = rows[0].getBoundingClientRect();

    const row2Rect = rows[1].getBoundingClientRect();

    const row1Height = Number(row1Rect.height);

    const row2Height = Number(row2Rect.height);

    if (!Number.isFinite(row1Height) || !Number.isFinite(row2Height)) {
      clearStickyHeaderOffsets();

      return;
    }

    /*
     * Keep browser sub-pixel precision.
     *
     * Fractional values are valid and avoid cumulative gaps at browser zoom
     * levels where line boxes do not resolve to whole CSS pixels.
     */

    const row2Offset = Math.max(0, row1Height);

    const row3Offset = Math.max(0, row1Height + row2Height);

    table.style.setProperty(STICKY_ROW_2_PROPERTY, `${row2Offset}px`);

    table.style.setProperty(STICKY_ROW_3_PROPERTY, `${row3Offset}px`);
  }

  /* =========================================================================
     Scheduled Layout Adjustment
     ========================================================================= */

  /*
   * Layout changes can arrive several times during the same browser frame.
   *
   * Schedule one measurement instead of forcing repeated synchronous layout
   * reads.
   */

  function scheduleAdjustment() {
    if (destroyed) {
      return;
    }

    if (adjustmentFrame !== null) {
      cancelAnimationFrame(adjustmentFrame);
    }

    adjustmentFrame = requestAnimationFrame(() => {
      adjustmentFrame = null;

      if (destroyed) {
        return;
      }

      updateStickyHeaderOffsets();
    });
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

      scheduleAdjustment();

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

    /*
     * Body rendering may change the intrinsic width of the table.
     *
     * That can change header wrapping and therefore the real heights of the
     * JSP-owned header rows.
     */

    scheduleAdjustment();
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

      scheduleAdjustment();

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

    scheduleAdjustment();
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

    scheduleAdjustment();
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

    scheduleAdjustment();
  }
  /* =========================================================================
     Search Render
     ========================================================================= */

  function renderSearch() {
    if (destroyed) {
      return;
    }

    /*
     * Search operates entirely against the already-loaded Minimum Size rows.
     *
     * No request is made when the search value changes.
     */

    applySearch();

    if (!visibleRows.length) {
      const message = config.labels?.noData || "No data available";

      tbody.innerHTML = renderMessageRow(message);

      cards.showEmpty(message);

      results.showEmpty(message);

      scheduleAdjustment();

      return;
    }

    renderTable();

    renderCards();

    renderResults();
  }

  /* =========================================================================
     Search Event
     ========================================================================= */

  function handleSearchInput(event) {
    if (destroyed) {
      return;
    }

    searchValue = normalizeSearchValue(event?.currentTarget?.value);

    renderSearch();
  }

  if (search) {
    search.addEventListener("input", handleSearchInput, {
      signal,
    });
  }

  /* =========================================================================
     Layout Events
     ========================================================================= */

  /*
   * The Minimum Size header is localized and can change physical height when:
   *
   * - the viewport changes
   * - browser zoom changes
   * - responsive padding changes
   * - fonts finish loading
   *
   * Re-measure rather than relying on fixed SCSS heights.
   */

  function handleResize() {
    if (destroyed) {
      return;
    }

    scheduleAdjustment();
  }

  window.addEventListener("resize", handleResize, {
    signal,
  });

  /* =========================================================================
     Font Readiness
     ========================================================================= */

  /*
   * Web fonts may settle after the initial layout.
   *
   * document.fonts is progressive enhancement only; older browsers simply
   * keep the initial/resize measurements.
   */

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready
      .then(() => {
        if (destroyed) {
          return;
        }

        scheduleAdjustment();
      })
      .catch(() => {
        /*
         * Font readiness must never prevent the view from working.
         */
      });
  }

  /* =========================================================================
     Initial Header Measurement
     ========================================================================= */

  /*
   * Measure the JSP-rendered header immediately after the view has been
   * created.
   *
   * If the tab is initially hidden, trading.js can call adjust() again when
   * the tab becomes visible.
   */

  scheduleAdjustment();

  /* =========================================================================
     Reload
     ========================================================================= */

  async function reload() {
    if (destroyed) {
      return [];
    }

    showLoading();

    try {
      const result = await source.load();

      if (destroyed) {
        return [];
      }

      const rows = Array.isArray(result?.rows) ? result.rows : [];

      sourceRows = rows.slice();

      totalCount = Number.isFinite(Number(result?.meta?.total))
        ? Number(result.meta.total)
        : sourceRows.length;

      if (!sourceRows.length) {
        showEmpty();

        return [];
      }

      renderReady();

      return sourceRows;
    } catch (error) {
      if (destroyed) {
        return [];
      }

      /*
       * An aborted request during destruction is lifecycle cleanup rather than
       * a user-visible load failure.
       */

      if (error?.name === "AbortError") {
        return [];
      }

      showError(error);

      return [];
    }
  }

  /* =========================================================================
     Adjustment
     ========================================================================= */

  function adjust() {
    if (destroyed) {
      return;
    }

    /*
     * Native matrix only.
     *
     * There is no:
     *
     * - DataTables columns.adjust()
     * - FixedHeader.adjust()
     * - FixedColumns relayout
     *
     * The only runtime geometry owned by this view is the measured three-row
     * sticky header.
     */

    scheduleAdjustment();
  }

  /* =========================================================================
     Search API
     ========================================================================= */

  function setSearch(value, { render = true } = {}) {
    if (destroyed) {
      return;
    }

    const normalizedValue = normalizeSearchValue(value);

    searchValue = normalizedValue;

    if (search) {
      search.value = hasValue(value) ? String(value) : "";
    }

    if (render) {
      renderSearch();
    }
  }

  function clearSearch(options = {}) {
    setSearch("", options);
  }

  /* =========================================================================
     Query API
     ========================================================================= */

  function getRows() {
    return sourceRows.slice();
  }

  function getVisibleRows() {
    return visibleRows.slice();
  }

  function getTotalCount() {
    return totalCount;
  }

  function getVisibleRowCount() {
    return visibleRows.length;
  }

  function getSearch() {
    return searchValue;
  }

  function getStatus() {
    return status;
  }

  /* =========================================================================
     Destruction
     ========================================================================= */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    /*
     * Remove all listeners registered with this view.
     */

    abortController.abort();

    /*
     * Cancel any pending measurement frame.
     */

    if (adjustmentFrame !== null) {
      cancelAnimationFrame(adjustmentFrame);

      adjustmentFrame = null;
    }

    /*
     * Remove runtime geometry written by this view.
     *
     * This leaves table-market.scss defaults authoritative if the DOM remains
     * mounted after destruction.
     */

    clearStickyHeaderOffsets();

    /*
     * Allow common helpers to release their own resources where supported.
     */

    source.destroy?.();

    cards.destroy?.();

    results.destroy?.();

    sourceRows = [];

    visibleRows = [];

    totalCount = 0;

    status = "destroyed";
  }

  /* =========================================================================
     Public API
     ========================================================================= */

  return {
    /*
     * Data lifecycle
     */

    reload,

    /*
     * Layout lifecycle
     */

    adjust,

    /*
     * Search
     */

    setSearch,
    clearSearch,

    /*
     * Query
     */

    getRows,
    getVisibleRows,
    getTotalCount,
    getVisibleRowCount,
    getSearch,
    getStatus,

    /*
     * Lifecycle
     */

    destroy,
  };
}
