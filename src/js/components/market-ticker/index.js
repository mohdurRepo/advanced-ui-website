/* ==========================================================================
   Market Ticker
   ========================================================================== */

const DEFAULT_SPEED = 48;
const MINIMUM_SPEED = 1;
const MAXIMUM_FRAME_TIME = 0.1;
const MEASUREMENT_TOLERANCE = 0.5;

const POSITION_STORAGE_KEY = "se-market-ticker-position";
const POSITION_SAVE_INTERVAL = 5000;

const controllers = new WeakMap();

/* ==========================================================================
   Helpers
   ========================================================================== */

function getDirection(element = document.documentElement) {
  return getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr";
}

function getLanguage() {
  return document.documentElement.lang || "en";
}

function hasReducedMotion(mediaQuery) {
  return (
    document.documentElement.dataset.motion === "reduce" || mediaQuery.matches
  );
}

function parseNumber(value) {
  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? number : null;
}

function clampProgress(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

function getPriceState(changePercent) {
  const value = parseNumber(changePercent);

  if (value === null || value === 0) {
    return {
      className: "price-neutral",
      iconClass: null,
    };
  }

  if (value > 0) {
    return {
      className: "price-up",
      iconClass: "icon-trending-up",
    };
  }

  return {
    className: "price-down",
    iconClass: "icon-trending-down",
  };
}

function getSafeUrl(value, fallback = "#") {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  try {
    const url = new URL(value, window.location.origin);

    if (!["http:", "https:"].includes(url.protocol)) {
      return fallback;
    }

    return url.href;
  } catch {
    return fallback;
  }
}

function getTickerData(root) {
  const sourceId = root.dataset.marketTickerSource;

  if (!sourceId) {
    return [];
  }

  const source = document.getElementById(sourceId);

  if (!source) {
    return [];
  }

  try {
    const data = JSON.parse(source.textContent);

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Market ticker data could not be parsed.", error);

    return [];
  }
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
}

function readStoredPosition() {
  try {
    const value = Number.parseFloat(
      window.sessionStorage.getItem(POSITION_STORAGE_KEY),
    );

    return Number.isFinite(value) ? clampProgress(value) : null;
  } catch {
    return null;
  }
}

function writeStoredPosition(value) {
  try {
    window.sessionStorage.setItem(
      POSITION_STORAGE_KEY,
      String(clampProgress(value)),
    );
  } catch {
    /*
     * Ticker continues normally when storage is unavailable.
     */
  }
}

function addMediaQueryListener(mediaQuery, listener) {
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", listener);

    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }

  mediaQuery.addListener(listener);

  return () => {
    mediaQuery.removeListener(listener);
  };
}

/* ==========================================================================
   Controller
   ========================================================================== */

