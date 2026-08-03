import {
  getMarketChartSeriesTheme,
  getMarketChartTheme,
} from "./market-chart-theme";

/* ==========================================================================
   Registry
   ========================================================================== */

const chartRegistry = new Map();

/* ==========================================================================
   Constants
   ========================================================================== */

const CHART_MODES = new Set(["trend", "line", "candlestick"]);

const EXPORT_ACTIONS = new Set(["fullscreen", "print", "png", "pdf"]);

/* ==========================================================================
   Element Helpers
   ========================================================================== */

function resolveElement(target) {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (typeof target === "string") {
    return document.querySelector(target);
  }

  return null;
}

function resolveControlsRoot(element, target) {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (typeof target === "string") {
    return element.closest(target) || document.querySelector(target);
  }

  return (
    element.closest("[data-performance-chart]") ||
    element.closest(".performance-chart") ||
    element.parentElement
  );
}

/* ==========================================================================
   Highcharts
   ========================================================================== */

function getHighcharts() {
  const Highcharts = window.Highcharts;

  if (!Highcharts) {
    console.error(
      "Market chart could not initialize because Highcharts is unavailable.",
    );

    return null;
  }

  if (typeof Highcharts.stockChart !== "function") {
    console.error("Market chart requires the Highcharts Stock build.");

    return null;
  }

  return Highcharts;
}

/* ==========================================================================
   Preferences
   ========================================================================== */

function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getAnimationDuration() {
  return prefersReducedMotion() ? false : 200;
}

/* ==========================================================================
   Data Normalization
   ========================================================================== */

function normalizeTrendData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((point) => {
      return (
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(Number(point[0])) &&
        Number.isFinite(Number(point[1]))
      );
    })
    .map(([timestamp, value]) => {
      return [Number(timestamp), Number(value)];
    })
    .sort((first, second) => first[0] - second[0]);
}

function normalizeCandlestickData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((point) => {
      if (!Array.isArray(point) || point.length < 5) {
        return false;
      }

      return point.slice(0, 5).every((value) => {
        return Number.isFinite(Number(value));
      });
    })
    .map(([timestamp, open, high, low, close]) => {
      return [
        Number(timestamp),
        Number(open),
        Number(high),
        Number(low),
        Number(close),
      ];
    })
    .filter((point) => {
      const [, open, high, low, close] = point;

      return (
        high >= low &&
        high >= open &&
        high >= close &&
        low <= open &&
        low <= close
      );
    })
    .sort((first, second) => first[0] - second[0]);
}

function normalizeData(data, mode) {
  return mode === "candlestick"
    ? normalizeCandlestickData(data)
    : normalizeTrendData(data);
}

function normalizeRanges(ranges) {
  if (!ranges || typeof ranges !== "object") {
    return {};
  }

  return Object.entries(ranges).reduce((result, [range, record]) => {
    if (!record || typeof record !== "object") {
      return result;
    }

    result[range] = {
      trend: normalizeTrendData(record.trend),
      line: normalizeTrendData(record.line || record.trend),

      candlestick: normalizeCandlestickData(record.candlestick),
    };

    return result;
  }, {});
}

/* ==========================================================================
   State Messages
   ========================================================================== */

function removeMessage(element) {
  element.querySelector(":scope > .market-chart__message")?.remove();
}

function setMessage(element, message) {
  removeMessage(element);

  const messageElement = document.createElement("p");

  messageElement.className = "market-chart__message";
  messageElement.textContent = message;

  element.append(messageElement);
}

/* ==========================================================================
   Market Chart Controller
   ========================================================================== */

class MarketChartController {
  constructor(element, configuration, Highcharts) {
    this.element = element;
    this.Highcharts = Highcharts;

    this.configuration = {
      context: "performance",

      symbol: "",
      name: "",
      currency: "",

      mode: "trend",
      range: "1D",

      data: [],
      ranges: {},

      controls: {},

      ...configuration,
    };

    this.configuration.mode = CHART_MODES.has(this.configuration.mode)
      ? this.configuration.mode
      : "trend";

    this.ranges = normalizeRanges(this.configuration.ranges);

    this.currentMode = this.configuration.mode;
    this.currentRange = this.configuration.range;

    this.chart = null;
    this.themeObserver = null;
    this.resizeObserver = null;
    this.abortController = new AbortController();

    this.controlsRoot = resolveControlsRoot(
      element,
      this.configuration.controls?.root,
    );

    this.isComparing = false;

    this.handleThemeChange = this.handleThemeChange.bind(this);

    this.handleDocumentClick = this.handleDocumentClick.bind(this);
  }

