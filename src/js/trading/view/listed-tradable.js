/* ==========================================================================
   Listed Tradable Rights View
   ========================================================================== */

/*
 * Listed Tradable Rights Trading view.
 *
 * Final desktop contract:
 *
 *   Tradable Rights
 *
 *   Last Trade
 *     - Price
 *     - Volume
 *     - Change Value
 *     - Change %
 *
 *   Today's Trading
 *     - Open
 *     - High
 *     - Low
 *
 *   Cumulative
 *     - Number of Trades
 *     - Volume Traded
 *
 *   Best Bid
 *     - Price
 *     - Volume
 *
 *   Best Offer
 *     - Price
 *     - Volume
 *
 * The JSP owns the complete two-row grouped <thead>.
 *
 * This module owns:
 *
 * - data loading
 * - response normalization
 * - 14-column tbody rendering
 * - mobile card composition
 * - result count
 * - table lifecycle
 *
 * Shared formatters own:
 *
 * - company identity
 * - company logo / fallback
 * - number formatting
 * - money formatting
 * - percentage formatting
 * - HTML escaping
 *
 * Shared data-view owns:
 *
 * - loading state
 * - empty state
 * - error state
 * - DataTables lifecycle
 * - card lifecycle
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
} from "../../common/data-view/index.js";

/* ==========================================================================
   Trading
   ========================================================================== */

import {
  TRADING_VIEWS,
  getCardsSelector,
  getResultCountSelector,
  getTableSelector,
} from "../constants.js";

import {
  escapeHtml,
  formatMoney,
  formatPercentage,
  formatQuantity,
  getCompanyName,
  getCompanySymbol,
  renderTradingCardIdentity,
  renderTradingCompanyCell,
} from "../formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW = TRADING_VIEWS.listedTradableRights;

/* ==========================================================================
   Generic Helpers
   ========================================================================== */

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

/* ==========================================================================
   Change Tone
   ========================================================================== */

/*
 * Keep the CSS-facing semantic tone local to this view.
 *
 * formatters.js is a frozen shared contract and therefore does not need a
 * Listed-specific public tone helper.
 */

function getChangeTone(value) {
  const normalized = String(value ?? "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  if (!normalized) {
    return "neutral";
  }

  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    return "neutral";
  }

  if (number > 0) {
    return "positive";
  }

  if (number < 0) {
    return "negative";
  }

  return "neutral";
}

/* ==========================================================================
   Field Accessors
   ========================================================================== */

/*
 * Keep endpoint-specific aliases here.
 *
 * The common formatter should remain generic and reusable across Trading
 * tabs rather than accumulating every possible Listed Rights backend alias.
 */

/* --------------------------------------------------------------------------
   Last Trade
   -------------------------------------------------------------------------- */

function getLastTradePrice(row) {
  return firstDefined(
    row?.lastTradePrice,
    row?.lastPrice,
    row?.tradePrice,
    row?.price,
    "",
  );
}

function getLastTradeVolume(row) {
  return firstDefined(
    row?.lastTradeVolume,
    row?.lastVolume,
    row?.tradeVolume,
    row?.volume,
    "",
  );
}

function getChangeValue(row) {
  return firstDefined(
    row?.changeValue,
    row?.change,
    row?.netChange,
    row?.priceChange,
    "",
  );
}

function getChangePercent(row) {
  return firstDefined(
    row?.changePercent,
    row?.changePercentage,
    row?.percentageChange,
    row?.percentChange,
    row?.changePct,
    "",
  );
}

/* --------------------------------------------------------------------------
   Today's Trading
   -------------------------------------------------------------------------- */

function getOpen(row) {
  return firstDefined(row?.open, row?.openPrice, row?.openingPrice, "");
}

function getHigh(row) {
  return firstDefined(row?.high, row?.highPrice, row?.highestPrice, "");
}

function getLow(row) {
  return firstDefined(row?.low, row?.lowPrice, row?.lowestPrice, "");
}

/* --------------------------------------------------------------------------
   Cumulative
   -------------------------------------------------------------------------- */

function getNumberOfTrades(row) {
  return firstDefined(
    row?.numberOfTrades,
    row?.noOfTrades,
    row?.tradeCount,
    row?.trades,
    "",
  );
}

function getVolumeTraded(row) {
  return firstDefined(
    row?.volumeTraded,
    row?.tradedVolume,
    row?.totalVolume,
    row?.cumulativeVolume,
    "",
  );
}

