/* ==========================================================================
   Trading
   ========================================================================== */

/*
 * Trading page controller.
 *
 * Responsibilities:
 *
 * - initialize Trading tabs/views
 * - own filter state
 * - load endpoint data
 * - coordinate loading states
 * - initialize DataTables only when required
 * - preserve JSP-owned table headers
 * - render dedicated Minimum Size matrix
 * - render mobile cards
 * - synchronize result counts
 * - reset filters to business defaults
 * - synchronize Sector -> Company dependency
 * - refresh visible tables after tab/variant changes
 *
 * Presentation rules live in:
 *
 * - trading-schema.js
 * - trading-formatters.js
 *
 * Shared card behavior remains owned by the design-system DataViewCard.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  TRADING_TABS,
  TRADING_VIEWS,
  getColumns,
  getColumnByKey,
  getIdentityConfig,
  getMatrixConfig,
  getMobileConfig,
  getNegotiatedView,
  getSearchConfig,
  getSuspendedDelistedView,
  getTableConfig,
  getTableMode,
  getTotalsConfig,
  getViewSchema,
  getViewsForTab,
  isComplexHeaderTable,
  isMatrixTable,
  shouldPreserveHeader,
} from "./trading-schema";

import {
  createMobileField,
  escapeHtml,
  filterMinimumSizeRows,
  formatTradingDate,
  getDefaultTradingDateRange,
  getNegotiatedDateGroup,
  getTradingCardContainerClass,
  hasValue,
  isTotalRow,
  renderMinimumSizeDesktopRow,
  renderMinimumSizeMobileCards,
  renderMobileIdentity,
  renderMobileSummaryValue,
  renderNegotiatedDailyTotalCard,
  renderTradingCell,
  safeUrl,
  toRequestDate,
} from "./trading-formatters";

import { renderStandardDataCard } from "../../components/data-view/data-card";

import {
  initDataViewCards,
  refreshDataViews,
} from "../../components/data-view";

/* ==========================================================================
   Configuration
   ========================================================================== */

const config = window.TradingConfig || {};

/* ==========================================================================
   Root
   ========================================================================== */

const root = document.querySelector("[data-trading]");

/*
 * Trading is page-specific.
 *
 * Importing this module on another page must remain harmless.
 */
if (!root) {
  // Intentionally no initialization.
}

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = Object.freeze({
  /* ------------------------------------------------------------------------
     Tabs
     ------------------------------------------------------------------------ */

  tab: "[data-trading-tab]",

  panel: "[data-trading-panel]",

  /* ------------------------------------------------------------------------
     Views
     ------------------------------------------------------------------------ */

  view: "[data-trading-view]",

  table: "[data-trading-table]",

  cards: "[data-trading-cards]",

  resultCount: "[data-trading-result-count]",

  loading: "[data-trading-loading]",

  /* ------------------------------------------------------------------------
     Negotiated Filters
     ------------------------------------------------------------------------ */

  negotiatedForm: "[data-trading-negotiated-filters]",

  negotiatedType: "[data-trading-negotiated-type]",

  negotiatedSector: "[data-trading-negotiated-sector]",

  negotiatedCompany: "[data-trading-negotiated-company]",

  negotiatedFrom: "[data-trading-negotiated-from-date]",

  negotiatedTo: "[data-trading-negotiated-to-date]",

  negotiatedSearch: '[data-trading-table-search="minimumSize"]',

  companyStatusType: "[data-trading-delisted-type]",

  companyStatusFrom: "[data-trading-delisted-from-date]",

  companyStatusTo: "[data-trading-delisted-to-date]",

  /* ------------------------------------------------------------------------
     Accumulated
     ------------------------------------------------------------------------ */

  accumulatedForm: "[data-trading-accumulated-filters]",

  accumulatedReport: "[data-trading-accumulated-report]",

  /* ------------------------------------------------------------------------
     Suspended / Delisted
     ------------------------------------------------------------------------ */

  companyStatusForm: "[data-trading-company-status-filters]",

  companyStatusType: "[data-trading-company-status-type]",

  companyStatusFrom: "[data-trading-company-status-from]",

  companyStatusTo: "[data-trading-company-status-to]",

  /* ------------------------------------------------------------------------
     Reset
     ------------------------------------------------------------------------ */

  reset: "[data-trading-reset]",
});

/* ==========================================================================
   State
   ========================================================================== */

const state = {
  initialized: false,

  activeTab: config.initialState?.activeTab || TRADING_TABS.negotiatedDeals,

  /*
   * Data loaded from endpoints.
   */
  rows: new Map(),

  /*
   * DataTables API instances.
   */
  tables: new Map(),

  /*
   * AbortControllers for in-flight requests.
   */
  requests: new Map(),

  /*
   * Whether a view has successfully loaded at least once.
   */
  loaded: new Set(),

  /*
   * Whether a view is currently loading.
   */
  loading: new Set(),

  /*
   * Current negotiated variant.
   */
  negotiatedType:
    config.initialState?.negotiatedDeals?.type || "Negotiated-Deals",

  /*
   * Current suspended/delisted variant.
   */
  companyStatusType:
    config.initialState?.deListedCompanies?.type || "Suspension",

  /*
   * Minimum Size client-side search.
   */
  minimumSizeSearch: "",
};

/* ==========================================================================
   DOM Helpers
   ========================================================================== */

function query(selector, context = root) {
  return context?.querySelector?.(selector) || null;
}

function queryAll(selector, context = root) {
  return [...(context?.querySelectorAll?.(selector) || [])];
}

/* ==========================================================================
   View DOM
   ========================================================================== */

function getViewElement(view) {
  return query(`[data-trading-view="${view}"]`);
}

function getTableElement(view) {
  return query(`[data-trading-table="${view}"]`);
}

function getCardsElement(view) {
  return query(`[data-trading-cards="${view}"]`);
}

function getResultCountElement(view) {
  return query(`[data-trading-result-count="${view}"]`);
}

function getLoadingElement(view) {
  return query(`[data-trading-loading="${view}"]`);
}

/* ==========================================================================
   Visibility
   ========================================================================== */

function isElementVisible(element) {
  if (!element) {
    return false;
  }

  if (element.hidden || element.closest("[hidden]")) {
    return false;
  }

  return true;
}

function isViewVisible(view) {
  return isElementVisible(getViewElement(view));
}

/* ==========================================================================
   Result Count
   ========================================================================== */

function setResultCount(view, count) {
  const element = getResultCountElement(view);

  if (!element) {
    return;
  }

  element.textContent = String(
    Number.isFinite(Number(count)) ? Number(count) : 0,
  );
}

/* ==========================================================================
   Loading
   ========================================================================== */

function setLoading(view, loading) {
  const element = getLoadingElement(view);

  if (loading) {
    state.loading.add(view);
  } else {
    state.loading.delete(view);
  }

  if (!element) {
    return;
  }

  element.hidden = !loading;

  element.setAttribute("aria-hidden", String(!loading));

  const viewElement = getViewElement(view);

  if (viewElement) {
    viewElement.classList.toggle("is-loading", loading);
  }
}