  /* ========================================================================
     Initialization
     ===================================================================== */

  initialize() {
    this.setState("loading");

    const initialData = this.getActiveData();

    if (!initialData.length) {
      this.setState("empty", "Chart data is currently unavailable.");

      return this;
    }

    try {
      const theme = getMarketChartTheme(this.element);

      this.chart = this.Highcharts.stockChart(
        this.element,
        this.createOptions(initialData, theme),
      );

      this.bindControls();
      this.observeTheme();
      this.observeResize();
      this.updateControls();

      this.setState("ready");

      return this;
    } catch (error) {
      this.setState("error", "The chart could not be loaded.");

      console.error("Market chart initialization failed.", error);

      return this;
    }
  }

  /* ========================================================================
     Data Resolution
     ===================================================================== */

  getActiveData() {
    const rangeRecord = this.ranges[this.currentRange];

    if (rangeRecord) {
      const rangeData = rangeRecord[this.currentMode];

      if (Array.isArray(rangeData)) {
        return rangeData;
      }
    }

    return normalizeData(this.configuration.data, this.currentMode);
  }

  hasModeData(mode, range = this.currentRange) {
    const rangeRecord = this.ranges[range];

    if (rangeRecord) {
      return Boolean(rangeRecord[mode]?.length);
    }

    return Boolean(normalizeData(this.configuration.data, mode).length);
  }

  /* ========================================================================
     Highcharts Options
     ===================================================================== */

  createOptions(data, theme) {
    const { context, currency, name, symbol } = this.configuration;

    const compact = context === "overview";
    const animation = getAnimationDuration();

    return {
      chart: {
        animation,
        backgroundColor: theme.background,

        spacing: compact ? [8, 8, 8, 8] : [16, 12, 8, 8],
      },

      accessibility: {
        enabled: true,

        description: name
          ? `${name} market performance over time.`
          : "Market performance over time.",

        keyboardNavigation: {
          enabled: true,
        },

        series: {
          describeSingleSeries: true,
        },
      },

      credits: {
        enabled: false,
      },

      exporting: {
        enabled: false,

        fallbackToExportServer: false,

        filename: symbol
          ? `${symbol.toLowerCase()}-${this.currentRange.toLowerCase()}`
          : "market-chart",
      },

      legend: {
        enabled: false,
      },

      navigator: {
        enabled: false,
      },

      rangeSelector: {
        enabled: false,
      },

      scrollbar: {
        enabled: false,
      },

      title: {
        text: null,
      },

      time: {
        useUTC: false,
      },

      xAxis: {
        ordinal: true,

        lineColor: theme.border,
        tickColor: theme.border,

        labels: {
          style: {
            color: theme.muted,
            fontSize: "11px",
          },
        },

        crosshair: {
          color: theme.crosshair,
          dashStyle: "ShortDot",
        },
      },

      yAxis: {
        opposite: false,

        gridLineColor: theme.grid,
        gridLineDashStyle: "ShortDot",

        title: {
          text: null,
        },

        labels: {
          align: "end",

          style: {
            color: theme.muted,
            fontSize: "11px",
          },
        },
      },

      tooltip: {
        animation: false,

        backgroundColor: theme.tooltipBackground,
        borderColor: theme.tooltipBorder,
        borderRadius: 8,

        shared: false,

        style: {
          color: theme.text,
          fontSize: "12px",
        },

        valueDecimals: 2,
        valueSuffix: currency ? ` ${currency}` : "",

        xDateFormat: "%A, %e %B %Y, %H:%M",
      },

      plotOptions: {
        series: {
          animation,

          dataGrouping: {
            enabled: true,
          },

          marker: {
            enabled: false,

            states: {
              hover: {
                enabled: true,
                radius: 4,
              },
            },
          },

          states: {
            inactive: {
              opacity: 1,
            },
          },
        },

        area: {
          lineWidth: 2,
          threshold: null,

          states: {
            hover: {
              lineWidth: 2,
            },
          },
        },

        line: {
          lineWidth: 2,

          states: {
            hover: {
              lineWidth: 2,
            },
          },
        },

        candlestick: {
          lineWidth: 1,

          dataGrouping: {
            enabled: true,
          },
        },
      },

      series: [this.createSeriesOptions(data, theme)],
    };
  }

  createSeriesOptions(data, theme) {
    const { name, symbol } = this.configuration;

    const mode = this.currentMode;
    const type = mode === "trend" ? "area" : mode;

    return {
      id: symbol || "market-series",
      name: name || symbol || "Market",
      type,

      data,

      ...getMarketChartSeriesTheme(this.Highcharts, theme, mode),
    };
  }