class MarketTicker {
  constructor(root, data) {
    this.root = root;
    this.data = data;

    this.viewport = null;
    this.track = null;
    this.sourceList = null;

    this.direction = getDirection(root);
    this.language = getLanguage();

    this.numberFormatter = null;
    this.signedNumberFormatter = null;

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.reducedMotion = hasReducedMotion(this.motionQuery);

    this.speed = DEFAULT_SPEED;

    this.sourceWidth = 0;
    this.position = 0;

    this.measuredViewportWidth = 0;
    this.measuredSourceWidth = 0;

    this.savedPosition = readStoredPosition();

    this.frameId = null;
    this.resizeFrameId = null;
    this.lastTimestamp = null;

    this.positionSaveTimer = null;

    this.pauseReasons = new Set();
    this.cleanups = [];

    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.preferenceObserver = null;

    this.destroyed = false;

    this.handleFrame = this.handleFrame.bind(this);

    this.handlePointerEnter = this.handlePointerEnter.bind(this);

    this.handlePointerLeave = this.handlePointerLeave.bind(this);

    this.handleFocusIn = this.handleFocusIn.bind(this);

    this.handleFocusOut = this.handleFocusOut.bind(this);

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    this.handleMotionChange = this.handleMotionChange.bind(this);

    this.handleResize = this.handleResize.bind(this);

    this.handleImageError = this.handleImageError.bind(this);

    this.handlePageHide = this.handlePageHide.bind(this);
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  init() {
    if (!this.data.length) {
      this.root.hidden = true;

      return;
    }

    this.createFormatters();
    this.render();
    this.updateSpeed();
    this.bindEvents();
    this.configureMotion();

    this.root.classList.add("is-ready");

    this.root.dataset.marketTickerInitialized = "true";

    this.waitForFonts();
  }

  /* ==========================================================================
     Formatting
     ========================================================================== */

  createFormatters() {
    this.numberFormatter = new Intl.NumberFormat(this.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    this.signedNumberFormatter = new Intl.NumberFormat(this.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
    });
  }

  formatNumber(value, signed = false) {
    const number = parseNumber(value);

    if (number === null) {
      return "–";
    }

    return signed
      ? this.signedNumberFormatter.format(number)
      : this.numberFormatter.format(number);
  }

  /* ==========================================================================
     Rendering
     ========================================================================== */

  render() {
    this.viewport = createElement(
      "div",
      "market-ticker__viewport custom-scrollbar",
    );

    this.viewport.dataset.marketTickerViewport = "";

    this.track = createElement("div", "market-ticker__track");

    this.track.dataset.marketTickerTrack = "";

    /*
     * The animation always uses one physical coordinate system.
     */
    this.track.dir = "ltr";

    this.sourceList = this.createList(this.data);

    this.sourceList.dataset.marketTickerList = "";

    /*
     * List geometry also stays physical LTR.
     *
     * Text direction is handled by individual elements.
     */
    this.sourceList.dir = "ltr";

    this.track.append(this.sourceList);

    this.viewport.append(this.track);

    this.root.append(this.viewport);
  }

  createList(items) {
    const list = createElement("ul", "market-ticker__list");

    const fragment = document.createDocumentFragment();

    for (const item of items) {
      fragment.append(this.createItem(item));
    }

    list.append(fragment);

    return list;
  }

  createItem(item) {
    const listItem = createElement("li", "market-ticker__item");

    const link = createElement("a", "market-ticker__link");

    const companyName =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : String(item.symbol || "");

    const price = this.formatNumber(item.price);

    const change = this.formatNumber(item.change, true);

    const changePercent = this.formatNumber(item.changePercent, true);

    const state = getPriceState(item.changePercent);

    link.href = getSafeUrl(item.url);

    link.setAttribute(
      "aria-label",
      `${companyName}, ${price}, ${change}, ${changePercent}%`,
    );

    /* ========================================================================
       Logo
       ======================================================================== */

    const safeLogoUrl = getSafeUrl(item.logo, "");

    if (safeLogoUrl) {
      const logo = createElement("img", "market-ticker__logo");

      logo.src = safeLogoUrl;

      logo.alt = "";

      logo.width = 32;
      logo.height = 32;

      logo.decoding = "async";

      logo.loading = "eager";

      link.append(logo);
    }

    /* ========================================================================
       Company Name
       ======================================================================== */

    const name = createElement("span", "market-ticker__name", companyName);

    /*
     * Allows Arabic and English company names while ticker geometry remains
     * independent from document direction.
     */
    name.dir = "auto";

    /* ========================================================================
       Price
       ======================================================================== */

    const priceElement = createElement("data", "market-ticker__price", price);

    const numericPrice = parseNumber(item.price);

    if (numericPrice !== null) {
      priceElement.value = String(numericPrice);
    }

    /* ========================================================================
       Change
       ======================================================================== */

    const changeElement = createElement(
      "span",
      ["market-ticker__change", state.className].join(" "),
    );

    if (state.iconClass) {
      const directionIcon = createElement(
        "span",
        ["market-ticker__direction", "has-icon", state.iconClass].join(" "),
      );

      directionIcon.setAttribute("aria-hidden", "true");

      changeElement.append(directionIcon);
    }

    const changeValue = createElement("data", "", change);

    const percentageValue = createElement("data", "", `(${changePercent}%)`);

    const numericChange = parseNumber(item.change);

    const numericPercentage = parseNumber(item.changePercent);

    if (numericChange !== null) {
      changeValue.value = String(numericChange);
    }

    if (numericPercentage !== null) {
      percentageValue.value = String(numericPercentage);
    }

    changeElement.append(changeValue, percentageValue);

    link.append(name, priceElement, changeElement);

    listItem.append(link);

    return listItem;
  }

  /* ==========================================================================
     Image Errors
     ========================================================================== */

  handleImageError(event) {
    const image = event.target;

    if (
      image instanceof HTMLImageElement &&
      image.classList.contains("market-ticker__logo")
    ) {
      image.hidden = true;
    }
  }

  /* ==========================================================================
     Presentation Copies
     ========================================================================== */

  createClone() {
    const clone = this.sourceList.cloneNode(true);

    clone.dataset.marketTickerClone = "";

    clone.removeAttribute("data-market-ticker-list");

    clone.dir = "ltr";

    /*
     * Clones provide visual continuity only.
     */
    clone.setAttribute("aria-hidden", "true");

    clone.setAttribute("inert", "");

    for (const link of clone.querySelectorAll("a")) {
      link.tabIndex = -1;
    }

    return clone;
  }

  removeCopies() {
    if (!this.track) {
      return;
    }

    const copies = this.track.querySelectorAll("[data-market-ticker-clone]");

    for (const copy of copies) {
      copy.remove();
    }
  }

  createCopies() {
    const trailingCopyCount = Math.max(
      2,
      Math.ceil(this.measuredViewportWidth / this.sourceWidth) + 1,
    );

    /*
     * Same geometry in both directions:
     *
     * [clone][SOURCE][clone][clone][clone]
     */

    const leadingClone = this.createClone();

    this.track.insertBefore(leadingClone, this.sourceList);

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < trailingCopyCount; index += 1) {
      fragment.append(this.createClone());
    }

    this.track.append(fragment);
  }

