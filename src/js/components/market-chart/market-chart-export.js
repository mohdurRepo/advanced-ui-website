/* ==========================================================================
   Market Chart Export
   ========================================================================== */

/* ==========================================================================
   Export Actions
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

const IMAGE_ACTIONS = new Set([
  MARKET_CHART_EXPORT_ACTIONS.PNG,
  MARKET_CHART_EXPORT_ACTIONS.JPEG,
  MARKET_CHART_EXPORT_ACTIONS.SVG,
]);

const EXPORT_MIME_TYPES = Object.freeze({
  [MARKET_CHART_EXPORT_ACTIONS.PNG]: "image/png",
  [MARKET_CHART_EXPORT_ACTIONS.JPEG]: "image/jpeg",
  [MARKET_CHART_EXPORT_ACTIONS.SVG]: "image/svg+xml",
  [MARKET_CHART_EXPORT_ACTIONS.PDF]: "application/pdf",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && value.ownerDocument);
}

function isPromiseLike(value) {
  return Boolean(value && typeof value.then === "function");
}

function resolveElement(root, target) {
  if (isElement(target)) {
    return target;
  }

  if (typeof target === "string" && isElement(root)) {
    try {
      return root.querySelector(target);
    } catch {
      return null;
    }
  }

  return null;
}

function getEnabledMenuItems(menu) {
  if (!isElement(menu)) {
    return [];
  }

  return [
    ...menu.querySelectorAll(
      [
        '[role="menuitem"]',
        ":not(:disabled)",
        ':not([aria-disabled="true"])',
        ":not([hidden])",
      ].join(""),
    ),
  ];
}

function normalizeAction(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeFilenamePart(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 120);
}

/* ==========================================================================
   Filename
   ========================================================================== */

export function normalizeMarketChartExportFilename(
  value,
  fallback = "market-chart",
) {
  const normalizedFallback = normalizeFilenamePart(fallback) || "market-chart";

  return normalizeFilenamePart(value) || normalizedFallback;
}

/* ==========================================================================
   Export Controller
   ========================================================================== */

export class MarketChartExportController {
  constructor(configuration = {}) {
    const safeConfiguration =
      configuration &&
      typeof configuration === "object" &&
      !Array.isArray(configuration)
        ? configuration
        : {};

    this.configuration = {
      root: null,

      chartElement: null,
      fullscreenElement: null,

      trigger: ".chart-export__trigger",
      menu: ".chart-export-menu",
      actionSelector: "[data-export-action]",

      getChart: null,
      getFilename: null,

      allowServerExport: true,
      pdfEnabled: true,

      fallbackFullscreenClass: "is-fullscreen",

      onReflow: null,
      onAction: null,

      ...safeConfiguration,
    };

    this.chartElement = isElement(this.configuration.chartElement)
      ? this.configuration.chartElement
      : null;

    this.root = isElement(this.configuration.root)
      ? this.configuration.root
      : this.chartElement?.closest(
          [
            "[data-performance-chart]",
            ".performance-chart",
            "[data-market-detail-panel]",
          ].join(","),
        ) || null;

    this.document =
      this.root?.ownerDocument ||
      this.chartElement?.ownerDocument ||
      globalThis.document ||
      null;

    this.window = this.document?.defaultView || globalThis.window || globalThis;

    this.fullscreenElement = isElement(this.configuration.fullscreenElement)
      ? this.configuration.fullscreenElement
      : this.root;

    this.trigger = resolveElement(this.root, this.configuration.trigger);

    this.menu = resolveElement(this.root, this.configuration.menu);

    const AbortControllerConstructor =
      this.window?.AbortController || globalThis.AbortController;

    this.abortController =
      typeof AbortControllerConstructor === "function"
        ? new AbortControllerConstructor()
        : null;

    this.initialized = false;
    this.destroyed = false;

    this.fallbackFullscreen = false;
    this.inFlightAction = null;

    this.reflowFrames = new Set();

    this.handleTriggerClick = this.handleTriggerClick.bind(this);

    this.handleDocumentClick = this.handleDocumentClick.bind(this);

    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);

