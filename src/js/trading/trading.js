/* ==========================================================================
   Trading
   ========================================================================== */

/*
 * Main Trading page composition module.
 *
 * Responsibilities:
 *
 * - coordinate Trading tabs
 * - coordinate tab-specific filters
 * - coordinate Negotiated / Minimum Size variants
 * - coordinate Suspension / Delisting variants
 * - load Sector -> Company options
 * - build backend requests
 * - initialize reusable Data View tables/results
 * - render standard mobile cards
 * - render Negotiated date-grouped mobile cards
 * - render Negotiated daily totals
 *
 * This module intentionally leaves:
 *
 * - reusable table behavior to common/data-view
 * - reusable standard card markup to common/data-view
 * - business-value formatting to trading-formatters.js
 * - schema definitions to trading-schema.js
 * - tab visual behavior to the design-system Tabs component
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
} from "../../common/data-view/index.js";

/* ==========================================================================
   Trading Schema
   ========================================================================== */

import {
  TRADING_TABS,
  TRADING_VIEWS,
  getColumns,
  getMobileColumns,
  getNegotiatedView,
  getSuspendedDelistedView,
  getTableConfig,
  isTradingTab,
} from "./trading-schema.js";

/* ==========================================================================
   Trading Formatters
   ========================================================================== */

import {
  escapeHtml,
  getDefaultTradingDateRange,
  getNegotiatedDateGroup,
  getTradingIdentity,
  isTotalRow,
  renderMobileIdentity,
  renderMobileSummaryValue,
  renderNegotiatedDailyTotalCard,
  renderNegotiatedDesktopTotalRow,
  renderTradingCell,
  toRequestDate,
} from "./trading-formatters.js";

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = {
  /* ------------------------------------------------------------------------
     Tabs
     ------------------------------------------------------------------------ */

  tabs: "[data-trading-tabs]",

  tab: "[data-trading-tab]",

  /* ------------------------------------------------------------------------
     Negotiated Deals
     ------------------------------------------------------------------------ */

  negotiatedType: "[data-trading-negotiated-type]",

  negotiatedSector: "[data-trading-negotiated-sector]",

  negotiatedCompany: "[data-trading-negotiated-company]",

  negotiatedFromDate: "[data-trading-negotiated-from-date]",

  negotiatedToDate: "[data-trading-negotiated-to-date]",

  /* ------------------------------------------------------------------------
     Accumulated Losses
     ------------------------------------------------------------------------ */

  accumulatedReport: "[data-trading-accumulated-report]",

  /* ------------------------------------------------------------------------
     Company Status
     ------------------------------------------------------------------------ */

  companyStatusType: "[data-trading-delisted-type]",

  companyStatusFromDate: "[data-trading-delisted-from-date]",

  companyStatusToDate: "[data-trading-delisted-to-date]",

  /* ------------------------------------------------------------------------
     Actions
     ------------------------------------------------------------------------ */

  reset: "[data-trading-reset]",
};

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Configuration
   ========================================================================== */

function getConfig() {
  const config = window.TradingConfig;

  if (!config) {
    throw new Error("TradingConfig is required.");
  }

  return config;
}

/* ==========================================================================
   DOM Helpers
   ========================================================================== */

function getElement(root, selector) {
  return root.querySelector(selector);
}

function getTradingViewRoot(root, view) {
  return root.querySelector(`[data-trading-view="${view}"]`);
}

function getTradingTableSelector(view) {
  return `[data-trading-table="${view}"]`;
}

function getTradingCardsSelector(view) {
  return `[data-trading-cards="${view}"]`;
}

function getTradingResultSelector(view) {
  return `[data-trading-result-count="${view}"]`;
}

/* ==========================================================================
   Design-system Card Enhancement
   ========================================================================== */

/*
 * Negotiated Deals renders grouped cards dynamically rather than using
 * createDataCards() for the outer collection.
 *
 * If the compiled design system exposes its card initializer, enhance the
 * newly inserted cards after their markup exists in the DOM.
 *
 * If no public initializer exists, this safely becomes a no-op.
 */