/* ==========================================================================
   Empty State
   ========================================================================== */

function getNoDataLabel() {
  return config.labels?.noData || "No data available";
}

function renderEmptyTable(view) {
  const table = getTableElement(view);

  if (!table) {
    return;
  }

  const body = table.tBodies?.[0];

  if (!body) {
    return;
  }

  const visualColumns = getVisualColumnCount(view);

  body.innerHTML = `
    <tr
      class="table-market__empty-row"
    >
      <td
        colspan="${visualColumns}"
        class="table-market__empty"
      >
        ${escapeHtml(getNoDataLabel())}
      </td>
    </tr>
  `.trim();
}

function renderEmptyCards(view) {
  const cards = getCardsElement(view);

  if (!cards) {
    return;
  }

  cards.innerHTML = `
    <div
      class="data-view__empty"
    >
      ${escapeHtml(getNoDataLabel())}
    </div>
  `.trim();
}

/* ==========================================================================
   Visual Column Count
   ========================================================================== */

function getVisualColumnCount(view) {
  if (isMatrixTable(view, config)) {
    return getMatrixConfig(view, config)?.visualColumnCount || 1;
  }

  return Math.max(getColumns(view, config).length, 1);
}

/* ==========================================================================
   Error Handling
   ========================================================================== */

function reportError(context, error) {
  console.error(`Trading: ${context}`, error);
}

/* ==========================================================================
   Request Helpers
   ========================================================================== */

function abortRequest(key) {
  const controller = state.requests.get(key);

  if (!controller) {
    return;
  }

  controller.abort();

  state.requests.delete(key);
}

function createRequestController(key) {
  abortRequest(key);

  const controller = new AbortController();

  state.requests.set(key, controller);

  return controller;
}

/* ==========================================================================
   URL Parameters
   ========================================================================== */

function appendParameter(params, key, value) {
  if (!key || value === undefined || value === null || value === "") {
    return;
  }

  params.set(key, String(value));
}

function buildRequestUrl(endpoint, parameters = {}) {
  const url = new URL(endpoint, window.location.href);

  Object.entries(parameters).forEach(([key, value]) => {
    appendParameter(url.searchParams, key, value);
  });

  return url.toString();
}

/* ==========================================================================
   Fetch JSON
   ========================================================================== */

