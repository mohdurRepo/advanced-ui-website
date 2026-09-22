  (() => {
    "use strict";

    /* ==========================================================================
       Guard
       ========================================================================== */

    if (window.__marketOverviewChartsInitialized) {
      return;
    }

    window.__marketOverviewChartsInitialized = true;

    /* ==========================================================================
       Production Configuration
       ========================================================================== */

    const LIVE_INTERVAL = 60_000;
    const LIVE_WINDOW_DURATION = null;

    /*
     * Keep comfortable headroom above a complete one-minute trading session.
     *
     * This prevents the controller's bounded live store from evicting the
     * session open during normal trading or after a short hidden-tab catch-up.
     */
    const MAX_POINTS = 900;

    const REQUEST_TIMEOUT = 10_000;
    const API_READY_TIMEOUT = 10_000;

    const TIME_ZONE = "Asia/Riyadh";
    const RIYADH_OFFSET = "+03:00";

    /* ==========================================================================
       Markets
       ========================================================================== */

    const MARKETS = Object.freeze([
      Object.freeze({
        key: "tasi",
        apiId: "tasi",

        symbol: "TASI",

        nameEn: "Tadawul All Share Index",
        nameAr: "مؤشر السوق الرئيسية (تاسي)",

        decimals: 2,

        chartSelector: "#tasi-chart",
        panelSelector: "#market-panel-tasi",
      }),

      Object.freeze({
        key: "nomu",
        apiId: "nomuc",

        symbol: "NOMUC",

        nameEn: "Parallel Market Capped Index",
        nameAr: "مؤشر السوق الموازية (نمو حد أعلى)",

        decimals: 2,

        chartSelector: "#nomu-chart",
        panelSelector: "#market-panel-nomu",
      }),

      Object.freeze({
        key: "sukuk",
        apiId: "sukuk",

        symbol: "SUKUK",

        nameEn: "Sukuk/Bonds Market Index",
        nameAr: "مؤشر سوق الصكوك / السندات",

        decimals: 2,

        chartSelector: "#sukuk-chart",
        panelSelector: "#market-panel-sukuk",
      }),

      Object.freeze({
        key: "reits",
        apiId: "reits",

        symbol: "REITS",

        nameEn: "REITs Index",
        nameAr: "صناديق الاستثمار العقارية",

        decimals: 2,

        chartSelector: "#reits-chart",
        panelSelector: "#market-panel-funds",
      }),

      Object.freeze({
        key: "mt30",
        apiId: "mt30",

        symbol: "MT30",

        nameEn: "MT30 Index",
        nameAr: "إم تي 30",

        decimals: 2,

        chartSelector: "#mt30-chart",
        panelSelector: "#market-panel-derivatives",
      }),
    ]);

    const marketByPanelId = new Map(
      MARKETS.map((market) => [market.panelSelector.slice(1), market]),
    );

    /* ==========================================================================
       Runtime
       ========================================================================== */

    const listenerController = new AbortController();

    let chartAPI = null;

    /*
     * Exactly ONE Highcharts/controller runtime.
     */
    let activeRuntime = null;

    /*
     * Exactly ONE initial API request may be pending.
     */
    let pendingCreation = null;

    let syncFrame = null;
    let syncRevision = 0;

    let destroyed = false;

    /* ==========================================================================
       Locale
       ========================================================================== */

    function getLanguage() {
      return document.documentElement.lang || "en";
    }

    function isArabic() {
      return String(getLanguage()).toLowerCase().startsWith("ar");
    }

    function getMarketName(market) {
      return isArabic() ? market.nameAr : market.nameEn;
    }

    function getAxisLabels() {
      return isArabic()
        ? {
            time: "الوقت",
            value: "قيمة المؤشر",
          }
        : {
            time: "Time",
            value: "Index Value",
          };
    }

    function getMessages(market) {
      const name = getMarketName(market);

      return isArabic()
        ? {
            loading: `جارٍ تحميل بيانات ${name}…`,
            empty: `بيانات ${name} غير متاحة حالياً.`,
            error: `تعذر تحميل بيانات ${name}.`,
          }
        : {
            loading: `Loading ${name} data…`,
            empty: `${name} data is currently unavailable.`,
            error: `${name} data could not be loaded.`,
          };
    }

    /* ==========================================================================
       Number Normalization
       ========================================================================== */

    function toFiniteNumber(value) {
      if (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return null;
      }

      const normalized =
        typeof value === "string" ? value.replaceAll(",", "").trim() : value;

      const number = Number(normalized);

      return Number.isFinite(number) ? number : null;
    }

    /* ==========================================================================
       Timestamp Normalization
       ========================================================================== */

    function toTimestamp(value) {
      if (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return null;
      }

      /* ------------------------------------------------------------------------
         Numeric epoch
         ------------------------------------------------------------------------ */

      const text = String(value).trim();

      if (typeof value === "number" || /^\d+$/.test(text)) {
        const numeric = Number(value);

        if (!Number.isFinite(numeric)) {
          return null;
        }

        return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
      }

      const source = text;

      /* ------------------------------------------------------------------------
         Zoned date/time
         ------------------------------------------------------------------------ */

      if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(source)) {
        const timestamp = Date.parse(source);

        return Number.isFinite(timestamp) ? timestamp : null;
      }

      /* ------------------------------------------------------------------------
         Saudi local ISO date/time
         ------------------------------------------------------------------------ */

      const isoLocalMatch = source.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
      );

      if (isoLocalMatch) {
        const [
          ,
          year,
          month,
          day,
          hour,
          minute,
          second = "00",
          milliseconds = "",
        ] = isoLocalMatch;

        const fraction = milliseconds ? `.${milliseconds.padEnd(3, "0")}` : "";

        const timestamp = Date.parse(
          `${year}-${month}-${day}T${hour.padStart(
            2,
            "0",
          )}:${minute}:${second}${fraction}${RIYADH_OFFSET}`,
        );

        return Number.isFinite(timestamp) ? timestamp : null;
      }

      /* ------------------------------------------------------------------------
         Saudi local DD/MM/YYYY
         ------------------------------------------------------------------------ */

      const dayFirstMatch = source.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
      );

      if (dayFirstMatch) {
        const [, day, month, year, hour, minute, second = "00"] = dayFirstMatch;

        const timestamp = Date.parse(
          `${year}-${month.padStart(2, "0")}-${day.padStart(
            2,
            "0",
          )}T${hour.padStart(2, "0")}:${minute}:${second}${RIYADH_OFFSET}`,
        );

        return Number.isFinite(timestamp) ? timestamp : null;
      }

      /*
       * Final fallback for backend representations
       * already understood by the browser.
       */
      const timestamp = Date.parse(source);

      return Number.isFinite(timestamp) ? timestamp : null;
    }

    /* ==========================================================================
       Backend URL
       ========================================================================== */

    function buildMarketApiUrl(market) {
      if (!market) {
        return null;
      }

      const params = new URLSearchParams();

      params.set("methodType", "parsingMethod");

      /* ------------------------------------------------------------------------
         Existing backend chart type
         ------------------------------------------------------------------------ */

      let chartType = "SQL_MI_MSPV";

      if (market.apiId === "nomuc") {
        chartType = "SQL_MI_MSPV_SME";
      } else if (market.apiId === "sukuk") {
        chartType = "SQL_MI_MSPV_SUKUK";
      }

      params.set("chart-type", chartType);

      /* ------------------------------------------------------------------------
         Existing parameter aliases
         ------------------------------------------------------------------------ */

      let chartParameter = market.apiId;

      if (market.apiId === "sukuk") {
        chartParameter = "tsbi";
      } else if (market.apiId === "reits") {
        chartParameter = "trti";
      }

      params.set("chart-parameter", chartParameter);

      params.set("format", "json");

      params.set("pageName", "MarketSummaryHomePageGraph");

      params.set(
        "jwtToken",
        '<%=JwtBean.getJwtToken("marketStatusHomeGraph")%>',
      );

      return "/api?" + params.toString();
    }

    /* ==========================================================================
       Snapshot Normalization
       ========================================================================== */

    function normalizeSnapshot(payload) {
      if (!Array.isArray(payload) || !payload.length) {
        return [];
      }

      /*
       * Duplicate timestamp:
       * latest backend occurrence wins.
       */
      const byTimestamp = new Map();

      for (const item of payload) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const timestamp = toTimestamp(item.dateTime);

        const value = toFiniteNumber(item.indexPrice);

        if (timestamp === null || value === null) {
          continue;
        }

        byTimestamp.set(timestamp, [timestamp, value]);
      }

      const points = [...byTimestamp.values()].sort(
        (first, second) => first[0] - second[0],
      );

      /*
       * Keep one complete intraday session,
       * not an unbounded history.
       */
      return points.length > MAX_POINTS ? points.slice(-MAX_POINTS) : points;
    }

    /* ==========================================================================
       Abort Helpers
       ========================================================================== */

    function createAbortError(message = "The request was cancelled.") {
      const error = new Error(message);

      error.name = "AbortError";

      return error;
    }

    function isAbortError(error) {
      return error?.name === "AbortError";
    }

    /* ==========================================================================
       Backend Request
       ========================================================================== */

    async function requestSnapshot(market, externalSignal = null) {
      const url = buildMarketApiUrl(market);

      if (!url) {
        throw new Error(
          `Unable to build ${market?.symbol || "market"} chart URL.`,
        );
      }

      const controller = new AbortController();

      let timedOut = false;

      const handleExternalAbort = () => {
        controller.abort();
      };

      if (externalSignal) {
        if (externalSignal.aborted) {
          throw externalSignal.reason || createAbortError();
        }

        externalSignal.addEventListener("abort", handleExternalAbort, {
          once: true,
        });
      }

      const timeoutId = window.setTimeout(() => {
        timedOut = true;

        controller.abort();
      }, REQUEST_TIMEOUT);

      try {
        const response = await fetch(url, {
          method: "GET",

          credentials: "same-origin",

          signal: controller.signal,

          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `${market.symbol} chart request failed with HTTP ${response.status}.`,
          );
        }

        return normalizeSnapshot(await response.json());
      } catch (error) {
        if (timedOut) {
          const timeoutError = new Error(
            `${market.symbol} chart request timed out.`,
          );

          timeoutError.name = "TimeoutError";

          throw timeoutError;
        }

        if (externalSignal?.aborted) {
          throw externalSignal.reason || createAbortError();
        }

        if (controller.signal.aborted) {
          throw createAbortError();
        }

        throw error;
      } finally {
        window.clearTimeout(timeoutId);

        externalSignal?.removeEventListener("abort", handleExternalAbort);
      }
    }

    /* ==========================================================================
       Live Delta
       ========================================================================== */

    function selectLivePoints(snapshot, since) {
      if (!Array.isArray(snapshot) || !snapshot.length) {
        return [];
      }

      const sinceTimestamp = toTimestamp(since);

      /*
       * Recovery from an empty initial chart.
       */
      if (sinceTimestamp === null) {
        return snapshot;
      }

      /*
       * Inclusive reconciliation boundary.
       *
       * The controller deliberately sends `sinceInclusive: true` and can
       * reconcile both:
       *
       * - a correction at the latest known timestamp
       * - every genuinely newer point returned after a hidden-tab pause
       *
       * An unchanged boundary point becomes a canonical no-op inside
       * market-chart.js, so it does not trigger a chart redraw.
       */
      return snapshot.filter((point) => point[0] >= sinceTimestamp);
    }

    /* ==========================================================================
       DOM
       ========================================================================== */

    function resolveChartElement(market) {
      return document.querySelector(market.chartSelector);
    }

    function resolvePanel(market, chartElement = resolveChartElement(market)) {
      return (
        document.querySelector(market.panelSelector) ||
        chartElement?.closest("[data-market-detail-panel]") ||
        chartElement?.closest("[data-performance-chart]") ||
        chartElement?.closest(".performance-chart") ||
        chartElement?.parentElement ||
        null
      );
    }

    function getSelectedMarket() {
      const overview =
        document.querySelector("[data-market-overview]") || document;

      /*
       * Primary source of truth: selected market tab.
       *
       * Never use chart-host geometry here. A destroyed Highstock host can
       * temporarily have zero height while its tab is still the selected tab.
       */
      const selectedTab = overview.querySelector(
        '[data-market-tabs] [role="tab"][aria-selected="true"][aria-controls]',
      );

      if (selectedTab) {
        const market = marketByPanelId.get(
          selectedTab.getAttribute("aria-controls"),
        );

        if (market) {
          return market;
        }
      }

      /*
       * Fallback for page/tab implementations that expose panel state before
       * aria-selected is updated.
       */
      const revealedPanel = overview.querySelector(
        '[data-market-detail-panel][aria-hidden="false"]',
      );

      if (revealedPanel?.id) {
        const market = marketByPanelId.get(revealedPanel.id);

        if (market) {
          return market;
        }
      }

      /*
       * Final fallback for implementations using the native hidden attribute.
       */
      for (const market of MARKETS) {
        const panel = document.querySelector(market.panelSelector);

        if (
          panel &&
          !panel.hidden &&
          !panel.hasAttribute("hidden") &&
          panel.getAttribute("aria-hidden") !== "true"
        ) {
          return market;
        }
      }

      return null;
    }

    /* ==========================================================================
       Comparison
       ========================================================================== */

    function resolveComparisonValue(points) {
      if (!Array.isArray(points) || !points.length) {
        return null;
      }

      /*
       * Current Overview endpoint does not expose
       * a separate previous-close field.
       */
      return toFiniteNumber(points[0]?.[1]);
    }

    /* ==========================================================================
       Chart Configuration
       ========================================================================== */

    function createChartOptions(market, panel, initialPoints) {
      const labels = getAxisLabels();

      const comparisonValue = resolveComparisonValue(initialPoints);

      return {
        context: "overview",

        symbol: market.symbol,

        name: getMarketName(market),

        /*
         * Overview displays index values, not monetary amounts.
         */
        currency: "",

        previousClose: comparisonValue,

        /*
         * Overview remains intentionally simple.
         */
        mode: "trend",

                showEmptyState: true,

        range: "1D",

        language: getLanguage(),

        timeZone: TIME_ZONE,

        decimals: market.decimals,

        maxPoints: MAX_POINTS,

        /*
         * Keep the complete available intraday session visible.
         */
        liveWindowDuration: LIVE_WINDOW_DURATION,

        /*
         * Fresh active-market creation gets one restrained initial draw.
         * Live ticks and controller refreshes remain non-animated.
         */
        animation: {
          duration: 450,
        },

        xAxisTitle: labels.time,

        yAxisTitle: labels.value,

        capabilities: {
          intraday: true,

          historical: false,

          live: true,

          navigator: true,

          intradayRange: "1D",
        },

        axis: {
          x: {
            labels: true,

            rotation: 0,

            showFirstLabel: true,

            showLastLabel: true,

            minPadding: 0,

            maxPadding: 0,
          },

          y: {
            /*
             * Physically right in both LTR/RTL.
             */
            opposite: true,

            labels: true,

            minPadding: 0.06,

            maxPadding: 0.06,

            format: {
              decimals: market.decimals,

              useGrouping: true,
            },
          },
        },

        dateFormats: {
          "1D": {
            hour: "2-digit",

            minute: "2-digit",

            hourCycle: "h23",
          },
        },

        tooltipDateFormats: {
          "1D": {
            day: "2-digit",

            month: "short",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit",

            second: "2-digit",

            hourCycle: "h23",
          },
        },

        ranges: {
          "1D": {
            comparisonValue,

            trend: initialPoints,
          },
        },

        controls: {
          root: panel,
        },

        /* ----------------------------------------------------------------------
           Navigator
           ---------------------------------------------------------------------- */

        navigatorEnabled: true,

        navigator: {
          enabled: true,

          labels: true,

          height: 32,

          margin: 12,

          handles: true,

          handleWidth: 7,

          handleHeight: 14,

          labelY: -5,

          showFirstLabel: true,

          showLastLabel: true,

          tickPixelInterval: 120,

          dataGrouping: false,
        },

        /* ----------------------------------------------------------------------
           Export
           ---------------------------------------------------------------------- */

        exporting: {
          enabled: false,
        },

        /* ----------------------------------------------------------------------
           Live
           ---------------------------------------------------------------------- */

        live: {
          enabled: true,

          interval: LIVE_INTERVAL,

          alignToInterval: true,

          /*
           * Initial snapshot was fetched before Highstock creation.
           */
          immediate: false,

          /*
           * Browser-tab visibility only.
           */
          pauseWhenHidden: true,

          retry: true,

          autostart: true,

          requestTimeout: REQUEST_TIMEOUT,

          async fetchUpdates({ signal, since, fullSnapshot = false } = {}) {
            const snapshot = await requestSnapshot(market, signal);

            const points = selectLivePoints(
              snapshot,
              fullSnapshot ? null : since,
            );

            /*
             * No valid delta:
             * true no-op.
             */
            if (!points.length) {
              return null;
            }

            return {
              points,
            };
          },

          onError(error, metadata) {
            if (isAbortError(error)) {
              return;
            }

            console.error(`${market.symbol} live chart update failed.`, {
              error,
              metadata,
            });
          },
        },

        accessibilityDescription: isArabic()
          ? `الأداء اللحظي لمؤشر ${getMarketName(market)}.`
          : `${getMarketName(market)} intraday market performance.`,

        messages: getMessages(market),
      };
    }

    /* ==========================================================================
       Runtime Destruction
       ========================================================================== */

    function destroyActiveRuntime() {
      const runtime = activeRuntime;

      if (!runtime) {
        return;
      }

      /*
       * Immediately detach it from global state so no later callback considers
       * this market active.
       */
      activeRuntime = null;

      try {
        runtime.controller?.destroy();
      } catch (error) {
        console.error(
          `${runtime.market.symbol} chart destruction failed.`,
          error,
        );
      }

      if (runtime.panel.marketChartController === runtime.controller) {
        delete runtime.panel.marketChartController;
      }
    }

    /* ==========================================================================
       Pending Initial Request
       ========================================================================== */

    function cancelPendingCreation() {
      if (!pendingCreation) {
        return;
      }

      pendingCreation.controller.abort();

      pendingCreation = null;
    }

    /* ==========================================================================
       Runtime Creation
       ========================================================================== */

    async function createRuntime(market, signal) {
      const chartElement = resolveChartElement(market);

      if (!chartElement) {
        console.warn(
          `${market.symbol} chart element was not found: ${market.chartSelector}`,
        );

        return null;
      }

      const panel = resolvePanel(market, chartElement);

      if (!panel) {
        console.warn(`${market.symbol} chart panel could not be resolved.`);

        return null;
      }

      panel.setAttribute("aria-busy", "true");

      chartElement.dataset.chartState = "loading";

      let initialPoints = [];

      try {
        /*
         * API first.
         *
         * Highstock is not constructed until the selected market snapshot
         * is available.
         */
        initialPoints = await requestSnapshot(market, signal);
      } catch (error) {
        if (isAbortError(error)) {
          panel.setAttribute("aria-busy", "false");

          return null;
        }

        /*
         * Allow live polling to recover from a temporary initial API failure.
         */
        console.error(`${market.symbol} initial chart request failed.`, error);
      }

      if (destroyed || signal.aborted) {
        panel.setAttribute("aria-busy", "false");

        return null;
      }

      let controller = null;

      try {
        controller = chartAPI.create(
          chartElement,
          createChartOptions(market, panel, initialPoints),
        );

        if (!controller) {
          throw new Error(`${market.symbol} chart controller was not created.`);
        }

        const runtime = {
          market,
          panel,
          chartElement,
          controller,
        };

        panel.marketChartController = controller;

        panel.setAttribute("aria-busy", "false");

        return runtime;
      } catch (error) {
        controller?.destroy();

        panel.setAttribute("aria-busy", "false");

        console.error(`${market.symbol} chart initialization failed.`, error);

        return null;
      }
    }

    /* ==========================================================================
       Selected Market Synchronization
       ========================================================================== */

    async function synchronizeSelectedMarket() {
      syncFrame = null;

      if (destroyed || !chartAPI) {
        return;
      }

      const market = getSelectedMarket();

      /*
       * Already exactly the market we need.
       */
      if (market && activeRuntime?.market?.key === market.key) {
        activeRuntime.controller?.getChart()?.reflow();

        return;
      }

      /*
       * Same market is already loading.
       */
      if (
        market &&
        !activeRuntime &&
        pendingCreation?.marketKey === market.key
      ) {
        return;
      }

      const revision = ++syncRevision;

      /*
       * Any previous initial request is no longer useful.
       */
      cancelPendingCreation();

      /*
       * The old market must disappear completely.
       *
       * No hidden Highstock instance survives while the selected market loads.
       */
      destroyActiveRuntime();

      if (!market) {
        return;
      }

      const creationController = new AbortController();

      pendingCreation = {
        marketKey: market.key,

        controller: creationController,
      };

      const runtime = await createRuntime(market, creationController.signal);

      if (pendingCreation?.controller === creationController) {
        pendingCreation = null;
      }

      /*
       * The user may have selected another tab while the network request
       * was in flight.
       */
      if (
        destroyed ||
        creationController.signal.aborted ||
        revision !== syncRevision ||
        getSelectedMarket()?.key !== market.key
      ) {
        runtime?.controller?.destroy();

        return;
      }

      activeRuntime = runtime;

      if (runtime) {
        console.info(
          `[Market Chart] ${market.symbol} active — one Highstock instance.`,
        );
      }
    }

    function scheduleSelectedMarketSync() {
      if (destroyed || syncFrame !== null) {
        return;
      }

      /*
       * One frame lets the page's tab component finish updating:
       *
       * - aria-selected
       * - aria-hidden
       * - hidden
       * - classes
       */
      syncFrame = window.requestAnimationFrame(() => {
        void synchronizeSelectedMarket();
      });
    }

    /* ==========================================================================
       Market Tab Events
       ========================================================================== */

    function bindMarketActivity() {
      const root = document.querySelector("[data-market-overview]") || document;

      /*
       * React only to actual market-tab clicks.
       *
       * Range/export/utility clicks must not trigger ownership reconciliation.
       */
      root.addEventListener(
        "click",
        (event) => {
          const tab = event.target?.closest?.(
            '[data-market-tabs] [role="tab"][aria-controls]',
          );

          if (
            !tab ||
            !root.contains(tab) ||
            tab.disabled ||
            tab.getAttribute("aria-disabled") === "true"
          ) {
            return;
          }

          scheduleSelectedMarketSync();
        },
        {
          passive: true,

          signal: listenerController.signal,
        },
      );

      /*
       * Bootstrap-compatible tab event.
       */
      root.addEventListener("shown.bs.tab", scheduleSelectedMarketSync, {
        signal: listenerController.signal,
      });

      /*
       * Optional application-level market-view event.
       */
      root.addEventListener("marketviewchange", scheduleSelectedMarketSync, {
        signal: listenerController.signal,
      });

      window.addEventListener("hashchange", scheduleSelectedMarketSync, {
        signal: listenerController.signal,
      });
    }

    /* ==========================================================================
       Chart API Readiness
       ========================================================================== */

    function waitForChartAPI() {
      return new Promise((resolve, reject) => {
        const started = performance.now();

        function check() {
          if (destroyed) {
            reject(createAbortError());

            return;
          }

          const api = window.SEMarketCharts;

          if (api && typeof api.create === "function") {
            resolve(api);

            return;
          }

          if (performance.now() - started >= API_READY_TIMEOUT) {
            reject(
              new Error(
                "SEMarketCharts did not become available within 10 seconds.",
              ),
            );

            return;
          }

          window.setTimeout(check, 25);
        }

        check();
      });
    }

    function waitForDOM() {
      if (document.readyState !== "loading") {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve, {
          once: true,
        });
      });
    }

    /* ==========================================================================
       Teardown
       ========================================================================== */

    function destroyOverviewCharts() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      syncRevision += 1;

      listenerController.abort();

      if (syncFrame !== null) {
        window.cancelAnimationFrame(syncFrame);

        syncFrame = null;
      }

      cancelPendingCreation();

      destroyActiveRuntime();

      chartAPI = null;
    }

    /* ==========================================================================
       Initialization
       ========================================================================== */

    async function initializeOverviewCharts() {
      try {
        await waitForDOM();

        chartAPI = await waitForChartAPI();

        if (destroyed) {
          return;
        }

        bindMarketActivity();

        /*
         * Initial page:
         *
         * fetch + create ONLY the selected market.
         */
        await synchronizeSelectedMarket();

        window.addEventListener("pagehide", destroyOverviewCharts, {
          once: true,
        });

        console.info(
          "[Market Chart] Overview single-runtime architecture ready.",
          {
            activeChartLimit: 1,

            runtimeCache: false,

            mutationObservers: 0,

            maxIntradayPoints: MAX_POINTS,

            liveInterval: LIVE_INTERVAL,

            timeZone: TIME_ZONE,
          },
        );
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        console.error("Market Overview chart initialization failed.", error);
      }
    }

    void initializeOverviewCharts();
  })();