function enhanceDataViewCards(container) {
  if (!container) {
    return;
  }

  const initializer =
    window.initDataViewCards ??
    window.DataView?.initDataViewCards ??
    window.Theme?.dataView?.initDataViewCards;

  if (typeof initializer !== "function") {
    return;
  }

  initializer(container);
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
   Response Normalization
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
   Initial Date Range
   ========================================================================== */

function applyDefaultDateRange(root, fromSelector, toSelector) {
  const from = getElement(root, fromSelector);

  const to = getElement(root, toSelector);

  if (!from || !to) {
    return;
  }

  const range = getDefaultTradingDateRange();

  if (!from.value) {
    from.value = range.fromDate;
  }

  if (!to.value) {
    to.value = range.toDate;
  }
}

/* ==========================================================================
   Negotiated Filter State
   ========================================================================== */

function getNegotiatedFilters(root) {
  return {
    type:
      getElement(root, SELECTORS.negotiatedType)?.value || "Negotiated-Deals",

    sector: getElement(root, SELECTORS.negotiatedSector)?.value || "All",

    company: getElement(root, SELECTORS.negotiatedCompany)?.value || "All",

    fromDate: getElement(root, SELECTORS.negotiatedFromDate)?.value || "",

    toDate: getElement(root, SELECTORS.negotiatedToDate)?.value || "",
  };
}

/* ==========================================================================
   Accumulated Filter State
   ========================================================================== */

function getAccumulatedFilters(root) {
  return {
    report: getElement(root, SELECTORS.accumulatedReport)?.value || "All",
  };
}

/* ==========================================================================
   Company Status Filter State
   ========================================================================== */

function getCompanyStatusFilters(root) {
  return {
    type: getElement(root, SELECTORS.companyStatusType)?.value || "Suspension",

    fromDate: getElement(root, SELECTORS.companyStatusFromDate)?.value || "",

    toDate: getElement(root, SELECTORS.companyStatusToDate)?.value || "",
  };
}

/* ==========================================================================
   Endpoint Resolution
   ========================================================================== */

function getEndpoint(view, config) {
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
   Request Data
   ========================================================================== */

function buildRequestData(view, config, filters = {}) {
  const locale = config.locale || "en";

  switch (view) {
    /* ----------------------------------------------------------------------
       Negotiated Deals
       ---------------------------------------------------------------------- */

    case TRADING_VIEWS.negotiatedDeals:
      return {
        type: filters.type || "Negotiated-Deals",

        sector: filters.sector || "All",

        company: filters.company || "All",

        fromDate: toRequestDate(filters.fromDate),

        toDate: toRequestDate(filters.toDate),

        requestLocale: locale,
      };

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

    case TRADING_VIEWS.accumulatedLosses:
      return {
        percentage: filters.report || "All",

        requestLocale: locale,
      };

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
    case TRADING_VIEWS.delistedCompanies:
      return {
        renderType: "Search",

        fromDate: toRequestDate(filters.fromDate),

        toDate: toRequestDate(filters.toDate),

        formType: filters.type || "Suspension",

        requestLocale: locale,
      };

    /* ----------------------------------------------------------------------
       OTC Trading
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
   Negotiated Desktop Total Row
   ========================================================================== */

function decorateNegotiatedRow(rowElement, row, config) {
  if (!isTotalRow(row)) {
    return;
  }

  rowElement.classList.add("table-market__summary-row");

  const totalMarkup = renderNegotiatedDesktopTotalRow(row, config);

  /*
   * The formatter returns a complete <tr>.
   *
   * DataTables already owns the actual row element, so only copy the
   * rendered cells into that existing row.
   */

  const template = document.createElement("template");

  template.innerHTML = totalMarkup.trim();

  const renderedRow = template.content.querySelector("tr");

  if (!renderedRow) {
    return;
  }

  rowElement.replaceChildren(...Array.from(renderedRow.children));
}

/* ==========================================================================
   Generic Mobile Fields
   ========================================================================== */

function getMobileFields(row, view, config) {
  return getMobileColumns(view, config).map((column) => ({
    label: column.label || column.key,

    value: renderTradingCell({
      row,
      column,

      type: "display",

      config,
    }),

    numeric: Boolean(column.numeric),
  }));
}

/* ==========================================================================
   Standard Mobile Card
   ========================================================================== */

function renderStandardTradingCard(row, context, view, config) {
  const identity = getTradingIdentity(row, view);

  const fields = getMobileFields(row, view, config);

  const summary = `
    ${renderMobileIdentity(row, view)}

    ${renderMobileSummaryValue(row, view, config)}
  `;

  const rowId = identity.code || identity.name || context.index;

  /*
   * When no remaining detail fields exist, render a compact card without
   * an unnecessary expand/collapse control.
   */

  return renderStandardDataCard({
    idPrefix: `trading-${view}-details`,

    rowId: `${rowId}-${context.index}`,

    summary,

    fields,

    expandable: fields.length > 0,

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",
  });
}

/* ==========================================================================
   Minimum Size Mobile Card
   ========================================================================== */

function renderMinimumSizeCard(row, context, config) {
  const fields = getMobileColumns(TRADING_VIEWS.minimumSize, config).map(
    (column) => ({
      label: column.label || column.key,

      value: renderTradingCell({
        row,
        column,
        config,
      }),
    }),
  );

  return renderStandardDataCard({
    idPrefix: "trading-minimum-size",

    rowId: context.index,

    summary: "",

    fields,

    expandable: false,
  });
}

/* ==========================================================================
   Negotiated Regular Mobile Card
   ========================================================================== */

function renderNegotiatedCard(row, index, config) {
  const fields = getMobileColumns(TRADING_VIEWS.negotiatedDeals, config).map(
    (column) => ({
      label: column.label || column.key,

      value: renderTradingCell({
        row,
        column,
        config,
      }),

      numeric: Boolean(column.numeric),
    }),
  );

  const identity = getTradingIdentity(row, TRADING_VIEWS.negotiatedDeals);

  const summary = `
    ${renderMobileIdentity(row, TRADING_VIEWS.negotiatedDeals)}

    ${renderMobileSummaryValue(row, TRADING_VIEWS.negotiatedDeals, config)}
  `;

  return renderStandardDataCard({
    idPrefix: "trading-negotiated-details",

    rowId: `${identity.code || index}-${index}`,

    summary,

    fields,

    expandable: fields.length > 0,

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",
  });
}
/* ==========================================================================
   Negotiated Groups
   ========================================================================== */

function groupNegotiatedRows(rows) {
  const groups = new Map();

  let currentGroup = null;

  rows.forEach((row) => {
    const date = getNegotiatedDateGroup(row);

    /*
     * Daily totals may not repeat the trading date.
     *
     * If a total row has no date, attach it to the most recently
     * created date group.
     */
    if (isTotalRow(row)) {
      if (date && groups.has(date)) {
        groups.get(date).total = row;

        return;
      }

      if (currentGroup) {
        currentGroup.total = row;
      }

      return;
    }

    const groupKey = date || "";

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
  const safe = String(date || `group-${index}`)
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `negotiated-mobile-date-${safe || index}`;
}

/* ==========================================================================
   Negotiated Mobile Renderer
   ========================================================================== */

function renderNegotiatedCards(container, rows, config) {
  if (!container) {
    return;
  }

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
          const markup = renderNegotiatedCard(row, cardIndex, config);

          cardIndex += 1;

          return markup;
        })
        .join("");

      const total = group.total
        ? renderNegotiatedDailyTotalCard(group.total, config)
        : "";

      return `
            <section
              class="data-card-group"
              aria-labelledby="${escapeHtml(titleId)}"
            >
              <h3
                class="data-card-group__title"
                id="${escapeHtml(titleId)}"
              >
                ${escapeHtml(group.date)}
              </h3>

              <div
                class="data-card-group__items"
              >
                ${cards}

                ${total}
              </div>
            </section>
          `.trim();
    })
    .join("");

  /*
   * Enhance only after all grouped card markup exists in the DOM.
   */
  enhanceDataViewCards(container);
}

/* ==========================================================================
   Negotiated Cards Adapter
   ========================================================================== */

/*
 * Negotiated mobile presentation is intentionally more specialized than
 * the generic createDataCards() collection because it requires:
 *
 * - date grouping
 * - a heading per date
 * - standard Data Cards inside each group
 * - a compact Daily Total card at the end of each group
 */

function createNegotiatedCardsAdapter({ root, config }) {
  const container = root.querySelector(
    getTradingCardsSelector(TRADING_VIEWS.negotiatedDeals),
  );

  let rows = [];

  function render() {
    renderNegotiatedCards(container, rows, config);
  }

  function clear() {
    rows = [];

    if (container) {
      container.innerHTML = "";
    }
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

    clear,

    setLoading() {
      /*
       * Primary loading state is owned by the reusable data-view controller.
       *
       * Do not inject temporary grouped markup here.
       */
    },

    setEmpty() {
      clear();
    },

    setError() {
      clear();
    },

    destroy() {
      clear();
    },
  });
}

/* ==========================================================================
   Trading View
   ========================================================================== */

function createTradingView({ root, view, config, getFilters }) {
  const viewRoot = getTradingViewRoot(root, view);

  if (!viewRoot) {
    return null;
  }

  const endpoint = getEndpoint(view, config);

  if (!endpoint) {
    console.warn(`Trading endpoint missing for view: ${view}`);

    return null;
  }

  /* ========================================================================
     State
     ======================================================================== */

  const state = createDataState({
    loading: false,

    sourceRows: [],

    visibleRows: [],

    meta: {},

    error: null,
  });

  /* ========================================================================
     Source
     ======================================================================== */

  const source = createDataSource({
    endpoint,

    buildRequestData() {
      return buildRequestData(view, config, getFilters());
    },

    normalizeResponse,
  });

  /* ========================================================================
     Table
     ======================================================================== */

  const table = createDataTable({
    root: viewRoot,

    table: getTradingTableSelector(view),

    initialView: view,

    getColumns() {
      return getColumns(view, config);
    },

    renderCell(args) {
      return renderTradingCell({
        ...args,

        config,
      });
    },

    tableOptions: getTableConfig(view, config),

    createdRow(rowElement, row) {
      if (view === TRADING_VIEWS.negotiatedDeals) {
        decorateNegotiatedRow(rowElement, row, config);
      }
    },
  });

  /* ========================================================================
     Cards
     ======================================================================== */

  let cards;

  if (view === TRADING_VIEWS.negotiatedDeals) {
    cards = createNegotiatedCardsAdapter({
      root: viewRoot,

      config,
    });
  } else {
    cards = createDataCards({
      root: viewRoot,

      container: getTradingCardsSelector(view),

      initialView: view,

      renderCard(row, context) {
        if (view === TRADING_VIEWS.minimumSize) {
          return renderMinimumSizeCard(row, context, config);
        }

        return renderStandardTradingCard(row, context, view, config);
      },

      emptyMessage: config.labels?.noData || "No data available",

      errorMessage: config.labels?.loadError || "Unable to load trading data.",
    });
  }

  /* ========================================================================
     Results
     ======================================================================== */

  const resultCount = viewRoot.querySelector(getTradingResultSelector(view));

  const results = resultCount
    ? createDataResults({
        root: viewRoot,

        count: resultCount,

        labels: {
          results: config.labels?.results || "Results",

          empty: config.labels?.noData || "No data available",

          error: config.labels?.loadError || "Unable to load trading data.",
        },
      })
    : null;

  /* ========================================================================
     Controller
     ======================================================================== */

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
     * Trading loads only the currently active view.
     */
    autoLoad: false,
  });

  controller.init();

  return Object.freeze({
    view,

    reload() {
      return controller.reload();
    },

    destroy() {
      controller.destroy();
    },

    getRows() {
      return controller.getSourceRows();
    },

    getVisibleRows() {
      return controller.getVisibleRows();
    },

    getTable() {
      return table.getApi();
    },
  });
}