async function fetchJson(key, endpoint, parameters = {}) {
  if (!endpoint) {
    throw new Error(`Missing endpoint for ${key}.`);
  }

  const controller = createRequestController(key);

  const response = await fetch(buildRequestUrl(endpoint, parameters), {
    method: "GET",

    credentials: "same-origin",

    headers: {
      Accept: "application/json",
    },

    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

function normalizeRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload?.aaData)) {
    return payload.aaData;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  return [];
}

/* ==========================================================================
   DataTables Detection
   ========================================================================== */

function getDataTablesFactory() {
  if (
    window.jQuery &&
    window.jQuery.fn &&
    typeof window.jQuery.fn.DataTable === "function"
  ) {
    return window.jQuery;
  }

  return null;
}

function hasDataTable(table) {
  const $ = getDataTablesFactory();

  if (!$ || !table) {
    return false;
  }

  return $.fn.DataTable.isDataTable(table);
}

/* ==========================================================================
   Destroy DataTable
   ========================================================================== */

function destroyTable(view) {
  const api = state.tables.get(view);

  if (api) {
    try {
      api.destroy(false);
    } catch (error) {
      reportError(`could not destroy ${view} table`, error);
    }
  }

  state.tables.delete(view);

  const table = getTableElement(view);

  if (table && hasDataTable(table)) {
    try {
      getDataTablesFactory()(table).DataTable().destroy(false);
    } catch (error) {
      reportError(`could not destroy orphan ${view} DataTable`, error);
    }
  }
}

/* ==========================================================================
   Header Validation
   ========================================================================== */

/*
 * JSP is authoritative for all Trading headers.
 *
 * JS may validate the leaf-column count but must not replace <thead>.
 */

function getLeafHeaderCells(table) {
  if (!table?.tHead) {
    return [];
  }

  const rows = [...table.tHead.rows];

  if (rows.length === 0) {
    return [];
  }

  /*
   * The final header row contains the leaf headings for grouped tables.
   *
   * Cells with rowspan from previous rows are intentionally not duplicated
   * here; DataTables itself reads the complete DOM header structure.
   */
  return [...rows[rows.length - 1].cells];
}

function validateHeader(view) {
  const table = getTableElement(view);

  if (!table) {
    return;
  }

  if (!shouldPreserveHeader(view, config)) {
    return;
  }

  /*
   * Do not attempt to "fix" complex/matrix headers here.
   *
   * That was one of the causes of the broken Group 1 / Group 2 result.
   */
  if (isComplexHeaderTable(view, config) || isMatrixTable(view, config)) {
    return;
  }

  const expected = getColumns(view, config).length;

  const actual = table.tHead?.rows?.[0]?.cells?.length || 0;

  if (expected && actual !== expected) {
    console.warn(
      `Trading: ${view} header has ${actual} columns; schema expects ${expected}.`,
    );
  }
}

/* ==========================================================================
   DataTables Columns
   ========================================================================== */

function createDataTableColumns(view) {
  return getColumns(view, config).map((column) => ({
    data: column.data,

    name: column.key,

    className: column.className || "",

    width: column.width || undefined,

    orderable: Boolean(column.orderable),

    searchable: Boolean(column.searchable),

    defaultContent: "",

    render(value, type, row) {
      return renderTradingCell({
        row,
        column,
        type,
        config,
      });
    },
  }));
}

/* ==========================================================================
   Table Initialization
   ========================================================================== */

function createDataTable(view, rows) {
  const table = getTableElement(view);

  const $ = getDataTablesFactory();

  if (!table || !$) {
    return null;
  }

  /*
   * Matrix tables intentionally do not use the generic DataTable path.
   */
  if (isMatrixTable(view, config)) {
    return null;
  }

  validateHeader(view);

  destroyTable(view);

  const options = getTableConfig(view, config);

  /*
   * Presentation metadata belongs to Trading, not DataTables.
   */
  const { tradingMode, preserveHeader, complexHeader, ...dataTableOptions } =
    options;

  const api = $(table).DataTable({
    ...dataTableOptions,

    data: rows,

    columns: createDataTableColumns(view),

    /*
     * Do not let a hidden-tab initialization determine final widths.
     */
    autoWidth: false,

    /*
     * Keep JSP header structure.
     */
    destroy: true,

    retrieve: false,

    createdRow(row, rowData) {
      if (isTotalRow(rowData)) {
        row.classList.add("table-market__summary-row");
      }
    },

    initComplete() {
      /*
       * Only adjust immediately if this table is actually visible.
       */
      if (isViewVisible(view)) {
        requestAnimationFrame(() => {
          adjustTable(view);
        });
      }
    },
  });

  state.tables.set(view, api);

  return api;
}

/* ==========================================================================
   Table Adjustment
   ========================================================================== */

function adjustTable(view) {
  if (!isViewVisible(view)) {
    return;
  }

  const api = state.tables.get(view);

  if (!api) {
    return;
  }

  try {
    api.columns.adjust();

    /*
     * Responsive is optional.
     */
    if (api.responsive && typeof api.responsive.recalc === "function") {
      api.responsive.recalc();
    }

    /*
     * FixedHeader is intentionally disabled in TradingConfig, but keep this
     * defensive in case a future view enables it explicitly.
     */
    if (api.fixedHeader && typeof api.fixedHeader.adjust === "function") {
      api.fixedHeader.adjust();
    }
  } catch (error) {
    reportError(`could not adjust ${view}`, error);
  }
}

/* ==========================================================================
   Adjust Visible Tables
   ========================================================================== */

function adjustVisibleTables() {
  state.tables.forEach((api, view) => {
    if (isViewVisible(view)) {
      adjustTable(view);
    }
  });
}

/* ==========================================================================
   Plain Table Rendering
   ========================================================================== */

/*
 * Fallback renderer when DataTables is unavailable.
 *
 * Also useful for views that deliberately avoid DataTables.
 */

function renderPlainTable(view, rows) {
  const table = getTableElement(view);

  if (!table) {
    return;
  }

  const body = table.tBodies?.[0];

  if (!body) {
    return;
  }

  if (!rows.length) {
    renderEmptyTable(view);

    return;
  }

  const columns = getColumns(view, config);

  body.innerHTML = rows
    .map((row) => {
      const rowClass = isTotalRow(row) ? "table-market__summary-row" : "";

      return `
            <tr
              class="${rowClass}"
            >
              ${columns
                .map((column) =>
                  `
                    <td
                      class="${escapeHtml(column.className || "")}"
                      data-column-key="${escapeHtml(column.key)}"
                    >
                      ${renderTradingCell({
                        row,
                        column,
                        type: "display",
                        config,
                      })}
                    </td>
                  `.trim(),
                )
                .join("")}
            </tr>
          `.trim();
    })
    .join("");
}

/* ==========================================================================
   Minimum Size
   ========================================================================== */

function getMinimumSizeRows() {
  return state.rows.get(TRADING_VIEWS.minimumSize) || [];
}

/* ==========================================================================
   Filtered Minimum Size
   ========================================================================== */

function getFilteredMinimumSizeRows() {
  return filterMinimumSizeRows(getMinimumSizeRows(), state.minimumSizeSearch);
}

/* ==========================================================================
   Minimum Size Desktop
   ========================================================================== */

function renderMinimumSizeTable() {
  const view = TRADING_VIEWS.minimumSize;

  const table = getTableElement(view);

  if (!table) {
    return;
  }

  /*
   * Minimum Size must never inherit a stale DataTable wrapper.
   */
  destroyTable(view);

  const body = table.tBodies?.[0];

  if (!body) {
    return;
  }

  const rows = getFilteredMinimumSizeRows();

  setResultCount(view, rows.length);

  if (rows.length === 0) {
    renderEmptyTable(view);

    return;
  }

  /*
   * Critical:
   *
   * Do not touch table.tHead.
   *
   * JSP owns the complete 3-row Minimum Size matrix header.
   */
  body.innerHTML = rows.map((row) => renderMinimumSizeDesktopRow(row)).join("");
}

/* ==========================================================================
   Minimum Size Mobile
   ========================================================================== */

function renderMinimumSizeCards() {
  const view = TRADING_VIEWS.minimumSize;

  const cards = getCardsElement(view);

  if (!cards) {
    return;
  }

  const rows = getFilteredMinimumSizeRows();

  cards.classList.add(getTradingCardContainerClass());

  if (rows.length === 0) {
    renderEmptyCards(view);

    return;
  }

  cards.innerHTML = renderMinimumSizeMobileCards(rows, config);
}

/* ==========================================================================
   Render Minimum Size
   ========================================================================== */

function renderMinimumSize() {
  renderMinimumSizeTable();
  renderMinimumSizeCards();
}

/* ==========================================================================
   Standard / Complex Desktop Render
   ========================================================================== */

function renderDesktopView(view, rows) {
  if (isMatrixTable(view, config)) {
    renderMinimumSizeTable();

    return;
  }

  const $ = getDataTablesFactory();

  if ($) {
    createDataTable(view, rows);

    return;
  }

  renderPlainTable(view, rows);
}

/* ==========================================================================
   Data Storage
   ========================================================================== */

function storeRows(view, rows) {
  const normalized = Array.isArray(rows) ? rows : [];

  state.rows.set(view, normalized);

  state.loaded.add(view);

  setResultCount(view, normalized.length);

  return normalized;
}

/* ==========================================================================
   Current View Resolution
   ========================================================================== */

function getCurrentNegotiatedView() {
  return getNegotiatedView(state.negotiatedType);
}

function getCurrentCompanyStatusView() {
  return getSuspendedDelistedView(state.companyStatusType);
}

/* ==========================================================================
   Current View for Tab
   ========================================================================== */

function getCurrentViewForTab(tab) {
  switch (tab) {
    case TRADING_TABS.negotiatedDeals:
      return getCurrentNegotiatedView();

    case TRADING_TABS.accumulated:
      return TRADING_VIEWS.accumulatedLosses;

    case TRADING_TABS.listedTradable:
      return TRADING_VIEWS.listedTradableRights;

    case TRADING_TABS.deListedCompanies:
      return getCurrentCompanyStatusView();

    case TRADING_TABS.otcTrading:
      return TRADING_VIEWS.otcTrading;

    default:
      return null;
  }
}
/* ==========================================================================
   Standard Mobile Fields
   ========================================================================== */

function getMobileDetailFields(view, row) {
  const mobile = getMobileConfig(view, config);

  return (mobile.details || [])
    .map((key) => getColumnByKey(view, key, config))
    .filter(Boolean)
    .map((column) => createMobileField(row, column, config));
}

/* ==========================================================================
   Standard Mobile Card
   ========================================================================== */

function renderStandardMobileCard(view, row, index) {
  const mobile = getMobileConfig(view, config);

  const identity = renderMobileIdentity(row, view);

  const summary = renderMobileSummaryValue(row, view, config);

  const fields = getMobileDetailFields(view, row);

  const identityConfig = getIdentityConfig(view, config);

  const code = identityConfig?.codeData ? row?.[identityConfig.codeData] : "";

  const name = identityConfig?.nameData ? row?.[identityConfig.nameData] : "";

  const rowId = code || name || index;

  return renderStandardDataCard({
    idPrefix: `trading-${view}-details`,

    rowId: `${rowId}-${index}`,

    className: "trading-data-card",

    summary: `
        ${identity}
        ${summary}
      `,

    fields,

    expandable: mobile.expandable === false ? false : fields.length > 0,

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",
  });
}

/* ==========================================================================
   Standard Mobile Collection
   ========================================================================== */

function renderStandardCards(view, rows) {
  const cards = getCardsElement(view);

  if (!cards) {
    return;
  }

  cards.classList.add(getTradingCardContainerClass());

  if (!rows.length) {
    renderEmptyCards(view);

    return;
  }

  cards.innerHTML = rows
    .map((row, index) => renderStandardMobileCard(view, row, index))
    .join("");

  /*
   * Enhance newly inserted standard Data Cards.
   *
   * This call happens only after markup exists in the DOM.
   */
  initDataViewCards?.(cards);
}

/* ==========================================================================
   Negotiated Grouping
   ========================================================================== */

function groupNegotiatedRows(rows) {
  const groups = new Map();

  let currentGroup = null;

  rows.forEach((row) => {
    const date = getNegotiatedDateGroup(row);

    /* --------------------------------------------------------------------
         Daily Total
         -------------------------------------------------------------------- */

    if (isTotalRow(row)) {
      /*
       * Some responses repeat the date on the total row.
       */
      if (hasValue(date) && groups.has(date)) {
        groups.get(date).total = row;

        return;
      }

      /*
       * Other responses omit the date from the total row.
       *
       * Attach it to the most recently processed date group.
       */
      if (currentGroup) {
        currentGroup.total = row;
      }

      return;
    }

    /* --------------------------------------------------------------------
         Normal Row
         -------------------------------------------------------------------- */

    const groupKey = hasValue(date) ? date : "";

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        date: groupKey,

        rows: [],

        total: null,
      });
    }

    currentGroup = groups.get(groupKey);

    currentGroup.rows.push(row);
  });

  return [...groups.values()];
}

