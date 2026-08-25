/* ==========================================================================
   Negotiated Deals View
   ========================================================================== */

/*
 * Negotiated Deals page-view definition.
 *
 * Responsibilities:
 *
 * - define Negotiated table columns
 * - build Negotiated request payload
 * - normalize Negotiated response rows/meta
 * - create standard DataTable lifecycle
 * - create grouped mobile cards
 * - render daily total cards
 * - synchronize result counts
 *
 * Shared responsibilities remain in common/data-view:
 *
 * - request cancellation
 * - observable state
 * - loading / empty / error lifecycle
 * - DataTables lifecycle
 * - result-count behavior
 * - standard Data Card markup
 * - DataViewCard expand/collapse behavior
 */

import {
  createDataResults,
  createDataSource,
  createDataState,
  createDataTable,
  createDataViewController,
  renderStandardDataCard,
} from "../common/data-view/index.js";

import {
  TRADING_VIEWS,
  getCardsSelector,
  getResultCountSelector,
  getTableSelector,
} from "../constants.js";

import {
  escapeHtml,
  formatMoney,
  formatQuantity,
  formatTradingDate,
  getDisplayValue,
  isTotalRow,
  renderNegotiatedCompany,
  renderTradingCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.negotiatedDeals;

/* ==========================================================================
   Columns
   ========================================================================== */

function getColumns(config) {
  const labels = config.labels?.negotiatedDeals || {};

  return [
    {
      key: "date",

      data: "tradeDate",

      fallbackData: ["date", "trade_date"],

      label: labels.date || "Date",

      type: "negotiated-date",

      className: "table-market__date",

      width: "8rem",
    },

    {
      key: "company",

      data: "company",

      fallbackData: ["companyName", "name"],

      label: labels.company || "Company",

      type: "negotiated-company",

      className: "table-market__security",

      width: "15rem",
    },

    {
      key: "trade-price",

      data: "tradePrice",

      fallbackData: ["price", "trade_price"],

      label: labels.price || "Price",

      type: "money",

      numeric: true,

      className: "table-market__number",

      width: "8rem",
    },

    {
      key: "trade-volume",

      data: "tradeVolume",

      fallbackData: ["volume", "trade_volume"],

      label: labels.volume || "Volume",

      type: "quantity",

      numeric: true,

      className: "table-market__number",

      width: "9rem",
    },

    {
      key: "turnover",

      data: "turnOver",

      fallbackData: ["turnover", "tradeValue", "value"],

      label: labels.value || "Value",

      type: "money",

      numeric: true,

      className: "table-market__number",

      width: "10rem",
    },

    {
      key: "time",

      data: "tradeTime",

      fallbackData: ["time", "trade_time"],

      label: labels.time || "Time",

      type: "time",

      numeric: true,

      className: "table-market__number",

      width: "7rem",
    },
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

function buildRequestData(filters, config) {
  const state = filters.getNegotiatedRequestState();

  return {
    type: state.type,

    sector: state.sector,

    company: state.company,

    fromDate: state.fromDate,

    toDate: state.toDate,

    locale: config.locale,
  };
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

function normalizeCount(response, rows) {
  const candidates = [
    response?.total,
    response?.count,
    response?.recordsFiltered,
    response?.recordsTotal,

    rows?.[0]?.count,
  ];

  for (const candidate of candidates) {
    const count = Number(candidate);

    if (Number.isFinite(count) && count >= 0) {
      return Math.floor(count);
    }
  }

  /*
   * Daily total rows are presentation rows and should not count as securities.
   */
  return rows.filter((row) => !isTotalRow(row)).length;
}

function normalizeResponse(response) {
  const rows = getRows(response);

  return {
    rows,

    meta: {
      total: normalizeCount(response, rows),

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
   Negotiated Date Groups
   ========================================================================== */

function getRowDate(row) {
  return row?.tradeDate ?? row?.date ?? row?.trade_date ?? "";
}

function getDateGroupKey(row) {
  const value = getRowDate(row);

  return value ? String(value).trim() : "unknown";
}

function groupRowsByDate(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    /*
     * Total rows are attached to the date group they belong to.
     */
    const key = getDateGroupKey(row);

    if (!groups.has(key)) {
      groups.set(key, {
        key,

        label: formatTradingDate(getRowDate(row)),

        rows: [],

        totalRow: null,
      });
    }

    const group = groups.get(key);

    if (isTotalRow(row)) {
      group.totalRow = row;

      return;
    }

    group.rows.push(row);
  });

  return Array.from(groups.values());
}

/* ==========================================================================
   Mobile Summary
   ========================================================================== */

function renderMobileSummary(row, config) {
  const price = formatMoney(row?.tradePrice ?? row?.price, config);

  const company = getDisplayValue(row?.company ?? row?.companyName, "");

  const symbol = getDisplayValue(row?.symbol, "");

  const companyUrl = row?.companyURL ?? row?.companyUrl ?? row?.pageUrl ?? "";

  return `
    <div class="data-card__identity">
      <div class="data-card__identity-content">

        <div class="data-card__identity-name">
          ${
            companyUrl
              ? `
                <a
                  class="data-card__identity-link"
                  href="${escapeHtml(companyUrl)}"
                >
                  ${escapeHtml(company)}
                </a>
              `
              : escapeHtml(company)
          }
        </div>

        ${
          symbol
            ? `
              <div class="data-card__identity-meta">
                ${escapeHtml(symbol)}
              </div>
            `
            : ""
        }

      </div>
    </div>

    <div class="data-card__summary-value">
      ${escapeHtml(price)}
    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Fields
   ========================================================================== */

function createMobileFields(row, config) {
  const labels = config.labels?.negotiatedDeals || {};

  return [
    {
      label: labels.volume || "Volume",

      value: escapeHtml(
        formatQuantity(row?.tradeVolume ?? row?.volume, config),
      ),

      numeric: true,
    },

    {
      label: labels.value || "Value",

      value: escapeHtml(
        formatMoney(row?.turnOver ?? row?.turnover ?? row?.tradeValue, config),
      ),

      numeric: true,
    },

    {
      label: labels.time || "Time",

      value: escapeHtml(getDisplayValue(row?.tradeTime ?? row?.time, "-")),

      numeric: true,
    },
  ];
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderNegotiatedCard({ row, index, config }) {
  return renderStandardDataCard({
    rowId: row?.id ?? row?.transactionId ?? row?.symbol ?? index,

    idPrefix: "negotiated-card-details",

    summary: renderMobileSummary(row, config),

    fields: createMobileFields(row, config),

    moreLabel: config.labels?.mobile?.showDetails || "Show details",

    lessLabel: config.labels?.mobile?.hideDetails || "Hide details",

    className: "trading-card trading-card--negotiated",
  });
}

/* ==========================================================================
   Daily Total Card
   ========================================================================== */

function renderDailyTotalCard(row, config) {
  if (!row) {
    return "";
  }

  const labels = config.labels || {};

  const negotiatedLabels = labels.negotiatedDeals || {};

  return `
    <article
      class="
        data-card
        trading-card
        trading-card--summary
        trading-negotiated-total
      "
    >
      <div class="data-card__main">

        <div class="data-card__identity">
          <div class="data-card__identity-content">

            <strong class="data-card__identity-name">
              ${escapeHtml(labels.total || "Total")}
            </strong>

          </div>
        </div>

        <dl class="trading-negotiated-total__values">

          <div class="trading-negotiated-total__value">

            <dt>
              ${escapeHtml(negotiatedLabels.volume || "Volume")}
            </dt>

            <dd class="data-card__value--numeric">
              ${escapeHtml(
                formatQuantity(
                  row?.tradeVolume ?? row?.totalVolume ?? row?.volume,
                  config,
                ),
              )}
            </dd>

          </div>

          <div class="trading-negotiated-total__value">

            <dt>
              ${escapeHtml(negotiatedLabels.value || "Value")}
            </dt>

            <dd class="data-card__value--numeric">
              ${escapeHtml(
                formatMoney(
                  row?.turnOver ?? row?.totalValue ?? row?.value,
                  config,
                ),
              )}
            </dd>

          </div>

        </dl>

      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Grouped Cards Adapter
   ========================================================================== */

function createNegotiatedCards({ root, config }) {
  const container = root.querySelector(getCardsSelector(VIEW));

  if (!container) {
    return null;
  }

  let rows = [];
  let destroyed = false;

  function setBusy(busy) {
    container.setAttribute("aria-busy", String(Boolean(busy)));
  }

  function enhance() {
    /*
     * Dynamic cards need the design-system DataViewCard interaction.
     *
     * We intentionally call the existing public design-system refresh hook
     * rather than implementing expand/collapse in Trading.
     */
    const refresh = window.Theme?.dataView?.refresh;

    if (typeof refresh === "function") {
      refresh(container);
    }
  }

  function renderLoading() {
    container.innerHTML = `
      <div
        class="data-view__cards-inner"
        aria-hidden="true"
      >
        ${Array.from(
          {
            length: 4,
          },
          () => `
            <article
              class="
                data-card
                trading-card
                trading-card--skeleton
              "
            >
              <div class="data-card__main">

                <div class="data-card__identity">
                  <div class="data-card__identity-content">

                    <span
                      class="
                        table-skeleton
                        table-skeleton-md
                      "
                    ></span>

                    <span
                      class="
                        table-skeleton
                        table-skeleton-sm
                      "
                    ></span>

                  </div>
                </div>

                <span
                  class="
                    table-skeleton
                    table-skeleton-sm
                  "
                ></span>

              </div>
            </article>
          `,
        ).join("")}
      </div>
    `.trim();
  }

  function renderEmpty(message) {
    container.innerHTML = `
      <div class="data-view__empty">
        ${escapeHtml(message)}
      </div>
    `.trim();
  }

  function renderError(message) {
    renderEmpty(message);
  }

  function render() {
    if (destroyed) {
      return;
    }

    if (!rows.length) {
      container.replaceChildren();

      setBusy(false);

      return;
    }

    const groups = groupRowsByDate(rows);

    let cardIndex = 0;

    container.innerHTML = `
      <div class="trading-negotiated-groups">
        ${groups
          .map((group) => {
            const cards = group.rows
              .map((row) => {
                const card = renderNegotiatedCard({
                  row,
                  index: cardIndex,
                  config,
                });

                cardIndex += 1;

                return card;
              })
              .join("");

            return `
              <section
                class="trading-negotiated-group"
                aria-label="${escapeHtml(group.label)}"
              >

                <header class="trading-negotiated-group__header">
                  <h3 class="trading-negotiated-group__title">
                    ${escapeHtml(group.label)}
                  </h3>
                </header>

                <div class="data-view__cards-inner">
                  ${cards}
                </div>

                ${renderDailyTotalCard(group.totalRow, config)}

              </section>
            `.trim();
          })
          .join("")}
      </div>
    `.trim();

    setBusy(false);

    enhance();
  }

  return Object.freeze({
    showLoading() {
      if (destroyed) {
        return;
      }

      setBusy(true);

      renderLoading();
    },

    setLoading(loading) {
      if (loading) {
        this.showLoading();
      }
    },

    setRows(nextRows = []) {
      rows = Array.isArray(nextRows) ? nextRows : [];

      render();
    },

    renderRows(nextRows = []) {
      this.setRows(nextRows);
    },

    setEmpty(message = "") {
      rows = [];

      setBusy(false);

      renderEmpty(message || config.labels?.noData || "No data available");
    },

    setError(message = "") {
      rows = [];

      setBusy(false);

      renderError(
        message || config.labels?.loadError || "Unable to load data.",
      );
    },

    clear() {
      rows = [];

      container.replaceChildren();

      setBusy(false);
    },

    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      rows = [];

      container.replaceChildren();
    },
  });
}

/* ==========================================================================
   Public View Factory
   ========================================================================== */

export function createNegotiatedView({ root, config, filters } = {}) {
  if (!(root instanceof Element)) {
    throw new TypeError("Negotiated view requires a valid root element.");
  }

  if (!filters?.negotiated) {
    throw new TypeError("Negotiated view requires Trading filters.");
  }

  const columns = getColumns(config);

  /* =========================================================================
     State
     ========================================================================= */

  const state = createDataState({
    loading: false,

    sourceRows: [],

    visibleRows: [],

    meta: {},

    error: null,
  });

  /* =========================================================================
     Source
     ========================================================================= */

  const source = createDataSource({
    endpoint: config.endpoints.negotiatedDeals,

    buildRequestData() {
      return buildRequestData(filters, config);
    },

    normalizeResponse,
  });

  /* =========================================================================
     Table
     ========================================================================= */

  const table = createDataTable({
    root,

    table: getTableSelector(VIEW),

    initialView: VIEW,

    /*
     * JSP owns the final six-column header.
     */
    headerMode: "existing",

    getColumns() {
      return columns;
    },

    renderCell(args) {
      return renderTradingCell({
        ...args,
        config,
      });
    },

    tableOptions: {
      ...config.tableDefaults,
      ...config.tables?.negotiatedDeals,
    },

    createdRow(rowElement, row) {
      rowElement.classList.toggle("table-total-row", isTotalRow(row));
    },
  });

  /* =========================================================================
     Mobile Cards
     ========================================================================= */

  const cards = createNegotiatedCards({
    root,
    config,
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
     Controller
     ========================================================================= */

  const controller = createDataViewController({
    source,
    state,
    table,
    cards,
    results,

    autoLoad: false,

    getView() {
      return VIEW;
    },

    getEmptyMessage() {
      return config.labels?.noData || "No data available";
    },

    getErrorMessage(error) {
      return (
        error?.response?.message ||
        config.labels?.loadError ||
        "Unable to load data."
      );
    },
  });

  controller.init();

  /* =========================================================================
     Loading
     ========================================================================= */

  function showLoading() {
    root.setAttribute("aria-busy", "true");

    table?.showLoading?.();

    cards?.showLoading?.();

    results?.showLoading?.();
  }

  /* =========================================================================
     Reload
     ========================================================================= */

  async function reload() {
    showLoading();

    try {
      return await controller.reload();
    } finally {
      root.setAttribute("aria-busy", "false");
    }
  }

  /* =========================================================================
     Adjust
     ========================================================================= */

  function adjust() {
    const api = table?.getApi?.();

    api?.columns?.adjust?.();

    /*
     * DataTables scroll wrappers can require a redraw after a hidden tab
     * becomes visible.
     */
    api?.draw?.(false);
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    reload,
    adjust,

    getRows() {
      return controller.getSourceRows?.() || [];
    },

    getVisibleRows() {
      return controller.getVisibleRows?.() || [];
    },

    getTable() {
      return table?.getApi?.() || null;
    },

    destroy() {
      controller.destroy();
    },
  });
}