/* ==========================================================================
   Negotiated Variant
   ========================================================================== */

function syncNegotiatedVariant(root) {
  const filters = getNegotiatedFilters(root);

  const selectedView = getNegotiatedView(filters.type);

  const showMinimumSize = selectedView === TRADING_VIEWS.minimumSize;

  root
    .querySelectorAll(
      '[data-trading-panel="negotiatedDeals"] [data-trading-variant]',
    )
    .forEach((element) => {
      const variant = element.dataset.tradingVariant;

      const visible = showMinimumSize
        ? variant === "Minimum-Size"
        : variant === "Negotiated-Deals";

      element.hidden = !visible;
    });

  return selectedView;
}

/* ==========================================================================
   Company Status Variant
   ========================================================================== */

function syncCompanyStatusVariant(root) {
  const filters = getCompanyStatusFilters(root);

  const selectedView = getSuspendedDelistedView(filters.type);

  const suspension = selectedView === TRADING_VIEWS.suspendedCompanies;

  root
    .querySelectorAll(
      '[data-trading-panel="deListedCompanies"] [data-trading-variant]',
    )
    .forEach((element) => {
      const variant = element.dataset.tradingVariant;

      const visible = suspension
        ? variant === "Suspension"
        : variant === "Delisting";

      element.hidden = !visible;
    });

  return selectedView;
}