/* ==========================================================================
   Negotiated Group ID
   ========================================================================== */

function createNegotiatedGroupId(date, index) {
  const value = String(date || `group-${index}`)
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `trading-negotiated-group-${value || index}`;
}

/* ==========================================================================
   Negotiated Mobile Cards
   ========================================================================== */

function renderNegotiatedCards(rows) {
  const view = TRADING_VIEWS.negotiatedDeals;

  const cards = getCardsElement(view);

  if (!cards) {
    return;
  }

  cards.classList.add(
    getTradingCardContainerClass(),
    "trading-negotiated-card-list",
  );

  const groups = groupNegotiatedRows(rows);

  if (groups.length === 0) {
    renderEmptyCards(view);

    return;
  }

  let cardIndex = 0;

  cards.innerHTML = groups
    .map((group, groupIndex) => {
      const titleId = createNegotiatedGroupId(group.date, groupIndex);

      const normalCards = group.rows
        .map((row) => {
          const markup = renderStandardMobileCard(view, row, cardIndex);

          cardIndex += 1;

          return markup;
        })
        .join("");

      const total = group.total
        ? renderNegotiatedDailyTotalCard(group.total, config)
        : "";

      return `
            <section
              class="data-card-group trading-negotiated-group"
              aria-labelledby="${escapeHtml(titleId)}"
            >
              ${
                group.date
                  ? `
                    <h3
                      class="data-card-group__title"
                      id="${escapeHtml(titleId)}"
                    >
                      ${escapeHtml(group.date)}
                    </h3>
                  `
                  : ""
              }

              <div
                class="data-card-group__items trading-card-list"
              >
                ${normalCards}
                ${total}
              </div>
            </section>
          `.trim();
    })
    .join("");

  /*
   * Dynamic cards now exist.
   */
  initDataViewCards?.(cards);
}

/* ==========================================================================
   Mobile View Renderer
   ========================================================================== */

function renderMobileView(view, rows) {
  switch (view) {
    case TRADING_VIEWS.minimumSize:
      renderMinimumSizeCards();

      return;

    case TRADING_VIEWS.negotiatedDeals:
      renderNegotiatedCards(rows);

      return;

    default:
      renderStandardCards(view, rows);
  }
}

/* ==========================================================================
   Render Complete View
   ========================================================================== */

function renderView(view) {
  const rows = state.rows.get(view) || [];

  /* ------------------------------------------------------------------------
     Desktop
     ------------------------------------------------------------------------ */

  renderDesktopView(view, rows);

  /* ------------------------------------------------------------------------
     Mobile
     ------------------------------------------------------------------------ */

  renderMobileView(view, rows);

  /* ------------------------------------------------------------------------
     Count
     ------------------------------------------------------------------------ */

  if (view !== TRADING_VIEWS.minimumSize) {
    setResultCount(view, rows.length);
  }

  /* ------------------------------------------------------------------------
     Visible Table Width
     ------------------------------------------------------------------------ */

  if (isViewVisible(view)) {
    requestAnimationFrame(() => {
      adjustTable(view);
    });
  }
}

/* ==========================================================================
   Filter Values
   ========================================================================== */

function getSelectValue(selector, fallback = "") {
  const element = query(selector);

  return element?.value || fallback;
}

function getInputValue(selector, fallback = "") {
  const element = query(selector);

  return element?.value || fallback;
}

/* ==========================================================================
   Negotiated Request
   ========================================================================== */

