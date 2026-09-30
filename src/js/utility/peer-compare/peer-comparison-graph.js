/* ==========================================================================
   Peer Comparison Graph
   ========================================================================== */

(() => {
  "use strict";

  /* ==========================================================================
     Dependencies
     ========================================================================== */

  const U = window.PeerComparisonUtils;

  if (!U) {
    console.error("PeerComparisonGraph requires window.PeerComparisonUtils.");

    return;
  }

  /* ==========================================================================
     Configuration
     ========================================================================== */

  const CONFIG = U.getConfig();

  const TIME_ZONE = "Asia/Riyadh";

  const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1_000;

  const DAY = 24 * 60 * 60 * 1_000;

  const DEFAULT_RANGE = "6M";

  const RANGES = Object.freeze(["1W", "1M", "3M", "6M", "1Y", "ALL"]);

  const RANGE_WINDOWS = Object.freeze({
    "1W": 7 * DAY,

    "1M": 30 * DAY,

    "3M": 90 * DAY,

    "6M": 180 * DAY,

    "1Y": 365 * DAY,

    ALL: null,
  });

  const FALLBACK_COLORS = Object.freeze([
    "#2563eb",
    "#f97316",
    "#8b5cf6",
    "#0891b2",
    "#d97706",
    "#db2777",
  ]);

  const ZERO_LINE_ID = "peer-comparison-zero-line";

  /* ==========================================================================
     Selectors
     ========================================================================== */

  const SELECTORS = Object.freeze({
    graph: "[data-peer-graph]",

    canvas: "[data-peer-chart-canvas]",

    resultPeer: "[data-peer-result-peer]",
  });

  /* ==========================================================================
     Events
     ========================================================================== */

  const EVENTS = Object.freeze({
    loading: "peercomparison:loading",

    render: "peercomparison:render",

    error: "peercomparison:error",

    clear: "peercomparison:clear",
  });

  /* ==========================================================================
     Runtime State
     ========================================================================== */

  let controller = null;

  let companies = [];

  let comparisonSeries = [];

  let chartBaseSeries = null;

  let peerColors = new Map();

  let requestController = null;

  let presentationObserver = null;

  let presentationFrame = null;

  let chartGeneration = 0;

  /**
   * Stable color allocation for this page lifetime.
   *
   * Removing a peer therefore does not recolor all remaining instruments.
   */

  const preferredColorSlots = new Map();

  /* ==========================================================================
     General Helpers
     ========================================================================== */

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getLocale() {
    return U.getLocale();
  }

  function getLabel(key, fallback) {
    return U.getLabel(key, fallback);
  }

  function readCSSVariable(element, name) {
    if (!element) {
      return "";
    }

    return getComputedStyle(element).getPropertyValue(name).trim();
  }

  function escapeSelectorValue(value) {
    const text = String(value ?? "");

    if (globalThis.CSS && typeof CSS.escape === "function") {
      return CSS.escape(text);
    }

    return text.replace(/["\\]/g, "\\$&");
  }

  function isAbortError(error) {
    return error?.name === "AbortError";
  }

  /* ==========================================================================
     Comparison Roster
     ========================================================================== */

  /**
   * Prefer the canonical roster dispatched by peer-comparison.js.
   *
   * Fallback still supports base + selected peers defensively.
   */

  function normalizeComparisonRoster(roster, peers, rows) {
    const summaries = U.normalizeSummaryRows(rows);

    const summariesByCode = new Map(
      summaries.map((record) => [record.symbol, record]),
    );

    const result = [];

    const seen = new Set();

    const addCompany = (item, isBase = false) => {
      const code = U.normalizeCode(item?.code ?? item?.symbol);

      if (!code || seen.has(code)) {
        return;
      }

      const summary = summariesByCode.get(code);

      result.push({
        code,

        name: String(item?.name || summary?.name || code).trim(),

        isBase: Boolean(item?.isBase ?? isBase),
      });

      seen.add(code);
    };

    if (Array.isArray(roster) && roster.length) {
      for (const item of roster) {
        addCompany(item, item?.isBase);
      }

      return result;
    }

    const baseSymbol = U.getBaseCompanySymbol();

    if (baseSymbol) {
      addCompany(
        {
          code: baseSymbol,

          name: U.getBaseCompanyName() || baseSymbol,

          isBase: true,
        },
        true,
      );
    }

    for (const peer of U.normalizePeers(peers)) {
      addCompany(
        {
          ...peer,

          isBase: false,
        },
        false,
      );
    }

    return result;
  }

  /* ==========================================================================
     Identity Palette
     ========================================================================== */

  function getPalette(root) {
    return FALLBACK_COLORS.map(
      (fallback, index) =>
        readCSSVariable(root, `--peer-comparison-color-${index + 1}`) ||
        fallback,
    );
  }

  function assignPeerColors(items, root) {
    const palette = getPalette(root);

    const usedSlots = new Set();

    const slotByCode = new Map();

    /*
     * Preserve existing assignments first.
     */

    for (const company of items) {
      const preferred = preferredColorSlots.get(company.code);

      if (
        Number.isInteger(preferred) &&
        preferred >= 0 &&
        preferred < palette.length &&
        !usedSlots.has(preferred)
      ) {
        slotByCode.set(company.code, preferred);

        usedSlots.add(preferred);
      }
    }

    /*
     * Assign free colors to new companies.
     */

    for (const company of items) {
      if (slotByCode.has(company.code)) {
        continue;
      }

      const freeSlot = palette.findIndex((_, index) => !usedSlots.has(index));

      const slot = freeSlot >= 0 ? freeSlot : slotByCode.size % palette.length;

      slotByCode.set(company.code, slot);

      usedSlots.add(slot);

      preferredColorSlots.set(company.code, slot);
    }

    const colors = new Map();

    for (const company of items) {
      const slot = slotByCode.get(company.code) ?? 0;

      colors.set(company.code, palette[slot]);
    }

    return colors;
  }

  function getPeerColor(code) {
    const normalizedCode = U.normalizeCode(code);

    return peerColors.get(normalizedCode) || FALLBACK_COLORS[0];
  }

  /* ==========================================================================
     Comparison Chip Colors
     ========================================================================== */

  /**
   * Synchronize every comparison chip:
   *
   * base/original index + selected peers.
   *
   * The exact same color is later used by:
   *
   * - main chart series;
   * - overlay chart series;
   * - hover markers;
   * - tooltip marker;
   * - comparison chips.
   */

  function syncComparisonChipColors() {
    for (const company of companies) {
      const code = escapeSelectorValue(company.code);

      const chip = document.querySelector(
        `${SELECTORS.resultPeer}[data-peer-result-peer="${code}"]`,
      );

      if (!chip) {
        continue;
      }

      chip.style.setProperty("--peer-series-color", getPeerColor(company.code));
    }
  }

  /* ==========================================================================
     Graph Markup
     ========================================================================== */

  function getRangeLabel(range) {
    const labels = {
      "1W": getLabel("range1W", "1W"),

      "1M": getLabel("range1M", "1M"),

      "3M": getLabel("range3M", "3M"),

      "6M": getLabel("range6M", "6M"),

      "1Y": getLabel("range1Y", "1Y"),

      ALL: getLabel("rangeAll", "All"),
    };

    return labels[range] || range;
  }

  function getGraphMarkup() {
    return `
      <div class="peer-comparison-chart">

        <div class="peer-comparison-chart__header">
          <div>
            <p class="peer-comparison-result__section-eyebrow">
              Performance
            </p>

            <h3 class="peer-comparison-chart__title">
              Relative performance
            </h3>

            <p class="peer-comparison-chart__description">
              Percentage movement from the first value in the selected range.
            </p>
          </div>
        </div>

        <div
          class="
            chart-toolbar__ranges
            peer-comparison-chart__ranges
          "
          data-peer-chart-controls
          aria-label="Comparison chart range"
        >
          ${RANGES.map(
            (range) => `
              <button
                type="button"
                class="chart-range${
                  range === DEFAULT_RANGE ? " is-active" : ""
                }"
                data-chart-range="${range}"
              >
                ${escapeHTML(getRangeLabel(range))}
              </button>
            `,
          ).join("")}
        </div>

        <div class="peer-comparison-chart__surface">
          <div
            class="
              chart-canvas
              market-chart
              peer-comparison-chart__canvas
            "
            data-peer-chart-canvas
            aria-label="Relative performance of compared market indices"
          ></div>
        </div>

      </div>
    `;
  }

  /* ==========================================================================
     Loading / Empty / Error States
     ========================================================================== */

  function renderLoading() {
    destroyChart();

    const root = document.querySelector(SELECTORS.graph);

    if (!root) {
      return;
    }

    root.setAttribute("aria-busy", "true");

    root.innerHTML = `
      <div
        class="peer-comparison-result__placeholder"
        role="status"
        aria-live="polite"
      >
        ${escapeHTML(getLabel("loading", "Loading"))}...
      </div>
    `;
  }

  function renderError(message = "Unable to load peer comparison chart.") {
    destroyChart();

    const root = document.querySelector(SELECTORS.graph);

    if (!root) {
      return;
    }

    root.setAttribute("aria-busy", "false");

    root.innerHTML = `
      <div
        class="peer-comparison-result__placeholder"
        role="alert"
      >
        ${escapeHTML(message)}
      </div>
    `;
  }

  function renderEmpty() {
    renderError("No chart data available.");
  }

  /* ==========================================================================
     Request Configuration
     ========================================================================== */

  function getChartEndpoint() {
    return String(
      CONFIG.chartEndpoint ??
        CONFIG.chartApiUrl ??
        CONFIG.chartDataUrl ??
        "/api",
    ).trim();
  }

  function getTokenUrl() {
    return U.getChartTokenUrl();
  }

  function getPageName() {
    return U.getChartPageName();
  }

  function getHistoricalChartType() {
    return U.getHistoricalChartType();
  }

  /* ==========================================================================
     Request Lifecycle
     ========================================================================== */

  function cancelRequests() {
    requestController?.abort();

    requestController = null;
  }

  async function readResponse(response) {
    const text = await response.text();

    if (!text.trim()) {
      return [];
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Peer chart API returned invalid JSON.");
    }
  }

  /* ==========================================================================
     JWT
     ========================================================================== */

  async function requestToken(signal) {
    const tokenUrl = getTokenUrl();

    if (!tokenUrl) {
      throw new Error("Peer comparison chart token URL is missing.");
    }

    const url = new URL(tokenUrl, window.location.href);

    const pageName = getPageName();

    if (pageName) {
      url.searchParams.set("pageName", pageName);
    }

    const response = await fetch(url.toString(), {
      method: "GET",

      credentials: "same-origin",

      headers: {
        Accept: "application/json",
      },

      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Peer chart token request failed with HTTP ${response.status}.`,
      );
    }

    const payload = await readResponse(response);

    const token = U.normalizeTokenResponse(payload);

    if (!token) {
      throw new Error("Peer chart JWT token is missing.");
    }

    return token;
  }

  /* ==========================================================================
     Chart API
     ========================================================================== */

  /**
   * Identity and API parameter are deliberately separate.
   *
   * `company.code` always remains canonical because it is also our identity
   * key for colors, legends, tooltips and series ownership.
   *
   * Only the backend chart parameter is lowercased.
   */

  function buildChartUrl(company, jwtToken) {
    const url = new URL(getChartEndpoint(), window.location.href);

    const chartParameter = String(company.code).toLowerCase();

    url.searchParams.set("chart-type", getHistoricalChartType());

    url.searchParams.set("chart-parameter", chartParameter);

    url.searchParams.set("pageName", getPageName());

    url.searchParams.set("jwtToken", jwtToken);

    return url;
  }

  async function requestCompanySeries(company, jwtToken, signal) {
    const response = await fetch(buildChartUrl(company, jwtToken).toString(), {
      method: "GET",

      credentials: "same-origin",

      headers: {
        Accept: "application/json",
      },

      signal,
    });

    if (!response.ok) {
      const error = new Error(
        `Peer chart request for "${company.code}" failed with HTTP ${response.status}.`,
      );

      error.status = response.status;

      throw error;
    }

    return readResponse(response);
  }

  /* ==========================================================================
     Market Timestamp Parsing
     ========================================================================== */

  /**
   * Market date/time without a zone is Riyadh local wall-clock time.
   * Explicit UTC/offset timestamps are respected as absolute timestamps.
   */

  function parseMarketTimestamp(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== "string") {
      return U.toTimestamp(value);
    }

    const raw = value.trim();

    if (!raw) {
      return null;
    }

    if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
      const parsed = Date.parse(raw);

      return Number.isFinite(parsed) ? parsed : null;
    }

    const match = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/,
    );

    if (!match) {
      return U.toTimestamp(raw);
    }

    const year = Number(match[1]);

    const month = Number(match[2]) - 1;

    const day = Number(match[3]);

    const hour = Number(match[4] || 0);

    const minute = Number(match[5] || 0);

    const second = Number(match[6] || 0);

    const milliseconds = Number(
      String(match[7] || "")
        .padEnd(3, "0")
        .slice(0, 3) || 0,
    );

    return (
      Date.UTC(year, month, day, hour, minute, second, milliseconds) -
      RIYADH_OFFSET_MS
    );
  }

  /* ==========================================================================
     Chart Payload Normalization
     ========================================================================== */

  function normalizeChartPoints(payload) {
    const rows = U.unwrapSeriesPayload(payload);

    if (!rows.length) {
      return Object.freeze([]);
    }

    const byTimestamp = new Map();

    for (const point of rows) {
      let timestamp;
      let value;

      if (Array.isArray(point)) {
        timestamp = parseMarketTimestamp(point[0]);

        value = U.toFiniteNumber(point[1]);
      } else {
        timestamp = parseMarketTimestamp(
          point?.dateTime ??
            point?.datetime ??
            point?.timestamp ??
            point?.time ??
            point?.date ??
            point?.x,
        );

        value = U.toFiniteNumber(
          point?.indexPrice ??
            point?.price ??
            point?.value ??
            point?.closePrice ??
            point?.close ??
            point?.y,
        );
      }

      if (timestamp === null || value === null) {
        continue;
      }

      byTimestamp.set(timestamp, Object.freeze([timestamp, value]));
    }

    return Object.freeze([...byTimestamp.values()].sort((a, b) => a[0] - b[0]));
  }

  /* ==========================================================================
     Real Series Loading
     ========================================================================== */

  async function loadComparisonSeries(items, generation) {
    cancelRequests();

    const abortController = new AbortController();

    requestController = abortController;

    const token = await requestToken(abortController.signal);

    if (generation !== chartGeneration) {
      return null;
    }

    /*
     * Each company request is independent. One failed instrument must not
     * prevent valid comparison series from rendering.
     */

    const results = await Promise.allSettled(
      items.map(async (company) => {
        const payload = await requestCompanySeries(
          company,
          token,
          abortController.signal,
        );

        return {
          /*
           * Keep canonical company identity.
           * Never replace code with its API-normalized representation.
           */
          ...company,

          points: normalizeChartPoints(payload),
        };
      }),
    );

    if (generation !== chartGeneration) {
      return null;
    }

    const series = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        if (result.value.points.length) {
          series.push(result.value);
        }

        return;
      }

      if (!isAbortError(result.reason)) {
        console.error(
          `Peer chart request failed for "${items[index]?.code}".`,
          result.reason,
        );
      }
    });

    return series;
  }

  /* ==========================================================================
     Range Data
     ========================================================================== */

  function sliceRange(points, range) {
    if (!points.length) {
      return [];
    }

    const duration = RANGE_WINDOWS[range];

    if (duration === null) {
      return [...points];
    }

    const end = points.at(-1)[0];

    const start = end - duration;

    return points.filter(
      ([timestamp]) => timestamp >= start && timestamp <= end,
    );
  }

  function normalizeRange(points, range) {
    return U.normalizeSeriesToPercentage(sliceRange(points, range));
  }

  function buildComparisonSeries(rawSeries) {
    return rawSeries.map((series) => {
      const ranges = {};

      for (const range of RANGES) {
        ranges[range] = normalizeRange(series.points, range);
      }

      return Object.freeze({
        ...series,

        ranges: Object.freeze(ranges),
      });
    });
  }

  function hasSeriesData(series) {
    return RANGES.some((range) => series.ranges[range]?.length);
  }

  /* ==========================================================================
     Shared Chart Range Records
     ========================================================================== */

  function createBaseRanges(series) {
    const ranges = {};

    for (const range of RANGES) {
      const data = series.ranges[range];

      if (!data?.length) {
        continue;
      }

      ranges[range] = {
        comparisonValue: 0,

        trend: data,

        candlestick: [],
      };
    }

    return ranges;
  }

  /* ==========================================================================
     Formatting
     ========================================================================== */

  function formatPerformance(value) {
    const number = U.toFiniteNumber(value);

    if (number === null) {
      return "—";
    }

    const formatted = new Intl.NumberFormat(getLocale(), {
      minimumFractionDigits: 2,

      maximumFractionDigits: 2,

      signDisplay: "never",
    }).format(Math.abs(number));

    if (number > 0) {
      return `▲ ${formatted}%`;
    }

    if (number < 0) {
      return `▼ ${formatted}%`;
    }

    return `${formatted}%`;
  }

  function formatAxisPerformance(value) {
    const number = U.toFiniteNumber(value);

    if (number === null) {
      return "";
    }

    return `${new Intl.NumberFormat(getLocale(), {
      maximumFractionDigits: 1,
    }).format(number)}%`;
  }

  function formatTooltipDate(timestamp) {
    return U.formatDate(timestamp, {
      timeZone: TIME_ZONE,

      year: "numeric",

      month: "short",

      day: "numeric",
    });
  }

  /* ==========================================================================
     Tooltip
     ========================================================================== */

  function comparisonTooltipFormatter() {
    const point = this.point ?? this.points?.[0]?.point ?? this;

    const series = point?.series ?? this.series;

    if (!series) {
      return false;
    }

    const value = U.toFiniteNumber(point?.y);

    if (value === null) {
      return false;
    }

    const code = U.normalizeCode(series.options?.custom?.peerCode || "");

    const color = getPeerColor(code);

    return `
      <div class="market-chart-tooltip">

        <div class="market-chart-tooltip__header">
          <strong class="market-chart-tooltip__title">
            <span
              aria-hidden="true"
              style="
                display:inline-block;
                inline-size:0.625rem;
                block-size:0.625rem;
                margin-inline-end:0.375rem;
                border-radius:999px;
                background:${escapeHTML(color)};
              "
            ></span>

            ${escapeHTML(series.name || code || "Index")}
          </strong>

          <span class="market-chart-tooltip__date">
            ${escapeHTML(formatTooltipDate(point.x))}
          </span>
        </div>

        <div class="market-chart-tooltip__body">
          <div class="market-chart-tooltip__row">
            <span class="market-chart-tooltip__label">
              Performance
            </span>

            <span class="market-chart-tooltip__value">
              ${escapeHTML(formatPerformance(value))}
            </span>
          </div>
        </div>

      </div>
    `;
  }

  /* ==========================================================================
     Shared Market Chart API
     ========================================================================== */

  function getMarketChartAPI() {
    const api = window.SEMarketCharts;

    return typeof api?.create === "function" ? api : null;
  }

  function createChartConfiguration(baseSeries, ranges, controlsRoot) {
    return {
      context: "performance",

      symbol: baseSeries.code,

      name: baseSeries.name,

      currency: "",

      decimals: 2,

      range: DEFAULT_RANGE,

      mode: "line",

      language: getLocale(),

      timeZone: TIME_ZONE,

      showEmptyState: true,

      animation: {
        duration: 350,
      },

      capabilities: {
        intraday: false,

        historical: true,

        live: false,

        navigator: false,
      },

      /*
       * Comparison values now read naturally from the left edge.
       */
      yAxis: {
        opposite: false,

        title: "Performance (%)",

        format: {
          decimals: 1,

          useGrouping: false,
        },

        labelOptions: {
          formatter() {
            return formatAxisPerformance(this.value);
          },
        },
      },

      ranges,

      controls: {
        root: controlsRoot,
      },

      tooltip: {
        options: {
          formatter: comparisonTooltipFormatter,
        },
      },

      exporting: {
        enabled: false,
      },

      accessibilityDescription:
        "Relative percentage performance of compared market indices.",
    };
  }

  /* ==========================================================================
     Shared Chart Access
     ========================================================================== */

  function getCurrentRange() {
    return controller?.getState()?.range ?? DEFAULT_RANGE;
  }

  function getMainSeries(chart) {
    return (
      chart?.series?.find(
        (series) =>
          !series.options?.isInternal &&
          series.options?.custom?.peerComparisonOverlay !== true,
      ) ?? null
    );
  }

  /* ==========================================================================
     Base Series Presentation
     ========================================================================== */

  function applyBaseSeriesPresentation(chart) {
    const series = getMainSeries(chart);

    if (!series || !chartBaseSeries) {
      return;
    }

    const color = getPeerColor(chartBaseSeries.code);

    series.update(
      {
        name: chartBaseSeries.name,

        color,

        lineColor: color,

        lineWidth: 2,

        fillColor: "transparent",

        marker: {
          enabled: false,

          states: {
            hover: {
              enabled: true,

              radius: 4,

              lineWidth: 2,

              lineColor: color,

              fillColor: color,
            },
          },
        },

        custom: {
          peerCode: chartBaseSeries.code,

          peerComparisonBase: true,
        },

        states: {
          inactive: {
            opacity: 1,
          },

          hover: {
            lineWidthPlus: 1,
          },
        },
      },
      false,
    );
  }

  /* ==========================================================================
     Overlay Series
     ========================================================================== */

  function removeOverlaySeries(chart) {
    if (!chart) {
      return;
    }

    const overlays = chart.series.filter(
      (series) => series.options?.custom?.peerComparisonOverlay === true,
    );

    for (const series of overlays) {
      series.remove(false);
    }
  }

  function applyOverlaySeries(chart) {
    if (!chart) {
      return;
    }

    removeOverlaySeries(chart);

    const range = getCurrentRange();

    for (const peer of comparisonSeries) {
      if (peer.code === chartBaseSeries?.code) {
        continue;
      }

      const data = peer.ranges[range];

      if (!data?.length) {
        continue;
      }

      const color = getPeerColor(peer.code);

      chart.addSeries(
        {
          type: "line",

          name: peer.name,

          data,

          color,

          lineColor: color,

          lineWidth: 2,

          marker: {
            enabled: false,

            states: {
              hover: {
                enabled: true,

                radius: 4,

                lineWidth: 2,

                lineColor: color,

                fillColor: color,
              },
            },
          },

          dataGrouping: {
            enabled: false,
          },

          showInNavigator: false,

          custom: {
            peerCode: peer.code,

            peerComparisonOverlay: true,
          },

          states: {
            inactive: {
              opacity: 1,
            },

            hover: {
              lineWidthPlus: 1,
            },
          },
        },
        false,
      );
    }
  }

  /* ==========================================================================
     0% Baseline
     ========================================================================== */

  function applyZeroBaseline(chart) {
    const axis = chart?.yAxis?.[0];

    if (!axis) {
      return;
    }

    axis.removePlotLine(ZERO_LINE_ID);

    const canvas = document.querySelector(SELECTORS.canvas);

    const color = readCSSVariable(canvas, "--color-border-strong") || "#64748b";

    axis.addPlotLine({
      id: ZERO_LINE_ID,

      value: 0,

      color,

      width: 1,

      dashStyle: "ShortDash",

      zIndex: 3,
    });
  }

  /* ==========================================================================
     Comparison Presentation
     ========================================================================== */

  function applyComparisonPresentation() {
    if (!controller) {
      return;
    }

    const chart = controller.getChart();

    if (!chart) {
      return;
    }

    syncComparisonChipColors();

    applyBaseSeriesPresentation(chart);

    applyOverlaySeries(chart);

    applyZeroBaseline(chart);

    chart.redraw(false);
  }

  function schedulePresentation() {
    if (presentationFrame !== null) {
      cancelAnimationFrame(presentationFrame);
    }

    /*
     * Shared Market Chart rebuilds on structural changes such as range/theme.
     * Reapply comparison-only series after that rebuild completes.
     */

    presentationFrame = requestAnimationFrame(() => {
      presentationFrame = requestAnimationFrame(() => {
        presentationFrame = null;

        applyComparisonPresentation();
      });
    });
  }

  /* ==========================================================================
     Presentation Observation
     ========================================================================== */

  function observePresentationChanges() {
    presentationObserver?.disconnect();

    presentationObserver = new MutationObserver(schedulePresentation);

    presentationObserver.observe(document.documentElement, {
      attributes: true,

      attributeFilter: ["data-theme", "data-contrast", "dir"],
    });
  }

  /* ==========================================================================
     Chart Destruction
     ========================================================================== */

  function destroyChart() {
    cancelRequests();

    chartGeneration += 1;

    if (presentationFrame !== null) {
      cancelAnimationFrame(presentationFrame);

      presentationFrame = null;
    }

    presentationObserver?.disconnect();

    presentationObserver = null;

    if (controller) {
      try {
        controller.destroy();
      } catch (error) {
        console.error("Peer comparison chart destruction failed.", error);
      }
    }

    controller = null;

    companies = [];

    comparisonSeries = [];

    chartBaseSeries = null;

    peerColors = new Map();
  }

  /* ==========================================================================
     Chart Creation
     ========================================================================== */

  async function createChart(peers, rows, comparisonRoster) {
    destroyChart();

    const generation = chartGeneration;

    const graphRoot = document.querySelector(SELECTORS.graph);

    if (!graphRoot) {
      return;
    }

    graphRoot.setAttribute("aria-busy", "true");

    graphRoot.innerHTML = getGraphMarkup();

    const canvas = graphRoot.querySelector(SELECTORS.canvas);

    if (!canvas) {
      return;
    }

    companies = normalizeComparisonRoster(comparisonRoster, peers, rows);

    if (!companies.length) {
      renderEmpty();

      return;
    }

    /*
     * One identity palette is established before any request is sent.
     */

    peerColors = assignPeerColors(companies, graphRoot);

    syncComparisonChipColors();

    let loaded;

    try {
      loaded = await loadComparisonSeries(companies, generation);
    } catch (error) {
      if (isAbortError(error) || generation !== chartGeneration) {
        return;
      }

      console.error("Peer comparison chart loading failed.", error);

      renderError();

      return;
    }

    if (loaded === null || generation !== chartGeneration) {
      return;
    }

    if (!loaded.length) {
      renderEmpty();

      return;
    }

    comparisonSeries = buildComparisonSeries(loaded).filter(hasSeriesData);

    if (!comparisonSeries.length) {
      renderEmpty();

      return;
    }

    /*
     * Prefer the configured original/base index as the canonical shared
     * Market Chart series. If that endpoint has no data, gracefully fall back
     * to the first available comparison series.
     */

    const configuredBase = U.getBaseCompanySymbol();

    chartBaseSeries =
      comparisonSeries.find((series) => series.code === configuredBase) ??
      comparisonSeries[0];

    const ranges = createBaseRanges(chartBaseSeries);

    if (!Object.keys(ranges).length) {
      renderEmpty();

      return;
    }

    const api = getMarketChartAPI();

    if (!api) {
      renderError("Comparison chart is unavailable.");

      return;
    }

    controller = api.create(
      canvas,
      createChartConfiguration(chartBaseSeries, ranges, graphRoot),
    );

    if (!controller) {
      renderError();

      return;
    }

    canvas.addEventListener("marketchartrangechange", schedulePresentation);

    /*
     * No tab reflow is needed anymore.
     * Chart is visible as part of the dashboard from first render.
     */

    applyComparisonPresentation();

    observePresentationChanges();

    graphRoot.setAttribute("aria-busy", "false");
  }

  /* ==========================================================================
     Feature Events
     ========================================================================== */

  function handleLoading() {
    renderLoading();
  }

  function handleRender(event) {
    void createChart(
      event.detail?.peers ?? [],

      event.detail?.rows ?? [],

      event.detail?.comparisonRoster ?? [],
    );
  }

  function handleError() {
    renderError("Unable to load peer comparison data.");
  }

  function handleClear() {
    destroyChart();
  }

  /* ==========================================================================
     Binding
     ========================================================================== */

  function bindEvents() {
    document.addEventListener(EVENTS.loading, handleLoading);

    document.addEventListener(EVENTS.render, handleRender);

    document.addEventListener(EVENTS.error, handleError);

    document.addEventListener(EVENTS.clear, handleClear);

    window.addEventListener("pagehide", () => {
      destroyChart();
    });
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  function initialize() {
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true,
    });
  } else {
    initialize();
  }
})();