/* ==========================================================================
   Active View Resolution
   ========================================================================== */

function resolveActiveView(root, activeTab) {
  switch (activeTab) {
    case TRADING_TABS.negotiatedDeals:
      return syncNegotiatedVariant(root);

    case TRADING_TABS.accumulated:
      return TRADING_VIEWS.accumulatedLosses;

    case TRADING_TABS.listedTradable:
      return TRADING_VIEWS.listedTradableRights;

    case TRADING_TABS.deListedCompanies:
      return syncCompanyStatusVariant(root);

    case TRADING_TABS.otcTrading:
      return TRADING_VIEWS.otcTrading;

    default:
      return null;
  }
}

/* ==========================================================================
   Company Select Helpers
   ========================================================================== */

function getCompanyDefaultLabel(company) {
  return (
    company?.dataset?.defaultLabel ||
    company?.querySelector('option[value="All"]')?.textContent ||
    company?.options?.[0]?.textContent ||
    "All"
  ).trim();
}

function resetCompanyOptions(company, config) {
  if (!company) {
    return;
  }

  const defaultValue =
    config.dependencies?.sectorCompany?.defaultValue || "All";

  const label = getCompanyDefaultLabel(company);

  company.innerHTML = "";

  const option = document.createElement("option");

  option.value = defaultValue;

  option.textContent = label;

  company.appendChild(option);

  company.value = defaultValue;
}