function getNegotiatedRequest() {
  return {
    type: getSelectValue(
      SELECTORS.negotiatedType,
      config.filters?.negotiatedDeals?.defaults?.type || "Negotiated-Deals",
    ),

    sector: getSelectValue(
      SELECTORS.negotiatedSector,
      config.filters?.negotiatedDeals?.defaults?.sector || "All",
    ),

    company: getSelectValue(
      SELECTORS.negotiatedCompany,
      config.filters?.negotiatedDeals?.defaults?.company || "All",
    ),

    fromDate: toRequestDate(getInputValue(SELECTORS.negotiatedFrom)),

    toDate: toRequestDate(getInputValue(SELECTORS.negotiatedTo)),

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Minimum Size Request
   ========================================================================== */

function getMinimumSizeRequest() {
  return {
    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Accumulated Request
   ========================================================================== */

function getAccumulatedRequest() {
  return {
    percentage: getSelectValue(
      SELECTORS.accumulatedReport,
      config.filters?.accumulated?.defaults?.report || "All",
    ),

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Company Status Request
   ========================================================================== */

function getCompanyStatusRequest() {
  return {
    renderType: "Search",

    formType: getSelectValue(
      SELECTORS.companyStatusType,
      config.filters?.deListedCompanies?.defaults?.type || "Suspension",
    ),

    fromDate: toRequestDate(getInputValue(SELECTORS.companyStatusFrom)),

    toDate: toRequestDate(getInputValue(SELECTORS.companyStatusTo)),

    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   OTC Request
   ========================================================================== */

function getOtcRequest() {
  return {
    requestLocale: config.locale || "en",
  };
}

/* ==========================================================================
   Endpoint Resolution
   ========================================================================== */

function getEndpoint(view) {
  switch (view) {
    case TRADING_VIEWS.negotiatedDeals:
      return config.endpoints?.negotiatedDeals;

    case TRADING_VIEWS.minimumSize:
      return config.endpoints?.minimumSize;

    case TRADING_VIEWS.accumulatedLosses:
      return config.endpoints?.accumulatedLosses;

    case TRADING_VIEWS.listedTradableRights:
      return config.endpoints?.listedTradableRights;

    case TRADING_VIEWS.suspendedCompanies:
    case TRADING_VIEWS.delistedCompanies:
      return config.endpoints?.suspendedDelisted;

    case TRADING_VIEWS.otcTrading:
      return config.endpoints?.otcTrading;

    default:
      return "";
  }
}

/* ==========================================================================
   Request Resolution
   ========================================================================== */

function getViewRequest(view) {
  switch (view) {
    case TRADING_VIEWS.negotiatedDeals:
      return getNegotiatedRequest();

    case TRADING_VIEWS.minimumSize:
      return getMinimumSizeRequest();

    case TRADING_VIEWS.accumulatedLosses:
      return getAccumulatedRequest();

    case TRADING_VIEWS.listedTradableRights:
      return {
        requestLocale: config.locale || "en",
      };

    case TRADING_VIEWS.suspendedCompanies:
    case TRADING_VIEWS.delistedCompanies:
      return getCompanyStatusRequest();

    case TRADING_VIEWS.otcTrading:
      return getOtcRequest();

    default:
      return {
        requestLocale: config.locale || "en",
      };
  }
}

/* ==========================================================================
   Generic View Loader
   ========================================================================== */

async function loadView(view, options = {}) {
  const { force = false } = options;

  /*
   * Avoid unnecessary duplicate requests.
   */
  if (state.loaded.has(view) && !force) {
    renderView(view);

    return state.rows.get(view) || [];
  }

  const endpoint = getEndpoint(view);

  if (!endpoint) {
    reportError(
      `missing endpoint for ${view}`,
      new Error("Endpoint not configured."),
    );

    storeRows(view, []);

    renderView(view);

    return [];
  }

  setLoading(view, true);

  try {
    const payload = await fetchJson(view, endpoint, getViewRequest(view));

    const rows = normalizeRows(payload);

    storeRows(view, rows);

    renderView(view);

    return rows;
  } catch (error) {
    /*
     * A newer request may intentionally abort the previous one.
     */
    if (error?.name === "AbortError") {
      return [];
    }

    reportError(`could not load ${view}`, error);

    storeRows(view, []);

    renderView(view);

    return [];
  } finally {
    setLoading(view, false);

    state.requests.delete(view);
  }
}

/* ==========================================================================
   Force Reload
   ========================================================================== */

function reloadView(view) {
  state.loaded.delete(view);

  return loadView(view, {
    force: true,
  });
}

/* ==========================================================================
   Load Current Tab
   ========================================================================== */

function loadCurrentTab(options = {}) {
  const view = getCurrentViewForTab(state.activeTab);

  if (!view) {
    return Promise.resolve([]);
  }

  return loadView(view, options);
}

/* ==========================================================================
   Variant Visibility
   ========================================================================== */

function setVariantVisibility(panelName, visibleVariant) {
  const panel = query(`[data-trading-panel="${panelName}"]`);

  if (!panel) {
    return;
  }

  queryAll("[data-trading-variant]", panel).forEach((element) => {
    element.hidden = element.dataset.tradingVariant !== visibleVariant;
  });
}

/* ==========================================================================
   Negotiated Variant Visibility
   ========================================================================== */

function syncNegotiatedVariant() {
  const type = getSelectValue(SELECTORS.negotiatedType, "Negotiated-Deals");

  state.negotiatedType = type;

  setVariantVisibility(
    "negotiatedDeals",
    type === "Minimum-Size" ? "Minimum-Size" : "Negotiated-Deals",
  );

  /*
   * Tables must be adjusted only after their variant becomes visible.
   */
  requestAnimationFrame(() => {
    adjustVisibleTables();
  });

  return getCurrentNegotiatedView();
}

/* ==========================================================================
   Company Status Variant Visibility
   ========================================================================== */

function syncCompanyStatusVariant() {
  const type = getSelectValue(SELECTORS.companyStatusType, "Suspension");

  state.companyStatusType = type;

  const suspended =
    getSuspendedDelistedView(type) === TRADING_VIEWS.suspendedCompanies;

  setVariantVisibility(
    "deListedCompanies",
    suspended ? "Suspension" : "Delisting",
  );

  requestAnimationFrame(() => {
    adjustVisibleTables();
  });

  return getCurrentCompanyStatusView();
}

/* ==========================================================================
   Minimum Size Search
   ========================================================================== */

function applyMinimumSizeSearch() {
  const input = query(SELECTORS.negotiatedSearch);

  state.minimumSizeSearch = input?.value || "";

  renderMinimumSize();
}

/* ==========================================================================
   Sector -> Company Dependency
   ========================================================================== */

function getSectorCompanyConfig() {
  return config.dependencies?.sectorCompany || {};
}

/* ==========================================================================
   Company Default Value
   ========================================================================== */

function getCompanyDefaultValue() {
  return (
    config.filters?.negotiatedDeals?.companyClearValue ||
    getSectorCompanyConfig().defaultValue ||
    "All"
  );
}

/* ==========================================================================
   Native Control Synchronization
   ========================================================================== */

/*
 * Trading updates native form controls programmatically during:
 *
 * - Reset
 * - Company clear
 * - Sector -> Company reload
 *
 * The design-system components enhance those native controls, so after
 * changing a value/options collection we dispatch native events plus the
 * existing component refresh hook.
 *
 * `state.suppressEvents` prevents those synchronization events from causing
 * duplicate API requests.
 */

state.suppressEvents = false;

function dispatchNativeControlUpdate(element, options = {}) {
  if (!element) {
    return;
  }

  const {
    input = false,

    change = true,

    optionsUpdated = false,
  } = options;

  if (input) {
    element.dispatchEvent(
      new Event("input", {
        bubbles: true,
      }),
    );
  }

  if (change) {
    element.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
  }

  if (optionsUpdated) {
    element.dispatchEvent(
      new CustomEvent("custom-select:options-updated", {
        bubbles: true,
      }),
    );
  }
}

/* ==========================================================================
   Safe Programmatic Update
   ========================================================================== */

function withSuppressedEvents(callback) {
  state.suppressEvents = true;

  try {
    callback();
  } finally {
    /*
     * Native change/input events are synchronous, but the enhanced component
     * may update its visible label in a microtask.
     */
    queueMicrotask(() => {
      state.suppressEvents = false;
    });
  }
}

/* ==========================================================================
   Set Select Value
   ========================================================================== */

function setSelectValue(element, value, options = {}) {
  if (!element) {
    return;
  }

  const normalized = value == null ? "" : String(value);

  element.value = normalized;

  dispatchNativeControlUpdate(element, {
    change: options.change !== false,

    optionsUpdated: Boolean(options.optionsUpdated),
  });
}

/* ==========================================================================
   Set Date Value
   ========================================================================== */

function setDateValue(element, value) {
  if (!element) {
    return;
  }

  element.value = value || "";

  dispatchNativeControlUpdate(element, {
    input: true,

    change: true,
  });
}

/* ==========================================================================
   Company Default Option
   ========================================================================== */

function getCompanyDefaultLabel(company) {
  if (!company) {
    return config.labels?.controls?.all || "All";
  }

  const defaultValue = getCompanyDefaultValue();

  const existing = [...company.options].find(
    (option) => option.value === defaultValue,
  );

  if (existing?.textContent) {
    return existing.textContent.trim();
  }

  return config.labels?.controls?.all || "All";
}

/* ==========================================================================
   Reset Company Options
   ========================================================================== */

function resetCompanyOptions(options = {}) {
  const company = query(SELECTORS.negotiatedCompany);

  if (!company) {
    return;
  }

  const defaultValue = getCompanyDefaultValue();

  const defaultLabel = getCompanyDefaultLabel(company);

  company.replaceChildren();

  const option = document.createElement("option");

  option.value = defaultValue;

  option.textContent = defaultLabel;

  option.selected = true;

  company.appendChild(option);

  company.value = defaultValue;

  dispatchNativeControlUpdate(company, {
    change: options.change !== false,

    optionsUpdated: true,
  });
}

/* ==========================================================================
   Company Response Normalization
   ========================================================================== */

function normalizeCompanies(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  return [];
}

/* ==========================================================================
   Load Companies for Sector
   ========================================================================== */

async function loadCompaniesForSector(options = {}) {
  const sector = query(SELECTORS.negotiatedSector);

  const company = query(SELECTORS.negotiatedCompany);

  const dependency = getSectorCompanyConfig();

  if (!sector || !company) {
    return;
  }

  const sectorValue =
    sector.value || config.filters?.negotiatedDeals?.defaults?.sector || "All";

  const defaultValue = getCompanyDefaultValue();

  /* ------------------------------------------------------------------------
     All Sectors
     ------------------------------------------------------------------------ */

  if (sectorValue === "All" || !dependency.endpoint) {
    withSuppressedEvents(() => {
      resetCompanyOptions({
        change: true,
      });
    });

    return;
  }

  /* ------------------------------------------------------------------------
     Loading
     ------------------------------------------------------------------------ */

  company.disabled = true;

  try {
    const requestKey = "sector-companies";

    const parameters = {};

    const sectorParameter = dependency.request?.sectorParameter || "sector";

    parameters[sectorParameter] = sectorValue;

    if (dependency.request?.format) {
      parameters.format = dependency.request.format;
    }

    const payload = await fetchJson(
      requestKey,
      dependency.endpoint,
      parameters,
    );

    const companies = normalizeCompanies(payload);

    const valueKey = dependency.response?.value || "symbol";

    const labelKey = dependency.response?.label || "longName";

    const defaultLabel = getCompanyDefaultLabel(company);

    company.replaceChildren();

    /* ----------------------------------------------------------------------
       All Companies
       ---------------------------------------------------------------------- */

    const defaultOption = document.createElement("option");

    defaultOption.value = defaultValue;

    defaultOption.textContent = defaultLabel;

    company.appendChild(defaultOption);

    /* ----------------------------------------------------------------------
       Companies
       ---------------------------------------------------------------------- */

    companies.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      const value = item[valueKey];

      if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
      ) {
        return;
      }

      const label = item[labelKey] ?? value;

      const option = document.createElement("option");

      option.value = String(value);

      option.textContent = String(label);

      company.appendChild(option);
    });

    company.value = defaultValue;

    withSuppressedEvents(() => {
      dispatchNativeControlUpdate(company, {
        change: true,

        optionsUpdated: true,
      });
    });
  } catch (error) {
    if (error?.name !== "AbortError") {
      reportError("could not load companies by sector", error);
    }

    withSuppressedEvents(() => {
      resetCompanyOptions({
        change: true,
      });
    });
  } finally {
    company.disabled = false;

    state.requests.delete("sector-companies");
  }

  if (
    options.reload !== false &&
    state.activeTab === TRADING_TABS.negotiatedDeals &&
    getCurrentNegotiatedView() === TRADING_VIEWS.negotiatedDeals
  ) {
    await reloadView(TRADING_VIEWS.negotiatedDeals);
  }
}

/* ==========================================================================
   Company Clear -> All
   ========================================================================== */

/*
 * The enhanced Company select is clearable.
 *
 * Empty is NOT a valid Trading business state.
 *
 * If the design-system clear action empties the native select, normalize it
 * immediately back to `All`.
 */

function normalizeCompanyClear() {
  const company = query(SELECTORS.negotiatedCompany);

  if (!company) {
    return false;
  }

  if (hasValue(company.value)) {
    return false;
  }

  withSuppressedEvents(() => {
    setSelectValue(company, getCompanyDefaultValue(), {
      change: true,
    });
  });

  return true;
}

/* ==========================================================================
   Default Date Range
   ========================================================================== */

function getConfiguredDefaultDateRange() {
  /*
   * Current TradingConfig uses lastMonthToToday.
   *
   * Keep this helper isolated so another date policy can be added later
   * without changing Reset/event code.
   */
  return getDefaultTradingDateRange();
}

/* ==========================================================================
   Initial Negotiated Values
   ========================================================================== */

function applyInitialNegotiatedValues() {
  const initial = config.initialState?.negotiatedDeals || {};

  const defaults = config.filters?.negotiatedDeals?.defaults || {};

  const range = getConfiguredDefaultDateRange();

  const type = query(SELECTORS.negotiatedType);

  const sector = query(SELECTORS.negotiatedSector);

  const company = query(SELECTORS.negotiatedCompany);

  const from = query(SELECTORS.negotiatedFrom);

  const to = query(SELECTORS.negotiatedTo);

  withSuppressedEvents(() => {
    if (type) {
      setSelectValue(type, initial.type || defaults.type || "Negotiated-Deals");
    }

    if (sector) {
      setSelectValue(sector, initial.sector || defaults.sector || "All");
    }

    if (company) {
      const requested =
        initial.company || defaults.company || getCompanyDefaultValue();

      /*
       * Only select the requested Company if it exists in current markup.
       */
      const exists = [...company.options].some(
        (option) => option.value === requested,
      );

      setSelectValue(company, exists ? requested : getCompanyDefaultValue());
    }

    if (from) {
      setDateValue(from, initial.fromDate || range.fromDate);
    }

    if (to) {
      setDateValue(to, initial.toDate || range.toDate);
    }
  });
}

/* ==========================================================================
   Initial Accumulated Values
   ========================================================================== */

function applyInitialAccumulatedValues() {
  const report = query(SELECTORS.accumulatedReport);

  if (!report) {
    return;
  }

  const value =
    config.initialState?.accumulated?.report ||
    config.filters?.accumulated?.defaults?.report ||
    "All";

  withSuppressedEvents(() => {
    setSelectValue(report, value);
  });
}

/* ==========================================================================
   Initial Company Status Values
   ========================================================================== */

function applyInitialCompanyStatusValues() {
  const initial = config.initialState?.deListedCompanies || {};

  const defaults = config.filters?.deListedCompanies?.defaults || {};

  const range = getConfiguredDefaultDateRange();

  const type = query(SELECTORS.companyStatusType);

  const from = query(SELECTORS.companyStatusFrom);

  const to = query(SELECTORS.companyStatusTo);

  withSuppressedEvents(() => {
    if (type) {
      setSelectValue(type, initial.type || defaults.type || "Suspension");
    }

    if (from) {
      setDateValue(from, initial.fromDate || range.fromDate);
    }

    if (to) {
      setDateValue(to, initial.toDate || range.toDate);
    }
  });
}

/* ==========================================================================
   Reset Negotiated
   ========================================================================== */

async function resetNegotiated() {
  const defaults = config.filters?.negotiatedDeals?.defaults || {};

  const range = getConfiguredDefaultDateRange();

  const type = query(SELECTORS.negotiatedType);

  const sector = query(SELECTORS.negotiatedSector);

  const company = query(SELECTORS.negotiatedCompany);

  const from = query(SELECTORS.negotiatedFrom);

  const to = query(SELECTORS.negotiatedTo);

  withSuppressedEvents(() => {
    setSelectValue(type, defaults.type || "Negotiated-Deals");

    setSelectValue(sector, defaults.sector || "All");

    resetCompanyOptions({
      change: true,
    });

    setDateValue(from, range.fromDate);

    setDateValue(to, range.toDate);
  });

  state.minimumSizeSearch = "";

  const search = query(SELECTORS.negotiatedSearch);

  if (search) {
    search.value = "";
  }

  state.negotiatedType = defaults.type || "Negotiated-Deals";

  syncNegotiatedVariant();

  /*
   * Reset means return to Negotiated Deals + All Sector + All Company +
   * default dates and reload exactly once.
   */
  await reloadView(TRADING_VIEWS.negotiatedDeals);
}

/* ==========================================================================
   Reset Accumulated
   ========================================================================== */

async function resetAccumulated() {
  const report = query(SELECTORS.accumulatedReport);

  const value = config.filters?.accumulated?.defaults?.report || "All";

  withSuppressedEvents(() => {
    setSelectValue(report, value);
  });

  await reloadView(TRADING_VIEWS.accumulatedLosses);
}

/* ==========================================================================
   Reset Company Status
   ========================================================================== */

async function resetCompanyStatus() {
  const defaults = config.filters?.deListedCompanies?.defaults || {};

  const range = getConfiguredDefaultDateRange();

  const type = query(SELECTORS.companyStatusType);

  const from = query(SELECTORS.companyStatusFrom);

  const to = query(SELECTORS.companyStatusTo);

  withSuppressedEvents(() => {
    setSelectValue(type, defaults.type || "Suspension");

    setDateValue(from, range.fromDate);

    setDateValue(to, range.toDate);
  });

  state.companyStatusType = defaults.type || "Suspension";

  syncCompanyStatusVariant();

  await reloadView(getCurrentCompanyStatusView());
}

/* ==========================================================================
   Reset Dispatcher
   ========================================================================== */

async function handleReset(key) {
  switch (key) {
    case TRADING_TABS.negotiatedDeals:
      await resetNegotiated();

      return;

    case TRADING_TABS.accumulated:
      await resetAccumulated();

      return;

    case TRADING_TABS.deListedCompanies:
      await resetCompanyStatus();

      return;

    default:
      return;
  }
}

/* ==========================================================================
   Active Tab
   ========================================================================== */

function setActiveTab(tab, options = {}) {
  if (!Object.values(TRADING_TABS).includes(tab)) {
    return;
  }

  state.activeTab = tab;

  /*
   * Design-system Tabs owns:
   *
   * - active class
   * - aria-selected
   * - tabindex
   * - panel hidden state
   *
   * Trading only synchronizes its data lifecycle.
   */

  if (options.load === false) {
    return;
  }

  queueMicrotask(async () => {
    const view = getCurrentViewForTab(state.activeTab);

    if (!view) {
      return;
    }

    await loadView(view);

    /*
     * Panel is now visible, so widths are safe to calculate.
     */
    requestAnimationFrame(() => {
      adjustVisibleTables();

      refreshDataViews?.(getViewElement(view) || document);
    });
  });
}

/* ==========================================================================
   Tab Events
   ========================================================================== */

function bindTabs(signal) {
  root.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      const tab = target.closest(SELECTORS.tab);

      if (!tab) {
        return;
      }

      const key = tab.dataset.tradingTab;

      if (!key) {
        return;
      }

      setActiveTab(key);
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Negotiated Type
   ========================================================================== */

function bindNegotiatedType(signal) {
  const type = query(SELECTORS.negotiatedType);

  type?.addEventListener(
    "change",
    async () => {
      if (state.suppressEvents) {
        return;
      }

      const view = syncNegotiatedVariant();

      if (state.activeTab !== TRADING_TABS.negotiatedDeals) {
        return;
      }

      /*
       * Minimum Size and Negotiated Deals have different endpoints.
       *
       * Load the selected variant only after it becomes visible.
       */
      await loadView(view);

      requestAnimationFrame(() => {
        adjustVisibleTables();
      });
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Negotiated Sector
   ========================================================================== */

function bindNegotiatedSector(signal) {
  const sector = query(SELECTORS.negotiatedSector);

  sector?.addEventListener(
    "change",
    async () => {
      if (state.suppressEvents) {
        return;
      }

      /*
       * Changing Sector always resets Company to All and rebuilds its options.
       *
       * loadCompaniesForSector() performs the final Negotiated reload once.
       */
      await loadCompaniesForSector({
        reload: true,
      });
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Negotiated Company
   ========================================================================== */

function bindNegotiatedCompany(signal) {
  const company = query(SELECTORS.negotiatedCompany);

  company?.addEventListener(
    "change",
    async () => {
      if (state.suppressEvents) {
        return;
      }

      /*
       * Clearable select may temporarily produce an empty native value.
       */
      normalizeCompanyClear();

      if (
        state.activeTab !== TRADING_TABS.negotiatedDeals ||
        getCurrentNegotiatedView() !== TRADING_VIEWS.negotiatedDeals
      ) {
        return;
      }

      await reloadView(TRADING_VIEWS.negotiatedDeals);
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Negotiated Dates
   ========================================================================== */

function bindNegotiatedDates(signal) {
  [query(SELECTORS.negotiatedFrom), query(SELECTORS.negotiatedTo)]
    .filter(Boolean)
    .forEach((input) => {
      input.addEventListener(
        "change",
        async () => {
          if (state.suppressEvents) {
            return;
          }

          if (
            state.activeTab !== TRADING_TABS.negotiatedDeals ||
            getCurrentNegotiatedView() !== TRADING_VIEWS.negotiatedDeals
          ) {
            return;
          }

          await reloadView(TRADING_VIEWS.negotiatedDeals);
        },
        {
          signal,
        },
      );
    });
}

/* ==========================================================================
   Minimum Size Search
   ========================================================================== */

function bindMinimumSizeSearch(signal) {
  const input = query(SELECTORS.negotiatedSearch);

  if (!input) {
    return;
  }

  input.addEventListener(
    "input",
    () => {
      state.minimumSizeSearch = input.value || "";

      if (getCurrentNegotiatedView() !== TRADING_VIEWS.minimumSize) {
        return;
      }

      renderMinimumSize();
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Accumulated
   ========================================================================== */

function bindAccumulated(signal) {
  const report = query(SELECTORS.accumulatedReport);

  report?.addEventListener(
    "change",
    async () => {
      if (state.suppressEvents) {
        return;
      }

      if (state.activeTab !== TRADING_TABS.accumulated) {
        return;
      }

      await reloadView(TRADING_VIEWS.accumulatedLosses);
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Company Status Type
   ========================================================================== */

function bindCompanyStatusType(signal) {
  const type = query(SELECTORS.companyStatusType);

  type?.addEventListener(
    "change",
    async () => {
      if (state.suppressEvents) {
        return;
      }

      const view = syncCompanyStatusVariant();

      if (state.activeTab !== TRADING_TABS.deListedCompanies) {
        return;
      }

      /*
       * Suspension and Delisting use the same endpoint with different
       * formType values, so changing variants must force a new request.
       */
      await reloadView(view);

      requestAnimationFrame(() => {
        adjustVisibleTables();
      });
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Company Status Dates
   ========================================================================== */

function bindCompanyStatusDates(signal) {
  [query(SELECTORS.companyStatusFrom), query(SELECTORS.companyStatusTo)]
    .filter(Boolean)
    .forEach((input) => {
      input.addEventListener(
        "change",
        async () => {
          if (state.suppressEvents) {
            return;
          }

          if (state.activeTab !== TRADING_TABS.deListedCompanies) {
            return;
          }

          await reloadView(getCurrentCompanyStatusView());
        },
        {
          signal,
        },
      );
    });
}

/* ==========================================================================
   Reset Events
   ========================================================================== */

function bindReset(signal) {
  root.addEventListener(
    "click",
    async (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      const button = target.closest(SELECTORS.reset);

      if (!button) {
        return;
      }

      /*
       * We own the complete reset so enhanced controls and business defaults
       * stay synchronized.
       */
      event.preventDefault();

      const key = button.dataset.tradingReset;

      await handleReset(key);
    },
    {
      signal,
    },
  );

  /*
   * Prevent browser form reset from independently changing native values
   * before our controlled reset logic runs.
   */
  [
    query(SELECTORS.negotiatedForm),

    query(SELECTORS.accumulatedForm),

    query(SELECTORS.companyStatusForm),
  ]
    .filter(Boolean)
    .forEach((form) => {
      form.addEventListener(
        "reset",
        (event) => {
          event.preventDefault();
        },
        {
          signal,
        },
      );
    });
}

/* ==========================================================================
   Resize
   ========================================================================== */

function bindResize(signal) {
  let frame = null;

  window.addEventListener(
    "resize",
    () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        frame = null;

        adjustVisibleTables();

        const view = getCurrentViewForTab(state.activeTab);

        if (view) {
          initDataViewCards?.(getCardsElement(view) || document);
        }
      });
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Bind Events
   ========================================================================== */

function bindEvents(signal) {
  bindTabs(signal);

  bindNegotiatedType(signal);

  bindNegotiatedSector(signal);

  bindNegotiatedCompany(signal);

  bindNegotiatedDates(signal);

  bindMinimumSizeSearch(signal);

  bindAccumulated(signal);

  bindCompanyStatusType(signal);

  bindCompanyStatusDates(signal);

  bindReset(signal);

  bindResize(signal);
}

/* ==========================================================================
   Initial State
   ========================================================================== */

function applyInitialState() {
  applyInitialNegotiatedValues();

  applyInitialAccumulatedValues();

  applyInitialCompanyStatusValues();

  syncNegotiatedVariant();

  syncCompanyStatusVariant();
}

/* ==========================================================================
   Initial Panel Resolution
   ========================================================================== */

function resolveInitialTab() {
  const configured =
    config.initialState?.activeTab || TRADING_TABS.negotiatedDeals;

  const valid = Object.values(TRADING_TABS).includes(configured);

  state.activeTab = valid ? configured : TRADING_TABS.negotiatedDeals;
}

/* ==========================================================================
   Initial Load
   ========================================================================== */

async function loadInitialView() {
  const view = getCurrentViewForTab(state.activeTab);

  if (!view) {
    return;
  }

  await loadView(view);

  requestAnimationFrame(() => {
    adjustVisibleTables();

    initDataViewCards?.(getCardsElement(view) || document);
  });
}

/* ==========================================================================
   Controller
   ========================================================================== */

let lifecycleController = null;

/* ==========================================================================
   Initialize
   ========================================================================== */

export async function initTrading() {
  if (!root || state.initialized) {
    return;
  }

  state.initialized = true;

  lifecycleController = new AbortController();

  resolveInitialTab();

  applyInitialState();

  bindEvents(lifecycleController.signal);

  await loadInitialView();
}

/* ==========================================================================
   Destroy
   ========================================================================== */

export function destroyTrading() {
  if (!state.initialized) {
    return;
  }

  lifecycleController?.abort();

  lifecycleController = null;

  state.requests.forEach((controller) => {
    controller.abort();
  });

  state.requests.clear();

  state.tables.forEach((_api, view) => {
    destroyTable(view);
  });

  state.tables.clear();

  state.rows.clear();

  state.loaded.clear();

  state.loading.clear();

  state.initialized = false;
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function reloadTrading() {
  if (!state.initialized) {
    return Promise.resolve([]);
  }

  const view = getCurrentViewForTab(state.activeTab);

  if (!view) {
    return Promise.resolve([]);
  }

  return reloadView(view);
}

export function getTradingState() {
  return {
    activeTab: state.activeTab,

    activeView: getCurrentViewForTab(state.activeTab),

    negotiatedType: state.negotiatedType,

    companyStatusType: state.companyStatusType,

    minimumSizeSearch: state.minimumSizeSearch,

    loadedViews: [...state.loaded],

    loadingViews: [...state.loading],
  };
}

/* ==========================================================================
   Startup
   ========================================================================== */

function startTrading() {
  initTrading().catch((error) => {
    reportError("initialization failed", error);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startTrading, {
    once: true,
  });
} else {
  startTrading();
}