  /* ========================================================================
     State
     ===================================================================== */

  setState(state, message = "") {
    this.element.dataset.chartState = state;

    const section = this.element.closest(".performance-chart");

    if (section) {
      section.setAttribute("aria-busy", String(state === "loading"));
    }

    if (state === "empty" || state === "error") {
      setMessage(this.element, message);
    } else {
      removeMessage(this.element);
    }

    if (state === "ready") {
      this.element.dataset.chartReady = "true";
    } else {
      this.element.removeAttribute("data-chart-ready");
    }
  }

  /* ========================================================================
     Range
     ===================================================================== */

  setRange(range) {
    if (!range || !Object.hasOwn(this.ranges, range)) {
      return false;
    }

    const requestedData = this.ranges[range][this.currentMode];

    if (!requestedData?.length) {
      return false;
    }

    this.currentRange = range;
    this.configuration.range = range;

    this.replaceSeries(requestedData);
    this.updateControls();

    this.element.dispatchEvent(
      new CustomEvent("marketchartchange", {
        bubbles: true,

        detail: {
          range: this.currentRange,
          mode: this.currentMode,
          symbol: this.configuration.symbol,
        },
      }),
    );

    return true;
  }

  /* ========================================================================
     Chart Mode
     ===================================================================== */

  setMode(mode) {
    if (!CHART_MODES.has(mode)) {
      return false;
    }

    if (mode === "candlestick" && this.isComparing) {
      return false;
    }

    const rangeRecord = this.ranges[this.currentRange];

    const requestedData = rangeRecord
      ? rangeRecord[mode]
      : normalizeData(this.configuration.data, mode);

    if (!requestedData?.length) {
      return false;
    }

    this.currentMode = mode;
    this.configuration.mode = mode;

    this.replaceSeries(requestedData);
    this.updateControls();

    this.element.dispatchEvent(
      new CustomEvent("marketchartchange", {
        bubbles: true,

        detail: {
          range: this.currentRange,
          mode: this.currentMode,
          symbol: this.configuration.symbol,
        },
      }),
    );

    return true;
  }

  /* ========================================================================
     Comparison
     ===================================================================== */

  setComparing(comparing) {
    this.isComparing = Boolean(comparing);

    const section = this.element.closest(
      ".market-index-chart, .performance-chart",
    );

    section?.classList.toggle("is-comparing", this.isComparing);

    section?.setAttribute("data-chart-comparing", String(this.isComparing));

    if (this.isComparing && this.currentMode === "candlestick") {
      this.setMode("trend");
    }

    this.updateControls();

    this.element.dispatchEvent(
      new CustomEvent("marketchartcompare", {
        bubbles: true,

        detail: {
          active: this.isComparing,
          controller: this,
        },
      }),
    );
  }

  /* ========================================================================
     Data Update
     ===================================================================== */

  setData(data, options = {}) {
    const normalized = normalizeData(data, options.mode || this.currentMode);

    if (!normalized.length) {
      return false;
    }

    if (options.symbol) {
      this.configuration.symbol = options.symbol;
    }

    if (options.name) {
      this.configuration.name = options.name;
    }

    if (options.currency !== undefined) {
      this.configuration.currency = options.currency;
    }

    if (options.mode && CHART_MODES.has(options.mode)) {
      this.currentMode = options.mode;
    }

    this.configuration.data = normalized;

    this.replaceSeries(normalized);
    this.updateControls();

    return true;
  }

  setRanges(ranges, options = {}) {
    const normalizedRanges = normalizeRanges(ranges);

    if (!Object.keys(normalizedRanges).length) {
      return false;
    }

    this.ranges = normalizedRanges;
    this.configuration.ranges = ranges;

    const requestedRange =
      options.range || this.currentRange || Object.keys(normalizedRanges)[0];

    if (!normalizedRanges[requestedRange]) {
      this.currentRange = Object.keys(normalizedRanges)[0];
    } else {
      this.currentRange = requestedRange;
    }

    if (!this.hasModeData(this.currentMode, this.currentRange)) {
      this.currentMode = "trend";
    }

    const data = this.getActiveData();

    if (!data.length) {
      return false;
    }

    this.replaceSeries(data);
    this.updateControls();

    return true;
  }

  /* ========================================================================
     Series Replacement
     ===================================================================== */