  /* ==========================================================================
     Position State
     ========================================================================== */

  getNormalizedPosition(direction = this.direction) {
    if (this.sourceWidth <= 0) {
      return 0;
    }

    if (direction === "rtl") {
      /*
       * RTL animation range:
       *
       * -W -> 0
       *
       * Normalized:
       *
       * 0 -> 1
       */
      return clampProgress(
        (this.position + this.sourceWidth) / this.sourceWidth,
      );
    }

    /*
     * LTR animation range:
     *
     * -W -> -2W
     *
     * Normalized:
     *
     * 0 -> 1
     */
    return clampProgress(
      (-this.position - this.sourceWidth) / this.sourceWidth,
    );
  }

  setPositionFromProgress(progress, direction = this.direction) {
    const normalized = clampProgress(progress);

    if (direction === "rtl") {
      /*
       * -W -> 0
       */
      this.position = -this.sourceWidth + this.sourceWidth * normalized;

      return;
    }

    /*
     * -W -> -2W
     */
    this.position = -this.sourceWidth - this.sourceWidth * normalized;
  }

  savePosition() {
    if (this.destroyed || this.reducedMotion || this.sourceWidth <= 0) {
      return;
    }

    writeStoredPosition(this.getNormalizedPosition());
  }

  /* ==========================================================================
     Rebuild
     ========================================================================== */

  rebuildCopies({ progress = null } = {}) {
    if (this.destroyed || !this.viewport || !this.track || !this.sourceList) {
      return;
    }

    /*
     * Preserve current cycle progress before changing geometry.
     *
     * On first initialization sourceWidth is still zero, so use the stored
     * session value instead.
     */
    const preservedProgress =
      progress ??
      (this.sourceWidth > 0
        ? this.getNormalizedPosition()
        : this.savedPosition) ??
      0;

    this.stopAnimation();
    this.removeCopies();

    this.sourceWidth = this.sourceList.getBoundingClientRect().width;

    this.measuredSourceWidth = this.sourceWidth;

    this.measuredViewportWidth = this.viewport.clientWidth;

    if (
      this.reducedMotion ||
      this.sourceWidth <= 0 ||
      this.measuredViewportWidth <= 0
    ) {
      this.position = 0;

      this.applyPosition();

      return;
    }

    this.createCopies();

    this.setPositionFromProgress(preservedProgress);

    this.applyPosition();

    /*
     * Stored page-load position is consumed after successful geometry has
     * been established. Subsequent rebuilds preserve live progress.
     */
    this.savedPosition = null;

    this.startAnimation();
  }

