/* ==========================================================================
   Market Chart Export
   ========================================================================== */

/*
 * This module owns:
 * - Export menu disclosure
 * - Menu keyboard navigation
 * - Click-outside behavior
 * - Native fullscreen
 * - Fullscreen fallback
 * - Print
 * - PNG, JPEG, SVG and PDF export
 *
 * It does not own chart data or chart rendering.
 */

/* ==========================================================================
   Actions
   ========================================================================== */

export const MARKET_CHART_EXPORT_ACTIONS = Object.freeze({
  FULLSCREEN: "fullscreen",
  PRINT: "print",
  PNG: "png",
  JPEG: "jpeg",
  SVG: "svg",
  PDF: "pdf",
});

const SUPPORTED_ACTIONS = new Set(Object.values(MARKET_CHART_EXPORT_ACTIONS));

/* ==========================================================================
   MIME Types
   ========================================================================== */

const EXPORT_MIME_TYPES = Object.freeze({
  png: "image/png",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  pdf: "application/pdf",
});

/* ==========================================================================
   Element Helpers
   ========================================================================== */

function resolveElement(root, target) {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (typeof target === "string" && root instanceof Element) {
    return root.querySelector(target);
  }

  return null;
}

function getEnabledMenuItems(menu) {
  if (!(menu instanceof HTMLElement)) {
    return [];
  }

  return [
    ...menu.querySelectorAll(
      '[role="menuitem"]:not(:disabled):not([aria-disabled="true"])',
    ),
  ];
}

/* ==========================================================================
   Export Controller
   ========================================================================== */

export class MarketChartExportController {
  constructor(configuration = {}) {
    this.configuration = {
      root: null,
      chartElement: null,
      fullscreenElement: null,

      trigger: ".chart-export__trigger",

      menu: ".chart-export-menu",

      actionSelector: "[data-export-action]",

      getChart: null,
      onReflow: null,
      onAction: null,

      ...configuration,
    };

    this.root =
      this.configuration.root instanceof HTMLElement
        ? this.configuration.root
        : this.configuration.chartElement?.closest(
            "[data-performance-chart]",
          ) ||
          this.configuration.chartElement?.closest(".performance-chart") ||
          null;

    this.chartElement = this.configuration.chartElement;

    this.fullscreenElement = this.configuration.fullscreenElement || this.root;

    this.trigger = resolveElement(this.root, this.configuration.trigger);

    this.menu = resolveElement(this.root, this.configuration.menu);

    this.abortController = new AbortController();

    this.destroyed = false;
    this.fallbackFullscreen = false;

    this.handleTriggerClick = this.handleTriggerClick.bind(this);

    this.handleDocumentClick = this.handleDocumentClick.bind(this);

    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);

    this.handleMenuKeydown = this.handleMenuKeydown.bind(this);