/* ==========================================================================
   Sector -> Company
   ========================================================================== */

async function loadCompaniesBySector(root, config) {
  const sector = getElement(root, SELECTORS.negotiatedSector);

  const company = getElement(root, SELECTORS.negotiatedCompany);

  const dependency = config.dependencies?.sectorCompany;

  if (!sector || !company || !dependency?.endpoint) {
    return;
  }

  const sectorValue = sector.value || "All";

  const defaultValue = dependency.defaultValue || "All";

  /* ========================================================================
     All Sectors
     ======================================================================== */

  if (sectorValue === "All") {
    resetCompanyOptions(company, config);

    return;
  }

  /* ========================================================================
     Request
     ======================================================================== */

  company.disabled = true;

  try {
    const params = new URLSearchParams();

    params.set("format", dependency.request?.format || "json");

    params.set(dependency.request?.sectorParameter || "sector", sectorValue);

    const separator = dependency.endpoint.includes("?") ? "&" : "?";

    const response = await fetch(
      `${dependency.endpoint}${separator}${params.toString()}`,
      {
        method: "GET",

        credentials: "same-origin",

        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Company request failed with status ${response.status}.`);
    }

    const payload = await response.json();

    const companies = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    const defaultLabel = getCompanyDefaultLabel(company);

    company.innerHTML = "";

    const defaultOption = document.createElement("option");

    defaultOption.value = defaultValue;

    defaultOption.textContent = defaultLabel;

    company.appendChild(defaultOption);

    const valueKey = dependency.response?.value || "symbol";

    const labelKey = dependency.response?.label || "longName";

    companies.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      const value = item[valueKey];

      const label = item[labelKey];

      if (value === undefined || value === null) {
        return;
      }

      const option = document.createElement("option");

      option.value = String(value);

      option.textContent = String(label ?? value);

      company.appendChild(option);
    });

    company.value = defaultValue;
  } catch (error) {
    console.error("Trading Sector -> Company:", error);

    resetCompanyOptions(company, config);
  } finally {
    company.disabled = false;
  }
}
/* ==========================================================================
   Reset Negotiated Filters
   ========================================================================== */

function resetNegotiatedFilters(root, config) {
  const type = getElement(root, SELECTORS.negotiatedType);

  const sector = getElement(root, SELECTORS.negotiatedSector);

  const company = getElement(root, SELECTORS.negotiatedCompany);

  const fromDate = getElement(root, SELECTORS.negotiatedFromDate);

  const toDate = getElement(root, SELECTORS.negotiatedToDate);

  const range = getDefaultTradingDateRange();

  if (type) {
    type.value = "Negotiated-Deals";
  }

  if (sector) {
    sector.value = "All";
  }

  if (fromDate) {
    fromDate.value = range.fromDate;
  }

  if (toDate) {
    toDate.value = range.toDate;
  }

  resetCompanyOptions(company, config);
}

/* ==========================================================================
   Reset Accumulated Filters
   ========================================================================== */

function resetAccumulatedFilters(root) {
  const report = getElement(root, SELECTORS.accumulatedReport);

  if (report) {
    report.value = "All";
  }
}

/* ==========================================================================
   Reset Company Status Filters
   ========================================================================== */

function resetCompanyStatusFilters(root) {
  const type = getElement(root, SELECTORS.companyStatusType);

  const fromDate = getElement(root, SELECTORS.companyStatusFromDate);

  const toDate = getElement(root, SELECTORS.companyStatusToDate);

  const range = getDefaultTradingDateRange();

  if (type) {
    type.value = "Suspension";
  }

  if (fromDate) {
    fromDate.value = range.fromDate;
  }

  if (toDate) {
    toDate.value = range.toDate;
  }
}

/* ==========================================================================
   Custom Select Refresh
   ========================================================================== */

/*
 * The page updates the native Company <select> after a Sector change.
 *
 * The design system remains responsible for its own enhanced Custom Select
 * presentation. This event gives the compiled component a clean refresh hook
 * without importing design-system implementation files into the page module.
 */

function notifySelectUpdated(select) {
  if (!select) {
    return;
  }

  select.dispatchEvent(
    new CustomEvent("custom-select:options-updated", {
      bubbles: true,
    }),
  );
}

/* ==========================================================================
   Public Initialization
   ========================================================================== */

export function initTrading(root = document) {
  const existing = instances.get(root);

  if (existing) {
    return existing;
  }

  const config = getConfig();

  const tabs = getElement(root, SELECTORS.tabs);

  if (!tabs) {
    return null;
  }

  /* ========================================================================
     Default Date State
     ======================================================================== */

  applyDefaultDateRange(
    root,
    SELECTORS.negotiatedFromDate,
    SELECTORS.negotiatedToDate,
  );

  applyDefaultDateRange(
    root,
    SELECTORS.companyStatusFromDate,
    SELECTORS.companyStatusToDate,
  );

  /* ========================================================================
     Active Tab
     ======================================================================== */

  let activeTab =
    config.initialState?.activeTab || TRADING_TABS.negotiatedDeals;

  if (!isTradingTab(activeTab)) {
    activeTab = TRADING_TABS.negotiatedDeals;
  }

  /* ========================================================================
     View Registry
     ======================================================================== */

  const views = new Map();

  function registerView(view, getFilters) {
    const instance = createTradingView({
      root,
      view,
      config,
      getFilters,
    });

    if (instance) {
      views.set(view, instance);
    }
  }

  registerView(TRADING_VIEWS.negotiatedDeals, () => getNegotiatedFilters(root));

  registerView(TRADING_VIEWS.minimumSize, () => getNegotiatedFilters(root));

  registerView(TRADING_VIEWS.accumulatedLosses, () =>
    getAccumulatedFilters(root),
  );

  registerView(TRADING_VIEWS.listedTradableRights, () => ({}));

  registerView(TRADING_VIEWS.suspendedCompanies, () =>
    getCompanyStatusFilters(root),
  );

  registerView(TRADING_VIEWS.delistedCompanies, () =>
    getCompanyStatusFilters(root),
  );

  registerView(TRADING_VIEWS.otcTrading, () => ({}));

  /* ========================================================================
     Active View
     ======================================================================== */

  function getActiveView() {
    return resolveActiveView(root, activeTab);
  }

  /* ========================================================================
     Reload
     ======================================================================== */

  function reloadActiveView() {
    const view = getActiveView();

    if (!view) {
      return Promise.resolve();
    }

    const instance = views.get(view);

    if (!instance) {
      return Promise.resolve();
    }

    return instance.reload();
  }

  /* ========================================================================
     Tab State
     ======================================================================== */

  function setActiveTab(tab, options = {}) {
    if (!isTradingTab(tab)) {
      return;
    }

    activeTab = tab;

    /*
     * Visual tab state is owned entirely by the design-system Tabs component.
     *
     * Do not manually mutate:
     *
     * - .active
     * - aria-selected
     * - tabindex
     * - panel hidden state
     *
     * Trading only synchronizes the data layer with the selected tab.
     */

    resolveActiveView(root, activeTab);

    if (options.reload !== false) {
      reloadActiveView();
    }
  }

  /* ========================================================================
     Event Lifecycle
     ======================================================================== */

  const abortController = new AbortController();

  const eventOptions = {
    signal: abortController.signal,
  };

  /* ------------------------------------------------------------------------
     Tabs
     ------------------------------------------------------------------------ */

  tabs.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const tab = event.target.closest(SELECTORS.tab);

      if (!tab) {
        return;
      }

      const tabKey = tab.dataset.tradingTab;

      if (!isTradingTab(tabKey)) {
        return;
      }

      /*
       * Let the design-system Tabs component complete its visual state update
       * before Trading loads the newly active dataset.
       */
      queueMicrotask(() => {
        setActiveTab(tabKey);
      });
    },
    eventOptions,
  );

  /* ------------------------------------------------------------------------
     Negotiated Type
     ------------------------------------------------------------------------ */

  getElement(root, SELECTORS.negotiatedType)?.addEventListener(
    "change",
    () => {
      syncNegotiatedVariant(root);

      if (activeTab === TRADING_TABS.negotiatedDeals) {
        reloadActiveView();
      }
    },
    eventOptions,
  );

  /* ------------------------------------------------------------------------
     Negotiated Sector
     ------------------------------------------------------------------------ */

  getElement(root, SELECTORS.negotiatedSector)?.addEventListener(
    "change",
    async () => {
      await loadCompaniesBySector(root, config);

      const company = getElement(root, SELECTORS.negotiatedCompany);

      notifySelectUpdated(company);

      if (activeTab === TRADING_TABS.negotiatedDeals) {
        reloadActiveView();
      }
    },
    eventOptions,
  );

  /* ------------------------------------------------------------------------
     Negotiated Company
     ------------------------------------------------------------------------ */

  getElement(root, SELECTORS.negotiatedCompany)?.addEventListener(
    "change",
    () => {
      if (activeTab === TRADING_TABS.negotiatedDeals) {
        reloadActiveView();
      }
    },
    eventOptions,
  );

  /* ------------------------------------------------------------------------
     Negotiated Dates
     ------------------------------------------------------------------------ */

  [SELECTORS.negotiatedFromDate, SELECTORS.negotiatedToDate].forEach(
    (selector) => {
      getElement(root, selector)?.addEventListener(
        "change",
        () => {
          if (activeTab === TRADING_TABS.negotiatedDeals) {
            reloadActiveView();
          }
        },
        eventOptions,
      );
    },
  );

  /* ------------------------------------------------------------------------
     Accumulated Losses
     ------------------------------------------------------------------------ */

  getElement(root, SELECTORS.accumulatedReport)?.addEventListener(
    "change",
    () => {
      if (activeTab === TRADING_TABS.accumulated) {
        reloadActiveView();
      }
    },
    eventOptions,
  );

  /* ------------------------------------------------------------------------
     Company Status Type
     ------------------------------------------------------------------------ */

  getElement(root, SELECTORS.companyStatusType)?.addEventListener(
    "change",
    () => {
      syncCompanyStatusVariant(root);

      if (activeTab === TRADING_TABS.deListedCompanies) {
        reloadActiveView();
      }
    },
    eventOptions,
  );

  /* ------------------------------------------------------------------------
     Company Status Dates
     ------------------------------------------------------------------------ */

  [SELECTORS.companyStatusFromDate, SELECTORS.companyStatusToDate].forEach(
    (selector) => {
      getElement(root, selector)?.addEventListener(
        "change",
        () => {
          if (activeTab === TRADING_TABS.deListedCompanies) {
            reloadActiveView();
          }
        },
        eventOptions,
      );
    },
  );

  /* ------------------------------------------------------------------------
     Reset
     ------------------------------------------------------------------------ */

  root.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const button = event.target.closest(SELECTORS.reset);

      if (!button) {
        return;
      }

      event.preventDefault();

      const target = button.dataset.tradingReset;

      switch (target) {
        case TRADING_TABS.negotiatedDeals: {
          resetNegotiatedFilters(root, config);

          const company = getElement(root, SELECTORS.negotiatedCompany);

          notifySelectUpdated(company);

          syncNegotiatedVariant(root);

          break;
        }

        case TRADING_TABS.accumulated:
          resetAccumulatedFilters(root);

          break;

        case TRADING_TABS.deListedCompanies:
          resetCompanyStatusFilters(root);

          syncCompanyStatusVariant(root);

          break;
      }

      if (target === activeTab) {
        reloadActiveView();
      }
    },
    eventOptions,
  );

  /* ========================================================================
     Initial Variant State
     ======================================================================== */

  syncNegotiatedVariant(root);

  syncCompanyStatusVariant(root);

  /* ========================================================================
     Initial Load
     ======================================================================== */

  reloadActiveView();

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    destroy() {
      abortController.abort();

      views.forEach((view) => {
        view.destroy();
      });

      views.clear();

      instances.delete(root);
    },

    reload() {
      return reloadActiveView();
    },

    setActiveTab(tab) {
      setActiveTab(tab);
    },

    getActiveTab() {
      return activeTab;
    },

    getActiveView() {
      return getActiveView();
    },

    getView(view) {
      return views.get(view) || null;
    },

    getFilters() {
      return {
        negotiatedDeals: getNegotiatedFilters(root),

        accumulated: getAccumulatedFilters(root),

        deListedCompanies: getCompanyStatusFilters(root),
      };
    },
  });

  instances.set(root, instance);

  return instance;
}

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  initTrading(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