/* --------------------------------------------------------------------------
   Best Bid
   -------------------------------------------------------------------------- */

function getBidPrice(row) {
  return firstDefined(row?.bidPrice, row?.bestBidPrice, row?.bestBid, "");
}

function getBidVolume(row) {
  return firstDefined(
    row?.bidVolume,
    row?.bestBidVolume,
    row?.bestBidQuantity,
    "",
  );
}

/* --------------------------------------------------------------------------
   Best Offer
   -------------------------------------------------------------------------- */

function getAskPrice(row) {
  return firstDefined(
    row?.askPrice,
    row?.offerPrice,
    row?.bestAskPrice,
    row?.bestOfferPrice,
    row?.bestOffer,
    "",
  );
}

function getAskVolume(row) {
  return firstDefined(
    row?.askVolume,
    row?.offerVolume,
    row?.bestAskVolume,
    row?.bestOfferVolume,
    row?.bestOfferQuantity,
    "",
  );
}

/* ==========================================================================
   Columns
   ========================================================================== */

/*
 * IMPORTANT:
 *
 * This array describes the 14 PHYSICAL leaf columns represented by the
 * JSP-owned grouped header.
 *
 * JSP:
 *
 *   1 Tradable Rights
 *
 *   Last Trade       = 4
 *   Today's Trading  = 3
 *   Cumulative       = 2
 *   Best Bid         = 2
 *   Best Offer       = 2
 *
 * Total:
 *
 *   1 + 4 + 3 + 2 + 2 + 2 = 14
 *
 * Do not add Symbol as a separate column.
 * Symbol belongs beneath the Tradable Right / company name.
 */

function getColumns(config) {
  const labels = config.labels?.listedTradableRights || {};

  return [
    /* ---------------------------------------------------------------------
       Identity
       --------------------------------------------------------------------- */

    {
      key: "tradable-right",

      label: labels.tradableRight || "Tradable Rights",

      data: null,

      width: "18rem",

      className: "table-market__security",
    },

    /* ---------------------------------------------------------------------
       Last Trade
       --------------------------------------------------------------------- */

    {
      key: "last-trade-price",

      label: labels.price || "Price",

      data: null,

      numeric: true,

      width: "7.5rem",

      className: "table-market__number table-market__price",
    },

    {
      key: "last-trade-volume",

      label: labels.volume || "Volume",

      data: null,

      numeric: true,

      width: "9rem",

      className: "table-market__number",
    },

    {
      key: "change-value",

      label: labels.changeValue || "Change Value",

      data: null,

      numeric: true,

      width: "8.5rem",

      className: "table-market__number",
    },

    {
      key: "change-percent",

      label: labels.changePercent || "Change %",

      data: null,

      numeric: true,

      width: "8rem",

      className: "table-market__number",
    },

    /* ---------------------------------------------------------------------
       Today's Trading
       --------------------------------------------------------------------- */

    {
      key: "open",

      label: labels.open || "Open",

      data: null,

      numeric: true,

      width: "7.5rem",

      className: "table-market__number",
    },

    {
      key: "high",

      label: labels.high || "High",

      data: null,

      numeric: true,

      width: "7.5rem",

      className: "table-market__number",
    },

    {
      key: "low",

      label: labels.low || "Low",

      data: null,

      numeric: true,

      width: "7.5rem",

      className: "table-market__number",
    },

    /* ---------------------------------------------------------------------
       Cumulative
       --------------------------------------------------------------------- */

    {
      key: "number-of-trades",

      label: labels.numberOfTrades || "Number of Trades",

      data: null,

      numeric: true,

      width: "9rem",

      className: "table-market__number",
    },

    {
      key: "volume-traded",

      label: labels.volumeTraded || "Volume Traded",

      data: null,

      numeric: true,

      width: "10rem",

      className: "table-market__number",
    },

    /* ---------------------------------------------------------------------
       Best Bid
       --------------------------------------------------------------------- */

    {
      key: "bid-price",

      label: labels.bidPrice || labels.price || "Price",

      data: null,

      numeric: true,

      width: "7.5rem",

      className: "table-market__number",
    },

    {
      key: "bid-volume",

      label: labels.bidVolume || labels.volume || "Volume",

      data: null,

      numeric: true,

      width: "9rem",

      className: "table-market__number",
    },

    /* ---------------------------------------------------------------------
       Best Offer
       --------------------------------------------------------------------- */

    {
      key: "ask-price",

      label: labels.askPrice || labels.price || "Price",

      data: null,

      numeric: true,

      width: "7.5rem",

      className: "table-market__number",
    },

    {
      key: "ask-volume",

      label: labels.askVolume || labels.volume || "Volume",

      data: null,

      numeric: true,

      width: "9rem",

      className: "table-market__number",
    },
  ];
}