  /* ==========================================================================
     Speed
     ========================================================================== */

  updateSpeed() {
    const computedSpeed = Number.parseFloat(
      getComputedStyle(this.root).getPropertyValue("--market-ticker-speed"),
    );

    this.speed =
      Number.isFinite(computedSpeed) && computedSpeed >= MINIMUM_SPEED
        ? computedSpeed
        : DEFAULT_SPEED;
  }

  /* ==========================================================================
     Animation
     ========================================================================== */

  applyPosition() {
    if (!this.track) {
      return;
    }

    this.track.style.transform = `translate3d(${this.position}px, 0, 0)`;
  }

  handleFrame(timestamp) {
    this.frameId = null;

    if (
      this.destroyed ||
      this.pauseReasons.size ||
      this.reducedMotion ||
      this.sourceWidth <= 0
    ) {
      this.lastTimestamp = null;

      return;
    }

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
    }

    /*
     * Clamp unusually long frames so tab suspension or main-thread stalls
     * cannot cause large ticker jumps.
     */
    const elapsed = Math.min(
      (timestamp - this.lastTimestamp) / 1000,
      MAXIMUM_FRAME_TIME,
    );

    const distance = this.speed * elapsed;

    if (this.direction === "rtl") {
      /*
       * RTL:
       *
       * Move physically right:
       *
       * -W -> 0
       */
      this.position += distance;

      if (this.position >= 0) {
        this.position -= this.sourceWidth;
      }
    } else {
      /*
       * LTR:
       *
       * Move physically left:
       *
       * -W -> -2W
       */
      this.position -= distance;

      if (this.position <= -this.sourceWidth * 2) {
        this.position += this.sourceWidth;
      }
    }

    this.applyPosition();

    this.lastTimestamp = timestamp;