  replaceSeries(data) {
    if (!this.chart || !data.length) {
      return;
    }

    const theme = getMarketChartTheme(this.element);

    const existingSeries = this.chart.series.find((series) => {
      return !series.options.isInternal;
    });

    if (existingSeries) {
      existingSeries.remove(false);
    }

    this.chart.addSeries(this.createSeriesOptions(data, theme), false);

    this.updateTooltip();

    this.chart.redraw(getAnimationDuration());

    this.chart.xAxis[0]?.setExtremes(
      undefined,
      undefined,
      true,
      getAnimationDuration(),
    );
  }

  updateTooltip() {
    if (!this.chart) {
      return;
    }

    const isCandlestick = this.currentMode === "candlestick";

    this.chart.update(
      {
        tooltip: {
          shared: false,

          pointFormat: isCandlestick
            ? [
                '<span style="color:{point.color}">●</span> ',
                "<b>{series.name}</b><br/>",
                "Open: <b>{point.open:,.2f}</b><br/>",
                "High: <b>{point.high:,.2f}</b><br/>",
                "Low: <b>{point.low:,.2f}</b><br/>",
                "Close: <b>{point.close:,.2f}</b>",
              ].join("")
            : undefined,
        },
      },
      false,
      false,
      false,
    );
  }

  /* ========================================================================
     Theme
     ===================================================================== */

  updateTheme() {
    if (!this.chart) {
      return;
    }

    const theme = getMarketChartTheme(this.element);

    this.chart.update(
      {
        chart: {
          backgroundColor: theme.background,
        },

        xAxis: {
          lineColor: theme.border,
          tickColor: theme.border,

          labels: {
            style: {
              color: theme.muted,
            },
          },

          crosshair: {
            color: theme.crosshair,
          },
        },

        yAxis: {
          gridLineColor: theme.grid,

          labels: {
            style: {
              color: theme.muted,
            },
          },
        },

        tooltip: {
          backgroundColor: theme.tooltipBackground,

          borderColor: theme.tooltipBorder,

          style: {
            color: theme.text,
          },
        },
      },
      false,
      false,
      false,
    );

    const series = this.chart.series.find((item) => !item.options.isInternal);

    series?.update(
      getMarketChartSeriesTheme(this.Highcharts, theme, this.currentMode),
      false,
    );

    this.chart.redraw(false);
  }

  handleThemeChange(mutations) {
    const relevantChange = mutations.some((mutation) => {
      return [
        "data-theme",
        "data-accent",
        "data-contrast",
        "data-motion",
      ].includes(mutation.attributeName);
    });

    if (relevantChange) {
      this.updateTheme();
    }
  }

  observeTheme() {
    this.themeObserver = new MutationObserver(this.handleThemeChange);

    this.themeObserver.observe(document.documentElement, {
      attributes: true,

      attributeFilter: [
        "data-theme",
        "data-accent",
        "data-contrast",
        "data-motion",
      ],
    });
  }

  /* ========================================================================
     Resize
     ===================================================================== */