/* ==========================================================================
   Request
   ========================================================================== */

/*
 * Listed Tradable Rights has no local filter form.
 *
 * Keep the request contract deliberately small.
 */

function buildRequestData(config) {
  return {
    requestLocale: config.locale || "en",
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

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  /*
   * Compatibility with older DataTables-oriented endpoints.
   */

  if (Array.isArray(value?.aaData)) {
    return value.aaData;
  }

  return [];
}

/* ==========================================================================
   Result Count
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

      updatedAt: firstDefined(
        raw?.updatedAt,
        raw?.lastUpdated,
        raw?.timestamp,
        null,
      ),
    },

    raw,
  };
}

/* ==========================================================================
   Change Presentation
   ========================================================================== */

function renderChangeValue(row, config) {
  const value = getChangeValue(row);

  const tone = getChangeTone(value);

  return `
    <span
      class="
        table-market__change
        table-market__change--${escapeHtml(tone)}
      "
    >
      ${escapeHtml(formatMoney(value, config))}
    </span>
  `.trim();
}

/* ==========================================================================
   Change Percent
   ========================================================================== */

function renderChangePercent(row, config) {
  const value = getChangePercent(row);

  const tone = getChangeTone(value);

  return `
    <span
      class="
        table-market__change
        table-market__change--${escapeHtml(tone)}
      "
    >
      ${escapeHtml(formatPercentage(value, config))}
    </span>
  `.trim();
}

/* ==========================================================================
   Desktop Cell
   ========================================================================== */

function renderCell({ row, column }, config) {
  switch (column.key) {
    /* ---------------------------------------------------------------------
       Identity
       --------------------------------------------------------------------- */

    case "tradable-right":
      return renderTradingCompanyCell(row, config);

    /* ---------------------------------------------------------------------
       Last Trade
       --------------------------------------------------------------------- */

    case "last-trade-price":
      return escapeHtml(formatMoney(getLastTradePrice(row), config));

    case "last-trade-volume":
      return escapeHtml(formatQuantity(getLastTradeVolume(row), config));

    case "change-value":
      return renderChangeValue(row, config);

    case "change-percent":
      return renderChangePercent(row, config);

    /* ---------------------------------------------------------------------
       Today's Trading
       --------------------------------------------------------------------- */

    case "open":
      return escapeHtml(formatMoney(getOpen(row), config));

    case "high":
      return escapeHtml(formatMoney(getHigh(row), config));

    case "low":
      return escapeHtml(formatMoney(getLow(row), config));

    /* ---------------------------------------------------------------------
       Cumulative
       --------------------------------------------------------------------- */

    case "number-of-trades":
      return escapeHtml(formatQuantity(getNumberOfTrades(row), config));

    case "volume-traded":
      return escapeHtml(formatQuantity(getVolumeTraded(row), config));

    /* ---------------------------------------------------------------------
       Best Bid
       --------------------------------------------------------------------- */

    case "bid-price":
      return escapeHtml(formatMoney(getBidPrice(row), config));

    case "bid-volume":
      return escapeHtml(formatQuantity(getBidVolume(row), config));

    /* ---------------------------------------------------------------------
       Best Offer
       --------------------------------------------------------------------- */

    case "ask-price":
      return escapeHtml(formatMoney(getAskPrice(row), config));

    case "ask-volume":
      return escapeHtml(formatQuantity(getAskVolume(row), config));

    default:
      return "";
  }
}

/* ==========================================================================
   Mobile Labels
   ========================================================================== */

function getMobileLabels(config) {
  const labels = config.labels?.listedTradableRights || {};

  return {
    lastTrade: labels.lastTrade || "Last Trade",

    todaysTrading: labels.todaysTrading || "Today's Trading",

    cumulative: labels.cumulative || "Cumulative",

    bestBid: labels.bestBid || "Best Bid",

    bestOffer: labels.bestOffer || "Best Offer",

    price: labels.price || "Price",

    volume: labels.volume || "Volume",

    changeValue: labels.changeValue || "Change Value",

    changePercent: labels.changePercent || "Change %",

    open: labels.open || "Open",

    high: labels.high || "High",

    low: labels.low || "Low",

    numberOfTrades: labels.numberOfTrades || "Number of Trades",

    volumeTraded: labels.volumeTraded || "Volume Traded",
  };
}

/* ==========================================================================
   Mobile Summary
   ========================================================================== */

/*
 * Smart mobile treatment for the complex grouped desktop table.
 *
 * Do NOT reproduce the 14-column table as a flat list.
 *
 * Card summary:
 *
 *   LEFT
 *     [logo] Company / Tradable Right
 *            SYMBOL
 *
 *   RIGHT
 *     Last Price
 *     Change %
 *
 * Details:
 *
 *   Last Trade
 *   Today's Trading
 *   Cumulative
 *   Best Bid
 *   Best Offer
 */

function renderMobileSummary(row, config) {
  const labels = getMobileLabels(config);

  const price = getLastTradePrice(row);

  const changePercent = getChangePercent(row);

  const tone = getChangeTone(changePercent);

  return `
    <div
      class="
        data-card__quote
        trading-listed-right__quote
      "
    >
      <span
        class="data-card__symbol"
      >
        ${escapeHtml(labels.price)}
      </span>

      <span
        class="data-card__price"
      >
        ${escapeHtml(formatMoney(price, config))}
      </span>

      <span
        class="
          data-card__meta
          table-market__change
          table-market__change--${escapeHtml(tone)}
        "
      >
        ${escapeHtml(formatPercentage(changePercent, config))}
      </span>
    </div>
  `.trim();
}

/* ==========================================================================
   Mobile Field
   ========================================================================== */

function createMobileField({ label, value, numeric = true, className = "" }) {
  return {
    label,
    value,
    numeric,
    className,
  };
}

/* ==========================================================================
   Mobile Last Trade Fields
   ========================================================================== */

function getLastTradeFields(row, config) {
  const labels = getMobileLabels(config);

  return [
    createMobileField({
      label: labels.volume,

      value: formatQuantity(getLastTradeVolume(row), config),
    }),

    createMobileField({
      label: labels.changeValue,

      value: formatMoney(getChangeValue(row), config),

      className: `table-market__change table-market__change--${getChangeTone(
        getChangeValue(row),
      )}`,
    }),

    createMobileField({
      label: labels.changePercent,

      value: formatPercentage(getChangePercent(row), config),

      className: `table-market__change table-market__change--${getChangeTone(
        getChangePercent(row),
      )}`,
    }),
  ];
}

/* ==========================================================================
   Mobile Today's Trading Fields
   ========================================================================== */

function getTodayFields(row, config) {
  const labels = getMobileLabels(config);

  return [
    createMobileField({
      label: labels.open,

      value: formatMoney(getOpen(row), config),
    }),

    createMobileField({
      label: labels.high,

      value: formatMoney(getHigh(row), config),
    }),

    createMobileField({
      label: labels.low,

      value: formatMoney(getLow(row), config),
    }),
  ];
}

/* ==========================================================================
   Mobile Cumulative Fields
   ========================================================================== */

function getCumulativeFields(row, config) {
  const labels = getMobileLabels(config);

  return [
    createMobileField({
      label: labels.numberOfTrades,

      value: formatQuantity(getNumberOfTrades(row), config),
    }),

    createMobileField({
      label: labels.volumeTraded,

      value: formatQuantity(getVolumeTraded(row), config),
    }),
  ];
}

/* ==========================================================================
   Mobile Best Bid Fields
   ========================================================================== */

function getBestBidFields(row, config) {
  const labels = getMobileLabels(config);

  return [
    createMobileField({
      label: labels.price,

      value: formatMoney(getBidPrice(row), config),
    }),

    createMobileField({
      label: labels.volume,

      value: formatQuantity(getBidVolume(row), config),
    }),
  ];
}

/* ==========================================================================
   Mobile Best Offer Fields
   ========================================================================== */

function getBestOfferFields(row, config) {
  const labels = getMobileLabels(config);

  return [
    createMobileField({
      label: labels.price,

      value: formatMoney(getAskPrice(row), config),
    }),

    createMobileField({
      label: labels.volume,

      value: formatQuantity(getAskVolume(row), config),
    }),
  ];
}

/* ==========================================================================
   Safe Mobile Detail Group
   ========================================================================== */

/*
 * Values are normalized before markup generation.
 *
 * This is the single grouped-detail renderer.
 */

function renderMobileDetailGroup({ title, fields }) {
  return `
    <section
      class="
        data-card__field-group
        trading-listed-right__group
      "
    >
      <h4
        class="data-card__field-group-title"
      >
        ${escapeHtml(title)}
      </h4>

      <dl
        class="
          data-card__fields
          trading-listed-right__fields
        "
      >
        ${fields
          .map(({ label, value, className = "" }) =>
            `
              <div
                class="data-card__field"
              >
                <dt
                  class="data-card__label"
                >
                  ${escapeHtml(label)}
                </dt>

                <dd
                  class="
                    data-card__value
                    ${escapeHtml(className)}
                  "
                >
                  ${escapeHtml(value)}
                </dd>
              </div>
            `.trim(),
          )
          .join("")}
      </dl>
    </section>
  `.trim();
}

/* ==========================================================================
   Mobile Detail Groups
   ========================================================================== */

function renderMobileDetails(row, config) {
  const labels = getMobileLabels(config);

  const fallback = config.labels?.notAvailable || "-";

  /*
   * Normalize missing values once before handing them to the presentation
   * renderer.
   */

  const normalizeFields = (fields) =>
    fields.map((field) => ({
      ...field,

      value: hasValue(field.value) ? field.value : fallback,
    }));

  return [
    renderMobileDetailGroup({
      title: labels.lastTrade,

      fields: normalizeFields(getLastTradeFields(row, config)),
    }),

    renderMobileDetailGroup({
      title: labels.todaysTrading,

      fields: normalizeFields(getTodayFields(row, config)),
    }),

    renderMobileDetailGroup({
      title: labels.cumulative,

      fields: normalizeFields(getCumulativeFields(row, config)),
    }),

    renderMobileDetailGroup({
      title: labels.bestBid,

      fields: normalizeFields(getBestBidFields(row, config)),
    }),

    renderMobileDetailGroup({
      title: labels.bestOffer,

      fields: normalizeFields(getBestOfferFields(row, config)),
    }),
  ].join("");
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function renderListedTradableCard(row, context, config) {
  const symbol = getCompanySymbol(row);

  const company = getCompanyName(row, config);

  const rowId = `${symbol || company || "listed-right"}-${context.index}`;

  const detailsId = `trading-listed-right-details-${rowId}`;

  /*
   * We intentionally provide the grouped detail markup ourselves.
   *
   * A complex grouped financial table should not become a flat 13-field
   * mobile card.
   */

  return `
    <article
      class="
        data-card
        trading-data-card
        trading-data-card--listed-tradable
      "
      data-data-card
    >
      <div
        class="data-card__main"
      >
        ${renderTradingCardIdentity(row, config)}

        ${renderMobileSummary(row, config)}
      </div>

      <div
        class="data-card__actions"
      >
        <button
          class="
            data-card__toggle
            btn
            btn-sm
            btn-link
          "
          type="button"
          aria-expanded="false"
          aria-controls="${escapeHtml(detailsId)}"
          data-data-card-toggle
        >
          <span
            data-data-card-more-label
          >
            ${escapeHtml(config.labels?.mobile?.showDetails || "Show details")}
          </span>

          <span
            data-data-card-less-label
            hidden
          >
            ${escapeHtml(config.labels?.mobile?.hideDetails || "Hide details")}
          </span>
        </button>
      </div>

      <div
        class="data-card__details"
        id="${escapeHtml(detailsId)}"
        hidden
        data-data-card-details
      >
        ${renderMobileDetails(row, config)}
      </div>
    </article>
  `.trim();
}

/* ==========================================================================
   Public View
   ========================================================================== */

export function createListedTradableView({ root, config } = {}) {
  /* =========================================================================
     Guards
     ========================================================================= */

  if (!(root instanceof Element)) {
    throw new TypeError(
      "Listed Tradable Rights view requires a valid root element.",
    );
  }

  if (!config?.endpoints?.listedTradableRights) {
    throw new TypeError("Listed Tradable Rights endpoint is required.");
  }

  const columns = getColumns(config);

  let lastResultCount = 0;

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
    endpoint: config.endpoints.listedTradableRights,

    buildRequestData() {
      return buildRequestData(config);
    },

    normalizeResponse(response) {
      const normalized = normalizeResponse(response);

      lastResultCount = Number(normalized.meta?.total) || 0;

      return normalized;
    },
  });

  /* =========================================================================
     Table
     ========================================================================= */

  const table = createDataTable({
    root,

    table: getTableSelector(VIEW),

    initialView: VIEW,

    /*
     * CRITICAL:
     *
     * JSP owns the complete grouped two-row header.
     *
     * DataTable must not recreate <thead>.
     */

    headerMode: "existing",

    getColumns() {
      return columns;
    },

    renderCell(args) {
      return renderCell(args, config);
    },

    tableOptions: {
      /*
       * Common Trading defaults.
       */

      ...config.tableDefaults,

      /*
       * Listed Tradable Rights overrides.
       */

      ...config.tables?.listedTradableRights,

      /*
       * The outer .table-responsive owns horizontal scrolling.
       *
       * Do not introduce a second DataTables scroll container.
       */

      scrollX: false,

      scrollCollapse: false,

      /*
       * Header participates in the shared FixedHeader system.
       *
       * The table has a complex two-row header, so the shared table
       * infrastructure must measure the complete <thead>.
       */

      fixedHeader: true,

      /*
       * The first identity column is visually sticky through shared
       * table-market CSS.
       *
       * Do not also enable DataTables FixedColumns.
       */

      fixedColumns: false,

      /*
       * Preserve all 14 physical columns.
       *
       * Mobile uses cards instead of DataTables Responsive child rows.
       */

      responsive: false,
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
      return renderListedTradableCard(row, context, config);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.loadError || "Unable to load trading data.",

    afterRender(container) {
      container?.classList?.add(
        "trading-data-card-list",
        "trading-listed-tradable-card-list",
      );
    },
  });

  /* =========================================================================
     Results
     ========================================================================= */

  const baseResults = createDataResults({
    root,

    count: getResultCountSelector(VIEW),

    labels: {
      loading: config.labels?.loading,

      empty: config.labels?.noData,

      error: config.labels?.loadError,

      /*
       * JSP already owns the visible Result label.
       *
       * JavaScript writes only the number.
       */

      results: "",
    },
  });

  const results = Object.freeze({
    showLoading() {
      baseResults.showLoading();
    },

    showReady() {
      baseResults.showReady(lastResultCount);
    },

    showEmpty(message) {
      lastResultCount = 0;

      baseResults.showEmpty(message);
    },

    showError(message) {
      lastResultCount = 0;

      baseResults.showError(message);
    },

    destroy() {
      baseResults.destroy();
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

    /*
     * trading.js controls loading according to active-tab lifecycle.
     */

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
        "Unable to load trading data."
      );
    },
  });

  controller.init();

  /* =========================================================================
     Outer Busy State
     ========================================================================= */

  const unsubscribeState = state.subscribe(({ state: snapshot }) => {
    root.setAttribute("aria-busy", String(Boolean(snapshot.loading)));
  });

  /*
   * JSP no longer hard-codes aria-busy="true".
   */

  root.setAttribute("aria-busy", "false");

  /* =========================================================================
     Reload
     ========================================================================= */

  function reload() {
    return controller.reload();
  }

  /* =========================================================================
     Adjust
     ========================================================================= */

  function adjust() {
    const api = table.getApi?.();

    if (!api) {
      return;
    }

    /*
     * This table frequently initializes while its tab is hidden.
     *
     * Once visible we must remeasure:
     *
     * - all 14 columns
     * - grouped two-row header
     * - FixedHeader clone
     */

    requestAnimationFrame(() => {
      try {
        api.columns?.adjust?.();

        api.fixedHeader?.adjust?.();

        /*
         * Responsive is deliberately disabled, but keep the optional call
         * safe in case the common table adapter exposes it.
         */

        api.responsive?.recalc?.();
      } catch (error) {
        console.warn("Listed Tradable Rights table adjustment failed:", error);
      }
    });
  }

  /* =========================================================================
     Queries
     ========================================================================= */

  function getRows() {
    return controller.getSourceRows?.() || [];
  }

  function getVisibleRows() {
    return controller.getVisibleRows?.() || [];
  }

  function getTable() {
    return table.getApi?.() || null;
  }

  /* =========================================================================
     Destroy
     ========================================================================= */

  function destroy() {
    unsubscribeState();

    controller.destroy();

    root.removeAttribute("aria-busy");
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