    this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
  }

  /* ========================================================================
     Initialization
     ===================================================================== */

  initialize() {
    if (!this.root || !this.trigger || !this.menu) {
      return this;
    }

    const signal = this.abortController.signal;

    this.trigger.addEventListener("click", this.handleTriggerClick, { signal });

    this.menu.addEventListener(
      "click",
      (event) => {
        const actionElement = event.target.closest(
          this.configuration.actionSelector,
        );

        if (!actionElement || !this.menu.contains(actionElement)) {
          return;
        }

        const action = actionElement.dataset.exportAction;

        this.execute(action);
      },
      { signal },
    );

    this.menu.addEventListener("keydown", this.handleMenuKeydown, { signal });

    document.addEventListener("click", this.handleDocumentClick, { signal });

    document.addEventListener("keydown", this.handleDocumentKeydown, {
      signal,
    });

    document.addEventListener("fullscreenchange", this.handleFullscreenChange, {
      signal,
    });

    this.close({
      restoreFocus: false,
    });

    return this;
  }

  /* ========================================================================
     Chart
     ===================================================================== */

  getChart() {
    if (typeof this.configuration.getChart !== "function") {
      return null;
    }

    return this.configuration.getChart();
  }

  /* ========================================================================
     Menu State
     ===================================================================== */

  isOpen() {
    return Boolean(this.menu && !this.menu.hidden);
  }

  open() {
    if (!this.trigger || !this.menu || this.destroyed) {
      return false;
    }

    this.menu.hidden = false;

    this.trigger.setAttribute("aria-expanded", "true");

    const [firstItem] = getEnabledMenuItems(this.menu);

    firstItem?.focus();

    return true;
  }

  close(options = {}) {
    const { restoreFocus = false } = options;

    if (!this.menu) {
      return false;
    }

    this.menu.hidden = true;

    this.trigger?.setAttribute("aria-expanded", "false");

    if (restoreFocus) {
      this.trigger?.focus();
    }

    return true;
  }

  toggle() {
    return this.isOpen() ? this.close() : this.open();
  }

  /* ========================================================================
     Trigger
     ===================================================================== */

  handleTriggerClick(event) {
    event.preventDefault();
    event.stopPropagation();

    this.toggle();
  }

  /* ========================================================================
     Click Outside
     ===================================================================== */

  handleDocumentClick(event) {
    if (!this.isOpen() || this.root?.contains(event.target)) {
      return;
    }

    this.close();
  }

  /* ========================================================================
     Keyboard
     ===================================================================== */

  handleDocumentKeydown(event) {
    if (event.key !== "Escape" || !this.isOpen()) {
      return;
    }

    event.preventDefault();

    this.close({
      restoreFocus: true,
    });
  }

  handleMenuKeydown(event) {
    const items = getEnabledMenuItems(this.menu);

    if (!items.length) {
      return;
    }

    const currentIndex = items.indexOf(document.activeElement);

    let nextIndex = currentIndex;

    switch (event.key) {
      case "ArrowDown":
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        break;

      case "ArrowUp":
        nextIndex =
          currentIndex < 0
            ? items.length - 1
            : (currentIndex - 1 + items.length) % items.length;
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = items.length - 1;
        break;

      case "Escape":
        event.preventDefault();

        this.close({
          restoreFocus: true,
        });

        return;

      case "Tab":
        this.close();

        return;

      default:
        return;
    }

    event.preventDefault();

    items[nextIndex]?.focus();
  }

  /* ========================================================================
     Actions
     ===================================================================== */

  async execute(action) {
    if (!SUPPORTED_ACTIONS.has(action)) {
      return false;
    }

    this.close();

    let successful = false;

    try {
      switch (action) {
        case MARKET_CHART_EXPORT_ACTIONS.FULLSCREEN:
          successful = await this.toggleFullscreen();
          break;

        case MARKET_CHART_EXPORT_ACTIONS.PRINT:
          successful = this.print();
          break;

        case MARKET_CHART_EXPORT_ACTIONS.PNG:
        case MARKET_CHART_EXPORT_ACTIONS.JPEG:
        case MARKET_CHART_EXPORT_ACTIONS.SVG:
        case MARKET_CHART_EXPORT_ACTIONS.PDF:
          successful = this.exportFile(action);
          break;

        default:
          successful = false;
      }

      this.dispatchAction(action, successful);

      return successful;
    } catch (error) {
      console.error(`Market chart export action "${action}" failed.`, error);

      this.dispatchAction(action, false, error);

      return false;
    }
  }

  dispatchAction(action, successful, error = null) {
    const detail = {
      action,
      successful,
      error,
      chart: this.getChart(),
    };

    if (typeof this.configuration.onAction === "function") {
      this.configuration.onAction(detail);
    }

    this.chartElement?.dispatchEvent(new CustomEvent("marketchart export"));

    /*
     * Use a valid, stable event name for application listeners.
     */

    this.chartElement?.dispatchEvent(
      new CustomEvent("marketchartexport", {
        bubbles: true,
        detail,
      }),
    );
  }

  /* ========================================================================
     Print
     ===================================================================== */

  print() {
    const chart = this.getChart();

    if (!chart || typeof chart.print !== "function") {
      return false;
    }

    chart.print();

    return true;
  }

  /* ========================================================================
     File Export
     ===================================================================== */

  exportFile(format) {
    const chart = this.getChart();
    const type = EXPORT_MIME_TYPES[format];

    if (!chart || !type) {
      return false;
    }

    const exportOptions = {
      type,

      filename: chart.options.exporting?.filename || "market-chart",
    };

    /*
     * Prefer local/offline export when the optional Highcharts Offline
     * Exporting module is available.
     */

    if (typeof chart.exportChartLocal === "function") {
      chart.exportChartLocal(exportOptions);

      return true;
    }

    if (typeof chart.exportChart === "function") {
      chart.exportChart(exportOptions);

      return true;
    }

    return false;
  }

  /* ========================================================================
     Fullscreen
     ===================================================================== */

  isNativeFullscreen() {
    return document.fullscreenElement === this.fullscreenElement;
  }

  isFullscreen() {
    return this.isNativeFullscreen() || this.fallbackFullscreen;
  }

  async toggleFullscreen() {
    if (!this.fullscreenElement) {
      return false;
    }

    if (this.isNativeFullscreen()) {
      await document.exitFullscreen();

      return true;
    }

    if (this.fallbackFullscreen) {
      this.exitFallbackFullscreen();

      return true;
    }

    if (typeof this.fullscreenElement.requestFullscreen === "function") {
      try {
        await this.fullscreenElement.requestFullscreen();

        this.scheduleReflow();

        return true;
      } catch (error) {
        /*
         * Fall back to the CSS fullscreen state if the browser rejects the
         * native Fullscreen API.
         */

        console.warn(
          "Native chart fullscreen was unavailable; using fallback mode.",
          error,
        );
      }
    }

    this.enterFallbackFullscreen();

    return true;
  }

  enterFallbackFullscreen() {
    if (!this.fullscreenElement) {
      return;
    }

    this.fallbackFullscreen = true;

    this.fullscreenElement.classList.add("is-fullscreen");

    document.documentElement.classList.add("has-chart-fullscreen");

    this.scheduleReflow();
  }

  exitFallbackFullscreen() {
    if (!this.fullscreenElement) {
      return;
    }

    this.fallbackFullscreen = false;

    this.fullscreenElement.classList.remove("is-fullscreen");

    document.documentElement.classList.remove("has-chart-fullscreen");

    this.scheduleReflow();
  }

  handleFullscreenChange() {
    this.scheduleReflow();
  }

  scheduleReflow() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (typeof this.configuration.onReflow === "function") {
          this.configuration.onReflow();
        }
      });
    });
  }

  /* ========================================================================
     Destruction
     ===================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.close();

    if (this.fallbackFullscreen) {
      this.exitFallbackFullscreen();
    }

    this.abortController.abort();

    this.destroyed = true;
  }
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createMarketChartExportController(configuration) {
  return new MarketChartExportController(configuration).initialize();
}