    this.startAnimation();
  }

  startAnimation() {
    if (
      this.destroyed ||
      this.frameId !== null ||
      this.pauseReasons.size ||
      this.reducedMotion ||
      this.sourceWidth <= 0
    ) {
      return;
    }

    this.root.classList.remove("is-paused");

    this.frameId = window.requestAnimationFrame(this.handleFrame);
  }

  stopAnimation() {
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);

      this.frameId = null;
    }

    this.lastTimestamp = null;
  }

  setPaused(reason, paused) {
    if (paused) {
      this.pauseReasons.add(reason);
    } else {
      this.pauseReasons.delete(reason);
    }

    if (this.pauseReasons.size) {
      this.root.classList.add("is-paused");

      this.stopAnimation();

      return;
    }

    this.root.classList.remove("is-paused");

    this.startAnimation();
  }

  /* ==========================================================================
     Interaction
     ========================================================================== */

  handlePointerEnter() {
    this.setPaused("pointer", true);
  }

  handlePointerLeave() {
    this.setPaused("pointer", false);
  }

  handleFocusIn() {
    this.setPaused("focus", true);
  }

  handleFocusOut(event) {
    if (event.relatedTarget && this.root.contains(event.relatedTarget)) {
      return;
    }

    this.setPaused("focus", false);
  }

  handlePageHide() {
    this.savePosition();
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.savePosition();
    }

    this.setPaused("document-hidden", document.hidden);
  }

  handleMotionChange() {
    this.configureMotion();
  }

  /* ==========================================================================
     Measurement
     ========================================================================== */

  handleResize() {
    if (this.destroyed || this.resizeFrameId !== null) {
      return;
    }

    this.resizeFrameId = window.requestAnimationFrame(() => {
      this.resizeFrameId = null;

      if (this.destroyed || !this.root.isConnected) {
        return;
      }

      /*
       * Capture progress using the CURRENT direction before updating any
       * direction state.
       */
      const currentDirection = this.direction;

      const progress =
        this.sourceWidth > 0
          ? this.getNormalizedPosition(currentDirection)
          : this.savedPosition;

      const nextDirection = getDirection(this.root);

      const nextViewportWidth = this.viewport.clientWidth;

      const nextSourceWidth = this.sourceList.getBoundingClientRect().width;

      const directionChanged = nextDirection !== currentDirection;

      const viewportChanged =
        Math.abs(nextViewportWidth - this.measuredViewportWidth) >
        MEASUREMENT_TOLERANCE;

      const sourceChanged =
        Math.abs(nextSourceWidth - this.measuredSourceWidth) >
        MEASUREMENT_TOLERANCE;

      if (!directionChanged && !viewportChanged && !sourceChanged) {
        return;
      }

      this.direction = nextDirection;

      this.updateSpeed();

      this.rebuildCopies({
        progress,
      });
    });
  }

  /* ==========================================================================
     Reduced Motion
     ========================================================================== */

  configureMotion() {
    const previousReducedMotion = this.reducedMotion;

    this.reducedMotion = hasReducedMotion(this.motionQuery);

    if (this.reducedMotion) {
      /*
       * Save live position before switching to the static/manual mode.
       */
      if (!previousReducedMotion) {
        this.savePosition();
      }

      this.pauseReasons.add("reduced-motion");

      this.root.classList.add("is-paused");

      this.stopAnimation();
      this.removeCopies();

      this.position = 0;

      this.applyPosition();

      if (this.viewport) {
        this.viewport.scrollLeft = 0;
      }

      return;
    }

    this.pauseReasons.delete("reduced-motion");

    this.rebuildCopies();
  }

  /* ==========================================================================
     Events and Observers
     ========================================================================== */

  bindEvents() {
    this.viewport.addEventListener("pointerenter", this.handlePointerEnter);

    this.viewport.addEventListener("pointerleave", this.handlePointerLeave);

    this.root.addEventListener("focusin", this.handleFocusIn);

    this.root.addEventListener("focusout", this.handleFocusOut);

    /*
     * Capture image errors because native image error events do not bubble.
     */
    this.root.addEventListener("error", this.handleImageError, true);

    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    window.addEventListener("pagehide", this.handlePageHide);

    const removeMotionListener = addMediaQueryListener(
      this.motionQuery,
      this.handleMotionChange,
    );

    /*
     * Persist transient progress occasionally.
     *
     * This avoids the legacy pattern of writing storage every animation frame.
     */
    this.positionSaveTimer = window.setInterval(() => {
      this.savePosition();
    }, POSITION_SAVE_INTERVAL);

    this.cleanups.push(() => {
      this.viewport?.removeEventListener(
        "pointerenter",
        this.handlePointerEnter,
      );

      this.viewport?.removeEventListener(
        "pointerleave",
        this.handlePointerLeave,
      );

      this.root.removeEventListener("focusin", this.handleFocusIn);

      this.root.removeEventListener("focusout", this.handleFocusOut);

      this.root.removeEventListener("error", this.handleImageError, true);

      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );

      window.removeEventListener("pagehide", this.handlePageHide);

      removeMotionListener();

      if (this.positionSaveTimer !== null) {
        window.clearInterval(this.positionSaveTimer);

        this.positionSaveTimer = null;
      }
    });

    /* ========================================================================
       Resize
       ======================================================================== */

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);

      this.resizeObserver.observe(this.viewport);

      /*
       * Font loading and application text-size preferences can change the
       * source width independently of viewport width.
       */
      this.resizeObserver.observe(this.sourceList);
    } else {
      window.addEventListener("resize", this.handleResize, {
        passive: true,
      });

      this.cleanups.push(() => {
        window.removeEventListener("resize", this.handleResize);
      });
    }

    /* ========================================================================
       Viewport Visibility
       ======================================================================== */

    if ("IntersectionObserver" in window) {
      const bounds = this.root.getBoundingClientRect();

      const initiallyOutsideViewport =
        bounds.bottom <= 0 || bounds.top >= window.innerHeight;

      this.setPaused("outside-viewport", initiallyOutsideViewport);

      this.intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          this.setPaused("outside-viewport", !entry.isIntersecting);
        },
        {
          threshold: 0,
        },
      );

      this.intersectionObserver.observe(this.root);
    }

    /* ========================================================================
       Preferences / Direction / Language
       ======================================================================== */

    this.preferenceObserver = new MutationObserver((mutations) => {
      const attributes = new Set(
        mutations.map((mutation) => mutation.attributeName),
      );

      /*
       * Theme and accent are deliberately not observed.
       *
       * The ticker is visually independent from page theme switching.
       */

      if (attributes.has("data-ticker-speed")) {
        this.updateSpeed();
      }

      if (attributes.has("dir") || attributes.has("lang")) {
        const oldDirection = this.direction;

        const progress =
          this.sourceWidth > 0
            ? this.getNormalizedPosition(oldDirection)
            : this.savedPosition;

        const nextDirection = getDirection(this.root);

        const directionChanged = nextDirection !== oldDirection;

        const languageChanged = attributes.has("lang");

        this.direction = nextDirection;

        if (languageChanged) {
          this.language = getLanguage();

          this.createFormatters();
        }

        if (directionChanged || languageChanged) {
          this.rebuildCopies({
            progress,
          });
        }
      }

      if (attributes.has("data-motion")) {
        this.configureMotion();
      }

      if (attributes.has("data-ticker-visibility")) {
        const hidden =
          document.documentElement.dataset.tickerVisibility === "hidden";

        if (hidden) {
          this.savePosition();
        }

        this.setPaused("preference-hidden", hidden);

        /*
         * display:none prevents useful measurements.
         */
        if (!hidden) {
          this.handleResize();
        }
      }
    });

    this.preferenceObserver.observe(document.documentElement, {
      attributes: true,

      attributeFilter: [
        "data-motion",
        "data-ticker-speed",
        "data-ticker-visibility",
        "dir",
        "lang",
      ],
    });

    this.setPaused("document-hidden", document.hidden);

    this.setPaused(
      "preference-hidden",
      document.documentElement.dataset.tickerVisibility === "hidden",
    );
  }

  /* ==========================================================================
     Fonts
     ========================================================================== */

  waitForFonts() {
    if (!document.fonts?.ready) {
      return;
    }

    document.fonts.ready
      .then(() => {
        if (this.destroyed || !this.root.isConnected) {
          return;
        }

        /*
         * Loaded font metrics may differ from fallback font metrics.
         */
        this.handleResize();
      })
      .catch(() => {
        /*
         * Fallback font metrics remain usable.
         */
      });
  }

  /* ==========================================================================
     Cleanup
     ========================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    /*
     * Persist final progress before destroying the controller.
     */
    this.savePosition();

    this.destroyed = true;

    this.stopAnimation();

    if (this.resizeFrameId !== null) {
      window.cancelAnimationFrame(this.resizeFrameId);

      this.resizeFrameId = null;
    }

    this.resizeObserver?.disconnect();

    this.intersectionObserver?.disconnect();

    this.preferenceObserver?.disconnect();

    for (const cleanup of this.cleanups) {
      cleanup();
    }

    this.cleanups = [];

    this.pauseReasons.clear();

    this.root.classList.remove("is-ready", "is-paused");

    this.root.removeAttribute("data-market-ticker-initialized");

    this.viewport?.remove();

    this.viewport = null;
    this.track = null;
    this.sourceList = null;

    controllers.delete(this.root);
  }
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initMarketTicker(container = document) {
  const roots = [];

  if (
    container instanceof Element &&
    container.matches("[data-market-ticker]")
  ) {
    roots.push(container);
  }

  roots.push(...container.querySelectorAll("[data-market-ticker]"));

  for (const root of roots) {
    if (controllers.has(root)) {
      continue;
    }

    const data = getTickerData(root);

    const controller = new MarketTicker(root, data);

    controllers.set(root, controller);

    controller.init();
  }
}

export function destroyMarketTicker(container = document) {
  const roots = [];

  if (
    container instanceof Element &&
    container.matches("[data-market-ticker]")
  ) {
    roots.push(container);
  }

  roots.push(...container.querySelectorAll("[data-market-ticker]"));

  for (const root of roots) {
    controllers.get(root)?.destroy();
  }
}