================
  (() => {
    "use strict";

    /* ==========================================================================
       Main Market Performance — Production Integration
       ==========================================================================

       Uses the shared SEMarketCharts controller exposed by the Vite bundle.

       Production responsibilities owned here:

       - resolve the real backend endpoints/configuration
       - normalize intraday + historical backend payloads
       - build canonical named range records
       - provide live catch-up batches through fetchUpdates()
       - bind export / compare / live-status UI
       - create exactly one Market Performance chart runtime
       ========================================================================== */

    if (window.__mainMarketPerformanceInitialized) {
      return;
    }

    window.__mainMarketPerformanceInitialized = true;

    /* ==========================================================================
       Constants
       ========================================================================== */

    const TIME_ZONE = "Asia/Riyadh";
    const RIYADH_OFFSET = "+03:00";

    const LIVE_INTERVAL = 60_000;
    const LIVE_CANDLE_BUCKET = 60_000;

    const REQUEST_TIMEOUT = 10_000;
    const CHART_API_TIMEOUT = 10_000;

    /*
     * A one-minute series can safely retain a complete trading session plus
     * hidden-tab catch-up headroom without becoming remotely expensive for
     * Highstock.
     */
    const MAX_LIVE_POINTS = 900;
    const MAX_HISTORICAL_POINTS = 1_000;

    const DAY = 24 * 60 * 60 * 1_000;

    const RANGE_WINDOWS = Object.freeze({
      "1W": 7 * DAY,
      "1M": 30 * DAY,
      "3M": 90 * DAY,
      "6M": 180 * DAY,
      "1Y": 365 * DAY,
      "5Y": 5 * 365 * DAY,
      ALL: null,
    });

    const CANDLE_BUCKETS = Object.freeze({
      "1D": LIVE_CANDLE_BUCKET,
      "1W": DAY,
      "1M": DAY,
      "3M": 7 * DAY,
      "6M": 7 * DAY,
      "1Y": 30 * DAY,
      "5Y": 90 * DAY,
      ALL: 365 * DAY,
    });

    const LIVE_STATUS_LABELS = Object.freeze({
      live: {
        open: true,
        en: "Live",
        ar: "مباشر",
      },

      updating: {
        open: true,
        en: "Live",
        ar: "مباشر",
      },

      waiting: {
        open: true,
        en: "Live",
        ar: "مباشر",
      },

      starting: {
        open: true,
        en: "Live",
        ar: "مباشر",
      },

      offline: {
        open: false,
        en: "Offline",
        ar: "غير متصل",
      },

      hidden: {
        open: false,
        en: "Paused",
        ar: "متوقف مؤقتاً",
      },

      paused: {
        open: false,
        en: "Paused",
        ar: "متوقف مؤقتاً",
      },

      stopped: {
        open: false,
        en: "Closed",
        ar: "مغلق",
      },

      error: {
        open: false,
        en: "Reconnecting",
        ar: "إعادة الاتصال",
      },

      idle: {
        open: false,
        en: "Closed",
        ar: "مغلق",
      },

      destroyed: {
        open: false,
        en: "Closed",
        ar: "مغلق",
      },
    });

    /* ==========================================================================
       Runtime
       ========================================================================== */

    const pageController = new AbortController();

    const { signal: pageSignal } = pageController;

    let root = null;

    let chartElement = null;

    let titleElement = null;

    let exportRoot = null;

    let exportTrigger = null;

    let exportMenu = null;

    let compareButton = null;

    let liveStatusText = null;

    let liveStatusIcon = null;

    let serverConfiguration = null;

    let marketChartAPI = null;

    let controller = null;

    let destroyed = false;

    /* ==========================================================================
       DOM
       ========================================================================== */

    function resolveDOM() {
      root = document.querySelector("[data-performance-chart]");

      if (!root) {
        throw new Error("Main Market Performance root is missing.");
      }

      chartElement = root.querySelector("[data-market-chart]");

      if (!chartElement) {
        throw new Error("Main Market Performance chart element is missing.");
      }

      titleElement = root.querySelector(".chart-toolbar__title");

      exportRoot = root.querySelector("[data-chart-export]");

      exportTrigger = exportRoot?.querySelector("[data-chart-export-trigger]");

      exportMenu = exportRoot?.querySelector("[data-chart-export-menu]");

      compareButton = root.querySelector("[data-chart-compare]");

      liveStatusText = root.querySelector("[data-chart-live-status]");

      liveStatusIcon = root.querySelector(".market-status");
    }

    /* ==========================================================================
       Server Configuration
       ========================================================================== */

    function resolveServerConfiguration() {
      const external =
        window.marketPerformanceConfig &&
        typeof window.marketPerformanceConfig === "object"
          ? window.marketPerformanceConfig
          : {};

      return Object.freeze({
        symbol:
          external.symbol ||
          root.dataset.chartSymbol ||
          root.dataset.chartCompanySymbol ||
          "${requestScope.chart_tasi_current_sector}",

        parameter: external.parameter || root.dataset.chartParameter || null,

        jwtToken:
          external.jwtToken ||
          root.dataset.chartToken ||
          document.querySelector("[data-chart-token]")?.dataset.chartToken ||
          "",

        pageName:
          external.pageName || root.dataset.chartPageName || "MainMarketWatch",

        intradayChartType:
          external.intradayChartType ||
          root.dataset.chartIntraday ||
          root.dataset.chartIntrady ||
          "SQL_MI_MSPV",

        historicalChartType:
          external.historicalChartType ||
          root.dataset.chartHistorical ||
          "SQL_T_IC_ALL_PER",

        /*
         * Main Market Performance
         * is an index chart, not a
         * monetary chart.
         */
        currency: "",

        /*
         * Match the validated static
         * build: display whole index
         * values while preserving
         * source precision.
         */
        decimals: 0,
      });
    }

    /* ==========================================================================
       Locale
       ========================================================================== */

    function getLanguage() {
      return document.documentElement.lang || "en";
    }

    function isArabic() {
      return String(getLanguage()).toLowerCase().startsWith("ar");
    }

    function getChartName() {
      return titleElement?.textContent?.trim() || "Main Market Performance";
    }

    function getLabels() {
      return isArabic()
        ? {
            time: "الوقت",
            date: "التاريخ",
            value: "قيمة المؤشر",
          }
        : {
            time: "Time",
            date: "Date",
            value: "Index Value",
          };
    }

    function getMessages() {
      const name = getChartName();

      return isArabic()
        ? {
            loading: `جارٍ تحميل بيانات ${name}…`,

            empty: `بيانات ${name} غير متاحة حالياً.`,

            error: `تعذر تحميل بيانات ${name}.`,
          }
        : {
            loading: `Loading ${name} data…`,

            empty: `${name} data is currently unavailable.`,

            error: `${name} data could not be loaded.`,
          };
    }

    /* ==========================================================================
       Generic Helpers
       ========================================================================== */

    function isPlainObject(value) {
      return Boolean(
        value && typeof value === "object" && !Array.isArray(value),
      );
    }

    function toFiniteNumber(value) {
      if (
        value === null ||
        value === undefined ||
        typeof value === "boolean" ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return null;
      }

      const normalized =
        typeof value === "string" ? value.replaceAll(",", "").trim() : value;

      const number = Number(normalized);

      return Number.isFinite(number) ? number : null;
    }

    function getCloseValue(point) {
      if (!Array.isArray(point)) {
        return null;
      }

      return toFiniteNumber(point.length >= 5 ? point[4] : point[1]);
    }

    function createAbortError(message = "The request was cancelled.") {
      const error = new Error(message);

      error.name = "AbortError";

      return error;
    }

    function isAbortError(error) {
      return error?.name === "AbortError";
    }

    /* ==========================================================================
       Timestamp Normalization
       ========================================================================== */

    function toTimestamp(value) {
      if (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return null;
      }

      const text = String(value).trim();

      /* ------------------------------------------------------------------------
         Numeric Epoch
         ------------------------------------------------------------------------ */

      if (typeof value === "number" || /^\d+$/.test(text)) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
          return null;
        }

        return number < 10_000_000_000 ? number * 1_000 : number;
      }

      /* ------------------------------------------------------------------------
         Already Zoned
         ------------------------------------------------------------------------ */

      if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
        const timestamp = Date.parse(text);

        return Number.isFinite(timestamp) ? timestamp : null;
      }

      /* ------------------------------------------------------------------------
         Date Only
         ------------------------------------------------------------------------ */

      const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

      if (dateOnly) {
        const [, year, month, day] = dateOnly;

        /*
         * Noon Riyadh keeps the
         * historical trading date
         * stable regardless of the
         * visitor's timezone.
         */
        const timestamp = Date.parse(
          `${year}-${month}-${day}T12:00:00${RIYADH_OFFSET}`,
        );

        return Number.isFinite(timestamp) ? timestamp : null;
      }

      /* ------------------------------------------------------------------------
         Riyadh Local DateTime
         ------------------------------------------------------------------------ */

      const localDateTime = text.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
      );

      if (localDateTime) {
        const [
          ,
          year,
          month,
          day,
          hour,
          minute,
          second = "00",
          milliseconds = "",
        ] = localDateTime;

        const fraction = milliseconds ? `.${milliseconds.padEnd(3, "0")}` : "";

        const timestamp = Date.parse(
          `${year}-${month}-${day}T${hour.padStart(
            2,
            "0",
          )}:${minute}:${second}${fraction}${RIYADH_OFFSET}`,
        );

        return Number.isFinite(timestamp) ? timestamp : null;
      }

      /* ------------------------------------------------------------------------
         Browser-Supported Fallback
         ------------------------------------------------------------------------ */

      const timestamp = Date.parse(text);

      return Number.isFinite(timestamp) ? timestamp : null;
    }

    /* ==========================================================================
       Payload Normalization
       ========================================================================== */

    function unwrapPayload(payload) {
      if (Array.isArray(payload)) {
        return payload;
      }

      if (!isPlainObject(payload)) {
        return [];
      }

      return (
        [payload.data, payload.items, payload.results, payload.rows].find(
          Array.isArray,
        ) || []
      );
    }

    function normalizeSnapshot(payload) {
      const source = unwrapPayload(payload);

      const trendByTimestamp = new Map();

      const candlesByTimestamp = new Map();

      for (const item of source) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const timestamp = toTimestamp(
          item.dateTime ?? item.timestamp ?? item.time ?? item.date,
        );

        if (timestamp === null) {
          continue;
        }

        const close = toFiniteNumber(
          item.closePrice ??
            item.close ??
            item.indexPrice ??
            item.value ??
            item.price,
        );

        /*
         * Zero is not a valid
         * market-index observation.
         */
        if (close !== null && close !== 0) {
          trendByTimestamp.set(timestamp, [timestamp, close]);
        }

        /*
         * Preserve real backend OHLC
         * when available.
         */
        const open = toFiniteNumber(item.openPrice ?? item.open);

        const high = toFiniteNumber(item.highPrice ?? item.high);

        const low = toFiniteNumber(item.lowPrice ?? item.low);

        if (open === null || high === null || low === null || close === null) {
          continue;
        }

        if (
          high < Math.max(open, close) ||
          low > Math.min(open, close) ||
          high < low
        ) {
          continue;
        }

        candlesByTimestamp.set(timestamp, [timestamp, open, high, low, close]);
      }

      return {
        trend: [...trendByTimestamp.values()].sort(
          (first, second) => first[0] - second[0],
        ),

        candlestick: [...candlesByTimestamp.values()].sort(
          (first, second) => first[0] - second[0],
        ),
      };
    }

    /* ==========================================================================
       Backend URL
       ========================================================================== */

    function getChartParameter() {
      return String(
        serverConfiguration.parameter || serverConfiguration.symbol || "",
      ).toLowerCase();
    }

    function buildMarketUrl(chartType) {
      if (!chartType) {
        throw new Error("Market chart type is missing.");
      }

      if (!serverConfiguration.symbol) {
        throw new Error("Main Market chart symbol is missing.");
      }

      if (!serverConfiguration.jwtToken) {
        throw new Error("Main Market chart JWT token is missing.");
      }

      const params = new URLSearchParams();

      params.set("methodType", "parsingMethod");

      params.set("chart-type", chartType);

      params.set("chart-parameter", getChartParameter());

      params.set("format", "json");

      params.set("pageName", serverConfiguration.pageName);

      params.set("jwtToken", serverConfiguration.jwtToken);

      /*
       * Keep the application's
       * existing backend route
       * contract unchanged.
       */
      return "/api?" + params.toString();
    }

    /* ==========================================================================
       Backend Request
       ========================================================================== */

    async function requestSnapshot(chartType, externalSignal = null) {
      const requestController = new AbortController();

      let timedOut = false;

      const forwardAbort = () => {
        requestController.abort();
      };

      if (externalSignal) {
        if (externalSignal.aborted) {
          throw externalSignal.reason || createAbortError();
        }

        externalSignal.addEventListener("abort", forwardAbort, {
          once: true,
        });
      }

      const timeoutId = window.setTimeout(() => {
        timedOut = true;

        requestController.abort();
      }, REQUEST_TIMEOUT);

      try {
        const response = await fetch(buildMarketUrl(chartType), {
          method: "GET",

          credentials: "same-origin",

          signal: requestController.signal,

          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Market chart request failed with HTTP ${response.status}.`,
          );
        }

        return normalizeSnapshot(await response.json());
      } catch (error) {
        if (timedOut) {
          const timeoutError = new Error("Market chart request timed out.");

          timeoutError.name = "TimeoutError";

          throw timeoutError;
        }

        if (externalSignal?.aborted) {
          throw externalSignal.reason || createAbortError();
        }

        if (requestController.signal.aborted) {
          throw createAbortError();
        }

        throw error;
      } finally {
        window.clearTimeout(timeoutId);

        externalSignal?.removeEventListener("abort", forwardAbort);
      }
    }

    /* ==========================================================================
       Sorted Range Helpers
       ========================================================================== */

    function lowerBound(points, timestamp) {
      let low = 0;
      let high = points.length;

      while (low < high) {
        const middle = (low + high) >> 1;

        if (points[middle][0] < timestamp) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }

      return low;
    }

    function upperBound(points, timestamp) {
      let low = 0;
      let high = points.length;

      while (low < high) {
        const middle = (low + high) >> 1;

        if (points[middle][0] <= timestamp) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }

      return low;
    }

    function sliceByTime(points, minimum, maximum) {
      if (!Array.isArray(points) || !points.length) {
        return [];
      }

      return points.slice(
        lowerBound(points, minimum),

        upperBound(points, maximum),
      );
    }

    /* ==========================================================================
       Historical Downsampling
       ========================================================================== */

    function downsampleTrend(points, maximumPoints) {
      if (!Array.isArray(points) || points.length <= maximumPoints) {
        return points;
      }

      if (maximumPoints <= 2) {
        return [points[0], points.at(-1)];
      }

      const first = points[0];

      const last = points.at(-1);

      const interior = points.slice(1, -1);

      const targetInterior = Math.max(2, maximumPoints - 2);

      /*
       * Preserve local extrema instead
       * of selecting only evenly-spaced
       * samples. This keeps meaningful
       * historical shape.
       */
      const pairBudget = Math.max(1, Math.floor(targetInterior / 2));

      const bucketSize = Math.ceil(interior.length / pairBudget);

      const sampled = [first];

      for (let start = 0; start < interior.length; start += bucketSize) {
        const bucket = interior.slice(start, start + bucketSize);

        if (!bucket.length) {
          continue;
        }

        let minPoint = bucket[0];

        let maxPoint = bucket[0];

        for (const point of bucket) {
          if (point[1] < minPoint[1]) {
            minPoint = point;
          }

          if (point[1] > maxPoint[1]) {
            maxPoint = point;
          }
        }

        if (minPoint[0] === maxPoint[0]) {
          sampled.push(minPoint);
        } else if (minPoint[0] < maxPoint[0]) {
          sampled.push(minPoint, maxPoint);
        } else {
          sampled.push(maxPoint, minPoint);
        }
      }

      sampled.push(last);

      if (sampled.length <= maximumPoints) {
        return sampled;
      }

      /*
       * A final uniform reduction keeps
       * the requested hard cap after
       * extrema preservation.
       */
      const result = [sampled[0]];

      const step = (sampled.length - 1) / (maximumPoints - 1);

      for (let index = 1; index < maximumPoints - 1; index += 1) {
        result.push(sampled[Math.round(index * step)]);
      }

      result.push(sampled.at(-1));

      return result;
    }

    /* ==========================================================================
       Candle Aggregation
       ========================================================================== */

    function aggregateCandles(candles, bucketSize) {
      if (!Array.isArray(candles) || !candles.length) {
        return [];
      }

      const result = [];

      let current = null;

      for (const candle of candles) {
        const [timestamp, open, high, low, close] = candle;

        const bucket = Math.floor(timestamp / bucketSize) * bucketSize;

        if (!current || current[0] !== bucket) {
          if (current) {
            result.push(current);
          }

          current = [bucket, open, high, low, close];

          continue;
        }

        current[2] = Math.max(current[2], high);

        current[3] = Math.min(current[3], low);

        current[4] = close;
      }

      if (current) {
        result.push(current);
      }

      return result;
    }

    function createCandlesFromSamples(points, bucketSize) {
      if (!Array.isArray(points) || !points.length) {
        return [];
      }

      const result = [];

      let current = null;

      /*
       * When real OHLC is unavailable,
       * derive candles only from observed
       * index samples. No artificial wick
       * values are invented.
       */
      for (const [timestamp, value] of points) {
        const bucket = Math.floor(timestamp / bucketSize) * bucketSize;

        if (!current || current[0] !== bucket) {
          if (current) {
            result.push(current);
          }

          current = [bucket, value, value, value, value];

          continue;
        }

        current[2] = Math.max(current[2], value);

        current[3] = Math.min(current[3], value);

        current[4] = value;
      }

      if (current) {
        result.push(current);
      }

      return result;
    }

    /* ==========================================================================
       Range Records
       ========================================================================== */

    function createRangeRecord({
      range,
      trend,
      candles,
      minimum,
      maximum,
      referenceClose = null,
    }) {
      const rawTrend = sliceByTime(trend, minimum, maximum);

      const displayTrend =
        range === "1D"
          ? rawTrend.slice(-MAX_LIVE_POINTS)
          : downsampleTrend(rawTrend, MAX_HISTORICAL_POINTS);

      const sourceCandles = sliceByTime(candles, minimum, maximum);

      const bucketSize = CANDLE_BUCKETS[range];

      const candlestick = sourceCandles.length
        ? aggregateCandles(sourceCandles, bucketSize)
        : createCandlesFromSamples(rawTrend, bucketSize);

      return {
        comparisonValue:
          referenceClose ?? rawTrend[0]?.[1] ?? candlestick[0]?.[1] ?? null,

        trend: displayTrend,

        candlestick,
      };
    }

    /* ==========================================================================
       Named Ranges
       ========================================================================== */

    function createRanges(intraday, historical) {
      const ranges = {};

      /*
       * Use the latest historical
       * close as the 1D comparison
       * baseline.
       *
       * This avoids comparing today's
       * current movement with today's
       * first intraday observation.
       */
      const historicalReference = historical.trend.length
        ? historical.trend
        : historical.candlestick;

      const previousClose = historicalReference.length
        ? getCloseValue(historicalReference.at(-1))
        : null;

      const intradayReference = intraday.trend.length
        ? intraday.trend
        : intraday.candlestick;

      /* ------------------------------------------------------------------------
         1D
         ------------------------------------------------------------------------ */

      if (intradayReference.length) {
        const first = intradayReference[0][0];

        const end = intradayReference.at(-1)[0];

        ranges["1D"] = createRangeRecord({
          range: "1D",

          trend: intraday.trend,

          candles: intraday.candlestick,

          minimum: first,

          maximum: end,

          referenceClose: previousClose,
        });
      }

      /* ------------------------------------------------------------------------
         Historical
         ------------------------------------------------------------------------ */

      if (!historicalReference.length) {
        return ranges;
      }

      const historicalStart = historicalReference[0][0];

      const historicalEnd = historicalReference.at(-1)[0];

      for (const [range, duration] of Object.entries(RANGE_WINDOWS)) {
        const minimum =
          duration === null
            ? historicalStart
            : Math.max(historicalStart, historicalEnd - duration);

        const record = createRangeRecord({
          range,

          trend: historical.trend,

          candles: historical.candlestick,

          minimum,

          maximum: historicalEnd,
        });

        if (record.trend.length || record.candlestick.length) {
          ranges[range] = record;
        }
      }

      return ranges;
    }

    /* ==========================================================================
       Live Reconciliation
       ========================================================================== */

    function selectLivePoints(snapshot, since) {
      /*
       * Prefer real OHLC payloads when
       * they exist for a timestamp.
       *
       * market-chart.js derives its trend
       * close from the same payload, so
       * main candlestick, trend and
       * navigator remain canonical.
       */
      const candleByTimestamp = new Map(
        snapshot.candlestick.map((point) => [point[0], point]),
      );

      const scalarByTimestamp = new Map(
        snapshot.trend.map((point) => [point[0], point]),
      );

      const timestamps = new Set([
        ...scalarByTimestamp.keys(),
        ...candleByTimestamp.keys(),
      ]);

      if (!timestamps.size) {
        return [];
      }

      const ordered = [...timestamps].sort((first, second) => first - second);

      const sinceTimestamp = toTimestamp(since);

      /*
       * Inclusive boundary is
       * intentional.
       *
       * It supports both:
       *
       * - correction of the latest known
       *   timestamp
       * - chronological catch-up of all
       *   newer timestamps after a hidden
       *   browser tab resumes
       *
       * An unchanged boundary point is a
       * controller-level noop.
       */
      const selected =
        sinceTimestamp === null
          ? ordered.slice(-MAX_LIVE_POINTS)
          : ordered.filter((timestamp) => timestamp >= sinceTimestamp);

      return selected
        .map(
          (timestamp) =>
            candleByTimestamp.get(timestamp) ||
            scalarByTimestamp.get(timestamp),
        )
        .filter(Boolean);
    }

    /* ==========================================================================
       Initial Data
       ========================================================================== */

    async function loadInitialData() {
      const [intradayResult, historicalResult] = await Promise.allSettled([
        requestSnapshot(
          serverConfiguration.intradayChartType,

          pageSignal,
        ),

        requestSnapshot(
          serverConfiguration.historicalChartType,

          pageSignal,
        ),
      ]);

      if (pageSignal.aborted) {
        throw pageSignal.reason || createAbortError();
      }

      const empty = {
        trend: [],
        candlestick: [],
      };

      const intraday =
        intradayResult.status === "fulfilled" ? intradayResult.value : empty;

      const historical =
        historicalResult.status === "fulfilled"
          ? historicalResult.value
          : empty;

      if (
        intradayResult.status === "rejected" &&
        !isAbortError(intradayResult.reason)
      ) {
        console.error(
          "Intraday Market Performance request failed.",
          intradayResult.reason,
        );
      }

      if (
        historicalResult.status === "rejected" &&
        !isAbortError(historicalResult.reason)
      ) {
        console.error(
          "Historical Market Performance request failed.",
          historicalResult.reason,
        );
      }

      return {
        intraday,

        historical,

        ranges: createRanges(intraday, historical),
      };
    }

    /* ==========================================================================
       Chart Configuration
       ========================================================================== */

    function createChartConfiguration(initialData) {
      const labels = getLabels();

      const previousClose = initialData.ranges?.["1D"]?.comparisonValue ?? null;

      return {
        context: "performance",

        symbol: serverConfiguration.symbol,

        name: getChartName(),

        /*
         * No currency row for an
         * index chart.
         */
        currency: "",

        previousClose,

        range: "1D",

        mode: "trend",

        showEmptyState: true,

        language: getLanguage(),

        timeZone: TIME_ZONE,

        /*
         * Whole-number presentation.
         * Underlying points retain their
         * original precision.
         */
        decimals: 0,

        maxPoints: MAX_LIVE_POINTS,

        candleBucketSize: LIVE_CANDLE_BUCKET,

        /*
         * Initial and live view show
         * the complete active session.
         */
        liveWindowDuration: null,

        /*
         * Performance mode/range
         * transitions should remain
         * deterministic and free of
         * animation residue.
         */
        animation: {
  duration: 450,
},

        xAxisTitle: null,

        yAxisTitle: labels.value,

        capabilities: {
          intraday: true,

          historical: true,

          live: true,

          navigator: true,

          intradayRange: "1D",
        },

        axis: {
          x: {
            title: {
              "1D": labels.time,

              default: labels.date,
            },

            rotation: {
              "1D": 0,

              default: -20,
            },

            labels: true,

            showFirstLabel: true,

            showLastLabel: true,

            minPadding: 0,

            maxPadding: 0,
          },

          y: {
            /*
             * Physically right in
             * both LTR and RTL.
             */
            opposite: true,

            labels: true,

            minPadding: 0.06,

            maxPadding: 0.06,

            format: {
              decimals: 0,

              useGrouping: true,
            },
          },
        },

        dateFormats: {
          "1D": {
            hour: "2-digit",

            minute: "2-digit",

            hourCycle: "h23",
          },
        },

        tooltipDateFormats: {
          "1D": {
            day: "2-digit",

            month: "short",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit",

            second: "2-digit",

            hourCycle: "h23",
          },
        },

        ranges: initialData.ranges,

        controls: {
          root,
        },

        /* ----------------------------------------------------------------------
           Navigator
           ---------------------------------------------------------------------- */

        navigatorEnabled: true,

        navigator: {
          enabled: true,

          labels: true,

          height: 40,

          margin: 14,

          handles: true,

          handleWidth: 6,

          handleHeight: 16,

          /*
           * Same configuration used by
           * our validated static harness.
           */
          showFirstLabel: false,

          showLastLabel: false,

          tickPixelInterval: 110,

          dataGrouping: false,
        },

        /* ----------------------------------------------------------------------
           Export
           ---------------------------------------------------------------------- */

        exporting: {
          enabled: true,

          /*
           * The HTML toolbar owns the
           * visible export interface.
           */
          showContextButton: false,

          fallbackToExportServer: false,

          sourceWidth: 1_200,

          sourceHeight: 675,

          scale: 2,
        },

        /* ----------------------------------------------------------------------
           Live
           ---------------------------------------------------------------------- */

        live: {
          enabled: true,

          interval: LIVE_INTERVAL,

          alignToInterval: true,

          /*
           * Initial snapshots are already
           * fetched before chart creation.
           */
          immediate: false,

          /*
           * Browser-tab hidden:
           * live controller pauses its
           * polling work.
           */
          pauseWhenHidden: true,

          retry: true,

          autostart: true,

          requestTimeout: REQUEST_TIMEOUT,

          /*
           * Final controller contract.
           *
           * Not fetchPoint().
           */
          async fetchUpdates({ signal, since, fullSnapshot = false } = {}) {
              const snapshot = await requestSnapshot(
                serverConfiguration.intradayChartType,
                signal,
              );

              const points = selectLivePoints(
                snapshot,
                fullSnapshot ? null : since,
          );

            return points.length
              ? {
                  points,
                }
              : null;
          },

          onStateChange(state) {
            updateLiveStatusUI(state.state);
          },

          onError(error, metadata) {
            if (isAbortError(error)) {
              return;
            }

            console.error("Main Market live chart update failed.", {
              error,

              metadata,
            });
          },
        },

        accessibilityDescription: isArabic()
          ? `الأداء التاريخي واللحظي لـ ${getChartName()}.`
          : `${getChartName()} historical and live market performance.`,

        messages: getMessages(),
      };
    }

    /* ==========================================================================
       Live Status UI
       ========================================================================== */

    function updateLiveStatusUI(stateValue) {
      const mapping = LIVE_STATUS_LABELS[stateValue] || LIVE_STATUS_LABELS.idle;

      if (liveStatusText) {
        liveStatusText.textContent = isArabic() ? mapping.ar : mapping.en;
      }

      liveStatusIcon?.classList.toggle("market-status--open", mapping.open);

      liveStatusIcon?.classList.toggle("market-status--closed", !mapping.open);
    }

    function bindLiveStatus() {
      chartElement.addEventListener(
        "marketchartlivestatechange",

        (event) => {
          updateLiveStatusUI(event.detail?.state);
        },

        {
          signal: pageSignal,
        },
      );
    }

    /* ==========================================================================
       Export Filename
       ========================================================================== */

    function slugify(value) {
      return String(value || "market")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\u0600-\u06ffa-z0-9_-]+/gi, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    function getExportFileName() {
      const state = controller?.getState?.();

      return [
        slugify(getChartName()),

        String(state?.range || "1D").toLowerCase(),

        String(state?.mode || "trend").toLowerCase(),

        "performance",
      ]
        .filter(Boolean)
        .join("-");
    }

    /* ==========================================================================
       Export Menu
       ========================================================================== */

    function getExportItems() {
      return exportMenu
        ? [...exportMenu.querySelectorAll('[role="menuitem"]')]
        : [];
    }

    function isExportOpen() {
      return Boolean(exportMenu && !exportMenu.hasAttribute("hidden"));
    }

    function openExportMenu({ focusFirst = false } = {}) {
      if (!exportMenu || !exportTrigger) {
        return;
      }

      exportMenu.removeAttribute("hidden");

      exportTrigger.setAttribute("aria-expanded", "true");

      if (focusFirst) {
        getExportItems()[0]?.focus();
      }
    }

    function closeExportMenu({ restoreFocus = false } = {}) {
      if (!exportMenu || !exportTrigger) {
        return;
      }

      exportMenu.setAttribute("hidden", "");

      exportTrigger.setAttribute("aria-expanded", "false");

      if (restoreFocus) {
        exportTrigger.focus();
      }
    }

    function executeExport(action) {
      const chart = controller?.getChart?.();

      if (!chart) {
        return;
      }

      const filename = getExportFileName();

      switch (action) {
        case "fullscreen": {
          chart.fullscreen?.toggle?.();

          break;
        }

        case "print": {
          chart.print?.();

          break;
        }

        case "png": {
          chart.exportChart?.({
            type: "image/png",

            filename,
          });

          break;
        }

        case "pdf": {
          chart.exportChart?.({
            type: "application/pdf",

            filename,
          });

          break;
        }

        default:
          break;
      }
    }

    function bindExportMenu() {
      if (!exportRoot || !exportTrigger || !exportMenu) {
        return;
      }

      exportTrigger.addEventListener(
        "click",

        (event) => {
          event.preventDefault();

          event.stopPropagation();

          if (isExportOpen()) {
            closeExportMenu();

            return;
          }

          openExportMenu();
        },

        {
          signal: pageSignal,
        },
      );

      exportTrigger.addEventListener(
        "keydown",

        (event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
            return;
          }

          event.preventDefault();

          openExportMenu({
            focusFirst: true,
          });
        },

        {
          signal: pageSignal,
        },
      );

      exportMenu.addEventListener(
        "click",

        (event) => {
          const button = event.target?.closest?.("[data-export-action]");

          if (!button) {
            return;
          }

          event.preventDefault();

          event.stopPropagation();

          const action = button.dataset.exportAction;

          closeExportMenu();

          try {
            executeExport(action);
          } catch (error) {
            console.error(
              `Market chart export action "${action}" failed.`,
              error,
            );
          }
        },

        {
          signal: pageSignal,
        },
      );

      exportMenu.addEventListener(
        "keydown",

        (event) => {
          const items = getExportItems();

          if (!items.length) {
            return;
          }

          const currentIndex = items.indexOf(document.activeElement);

          if (event.key === "Escape") {
            event.preventDefault();

            closeExportMenu({
              restoreFocus: true,
            });

            return;
          }

          if (event.key === "Home") {
            event.preventDefault();

            items[0].focus();

            return;
          }

          if (event.key === "End") {
            event.preventDefault();

            items[items.length - 1].focus();

            return;
          }

          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
            return;
          }

          event.preventDefault();

          const direction = event.key === "ArrowDown" ? 1 : -1;

          const startIndex = currentIndex >= 0 ? currentIndex : 0;

          const nextIndex =
            (startIndex + direction + items.length) % items.length;

          items[nextIndex].focus();
        },

        {
          signal: pageSignal,
        },
      );

      document.addEventListener(
        "click",

        (event) => {
          if (!isExportOpen() || exportRoot.contains(event.target)) {
            return;
          }

          closeExportMenu();
        },

        {
          signal: pageSignal,
        },
      );

      document.addEventListener(
        "keydown",

        (event) => {
          if (event.key === "Escape" && isExportOpen()) {
            closeExportMenu({
              restoreFocus: true,
            });
          }
        },

        {
          signal: pageSignal,
        },
      );
    }

    /* ==========================================================================
       Compare Hook
       ========================================================================== */

    function bindCompare() {
      if (!compareButton) {
        return;
      }

      compareButton.addEventListener(
        "click",

        () => {
          const active = compareButton.getAttribute("aria-pressed") !== "true";

          compareButton.setAttribute("aria-pressed", String(active));

          compareButton.classList.toggle("is-active", active);

          /*
           * Compare business logic
           * remains outside the base
           * market chart.
           */
          root.dispatchEvent(
            new CustomEvent("marketperformancecomparechange", {
              bubbles: true,

              detail: {
                active,

                controller,
              },
            }),
          );
        },

        {
          signal: pageSignal,
        },
      );
    }

    /* ==========================================================================
       Market Chart API
       ========================================================================== */

    function waitForMarketChartAPI() {
      if (window.SEMarketCharts?.create) {
        return Promise.resolve(window.SEMarketCharts);
      }

      return new Promise((resolve, reject) => {
        const started = performance.now();

        function check() {
          if (destroyed || pageSignal.aborted) {
            reject(pageSignal.reason || createAbortError());

            return;
          }

          if (window.SEMarketCharts?.create) {
            resolve(window.SEMarketCharts);

            return;
          }

          if (performance.now() - started >= CHART_API_TIMEOUT) {
            reject(
              new Error(
                "SEMarketCharts did not become available within 10 seconds.",
              ),
            );

            return;
          }

          window.setTimeout(check, 25);
        }

        check();
      });
    }

    function waitForDOM() {
      if (document.readyState !== "loading") {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve, {
          once: true,
        });
      });
    }

    /* ==========================================================================
       Chart Creation
       ========================================================================== */

    async function createPerformanceChart() {
      root.setAttribute("aria-busy", "true");

      chartElement.dataset.chartState = "loading";

      try {
        const initialData = await loadInitialData();

        if (destroyed || pageSignal.aborted) {
          return;
        }

        controller = marketChartAPI.create(
          chartElement,

          createChartConfiguration(initialData),
        );

        if (!controller) {
          throw new Error(
            "Main Market Performance controller was not created.",
          );
        }

        root.marketChartController = controller;

        chartElement.dataset.chartState = "ready";

        updateLiveStatusUI(controller.getState().live?.state);
      } finally {
        root.setAttribute("aria-busy", "false");
      }
    }

    /* ==========================================================================
       Teardown
       ========================================================================== */

    function destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      pageController.abort();

      closeExportMenu();

      try {
        controller?.destroy?.();
      } catch (error) {
        console.error(
          "Main Market Performance chart destruction failed.",
          error,
        );
      }

      if (root?.marketChartController === controller) {
        delete root.marketChartController;
      }

      controller = null;

      marketChartAPI = null;

      root?.setAttribute("aria-busy", "false");
    }

    /* ==========================================================================
       Initialize
       ========================================================================== */

    async function initialize() {
      try {
        await waitForDOM();

        resolveDOM();

        serverConfiguration = resolveServerConfiguration();

        marketChartAPI = await waitForMarketChartAPI();

        if (destroyed || pageSignal.aborted) {
          return;
        }

        bindExportMenu();

        bindCompare();

        bindLiveStatus();

        await createPerformanceChart();

        window.addEventListener("pagehide", destroy, {
          once: true,
        });

        console.info(
          "[Market Chart] Main Market Performance production integration ready.",
          {
            liveInterval: LIVE_INTERVAL,

            maxLivePoints: MAX_LIVE_POINTS,

            maxHistoricalPoints: MAX_HISTORICAL_POINTS,

            currency: "disabled",

            decimals: 0,

            timeZone: TIME_ZONE,
          },
        );
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        root?.setAttribute("aria-busy", "false");

        if (chartElement) {
          chartElement.dataset.chartState = "error";
        }

        console.error("Main Market Performance initialization failed.", error);
      }
    }

    void initialize();
  })();
<section
            class="performance-chart market-index-chart"
            data-performance-chart
            aria-labelledby="main-market-chart-title"
            aria-busy="true"
            data-chart-company-name="<fmt:message key="tasi.portlet.title" />"
            data-chart-company-symbol="${requestScope.chart_tasi_current_sector}"
            data-chart-page-name="MainMarketWatch"
            data-chart-x-label="<fmt:message key='tasi.chart.label.date' />"
            data-chart-y-label="<fmt:message key='tasi.char.yaxis.title' />"
            data-chart-t-label="<fmt:message key='tasi.char.xaxis.title' />"
            data-chart-empty-label="<fmt:message key='tasi.empty.label' />"
            data-chart-token=""
            aria-label="Time series chart"
            data-chart-intrady="SQL_MI_MSPV"
            data-chart-historical="SQL_T_IC_ALL_PER"
          >