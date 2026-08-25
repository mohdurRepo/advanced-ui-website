/* ==========================================================================
   Trading
   ========================================================================== */

/*
 * Trading page controller.
 *
 * Responsibilities:
 *
 * - coordinate Trading tabs and variants
 * - coordinate Trading-specific filters
 * - load Trading endpoints
 * - lazily initialize active data views
 * - preserve JSP-owned complex headers
 * - render dedicated Minimum Size matrix/mobile output
 * - render Negotiated grouped mobile cards
 * - synchronize loading and result counts
 * - synchronize Sector -> Company dependency
 * - synchronize Reset / clear behavior
 *
 * Shared responsibilities remain in common/data-view:
 *
 * - state
 * - source lifecycle
 * - standard table lifecycle
 * - standard card rendering
 * - result-count behavior
 * - reusable controller behavior
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import {
  createDataCards,
  createDataResults,
  createDataSource,
  createDataState,
  createDataTable,
  createDataViewController,
  renderStandardDataCard,
} from "../common/data-view/index.js";

/* ==========================================================================
   Trading Schema
   ========================================================================== */

import {
  TRADING_TABS,
  TRADING_VIEWS,
  getColumnByKey,
  getColumns,
  getIdentityConfig,
  getMatrixConfig,
  getMobileConfig,
  getNegotiatedView,
  getSuspendedDelistedView,
  getTableConfig,
  getTableMode,
  getViewSchema,
  isComplexHeaderTable,
  isMatrixTable,
  isTradingTab,
  shouldPreserveHeader,
} from "./trading-schema.js";

/* ==========================================================================
   Trading Formatters
   ========================================================================== */

import {
  createMobileField,
  escapeHtml,
  filterMinimumSizeRows,
  getDefaultTradingDateRange,
  getNegotiatedDateGroup,
  getTradingCardContainerClass,
  getTradingIdentity,
  hasValue,
  isTotalRow,
  renderMinimumSizeDesktopRow,
  renderMinimumSizeMobileCards,
  renderMobileIdentity,
  renderMobileSummaryValue,
  renderNegotiatedDailyTotalCard,
  renderTradingCell,
  toRequestDate,
} from "./trading-formatters.js";

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = Object.freeze({
  /* ------------------------------------------------------------------------
     Page
     ------------------------------------------------------------------------ */

  root: "[data-trading]",

  /* ------------------------------------------------------------------------
     Tabs
     ------------------------------------------------------------------------ */

  tabs: "[data-trading-tabs]",

  tab: "[data-trading-tab]",

  panel: "[data-trading-panel]",

  /* ------------------------------------------------------------------------
     Generic Views
     ------------------------------------------------------------------------ */

  view: "[data-trading-view]",

  loading: "[data-trading-loading]",

  reset: "[data-trading-reset]",

  /* ------------------------------------------------------------------------
     Negotiated
     ------------------------------------------------------------------------ */

  negotiatedForm: "[data-trading-negotiated-filters]",

  negotiatedType: "[data-trading-negotiated-type]",

  negotiatedSector: "[data-trading-negotiated-sector]",

  negotiatedCompany: "[data-trading-negotiated-company]",

  negotiatedFromDate: "[data-trading-negotiated-from-date]",

  negotiatedToDate: "[data-trading-negotiated-to-date]",

  minimumSizeSearch: '[data-trading-table-search="minimumSize"]',

  /* ------------------------------------------------------------------------
     Accumulated
     ------------------------------------------------------------------------ */

  accumulatedForm: "[data-trading-accumulated-filters]",

  accumulatedReport: "[data-trading-accumulated-report]",

  /* ------------------------------------------------------------------------
     Suspended / Delisted
     ------------------------------------------------------------------------ */

  companyStatusForm: "[data-trading-delisted-filters]",

  companyStatusType: "[data-trading-delisted-type]",

  companyStatusFromDate: "[data-trading-delisted-from-date]",

  companyStatusToDate: "[data-trading-delisted-to-date]",
});

/* ==========================================================================
   Root
   ========================================================================== */

const root = document.querySelector(SELECTORS.root);

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getConfig() {
  const config = window.TradingConfig;

  if (!config || !isObject(config)) {
    throw new Error("TradingConfig is required.");
  }

  return config;
}

function query(selector, context = root) {
  return context?.querySelector?.(selector) || null;
}

function queryAll(selector, context = root) {
  return Array.from(context?.querySelectorAll?.(selector) || []);
}

/* ==========================================================================
   View DOM
   ========================================================================== */

function getViewRoot(view) {
  return query(`[data-trading-view="${view}"]`);
}

function getTableSelector(view) {
  return `[data-trading-table="${view}"]`;
}

function getCardsSelector(view) {
  return `[data-trading-cards="${view}"]`;
}

function getResultSelector(view) {
  return `[data-trading-result-count="${view}"]`;
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
  return isElementVisible(getViewRoot(view));
}

/* ==========================================================================
   State
   ========================================================================== */

function createTradingRuntime(config) {
  return {
    activeTab: config.initialState?.activeTab || TRADING_TABS.negotiatedDeals,

    negotiatedType:
      config.initialState?.negotiatedDeals?.type || "Negotiated-Deals",

    companyStatusType:
      config.initialState?.deListedCompanies?.type || "Suspension",

    minimumSizeSearch: "",

    suppressEvents: false,

    /*
     * Lazily created common Data View instances.
     */
    views: new Map(),

    /*
     * Dedicated matrix rows.
     */
    matrixRows: new Map(),

    /*
     * Active dependent-select request.
     */
    dependencyController: null,

    destroyed: false,
  };
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

  if (Array.isArray(value?.aaData)) {
    return value.aaData;
  }

  return [];
}

/* ==========================================================================
   Response Total
   ========================================================================== */

