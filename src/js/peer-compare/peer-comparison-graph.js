/* ==========================================================================
   Peer Comparison Graph
   ========================================================================== */

/**
 * Peer comparison graph adapter.
 *
 * Owns:
 *
 * - real peer chart-data requests;
 * - JWT retrieval;
 * - request cancellation / stale-response protection;
 * - comparison-series normalization;
 * - stable peer identity colors;
 * - percentage normalization per selected range;
 * - comparison tooltip;
 * - 0% baseline;
 * - selected-chip color synchronization;
 * - shared Market Chart integration.
 *
 * Does not own:
 *
 * - Highstock construction;
 * - generic Market Chart lifecycle;
 * - generic chart theme;
 * - peer-summary API;
 * - modal behavior;
 * - tab behavior.
 */

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

  let selectedPeers = [];

  let companies = [];

  let comparisonSeries = [];

  let chartBaseSeries = null;

  let peerColors = new Map();

  let requestController = null;

  let requestId = 0;

  let presentationObserver = null;

  let presentationFrame = null;

  /**
   * Stable color assignment for the lifetime of the page.
   *
   * Removing one peer therefore does not recolor every remaining peer.
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
     Comparison Companies
     ========================================================================== */

  /**
   * Build comparison identities independently of API ordering.
   *
   * Base company/index comes first when configured, followed by selected
   * peers in UI order.
   */

  function buildCompanies(peers, rows) {
    const selected = U.normalizePeers(peers);

    const summaries = U.normalizeSummaryRows(rows);

    const summaryBySymbol = new Map(summaries.map((row) => [row.symbol, row]));

    const result = [];

    const seen = new Set();

    const baseSymbol = U.getBaseCompanySymbol();

    if (baseSymbol) {
      const summary = summaryBySymbol.get(baseSymbol);

      result.push({
        code: baseSymbol,

        name: summary?.name || U.getBaseCompanyName() || baseSymbol,

        isBase: true,
      });

      seen.add(baseSymbol);
    }

    for (const peer of selected) {
      if (seen.has(peer.code)) {
        continue;
      }

      const summary = summaryBySymbol.get(peer.code);

      result.push({
        code: peer.code,

        name: peer.name || summary?.name || peer.code,

        isBase: false,
      });

      seen.add(peer.code);
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
     * Preserve previous assignments.
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
     * Assign new peers to free slots.
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
    return peerColors.get(code) || FALLBACK_COLORS[0];
  }

  /* ==========================================================================
     Selected Chip Colors
     ========================================================================== */

  function syncPeerChipColors() {
    for (const peer of selectedPeers) {
      const code = escapeSelectorValue(peer.code);

      const chip = document.querySelector(
        `${SELECTORS.resultPeer}[data-peer-result-peer="${code}"]`,
      );

      if (!chip) {
        continue;
      }

      chip.style.setProperty("--peer-series-color", getPeerColor(peer.code));
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
            aria-label="Relative performance of selected market indices"
          ></div>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
     Loading / Error States
     ========================================================================== */

  function renderLoading() {
    destroyChart();

    const root = document.querySelector(SELECTORS.graph);

    if (!root) {
      return;
    }

    root.setAttribute("aria-busy", "true");

    root.innerHTML = `
      <div class="peer-comparison-result__placeholder">
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

  function buildChartUrl(company, jwtToken) {
    const url = new URL(getChartEndpoint(), window.location.href);

    /*
     * Preserve the legacy peer-chart API contract.
     */

    url.searchParams.set("chart-type", getHistoricalChartType());

    url.searchParams.set("chart-parameter", company.code);

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
   * The chart API's legacy records use wall-clock market timestamps such as:
   *
   * YYYY-MM-DD
   * YYYY-MM-DD HH:mm:ss
   * YYYY-MM-DDTHH:mm:ss
   *
   * They belong to the Riyadh market time zone.
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

    /*
     * Absolute timestamp with explicit zone.
     */

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

    /*
     * Riyadh is UTC+03:00.
     */

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
     Load Real Series
     ========================================================================== */

  async function loadComparisonSeries(items) {
    cancelRequests();

    const abortController = new AbortController();

    requestController = abortController;

    const currentRequestId = ++requestId;

    const token = await requestToken(abortController.signal);

    if (currentRequestId !== requestId) {
      return null;
    }

    /*
     * One failed company must not prevent the remaining comparison lines
     * from rendering.
     */

    const results = await Promise.allSettled(
      items.map(async (company) => {
        const payload = await requestCompanySeries(
          company,
          token,
          abortController.signal,
        );

        return {
          ...company,

          points: normalizeChartPoints(payload),
        };
      }),
    );

    if (currentRequestId !== requestId) {
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

    const code = series.options?.custom?.peerCode || "";

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

      yAxis: {
        opposite: true,

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

    syncPeerChipColors();

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
     * Range/theme changes rebuild the shared Highcharts instance.
     * Reapply comparison-only presentation afterwards.
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

    requestId += 1;

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

  async function createChart(peers, rows) {
    destroyChart();

    selectedPeers = U.normalizePeers(peers);

    if (!selectedPeers.length) {
      return;
    }

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

    companies = buildCompanies(selectedPeers, rows);

    if (!companies.length) {
      renderEmpty();

      return;
    }

    peerColors = assignPeerColors(companies, graphRoot);

    syncPeerChipColors();

    const currentRequestId = requestId;

    let loaded;

    try {
      loaded = await loadComparisonSeries(companies);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      console.error("Peer comparison chart loading failed.", error);

      renderError();

      return;
    }

    if (loaded === null || currentRequestId > requestId) {
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
     * Prefer the configured base company as the canonical shared-chart
     * series. If its chart endpoint returned no data, use the first available
     * peer so the remaining comparison can still render.
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

    applyComparisonPresentation();

    observePresentationChanges();

    graphRoot.setAttribute("aria-busy", "false");
  }

  /* ==========================================================================
     Tab Visibility
     ========================================================================== */

  function handleTabChange(event) {
    if (event.detail?.tabKey !== "graph") {
      return;
    }

    requestAnimationFrame(() => {
      controller?.reflow?.();

      applyComparisonPresentation();
    });
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

    document.addEventListener("tabs:change", handleTabChange);

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
