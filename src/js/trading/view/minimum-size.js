/* ==========================================================================
   Minimum Size View
   ========================================================================== */

/*
 * Minimum Size is intentionally a special Trading view.
 *
 * The API returns:
 *
 * - col1
 * - col2
 * - col3
 * - col4
 *
 * The JSP owns the complete matrix header and its five visual positions.
 *
 * Responsibilities:
 *
 * - load Minimum Size data through common createDataSource()
 * - render only the matrix <tbody>
 * - provide client-side matrix search
 * - render mobile content through common createDataCards()
 * - use the standard design-system Data Card
 * - synchronize result count through common createDataResults()
 *
 * This file intentionally has no:
 *
 * - DataTables
 * - header generation
 * - generic card lifecycle
 * - AJAX implementation
 * - tab switching
 * - filter orchestration
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import {
  createDataCards,
  createDataResults,
  createDataSource,
  renderStandardDataCard,
} from "../common/data-view/index.js";

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
  getDisplayValue,
  renderSecurityReference,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.minimumSize;

const MATRIX_COLUMN_COUNT = 5;

/* ==========================================================================
   Values
   ========================================================================== */

function getValues(row = {}) {
  return [row.col1, row.col2, row.col3, row.col4];
}

/* ==========================================================================
   Search Text
   ========================================================================== */

function getValueSearchText(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return [value.symbol, value.name, value.label].filter(Boolean).join(" ");
  }

  return getDisplayValue(value, "");
}

function getRowSearchText(row = {}) {
  return getValues(row).map(getValueSearchText).join(" ").toLowerCase();
}

function filterRows(rows = [], query = "") {
  if (!Array.isArray(rows)) {
    return [];
  }

  const normalized = String(query || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return [...rows];
  }

  return rows.filter((row) => getRowSearchText(row).includes(normalized));
}

/* ==========================================================================
   Response
   ========================================================================== */

function getRows(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
}

function normalizeResponse(response) {
  const rows = getRows(response);

  return {
    rows,

    meta: {
      total: rows.length,

      updatedAt:
        response?.updatedAt ??
        response?.lastUpdated ??
        response?.timestamp ??
        null,
    },

    raw: response,
  };
}

/* ==========================================================================
   Desktop Matrix Cell
   ========================================================================== */

function renderMatrixValue(value) {
  return renderSecurityReference(value);
}

/* ==========================================================================
   Desktop Matrix Row
   ========================================================================== */

/*
 * The first physical tbody cell corresponds to the row-heading position
 * already represented visually by the JSP matrix header.
 *
 * Do not modify:
 *
 * - table.tHead
 * - table.innerHTML
 *
 * Only tbody is rendered here.
 */

function renderMatrixRow(row) {
  return `
    <tr class="trading-minimum-size-row">

      <td
        class="trading-minimum-size-row__label"
        aria-hidden="true"
      ></td>

      <td>
        ${renderMatrixValue(row?.col1)}
      </td>

      <td>
        ${renderMatrixValue(row?.col2)}
      </td>

      <td>
        ${renderMatrixValue(row?.col3)}
      </td>

      <td>
        ${renderMatrixValue(row?.col4)}
      </td>

    </tr>
  `.trim();
}

/* ==========================================================================
   Desktop Loading
   ========================================================================== */