function getResponseTotal(response, rows) {
  const value = parseResponse(response);

  const candidates = [
    value?.total,
    value?.recordsTotal,
    value?.recordsFiltered,
    rows?.[0]?.count,
    rows.length,
  ];

  for (const candidate of candidates) {
    const number = Number(candidate);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return rows.length;
}

/* ==========================================================================
   Normalize Response
   ========================================================================== */

function normalizeResponse(response) {
  const rows = getResponseRows(response);

  return {
    rows,

    meta: {
      total: getResponseTotal(response, rows),
    },

    raw: parseResponse(response),
  };
}

/* ==========================================================================
   Loading
   ========================================================================== */

function setViewLoading(view, loading) {
  const loadingElement = getLoadingElement(view);

  const viewRoot = getViewRoot(view);

  if (loadingElement) {
    loadingElement.hidden = !loading;

    loadingElement.setAttribute("aria-hidden", String(!loading));
  }

  viewRoot?.classList.toggle("is-loading", loading);
}

/* ==========================================================================
   Filter Values
   ========================================================================== */

function getSelectValue(selector, fallback = "") {
  const element = query(selector);

  if (!element) {
    return fallback;
  }

  return hasValue(element.value) ? element.value : fallback;
}

function getInputValue(selector, fallback = "") {
  const element = query(selector);

  if (!element) {
    return fallback;
  }

  return hasValue(element.value) ? element.value : fallback;
}

/* ==========================================================================
   Negotiated Filters
   ========================================================================== */

function getNegotiatedFilters(config) {
  const defaults = config.filters?.negotiatedDeals?.defaults || {};

  return {
    type: getSelectValue(
      SELECTORS.negotiatedType,
      defaults.type || "Negotiated-Deals",
    ),

    sector: getSelectValue(
      SELECTORS.negotiatedSector,
      defaults.sector || "All",
    ),

    company: getSelectValue(
      SELECTORS.negotiatedCompany,
      defaults.company || "All",
    ),

    fromDate: getInputValue(SELECTORS.negotiatedFromDate),

    toDate: getInputValue(SELECTORS.negotiatedToDate),
  };
}

/* ==========================================================================
   Accumulated Filters
   ========================================================================== */

function getAccumulatedFilters(config) {
  const defaults = config.filters?.accumulated?.defaults || {};

  return {
    report: getSelectValue(
      SELECTORS.accumulatedReport,
      defaults.report || "All",
    ),
  };
}

/* ==========================================================================
   Company Status Filters
   ========================================================================== */

function getCompanyStatusFilters(config) {
  const defaults = config.filters?.deListedCompanies?.defaults || {};

  return {
    type: getSelectValue(
      SELECTORS.companyStatusType,
      defaults.type || "Suspension",
    ),

    fromDate: getInputValue(SELECTORS.companyStatusFromDate),

    toDate: getInputValue(SELECTORS.companyStatusToDate),
  };
}

/* ==========================================================================
   Endpoint Resolution
   ========================================================================== */

function getEndpoint(view, config) {
  switch (view) {
    case TRADING_VIEWS.negotiatedDeals:
      return config.endpoints?.negotiatedDeals || "";

    case TRADING_VIEWS.minimumSize:
      return config.endpoints?.minimumSize || "";

    case TRADING_VIEWS.accumulatedLosses:
      return config.endpoints?.accumulatedLosses || "";

    case TRADING_VIEWS.listedTradableRights:
      return config.endpoints?.listedTradableRights || "";

    case TRADING_VIEWS.suspendedCompanies:
    case TRADING_VIEWS.delistedCompanies:
      return config.endpoints?.suspendedDelisted || "";

    case TRADING_VIEWS.otcTrading:
      return config.endpoints?.otcTrading || "";

    default:
      return "";
  }
}

/* ==========================================================================
   Request Data
   ========================================================================== */

function buildRequestData(view, config) {
  const locale = config.locale || "en";

  switch (view) {
    /* ----------------------------------------------------------------------
       Negotiated Deals
       ---------------------------------------------------------------------- */

    case TRADING_VIEWS.negotiatedDeals: {
      const filters = getNegotiatedFilters(config);

      return {
        type: filters.type,

        sector: filters.sector,

        company: filters.company,

        fromDate: toRequestDate(filters.fromDate),

        toDate: toRequestDate(filters.toDate),

        requestLocale: locale,
      };
    }

    /* ----------------------------------------------------------------------
       Minimum Size
       ---------------------------------------------------------------------- */

    case TRADING_VIEWS.minimumSize:
      return {
        requestLocale: locale,
      };

    /* ----------------------------------------------------------------------
       Accumulated Losses
       ---------------------------------------------------------------------- */

    case TRADING_VIEWS.accumulatedLosses: {
      const filters = getAccumulatedFilters(config);

      return {
        percentage: filters.report,

        requestLocale: locale,
      };
    }

    /* ----------------------------------------------------------------------
       Listed Tradable Rights
       ---------------------------------------------------------------------- */

    case TRADING_VIEWS.listedTradableRights:
      return {
        requestLocale: locale,
      };

    /* ----------------------------------------------------------------------
       Suspended / Delisted
       ---------------------------------------------------------------------- */

    case TRADING_VIEWS.suspendedCompanies:
    case TRADING_VIEWS.delistedCompanies: {
      const filters = getCompanyStatusFilters(config);

      return {
        renderType: "Search",

        formType: filters.type,

        fromDate: toRequestDate(filters.fromDate),

        toDate: toRequestDate(filters.toDate),

        requestLocale: locale,
      };
    }

    /* ----------------------------------------------------------------------
       OTC
       ---------------------------------------------------------------------- */

    case TRADING_VIEWS.otcTrading:
      return {
        requestLocale: locale,
      };

    default:
      return {
        requestLocale: locale,
      };
  }
}

/* ==========================================================================
   Current View
   ========================================================================== */

function getCurrentNegotiatedView(runtime) {
  return getNegotiatedView(runtime.negotiatedType);
}

function getCurrentCompanyStatusView(runtime) {
  return getSuspendedDelistedView(runtime.companyStatusType);
}

function getCurrentView(runtime) {
  switch (runtime.activeTab) {
    case TRADING_TABS.negotiatedDeals:
      return getCurrentNegotiatedView(runtime);

    case TRADING_TABS.accumulated:
      return TRADING_VIEWS.accumulatedLosses;

    case TRADING_TABS.listedTradable:
      return TRADING_VIEWS.listedTradableRights;

    case TRADING_TABS.deListedCompanies:
      return getCurrentCompanyStatusView(runtime);

    case TRADING_TABS.otcTrading:
      return TRADING_VIEWS.otcTrading;

    default:
      return null;
  }
}

/* ==========================================================================
   Mobile Detail Fields
   ========================================================================== */

function getMobileDetailFields(view, row, config) {
  const mobile = getMobileConfig(view, config);

  return (mobile.details || [])
    .map((key) => getColumnByKey(view, key, config))
    .filter(Boolean)
    .map((column) => createMobileField(row, column, config));
}

/* ==========================================================================
   Standard Mobile Card
   ========================================================================== */

function renderStandardTradingCard(view, row, context, config) {
  const mobile = getMobileConfig(view, config);

  const identity = getTradingIdentity(row, view);

  const fields = getMobileDetailFields(view, row, config);

  const summary = `
    ${renderMobileIdentity(row, view)}

    ${renderMobileSummaryValue(row, view, config)}
  `;

  const rowId = identity.code || identity.name || context.index;

  return renderStandardDataCard({
    idPrefix: `trading-${view}-details`,

    rowId: `${rowId}-${context.index}`,

    className: "trading-data-card",

    summary,

    fields,

    expandable: mobile.expandable === false ? false : fields.length > 0,

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",
  });
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
         Total
         -------------------------------------------------------------------- */

    if (isTotalRow(row)) {
      if (hasValue(date) && groups.has(date)) {
        groups.get(date).total = row;

        return;
      }

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

  return Array.from(groups.values());
}

/* ==========================================================================
   Negotiated Group ID
   ========================================================================== */

function createNegotiatedGroupId(date, index) {
  const normalized = String(date || `group-${index}`)
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `trading-negotiated-${normalized || index}`;
}

/* ==========================================================================
   Negotiated Cards Adapter
   ========================================================================== */

function createNegotiatedCardsAdapter({ viewRoot, config }) {
  const container = viewRoot.querySelector(
    getCardsSelector(TRADING_VIEWS.negotiatedDeals),
  );

  let rows = [];

  function clear() {
    rows = [];

    if (container) {
      container.innerHTML = "";
    }
  }

  function render() {
    if (!container) {
      return;
    }

    container.classList.add(
      getTradingCardContainerClass(),
      "trading-negotiated-card-list",
    );

    const groups = groupNegotiatedRows(rows);

    if (groups.length === 0) {
      container.innerHTML = "";

      return;
    }

    let cardIndex = 0;

    container.innerHTML = groups
      .map((group, groupIndex) => {
        const titleId = createNegotiatedGroupId(group.date, groupIndex);

        const cards = group.rows
          .map((row) => {
            const markup = renderStandardTradingCard(
              TRADING_VIEWS.negotiatedDeals,
              row,
              {
                index: cardIndex,
              },
              config,
            );

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
                ${group.date ? `aria-labelledby="${escapeHtml(titleId)}"` : ""}
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
                  ${cards}

                  ${total}
                </div>
              </section>
            `.trim();
      })
      .join("");
  }

  return Object.freeze({
    setRows(nextRows) {
      rows = Array.isArray(nextRows) ? nextRows : [];

      render();
    },

    renderRows(nextRows) {
      rows = Array.isArray(nextRows) ? nextRows : [];

      render();
    },

    render(nextRows) {
      if (Array.isArray(nextRows)) {
        rows = nextRows;
      }

      render();
    },

    setLoading() {
      /*
       * JSP skeleton owns visible loading state.
       */
    },

    setEmpty() {
      clear();
    },

    setError() {
      clear();
    },

    clear,

    destroy() {
      clear();
    },
  });
}
/* ==========================================================================
   Minimum Size Adapter
   ========================================================================== */

/*
 * Minimum Size is deliberately NOT passed through createDataTable().
 *
 * Its JSP owns:
 *
 * - three matrix heading rows
 * - five visual positions
 *
 * The API owns only:
 *
 * - col1
 * - col2
 * - col3
 * - col4
 *
 * This adapter renders only <tbody> and mobile content.
 */

function createMinimumSizeAdapter({ viewRoot, config, runtime }) {
  const view = TRADING_VIEWS.minimumSize;

  const table = viewRoot.querySelector(getTableSelector(view));

  const cards = viewRoot.querySelector(getCardsSelector(view));

  const resultCount = viewRoot.querySelector(getResultSelector(view));

  const search = query(SELECTORS.minimumSizeSearch);

  let sourceRows = [];

  /* ========================================================================
     Rows
     ======================================================================== */

  function getVisibleRows() {
    return filterMinimumSizeRows(sourceRows, runtime.minimumSizeSearch);
  }

  /* ========================================================================
     Result Count
     ======================================================================== */

  function updateResultCount(count) {
    if (!resultCount) {
      return;
    }

    resultCount.textContent = String(count);
  }

  /* ========================================================================
     Desktop
     ======================================================================== */

  function renderTable() {
    if (!table) {
      return;
    }

    const tbody = table.tBodies?.[0];

    if (!tbody) {
      return;
    }

    const rows = getVisibleRows();

    updateResultCount(rows.length);

    if (rows.length === 0) {
      const matrix = getMatrixConfig(view, config);

      tbody.innerHTML = `
        <tr
          class="table-market__empty-row"
        >
          <td
            class="table-market__empty"
            colspan="${escapeHtml(matrix?.visualColumnCount || 5)}"
          >
            ${escapeHtml(config.labels?.noData || "No data available")}
          </td>
        </tr>
      `.trim();

      return;
    }

    /*
     * Critical:
     *
     * Never modify:
     *
     * table.tHead
     * table.innerHTML
     *
     * Only tbody is replaced.
     */
    tbody.innerHTML = rows
      .map((row) => renderMinimumSizeDesktopRow(row))
      .join("");
  }

  /* ========================================================================
     Mobile
     ======================================================================== */

  function renderCards() {
    if (!cards) {
      return;
    }

    cards.classList.add(
      getTradingCardContainerClass(),
      "trading-minimum-size-card-list",
    );

    const rows = getVisibleRows();

    if (rows.length === 0) {
      cards.innerHTML = "";

      return;
    }

    cards.innerHTML = renderMinimumSizeMobileCards(rows, config);
  }

  /* ========================================================================
     Render
     ======================================================================== */

  function render() {
    renderTable();

    renderCards();
  }

  /* ========================================================================
     Search
     ======================================================================== */

  function syncSearch() {
    runtime.minimumSizeSearch = search?.value || "";

    render();
  }

  /* ========================================================================
     Public API
     ======================================================================== */

  return Object.freeze({
    setRows(rows) {
      sourceRows = Array.isArray(rows) ? rows : [];

      runtime.matrixRows.set(view, sourceRows);

      render();
    },

    render,

    search: syncSearch,

    getRows() {
      return [...sourceRows];
    },

    getVisibleRows() {
      return [...getVisibleRows()];
    },

    clear() {
      sourceRows = [];

      runtime.matrixRows.set(view, []);

      render();
    },

    setLoading() {
      /*
       * JSP skeleton handles loading.
       */
    },

    setEmpty() {
      sourceRows = [];

      render();
    },

    setError() {
      sourceRows = [];

      render();
    },

    destroy() {
      sourceRows = [];

      runtime.matrixRows.delete(view);

      if (table?.tBodies?.[0]) {
        table.tBodies[0].replaceChildren();
      }

      if (cards) {
        cards.replaceChildren();
      }
    },
  });
}

/* ==========================================================================
   Standard Cards
   ========================================================================== */

function createStandardCards({ view, viewRoot, config }) {
  return createDataCards({
    root: viewRoot,

    container: getCardsSelector(view),

    initialView: view,

    renderCard(row, context) {
      return renderStandardTradingCard(view, row, context, config);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load trading data.",

    afterRender(container) {
      /*
       * Keep Trading-specific spacing outside common Data Card CSS.
       */
      container?.classList?.add(getTradingCardContainerClass());
    },
  });
}

/* ==========================================================================
   Cards Factory
   ========================================================================== */

function createTradingCards({ view, viewRoot, config, runtime }) {
  if (view === TRADING_VIEWS.minimumSize) {
    return createMinimumSizeAdapter({
      viewRoot,
      config,
      runtime,
    });
  }

  if (view === TRADING_VIEWS.negotiatedDeals) {
    return createNegotiatedCardsAdapter({
      viewRoot,
      config,
    });
  }

  return createStandardCards({
    view,
    viewRoot,
    config,
  });
}

/* ==========================================================================
   Table Header Ownership
   ========================================================================== */

/*
 * Every final Trading JSP now owns its <thead>.
 *
 * In particular:
 *
 * Minimum Size:
 *   3-row matrix header
 *
 * Listed Tradable:
 *   2-row grouped market header
 *
 * Suspended:
 *   2-row Period header
 *
 * createDataTable() must therefore be configured to bind to the existing
 * header rather than reconstructing it.
 */

function getTradingTableOptions(view, config) {
  const options = getTableConfig(view, config);

  return {
    ...options,

    /*
     * Explicitly keep automatic width calculations disabled.
     */
    autoWidth: false,

    /*
     * Complex views are stabilized before optional sorting is reintroduced.
     */
    ordering: Boolean(options.ordering),

    /*
     * FixedHeader stays disabled by TradingConfig during this pass.
     */
    fixedHeader: Boolean(options.fixedHeader),
  };
}

/* ==========================================================================
   Common Table
   ========================================================================== */

function createTradingTable({ view, viewRoot, config }) {
  /*
   * Matrix views have their own dedicated adapter.
   */
  if (isMatrixTable(view, config)) {
    return null;
  }

  const columns = getColumns(view, config);

  const preserveHeader = shouldPreserveHeader(view, config);

  return createDataTable({
    root: viewRoot,

    table: getTableSelector(view),

    initialView: view,

    /*
     * Schema provides body-column definitions only.
     *
     * JSP <thead> remains authoritative.
     */
    getColumns() {
      return columns;
    },

    renderCell(args) {
      return renderTradingCell({
        ...args,

        config,
      });
    },

    tableOptions: getTradingTableOptions(view, config),

    /*
     * This property is consumed by the common table adapter if supported.
     *
     * If the common layer does not currently inspect it, it remains harmless;
     * importantly, Trading itself never reconstructs the header.
     */
    preserveHeader,

    createdRow(rowElement, row) {
      if (isTotalRow(row)) {
        rowElement.classList.add("table-market__summary-row");
      }
    },
  });
}

/* ==========================================================================
   Results
   ========================================================================== */

function createTradingResults({ view, viewRoot, config }) {
  const count = viewRoot.querySelector(getResultSelector(view));

  if (!count) {
    return null;
  }

  /*
   * JSP owns:
   *
   * Results:
   *
   * createDataResults owns only the numeric element.
   */
  return createDataResults({
    root: viewRoot,

    count,

    labels: {
      results: "",

      empty: config.labels?.noData || "No data available",

      error: config.labels?.loadError || "Unable to load trading data.",
    },
  });
}

/* ==========================================================================
   Data Source
   ========================================================================== */

function createTradingSource({ view, config }) {
  const endpoint = getEndpoint(view, config);

  if (!endpoint) {
    throw new Error(`Trading endpoint missing for view: ${view}`);
  }

  return createDataSource({
    endpoint,

    buildRequestData() {
      return buildRequestData(view, config);
    },

    normalizeResponse,
  });
}

/* ==========================================================================
   State
   ========================================================================== */

function createTradingState() {
  return createDataState({
    loading: false,

    sourceRows: [],

    visibleRows: [],

    meta: {},

    error: null,
  });
}

/* ==========================================================================
   Loading Subscription
   ========================================================================== */

function subscribeToLoading({ view, state }) {
  if (!state || typeof state.subscribe !== "function") {
    return () => {};
  }

  let previousLoading = null;

  return state.subscribe((nextState) => {
    const loading = Boolean(nextState?.loading);

    if (loading === previousLoading) {
      return;
    }

    previousLoading = loading;

    setViewLoading(view, loading);
  });
}

/* ==========================================================================
   Table API
   ========================================================================== */

function getTableApi(table) {
  if (!table) {
    return null;
  }

  if (typeof table.getApi === "function") {
    return table.getApi();
  }

  return null;
}

/* ==========================================================================
   Adjust Table
   ========================================================================== */

function adjustTradingTable(view, table) {
  if (!table || !isViewVisible(view)) {
    return;
  }

  const api = getTableApi(table);

  if (!api) {
    return;
  }

  requestAnimationFrame(() => {
    try {
      api.columns?.adjust?.();

      api.responsive?.recalc?.();

      api.fixedHeader?.adjust?.();
    } catch (error) {
      console.warn(`Trading table adjustment failed for ${view}:`, error);
    }
  });
}

/* ==========================================================================
   Standard Trading View
   ========================================================================== */

function createStandardTradingView({ view, viewRoot, config, runtime }) {
  const state = createTradingState();

  const source = createTradingSource({
    view,
    config,
  });

  const table = createTradingTable({
    view,
    viewRoot,
    config,
  });

  const cards = createTradingCards({
    view,
    viewRoot,
    config,
    runtime,
  });

  const results = createTradingResults({
    view,
    viewRoot,
    config,
  });

  const unsubscribeLoading = subscribeToLoading({
    view,
    state,
  });

  const controller = createDataViewController({
    source,
    state,
    table,
    cards,
    results,

    getView() {
      return view;
    },

    getEmptyMessage() {
      return config.labels?.noData || "No data available";
    },

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        config.labels?.loadError ||
        "Unable to load trading data."
      );
    },

    /*
     * Critical:
     *
     * No Trading view performs an automatic request when its instance is
     * created. The active tab/variant explicitly controls loading.
     */
    autoLoad: false,
  });

  controller.init();

  return Object.freeze({
    view,

    reload() {
      setViewLoading(view, true);

      const result = controller.reload();

      /*
       * Controller implementations may return either a Promise or a direct
       * value. Normalize both.
       */
      return Promise.resolve(result)
        .then((value) => {
          adjustTradingTable(view, table);

          return value;
        })
        .finally(() => {
          setViewLoading(view, false);
        });
    },

    adjust() {
      adjustTradingTable(view, table);
    },

    destroy() {
      unsubscribeLoading?.();

      controller.destroy();
    },

    getRows() {
      if (typeof controller.getSourceRows === "function") {
        return controller.getSourceRows();
      }

      return [];
    },

    getVisibleRows() {
      if (typeof controller.getVisibleRows === "function") {
        return controller.getVisibleRows();
      }

      return [];
    },

    getTable() {
      return getTableApi(table);
    },
  });
}

/* ==========================================================================
   Minimum Size Source
   ========================================================================== */

/*
 * Minimum Size uses the common Data Source for network normalization but
 * deliberately avoids the common DataTable.
 */

function createMinimumSizeView({ viewRoot, config, runtime }) {
  const view = TRADING_VIEWS.minimumSize;

  const source = createTradingSource({
    view,
    config,
  });

  const cards = createMinimumSizeAdapter({
    viewRoot,
    config,
    runtime,
  });

  let sourceRows = [];

  let destroyed = false;

  /* ========================================================================
     Result Count
     ======================================================================== */

  const count = viewRoot.querySelector(getResultSelector(view));

  function updateCount() {
    if (!count) {
      return;
    }

    count.textContent = String(cards.getVisibleRows().length);
  }

  /* ========================================================================
     Render
     ======================================================================== */

  function render() {
    cards.setRows(sourceRows);

    updateCount();
  }

  /* ========================================================================
     Reload
     ======================================================================== */

  async function reload() {
    if (destroyed) {
      return [];
    }

    setViewLoading(view, true);

    try {
      /*
       * Reuse the common data source request contract.
       *
       * The exact source API differs slightly between common versions, so
       * resolve the supported public request method cleanly.
       */
      let response;

      if (typeof source.load === "function") {
        response = await source.load();
      } else if (typeof source.reload === "function") {
        response = await source.reload();
      } else if (typeof source.fetch === "function") {
        response = await source.fetch();
      } else {
        throw new Error("Minimum Size data source has no public load method.");
      }

      /*
       * createDataSource may already return normalized output.
       */
      const normalized =
        response && Array.isArray(response.rows)
          ? response
          : normalizeResponse(response);

      sourceRows = Array.isArray(normalized.rows) ? normalized.rows : [];

      runtime.matrixRows.set(view, sourceRows);

      render();

      return sourceRows;
    } catch (error) {
      console.error("Trading Minimum Size:", error);

      sourceRows = [];

      render();

      return [];
    } finally {
      setViewLoading(view, false);
    }
  }

  return Object.freeze({
    view,

    reload,

    adjust() {
      /*
       * No DataTables width recalculation is required.
       *
       * Matrix header/body share the same physical table.
       */
    },

    search() {
      runtime.minimumSizeSearch =
        query(SELECTORS.minimumSizeSearch)?.value || "";

      render();
    },

    getRows() {
      return [...sourceRows];
    },

    getVisibleRows() {
      return cards.getVisibleRows();
    },

    getTable() {
      return null;
    },

    destroy() {
      destroyed = true;

      cards.destroy();

      runtime.matrixRows.delete(view);

      if (typeof source.destroy === "function") {
        source.destroy();
      }
    },
  });
}

/* ==========================================================================
   View Factory
   ========================================================================== */

function createTradingView({ view, config, runtime }) {
  const viewRoot = getViewRoot(view);

  if (!viewRoot) {
    console.warn(`Trading view markup not found: ${view}`);

    return null;
  }

  if (isMatrixTable(view, config)) {
    return createMinimumSizeView({
      viewRoot,
      config,
      runtime,
    });
  }

  return createStandardTradingView({
    view,
    viewRoot,
    config,
    runtime,
  });
}

/* ==========================================================================
   Lazy View Access
   ========================================================================== */

function getOrCreateView(view, config, runtime) {
  const existing = runtime.views.get(view);

  if (existing) {
    return existing;
  }

  const instance = createTradingView({
    view,
    config,
    runtime,
  });

  if (!instance) {
    return null;
  }

  runtime.views.set(view, instance);

  return instance;
}

/* ==========================================================================
   Load View
   ========================================================================== */

function loadView(view, config, runtime) {
  const instance = getOrCreateView(view, config, runtime);

  if (!instance) {
    return Promise.resolve([]);
  }

  return Promise.resolve(instance.reload()).then((result) => {
    /*
     * Adjust only now, after:
     *
     * 1. active variant is visible
     * 2. data exists
     * 3. table has been drawn
     */
    instance.adjust?.();

    return result;
  });
}

/* ==========================================================================
   Adjust Current View
   ========================================================================== */

function adjustCurrentView(runtime) {
  const view = getCurrentView(runtime);

  if (!view) {
    return;
  }

  runtime.views.get(view)?.adjust?.();
}

/* ==========================================================================
   Destroy Views
   ========================================================================== */

function destroyViews(runtime) {
  runtime.views.forEach((instance) => {
    instance.destroy?.();
  });

  runtime.views.clear();

  runtime.matrixRows.clear();
}

/* ==========================================================================
   Variant Visibility
   ========================================================================== */

function setVariantVisibility(panelKey, variant) {
  const panel = query(`[data-trading-panel="${panelKey}"]`);

  if (!panel) {
    return;
  }

  queryAll("[data-trading-variant]", panel).forEach((element) => {
    element.hidden = element.dataset.tradingVariant !== variant;
  });
}

/* ==========================================================================
   Negotiated Variant
   ========================================================================== */

function syncNegotiatedVariant(runtime, config) {
  const filters = getNegotiatedFilters(config);

  runtime.negotiatedType = filters.type;

  const view = getNegotiatedView(filters.type);

  setVariantVisibility(
    TRADING_TABS.negotiatedDeals,
    view === TRADING_VIEWS.minimumSize ? "Minimum-Size" : "Negotiated-Deals",
  );

  requestAnimationFrame(() => {
    runtime.views.get(view)?.adjust?.();
  });

  return view;
}

/* ==========================================================================
   Company Status Variant
   ========================================================================== */

function syncCompanyStatusVariant(runtime, config) {
  const filters = getCompanyStatusFilters(config);

  runtime.companyStatusType = filters.type;

  const view = getSuspendedDelistedView(filters.type);

  setVariantVisibility(
    TRADING_TABS.deListedCompanies,
    view === TRADING_VIEWS.suspendedCompanies ? "Suspension" : "Delisting",
  );

  requestAnimationFrame(() => {
    runtime.views.get(view)?.adjust?.();
  });

  return view;
}
/* ==========================================================================
   Programmatic Control Synchronization
   ========================================================================== */

/*
 * Trading changes native controls during:
 *
 * - initialization
 * - Reset
 * - Sector -> Company refresh
 * - Company clear normalization
 *
 * The design-system controls enhance those native elements, so we dispatch
 * native events plus the existing options-refresh event after programmatic
 * updates.
 */

function withSuppressedEvents(runtime, callback) {
  runtime.suppressEvents = true;

  try {
    callback();
  } finally {
    queueMicrotask(() => {
      runtime.suppressEvents = false;
    });
  }
}

/* ==========================================================================
   Dispatch Control Update
   ========================================================================== */

function dispatchControlUpdate(element, options = {}) {
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
   Set Select
   ========================================================================== */

function setSelectValue(element, value, options = {}) {
  if (!element) {
    return;
  }

  const normalized = value == null ? "" : String(value);

  element.value = normalized;

  dispatchControlUpdate(element, {
    change: options.change !== false,

    optionsUpdated: Boolean(options.optionsUpdated),
  });
}

/* ==========================================================================
   Set Date
   ========================================================================== */

function setDateValue(element, value, options = {}) {
  if (!element) {
    return;
  }

  element.value = value || "";

  dispatchControlUpdate(element, {
    input: options.input !== false,

    change: options.change !== false,
  });
}

/* ==========================================================================
   Default Date Range
   ========================================================================== */

function getDefaultDateRange() {
  return getDefaultTradingDateRange();
}

/* ==========================================================================
   Company Dependency Configuration
   ========================================================================== */

function getSectorCompanyConfig(config) {
  return config.dependencies?.sectorCompany || {};
}

function getCompanyDefaultValue(config) {
  return (
    config.filters?.negotiatedDeals?.companyClearValue ||
    getSectorCompanyConfig(config).defaultValue ||
    "All"
  );
}

/* ==========================================================================
   Company Default Label
   ========================================================================== */

function getCompanyDefaultLabel(company, config) {
  if (!company) {
    return config.labels?.controls?.all || "All";
  }

  const defaultValue = getCompanyDefaultValue(config);

  const option = Array.from(company.options).find(
    (item) => item.value === defaultValue,
  );

  return option?.textContent?.trim() || config.labels?.controls?.all || "All";
}

/* ==========================================================================
   Reset Company Options
   ========================================================================== */

function resetCompanyOptions(runtime, config, options = {}) {
  const company = query(SELECTORS.negotiatedCompany);

  if (!company) {
    return;
  }

  const defaultValue = getCompanyDefaultValue(config);

  const defaultLabel = getCompanyDefaultLabel(company, config);

  company.replaceChildren();

  const option = document.createElement("option");

  option.value = defaultValue;

  option.textContent = defaultLabel;

  option.selected = true;

  company.appendChild(option);

  company.value = defaultValue;

  dispatchControlUpdate(company, {
    change: options.change !== false,

    optionsUpdated: true,
  });
}

/* ==========================================================================
   Company Response
   ========================================================================== */

function normalizeCompanyRows(payload) {
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
   Dependency Request
   ========================================================================== */

async function fetchCompaniesBySector(runtime, config, sectorValue) {
  const dependency = getSectorCompanyConfig(config);

  if (!dependency.endpoint) {
    return [];
  }

  runtime.dependencyController?.abort();

  const controller = new AbortController();

  runtime.dependencyController = controller;

  const url = new URL(dependency.endpoint, window.location.href);

  const sectorParameter = dependency.request?.sectorParameter || "sector";

  url.searchParams.set(sectorParameter, sectorValue);

  if (dependency.request?.format) {
    url.searchParams.set("format", dependency.request.format);
  }

  const response = await fetch(url.toString(), {
    method: "GET",

    credentials: "same-origin",

    headers: {
      Accept: "application/json",
    },

    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`Company request failed with status ${response.status}.`);
  }

  return normalizeCompanyRows(await response.json());
}

/* ==========================================================================
   Populate Companies
   ========================================================================== */

function populateCompanyOptions(runtime, config, companies) {
  const company = query(SELECTORS.negotiatedCompany);

  if (!company) {
    return;
  }

  const dependency = getSectorCompanyConfig(config);

  const defaultValue = getCompanyDefaultValue(config);

  const defaultLabel = getCompanyDefaultLabel(company, config);

  const valueKey = dependency.response?.value || "symbol";

  const labelKey = dependency.response?.label || "longName";

  company.replaceChildren();

  /* ------------------------------------------------------------------------
     All Companies
     ------------------------------------------------------------------------ */

  const defaultOption = document.createElement("option");

  defaultOption.value = defaultValue;

  defaultOption.textContent = defaultLabel;

  defaultOption.selected = true;

  company.appendChild(defaultOption);

  /* ------------------------------------------------------------------------
     Company Options
     ------------------------------------------------------------------------ */

  companies.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const rawValue = item[valueKey];

    if (
      rawValue === null ||
      rawValue === undefined ||
      String(rawValue).trim() === ""
    ) {
      return;
    }

    const rawLabel = item[labelKey] ?? rawValue;

    const option = document.createElement("option");

    option.value = String(rawValue);

    option.textContent = String(rawLabel);

    company.appendChild(option);
  });

  company.value = defaultValue;

  withSuppressedEvents(runtime, () => {
    dispatchControlUpdate(company, {
      change: true,

      optionsUpdated: true,
    });
  });
}

/* ==========================================================================
   Load Companies
   ========================================================================== */

async function loadCompaniesForSector(runtime, config, options = {}) {
  const { reload = true } = options;

  const sector = query(SELECTORS.negotiatedSector);

  const company = query(SELECTORS.negotiatedCompany);

  if (!sector || !company) {
    return;
  }

  const defaults = config.filters?.negotiatedDeals?.defaults || {};

  const sectorValue = sector.value || defaults.sector || "All";

  /* ========================================================================
     All Sector
     ======================================================================== */

  if (sectorValue === "All") {
    withSuppressedEvents(runtime, () => {
      resetCompanyOptions(runtime, config);
    });

    if (
      reload &&
      runtime.activeTab === TRADING_TABS.negotiatedDeals &&
      getCurrentNegotiatedView(runtime) === TRADING_VIEWS.negotiatedDeals
    ) {
      await loadView(TRADING_VIEWS.negotiatedDeals, config, runtime);
    }

    return;
  }

  /* ========================================================================
     Remote Dependency
     ======================================================================== */

  company.disabled = true;

  try {
    const companies = await fetchCompaniesBySector(
      runtime,
      config,
      sectorValue,
    );

    populateCompanyOptions(runtime, config, companies);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("Trading Sector -> Company:", error);

      withSuppressedEvents(runtime, () => {
        resetCompanyOptions(runtime, config);
      });
    }
  } finally {
    company.disabled = false;

    runtime.dependencyController = null;
  }

  /* ========================================================================
     Reload Negotiated Once
     ======================================================================== */

  if (
    reload &&
    runtime.activeTab === TRADING_TABS.negotiatedDeals &&
    getCurrentNegotiatedView(runtime) === TRADING_VIEWS.negotiatedDeals
  ) {
    await loadView(TRADING_VIEWS.negotiatedDeals, config, runtime);
  }
}

/* ==========================================================================
   Company Clear -> All
   ========================================================================== */

function normalizeCompanyClear(runtime, config) {
  const company = query(SELECTORS.negotiatedCompany);

  if (!company) {
    return false;
  }

  if (hasValue(company.value)) {
    return false;
  }

  withSuppressedEvents(runtime, () => {
    setSelectValue(company, getCompanyDefaultValue(config));
  });

  return true;
}

/* ==========================================================================
   Initial Negotiated State
   ========================================================================== */

function applyInitialNegotiatedState(runtime, config) {
  const initial = config.initialState?.negotiatedDeals || {};

  const defaults = config.filters?.negotiatedDeals?.defaults || {};

  const range = getDefaultDateRange();

  const type = query(SELECTORS.negotiatedType);

  const sector = query(SELECTORS.negotiatedSector);

  const company = query(SELECTORS.negotiatedCompany);

  const fromDate = query(SELECTORS.negotiatedFromDate);

  const toDate = query(SELECTORS.negotiatedToDate);

  withSuppressedEvents(runtime, () => {
    setSelectValue(type, initial.type || defaults.type || "Negotiated-Deals");

    setSelectValue(sector, initial.sector || defaults.sector || "All");

    if (company) {
      const requested =
        initial.company || defaults.company || getCompanyDefaultValue(config);

      const exists = Array.from(company.options).some(
        (option) => option.value === requested,
      );

      setSelectValue(
        company,
        exists ? requested : getCompanyDefaultValue(config),
      );
    }

    setDateValue(fromDate, initial.fromDate || range.fromDate);

    setDateValue(toDate, initial.toDate || range.toDate);
  });

  runtime.negotiatedType = getSelectValue(
    SELECTORS.negotiatedType,
    "Negotiated-Deals",
  );
}

/* ==========================================================================
   Initial Accumulated State
   ========================================================================== */

function applyInitialAccumulatedState(runtime, config) {
  const report = query(SELECTORS.accumulatedReport);

  if (!report) {
    return;
  }

  const initial = config.initialState?.accumulated?.report;

  const fallback = config.filters?.accumulated?.defaults?.report || "All";

  withSuppressedEvents(runtime, () => {
    setSelectValue(report, initial || fallback);
  });
}

/* ==========================================================================
   Initial Company Status State
   ========================================================================== */

function applyInitialCompanyStatusState(runtime, config) {
  const initial = config.initialState?.deListedCompanies || {};

  const defaults = config.filters?.deListedCompanies?.defaults || {};

  const range = getDefaultDateRange();

  const type = query(SELECTORS.companyStatusType);

  const fromDate = query(SELECTORS.companyStatusFromDate);

  const toDate = query(SELECTORS.companyStatusToDate);

  withSuppressedEvents(runtime, () => {
    setSelectValue(type, initial.type || defaults.type || "Suspension");

    setDateValue(fromDate, initial.fromDate || range.fromDate);

    setDateValue(toDate, initial.toDate || range.toDate);
  });

  runtime.companyStatusType = getSelectValue(
    SELECTORS.companyStatusType,
    "Suspension",
  );
}

/* ==========================================================================
   Reset Negotiated
   ========================================================================== */

async function resetNegotiated(runtime, config) {
  const defaults = config.filters?.negotiatedDeals?.defaults || {};

  const range = getDefaultDateRange();

  const type = query(SELECTORS.negotiatedType);

  const sector = query(SELECTORS.negotiatedSector);

  const fromDate = query(SELECTORS.negotiatedFromDate);

  const toDate = query(SELECTORS.negotiatedToDate);

  const search = query(SELECTORS.minimumSizeSearch);

  withSuppressedEvents(runtime, () => {
    setSelectValue(type, defaults.type || "Negotiated-Deals");

    setSelectValue(sector, defaults.sector || "All");

    resetCompanyOptions(runtime, config);

    setDateValue(fromDate, range.fromDate);

    setDateValue(toDate, range.toDate);
  });

  runtime.minimumSizeSearch = "";

  if (search) {
    search.value = "";
  }

  runtime.negotiatedType = defaults.type || "Negotiated-Deals";

  syncNegotiatedVariant(runtime, config);

  await loadView(TRADING_VIEWS.negotiatedDeals, config, runtime);
}

/* ==========================================================================
   Reset Accumulated
   ========================================================================== */

async function resetAccumulated(runtime, config) {
  const report = query(SELECTORS.accumulatedReport);

  const defaultValue = config.filters?.accumulated?.defaults?.report || "All";

  withSuppressedEvents(runtime, () => {
    setSelectValue(report, defaultValue);
  });

  await loadView(TRADING_VIEWS.accumulatedLosses, config, runtime);
}

/* ==========================================================================
   Reset Company Status
   ========================================================================== */

async function resetCompanyStatus(runtime, config) {
  const defaults = config.filters?.deListedCompanies?.defaults || {};

  const range = getDefaultDateRange();

  const type = query(SELECTORS.companyStatusType);

  const fromDate = query(SELECTORS.companyStatusFromDate);

  const toDate = query(SELECTORS.companyStatusToDate);

  withSuppressedEvents(runtime, () => {
    setSelectValue(type, defaults.type || "Suspension");

    setDateValue(fromDate, range.fromDate);

    setDateValue(toDate, range.toDate);
  });

  runtime.companyStatusType = defaults.type || "Suspension";

  const view = syncCompanyStatusVariant(runtime, config);

  await loadView(view, config, runtime);
}

/* ==========================================================================
   Reset Dispatcher
   ========================================================================== */

async function handleReset(key, runtime, config) {
  switch (key) {
    case TRADING_TABS.negotiatedDeals:
      await resetNegotiated(runtime, config);

      return;

    case TRADING_TABS.accumulated:
      await resetAccumulated(runtime, config);

      return;

    case TRADING_TABS.deListedCompanies:
      await resetCompanyStatus(runtime, config);

      return;

    default:
      return;
  }
}

/* ==========================================================================
   Tab State
   ========================================================================== */

async function activateTab(tab, runtime, config) {
  if (!isTradingTab(tab)) {
    return;
  }

  runtime.activeTab = tab;

  /*
   * Tabs visual state remains design-system owned.
   *
   * Trading waits until the tab panel has been made visible, then lazily
   * creates/loads its current dataset.
   */
  await new Promise((resolve) => {
    queueMicrotask(resolve);
  });

  const view = getCurrentView(runtime);

  if (!view) {
    return;
  }

  await loadView(view, config, runtime);

  requestAnimationFrame(() => {
    runtime.views.get(view)?.adjust?.();
  });
}

/* ==========================================================================
   Tab Events
   ========================================================================== */

function bindTabs(runtime, config, signal) {
  const tabs = query(SELECTORS.tabs);

  if (!tabs) {
    return;
  }

  tabs.addEventListener(
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

      if (!isTradingTab(key)) {
        return;
      }

      activateTab(key, runtime, config);
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Negotiated Type Event
   ========================================================================== */

function bindNegotiatedType(runtime, config, signal) {
  const type = query(SELECTORS.negotiatedType);

  type?.addEventListener(
    "change",
    async () => {
      if (runtime.suppressEvents) {
        return;
      }

      const view = syncNegotiatedVariant(runtime, config);

      if (runtime.activeTab !== TRADING_TABS.negotiatedDeals) {
        return;
      }

      await loadView(view, config, runtime);
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Negotiated Sector Event
   ========================================================================== */

function bindNegotiatedSector(runtime, config, signal) {
  const sector = query(SELECTORS.negotiatedSector);

  sector?.addEventListener(
    "change",
    async () => {
      if (runtime.suppressEvents) {
        return;
      }

      await loadCompaniesForSector(runtime, config, {
        reload: true,
      });
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Negotiated Company Event
   ========================================================================== */

function bindNegotiatedCompany(runtime, config, signal) {
  const company = query(SELECTORS.negotiatedCompany);

  company?.addEventListener(
    "change",
    async () => {
      if (runtime.suppressEvents) {
        return;
      }

      normalizeCompanyClear(runtime, config);

      if (
        runtime.activeTab !== TRADING_TABS.negotiatedDeals ||
        getCurrentNegotiatedView(runtime) !== TRADING_VIEWS.negotiatedDeals
      ) {
        return;
      }

      await loadView(TRADING_VIEWS.negotiatedDeals, config, runtime);
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Negotiated Date Events
   ========================================================================== */

function bindNegotiatedDates(runtime, config, signal) {
  [query(SELECTORS.negotiatedFromDate), query(SELECTORS.negotiatedToDate)]
    .filter(Boolean)
    .forEach((input) => {
      input.addEventListener(
        "change",
        async () => {
          if (runtime.suppressEvents) {
            return;
          }

          if (
            runtime.activeTab !== TRADING_TABS.negotiatedDeals ||
            getCurrentNegotiatedView(runtime) !== TRADING_VIEWS.negotiatedDeals
          ) {
            return;
          }

          await loadView(TRADING_VIEWS.negotiatedDeals, config, runtime);
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

function bindMinimumSizeSearch(runtime, signal) {
  const search = query(SELECTORS.minimumSizeSearch);

  if (!search) {
    return;
  }

  search.addEventListener(
    "input",
    () => {
      runtime.minimumSizeSearch = search.value || "";

      runtime.views.get(TRADING_VIEWS.minimumSize)?.search?.();
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Accumulated Event
   ========================================================================== */

function bindAccumulated(runtime, config, signal) {
  const report = query(SELECTORS.accumulatedReport);

  report?.addEventListener(
    "change",
    async () => {
      if (runtime.suppressEvents) {
        return;
      }

      if (runtime.activeTab !== TRADING_TABS.accumulated) {
        return;
      }

      await loadView(TRADING_VIEWS.accumulatedLosses, config, runtime);
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Company Status Type Event
   ========================================================================== */

function bindCompanyStatusType(runtime, config, signal) {
  const type = query(SELECTORS.companyStatusType);

  type?.addEventListener(
    "change",
    async () => {
      if (runtime.suppressEvents) {
        return;
      }

      const view = syncCompanyStatusVariant(runtime, config);

      if (runtime.activeTab !== TRADING_TABS.deListedCompanies) {
        return;
      }

      await loadView(view, config, runtime);
    },
    {
      signal,
    },
  );
}

/* ==========================================================================
   Company Status Date Events
   ========================================================================== */

function bindCompanyStatusDates(runtime, config, signal) {
  [query(SELECTORS.companyStatusFromDate), query(SELECTORS.companyStatusToDate)]
    .filter(Boolean)
    .forEach((input) => {
      input.addEventListener(
        "change",
        async () => {
          if (runtime.suppressEvents) {
            return;
          }

          if (runtime.activeTab !== TRADING_TABS.deListedCompanies) {
            return;
          }

          await loadView(getCurrentCompanyStatusView(runtime), config, runtime);
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

function bindResets(runtime, config, signal) {
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

      event.preventDefault();

      await handleReset(button.dataset.tradingReset, runtime, config);
    },
    {
      signal,
    },
  );

  /*
   * We own reset completely because browser-only reset would not reliably
   * synchronize the enhanced custom-select/custom-date presentation.
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

function bindResize(runtime, signal) {
  let frame = null;

  window.addEventListener(
    "resize",
    () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        frame = null;

        adjustCurrentView(runtime);
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

function bindEvents(runtime, config, signal) {
  bindTabs(runtime, config, signal);

  bindNegotiatedType(runtime, config, signal);

  bindNegotiatedSector(runtime, config, signal);

  bindNegotiatedCompany(runtime, config, signal);

  bindNegotiatedDates(runtime, config, signal);

  bindMinimumSizeSearch(runtime, signal);

  bindAccumulated(runtime, config, signal);

  bindCompanyStatusType(runtime, config, signal);

  bindCompanyStatusDates(runtime, config, signal);

  bindResets(runtime, config, signal);

  bindResize(runtime, signal);
}

/* ==========================================================================
   Initial State
   ========================================================================== */

function applyInitialState(runtime, config) {
  if (!isTradingTab(runtime.activeTab)) {
    runtime.activeTab = TRADING_TABS.negotiatedDeals;
  }

  applyInitialNegotiatedState(runtime, config);

  applyInitialAccumulatedState(runtime, config);

  applyInitialCompanyStatusState(runtime, config);

  syncNegotiatedVariant(runtime, config);

  syncCompanyStatusVariant(runtime, config);
}

/* ==========================================================================
   Trading Initialization
   ========================================================================== */

export function initTrading(targetRoot = root) {
  if (!targetRoot) {
    return null;
  }

  const existing = instances.get(targetRoot);

  if (existing) {
    return existing;
  }

  const config = getConfig();

  const runtime = createTradingRuntime(config);

  const abortController = new AbortController();

  applyInitialState(runtime, config);

  bindEvents(runtime, config, abortController.signal);

  /* ========================================================================
     Initial Load
     ======================================================================== */

  const initialView = getCurrentView(runtime);

  if (initialView) {
    /*
     * Only the current visible Trading view is constructed and loaded.
     */
    queueMicrotask(() => {
      loadView(initialView, config, runtime).catch((error) => {
        console.error("Trading initial load:", error);
      });
    });
  }

  /* ========================================================================
     Public API
     ======================================================================== */

  const instance = Object.freeze({
    reload() {
      const view = getCurrentView(runtime);

      if (!view) {
        return Promise.resolve([]);
      }

      return loadView(view, config, runtime);
    },

    setActiveTab(tab) {
      return activateTab(tab, runtime, config);
    },

    getActiveTab() {
      return runtime.activeTab;
    },

    getActiveView() {
      return getCurrentView(runtime);
    },

    getView(view) {
      return runtime.views.get(view) || null;
    },

    getFilters() {
      return {
        negotiatedDeals: getNegotiatedFilters(config),

        accumulated: getAccumulatedFilters(config),

        deListedCompanies: getCompanyStatusFilters(config),
      };
    },

    destroy() {
      if (runtime.destroyed) {
        return;
      }

      runtime.destroyed = true;

      abortController.abort();

      runtime.dependencyController?.abort();

      runtime.dependencyController = null;

      destroyViews(runtime);

      instances.delete(targetRoot);
    },
  });

  instances.set(targetRoot, instance);

  return instance;
}

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  if (!root) {
    return;
  }

  initTrading(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