    this.handleMenuClick = this.handleMenuClick.bind(this);

    this.handleMenuKeydown = this.handleMenuKeydown.bind(this);

    this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
  }

  /* ========================================================================
     Event Listener
     ======================================================================== */

  addEventListener(target, type, listener, options = {}) {
    if (!target || typeof target.addEventListener !== "function") {
      return;
    }

    const listenerOptions = this.abortController
      ? {
          ...options,
          signal: this.abortController.signal,
        }
      : options;

    target.addEventListener(type, listener, listenerOptions);
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  initialize() {
    if (this.destroyed || this.initialized) {
      return this;
    }

    this.addEventListener(this.trigger, "click", this.handleTriggerClick);

    this.addEventListener(this.menu, "click", this.handleMenuClick);

    this.addEventListener(this.menu, "keydown", this.handleMenuKeydown);

    this.addEventListener(this.document, "click", this.handleDocumentClick);

    this.addEventListener(this.document, "keydown", this.handleDocumentKeydown);

    this.addEventListener(
      this.document,
      "fullscreenchange",
      this.handleFullscreenChange,
    );

    this.close({
      restoreFocus: false,
    });

    this.updateCapabilities();

    this.initialized = true;

    return this;
  }

  /* ========================================================================
     Chart
     ======================================================================== */

  getChart() {
    if (this.destroyed || typeof this.configuration.getChart !== "function") {
      return null;
    }

    let chart = null;

    try {
      chart = this.configuration.getChart();
    } catch {
      return null;
    }

    if (!chart || chart.destroyed || !chart.renderTo) {
      return null;
    }

    return chart;
  }

  /* ========================================================================
     Export Capabilities
     ======================================================================== */

  hasLocalExport() {
    const chart = this.getChart();

    return Boolean(chart && typeof chart.exportChartLocal === "function");
  }

  hasStandardExport() {
    const chart = this.getChart();

    return Boolean(chart && typeof chart.exportChart === "function");
  }

  canUseStandardExport() {
    return Boolean(
      this.configuration.allowServerExport !== false &&
      this.hasStandardExport(),
    );
  }

  canExportImages() {
    return this.hasLocalExport() || this.canUseStandardExport();
  }

  hasLocalPdfDependencies() {
    const hasJsPdf = Boolean(this.window?.jspdf?.jsPDF || this.window?.jsPDF);

    const hasSvgToPdf = Boolean(this.window?.svg2pdf || this.window?.svg2pdfjs);

    return hasJsPdf && hasSvgToPdf;
  }

  canExportPdf() {
    if (this.configuration.pdfEnabled === false) {
      return false;
    }

    if (this.canUseStandardExport()) {
      return true;
    }

    return Boolean(this.hasLocalExport() && this.hasLocalPdfDependencies());
  }

  isActionSupported(action) {
    const normalizedAction = normalizeAction(action);
    const chart = this.getChart();

    if (!chart || !SUPPORTED_ACTIONS.has(normalizedAction)) {
      return false;
    }

    if (IMAGE_ACTIONS.has(normalizedAction)) {
      return this.canExportImages();
    }

    switch (normalizedAction) {
      case MARKET_CHART_EXPORT_ACTIONS.FULLSCREEN:
        return Boolean(this.fullscreenElement);

      case MARKET_CHART_EXPORT_ACTIONS.PRINT:
        return typeof chart.print === "function";

      case MARKET_CHART_EXPORT_ACTIONS.PDF:
        return this.canExportPdf();

      default:
        return false;
    }
  }

  updateCapabilities() {
    if (!this.menu) {
      return;
    }

    const busy = Boolean(this.inFlightAction);

    const buttons = [
      ...this.menu.querySelectorAll(this.configuration.actionSelector),
    ];

    buttons.forEach((button) => {
      const action = normalizeAction(button.dataset.exportAction);

      const supported =
        SUPPORTED_ACTIONS.has(action) && this.isActionSupported(action);

      const disabled = !supported || busy;

      button.disabled = disabled;

      button.setAttribute("aria-disabled", String(disabled));

      if (action === MARKET_CHART_EXPORT_ACTIONS.PDF) {
        button.hidden = !supported;
      } else {
        button.hidden = false;
      }
    });

    if (this.trigger) {
      const hasAvailableAction = buttons.some(
        (button) => !button.hidden && !button.disabled,
      );

      this.trigger.disabled = !hasAvailableAction || busy;

      this.trigger.setAttribute(
        "aria-disabled",
        String(!hasAvailableAction || busy),
      );
    }
  }
  /* ========================================================================
     Menu State
     ======================================================================== */

  isOpen() {
    return Boolean(this.menu && this.menu.hidden === false);
  }

  open({ focusFirst = true } = {}) {
    if (
      this.destroyed ||
      this.inFlightAction ||
      !this.trigger ||
      !this.menu ||
      this.trigger.disabled ||
      this.trigger.getAttribute("aria-disabled") === "true"
    ) {
      return false;
    }

    this.updateCapabilities();

    const enabledItems = getEnabledMenuItems(this.menu);

    if (!enabledItems.length) {
      return false;
    }

    this.menu.hidden = false;

    this.trigger.setAttribute("aria-expanded", "true");

    if (focusFirst) {
      enabledItems[0]?.focus({
        preventScroll: true,
      });
    }

    return true;
  }

  close({ restoreFocus = false } = {}) {
    if (!this.menu) {
      return false;
    }

    const wasOpen = this.isOpen();

    this.menu.hidden = true;

    this.trigger?.setAttribute("aria-expanded", "false");

    if (restoreFocus && wasOpen && this.trigger && !this.trigger.disabled) {
      this.trigger.focus({
        preventScroll: true,
      });
    }

    return wasOpen;
  }

  toggle() {
    if (this.isOpen()) {
      return this.close({
        restoreFocus: true,
      });
    }

    return this.open({
      focusFirst: true,
    });
  }

  /* ========================================================================
     Trigger Events
     ======================================================================== */

  handleTriggerClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.destroyed || this.inFlightAction) {
      return;
    }

    this.toggle();
  }

  /* ========================================================================
     Document Events
     ======================================================================== */

  handleDocumentClick(event) {
    if (!this.isOpen()) {
      return;
    }

    const target = event.target;

    if (this.trigger?.contains(target) || this.menu?.contains(target)) {
      return;
    }

    this.close({
      restoreFocus: false,
    });
  }

  handleDocumentKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    if (this.isOpen()) {
      event.preventDefault();
      event.stopPropagation();

      this.close({
        restoreFocus: true,
      });

      return;
    }

    if (this.isFullscreen()) {
      event.preventDefault();

      void this.exitFullscreen();
    }
  }

  /* ========================================================================
     Menu Events
     ======================================================================== */

  handleMenuClick(event) {
    const actionElement = event.target?.closest?.(
      this.configuration.actionSelector,
    );

    if (!actionElement || !this.menu?.contains(actionElement)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (
      actionElement.disabled ||
      actionElement.getAttribute("aria-disabled") === "true" ||
      actionElement.hidden
    ) {
      return;
    }

    const action = normalizeAction(actionElement.dataset.exportAction);

    if (!SUPPORTED_ACTIONS.has(action)) {
      return;
    }

    this.close({
      restoreFocus: true,
    });

    void this.execute(action);
  }

  handleMenuKeydown(event) {
    if (!this.isOpen()) {
      return;
    }

    const items = getEnabledMenuItems(this.menu);

    if (!items.length) {
      if (event.key === "Escape") {
        event.preventDefault();

        this.close({
          restoreFocus: true,
        });
      }

      return;
    }

    const activeElement = this.document?.activeElement;

    const currentIndex = items.indexOf(activeElement);

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
        event.stopPropagation();

        this.close({
          restoreFocus: true,
        });

        return;

      case "Tab":
        this.close({
          restoreFocus: false,
        });

        return;

      default:
        return;
    }

    event.preventDefault();

    items[nextIndex]?.focus({
      preventScroll: true,
    });
  }
  /* ========================================================================
     Action Execution
     ======================================================================== */

  async execute(action) {
    const normalizedAction = normalizeAction(action);

    if (
      this.destroyed ||
      this.inFlightAction ||
      !SUPPORTED_ACTIONS.has(normalizedAction)
    ) {
      return false;
    }

    if (!this.isActionSupported(normalizedAction)) {
      const error = new Error(
        `Market chart export action "${normalizedAction}" is unavailable.`,
      );

      this.dispatchAction(normalizedAction, false, error);

      return false;
    }

    this.inFlightAction = normalizedAction;

    this.root?.setAttribute("data-chart-export-busy", "true");

    this.trigger?.setAttribute("aria-busy", "true");

    this.close({
      restoreFocus: false,
    });

    this.updateCapabilities();

    try {
      let result = false;

      switch (normalizedAction) {
        case MARKET_CHART_EXPORT_ACTIONS.FULLSCREEN:
          result = await this.toggleFullscreen();

          break;

        case MARKET_CHART_EXPORT_ACTIONS.PRINT:
          result = this.print();

          break;

        case MARKET_CHART_EXPORT_ACTIONS.PNG:
        case MARKET_CHART_EXPORT_ACTIONS.JPEG:
        case MARKET_CHART_EXPORT_ACTIONS.SVG:
        case MARKET_CHART_EXPORT_ACTIONS.PDF:
          result = this.exportFile(normalizedAction);

          if (isPromiseLike(result)) {
            result = await result;
          }

          break;

        default:
          result = false;
      }

      const successful = result !== false;

      if (!this.destroyed) {
        this.dispatchAction(normalizedAction, successful);
      }

      return successful;
    } catch (error) {
      console.error(
        `Market chart export action "${normalizedAction}" failed.`,
        error,
      );

      if (!this.destroyed) {
        this.dispatchAction(normalizedAction, false, error);
      }

      return false;
    } finally {
      this.inFlightAction = null;

      if (!this.destroyed) {
        this.root?.removeAttribute("data-chart-export-busy");

        this.trigger?.removeAttribute("aria-busy");

        this.updateCapabilities();
      }
    }
  }

  /* ========================================================================
     Action Notification
     ======================================================================== */

  createActionEvent(detail) {
    const CustomEventConstructor =
      this.window?.CustomEvent || globalThis.CustomEvent;

    if (typeof CustomEventConstructor === "function") {
      return new CustomEventConstructor("marketchartexport", {
        bubbles: true,
        detail,
      });
    }

    const EventConstructor = this.window?.Event || globalThis.Event;

    if (typeof EventConstructor !== "function") {
      return null;
    }

    const event = new EventConstructor("marketchartexport", {
      bubbles: true,
    });

    Object.defineProperty(event, "detail", {
      value: detail,
      enumerable: true,
    });

    return event;
  }

  dispatchAction(action, successful, error = null) {
    const detail = Object.freeze({
      action,
      successful: Boolean(successful),
      error,

      chart: this.getChart(),
      controller: this,
    });

    if (typeof this.configuration.onAction === "function") {
      try {
        this.configuration.onAction(detail);
      } catch (callbackError) {
        console.error("Market chart export callback failed.", callbackError);
      }
    }

    const event = this.createActionEvent(detail);

    if (event) {
      this.chartElement?.dispatchEvent(event);
    }
  }

  /* ========================================================================
     Print
     ======================================================================== */

  print() {
    const chart = this.getChart();

    if (!chart || typeof chart.print !== "function") {
      return false;
    }

    chart.print();

    return true;
  }

  /* ========================================================================
     Export Filename
     ======================================================================== */

  getExportFilename(chart) {
    let configuredFilename = null;

    if (typeof this.configuration.getFilename === "function") {
      try {
        configuredFilename = this.configuration.getFilename({
          chart,
          controller: this,
        });
      } catch (error) {
        console.error("Market chart export filename callback failed.", error);
      }
    }

    return normalizeMarketChartExportFilename(
      configuredFilename || chart?.options?.exporting?.filename,
      "market-chart",
    );
  }

  /* ========================================================================
     File Export
     ======================================================================== */

  exportFile(format) {
    const normalizedFormat = normalizeAction(format);

    const chart = this.getChart();

    const type = EXPORT_MIME_TYPES[normalizedFormat];

    if (!chart || !type) {
      return false;
    }

    if (
      normalizedFormat === MARKET_CHART_EXPORT_ACTIONS.PDF &&
      !this.canExportPdf()
    ) {
      return false;
    }

    const exportOptions = {
      type,

      filename: this.getExportFilename(chart),
    };

    const canUseLocalExport =
      this.hasLocalExport() &&
      (normalizedFormat !== MARKET_CHART_EXPORT_ACTIONS.PDF ||
        this.hasLocalPdfDependencies());

    if (canUseLocalExport) {
      const result = chart.exportChartLocal(exportOptions);

      return result ?? true;
    }

    if (this.canUseStandardExport()) {
      const result = chart.exportChart(exportOptions);

      return result ?? true;
    }

    return false;
  }
  /* ========================================================================
     Fullscreen State
     ======================================================================== */

  isNativeFullscreen() {
    return Boolean(this.document?.fullscreenElement === this.fullscreenElement);
  }

  isFullscreen() {
    return Boolean(this.isNativeFullscreen() || this.fallbackFullscreen);
  }

  updateFullscreenState() {
    const fullscreen = this.isFullscreen();

    const fullscreenActions = this.menu
      ? [
          ...this.menu.querySelectorAll(
            `[data-export-action="${MARKET_CHART_EXPORT_ACTIONS.FULLSCREEN}"]`,
          ),
        ]
      : [];

    fullscreenActions.forEach((actionElement) => {
      actionElement.setAttribute("aria-pressed", String(fullscreen));
    });

    this.fullscreenElement?.classList.toggle(
      "is-native-fullscreen",
      this.isNativeFullscreen(),
    );

    return fullscreen;
  }

  async toggleFullscreen() {
    return this.isFullscreen() ? this.exitFullscreen() : this.enterFullscreen();
  }

  /* ========================================================================
     Enter Fullscreen
     ======================================================================== */

  async enterFullscreen() {
    if (this.destroyed || !this.fullscreenElement) {
      return false;
    }

    if (this.isFullscreen()) {
      return true;
    }

    if (typeof this.fullscreenElement.requestFullscreen === "function") {
      try {
        await this.fullscreenElement.requestFullscreen();

        this.updateFullscreenState();
        this.scheduleReflow();

        return true;
      } catch {
        /*
         * Native fullscreen may be blocked by browser policy.
         * Continue with the CSS fallback.
         */
      }
    }

    return this.enterFallbackFullscreen();
  }

  /* ========================================================================
     Exit Fullscreen
     ======================================================================== */

  async exitFullscreen() {
    if (this.isNativeFullscreen()) {
      if (typeof this.document?.exitFullscreen !== "function") {
        return false;
      }

      await this.document.exitFullscreen();

      this.updateFullscreenState();
      this.scheduleReflow();

      return true;
    }

    if (this.fallbackFullscreen) {
      return this.exitFallbackFullscreen();
    }

    return false;
  }

  /* ========================================================================
     CSS Fullscreen Fallback
     ======================================================================== */

  getFallbackFullscreenClass() {
    const className = String(
      this.configuration.fallbackFullscreenClass || "is-fullscreen",
    ).trim();

    return className || "is-fullscreen";
  }

  enterFallbackFullscreen() {
    if (this.destroyed || !this.fullscreenElement) {
      return false;
    }

    if (this.fallbackFullscreen) {
      return true;
    }

    this.fallbackFullscreen = true;

    this.fullscreenElement.classList.add(this.getFallbackFullscreenClass());

    this.document?.documentElement.classList.add("has-chart-fullscreen");

    this.updateFullscreenState();
    this.scheduleReflow();

    return true;
  }

  exitFallbackFullscreen() {
    if (!this.fullscreenElement) {
      return false;
    }

    const wasFullscreen = this.fallbackFullscreen;

    this.fallbackFullscreen = false;

    this.fullscreenElement.classList.remove(this.getFallbackFullscreenClass());

    this.document?.documentElement.classList.remove("has-chart-fullscreen");

    this.updateFullscreenState();

    if (wasFullscreen) {
      this.scheduleReflow();
    }

    return wasFullscreen;
  }

  handleFullscreenChange() {
    if (this.destroyed) {
      return;
    }

    this.updateFullscreenState();
    this.scheduleReflow();
  }

  /* ========================================================================
     Chart Reflow
     ======================================================================== */

  cancelScheduledReflow() {
    const cancelFrame =
      this.window?.cancelAnimationFrame?.bind(this.window) ||
      this.window?.clearTimeout?.bind(this.window);

    this.reflowFrames.forEach((frame) => {
      cancelFrame?.(frame);
    });

    this.reflowFrames.clear();
  }

  scheduleReflow() {
    if (this.destroyed) {
      return;
    }

    this.cancelScheduledReflow();

    const requestFrame =
      this.window?.requestAnimationFrame?.bind(this.window) ||
      ((callback) => this.window?.setTimeout?.(callback, 0));

    if (typeof requestFrame !== "function") {
      this.reflowChart();

      return;
    }

    const firstFrame = requestFrame(() => {
      this.reflowFrames.delete(firstFrame);

      if (this.destroyed) {
        return;
      }

      const secondFrame = requestFrame(() => {
        this.reflowFrames.delete(secondFrame);

        if (!this.destroyed) {
          this.reflowChart();
        }
      });

      if (secondFrame !== undefined) {
        this.reflowFrames.add(secondFrame);
      }
    });

    if (firstFrame !== undefined) {
      this.reflowFrames.add(firstFrame);
    }
  }

  reflowChart() {
    if (this.destroyed) {
      return;
    }

    const chart = this.getChart();

    try {
      if (typeof this.configuration.onReflow === "function") {
        this.configuration.onReflow({
          chart,
          controller: this,
        });

        return;
      }

      chart?.reflow?.();
    } catch (error) {
      console.error("Market chart reflow failed.", error);
    }
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.close({
      restoreFocus: false,
    });

    this.cancelScheduledReflow();

    if (this.fallbackFullscreen) {
      this.fallbackFullscreen = false;

      this.fullscreenElement?.classList.remove(
        this.getFallbackFullscreenClass(),
      );

      this.document?.documentElement.classList.remove("has-chart-fullscreen");
    }

    if (
      this.isNativeFullscreen() &&
      typeof this.document?.exitFullscreen === "function"
    ) {
      Promise.resolve(this.document.exitFullscreen()).catch(() => {});
    }

    this.abortController?.abort();

    this.root?.removeAttribute("data-chart-export-busy");

    this.trigger?.removeAttribute("aria-busy");

    this.trigger?.setAttribute("aria-expanded", "false");

    this.fullscreenElement?.classList.remove("is-native-fullscreen");

    this.inFlightAction = null;
    this.initialized = false;
    this.destroyed = true;
  }
}

/* ==========================================================================
   Factory
   ========================================================================== */

export function createMarketChartExportController(configuration = {}) {
  return new MarketChartExportController(configuration).initialize();
}