function renderMatrixLoadingRow() {
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

/* ==========================================================================
   Desktop Empty / Error
   ========================================================================== */

function renderMatrixMessageRow(message, className = "table-empty") {
  return `
    <tr class="${escapeHtml(className)}">

      <td colspan="${MATRIX_COLUMN_COUNT}">
        ${escapeHtml(message)}
      </td>

    </tr>
  `.trim();
}

/* ==========================================================================
   Mobile Fields
   ========================================================================== */

function getMobileFields(row, config) {
  const labels = config.labels?.minimumSize || {};

  return [
    {
      label: labels.col1 || "",

      value: renderMatrixValue(row?.col1),

      fullWidth: true,
    },

    {
      label: labels.col2 || "",

      value: renderMatrixValue(row?.col2),

      fullWidth: true,
    },

    {
      label: labels.col3 || "",

      value: renderMatrixValue(row?.col3),

      fullWidth: true,
    },

    {
      label: labels.col4 || "",

      value: renderMatrixValue(row?.col4),

      fullWidth: true,
    },
  ];
}

/* ==========================================================================
   Mobile Summary
   ========================================================================== */

function renderMobileSummary(config) {
  return `
    <div class="data-card__identity">

      <div class="data-card__identity-content">

        <div class="data-card__identity-name">
          ${escapeHtml(config.labels?.tabs?.negotiatedDeals || "Minimum Size")}
        </div>

      </div>

    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderMobileCard(row, context, config) {
  return renderStandardDataCard({
    rowId: context.index,

    idPrefix: "minimum-size-card-details",

    summary: renderMobileSummary(config),

    fields: getMobileFields(row, config),

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",

    className: "trading-card trading-card--minimum-size",
  });
}

/* ==========================================================================
   Public View Factory
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

  let sourceRows = [];

  let visibleRows = [];

  let searchQuery = "";

  let destroyed = false;

  const abortController = new AbortController();

  const { signal } = abortController;

  /* =========================================================================
     Source
     ========================================================================= */

  const source = createDataSource({
    endpoint: config.endpoints.minimumSize,

    /*
     * Legacy Minimum Size does not consume the Negotiated filters.
     *
     * Locale is the only request state required here.
     */
    buildRequestData() {
      return {
        locale: config.locale,
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

      results: config.labels?.results,
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
      return renderMobileCard(row, context, config);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load data.",

    afterRender(container) {
      container?.classList?.add(
        "trading-card-list",
        "trading-minimum-size-card-list",
      );
    },
  });

  /* =========================================================================
     Busy State
     ========================================================================= */

  function setBusy(busy) {
    root.setAttribute("aria-busy", String(Boolean(busy)));

    table.setAttribute("aria-busy", String(Boolean(busy)));
  }

  /* =========================================================================
     Visible Rows
     ========================================================================= */

  function updateVisibleRows() {
    visibleRows = filterRows(sourceRows, searchQuery);
  }

  /* =========================================================================
     Desktop Render
     ========================================================================= */

  function renderTable() {
    if (destroyed) {
      return;
    }

    if (!visibleRows.length) {
      tbody.innerHTML = renderMatrixMessageRow(
        config.labels?.noData || "No data available",
      );

      return;
    }

    tbody.innerHTML = visibleRows.map(renderMatrixRow).join("");
  }

  /* =========================================================================
     Results Render
     ========================================================================= */

  function renderResults() {
    results.setCount(visibleRows.length);
  }

  /* =========================================================================
     Cards Render
     ========================================================================= */

  function renderCards() {
    cards.setRows(visibleRows);
  }

  /* =========================================================================
     Render
     ========================================================================= */

  function render() {
    updateVisibleRows();

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

    tbody.innerHTML = renderMatrixLoadingRow();

    cards.showLoading?.();

    results.showLoading?.();
  }

  /* =========================================================================
     Empty
     ========================================================================= */

  function showEmpty() {
    sourceRows = [];
    visibleRows = [];

    setBusy(false);

    tbody.innerHTML = renderMatrixMessageRow(
      config.labels?.noData || "No data available",
    );

    cards.setEmpty?.(config.labels?.noData || "No data available");

    results.showEmpty?.(config.labels?.noData || "No data available");
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
      "Unable to load data.";

    tbody.innerHTML = renderMatrixMessageRow(
      message,
      "table-empty table-error",
    );

    cards.setError?.(message);

    results.showError?.(message);
  }

  /* =========================================================================
     Search
     ========================================================================= */

  function handleSearch() {
    if (destroyed) {
      return;
    }

    searchQuery = search?.value || "";

    render();
  }

  search?.addEventListener("input", handleSearch, {
    signal,
  });

  /*
   * Search is client-side only.
   *
   * Do not issue another backend request while users type.
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

      sourceRows = Array.isArray(response.rows) ? response.rows : [];

      if (!sourceRows.length) {
        showEmpty();

        return [];
      }

      setBusy(false);

      render();

      results.showReady?.(visibleRows.length);

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
     * No DataTables recalculation is necessary.
     *
     * Minimum Size uses one physical native table whose JSP-owned thead and
     * dynamically rendered tbody share the same layout.
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
     * There is intentionally no DataTables API for this view.
     */
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

    abortController.abort();

    source.destroy();

    cards.destroy?.();

    results.destroy?.();

    sourceRows = [];
    visibleRows = [];

    tbody.replaceChildren();
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    reload,
    adjust,

    getRows,
    getVisibleRows,
    getTable,

    destroy,
  });
}