  observeResize() {
    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.chart?.reflow();
      });

      this.resizeObserver.observe(this.element);

      return;
    }

    window.addEventListener("resize", () => this.chart?.reflow(), {
      passive: true,
      signal: this.abortController.signal,
    });
  }

  reflow() {
    this.chart?.reflow();
  }

  /* ========================================================================
     Controls
     ===================================================================== */

  bindControls() {
    if (!this.controlsRoot) {
      return;
    }

    const signal = this.abortController.signal;

    const {
      rangeSelector = "[data-chart-range]",
      typeSelector = "[data-chart-type]",
      compareTrigger = "[data-chart-compare]",
      exportTrigger = ".chart-export__trigger",
      exportMenu = ".chart-export-menu",
    } = this.configuration.controls || {};

    this.rangeButtons = this.controlsRoot.querySelectorAll(rangeSelector);

    this.typeButtons = this.controlsRoot.querySelectorAll(typeSelector);

    this.compareButton = this.controlsRoot.querySelector(compareTrigger);

    this.exportTrigger = this.controlsRoot.querySelector(exportTrigger);

    this.exportMenu = this.controlsRoot.querySelector(exportMenu);

    this.rangeButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          this.setRange(button.dataset.chartRange);
        },
        { signal },
      );
    });

    this.typeButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          this.setMode(button.dataset.chartType);
        },
        { signal },
      );
    });

    this.compareButton?.addEventListener(
      "click",
      () => {
        this.setComparing(!this.isComparing);
      },
      { signal },
    );

    this.exportTrigger?.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();

        this.toggleExportMenu();
      },
      { signal },
    );

    this.exportMenu
      ?.querySelectorAll("[data-export-action]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            this.handleExport(button.dataset.exportAction);

            this.closeExportMenu();
          },
          { signal },
        );
      });

    document.addEventListener("click", this.handleDocumentClick, { signal });

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          this.closeExportMenu();

          this.exportTrigger?.focus();
        }
      },
      { signal },
    );
  }

  updateControls() {
    this.rangeButtons?.forEach((button) => {
      const active = button.dataset.chartRange === this.currentRange;

      button.classList.toggle("is-active", active);

      button.setAttribute("aria-pressed", String(active));

      const available = this.hasModeData(
        this.currentMode,
        button.dataset.chartRange,
      );

      button.disabled = !available;
      button.setAttribute("aria-disabled", String(!available));
    });

    this.typeButtons?.forEach((button) => {
      const mode = button.dataset.chartType;
      const active = mode === this.currentMode;

      const available =
        this.hasModeData(mode) && !(mode === "candlestick" && this.isComparing);

      button.classList.toggle("is-active", active);

      button.setAttribute("aria-pressed", String(active));

      button.disabled = !available;
      button.setAttribute("aria-disabled", String(!available));
    });

    if (this.compareButton) {
      this.compareButton.classList.toggle("is-active", this.isComparing);

      this.compareButton.setAttribute("aria-pressed", String(this.isComparing));
    }
  }

  /* ========================================================================
     Export Menu
     ===================================================================== */

  toggleExportMenu() {
    if (!this.exportMenu) {
      return;
    }

    const opening = this.exportMenu.hidden;

    this.exportMenu.hidden = !opening;

    this.exportTrigger?.setAttribute("aria-expanded", String(opening));

    if (opening) {
      this.exportMenu
        .querySelector('[role="menuitem"]:not(:disabled)')
        ?.focus();
    }
  }

  closeExportMenu() {
    if (!this.exportMenu) {
      return;
    }

    this.exportMenu.hidden = true;

    this.exportTrigger?.setAttribute("aria-expanded", "false");
  }

  handleDocumentClick(event) {
    const exportControl = this.exportTrigger?.closest(".chart-export");

    if (exportControl && !exportControl.contains(event.target)) {
      this.closeExportMenu();
    }
  }

  /* ========================================================================
     Export Actions
     ===================================================================== */

  async handleExport(action) {
    if (!this.chart || !EXPORT_ACTIONS.has(action)) {
      return;
    }

    switch (action) {
      case "fullscreen":
        await this.toggleFullscreen();
        break;

      case "print":
        this.chart.print();
        break;

      case "png":
        this.chart.exportChart({
          type: "image/png",
        });
        break;

      case "pdf":
        this.chart.exportChart({
          type: "application/pdf",
        });
        break;

      default:
        break;
    }
  }

  async toggleFullscreen() {
    const container = this.element.closest(".performance-chart");

    if (!container) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();

        return;
      }

      if (container.requestFullscreen) {
        await container.requestFullscreen();

        requestAnimationFrame(() => {
          this.reflow();
        });

        return;
      }

      container.classList.toggle("is-fullscreen");

      requestAnimationFrame(() => {
        this.reflow();
      });
    } catch (error) {
      console.error("Chart fullscreen action failed.", error);
    }
  }

  /* ========================================================================
     Destruction
     ===================================================================== */

  destroy() {
    this.abortController.abort();

    this.themeObserver?.disconnect();
    this.resizeObserver?.disconnect();

    this.chart?.destroy();

    this.chart = null;

    removeMessage(this.element);

    this.element.removeAttribute("data-chart-ready");

    this.element.removeAttribute("data-chart-state");

    chartRegistry.delete(this.element);
  }
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketChart(target, configuration = {}) {
  const element = resolveElement(target);
  const Highcharts = getHighcharts();

  if (!element) {
    console.error("Market chart target could not be found.");

    return null;
  }

  if (!Highcharts) {
    element.dataset.chartState = "error";

    setMessage(element, "The chart could not be loaded.");

    return null;
  }

  const existingController = chartRegistry.get(element);

  existingController?.destroy();

  const controller = new MarketChartController(
    element,
    configuration,
    Highcharts,
  ).initialize();

  chartRegistry.set(element, controller);

  return controller;
}

export function getMarketChart(target) {
  const element = resolveElement(target);

  return element ? chartRegistry.get(element) || null : null;
}

export function destroyMarketChart(target) {
  getMarketChart(target)?.destroy();
}

export function destroyAllMarketCharts() {
  [...chartRegistry.values()].forEach((controller) => {
    controller.destroy();
  });
}
